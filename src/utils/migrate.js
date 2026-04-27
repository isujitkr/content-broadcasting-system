const { pool } = require('../config/database');

const createTables = async () => {
  const connection = await pool.getConnection();

  try {
    console.log('🔄 Running migrations...');

    // Users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('principal', 'teacher') NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        last_login_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_role (role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ users table ready');

    // Content Slots table (Subject-based broadcast slots)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS content_slots (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        subject VARCHAR(100) NOT NULL UNIQUE,
        display_name VARCHAR(150) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_subject (subject)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ content_slots table ready');

    // Content table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS content (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        subject VARCHAR(100) NOT NULL,
        file_url VARCHAR(500) NOT NULL,
        cloudinary_public_id VARCHAR(500),
        file_type VARCHAR(50) NOT NULL,
        file_size INT NOT NULL,
        file_original_name VARCHAR(255),
        uploaded_by VARCHAR(36) NOT NULL,
        status ENUM('uploaded', 'pending', 'approved', 'rejected') DEFAULT 'pending',
        rejection_reason TEXT,
        approved_by VARCHAR(36),
        approved_at TIMESTAMP NULL,
        rejected_at TIMESTAMP NULL,
        rejected_by VARCHAR(36),
        start_time TIMESTAMP NULL,
        end_time TIMESTAMP NULL,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (rejected_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_subject (subject),
        INDEX idx_status (status),
        INDEX idx_uploaded_by (uploaded_by),
        INDEX idx_start_end_time (start_time, end_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ content table ready');

    // Content Schedule table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS content_schedule (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        content_id VARCHAR(36) NOT NULL,
        slot_id VARCHAR(36) NOT NULL,
        rotation_order INT NOT NULL DEFAULT 0,
        duration INT NOT NULL DEFAULT 5,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE,
        FOREIGN KEY (slot_id) REFERENCES content_slots(id) ON DELETE CASCADE,
        UNIQUE KEY unique_content_slot (content_id, slot_id),
        INDEX idx_slot_id (slot_id),
        INDEX idx_content_id (content_id),
        INDEX idx_rotation_order (rotation_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ content_schedule table ready');

    console.log('\n✅ All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    connection.release();
  }
};

// Run if called directly
if (require.main === module) {
  createTables()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { createTables };