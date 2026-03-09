const jwt = require('jsonwebtoken');
const db = require('../db');

const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_change_this');
    
    // Get fresh user data from database
    const result = await db.query(
      'SELECT id, lms_id, username, email, name, role FROM users WHERE id = $1',
      [decoded.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    req.user = result.rows[0];
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

const requireTeacher = async (req, res, next) => {
  try {
    await requireAuth(req, res, () => {
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Teacher access required' });
      }
      next();
    });
  } catch (error) {
    console.error('Teacher auth middleware error:', error);
    res.status(403).json({ error: 'Teacher access required' });
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    await requireAuth(req, res, () => {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      next();
    });
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    res.status(403).json({ error: 'Admin access required' });
  }
};

module.exports = {
  requireAuth,
  requireTeacher,
  requireAdmin
};
