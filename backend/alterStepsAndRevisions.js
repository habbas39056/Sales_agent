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

    console.log('Altering project_steps...');
    try {
      await c.query(`
        ALTER TABLE project_steps 
        ADD COLUMN allow_revision BOOLEAN DEFAULT FALSE;
      `);
      console.log('Added allow_revision to project_steps.');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log('allow_revision already exists in project_steps.');
      else throw e;
    }

    console.log('Altering revisions...');
    try {
      await c.query(`
        ALTER TABLE revisions 
        ADD COLUMN step_id INT,
        ADD COLUMN image_url TEXT,
        ADD FOREIGN KEY (step_id) REFERENCES project_steps(id) ON DELETE CASCADE;
      `);
      console.log('Added step_id and image_url to revisions.');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log('step_id/image_url already exists in revisions.');
      else throw e;
    }

    console.log('Database migration complete.');
  } catch (err) {
    console.error(err);
  } finally {
    if (c) await c.end();
  }
}
run();
