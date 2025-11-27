const jwt = require('jsonwebtoken');
const { Ambassador, Admin } = require('../models');

exports.authenticateAmbassador = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'ambassador') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const ambassador = await Ambassador.findByPk(decoded.id);

    if (!ambassador || !ambassador.isActive) {
      return res.status(401).json({ message: 'Invalid authentication' });
    }

    req.ambassador = ambassador;
    req.userId = ambassador.id;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

exports.authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const admin = await Admin.findByPk(decoded.id);

    if (!admin) {
      return res.status(401).json({ message: 'Invalid authentication' });
    }

    req.admin = admin;
    req.userId = admin.id;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};
