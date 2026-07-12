const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Basic validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // 2. Check duplicate email
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    // 3. Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 4. Save User
    const newUser = new User({
      email: normalizedEmail,
      passwordHash
    });
    await newUser.save();

    // 5. Generate JWT token
    const token = jwt.sign(
      { userId: newUser._id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // 6. Return response
    res.status(201).json({
      token,
      user: {
        userId: newUser._id,
        email: newUser.email,
        name: newUser.name,
        phone: newUser.phone,
        emailNotifications: newUser.emailNotifications
      }
    });

    // Send Welcome Email
    try {
      const notifier = require('../services/notifier');
      notifier.sendWelcomeEmail(newUser.email).catch((emailErr) => {
        console.error('Welcome email sending failed:', emailErr.message);
      });
    } catch (notifierErr) {
      console.error('Welcome email trigger failed:', notifierErr.message);
    }

  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Basic validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // 2. Find user
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // 3. Compare password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // 4. Generate JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // 5. Return response
    res.status(200).json({
      token,
      user: {
        userId: user._id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        emailNotifications: user.emailNotifications
      }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/auth/profile
const authMiddleware = require('../middleware/auth');
router.put('/profile', authMiddleware, async (req, res, next) => {
  try {
    const { name, phone, emailNotifications, oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update details
    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (emailNotifications !== undefined) user.emailNotifications = emailNotifications;

    // Handle password update
    if (oldPassword && newPassword) {
      const isPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(400).json({ error: 'Incorrect old password' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long' });
      }

      user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    }

    await user.save();

    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        userId: user._id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        emailNotifications: user.emailNotifications
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
