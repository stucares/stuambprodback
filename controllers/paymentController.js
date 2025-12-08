const crypto = require('crypto');
const axios = require('axios');
const { Ambassador } = require('../models');
const nodemailer = require('nodemailer');

// Cashfree Configuration
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_ENV = process.env.CASHFREE_ENV || 'sandbox';
const CASHFREE_BASE_URL = CASHFREE_ENV === 'production' 
  ? 'https://api.cashfree.com/pg' 
  : 'https://sandbox.cashfree.com/pg';

// Development mode - only enabled with explicit env variable
const DEV_MODE = process.env.ENABLE_DEV_MODE === 'true';

// Payment model (in-memory for now, should be in DB)
const payments = new Map();

// Meeting time slots configuration (IST)
const MEETING_SLOTS = [
  { hour: 10, minute: 0 },  // 10:00 AM
  { hour: 11, minute: 0 },  // 11:00 AM
  { hour: 12, minute: 0 },  // 12:00 PM
  { hour: 14, minute: 0 },  // 2:00 PM
  { hour: 15, minute: 0 },  // 3:00 PM
  { hour: 16, minute: 0 },  // 4:00 PM
  { hour: 17, minute: 0 },  // 5:00 PM
];

// Helper function to get next available meeting slot
const getNextAvailableSlot = async () => {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() + 1); // Start from tomorrow
  
  // Try for next 14 days
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const checkDate = new Date(startDate);
    checkDate.setDate(checkDate.getDate() + dayOffset);
    
    // Skip weekends
    const dayOfWeek = checkDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip Sunday (0) and Saturday (6)
    
    // Check each time slot
    for (const slot of MEETING_SLOTS) {
      const slotTime = new Date(checkDate);
      slotTime.setHours(slot.hour, slot.minute, 0, 0);
      
      // Check if this slot is already taken
      const existingMeeting = await Ambassador.findOne({
        where: {
          meetingDate: slotTime,
          meetingScheduled: true
        }
      });
      
      if (!existingMeeting) {
        return slotTime; // Found available slot
      }
    }
  }
  
  // If no slot found in 14 days, return a default slot
  const fallbackDate = new Date(startDate);
  fallbackDate.setDate(fallbackDate.getDate() + 3);
  fallbackDate.setHours(14, 0, 0, 0);
  return fallbackDate;
};

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Helper function for Cashfree API calls
const cashfreeRequest = async (endpoint, method = 'POST', data = null) => {
  const config = {
    method,
    url: `${CASHFREE_BASE_URL}${endpoint}`,
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': CASHFREE_APP_ID,
      'x-client-secret': CASHFREE_SECRET_KEY,
      'x-api-version': '2023-08-01'
    }
  };
  
  if (data) {
    config.data = data;
  }
  
  return axios(config);
};

// Create payment order
exports.createOrder = async (req, res) => {
  try {
    const { amount, plan } = req.body;
    const ambassador = req.ambassador;
    
    if (!ambassador) {
      return res.status(404).json({ message: 'Ambassador not found' });
    }
    
    const ambassadorId = String(ambassador.id);

    // Check if already premium
    if (ambassador.isPremium && ambassador.premiumExpiresAt > new Date()) {
      return res.status(400).json({ message: 'You are already a premium member' });
    }

    const orderId = `order_${Date.now()}_${ambassadorId}`;
    
    // Ensure phone number is in correct format (10 digits)
    let phoneNumber = ambassador.phoneNumber || '9999999999';
    phoneNumber = phoneNumber.replace(/\D/g, ''); // Remove non-digits
    if (phoneNumber.length > 10) {
      phoneNumber = phoneNumber.slice(-10); // Get last 10 digits
    }
    
    // Store payment info
    payments.set(orderId, {
      ambassadorId,
      amount: amount || 19,
      plan: plan || 'monthly',
      status: 'created',
      createdAt: new Date()
    });

    // DEV MODE: Skip Cashfree only if explicitly enabled
    if (DEV_MODE) {
      console.log('⚠️ DEV MODE: Creating simulated payment order');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      
      return res.json({
        success: true,
        orderId: orderId,
        paymentLink: `${frontendUrl}/payment-success?order_id=${orderId}&dev_mode=true`,
        paymentSessionId: `dev_session_${orderId}`,
        devMode: true,
        message: 'Development mode - payment simulation enabled'
      });
    }

    // Check for Cashfree credentials
    if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
      console.error('❌ Cashfree credentials missing!');
      return res.status(500).json({ 
        message: 'Payment gateway not configured. Please contact support.',
        error: 'Missing Cashfree credentials'
      });
    }
    
    // PRODUCTION/SANDBOX MODE: Use Cashfree
    console.log(`🔄 Creating Cashfree order in ${CASHFREE_ENV} mode`);
    console.log(`📍 Cashfree URL: ${CASHFREE_BASE_URL}`);
    console.log(`🔑 App ID: ${CASHFREE_APP_ID?.substring(0, 10)}...`);
    
    const orderData = {
      order_id: orderId,
      order_amount: amount || 19,
      order_currency: "INR",
      customer_details: {
        customer_id: ambassadorId,
        customer_name: ambassador.name || 'Ambassador',
        customer_email: ambassador.email,
        customer_phone: phoneNumber
      },
      order_meta: {
        return_url: `${process.env.FRONTEND_URL}/payment-success?order_id=${orderId}`,
        notify_url: `${process.env.BACKEND_URL}/api/payment/webhook`
      },
      order_note: `Premium Ambassador Subscription - ${plan || 'monthly'}`
    };

    const response = await cashfreeRequest('/orders', 'POST', orderData);
    
    if (response.data) {
      console.log('✅ Cashfree order created:', orderId);
      res.json({
        success: true,
        orderId: orderId,
        paymentLink: response.data.payment_link,
        paymentSessionId: response.data.payment_session_id
      });
    } else {
      throw new Error('Failed to create order');
    }
  } catch (error) {
    console.error('Create order error:', error.response?.data || error);
    res.status(500).json({ 
      message: 'Failed to create payment order',
      error: error.response?.data?.message || error.message 
    });
  }
};

// Verify payment
exports.verifyPayment = async (req, res) => {
  try {
    const { orderId, devMode } = req.body;
    const ambassadorId = req.ambassador.id;

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    // DEV MODE: Simulate successful payment verification
    if (DEV_MODE || devMode) {
      console.log('DEV MODE: Simulating successful payment verification for', orderId);
      
      const ambassador = await Ambassador.findByPk(ambassadorId);
      
      if (ambassador) {
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + 1); // 1 month premium

        await ambassador.update({
          isPremium: true,
          premiumExpiresAt: expiryDate,
          meetingScheduled: false,
          meetingLink: `https://calendly.com/it-stucares/30min`
        });

        // Update payment status in memory
        if (payments.has(orderId)) {
          const paymentInfo = payments.get(orderId);
          paymentInfo.status = 'completed';
          payments.set(orderId, paymentInfo);
        }

        return res.json({
          success: true,
          message: 'Payment verified successfully',
          meeting: {
            link: 'https://calendly.com/it-stucares/30min',
            scheduled: false
          },
          devMode: true
        });
      }
    }

    // PRODUCTION MODE: Fetch order payments from Cashfree
    const response = await cashfreeRequest(`/orders/${orderId}/payments`, 'GET');
    
    if (response.data && response.data.length > 0) {
      const payment = response.data[0];
      
      if (payment.payment_status === 'SUCCESS') {
        // Update ambassador to premium
        const ambassador = await Ambassador.findByPk(ambassadorId);
        
        if (ambassador) {
          const expiryDate = new Date();
          expiryDate.setMonth(expiryDate.getMonth() + 1); // 1 month premium

          await ambassador.update({
            isPremium: true,
            premiumExpiresAt: expiryDate,
            meetingScheduled: false,
            meetingLink: `https://calendly.com/it-stucares/30min`
          });

          // Send confirmation email
          await sendPremiumConfirmationEmail(ambassador);

          // Update payment status
          if (payments.has(orderId)) {
            const paymentInfo = payments.get(orderId);
            paymentInfo.status = 'completed';
            payments.set(orderId, paymentInfo);
          }

          res.json({
            success: true,
            message: 'Payment verified successfully',
            meeting: {
              link: `https://calendly.com/it-stucares/30min`,
              scheduled: false
            }
          });
        } else {
          res.status(404).json({ message: 'Ambassador not found' });
        }
      } else {
        res.status(400).json({ 
          success: false, 
          message: 'Payment not successful',
          status: payment.payment_status 
        });
      }
    } else {
      res.status(404).json({ message: 'Payment not found' });
    }
  } catch (error) {
    console.error('Verify payment error:', error.response?.data || error);
    res.status(500).json({ 
      message: 'Failed to verify payment',
      error: error.response?.data?.message || error.message 
    });
  }
};

// Webhook handler
exports.handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];
    const rawBody = JSON.stringify(req.body);

    // Verify webhook signature (if configured)
    if (process.env.CASHFREE_WEBHOOK_SECRET && process.env.CASHFREE_WEBHOOK_SECRET !== 'your_webhook_secret') {
      const expectedSignature = crypto
        .createHmac('sha256', process.env.CASHFREE_WEBHOOK_SECRET)
        .update(timestamp + rawBody)
        .digest('base64');

      if (signature !== expectedSignature) {
        console.error('Invalid webhook signature');
        return res.status(401).json({ message: 'Invalid signature' });
      }
    }

    const { data, type } = req.body;

    if (type === 'PAYMENT_SUCCESS_WEBHOOK') {
      const { order, payment } = data;
      const orderId = order.order_id;
      const customerId = order.customer_details.customer_id;

      // Update ambassador to premium
      const ambassador = await Ambassador.findByPk(customerId);
      
      if (ambassador && !ambassador.isPremium) {
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + 1);

        const meetingDate = new Date();
        meetingDate.setDate(meetingDate.getDate() + 2);
        meetingDate.setHours(14, 0, 0, 0);

        await ambassador.update({
          isPremium: true,
          premiumExpiresAt: expiryDate,
          meetingScheduled: true,
          meetingDate: meetingDate,
          meetingLink: `https://calendly.com/it-stucares/30min`
        });

        await sendPremiumConfirmationEmail(ambassador, meetingDate);
      }

      // Update payment status
      if (payments.has(orderId)) {
        const paymentInfo = payments.get(orderId);
        paymentInfo.status = 'completed';
        payments.set(orderId, paymentInfo);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
};

// Get payment status
exports.getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const response = await cashfreeRequest(`/orders/${orderId}/payments`, 'GET');
    
    if (response.data && response.data.length > 0) {
      res.json({
        success: true,
        status: response.data[0].payment_status,
        payment: response.data[0]
      });
    } else {
      res.status(404).json({ message: 'Payment not found' });
    }
  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({ message: 'Failed to get payment status' });
  }
};

// Send premium confirmation email
async function sendPremiumConfirmationEmail(ambassador, meetingDate) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@stucares.com',
      to: ambassador.email,
      subject: '🎉 Welcome to Premium Ambassador Program - Stucare × Scholare',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #a855f7, #c5f74a); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { color: white; margin: 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .badge { display: inline-block; background: #a855f7; color: white; padding: 5px 15px; border-radius: 20px; font-size: 14px; }
            .meeting-box { background: white; border: 2px solid #a855f7; border-radius: 10px; padding: 20px; margin: 20px 0; }
            .btn { display: inline-block; background: #a855f7; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🌟 Congratulations, ${ambassador.name}!</h1>
            </div>
            <div class="content">
              <p>You are now a <span class="badge">Premium Ambassador</span></p>
              
              <p>Thank you for upgrading to Premium! Your account is now activated with all premium benefits:</p>
              
              <ul>
                <li>✅ Verified Blue Tick Badge</li>
                <li>✅ Access to Exclusive Daily Tasks</li>
                <li>✅ 2x Points on All Referrals</li>
                <li>✅ Welcome Kit (Shipping within 7 days)</li>
                <li>✅ Personal Onboarding Meeting</li>
              </ul>
              
              <div class="meeting-box">
                <h3>📅 Your Onboarding Meeting</h3>
                <p><strong>Date:</strong> ${meetingDate.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p><strong>Time:</strong> ${meetingDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST</p>
                <p><strong>Duration:</strong> 15 minutes</p>
                <br>
                <a href="https://calendly.com/it-stucares/30min" class="btn">Join Meeting</a>
              </div>
              
              <p><strong>💰 Remember:</strong> Complete your first task to get your ₹19 back!</p>
              
              <p>If you have any questions, feel free to reply to this email or contact us at support@stucares.com</p>
              
              <p>Best regards,<br>Team Stucare × Scholare</p>
            </div>
            <div class="footer">
              <p>© 2024 Stucare × Scholare. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      await transporter.sendMail(mailOptions);
      console.log('Premium confirmation email sent to:', ambassador.email);
    } else {
      console.log('Email not configured. Skipping email send.');
    }
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}

// Get premium status
exports.getPremiumStatus = async (req, res) => {
  try {
    const ambassador = req.ambassador;

    if (!ambassador) {
      return res.status(404).json({ message: 'Ambassador not found' });
    }

    res.json({
      isPremium: ambassador.isPremium,
      premiumExpiresAt: ambassador.premiumExpiresAt,
      meetingScheduled: ambassador.meetingScheduled,
      meeting: ambassador.meetingDate ? {
        date: ambassador.meetingDate.toLocaleDateString('en-IN', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        time: ambassador.meetingDate.toLocaleTimeString('en-IN', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        link: ambassador.meetingLink
      } : null
    });
  } catch (error) {
    console.error('Get premium status error:', error);
    res.status(500).json({ message: 'Failed to get premium status' });
  }
};
