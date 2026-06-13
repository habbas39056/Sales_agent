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
      ADD COLUMN assignee_id INT,
      ADD COLUMN deadline DATE,
      ADD COLUMN requires_client_form BOOLEAN DEFAULT FALSE,
      ADD COLUMN client_form_schema JSON,
      ADD COLUMN requires_payment BOOLEAN DEFAULT FALSE,
      ADD FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL;
    `);

    console.log('project_steps table altered successfully.');
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
