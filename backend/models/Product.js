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
  price: { type: Number, required: true, min: 0, default: 0 },
  images: [{ type: String, required: true }],
  category: { type: String, required: true },
  stock: { type: Number, required: true, min: 0, default: 0 },
  description: { type: String, required: true },
  reviews: [reviewSchema],
  rating: { type: Number, required: true, default: 0, min: 0, max: 5 },
  numReviews: { type: Number, required: true, default: 0, min: 0 }
}, {
  timestamps: true
});

const MongooseProduct = mongoose.model('Product', productSchema);

class MockProductQuery {
  constructor(dataArray) {
    this.data = Array.isArray(dataArray) ? [...dataArray] : [];
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

  select(fields) {
    return this;
  }

  then(resolve, reject) {
    try {
      const mapped = this.data.map(p => new MockProductInstance(p));
      return resolve(mapped);
    } catch (err) {
      if (reject) return reject(err);
      throw err;
    }
  }

  catch(reject) {
    return this.then(null, reject);
  }
}

class MockProductInstance {
  constructor(fields) {
    Object.assign(this, JSON.parse(JSON.stringify(fields || {})));
    if (!Array.isArray(this.reviews)) this.reviews = [];
    if (!Array.isArray(this.images)) this.images = [];
    this.price = Number(this.price) || 0;
    this.stock = Number(this.stock) || 0;
    this.rating = Number(this.rating) || 0;
    this.numReviews = Number(this.numReviews) || 0;
  }

  async save() {
    const data = readData();
    
    if (!this._id) {
      this._id = `prod_${Math.random().toString(36).substring(2, 10)}`;
      this.createdAt = new Date().toISOString();
      if (!this.reviews) this.reviews = [];
      this.rating = 0;
      this.numReviews = 0;
    }

    if (this.reviews && this.reviews.length > 0) {
      this.numReviews = this.reviews.length;
      const totalRating = this.reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
      this.rating = Number((totalRating / this.reviews.length).toFixed(1));
    } else {
      this.numReviews = 0;
      this.rating = 0;
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

class MockProduct {
  static find(query = {}) {
    const data = readData();
    let results = [...data.products];

    // Filter by category
    if (query.category && query.category !== 'All') {
      results = results.filter(p => p.category.toLowerCase() === query.category.toLowerCase());
    }

    // Filter by price
    if (query.price) {
      if (query.price.$gte !== undefined && !isNaN(query.price.$gte)) {
        results = results.filter(p => p.price >= query.price.$gte);
      }
      if (query.price.$lte !== undefined && !isNaN(query.price.$lte)) {
        results = results.filter(p => p.price <= query.price.$lte);
      }
    }

    // Keyword search (fuzzy regex search on name and description)
    if (query.$or && Array.isArray(query.$or)) {
      const keywordRegexes = query.$or.map(cond => {
        const fieldName = Object.keys(cond)[0];
        const pattern = cond[fieldName].$regex || '';
        return { field: fieldName, regex: new RegExp(pattern, 'i') };
      });

      results = results.filter(p => {
        return keywordRegexes.some(r => r.regex.test(p[r.field] || ''));
      });
    }

    return new MockProductQuery(results);
  }

  static async findById(id) {
    if (!id) return null;
    const data = readData();
    const product = data.products.find(p => p._id.toString() === id.toString());
    if (!product) return null;
    return new MockProductInstance(product);
  }

  static async countDocuments(query = {}) {
    const data = readData();
    return data.products.length;
  }

  static async deleteOne({ _id }) {
    const data = readData();
    const initialLen = data.products.length;
    data.products = data.products.filter(p => p._id.toString() !== _id.toString());
    writeData(data);
    return { deletedCount: initialLen - data.products.length };
  }

  static async insertMany(productsArray) {
    const data = readData();
    const formatted = productsArray.map((p, index) => ({
      _id: p._id || `prod_${Date.now()}_${index}`,
      reviews: Array.isArray(p.reviews) ? p.reviews : [],
      rating: Number(p.rating) || 0,
      numReviews: Number(p.numReviews) || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...p
    }));
    data.products.push(...formatted);
    writeData(data);
    return formatted.map(p => new MockProductInstance(p));
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
