const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const auth = require('../middleware/auth');
const sendEmail = require('../utils/email');

const router = express.Router();

// Public quick payment intent (no auth, no DB record)
router.post('/public/create-payment-intent', [
  body('amount').isFloat({ min: 100, max: 10000000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { amount } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'ngn',
      metadata: {
        source: 'quick_payment'
      },
      description: `Quick payment`
    });

    res.json({
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    console.error('Public create payment intent error:', error);
    res.status(500).json({
      message: 'Failed to create payment intent',
      error: error.message
    });
  }
});

// Create payment intent
router.post('/create-payment-intent', auth, [
  body('loanApplicationId').isInt(),
  body('amount').isFloat({ min: 10, max: 10000000 }),
  body('paymentType').isIn(['loan_repayment', 'processing_fee', 'late_fee', 'early_repayment'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { loanApplicationId, amount, paymentType } = req.body;

    // Verify loan application exists and belongs to user
    const [applications] = await pool.execute(
      'SELECT id, user_id, amount_requested FROM loan_applications WHERE id = ? AND user_id = ?',
      [loanApplicationId, req.user.userId]
    );

    if (applications.length === 0) {
      return res.status(404).json({
        message: 'Loan application not found'
      });
    }

    // Create payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'ngn',
      metadata: {
        userId: req.user.userId,
        loanApplicationId: loanApplicationId,
        paymentType: paymentType
      },
      description: `Payment for ${paymentType} - Loan Application #${loanApplicationId}`
    });

    // Store payment record
    const [result] = await pool.execute(
      `INSERT INTO payments (
        loan_application_id, user_id, amount, payment_type, 
        payment_method, stripe_payment_intent_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        loanApplicationId,
        req.user.userId,
        amount,
        paymentType,
        'card',
        paymentIntent.id,
        'pending'
      ]
    );

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentId: result.insertId
    });

  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({
      message: 'Failed to create payment intent',
      error: error.message
    });
  }
});

// Confirm payment
router.post('/confirm-payment', auth, [
  body('paymentId').isInt(),
  body('paymentIntentId').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { paymentId, paymentIntentId } = req.body;

    // Get payment record
    const [payments] = await pool.execute(
      'SELECT * FROM payments WHERE id = ? AND user_id = ?',
      [paymentId, req.user.userId]
    );

    if (payments.length === 0) {
      return res.status(404).json({
        message: 'Payment not found'
      });
    }

    const payment = payments[0];

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      // Update payment status
      await pool.execute(
        'UPDATE payments SET status = ?, transaction_reference = ? WHERE id = ?',
        ['completed', paymentIntentId, paymentId]
      );

      // Send confirmation email
      const [users] = await pool.execute(
        'SELECT email, first_name, last_name FROM users WHERE id = ?',
        [req.user.userId]
      );

      if (users.length > 0) {
        const user = users[0];
        await sendEmail({
          to: user.email,
          subject: 'Payment Confirmation - Blue Print Financial',
          template: 'payment-confirmation',
          data: {
            name: `${user.first_name} ${user.last_name}`,
            amount: payment.amount,
            paymentType: payment.payment_type,
            transactionId: paymentIntentId,
            date: new Date().toLocaleDateString('en-NG')
          }
        });
      }

      res.json({
        message: 'Payment confirmed successfully',
        status: 'completed'
      });
    } else {
      // Update payment status to failed
      await pool.execute(
        'UPDATE payments SET status = ? WHERE id = ?',
        ['failed', paymentId]
      );

      res.status(400).json({
        message: 'Payment not completed',
        status: paymentIntent.status
      });
    }

  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({
      message: 'Failed to confirm payment',
      error: error.message
    });
  }
});

// Get payment history
router.get('/history', auth, async (req, res) => {
  try {
    const [payments] = await pool.execute(
      `SELECT 
        p.id, p.amount, p.payment_type, p.payment_method, 
        p.status, p.payment_date, p.transaction_reference,
        la.loan_type, la.amount_requested
      FROM payments p
      JOIN loan_applications la ON p.loan_application_id = la.id
      WHERE p.user_id = ?
      ORDER BY p.payment_date DESC`,
      [req.user.userId]
    );

    res.json({
      payments
    });

  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      message: 'Failed to get payment history',
      error: error.message
    });
  }
});

// Get payment details
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const [payments] = await pool.execute(
      `SELECT 
        p.*, la.loan_type, la.amount_requested
      FROM payments p
      JOIN loan_applications la ON p.loan_application_id = la.id
      WHERE p.id = ? AND p.user_id = ?`,
      [id, req.user.userId]
    );

    if (payments.length === 0) {
      return res.status(404).json({
        message: 'Payment not found'
      });
    }

    res.json({
      payment: payments[0]
    });

  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({
      message: 'Failed to get payment details',
      error: error.message
    });
  }
});

// Stripe webhook endpoint
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('PaymentIntent was successful!', paymentIntent.id);
      
      // Update payment status in database
      try {
        await pool.execute(
          'UPDATE payments SET status = ? WHERE stripe_payment_intent_id = ?',
          ['completed', paymentIntent.id]
        );

        // Get payment details for email notification
        const [payments] = await pool.execute(
          `SELECT p.*, u.email, u.first_name, u.last_name 
           FROM payments p 
           JOIN users u ON p.user_id = u.id 
           WHERE p.stripe_payment_intent_id = ?`,
          [paymentIntent.id]
        );

        if (payments.length > 0) {
          const payment = payments[0];
          await sendEmail({
            to: 'mubasharhanif24@gmail.com',
            subject: `New Payment Received - ₦${payment.amount}`,
            template: 'admin-payment-notification',
            data: {
              customerName: `${payment.first_name} ${payment.last_name}`,
              customerEmail: payment.email,
              amount: payment.amount,
              paymentType: payment.payment_type,
              transactionId: paymentIntent.id,
              date: new Date().toLocaleDateString('en-NG')
            }
          });
        }
      } catch (error) {
        console.error('Error updating payment status:', error);
      }
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log('PaymentIntent failed!', failedPayment.id);
      
      try {
        await pool.execute(
          'UPDATE payments SET status = ? WHERE stripe_payment_intent_id = ?',
          ['failed', failedPayment.id]
        );
      } catch (error) {
        console.error('Error updating failed payment status:', error);
      }
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

module.exports = router;

