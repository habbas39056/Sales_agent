const db = require('./db');

async function testQuery() {
  try {
    const clientId = 1; // Assuming a client exists
    const [textNotes] = await db.query(`
      SELECT n.*, u.role as created_by_role, u.name as created_by_name
      FROM notes n
      JOIN users u ON n.created_by = u.id
      WHERE n.client_id = ?
      ORDER BY n.created_at DESC
    `, [clientId]);
    console.log("Success:", textNotes);
  } catch (error) {
    console.error("DB Error:", error);
  } finally {
    process.exit(0);
  }
}
testQuery();
