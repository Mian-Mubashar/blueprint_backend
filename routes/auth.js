const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');
const pool = require('../config/database');
const auth = require('../middleware/auth');
const sendEmail = require('../utils/email');

const router = express.Router();

// Register new user
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').notEmpty().trim(),
  body('lastName').notEmpty().trim(),
  body('phone').notEmpty().trim(),
  body('dateOfBirth').notEmpty()
], async (req, res) => {
  try {
    console.log('Registration attempt:', {
      email: req.body.email,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phone: req.body.phone
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorDetails = errors.array().map(e => `${e.path || e.param}: ${e.msg}`).join(', ');
      console.error('Validation errors:', errors.array());
      return res.status(400).json({
        message: `Validation failed: ${errorDetails}`,
        errors: errors.array()
      });
    }

    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      dateOfBirth,
      address,
      city,
      state,
      bvn,
      bankAccountNumber,
      bankName,
      accountName,
      employmentStatus,
      monthlyIncome,
      employerName,
      jobTitle,
      employmentDuration
    } = req.body;

    // Check if user already exists
    console.log('Checking for existing user...');
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ? OR phone = ?',
      [email, phone]
    );

    if (existingUsers.length > 0) {
      console.error('User already exists:', { email, phone });
      return res.status(400).json({
        message: 'User with this email or phone number already exists'
      });
    }

    // Hash password
    console.log('Hashing password...');
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new user (default role = user)
    console.log('Inserting user into database...');
    const [result] = await pool.execute(
      `INSERT INTO users (
        email, password, first_name, last_name, phone, date_of_birth,
        address, city, state, bvn, bank_account_number, bank_name, account_name,
        employment_status, monthly_income, employer_name, job_title, employment_duration, role
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        email, hashedPassword, firstName, lastName, phone, dateOfBirth,
        address || null, city || null, state || null,
        bvn || null,
        bankAccountNumber || null,
        bankName || null,
        accountName || null,
        employmentStatus || null,
        monthlyIncome ? parseFloat(monthlyIncome) : null,
        employerName || null,
        jobTitle || null,
        employmentDuration ? parseInt(employmentDuration) : null,
        'user'
      ]
    );

    console.log('User inserted successfully, ID:', result.insertId);

    // Generate JWT token
    const token = jwt.sign(
      { userId: result.insertId, email, role: 'user' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Get user data (excluding password)
    const [newUser] = await pool.execute(
      'SELECT id, email, first_name, last_name, phone, role, is_verified, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    console.log('Registration successful for:', email);
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: newUser[0]
    });

  } catch (error) {
    console.error('Registration error:', {
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage,
      sqlState: error.sqlState,
      stack: error.stack
    });

    // More specific error messages
    let errorMessage = 'Registration failed';
    if (error.code === 'ER_DUP_ENTRY') {
      errorMessage = 'Email or phone number already exists';
    } else if (error.code === 'ER_NO_SUCH_TABLE') {
      errorMessage = 'Database table not found. Please run migrations first.';
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Database connection failed. Please check your database settings.';
    } else if (error.sqlMessage) {
      errorMessage = `Database error: ${error.sqlMessage}`;
    } else {
      errorMessage = error.message || 'Registration failed';
    }

    const fs = require('fs');
    try {
      fs.writeFileSync('debug_error.log', JSON.stringify({
        message: error.message,
        code: error.code,
        sqlMessage: error.sqlMessage,
        sqlState: error.sqlState,
        stack: error.stack
      }, null, 2));
    } catch (e) { }

    res.status(500).json({
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Login user
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user by email
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        message: 'Invalid email or password'
      });
    }

    const user = users[0];

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'Invalid email or password'
      });
    }

    // Ensure role exists (default to 'user' if not set)
    const userRole = user.role || 'user';

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: userRole },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Return user data (excluding password)
    const { password: _, ...userWithoutPassword } = user;
    
    // Ensure role is set in response
    if (!userWithoutPassword.role) {
      userWithoutPassword.role = 'user';
    }

    res.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Login error:', {
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage,
      stack: error.stack
    });
    res.status(500).json({
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get current user profile
router.get('/me', auth, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, email, first_name, last_name, phone, date_of_birth, address, city, state, bvn, bank_account_number, bank_name, account_name, employment_status, monthly_income, employer_name, job_title, employment_duration, is_verified, role, created_at FROM users WHERE id = ?',
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

// Update user profile
router.put('/profile', auth, [
  body('firstName').optional().notEmpty().trim(),
  body('lastName').optional().notEmpty().trim(),
  body('phone').optional().notEmpty().trim(),
  body('email').optional().isEmail().normalizeEmail()
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
      firstName,
      lastName,
      phone,
      email,
      address,
      city,
      state,
      bvn,
      bankAccountNumber,
      bankName,
      accountName,
      employmentStatus,
      monthlyIncome,
      employerName,
      jobTitle,
      employmentDuration
    } = req.body;

    // Check if email is already taken by another user
    if (email) {
      const [existingUsers] = await pool.execute(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, req.user.userId]
      );

      if (existingUsers.length > 0) {
        return res.status(400).json({
          message: 'Email is already taken by another user'
        });
      }
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];

    if (firstName) { updateFields.push('first_name = ?'); updateValues.push(firstName); }
    if (lastName) { updateFields.push('last_name = ?'); updateValues.push(lastName); }
    if (phone) { updateFields.push('phone = ?'); updateValues.push(phone); }
    if (email) { updateFields.push('email = ?'); updateValues.push(email); }
    if (address) { updateFields.push('address = ?'); updateValues.push(address); }
    if (city) { updateFields.push('city = ?'); updateValues.push(city); }
    if (state) { updateFields.push('state = ?'); updateValues.push(state); }
    if (bvn) { updateFields.push('bvn = ?'); updateValues.push(bvn); }
    if (bankAccountNumber) { updateFields.push('bank_account_number = ?'); updateValues.push(bankAccountNumber); }
    if (bankName) { updateFields.push('bank_name = ?'); updateValues.push(bankName); }
    if (accountName) { updateFields.push('account_name = ?'); updateValues.push(accountName); }
    if (employmentStatus) { updateFields.push('employment_status = ?'); updateValues.push(employmentStatus); }
    if (monthlyIncome) { updateFields.push('monthly_income = ?'); updateValues.push(monthlyIncome); }
    if (employerName) { updateFields.push('employer_name = ?'); updateValues.push(employerName); }
    if (jobTitle) { updateFields.push('job_title = ?'); updateValues.push(jobTitle); }
    if (employmentDuration) { updateFields.push('employment_duration = ?'); updateValues.push(employmentDuration); }

    if (updateFields.length === 0) {
      return res.status(400).json({
        message: 'No fields to update'
      });
    }

    updateValues.push(req.user.userId);

    const [result] = await pool.execute(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    // Get updated user data
    const [updatedUsers] = await pool.execute(
      'SELECT id, email, first_name, last_name, phone, date_of_birth, address, city, state, bvn, bank_account_number, bank_name, account_name, employment_status, monthly_income, employer_name, job_title, employment_duration, is_verified, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );

    res.json({
      message: 'Profile updated successfully',
      user: updatedUsers[0]
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      message: 'Failed to update profile',
      error: error.message
    });
  }
});

// Change password
router.put('/change-password', auth, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Get current user password
    const [users] = await pool.execute(
      'SELECT password FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, users[0].password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await pool.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedNewPassword, req.user.userId]
    );

    res.json({
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      message: 'Failed to change password',
      error: error.message
    });
  }
});

// Google OAuth login
router.post('/google-login', [
  body('credential').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { credential } = req.body;

    // Verify Google token
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID
      });

      const payload = ticket.getPayload();
      const { email, given_name, family_name, picture, sub: googleId } = payload;

      // Check if user already exists
      const [existingUsers] = await pool.execute(
        'SELECT id, email, first_name, last_name FROM users WHERE email = ? OR google_id = ?',
        [email, googleId]
      );

      let user;

      if (existingUsers.length > 0) {
        // Update existing user with Google ID if not set
        user = existingUsers[0];
        if (!user.google_id) {
          await pool.execute(
            'UPDATE users SET google_id = ?, profile_picture = ? WHERE id = ?',
            [googleId, picture, user.id]
          );
        }
      } else {
        // Create new user
        const [result] = await pool.execute(
          `INSERT INTO users (
            email, first_name, last_name, google_id, profile_picture, is_verified
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [email, given_name, family_name, googleId, picture, true]
        );

        user = {
          id: result.insertId,
          email,
          first_name: given_name,
          last_name: family_name,
          google_id: googleId,
          profile_picture: picture
        };
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      res.json({
        message: 'Google login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          profile_picture: user.profile_picture || picture,
          is_verified: true
        }
      });

    } catch (googleError) {
      console.error('Google token verification failed:', googleError);
      return res.status(401).json({
        message: 'Invalid Google token'
      });
    }

  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({
      message: 'Google login failed',
      error: error.message
    });
  }
});

// Forgot password - send reset link
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Please provide a valid email address')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Get email from request body and trim it (don't normalize to preserve user's exact email)
    const email = req.body.email ? req.body.email.trim().toLowerCase() : '';
    
    console.log('=== FORGOT PASSWORD REQUEST ===');
    console.log('Email from request body (original):', req.body.email);
    console.log('Email after trim/lowercase:', email);

    // Try multiple query approaches to find user
    let users = [];
    
    // First try: Case-insensitive search with LOWER()
    try {
      [users] = await pool.execute(
        'SELECT id, email, first_name, last_name FROM users WHERE LOWER(email) = ?',
        [email]
      );
      console.log('Query 1 (LOWER): Found', users.length, 'users');
    } catch (err) {
      console.error('Query 1 error:', err.message);
    }
    
    // Second try: Direct email match (in case LOWER() doesn't work)
    if (users.length === 0) {
      try {
        [users] = await pool.execute(
          'SELECT id, email, first_name, last_name FROM users WHERE email = ?',
          [email]
        );
        console.log('Query 2 (direct): Found', users.length, 'users');
      } catch (err) {
        console.error('Query 2 error:', err.message);
      }
    }
    
    // Third try: Case-insensitive with LIKE (for partial matches)
    if (users.length === 0) {
      try {
        [users] = await pool.execute(
          'SELECT id, email, first_name, last_name FROM users WHERE email LIKE ?',
          [`%${email.split('@')[0]}%@%`]
        );
        console.log('Query 3 (LIKE): Found', users.length, 'users');
        if (users.length > 0) {
          console.log('Found similar emails:', users.map(u => u.email));
          // Filter to exact match (case-insensitive)
          users = users.filter(u => u.email.toLowerCase() === email);
          console.log('After filtering:', users.length, 'exact matches');
        }
      } catch (err) {
        console.error('Query 3 error:', err.message);
      }
    }
    
    // Debug: Show all emails in database (for debugging only)
    if (users.length === 0 && process.env.NODE_ENV === 'development') {
      try {
        const [allUsers] = await pool.execute(
          'SELECT email FROM users LIMIT 10'
        );
        console.log('Sample emails in database:', allUsers.map(u => u.email));
      } catch (err) {
        console.error('Debug query error:', err.message);
      }
    }
    
    console.log('User found:', users.length > 0 ? 'Yes' : 'No');
    if (users.length > 0) {
      console.log('User email in database:', users[0].email);
      console.log('User ID:', users[0].id);
    } else {
      console.log('No user found with email:', email);
    }

    // Always return success to prevent email enumeration
    if (users.length === 0) {
      return res.json({
        message: 'If an account with that email exists, we have sent a password reset link.'
      });
    }

    const user = users[0];

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

    try {
      // Check if table exists, if not create it
      try {
        await pool.execute('SELECT 1 FROM password_reset_tokens LIMIT 1');
      } catch (tableError) {
        if (tableError.code === 'ER_NO_SUCH_TABLE') {
          console.log('Creating password_reset_tokens table...');
          await pool.execute(`
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
              id INT PRIMARY KEY AUTO_INCREMENT,
              user_id INT NOT NULL,
              token VARCHAR(255) NOT NULL UNIQUE,
              expires_at TIMESTAMP NOT NULL,
              used BOOLEAN DEFAULT FALSE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
              INDEX idx_token (token),
              INDEX idx_user_id (user_id),
              INDEX idx_expires_at (expires_at)
            )
          `);
          console.log('password_reset_tokens table created successfully');
        } else {
          throw tableError;
        }
      }

      // Delete any existing reset tokens for this user
      await pool.execute(
        'DELETE FROM password_reset_tokens WHERE user_id = ?',
        [user.id]
      );

      // Save reset token to database
      await pool.execute(
        `INSERT INTO password_reset_tokens (user_id, token, expires_at) 
         VALUES (?, ?, ?)`,
        [user.id, hashedToken, expiresAt]
      );

      // Create reset URL
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

      // Send email
      try {
        console.log('=== SENDING PASSWORD RESET EMAIL ===');
        console.log('User email from request (normalized):', email);
        console.log('User email from database:', user.email);
        console.log('User ID:', user.id);
        console.log('User name:', user.first_name);
        
        // Use the email from database (user's actual registered email) to send reset link
        // This ensures we send to the exact email they registered with
        let emailToSend = user.email ? user.email.trim() : '';
        
        // CRITICAL: Validate email before sending
        if (!emailToSend) {
          throw new Error('User email is empty in database');
        }
        
        if (!emailToSend.includes('@')) {
          throw new Error(`Invalid user email format in database: ${emailToSend}`);
        }
        
        // CRITICAL: Ensure we're NOT sending to admin email
        if (emailToSend.toLowerCase() === 'mubasharhanif24@gmail.com') {
          console.error('ERROR: User email matches admin email! This should not happen.');
          console.error('   User ID:', user.id);
          console.error('   User email in DB:', user.email);
          throw new Error('Cannot send password reset to admin email. User must have their own email.');
        }
        
        // Send email with explicit email address - NO HARDCODED VALUES
        const emailResult = await sendEmail({
          to: emailToSend, // CRITICAL: Use user's registered email from database - NO HARDCODED EMAIL
          subject: 'Reset Your Password - Blue Print Financial',
          template: 'password-reset',
          data: {
            name: user.first_name,
            resetUrl,
            expiresIn: '1 hour'
          }
        });
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError);
        console.error('Email error details:', {
          message: emailError.message,
          stack: emailError.stack,
          to: email
        });
        // Still return success to prevent email enumeration
        // In development, log the reset URL
        if (process.env.NODE_ENV === 'development') {
          console.log('🔗 Password Reset URL (dev only):', resetUrl);
        }
      }

      res.json({
        message: 'If an account with that email exists, we have sent a password reset link.'
      });

    } catch (dbError) {
      console.error('Database error in forgot password:', dbError);
      // If it's a table error, provide helpful message
      if (dbError.code === 'ER_NO_SUCH_TABLE') {
        return res.status(500).json({
          message: 'Database table not found. Please run migrations: npm run migrate'
        });
      }
      throw dbError;
    }

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      message: 'Failed to process password reset request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Reset password with token
router.post('/reset-password', [
  body('token').notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { token, email, password } = req.body;

    // Hash the token to compare with database
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user and valid token
    const [tokens] = await pool.execute(
      `SELECT prt.*, u.id as user_id, u.email 
       FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE prt.token = ? AND u.email = ? AND prt.used = FALSE AND prt.expires_at > NOW()`,
      [hashedToken, email]
    );

    if (tokens.length === 0) {
      return res.status(400).json({
        message: 'Invalid or expired reset token'
      });
    }

    const resetToken = tokens[0];

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Update user password
    await pool.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, resetToken.user_id]
    );

    // Mark token as used
    await pool.execute(
      'UPDATE password_reset_tokens SET used = TRUE WHERE id = ?',
      [resetToken.id]
    );

    res.json({
      message: 'Password reset successfully. You can now login with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      message: 'Failed to reset password',
      error: error.message
    });
  }
});

module.exports = router;



