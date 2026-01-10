const { Ambassador, Admin } = require('../models');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { sendWelcomeEmail } = require('../services/emailService');
const { OAuth2Client } = require('google-auth-library');

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
    let validReferralCode = null;
    if (referralCode) {
      // Normalize code: remove spaces and convert to uppercase
      validReferralCode = referralCode.trim().toUpperCase();

      referrer = await Ambassador.findOne({
        where: {
          uniqueCode: validReferralCode,
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
      referredBy: validReferralCode || null,
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
        referredBy: validReferralCode || null
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
// Google Login - Production Hardened
exports.googleLogin = async (req, res) => {
  try {
    const { token } = req.body;

    // 1. Validate input
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'Invalid request: token is required' });
    }

    // 2. Ensure GOOGLE_CLIENT_ID is configured
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      console.error('CRITICAL: GOOGLE_CLIENT_ID is not configured in environment variables');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    // 3. Create OAuth2Client with the configured client ID
    const googleClient = new OAuth2Client(googleClientId);

    // 4. Verify Google ID Token with strict audience check
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: googleClientId, // Strictly verify the audience matches our client ID
      });
    } catch (verifyError) {
      // Log detailed error in development, generic in production
      if (process.env.NODE_ENV !== 'production') {
        console.error('Google token verification failed:', verifyError.message);
      }
      return res.status(401).json({ message: 'Invalid or expired Google token' });
    }

    // 5. Extract and validate payload
    const payload = ticket.getPayload();

    if (!payload) {
      return res.status(401).json({ message: 'Invalid token payload' });
    }

    // 6. Verify token audience matches our client ID (double-check)
    if (payload.aud !== googleClientId) {
      console.error('Token audience mismatch:', payload.aud, '!==', googleClientId);
      return res.status(401).json({ message: 'Token audience mismatch' });
    }

    // 7. Verify token issuer
    const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    if (!validIssuers.includes(payload.iss)) {
      console.error('Invalid token issuer:', payload.iss);
      return res.status(401).json({ message: 'Invalid token issuer' });
    }

    // 8. Check token expiration (library does this, but double-check)
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return res.status(401).json({ message: 'Token has expired' });
    }

    // 9. Validate email exists and is verified
    const { email, name, picture, email_verified } = payload;

    if (!email) {
      return res.status(400).json({ message: 'Email not found in Google token' });
    }

    // 10. Require email to be verified by Google (production security)
    if (email_verified === false) {
      return res.status(403).json({ message: 'Google email is not verified' });
    }

    // 11. Find ambassador by email (case-insensitive)
    let ambassador = await Ambassador.findOne({
      where: { email: email.toLowerCase() }
    });

    if (!ambassador) {
      // Auto-create account for first-time Google Sign-In users
      console.log('Creating new account for Google user:', email);

      // Generate unique code
      let uniqueCode;
      let codeExists = true;
      while (codeExists) {
        uniqueCode = generateUniqueCode();
        const existing = await Ambassador.findOne({ where: { uniqueCode } });
        codeExists = !!existing;
      }

      // Create new ambassador with Google account info
      ambassador = await Ambassador.create({
        name: name || email.split('@')[0], // Use name from Google or email prefix
        email: email.toLowerCase(),
        password: null, //  password for Google-authenticated users
        age: null, // Will need to be filled later
        collegeName: null, // Will need to be filled later  
        phoneNumber: null, // Will need to be filled later
        uniqueCode,
        referredBy: null,
        uniqueCodeApproved: false,
        avatar: picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name || email}`,
        googleId: payload.sub, // Store Google ID for future logins
        isGoogleAuth: true // Flag to identify Google-authenticated users
      });

      console.log('New Google user account created:', ambassador.id);

      // Send welcome email (don't wait for it to complete)
      sendWelcomeEmail({
        name: ambassador.name,
        email: ambassador.email,
        uniqueCode: ambassador.uniqueCode
      }).catch(err => {
        console.error('❌ Failed to send welcome email:', err.message);
      });
    }

    // 12. Check if account is active
    if (!ambassador.isActive) {
      return res.status(403).json({ message: 'Account is inactive' });
    }

    // 13. Generate JWT token
    const jwtToken = generateToken(ambassador.id, 'ambassador');

    // 14. Log successful authentication (without sensitive data)
    if (process.env.NODE_ENV !== 'production') {
      console.log('Google login successful for:', email);
    }

    res.json({
      message: 'Login successful',
      token: jwtToken,
      ambassador: {
        id: ambassador.id,
        name: ambassador.name,
        email: ambassador.email,
        uniqueCode: ambassador.uniqueCode,
        level: ambassador.level,
        referralCount: ambassador.referralCount,
        creditPoints: ambassador.creditPoints,
        avatar: ambassador.avatar
      }
    });

  } catch (error) {
    // Production-safe error logging
    if (process.env.NODE_ENV === 'production') {
      console.error('Google Login error:', error.message);
    } else {
      console.error('Google Login error:', error);
    }
    res.status(500).json({ message: 'Authentication failed' });
  }
};
