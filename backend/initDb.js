const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function initDb() {
  let connection;
  try {
    // Connect without database selected first to create it
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'Bestfather@51',
    });

    console.log('Connected to MySQL server.');

    // Create database
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`agency_management\`;`);
    console.log('Database ensured.');

    await connection.query(`USE \`agency_management\`;`);

    // Read schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Split statements by semicolon and execute
    const statements = schema.split(';').filter(stmt => stmt.trim() !== '');

    for (const stmt of statements) {
      if (stmt.trim()) {
        await connection.query(stmt);
      }
    }

    console.log('Schema executed successfully.');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initDb();
