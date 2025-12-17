const axios = require('axios');

// Zepto Mail API configuration
const ZEPTO_API_URL = process.env.ZEPTO_MAIL_URL || 'https://api.zeptomail.in/v1.1/email';
const ZEPTO_TOKEN = process.env.ZEPTO_MAIL_TOKEN;
const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || 'noreply@stucareambassador.com';
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'Stucare Ambassador';

// Send email using Zepto Mail API
const sendEmail = async (to, subject, htmlContent) => {
  try {
    const response = await axios.post(ZEPTO_API_URL, {
      from: {
        address: EMAIL_FROM_ADDRESS,
        name: EMAIL_FROM_NAME
      },
      to: [{
        email_address: {
          address: to,
          name: to.split('@')[0]
        }
      }],
      subject: subject,
      htmlbody: htmlContent
    }, {
      headers: {
        'Authorization': ZEPTO_TOKEN,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Email sent successfully:', response.data);
    return { success: true, messageId: response.data.request_id };
  } catch (error) {
    console.error('❌ Failed to send email:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
};

// Send welcome email to new ambassador
const sendWelcomeEmail = async (ambassadorData) => {
  try {
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              text-align: center;
              border-radius: 10px 10px 0 0;
            }
            .content {
              background: #f9f9f9;
              padding: 30px;
              border-radius: 0 0 10px 10px;
            }
            .code-box {
              background: white;
              border: 2px dashed #667eea;
              padding: 20px;
              text-align: center;
              margin: 20px 0;
              border-radius: 8px;
            }
            .code {
              font-size: 32px;
              font-weight: bold;
              color: #667eea;
              letter-spacing: 3px;
            }
            .button {
              display: inline-block;
              background: #667eea;
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              color: #666;
              font-size: 14px;
            }
            .info-box {
              background: white;
              padding: 15px;
              border-left: 4px solid #667eea;
              margin: 15px 0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎉 Welcome to Stucare!</h1>
            <p>You're now part of our Ambassador Program</p>
          </div>
          
          <div class="content">
            <h2>Hi ${ambassadorData.name}! 👋</h2>
            
            <p>Congratulations on joining the Stucare Ambassador Program! We're excited to have you on board.</p>
            
            <div class="code-box">
              <p style="margin: 0; font-size: 14px; color: #666;">Your Unique Referral Code</p>
              <div class="code">${ambassadorData.uniqueCode}</div>
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">Share this code to earn rewards!</p>
            </div>
            
            <div class="info-box">
              <h3 style="margin-top: 0;">📊 Your Dashboard</h3>
              <p>Access your dashboard to:</p>
              <ul>
                <li>Track your referrals and earnings</li>
                <li>Share promotional content</li>
                <li>Request withdrawals</li>
                <li>View exclusive tasks</li>
              </ul>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/dashboard" class="button">Go to Dashboard</a>
            </div>
            
            <div class="info-box">
              <h3 style="margin-top: 0;">💰 How to Earn</h3>
              <ol>
                <li>Share your unique code with friends</li>
                <li>When they register and purchase premium, you earn points</li>
                <li>Complete tasks to earn even more</li>
                <li>Redeem your points for cash rewards</li>
              </ol>
            </div>
            
            <p><strong>Need help?</strong> Reply to this email or contact our support team.</p>
            
            <p>Best regards,<br><strong>Team Stucare</strong></p>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} Stucare. All rights reserved.</p>
            <p>You received this email because you registered as a Stucare Ambassador.</p>
          </div>
        </body>
        </html>
      `;

    return await sendEmail(
      ambassadorData.email,
      '🎉 Welcome to Stucare Ambassador Program!',
      htmlContent
    );
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error);
    return { success: false, error: error.message };
  }
};

// Send withdrawal request notification
const sendWithdrawalNotification = async (withdrawalData) => {
  try {
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              text-align: center;
              border-radius: 10px 10px 0 0;
            }
            .content {
              background: #f9f9f9;
              padding: 30px;
              border-radius: 0 0 10px 10px;
            }
            .status-box {
              background: white;
              padding: 20px;
              text-align: center;
              margin: 20px 0;
              border-radius: 8px;
              border: 2px solid #fbbf24;
            }
            .amount {
              font-size: 36px;
              font-weight: bold;
              color: #667eea;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              border-bottom: 1px solid #eee;
            }
            .info-label {
              font-weight: bold;
              color: #666;
            }
            .button {
              display: inline-block;
              background: #667eea;
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              color: #666;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>💰 Withdrawal Request Received</h1>
          </div>
          
          <div class="content">
            <h2>Hi ${withdrawalData.name}! 👋</h2>
            
            <p>We've received your withdrawal request and it's being processed.</p>
            
            <div class="status-box">
              <p style="margin: 0; color: #fbbf24; font-weight: bold;">⏳ Status: PENDING</p>
              <div class="amount">₹${withdrawalData.amount}</div>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">Withdrawal Amount</p>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">📋 Request Details</h3>
              
              <div class="info-row">
                <span class="info-label">Request ID:</span>
                <span>#${withdrawalData.requestId}</span>
              </div>
              
              <div class="info-row">
                <span class="info-label">Amount:</span>
                <span>₹${withdrawalData.amount}</span>
              </div>
              
              <div class="info-row">
                <span class="info-label">UPI ID:</span>
                <span>${withdrawalData.upiId}</span>
              </div>
              
              <div class="info-row" style="border-bottom: none;">
                <span class="info-label">Requested On:</span>
                <span>${new Date(withdrawalData.requestedAt).toLocaleString('en-IN')}</span>
              </div>
            </div>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #fbbf24;">
              <p style="margin: 0;"><strong>⏰ Processing Time:</strong> Your withdrawal will be processed within 3-5 business days.</p>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/earnings" class="button">Track Withdrawal Status</a>
            </div>
            
            <p style="margin-top: 30px; font-size: 14px; color: #666;">
              <strong>Note:</strong> You'll receive another email once your withdrawal is approved and processed.
            </p>
            
            <p>Best regards,<br><strong>Team Stucare</strong></p>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} Stucare. All rights reserved.</p>
          </div>
        </body>
        </html>
      `;

    return await sendEmail(
      withdrawalData.email,
      `💰 Withdrawal Request Received - ₹${withdrawalData.amount}`,
      htmlContent
    );
  } catch (error) {
    console.error('❌ Failed to send withdrawal notification:', error);
    return { success: false, error: error.message };
  }
};

// Send withdrawal approval notification
const sendWithdrawalApprovalEmail = async (withdrawalData) => {
  try {
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white;
              padding: 30px;
              text-align: center;
              border-radius: 10px 10px 0 0;
            }
            .content {
              background: #f9f9f9;
              padding: 30px;
              border-radius: 0 0 10px 10px;
            }
            .success-box {
              background: white;
              padding: 20px;
              text-align: center;
              margin: 20px 0;
              border-radius: 8px;
              border: 2px solid #10b981;
            }
            .amount {
              font-size: 36px;
              font-weight: bold;
              color: #10b981;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              color: #666;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>✅ Payment Processed Successfully!</h1>
          </div>
          
          <div class="content">
            <h2>Hi ${withdrawalData.name}! 🎉</h2>
            
            <p>Great news! Your withdrawal request has been approved and the payment has been processed.</p>
            
            <div class="success-box">
              <p style="margin: 0; color: #10b981; font-weight: bold;">✅ Status: APPROVED</p>
              <div class="amount">₹${withdrawalData.amount}</div>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">Sent to ${withdrawalData.upiId}</p>
            </div>
            
            <div style="background: #d1fae5; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981;">
              <p style="margin: 0;"><strong>💳 Payment Details:</strong> The amount has been transferred to your UPI ID. Please check your payment app.</p>
            </div>
            
            <p style="margin-top: 20px;">Keep up the great work! Continue referring friends and completing tasks to earn more rewards.</p>
            
            <p>Best regards,<br><strong>Team Stucare</strong></p>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} Stucare. All rights reserved.</p>
          </div>
        </body>
        </html>
      `;

    return await sendEmail(
      withdrawalData.email,
      '✅ Withdrawal Approved - Payment Processed',
      htmlContent
    );
  } catch (error) {
    console.error('❌ Failed to send withdrawal approval email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendWelcomeEmail,
  sendWithdrawalNotification,
  sendWithdrawalApprovalEmail
};
