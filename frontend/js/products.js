document.addEventListener('DOMContentLoaded', () => {
  const productsGrid = document.getElementById('products-grid-container');
  const searchStatus = document.getElementById('search-status-text');
  const emptyMsg = document.getElementById('empty-products-msg');

  // Filter Selectors
  const filterCategory = document.getElementById('filter-category');
  const filterMinPrice = document.getElementById('filter-min-price');
  const filterMaxPrice = document.getElementById('filter-max-price');
  const filterSort = document.getElementById('filter-sort');
  const resetBtn = document.getElementById('reset-filters-btn');

  // Load URL queries
  const urlParams = new URLSearchParams(window.location.search);
  let keyword = urlParams.get('keyword') || '';
  let category = urlParams.get('category') || 'All';
  let minPrice = urlParams.get('minPrice') || '';
  let maxPrice = urlParams.get('maxPrice') || '';
  let sortBy = urlParams.get('sortBy') || 'newest';

  // Setup Initial Inputs from URL Parameters
  filterCategory.value = category;
  filterMinPrice.value = minPrice;
  filterMaxPrice.value = maxPrice;
  filterSort.value = sortBy;

  // Render Stars
  function getStarsHTML(rating) {
    let stars = '';
    const roundedRating = Math.round(rating);
    for (let i = 1; i <= 5; i++) {
      if (i <= roundedRating) {
        stars += '★';
      } else {
        stars += '☆';
      }
    }
    return stars;
  }

  // Fetch and Render Products
  async function fetchProducts() {
    productsGrid.innerHTML = '';
    emptyMsg.style.display = 'none';
    searchStatus.textContent = 'Loading products catalog...';

    // Build URL Query String
    let queryParams = [];
    if (keyword) queryParams.push(`keyword=${encodeURIComponent(keyword)}`);
    if (category && category !== 'All') queryParams.push(`category=${encodeURIComponent(category)}`);
    if (minPrice) queryParams.push(`minPrice=${minPrice}`);
    if (maxPrice) queryParams.push(`maxPrice=${maxPrice}`);
    if (sortBy) queryParams.push(`sortBy=${sortBy}`);

    const queryString = queryParams.length ? `?${queryParams.join('&')}` : '';

    try {
      const products = await apiFetch(`/products${queryString}`);
      
      searchStatus.textContent = `Found ${products.length} product${products.length !== 1 ? 's' : ''}${keyword ? ` for "${keyword}"` : ''}`;

      if (products.length === 0) {
        emptyMsg.style.display = 'block';
        return;
      }

      products.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        
        const image = product.images && product.images.length ? product.images[0] : 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=500';

        productCard.innerHTML = `
          <div class="product-img-wrapper">
            <a href="product-detail.html?id=${product._id}">
              <img src="${image}" alt="${product.name}" class="product-img" loading="lazy">
            </a>
            <span class="product-badge">${product.category}</span>
          </div>
          <div class="product-content">
            <span class="product-category">${product.category}</span>
            <h3 class="product-title">
              <a href="product-detail.html?id=${product._id}">${product.name}</a>
            </h3>
            <div class="product-rating">
              <span class="stars">${getStarsHTML(product.rating)}</span>
              <span class="rating-count">(${product.numReviews})</span>
            </div>
            <div class="product-footer">
              <span class="product-price">₹${product.price.toLocaleString('en-IN')}</span>
              <button class="add-cart-btn" data-id="${product._id}" title="Add to Cart">
                +
              </button>
            </div>
          </div>
        `;

        // Bind quick add
        const addBtn = productCard.querySelector('.add-cart-btn');
        addBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          if (product.stock === 0) {
            showToast('Out of stock!', 'warning');
            return;
          }

          // Use helper from common.js
          await addItemToCart(product, 1);
        });

        productsGrid.appendChild(productCard);
      });

    } catch (err) {
      searchStatus.textContent = 'Error loading products catalog.';
      showToast(err.message, 'error');
    }
  }

  // Update URL Query and Fetch
  function updateFilters() {
    category = filterCategory.value;
    minPrice = filterMinPrice.value.trim();
    maxPrice = filterMaxPrice.value.trim();
    sortBy = filterSort.value;

    const url = new URL(window.location);
    url.searchParams.set('category', category);
    
    if (minPrice) url.searchParams.set('minPrice', minPrice);
    else url.searchParams.delete('minPrice');

    if (maxPrice) url.searchParams.set('maxPrice', maxPrice);
    else url.searchParams.delete('maxPrice');

    url.searchParams.set('sortBy', sortBy);
    window.history.pushState({}, '', url);

    fetchProducts();
  }

  // Listeners
  filterCategory.addEventListener('change', updateFilters);
  filterMinPrice.addEventListener('change', updateFilters);
  filterMaxPrice.addEventListener('change', updateFilters);
  filterSort.addEventListener('change', updateFilters);

  resetBtn.addEventListener('click', () => {
    filterCategory.value = 'All';
    filterMinPrice.value = '';
    filterMaxPrice.value = '';
    filterSort.value = 'newest';
    keyword = '';
    
    // Clear URL Search Parameters
    const url = new URL(window.location);
    url.search = '';
    window.history.pushState({}, '', url);

    // Sync search input if elements exist
    const searchInput = document.getElementById('global-search-input');
    if (searchInput) searchInput.value = '';

    updateFilters();
  });

  // Run initial fetch
  fetchProducts();
});
