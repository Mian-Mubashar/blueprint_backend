const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const sendEmail = require('../utils/email');

const router = express.Router();

// Custom validator for Nigerian phone numbers
const validateNigerianPhone = (value) => {
  if (!value) return true; // Phone is optional
  
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  
  // Must be either 11 digits (0XXXXXXXXXX) or 13 digits (234XXXXXXXXXX)
  if (digits.length !== 11 && digits.length !== 13) {
    return false;
  }
  
  // If 11 digits, must start with 0
  if (digits.length === 11 && !digits.startsWith('0')) {
    return false;
  }
  
  // If 13 digits, must start with 234
  if (digits.length === 13 && !digits.startsWith('234')) {
    return false;
  }
  
  // Valid Nigerian mobile prefixes
  const validPrefixes = ['070', '080', '081', '090', '091', '082', '083', '084', '085', '086', '087', '088', '089', '092', '093', '094', '095', '096', '097', '098', '099'];
  const prefix = digits.length === 11 ? digits.slice(0, 3) : digits.slice(3, 6);
  
  return validPrefixes.includes(prefix);
};

// Submit contact form
router.post('/submit', [
  body('name').notEmpty().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('email').isEmail().withMessage('Please provide a valid email address'),
  body('phone').optional().custom(validateNigerianPhone).withMessage('Please enter a valid Nigerian phone number'),
  body('subject').notEmpty().trim().isLength({ max: 200 }).withMessage('Subject is required and must be less than 200 characters'),                                   
  body('message').notEmpty().trim().isLength({ min: 10, max: 1000 }).withMessage('Message must be between 10 and 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation errors:', errors.array());
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array().map(err => ({
          field: err.param,
          message: err.msg
        }))
      });
    }

    const { name, email, phone, subject, message } = req.body;
    
    // Use the original email from request body (trimmed and lowercased for consistency)
    const userEmail = email.trim().toLowerCase();

    console.log('=== CONTACT FORM SUBMISSION ===');
    console.log('📝 Name:', name);
    console.log('📧 User Email (original):', email);
    console.log('📧 User Email (processed):', userEmail);
    console.log('📱 Phone:', phone || 'Not provided');
    console.log('📋 Subject:', subject);

    // Store contact submission in database
    let submissionId;
    try {
      const [result] = await pool.execute(
        `INSERT INTO contact_submissions (
          name, email, phone, subject, message
        ) VALUES (?, ?, ?, ?, ?)`,
        [name, userEmail, phone || null, subject, message]
      );
      submissionId = result.insertId;
      console.log('Contact submission saved to database with ID:', submissionId);
    } catch (dbError) {
      console.error('Database error:', dbError);
      // Check if table doesn't exist
      if (dbError.code === 'ER_NO_SUCH_TABLE') {
        return res.status(500).json({
          message: 'Database table not found. Please run database migrations.',
          error: dbError.message
        });
      }
      throw dbError;
    }

    // Send email to admin (optional - don't fail if email service is not configured)
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'mubasharhanif24@gmail.com';
      console.log('📧 Sending admin notification to:', adminEmail);
      await sendEmail({
        to: adminEmail,
        subject: `New Contact Form Submission: ${subject}`,
        template: 'contact-form',
        data: {
          name,
          email: userEmail,
          phone: phone || 'Not provided',
          subject,
          message,
          submissionDate: new Date().toLocaleDateString('en-NG'),
          submissionTime: new Date().toLocaleTimeString('en-NG')
        },
        isAdminEmail: true // Flag to allow admin emails
      });
      console.log('✅ Admin notification email sent successfully to:', adminEmail);
    } catch (emailError) {
      console.error('❌ Failed to send admin email (non-critical):', emailError.message);
      console.error('   Error details:', emailError);
      // Don't fail the request if email fails
    }

    // Send confirmation email to user (optional)
    try {
      console.log('📧 Sending confirmation email to user:', userEmail);
      await sendEmail({
        to: userEmail,
        subject: 'Thank you for contacting Blue Print Financial',
        template: 'contact-confirmation',
        data: {
          name,
          subject
        }
      });
      console.log('✅ Confirmation email sent successfully to user:', userEmail);
    } catch (emailError) {
      console.error('❌ Failed to send confirmation email (non-critical):', emailError.message);
      console.error('   Error details:', emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      message: 'Contact form submitted successfully. We will get back to you soon!',
      submissionId
    });

  } catch (error) {
    console.error('Contact form submission error:', error);
    res.status(500).json({
      message: 'Failed to submit contact form. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get contact submissions (admin only - would need admin auth in production)
router.get('/submissions', async (req, res) => {
  try {
    const [submissions] = await pool.execute(
      `SELECT 
        id, name, email, phone, subject, message, status, created_at
      FROM contact_submissions 
      ORDER BY created_at DESC`
    );

    res.json({
      submissions
    });

  } catch (error) {
    console.error('Get contact submissions error:', error);
    res.status(500).json({
      message: 'Failed to get contact submissions',
      error: error.message
    });
  }
});

// Update contact submission status (admin only)
router.put('/:id/status', [
  body('status').isIn(['new', 'in_progress', 'resolved'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { status } = req.body;

    const [result] = await pool.execute(
      'UPDATE contact_submissions SET status = ? WHERE id = ?',
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: 'Contact submission not found'
      });
    }

    res.json({
      message: 'Contact submission status updated successfully'
    });

  } catch (error) {
    console.error('Update contact submission error:', error);
    res.status(500).json({
      message: 'Failed to update contact submission',
      error: error.message
    });
  }
});

// Get contact statistics
router.get('/stats', async (req, res) => {
  try {
    const [stats] = await pool.execute(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_count,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_count
      FROM contact_submissions`
    );

    res.json({
      stats: stats[0]
    });

  } catch (error) {
    console.error('Get contact stats error:', error);
    res.status(500).json({
      message: 'Failed to get contact statistics',
      error: error.message
    });
  }
});

module.exports = router;



