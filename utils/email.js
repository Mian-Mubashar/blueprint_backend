const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter;

const initializeTransporter = async () => {
  try {
    if (transporter) {
      return transporter;
    }

    if (process.env.EMAIL_HOST) {
      // Custom SMTP
      transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587', 10),
        secure: (process.env.EMAIL_SECURE || 'false') === 'true',
        auth: process.env.EMAIL_USER && process.env.EMAIL_PASS ? {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        } : undefined
      });
    } else if (process.env.EMAIL_USER && (process.env.EMAIL_PASS || process.env.APP_PASSWORD)) {
      // Gmail via basic auth or app password
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS || process.env.APP_PASSWORD
        }
      });
    } else if (nodemailer.createTestAccount) {
      // Development fallback: create Ethereal test account (NOT for production)
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      console.log(`📧 Using Ethereal test SMTP. Login: ${testAccount.user}`);
    } else {
      throw new Error('Email transport is not configured. Set EMAIL_USER and EMAIL_PASS or EMAIL_HOST.');
    }

    await transporter.verify();
    console.log('✅ Email transporter configured');
    return transporter;
  } catch (e) {
    console.error('❌ Failed to initialize email transporter:', e.message);
    throwe;
  }
};

// Email templates
const templates = {
  'payment-confirmation': (data) => ({
    subject: 'Payment Confirmation - Blue Print Financial',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Blue Print Financial</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #1e3a8a;">Payment Confirmation</h2>
          <p>Dear ${data.name},</p>
          <p>Your payment has been successfully processed. Here are the details:</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%;">
              <tr>
                <td><strong>Amount:</strong></td>
                <td>₦${data.amount.toLocaleString()}</td>
              </tr>
              <tr>
                <td><strong>Payment Type:</strong></td>
                <td>${data.paymentType.replace('_', ' ').toUpperCase()}</td>
              </tr>
              <tr>
                <td><strong>Transaction ID:</strong></td>
                <td>${data.transactionId}</td>
              </tr>
              <tr>
                <td><strong>Date:</strong></td>
                <td>${data.date}</td>
              </tr>
            </table>
          </div>
          <p>Thank you for choosing Blue Print Financial. If you have any questions, please contact us.</p>
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://blueprintfinancial.ng" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Visit Our Website</a>
          </div>
        </div>
        <div style="background: #1e3a8a; padding: 20px; text-align: center; color: white;">
          <p style="margin: 0;">Blue Print Financial Ltd | Lagos, Nigeria</p>
          <p style="margin: 5px 0 0 0;">Email: info@blueprintfinancial.ng | Phone: +234 (0) 123 456 7890</p>
        </div>
      </div>
    `
  }),

  'contact-form': (data) => ({
    subject: `New Contact Form Submission: ${data.subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Blue Print Financial</h1>
          <p style="color: white; margin: 10px 0 0 0;">New Contact Form Submission</p>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #1e3a8a;">Contact Form Details</h2>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%;">
              <tr>
                <td><strong>Name:</strong></td>
                <td>${data.name}</td>
              </tr>
              <tr>
                <td><strong>Email:</strong></td>
                <td><a href="mailto:${data.email}">${data.email}</a></td>
              </tr>
              <tr>
                <td><strong>Phone:</strong></td>
                <td>${data.phone}</td>
              </tr>
              <tr>
                <td><strong>Subject:</strong></td>
                <td>${data.subject}</td>
              </tr>
              <tr>
                <td><strong>Date:</strong></td>
                <td>${data.submissionDate} at ${data.submissionTime}</td>
              </tr>
            </table>
          </div>
          <h3 style="color: #1e3a8a;">Message:</h3>
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
            <p style="margin: 0; line-height: 1.6;">${data.message}</p>
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <a href="mailto:${data.email}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Reply to Customer</a>
          </div>
        </div>
      </div>
    `
  }),

  'contact-confirmation': (data) => ({
    subject: 'Thank you for contacting Blue Print Financial',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Blue Print Financial</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #1e3a8a;">Thank You for Your Message</h2>
          <p>Dear ${data.name},</p>
          <p>Thank you for reaching out to us regarding "${data.subject}". We have received your message and our team will review it shortly.</p>
          <p>We typically respond to all inquiries within 24 hours during business days.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
            <h3 style="color: #1e3a8a; margin-top: 0;">What happens next?</h3>
            <ul style="color: #374151; line-height: 1.8;">
              <li>Our team will review your inquiry</li>
              <li>We'll contact you via email or phone</li>
              <li>We'll provide detailed information about our services</li>
              <li>If needed, we'll schedule a consultation</li>
            </ul>
          </div>
          <p>In the meantime, feel free to explore our website to learn more about our loan products and services.</p>
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://blueprintfinancial.ng" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Visit Our Website</a>
          </div>
        </div>
        <div style="background: #1e3a8a; padding: 20px; text-align: center; color: white;">
          <p style="margin: 0;">Blue Print Financial Ltd | Lagos, Nigeria</p>
          <p style="margin: 5px 0 0 0;">Email: info@blueprintfinancial.ng | Phone: +234 (0) 123 456 7890</p>
        </div>
      </div>
    `
  }),

  'admin-payment-notification': (data) => ({
    subject: `New Payment Received - ₦${data.amount.toLocaleString()}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">💰 New Payment Received</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #1e3a8a;">Payment Details</h2>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%;">
              <tr>
                <td><strong>Customer:</strong></td>
                <td>${data.customerName}</td>
              </tr>
              <tr>
                <td><strong>Email:</strong></td>
                <td>${data.customerEmail}</td>
              </tr>
              <tr>
                <td><strong>Amount:</strong></td>
                <td style="color: #22c55e; font-weight: bold;">₦${data.amount.toLocaleString()}</td>
              </tr>
              <tr>
                <td><strong>Payment Type:</strong></td>
                <td>${data.paymentType.replace('_', ' ').toUpperCase()}</td>
              </tr>
              <tr>
                <td><strong>Transaction ID:</strong></td>
                <td>${data.transactionId}</td>
              </tr>
              <tr>
                <td><strong>Date:</strong></td>
                <td>${data.date}</td>
              </tr>
            </table>
          </div>
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <p style="margin: 0; color: #92400e;"><strong>Note:</strong> This payment has been automatically processed through Stripe and confirmed in the system.</p>
          </div>
        </div>
      </div>
    `
  })
};

// Send email function
const sendEmail = async ({ to, subject, template, data }) => {
  try {
    if (!transporter) {
      await initializeTransporter();
    }
    const emailTemplate = templates[template];
    if (!emailTemplate) {
      throw new Error(`Email template '${template}' not found`);
    }

    const emailContent = emailTemplate(data);

    const mailOptions = {
      from: `"Blue Print Financial" <${process.env.EMAIL_USER || 'mubasharhanif24@gmail.com'}>`,
      to,
      subject: subject || emailContent.subject,
      html: emailContent.html
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return result;

  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
};

module.exports = sendEmail;
