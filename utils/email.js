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
  }),

  'password-reset': (data) => ({
    subject: 'Reset Your Password - Blue Print Financial',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Blue Print Financial</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #1e3a8a;">Password Reset Request</h2>
          <p>Dear ${data.name},</p>
          <p>We received a request to reset your password. Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.resetUrl}" style="background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Reset Password</a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:</p>
          <p style="color: #3b82f6; font-size: 12px; word-break: break-all; background: white; padding: 10px; border-radius: 4px;">${data.resetUrl}</p>
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;"><strong>Important:</strong> This link will expire in ${data.expiresIn}. If you didn't request a password reset, please ignore this email.</p>
          </div>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">If you're having trouble clicking the button, copy and paste the URL above into your web browser.</p>
        </div>
        <div style="background: #1e3a8a; padding: 20px; text-align: center; color: white;">
          <p style="margin: 0;">Blue Print Financial Ltd | Lagos, Nigeria</p>
          <p style="margin: 5px 0 0 0;">Email: info@blueprintfinancial.ng | Phone: +234 (0) 123 456 7890</p>
        </div>
      </div>
    `
  }),

  'loan-approved': (data) => ({
    subject: 'Congratulations! Your Loan Application Has Been Approved',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">✅ Loan Application Approved</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #1e3a8a;">Congratulations, ${data.name}!</h2>
          <p>We are pleased to inform you that your loan application has been <strong style="color: #22c55e;">approved</strong>.</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
            <h3 style="color: #1e3a8a; margin-top: 0;">Loan Details</h3>
            <table style="width: 100%;">
              <tr>
                <td style="padding: 8px 0;"><strong>Application ID:</strong></td>
                <td style="padding: 8px 0;">#${data.applicationId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Loan Type:</strong></td>
                <td style="padding: 8px 0; text-transform: capitalize;">${data.loanType}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Loan Amount:</strong></td>
                <td style="padding: 8px 0; color: #22c55e; font-weight: bold;">₦${data.amount}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Loan Duration:</strong></td>
                <td style="padding: 8px 0;">${data.duration} months</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Repayment Duration:</strong></td>
                <td style="padding: 8px 0; color: #3b82f6; font-weight: bold;">${data.duration} months</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Interest Rate:</strong></td>
                <td style="padding: 8px 0;">${data.interestRate}%</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Monthly Repayment:</strong></td>
                <td style="padding: 8px 0; color: #3b82f6; font-weight: bold;">₦${data.monthlyRepayment}</td>
              </tr>
            </table>
          </div>

          <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; border-left: 4px solid #22c55e; margin: 20px 0;">
            <p style="margin: 0; color: #166534;"><strong>Next Steps:</strong></p>
            <ul style="color: #166534; margin: 10px 0 0 20px; padding: 0;">
              <li>Your loan will be disbursed via bank transfer within 2-3 business days</li>
              <li>You will receive a confirmation once the funds are transferred</li>
              <li>Please ensure your bank account details are correct</li>
              <li>Monthly repayments will begin as per the schedule</li>
            </ul>
          </div>

          ${data.reviewNotes ? `
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;"><strong>Review Notes:</strong> ${data.reviewNotes}</p>
          </div>
          ` : ''}

          <p>If you have any questions, please don't hesitate to contact our customer service team.</p>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Dashboard</a>
          </div>
        </div>
        <div style="background: #1e3a8a; padding: 20px; text-align: center; color: white;">
          <p style="margin: 0;">Blue Print Financial Ltd | Lagos, Nigeria</p>
          <p style="margin: 5px 0 0 0;">Email: info@blueprintfinancial.ng | Phone: +234 (0) 123 456 7890</p>
        </div>
      </div>
    `
  }),

  'loan-rejected': (data) => ({
    subject: 'Loan Application Update - Blue Print Financial',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Loan Application Update</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #1e3a8a;">Dear ${data.name},</h2>
          <p>Thank you for your interest in Blue Print Financial. We have reviewed your loan application, and unfortunately, we are unable to approve it at this time.</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
            <h3 style="color: #1e3a8a; margin-top: 0;">Application Details</h3>
            <table style="width: 100%;">
              <tr>
                <td style="padding: 8px 0;"><strong>Application ID:</strong></td>
                <td style="padding: 8px 0;">#${data.applicationId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Loan Type:</strong></td>
                <td style="padding: 8px 0; text-transform: capitalize;">${data.loanType}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Requested Amount:</strong></td>
                <td style="padding: 8px 0;">₦${data.amount}</td>
              </tr>
            </table>
          </div>

          <div style="background: #fef2f2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 20px 0;">
            <p style="margin: 0; color: #991b1b;"><strong>Reason:</strong></p>
            <p style="margin: 10px 0 0 0; color: #991b1b;">${data.reviewNotes}</p>
          </div>

          <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #166534;"><strong>What's Next?</strong></p>
            <ul style="color: #166534; margin: 10px 0 0 20px; padding: 0;">
              <li>You can reapply after addressing the concerns mentioned above</li>
              <li>Consider improving your credit profile or providing additional documentation</li>
              <li>Our team is available to discuss alternative loan options</li>
              <li>You can contact us for personalized financial advice</li>
            </ul>
          </div>

          <p>We appreciate your interest in Blue Print Financial and encourage you to apply again in the future when your circumstances may have changed.</p>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/contact" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-right: 10px;">Contact Us</a>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/apply-loan" style="background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Apply Again</a>
          </div>
        </div>
        <div style="background: #1e3a8a; padding: 20px; text-align: center; color: white;">
          <p style="margin: 0;">Blue Print Financial Ltd | Lagos, Nigeria</p>
          <p style="margin: 5px 0 0 0;">Email: info@blueprintfinancial.ng | Phone: +234 (0) 123 456 7890</p>
        </div>
      </div>
    `
  }),

  'loan-disbursed': (data) => ({
    subject: 'Loan Disbursed - Funds Transferred Successfully',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">💰 Loan Disbursed Successfully</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #1e3a8a;">Dear ${data.name},</h2>
          <p>We are pleased to inform you that your loan has been <strong style="color: #3b82f6;">disbursed</strong> and the funds have been transferred to your bank account.</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
            <h3 style="color: #1e3a8a; margin-top: 0;">Disbursement Details</h3>
            <table style="width: 100%;">
              <tr>
                <td style="padding: 8px 0;"><strong>Application ID:</strong></td>
                <td style="padding: 8px 0;">#${data.applicationId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Loan Type:</strong></td>
                <td style="padding: 8px 0; text-transform: capitalize;">${data.loanType}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Disbursed Amount:</strong></td>
                <td style="padding: 8px 0; color: #3b82f6; font-weight: bold; font-size: 18px;">₦${data.amount}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Disbursement Date:</strong></td>
                <td style="padding: 8px 0;">${data.disbursementDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Bank Account:</strong></td>
                <td style="padding: 8px 0;">${data.bankName} - ${data.accountNumber}</td>
              </tr>
            </table>
          </div>

          <div style="background: #eff6ff; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 20px 0;">
            <p style="margin: 0; color: #1e40af;"><strong>Important Information:</strong></p>
            <ul style="color: #1e40af; margin: 10px 0 0 20px; padding: 0;">
              <li>Please check your bank account for the transferred funds</li>
              <li>Funds should reflect within 24-48 hours depending on your bank</li>
              <li>Monthly repayments will begin as per your repayment schedule</li>
              <li>You can view your repayment schedule in your dashboard</li>
            </ul>
          </div>

          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1e3a8a; margin-top: 0;">Repayment Summary</h3>
            <table style="width: 100%;">
              <tr>
                <td style="padding: 8px 0;"><strong>Loan Duration:</strong></td>
                <td style="padding: 8px 0;">${data.duration} months</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Monthly Repayment:</strong></td>
                <td style="padding: 8px 0; color: #3b82f6; font-weight: bold;">₦${data.monthlyRepayment}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Interest Rate:</strong></td>
                <td style="padding: 8px 0;">${data.interestRate}%</td>
              </tr>
            </table>
          </div>

          <p>If you have any questions or concerns, please don't hesitate to contact our customer service team.</p>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-right: 10px;">View Dashboard</a>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/repayment-schedule" style="background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Repayment Schedule</a>
          </div>
        </div>
        <div style="background: #1e3a8a; padding: 20px; text-align: center; color: white;">
          <p style="margin: 0;">Blue Print Financial Ltd | Lagos, Nigeria</p>
          <p style="margin: 5px 0 0 0;">Email: info@blueprintfinancial.ng | Phone: +234 (0) 123 456 7890</p>
        </div>
      </div>
    `
  })
};

// Send email function
const sendEmail = async ({ to, subject, template, data, isAdminEmail = false }) => {
  try {
    // Validate and prepare email address
    if (!to) {
      throw new Error('Email address (to) is required');
    }
    
    if (typeof to !== 'string') {
      throw new Error(`Email address must be a string, got: ${typeof to}`);
    }
    
    const recipientEmail = to.trim();
    
    if (!recipientEmail.includes('@') || recipientEmail.length < 5) {
      throw new Error(`Invalid email address format: ${recipientEmail}`);
    }

    if (!transporter) {
      await initializeTransporter();
    }
    
    const emailTemplate = templates[template];
    if (!emailTemplate) {
      throw new Error(`Email template '${template}' not found`);
    }

    const emailContent = emailTemplate(data);

    // CRITICAL: Ensure we NEVER use hardcoded email as recipient for USER emails
    // But allow admin emails when explicitly flagged (for admin notifications)
    if (recipientEmail.toLowerCase() === 'mubasharhanif24@gmail.com' && !isAdminEmail) {
      console.error('❌ ERROR: Attempted to send email to hardcoded admin email!');
      console.error('   This should NEVER happen for user emails.');
      console.error('   Original to parameter:', to);
      console.error('   Template:', template);
      console.error('   isAdminEmail flag:', isAdminEmail);
      throw new Error('Cannot send email to hardcoded admin address. User email required.');
    }

    // Build mail options - CRITICAL: Use the provided 'to' email, not any hardcoded value
    const mailOptions = {
      from: `"Blue Print Financial" <${process.env.EMAIL_USER || 'mubasharhanif24@gmail.com'}>`,
      to: recipientEmail, // Use the provided recipient email (user's email)
      subject: subject || emailContent.subject,
      html: emailContent.html
    };

    console.log('=== EMAIL UTILITY SENDING EMAIL ===');
    console.log('📧 Recipient Email (to):', mailOptions.to);
    console.log('📧 From Email:', mailOptions.from);
    console.log('📧 Subject:', mailOptions.subject);
    console.log('📧 Template:', template);
    console.log('📧 Original to parameter:', to);
    console.log('📧 isAdminEmail flag:', isAdminEmail);
    console.log('📧 Recipient email validation:', {
      isString: typeof recipientEmail === 'string',
      hasAt: recipientEmail.includes('@'),
      length: recipientEmail.length,
      isAdminEmail: isAdminEmail,
      isAdminAddress: recipientEmail.toLowerCase() === 'mubasharhanif24@gmail.com'
    });

    const result = await transporter.sendMail(mailOptions);
    return result;

  } catch (error) {
    throw error;
  }
};

module.exports = sendEmail;
