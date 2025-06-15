addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

const urlMap = new Map();
const rateLimitStore = new Map();

/**
 * Generates base URL from request object
 * @param {Request} request - Cloudflare Workers request object
 * @returns {string} Fully qualified base URL
 */
function getBaseUrl(request) {
  const url = new URL(request.url);
  const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 
                   url.protocol.slice(0, -1) || 
                   'http';
  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || 
               request.headers.get('host') || 
               url.host;
  return `${protocol}://${host}`;
}

function generateNumericUID(segmentLength = 4, segments = 3) {
  let uid = '';
  for (let i = 0; i < segments; i++) {
    let segment = '';
    for (let j = 0; j < segmentLength; j++) {
      segment += Math.floor(Math.random() * 10);
    }
    uid += segment;
    if (i < segments - 1) uid += '-';
  }
  return uid;
}

async function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 100;
  
  let record = rateLimitStore.get(ip) || { count: 0, timestamp: now };
  
  if (now - record.timestamp > windowMs) {
    record = { count: 0, timestamp: now };
  }
  
  record.count++;
  rateLimitStore.set(ip, record);
  
  // Cleanup old entries
  if (rateLimitStore.size > 10000) {
    for (const [key, value] of rateLimitStore) {
      if (now - value.timestamp > windowMs) {
        rateLimitStore.delete(key);
      }
    }
  }
  
  return record.count > maxRequests;
}

function isValidHttpUrl(urlString) {
  try {
    const url = new URL(urlString);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

async function proxyRequest(request, targetUrl) {
  const newHeaders = new Headers(request.headers);
  newHeaders.set('x-forwarded-host', request.headers.get('host') || new URL(targetUrl).host);
  newHeaders.set('x-forwarded-for', request.headers.get('cf-connecting-ip') || 'unknown');
  newHeaders.delete('host');
  
  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: newHeaders,
      body: request.body,
      redirect: 'follow',
      cf: { cacheTtl: 0 }
    });
    
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    return newResponse;
  } catch (error) {
    return new Response(`Proxy error: ${error.message}`, { 
      status: 502,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

async function handleRequest(request) {
  try {
    // Basic security checks
    const userAgent = request.headers.get('user-agent') || '';
    if (/bot|crawler|spider/i.test(userAgent)) {
      return new Response('Access denied', { status: 403 });
    }
    
    const clientIP = request.headers.get('cf-connecting-ip') || 'unknown';
    if (await isRateLimited(clientIP)) {
      return new Response('Rate limit exceeded', { status: 429 });
    }
    
    if (!['GET', 'POST', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return new Response('Method not allowed', { 
        status: 405,
        headers: { 'Allow': 'GET, POST, HEAD, OPTIONS' }
      });
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Handle proxy creation
    if (url.pathname === '/proxy' && request.method === 'GET') {
      const target = url.searchParams.get('url');
      if (!target) {
        return new Response('Missing target URL parameter', { status: 400 });
      }
      
      if (!isValidHttpUrl(target)) {
        return new Response('Invalid target URL: Must be http or https', { status: 400 });
      }
      
      const uid = generateNumericUID();
      urlMap.set(uid, target);
      
      const proxyUrl = `${getBaseUrl(request)}/${uid}`;
      return new Response(JSON.stringify({ 
        status: 'success',
        proxy_url: proxyUrl,
        original_url: target,
        expires_at: Date.now() + 3600000 // 1 hour from now
      }), {
        status: 201,
        headers: { 
          'Content-Type': 'application/json', 
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store'
        }
      });
    }
    
    // Handle proxy requests
    if (pathParts.length === 1 && urlMap.has(pathParts[0])) {
      const targetUrl = urlMap.get(pathParts[0]);
      const target = new URL(targetUrl);
      
      // Append query parameters from the proxy request
      url.searchParams.forEach((value, key) => {
        target.searchParams.append(key, value);
      });
      
      return proxyRequest(request, target.toString());
    }
    
    // Default proxy for root path
    if (pathParts.length === 0) {
      const defaultTarget = 'https://haji-mix.up.railway.app' + url.pathname + url.search;
      return proxyRequest(request, defaultTarget);
    }
    
    // Not found handler
    return new Response('Not Found - Invalid proxy path', { 
      status: 404,
      headers: { 'Content-Type': 'text/plain' }
    });
    
  } catch (error) {
    return new Response(`Server Error: ${error.message}`, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}