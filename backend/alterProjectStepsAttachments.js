const db = require('./db');

async function main() {
  try {
    await db.query("ALTER TABLE project_steps ADD COLUMN attachments MEDIUMTEXT NULL;");
    console.log("Successfully added attachments column to project_steps.");
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log("Column already exists.");
    } else {
      console.error(err);
    }
  }
  process.exit(0);
}

main();
