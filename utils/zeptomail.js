const axios = require('axios');

/**
 * ZeptoMail Email Service
 * Handles all email communications via ZeptoMail API
 * @class ZeptoMailService
 */
class ZeptoMailService {
  constructor() {
    // Hardcoded API endpoint as per ZeptoMail documentation
    this.apiURL = 'https://api.zeptomail.in/v1.1/email';
    this.token = process.env.ZEPTO_MAIL_TOKEN;
    this.fromAddress = process.env.EMAIL_FROM_ADDRESS;
    this.fromName = process.env.EMAIL_FROM_NAME;

    // Validate configuration on initialization
    this.validateConfig();
  }

  /**
   * Validate ZeptoMail configuration
   * Logs warnings if env variables are not set
   */
  validateConfig() {
    if (!this.token) {
      console.error('❌ ZEPTO_MAIL_TOKEN is not set in environment variables');
    }
    if (!this.fromAddress) {
      console.error('❌ EMAIL_FROM_ADDRESS is not set in environment variables');
    }
    if (!this.fromName) {
      console.error('❌ EMAIL_FROM_NAME is not set in environment variables');
    }

    if (this.token && this.fromAddress && this.fromName) {
      console.log('✅ ZeptoMail configuration validated');
      console.log(`📧 From Email: ${this.fromAddress}`);
    }
  }

  /**
   * Send email via ZeptoMail API
   * @param {Object} params - Email parameters
   * @param {string} params.to - Recipient email address
   * @param {string} params.subject - Email subject
   * @param {string} params.htmlBody - HTML body content
   * @param {string} params.textBody - Plain text body (optional, auto-generated from HTML)
   * @returns {Promise<Object>} { success: boolean, data?: any, error?: string }
   */
  async sendEmail({ to, subject, htmlBody, textBody }) {
    console.log('🔵 ZeptoMail: Attempting to send email...');
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   From: ${this.fromAddress} (${this.fromName})`);

    try {
      // Validate required parameters
      if (!to || !subject || !htmlBody) {
        const missingParams = [];
        if (!to) missingParams.push('to');
        if (!subject) missingParams.push('subject');
        if (!htmlBody) missingParams.push('htmlBody');

        console.error(`❌ Missing required parameters: ${missingParams.join(', ')}`);
        return {
          success: false,
          error: `Missing required parameters: ${missingParams.join(', ')}`
        };
      }

      // Validate configuration
      if (!this.token || !this.fromAddress || !this.fromName) {
        console.error('❌ ZeptoMail configuration incomplete');
        return {
          success: false,
          error: 'Email service not configured properly'
        };
      }

      // Prepare email payload according to ZeptoMail API specs
      const payload = {
        from: {
          address: this.fromAddress,
          name: this.fromName
        },
        to: [
          {
            email_address: {
              address: to,
              name: to.split('@')[0]  // Use email prefix as name
            }
          }
        ],
        subject: subject,
        htmlbody: htmlBody,
        textbody: textBody || htmlBody.replace(/<[^>]*>/g, '')  // Strip HTML tags for plain text
      };

      console.log('📤 Sending request to ZeptoMail API...');
      console.log(`   URL: ${this.apiURL}`);

      // Make API request to ZeptoMail
      const response = await axios.post(
        this.apiURL,
        payload,
        {
          headers: {
            'Authorization': this.token,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 30000  // 30 second timeout
        }
      );

      console.log('✅ ZeptoMail: Email sent successfully');
      console.log('   Response:', JSON.stringify(response.data, null, 2));

      return {
        success: true,
        data: response.data
      };

    } catch (error) {
      // Detailed error logging
      console.error('❌ ZeptoMail Error:', error.message);

      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('❌ Response Status:', error.response.status);
        console.error('❌ Response Data:', JSON.stringify(error.response.data, null, 2));
        console.error('❌ Response Headers:', JSON.stringify(error.response.headers, null, 2));

        // Common ZeptoMail errors
        const errorData = error.response.data;
        if (errorData.code === 'INVALID_AUTHENTICATION') {
          console.error('⚠️  Invalid ZeptoMail token - check ZEPTO_MAIL_TOKEN');
        } else if (errorData.code === 'SENDER_NOT_VERIFIED') {
          console.error('⚠️  Sender email not verified in ZeptoMail - verify ' + this.fromAddress);
        } else if (errorData.code === 'RECIPIENT_NOT_VALID') {
          console.error('⚠️  Invalid recipient email address:', to);
        }

        return {
          success: false,
          error: errorData.message || error.message,
          code: errorData.code
        };
      } else if (error.request) {
        // The request was made but no response was received
        console.error('❌ No response received from ZeptoMail API');
        console.error('   Request details:', error.request);
        return {
          success: false,
          error: 'No response from email service'
        };
      } else {
        // Something happened in setting up the request
        console.error('❌ Error setting up request:', error.message);
        return {
          success: false,
          error: error.message
        };
      }
    }
  }

  /**
   * Send OTP email for password reset
   * @param {string} email - Recipient email address
   * @param {string} otp - 6-digit OTP code
   * @param {string} name - Recipient name (default: 'User')
   * @returns {Promise<Object>} { success: boolean, data?: any, error?: string }
   */
  async sendOTP(email, otp, name = 'User') {
    console.log(`🔐 Sending OTP to ${email} for user ${name}`);
    console.log(`   OTP: ${otp} (expires in 10 minutes)`);

    const subject = 'Password Reset OTP - StuCare Ambassador';
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #6366f1 0%, #84cc16 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .otp-box { background: white; border: 2px dashed #6366f1; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .otp-code { font-size: 32px; font-weight: bold; color: #6366f1; letter-spacing: 8px; font-family: monospace; }
          .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">🔐 Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${name}</strong>,</p>
            <p>We received a request to reset your password for your StuCare × Scholare Ambassador account.</p>
            
            <div class="otp-box">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Your One-Time Password (OTP)</p>
              <div class="otp-code">${otp}</div>
              <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 12px;">Valid for 10 minutes</p>
            </div>
            
            <p>Enter this OTP on the password reset page to continue.</p>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong><br>
              If you didn't request a password reset, please ignore this email. Your account is secure.
            </div>
            
            <p>For security reasons, this OTP will expire in <strong>10 minutes</strong>.</p>
            
            <p>Best regards,<br><strong>StuCare × Scholare Team</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>&copy; ${new Date().getFullYear()} StuCare × Scholare. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody
    });
  }
}

// Export singleton instance
module.exports = new ZeptoMailService();
