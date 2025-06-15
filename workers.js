addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

const urlMap = new Map();

function generateNumericUID() {
  return Array.from({length: 3}, () => 
    Array.from({length: 4}, () => Math.floor(Math.random() * 10)).join('')
  ).join('-');
}

async function proxyRequest(request, targetUrl) {
  try {
    const newHeaders = new Headers(request.headers);
    newHeaders.set('x-forwarded-host', new URL(targetUrl).host);
    newHeaders.delete('host');
    
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: newHeaders,
      body: request.body,
      redirect: 'follow'
    });
    
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    return newResponse;
  } catch (error) {
    return new Response(`Proxy error: ${error.message}`, { status: 502 });
  }
}

async function handleRequest(request) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    if (url.pathname === '/proxy' && request.method === 'GET') {
      const target = url.searchParams.get('url');
      if (!target) return new Response('Missing target URL', { status: 400 });
      
      const uid = generateNumericUID();
      urlMap.set(uid, target.replace(/\/$/, ''));
      
      return new Response(JSON.stringify({ 
        proxy_url: `${url.origin}/${uid}`,
        original_url: target
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (pathParts.length >= 1) {
      const uid = pathParts[0];
      if (urlMap.has(uid)) {
        const targetBase = urlMap.get(uid);
        const restPath = pathParts.slice(1).join('/');
        const targetUrl = `${targetBase}/${restPath}${url.search}`;
        return proxyRequest(request, targetUrl);
      }
    }
    
    return new Response('Not found', { status: 404 });
    
  } catch (error) {
    return new Response(`Server error: ${error.message}`, { status: 500 });
  }
}