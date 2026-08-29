document.addEventListener('DOMContentLoaded', () => {
  // Check auth
  const token = localStorage.getItem('zynero_token');
  if (!token) {
    showToast('Please log in to checkout', 'warning');
    window.location.href = 'auth.html?redirect=checkout.html';
    return;
  }

  // Check cart items
  const cart = getLocalCart();
  if (cart.length === 0) {
    showToast('Your cart is empty', 'warning');
    window.location.href = 'products.html';
    return;
  }

  const user = getUser();
  const summaryItems = document.getElementById('checkout-summary-items');
  
  // Pricing elements
  const subtotalEl = document.getElementById('check-subtotal');
  const shippingEl = document.getElementById('check-shipping');
  const taxEl = document.getElementById('check-tax');
  const totalEl = document.getElementById('check-total');

  const checkoutForm = document.getElementById('checkout-form');
  const placeOrderBtn = document.getElementById('place-order-btn');

  // Simulator Modal Elements
  const mockModal = document.getElementById('mock-payment-modal');
  const mockOrderIdEl = document.getElementById('mock-order-id');
  const mockAmountEl = document.getElementById('mock-amount');
  const mockSuccessBtn = document.getElementById('mock-pay-success-btn');
  const mockFailBtn = document.getElementById('mock-pay-fail-btn');

  // Populate Saved Address if exists
  if (user && Array.isArray(user.addresses) && user.addresses.length > 0) {
    const saved = user.addresses[user.addresses.length - 1];
    if (document.getElementById('ship-street')) document.getElementById('ship-street').value = saved.street || '';
    if (document.getElementById('ship-city')) document.getElementById('ship-city').value = saved.city || '';
    if (document.getElementById('ship-state')) document.getElementById('ship-state').value = saved.state || '';
    if (document.getElementById('ship-zip')) document.getElementById('ship-zip').value = saved.zipCode || '';
    if (document.getElementById('ship-country')) document.getElementById('ship-country').value = saved.country || 'India';
  }

  // Render items summary
  let subtotal = 0;
  if (summaryItems) {
    summaryItems.innerHTML = '';

    cart.forEach(item => {
      const prod = item.product || {};
      const price = Number(prod.price) || 0;
      const qty = Number(item.qty) || 1;
      const itemTotal = price * qty;
      subtotal += itemTotal;

      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justify = 'space-between';
      row.style.alignItems = 'center';
      row.style.fontSize = '13px';
      row.style.marginBottom = '12px';
      
      row.innerHTML = `
        <div style="max-width: 70%;">
          <span style="font-weight: 600; color: var(--text-main);">${prod.name || 'Product'}</span>
          <span style="color: var(--text-muted); font-size: 11px; display: block;">Qty: ${qty} × ₹${price.toLocaleString('en-IN')}</span>
        </div>
        <span style="font-weight: 700;">₹${itemTotal.toLocaleString('en-IN')}</span>
      `;
      summaryItems.appendChild(row);
    });
  }

  const shipping = subtotal > 10000 ? 0 : 150;
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + shipping + tax;

  if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toLocaleString('en-IN')}`;
  if (shippingEl) shippingEl.textContent = shipping === 0 ? 'FREE' : `₹${shipping}`;
  if (taxEl) taxEl.textContent = `₹${tax.toLocaleString('en-IN')}`;
  if (totalEl) totalEl.textContent = `₹${total.toLocaleString('en-IN')}`;

  let currentOrderId = null;
  let currentRazorpayOrderId = null;
  let isSubmitting = false;

  // Process Checkout
  if (placeOrderBtn) {
    placeOrderBtn.addEventListener('click', async (e) => {
      e.preventDefault();

      if (isSubmitting) return;

      if (!checkoutForm || !checkoutForm.reportValidity()) {
        showToast('Please specify all shipping details', 'warning');
        return;
      }

      const street = document.getElementById('ship-street').value.trim();
      const city = document.getElementById('ship-city').value.trim();
      const state = document.getElementById('ship-state').value.trim();
      const zipCode = document.getElementById('ship-zip').value.trim();
      const country = document.getElementById('ship-country').value.trim();
      const saveAddressCheckbox = document.getElementById('save-address-checkbox');
      const saveAddress = saveAddressCheckbox ? saveAddressCheckbox.checked : false;

      if (!street || !city || !state || !zipCode) {
        showToast('Please fill in all address fields', 'warning');
        return;
      }

      isSubmitting = true;
      placeOrderBtn.disabled = true;
      placeOrderBtn.textContent = 'Processing Transaction...';

      const shippingAddress = { street, city, state, zipCode, country: country || 'India' };

      const orderItems = cart.map(item => ({
        product: item.product._id,
        qty: item.qty
      }));

      try {
        // Address Sync
        if (saveAddress && user) {
          const addrExists = (user.addresses || []).some(a => a.street === street && a.zipCode === zipCode);
          if (!addrExists) {
            try {
              const updatedAddresses = [...(user.addresses || []), shippingAddress];
              const updateRes = await apiFetch('/users/profile', {
                method: 'PUT',
                body: JSON.stringify({ addresses: updatedAddresses })
              });
              localStorage.setItem('zynero_user', JSON.stringify({
                ...user,
                addresses: updateRes.addresses
              }));
            } catch (e) {
              console.warn('Could not save address to profile:', e);
            }
          }
        }

        // Order creation
        const orderPayload = {
          orderItems,
          shippingAddress
        };

        const resData = await apiFetch('/orders', {
          method: 'POST',
          body: JSON.stringify(orderPayload)
        });

        currentOrderId = resData.order._id;
        currentRazorpayOrderId = resData.razorpayOrder ? resData.razorpayOrder.id : resData.order.razorpayOrderId;

        if (resData.isMock) {
          // Toggle simulator overlay modal
          if (mockOrderIdEl) mockOrderIdEl.textContent = currentRazorpayOrderId;
          if (mockAmountEl) mockAmountEl.textContent = `₹${(resData.order.totalPrice || total).toLocaleString('en-IN')}`;
          if (mockModal) mockModal.style.display = 'flex';
        } else {
          // Run Real Razorpay Checkout
          if (typeof Razorpay === 'undefined') {
            throw new Error('Razorpay SDK failed to load. Please refresh and try again.');
          }

          const options = {
            key: resData.razorpayKeyId,
            amount: resData.razorpayOrder.amount,
            currency: resData.razorpayOrder.currency || 'INR',
            name: "Zynero Premium Store",
            description: "Payment Checkout transaction",
            order_id: currentRazorpayOrderId,
            handler: async function (response) {
              await verifyPaymentSignature(
                response.razorpay_order_id,
                response.razorpay_payment_id,
                response.razorpay_signature
              );
            },
            prefill: {
              name: user.name || '',
              email: user.email || ''
            },
            theme: {
              color: "#8b5cf6"
            },
            modal: {
              ondismiss: function () {
                showToast('Payment window closed. Order is pending.', 'warning');
                isSubmitting = false;
                placeOrderBtn.disabled = false;
                placeOrderBtn.textContent = 'Proceed to Payment';
              }
            }
          };
          const rzp = new Razorpay(options);
          rzp.open();
        }

      } catch (err) {
        showToast(err.message, 'error');
        isSubmitting = false;
        placeOrderBtn.disabled = false;
        placeOrderBtn.textContent = 'Proceed to Payment';
      }
    });
  }

  // Verification helper
  async function verifyPaymentSignature(rzp_order_id, rzp_payment_id, rzp_signature) {
    try {
      await apiFetch('/orders/verify', {
        method: 'POST',
        body: JSON.stringify({
          orderId: currentOrderId,
          razorpay_order_id: rzp_order_id,
          razorpay_payment_id: rzp_payment_id,
          razorpay_signature: rzp_signature
        })
      });

      showToast('Payment verified successfully!', 'success');
      
      // Reset local cart storage
      saveLocalCart([]);
      
      // Clear Server Cart in background
      try {
        await apiFetch('/cart', { method: 'DELETE' });
      } catch (e) {
        console.error(e);
      }

      // Redirect to Order tracking dashboard
      setTimeout(() => {
        window.location.href = `dashboard.html?orderId=${currentOrderId}`;
      }, 1000);

    } catch (err) {
      showToast(err.message, 'error');
      isSubmitting = false;
      if (placeOrderBtn) {
        placeOrderBtn.disabled = false;
        placeOrderBtn.textContent = 'Proceed to Payment';
      }
    }
  }

  // Simulator bindings
  if (mockSuccessBtn) {
    mockSuccessBtn.addEventListener('click', async () => {
      if (mockModal) mockModal.style.display = 'none';
      const mockPaymentId = `pay_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const mockSignature = `sig_mock_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
      await verifyPaymentSignature(currentRazorpayOrderId, mockPaymentId, mockSignature);
    });
  }

  if (mockFailBtn) {
    mockFailBtn.addEventListener('click', () => {
      if (mockModal) mockModal.style.display = 'none';
      showToast('Payment simulation cancelled.', 'info');
      isSubmitting = false;
      if (placeOrderBtn) {
        placeOrderBtn.disabled = false;
        placeOrderBtn.textContent = 'Proceed to Payment';
      }
    });
  }
});
