const User = require('../models/User');
const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

exports.signup = async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user
    const user = new User({ name, email, password });
    await user.save();

    // Return response (without password)
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: userResponse
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

exports.login = async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password } = req.body;

    // 1. Check if user exists and select password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        errors: [{ msg: 'Invalid credentials', path: 'email' }]
      });
    }

    // 2. Check if password matches
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        errors: [{ msg: 'Invalid credentials', path: 'password' }]
      });
    }

    // 3. Generate JWT token
    const token = user.generateAuthToken();

    // 4. Return response without password
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      success: true,
      token,
      user: userResponse
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};


// Generate OTP
const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit OTP
};

// Forgot Password - Send OTP
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // 1. Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user found with this email address'
      });
    }

    // 2. Generate OTP and set expiration (10 minutes from now)
    const otp = generateOTP();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // 3. Save OTP to user document
    user.resetPasswordOtp = otp;
    user.resetPasswordOtpExpires = otpExpires;
    await user.save();

    // In a real app, you would send the OTP via email here
    // For your requirement, we're just storing it in MongoDB

    res.status(200).json({
      success: true,
      message: 'OTP sent to email (stored in DB)',
      data: {
        otp, // Only for development - remove in production
        email
      }
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Verify OTP
exports.verifyOtp = async (req, res) => {
  try {
    // 1. Extract email and OTP from request body
    const { email, otp } = req.body;

    // 2. Verify OTP against database record
    const user = await User.findOne({
      email,                      // Match user by email
      resetPasswordOtp: otp,       // Match the exact OTP
      resetPasswordOtpExpires: {   // Check OTP hasn't expired
        $gt: Date.now()            // Expiry time > current time
      }
    });

    // 3. Handle invalid/expired OTP
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP or OTP has expired',
        errorType: 'OTP_VALIDATION_FAILED'
      });
    }

    // 4. Generate password reset token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // 5. Update user document
    user.resetPasswordToken = resetToken;       // Store new token
    user.resetPasswordExpire = Date.now() +     // Set 30min expiry
      30 * 60 * 1000;                          // (in milliseconds)
    user.resetPasswordOtp = undefined;          // Clear used OTP
    user.resetPasswordOtpExpires = undefined;   // Clear OTP expiry
    await user.save({ validateBeforeSave: false }); // Skip validation

    // 6. Return success response
    res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      data: {
        resetToken,
        expiresIn: '30 minutes'  // Client-facing expiry info
      }
    });

  } catch (err) {
    // 7. Handle unexpected errors
    console.error('OTP Verification Error:', err);

    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP',
      errorDetails: process.env.NODE_ENV === 'development'
        ? err.message
        : undefined
    });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { token, email, password, confirmPassword } = req.body;

    // 1. Validate passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    // 2. Find user by token and check expiration
    const user = await User.findOne({
      email,
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token or token has expired'
      });
    }

    // 3. Update password and clear reset fields
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};
