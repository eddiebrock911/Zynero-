const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getJwtSecret } = require('../middleware/auth');

const generateToken = (id) => {
  return jwt.sign({ id }, getJwtSecret(), {
    expiresIn: '30d'
  });
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
const authUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Please provide both email and password' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (user && (await user.comparePassword(password))) {
      return res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: Boolean(user.isAdmin),
        addresses: user.addresses || [],
        token: generateToken(user._id)
      });
    } else {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Register a new user
// @route   POST /api/users
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ message: 'Full name is required' });
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const userExists = await User.findOne({ email: normalizedEmail });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists with this email address' });
    }

    // First user is automatically made Admin for initial setup
    const isFirstUser = (await User.countDocuments({})) === 0;

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      isAdmin: isFirstUser, // Reject client-supplied isAdmin
      addresses: []
    });

    if (user) {
      return res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        addresses: user.addresses || [],
        token: generateToken(user._id)
      });
    } else {
      return res.status(400).json({ message: 'Invalid user data provided' });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');

    if (user) {
      return res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: Boolean(user.isAdmin),
        addresses: user.addresses || []
      });
    } else {
      return res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update user profile & address list
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update name if provided
    if (req.body.name !== undefined) {
      if (typeof req.body.name !== 'string' || req.body.name.trim().length === 0) {
        return res.status(400).json({ message: 'Name cannot be empty' });
      }
      user.name = req.body.name.trim();
    }

    // Update email if provided
    if (req.body.email !== undefined) {
      if (typeof req.body.email !== 'string' || !EMAIL_REGEX.test(req.body.email.trim())) {
        return res.status(400).json({ message: 'Please provide a valid email address' });
      }
      const newEmail = req.body.email.trim().toLowerCase();
      if (newEmail !== user.email.toLowerCase()) {
        const existingUser = await User.findOne({ email: newEmail });
        if (existingUser && existingUser._id.toString() !== user._id.toString()) {
          return res.status(400).json({ message: 'Email address is already in use by another account' });
        }
        user.email = newEmail;
      }
    }

    // Update password if provided
    if (req.body.password !== undefined && req.body.password !== '') {
      if (typeof req.body.password !== 'string' || req.body.password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
      }
      user.password = req.body.password;
    }

    // Update addresses if provided
    if (req.body.addresses !== undefined) {
      if (!Array.isArray(req.body.addresses)) {
        return res.status(400).json({ message: 'Addresses must be an array' });
      }
      // Sanitize address objects
      const sanitizedAddresses = req.body.addresses.map(addr => ({
        street: String(addr.street || '').trim(),
        city: String(addr.city || '').trim(),
        state: String(addr.state || '').trim(),
        zipCode: String(addr.zipCode || '').trim(),
        country: String(addr.country || 'India').trim()
      })).filter(addr => addr.street && addr.city && addr.state && addr.zipCode);

      user.addresses = sanitizedAddresses;
    }

    // Note: isAdmin is strictly protected and never modified through this endpoint

    const updatedUser = await user.save();

    return res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      isAdmin: Boolean(updatedUser.isAdmin),
      addresses: updatedUser.addresses || [],
      token: generateToken(updatedUser._id)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  authUser,
  registerUser,
  getUserProfile,
  updateUserProfile
};
