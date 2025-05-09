// importData.js
// Script to import CSV data into MongoDB
const mongoose = require('mongoose');
const csv = require('csvtojson');
const path = require('path');
require('dotenv').config();

const Customer = require('./models/Customer');
const Order = require('./models/Order');
const Product = require('./models/Product');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/salesdb';

async function importCSV(Model, filePath) {
  const jsonArray = await csv().fromFile(filePath);
  await Model.deleteMany({}); // Clear existing data
  await Model.insertMany(jsonArray);
  console.log(`Imported ${jsonArray.length} records from ${filePath}`);
}

async function main() {
  await mongoose.connect(MONGO_URI);
  await importCSV(Customer, path.join(__dirname, '../csv_data/customers.csv'));
  await importCSV(Order, path.join(__dirname, '../csv_data/orders.csv'));
  await importCSV(Product, path.join(__dirname, '../csv_data/products.csv'));
  await mongoose.disconnect();
  console.log('All data imported successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
