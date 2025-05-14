require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const bcrypt = require("bcrypt");

// Initialize Express app
const app = express();

// User schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true },
  password: { type: String, required: true },
  age: { type: Number, required: true },
  phoneNumber: { type: String, required: true },
});

const User = mongoose.model('User', userSchema);
const University = require('./Model/uni');
// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Token store (still in-memory for simplicity)
const tokenStore = {};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
// Review Schema
const reviewSchema = new mongoose.Schema({
    university: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String, required: true },
    author: { type: String, required: true },
    date: { type: Date, default: Date.now }
});

// API endpoint to get all universities
app.get('/universities', async (req, res) => {
    try {
        const universities = await University.find();
        res.json(universities);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});
const Review = mongoose.model('Review', reviewSchema);

// Submit Review Endpoint
app.post('/submit-review', async (req, res) => {
    try {
        const { university, rating, review, author } = req.body;
        
        // Basic validation
        if (!university || !rating || !review || !author) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        if (rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }
        
        const newReview = new Review({
            university,
            rating: parseInt(rating),
            review,
            author
        });
        
        await newReview.save();
        
        res.status(201).json({ message: 'Review submitted successfully', review: newReview });
    } catch (error) {
        console.error('Error submitting review:', error);
        res.status(500).json({ error: 'Server error while submitting review' });
    }
});

// Get aggregated university ratings
app.get('/get-university-ratings', async (req, res) => {
    try {
        const ratings = await Review.aggregate([
            {
                $group: {
                    _id: "$university",
                    averageRating: { $avg: "$rating" },
                    reviewCount: { $sum: 1 }
                }
            },
            { $sort: { averageRating: -1 } }
        ]);
        
        res.json(ratings);
    } catch (error) {
        console.error('Error fetching university ratings:', error);
        res.status(500).json({ error: 'Server error while fetching ratings' });
    }
});
// Get individual reviews
app.get('/get-reviews', async (req, res) => {
    try {
        const { university } = req.query;
        let query = {};
        
        if (university) {
            query.university = university;
        }
        
        const reviews = await Review.find(query).sort({ date: -1 });
        res.json(reviews);
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ error: 'Server error while fetching reviews' });
    }
});
// Token generator
function generateResetToken() {
  return crypto.randomBytes(16).toString('hex');
}
// Signup route with duplicate email check
app.post('/signup', async (req, res) => {
  const { email, password, age, phoneNumber } = req.body;
  
  if (!email || !password || !age || !phoneNumber) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  try {
    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        message: 'Email already registered. Please use a different email or delete your existing account.'
      });
    }

    const user = new User({ email, password, age, phoneNumber });
    await user.save();
    res.json({ success: true, message: 'User signed up successfully!' });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, message: 'Signup failed.' });
  }
});

// Send reset email
app.post('/verify-email', async (req, res) => {
  const { email } = req.body;
  const resetToken = generateResetToken();
  tokenStore[email] = resetToken;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Password Reset Verification',
    html: `<p>Hello,</p><p>Click the link below to reset your password:</p><a href="http://localhost:3000/reset-password?token=${resetToken}">Reset Password</a>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Verification email sent.', token: resetToken });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send verification email.' });
  }
});

// Account deletion route
app.delete('/delete-account', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required for account deletion' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    await User.deleteOne({ email });

    if (tokenStore[email]) {
      delete tokenStore[email];
    }

    res.status(200).json({ success: true, message: 'Account permanently deleted' });
  } catch (err) {
    console.error('Account deletion error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete account' });
  }
});

// Reset password page
app.get('/reset-password', (req, res) => {
  const { token } = req.query;
  const email = Object.keys(tokenStore).find((email) => tokenStore[email] === token);

  if (!token || !email) {
    return res.status(400).send('Token missing, invalid, or expired.');
  }

  res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

// Handle reset password
app.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  const email = Object.keys(tokenStore).find((email) => tokenStore[email] === token);

  if (!email) {
    return res.status(400).json({ error: 'Invalid or expired token.' });
  }

  try {
    await User.updateOne({ email }, { $set: { password: newPassword } });
    delete tokenStore[email];
    res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// Login route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    res.json({ success: true, message: 'Login successful!', email: user.email });
  } catch (err) {
    res.status(500).json({ error: 'Failed to login.' });
  }
});

// Contact form
app.post('/contact', (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  const mailOptions = {
    from: email,
    to: process.env.EMAIL_USER,
    subject: `Contact Form Submission: ${subject}`,
    text: `You received a message from ${name} <${email}>:\n\n${message}`,
  };

  transporter.sendMail(mailOptions, (error) => {
    if (error) {
      console.error('Error sending contact form email:', error);
      return res.status(500).json({ success: false, message: 'Failed to send message.' });
    }
    res.json({ success: true, message: 'Form submitted successfully!' });
  });
});

const universityRoutes = require('./controllers/scraper');
app.use("/", universityRoutes);
// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
