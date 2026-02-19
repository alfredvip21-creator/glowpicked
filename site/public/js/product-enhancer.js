/**
 * GlowPicked Product Enhancer
 * 
 * Automatically fetches product images + live prices from PA-API
 * and injects them into product cards.
 * 
 * Gracefully degrades: if API not configured, cards stay as-is.
 * 
 * Usage: Add data-asin="B00TTD9BRC" to any product card element.
 * The script will inject an <img> and update price if available.
 */
(function() {
  'use strict';

  const cards = document.querySelectorAll('[data-asin]');
  if (cards.length === 0) return;

  const asins = Array.from(cards).map(c => c.getAttribute('data-asin')).filter(Boolean);
  if (asins.length === 0) return;

  // Batch fetch (max 10 per request)
  const batches = [];
  for (let i = 0; i < asins.length; i += 10) {
    batches.push(asins.slice(i, i + 10));
  }

  batches.forEach(function(batch) {
    fetch('/api/amazon-product?asins=' + batch.join(','))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.products) return;

        data.products.forEach(function(product) {
          if (!product.imageUrl) return;

          const card = document.querySelector('[data-asin="' + product.asin + '"]');
          if (!card) return;

          // Inject product image
          var imgContainer = card.querySelector('.product-image');
          if (!imgContainer) {
            imgContainer = document.createElement('div');
            imgContainer.className = 'product-image';
            imgContainer.style.cssText = 'text-align:center;margin-bottom:1rem;';
            card.insertBefore(imgContainer, card.firstChild);
          }

          var img = document.createElement('img');
          img.src = product.imageUrl;
          img.alt = product.title || 'Product image';
          img.loading = 'lazy';
          img.style.cssText = 'max-height:180px;border-radius:8px;';
          imgContainer.appendChild(img);

          // Update price if available
          if (product.price) {
            var priceEl = card.querySelector('.product-price');
            if (!priceEl) {
              priceEl = document.createElement('div');
              priceEl.className = 'product-price';
              priceEl.style.cssText = 'font-size:1.3rem;font-weight:700;color:#e91e63;text-align:center;margin:0.5rem 0;';
              var cta = card.querySelector('.cta-button');
              if (cta) card.insertBefore(priceEl, cta);
            }
            priceEl.textContent = product.price;
          }
        });
      })
      .catch(function() { /* Silently degrade */ });
  });
})();
