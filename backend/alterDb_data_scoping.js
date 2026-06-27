const db = require('./db');

async function migrate() {
  const connection = await db.getConnection();
  try {
    console.log("Adding created_by to clients...");
    await connection.query(`ALTER TABLE clients ADD COLUMN created_by INT`);
    await connection.query(`ALTER TABLE clients ADD CONSTRAINT fk_client_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL`);
    console.log("Done.");

    console.log("Adding created_by to invoices...");
    await connection.query(`ALTER TABLE invoices ADD COLUMN created_by INT`);
    await connection.query(`ALTER TABLE invoices ADD CONSTRAINT fk_invoice_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL`);
    console.log("Done.");

    console.log("Migration complete.");
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
        console.log("Columns already exist, skipping...");
    } else {
        console.error("Migration failed:", error);
    }
  } finally {
    connection.release();
    process.exit(0);
  }
}

migrate();
