const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const auth = require('../middleware/auth');
const sendEmail = require('../utils/email');

const router = express.Router();

// Public quick payment intent (no auth, no DB record)
router.post('/public/create-payment-intent', [
  body('amount').isFloat({ min: 100, max: 10000000 }).withMessage('Amount must be between ₦100 and ₦10,000,000')
], async (req, res) => {
  try {
    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_your_stripe_secret_key') {
      console.error('Stripe secret key not configured');
      return res.status(500).json({
        message: 'Payment system not configured. Please contact support.',
        error: 'Stripe key missing'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation errors:', errors.array());
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { amount } = req.body;
    const numericAmount = parseFloat(amount);

    if (isNaN(numericAmount) || numericAmount < 100 || numericAmount > 10000000) {
      return res.status(400).json({
        message: 'Invalid amount. Amount must be between ₦100 and ₦10,000,000',
        error: 'Amount validation failed'
      });
    }

    console.log('Creating payment intent for amount:', numericAmount);

    // Create payment intent with NGN currency
    // Note: If Stripe account doesn't support NGN, you may need to use USD or enable NGN in Stripe dashboard
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(numericAmount * 100), // Convert to kobo (smallest NGN unit)
        currency: 'ngn',
        metadata: {
          source: 'public_payment',
          amount: numericAmount.toString()
        },
        description: `Public payment of ₦${numericAmount.toLocaleString()}`
      });
    } catch (stripeError) {
      // If NGN is not supported, try with USD (for testing)
      if (stripeError.code === 'currency_not_supported' || stripeError.message?.includes('currency')) {
        console.warn('NGN not supported, trying USD for testing');
        paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(numericAmount * 100), // For USD, this is cents
          currency: 'usd',
          metadata: {
            source: 'public_payment',
            amount: numericAmount.toString(),
            original_currency: 'NGN'
          },
          description: `Public payment of ₦${numericAmount.toLocaleString()}`
        });
      } else {
        throw stripeError;
      }
    }

    console.log('Payment intent created:', paymentIntent.id);

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Public create payment intent error:', error);
    console.error('Error details:', {
      message: error.message,
      type: error.type,
      code: error.code,
      statusCode: error.statusCode
    });
    
    // Provide more specific error messages
    let errorMessage = 'Failed to create payment intent';
    if (error.type === 'StripeInvalidRequestError') {
      errorMessage = 'Invalid payment request. Please check your amount and try again.';
    } else if (error.type === 'StripeAPIError') {
      errorMessage = 'Payment service temporarily unavailable. Please try again later.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.status(500).json({
      message: errorMessage,
      error: error.message || 'Unknown error'
    });
  }
});

// Create payment intent - only for loan repayment (no application fees)
router.post('/create-payment-intent', auth, async (req, res) => {
  try {
    console.log('=== PAYMENT INTENT REQUEST ===');
    console.log('Request body:', req.body);
    console.log('User ID:', req.user?.userId);
    
    const { loanApplicationId, amount, paymentType } = req.body;
    
    // Manual validation with detailed logging
    if (!loanApplicationId) {
      console.error('Missing loanApplicationId');
      return res.status(400).json({
        message: 'Loan ID is required',
        error: 'loanApplicationId missing'
      });
    }
    
    if (!amount) {
      console.error('Missing amount');
      return res.status(400).json({
        message: 'Amount is required',
        error: 'amount missing'
      });
    }
    
    if (paymentType !== 'loan_repayment') {
      console.error('Invalid paymentType:', paymentType);
      return res.status(400).json({
        message: 'Payment type must be loan_repayment',
        error: 'Invalid payment type'
      });
    }
    
    // Validate and parse loanApplicationId
    const parsedLoanId = parseInt(loanApplicationId);
    console.log('Parsed Loan ID:', parsedLoanId, 'Original:', loanApplicationId);
    if (isNaN(parsedLoanId) || parsedLoanId <= 0) {
      console.error('Invalid loan ID:', loanApplicationId);
      return res.status(400).json({
        message: 'Invalid loan ID',
        error: 'Loan ID must be a valid number'
      });
    }
    
    // Validate and parse amount
    const numericAmount = parseFloat(amount);
    console.log('Parsed Amount:', numericAmount, 'Original:', amount);
    if (isNaN(numericAmount) || numericAmount < 10 || numericAmount > 10000000) {
      console.error('Invalid amount:', amount, 'Parsed:', numericAmount);
      return res.status(400).json({
        message: `Invalid amount. Amount must be between ₦10 and ₦10,000,000. Received: ${amount}`,
        error: 'Amount validation failed'
      });
    }
    
    console.log('Creating payment intent:', {
      loanApplicationId: parsedLoanId,
      amount: numericAmount,
      paymentType,
      userId: req.user.userId
    });

    // Verify loan application exists and belongs to user
    const [applications] = await pool.execute(
      'SELECT id, user_id, amount_requested FROM loan_applications WHERE id = ? AND user_id = ?',
      [parsedLoanId, req.user.userId]
    );

    if (applications.length === 0) {
      console.error('Loan application not found:', parsedLoanId, 'for user:', req.user.userId);
      return res.status(404).json({
        message: 'Loan application not found'
      });
    }

    console.log('Loan application found:', applications[0]);

    // Check if Stripe is configured
    console.log('Checking Stripe configuration...');
    console.log('STRIPE_SECRET_KEY exists:', !!process.env.STRIPE_SECRET_KEY);
    console.log('STRIPE_SECRET_KEY value:', process.env.STRIPE_SECRET_KEY ? 
      process.env.STRIPE_SECRET_KEY.substring(0, 10) + '...' : 'NOT SET');
    
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_your_stripe_secret_key') {
      console.error('Stripe secret key not configured');
      return res.status(500).json({
        message: 'Payment system not configured. Please contact support.',
        error: 'Stripe key missing',
        details: 'Please configure STRIPE_SECRET_KEY in .env file'
      });
    }

    // Create payment intent with Stripe
    let paymentIntent;
    let finalCurrency = 'ngn';
    let finalAmount;
    
    // NGN to USD conversion rate (approximate, can be updated)
    const NGN_TO_USD_RATE = 1400; // 1 USD = 1400 NGN (approximate)
    const MINIMUM_USD_AMOUNT = 0.50; // Stripe minimum is 50 cents
    const MINIMUM_NGN_AMOUNT = Math.ceil(MINIMUM_USD_AMOUNT * NGN_TO_USD_RATE); // ~₦700
    
    // Pre-check: If amount is too small for USD conversion, use USD directly
    const amountInUSD = numericAmount / NGN_TO_USD_RATE;
    const useUSDDirectly = amountInUSD < MINIMUM_USD_AMOUNT;
    
    console.log('Payment amount check:', {
      ngnAmount: numericAmount,
      usdAmount: amountInUSD,
      minimumUSD: MINIMUM_USD_AMOUNT,
      minimumNGN: MINIMUM_NGN_AMOUNT,
      useUSDDirectly: useUSDDirectly
    });
    
    // If amount is too small, return error (don't round up - user wants exact amount)
    if (useUSDDirectly) {
      console.error('Amount too small for card processing:', {
        ngnAmount: numericAmount,
        usdAmount: amountInUSD,
        minimumNGN: MINIMUM_NGN_AMOUNT
      });
      return res.status(400).json({
        message: `Payment amount is too small for card processing. Minimum payment is ₦${MINIMUM_NGN_AMOUNT.toLocaleString()}. Your amount: ₦${numericAmount.toLocaleString()}`,
        error: 'Amount below minimum',
        minimumAmount: MINIMUM_NGN_AMOUNT,
        yourAmount: numericAmount,
        suggestion: `Please pay at least ₦${MINIMUM_NGN_AMOUNT.toLocaleString()} or contact support for alternative payment methods`
      });
    } else {
      // Try NGN first (for larger amounts)
      const amountInKobo = Math.round(numericAmount * 100); // Convert to kobo (smallest NGN unit)
      
      console.log('Stripe payment intent params (NGN):', {
        amount: amountInKobo,
        currency: 'ngn',
        amountValue: numericAmount
      });
      
      try {
        paymentIntent = await stripe.paymentIntents.create({
          amount: amountInKobo, // Convert to kobo (smallest NGN unit)
          currency: 'ngn',
          metadata: {
            userId: req.user.userId.toString(),
            loanApplicationId: parsedLoanId.toString(),
            paymentType: paymentType
          },
          description: `Payment for ${paymentType} - Loan Application #${parsedLoanId}`
        });
        console.log('Payment intent created successfully with NGN:', paymentIntent.id);
        finalAmount = amountInKobo;
      } catch (stripeError) {
        console.error('Stripe NGN error:', {
          code: stripeError.code,
          type: stripeError.type,
          message: stripeError.message
        });
        
        // If NGN is not supported, convert to USD
        if (stripeError.code === 'currency_not_supported' || 
            stripeError.message?.includes('currency') ||
            stripeError.code === 'parameter_invalid_empty' ||
            stripeError.message?.includes('Amount must convert')) {
          console.warn('NGN not supported or amount too small, converting to USD');
          
          // Convert NGN to USD
          const amountInUSD = numericAmount / NGN_TO_USD_RATE;
          const amountInCents = Math.round(amountInUSD * 100);
          const minimumNGN = Math.ceil(MINIMUM_USD_AMOUNT * NGN_TO_USD_RATE);
          
          console.log('USD conversion:', {
            ngnAmount: numericAmount,
            usdAmount: amountInUSD,
            cents: amountInCents,
            minimumRequired: MINIMUM_USD_AMOUNT,
            minimumNGN: minimumNGN
          });
          
          // Check if amount meets Stripe minimum (50 cents)
          if (amountInUSD < MINIMUM_USD_AMOUNT) {
            console.error('Amount too small for USD conversion:', {
              ngnAmount: numericAmount,
              usdAmount: amountInUSD,
              minimumNGN: minimumNGN
            });
            return res.status(400).json({
              message: `Payment amount is too small for card processing. Minimum payment is ₦${minimumNGN.toLocaleString()}. Your amount: ₦${numericAmount.toLocaleString()}`,
              error: 'Amount below minimum',
              minimumAmount: minimumNGN,
              yourAmount: numericAmount,
              suggestion: `Please pay at least ₦${minimumNGN.toLocaleString()} or use bank transfer for smaller amounts`
            });
          }
          
          try {
            paymentIntent = await stripe.paymentIntents.create({
              amount: amountInCents, // For USD, this is cents
              currency: 'usd',
              metadata: {
                userId: req.user.userId.toString(),
                loanApplicationId: parsedLoanId.toString(),
                paymentType: paymentType,
                original_currency: 'NGN',
                original_amount: numericAmount.toString(),
                conversion_rate: NGN_TO_USD_RATE.toString()
              },
              description: `Payment for ${paymentType} - Loan Application #${parsedLoanId} (₦${numericAmount.toLocaleString()})`
            });
            console.log('Payment intent created with USD:', paymentIntent.id);
            finalCurrency = 'usd';
            finalAmount = amountInCents;
          } catch (usdError) {
            console.error('USD payment intent also failed:', usdError);
            return res.status(500).json({
              message: `Payment failed: ${usdError.message || 'Unable to process payment'}`,
              error: usdError.message || 'Stripe error',
              details: 'Please try again or contact support'
            });
          }
        } else {
          // Other Stripe errors
          throw stripeError;
        }
      }
    }

    // Store payment record
    const [result] = await pool.execute(
      `INSERT INTO payments (
        loan_application_id, user_id, amount, payment_type, 
        payment_method, stripe_payment_intent_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        parsedLoanId,
        req.user.userId,
        numericAmount,
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
    console.error('=== PAYMENT INTENT ERROR ===');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      type: error.type,
      code: error.code,
      statusCode: error.statusCode,
      name: error.name
    });
    
    // Provide more specific error messages
    let errorMessage = 'Failed to create payment intent';
    let statusCode = 500;
    
    if (error.type === 'StripeInvalidRequestError') {
      errorMessage = `Invalid payment request: ${error.message || 'Please check your amount and try again.'}`;
      statusCode = 400;
    } else if (error.type === 'StripeAPIError') {
      errorMessage = 'Payment service temporarily unavailable. Please try again later.';
      statusCode = 503;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    console.error('Sending error response:', { message: errorMessage, statusCode });
    
    res.status(statusCode).json({
      message: errorMessage,
      error: error.message || 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
          // Send admin notification (use ADMIN_EMAIL from env or fallback)
          const adminEmail = process.env.ADMIN_EMAIL || 'mubasharhanif24@gmail.com';
          await sendEmail({
            to: adminEmail,
            subject: `New Payment Received - ₦${payment.amount}`,
            template: 'admin-payment-notification',
            data: {
              customerName: `${payment.first_name} ${payment.last_name}`,
              customerEmail: payment.email,
              amount: payment.amount,
              paymentType: payment.payment_type,
              transactionId: paymentIntent.id,
              date: new Date().toLocaleDateString('en-NG')
            },
            isAdminEmail: true // Flag to allow admin emails
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

