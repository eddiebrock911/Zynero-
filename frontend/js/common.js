// Global Toast Notification System
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'warning') icon = '⚠️';

  toast.innerHTML = `
    <span>${icon}</span>
    <div>${message}</div>
  `;

  container.appendChild(toast);

  // Trigger animation reflow
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  // Remove toast after 4 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

// Check logged in user
function getUser() {
  const userStr = localStorage.getItem('zynero_user');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch (e) {
      return null;
    }
  }
  return null;
}

// Get Cart Items
function getLocalCart() {
  const cartStr = localStorage.getItem('zynero_cart');
  if (cartStr) {
    try {
      return JSON.parse(cartStr);
    } catch (e) {
      return [];
    }
  }
  return [];
}

// Save Cart Items
function saveLocalCart(cart) {
  localStorage.setItem('zynero_cart', JSON.stringify(cart));
  updateCartBadge();
}

// Update Cart Badge Count
function updateCartBadge() {
  const cart = getLocalCart();
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  const badge = document.getElementById('cart-count-badge');
  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }
}

// Sync Local Cart with DB (after user logs in)
async function syncCartWithServer() {
  const token = localStorage.getItem('zynero_token');
  if (!token) return;

  const localCart = getLocalCart();
  if (localCart.length === 0) {
    // If local cart is empty, fetch cart from server to populate local
    try {
      const serverCart = await apiFetch('/cart');
      const formattedItems = serverCart.items.map(item => ({
        product: {
          _id: item.product._id,
          name: item.product.name,
          price: item.product.price,
          images: item.product.images,
          stock: item.product.stock
        },
        qty: item.qty
      }));
      localStorage.setItem('zynero_cart', JSON.stringify(formattedItems));
      updateCartBadge();
    } catch (err) {
      console.error('Failed to fetch server cart:', err);
    }
  } else {
    // Sync local cart to server
    try {
      const payloadItems = localCart.map(item => ({
        product: item.product._id,
        qty: item.qty
      }));
      await apiFetch('/cart', {
        method: 'POST',
        body: JSON.stringify({ items: payloadItems })
      });
    } catch (err) {
      console.error('Failed to sync cart with server:', err);
    }
  }
}

// Add Item to Cart
async function addItemToCart(product, qty = 1) {
  let cart = getLocalCart();
  const existing = cart.find(item => item.product._id === product._id);

  if (existing) {
    if (existing.qty + qty > product.stock) {
      showToast(`Cannot add more items. Only ${product.stock} in stock.`, 'warning');
      return false;
    }
    existing.qty += qty;
  } else {
    if (qty > product.stock) {
      showToast(`Cannot add. Only ${product.stock} in stock.`, 'warning');
      return false;
    }
    cart.push({ product, qty });
  }

  saveLocalCart(cart);
  showToast(`${product.name} added to cart!`, 'success');

  // If logged in, sync to server in background
  if (localStorage.getItem('zynero_token')) {
    try {
      const payloadItems = cart.map(item => ({
        product: item.product._id,
        qty: item.qty
      }));
      await apiFetch('/cart', {
        method: 'POST',
        body: JSON.stringify({ items: payloadItems })
      });
    } catch (err) {
      console.error('Failed to sync add item to cart:', err);
    }
  }
  return true;
}

// Log Out User
function logout() {
  localStorage.removeItem('zynero_token');
  localStorage.removeItem('zynero_user');
  localStorage.removeItem('zynero_cart');
  showToast('Logged out successfully!', 'info');
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 1000);
}

// Dynamically Inject Header & Footer
document.addEventListener('DOMContentLoaded', () => {
  // Inject Header
  const headerContainer = document.getElementById('header-wrapper');
  if (headerContainer) {
    const user = getUser();
    const isAdmin = user && user.isAdmin;
    
    let userSectionHTML = `
      <a href="auth.html" class="btn btn-primary btn-sm">Log In</a>
    `;

    if (user) {
      userSectionHTML = `
        <div style="display: flex; align-items: center; gap: 15px;">
          <a href="dashboard.html" class="nav-link" style="font-weight: 600;">👋 ${user.name.split(' ')[0]}</a>
          <button onclick="logout()" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;">Logout</button>
        </div>
      `;
    }

    const headerHTML = `
      <header class="main-header">
        <div class="container nav-container">
          <a href="index.html" class="logo">Zynero<span>.</span></a>
          
          <nav class="nav-menu">
            <a href="index.html" class="nav-link" id="nav-home">Home</a>
            <a href="products.html" class="nav-link" id="nav-products">Products</a>
            ${isAdmin ? `<a href="admin.html" class="nav-link" id="nav-admin" style="color: var(--secondary-light);">Admin Panel</a>` : ''}
          </nav>
          
          <div class="nav-actions">
            <!-- Search bar -->
            <div class="search-bar-container">
              <input type="text" placeholder="Search products..." class="search-input" id="global-search-input">
              <i class="search-icon">🔍</i>
            </div>
            
            <!-- Cart Button -->
            <a href="cart.html" class="cart-icon-btn">
              🛒
              <span class="cart-badge" id="cart-count-badge" style="display: none;">0</span>
            </a>
            
            <!-- User Nav Section -->
            <div id="user-nav-section">
              ${userSectionHTML}
            </div>
          </div>
        </div>
      </header>
    `;
    headerContainer.innerHTML = headerHTML;

    // Active Tab Highlight
    const path = window.location.pathname;
    if (path.includes('index.html') || path.endsWith('/')) {
      const link = document.getElementById('nav-home');
      if (link) link.classList.add('active');
    } else if (path.includes('products.html')) {
      const link = document.getElementById('nav-products');
      if (link) link.classList.add('active');
    } else if (path.includes('admin.html')) {
      const link = document.getElementById('nav-admin');
      if (link) link.classList.add('active');
    }

    // Bind Global Search Input
    const searchInput = document.getElementById('global-search-input');
    if (searchInput) {
      // If we are on products page, sync search input
      const urlParams = new URLSearchParams(window.location.search);
      const keyword = urlParams.get('keyword') || '';
      if (window.location.pathname.includes('products.html')) {
        searchInput.value = keyword;
      }

      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const val = searchInput.value.trim();
          window.location.href = `products.html?keyword=${encodeURIComponent(val)}`;
        }
      });
    }
  }

  // Inject Footer
  const footerContainer = document.getElementById('footer-wrapper');
  if (footerContainer) {
    const footerHTML = `
      <footer class="main-footer">
        <div class="container footer-grid">
          <div class="footer-about">
            <div class="footer-logo">Zynero<span>.</span></div>
            <p>Your ultimate destination for premium gaming equipment, hi-fi audio monitors, wearable tech, and designer computer accessories. Build your setup with Zynero.</p>
          </div>
          <div>
            <h4 class="footer-heading">Shop Categories</h4>
            <ul class="footer-links">
              <li><a href="products.html?category=Audio">Audio Equipment</a></li>
              <li><a href="products.html?category=Gaming">Gaming Peripherals</a></li>
              <li><a href="products.html?category=Wearables">Smart Wearables</a></li>
              <li><a href="products.html?category=Computers">Computers & Laptops</a></li>
            </ul>
          </div>
          <div>
            <h4 class="footer-heading">Customer Assistance</h4>
            <ul class="footer-links">
              <li><a href="#">Contact Support</a></li>
              <li><a href="#">Shipping Rates</a></li>
              <li><a href="#">Return Policy</a></li>
              <li><a href="#">FAQ Section</a></li>
            </ul>
          </div>
          <div>
            <h4 class="footer-heading">Store Contact</h4>
            <ul class="footer-contact">
              <li><i>📍</i> Delhi, NCR, India</li>
              <li><i>✉️</i> support@zynero.com</li>
              <li><i>📞</i> +91 98765 43210</li>
            </ul>
          </div>
        </div>
        <div class="container footer-bottom">
          <p>&copy; 2026 Zynero E-Commerce. All rights reserved. Created with high-fidelity glassmorphic design principles.</p>
        </div>
      </footer>
    `;
    footerContainer.innerHTML = footerHTML;
  }

  // Always update badge count on load
  updateCartBadge();
});
