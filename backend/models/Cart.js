const mongoose = require('mongoose');
const { readData, writeData } = require('../config/mockDb');

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  qty: { type: Number, required: true, min: 1, default: 1 }
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

class MockCartInstance {
  constructor(fields) {
    Object.assign(this, JSON.parse(JSON.stringify(fields || {})));
    if (!Array.isArray(this.items)) this.items = [];
  }

  async populate(field) {
    const dbData = readData();
    this.items = this.items.map(item => {
      const prodId = (item.product && item.product._id) ? item.product._id.toString() : (item.product ? item.product.toString() : null);
      const prodObj = dbData.products.find(p => p._id.toString() === prodId);
      return {
        _id: item._id || `item_${Math.random().toString(36).substring(2, 9)}`,
        product: prodObj ? JSON.parse(JSON.stringify(prodObj)) : null,
        qty: Number(item.qty) || 1
      };
    }).filter(item => item.product !== null); // Filter out deleted products
    return this;
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
    plainObj.items = (plainObj.items || []).map(item => ({
      _id: item._id || `item_${Math.random().toString(36).substring(2, 9)}`,
      product: (item.product && typeof item.product === 'object' && item.product._id) ? item.product._id : item.product,
      qty: Number(item.qty) || 1
    })).filter(item => Boolean(item.product));

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

class MockCartQuery {
  constructor(cartObj) {
    this.cart = cartObj;
    this.shouldPopulate = false;
  }

  populate(field) {
    this.shouldPopulate = true;
    return this;
  }

  async then(resolve, reject) {
    try {
      if (!this.cart) {
        return resolve(null);
      }

      const instance = new MockCartInstance(this.cart);
      if (this.shouldPopulate) {
        await instance.populate('items.product');
      }
      return resolve(instance);
    } catch (err) {
      if (reject) return reject(err);
      throw err;
    }
  }

  catch(reject) {
    return this.then(null, reject);
  }
}

class MockCart {
  static findOne(query = {}) {
    const data = readData();
    const userId = query.user ? query.user.toString() : null;
    const cart = data.carts.find(c => c.user && c.user.toString() === userId);
    return new MockCartQuery(cart);
  }

  static async create(fields) {
    const data = readData();
    const id = `cart_${Math.random().toString(36).substring(2, 10)}`;
    const newCart = {
      _id: id,
      user: fields.user ? fields.user.toString() : null,
      items: Array.isArray(fields.items) ? fields.items : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.carts.push(newCart);
    writeData(data);
    return new MockCartInstance(newCart);
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
