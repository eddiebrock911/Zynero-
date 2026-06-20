document.addEventListener('DOMContentLoaded', () => {
  // Safe-guard role check
  const user = getUser();
  if (!user || !user.isAdmin) {
    showToast('Unauthorized access. Admin privileges required.', 'error');
    window.location.href = 'index.html';
    return;
  }

  // Sidebar Menu Selectors
  const overviewBtn = document.getElementById('menu-overview-btn');
  const productsBtn = document.getElementById('menu-products-btn');
  const ordersBtn = document.getElementById('menu-orders-btn');

  // View Sections
  const secOverview = document.getElementById('section-overview');
  const secProducts = document.getElementById('section-products');
  const secOrders = document.getElementById('section-orders');

  // Overview metrics
  const metricRev = document.getElementById('metric-revenue');
  const metricOrd = document.getElementById('metric-orders');
  const metricProd = document.getElementById('metric-products');

  // Product tables & modals
  const productsTbody = document.getElementById('admin-products-tbody');
  const addProdModalBtn = document.getElementById('add-product-modal-btn');
  const prodModal = document.getElementById('product-form-modal');
  const prodForm = document.getElementById('admin-product-form');
  const formSubmitBtn = document.getElementById('form-submit-btn');
  const formCancelBtn = document.getElementById('form-cancel-btn');
  const modalTitle = document.getElementById('modal-form-title');

  // Form Inputs
  const inputId = document.getElementById('form-product-id');
  const inputName = document.getElementById('form-name');
  const inputPrice = document.getElementById('form-price');
  const inputStock = document.getElementById('form-stock');
  const inputCategory = document.getElementById('form-category');
  const inputImage = document.getElementById('form-image');
  const inputDesc = document.getElementById('form-description');

  // Order tables
  const ordersTbody = document.getElementById('admin-orders-tbody');

  // Tab View Switcher helper
  function showSection(section) {
    [secOverview, secProducts, secOrders].forEach(s => s.style.display = 'none');
    [overviewBtn, productsBtn, ordersBtn].forEach(b => b.classList.remove('active'));

    if (section === 'overview') {
      secOverview.style.display = 'block';
      overviewBtn.classList.add('active');
      loadOverviewMetrics();
    } else if (section === 'products') {
      secProducts.style.display = 'block';
      productsBtn.classList.add('active');
      loadAdminProducts();
    } else if (section === 'orders') {
      secOrders.style.display = 'block';
      ordersBtn.classList.add('active');
      loadAdminOrders();
    }
  }

  // Bind Menu Click listeners
  overviewBtn.addEventListener('click', () => showSection('overview'));
  productsBtn.addEventListener('click', () => showSection('products'));
  ordersBtn.addEventListener('click', () => showSection('orders'));

  // ==========================================================================
  // Dashboard Overview Metrics
  // ==========================================================================
  async function loadOverviewMetrics() {
    try {
      const products = await apiFetch('/products');
      const orders = await apiFetch('/orders');

      // Calculate gross sales
      const paidOrders = orders.filter(o => o.isPaid);
      const revenue = paidOrders.reduce((sum, o) => sum + o.totalPrice, 0);

      metricRev.textContent = `₹${revenue.toLocaleString('en-IN')}`;
      metricOrd.textContent = orders.length;
      metricProd.textContent = products.length;

    } catch (err) {
      showToast('Error loading metrics data.', 'error');
    }
  }

  // ==========================================================================
  // Product Inventory Management CRUD
  // ==========================================================================
  async function loadAdminProducts() {
    productsTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">Fetching catalog...</td></tr>';
    try {
      const products = await apiFetch('/products');
      productsTbody.innerHTML = '';

      if (products.length === 0) {
        productsTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No products registered yet.</td></tr>';
        return;
      }

      products.forEach(p => {
        const row = document.createElement('tr');
        
        const image = p.images && p.images.length ? p.images[0] : 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=500';

        row.innerHTML = `
          <td>
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${image}" alt="${p.name}" style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover;">
              <div style="font-weight: 600;">${p.name}</div>
            </div>
          </td>
          <td><span class="status-badge" style="background: rgba(255, 255, 255, 0.05); color: var(--text-muted); text-transform: capitalize;">${p.category}</span></td>
          <td style="font-weight: 600;">₹${p.price.toLocaleString('en-IN')}</td>
          <td>${p.stock} units</td>
          <td style="text-align: right;">
            <button class="btn btn-secondary edit-btn" style="padding: 6px 12px; font-size: 12px; margin-right: 8px;">Edit</button>
            <button class="btn btn-danger delete-btn" style="padding: 6px 12px; font-size: 12px;">Delete</button>
          </td>
        `;

        // Bind Edit
        row.querySelector('.edit-btn').addEventListener('click', () => openProductModal(p));
        // Bind Delete
        row.querySelector('.delete-btn').addEventListener('click', () => deleteProduct(p._id));

        productsTbody.appendChild(row);
      });
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Open Create/Edit modal
  function openProductModal(p = null) {
    prodForm.reset();
    if (p) {
      // Edit mode
      modalTitle.textContent = 'Edit Product Listing';
      inputId.value = p._id;
      inputName.value = p.name;
      inputPrice.value = p.price;
      inputStock.value = p.stock;
      inputCategory.value = p.category;
      inputImage.value = p.images && p.images.length ? p.images[0] : '';
      inputDesc.value = p.description;
    } else {
      // Create mode
      modalTitle.textContent = 'Create Product Listing';
      inputId.value = '';
    }
    prodModal.style.display = 'flex';
  }

  // Close modal
  function closeProductModal() {
    prodModal.style.display = 'none';
  }

  formCancelBtn.addEventListener('click', closeProductModal);
  addProdModalBtn.addEventListener('click', () => openProductModal());

  // Form Submit (Create / Edit)
  prodForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = inputId.value;
    const name = inputName.value.trim();
    const price = Number(inputPrice.value);
    const stock = Number(inputStock.value);
    const category = inputCategory.value;
    const images = [inputImage.value.trim()];
    const description = inputDesc.value.trim();

    const payload = { name, price, stock, category, images, description };

    const saveBtn = document.getElementById('form-submit-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      if (id) {
        // Edit PUT
        await apiFetch(`/products/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast('Product updated successfully!', 'success');
      } else {
        // Create POST
        await apiFetch('/products', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast('Product created successfully!', 'success');
      }

      closeProductModal();
      loadAdminProducts();

    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Product';
    }
  });

  // Delete product
  async function deleteProduct(productId) {
    if (confirm('Are you sure you want to delete this product listing? This action cannot be undone.')) {
      try {
        await apiFetch(`/products/${productId}`, {
          method: 'DELETE'
        });
        showToast('Product removed from catalog', 'info');
        loadAdminProducts();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  }

  // ==========================================================================
  // Customer Orders Fulfillment Dispatch Tracking
  // ==========================================================================
  async function loadAdminOrders() {
    ordersTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">Fetching orders...</td></tr>';
    try {
      const orders = await apiFetch('/orders');
      ordersTbody.innerHTML = '';

      if (orders.length === 0) {
        ordersTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">No orders registered.</td></tr>';
        return;
      }

      orders.forEach(o => {
        const row = document.createElement('tr');
        
        const date = new Date(o.createdAt).toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        const payStatusHTML = o.isPaid 
          ? `<span class="status-badge paid" style="font-size: 11px;">Paid</span>`
          : `<span class="status-badge pending" style="font-size: 11px;">Pending</span>`;

        row.innerHTML = `
          <td><span style="font-family: monospace; font-size: 12px; font-weight: 600;">${o._id}</span></td>
          <td><div style="font-weight: 600;">${o.user ? o.user.name : 'Guest User'}</div></td>
          <td style="font-size: 12px; color: var(--text-muted);">${date}</td>
          <td style="font-weight: 600;">₹${o.totalPrice.toLocaleString('en-IN')}</td>
          <td>${payStatusHTML}</td>
          <td style="text-align: right;">
            <select class="form-control status-select" data-id="${o._id}" style="padding: 6px 12px; font-size: 12px; width: fit-content; display: inline-block; background: var(--bg-card); border-color: rgba(255,255,255,0.08);">
              <option value="Pending">Pending</option>
              <option value="Paid">Paid</option>
              <option value="Processing">Processing</option>
              <option value="Shipped">Shipped</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </td>
        `;

        // Bind initial status value
        const select = row.querySelector('.status-select');
        select.value = o.status;

        // Bind Change Listener
        select.addEventListener('change', async (e) => {
          const newStatus = e.target.value;
          select.disabled = true;
          try {
            await apiFetch(`/orders/${o._id}/status`, {
              method: 'PUT',
              body: JSON.stringify({ status: newStatus })
            });
            showToast(`Order status updated to ${newStatus}`, 'success');
          } catch (err) {
            showToast(err.message, 'error');
            select.value = o.status; // Revert
          } finally {
            select.disabled = false;
          }
        });

        ordersTbody.appendChild(row);
      });
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Load default metrics on startup
  loadOverviewMetrics();
});
