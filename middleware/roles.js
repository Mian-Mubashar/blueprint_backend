const requireRole = (roles = []) => {
  const allowed = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    try {
      if (!req.user || !req.user.role) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      if (!allowed.includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden: insufficient permissions' });
      }

      next();
    } catch (error) {
      console.error('Role middleware error:', error);
      res.status(500).json({ message: 'Authorization error' });
    }
  };
};

module.exports = { requireRole };


