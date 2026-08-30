const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Verify user still exists and get role
    const [users] = await pool.execute(
      'SELECT id, email, first_name, last_name, role FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({
        message: 'Invalid token. User not found.'
      });
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: users[0].role
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        message: 'Invalid token.'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Token expired.'
      });
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({
      message: 'Authentication error'
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const [users] = await pool.execute(
      'SELECT id, email, first_name, last_name, role FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (users.length === 0) {
      req.user = null;
      return next();
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: users[0].role
    };
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

auth.optionalAuth = optionalAuth;
module.exports = auth;



