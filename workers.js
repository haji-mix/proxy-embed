addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

const urlMap = new Map(); // Stores: { uid: { target: string, expiresAt: number|null } }

function parseDuration(durationStr) {
  if (!durationStr || durationStr.toLowerCase() === 'never') return null;
  
  const match = durationStr.match(/^(\d+)\s*(sec|second|min|minute|hr|hour|day|week|month|year)s?$/i);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  const multipliers = {
    sec: 1000, second: 1000,
    min: 60 * 1000, minute: 60 * 1000,
    hr: 60 * 60 * 1000, hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000
  };

  return value * (multipliers[unit] || 0);
}

function getBaseUrl(request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function generateNumericUID() {
  return Array.from({length: 3}, () => 
    Array.from({length: 4}, () => Math.floor(Math.random() * 10)).join('')).join('-');
}

function isValidHttpUrl(urlString) {
  try {
    const url = new URL(urlString);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

async function proxyRequest(request, targetUrl, pathToAppend = '') {
  try {
    const target = new URL(targetUrl);
    
    // Handle path joining correctly
    if (pathToAppend) {
      const cleanPath = pathToAppend.startsWith('/') ? pathToAppend.slice(1) : pathToAppend;
      target.pathname = target.pathname.endsWith('/') 
        ? target.pathname + cleanPath
        : target.pathname + '/' + cleanPath;
    }

    // Preserve query parameters
    const requestUrl = new URL(request.url);
    requestUrl.searchParams.forEach((value, key) => {
      target.searchParams.set(key, value);
    });

    const newHeaders = new Headers(request.headers);
    newHeaders.set('x-forwarded-host', target.host);
    newHeaders.delete('host');
    
    const response = await fetch(target.toString(), {
      method: request.method,
      headers: newHeaders,
      body: request.method === 'GET' ? null : request.body,
      redirect: 'follow'
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
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Proxy creation endpoint
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
        target: target,
        expiresAt
      });
      
      // Cleanup expired entries
      const now = Date.now();
      for (const [key, value] of urlMap) {
        if (value.expiresAt && value.expiresAt < now) {
          urlMap.delete(key);
        }
      }
      
      return new Response(JSON.stringify({ 
        proxy_url: `${getBaseUrl(request)}/${uid}`,
        original_url: target,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : 'never'
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Handle proxy requests
    if (pathParts.length >= 1) {
      const uid = pathParts[0];
      if (urlMap.has(uid)) {
        const proxyInfo = urlMap.get(uid);
        
        // Check expiration
        if (proxyInfo.expiresAt && proxyInfo.expiresAt < Date.now()) {
          urlMap.delete(uid);
          return new Response('Proxy link expired', { status: 410 });
        }
        
        // Get the remaining path after the UID
        const remainingPath = pathParts.slice(1).join('/');
        return proxyRequest(request, proxyInfo.target, remainingPath);
      }
    }

    // Default proxy for root path
    if (pathParts.length === 0) {
      return proxyRequest(request, 'https://haji-mix.up.railway.app');
    }

    return new Response('Not Found', { status: 404 });
    
  } catch (error) {
    return new Response(`Server Error: ${error.message}`, { status: 500 });
  }
}