const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class ContentSlotModel {

  static async findBySubject(subject) {
    const [rows] = await pool.query(
      'SELECT * FROM content_slots WHERE subject = ? AND is_active = TRUE',
      [subject.toLowerCase()]
    );
    return rows[0] || null;
  }

  static async findOrCreate(subject) {
    let slot = await this.findBySubject(subject);
    if (!slot) {
      const id = uuidv4();
      const displayName = subject.charAt(0).toUpperCase() + subject.slice(1).replace(/_/g, ' ');
      await pool.query(
        `INSERT INTO content_slots (id, subject, display_name)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)`,
        [id, subject.toLowerCase(), displayName]
      );
      slot = await this.findBySubject(subject);
    }
    return slot;
  }

  static async findAll() {
    const [rows] = await pool.query(
      'SELECT * FROM content_slots WHERE is_active = TRUE ORDER BY subject ASC'
    );
    return rows;
  }
}

module.exports = ContentSlotModel;