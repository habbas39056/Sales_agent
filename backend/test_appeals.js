const db = require('./db');

async function test() {
    let query = `
      SELECT 
        ps.id as step_id,
        ps.project_id,
        ps.title as step_title,
        ps.status as step_status,
        ps.deadline as original_deadline,
        ps.proposed_deadline,
        ps.deadline_appeal_reason as appeal_reason,
        ps.appealed_at,
        ps.reassign_todos,
        ps.reject_todos,
        COALESCE(ps.deadline_status, 'Pending Acceptance') as deadline_status,
        ps.invoice_item_ids,
        p.title as project_title,
        c.full_name as client_name,
        u.name as employee_name,
        u.email as employee_email,
        u.role as employee_role
      FROM project_steps ps
      JOIN projects p ON ps.project_id = p.id
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN users u ON COALESCE(ps.appealed_by, ps.assignee_id) = u.id
    `;

    const queryParams = [];

    // Simulate Admin:1 (so isAdminOrPm is false)
    query += ` WHERE (ps.assignee_id = ? OR ps.appealed_by = ? OR p.pm_id = ?)`;
    queryParams.push(17, 17, 17);

    query += `
      ORDER BY 
        CASE 
          WHEN ps.deadline_status = 'Appealed' THEN 1 
          WHEN ps.deadline_status = 'Pending Acceptance' OR ps.deadline_status IS NULL THEN 2 
          ELSE 3 
        END,
        ps.id DESC
    `;

    try {
        const [appeals] = await db.query(query, queryParams);
        console.log("Appeals count:", appeals.length);
        
        // Fetch and attach invoice items if they exist
        const allItemIds = new Set();
        appeals.forEach(a => {
        if (a.invoice_item_ids) {
            try {
            const ids = typeof a.invoice_item_ids === 'string' ? JSON.parse(a.invoice_item_ids) : a.invoice_item_ids;
            if (Array.isArray(ids)) {
                a.parsed_invoice_item_ids = ids;
                ids.forEach(id => allItemIds.add(id));
            }
            } catch (e) {}
        }
        });

        if (allItemIds.size > 0) {
            console.log("Fetching invoice items:", Array.from(allItemIds));
            const [items] = await db.query('SELECT * FROM invoice_items WHERE id IN (?)', [Array.from(allItemIds)]);
            console.log("Invoice items count:", items.length);
        }
        console.log("Success");
    } catch(e) {
        console.error("ERROR:", e.message);
    } finally {
        process.exit(0);
    }
}

test();
