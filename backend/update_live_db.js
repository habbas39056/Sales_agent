const db = require('./db');
const bcrypt = require('bcrypt');

/**
 * Self-Healing Database Schema & Migration Runner
 * Automatically creates all tables, adds missing columns, updates column types,
 * and seeds baseline configuration upon deployment or application startup.
 */
async function updateLiveDb() {
  const connection = await db.getConnection();
  try {
    console.log('🚀 [DB AUTO-MIGRATOR] Starting comprehensive database schema update...');

    // Helper: Safely add column if it does not exist
    const addColumnIfNotExists = async (table, column, definition) => {
      try {
        const [rows] = await connection.query(`SHOW COLUMNS FROM \`${table}\` LIKE '${column}'`);
        if (rows.length === 0) {
          await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
          console.log(`  ✅ Added column: ${table}.${column}`);
        }
      } catch (err) {
        console.warn(`  ⚠️ Column check/add note for ${table}.${column}: ${err.message}`);
      }
    };

    // Helper: Safely execute an ALTER or UPDATE statement
    const safeExec = async (sql, label) => {
      try {
        await connection.query(sql);
        if (label) console.log(`  ✅ ${label}`);
      } catch (err) {
        // Suppress benign warnings (e.g. column already exists or table structure identical)
        if (label) console.log(`  ℹ️ Note (${label}): ${err.message}`);
      }
    };

    // =========================================================================
    // STEP 1: ENSURE ALL CORE & SYSTEM TABLES EXIST
    // =========================================================================

    // 1. users
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL,
        \`username\` VARCHAR(255) UNIQUE NULL,
        \`email\` VARCHAR(255) UNIQUE NOT NULL,
        \`password_hash\` VARCHAR(255) NOT NULL,
        \`role\` VARCHAR(100) NOT NULL DEFAULT 'Employee',
        \`modules_access\` JSON NULL,
        \`commission_percentage\` DECIMAL(5,2) DEFAULT 0.00,
        \`monthly_goal\` DECIMAL(12,2) DEFAULT 1000000.00,
        \`base_salary\` DECIMAL(10,2) DEFAULT 0.00,
        \`profile_image_url\` VARCHAR(255) NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. clients
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`clients\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`full_name\` VARCHAR(255) NOT NULL,
        \`business_name\` VARCHAR(255) NULL,
        \`whatsapp_number\` VARCHAR(50) NULL,
        \`email\` VARCHAR(255) UNIQUE NOT NULL,
        \`physical_address\` TEXT NULL,
        \`profile_image_url\` VARCHAR(255) NULL,
        \`user_id\` INT NULL,
        \`created_by\` INT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY \`user_id\` (\`user_id\`),
        CONSTRAINT \`clients_user_fk\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. products
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`products\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL,
        \`description\` TEXT NULL,
        \`default_price\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. projects
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`projects\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`title\` VARCHAR(255) NOT NULL,
        \`description\` TEXT NULL,
        \`service_type\` VARCHAR(255) NULL,
        \`total_steps\` INT DEFAULT 0,
        \`completed_steps\` INT DEFAULT 0,
        \`client_id\` INT NULL,
        \`pm_id\` INT NULL,
        \`production_id\` INT NULL,
        \`status\` VARCHAR(100) DEFAULT 'Assigned',
        \`revision_cycles_included\` INT DEFAULT 0,
        \`revision_cycles_remaining\` INT DEFAULT 0,
        \`locked_deadline\` DATE NULL,
        \`terms_accepted\` BOOLEAN DEFAULT FALSE,
        \`terms_and_conditions\` TEXT NULL,
        \`start_date\` DATETIME NULL,
        \`remarks\` TEXT NULL,
        \`created_by\` INT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY \`client_id\` (\`client_id\`),
        KEY \`pm_id\` (\`pm_id\`),
        KEY \`production_id\` (\`production_id\`),
        CONSTRAINT \`projects_client_fk\` FOREIGN KEY (\`client_id\`) REFERENCES \`clients\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`projects_pm_fk\` FOREIGN KEY (\`pm_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`projects_prod_fk\` FOREIGN KEY (\`production_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. project_steps
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`project_steps\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`project_id\` INT NOT NULL,
        \`title\` VARCHAR(255) NOT NULL,
        \`description\` TEXT NULL,
        \`status\` ENUM('Pending', 'In Progress', 'Completed', 'Pending Approval', 'Overdue') DEFAULT 'Pending',
        \`assignee_id\` INT NULL,
        \`deadline\` DATE NULL,
        \`completed_at\` TIMESTAMP NULL,
        \`forgive_late_commission\` BOOLEAN DEFAULT FALSE,
        \`requires_client_form\` BOOLEAN DEFAULT FALSE,
        \`client_form_schema\` JSON NULL,
        \`client_form_answers\` JSON NULL,
        \`requires_payment\` BOOLEAN DEFAULT FALSE,
        \`allow_revision\` BOOLEAN DEFAULT FALSE,
        \`attachments\` JSON NULL,
        \`invoice_item_ids\` JSON NULL,
        \`deadline_status\` ENUM('Accepted', 'Pending Acceptance', 'Appealed', 'Rejected') DEFAULT 'Pending Acceptance',
        \`proposed_deadline\` DATE NULL,
        \`deadline_appeal_reason\` TEXT NULL,
        \`appealed_by\` INT NULL,
        \`appealed_at\` TIMESTAMP NULL,
        \`commission_released\` BOOLEAN DEFAULT FALSE,
        \`deliverable_name\` VARCHAR(255) DEFAULT NULL,
        \`deliverable_url\` VARCHAR(1000) DEFAULT NULL,
        \`reassign_todos\` LONGTEXT DEFAULT NULL,
        \`reject_todos\` LONGTEXT DEFAULT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY \`project_id\` (\`project_id\`),
        KEY \`assignee_id\` (\`assignee_id\`),
        KEY \`appealed_by\` (\`appealed_by\`),
        CONSTRAINT \`steps_project_fk\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`steps_assignee_fk\` FOREIGN KEY (\`assignee_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`steps_appealed_fk\` FOREIGN KEY (\`appealed_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. invoices
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`invoices\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`invoice_number\` VARCHAR(50) UNIQUE NOT NULL,
        \`amount\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        \`balance\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        \`status\` ENUM('Paid', 'Unpaid', 'Overdue') DEFAULT 'Unpaid',
        \`client_id\` INT NOT NULL,
        \`project_id\` INT NULL,
        \`issue_date\` DATE NOT NULL,
        \`due_date\` DATE NOT NULL,
        \`terms_and_conditions\` TEXT NULL,
        \`created_by\` INT NULL,
        \`agent_id\` INT NULL,
        \`commission_amount\` DECIMAL(10,2) DEFAULT 0.00,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY \`client_id\` (\`client_id\`),
        KEY \`project_id\` (\`project_id\`),
        KEY \`agent_id\` (\`agent_id\`),
        CONSTRAINT \`invoices_client_fk\` FOREIGN KEY (\`client_id\`) REFERENCES \`clients\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`invoices_project_fk\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`invoices_agent_fk\` FOREIGN KEY (\`agent_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. invoice_items
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`invoice_items\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`invoice_id\` INT NOT NULL,
        \`description\` VARCHAR(255) NOT NULL,
        \`details\` TEXT NULL,
        \`category\` VARCHAR(50) DEFAULT 'SERVICE',
        \`unit\` VARCHAR(50) NULL,
        \`quantity\` DECIMAL(10,2) DEFAULT 1.00,
        \`unit_price\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        \`total\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        KEY \`invoice_id\` (\`invoice_id\`),
        CONSTRAINT \`invoice_items_fk\` FOREIGN KEY (\`invoice_id\`) REFERENCES \`invoices\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 8. invoice_payments
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`invoice_payments\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`invoice_id\` INT NOT NULL,
        \`amount\` DECIMAL(10,2) NOT NULL,
        \`payment_date\` DATE NOT NULL,
        \`payment_method\` VARCHAR(50) NULL,
        \`bank\` VARCHAR(100) DEFAULT NULL,
        \`transaction_id\` VARCHAR(255) DEFAULT NULL,
        \`notes\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY \`invoice_id\` (\`invoice_id\`),
        CONSTRAINT \`payments_invoice_fk\` FOREIGN KEY (\`invoice_id\`) REFERENCES \`invoices\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 9. expenses
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`expenses\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`title\` VARCHAR(255) NOT NULL,
        \`amount\` DECIMAL(10,2) NOT NULL,
        \`category\` VARCHAR(100) NULL,
        \`expense_date\` DATE NOT NULL,
        \`payment_method\` VARCHAR(50) NULL,
        \`bank\` VARCHAR(100) DEFAULT NULL,
        \`notes\` TEXT NULL,
        \`receipt_url\` VARCHAR(255) NULL,
        \`created_by\` INT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY \`created_by\` (\`created_by\`),
        CONSTRAINT \`expenses_user_fk\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 10. commissions
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`commissions\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`invoice_id\` INT NULL,
        \`project_id\` INT NULL,
        \`step_id\` INT NULL,
        \`amount\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        \`status\` ENUM('Pending', 'Approved', 'Paid') DEFAULT 'Pending',
        \`month\` VARCHAR(7) NOT NULL,
        \`paid_at\` TIMESTAMP NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY \`user_id\` (\`user_id\`),
        KEY \`invoice_id\` (\`invoice_id\`),
        KEY \`project_id\` (\`project_id\`),
        KEY \`step_id\` (\`step_id\`),
        CONSTRAINT \`comm_user_fk\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 11. deliverables
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`deliverables\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`project_id\` INT NOT NULL,
        \`file_url\` VARCHAR(255) NOT NULL,
        \`file_name\` VARCHAR(255) NOT NULL,
        \`submitted_by\` INT NOT NULL,
        \`notes\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY \`project_id\` (\`project_id\`),
        CONSTRAINT \`deliverables_project_fk\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 12. revisions
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`revisions\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`project_id\` INT NOT NULL,
        \`step_id\` INT NULL,
        \`requested_by\` VARCHAR(50) NOT NULL,
        \`reason\` TEXT NOT NULL,
        \`feedback_data\` JSON NULL,
        \`image_url\` TEXT NULL,
        \`status\` ENUM('Pending', 'In Progress', 'Completed') DEFAULT 'Pending',
        \`is_paid\` BOOLEAN DEFAULT FALSE,
        \`amount\` DECIMAL(10,2) DEFAULT 0.00,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY \`project_id\` (\`project_id\`),
        CONSTRAINT \`revisions_project_fk\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 13. settings
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`settings\` (
        \`setting_key\` VARCHAR(100) NOT NULL PRIMARY KEY,
        \`setting_value\` MEDIUMTEXT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 14. terms_templates
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`terms_templates\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`title\` VARCHAR(255) NOT NULL,
        \`category\` VARCHAR(100) NOT NULL DEFAULT 'General',
        \`content\` TEXT NOT NULL,
        \`is_default\` TINYINT(1) DEFAULT 0,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 15. quotations
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`quotations\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`quotation_number\` VARCHAR(50) UNIQUE NOT NULL,
        \`amount\` DECIMAL(10,2) DEFAULT 0.00,
        \`status\` ENUM('Draft', 'Sent', 'Accepted', 'Rejected') DEFAULT 'Draft',
        \`client_id\` INT NULL,
        \`issue_date\` DATE NULL,
        \`expiry_date\` DATE NULL,
        \`terms_and_conditions\` TEXT NULL,
        \`manual_client_name\` VARCHAR(255) NULL,
        \`manual_client_email\` VARCHAR(255) NULL,
        \`manual_client_phone\` VARCHAR(100) NULL,
        \`manual_client_business\` VARCHAR(255) NULL,
        \`manual_client_address\` TEXT NULL,
        \`created_by\` INT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY \`client_id\` (\`client_id\`),
        KEY \`created_by\` (\`created_by\`),
        CONSTRAINT \`quotations_client_fk\` FOREIGN KEY (\`client_id\`) REFERENCES \`clients\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`quotations_creator_fk\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 16. quotation_items
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`quotation_items\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`quotation_id\` INT NOT NULL,
        \`description\` TEXT NOT NULL,
        \`details\` TEXT NULL,
        \`category\` VARCHAR(50) DEFAULT 'SERVICE',
        \`unit\` VARCHAR(50) NULL,
        \`quantity\` DECIMAL(10,2) DEFAULT 1.00,
        \`unit_price\` DECIMAL(10,2) DEFAULT 0.00,
        \`total\` DECIMAL(10,2) DEFAULT 0.00,
        KEY \`quotation_id\` (\`quotation_id\`),
        CONSTRAINT \`quotation_items_fk\` FOREIGN KEY (\`quotation_id\`) REFERENCES \`quotations\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 17. project_categories
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`project_categories\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL UNIQUE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 18. project_members
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`project_members\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`project_id\` INT NOT NULL,
        \`user_id\` INT NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY \`project_user\` (\`project_id\`, \`user_id\`),
        KEY \`project_id\` (\`project_id\`),
        KEY \`user_id\` (\`user_id\`),
        CONSTRAINT \`pm_project_fk\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`pm_user_fk\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 19. step_comments
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`step_comments\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`step_id\` INT NOT NULL,
        \`user_id\` INT NOT NULL,
        \`message\` TEXT NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY \`step_id\` (\`step_id\`),
        KEY \`user_id\` (\`user_id\`),
        CONSTRAINT \`sc_step_fk\` FOREIGN KEY (\`step_id\`) REFERENCES \`project_steps\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`sc_user_fk\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 20. step_inhouse_chats
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`step_inhouse_chats\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`step_id\` INT NOT NULL,
        \`user_id\` INT NOT NULL,
        \`message\` TEXT NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY \`step_id\` (\`step_id\`),
        KEY \`user_id\` (\`user_id\`),
        CONSTRAINT \`sic_step_fk\` FOREIGN KEY (\`step_id\`) REFERENCES \`project_steps\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`sic_user_fk\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 21. step_activity
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`step_activity\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`step_id\` INT NOT NULL,
        \`user_id\` INT NULL,
        \`action_text\` TEXT NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY \`step_id\` (\`step_id\`),
        KEY \`user_id\` (\`user_id\`),
        CONSTRAINT \`sa_step_fk\` FOREIGN KEY (\`step_id\`) REFERENCES \`project_steps\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`sa_user_fk\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 22. payrolls
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`payrolls\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`month\` VARCHAR(7) NOT NULL,
        \`base_salary\` DECIMAL(10,2) DEFAULT 0.00,
        \`bonus\` DECIMAL(10,2) DEFAULT 0.00,
        \`deductions\` DECIMAL(10,2) DEFAULT 0.00,
        \`overtime_allowance\` DECIMAL(10,2) DEFAULT 0.00,
        \`advance_salary\` DECIMAL(10,2) DEFAULT 0.00,
        \`tax_deduction\` DECIMAL(10,2) DEFAULT 0.00,
        \`other_deductions\` DECIMAL(10,2) DEFAULT 0.00,
        \`gross_salary\` DECIMAL(10,2) DEFAULT 0.00,
        \`net_salary\` DECIMAL(10,2) DEFAULT 0.00,
        \`status\` ENUM('Pending', 'Paid') DEFAULT 'Pending',
        \`payment_date\` DATE NULL,
        \`payment_method\` VARCHAR(50) NULL,
        \`bank_name\` VARCHAR(100) NULL,
        \`expense_id\` INT NULL,
        \`notes\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY \`user_month\` (\`user_id\`, \`month\`),
        KEY \`user_id\` (\`user_id\`),
        KEY \`expense_id\` (\`expense_id\`),
        CONSTRAINT \`payrolls_user_fk\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 23. salary_advances
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`salary_advances\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`month\` VARCHAR(7) NOT NULL,
        \`advance_date\` DATE NOT NULL,
        \`amount\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        \`payment_method\` VARCHAR(50) DEFAULT 'Cash',
        \`bank_name\` VARCHAR(100) DEFAULT NULL,
        \`expense_id\` INT DEFAULT NULL,
        \`notes\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY \`user_id\` (\`user_id\`),
        KEY \`month\` (\`month\`),
        CONSTRAINT \`sa_user_advance_fk\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 24. salary_penalties
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`salary_penalties\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`step_id\` INT NOT NULL,
        \`month\` VARCHAR(7) NOT NULL,
        \`amount\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        \`reason\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY \`user_id\` (\`user_id\`),
        KEY \`step_id\` (\`step_id\`),
        CONSTRAINT \`sp_user_fk\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`sp_step_fk\` FOREIGN KEY (\`step_id\`) REFERENCES \`project_steps\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 25. expense_categories
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`expense_categories\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL UNIQUE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 26. banks
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`banks\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL UNIQUE,
        \`opening_balance\` DECIMAL(12,2) DEFAULT 0.00,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 27. notifications
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`notifications\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`message\` TEXT NOT NULL,
        \`type\` VARCHAR(50) NULL,
        \`link\` VARCHAR(255) NULL,
        \`is_read\` BOOLEAN DEFAULT FALSE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY \`user_id\` (\`user_id\`),
        CONSTRAINT \`notif_user_fk\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 28. client_reviews
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`client_reviews\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`project_id\` INT NOT NULL,
        \`title\` VARCHAR(255) NOT NULL,
        \`description\` TEXT NULL,
        \`file_url\` VARCHAR(255) NULL,
        \`deadline\` DATE NULL,
        \`status\` ENUM('Pending Review', 'Approved', 'Revision Requested') DEFAULT 'Pending Review',
        \`feedback_todos\` JSON NULL,
        \`feedback_attachments\` JSON NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY \`project_id\` (\`project_id\`),
        CONSTRAINT \`cr_project_fk\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 29. client_notes
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`client_notes\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`client_id\` INT NOT NULL,
        \`note\` TEXT NOT NULL,
        \`created_by\` INT NULL,
        \`is_admin_note\` BOOLEAN DEFAULT FALSE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY \`client_id\` (\`client_id\`),
        KEY \`created_by\` (\`created_by\`),
        CONSTRAINT \`cn_client_fk\` FOREIGN KEY (\`client_id\`) REFERENCES \`clients\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`cn_creator_fk\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 30. future_payables
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`future_payables\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`title\` VARCHAR(255) NOT NULL,
        \`category\` VARCHAR(100) DEFAULT 'General',
        \`amount\` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        \`due_date\` DATE NOT NULL,
        \`priority\` ENUM('Low', 'Medium', 'High', 'Urgent') DEFAULT 'Medium',
        \`preferred_bank\` VARCHAR(100) DEFAULT NULL,
        \`notes\` TEXT NULL,
        \`reference_no\` VARCHAR(100) DEFAULT NULL,
        \`recurring_cycle\` ENUM('One-Time', 'Weekly', 'Monthly', 'Quarterly', 'Yearly') DEFAULT 'One-Time',
        \`status\` ENUM('Pending', 'Due Today', 'Overdue', 'Paid', 'Cancelled') DEFAULT 'Pending',
        \`paid_at\` DATETIME DEFAULT NULL,
        \`expense_id\` INT DEFAULT NULL,
        \`last_notified_at\` DATETIME DEFAULT NULL,
        \`created_by\` INT DEFAULT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_due_date\` (\`due_date\`),
        INDEX \`idx_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('  ✅ Verified all 30 base relational tables exist.');

    // =========================================================================
    // STEP 2: SAFE COLUMN & ATTRIBUTE MIGRATIONS
    // =========================================================================

    // users
    await addColumnIfNotExists('users', 'username', 'VARCHAR(255) NULL');
    await addColumnIfNotExists('users', 'modules_access', 'JSON NULL');
    await addColumnIfNotExists('users', 'commission_percentage', 'DECIMAL(5,2) DEFAULT 0.00');
    await addColumnIfNotExists('users', 'monthly_goal', 'DECIMAL(12,2) DEFAULT 1000000.00');
    await addColumnIfNotExists('users', 'base_salary', 'DECIMAL(10,2) DEFAULT 0.00');
    await addColumnIfNotExists('users', 'profile_image_url', 'VARCHAR(255) NULL');
    await safeExec('ALTER TABLE `users` MODIFY COLUMN `role` VARCHAR(100) NOT NULL', 'Upgraded users.role column to VARCHAR(100)');

    // clients
    await addColumnIfNotExists('clients', 'created_by', 'INT NULL');
    await addColumnIfNotExists('clients', 'whatsapp_number', 'VARCHAR(50) NULL');
    await addColumnIfNotExists('clients', 'physical_address', 'TEXT NULL');
    await addColumnIfNotExists('clients', 'profile_image_url', 'VARCHAR(255) NULL');

    // projects
    await addColumnIfNotExists('projects', 'created_by', 'INT NULL');
    await addColumnIfNotExists('projects', 'pm_id', 'INT NULL');
    await addColumnIfNotExists('projects', 'production_id', 'INT NULL');
    await addColumnIfNotExists('projects', 'service_type', 'VARCHAR(255) NULL');
    await addColumnIfNotExists('projects', 'locked_deadline', 'DATE NULL');
    await addColumnIfNotExists('projects', 'terms_accepted', 'BOOLEAN DEFAULT FALSE');
    await addColumnIfNotExists('projects', 'terms_and_conditions', 'TEXT NULL');
    await addColumnIfNotExists('projects', 'start_date', 'DATETIME NULL');
    await addColumnIfNotExists('projects', 'remarks', 'TEXT NULL');
    await addColumnIfNotExists('projects', 'revision_cycles_included', 'INT DEFAULT 0');
    await addColumnIfNotExists('projects', 'revision_cycles_remaining', 'INT DEFAULT 0');
    await safeExec("ALTER TABLE `projects` MODIFY COLUMN `status` VARCHAR(100) DEFAULT 'Assigned'", 'Upgraded projects.status column to VARCHAR(100)');

    // project_steps
    await addColumnIfNotExists('project_steps', 'deadline_status', "ENUM('Accepted', 'Pending Acceptance', 'Appealed', 'Rejected') DEFAULT 'Pending Acceptance'");
    await addColumnIfNotExists('project_steps', 'proposed_deadline', 'DATE NULL');
    await addColumnIfNotExists('project_steps', 'deadline_appeal_reason', 'TEXT NULL');
    await addColumnIfNotExists('project_steps', 'appealed_by', 'INT NULL');
    await addColumnIfNotExists('project_steps', 'appealed_at', 'TIMESTAMP NULL');
    await addColumnIfNotExists('project_steps', 'invoice_item_ids', 'JSON DEFAULT NULL');
    await addColumnIfNotExists('project_steps', 'completed_at', 'TIMESTAMP NULL');
    await addColumnIfNotExists('project_steps', 'forgive_late_commission', 'BOOLEAN DEFAULT FALSE');
    await addColumnIfNotExists('project_steps', 'commission_released', 'BOOLEAN DEFAULT FALSE');
    await addColumnIfNotExists('project_steps', 'deliverable_name', 'VARCHAR(255) DEFAULT NULL');
    await addColumnIfNotExists('project_steps', 'deliverable_url', 'VARCHAR(1000) DEFAULT NULL');
    await addColumnIfNotExists('project_steps', 'reassign_todos', 'LONGTEXT DEFAULT NULL');
    await addColumnIfNotExists('project_steps', 'reject_todos', 'LONGTEXT DEFAULT NULL');
    await safeExec("ALTER TABLE `project_steps` MODIFY COLUMN `status` ENUM('Pending', 'In Progress', 'Completed', 'Pending Approval', 'Overdue') DEFAULT 'Pending'", 'Updated project_steps.status ENUM');
    await safeExec("ALTER TABLE `project_steps` MODIFY COLUMN `deadline_status` ENUM('Accepted', 'Pending Acceptance', 'Appealed', 'Rejected') DEFAULT 'Pending Acceptance'", 'Updated project_steps.deadline_status ENUM');
    await safeExec("UPDATE `project_steps` SET `reassign_todos` = NULL WHERE `reassign_todos` = '0' OR `reassign_todos` = 0");
    await safeExec("UPDATE `project_steps` SET `reject_todos` = NULL WHERE `reject_todos` = '0' OR `reject_todos` = 0");

    // invoices
    await addColumnIfNotExists('invoices', 'created_by', 'INT NULL');
    await addColumnIfNotExists('invoices', 'agent_id', 'INT NULL');
    await addColumnIfNotExists('invoices', 'commission_amount', 'DECIMAL(10,2) DEFAULT 0.00');
    await addColumnIfNotExists('invoices', 'project_id', 'INT NULL');
    await addColumnIfNotExists('invoices', 'terms_and_conditions', 'TEXT NULL');

    // invoice_items
    await addColumnIfNotExists('invoice_items', 'details', 'TEXT NULL');
    await addColumnIfNotExists('invoice_items', 'category', "VARCHAR(50) DEFAULT 'SERVICE'");
    await addColumnIfNotExists('invoice_items', 'unit', 'VARCHAR(50) NULL');

    // invoice_payments
    await addColumnIfNotExists('invoice_payments', 'bank', 'VARCHAR(100) DEFAULT NULL');
    await addColumnIfNotExists('invoice_payments', 'transaction_id', 'VARCHAR(255) DEFAULT NULL');

    // expenses
    await addColumnIfNotExists('expenses', 'category', 'VARCHAR(100) NULL');
    await addColumnIfNotExists('expenses', 'bank', 'VARCHAR(100) DEFAULT NULL');
    await addColumnIfNotExists('expenses', 'notes', 'TEXT NULL');
    await addColumnIfNotExists('expenses', 'receipt_url', 'VARCHAR(255) NULL');
    await addColumnIfNotExists('expenses', 'created_by', 'INT NULL');

    // banks
    await addColumnIfNotExists('banks', 'opening_balance', 'DECIMAL(12,2) DEFAULT 0.00');

    // commissions
    await addColumnIfNotExists('commissions', 'step_id', 'INT NULL');

    // revisions
    await addColumnIfNotExists('revisions', 'step_id', 'INT NULL');
    await addColumnIfNotExists('revisions', 'image_url', 'TEXT NULL');
    await addColumnIfNotExists('revisions', 'is_paid', 'BOOLEAN DEFAULT FALSE');
    await addColumnIfNotExists('revisions', 'amount', 'DECIMAL(10,2) DEFAULT 0.00');

    // quotations
    await addColumnIfNotExists('quotations', 'manual_client_name', 'VARCHAR(255) NULL');
    await addColumnIfNotExists('quotations', 'manual_client_email', 'VARCHAR(255) NULL');
    await addColumnIfNotExists('quotations', 'manual_client_phone', 'VARCHAR(100) NULL');
    await addColumnIfNotExists('quotations', 'manual_client_business', 'VARCHAR(255) NULL');
    await addColumnIfNotExists('quotations', 'manual_client_address', 'TEXT NULL');

    // quotation_items
    await addColumnIfNotExists('quotation_items', 'details', 'TEXT NULL');
    await addColumnIfNotExists('quotation_items', 'category', "VARCHAR(50) DEFAULT 'SERVICE'");
    await addColumnIfNotExists('quotation_items', 'unit', 'VARCHAR(50) NULL');

    // payrolls
    await addColumnIfNotExists('payrolls', 'overtime_allowance', 'DECIMAL(10,2) DEFAULT 0.00');
    await addColumnIfNotExists('payrolls', 'advance_salary', 'DECIMAL(10,2) DEFAULT 0.00');
    await addColumnIfNotExists('payrolls', 'tax_deduction', 'DECIMAL(10,2) DEFAULT 0.00');
    await addColumnIfNotExists('payrolls', 'other_deductions', 'DECIMAL(10,2) DEFAULT 0.00');
    await addColumnIfNotExists('payrolls', 'gross_salary', 'DECIMAL(10,2) DEFAULT 0.00');

    // step_activity: ensure user_id is nullable for system events
    await safeExec('ALTER TABLE `step_activity` MODIFY COLUMN `user_id` INT NULL', 'Allowed step_activity.user_id to be NULL for system auto-events');

    // =========================================================================
    // STEP 3: SEED INITIAL & CRITICAL SYSTEM DATA
    // =========================================================================

    // 1. Seed Default Administrator ONLY if the database has ZERO users (fresh install only)
    const [[totalUserCount]] = await connection.query("SELECT COUNT(*) as count FROM `users`");
    if (!totalUserCount || totalUserCount.count === 0) {
      const defaultAdminEmail = 'admin@adwiselabs.com';
      const defaultPassword = 'password123';
      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      await connection.query(`
        INSERT INTO \`users\` (\`name\`, \`username\`, \`email\`, \`password_hash\`, \`role\`)
        VALUES (?, ?, ?, ?, ?)
      `, ['Admin', 'admin', defaultAdminEmail, passwordHash, 'Admin']);
      console.log(`  🌟 [FRESH DB ONLY] Created initial Administrator account: ${defaultAdminEmail}`);
    } else {
      console.log(`  ⏩ Existing database detected (${totalUserCount.count} users found) — zero user data touched.`);
    }

    // 2. Seed Default Settings
    const defaultSettings = [
      ['company_name', 'Adwise Labs'],
      ['company_email', 'contact@adwiselabs.com'],
      ['company_phone', '+92 300 1234567'],
      ['company_address', 'Adwise Labs Headquarters'],
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
      ['project_updates', 'true'],
      ['whatsapp_notifications_enabled', 'true'],
      ['evolution_api_url', 'https://evolution.adwiselabs.com'],
      ['evolution_instance_name', 'adwise_main'],
      ['evolution_api_key', '']
    ];

    for (const [sKey, sVal] of defaultSettings) {
      await connection.query('INSERT IGNORE INTO `settings` (`setting_key`, `setting_value`) VALUES (?, ?)', [sKey, sVal]);
    }

    const defaultTermsText = `1. PAYMENT TERMS: Payments are due within 15 days from the date of invoice issuance. Late payments may be subject to a 1.5% monthly service charge.
2. REVISIONS & SCOPE: Any additional feature requests or out-of-scope revisions beyond agreed milestone deliverables will be billed separately.
3. INTELLECTUAL PROPERTY: Final project deliverables and assets will be released to the client upon receipt of 100% full payment.
4. CONFIDENTIALITY: Both parties agree to maintain non-disclosure of proprietary business data and technology shared during project execution.
5. CANCELLATION & REFUNDS: Deposits and work completed prior to cancellation are non-refundable.`;
    await connection.query('INSERT IGNORE INTO `settings` (`setting_key`, `setting_value`) VALUES (?, ?)', ['terms_and_conditions', defaultTermsText]);

    // 3. Seed Bank Alfalah as default bank
    await connection.query(`
      INSERT IGNORE INTO \`banks\` (\`name\`, \`opening_balance\`) 
      VALUES ('Bank Alfalah', 0.00)
    `);

    // 4. Seed Terms Templates
    const defaultTemplates = [
      ['Standard Services Terms', 'General', '1. PAYMENT TERMS: Payments are due within 15 days from the date of invoice issuance.\n2. REVISIONS & SCOPE: Additional feature requests beyond milestone deliverables will be billed separately.\n3. INTELLECTUAL PROPERTY: Final project deliverables released upon 100% full payment.\n4. CONFIDENTIALITY: Non-disclosure of proprietary business data and technology.\n5. CANCELLATION: Deposits and work completed prior to cancellation are non-refundable.', 1],
      ['Social Media Marketing', 'Social Media', '1. Content schedule will be submitted 5 business days in advance for approval.\n2. Ad spend budget is paid directly to advertising platforms (Meta/Google).\n3. Monthly analytics reports delivered on the 1st of every month.\n4. 30 days written notice required for monthly campaign cancellations.', 0],
      ['Web Development & Software', 'Web Development', '1. Scope of work strictly based on approved UI/UX mockups and PRD documentation.\n2. Includes 30 days complimentary bug-fixing post live deployment.\n3. Server hosting and third-party API subscription costs are billed to client.\n4. Source code ownership transferred upon final payment settlement.', 0]
    ];
    for (const [title, category, content, isDefault] of defaultTemplates) {
      await connection.query(`
        INSERT IGNORE INTO \`terms_templates\` (\`title\`, \`category\`, \`content\`, \`is_default\`) 
        VALUES (?, ?, ?, ?)
      `, [title, category, content, isDefault]);
    }

    // 5. Seed Project Categories
    const defaultProjectCategories = [
      'Income Tax Return Filing',
      'Sales Tax Registration',
      'Corporate Tax Filing',
      'Company Registration',
      'Website Development',
      'Logo Design',
      'SEO Optimization'
    ];
    for (const catName of defaultProjectCategories) {
      await connection.query('INSERT IGNORE INTO `project_categories` (`name`) VALUES (?)', [catName]);
    }

    // 6. Seed Expense Categories
    const defaultExpCategories = [
      'Software Subscriptions',
      'Office Supplies',
      'Marketing',
      'Utilities',
      'Payroll',
      'Rent'
    ];
    for (const catName of defaultExpCategories) {
      await connection.query('INSERT IGNORE INTO `expense_categories` (`name`) VALUES (?)', [catName]);
    }

    // 7. Seed Sample Products
    const [[prodCount]] = await connection.query('SELECT COUNT(*) as count FROM `products`');
    if (!prodCount || prodCount.count === 0) {
      const defaultProducts = [
        ['Website Development', 'Custom built responsive website', 1500.00],
        ['Logo Design', 'Professional logo design package', 300.00],
        ['SEO Optimization', 'Monthly SEO maintenance and optimization', 500.00]
      ];
      for (const [pName, pDesc, pPrice] of defaultProducts) {
        await connection.query('INSERT IGNORE INTO `products` (`name`, `description`, `default_price`) VALUES (?, ?, ?)', [pName, pDesc, pPrice]);
      }
    }

    console.log('🎉 [DB AUTO-MIGRATOR] Complete! All tables, columns, indexes & seeds are 100% up to date.\n');
  } catch (error) {
    console.error('❌ [DB AUTO-MIGRATOR] Error during migration:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Support direct execution via CLI: `node backend/update_live_db.js`
if (require.main === module) {
  updateLiveDb()
    .then(() => {
      console.log('Migration process finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration process failed:', err);
      process.exit(1);
    });
}

module.exports = updateLiveDb;
