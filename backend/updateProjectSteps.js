const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  let c;
  try {
    c = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Bestfather@51',
      database: 'agency_management'
    });

    await c.query(`
      CREATE TABLE IF NOT EXISTS project_steps (
          id INT AUTO_INCREMENT PRIMARY KEY,
          project_id INT NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          status ENUM('Pending', 'In Progress', 'Completed') DEFAULT 'Pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
    `);

    console.log('project_steps table created successfully.');
  } catch (err) {
    console.error(err);
  } finally {
    if (c) await c.end();
  }
}
run();
