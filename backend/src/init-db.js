const db = require('./db');
const fs = require('fs');
const path = require('path');

async function initializeDatabase() {
  try {
    console.log('Starting manual database initialization...');
    
    // Check if tables already exist
    const existingTables = await db.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('Existing tables:', existingTables.rows.map(row => row.table_name));
    
    // Create missing tables manually
    const createTablesSQL = `
      -- Attendance sessions table
      CREATE TABLE IF NOT EXISTS attendance_sessions (
        id SERIAL PRIMARY KEY,
        class_id INT REFERENCES classes(id) ON DELETE CASCADE,
        session_date DATE NOT NULL,
        start_time TIME,
        end_time TIME,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
      );

      -- Attendance records table
      CREATE TABLE IF NOT EXISTS attendance_records (
        id SERIAL PRIMARY KEY,
        session_id INT REFERENCES attendance_sessions(id) ON DELETE CASCADE,
        student_id INT REFERENCES students(id) ON DELETE CASCADE,
        present BOOLEAN DEFAULT true,
        method TEXT CHECK (method IN ('qr', 'face', 'manual')),
        confidence FLOAT DEFAULT 1.0,
        timestamp TIMESTAMP DEFAULT now(),
        UNIQUE(session_id, student_id)
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_attendance_sessions_class ON attendance_sessions(class_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date ON attendance_sessions(session_date);
      CREATE INDEX IF NOT EXISTS idx_attendance_sessions_active ON attendance_sessions(is_active);
      CREATE INDEX IF NOT EXISTS idx_attendance_records_session ON attendance_records(session_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_records_student ON attendance_records(student_id);
    `;
    
    await db.query(createTablesSQL);
    console.log('Database tables created successfully!');
    
    // Verify tables were created
    const updatedTables = await db.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('Updated tables:', updatedTables.rows.map(row => row.table_name));
    
    return true;
  } catch (error) {
    console.error('Database initialization error:', error);
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase()
    .then(success => {
      if (success) {
        console.log('Database initialization completed successfully');
        process.exit(0);
      } else {
        console.log('Database initialization failed');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Initialization error:', error);
      process.exit(1);
    });
}

module.exports = { initializeDatabase };
