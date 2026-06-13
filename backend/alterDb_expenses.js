const pool = require('./db.js');

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        date DATE NOT NULL,
        client VARCHAR(255) NOT NULL,
        description TEXT,
        mode VARCHAR(50),
        bank VARCHAR(100),
        reference VARCHAR(100),
        receipt_amount DECIMAL(10,2) DEFAULT 0.00,
        payment_amount DECIMAL(10,2) DEFAULT 0.00,
        balance DECIMAL(10,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Successfully created expenses table");
  } catch (err) {
    console.error("Error creating table:", err.message);
  } finally {
    process.exit(0);
  }
}
run();
