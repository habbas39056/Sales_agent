const db = require('./db');

async function run() {
  try {
    await db.query("ALTER TABLE invoice_payments ADD COLUMN transaction_id VARCHAR(255) AFTER payment_method");
    console.log("Added transaction_id to invoice_payments");
  } catch (err) {
    // Ignore if column already exists (Error code 1060)
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log("Column transaction_id already exists.");
    } else {
      console.error("Error adding column:", err);
    }
  }
  process.exit();
}

run();
