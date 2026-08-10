const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'adwisesales'
  });

  try {
    await connection.query("ALTER TABLE project_steps ADD COLUMN deliverable_name VARCHAR(255) DEFAULT NULL");
    console.log("Added deliverable_name column");
  } catch(e) {
    console.log("Column deliverable_name might already exist", e.message);
  }

  try {
    await connection.query("ALTER TABLE project_steps ADD COLUMN deliverable_url VARCHAR(1000) DEFAULT NULL");
    console.log("Added deliverable_url column");
  } catch(e) {
    console.log("Column deliverable_url might already exist", e.message);
  }

  await connection.end();
}

run();
