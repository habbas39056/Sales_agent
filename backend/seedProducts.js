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
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY, 
        name VARCHAR(255) NOT NULL, 
        description TEXT, 
        default_price DECIMAL(10, 2) NOT NULL, 
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await c.query(`
      INSERT INTO products (name, description, default_price) VALUES 
      ('Website Development', 'Custom built responsive website', 1500.00), 
      ('Logo Design', 'Professional logo design package', 300.00), 
      ('SEO Optimization', 'Monthly SEO maintenance and optimization', 500.00)
    `);

    console.log('Products seeded successfully.');
  } catch (err) {
    console.error(err);
  } finally {
    if (c) await c.end();
  }
}
run();
