addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

const urlMap = new Map(); // Stores: { uid: { target: string, expiresAt: number|null } }
const rateLimitStore = new Map();

function parseDuration(durationStr) {
  if (!durationStr) return null;
  if (durationStr.toLowerCase() === 'never') return null;
  
  const match = durationStr.match(/^(\d+)\s*(sec|second|min|minute|hr|hour|day|week|month|year)s?$/i);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  const multipliers = {
    sec: 1000,
    second: 1000,
    min: 60 * 1000,
    minute: 60 * 1000,
    hr: 60 * 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000
  };

  return value * (multipliers[unit] || 0);
}

function getBaseUrl(request) {
  const url = new URL(request.url);
  const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 
                   url.protocol.slice(0, -1) || 'https';
  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || 
               request.headers.get('host') || url.host;
  return `${protocol}://${host}`;
}

function generateNumericUID() {
  return Array.from({length: 3}, () => 
    Array.from({length: 4}, () => Math.floor(Math.random() * 10)).join('')).join('-');
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
    
    target.pathname = originalUrl.pathname.replace(/^\/[^\/]+/, '') || '/';
    originalUrl.searchParams.forEach((value, key) => {
      target.searchParams.append(key, value);
    });

    const newHeaders = new Headers(request.headers);
    newHeaders.set('x-forwarded-host', target.host);
    newHeaders.set('x-forwarded-for', request.headers.get('cf-connecting-ip') || 'unknown');
    newHeaders.delete('host');
    
    newHeaders.set('x-proxy-request-url', request.url);
    newHeaders.set('x-proxy-target-url', target.toString());
    
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
    const userAgent = request.headers.get('user-agent') || '';
    if (/bot|crawler|spider/i.test(userAgent)) {
      return new Response('Access denied', { status: 403 });
    }
    
    const clientIP = request.headers.get('cf-connecting-ip') || 'unknown';
    if (await isRateLimited(clientIP)) {
      return new Response('DDOS SI TANGA!', { status: 403 });
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    if (url.pathname === '/proxy' && request.method === 'GET') {
      const target = url.searchParams.get('url');
      if (!target) return new Response('Missing target URL', { status: 400 });
      if (!isValidHttpUrl(target)) return new Response('Invalid URL', { status: 400 });
      
      const expiresParam = url.searchParams.get('expires') || '1 hour';
      const expiresMs = parseDuration(expiresParam);
      
      if (expiresMs === undefined) {
        return new Response('Invalid expiration format. Examples: "30 min", "2 hours", "1 week", "never"', {
          status: 400
        });
      }
      
      const uid = generateNumericUID();
      const expiresAt = expiresMs !== null ? Date.now() + expiresMs : null;
      
      urlMap.set(uid, {
        target: target.endsWith('/') ? target.slice(0, -1) : target,
        expiresAt
      });
      
      const now = Date.now();
      for (const [key, value] of urlMap) {
        if (value.expiresAt && value.expiresAt < now) {
          urlMap.delete(key);
        }
      }
      
      return new Response(JSON.stringify({ 
        status: 'success',
        proxy_url: `${getBaseUrl(request)}/${uid}`,
        original_url: target,
        expires_at: expiresAt,
        expires_human: expiresAt ? new Date(expiresAt).toISOString() : 'never',
        duration: expiresParam
      }), {
        status: 201,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store'
        }
      });
    }
    
    if (pathParts.length >= 1 && urlMap.has(pathParts[0])) {
      const proxyInfo = urlMap.get(pathParts[0]);

      if (proxyInfo.expiresAt && proxyInfo.expiresAt < Date.now()) {
        urlMap.delete(pathParts[0]);
        return new Response('Proxy link has expired', { status: 410 });
      }
      
      return proxyRequest(request, proxyInfo.target, request.url);
    }

    if (pathParts.length === 0) {
      return proxyRequest(request, 'https://haji-mix.up.railway.app', request.url);
    }
    
    return new Response('Not Found', { status: 404 });
    
  } catch (error) {
    return new Response(`Server Error: ${error.message}`, { status: 500 });
  }
}