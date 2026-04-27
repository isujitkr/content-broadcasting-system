const ContentModel = require('../models/content.model');
const UserModel = require('../models/user.model');
const { cacheGet, cacheSet } = require('../config/redis');
const { pool } = require('../config/database');

const computeTTL = (timeRemainingSeconds) => {
  if (!timeRemainingSeconds || timeRemainingSeconds <= 0) return 10;
  return Math.min(Math.max(Math.floor(timeRemainingSeconds), 5), 300);
};

class SchedulingService {
  static async _resolveTeacher(identifier) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (uuidRegex.test(identifier)) return UserModel.findById(identifier);

    return null;
  }

  static async getLiveContent(teacherIdentifier, subject = null) {
    const teacher = await this._resolveTeacher(teacherIdentifier);

    if (!teacher) {
      return { available: false, message: 'Invalid Url', data: null };
    }
    
    const cacheKey = subject
      ? `live:teacher:${teacher.id}:sub:${subject}`
      : `live:teacher:${teacher.id}`;

    const cached = await cacheGet(cacheKey);
    if (cached) {
      return this._refreshTimeRemaining(cached);
    }

    const liveItems = await ContentModel.findActiveLiveContent(teacher.id, subject || null);

    if (!liveItems || liveItems.length === 0) {
      const emptyResult = { available: false, message: 'No content available', data: null };
      await cacheSet(cacheKey, emptyResult, 10);
      return emptyResult;
    }

    const grouped = this._groupBySubject(liveItems);

    if (Object.keys(grouped).length === 0) {
      const emptyResult = { available: false, message: 'No content available', data: null };
      await cacheSet(cacheKey, emptyResult, 10);
      return emptyResult;
    }

    const now = Date.now();
    const broadcastResult = {};
    let minTimeRemaining = Infinity;

    for (const [subjectKey, items] of Object.entries(grouped)) {
      if (items.length === 0) continue;

      const activeItem = this._computeActiveItem(items, now);
      if (activeItem) {
        broadcastResult[subjectKey] = this._formatContentItem(activeItem, teacher);

        if (activeItem._time_remaining_seconds < minTimeRemaining) {
          minTimeRemaining = activeItem._time_remaining_seconds;
        }
      }
    }

    if (Object.keys(broadcastResult).length === 0) {
      const emptyResult = { available: false, message: 'No content available', data: null };
      await cacheSet(cacheKey, emptyResult, 10);
      return emptyResult;
    }

    const result = {
      available: true,
      message: 'Content is live',
      teacher: { id: teacher.id, name: teacher.name },
      data: broadcastResult,
      fetched_at: new Date().toISOString(),
      _cached_at_ms: now,
      _min_time_remaining_seconds: isFinite(minTimeRemaining) ? minTimeRemaining : 300,
    };

    const ttl = computeTTL(result._min_time_remaining_seconds);
    await cacheSet(cacheKey, result, ttl);

    return this._stripInternalFields(result);
  }

  static _refreshTimeRemaining(cached) {
    if (!cached.available || !cached._cached_at_ms) {
      return this._stripInternalFields(cached);
    }

    const elapsedSec = Math.floor((Date.now() - cached._cached_at_ms) / 1000);
    const refreshed = { ...cached, data: { ...cached.data } };

    for (const subjectKey of Object.keys(refreshed.data)) {
      const item = { ...refreshed.data[subjectKey] };
      const schedule = { ...item.schedule };
      if (schedule.time_remaining_seconds !== null) {
        schedule.time_remaining_seconds = Math.max(0, schedule.time_remaining_seconds - elapsedSec);
      }
      item.schedule = schedule;
      refreshed.data[subjectKey] = item;
    }

    return this._stripInternalFields(refreshed);
  }

  static _stripInternalFields(result) {
    const { _cached_at_ms, _min_time_remaining_seconds, ...clean } = result;
    return clean;
  }

  static _groupBySubject(items) {
    return items.reduce((acc, item) => {
      const key = item.subject;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }

  static _computeActiveItem(items, nowMs) {
    const sorted = [...items].sort((a, b) => {
      const orderA = a.rotation_order ?? 9999;
      const orderB = b.rotation_order ?? 9999;
      return orderA - orderB;
    });

    const totalCycleMs = sorted.reduce((sum, item) => {
      const durationMinutes = item.duration || 5;
      return sum + durationMinutes * 60 * 1000;
    }, 0);

    if (totalCycleMs === 0) return sorted[0];

    const startTimeMs = new Date(sorted[0].start_time).getTime();
    const elapsedMs = (nowMs - startTimeMs) % totalCycleMs;

    let accumulatedMs = 0;

    for (const item of sorted) {
      const durationMs = (item.duration || 5) * 60 * 1000;
      accumulatedMs += durationMs;
      if (elapsedMs < accumulatedMs) {
        const timeIntoSlotMs = elapsedMs - (accumulatedMs - durationMs);
        const timeRemainingMs = durationMs - timeIntoSlotMs;
        item._time_remaining_seconds = Math.floor(timeRemainingMs / 1000);
        item._slot_duration_seconds = Math.floor(durationMs / 1000);
        return item;
      }
    }

    return sorted[sorted.length - 1];
  }

  static _formatContentItem(item, teacher) {
    return {
      id: item.id,
      title: item.title,
      description: item.description,
      subject: item.subject,
      file_url: item.file_url,
      file_type: item.file_type,
      teacher: { id: teacher.id, name: teacher.name },
      schedule: {
        start_time: item.start_time,
        end_time: item.end_time,
        slot_duration_seconds: item._slot_duration_seconds || 300,
        time_remaining_seconds: item._time_remaining_seconds || null,
      },
    };
  }

  static async getAllLiveContent() {
    const [teachers] = await pool.query(
      `SELECT id, name, email FROM users WHERE role = 'teacher' AND is_active = TRUE`
    );

    const result = [];

    for (const teacher of teachers) {
      const liveItems = await ContentModel.findActiveLiveContent(teacher.id, null);
      if (liveItems.length > 0) {
        const grouped = this._groupBySubject(liveItems);
        const now = Date.now();
        const teacherBroadcast = { teacher, subjects: {} };

        for (const [subjectKey, items] of Object.entries(grouped)) {
          const activeItem = this._computeActiveItem(items, now);
          if (activeItem) {
            teacherBroadcast.subjects[subjectKey] = this._formatContentItem(activeItem, teacher);
          }
        }

        if (Object.keys(teacherBroadcast.subjects).length > 0) {
          result.push(teacherBroadcast);
        }
      }
    }

    return result;
  }
}

module.exports = SchedulingService;