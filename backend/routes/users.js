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
    // Assuming specialists are users with a specific role, or just all users for now
    const [rows] = await db.query('SELECT id, name as full_name, email, role FROM users');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Get team members (excluding clients)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, name, username, email, role, modules_access, created_at, commission_percentage FROM users WHERE role != 'Client' ORDER BY created_at DESC");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific user by ID
router.get('/:id', authMiddleware, async (req, res) => {
  if (req.params.id === 'specialists') return; // Skip if it's the specialists route
  try {
    const [rows] = await db.query("SELECT id, name, username, email, role, modules_access, created_at, commission_percentage FROM users WHERE id = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a team member
router.post('/', authMiddleware, async (req, res) => {
  const { name, username, email, password, role, commission_percentage, modules_access } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password and role are required' });
  }
  const commPct = commission_percentage || 0.00;
  const modulesAccessJson = modules_access ? JSON.stringify(modules_access) : null;
  
  try {
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);
    
    const [result] = await db.query(
      'INSERT INTO users (name, username, email, password_hash, role, commission_percentage, modules_access) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, username || null, email, password_hash, role, commPct, modulesAccessJson]
    );
    res.status(201).json({ id: result.insertId, name, username, email, role, modules_access });
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
  const { name, username, email, password, role, commission_percentage, modules_access } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ error: 'Name, email, and role are required' });
  }
  const commPct = commission_percentage || 0.00;
  const modulesAccessJson = modules_access ? JSON.stringify(modules_access) : null;
  
  try {
    if (password) {
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);
      await db.query(
        'UPDATE users SET name = ?, username = ?, email = ?, password_hash = ?, role = ?, commission_percentage = ?, modules_access = ? WHERE id = ?',
        [name, username || null, email, password_hash, role, commPct, modulesAccessJson, userId]
      );
    } else {
      await db.query(
        'UPDATE users SET name = ?, username = ?, email = ?, role = ?, commission_percentage = ?, modules_access = ? WHERE id = ?',
        [name, username || null, email, role, commPct, modulesAccessJson, userId]
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
  try {
    await db.query('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
