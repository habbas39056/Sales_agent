const db = require('./backend/config/db');

async function check() {
  try {
    const [projects] = await db.query('SELECT id, title, status FROM projects ORDER BY id DESC LIMIT 5');
    console.log("Projects:", projects);
    
    if (projects.length > 0) {
      const pid = projects[0].id;
      const [steps] = await db.query('SELECT id, title, status, assignee_id, invoice_item_ids, completed_at, forgive_late_commission FROM project_steps WHERE project_id = ?', [pid]);
      console.log("Steps for Project", pid, ":", steps);
      
      const [commissions] = await db.query('SELECT * FROM commissions WHERE project_id = ?', [pid]);
      console.log("Commissions:", commissions);
    }
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
check();
