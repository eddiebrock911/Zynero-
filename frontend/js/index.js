document.addEventListener('DOMContentLoaded', () => {
  const featuredGrid = document.getElementById('featured-grid-container');
  const newsletterEmail = document.getElementById('newsletter-email');
  const newsletterBtn = document.getElementById('newsletter-submit-btn');

  // Stars helper
  function getStarsHTML(rating) {
    let stars = '';
    const rounded = Math.round(rating);
    for (let i = 1; i <= 5; i++) {
      if (i <= rounded) stars += '★';
      else stars += '☆';
    }
    return stars;
  }

  // Load featured arrivals
  async function loadFeatured() {
    featuredGrid.innerHTML = '<div style="grid-column: span 3; text-align: center; color: var(--text-muted); font-size: 14px;">Retrieving featured arrivals...</div>';
    try {
      const products = await apiFetch('/products');
      featuredGrid.innerHTML = '';

      // Highlight the first 3 products
      const featured = products.slice(0, 3);

      if (featured.length === 0) {
        featuredGrid.innerHTML = '<div style="grid-column: span 3; text-align: center; color: var(--text-muted); font-size: 14px;">No items currently in stock.</div>';
        return;
      }

      featured.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card';
        
        const image = p.images && p.images.length ? p.images[0] : 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=500';

        card.innerHTML = `
          <div class="product-img-wrapper">
            <a href="product-detail.html?id=${p._id}">
              <img src="${image}" alt="${p.name}" class="product-img" loading="lazy">
            </a>
            <span class="product-badge">${p.category}</span>
          </div>
          <div class="product-content">
            <span class="product-category">${p.category}</span>
            <h3 class="product-title">
              <a href="product-detail.html?id=${p._id}">${p.name}</a>
            </h3>
            <div class="product-rating">
              <span class="stars">${getStarsHTML(p.rating)}</span>
              <span class="rating-count">(${p.numReviews})</span>
            </div>
            <div class="product-footer">
              <span class="product-price">₹${p.price.toLocaleString('en-IN')}</span>
              <button class="add-cart-btn" data-id="${p._id}" title="Add to Cart">
                +
              </button>
            </div>
          </div>
        `;

        // Bind quick add
        card.querySelector('.add-cart-btn').addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();

          if (p.stock === 0) {
            showToast('Out of stock!', 'warning');
            return;
          }

          await addItemToCart(p, 1);
        });

        featuredGrid.appendChild(card);
      });

    } catch (err) {
      featuredGrid.innerHTML = `<div style="grid-column: span 3; text-align: center; color: var(--danger); font-size: 14px;">Failed to connect to backend server.</div>`;
      console.error(err);
    }
  }

  // Newsletter Event
  if (newsletterBtn && newsletterEmail) {
    newsletterBtn.addEventListener('click', () => {
      const email = newsletterEmail.value.trim();
      if (!email || !email.includes('@')) {
        showToast('Please enter a valid email address.', 'warning');
        return;
      }
      showToast('Thank you! You have subscribed to Zynero updates.', 'success');
      newsletterEmail.value = '';
    });
  }

  // Run initial featured load
  loadFeatured();
});
