const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class ContentScheduleModel {

  static async upsert({ content_id, slot_id, rotation_order, duration }) {
    const id = uuidv4();
    await pool.query(
      `INSERT INTO content_schedule (id, content_id, slot_id, rotation_order, duration)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         rotation_order = VALUES(rotation_order),
         duration = VALUES(duration),
         is_active = TRUE`,
      [id, content_id, slot_id, rotation_order, duration]
    );
  }

  static async findBySlot(slot_id) {
    const [rows] = await pool.query(
      `SELECT cs.*, c.title, c.subject, c.file_url, c.status,
              c.start_time, c.end_time, c.uploaded_by
       FROM content_schedule cs
       JOIN content c ON cs.content_id = c.id
       WHERE cs.slot_id = ?
         AND cs.is_active = TRUE
         AND c.status = 'approved'
         AND c.is_deleted = FALSE
       ORDER BY cs.rotation_order ASC`,
      [slot_id]
    );
    return rows;
  }

  static async getMaxRotationOrder(slot_id) {
    const [rows] = await pool.query(
      'SELECT MAX(rotation_order) AS max_order FROM content_schedule WHERE slot_id = ? AND is_active = TRUE',
      [slot_id]
    );
    return rows[0]?.max_order ?? -1;
  }

  static async deactivate(content_id) {
    await pool.query(
      'UPDATE content_schedule SET is_active = FALSE WHERE content_id = ?',
      [content_id]
    );
  }
}

module.exports = ContentScheduleModel;