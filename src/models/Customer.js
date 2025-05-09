// Customer.js
const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({ _id: String, name: String, email: String }, { strict: false });

module.exports = mongoose.model('Customer', customerSchema);