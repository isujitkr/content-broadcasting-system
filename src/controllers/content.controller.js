const ContentService = require('../services/content.service');
const SchedulingService = require('../services/scheduling.service');
const {
  successResponse,
  createdResponse,
  errorResponse,
  notFoundResponse,
  paginatedResponse,
} = require('../utils/response');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');

class ContentController {

  static async upload(req, res, next) {
    try {
      const { title, description, subject, start_time, end_time, rotation_duration } = req.body;

      const content = await ContentService.uploadContent(
        { title, description, subject, start_time, end_time, rotation_duration },
        req.file,
        req.user.id
      );

      return createdResponse(res, { content }, 'Content uploaded successfully and pending approval');
    } catch (error) {
      next(error);
    }
  }

  static async getMyContent(req, res, next) {
    try {
      const { page, limit, offset } = getPagination(req.query);
      const { status, subject } = req.query;

      const { rows, total } = await ContentService.getAllContent(
        { status, subject, limit, offset },
        req.user
      );

      const pagination = buildPaginationMeta(total, page, limit);
      return paginatedResponse(res, rows, pagination, 'Content fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getAllContent(req, res, next) {
    try {
      const { page, limit, offset } = getPagination(req.query);
      const { status, subject, teacher_id } = req.query;

      const filters = { status, subject, limit, offset };
      if (teacher_id) filters.uploaded_by = teacher_id;

      const { rows, total } = await ContentService.getAllContent(filters, req.user);

      const pagination = buildPaginationMeta(total, page, limit);
      return paginatedResponse(res, rows, pagination, 'Content fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getPendingContent(req, res, next) {
    try {
      const { page, limit, offset } = getPagination(req.query);
      const { rows, total } = await ContentService.getPendingContent({ limit, offset });
      const pagination = buildPaginationMeta(total, page, limit);
      return paginatedResponse(res, rows, pagination, 'Pending content fetched');
    } catch (error) {
      next(error);
    }
  }

  static async getContentById(req, res, next) {
    try {
      const content = await ContentService.getContentById(req.params.id);

      // Teacher can only see their own content
      if (req.user.role === 'teacher' && content.uploaded_by !== req.user.id) {
        return notFoundResponse(res, 'Content not found');
      }

      return successResponse(res, { content }, 'Content fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  static async approveContent(req, res, next) {
    try {
      const content = await ContentService.approveContent(
        req.params.id,
        req.user.id,
        req.ip
      );
      return successResponse(res, { content }, 'Content approved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async rejectContent(req, res, next) {
    try {
      const content = await ContentService.rejectContent(
        req.params.id,
        req.user.id,
        req.body.rejection_reason,
        req.ip
      );
      return successResponse(res, { content }, 'Content rejected successfully');
    } catch (error) {
      next(error);
    }
  }

  static async deleteContent(req, res, next) {
    try {
      await ContentService.deleteContent(req.params.id, req.user, req.ip);
      return successResponse(res, null, 'Content deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getSubjects(req, res, next) {
    try {
      const subjects = await ContentService.getSubjects();
      return successResponse(res, { subjects }, 'Subjects fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getLiveContent(req, res, next) {
    try {
      const { teacherIdentifier } = req.params;
      const { subject } = req.query;

      const result = await SchedulingService.getLiveContent(teacherIdentifier, subject || null);

      if (!result.available) {
        return res.status(200).json({
          success: true,
          available: false,
          message: 'No content available',
          data: null,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(200).json({
        success: true,
        available: true,
        message: result.message,
        teacher: result.teacher,
        data: result.data,
        fetched_at: result.fetched_at,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAllLiveContent(req, res, next) {
    try {
      const result = await SchedulingService.getAllLiveContent();
      return successResponse(
        res,
        { live_broadcasts: result, count: result.length },
        'Live broadcast overview fetched'
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ContentController;