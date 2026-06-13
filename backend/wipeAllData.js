const mysql = require('mysql2/promise');
require('dotenv').config();

async function wipeAllData() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'Bestfather@51',
      database: 'agency_management'
    });

    console.log('Connected to MySQL. Initiating total wipe...');

    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');

    const tablesToWipe = [
      'expenses',
      'banks',
      'notes',
      'invoice_payments',
      'invoice_items',
      'invoices',
      'deliverables',
      'project_credentials',
      'project_steps',
      'projects',
      'clients'
    ];

    for (const table of tablesToWipe) {
      try {
        await connection.query(`TRUNCATE TABLE \`${table}\``);
        console.log(`Wiped ${table}...`);
      } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') {
          console.log(`Table ${table} does not exist, skipping...`);
        } else {
          console.error(`Error wiping ${table}:`, err.message);
        }
      }
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('All project, client, and financial data successfully wiped.');

  } catch (error) {
    console.error('Fatal Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

wipeAllData();
