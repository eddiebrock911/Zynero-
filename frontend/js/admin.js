document.addEventListener('DOMContentLoaded', () => {
  // Safe-guard role check
  const user = getUser();
  if (!user || !user.isAdmin) {
    showToast('Unauthorized access. Admin privileges required.', 'error');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1000);
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
    if (secOverview) secOverview.style.display = 'none';
    if (secProducts) secProducts.style.display = 'none';
    if (secOrders) secOrders.style.display = 'none';

    if (overviewBtn) overviewBtn.classList.remove('active');
    if (productsBtn) productsBtn.classList.remove('active');
    if (ordersBtn) ordersBtn.classList.remove('active');

    if (section === 'overview') {
      if (secOverview) secOverview.style.display = 'block';
      if (overviewBtn) overviewBtn.classList.add('active');
      loadOverviewMetrics();
    } else if (section === 'products') {
      if (secProducts) secProducts.style.display = 'block';
      if (productsBtn) productsBtn.classList.add('active');
      loadAdminProducts();
    } else if (section === 'orders') {
      if (secOrders) secOrders.style.display = 'block';
      if (ordersBtn) ordersBtn.classList.add('active');
      loadAdminOrders();
    }
  }

  // Bind Menu Click listeners
  if (overviewBtn) overviewBtn.addEventListener('click', () => showSection('overview'));
  if (productsBtn) productsBtn.addEventListener('click', () => showSection('products'));
  if (ordersBtn) ordersBtn.addEventListener('click', () => showSection('orders'));

  // ==========================================================================
  // Dashboard Overview Metrics
  // ==========================================================================
  async function loadOverviewMetrics() {
    try {
      const products = await apiFetch('/products');
      const orders = await apiFetch('/orders');

      // Calculate gross sales
      const paidOrders = Array.isArray(orders) ? orders.filter(o => o && o.isPaid) : [];
      const revenue = paidOrders.reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0);

      if (metricRev) metricRev.textContent = `₹${revenue.toLocaleString('en-IN')}`;
      if (metricOrd) metricOrd.textContent = Array.isArray(orders) ? orders.length : 0;
      if (metricProd) metricProd.textContent = Array.isArray(products) ? products.length : 0;

    } catch (err) {
      showToast('Error loading metrics data.', 'error');
    }
  }

  // ==========================================================================
  // Product Inventory Management CRUD
  // ==========================================================================
  async function loadAdminProducts() {
    if (!productsTbody) return;
    productsTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">Fetching catalog...</td></tr>';
    try {
      const products = await apiFetch('/products');
      productsTbody.innerHTML = '';

      if (!Array.isArray(products) || products.length === 0) {
        productsTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No products registered yet.</td></tr>';
        return;
      }

      products.forEach(p => {
        const row = document.createElement('tr');
        
        const image = p.images && p.images.length ? p.images[0] : 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=500';

        row.innerHTML = `
          <td>
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${image}" alt="${p.name || 'Product'}" style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover;">
              <div style="font-weight: 600;">${p.name || 'Product'}</div>
            </div>
          </td>
          <td><span class="status-badge" style="background: rgba(255, 255, 255, 0.05); color: var(--text-muted); text-transform: capitalize;">${p.category || 'Tech'}</span></td>
          <td style="font-weight: 600;">₹${(Number(p.price) || 0).toLocaleString('en-IN')}</td>
          <td>${p.stock || 0} units</td>
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
    if (!prodForm) return;
    prodForm.reset();
    if (p) {
      // Edit mode
      if (modalTitle) modalTitle.textContent = 'Edit Product Listing';
      if (inputId) inputId.value = p._id;
      if (inputName) inputName.value = p.name || '';
      if (inputPrice) inputPrice.value = p.price !== undefined ? p.price : '';
      if (inputStock) inputStock.value = p.stock !== undefined ? p.stock : '';
      if (inputCategory) inputCategory.value = p.category || 'Audio';
      if (inputImage) inputImage.value = p.images && p.images.length ? p.images[0] : '';
      if (inputDesc) inputDesc.value = p.description || '';
    } else {
      // Create mode
      if (modalTitle) modalTitle.textContent = 'Create Product Listing';
      if (inputId) inputId.value = '';
    }
    if (prodModal) prodModal.style.display = 'flex';
  }

  // Close modal
  function closeProductModal() {
    if (prodModal) prodModal.style.display = 'none';
  }

  if (formCancelBtn) formCancelBtn.addEventListener('click', closeProductModal);
  if (addProdModalBtn) addProdModalBtn.addEventListener('click', () => openProductModal());

  // Form Submit (Create / Edit)
  if (prodForm) {
    prodForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = inputId.value;
      const name = inputName.value.trim();
      const price = Number(inputPrice.value);
      const stock = Number(inputStock.value);
      const category = inputCategory.value;
      const imageVal = inputImage.value.trim();
      const images = imageVal ? [imageVal] : ['https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=500'];
      const description = inputDesc.value.trim();

      if (!name || isNaN(price) || price < 0 || isNaN(stock) || stock < 0 || !category || !description) {
        showToast('Please provide valid product details with non-negative price and stock', 'warning');
        return;
      }

      const payload = { name, price, stock, category, images, description };

      if (formSubmitBtn) {
        formSubmitBtn.disabled = true;
        formSubmitBtn.textContent = 'Saving...';
      }

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
        if (formSubmitBtn) {
          formSubmitBtn.disabled = false;
          formSubmitBtn.textContent = 'Save Product';
        }
      }
    });
  }

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
    if (!ordersTbody) return;
    ordersTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">Fetching orders...</td></tr>';
    try {
      const orders = await apiFetch('/orders');
      ordersTbody.innerHTML = '';

      if (!Array.isArray(orders) || orders.length === 0) {
        ordersTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">No orders registered.</td></tr>';
        return;
      }

      orders.forEach(o => {
        const row = document.createElement('tr');
        
        const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : 'Recent';

        const payStatusHTML = o.isPaid 
          ? `<span class="status-badge paid" style="font-size: 11px;">Paid</span>`
          : `<span class="status-badge pending" style="font-size: 11px;">Pending</span>`;

        const customerName = (o.user && typeof o.user === 'object' && o.user.name) ? o.user.name : 'Customer';

        row.innerHTML = `
          <td><span style="font-family: monospace; font-size: 12px; font-weight: 600;">${o._id}</span></td>
          <td><div style="font-weight: 600;">${customerName}</div></td>
          <td style="font-size: 12px; color: var(--text-muted);">${date}</td>
          <td style="font-weight: 600;">₹${(Number(o.totalPrice) || 0).toLocaleString('en-IN')}</td>
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
        select.value = o.status || 'Pending';

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
            o.status = newStatus;
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
