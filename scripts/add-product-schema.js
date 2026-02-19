#!/usr/bin/env node
/**
 * 🔍 GLOWPICKED - Add Product Schema for Better SEO
 * 
 * Ajoute le schema Product + Review sur les pages de catégories
 * pour améliorer la visibilité dans les résultats Google
 */

import fs from 'fs';
import path from 'path';

const SITE_DIR = '/Users/alfred/.openclaw/workspace/projects/glowpicked/site/src/pages/reviews';
const BASE_URL = 'https://glowpicked.com';

/**
 * Generate Product schema for a product
 */
function generateProductSchema(product, category) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "description": `${product.name} - Top-rated ${category.replace('-', ' ')} on Amazon`,
    "url": `${BASE_URL}/reviews/${category}/`,
    "image": `${BASE_URL}/images/${category}.jpg`,
    "brand": {
      "@type": "Brand", 
      "name": extractBrand(product.name)
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": product.rating,
      "bestRating": 5,
      "worstRating": 1,
      "ratingCount": product.reviewCount
    },
    "review": {
      "@type": "Review",
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": product.rating,
        "bestRating": 5
      },
      "author": {
        "@type": "Organization",
        "name": "GlowPicked"
      },
      "reviewBody": `Based on analysis of ${product.reviewCount.toLocaleString()}+ Amazon customer reviews, this ${category.replace('-', ' ')} offers excellent value and performance.`,
      "datePublished": "2026-02-16"
    },
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "url": `https://www.amazon.com/dp/${product.asin}/ref=nosim?tag=glowpicked0c-20`,
      "seller": {
        "@type": "Organization",
        "name": "Amazon"
      }
    }
  };
}

/**
 * Extract brand from product name
 */
function extractBrand(productName) {
  const commonBrands = [
    'CeraVe', 'Neutrogena', 'Olay', 'L\'Oréal', 'Maybelline', 'Revlon',
    'Clinique', 'Estée Lauder', 'Lancôme', 'Shiseido', 'SK-II', 'La Mer',
    'Tatcha', 'Drunk Elephant', 'The Ordinary', 'Paula\'s Choice', 'Embryolisse',
    'Augustinus Bader', 'Dr. Jart+', 'Medik8', 'EltaMD', 'Supergoop'
  ];
  
  for (const brand of commonBrands) {
    if (productName.toLowerCase().includes(brand.toLowerCase())) {
      return brand;
    }
  }
  
  // Fallback - use first word
  return productName.split(' ')[0];
}

/**
 * Add schema to an Astro page
 */
function addSchemaToPage(filePath, category) {
  console.log(`📄 Processing ${path.basename(filePath)}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Skip if already has Product schema
  if (content.includes('"@type": "Product"')) {
    console.log('   ✓ Already has Product schema');
    return false;
  }
  
  // Extract products from the file (simple regex parsing)
  const products = extractProductsFromFile(content, category);
  
  if (products.length === 0) {
    console.log('   ⚠️  No products found');
    return false;
  }
  
  // Generate schema for top products
  const schemas = products.slice(0, 3).map(product => 
    generateProductSchema(product, category)
  );
  
  // Find insertion point (after existing schema)
  const schemaInsertPoint = content.indexOf('</script>');
  if (schemaInsertPoint === -1) {
    console.log('   ❌ No existing schema found');
    return false;
  }
  
  // Add Product schemas
  const newSchemas = schemas.map(schema => 
    `    <script type="application/ld+json">\n    ${JSON.stringify(schema, null, 2).replace(/\n/g, '\n    ')}\n    </script>`
  ).join('\n');
  
  const updatedContent = content.replace(
    '</script>',
    `</script>\n    \n    <!-- Product Schema -->\n${newSchemas}`
  );
  
  fs.writeFileSync(filePath, updatedContent);
  console.log(`   ✅ Added ${schemas.length} Product schemas`);
  return true;
}

/**
 * Extract products from Astro file content
 */
function extractProductsFromFile(content, category) {
  const products = [];
  
  // Simple pattern matching for product data
  const productPattern = /"([^"]+)"[^}]*asin:\s*"([^"]+)"[^}]*rating:\s*([0-9.]+)[^}]*reviewCount:\s*([0-9]+)/g;
  
  let match;
  while ((match = productPattern.exec(content)) !== null) {
    products.push({
      name: match[1],
      asin: match[2], 
      rating: parseFloat(match[3]),
      reviewCount: parseInt(match[4])
    });
  }
  
  return products;
}

/**
 * Process all review pages
 */
function processAllPages() {
  console.log('🔍 Adding Product Schema to GlowPicked pages...\n');
  
  const reviewFiles = fs.readdirSync(SITE_DIR)
    .filter(file => file.endsWith('.astro') && !file.includes('-OLD'))
    .filter(file => file !== 'index.astro'); // Skip reviews index
    
  let processedCount = 0;
  
  reviewFiles.forEach(file => {
    const filePath = path.join(SITE_DIR, file);
    const category = file.replace('.astro', '');
    
    const wasUpdated = addSchemaToPage(filePath, category);
    if (wasUpdated) processedCount++;
  });
  
  console.log(`\n✅ Processing complete!`);
  console.log(`📊 Updated ${processedCount}/${reviewFiles.length} pages with Product schema`);
  console.log(`🔍 This will help Google understand our products better!`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  processAllPages();
}