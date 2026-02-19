#!/usr/bin/env node
/**
 * 🧪 TEST RAPIDE - Vérification de 3 produits populaires
 * 
 * Teste le système de vérification avec quelques ASINs pour s'assurer
 * que le scraping Amazon fonctionne correctement.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Test avec 3 produits populaires
const TEST_ASINS = [
  'B00TTD9BRC', // CeraVe Moisturizing Cream
  'B00NR1YQHM', // Neutrogena Hydro Boost
  'B01MSSDEPK'  // CeraVe Daily Facial Cleanser
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testScrapeAmazon(asin) {
  const url = `https://www.amazon.com/dp/${asin}`;
  
  try {
    console.log(`🧪 Testing ${asin}...`);
    
    const curlCommand = `curl -s -L \\
      -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \\
      -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \\
      "${url}"`;
    
    const html = execSync(curlCommand, { encoding: 'utf8', timeout: 15000 });
    
    // Test multiple rating extraction patterns
    console.log(`   📄 HTML length: ${html.length} chars`);
    
    // Look for rating patterns
    const ratingPatterns = [
      /"averageStarRating":[^}]*"value":([0-9.]+)/,
      /data-hook="average-star-rating"[^>]*>[^<]*<span[^>]*>([0-9.]+)/,
      /<span[^>]*data-hook="rating-out-of-text"[^>]*>([0-9.]+)/,
      /([0-9.]+)\\s*out\\s*of\\s*5\\s*stars/i
    ];
    
    let rating = null;
    for (let i = 0; i < ratingPatterns.length; i++) {
      const match = html.match(ratingPatterns[i]);
      if (match && match[1]) {
        rating = parseFloat(match[1]);
        console.log(`   ⭐ Rating found with pattern ${i+1}: ${rating}`);
        break;
      }
    }
    
    // Look for review count patterns  
    const reviewPatterns = [
      /"totalReviewCount":([0-9,]+)/,
      /data-hook="total-review-count"[^>]*>([0-9,]+)/,
      /([0-9,]+)\\s*global\\s*ratings/i,
      /([0-9,]+)\\s*customer\\s*reviews/i
    ];
    
    let reviewCount = null;
    for (let i = 0; i < reviewPatterns.length; i++) {
      const match = html.match(reviewPatterns[i]);
      if (match && match[1]) {
        reviewCount = parseInt(match[1].replace(/,/g, ''));
        console.log(`   📊 Reviews found with pattern ${i+1}: ${reviewCount.toLocaleString()}`);
        break;
      }
    }
    
    if (rating && reviewCount) {
      console.log(`   ✅ SUCCESS: ${asin} = ${rating}⭐ (${reviewCount.toLocaleString()} reviews)`);
      return { rating, reviews: reviewCount };
    } else {
      console.log(`   ❌ FAILED: ${asin} - rating: ${rating}, reviews: ${reviewCount}`);
      
      // Debug: look for any numbers that might be ratings/reviews
      const ratingNumbers = html.match(/[0-9.]+\\s*out\\s*of\\s*[0-9]/gi);
      const reviewNumbers = html.match(/[0-9,]+\\s*(customer|global)\\s*(review|rating)/gi);
      
      if (ratingNumbers) console.log(`   🔍 Found rating-like: ${ratingNumbers.slice(0,3)}`);
      if (reviewNumbers) console.log(`   🔍 Found review-like: ${reviewNumbers.slice(0,3)}`);
      
      return null;
    }
    
  } catch (error) {
    console.log(`   💥 ERROR: ${asin} - ${error.message}`);
    return null;
  }
}

async function runTest() {
  console.log('🧪 GLOWPICKED - Test de vérification des données Amazon');
  console.log('='.repeat(65));
  
  for (let i = 0; i < TEST_ASINS.length; i++) {
    const asin = TEST_ASINS[i];
    await testScrapeAmazon(asin);
    
    if (i < TEST_ASINS.length - 1) {
      console.log('   ⏳ Waiting 3 seconds...');
      await sleep(3000);
    }
  }
  
  console.log('\\n🎯 Test terminé!');
}

runTest().catch(console.error);