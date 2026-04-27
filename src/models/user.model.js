const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

class UserModel {
  static async create({ name, email, password, role }) {
    const id = uuidv4();
    const password_hash = await bcrypt.hash(password, 12);

    const [result] = await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES (?, ?, ?, ?, ?)`,
      [id, name, email, password_hash, role]
    );

    return { id, name, email, role };
  }

  static async findByEmail(email) {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
      [email]
    );
    return rows[0] || null;
  }

  static async findById(id) {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, is_active, last_login_at, created_at FROM users WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  static async findAllTeachers() {
    const [rows] = await pool.query(
      `SELECT id, name, email, is_active, created_at
       FROM users WHERE role = 'teacher' ORDER BY name ASC`
    );
    return rows;
  }

  static async updateLastLogin(id) {
    await pool.query(
      'UPDATE users SET last_login_at = NOW() WHERE id = ?',
      [id]
    );
  }

  static async emailExists(email) {
    const [rows] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    return rows.length > 0;
  }

  static async verifyPassword(plainPassword, hash) {
    return bcrypt.compare(plainPassword, hash);
  }

  
  // Safe user object (no password)
  static sanitize(user) {
    const { password_hash, ...safe } = user;
    return safe;
  }
}

module.exports = UserModel;