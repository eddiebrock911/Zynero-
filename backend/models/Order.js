const mongoose = require('mongoose');
const { readData, writeData } = require('../config/mockDb');

const orderItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  qty: { type: Number, required: true, min: 1 },
  image: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  }
});

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderItems: [orderItemSchema],
  shippingAddress: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true, default: 'India' }
  },
  paymentMethod: { type: String, required: true, default: 'Razorpay' },
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },
  itemsPrice: { type: Number, required: true, default: 0.0 },
  taxPrice: { type: Number, required: true, default: 0.0 },
  shippingPrice: { type: Number, required: true, default: 0.0 },
  totalPrice: { type: Number, required: true, default: 0.0 },
  status: {
    type: String,
    required: true,
    enum: ['Pending', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending'
  },
  isPaid: { type: Boolean, required: true, default: false },
  paidAt: { type: Date },
  isDelivered: { type: Boolean, required: true, default: false },
  deliveredAt: { type: Date }
}, {
  timestamps: true
});

const MongooseOrder = mongoose.model('Order', orderSchema);

class MockOrderInstance {
  constructor(fields) {
    Object.assign(this, JSON.parse(JSON.stringify(fields || {})));
    if (!Array.isArray(this.orderItems)) this.orderItems = [];
  }

  populate(field, select) {
    const dbData = readData();
    const rawUserId = (this.user && this.user._id) ? this.user._id.toString() : (this.user ? this.user.toString() : null);
    if (rawUserId) {
      const userObj = dbData.users.find(u => u._id.toString() === rawUserId);
      if (userObj) {
        this.user = {
          _id: userObj._id,
          name: userObj.name,
          email: userObj.email
        };
      } else {
        this.user = {
          _id: rawUserId,
          name: 'Customer',
          email: ''
        };
      }
    }
    return this;
  }

  async save() {
    const data = readData();
    
    if (!this._id) {
      this._id = `order_${Math.random().toString(36).substring(2, 10)}`;
      this.createdAt = new Date().toISOString();
    }

    this.updatedAt = new Date().toISOString();
    
    // Ensure we store just the user ID string in DB, not populated object
    const plainObj = JSON.parse(JSON.stringify(this));
    if (plainObj.user && typeof plainObj.user === 'object' && plainObj.user._id) {
      plainObj.user = plainObj.user._id;
    }

    const index = data.orders.findIndex(o => o._id === this._id);
    if (index !== -1) {
      data.orders[index] = plainObj;
    } else {
      data.orders.push(plainObj);
    }

    writeData(data);
    return this;
  }
}

class MockOrderQuery {
  constructor(dataArray, isSingle = false) {
    this.data = Array.isArray(dataArray) ? [...dataArray] : [];
    this.isSingle = isSingle;
    this.shouldPopulate = false;
  }

  populate(field, select) {
    this.shouldPopulate = true;
    return this;
  }

  sort(sortObj) {
    if (!sortObj) return this;
    const field = Object.keys(sortObj)[0];
    const order = sortObj[field];
    
    this.data.sort((a, b) => {
      let valA = a[field];
      let valB = b[field];
      if (field === 'createdAt') {
        valA = new Date(valA || 0).getTime();
        valB = new Date(valB || 0).getTime();
      }
      if (valA < valB) return order === 1 ? -1 : 1;
      if (valA > valB) return order === 1 ? 1 : -1;
      return 0;
    });
    return this;
  }

  async then(resolve, reject) {
    try {
      const dbData = readData();
      
      const populated = this.data.map(order => {
        const orderCopy = { ...order };
        const rawUserId = (order.user && order.user._id) ? order.user._id.toString() : (order.user ? order.user.toString() : null);
        if (rawUserId) {
          const userObj = dbData.users.find(u => u._id.toString() === rawUserId);
          if (userObj) {
            orderCopy.user = {
              _id: userObj._id,
              name: userObj.name,
              email: userObj.email
            };
          } else {
            orderCopy.user = {
              _id: rawUserId,
              name: 'Customer',
              email: ''
            };
          }
        }
        return new MockOrderInstance(orderCopy);
      });

      if (this.isSingle) {
        return resolve(populated.length > 0 ? populated[0] : null);
      }
      return resolve(populated);
    } catch (err) {
      if (reject) return reject(err);
      throw err;
    }
  }

  catch(reject) {
    return this.then(null, reject);
  }
}

class MockOrder {
  static find(query = {}) {
    const data = readData();
    let results = [...data.orders];

    if (query.user) {
      const targetUserId = query.user.toString();
      results = results.filter(o => o.user && o.user.toString() === targetUserId);
    }

    return new MockOrderQuery(results, false);
  }

  static findById(id) {
    if (!id) return new MockOrderQuery([], true);
    const data = readData();
    const order = data.orders.find(o => o._id.toString() === id.toString());
    return new MockOrderQuery(order ? [order] : [], true);
  }

  static async countDocuments(query = {}) {
    const data = readData();
    return data.orders.length;
  }
}

module.exports = new Proxy(MongooseOrder, {
  get(target, prop) {
    if (global.dbConnected) {
      return Reflect.get(target, prop);
    } else {
      return Reflect.get(MockOrder, prop);
    }
  },
  construct(target, args) {
    if (global.dbConnected) {
      return Reflect.construct(target, args);
    } else {
      return Reflect.construct(MockOrderInstance, args);
    }
  }
});
