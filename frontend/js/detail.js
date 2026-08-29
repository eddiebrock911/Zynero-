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
    if (loadingScreen) {
      loadingScreen.innerHTML = `<h3 style="color: var(--danger)">Product ID missing in URL parameters</h3>`;
    }
    return;
  }

  let productObj = null;
  let selectedQty = 1;

  // Star builder
  function getStarsHTML(rating) {
    let stars = '';
    const rounded = Math.round(Number(rating) || 0);
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
      if (prodImg) {
        prodImg.src = image;
        prodImg.alt = product.name || 'Product Image';
      }

      if (catBadge) catBadge.textContent = product.category || 'Tech';
      if (prodName) prodName.textContent = product.name || 'Product';
      if (starsEl) starsEl.textContent = getStarsHTML(product.rating);
      if (reviewCountEl) reviewCountEl.textContent = `(${product.numReviews || 0} review${product.numReviews !== 1 ? 's' : ''})`;
      if (priceEl) priceEl.textContent = `₹${(Number(product.price) || 0).toLocaleString('en-IN')}`;
      if (descEl) descEl.textContent = product.description || '';
      if (categoryNameEl) categoryNameEl.textContent = product.category || 'Tech';

      // Stock control
      const stock = Number(product.stock) || 0;
      if (stock > 0) {
        if (stockEl) {
          stockEl.textContent = `In Stock (${stock} unit${stock !== 1 ? 's' : ''} left)`;
          stockEl.style.color = 'var(--success)';
        }
        if (qtyWrapper) qtyWrapper.style.display = 'flex';
        if (addToCartBtn) {
          addToCartBtn.disabled = false;
          addToCartBtn.textContent = 'Add to Cart';
        }
      } else {
        if (stockEl) {
          stockEl.textContent = 'Out of Stock';
          stockEl.style.color = 'var(--danger)';
        }
        if (qtyWrapper) qtyWrapper.style.display = 'none';
        if (addToCartBtn) {
          addToCartBtn.disabled = true;
          addToCartBtn.textContent = 'Out of Stock';
        }
      }

      // Hide Spinner, Show content
      if (loadingScreen) loadingScreen.style.display = 'none';
      if (contentContainer) contentContainer.style.display = 'grid';
      if (reviewsContainer) reviewsContainer.style.display = 'block';

      // Render Reviews
      renderReviews(product.reviews || []);

      // Check Review Auth
      const token = localStorage.getItem('zynero_token');
      const user = getUser();
      if (token && user && user._id) {
        const alreadyReviewed = (product.reviews || []).find(r => {
          const rUserId = (r.user && r.user._id) ? r.user._id.toString() : (r.user ? r.user.toString() : null);
          return rUserId === user._id.toString();
        });

        if (alreadyReviewed) {
          if (reviewAuthPrompt) {
            reviewAuthPrompt.innerHTML = `<p style="color: var(--success); font-size: 14px; font-weight: 500; text-align: center;">You have already reviewed this product. Thank you!</p>`;
            reviewAuthPrompt.style.display = 'block';
          }
          if (reviewForm) reviewForm.style.display = 'none';
        } else {
          if (reviewForm) reviewForm.style.display = 'block';
          if (reviewAuthPrompt) reviewAuthPrompt.style.display = 'none';
        }
      } else {
        if (reviewAuthPrompt) reviewAuthPrompt.style.display = 'block';
        if (reviewForm) reviewForm.style.display = 'none';
      }

    } catch (err) {
      if (loadingScreen) loadingScreen.innerHTML = `<h3 style="color: var(--danger)">Error: ${err.message}</h3>`;
      showToast(err.message, 'error');
    }
  }

  // Render Reviews Helper
  function renderReviews(reviews) {
    if (!reviewsList) return;
    reviewsList.innerHTML = '';
    if (!reviews || reviews.length === 0) {
      if (noReviews) noReviews.style.display = 'block';
      return;
    }

    if (noReviews) noReviews.style.display = 'none';
    reviews.forEach(review => {
      const item = document.createElement('div');
      item.className = 'review-item';

      const date = review.createdAt ? new Date(review.createdAt).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }) : 'Recent';

      item.innerHTML = `
        <div class="review-header">
          <span class="review-author">${review.name || 'Customer'}</span>
          <span class="review-date">${date}</span>
        </div>
        <div style="margin-bottom: 8px;">
          <span class="stars" style="font-size: 13px;">${getStarsHTML(review.rating)}</span>
        </div>
        <p class="review-comment">${review.comment || ''}</p>
      `;
      reviewsList.appendChild(item);
    });
  }

  // Quantity Change Events
  if (qtyMinus && qtyVal) {
    qtyMinus.addEventListener('click', () => {
      if (selectedQty > 1) {
        selectedQty--;
        qtyVal.value = selectedQty;
      }
    });
  }

  if (qtyPlus && qtyVal) {
    qtyPlus.addEventListener('click', () => {
      if (productObj && selectedQty < (Number(productObj.stock) || 0)) {
        selectedQty++;
        qtyVal.value = selectedQty;
      } else {
        showToast('Maximum available stock reached', 'warning');
      }
    });
  }

  // Add to Cart Event
  if (addToCartBtn) {
    addToCartBtn.addEventListener('click', async () => {
      if (!productObj) return;
      const success = await addItemToCart(productObj, selectedQty);
      if (success) {
        selectedQty = 1;
        if (qtyVal) qtyVal.value = 1;
      }
    });
  }

  // Submit Review Form
  if (reviewForm) {
    reviewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rating = document.getElementById('review-rating').value;
      const comment = document.getElementById('review-comment').value.trim();

      const submitBtn = reviewForm.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
      }

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
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Review';
        }
      }
    });
  }

  // Run initial load
  loadProductDetails();
});
