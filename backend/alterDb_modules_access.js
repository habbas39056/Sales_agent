const db = require('./db');

async function runMigration() {
  const connection = await db.getConnection();
  try {
    console.log('Starting migration to add username and modules_access to users table...');

    // Check if username column exists
    const [columns1] = await connection.query(`SHOW COLUMNS FROM users LIKE 'username'`);
    if (columns1.length === 0) {
      await connection.query(`ALTER TABLE users ADD COLUMN username VARCHAR(255)`);
      console.log('Added username column.');
    } else {
      console.log('username column already exists.');
    }

    // Check if modules_access column exists
    const [columns2] = await connection.query(`SHOW COLUMNS FROM users LIKE 'modules_access'`);
    if (columns2.length === 0) {
      await connection.query(`ALTER TABLE users ADD COLUMN modules_access JSON`);
      console.log('Added modules_access column.');
    } else {
      console.log('modules_access column already exists.');
    }

    // Update enum for roles to include Employee if it doesn't already
    try {
      await connection.query(`ALTER TABLE users MODIFY COLUMN role ENUM('Admin', 'Project Manager', 'Sales Rep', 'Production', 'QA', 'Client', 'Employee') NOT NULL`);
      console.log('Updated role enum to include Employee.');
    } catch (e) {
      console.log('Error updating role enum:', e.message);
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    connection.release();
    process.exit(0);
  }
}

runMigration();
