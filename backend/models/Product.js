const mongoose = require('mongoose');
const { readData, writeData } = require('../config/mockDb');

const reviewSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, default: 0 },
  images: [{ type: String, required: true }],
  category: { type: String, required: true },
  stock: { type: Number, required: true, default: 0 },
  description: { type: String, required: true },
  reviews: [reviewSchema],
  rating: { type: Number, required: true, default: 0 },
  numReviews: { type: Number, required: true, default: 0 }
}, {
  timestamps: true
});

const MongooseProduct = mongoose.model('Product', productSchema);

// Mock Query Helper to chain sorting and acting as a thenable
class MockProductQuery {
  constructor(dataArray) {
    this.data = dataArray;
  }
  sort(sortObj) {
    if (!sortObj) return this;
    const field = Object.keys(sortObj)[0];
    const order = sortObj[field];
    
    this.data.sort((a, b) => {
      let valA = a[field];
      let valB = b[field];
      
      // Handle date conversion if sorting by date/createdAt
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
      const mapped = this.data.map(p => new MockProductInstance(p));
      resolve(mapped);
    } catch (err) {
      if (reject) reject(err);
    }
  }
}

// Mock Product Model
class MockProduct {
  static find(query = {}) {
    const data = readData();
    let results = [...data.products];

    // Filter by category
    if (query.category) {
      results = results.filter(p => p.category === query.category);
    }

    // Filter by price
    if (query.price) {
      if (query.price.$gte !== undefined) {
        results = results.filter(p => p.price >= query.price.$gte);
      }
      if (query.price.$lte !== undefined) {
        results = results.filter(p => p.price <= query.price.$lte);
      }
    }

    // Keyword search (fuzzy search on name and description)
    if (query.$or) {
      const keywordRegexes = query.$or.map(cond => {
        const fieldName = Object.keys(cond)[0];
        const pattern = cond[fieldName].$regex;
        return { field: fieldName, regex: new RegExp(pattern, 'i') };
      });

      results = results.filter(p => {
        return keywordRegexes.some(r => r.regex.test(p[r.field] || ''));
      });
    }

    return new MockProductQuery(results);
  }

  static async findById(id) {
    const data = readData();
    const product = data.products.find(p => p._id === id);
    if (!product) return null;
    return new MockProductInstance(product);
  }

  static async countDocuments() {
    const data = readData();
    return data.products.length;
  }

  static async deleteOne({ _id }) {
    const data = readData();
    const initialLen = data.products.length;
    data.products = data.products.filter(p => p._id !== _id);
    writeData(data);
    return { deletedCount: initialLen - data.products.length };
  }

  static async insertMany(productsArray) {
    const data = readData();
    const formatted = productsArray.map((p, index) => ({
      _id: p._id || `prod_${Date.now()}_${index}`,
      reviews: [],
      rating: p.rating || 0,
      numReviews: p.numReviews || 0,
      ...p
    }));
    data.products.push(...formatted);
    writeData(data);
    return formatted;
  }
}

class MockProductInstance {
  constructor(fields) {
    Object.assign(this, fields);
    if (!this.reviews) this.reviews = [];
  }
  async save() {
    const data = readData();
    
    // Check if new product or edit
    if (!this._id) {
      this._id = `prod_${Math.random().toString(36).substring(2, 10)}`;
      this.createdAt = new Date().toISOString();
      this.reviews = [];
      this.rating = 0;
      this.numReviews = 0;
    }

    this.updatedAt = new Date().toISOString();
    const plainObj = JSON.parse(JSON.stringify(this));

    const index = data.products.findIndex(p => p._id === this._id);
    if (index !== -1) {
      data.products[index] = plainObj;
    } else {
      data.products.push(plainObj);
    }
    
    writeData(data);
    return this;
  }
}

module.exports = new Proxy(MongooseProduct, {
  get(target, prop) {
    if (global.dbConnected) {
      return Reflect.get(target, prop);
    } else {
      return Reflect.get(MockProduct, prop);
    }
  },
  construct(target, args) {
    if (global.dbConnected) {
      return Reflect.construct(target, args);
    } else {
      return Reflect.construct(MockProductInstance, args);
    }
  }
});
