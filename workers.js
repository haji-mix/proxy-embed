addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

const urlMap = new Map();
const rateLimitStore = new Map();

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

function generateNumericUID() {
  return Array.from({length: 3}, () => 
    Array.from({length: 4}, () => Math.floor(Math.random() * 10)).join('')
  ).join('-');
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
  
  if (rateLimitStore.size > 10000) {
    for (const [key, value] of rateLimitStore) {
      if (now - value.timestamp > windowMs) rateLimitStore.delete(key);
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

async function proxyRequest(request, targetBaseUrl, requestUrl) {
  try {
    const target = new URL(targetBaseUrl);
    const originalUrl = new URL(requestUrl);
    
    // Preserve path and query parameters
    target.pathname = originalUrl.pathname;
    originalUrl.searchParams.forEach((value, key) => {
      target.searchParams.append(key, value);
    });
    
    const newHeaders = new Headers(request.headers);
    newHeaders.set('x-forwarded-host', target.host);
    newHeaders.set('x-forwarded-for', request.headers.get('cf-connecting-ip') || 'unknown');
    newHeaders.delete('host');
    
    const response = await fetch(target.toString(), {
      method: request.method,
      headers: newHeaders,
      body: request.body,
      redirect: 'follow'
    });
    
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Cache-Control', 'no-store');
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
    // Security checks
    const userAgent = request.headers.get('user-agent') || '';
    if (/bot|crawler|spider/i.test(userAgent)) {
      return new Response('Access denied', { status: 403 });
    }
    
    const clientIP = request.headers.get('cf-connecting-ip') || 'unknown';
    if (await isRateLimited(clientIP)) {
      return new Response('Rate limit exceeded', { status: 429 });
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    if (url.pathname === '/proxy' && request.method === 'GET') {
      const target = url.searchParams.get('url');
      if (!target) return new Response('Missing target URL', { status: 400 });
      if (!isValidHttpUrl(target)) return new Response('Invalid URL', { status: 400 });
      
      const uid = generateNumericUID();
      urlMap.set(uid, target.endsWith('/') ? target.slice(0, -1) : target);
      
      return new Response(JSON.stringify({ 
        proxy_url: `${getBaseUrl(request)}/${uid}`,
        original_url: target
      }), {
        status: 201,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    if (pathParts.length >= 1 && urlMap.has(pathParts[0])) {
      const targetBase = urlMap.get(pathParts[0]);
      return proxyRequest(request, targetBase, request.url);
    }
    
    if (pathParts.length === 0) {
      return proxyRequest(request, 'https://haji-mix.up.railway.app', request.url);
    }
    
    return new Response('Not Found', { status: 404 });
    
  } catch (error) {
    return new Response(`Server Error: ${error.message}`, { status: 500 });
  }
}