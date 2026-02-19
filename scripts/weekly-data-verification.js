#!/usr/bin/env node
/**
 * 📊 GLOWPICKED - VÉRIFICATION HEBDOMADAIRE DES DONNÉES AMAZON
 * 
 * Script automatique pour maintenir la transparence et la vérité:
 * - Vérifie ratings et review counts sur Amazon chaque semaine
 * - Détecte les changements significatifs (±5% reviews, ±0.1 rating)  
 * - Met à jour automatiquement real-review-counts.json
 * - Génère rapport des changements pour commit
 * 
 * Usage: node weekly-data-verification.js
 * Cron: 0 9 * * 1 (chaque lundi 9h)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const BASE_DIR = '/Users/alfred/.openclaw/workspace/projects/glowpicked';
const ASINS_FILE = path.join(BASE_DIR, 'data/verified-asins-all.json');
const REAL_DATA_FILE = path.join(BASE_DIR, 'data/real-review-counts.json');
const REPORT_FILE = path.join(BASE_DIR, 'data/weekly-verification-report.md');

// Configuration pour éviter rate limiting
const DELAY_BETWEEN_REQUESTS = 2000; // 2 secondes entre requêtes
const MAX_RETRIES = 3;
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

/**
 * Pause execution for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get random user agent to avoid detection
 */
function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Scrape Amazon product data (rating + review count)
 * @param {string} asin - Amazon ASIN
 * @returns {Object|null} {rating: number, reviews: number} or null if failed
 */
async function scrapeAmazonData(asin) {
  const url = `https://www.amazon.com/dp/${asin}`;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🔍 Checking ${asin} (attempt ${attempt}/${MAX_RETRIES})...`);
      
      // Use curl with random user agent and headers
      const userAgent = getRandomUserAgent();
      const curlCommand = `curl -s -L \\
        -H "User-Agent: ${userAgent}" \\
        -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \\
        -H "Accept-Language: en-US,en;q=0.5" \\
        -H "Accept-Encoding: gzip, deflate" \\
        -H "Connection: keep-alive" \\
        -H "Cache-Control: no-cache" \\
        "${url}"`;
      
      const html = execSync(curlCommand, { encoding: 'utf8', timeout: 10000 });
      
      // Extract rating (multiple possible selectors)
      let rating = null;
      const ratingPatterns = [
        /"averageStarRating":[^}]*"value":([0-9.]+)/,
        /data-hook="average-star-rating"[^>]*>\\s*<span[^>]*>([0-9.]+)/,
        /<span[^>]*data-hook="rating-out-of-text"[^>]*>([0-9.]+)/,
        /averageStarRating.*?([0-9.]+)\\s*out\\s*of\\s*5/i
      ];
      
      for (const pattern of ratingPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          rating = parseFloat(match[1]);
          break;
        }
      }
      
      // Extract review count (multiple possible selectors)
      let reviewCount = null;
      const reviewPatterns = [
        /"totalReviewCount":([0-9,]+)/,
        /data-hook="total-review-count"[^>]*>([0-9,]+)/,
        /<span[^>]*data-hook="total-review-count"[^>]*>([0-9,]+)/,
        /([0-9,]+)\\s*global\\s*ratings?/i,
        /([0-9,]+)\\s*customer\\s*reviews?/i
      ];
      
      for (const pattern of reviewPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          reviewCount = parseInt(match[1].replace(/,/g, ''));
          break;
        }
      }
      
      // Validation
      if (rating && rating >= 1 && rating <= 5 && reviewCount && reviewCount > 0) {
        console.log(`✅ ${asin}: ${rating}⭐ (${reviewCount.toLocaleString()} reviews)`);
        return { rating, reviews: reviewCount };
      } else {
        console.log(`⚠️  ${asin}: Incomplete data (rating: ${rating}, reviews: ${reviewCount})`);
        if (attempt < MAX_RETRIES) {
          await sleep(DELAY_BETWEEN_REQUESTS * attempt); // Exponential backoff
          continue;
        }
        return null;
      }
      
    } catch (error) {
      console.log(`❌ ${asin} attempt ${attempt} failed:`, error.message);
      if (attempt < MAX_RETRIES) {
        await sleep(DELAY_BETWEEN_REQUESTS * attempt);
        continue;
      }
      return null;
    }
  }
  
  return null;
}

/**
 * Compare two data objects and detect significant changes
 */
function detectSignificantChanges(oldData, newData) {
  if (!oldData || !newData) return true;
  
  const reviewsDiff = Math.abs(oldData.reviews - newData.reviews) / oldData.reviews;
  const ratingDiff = Math.abs(oldData.rating - newData.rating);
  
  // Significant if: reviews changed by >5% OR rating changed by >0.1
  return reviewsDiff > 0.05 || ratingDiff > 0.1;
}

/**
 * Main verification function
 */
async function runWeeklyVerification() {
  console.log('🚀 GLOWPICKED - Weekly Data Verification Starting...');
  console.log('='.repeat(60));
  
  // Load current data
  const asinsData = JSON.parse(fs.readFileSync(ASINS_FILE, 'utf8'));
  const currentData = fs.existsSync(REAL_DATA_FILE) ? 
    JSON.parse(fs.readFileSync(REAL_DATA_FILE, 'utf8')) : {};
  
  // Extract all ASINs
  const allAsins = new Set();
  Object.values(asinsData.categories).forEach(category => {
    ['budget', 'luxury'].forEach(tier => {
      if (category[tier]) {
        category[tier].forEach(product => {
          allAsins.add(product.asin);
        });
      }
    });
  });
  
  console.log(`📊 Checking ${allAsins.size} products for data updates...\\n`);
  
  const updatedData = { ...currentData };
  const changes = [];
  const errors = [];
  let checkedCount = 0;
  let updatedCount = 0;
  
  // Process each ASIN
  for (const asin of allAsins) {
    checkedCount++;
    console.log(`[${checkedCount}/${allAsins.size}] Processing ${asin}...`);
    
    const newData = await scrapeAmazonData(asin);
    
    if (newData) {
      const oldData = currentData[asin];
      const hasSignificantChange = detectSignificantChanges(oldData, newData);
      
      if (!oldData || hasSignificantChange) {
        updatedData[asin] = newData;
        updatedCount++;
        
        const changeType = !oldData ? 'NEW' : 'UPDATED';
        const changeDetail = oldData ? 
          `${oldData.rating}⭐(${oldData.reviews}) → ${newData.rating}⭐(${newData.reviews})` :
          `${newData.rating}⭐(${newData.reviews})`;
        
        changes.push(`${changeType}: ${asin} - ${changeDetail}`);
        console.log(`🔄 ${asin}: ${changeDetail}`);
      } else {
        console.log(`✓ ${asin}: No significant change`);
      }
    } else {
      errors.push(`❌ Failed to fetch data for ${asin}`);
      console.log(`❌ ${asin}: Failed to fetch data`);
    }
    
    // Rate limiting
    if (checkedCount < allAsins.size) {
      await sleep(DELAY_BETWEEN_REQUESTS);
    }
  }
  
  // Generate report
  const timestamp = new Date().toISOString().split('T')[0];
  const report = `# Weekly Data Verification Report - ${timestamp}

## Summary
- **Products checked:** ${checkedCount}/${allAsins.size}
- **Products updated:** ${updatedCount}
- **Errors:** ${errors.length}

## Changes Detected
${changes.length > 0 ? changes.map(c => `- ${c}`).join('\\n') : '- No significant changes detected'}

## Errors
${errors.length > 0 ? errors.map(e => `- ${e}`).join('\\n') : '- No errors'}

## Next Steps
${changes.length > 0 ? 
  '- [ ] Review changes above\\n- [ ] Rebuild and deploy GlowPicked site\\n- [ ] Monitor for any rating/review anomalies' : 
  '- [x] All data verified and up-to-date\\n- [x] No action required'}
  
---
*Generated by weekly-data-verification.js on ${new Date().toISOString()}*
`;
  
  // Save updated data if changes were made
  if (updatedCount > 0) {
    fs.writeFileSync(REAL_DATA_FILE, JSON.stringify(updatedData, null, 2));
    console.log(`\\n✅ Updated ${REAL_DATA_FILE} with ${updatedCount} changes`);
  }
  
  // Save report
  fs.writeFileSync(REPORT_FILE, report);
  console.log(`📋 Report saved to ${REPORT_FILE}`);
  
  // Print summary
  console.log('\\n' + '='.repeat(60));
  console.log('🎯 VERIFICATION COMPLETE');
  console.log(`✅ Checked: ${checkedCount}/${allAsins.size} products`);
  console.log(`🔄 Updated: ${updatedCount} products`);
  console.log(`❌ Errors: ${errors.length} products`);
  
  if (changes.length > 0) {
    console.log('\\n📝 CHANGES DETECTED - Manual Review Recommended:');
    changes.forEach(change => console.log(`   ${change}`));
  }
  
  return {
    checked: checkedCount,
    updated: updatedCount,
    errors: errors.length,
    changes: changes.length
  };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runWeeklyVerification()
    .then(result => {
      if (result.errors > 0) {
        console.log('\\n⚠️  Some errors occurred during verification');
        process.exit(1);
      } else {
        console.log('\\n🎉 Weekly verification completed successfully!');
        process.exit(0);
      }
    })
    .catch(error => {
      console.error('\\n💥 Fatal error during verification:', error);
      process.exit(1);
    });
}

export { runWeeklyVerification };