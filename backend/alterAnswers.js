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
      ALTER TABLE project_steps 
      ADD COLUMN client_form_answers JSON;
    `);

    console.log('client_form_answers added to project_steps.');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Column already exists.');
    } else {
      console.error(err);
    }
  } finally {
    if (c) await c.end();
  }
}
run();
