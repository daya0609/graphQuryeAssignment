// Order.js
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({ _id: String, customerId: String, orderDate: Date, status: String, items: Array }, { strict: false });

module.exports = mongoose.model('Order', orderSchema);