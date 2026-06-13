const db = require('./db');
async function fix() {
  try {
    await db.query('ALTER TABLE revisions CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    console.log('Fixed revisions charset');
    await db.query('ALTER TABLE project_steps CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    console.log('Fixed project_steps charset');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
fix();
