const Cart = require('../models/Cart');
const Product = require('../models/Product');

// @desc    Get logged in user cart
// @route   GET /api/cart
// @access  Private
const getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
      if (typeof cart.populate === 'function') {
        cart = await cart.populate('items.product');
      }
    }

    return res.json(cart);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Sync cart items (e.g. from localStorage on login, or saving state)
// @route   POST /api/cart
// @access  Private
const syncCart = async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items)) {
    return res.status(400).json({ message: 'Items must be an array' });
  }

  try {
    const validatedItems = [];

    for (const item of items) {
      const prodId = (item.product && typeof item.product === 'object' && item.product._id) 
        ? item.product._id 
        : (item.product || item._id);

      if (!prodId) continue;

      const product = await Product.findById(prodId);
      if (!product) continue;

      const rawQty = parseInt(item.qty, 10);
      const qty = (!isNaN(rawQty) && rawQty >= 1) ? Math.min(rawQty, Math.max(1, product.stock)) : 1;

      validatedItems.push({
        product: product._id,
        qty: qty
      });
    }

    let cart = await Cart.findOne({ user: req.user._id });

    if (cart) {
      cart.items = validatedItems;
      await cart.save();
    } else {
      cart = await Cart.create({
        user: req.user._id,
        items: validatedItems
      });
    }

    if (typeof cart.populate === 'function') {
      cart = await cart.populate('items.product');
    }

    return res.status(200).json(cart);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Clear cart
// @route   DELETE /api/cart
// @access  Private
const clearCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id });
    if (cart) {
      cart.items = [];
      await cart.save();
    }
    return res.json({ message: 'Cart cleared' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getCart,
  syncCart,
  clearCart
};
