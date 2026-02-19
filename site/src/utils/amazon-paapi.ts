/**
 * Amazon Product Advertising API 5.0 - GlowPicked Integration
 * 
 * Requirements:
 * 1. Amazon Associates account with 3+ qualifying sales in last 30 days
 * 2. PA-API credentials (Access Key + Secret Key)
 * 3. Associate Tag: glowpicked0c-20
 * 
 * Environment variables needed:
 * - AMAZON_ACCESS_KEY
 * - AMAZON_SECRET_KEY
 * - AMAZON_ASSOCIATE_TAG (default: glowpicked0c-20)
 * - AMAZON_REGION (default: us-east-1)
 * 
 * Usage:
 * const products = await getProductsByASINs(['B00TTD9BRC', 'B00NR1YQHM']);
 * // Returns: [{ asin, title, imageUrl, price, rating, url }]
 */

import crypto from 'crypto';

const HOST = 'webservices.amazon.com';
const REGION = process.env.AMAZON_REGION || 'us-east-1';
const SERVICE = 'ProductAdvertisingAPI';

interface PaapiProduct {
  asin: string;
  title: string;
  imageUrl: string;       // Amazon CDN URL (legal to display)
  imageLargeUrl: string;  // Larger image
  price: string;          // Dynamic price (always current = legal)
  currency: string;
  rating: number | null;
  totalReviews: number | null;
  url: string;            // Affiliate link with tag
  available: boolean;
}

// AWS Signature V4 signing
function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function getSignatureKey(key: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmacSha256(`AWS4${key}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

function signRequest(payload: string, accessKey: string, secretKey: string): Record<string, string> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  
  const canonicalUri = '/paapi5/getitems';
  const canonicalQuerystring = '';
  const contentType = 'application/json; charset=UTF-8';
  const target = 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems';
  
  const headers: Record<string, string> = {
    'content-encoding': 'amz-1.0',
    'content-type': contentType,
    'host': HOST,
    'x-amz-date': amzDate,
    'x-amz-target': target,
  };
  
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers).sort()
    .map(k => `${k}:${headers[k]}\n`).join('');
  
  const payloadHash = sha256(payload);
  const canonicalRequest = [
    'POST', canonicalUri, canonicalQuerystring,
    canonicalHeaders, signedHeaders, payloadHash
  ].join('\n');
  
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256', amzDate, credentialScope, sha256(canonicalRequest)
  ].join('\n');
  
  const signingKey = getSignatureKey(secretKey, dateStamp, REGION, SERVICE);
  const signature = hmacSha256(signingKey, stringToSign).toString('hex');
  
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  return {
    ...headers,
    'Authorization': authorization,
  };
}

/**
 * Fetch product data from Amazon PA-API 5.0
 * Batches in groups of 10 (API limit)
 */
export async function getProductsByASINs(asins: string[]): Promise<PaapiProduct[]> {
  const accessKey = process.env.AMAZON_ACCESS_KEY;
  const secretKey = process.env.AMAZON_SECRET_KEY;
  const tag = process.env.AMAZON_ASSOCIATE_TAG || 'glowpicked0c-20';
  
  if (!accessKey || !secretKey) {
    console.warn('[PA-API] Missing credentials. Set AMAZON_ACCESS_KEY and AMAZON_SECRET_KEY.');
    return asins.map(asin => ({
      asin,
      title: '',
      imageUrl: '',
      imageLargeUrl: '',
      price: '',
      currency: 'USD',
      rating: null,
      totalReviews: null,
      url: `https://www.amazon.com/dp/${asin}/ref=nosim?tag=${tag}`,
      available: false,
    }));
  }
  
  const results: PaapiProduct[] = [];
  
  // PA-API allows max 10 ASINs per request
  for (let i = 0; i < asins.length; i += 10) {
    const batch = asins.slice(i, i + 10);
    
    const payload = JSON.stringify({
      ItemIds: batch,
      Resources: [
        'Images.Primary.Large',
        'Images.Primary.Medium',
        'ItemInfo.Title',
        'Offers.Listings.Price',
        'Offers.Listings.Availability.Type',
        'CustomerReviews.Count',
        'CustomerReviews.StarRating',
      ],
      PartnerTag: tag,
      PartnerType: 'Associates',
      Marketplace: 'www.amazon.com',
    });
    
    const headers = signRequest(payload, accessKey, secretKey);
    
    try {
      const response = await fetch(`https://${HOST}/paapi5/getitems`, {
        method: 'POST',
        headers,
        body: payload,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[PA-API] Error ${response.status}: ${errorText}`);
        // Return placeholder for this batch
        batch.forEach(asin => results.push({
          asin, title: '', imageUrl: '', imageLargeUrl: '', price: '',
          currency: 'USD', rating: null, totalReviews: null,
          url: `https://www.amazon.com/dp/${asin}/ref=nosim?tag=${tag}`,
          available: false,
        }));
        continue;
      }
      
      const data = await response.json();
      
      if (data.ItemsResult?.Items) {
        for (const item of data.ItemsResult.Items) {
          const listing = item.Offers?.Listings?.[0];
          results.push({
            asin: item.ASIN,
            title: item.ItemInfo?.Title?.DisplayValue || '',
            imageUrl: item.Images?.Primary?.Medium?.URL || '',
            imageLargeUrl: item.Images?.Primary?.Large?.URL || '',
            price: listing?.Price?.DisplayAmount || '',
            currency: listing?.Price?.Currency || 'USD',
            rating: item.CustomerReviews?.StarRating?.Value ?? null,
            totalReviews: item.CustomerReviews?.Count ?? null,
            url: `https://www.amazon.com/dp/${item.ASIN}/ref=nosim?tag=${tag}`,
            available: listing?.Availability?.Type === 'Now',
          });
        }
      }
      
      // Respect rate limits (1 req/sec for new accounts)
      if (i + 10 < asins.length) {
        await new Promise(r => setTimeout(r, 1100));
      }
    } catch (err) {
      console.error(`[PA-API] Fetch error:`, err);
      batch.forEach(asin => results.push({
        asin, title: '', imageUrl: '', imageLargeUrl: '', price: '',
        currency: 'USD', rating: null, totalReviews: null,
        url: `https://www.amazon.com/dp/${asin}/ref=nosim?tag=${tag}`,
        available: false,
      }));
    }
  }
  
  return results;
}

/**
 * Convenience: get a single product
 */
export async function getProduct(asin: string): Promise<PaapiProduct> {
  const [product] = await getProductsByASINs([asin]);
  return product;
}

export type { PaapiProduct };
