#!/usr/bin/env python3
"""
Audit complet de toutes les pages reviews GlowPicked
Compare données hardcodées vs real-review-counts.json
"""

import json
import re
import os
from pathlib import Path

def extract_product_data(file_path):
    """Extract ASIN, rating, reviewCount from Astro file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Find all products with ASIN, rating, reviewCount patterns
        # Pattern for both JS and JSON format
        pattern1 = r'{\s*name:\s*["\']([^"\']+)["\']\s*,\s*asin:\s*["\']([A-Z0-9]+)["\']\s*,\s*rating:\s*([\d.]+)\s*,\s*reviewCount:\s*(\d+)'
        pattern2 = r'{\s*["\']name["\']\s*:\s*["\']([^"\']+)["\']\s*,\s*["\']asin["\']\s*:\s*["\']([A-Z0-9]+)["\']\s*,\s*["\']rating["\']\s*:\s*([\d.]+)\s*,\s*["\']reviewCount["\']\s*:\s*(\d+)'
        
        products = []
        matches1 = re.findall(pattern1, content, re.MULTILINE | re.DOTALL)
        matches2 = re.findall(pattern2, content, re.MULTILINE | re.DOTALL)
        
        all_matches = matches1 + matches2
        
        for match in all_matches:
            name, asin, rating, reviewCount = match
            products.append({
                'name': name.strip(),
                'asin': asin.strip(), 
                'rating': float(rating),
                'reviewCount': int(reviewCount),
                'file': os.path.basename(file_path)
            })
            
        return products
        
    except Exception as e:
        print(f"❌ Erreur lecture {file_path}: {e}")
        return []

def load_real_data():
    """Load real review data"""
    try:
        with open('/Users/alfred/.openclaw/workspace/projects/glowpicked/data/real-review-counts.json', 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Erreur lecture real data: {e}")
        return {}

def audit_all_pages():
    """Audit all review pages"""
    print("🔍 AUDIT COMPLET - TOUTES LES PAGES REVIEWS")
    print("=" * 80)
    
    # Load real data
    real_data = load_real_data()
    print(f"📊 Vraies données chargées: {len(real_data)} produits")
    print()
    
    # Find all review pages
    reviews_dir = Path('/Users/alfred/.openclaw/workspace/projects/glowpicked/site/src/pages/reviews')
    astro_files = list(reviews_dir.glob('*.astro'))
    astro_files = [f for f in astro_files if f.name != 'index.astro']  # Skip index
    
    all_errors = []
    total_products = 0
    
    for file_path in sorted(astro_files):
        print(f"📝 ANALYSE: {file_path.name}")
        print("-" * 60)
        
        products = extract_product_data(file_path)
        total_products += len(products)
        
        if not products:
            print("   ⚠️  Aucun produit trouvé (format non reconnu)")
            print()
            continue
            
        page_errors = []
        
        for product in products:
            asin = product['asin']
            site_rating = product['rating']
            site_reviews = product['reviewCount']
            name = product['name']
            
            # Get real data
            real = real_data.get(asin, {})
            if real is None:
                real = {}
            real_rating = real.get('rating', 'N/A') if real else 'N/A'
            real_reviews = real.get('reviews', 'N/A') if real else 'N/A'
            
            # Check for errors
            rating_error = False
            reviews_error = False
            
            if isinstance(real_rating, (int, float)):
                if abs(site_rating - real_rating) > 0.05:  # 0.05 tolerance
                    rating_error = True
            else:
                rating_error = True  # No real data available
                
            if isinstance(real_reviews, (int, float)):
                # Allow 10% tolerance or 1000 reviews, whichever is larger
                tolerance = max(real_reviews * 0.1, 1000)
                if abs(site_reviews - real_reviews) > tolerance:
                    reviews_error = True
            else:
                reviews_error = True  # No real data available
            
            status = "✅ OK"
            if rating_error or reviews_error:
                status = "❌ ERREUR"
                page_errors.append({
                    'asin': asin,
                    'name': name,
                    'file': file_path.name,
                    'site_rating': site_rating,
                    'real_rating': real_rating,
                    'site_reviews': site_reviews, 
                    'real_reviews': real_reviews,
                    'rating_error': rating_error,
                    'reviews_error': reviews_error
                })
            
            print(f"   {asin[:12]} | {name[:25]:<25} | {site_rating:>4} vs {real_rating:>4} | {site_reviews:>8,} vs {real_reviews:>8} | {status}")
        
        all_errors.extend(page_errors)
        print()
    
    # Summary
    print("📊 RÉSUMÉ AUDIT COMPLET")
    print("=" * 80)
    print(f"📄 Pages analysées: {len(astro_files)}")
    print(f"🛍️  Produits analysés: {total_products}")
    print(f"❌ Erreurs trouvées: {len(all_errors)}")
    print(f"✅ Précision: {((total_products - len(all_errors)) / total_products * 100):.1f}%")
    print()
    
    if all_errors:
        print("🚨 ERREURS DÉTAILLÉES:")
        print("-" * 80)
        for error in all_errors:
            print(f"📄 {error['file']}")
            print(f"   🛍️  {error['name']} ({error['asin']})")
            if error['rating_error']:
                print(f"   ⭐ Rating: {error['site_rating']} (site) vs {error['real_rating']} (réel)")
            if error['reviews_error']:
                print(f"   📊 Reviews: {error['site_reviews']:,} (site) vs {error['real_reviews']} (réel)")
            print()
    
    return all_errors, total_products

if __name__ == "__main__":
    audit_all_pages()