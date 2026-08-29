const mongoose = require('mongoose');

global.dbConnected = false;

const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    console.log('NOTICE: MONGODB_URI not provided. Running Zynero in JSON File Database Mode (persisted in backend/data/db.json).');
    global.dbConnected = false;
    return;
  }

  try {
    // Disable Mongoose operation buffering so it fails fast if not connected
    mongoose.set('bufferCommands', false);
    
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 2500 // 2.5 seconds timeout
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    global.dbConnected = true;

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB runtime error:', err.message);
      global.dbConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Falling back to JSON Database Mode.');
      global.dbConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected.');
      global.dbConnected = true;
    });
  } catch (error) {
    console.log('WARNING: Could not connect to MongoDB. Running Zynero in JSON File Database Mode (persisted in backend/data/db.json).');
    global.dbConnected = false;
  }
};

module.exports = connectDB;
