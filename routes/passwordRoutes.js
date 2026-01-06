const express = require('express');
const router = express.Router();
const sequelize = require('../config/database');
const { QueryTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const zeptoMail = require('../utils/zeptomail');

/**
 * In-memory OTP storage
 * TODO: Replace with Redis in production for scalability
 * Structure: Map<email, { otp, expiresAt, attempts, userId, verified }>
 */
const otpStore = new Map();

/**
 * Generate secure 6-digit OTP
 * @returns {string} 6-digit OTP code
 */
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Clean up expired OTPs periodically
 * Runs every minute to remove expired entries
 */
setInterval(() => {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [email, data] of otpStore.entries()) {
        if (now > data.expiresAt) {
            otpStore.delete(email);
            cleanedCount++;
        }
    }

    if (cleanedCount > 0) {
        console.log(`🧹 Cleaned ${cleanedCount} expired OTP(s)`);
    }
}, 60000); // Clean up every minute

/**
 * POST /api/password/forgot
 * Request OTP for password reset
 * 
 * Request Body:
 * {
 *   "email": "user@example.com"
 * }
 * 
 * Responses:
 * - 200: OTP sent successfully
 * - 400: Invalid request (missing email)
 * - 404: Email not found in database
 * - 500: Server error (DB or email service failure)
 */
router.post('/forgot', async (req, res) => {
    const startTime = Date.now();
    console.log('\n🔵 ===== FORGOT PASSWORD REQUEST =====');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Request Body:', JSON.stringify(req.body, null, 2));

    try {
        const { email } = req.body;

        // VALIDATION: Check if email is provided
        if (!email) {
            console.log('❌ Validation failed: Email is required');
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Normalize email to lowercase
        const normalizedEmail = email.trim().toLowerCase();
        console.log(`📧 Normalized email: ${normalizedEmail}`);

        // DATABASE: Check if ambassador exists
        console.log('🔍 Querying database for ambassador...');
        let ambassadorResult;
        try {
            ambassadorResult = await sequelize.query(
                'SELECT id, name, email FROM "Ambassadors" WHERE LOWER(email) = :email',
                {
                    replacements: { email: normalizedEmail },
                    type: QueryTypes.SELECT
                }
            );
            console.log(`✅ Database query successful. Rows found: ${ambassadorResult.length}`);
        } catch (dbError) {
            console.error('❌ Database error:', dbError.message);
            console.error('Stack:', dbError.stack);
            return res.status(500).json({
                success: false,
                message: 'Database error. Please try again later.'
            });
        }

        // Check if user exists
        if (ambassadorResult.length === 0) {
            console.log(`❌ No account found for email: ${normalizedEmail}`);
            return res.status(404).json({
                success: false,
                message: 'No account found with this email address'
            });
        }

        const ambassador = ambassadorResult[0];
        console.log(`✅ Ambassador found: ID=${ambassador.id}, Name=${ambassador.name}`);

        // GENERATE OTP
        const otp = generateOTP();
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes from now
        const expiryDate = new Date(expiresAt);

        console.log(`🔐 Generated OTP: ${otp}`);
        console.log(`⏰ Expires at: ${expiryDate.toISOString()} (${expiryDate.toLocaleString()})`);

        // STORE OTP in memory
        otpStore.set(normalizedEmail, {
            otp,
            expiresAt,
            attempts: 0,
            userId: ambassador.id,
            verified: false,
            createdAt: Date.now()
        });
        console.log(`💾 OTP stored in memory for: ${normalizedEmail}`);
        console.log(`📊 Total OTPs in store: ${otpStore.size}`);

        // SEND EMAIL via ZeptoMail
        console.log('📧 Initiating email send via ZeptoMail...');
        let emailResult;
        try {
            emailResult = await zeptoMail.sendOTP(normalizedEmail, otp, ambassador.name);
        } catch (emailError) {
            console.error('❌ Email service threw exception:', emailError.message);
            console.error('Stack:', emailError.stack);
            // Clean up OTP since email failed
            otpStore.delete(normalizedEmail);
            return res.status(500).json({
                success: false,
                message: 'Failed to send OTP email. Please try again.'
            });
        }

        // Check email result
        if (!emailResult || !emailResult.success) {
            console.error('❌ Email send failed');
            console.error('Result:', JSON.stringify(emailResult, null, 2));
            // Clean up OTP since email failed
            otpStore.delete(normalizedEmail);

            // Provide specific error message if available
            let errorMessage = 'Failed to send OTP email. Please try again.';
            if (emailResult && emailResult.code === 'SENDER_NOT_VERIFIED') {
                errorMessage = 'Email service configuration error. Please contact support.';
                console.error('⚠️  CRITICAL: Sender email not verified in ZeptoMail');
            } else if (emailResult && emailResult.error) {
                console.error('⚠️  Email error:', emailResult.error);
            }

            return res.status(500).json({
                success: false,
                message: errorMessage
            });
        }

        // SUCCESS
        const elapsed = Date.now() - startTime;
        console.log(`✅ OTP sent successfully to ${normalizedEmail}`);
        console.log(`⏱️  Total time: ${elapsed}ms`);
        console.log('🔵 ===== REQUEST COMPLETE =====\n');

        res.json({
            success: true,
            message: 'OTP sent successfully to your email'
        });

    } catch (error) {
        // GLOBAL ERROR HANDLER
        const elapsed = Date.now() - startTime;
        console.error('\n❌ ===== UNHANDLED ERROR =====');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        console.error(`⏱️  Time before error: ${elapsed}ms`);
        console.error('===== ERROR END =====\n');

        res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.'
        });
    }
});

/**
 * POST /api/password/verify-otp
 * Verify OTP code
 * 
 * Request Body:
 * {
 *   "email": "user@example.com",
 *   "otp": "123456"
 * }
 */
router.post('/verify-otp', async (req, res) => {
    console.log('\n🔵 ===== VERIFY OTP REQUEST =====');
    console.log('Request Body:', JSON.stringify(req.body, null, 2));

    try {
        const { email, otp } = req.body;

        // Validation
        if (!email || !otp) {
            console.log('❌ Validation failed: Missing email or OTP');
            return res.status(400).json({
                success: false,
                message: 'Email and OTP are required'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const otpData = otpStore.get(normalizedEmail);

        // Check if OTP exists
        if (!otpData) {
            console.log(`❌ No OTP found for: ${normalizedEmail}`);
            return res.status(400).json({
                success: false,
                message: 'OTP expired or not found. Please request a new one.'
            });
        }

        console.log(`🔍 OTP data found for: ${normalizedEmail}`);
        console.log(`   Stored OTP: ${otpData.otp}`);
        console.log(`   Received OTP: ${otp}`);
        console.log(`   Attempts: ${otpData.attempts}/5`);
        console.log(`   Expires at: ${new Date(otpData.expiresAt).toISOString()}`);

        // Check expiration
        if (Date.now() > otpData.expiresAt) {
            console.log('❌ OTP has expired');
            otpStore.delete(normalizedEmail);
            return res.status(400).json({
                success: false,
                message: 'OTP has expired. Please request a new one.'
            });
        }

        // Check attempts limit
        if (otpData.attempts >= 5) {
            console.log('❌ Too many failed attempts');
            otpStore.delete(normalizedEmail);
            return res.status(429).json({
                success: false,
                message: 'Too many failed attempts. Please request a new OTP.'
            });
        }

        // Verify OTP
        const storedOTP = String(otpData.otp).trim();
        const receivedOTP = String(otp).trim();

        if (storedOTP !== receivedOTP) {
            otpData.attempts++;
            console.log(`❌ OTP Mismatch:`);
            console.log(`   Expected: '${storedOTP}'`);
            console.log(`   Received: '${receivedOTP}'`);
            console.log(`   Attempts now: ${otpData.attempts}/5`);

            return res.status(400).json({
                success: false,
                message: `Invalid OTP. ${5 - otpData.attempts} attempts remaining.`
            });
        }

        // Mark as verified
        otpData.verified = true;
        console.log('✅ OTP verified successfully');
        console.log('🔵 ===== VERIFICATION COMPLETE =====\n');

        res.json({
            success: true,
            message: 'OTP verified successfully'
        });

    } catch (error) {
        console.error('❌ Verification error:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.'
        });
    }
});

/**
 * POST /api/password/reset
 * Reset password with verified OTP
 * 
 * Request Body:
 * {
 *   "email": "user@example.com",
 *   "otp": "123456",
 *   "newPassword": "newpassword123"
 * }
 */
router.post('/reset', async (req, res) => {
    console.log('\n🔵 ===== PASSWORD RESET REQUEST =====');
    console.log('Request Body (password hidden):', { ...req.body, newPassword: '***' });

    try {
        const { email, otp, newPassword } = req.body;

        // Validation
        if (!email || !otp || !newPassword) {
            console.log('❌ Validation failed: Missing required fields');
            return res.status(400).json({
                success: false,
                message: 'Email, OTP, and new password are required'
            });
        }

        // Validate password strength
        if (newPassword.length < 6) {
            console.log('❌ Password too short');
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const otpData = otpStore.get(normalizedEmail);

        // Check if OTP exists and is verified
        if (!otpData || !otpData.verified) {
            console.log('❌ OTP not verified or not found');
            return res.status(400).json({
                success: false,
                message: 'Please verify OTP first'
            });
        }

        // Check expiration
        if (Date.now() > otpData.expiresAt) {
            console.log('❌ OTP expired during reset');
            otpStore.delete(normalizedEmail);
            return res.status(400).json({
                success: false,
                message: 'OTP has expired. Please start over.'
            });
        }

        console.log('🔐 Hashing new password...');
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        console.log('✅ Password hashed successfully');

        // Update password in database
        console.log('💾 Updating password in database...');
        try {
            await sequelize.query(
                'UPDATE "Ambassadors" SET password = :password WHERE LOWER(email) = :email',
                {
                    replacements: {
                        password: hashedPassword,
                        email: normalizedEmail
                    },
                    type: QueryTypes.UPDATE
                }
            );
            console.log('✅ Password updated in database');
        } catch (dbError) {
            console.error('❌ Database error:', dbError.message);
            return res.status(500).json({
                success: false,
                message: 'Failed to update password. Please try again.'
            });
        }

        // Clean up OTP
        otpStore.delete(normalizedEmail);
        console.log('🧹 OTP cleaned up from memory');
        console.log('✅ Password reset completed successfully');
        console.log('🔵 ===== RESET COMPLETE =====\n');

        res.json({
            success: true,
            message: 'Password reset successfully. You can now login with your new password.'
        });

    } catch (error) {
        console.error('❌ Reset error:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.'
        });
    }
});

module.exports = router;
