document.addEventListener('DOMContentLoaded', () => {
  // Check auth
  const token = localStorage.getItem('zynero_token');
  if (!token) {
    showToast('Please log in to access your dashboard', 'warning');
    window.location.href = 'auth.html';
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
    nameInput.value = user.name || '';
    emailInput.value = user.email || '';
  }

  // Save/Update Settings
  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    const btn = profileForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Saving...';

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
        isAdmin: data.isAdmin,
        addresses: data.addresses
      }));

      showToast('Settings saved successfully!', 'success');
      passwordInput.value = '';

      // Update navbar greeting name
      const greetText = document.querySelector('#user-nav-section a');
      if (greetText) {
        greetText.textContent = `👋 ${data.name.split(' ')[0]}`;
      }

    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Settings';
    }
  });

  // Render Orders
  async function loadMyOrders() {
    try {
      const orders = await apiFetch('/orders/myorders');
      
      ordersLoading.style.display = 'none';

      if (orders.length === 0) {
        noOrdersMsg.style.display = 'block';
        return;
      }

      noOrdersMsg.style.display = 'none';
      ordersList.innerHTML = '';

      orders.forEach(order => {
        const card = document.createElement('div');
        card.className = 'order-history-card';

        const date = new Date(order.createdAt).toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        // Determine status tag style
        let statusStyle = 'pending';
        let statusText = order.status;
        if (order.status === 'Paid') statusStyle = 'paid';
        if (order.status === 'Processing') statusStyle = 'paid';
        if (order.status === 'Shipped') statusStyle = 'delivered';
        if (order.status === 'Delivered') statusStyle = 'delivered';
        if (order.status === 'Cancelled') statusStyle = 'cancelled';

        // Render item previews
        let itemsHTML = '';
        order.orderItems.forEach(item => {
          itemsHTML += `
            <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px dashed rgba(255, 255, 255, 0.03);">
              <img src="${item.image}" alt="${item.name}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover; border: var(--glass-border);">
              <div style="flex-grow: 1;">
                <h4 style="font-size: 13px; font-weight: 600;">${item.name}</h4>
                <p style="color: var(--text-muted); font-size: 11px;">Qty: ${item.qty} × ₹${item.price.toLocaleString('en-IN')}</p>
              </div>
              <span style="font-weight: 600; font-size: 13px;">₹${(item.price * item.qty).toLocaleString('en-IN')}</span>
            </div>
          `;
        });

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
              <strong>Ship to:</strong> ${order.shippingAddress.street}, ${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.zipCode}
            </div>
            <div style="text-align: right;">
              <span style="color: var(--text-muted); font-size: 12px; display: block;">GRAND TOTAL</span>
              <span style="font-family: var(--font-display); font-size: 18px; font-weight: 800; color: var(--text-main);">₹${order.totalPrice.toLocaleString('en-IN')}</span>
            </div>
          </div>
        `;

        ordersList.appendChild(card);
      });

    } catch (err) {
      ordersLoading.style.display = 'none';
      noOrdersMsg.innerHTML = `<h4 style="color: var(--danger)">Error loading order history: ${err.message}</h4>`;
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
        modalOrderId.textContent = orderDetails._id;
        modalDest.textContent = `${orderDetails.shippingAddress.city}, ${orderDetails.shippingAddress.state}`;
        successModal.style.display = 'flex';
      } catch (err) {
        console.error(err);
      }
    }
    showSuccessDetails();
  }

  // Close Success Modal
  modalCloseBtn.addEventListener('click', () => {
    successModal.style.display = 'none';
    
    // Clear orderId query parameters from address bar
    const path = window.location.pathname;
    window.history.pushState({}, '', path);
    
    loadMyOrders();
  });

  // Run initial fetch
  loadMyOrders();
});
