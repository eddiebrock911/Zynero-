const mongoose = require('mongoose');
const { readData, writeData } = require('../config/mockDb');

const orderItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  qty: { type: Number, required: true },
  image: { type: String, required: true },
  price: { type: Number, required: true },
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
    country: { type: String, required: true }
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

// Mock Query helper supporting chain methods
class MockOrderQuery {
  constructor(dataArray, isSingle = false) {
    this.data = dataArray;
    this.isSingle = isSingle;
  }
  populate(field) {
    // We handle user population automatically in the then resolver
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
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
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
      
      // Populate user info if user field exists
      const populated = this.data.map(order => {
        const orderCopy = { ...order };
        const userObj = dbData.users.find(u => u._id.toString() === order.user.toString());
        if (userObj) {
          orderCopy.user = {
            _id: userObj._id,
            name: userObj.name,
            email: userObj.email
          };
        }
        return new MockOrderInstance(orderCopy);
      });

      resolve(this.isSingle ? (populated[0] || null) : populated);
    } catch (err) {
      if (reject) reject(err);
    }
  }
}

// Mock Order model
class MockOrder {
  static find(query = {}) {
    const data = readData();
    let results = [...data.orders];

    if (query.user) {
      results = results.filter(o => o.user.toString() === query.user.toString());
    }

    return new MockOrderQuery(results);
  }

  static findById(id) {
    const data = readData();
    const order = data.orders.find(o => o._id === id);
    return new MockOrderQuery(order ? [order] : [], true);
  }
}

class MockOrderInstance {
  constructor(fields) {
    Object.assign(this, fields);
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
    if (plainObj.user && typeof plainObj.user === 'object') {
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
