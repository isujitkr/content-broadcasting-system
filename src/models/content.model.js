const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class ContentModel {
  static async create({
    title,
    description,
    subject,
    file_url,
    cloudinary_public_id,
    file_type,
    file_size,
    file_original_name,
    uploaded_by,
    start_time,
    end_time,
  }) {
    const id = uuidv4();
    
    await pool.query(
      `INSERT INTO content
        (id, title, description, subject, file_url, cloudinary_public_id,
         file_type, file_size, file_original_name, uploaded_by, status, start_time, end_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        id, title, description || null, subject,
        file_url, cloudinary_public_id || null,
        file_type, file_size, file_original_name || null,
        uploaded_by,
        start_time || null, end_time || null,
      ]
    );

    return this.findById(id);
  }

  static async findById(id) {
    const [rows] = await pool.query(
      `SELECT
         c.*,
         u.name AS uploader_name, u.email AS uploader_email,
         a.name AS approver_name,
         r.name AS rejecter_name
       FROM content c
       LEFT JOIN users u ON c.uploaded_by = u.id
       LEFT JOIN users a ON c.approved_by = a.id
       LEFT JOIN users r ON c.rejected_by = r.id
       WHERE c.id = ? AND c.is_deleted = FALSE`,
      [id]
    );
    return rows[0] || null;
  }

  static async findAll({ status, subject, uploaded_by, limit, offset }) {
    let whereClause = 'WHERE c.is_deleted = FALSE';
    const params = [];

    if (status) {
      whereClause += ' AND c.status = ?';
      params.push(status);
    }
    if (subject) {
      whereClause += ' AND c.subject = ?';
      params.push(subject);
    }
    if (uploaded_by) {
      whereClause += ' AND c.uploaded_by = ?';
      params.push(uploaded_by);
    }

    const countQuery = `SELECT COUNT(*) as total FROM content c ${whereClause}`;
    const [[{ total }]] = await pool.query(countQuery, params);

    const dataQuery = `
      SELECT
        c.*,
        u.name AS uploader_name, u.email AS uploader_email,
        a.name AS approver_name
      FROM content c
      LEFT JOIN users u ON c.uploaded_by = u.id
      LEFT JOIN users a ON c.approved_by = a.id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(dataQuery, [...params, limit, offset]);
    return { rows, total: parseInt(total) };
  }

  static async findByTeacher(uploaded_by, { status, subject, limit, offset }) {
    return this.findAll({ uploaded_by, status, subject, limit, offset });
  }

  static async findPending({ limit, offset }) {
    return this.findAll({ status: 'pending', limit, offset });
  }

  static async approve(id, approvedBy) {
    await pool.query(
      `UPDATE content
       SET status = 'approved', approved_by = ?, approved_at = NOW(),
           rejection_reason = NULL, rejected_by = NULL, rejected_at = NULL
       WHERE id = ? AND status = 'pending'`,
      [approvedBy, id]
    );
    return this.findById(id);
  }

  static async reject(id, rejectedBy, rejectionReason) {
    await pool.query(
      `UPDATE content
       SET status = 'rejected', rejected_by = ?, rejected_at = NOW(),
           rejection_reason = ?,
           approved_by = NULL, approved_at = NULL
       WHERE id = ? AND status = 'pending'`,
      [rejectedBy, rejectionReason, id]
    );
    return this.findById(id);
  }

  static async findActiveLiveContent(teacherId, subject = null) {
    let query = `
      SELECT
        c.*,
        cs.duration,
        cs.rotation_order,
        cs.slot_id,
        slot.subject AS slot_subject
      FROM content c
      LEFT JOIN content_schedule cs ON c.id = cs.content_id AND cs.is_active = TRUE
      LEFT JOIN content_slots slot ON cs.slot_id = slot.id
      WHERE c.uploaded_by = ?
        AND c.status = 'approved'
        AND c.is_deleted = FALSE
        AND c.start_time IS NOT NULL
        AND c.end_time IS NOT NULL
        AND NOW() BETWEEN c.start_time AND c.end_time
    `;
    const params = [teacherId];

    if (subject) {
      query += ' AND c.subject = ?';
      params.push(subject);
    }

    query += ' ORDER BY c.subject ASC, cs.rotation_order ASC, c.created_at ASC';

    const [rows] = await pool.query(query, params);
    return rows;
  }

  static async softDelete(id) {
    const [result] = await pool.query(
      'UPDATE content SET is_deleted = TRUE WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }
}

module.exports = ContentModel;