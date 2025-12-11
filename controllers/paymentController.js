const crypto = require('crypto');
const axios = require('axios');
const { Ambassador } = require('../models');
const nodemailer = require('nodemailer');

// Cashfree Configuration
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_ENV = process.env.CASHFREE_ENV || 'sandbox';

// Cashfree API Base URL
const CASHFREE_API_URL = CASHFREE_ENV === 'production' 
  ? 'https://api.cashfree.com/pg' 
  : 'https://sandbox.cashfree.com/pg';

// Development mode - only enabled with explicit env variable
const DEV_MODE = process.env.ENABLE_DEV_MODE === 'true';

// Payment model (in-memory for now, should be in DB)
const payments = new Map();

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
  try {
    const config = {
      method,
      url: `${CASHFREE_API_URL}${endpoint}`,
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
    
    const response = await axios(config);
    return response;
  } catch (error) {
    console.error('Cashfree API Error:', error.response?.data || error.message);
    throw error;
  }
};

// Create payment order
exports.createOrder = async (req, res) => {
  try {
    const { amount, plan } = req.body;
    const ambassador = req.ambassador;
    
    if (!ambassador) {
      return res.status(404).json({ message: 'Ambassador not found' });
    }

    // Check if already premium
    if (ambassador.isPremium && ambassador.premiumExpiresAt > new Date()) {
      return res.status(400).json({ message: 'You are already a premium member' });
    }

    const ambassadorId = String(ambassador.id);
    const orderId = `order_${Date.now()}_${ambassadorId.slice(0, 8)}`;
    
    // Determine plan type and amount
    const isLifetime = plan === 'lifetime';
    const orderAmount = isLifetime ? 999 : (amount || 19);
    
    // Format phone number (10 digits)
    let phoneNumber = ambassador.phoneNumber || '9999999999';
    phoneNumber = phoneNumber.replace(/\D/g, '').slice(-10);
    
    // Store payment info in memory
    payments.set(orderId, {
      ambassadorId,
      amount: orderAmount,
      plan: plan || 'monthly',
      isLifetime,
      status: 'created',
      createdAt: new Date()
    });

    // DEV MODE: Simulate payment
    if (DEV_MODE) {
      console.log('⚠️  DEV MODE: Simulating payment');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      
      return res.json({
        success: true,
        orderId,
        paymentSessionId: `dev_session_${orderId}`,
        payment_link: `${frontendUrl}/payment-success?order_id=${orderId}&dev_mode=true`,
        devMode: true
      });
    }

    // Validate Cashfree credentials
    if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
      console.error('❌ Cashfree credentials missing!');
      return res.status(500).json({ 
        message: 'Payment gateway not configured',
        error: 'Missing credentials'
      });
    }
    
    console.log(`\n🔄 Creating Cashfree order`);
    console.log(`   Environment: ${CASHFREE_ENV}`);
    console.log(`   API URL: ${CASHFREE_API_URL}`);
    console.log(`   Order ID: ${orderId}`);
    console.log(`   Amount: ₹${orderAmount}`);
    console.log(`   Plan: ${isLifetime ? 'Lifetime' : 'Monthly'}`);
    
    // Create Cashfree order
    const orderData = {
      order_id: orderId,
      order_amount: orderAmount,
      order_currency: "INR",
      customer_details: {
        customer_id: ambassadorId,
        customer_name: ambassador.name || 'Ambassador',
        customer_email: ambassador.email,
        customer_phone: phoneNumber
      },
      order_meta: {
        return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-success?order_id=${orderId}`,
        notify_url: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payment/webhook`
      }
    };

    console.log('   Sending request to Cashfree...');
    const response = await cashfreeRequest('/orders', 'POST', orderData);
    
    if (response.data && response.data.payment_session_id) {
      const { payment_session_id, order_id, order_status } = response.data;
      
      console.log(`✅ Order created successfully`);
      console.log(`   CF Order ID: ${order_id}`);
      console.log(`   Status: ${order_status}`);
      console.log(`   Session ID: ${payment_session_id.substring(0, 50)}...`);
      
      // Return payment session for frontend to initiate checkout
      res.json({
        success: true,
        orderId: order_id,
        paymentSessionId: payment_session_id,
        orderStatus: order_status,
        environment: CASHFREE_ENV
      });
    } else {
      throw new Error('Invalid response from Cashfree');
    }
  } catch (error) {
    console.error('\n❌ Order creation failed:');
    console.error('   Error:', error.response?.data || error.message);
    
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
        const paymentInfo = payments.get(orderId);
        const isLifetime = paymentInfo?.isLifetime || false;
        
        let expiryDate;
        if (isLifetime) {
          // Set expiry to 100 years from now for lifetime
          expiryDate = new Date();
          expiryDate.setFullYear(expiryDate.getFullYear() + 100);
        } else {
          // 1 month premium for monthly plan
          expiryDate = new Date();
          expiryDate.setMonth(expiryDate.getMonth() + 1);
        }

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

    // PRODUCTION MODE: First check order status, then fetch payments
    console.log(`\n🔍 Verifying payment for order: ${orderId}`);
    
    // Step 1: Check order status
    let orderResponse;
    try {
      orderResponse = await cashfreeRequest(`/orders/${orderId}`, 'GET');
      console.log(`   Order Status: ${orderResponse.data.order_status}`);
    } catch (orderError) {
      console.error('   ❌ Order not found:', orderError.response?.data || orderError.message);
      return res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
    }
    
    const orderStatus = orderResponse.data.order_status;
    
    // If order is not PAID, reject immediately
    if (orderStatus !== 'PAID') {
      console.log(`   ⚠️  Order status is ${orderStatus}, not PAID`);
      return res.status(400).json({ 
        success: false, 
        message: `Payment not completed. Order status: ${orderStatus}`,
        orderStatus 
      });
    }
    
    // Step 2: Fetch payment details to confirm
    const response = await cashfreeRequest(`/orders/${orderId}/payments`, 'GET');
    
    if (response.data && response.data.length > 0) {
      const payment = response.data[0];
      console.log(`   Payment Status: ${payment.payment_status}`);
      
      if (payment.payment_status === 'SUCCESS') {
        // Update ambassador to premium
        const ambassador = await Ambassador.findByPk(ambassadorId);
        
        if (ambassador) {
          // Check if already premium to prevent duplicate processing
          if (ambassador.isPremium && ambassador.premiumExpiresAt > new Date()) {
            console.log(`   ⚠️  Ambassador ${ambassadorId} is already premium, skipping update`);
            return res.status(400).json({ 
              success: false,
              message: 'You are already a premium member',
              alreadyPremium: true
            });
          }
          
          const paymentInfo = payments.get(orderId);
          const isLifetime = paymentInfo?.isLifetime || false;
          console.log(`   💎 Granting ${isLifetime ? 'Lifetime' : 'Monthly'} premium access`);
          
          let expiryDate;
          if (isLifetime) {
            // Set expiry to 100 years from now for lifetime
            expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 100);
          } else {
            // 1 month premium for monthly plan
            expiryDate = new Date();
            expiryDate.setMonth(expiryDate.getMonth() + 1);
          }

          await ambassador.update({
            isPremium: true,
            premiumExpiresAt: expiryDate,
            meetingScheduled: false,
            meetingLink: `https://calendly.com/it-stucares/30min`
          });

          // Send confirmation email
          await sendPremiumConfirmationEmail(ambassador);
          console.log(`   ✅ Premium access granted successfully`);
          console.log(`   📅 Expiry: ${expiryDate.toLocaleDateString()}`);

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
          console.log(`   ❌ Ambassador ${ambassadorId} not found`);
          res.status(404).json({ 
            success: false,
            message: 'Ambassador not found' 
          });
        }
      } else {
        console.log(`   ❌ Payment status is ${payment.payment_status}, not SUCCESS`);
        res.status(400).json({ 
          success: false, 
          message: 'Payment not successful',
          paymentStatus: payment.payment_status 
        });
      }
    } else {
      console.log('   ❌ No payment records found for this order');
      res.status(404).json({ 
        success: false,
        message: 'No payment found for this order' 
      });
    }
  } catch (error) {
    console.error('\n❌ Verify payment error:', error.response?.data || error.message);
    
    // Return proper error response
    const statusCode = error.response?.status || 500;
    res.status(statusCode).json({ 
      success: false,
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

      console.log(`\n📬 Webhook received: PAYMENT_SUCCESS for order ${orderId}`);

      // Verify payment status before processing
      if (payment.payment_status !== 'SUCCESS') {
        console.log(`   ⚠️  Payment status is ${payment.payment_status}, not SUCCESS. Ignoring webhook.`);
        return res.json({ success: true, message: 'Payment not successful, ignored' });
      }

      // Update ambassador to premium
      const ambassador = await Ambassador.findByPk(customerId);
      
      if (ambassador) {
        // Check if already premium to prevent duplicate processing
        if (ambassador.isPremium && ambassador.premiumExpiresAt > new Date()) {
          console.log(`   ℹ️  Ambassador ${customerId} is already premium, skipping webhook processing`);
          return res.json({ success: true, message: 'Already premium' });
        }

        const paymentInfo = payments.get(orderId);
        const isLifetime = paymentInfo?.isLifetime || false;
        
        let expiryDate;
        if (isLifetime) {
          expiryDate = new Date();
          expiryDate.setFullYear(expiryDate.getFullYear() + 100);
        } else {
          expiryDate = new Date();
          expiryDate.setMonth(expiryDate.getMonth() + 1);
        }

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
        console.log(`   ✅ Webhook processed: Premium granted to ${ambassador.name}`);
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
