const db = require('./db');

async function updateLiveDb() {
  const connection = await db.getConnection();
  try {
    console.log('Starting full database schema update for production...');

    // Helper function to safely add columns
    const addColumnIfNotExists = async (table, column, definition) => {
      const [rows] = await connection.query(`SHOW COLUMNS FROM ${table} LIKE '${column}'`);
      if (rows.length === 0) {
        await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        console.log(`✅ Added ${column} to ${table}.`);
      } else {
        console.log(`⏩ ${table}.${column} already exists.`);
      }
    };

    // 1. Users Table Updates
    await addColumnIfNotExists('users', 'username', 'VARCHAR(255) NULL');
    await addColumnIfNotExists('users', 'modules_access', 'JSON NULL');
    await addColumnIfNotExists('users', 'commission_percentage', 'DECIMAL(5,2) DEFAULT 0.00');
    await addColumnIfNotExists('users', 'monthly_goal', 'DECIMAL(12,2) DEFAULT 1000000.00');
    await addColumnIfNotExists('users', 'profile_image_url', 'VARCHAR(255) NULL');

    // Update Role Column to VARCHAR(100) to support Product Manager and all role extensions
    try {
      await connection.query(`ALTER TABLE users MODIFY COLUMN role VARCHAR(100) NOT NULL`);
      console.log('✅ Updated role column to VARCHAR(100) in users table.');
    } catch (e) {
      console.log('⚠️ Error updating role column:', e.message);
    }

    // 2. Data Scoping (created_by)
    await addColumnIfNotExists('clients', 'created_by', 'INT NULL');
    await addColumnIfNotExists('projects', 'created_by', 'INT NULL');
    await addColumnIfNotExists('invoices', 'created_by', 'INT NULL');

    // 3. Commissions
    await addColumnIfNotExists('invoices', 'agent_id', 'INT NULL');
    await addColumnIfNotExists('invoices', 'commission_amount', 'DECIMAL(10,2) DEFAULT 0.00');
    await addColumnIfNotExists('invoice_items', 'category', "VARCHAR(50) DEFAULT 'SERVICE'");

    // 4. Settings Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS settings (
        setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
        setting_value MEDIUMTEXT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    
    try {
      await connection.query(`ALTER TABLE settings MODIFY COLUMN setting_value MEDIUMTEXT NOT NULL`);
      console.log('✅ Updated setting_value to MEDIUMTEXT.');
    } catch (e) {
      console.log('⚠️ Error updating setting_value:', e.message);
    }
    
    console.log('✅ Ensured settings table exists.');

    // Seed default settings if empty
    const [existingSettings] = await connection.query('SELECT COUNT(*) as count FROM settings');
    if (existingSettings[0].count === 0) {
      const defaults = [
        ['company_name', 'Adwise Labs'],
        ['company_email', 'contact@adwiselabs.com'],
        ['company_phone', '+1 (555) 019-2834'],
        ['company_address', '123 Tech Avenue, Suite 400, New York, NY'],
        ['company_website', 'https://adwiselabs.com'],
        ['company_logo_url', '/logo.png'],
        ['tax_number', 'TAX-987654321'],
        ['currency', 'USD'],
        ['currency_symbol', '$'],
        ['invoice_prefix', 'INV-'],
        ['default_terms', 'Payment is due within 15 days of invoice date. Thank you for your business!'],
        ['default_commission_pct', '10.00'],
        ['default_revision_cycles', '2'],
        ['email_notifications', 'true'],
        ['project_updates', 'true']
      ];
      const defaultTermsText = `1. PAYMENT TERMS: Payments are due within 15 days from the date of invoice issuance. Late payments may be subject to a 1.5% monthly service charge.
2. REVISIONS & SCOPE: Any additional feature requests or out-of-scope revisions beyond agreed milestone deliverables will be billed separately.
3. INTELLECTUAL PROPERTY: Final project deliverables and assets will be released to the client upon receipt of 100% full payment.
4. CONFIDENTIALITY: Both parties agree to maintain non-disclosure of proprietary business data and technology shared during project execution.
5. CANCELLATION & REFUNDS: Deposits and work completed prior to cancellation are non-refundable.`;
      
      await connection.query('INSERT IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)', ['terms_and_conditions', defaultTermsText]);
      
      for (const [key, val] of defaults) {
        await connection.query('INSERT IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)', [key, val]);
      }
      console.log('✅ Seeded default system settings.');
    } else {
      const defaultTermsText = `1. PAYMENT TERMS: Payments are due within 15 days from the date of invoice issuance. Late payments may be subject to a 1.5% monthly service charge.
2. REVISIONS & SCOPE: Any additional feature requests or out-of-scope revisions beyond agreed milestone deliverables will be billed separately.
3. INTELLECTUAL PROPERTY: Final project deliverables and assets will be released to the client upon receipt of 100% full payment.
4. CONFIDENTIALITY: Both parties agree to maintain non-disclosure of proprietary business data and technology shared during project execution.
5. CANCELLATION & REFUNDS: Deposits and work completed prior to cancellation are non-refundable.`;
      await connection.query('INSERT IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)', ['terms_and_conditions', defaultTermsText]);
    }

    // 5. Project Categories Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS project_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Ensured project_categories table exists.');

    const [existingCategories] = await connection.query('SELECT COUNT(*) as count FROM project_categories');
    if (existingCategories[0].count === 0) {
      const defaultCategories = [
        'Income Tax Return Filing',
        'Sales Tax Registration',
        'Corporate Tax Filing',
        'Company Registration',
        'Website Development',
        'Logo Design',
        'SEO Optimization'
      ];
      for (const catName of defaultCategories) {
        await connection.query('INSERT IGNORE INTO project_categories (name) VALUES (?)', [catName]);
      }
      console.log('✅ Seeded default project categories.');
    }
    // 6. Step Comments Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS step_comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        step_id INT NOT NULL,
        user_id INT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY step_id (step_id),
        KEY user_id (user_id),
        CONSTRAINT step_comments_ibfk_1 FOREIGN KEY (step_id) REFERENCES project_steps(id) ON DELETE CASCADE,
        CONSTRAINT step_comments_ibfk_2 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Ensured step_comments table exists.');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS step_inhouse_chats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        step_id INT NOT NULL,
        user_id INT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY step_id (step_id),
        KEY user_id (user_id),
        CONSTRAINT step_inhouse_chats_ibfk_1 FOREIGN KEY (step_id) REFERENCES project_steps(id) ON DELETE CASCADE,
        CONSTRAINT step_inhouse_chats_ibfk_2 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Ensured step_inhouse_chats table exists.');

    // 7. Step Activity Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS step_activity (
        id INT AUTO_INCREMENT PRIMARY KEY,
        step_id INT NOT NULL,
        user_id INT NULL,
        action_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY step_id (step_id),
        KEY user_id (user_id),
        CONSTRAINT step_activity_ibfk_1 FOREIGN KEY (step_id) REFERENCES project_steps(id) ON DELETE CASCADE,
        CONSTRAINT step_activity_ibfk_2 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Ensured step_activity table exists.');
    
    // Modify user_id to be nullable for system events
    try {
      await connection.query('ALTER TABLE step_activity MODIFY COLUMN user_id INT NULL');
      console.log('✅ Modified step_activity user_id to be nullable.');
    } catch (e) {
      console.log('⚠️ Error modifying step_activity user_id:', e.message);
    }

    // 8. Payroll Table & Users base_salary
    await addColumnIfNotExists('users', 'base_salary', 'DECIMAL(10,2) DEFAULT 0.00');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS payrolls (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        month VARCHAR(7) NOT NULL,
        base_salary DECIMAL(10,2) DEFAULT 0.00,
        bonus DECIMAL(10,2) DEFAULT 0.00,
        deductions DECIMAL(10,2) DEFAULT 0.00,
        net_salary DECIMAL(10,2) DEFAULT 0.00,
        status ENUM('Pending', 'Paid') DEFAULT 'Pending',
        payment_date DATE NULL,
        payment_method VARCHAR(50) NULL,
        bank_name VARCHAR(100) NULL,
        expense_id INT NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY user_month (user_id, month),
        KEY user_id (user_id),
        KEY expense_id (expense_id),
        CONSTRAINT payrolls_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await addColumnIfNotExists('payrolls', 'overtime_allowance', 'DECIMAL(10,2) DEFAULT 0.00');
    await addColumnIfNotExists('payrolls', 'advance_salary', 'DECIMAL(10,2) DEFAULT 0.00');
    await addColumnIfNotExists('payrolls', 'tax_deduction', 'DECIMAL(10,2) DEFAULT 0.00');
    await addColumnIfNotExists('payrolls', 'other_deductions', 'DECIMAL(10,2) DEFAULT 0.00');
    await addColumnIfNotExists('payrolls', 'gross_salary', 'DECIMAL(10,2) DEFAULT 0.00');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS salary_advances (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        month VARCHAR(7) NOT NULL,
        advance_date DATE NOT NULL,
        amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        payment_method VARCHAR(50) DEFAULT 'Cash',
        bank_name VARCHAR(100) DEFAULT NULL,
        expense_id INT DEFAULT NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY user_id (user_id),
        KEY month (month),
        CONSTRAINT salary_advances_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Ensured salary_advances table exists.');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS project_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY project_user (project_id, user_id),
        KEY project_id (project_id),
        KEY user_id (user_id),
        CONSTRAINT project_members_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        CONSTRAINT project_members_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Ensured project_members table exists.');

    await addColumnIfNotExists('project_steps', 'deadline_status', "ENUM('Accepted', 'Pending Acceptance', 'Appealed', 'Rejected') DEFAULT 'Pending Acceptance'");
    await addColumnIfNotExists('project_steps', 'proposed_deadline', 'DATE NULL');
    await addColumnIfNotExists('project_steps', 'deadline_appeal_reason', 'TEXT NULL');
    await addColumnIfNotExists('project_steps', 'appealed_by', 'INT NULL');
    await addColumnIfNotExists('project_steps', 'appealed_at', 'TIMESTAMP NULL');
    console.log('✅ Ensured project_steps deadline workflow columns exist.');

    // 9. Expense Categories Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS expense_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Ensured expense_categories table exists.');

    const [existingExpCategories] = await connection.query('SELECT COUNT(*) as count FROM expense_categories');
    if (existingExpCategories[0].count === 0) {
      const defaultExpCategories = [
        'Software Subscriptions',
        'Office Supplies',
        'Marketing',
        'Utilities',
        'Payroll',
        'Rent'
      ];
      for (const catName of defaultExpCategories) {
        await connection.query('INSERT IGNORE INTO expense_categories (name) VALUES (?)', [catName]);
      }
      console.log('✅ Seeded default expense categories.');
    }

    await addColumnIfNotExists('expenses', 'category', 'VARCHAR(100) NULL');

    // 12. Notifications Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS notifications (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          message TEXT NOT NULL,
          type VARCHAR(50),
          link VARCHAR(255),
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Ensured notifications table exists.');

    // 13. Salary Penalties Table
    await connection.query(`
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
    console.log('✅ Ensured salary_penalties table exists.');

    // 14. Project Steps New Columns
    await addColumnIfNotExists('project_steps', 'invoice_item_ids', 'JSON DEFAULT NULL');
    await addColumnIfNotExists('project_steps', 'completed_at', 'TIMESTAMP NULL');
    await addColumnIfNotExists('project_steps', 'forgive_late_commission', 'BOOLEAN DEFAULT FALSE');
    await addColumnIfNotExists('project_steps', 'commission_released', 'BOOLEAN DEFAULT FALSE');
    await addColumnIfNotExists('project_steps', 'deliverable_name', 'VARCHAR(255) DEFAULT NULL');
    await addColumnIfNotExists('project_steps', 'deliverable_url', 'VARCHAR(1000) DEFAULT NULL');

    try {
      await connection.query("ALTER TABLE project_steps MODIFY COLUMN status ENUM('Pending', 'In Progress', 'Completed', 'Pending Approval', 'Overdue') DEFAULT 'Pending'");
      console.log('✅ Updated status ENUM in project_steps.');
    } catch (e) {
      console.log('⚠️ Error updating status ENUM:', e.message);
    }
    // 15. Projects Missing Columns
    await addColumnIfNotExists('projects', 'locked_deadline', 'DATE NULL');

    // 16. Commissions Missing Columns
    await addColumnIfNotExists('commissions', 'step_id', 'INT NULL');

    // 17. Client Reviews Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS client_reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        file_url VARCHAR(255),
        deadline DATE,
        status ENUM('Pending Review', 'Approved', 'Revision Requested') DEFAULT 'Pending Review',
        feedback_todos JSON,
        feedback_attachments JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Ensured client_reviews table exists.');

    console.log('\n🎉 Live database update completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  } finally {
    connection.release();
  }
}

module.exports = updateLiveDb;

