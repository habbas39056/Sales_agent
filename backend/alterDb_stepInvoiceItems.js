const mysql = require('mysql2/promise');
require('dotenv').config();

async function addInvoiceItemIdsColumn() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'Bestfather@51',
      database: process.env.DB_NAME || 'agency_management',
    });

    console.log('Adding invoice_item_ids column to project_steps table...');
    
    // Check if column already exists
    const [columns] = await connection.query(`SHOW COLUMNS FROM project_steps LIKE 'invoice_item_ids'`);
    if (columns.length === 0) {
      await connection.query('ALTER TABLE project_steps ADD COLUMN invoice_item_ids json DEFAULT NULL');
      console.log('Successfully added invoice_item_ids column.');
    } else {
      console.log('Column invoice_item_ids already exists.');
    }
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

addInvoiceItemIdsColumn();
