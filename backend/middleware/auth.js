const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getJwtSecret = () => {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured in production environment.');
  }
  return 'zynero_development_jwt_secret_key_only';
};

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      const parts = req.headers.authorization.split(' ');
      if (parts.length !== 2 || !parts[1]) {
        return res.status(401).json({ message: 'Not authorized, malformed token format' });
      }
      token = parts[1];
      
      const secret = getJwtSecret();
      const decoded = jwt.verify(token, secret);
      
      if (!decoded || !decoded.id) {
        return res.status(401).json({ message: 'Not authorized, invalid token payload' });
      }

      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      return next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Not authorized, session token has expired' });
      }
      return res.status(401).json({ message: 'Not authorized, invalid token' });
    }
  }

  return res.status(401).json({ message: 'Not authorized, no token provided' });
};

const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin === true) {
    return next();
  }
  return res.status(403).json({ message: 'Not authorized as an admin' });
};

module.exports = { protect, admin, getJwtSecret };
