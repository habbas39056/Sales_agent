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

    // 4.5. Revisions table
    await addColumnIfNotExists('revisions', 'step_id', 'INT NULL');
    await addColumnIfNotExists('revisions', 'image_url', 'TEXT NULL');

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
        ['currency', 'PKR'],
        ['currency_symbol', 'PKR'],
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
    await addColumnIfNotExists('project_steps', 'reassign_todos', 'LONGTEXT DEFAULT NULL');
    await addColumnIfNotExists('project_steps', 'reject_todos', 'LONGTEXT DEFAULT NULL');

    try {
      await connection.query("ALTER TABLE project_steps MODIFY COLUMN reassign_todos LONGTEXT DEFAULT NULL");
      await connection.query("ALTER TABLE project_steps MODIFY COLUMN reject_todos LONGTEXT DEFAULT NULL");
      await connection.query("UPDATE project_steps SET reassign_todos = NULL WHERE reassign_todos = '0' OR reassign_todos = 0");
      await connection.query("UPDATE project_steps SET reject_todos = NULL WHERE reject_todos = '0' OR reject_todos = 0");
      console.log('✅ Updated reassign_todos and reject_todos column types and cleaned false/0 values.');
    } catch (e) {
      console.log('⚠️ Error modifying reassign_todos/reject_todos:', e.message);
    }

    try {
      await connection.query("ALTER TABLE project_steps MODIFY COLUMN status ENUM('Pending', 'In Progress', 'Completed', 'Pending Approval', 'Overdue') DEFAULT 'Pending'");
      console.log('✅ Updated status ENUM in project_steps.');
    } catch (e) {
      console.log('⚠️ Error updating status ENUM:', e.message);
    }
    // 6. Fix for existing projects without standard dates (optional but helpful)
    await addColumnIfNotExists('projects', 'locked_deadline', 'DATE NULL');
    await addColumnIfNotExists('projects', 'pm_id', 'INT NULL');
    await addColumnIfNotExists('projects', 'production_id', 'INT NULL');

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

    // Quotations Tables
    await connection.query(`
      CREATE TABLE IF NOT EXISTS quotations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quotation_number VARCHAR(50) UNIQUE NOT NULL,
        amount DECIMAL(10,2) DEFAULT 0.00,
        status ENUM('Draft', 'Sent', 'Accepted', 'Rejected') DEFAULT 'Draft',
        client_id INT NULL,
        issue_date DATE,
        expiry_date DATE,
        terms_and_conditions TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by INT NULL,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS quotation_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quotation_id INT NOT NULL,
        description TEXT NOT NULL,
        details TEXT NULL,
        category VARCHAR(50) DEFAULT 'SERVICE',
        unit VARCHAR(50) NULL,
        quantity DECIMAL(10,2) DEFAULT 1.00,
        unit_price DECIMAL(10,2) DEFAULT 0.00,
        total DECIMAL(10,2) DEFAULT 0.00,
        FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await addColumnIfNotExists('quotation_items', 'details', 'TEXT NULL');
    await addColumnIfNotExists('quotation_items', 'category', "VARCHAR(50) DEFAULT 'SERVICE'");
    await addColumnIfNotExists('quotation_items', 'unit', 'VARCHAR(50) NULL');

    await addColumnIfNotExists('quotations', 'manual_client_name', 'VARCHAR(255) NULL');
    await addColumnIfNotExists('quotations', 'manual_client_email', 'VARCHAR(255) NULL');
    await addColumnIfNotExists('quotations', 'manual_client_phone', 'VARCHAR(100) NULL');
    await addColumnIfNotExists('quotations', 'manual_client_business', 'VARCHAR(255) NULL');
    await addColumnIfNotExists('quotations', 'manual_client_address', 'TEXT NULL');
    // 18. Terms and Conditions Templates Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS terms_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL DEFAULT 'General',
        content TEXT NOT NULL,
        is_default TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Ensured terms_templates table exists.');

    // Seed standard templates if empty
    const [existingTerms] = await connection.query('SELECT COUNT(*) as count FROM terms_templates');
    if (existingTerms[0].count === 0) {
      const defaultTemplates = [
        ['Standard Services Terms', 'General', '1. PAYMENT TERMS: Payments are due within 15 days from the date of invoice issuance.\n2. REVISIONS & SCOPE: Additional feature requests beyond milestone deliverables will be billed separately.\n3. INTELLECTUAL PROPERTY: Final project deliverables released upon 100% full payment.\n4. CONFIDENTIALITY: Non-disclosure of proprietary business data and technology.\n5. CANCELLATION: Deposits and work completed prior to cancellation are non-refundable.', 1],
        ['Social Media Marketing', 'Social Media', '1. Content schedule will be submitted 5 business days in advance for approval.\n2. Ad spend budget is paid directly to advertising platforms (Meta/Google).\n3. Monthly analytics reports delivered on the 1st of every month.\n4. 30 days written notice required for monthly campaign cancellations.', 0],
        ['Web Development & Software', 'Web Development', '1. Scope of work strictly based on approved UI/UX mockups and PRD documentation.\n2. Includes 30 days complimentary bug-fixing post live deployment.\n3. Server hosting and third-party API subscription costs are billed to client.\n4. Source code ownership transferred upon final payment settlement.', 0]
      ];
      for (const [title, category, content, isDefault] of defaultTemplates) {
        await connection.query('INSERT IGNORE INTO terms_templates (title, category, content, is_default) VALUES (?, ?, ?, ?)', [title, category, content, isDefault]);
      }
      console.log('✅ Seeded default terms and conditions templates.');
    }

    // 19. Projects Table Upgrades (start_date, remarks, status column)
    await addColumnIfNotExists('projects', 'start_date', 'DATETIME NULL');
    await addColumnIfNotExists('projects', 'remarks', 'TEXT NULL');
    try {
      await connection.query("ALTER TABLE projects MODIFY COLUMN status VARCHAR(100) DEFAULT 'Assigned'");
      console.log('✅ Updated status column to VARCHAR(100) in projects table.');
    } catch (e) {
      console.log('⚠️ Error modifying status column in projects:', e.message);
    }

    // 20. Invoice Payments & Bank Info
    await connection.query(`
      CREATE TABLE IF NOT EXISTS invoice_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_id INT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        payment_date DATE NOT NULL,
        payment_method VARCHAR(50),
        bank VARCHAR(100) DEFAULT NULL,
        transaction_id VARCHAR(255) DEFAULT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await addColumnIfNotExists('invoice_payments', 'bank', 'VARCHAR(100) DEFAULT NULL');
    await addColumnIfNotExists('invoice_payments', 'transaction_id', 'VARCHAR(255) DEFAULT NULL');
    console.log('✅ Ensured invoice_payments table and bank columns exist.');

    // 21. Client Notes Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS client_notes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_id INT NOT NULL,
        note TEXT NOT NULL,
        created_by INT NULL,
        is_admin_note BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    // 22. Future Payables (Scheduled Obligations & Accounts Payable)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS future_payables (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'General',
        amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        due_date DATE NOT NULL,
        priority ENUM('Low', 'Medium', 'High', 'Urgent') DEFAULT 'Medium',
        preferred_bank VARCHAR(100) DEFAULT NULL,
        notes TEXT,
        reference_no VARCHAR(100) DEFAULT NULL,
        recurring_cycle ENUM('One-Time', 'Weekly', 'Monthly', 'Quarterly', 'Yearly') DEFAULT 'One-Time',
        status ENUM('Pending', 'Due Today', 'Overdue', 'Paid', 'Cancelled') DEFAULT 'Pending',
        paid_at DATETIME DEFAULT NULL,
        expense_id INT DEFAULT NULL,
        last_notified_at DATETIME DEFAULT NULL,
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_due_date (due_date),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Ensured future_payables table exists.');

    console.log('\n🎉 Live database update completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  } finally {
    connection.release();
  }
}

module.exports = updateLiveDb;

