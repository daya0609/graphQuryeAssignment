// Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({ _id: String, name: String, category: String, price: Number }, { strict: false });

module.exports = mongoose.model('Product', productSchema);