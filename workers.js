addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const clientIP = request.headers.get('cf-connecting-ip') || '';
  const newHeaders = new Headers(request.headers);
  newHeaders.set('x-forwarded-host', request.headers.get('X-Forwarded-Host'));
  newHeaders.set('cf-connecting-ip', clientIP);
  newHeaders.delete('host');

  async function tryFetch(hostname) {
    const url = new URL(request.url);
    url.hostname = hostname;
    url.protocol = 'https:';
    url.port = '443';
    const response = await fetch(url, {
      method: request.method,
      headers: newHeaders,
      body: request.body,
      cf: { cacheTtl: 0 }
    });
    return response;
  }

  try {
    let response = await tryFetch('haji-mix.up.railway.app');
    if (!response.ok) {
      response = await tryFetch('haji-mix-api.onrender.com');
    }
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    return newResponse;
  } catch (error) {
    try {
      const response = await tryFetch('haji-mix-api.onrender.com');
      const newResponse = new Response(response.body, response);
      newResponse.headers.set('Access-Control-Allow-Origin', '*');
      return newResponse;
    } catch (e) {
      return new Response('Internal Server Error', { status: 500 });
    }
  }
}