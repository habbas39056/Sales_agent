const db = require('./db');

async function createNotesTable() {
  try {
    const connection = await db.getConnection();
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS notes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          client_id INT NOT NULL,
          content TEXT NOT NULL,
          created_by INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    console.log("Notes table created successfully.");
    connection.release();
    process.exit(0);
  } catch (error) {
    console.error("Error creating notes table:", error);
    process.exit(1);
  }
}

createNotesTable();
