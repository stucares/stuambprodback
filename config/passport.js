const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { Ambassador } = require('../models');

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await Ambassador.findByPk(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
      scope: ['profile', 'email'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Extract user data from Google profile
        const googleId = profile.id;
        const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
        const name = profile.displayName || 'Google User';
        const picture = profile.photos && profile.photos[0] ? profile.photos[0].value : null;

        if (!email) {
          return done(new Error('No email found in Google profile'), null);
        }

        // Check if user exists with this Google ID
        let user = await Ambassador.findOne({ where: { googleId } });

        if (user) {
          // Existing Google user - just login
          console.log('✅ Existing Google user found:', email);
          return done(null, user);
        }

        // Check if user exists with this email (Account Merging scenario)
        user = await Ambassador.findOne({ where: { email: email.toLowerCase() } });

        if (user) {
          // Account Merging: User exists with same email but different auth method
          console.log('🔗 Merging account for:', email);
          
          await user.update({
            googleId,
            isGoogleAuth: true,
            avatar: picture || user.avatar,
          });

          return done(null, user);
        }

        // New user - create account
        console.log('✨ Creating new Google user:', email);

        // Generate unique code
        const { v4: uuidv4 } = require('uuid');
        const generateUniqueCode = () => 'STU' + uuidv4().substring(0, 8).toUpperCase();
        
        let uniqueCode;
        let codeExists = true;
        while (codeExists) {
          uniqueCode = generateUniqueCode();
          const existing = await Ambassador.findOne({ where: { uniqueCode } });
          codeExists = !!existing;
        }

        user = await Ambassador.create({
          name,
          email: email.toLowerCase(),
          googleId,
          isGoogleAuth: true,
          password: null, // No password for Google users
          age: null, // Will be filled later
          collegeName: null, // Will be filled later
          phoneNumber: null, // Will be filled later
          uniqueCode,
          uniqueCodeApproved: false,
          avatar: picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
        });

        console.log('✅ New Google user created:', user.id);
        
        // Send welcome email (async, don't wait)
        const { sendWelcomeEmail } = require('../services/emailService');
        sendWelcomeEmail({
          name: user.name,
          email: user.email,
          uniqueCode: user.uniqueCode
        }).catch(err => {
          console.error('❌ Failed to send welcome email:', err.message);
        });

        return done(null, user);
      } catch (error) {
        console.error('❌ Google Strategy Error:', error);
        return done(error, null);
      }
    }
  )
);

module.exports = passport;
