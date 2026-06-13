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
      ALTER TABLE projects 
      ADD COLUMN service_type VARCHAR(255),
      ADD COLUMN total_steps INT DEFAULT 0,
      ADD COLUMN completed_steps INT DEFAULT 0;
    `);

    console.log('Projects table updated successfully.');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Columns already exist.');
    } else {
      console.error(err);
    }
  } finally {
    if (c) await c.end();
  }
}
run();
