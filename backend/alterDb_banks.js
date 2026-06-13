const pool = require('./db.js');

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS banks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Successfully created banks table");
  } catch (err) {
    console.error("Error creating table:", err.message);
  } finally {
    process.exit(0);
  }
}
run();
