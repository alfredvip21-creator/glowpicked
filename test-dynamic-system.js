#!/usr/bin/env node
/**
 * TEST SYSTÈME DYNAMIQUE - Validation avant déploiement complet
 */

import { 
  loadRealProductData, 
  enrichProductWithRealData, 
  processProductsList, 
  generateGlobalStats,
  validateProduct 
} from './site/src/utils/realProductData.js';

console.log('🧪 TEST SYSTÈME DYNAMIQUE GLOWPICKED');
console.log('=====================================');

// Test 1: Chargement données réelles
console.log('\n1️⃣ CHARGEMENT DONNÉES RÉELLES:');
const realData = loadRealProductData();
const dataCount = Object.keys(realData).length;
console.log(`✅ ${dataCount} produits chargés`);

if (dataCount === 0) {
  console.log('❌ ERREUR: Aucune donnée chargée!');
  process.exit(1);
}

// Test 2: Stats globales
console.log('\n2️⃣ STATS GLOBALES:');
const stats = generateGlobalStats();
console.log(`📊 Total reviews: ${stats.totalReviews.toLocaleString()}`);
console.log(`🛍️  Total produits: ${stats.totalProducts}`);
console.log(`⭐ Rating moyen: ${stats.avgRating.toFixed(2)}`);
console.log(`✅ Produits vérifiés: ${stats.verifiedCount}`);

// Test 3: Enrichissement produits individuels
console.log('\n3️⃣ TEST ENRICHISSEMENT PRODUITS:');
const testProducts = [
  { name: "CeraVe Moisturizing Cream", asin: "B00TTD9BRC" },
  { name: "Neutrogena Hydro Boost", asin: "B00NR1YQHM" },
  { name: "Medik8 Total Moisture", asin: "B0D714LX6K" }, // Le problématique trouvé par Francis
];

testProducts.forEach(product => {
  const enriched = enrichProductWithRealData(product, realData, { rating: 4.0, reviewCount: 1000 });
  const validation = validateProduct(enriched);
  
  console.log(`\n   🧴 ${product.name} (${product.asin}):`);
  console.log(`   ⭐ Rating: ${enriched.rating} | Reviews: ${enriched.reviewCount.toLocaleString()}`);
  console.log(`   📊 Source: ${enriched.dataSource} | Verified: ${enriched.verified ? '✅' : '❌'}`);
  console.log(`   ✓ Validation: ${validation.valid ? 'PASS' : 'FAIL'} ${validation.issues.join(', ')}`);
});

// Test 4: Process liste complète (comme dans les pages Astro)
console.log('\n4️⃣ TEST PROCESS LISTE COMPLÈTE:');
const faceProducts = [
  { name: "CeraVe Moisturizing Cream", asin: "B00TTD9BRC", pros: ["Test"], con: "Test" },
  { name: "Neutrogena Hydro Boost", asin: "B00NR1YQHM", pros: ["Test"], con: "Test" },
  { name: "Medik8 Total Moisture", asin: "B0D714LX6K", pros: ["Test"], con: "Test" }
];

const fallbacks = {
  "B00TTD9BRC": { rating: 4.6, reviewCount: 140000 },
  "B00NR1YQHM": { rating: 4.5, reviewCount: 90000 },
  "B0D714LX6K": { rating: 4.6, reviewCount: 200 }
};

const processedProducts = processProductsList(faceProducts, fallbacks);
console.log(`✅ ${processedProducts.length} produits processés`);

// Vérification spéciale pour le produit problématique de Francis
const medik8 = processedProducts.find(p => p.asin === 'B0D714LX6K');
if (medik8) {
  console.log(`\n🎯 VÉRIFICATION SPÉCIALE - Produit testé par Francis:`);
  console.log(`   Medik8 (B0D714LX6K):`);
  console.log(`   ⭐ Rating: ${medik8.rating} (était 4.7 erroné)`);
  console.log(`   📊 Reviews: ${medik8.reviewCount.toLocaleString()} (était 1900 erronés)`);
  console.log(`   ✓ Source: ${medik8.dataSource}`);
  console.log(`   ✓ Verified: ${medik8.verified}`);
  
  if (medik8.rating === 4.6 && medik8.reviewCount < 1000) {
    console.log('   🎉 SUCCÈS: Données corrigées!');
  } else {
    console.log('   ⚠️  Données différentes des attentes');
  }
}

console.log('\n🏁 TEST TERMINÉ');
console.log('===============');

const verifiedCount = processedProducts.filter(p => p.verified).length;
const accuracy = (verifiedCount / processedProducts.length * 100).toFixed(1);
console.log(`✅ Précision système: ${accuracy}% (${verifiedCount}/${processedProducts.length} produits vérifiés)`);

if (accuracy >= 80) {
  console.log('🎉 SYSTÈME PRÊT POUR DÉPLOIEMENT!');
} else {
  console.log('⚠️  Système nécessite des améliorations avant déploiement');
}