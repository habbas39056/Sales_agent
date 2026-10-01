const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');
const JWT_SECRET = process.env.JWT_SECRET || 'adwise_super_secret_key_2026';

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    console.log("Login failed: Missing email or password");
    return res.status(400).json({ error: 'Email and password are required' });
  }

  console.log(`\n=== LOGIN ATTEMPT ===`);
  console.log(`Email provided: "${email}" (Length: ${email.length})`);
  console.log(`Password provided: "${password}" (Length: ${password.length})`);

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      console.log(`Login failed: No user found for email "${email}"`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];
    console.log(`User found in DB! DB Hash: ${user.password_hash}`);
    const match = await bcrypt.compare(password, user.password_hash);

    if (match) {
      console.log(`Login SUCCESS for ${email}`);
      // Return user info (excluding password)
      const { password_hash, ...userInfo } = user;
      
      const token = jwt.sign(
        { id: user.id, role: user.role, email: user.email }, 
        JWT_SECRET, 
        { expiresIn: '24h' }
      );
      
      res.json({ message: 'Login successful', user: userInfo, token });
    } else {
      console.log(`Login failed: Password hash mismatch for ${email}`);
      res.status(401).json({ error: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/specialists', authMiddleware, async (req, res) => {
  try {
    // Only return team members (exclude clients)
    const [rows] = await db.query("SELECT id, name as full_name, email, role FROM users WHERE role != 'Client' ORDER BY name ASC");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Get team members (excluding clients)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, name, username, email, whatsapp_number, role, modules_access, created_at, commission_percentage, monthly_goal FROM users WHERE role != 'Client' ORDER BY created_at DESC");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific user by ID
router.get('/:id', authMiddleware, async (req, res) => {
  if (req.params.id === 'specialists') return; // Skip if it's the specialists route
  try {
    const [rows] = await db.query("SELECT id, name, username, email, role, modules_access, created_at, commission_percentage, monthly_goal FROM users WHERE id = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a team member
router.post('/', authMiddleware, async (req, res) => {
  const { name, username, email, password, role, commission_percentage, monthly_goal, modules_access, whatsapp_number } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password and role are required' });
  }
  const commPct = commission_percentage || 0.00;
  const goalVal = monthly_goal !== undefined && monthly_goal !== '' ? parseFloat(monthly_goal) : 0.00;
  const modulesAccessJson = modules_access ? JSON.stringify(modules_access) : null;
  
  try {
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);
    
    const [result] = await db.query(
      'INSERT INTO users (name, username, email, whatsapp_number, password_hash, role, commission_percentage, monthly_goal, modules_access) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, username || null, email, whatsapp_number || null, password_hash, role, commPct, goalVal, modulesAccessJson]
    );
    res.status(201).json({ id: result.insertId, name, username, email, whatsapp_number, role, commission_percentage: commPct, monthly_goal: goalVal, modules_access });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      if (error.message.includes('username')) {
        return res.status(409).json({ error: 'Username already exists' });
      }
      return res.status(409).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update a team member
router.put('/:id', authMiddleware, async (req, res) => {
  const userId = req.params.id;
  const { name, username, email, password, role, commission_percentage, monthly_goal, modules_access, whatsapp_number } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ error: 'Name, email, and role are required' });
  }
  const commPct = commission_percentage || 0.00;
  const goalVal = monthly_goal !== undefined && monthly_goal !== '' ? parseFloat(monthly_goal) : 0.00;
  const modulesAccessJson = modules_access ? JSON.stringify(modules_access) : null;
  
  try {
    if (password) {
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);
      await db.query(
        'UPDATE users SET name = ?, username = ?, email = ?, whatsapp_number = ?, password_hash = ?, role = ?, commission_percentage = ?, monthly_goal = ?, modules_access = ? WHERE id = ?',
        [name, username || null, email, whatsapp_number || null, password_hash, role, commPct, goalVal, modulesAccessJson, userId]
      );
    } else {
      await db.query(
        'UPDATE users SET name = ?, username = ?, email = ?, whatsapp_number = ?, role = ?, commission_percentage = ?, monthly_goal = ?, modules_access = ? WHERE id = ?',
        [name, username || null, email, whatsapp_number || null, role, commPct, goalVal, modulesAccessJson, userId]
      );
    }
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      if (error.message.includes('username')) return res.status(409).json({ error: 'Username already exists' });
      return res.status(409).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete a team member
router.delete('/:id', authMiddleware, async (req, res) => {
  const userId = req.params.id;

  // Prevent self-deletion of currently logged in user
  if (req.user && String(req.user.id) === String(userId)) {
    return res.status(400).json({ error: 'You cannot delete your own logged-in account.' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Check if user exists
    const [userRows] = await connection.query('SELECT id, role, name FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: 'User not found' });
    }

    // 1. Unassign user from projects
    await connection.query('UPDATE projects SET pm_id = NULL WHERE pm_id = ?', [userId]);
    await connection.query('UPDATE projects SET production_id = NULL WHERE production_id = ?', [userId]);
    await connection.query('UPDATE projects SET created_by = NULL WHERE created_by = ?', [userId]);

    // 2. Unassign user from project steps
    await connection.query('UPDATE project_steps SET assignee_id = NULL WHERE assignee_id = ?', [userId]);
    await connection.query('UPDATE project_steps SET appealed_by = NULL WHERE appealed_by = ?', [userId]);

    // 3. Delete user commissions
    await connection.query('DELETE FROM commissions WHERE user_id = ?', [userId]);

    // 4. Update deliverables (nullify submitted_by)
    await connection.query('UPDATE deliverables SET submitted_by = NULL WHERE submitted_by = ?', [userId]);

    // 5. Unassign user from leads & lead activities
    await connection.query('UPDATE leads SET assigned_to = NULL WHERE assigned_to = ?', [userId]);
    await connection.query('UPDATE leads SET created_by = NULL WHERE created_by = ?', [userId]);
    await connection.query('UPDATE lead_activities SET user_id = NULL WHERE user_id = ?', [userId]);

    // 6. Nullify in clients, invoices, quotations, client_notes, expenses, future_payables, recovery_timeline, step_activity
    await connection.query('UPDATE clients SET user_id = NULL WHERE user_id = ?', [userId]);
    await connection.query('UPDATE clients SET created_by = NULL WHERE created_by = ?', [userId]);
    await connection.query('UPDATE invoices SET agent_id = NULL WHERE agent_id = ?', [userId]);
    await connection.query('UPDATE invoices SET created_by = NULL WHERE created_by = ?', [userId]);
    await connection.query('UPDATE quotations SET created_by = NULL WHERE created_by = ?', [userId]);
    await connection.query('UPDATE client_notes SET created_by = NULL WHERE created_by = ?', [userId]);
    await connection.query('UPDATE expenses SET created_by = NULL WHERE created_by = ?', [userId]);
    await connection.query('UPDATE future_payables SET created_by = NULL WHERE created_by = ?', [userId]);
    await connection.query('UPDATE recovery_timeline SET user_id = NULL WHERE user_id = ?', [userId]);
    await connection.query('UPDATE step_activity SET user_id = NULL WHERE user_id = ?', [userId]);

    // 7. Delete records strictly belonging to this user
    await connection.query('DELETE FROM project_members WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM notifications WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM payrolls WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM salary_advances WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM salary_penalties WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM step_comments WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM step_inhouse_chats WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM notes WHERE created_by = ?', [userId]);
    await connection.query('DELETE FROM recovery_followups WHERE user_id = ?', [userId]);

    // 8. Finally delete the user record
    await connection.query('DELETE FROM users WHERE id = ?', [userId]);

    await connection.commit();
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Failed to delete user:', error);
    res.status(500).json({ error: error.message || 'Failed to delete user' });
  } finally {
    connection.release();
  }
});

module.exports = router;
