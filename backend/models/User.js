const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { readData, writeData } = require('../config/mockDb');

const addressSchema = new mongoose.Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, required: true, default: 'India' }
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, required: true, default: false },
  addresses: [addressSchema]
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const MongooseUser = mongoose.model('User', userSchema);

// Mock User Model Implementation
class MockUser {
  static async findOne({ email }) {
    const data = readData();
    const user = data.users.find(u => u.email === email);
    if (!user) return null;
    return new MockUserInstance(user);
  }

  static async findById(id) {
    const data = readData();
    const user = data.users.find(u => u._id === id);
    if (!user) return null;
    return new MockUserInstance(user);
  }

  static async countDocuments() {
    const data = readData();
    return data.users.length;
  }

  static async create(fields) {
    const data = readData();
    const id = `user_${Math.random().toString(36).substring(2, 10)}`;
    
    let hashedPassword = fields.password;
    if (fields.password && !fields.password.startsWith('$2a$')) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(fields.password, salt);
    }

    const newUser = {
      _id: id,
      name: fields.name,
      email: fields.email,
      password: hashedPassword,
      isAdmin: fields.isAdmin || false,
      addresses: fields.addresses || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.users.push(newUser);
    writeData(data);
    return new MockUserInstance(newUser);
  }
}

class MockUserInstance {
  constructor(fields) {
    Object.assign(this, fields);
  }
  async comparePassword(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
  }
  async save() {
    const data = readData();
    const index = data.users.findIndex(u => u._id === this._id);

    // Hash password if modified
    if (this.password && !this.password.startsWith('$2a$')) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }

    this.updatedAt = new Date().toISOString();
    const plainObj = JSON.parse(JSON.stringify(this));
    
    if (index !== -1) {
      data.users[index] = plainObj;
    } else {
      data.users.push(plainObj);
    }
    writeData(data);
    return this;
  }
}

module.exports = new Proxy(MongooseUser, {
  get(target, prop) {
    if (global.dbConnected) {
      return Reflect.get(target, prop);
    } else {
      return Reflect.get(MockUser, prop);
    }
  },
  construct(target, args) {
    if (global.dbConnected) {
      return Reflect.construct(target, args);
    } else {
      return Reflect.construct(MockUserInstance, args);
    }
  }
});
