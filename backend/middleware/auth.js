const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'adwise_super_secret_key_2026';

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Access denied. Invalid token format.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Contains id, role, etc.
    
    // Auto-inject secure token data into query 
    // to instantly secure all existing routes without rewriting them
    req.query.user_id = decoded.id;
    req.query.role = decoded.role;
    
    next();
  } catch (ex) {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

module.exports = authMiddleware;
