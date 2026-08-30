const express = require('express');
const pool = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// Get user dashboard data
router.get('/dashboard', auth, async (req, res) => {
  try {
    // Get user's loan applications summary
    const [applications] = await pool.execute(
      `SELECT 
        COUNT(*) as total_applications,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN status = 'disbursed' THEN 1 ELSE 0 END) as disbursed_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
        SUM(amount_requested) as total_amount_requested
      FROM loan_applications 
      WHERE user_id = ?`,
      [req.user.userId]
    );

    // Get recent loan applications
    const [recentApplications] = await pool.execute(
      `SELECT 
        id, loan_type, amount_requested, status, created_at
      FROM loan_applications 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 5`,
      [req.user.userId]
    );

    // Get payment summary
    const [payments] = await pool.execute(
      `SELECT 
        COUNT(*) as total_payments,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_payments,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_payments,
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_paid
      FROM payments 
      WHERE user_id = ?`,
      [req.user.userId]
    );

    // Get recent payments
    const [recentPayments] = await pool.execute(
      `SELECT 
        p.id, p.amount, p.payment_type, p.status, p.payment_date,
        la.loan_type
      FROM payments p
      LEFT JOIN loan_applications la ON p.loan_application_id = la.id
      WHERE p.user_id = ?
      ORDER BY p.payment_date DESC 
      LIMIT 5`,
      [req.user.userId]
    );

    // Get user profile
    const [users] = await pool.execute(
      'SELECT first_name, last_name, email, phone, is_verified FROM users WHERE id = ?',
      [req.user.userId]
    );

    res.json({
      user: users[0],
      applications: applications[0],
      recentApplications,
      payments: payments[0],
      recentPayments
    });

  } catch (error) {
    console.error('Get dashboard data error:', error);
    res.status(500).json({
      message: 'Failed to get dashboard data',
      error: error.message
    });
  }
});

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const [users] = await pool.execute(
      `SELECT 
        id, email, first_name, last_name, phone, date_of_birth, 
        address, city, state, bvn, bank_account_number, bank_name, 
        account_name, employment_status, monthly_income, employer_name, 
        job_title, employment_duration, is_verified, created_at
      FROM users 
      WHERE id = ?`,
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    res.json({
      user: users[0]
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      message: 'Failed to get user profile',
      error: error.message
    });
  }
});

// Get user's loan applications
router.get('/loan-applications', auth, async (req, res) => {
  try {
    const [applications] = await pool.execute(
      `SELECT 
        id, loan_type, amount_requested, loan_duration, purpose, 
        monthly_repayment, interest_rate, status, created_at, 
        approved_at, disbursed_at
      FROM loan_applications 
      WHERE user_id = ? 
      ORDER BY created_at DESC`,
      [req.user.userId]
    );

    res.json({
      applications
    });

  } catch (error) {
    console.error('Get loan applications error:', error);
    res.status(500).json({
      message: 'Failed to get loan applications',
      error: error.message
    });
  }
});

// Get user's payment history
router.get('/payments', auth, async (req, res) => {
  try {
    const [payments] = await pool.execute(
      `SELECT 
        p.id, p.amount, p.payment_type, p.payment_method, 
        p.status, p.payment_date, p.transaction_reference,
        la.loan_type, la.amount_requested
      FROM payments p
      LEFT JOIN loan_applications la ON p.loan_application_id = la.id
      WHERE p.user_id = ?
      ORDER BY p.payment_date DESC`,
      [req.user.userId]
    );

    res.json({
      payments
    });

  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      message: 'Failed to get payment history',
      error: error.message
    });
  }
});

module.exports = router;



