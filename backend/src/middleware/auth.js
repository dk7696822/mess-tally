const jwt = require('jsonwebtoken');
const AppDataSource = require('../config/database');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database to ensure they still exist and are active
    const userRepository = AppDataSource.getRepository('User');
    const user = await userRepository.findOne({ where: { id: decoded.userId } });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token - user not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Role-based middleware shortcuts
const requireAdmin = requireRole(['admin']);
const requireEditor = requireRole(['admin', 'editor']);
const requireViewer = requireRole(['admin', 'editor', 'viewer']);

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireEditor,
  requireViewer
};
