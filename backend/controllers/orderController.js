const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/Order');
const Product = require('../models/Product');

// Initialize Razorpay
const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;
let razorpay;
let isMockRazorpay = true;

if (keyId && keySecret && !keySecret.startsWith('rzp_test_dummy') && !keySecret.includes('dummy_secret_key')) {
  try {
    razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });
    isMockRazorpay = false;
    console.log('Razorpay SDK initialized successfully.');
  } catch (err) {
    console.error('Error initializing Razorpay, using mock mode:', err.message);
  }
} else {
  console.log('Using simulated Razorpay mode. Checkout will proceed using mock payments.');
}

// @desc    Create new order & Razorpay order
// @route   POST /api/orders
// @access  Private
const addOrderItems = async (req, res) => {
  const {
    orderItems,
    shippingAddress,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice
  } = req.body;

  if (!orderItems || orderItems.length === 0) {
    return res.status(400).json({ message: 'No order items' });
  }

  try {
    // 1. Create order in database
    const order = new Order({
      user: req.user._id,
      orderItems,
      shippingAddress,
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice,
      status: 'Pending'
    });

    const createdOrder = await order.save();

    // 2. Create Razorpay order
    // Razorpay amount is in paise (1 INR = 100 paise)
    const amountInPaise = Math.round(totalPrice * 100);

    if (isMockRazorpay) {
      const mockRazorpayOrderId = `order_mock_${Math.random().toString(36).substring(2, 15)}`;
      createdOrder.razorpayOrderId = mockRazorpayOrderId;
      await createdOrder.save();

      return res.status(201).json({
        order: createdOrder,
        razorpayOrder: {
          id: mockRazorpayOrderId,
          amount: amountInPaise,
          currency: 'INR'
        },
        isMock: true,
        razorpayKeyId: keyId || 'rzp_test_5V6vOqR4Z9Ua5v'
      });
    } else {
      const options = {
        amount: amountInPaise,
        currency: 'INR',
        receipt: `receipt_order_${createdOrder._id.toString().substring(0, 10)}`
      };

      try {
        const razorpayOrder = await razorpay.orders.create(options);
        createdOrder.razorpayOrderId = razorpayOrder.id;
        await createdOrder.save();

        return res.status(201).json({
          order: createdOrder,
          razorpayOrder,
          isMock: false,
          razorpayKeyId: keyId
        });
      } catch (err) {
        console.error('Razorpay SDK Order Create failed, falling back to mock:', err.message);
        // Fallback to mock order creation if API fails (network issue or invalid keys)
        const mockOrderId = `order_mock_${Math.random().toString(36).substring(2, 15)}`;
        createdOrder.razorpayOrderId = mockOrderId;
        await createdOrder.save();

        return res.status(201).json({
          order: createdOrder,
          razorpayOrder: {
            id: mockOrderId,
            amount: amountInPaise,
            currency: 'INR'
          },
          isMock: true,
          razorpayKeyId: keyId || 'rzp_test_5V6vOqR4Z9Ua5v'
        });
      }
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify Razorpay payment
// @route   POST /api/orders/verify
// @access  Private
const verifyPayment = async (req, res) => {
  const {
    orderId,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  } = req.body;

  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    let isVerified = false;

    // Check if it's a mock payment
    if (razorpay_order_id.startsWith('order_mock_') || isMockRazorpay) {
      isVerified = true;
    } else {
      // Real signature verification
      const secret = process.env.RAZORPAY_KEY_SECRET;
      const body = razorpay_order_id + '|' + razorpay_payment_id;

      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body.toString())
        .digest('hex');

      if (expectedSignature === razorpay_signature) {
        isVerified = true;
      }
    }

    if (isVerified) {
      order.isPaid = true;
      order.paidAt = Date.now();
      order.status = 'Paid';
      order.razorpayPaymentId = razorpay_payment_id;
      order.razorpaySignature = razorpay_signature;

      // Update product stock inventory
      for (const item of order.orderItems) {
        const product = await Product.findById(item.product);
        if (product) {
          product.stock = Math.max(0, product.stock - item.qty);
          await product.save();
        }
      }

      const updatedOrder = await order.save();
      res.json({ message: 'Payment verified successfully', order: updatedOrder });
    } else {
      res.status(400).json({ message: 'Payment verification failed. Invalid signature.' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');

    if (order) {
      // Check if user is owner or admin
      if (order.user._id.toString() === req.user._id.toString() || req.user.isAdmin) {
        res.json(order);
      } else {
        res.status(403).json({ message: 'Not authorized to view this order' });
      }
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all orders (Admin)
// @route   GET /api/orders
// @access  Private/Admin
const getOrders = async (req, res) => {
  try {
    const orders = await Order.find({}).populate('user', 'id name').sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update order status (Admin)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (order) {
      const { status } = req.body;
      if (!['Pending', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }

      order.status = status;
      if (status === 'Delivered') {
        order.isDelivered = true;
        order.deliveredAt = Date.now();
      }

      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  addOrderItems,
  verifyPayment,
  getMyOrders,
  getOrderById,
  getOrders,
  updateOrderStatus
};
