const express = require('express');
const pool = require('../config/database');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const sendEmail = require('../utils/email');

const router = express.Router();

// All admin routes require authenticated admin
router.use(auth, requireRole('admin'));

// Simple admin dashboard summary
router.get('/dashboard', async (req, res) => {
  try {
    const [[loanStats]] = await pool.execute(
      `SELECT 
        COUNT(*) AS total_applications,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'under_review' THEN 1 ELSE 0 END) AS under_review,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 'disbursed' THEN 1 ELSE 0 END) AS disbursed,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected
      FROM loan_applications`
    );

    const [[paymentStats]] = await pool.execute(
      `SELECT 
        COUNT(*) AS total_payments,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_payments,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_payments,
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) AS total_collected
      FROM payments`
    );

    const [recentLoans] = await pool.execute(
      `SELECT id, user_id, loan_type, amount_requested, status, created_at
       FROM loan_applications
       ORDER BY created_at DESC
       LIMIT 10`
    );

    const [recentPayments] = await pool.execute(
      `SELECT id, user_id, amount, payment_type, status, payment_date
       FROM payments
       ORDER BY payment_date DESC
       LIMIT 10`
    );

    res.json({
      loanStats,
      paymentStats,
      recentLoans,
      recentPayments,
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ message: 'Failed to load admin dashboard', error: error.message });
  }
});

// Get all applications
router.get('/applications', async (req, res) => {
  try {
    const [applications] = await pool.execute(`
      SELECT la.*, u.first_name, u.last_name, u.email, u.phone, u.bank_name, u.bank_account_number, u.account_name 
      FROM loan_applications la 
      JOIN users u ON la.user_id = u.id 
      ORDER BY la.created_at DESC
    `);
    res.json({ applications });
  } catch (error) {
    console.error('Get all applications error:', error);
    res.status(500).json({ message: 'Failed to load applications', error: error.message });
  }
});

// Get single application
router.get('/applications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [applications] = await pool.execute(`
      SELECT la.*, u.first_name, u.last_name, u.email, u.phone, u.bank_name, u.bank_account_number, u.account_name 
      FROM loan_applications la 
      JOIN users u ON la.user_id = u.id 
      WHERE la.id = ?
    `, [id]);

    if (applications.length === 0) return res.status(404).json({ message: 'Application not found' });
    res.json({ application: applications[0] });
  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({ message: 'Failed to load application', error: error.message });
  }
});

// Update application status (Approve, Reject, Disburse)
router.put('/applications/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, interestRate, monthlyRepayment, reviewNotes } = req.body;

    if (!['pending', 'approved', 'rejected', 'disbursed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    let query = 'UPDATE loan_applications SET status = ?';
    let params = [status];

    if (status === 'approved') {
      query += ', approved_at = NOW(), approved_by = ?';
      params.push(req.user.userId);
      if (interestRate !== undefined) {
        query += ', interest_rate = ?';
        params.push(interestRate);
      }
      if (monthlyRepayment !== undefined) {
        query += ', monthly_repayment = ?';
        params.push(monthlyRepayment);
      }
    } else if (status === 'disbursed') {
      // Amount disbursed is the amount requested for now based on schema
      // But we record disbursement date
      query += ', disbursed_at = NOW()';
    }

    if (reviewNotes !== undefined) {
      query += ', review_notes = ?';
      params.push(reviewNotes);
    }

    query += ' WHERE id = ?';
    params.push(id);

    await pool.execute(query, params);

    // Fetch updated application with user details
    const [updated] = await pool.execute(
      `SELECT la.*, u.email, u.first_name, u.last_name 
       FROM loan_applications la 
       JOIN users u ON la.user_id = u.id 
       WHERE la.id = ?`,
      [id]
    );

    const application = updated[0];

    // Send email notification to user
    try {
      if (status === 'approved') {
        await sendEmail({
          to: application.email,
          subject: 'Loan Application Approved - Blue Print Financial',
          template: 'loan-approved',
          data: {
            name: application.first_name,
            loanType: application.loan_type.replace('_', ' '),
            amount: parseFloat(application.amount_requested).toLocaleString(),
            duration: application.loan_duration,
            monthlyRepayment: application.monthly_repayment ? parseFloat(application.monthly_repayment).toLocaleString() : 'N/A',
            interestRate: application.interest_rate || 'N/A',
            reviewNotes: application.review_notes || 'Your application has been reviewed and approved.',
            applicationId: application.id
          }
        });
        console.log('Loan approval email sent to:', application.email);
      } else if (status === 'rejected') {
        await sendEmail({
          to: application.email,
          subject: 'Loan Application Update - Blue Print Financial',
          template: 'loan-rejected',
          data: {
            name: application.first_name,
            loanType: application.loan_type.replace('_', ' '),
            amount: parseFloat(application.amount_requested).toLocaleString(),
            reviewNotes: application.review_notes || 'Unfortunately, your loan application could not be approved at this time.',
            applicationId: application.id
          }
        });
        console.log('Loan rejection email sent to:', application.email);
      } else if (status === 'disbursed') {
        // Get user's bank details
        const [userDetails] = await pool.execute(
          'SELECT bank_name, bank_account_number, account_name FROM users WHERE id = ?',
          [application.user_id]
        );
        
        const userBank = userDetails[0] || {};
        const disbursementDate = new Date().toLocaleDateString('en-NG', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        
        await sendEmail({
          to: application.email,
          subject: 'Loan Disbursed - Funds Transferred Successfully',
          template: 'loan-disbursed',
          data: {
            name: application.first_name,
            loanType: application.loan_type.replace('_', ' '),
            amount: parseFloat(application.amount_requested).toLocaleString(),
            duration: application.loan_duration,
            monthlyRepayment: application.monthly_repayment ? parseFloat(application.monthly_repayment).toLocaleString() : 'N/A',
            interestRate: application.interest_rate || 'N/A',
            disbursementDate: disbursementDate,
            bankName: userBank.bank_name || 'N/A',
            accountNumber: userBank.bank_account_number ? `****${userBank.bank_account_number.slice(-4)}` : 'N/A',
            applicationId: application.id
          }
        });
        console.log('Loan disbursement email sent to:', application.email);
      }
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
      // Don't fail the request if email fails
    }

    res.json({ message: 'Status updated successfully', application });

  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Failed to update application status', error: error.message });
  }
});

// Get all payments with user details
router.get('/payments', async (req, res) => {
  try {
    const { status, search, startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        p.id,
        p.loan_application_id,
        p.user_id,
        p.amount,
        p.payment_type,
        p.payment_method,
        p.status,
        p.payment_date,
        p.due_date,
        p.transaction_reference,
        p.stripe_payment_intent_id,
        p.payer_name,
        p.payer_email,
        p.created_at,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        la.loan_type,
        la.amount_requested as loan_amount,
        la.status as loan_status
      FROM payments p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN loan_applications la ON p.loan_application_id = la.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (status && status !== 'all') {
      query += ' AND p.status = ?';
      params.push(status);
    }
    
    if (search) {
      query += ` AND (
        u.first_name LIKE ? OR 
        u.last_name LIKE ? OR 
        u.email LIKE ? OR 
        u.phone LIKE ? OR
        p.payer_name LIKE ? OR
        p.payer_email LIKE ? OR
        p.transaction_reference LIKE ? OR
        p.stripe_payment_intent_id LIKE ?
      )`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    if (startDate) {
      query += ' AND DATE(p.payment_date) >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND DATE(p.payment_date) <= ?';
      params.push(endDate);
    }
    
    query += ' ORDER BY p.payment_date DESC, p.created_at DESC';
    
    const [payments] = await pool.execute(query, params);
    
    // Calculate stats
    const [stats] = await pool.execute(`
      SELECT 
        COUNT(*) AS total_payments,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) AS total_collected
      FROM payments
    `);
    
    res.json({
      payments,
      stats: stats[0] || {}
    });
  } catch (error) {
    console.error('Get admin payments error:', error);
    res.status(500).json({ message: 'Failed to load payments', error: error.message });
  }
});

// Get payment details
router.get('/payments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [payments] = await pool.execute(`
      SELECT 
        p.*,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        la.loan_type,
        la.amount_requested as loan_amount,
        la.status as loan_status
      FROM payments p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN loan_applications la ON p.loan_application_id = la.id
      WHERE p.id = ?
    `, [id]);
    
    if (payments.length === 0) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    res.json({ payment: payments[0] });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ message: 'Failed to load payment', error: error.message });
  }
});

module.exports = router;


