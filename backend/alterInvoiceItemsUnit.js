const db = require('./db');

async function run() {
  try {
    await db.query("ALTER TABLE invoice_items ADD COLUMN unit VARCHAR(50) DEFAULT ''");
    console.log("Added unit to invoice_items");
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log("Field already exists");
    } else {
      console.error(e);
    }
  }
  process.exit(0);
}

run();
