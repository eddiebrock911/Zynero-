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

// Hash password before saving in Mongoose
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

class MockUserInstance {
  constructor(fields, selectedFields = null) {
    Object.assign(this, JSON.parse(JSON.stringify(fields)));
    if (selectedFields && selectedFields.includes('-password')) {
      delete this.password;
    }
  }

  async comparePassword(enteredPassword) {
    if (!this.password) {
      // If password field was excluded, retrieve raw password from database
      const data = readData();
      const rawUser = data.users.find(u => u._id === this._id);
      if (!rawUser) return false;
      return await bcrypt.compare(enteredPassword, rawUser.password);
    }
    return await bcrypt.compare(enteredPassword, this.password);
  }

  async save() {
    const data = readData();
    const index = data.users.findIndex(u => u._id === this._id);

    // Hash password if modified and not already a bcrypt hash
    if (this.password && !this.password.startsWith('$2a$') && !this.password.startsWith('$2b$')) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }

    this.updatedAt = new Date().toISOString();
    const plainObj = {
      _id: this._id,
      name: this.name,
      email: this.email,
      password: this.password !== undefined ? this.password : (index !== -1 ? data.users[index].password : ''),
      isAdmin: Boolean(this.isAdmin),
      addresses: Array.isArray(this.addresses) ? this.addresses : [],
      createdAt: this.createdAt || new Date().toISOString(),
      updatedAt: this.updatedAt
    };

    if (index !== -1) {
      data.users[index] = plainObj;
    } else {
      data.users.push(plainObj);
    }
    writeData(data);
    return this;
  }
}

class MockUserQuery {
  constructor(userObj) {
    this.userObj = userObj;
    this.selectField = null;
  }

  select(fields) {
    this.selectField = fields;
    return this;
  }

  then(resolve, reject) {
    try {
      if (!this.userObj) {
        return resolve(null);
      }
      return resolve(new MockUserInstance(this.userObj, this.selectField));
    } catch (err) {
      if (reject) return reject(err);
      throw err;
    }
  }

  catch(reject) {
    return this.then(null, reject);
  }
}

class MockUser {
  static findOne(query = {}) {
    const data = readData();
    let user = null;
    if (query.email) {
      const targetEmail = query.email.toLowerCase();
      user = data.users.find(u => u.email.toLowerCase() === targetEmail);
    } else if (query._id) {
      user = data.users.find(u => u._id === query._id);
    } else {
      user = data.users[0] || null;
    }
    return new MockUserQuery(user);
  }

  static findById(id) {
    const data = readData();
    const user = data.users.find(u => u._id === id);
    return new MockUserQuery(user);
  }

  static async countDocuments(query = {}) {
    const data = readData();
    return data.users.length;
  }

  static async create(fields) {
    const data = readData();
    const id = `user_${Math.random().toString(36).substring(2, 10)}`;
    
    let hashedPassword = fields.password;
    if (fields.password && !fields.password.startsWith('$2a$') && !fields.password.startsWith('$2b$')) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(fields.password, salt);
    }

    const newUser = {
      _id: id,
      name: fields.name,
      email: fields.email.toLowerCase(),
      password: hashedPassword,
      isAdmin: Boolean(fields.isAdmin),
      addresses: Array.isArray(fields.addresses) ? fields.addresses : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.users.push(newUser);
    writeData(data);
    return new MockUserInstance(newUser);
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
