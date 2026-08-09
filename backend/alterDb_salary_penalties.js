const db = require('./db');

async function run() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS salary_penalties (
        id INT(11) NOT NULL AUTO_INCREMENT,
        user_id INT(11) NOT NULL,
        step_id INT(11) NOT NULL,
        month VARCHAR(7) NOT NULL,
        amount DECIMAL(10,2) NOT NULL DEFAULT '0.00',
        reason TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY user_id (user_id),
        KEY step_id (step_id),
        CONSTRAINT salary_penalties_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT salary_penalties_ibfk_2 FOREIGN KEY (step_id) REFERENCES project_steps (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("Table salary_penalties created successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error creating table:", error);
    process.exit(1);
  }
}

run();
