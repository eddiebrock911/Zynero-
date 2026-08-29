const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/Order');
const Product = require('../models/Product');

// Initialize Razorpay
const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;
let razorpay = null;
let isMockRazorpay = true;

if (
  keyId && 
  keySecret && 
  !keyId.includes('dummy') &&
  !keySecret.includes('dummy') &&
  !keySecret.startsWith('dummy_')
) {
  try {
    razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });
    isMockRazorpay = false;
  } catch (err) {
    console.error('Error initializing Razorpay SDK, using mock mode:', err.message);
    isMockRazorpay = true;
  }
}

// @desc    Create new order & Razorpay order
// @route   POST /api/orders
// @access  Private
const addOrderItems = async (req, res) => {
  const { orderItems, shippingAddress } = req.body;

  if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
    return res.status(400).json({ message: 'No order items provided' });
  }

  if (
    !shippingAddress ||
    !shippingAddress.street ||
    !shippingAddress.city ||
    !shippingAddress.state ||
    !shippingAddress.zipCode
  ) {
    return res.status(400).json({ message: 'Complete shipping address is required' });
  }

  try {
    // Validate each order item against the database and calculate prices server-side
    const verifiedOrderItems = [];
    let itemsPrice = 0;

    for (const item of orderItems) {
      const prodId = (item.product && typeof item.product === 'object' && item.product._id) 
        ? item.product._id 
        : (item.product || item._id);

      if (!prodId) {
        return res.status(400).json({ message: 'Invalid product in order items' });
      }

      const product = await Product.findById(prodId);
      if (!product) {
        return res.status(400).json({ message: `Product not found: ${item.name || prodId}` });
      }

      const qty = parseInt(item.qty, 10);
      if (isNaN(qty) || qty < 1) {
        return res.status(400).json({ message: `Invalid quantity for ${product.name}` });
      }

      if (product.stock < qty) {
        return res.status(400).json({
          message: `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${qty}`
        });
      }

      const image = (product.images && product.images.length > 0)
        ? product.images[0]
        : 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=500';

      const itemPrice = Number(product.price);
      verifiedOrderItems.push({
        product: product._id,
        name: product.name,
        image,
        price: itemPrice,
        qty
      });

      itemsPrice += itemPrice * qty;
    }

    // Server-side calculations
    const shippingPrice = itemsPrice > 10000 ? 0 : 150;
    const taxPrice = Math.round(itemsPrice * 0.18);
    const totalPrice = itemsPrice + shippingPrice + taxPrice;

    // 1. Create order in database
    const order = new Order({
      user: req.user._id,
      orderItems: verifiedOrderItems,
      shippingAddress: {
        street: String(shippingAddress.street).trim(),
        city: String(shippingAddress.city).trim(),
        state: String(shippingAddress.state).trim(),
        zipCode: String(shippingAddress.zipCode).trim(),
        country: String(shippingAddress.country || 'India').trim()
      },
      paymentMethod: 'Razorpay',
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice,
      status: 'Pending',
      isPaid: false
    });

    const createdOrder = await order.save();

    // 2. Create Razorpay order (amount in paise: 1 INR = 100 paise)
    const amountInPaise = Math.round(totalPrice * 100);

    if (isMockRazorpay) {
      const mockRazorpayOrderId = `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
        razorpayKeyId: keyId || 'rzp_test_mock_key'
      });
    } else {
      const options = {
        amount: amountInPaise,
        currency: 'INR',
        receipt: `receipt_${createdOrder._id.toString().substring(0, 16)}`
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
        console.error('Razorpay SDK Order Create failed, falling back to mock mode:', err.message);
        const mockOrderId = `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
          razorpayKeyId: keyId || 'rzp_test_mock_key'
        });
      }
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
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

  if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ message: 'Missing payment verification parameters' });
  }

  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Verify order ownership
    const orderUserId = (order.user && order.user._id) ? order.user._id.toString() : (order.user ? order.user.toString() : null);
    if (orderUserId !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to verify payment for this order' });
    }

    // Idempotency: prevent double verification & multiple stock decrements
    if (order.isPaid) {
      return res.json({ message: 'Order payment is already verified', order });
    }

    // Check order ID match
    if (order.razorpayOrderId && order.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ message: 'Razorpay order ID mismatch' });
    }

    let isVerified = false;

    if (isMockRazorpay) {
      // In mock mode, verify simulated payment identifiers
      if (typeof razorpay_order_id === 'string' && razorpay_order_id.startsWith('order_mock_')) {
        isVerified = true;
      }
    } else {
      // In production mode, cryptographically verify Razorpay signature
      if (typeof razorpay_order_id === 'string' && razorpay_order_id.startsWith('order_mock_')) {
        return res.status(400).json({ message: 'Mock payment cannot be verified in live mode' });
      }

      const secret = process.env.RAZORPAY_KEY_SECRET;
      if (!secret) {
        return res.status(500).json({ message: 'Payment gateway configuration error on server' });
      }

      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');

      if (expectedSignature === razorpay_signature) {
        isVerified = true;
      }
    }

    if (isVerified) {
      order.isPaid = true;
      order.paidAt = new Date();
      order.status = 'Paid';
      order.razorpayPaymentId = razorpay_payment_id;
      order.razorpaySignature = razorpay_signature;

      // Update product inventory stock
      for (const item of order.orderItems) {
        const prodId = (item.product && typeof item.product === 'object' && item.product._id) 
          ? item.product._id 
          : item.product;
        
        if (prodId) {
          const product = await Product.findById(prodId);
          if (product) {
            product.stock = Math.max(0, product.stock - (item.qty || 1));
            await product.save();
          }
        }
      }

      const updatedOrder = await order.save();
      return res.json({ message: 'Payment verified successfully', order: updatedOrder });
    } else {
      return res.status(400).json({ message: 'Payment verification failed. Invalid signature.' });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    const order = await Order.findById(id).populate('user', 'name email');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const orderUserId = (order.user && order.user._id) ? order.user._id.toString() : (order.user ? order.user.toString() : null);

    if (orderUserId === req.user._id.toString() || req.user.isAdmin === true) {
      return res.json(order);
    } else {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get all orders (Admin)
// @route   GET /api/orders
// @access  Private/Admin
const getOrders = async (req, res) => {
  try {
    const orders = await Order.find({}).populate('user', 'name email').sort({ createdAt: -1 });
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update order status (Admin)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['Pending', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.status = status;
    if (status === 'Delivered') {
      order.isDelivered = true;
      order.deliveredAt = new Date();
    } else if (status === 'Paid') {
      order.isPaid = true;
      if (!order.paidAt) order.paidAt = new Date();
    }

    const updatedOrder = await order.save();
    return res.json(updatedOrder);
  } catch (error) {
    return res.status(500).json({ message: error.message });
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
