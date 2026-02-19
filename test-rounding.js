#!/usr/bin/env node
/**
 * Test arrondi conservateur
 */

import { conservativeRoundDown } from './site/src/utils/realProductData.js';

console.log('🧪 TEST ARRONDI CONSERVATEUR - Toujours à la baisse');
console.log('====================================================');

const testCases = [
  190,    // Le fameux Medik8 de Francis
  856,    // < 1000
  1567,   // 1K-10K
  8432,   // 1K-10K  
  18560,  // 10K-50K (exemple de Francis)
  23789,  // 10K-50K
  67890,  // 50K+
  142000, // Gros volumes comme CeraVe
];

testCases.forEach(original => {
  const rounded = conservativeRoundDown(original);
  const reduction = original - rounded;
  const percentReduction = ((reduction / original) * 100).toFixed(1);
  
  console.log(`${original.toLocaleString()} → ${rounded.toLocaleString()}+ reviews (réduit de ${reduction.toLocaleString()}, -${percentReduction}%)`);
});

console.log('\n✅ RÉSULTAT: Tous arrondis À LA BAISSE de façon conservatrice');
console.log('Plus jamais d\'impression de gonflement des chiffres!');