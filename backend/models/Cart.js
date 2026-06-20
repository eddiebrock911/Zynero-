const mongoose = require('mongoose');
const { readData, writeData } = require('../config/mockDb');

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  qty: { type: Number, required: true, default: 1 }
});

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema]
}, {
  timestamps: true
});

const MongooseCart = mongoose.model('Cart', cartSchema);

class MockCartQuery {
  constructor(cartObj) {
    this.cart = cartObj;
  }
  populate(field) {
    return this;
  }
  async then(resolve, reject) {
    if (!this.cart) {
      resolve(null);
      return;
    }

    try {
      const dbData = readData();
      const cartCopy = JSON.parse(JSON.stringify(this.cart));

      // Populate product details in cart items
      cartCopy.items = cartCopy.items.map(item => {
        const prodObj = dbData.products.find(p => p._id.toString() === item.product.toString());
        if (prodObj) {
          item.product = prodObj;
        }
        return item;
      });

      resolve(new MockCartInstance(cartCopy));
    } catch (err) {
      if (reject) reject(err);
    }
  }
}

class MockCart {
  static findOne({ user }) {
    const data = readData();
    const cart = data.carts.find(c => c.user.toString() === user.toString());
    return new MockCartQuery(cart);
  }

  static async create(fields) {
    const data = readData();
    const id = `cart_${Math.random().toString(36).substring(2, 10)}`;
    const newCart = {
      _id: id,
      user: fields.user,
      items: fields.items || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.carts.push(newCart);
    writeData(data);
    return new MockCartInstance(newCart);
  }
}

class MockCartInstance {
  constructor(fields) {
    Object.assign(this, fields);
  }
  async save() {
    const data = readData();
    if (!this._id) {
      this._id = `cart_${Math.random().toString(36).substring(2, 10)}`;
      this.createdAt = new Date().toISOString();
    }
    this.updatedAt = new Date().toISOString();

    const plainObj = JSON.parse(JSON.stringify(this));
    
    // De-populate product items back to pure IDs before saving
    plainObj.items = plainObj.items.map(item => {
      if (item.product && typeof item.product === 'object') {
        item.product = item.product._id;
      }
      return item;
    });

    const index = data.carts.findIndex(c => c._id === this._id);
    if (index !== -1) {
      data.carts[index] = plainObj;
    } else {
      data.carts.push(plainObj);
    }

    writeData(data);
    return this;
  }
}

module.exports = new Proxy(MongooseCart, {
  get(target, prop) {
    if (global.dbConnected) {
      return Reflect.get(target, prop);
    } else {
      return Reflect.get(MockCart, prop);
    }
  },
  construct(target, args) {
    if (global.dbConnected) {
      return Reflect.construct(target, args);
    } else {
      return Reflect.construct(MockCartInstance, args);
    }
  }
});
