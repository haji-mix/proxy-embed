addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

const urlMap = new Map();

/**
 * Generates base URL from request object (works with domains, IPs, proxies, and ports)
 * @param {Request} request - Cloudflare Workers request object
 * @returns {string} Fully qualified base URL (e.g., "https://example.com:8080")
 */
function getBaseUrl(request) {
  const url = new URL(request.url);
  const protocol =
    request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
    url.protocol.replace(':', '') ||
    'http';
  const host =
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    request.headers.get('host') ||
    url.host ||
    'localhost';
  const sanitizedHost = host.replace(/(:\d+)+$/, match => {
    const parts = match.split(':');
    return parts.length > 2 ? `:${parts.pop()}` : match;
  });
  return `${protocol}://${sanitizedHost}`;
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

const rateLimitStore = new Map();

async function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
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

/**
 * Validates if a URL is a valid HTTP/HTTPS URL
 * @param {string} urlString - URL to validate
 * @returns {boolean} True if valid, false otherwise
 */
function isValidHttpUrl(urlString) {
  try {
    const url = new URL(urlString);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

async function handleRequest(request) {
  try {
    const userAgent = request.headers.get('user-agent') || '';
    if (!userAgent || /bot|crawler|spider/i.test(userAgent)) {
      return new Response('Bot detected', { status: 403 });
    }
    const clientIP = request.headers.get('cf-connecting-ip') || 'unknown';
    if (await isRateLimited(clientIP)) {
      return new Response('Rate limit exceeded', { status: 429 });
    }
    if (!['GET', 'POST'].includes(request.method)) {
      return new Response('Method not allowed', { status: 405 });
    }

    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Endpoint to create a new tunnel via GET
    if (url.pathname === '/proxy' && request.method === 'GET') {
      const target = url.searchParams.get('url');
      if (!target) {
        return new Response('Missing target URL', { status: 400 });
      }
      if (!isValidHttpUrl(target)) {
        return new Response('Invalid target URL: Must be a valid HTTP/HTTPS URL', { status: 400 });
      }
      const uid = generateNumericUID();
      urlMap.set(uid, target);
      const baseUrl = getBaseUrl(request);
      return new Response(JSON.stringify({ proxy_url: `${baseUrl}/${uid}` }), {
        status: 201,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // If path is /<uid>, proxy to mapped URL
    if (pathParts.length === 1 && urlMap.has(pathParts[0])) {
      const targetUrl = urlMap.get(pathParts[0]);
      let target;
      try {
        target = new URL(targetUrl);
        target.search = url.search;
      } catch (error) {
        return new Response(`Invalid target URL stored for UID: ${error.message}`, { status: 400 });
      }
      const newHeaders = new Headers(request.headers);
      newHeaders.set('x-forwarded-host', request.headers.get('x-forwarded-host') || request.headers.get('host') || target.host);
      newHeaders.set('workers-proxy', 'true');
      // Remove headers that might interfere with the target server
      newHeaders.delete('host');
      try {
        const response = await fetch(target, {
          method: request.method,
          headers: newHeaders,
          body: request.body,
          cf: { cacheTtl: 0 }
        });
        if (!response.ok) {
          return new Response(`Error fetching from target server: ${response.status} ${response.statusText}`, { status: 502 });
        }
        const newResponse = new Response(response.body, response);
        newResponse.headers.set('Access-Control-Allow-Origin', '*');
        return newResponse;
      } catch (error) {
        return new Response(`Fetch error: ${error.message}`, { status: 502 });
      }
    }

    // Default: proxy to haji-mix
    url.hostname = 'haji-mix.up.railway.app';
    url.protocol = 'https:';
    url.port = '443';
    const newHeaders = new Headers(request.headers);
    newHeaders.set('x-forwarded-host', request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host);
    newHeaders.set('workers-proxy', 'true');
    newHeaders.delete('host');
    try {
      const response = await fetch(url, {
        method: request.method,
        headers: newHeaders,
        body: request.body,
        cf: { cacheTtl: 0 }
      });
      if (!response.ok) {
        return new Response(`Error fetching from default server: ${response.status} ${response.statusText}`, { status: 502 });
      }
      const newResponse = new Response(response.body, response);
      newResponse.headers.set('Access-Control-Allow-Origin', '*');
      return newResponse;
    } catch (error) {
      return new Response(`Fetch error to default server: ${error.message}`, { status: 502 });
    }

  } catch (error) {
    return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
  }
}