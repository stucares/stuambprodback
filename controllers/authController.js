const { Ambassador, Admin } = require('../models');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { sendWelcomeEmail } = require('../services/emailService');

// Generate unique ambassador code
const generateUniqueCode = () => {
  return 'STU' + uuidv4().substring(0, 8).toUpperCase();
};

// Generate JWT token
const generateToken = (id, type) => {
  return jwt.sign(
    { id, type },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Ambassador Registration
exports.registerAmbassador = async (req, res) => {
  try {
    const { name, email, password, age, collegeName, phoneNumber, referralCode } = req.body;

    // Validate required fields
    if (!name || !email || !password || !age || !collegeName || !phoneNumber) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Validate phone number (must be exactly 10 digits)
    if (!/^\d{10}$/.test(phoneNumber)) {
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits' });
    }

    // Check if email already exists
    const existingAmbassador = await Ambassador.findOne({ where: { email } });
    if (existingAmbassador) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Validate referral code if provided
    let referrer = null;
    if (referralCode) {
      referrer = await Ambassador.findOne({ 
        where: { 
          uniqueCode: referralCode,
          uniqueCodeApproved: true  // Only approved codes can be used for referrals
        } 
      });
      if (!referrer) {
        return res.status(400).json({ message: 'Invalid or unapproved referral code' });
      }
    }

    // Generate unique code
    let uniqueCode;
    let codeExists = true;
    while (codeExists) {
      uniqueCode = generateUniqueCode();
      const existing = await Ambassador.findOne({ where: { uniqueCode } });
      codeExists = !!existing;
    }

    // Create ambassador
    const ambassador = await Ambassador.create({
      name,
      email,
      password,
      age,
      collegeName,
      phoneNumber,
      uniqueCode,
      referredBy: referralCode || null,
      uniqueCodeApproved: false,  // Needs admin approval
      avatar: req.body.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`
    });

    // If referred, update referrer's referral count (but don't award points yet)
    // Points will be awarded when the referred user purchases premium
    if (referrer) {
      await referrer.update({
        referralCount: referrer.referralCount + 1
      });
      referrer.updateLevel();
      await referrer.save();
    }

    // Generate token
    const token = generateToken(ambassador.id, 'ambassador');

    // Send welcome email (don't wait for it to complete)
    console.log('🚀 Registration successful, triggering welcome email...');
    sendWelcomeEmail({
      name: ambassador.name,
      email: ambassador.email,
      uniqueCode: ambassador.uniqueCode
    }).catch(err => {
      console.error('❌ CRITICAL: Failed to send welcome email:', err);
      console.error('❌ Error details:', err.message, err.stack);
    });

    res.status(201).json({
      message: 'Registration successful',
      token,
      ambassador: {
        id: ambassador.id,
        name: ambassador.name,
        email: ambassador.email,
        level: ambassador.level,
        referredBy: referralCode || null
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: error.message || 'Registration failed' });
  }
};

// Ambassador Login
exports.loginAmbassador = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find ambassador
    const ambassador = await Ambassador.findOne({ where: { email } });
    if (!ambassador) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if active
    if (!ambassador.isActive) {
      return res.status(403).json({ message: 'Account is inactive' });
    }

    // Verify password
    const isMatch = await ambassador.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(ambassador.id, 'ambassador');

    res.json({
      message: 'Login successful',
      token,
      ambassador: {
        id: ambassador.id,
        name: ambassador.name,
        email: ambassador.email,
        uniqueCode: ambassador.uniqueCode,
        level: ambassador.level,
        referralCount: ambassador.referralCount,
        creditPoints: ambassador.creditPoints
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
};

// Admin Login
exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find admin
    const admin = await Admin.findOne({ where: { email } });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Verify password
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(admin.id, 'admin');

    res.json({
      message: 'Admin login successful',
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
};
