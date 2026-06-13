const db = require('./db');

async function run() {
  try {
    await db.query("ALTER TABLE invoices ADD COLUMN bill_from_name VARCHAR(255) DEFAULT 'Adwise Labs'");
    await db.query("ALTER TABLE invoices ADD COLUMN bill_from_address TEXT");
    console.log("Added bill_from_name and bill_from_address to invoices");
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log("Fields already exist");
    } else {
      console.error(e);
    }
  }
  process.exit(0);
}

run();
