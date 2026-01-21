const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');
const pool = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// Register new user
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').notEmpty().trim(),
  body('lastName').notEmpty().trim(),
  body('phone').isMobilePhone('any'),
  body('dateOfBirth').isISO8601().toDate()
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
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ? OR phone = ?',
      [email, phone]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        message: 'User with this email or phone number already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new user
    const [result] = await pool.execute(
      `INSERT INTO users (
        email, password, first_name, last_name, phone, date_of_birth,
        address, city, state, bvn, bank_account_number, bank_name, account_name,
        employment_status, monthly_income, employer_name, job_title, employment_duration
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        email, hashedPassword, firstName, lastName, phone, dateOfBirth,
        address, city, state, bvn, bankAccountNumber, bankName, accountName,
        employmentStatus, monthlyIncome, employerName, jobTitle, employmentDuration
      ]
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId: result.insertId, email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Get user data (excluding password)
    const [newUser] = await pool.execute(
      'SELECT id, email, first_name, last_name, phone, is_verified, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: newUser[0]
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      message: 'Registration failed',
      error: error.message
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

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Return user data (excluding password)
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      message: 'Login failed',
      error: error.message
    });
  }
});

// Get current user profile
router.get('/me', auth, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, email, first_name, last_name, phone, date_of_birth, address, city, state, bvn, bank_account_number, bank_name, account_name, employment_status, monthly_income, employer_name, job_title, employment_duration, is_verified, created_at FROM users WHERE id = ?',
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
  body('phone').optional().isMobilePhone('any'),
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

module.exports = router;



