document.addEventListener('DOMContentLoaded', () => {
  // Check auth
  const token = localStorage.getItem('zynero_token');
  if (!token) {
    showToast('Please log in to access your dashboard', 'warning');
    setTimeout(() => {
      window.location.href = 'auth.html';
    }, 1000);
    return;
  }

  // Profile selectors
  const profileForm = document.getElementById('profile-update-form');
  const nameInput = document.getElementById('profile-name');
  const emailInput = document.getElementById('profile-email');
  const passwordInput = document.getElementById('profile-password');

  // Orders selectors
  const ordersLoading = document.getElementById('orders-loading');
  const noOrdersMsg = document.getElementById('no-orders-msg');
  const ordersList = document.getElementById('orders-history-list');

  // Modal selectors
  const successModal = document.getElementById('success-order-modal');
  const modalOrderId = document.getElementById('success-modal-order-id');
  const modalDest = document.getElementById('success-modal-destination');
  const modalCloseBtn = document.getElementById('success-modal-close-btn');

  const user = getUser();

  // Populate profile form fields
  if (user) {
    if (nameInput) nameInput.value = user.name || '';
    if (emailInput) emailInput.value = user.email || '';
  }

  // Save/Update Settings
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!name || !email) {
        showToast('Name and email are required', 'warning');
        return;
      }

      if (password && password.length < 6) {
        showToast('New password must be at least 6 characters long', 'warning');
        return;
      }

      const btn = profileForm.querySelector('button[type="submit"]');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Saving...';
      }

      const payload = { name, email };
      if (password) payload.password = password;

      try {
        const data = await apiFetch('/users/profile', {
          method: 'PUT',
          body: JSON.stringify(payload)
        });

        // Update storage
        localStorage.setItem('zynero_token', data.token);
        localStorage.setItem('zynero_user', JSON.stringify({
          _id: data._id,
          name: data.name,
          email: data.email,
          isAdmin: Boolean(data.isAdmin),
          addresses: data.addresses || []
        }));

        showToast('Settings saved successfully!', 'success');
        if (passwordInput) passwordInput.value = '';

        // Update navbar greeting name
        const greetText = document.querySelector('#user-nav-section a');
        if (greetText) {
          greetText.textContent = `👋 ${data.name.split(' ')[0]}`;
        }

      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Save Settings';
        }
      }
    });
  }

  // Render Orders
  async function loadMyOrders() {
    try {
      const orders = await apiFetch('/orders/myorders');
      
      if (ordersLoading) ordersLoading.style.display = 'none';

      if (!Array.isArray(orders) || orders.length === 0) {
        if (noOrdersMsg) noOrdersMsg.style.display = 'block';
        return;
      }

      if (noOrdersMsg) noOrdersMsg.style.display = 'none';
      if (!ordersList) return;
      ordersList.innerHTML = '';

      orders.forEach(order => {
        const card = document.createElement('div');
        card.className = 'order-history-card';

        const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : 'Recent';

        // Determine status tag style
        let statusStyle = 'pending';
        let statusText = order.status || 'Pending';
        if (order.status === 'Paid') statusStyle = 'paid';
        if (order.status === 'Processing') statusStyle = 'paid';
        if (order.status === 'Shipped') statusStyle = 'delivered';
        if (order.status === 'Delivered') statusStyle = 'delivered';
        if (order.status === 'Cancelled') statusStyle = 'cancelled';

        // Render item previews
        let itemsHTML = '';
        if (Array.isArray(order.orderItems)) {
          order.orderItems.forEach(item => {
            const price = Number(item.price) || 0;
            const qty = Number(item.qty) || 1;
            const img = item.image || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=500';
            itemsHTML += `
              <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px dashed rgba(255, 255, 255, 0.03);">
                <img src="${img}" alt="${item.name || 'Product'}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover; border: var(--glass-border);">
                <div style="flex-grow: 1;">
                  <h4 style="font-size: 13px; font-weight: 600;">${item.name || 'Product'}</h4>
                  <p style="color: var(--text-muted); font-size: 11px;">Qty: ${qty} × ₹${price.toLocaleString('en-IN')}</p>
                </div>
                <span style="font-weight: 600; font-size: 13px;">₹${(price * qty).toLocaleString('en-IN')}</span>
              </div>
            `;
          });
        }

        const shipAddr = order.shippingAddress || {};
        const shipText = [shipAddr.street, shipAddr.city, shipAddr.state, shipAddr.zipCode].filter(Boolean).join(', ');

        card.innerHTML = `
          <div class="order-history-header">
            <div>
              <span style="color: var(--text-muted); font-size: 12px;">ORDER REFERENCE</span>
              <h4 style="font-family: monospace; font-size: 14px; color: var(--primary-light); font-weight: 600;">${order._id}</h4>
              <span style="color: var(--text-muted); font-size: 11px;">Placed on ${date}</span>
            </div>
            <span class="status-badge ${statusStyle}">${statusText}</span>
          </div>

          <div style="margin-top: 15px; margin-bottom: 15px;">
            ${itemsHTML}
          </div>

          <div style="display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 15px;">
            <div style="font-size: 12px; color: var(--text-muted); max-width: 60%;">
              <strong>Ship to:</strong> ${shipText || 'Address on file'}
            </div>
            <div style="text-align: right;">
              <span style="color: var(--text-muted); font-size: 12px; display: block;">GRAND TOTAL</span>
              <span style="font-family: var(--font-display); font-size: 18px; font-weight: 800; color: var(--text-main);">₹${(Number(order.totalPrice) || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>
        `;

        ordersList.appendChild(card);
      });

    } catch (err) {
      if (ordersLoading) ordersLoading.style.display = 'none';
      if (noOrdersMsg) {
        noOrdersMsg.innerHTML = `<h4 style="color: var(--danger)">Error loading order history: ${err.message}</h4>`;
        noOrdersMsg.style.display = 'block';
      }
      showToast(err.message, 'error');
    }
  }

  // Handle successful order popup query parameter
  const urlParams = new URLSearchParams(window.location.search);
  const successOrderId = urlParams.get('orderId');

  if (successOrderId) {
    async function showSuccessDetails() {
      try {
        const orderDetails = await apiFetch(`/orders/${successOrderId}`);
        if (modalOrderId) modalOrderId.textContent = orderDetails._id;
        const ship = orderDetails.shippingAddress || {};
        if (modalDest) modalDest.textContent = `${ship.city || ''}, ${ship.state || ''}`.trim() || 'India';
        if (successModal) successModal.style.display = 'flex';
      } catch (err) {
        console.error(err);
      }
    }
    showSuccessDetails();
  }

  // Close Success Modal
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', () => {
      if (successModal) successModal.style.display = 'none';
      
      // Clear orderId query parameters from address bar
      const path = window.location.pathname;
      window.history.pushState({}, '', path);
      
      loadMyOrders();
    });
  }

  // Run initial fetch
  loadMyOrders();
});
