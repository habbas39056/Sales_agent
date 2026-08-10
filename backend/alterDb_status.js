const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'agency_management'
  });

  try {
    const [rows] = await connection.query("SHOW COLUMNS FROM project_steps WHERE Field = 'status'");
    console.log("Current status type:", rows[0].Type);
    
    // Likely ENUM('Pending', 'In Progress', 'Completed') or something similar.
    // We will change it to include 'Pending Approval'
    await connection.query("ALTER TABLE project_steps MODIFY COLUMN status ENUM('Pending', 'In Progress', 'Completed', 'Pending Approval', 'Overdue') DEFAULT 'Pending'");
    console.log("Successfully updated status ENUM");
  } catch(e) {
    console.error(e.message);
  }
  
  await connection.end();
}
run();
