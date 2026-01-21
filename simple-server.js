const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Mock API routes for frontend testing
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Blue Print Financial API is running' });
});

// Mock auth routes
app.post('/api/auth/register', (req, res) => {
  res.json({
    message: 'User registered successfully',
    token: 'mock-token-123',
    user: {
      id: 1,
      email: req.body.email,
      first_name: req.body.firstName,
      last_name: req.body.lastName
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  res.json({
    message: 'Login successful',
    token: 'mock-token-123',
    user: {
      id: 1,
      email: req.body.email,
      first_name: 'John',
      last_name: 'Doe'
    }
  });
});

app.get('/api/auth/me', (req, res) => {
  res.json({
    user: {
      id: 1,
      email: 'user@example.com',
      first_name: 'John',
      last_name: 'Doe'
    }
  });
});

// Mock Google OAuth login
app.post('/api/auth/google-login', (req, res) => {
  const { credential } = req.body;
  
  // Mock Google user data
  const mockUser = {
    id: 2,
    email: 'google.user@gmail.com',
    first_name: 'Google',
    last_name: 'User',
    profile_picture: 'https://lh3.googleusercontent.com/a/default-user',
    is_verified: true
  };
  
  res.json({
    message: 'Google login successful',
    token: 'mock-google-token-123',
    user: mockUser
  });
});

// Mock loan routes
app.get('/api/loans/calculator/rates', (req, res) => {
  res.json({
    interestRates: {
      small_business: 15.5,
      payday: 25.0,
      collateral: 12.0
    },
    maxAmounts: {
      small_business: 5000000,
      payday: 500000,
      collateral: 50000000
    }
  });
});

app.post('/api/loans/calculator/calculate', (req, res) => {
  const { amount, duration, loanType } = req.body;
  const interestRate = loanType === 'small_business' ? 15.5 : 
                      loanType === 'payday' ? 25.0 : 12.0;
  
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
});

app.post('/api/loans/apply', (req, res) => {
  res.json({
    message: 'Loan application submitted successfully',
    application: {
      id: Math.floor(Math.random() * 1000),
      loan_type: req.body.loanType,
      amount_requested: req.body.amountRequested,
      loan_duration: req.body.loanDuration,
      status: 'pending',
      created_at: new Date().toISOString()
    }
  });
});

// Mock payment routes
app.post('/api/payments/create-payment-intent', (req, res) => {
  res.json({
    clientSecret: 'mock-client-secret',
    paymentId: Math.floor(Math.random() * 1000)
  });
});

app.post('/api/payments/confirm-payment', (req, res) => {
  res.json({
    message: 'Payment confirmed successfully',
    status: 'completed'
  });
});

// Mock contact route
app.post('/api/contact/submit', (req, res) => {
  res.json({
    message: 'Contact form submitted successfully. We will get back to you soon!'
  });
});

// Mock dashboard route
app.get('/api/users/dashboard', (req, res) => {
  res.json({
    user: {
      first_name: 'John',
      last_name: 'Doe',
      email: 'user@example.com',
      is_verified: true
    },
    applications: {
      total_applications: 2,
      pending_count: 1,
      approved_count: 1,
      disbursed_count: 0,
      completed_count: 0,
      rejected_count: 0,
      total_amount_requested: 1500000
    },
    recentApplications: [
      {
        id: 1,
        loan_type: 'small_business',
        amount_requested: 1000000,
        status: 'approved',
        created_at: new Date().toISOString()
      }
    ],
    payments: {
      total_payments: 1,
      completed_payments: 1,
      pending_payments: 0,
      total_paid: 50000
    },
    recentPayments: [
      {
        id: 1,
        amount: 50000,
        payment_type: 'loan_repayment',
        status: 'completed',
        payment_date: new Date().toISOString(),
        loan_type: 'small_business'
      }
    ]
  });
});

// Serve static files from React build
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Blue Print Financial server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🎨 Frontend will be available at http://localhost:3000`);
});


