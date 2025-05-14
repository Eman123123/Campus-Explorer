const mongoose = require('mongoose');

const universitySchema = new mongoose.Schema({
  degree: String,
  departement: String,
  campuses: [String],
});

module.exports = mongoose.model('University', universitySchema) || mongoose.model('University', universitySchema);