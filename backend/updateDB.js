const db = require('./db.js');

async function updateDB() {
  try {
    await db.query('ALTER TABLE project_steps ADD COLUMN completed_at TIMESTAMP NULL, ADD COLUMN forgive_late_commission BOOLEAN DEFAULT FALSE;');
    console.log('Columns added successfully');
  } catch(e) {
    if(e.code === 'ER_DUP_FIELDNAME') console.log('Columns already exist');
    else console.error(e);
  }
  process.exit(0);
}

updateDB();
