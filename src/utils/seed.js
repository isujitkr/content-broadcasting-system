const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');

const seed = async () => {
  const connection = await pool.getConnection();

  try {
    console.log('🌱 Seeding database...');

    // Seed default subjects/slots
    const subjects = [
      { subject: 'maths', display_name: 'Mathematics' },
      { subject: 'science', display_name: 'Science' },
      { subject: 'english', display_name: 'English' },
      { subject: 'history', display_name: 'History' },
      { subject: 'geography', display_name: 'Geography' },
      { subject: 'physics', display_name: 'Physics' },
      { subject: 'chemistry', display_name: 'Chemistry' },
      { subject: 'biology', display_name: 'Biology' },
      { subject: 'computer_science', display_name: 'Computer Science' },
      { subject: 'physical_education', display_name: 'Physical Education' },
    ];

    for (const s of subjects) {
      await connection.query(
        `INSERT INTO content_slots (id, subject, display_name)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)`,
        [uuidv4(), s.subject, s.display_name]
      );
    }
    console.log('✅ Subjects seeded');

    // Seed default principal
    const principalPassword = await bcrypt.hash('Principal@123', 12);
    await connection.query(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [uuidv4(), 'Principal Admin', 'principal@school.com', principalPassword, 'principal']
    );
    console.log('✅ Principal seeded: principal@school.com / Principal@123');

    // Seed demo teachers
    const teachers = [
      { name: 'Teacher One', email: 'teacher1@school.com' },
      { name: 'Teacher Two', email: 'teacher2@school.com' },
      { name: 'Teacher Three', email: 'teacher3@school.com' },
    ];

    for (const t of teachers) {
      const teacherPassword = await bcrypt.hash('Teacher@123', 12);
      await connection.query(
        `INSERT INTO users (id, name, email, password_hash, role)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [uuidv4(), t.name, t.email, teacherPassword, 'teacher']
      );
    }
    console.log('✅ Teachers seeded: teacher1@school.com / Teacher@123 (and teacher2, teacher3)');

    console.log('\n✅ Seeding completed successfully!');
    console.log('\n📋 Default Credentials:');
    console.log('  Principal: principal@school.com / Principal@123');
    console.log('  Teacher 1: teacher1@school.com / Teacher@123');
    console.log('  Teacher 2: teacher2@school.com / Teacher@123');
    console.log('  Teacher 3: teacher3@school.com / Teacher@123');
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    throw error;
  } finally {
    connection.release();
  }
};

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { seed };