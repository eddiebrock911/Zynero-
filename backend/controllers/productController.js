const Product = require('../models/Product');

// @desc    Fetch all products with filters & search
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
  try {
    const { keyword, category, minPrice, maxPrice, sortBy } = req.query;

    let query = {};

    // Keyword search (name or description)
    if (keyword && typeof keyword === 'string' && keyword.trim().length > 0) {
      const trimmedKeyword = keyword.trim();
      query.$or = [
        { name: { $regex: trimmedKeyword, $options: 'i' } },
        { description: { $regex: trimmedKeyword, $options: 'i' } }
      ];
    }

    // Category filter
    if (category && typeof category === 'string' && category !== 'All' && category.trim().length > 0) {
      query.category = category.trim();
    }

    // Price filter
    const parsedMin = minPrice !== undefined && minPrice !== '' ? Number(minPrice) : null;
    const parsedMax = maxPrice !== undefined && maxPrice !== '' ? Number(maxPrice) : null;

    if ((parsedMin !== null && !isNaN(parsedMin) && parsedMin >= 0) || (parsedMax !== null && !isNaN(parsedMax) && parsedMax >= 0)) {
      query.price = {};
      if (parsedMin !== null && !isNaN(parsedMin) && parsedMin >= 0) {
        query.price.$gte = parsedMin;
      }
      if (parsedMax !== null && !isNaN(parsedMax) && parsedMax >= 0) {
        query.price.$lte = parsedMax;
      }
    }

    let productsQuery = Product.find(query);

    // Sorting
    if (sortBy === 'price-asc') {
      productsQuery = productsQuery.sort({ price: 1 });
    } else if (sortBy === 'price-desc') {
      productsQuery = productsQuery.sort({ price: -1 });
    } else if (sortBy === 'rating') {
      productsQuery = productsQuery.sort({ rating: -1 });
    } else {
      productsQuery = productsQuery.sort({ createdAt: -1 }); // Default to newest
    }

    const products = await productsQuery;
    return res.json(products);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Fetch single product
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    const product = await Product.findById(id);

    if (product) {
      return res.json(product);
    } else {
      return res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    const product = await Product.findById(id);

    if (product) {
      await Product.deleteOne({ _id: id });
      return res.json({ message: 'Product removed' });
    } else {
      return res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = async (req, res) => {
  try {
    const { name, price, description, images, category, stock } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ message: 'Product name is required' });
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return res.status(400).json({ message: 'Valid positive price is required' });
    }

    const numStock = Number(stock);
    if (isNaN(numStock) || numStock < 0) {
      return res.status(400).json({ message: 'Valid non-negative stock number is required' });
    }

    if (!category || typeof category !== 'string' || category.trim().length === 0) {
      return res.status(400).json({ message: 'Product category is required' });
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({ message: 'Product description is required' });
    }

    const sanitizedImages = Array.isArray(images) && images.length > 0 && images.some(img => typeof img === 'string' && img.trim().length > 0)
      ? images.filter(img => typeof img === 'string' && img.trim().length > 0)
      : ['https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=500'];

    const product = new Product({
      name: name.trim(),
      price: numPrice,
      user: req.user._id,
      images: sanitizedImages,
      category: category.trim(),
      stock: Math.floor(numStock),
      description: description.trim(),
      rating: 0,
      numReviews: 0,
      reviews: []
    });

    const createdProduct = await product.save();
    return res.status(201).json(createdProduct);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, description, images, category, stock } = req.body;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: 'Product name cannot be empty' });
      }
      product.name = name.trim();
    }

    if (price !== undefined) {
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice < 0) {
        return res.status(400).json({ message: 'Price must be a valid non-negative number' });
      }
      product.price = numPrice;
    }

    if (stock !== undefined) {
      const numStock = Number(stock);
      if (isNaN(numStock) || numStock < 0) {
        return res.status(400).json({ message: 'Stock must be a valid non-negative number' });
      }
      product.stock = Math.floor(numStock);
    }

    if (category !== undefined) {
      if (typeof category !== 'string' || category.trim().length === 0) {
        return res.status(400).json({ message: 'Category cannot be empty' });
      }
      product.category = category.trim();
    }

    if (description !== undefined) {
      if (typeof description !== 'string' || description.trim().length === 0) {
        return res.status(400).json({ message: 'Description cannot be empty' });
      }
      product.description = description.trim();
    }

    if (images !== undefined) {
      if (Array.isArray(images) && images.length > 0) {
        product.images = images.filter(img => typeof img === 'string' && img.trim().length > 0);
      }
    }

    const updatedProduct = await product.save();
    return res.json(updatedProduct);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Create new review
// @route   POST /api/products/:id/reviews
// @access  Private
const createProductReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const numRating = Number(rating);

    if (isNaN(numRating) || numRating < 1 || numRating > 5 || !Number.isInteger(numRating)) {
      return res.status(400).json({ message: 'Rating must be an integer between 1 and 5' });
    }

    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
      return res.status(400).json({ message: 'Review comment is required' });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const alreadyReviewed = (product.reviews || []).find((r) => {
      const rUserId = (r.user && r.user._id) ? r.user._id.toString() : (r.user ? r.user.toString() : null);
      return rUserId === req.user._id.toString();
    });

    if (alreadyReviewed) {
      return res.status(400).json({ message: 'Product already reviewed by this user' });
    }

    const review = {
      name: req.user.name,
      rating: numRating,
      comment: comment.trim(),
      user: req.user._id,
      createdAt: new Date().toISOString()
    };

    product.reviews.push(review);
    product.numReviews = product.reviews.length;
    const totalRating = product.reviews.reduce((acc, item) => item.rating + acc, 0);
    product.rating = Number((totalRating / product.reviews.length).toFixed(1));

    await product.save();
    return res.status(201).json({ message: 'Review added successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProducts,
  getProductById,
  deleteProduct,
  createProduct,
  updateProduct,
  createProductReview
};
