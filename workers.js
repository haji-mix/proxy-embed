addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

const urlMap = new Map();
const rateLimitStore = new Map();

function getBaseUrl(request) {
  const url = new URL(request.url);
  const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || url.protocol.slice(0, -1) || 'https';
  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host') || url.host;
  return `${protocol}://${host}`;
}

function generateNumericUID() {
  return Array.from({length: 3}, () => Array.from({length: 4}, () => Math.floor(Math.random() * 10)).join('')).join('-');
}

async function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 100;
  let record = rateLimitStore.get(ip) || { count: 0, timestamp: now };
  if (now - record.timestamp > windowMs) record = { count: 0, timestamp: now };
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

async function proxyRequest(request, targetUrl) {
  try {
    const newHeaders = new Headers(request.headers);
    newHeaders.set('x-forwarded-host', new URL(targetUrl).host);
    newHeaders.set('x-forwarded-for', request.headers.get('cf-connecting-ip') || 'unknown');
    newHeaders.delete('host');
    const response = await fetch(targetUrl, {
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
    return new Response(`Proxy error: ${error.message}`, { status: 502 });
  }
}

async function handleRequest(request) {
  try {
    const userAgent = request.headers.get('user-agent') || '';
    if (/bot|crawler|spider/i.test(userAgent)) return new Response('Access denied', { status: 403 });
    
    const clientIP = request.headers.get('cf-connecting-ip') || 'unknown';
    if (await isRateLimited(clientIP)) return new Response('Rate limit exceeded', { status: 429 });
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    if (url.pathname === '/proxy' && request.method === 'GET') {
      const target = url.searchParams.get('url');
      if (!target) return new Response('Missing target URL', { status: 400 });
      if (!isValidHttpUrl(target)) return new Response('Invalid URL', { status: 400 });
      const uid = generateNumericUID();
      urlMap.set(uid, target.replace(/\/$/, ''));
      return new Response(JSON.stringify({ 
        proxy_url: `${getBaseUrl(request)}/${uid}`,
        original_url: target
      }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
    
    if (pathParts.length >= 1) {
      const uid = pathParts[0];
      if (urlMap.has(uid)) {
        const targetBase = urlMap.get(uid);
        const restOfPath = url.pathname.split('/').slice(2).join('/');
        const targetUrl = new URL(restOfPath + url.search, targetBase).toString();
        return proxyRequest(request, targetUrl);
      }
    }
    
    return proxyRequest(request, 'https://haji-mix.up.railway.app' + url.pathname + url.search);
    
  } catch (error) {
    return new Response(`Server Error: ${error.message}`, { status: 500 });
  }
}