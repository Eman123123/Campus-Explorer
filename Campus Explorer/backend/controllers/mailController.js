require('dotenv').config();
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const User = require('../models/User'); // Assuming you have User model defined

// Generate secure token
function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

exports.sendResetLink = async (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found with this email' });
    }

    const resetToken = generateResetToken();
    user.resetToken = resetToken;
    user.tokenExpires = Date.now() + 3600000; // 1 hour expiry
    await user.save();

    const resetLink = `http://localhost:3000/reset-password?token=${resetToken}`;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: `"Your App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Request',
      html: `<p>You requested a password reset. Click <a href="${resetLink}">here</a> to reset your password.</p>`
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'Reset link sent to your email!' });
  } catch (err) {
    console.error('Email send error:', err);
    res.status(500).json({ error: 'Failed to send reset link' });
  }
};
