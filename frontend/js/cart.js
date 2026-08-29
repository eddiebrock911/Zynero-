document.addEventListener('DOMContentLoaded', () => {
  const activeLayout = document.getElementById('cart-active-layout');
  const emptyContainer = document.getElementById('empty-cart-container');
  const itemsContainer = document.getElementById('cart-items-container');

  // Summary elements
  const subtotalEl = document.getElementById('summary-subtotal');
  const shippingEl = document.getElementById('summary-shipping');
  const taxEl = document.getElementById('summary-tax');
  const totalEl = document.getElementById('summary-total');

  const clearCartBtn = document.getElementById('clear-cart-btn');
  const checkoutBtn = document.getElementById('checkout-btn');

  // Render Cart
  function renderCart() {
    const cart = getLocalCart();
    
    if (!cart || cart.length === 0) {
      if (activeLayout) activeLayout.style.display = 'none';
      if (emptyContainer) emptyContainer.style.display = 'block';
      return;
    }

    if (emptyContainer) emptyContainer.style.display = 'none';
    if (activeLayout) activeLayout.style.display = 'grid';
    if (!itemsContainer) return;
    itemsContainer.innerHTML = '';

    let subtotal = 0;

    cart.forEach(item => {
      const product = item.product || {};
      const price = Number(product.price) || 0;
      const qty = Number(item.qty) || 1;
      const itemTotal = price * qty;
      subtotal += itemTotal;

      const itemRow = document.createElement('div');
      itemRow.className = 'cart-item-row';
      
      const image = product.images && product.images.length ? product.images[0] : 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=500';

      itemRow.innerHTML = `
        <img src="${image}" alt="${product.name || 'Product'}" class="cart-item-img">
        <div class="cart-item-info">
          <h4><a href="product-detail.html?id=${product._id}">${product.name || 'Unknown Product'}</a></h4>
          <p style="color: var(--text-muted); font-size: 12px; margin-top: 2px;">Category: ${product.category || 'Tech'}</p>
          <p style="font-weight: 600; margin-top: 6px; color: var(--text-main); font-size: 14px;">₹${price.toLocaleString('en-IN')}</p>
        </div>
        <div class="qty-selector" style="margin-bottom: 0;">
          <button class="qty-btn dec-qty-btn" data-id="${product._id}">-</button>
          <input type="text" value="${qty}" readonly class="qty-input" style="width: 35px; font-size: 14px;">
          <button class="qty-btn inc-qty-btn" data-id="${product._id}">+</button>
        </div>
        <div style="font-family: var(--font-display); font-weight: 700; font-size: 16px; text-align: right;">
          ₹${itemTotal.toLocaleString('en-IN')}
        </div>
        <div>
          <button class="delete-item-btn btn-danger" data-id="${product._id}" style="padding: 6px 10px; border-radius: 8px;" title="Remove Item">
            🗑️
          </button>
        </div>
      `;

      // Decrease Qty
      itemRow.querySelector('.dec-qty-btn').addEventListener('click', () => {
        if (qty > 1) {
          updateItemQty(product._id, qty - 1);
        } else {
          removeItem(product._id);
        }
      });

      // Increase Qty
      itemRow.querySelector('.inc-qty-btn').addEventListener('click', () => {
        const stock = typeof product.stock === 'number' ? product.stock : 999;
        if (qty >= stock) {
          showToast('Maximum available stock reached', 'warning');
          return;
        }
        updateItemQty(product._id, qty + 1);
      });

      // Delete Click
      itemRow.querySelector('.delete-item-btn').addEventListener('click', () => {
        removeItem(product._id);
      });

      itemsContainer.appendChild(itemRow);
    });

    // Summary calculations
    const shipping = subtotal > 10000 ? 0 : 150;
    const tax = Math.round(subtotal * 0.18);
    const total = subtotal + shipping + tax;

    if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toLocaleString('en-IN')}`;
    if (shippingEl) shippingEl.textContent = shipping === 0 ? 'FREE' : `₹${shipping}`;
    if (taxEl) taxEl.textContent = `₹${tax.toLocaleString('en-IN')}`;
    if (totalEl) totalEl.textContent = `₹${total.toLocaleString('en-IN')}`;
  }

  // Update item quantity
  async function updateItemQty(productId, newQty) {
    if (newQty < 1) return;
    let cart = getLocalCart();
    const item = cart.find(i => i.product && i.product._id === productId);
    if (item) {
      item.qty = newQty;
      saveLocalCart(cart);
      renderCart();
      await syncToServer(cart);
    }
  }

  // Remove item
  async function removeItem(productId) {
    let cart = getLocalCart();
    cart = cart.filter(i => i.product && i.product._id !== productId);
    saveLocalCart(cart);
    renderCart();
    showToast('Item removed from cart', 'info');
    await syncToServer(cart);
  }

  // Sync to database
  async function syncToServer(cart) {
    if (localStorage.getItem('zynero_token')) {
      try {
        const payloadItems = cart.map(i => ({
          product: i.product._id,
          qty: i.qty
        }));
        await apiFetch('/cart', {
          method: 'POST',
          body: JSON.stringify({ items: payloadItems })
        });
      } catch (err) {
        console.error('Error syncing cart update:', err);
      }
    }
  }

  // Clear Cart
  if (clearCartBtn) {
    clearCartBtn.addEventListener('click', async () => {
      saveLocalCart([]);
      renderCart();
      showToast('Cart cleared', 'info');

      if (localStorage.getItem('zynero_token')) {
        try {
          await apiFetch('/cart', {
            method: 'DELETE'
          });
        } catch (err) {
          console.error('Error clearing cart on server:', err);
        }
      }
    });
  }

  // Proceed to Checkout
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      const token = localStorage.getItem('zynero_token');
      if (!token) {
        showToast('Please sign in to proceed with checkout', 'warning');
        setTimeout(() => {
          window.location.href = 'auth.html?redirect=checkout.html';
        }, 1000);
      } else {
        window.location.href = 'checkout.html';
      }
    });
  }

  // Initial render
  renderCart();
});
