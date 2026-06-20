const mongoose = require('mongoose');

global.dbConnected = false;

const connectDB = async () => {
  try {
    // Disable Mongoose operation buffering so it fails fast
    mongoose.set('bufferCommands', false);
    
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zynero', {
      serverSelectionTimeoutMS: 2000 // 2 seconds timeout
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    global.dbConnected = true;
  } catch (error) {
    console.log('WARNING: MongoDB is not running locally. Running Zynero in JSON File Database Mode (persisted in backend/data/db.json).');
    global.dbConnected = false;
  }
};

module.exports = connectDB;
