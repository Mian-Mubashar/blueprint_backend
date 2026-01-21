const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all loan applications for a user
router.get('/my-applications', auth, async (req, res) => {
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
    console.error('Get applications error:', error);
    res.status(500).json({
      message: 'Failed to get loan applications',
      error: error.message
    });
  }
});

// Get specific loan application
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const [applications] = await pool.execute(
      `SELECT 
        id, loan_type, amount_requested, loan_duration, purpose, 
        monthly_repayment, interest_rate, status, application_documents,
        collateral_details, business_details, review_notes, created_at, 
        approved_at, disbursed_at
      FROM loan_applications 
      WHERE id = ? AND user_id = ?`,
      [id, req.user.userId]
    );

    if (applications.length === 0) {
      return res.status(404).json({
        message: 'Loan application not found'
      });
    }

    res.json({
      application: applications[0]
    });

  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({
      message: 'Failed to get loan application',
      error: error.message
    });
  }
});

// Create new loan application
router.post('/apply', auth, [
  body('loanType').isIn(['small_business', 'payday', 'collateral']),
  body('amountRequested').isFloat({ min: 10000, max: 50000000 }),
  body('loanDuration').isInt({ min: 1, max: 60 }),
  body('purpose').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      loanType,
      amountRequested,
      loanDuration,
      purpose,
      collateralDetails,
      businessDetails,
      applicationDocuments
    } = req.body;

    // Get system settings for interest rates
    const [settings] = await pool.execute(
      'SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE ?',
      [`${loanType}_interest_rate`]
    );

    const interestRate = settings.length > 0 ? parseFloat(settings[0].setting_value) : 15.0;

    // Calculate monthly repayment (simple interest calculation)
    const monthlyInterestRate = interestRate / 100 / 12;
    const monthlyRepayment = (amountRequested * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, loanDuration)) / 
                           (Math.pow(1 + monthlyInterestRate, loanDuration) - 1);

    // Insert loan application
    const [result] = await pool.execute(
      `INSERT INTO loan_applications (
        user_id, loan_type, amount_requested, loan_duration, purpose,
        monthly_repayment, interest_rate, collateral_details, business_details,
        application_documents
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.userId,
        loanType,
        amountRequested,
        loanDuration,
        purpose,
        monthlyRepayment,
        interestRate,
        JSON.stringify(collateralDetails || {}),
        JSON.stringify(businessDetails || {}),
        JSON.stringify(applicationDocuments || [])
      ]
    );

    // Get the created application
    const [newApplication] = await pool.execute(
      `SELECT 
        id, loan_type, amount_requested, loan_duration, purpose, 
        monthly_repayment, interest_rate, status, created_at
      FROM loan_applications 
      WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: 'Loan application submitted successfully',
      application: newApplication[0]
    });

  } catch (error) {
    console.error('Loan application error:', error);
    res.status(500).json({
      message: 'Failed to submit loan application',
      error: error.message
    });
  }
});

// Update loan application
router.put('/:id', auth, [
  body('loanType').optional().isIn(['small_business', 'payday', 'collateral']),
  body('amountRequested').optional().isFloat({ min: 10000, max: 50000000 }),
  body('loanDuration').optional().isInt({ min: 1, max: 60 }),
  body('purpose').optional().notEmpty().trim()
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
    const {
      loanType,
      amountRequested,
      loanDuration,
      purpose,
      collateralDetails,
      businessDetails,
      applicationDocuments
    } = req.body;

    // Check if application exists and belongs to user
    const [existingApplications] = await pool.execute(
      'SELECT id, status FROM loan_applications WHERE id = ? AND user_id = ?',
      [id, req.user.userId]
    );

    if (existingApplications.length === 0) {
      return res.status(404).json({
        message: 'Loan application not found'
      });
    }

    if (existingApplications[0].status !== 'pending') {
      return res.status(400).json({
        message: 'Cannot update application that is not pending'
      });
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];

    if (loanType) { updateFields.push('loan_type = ?'); updateValues.push(loanType); }
    if (amountRequested) { updateFields.push('amount_requested = ?'); updateValues.push(amountRequested); }
    if (loanDuration) { updateFields.push('loan_duration = ?'); updateValues.push(loanDuration); }
    if (purpose) { updateFields.push('purpose = ?'); updateValues.push(purpose); }
    if (collateralDetails) { updateFields.push('collateral_details = ?'); updateValues.push(JSON.stringify(collateralDetails)); }
    if (businessDetails) { updateFields.push('business_details = ?'); updateValues.push(JSON.stringify(businessDetails)); }
    if (applicationDocuments) { updateFields.push('application_documents = ?'); updateValues.push(JSON.stringify(applicationDocuments)); }

    if (updateFields.length === 0) {
      return res.status(400).json({
        message: 'No fields to update'
      });
    }

    updateValues.push(id);

    const [result] = await pool.execute(
      `UPDATE loan_applications SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: 'Failed to update loan application'
      });
    }

    // Get updated application
    const [updatedApplication] = await pool.execute(
      `SELECT 
        id, loan_type, amount_requested, loan_duration, purpose, 
        monthly_repayment, interest_rate, status, created_at
      FROM loan_applications 
      WHERE id = ?`,
      [id]
    );

    res.json({
      message: 'Loan application updated successfully',
      application: updatedApplication[0]
    });

  } catch (error) {
    console.error('Update application error:', error);
    res.status(500).json({
      message: 'Failed to update loan application',
      error: error.message
    });
  }
});

// Cancel loan application
router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.execute(
      'UPDATE loan_applications SET status = ? WHERE id = ? AND user_id = ? AND status = ?',
      ['rejected', id, req.user.userId, 'pending']
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: 'Loan application not found or cannot be cancelled'
      });
    }

    res.json({
      message: 'Loan application cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel application error:', error);
    res.status(500).json({
      message: 'Failed to cancel loan application',
      error: error.message
    });
  }
});

// Get loan calculator data
router.get('/calculator/rates', async (req, res) => {
  try {
    const [settings] = await pool.execute(
      'SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE ?',
      ['%_interest_rate']
    );

    const rates = {};
    settings.forEach(setting => {
      const loanType = setting.setting_key.replace('_interest_rate', '');
      rates[loanType] = parseFloat(setting.setting_value);
    });

    // Get maximum amounts
    const [amountSettings] = await pool.execute(
      'SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE ?',
      ['max_%_amount']
    );

    const maxAmounts = {};
    amountSettings.forEach(setting => {
      const loanType = setting.setting_key.replace('max_', '').replace('_amount', '');
      maxAmounts[loanType] = parseFloat(setting.setting_value);
    });

    res.json({
      interestRates: rates,
      maxAmounts: maxAmounts
    });

  } catch (error) {
    console.error('Get calculator data error:', error);
    res.status(500).json({
      message: 'Failed to get calculator data',
      error: error.message
    });
  }
});

// Calculate loan payment
router.post('/calculator/calculate', [
  body('amount').isFloat({ min: 10000 }),
  body('duration').isInt({ min: 1, max: 60 }),
  body('loanType').isIn(['small_business', 'payday', 'collateral'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { amount, duration, loanType } = req.body;

    // Get interest rate for loan type
    const [settings] = await pool.execute(
      'SELECT setting_value FROM system_settings WHERE setting_key = ?',
      [`${loanType}_interest_rate`]
    );

    const interestRate = settings.length > 0 ? parseFloat(settings[0].setting_value) : 15.0;

    // Calculate monthly payment
    const monthlyInterestRate = interestRate / 100 / 12;
    const monthlyPayment = (amount * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, duration)) / 
                          (Math.pow(1 + monthlyInterestRate, duration) - 1);

    const totalPayment = monthlyPayment * duration;
    const totalInterest = totalPayment - amount;

    res.json({
      loanAmount: amount,
      loanDuration: duration,
      interestRate: interestRate,
      monthlyPayment: Math.round(monthlyPayment * 100) / 100,
      totalPayment: Math.round(totalPayment * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100
    });

  } catch (error) {
    console.error('Calculate loan error:', error);
    res.status(500).json({
      message: 'Failed to calculate loan payment',
      error: error.message
    });
  }
});

module.exports = router;



