const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const sendEmail = require('../utils/email');

const router = express.Router();

// Submit contact form
router.post('/submit', [
  body('name').notEmpty().trim().isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('phone').optional().isMobilePhone('any'),
  body('subject').notEmpty().trim().isLength({ max: 200 }),                                   
  body('message').notEmpty().trim().isLength({ min: 10, max: 1000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {  
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, email, phone, subject, message } = req.body;

    // Store contact submission in database
    const [result] = await pool.execute(
      `INSERT INTO contact_submissions (
        name, email, phone, subject, message
      ) VALUES (?, ?, ?, ?, ?)`,
      [name, email, phone, subject, message]
    );

    // Send email to admin
    await sendEmail({
      to: 'mubasharhanif24@gmail.com',
      subject: `New Contact Form Submission: ${subject}`,
      template: 'contact-form',
      data: {
        name,
        email,
        phone: phone || 'Not provided',
        subject,
        message,
        submissionDate: new Date().toLocaleDateString('en-NG'),
        submissionTime: new Date().toLocaleTimeString('en-NG')
      }
    });

    // Send confirmation email to user
    await sendEmail({
      to: email,
      subject: 'Thank you for contacting Blue Print Financial',
      template: 'contact-confirmation',
      data: {
        name,
        subject
      }
    });

    res.status(201).json({
      message: 'Contact form submitted successfully. We will get back to you soon!'
    });

  } catch (error) {
    console.error('Contact form submission error:', error);
    res.status(500).json({
      message: 'Failed to submit contact form',
      error: error.message
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



