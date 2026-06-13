const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  let c;
  try {
    c = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Bestfather@51',
      database: 'agency_management'
    });

    await c.query(`
      CREATE TABLE IF NOT EXISTS invoice_payments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          invoice_id INT NOT NULL,
          amount DECIMAL(10, 2) NOT NULL,
          payment_date DATE NOT NULL,
          payment_method VARCHAR(50),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
      );
    `);

    console.log('invoice_payments table created.');
  } catch (err) {
    console.error(err);
  } finally {
    if (c) await c.end();
  }
}
run();
