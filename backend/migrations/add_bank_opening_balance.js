const db = require('../db');

async function runMigration() {
  try {
    const [columns] = await db.query("SHOW COLUMNS FROM banks LIKE 'opening_balance'");
    if (columns.length === 0) {
      await db.query("ALTER TABLE banks ADD COLUMN opening_balance DECIMAL(12,2) DEFAULT 0.00 AFTER name");
      console.log("Added opening_balance column to banks table successfully.");
    } else {
      console.log("opening_balance column already exists in banks table.");
    }
  } catch (err) {
    console.error("Migration error:", err);
  }
}

runMigration().then(() => process.exit(0));
