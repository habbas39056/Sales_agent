const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');

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
      res.json({ message: 'Login successful', user: userInfo });
    } else {
      console.log(`Login failed: Password hash mismatch for ${email}`);
      res.status(401).json({ error: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/specialists', async (req, res) => {
  try {
    // Assuming specialists are users with a specific role, or just all users for now
    const [rows] = await db.query('SELECT id, name as full_name, email, role FROM users');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Get team members (excluding clients)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, name, email, role, created_at, commission_percentage FROM users WHERE role != 'Client' ORDER BY created_at DESC");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a team member
router.post('/', async (req, res) => {
  const { name, email, password, role, commission_percentage } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  const commPct = commission_percentage || 0.00;
  try {
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);
    
    const [result] = await db.query(
      'INSERT INTO users (name, email, password_hash, role, commission_percentage) VALUES (?, ?, ?, ?, ?)',
      [name, email, password_hash, role, commPct]
    );
    res.status(201).json({ id: result.insertId, name, email, role });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
