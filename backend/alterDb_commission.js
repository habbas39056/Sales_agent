const db = require('./db');

async function updateDb() {
  try {
    console.log('Adding agent_id and commission_amount to invoices table...');
    await db.query(`ALTER TABLE invoices ADD COLUMN agent_id INT NULL`);
    await db.query(`ALTER TABLE invoices ADD COLUMN commission_amount DECIMAL(10,2) DEFAULT 0.00`);
    console.log('Database schema updated successfully.');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('Columns already exist. Skipping.');
    } else {
      console.error('Error updating database:', error);
    }
  } finally {
    process.exit(0);
  }
}

updateDb();
