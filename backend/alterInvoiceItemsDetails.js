const pool = require('./db.js');

async function run() {
  try {
    await pool.query("ALTER TABLE invoice_items ADD COLUMN details TEXT");
    console.log("Successfully added details column to invoice_items table");
  } catch (err) {
    console.error("Error altering table:", err.message);
  } finally {
    process.exit(0);
  }
}
run();
