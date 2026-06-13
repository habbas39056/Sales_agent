const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function seedUser() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'Bestfather@51',
      database: process.env.DB_NAME || 'agency_management',
    });

    const email = 'admin@adwiselabs.com';
    const plainPassword = 'password123';
    
    // Check if user already exists
    const [rows] = await connection.query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (rows.length === 0) {
      const hash = await bcrypt.hash(plainPassword, 10);
      await connection.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        ['Admin', email, hash, 'Admin']
      );
      console.log(`Admin user seeded: Email: ${email}, Password: ${plainPassword}`);
    } else {
      console.log('Admin user already exists.');
    }

  } catch (error) {
    console.error('Error seeding user:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

seedUser();
