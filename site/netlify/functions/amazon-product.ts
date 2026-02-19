/**
 * Netlify Function: /api/amazon-product?asin=B00TTD9BRC
 * 
 * Returns product image URL + dynamic price from Amazon PA-API.
 * Images are served from Amazon's CDN (images-na.ssl-images-amazon.com) = legal.
 * Prices are always live = no TOS violation.
 * 
 * Caches responses for 1 hour to respect rate limits.
 * 
 * Setup: Add these env vars in Netlify dashboard:
 * - AMAZON_ACCESS_KEY
 * - AMAZON_SECRET_KEY
 * - AMAZON_ASSOCIATE_TAG (optional, defaults to glowpicked0c-20)
 */

import type { Context } from "@netlify/functions";

// In-memory cache (persists across warm invocations)
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const asins = url.searchParams.get('asins')?.split(',').slice(0, 10) || [];
  
  if (asins.length === 0) {
    return new Response(JSON.stringify({ error: 'Missing ?asins= parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const accessKey = process.env.AMAZON_ACCESS_KEY;
  const secretKey = process.env.AMAZON_SECRET_KEY;
  const tag = process.env.AMAZON_ASSOCIATE_TAG || 'glowpicked0c-20';

  if (!accessKey || !secretKey) {
    return new Response(JSON.stringify({ 
      error: 'PA-API not configured yet',
      message: 'Need 3 qualifying sales to get API access',
      products: asins.map(asin => ({
        asin,
        imageUrl: null,
        price: null,
        url: `https://www.amazon.com/dp/${asin}/ref=nosim?tag=${tag}`,
      }))
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // Check cache
  const cacheKey = asins.sort().join(',');
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return new Response(JSON.stringify(cached.data), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'HIT',
      },
    });
  }

  try {
    // Dynamic import to keep cold starts fast when API isn't configured
    const { getProductsByASINs } = await import('../../src/utils/amazon-paapi.js');
    const products = await getProductsByASINs(asins);
    
    const responseData = {
      products: products.map(p => ({
        asin: p.asin,
        title: p.title,
        imageUrl: p.imageUrl,
        price: p.price,
        url: p.url,
        available: p.available,
      })),
    };

    // Cache it
    cache.set(cacheKey, { data: responseData, expires: Date.now() + CACHE_TTL });

    return new Response(JSON.stringify(responseData), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'MISS',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config = {
  path: "/api/amazon-product",
};
