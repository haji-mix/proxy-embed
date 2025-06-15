addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

const urlMap = new Map();

function generateUID() {
  return Array.from({length: 16}, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

async function handleRequest(request) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    if (pathParts[0] === 'proxy' && request.method === 'GET') {
      const target = url.searchParams.get('url');
      if (!target) return new Response('Missing target URL', {status: 400});
      
      const uid = generateUID();
      urlMap.set(uid, target);
      
      return new Response(JSON.stringify({
        proxy_url: `${url.origin}/${uid}`,
        original_url: target
      }), {
        headers: {'Content-Type': 'application/json'}
      });
    }

    if (pathParts.length > 0 && urlMap.has(pathParts[0])) {
      const target = new URL(urlMap.get(pathParts[0]));
      target.pathname = `${target.pathname}/${pathParts.slice(1).join('/')}`.replace(/\/+/g, '/');
      target.search = url.search;
      
      const headers = new Headers(request.headers);
      headers.set('x-forwarded-host', target.host);
      headers.delete('host');
      
      return fetch(target.toString(), {
        method: request.method,
        headers: headers,
        body: request.body,
        redirect: 'follow'
      });
    }

    return fetch(`https://haji-mix.up.railway.app${url.pathname}${url.search}`, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'follow'
    });

  } catch (error) {
    return new Response(`Server error: ${error.message}`, {status: 500});
  }
}