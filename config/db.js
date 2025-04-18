const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
  try {
    
  } catch (error) {
    console.log('Database connection error:', error.message);
    
  }
};

module.exports = connectDB;
