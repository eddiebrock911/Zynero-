document.addEventListener('DOMContentLoaded', () => {
  const loadingScreen = document.getElementById('detail-loading');
  const contentContainer = document.getElementById('detail-content-container');
  const reviewsContainer = document.getElementById('reviews-block-container');

  // Element selectors
  const prodImg = document.getElementById('detail-product-img');
  const catBadge = document.getElementById('detail-category-badge');
  const prodName = document.getElementById('detail-product-name');
  const starsEl = document.getElementById('detail-stars');
  const reviewCountEl = document.getElementById('detail-review-count');
  const priceEl = document.getElementById('detail-product-price');
  const descEl = document.getElementById('detail-product-desc');
  const stockEl = document.getElementById('detail-stock-status');
  const categoryNameEl = document.getElementById('detail-category-name');

  // Quantity controls
  const qtyMinus = document.getElementById('qty-minus');
  const qtyPlus = document.getElementById('qty-plus');
  const qtyVal = document.getElementById('qty-value');
  const qtyWrapper = document.getElementById('detail-qty-wrapper');
  const addToCartBtn = document.getElementById('add-to-cart-detail-btn');

  // Reviews selectors
  const reviewsList = document.getElementById('reviews-list-container');
  const noReviews = document.getElementById('no-reviews-msg');
  const reviewAuthPrompt = document.getElementById('review-auth-prompt');
  const reviewForm = document.getElementById('review-form');

  // Parse ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');

  if (!productId) {
    showToast('Invalid Product ID', 'error');
    loadingScreen.innerHTML = `<h3 style="color: var(--danger)">Product ID missing in URL parameters</h3>`;
    return;
  }

  let productObj = null;
  let selectedQty = 1;

  // Star builder
  function getStarsHTML(rating) {
    let stars = '';
    const rounded = Math.round(rating);
    for (let i = 1; i <= 5; i++) {
      if (i <= rounded) stars += '★';
      else stars += '☆';
    }
    return stars;
  }

  // Load product details
  async function loadProductDetails() {
    try {
      const product = await apiFetch(`/products/${productId}`);
      productObj = product;

      // Update UI
      const image = product.images && product.images.length ? product.images[0] : 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=500';
      prodImg.src = image;
      prodImg.alt = product.name;

      catBadge.textContent = product.category;
      prodName.textContent = product.name;
      starsEl.textContent = getStarsHTML(product.rating);
      reviewCountEl.textContent = `(${product.numReviews} review${product.numReviews !== 1 ? 's' : ''})`;
      priceEl.textContent = `₹${product.price.toLocaleString('en-IN')}`;
      descEl.textContent = product.description;
      categoryNameEl.textContent = product.category;

      // Stock control
      if (product.stock > 0) {
        stockEl.textContent = `In Stock (${product.stock} units left)`;
        stockEl.style.color = 'var(--success)';
        qtyWrapper.style.display = 'flex';
        addToCartBtn.disabled = false;
        addToCartBtn.textContent = 'Add to Cart';
      } else {
        stockEl.textContent = 'Out of Stock';
        stockEl.style.color = 'var(--danger)';
        qtyWrapper.style.display = 'none';
        addToCartBtn.disabled = true;
        addToCartBtn.textContent = 'Out of Stock';
      }

      // Hide Spinner, Show content
      loadingScreen.style.display = 'none';
      contentContainer.style.display = 'grid';
      reviewsContainer.style.display = 'block';

      // Render Reviews
      renderReviews(product.reviews);

      // Check Review Auth
      const token = localStorage.getItem('zynero_token');
      if (token) {
        // Check if user already reviewed
        const user = getUser();
        const alreadyReviewed = product.reviews.find(r => r.user.toString() === user._id.toString());
        if (alreadyReviewed) {
          reviewAuthPrompt.innerHTML = `<p style="color: var(--success); font-size: 14px; font-weight: 500; text-align: center;">You have already reviewed this product. Thank you!</p>`;
          reviewAuthPrompt.style.display = 'block';
        } else {
          reviewForm.style.display = 'block';
        }
      } else {
        reviewAuthPrompt.style.display = 'block';
      }

    } catch (err) {
      loadingScreen.innerHTML = `<h3 style="color: var(--danger)">Error: ${err.message}</h3>`;
      showToast(err.message, 'error');
    }
  }

  // Render Reviews Helper
  function renderReviews(reviews) {
    reviewsList.innerHTML = '';
    if (reviews.length === 0) {
      noReviews.style.display = 'block';
      return;
    }

    noReviews.style.display = 'none';
    reviews.forEach(review => {
      const item = document.createElement('div');
      item.className = 'review-item';

      const date = new Date(review.createdAt).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      item.innerHTML = `
        <div class="review-header">
          <span class="review-author">${review.name}</span>
          <span class="review-date">${date}</span>
        </div>
        <div style="margin-bottom: 8px;">
          <span class="stars" style="font-size: 13px;">${getStarsHTML(review.rating)}</span>
        </div>
        <p class="review-comment">${review.comment}</p>
      `;
      reviewsList.appendChild(item);
    });
  }

  // Quantity Change Events
  qtyMinus.addEventListener('click', () => {
    if (selectedQty > 1) {
      selectedQty--;
      qtyVal.value = selectedQty;
    }
  });

  qtyPlus.addEventListener('click', () => {
    if (productObj && selectedQty < productObj.stock) {
      selectedQty++;
      qtyVal.value = selectedQty;
    } else {
      showToast('Maximum stock limit reached', 'warning');
    }
  });

  // Add to Cart Event
  addToCartBtn.addEventListener('click', async () => {
    if (!productObj) return;
    const success = await addItemToCart(productObj, selectedQty);
    if (success) {
      selectedQty = 1;
      qtyVal.value = 1;
    }
  });

  // Submit Review Form
  reviewForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rating = document.getElementById('review-rating').value;
    const comment = document.getElementById('review-comment').value.trim();

    const submitBtn = reviewForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
      await apiFetch(`/products/${productId}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating, comment })
      });

      showToast('Review submitted successfully!', 'success');
      
      // Reload product details to show new review
      setTimeout(() => {
        reviewForm.reset();
        loadProductDetails();
      }, 1000);

    } catch (err) {
      showToast(err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Review';
    }
  });

  // Run initial load
  loadProductDetails();
});
