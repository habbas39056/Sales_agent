const db = require('./db');

async function updateDbForUserDeletion() {
  console.log('--- Updating Database Constraints for User Deletion ---');
  const connection = await db.getConnection();
  try {
    // 1. Modify deliverables.submitted_by to be NULLable
    console.log('1. Modifying deliverables.submitted_by column to allow NULL...');
    await connection.query('ALTER TABLE deliverables MODIFY COLUMN submitted_by INT NULL');

    // Helper to safely drop foreign key if it exists
    const dropFkIfExists = async (table, constraint) => {
      try {
        await connection.query(`ALTER TABLE ${table} DROP FOREIGN KEY ${constraint}`);
        console.log(`Dropped FK ${constraint} on ${table}`);
      } catch (err) {
        if (err.code !== 'ER_CANT_DROP_FIELD_OR_KEY') {
          console.log(`Notice for FK ${constraint} on ${table}: ${err.message}`);
        }
      }
    };

    // 2. Projects FKs
    await dropFkIfExists('projects', 'projects_ibfk_2');
    await dropFkIfExists('projects', 'projects_ibfk_3');
    await connection.query(`
      ALTER TABLE projects 
      ADD CONSTRAINT projects_ibfk_2 FOREIGN KEY (pm_id) REFERENCES users(id) ON DELETE SET NULL,
      ADD CONSTRAINT projects_ibfk_3 FOREIGN KEY (production_id) REFERENCES users(id) ON DELETE SET NULL
    `);
    console.log('Updated projects FKs to ON DELETE SET NULL');

    // 3. Commissions FK
    await dropFkIfExists('commissions', 'commissions_ibfk_2');
    await connection.query(`
      ALTER TABLE commissions 
      ADD CONSTRAINT commissions_ibfk_2 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    `);
    console.log('Updated commissions FK to ON DELETE CASCADE');

    // 4. Deliverables FK
    await dropFkIfExists('deliverables', 'deliverables_ibfk_2');
    await connection.query(`
      ALTER TABLE deliverables 
      ADD CONSTRAINT deliverables_ibfk_2 FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL
    `);
    console.log('Updated deliverables FK to ON DELETE SET NULL');

    // 5. Leads FK (assigned_to)
    await dropFkIfExists('leads', 'leads_user_fk');
    try {
      await connection.query(`
        ALTER TABLE leads 
        ADD CONSTRAINT leads_user_fk FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
      `);
      console.log('Updated leads FK to ON DELETE SET NULL');
    } catch (err) {
      console.log('Leads FK update note:', err.message);
    }

    console.log('✅ Database FK constraints updated successfully!');
  } catch (error) {
    console.error('❌ Error updating DB constraints:', error);
  } finally {
    connection.release();
    process.exit(0);
  }
}

updateDbForUserDeletion();
