const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  age: Number,
  phoneNumber: String,
  resetToken: String,
  tokenExpires: Date
});

module.exports = mongoose.model('User', userSchema);
