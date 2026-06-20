const express = require('express');
const router = express.Router();
const {
  getCart,
  syncCart,
  clearCart
} = require('../controllers/cartController');
const { protect } = require('../middleware/auth');

router.route('/')
  .get(protect, getCart)
  .post(protect, syncCart)
  .delete(protect, clearCart);

module.exports = router;
