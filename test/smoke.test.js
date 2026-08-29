/**
 * Zynero Full-Stack Smoke Test Suite
 * Tests all core API endpoints, security controls, authentication, cart, order, and payment flows.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

// Ensure test environment
process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = 'zynero_test_jwt_secret_key_2026';
process.env.PORT = '5099';

// Reset test db.json before running tests
const testDbPath = path.join(__dirname, '../backend/data/db.json');
const initialData = {
  users: [],
  products: [
    {
      _id: "prod_1",
      name: "AuraPulse Wireless Headphones",
      price: 8999,
      images: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500"],
      category: "Audio",
      stock: 12,
      description: "Premium noise-cancelling wireless headphones with deep bass, 40-hour battery life, and spatial audio support.",
      rating: 4.8,
      numReviews: 5,
      reviews: []
    },
    {
      _id: "prod_2",
      name: "Vortex Pro Gaming Mouse",
      price: 4500,
      images: ["https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500"],
      category: "Gaming",
      stock: 25,
      description: "Ultra-lightweight gaming mouse with a 26k DPI optical sensor, custom RGB lighting.",
      rating: 4.6,
      numReviews: 3,
      reviews: []
    }
  ],
  orders: [],
  carts: []
};
fs.writeFileSync(testDbPath, JSON.stringify(initialData, null, 2));

const { app, server } = require('../backend/server');

const BASE_URL = `http://localhost:${process.env.PORT || 5099}`;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const payload = body ? JSON.stringify(body) : null;
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('\n=============================================');
  console.log('🚀 Running Zynero Smoke & Security Test Suite');
  console.log('=============================================\n');

  try {
    // 1. Health & Startup
    console.log('[1] Health & System Status');
    const health = await request('GET', '/api/health');
    assert(health.status === 200, 'Health endpoint returns 200');
    assert(health.body.status === 'ok', 'Health response status is "ok"');

    // 2. Products Catalog
    console.log('\n[2] Products Catalog & Filters');
    const productsRes = await request('GET', '/api/products');
    assert(productsRes.status === 200, 'Fetch products returns 200');
    assert(Array.isArray(productsRes.body) && productsRes.body.length >= 2, 'Products list returned correctly');

    const filterCategory = await request('GET', '/api/products?category=Audio');
    assert(filterCategory.status === 200, 'Filter category returns 200');
    assert(filterCategory.body.every(p => p.category === 'Audio'), 'Category filter matches Audio');

    const productDetail = await request('GET', '/api/products/prod_1');
    assert(productDetail.status === 200, 'Fetch product by ID returns 200');
    assert(productDetail.body.name === 'AuraPulse Wireless Headphones', 'Product detail has correct name');

    const productNotFound = await request('GET', '/api/products/non_existent_id');
    assert(productNotFound.status === 404, 'Non-existent product returns 404');

    // 3. User Registration & Admin Role
    console.log('\n[3] Authentication & Privilege Hierarchy');
    // First user -> Admin
    const adminReg = await request('POST', '/api/users', {
      name: 'Admin User',
      email: 'admin@zynero.com',
      password: 'password123'
    });
    assert(adminReg.status === 201, 'First user registration returns 201');
    assert(adminReg.body.isAdmin === true, 'First user is automatically assigned Admin role');
    assert(!adminReg.body.password, 'Password is excluded from registration response');
    const adminToken = adminReg.body.token;

    // Second user -> Regular User (Attempt privilege escalation via isAdmin: true)
    const userReg = await request('POST', '/api/users', {
      name: 'Regular Customer',
      email: 'customer@zynero.com',
      password: 'password123',
      isAdmin: true // Malicious attempt to self-promote
    });
    assert(userReg.status === 201, 'Second user registration returns 201');
    assert(userReg.body.isAdmin === false, 'Client-supplied isAdmin is ignored; user is regular customer');
    const userToken = userReg.body.token;
    const userId = userReg.body._id;

    // Duplicate email registration should fail
    const dupReg = await request('POST', '/api/users', {
      name: 'Duplicate',
      email: 'customer@zynero.com',
      password: 'password123'
    });
    assert(dupReg.status === 400, 'Duplicate email registration returns 400');

    // Login
    const loginSuccess = await request('POST', '/api/users/login', {
      email: 'customer@zynero.com',
      password: 'password123'
    });
    assert(loginSuccess.status === 200, 'Login with valid credentials returns 200');
    assert(Boolean(loginSuccess.body.token), 'Login returns JWT token');

    const loginFail = await request('POST', '/api/users/login', {
      email: 'customer@zynero.com',
      password: 'wrongpassword'
    });
    assert(loginFail.status === 401, 'Login with invalid password returns 401');

    // 4. User Profile & Authorization
    console.log('\n[4] User Profile & Token Verification');
    const profileRes = await request('GET', '/api/users/profile', null, userToken);
    assert(profileRes.status === 200, 'Profile fetch with token returns 200');
    assert(profileRes.body.email === 'customer@zynero.com', 'Profile matches authenticated user');
    assert(profileRes.body.isAdmin === false, 'User isAdmin is false in profile');

    const noTokenProfile = await request('GET', '/api/users/profile');
    assert(noTokenProfile.status === 401, 'Profile fetch without token returns 401');

    const invalidTokenProfile = await request('GET', '/api/users/profile', null, 'invalid_bearer_token');
    assert(invalidTokenProfile.status === 401, 'Profile fetch with invalid token returns 401');

    // Profile update: prevent privilege escalation
    const updateRes = await request('PUT', '/api/users/profile', {
      name: 'Updated Customer Name',
      isAdmin: true // Malicious attempt
    }, userToken);
    assert(updateRes.status === 200, 'Profile update returns 200');
    assert(updateRes.body.name === 'Updated Customer Name', 'Name updated successfully');
    assert(updateRes.body.isAdmin === false, 'Profile update prevents modifying isAdmin');

    // 5. Admin Authorization Guards
    console.log('\n[5] Admin Authorization Guards');
    // Regular user attempting admin product creation
    const unauthorizedProductCreate = await request('POST', '/api/products', {
      name: 'Hacked Product',
      price: 100,
      category: 'Gaming',
      stock: 10,
      description: 'Hacked'
    }, userToken);
    assert(unauthorizedProductCreate.status === 403, 'Regular user blocked from POST /api/products (403)');

    // Admin creating product
    const adminProductCreate = await request('POST', '/api/products', {
      name: 'Admin Keyboard Pro',
      price: 5999,
      category: 'Gaming',
      stock: 20,
      description: 'High end mechanical keyboard'
    }, adminToken);
    assert(adminProductCreate.status === 201, 'Admin can create product (201)');
    const createdProductId = adminProductCreate.body._id;

    // Admin updating product
    const adminProductUpdate = await request('PUT', `/api/products/${createdProductId}`, {
      price: 5499,
      stock: 18
    }, adminToken);
    assert(adminProductUpdate.status === 200, 'Admin can update product (200)');
    assert(adminProductUpdate.body.price === 5499, 'Product price updated');

    // Regular user attempting to delete product
    const userDelete = await request('DELETE', `/api/products/${createdProductId}`, null, userToken);
    assert(userDelete.status === 403, 'Regular user cannot delete product (403)');

    // Admin deleting product
    const adminDelete = await request('DELETE', `/api/products/${createdProductId}`, null, adminToken);
    assert(adminDelete.status === 200, 'Admin can delete product (200)');

    // 6. Product Reviews & Validation
    console.log('\n[6] Reviews & Validation');
    const reviewRes = await request('POST', '/api/products/prod_1/reviews', {
      rating: 5,
      comment: 'Superb sound quality and comfort!'
    }, userToken);
    assert(reviewRes.status === 201, 'User can submit review (201)');

    // Duplicate review check
    const dupReview = await request('POST', '/api/products/prod_1/reviews', {
      rating: 4,
      comment: 'Trying to review again'
    }, userToken);
    assert(dupReview.status === 400, 'Duplicate review from same user is blocked (400)');

    // Invalid rating validation
    const invalidRatingReview = await request('POST', '/api/products/prod_2/reviews', {
      rating: 10, // Invalid: must be 1-5
      comment: 'Great'
    }, userToken);
    assert(invalidRatingReview.status === 400, 'Invalid rating (>5) is rejected (400)');

    // 7. Cart System
    console.log('\n[7] Cart System');
    const syncCartRes = await request('POST', '/api/cart', {
      items: [
        { product: 'prod_1', qty: 2 },
        { product: 'prod_2', qty: 1 }
      ]
    }, userToken);
    assert(syncCartRes.status === 200, 'Cart sync returns 200');
    assert(syncCartRes.body.items.length === 2, 'Cart has 2 items');
    assert(syncCartRes.body.items[0].product.name === 'AuraPulse Wireless Headphones', 'Cart items are populated');

    const getCartRes = await request('GET', '/api/cart', null, userToken);
    assert(getCartRes.status === 200, 'Get cart returns 200');
    assert(getCartRes.body.items.length === 2, 'Get cart returns stored items');

    const clearCartRes = await request('DELETE', '/api/cart', null, userToken);
    assert(clearCartRes.status === 200, 'Clear cart returns 200');

    // 8. Order Placement & Price Integrity
    console.log('\n[8] Order Placement & Server-Side Price Calculation');
    // Client attempts to spoof total price as 1 INR for 8999 INR headphones
    const spoofedOrderPayload = {
      orderItems: [
        { product: 'prod_1', qty: 1, price: 1 } // Spoofed price
      ],
      shippingAddress: {
        street: '123 Tech Lane',
        city: 'Bengaluru',
        state: 'Karnataka',
        zipCode: '560001',
        country: 'India'
      },
      itemsPrice: 1, // Spoofed items price
      taxPrice: 0,
      shippingPrice: 0,
      totalPrice: 1 // Spoofed total
    };

    const orderCreateRes = await request('POST', '/api/orders', spoofedOrderPayload, userToken);
    assert(orderCreateRes.status === 201, 'Order created successfully (201)');
    const createdOrder = orderCreateRes.body.order;
    
    // Server must have recalculated based on actual DB price: 8999
    // itemsPrice = 8999, shipping = 150 (<= 10000), tax = Math.round(8999 * 0.18) = 1620, total = 8999 + 150 + 1620 = 10769
    assert(createdOrder.itemsPrice === 8999, `Server computed correct itemsPrice (8999, got ${createdOrder.itemsPrice})`);
    assert(createdOrder.totalPrice === 10769, `Server computed correct totalPrice (10769, got ${createdOrder.totalPrice})`);
    assert(createdOrder.status === 'Pending', 'Initial order status is Pending');
    assert(createdOrder.isPaid === false, 'Initial order isPaid is false');

    const orderId = createdOrder._id;
    const razorpayOrderId = createdOrder.razorpayOrderId;

    // 9. Payment Verification & Stock Update
    console.log('\n[9] Payment Verification & Stock Decrement');
    const verifyPayload = {
      orderId: orderId,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: 'pay_mock_test123',
      razorpay_signature: 'sig_mock_test123'
    };

    const verifyRes = await request('POST', '/api/orders/verify', verifyPayload, userToken);
    assert(verifyRes.status === 200, 'Payment verification succeeds (200)');
    assert(verifyRes.body.order.isPaid === true, 'Order isPaid is marked true');
    assert(verifyRes.body.order.status === 'Paid', 'Order status is marked Paid');

    // Verify stock decreased from 12 to 11
    const checkProduct = await request('GET', '/api/products/prod_1');
    assert(checkProduct.body.stock === 11, `Product stock decremented from 12 to 11 (got ${checkProduct.body.stock})`);

    // Duplicate verification idempotency test: Stock should NOT decrease again
    const dupVerify = await request('POST', '/api/orders/verify', verifyPayload, userToken);
    assert(dupVerify.status === 200, 'Duplicate payment verification returns 200 idempotently');
    const checkProductAgain = await request('GET', '/api/products/prod_1');
    assert(checkProductAgain.body.stock === 11, 'Product stock remained at 11 on duplicate verification');

    // 10. Order History & Ownership Privacy
    console.log('\n[10] Order History & IDOR Protection');
    // Register third user
    const thirdUser = await request('POST', '/api/users', {
      name: 'Third User',
      email: 'third@zynero.com',
      password: 'password123'
    });
    const thirdToken = thirdUser.body.token;

    // Third user attempting to view second user's order
    const unauthorizedOrderView = await request('GET', `/api/orders/${orderId}`, null, thirdToken);
    assert(unauthorizedOrderView.status === 403, 'Third user cannot access another user order (403 IDOR protected)');

    // Owner viewing order
    const ownerOrderView = await request('GET', `/api/orders/${orderId}`, null, userToken);
    assert(ownerOrderView.status === 200, 'Order owner can view own order (200)');

    // Admin viewing order
    const adminOrderView = await request('GET', `/api/orders/${orderId}`, null, adminToken);
    assert(adminOrderView.status === 200, 'Admin can view any order (200)');

    // Admin order status update
    const statusUpdateRes = await request('PUT', `/api/orders/${orderId}/status`, {
      status: 'Shipped'
    }, adminToken);
    assert(statusUpdateRes.status === 200, 'Admin can update order status (200)');
    assert(statusUpdateRes.body.status === 'Shipped', 'Order status changed to Shipped');

    // 11. 404 & Centralized Error Handler
    console.log('\n[11] Error Handling & Security Headers');
    const notFoundApi = await request('GET', '/api/nonexistent_route');
    assert(notFoundApi.status === 404, 'Unknown API route returns 404 JSON');
    assert(notFoundApi.headers['x-content-type-options'] === 'nosniff', 'Security header X-Content-Type-Options is set');
    assert(notFoundApi.headers['x-frame-options'] === 'SAMEORIGIN', 'Security header X-Frame-Options is set');

    console.log('\n=============================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} SMOKE & SECURITY TESTS PASSED!`);
    console.log('=============================================\n');
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test Suite Failed with Error:\n', err);
    server.close();
    process.exit(1);
  }
}

runTests();
