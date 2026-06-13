const db = require('./backend/db');

async function run() {
  try {
    await db.query('ALTER TABLE users ADD COLUMN commission_percentage DECIMAL(5,2) DEFAULT 0.00');
    console.log('Added commission_percentage');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Column already exists');
    } else {
      console.error(err);
    }
  } finally {
    process.exit(0);
  }
}

run();
