addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const clientIP = request.headers.get('cf-connecting-ip') || request.headers.get('X-Forwarded-Host') || '';
  const newHeaders = new Headers(request.headers);
  newHeaders.set('x-forwarded-host', clientIP);
  newHeaders.set('cf-connecting-ip', clientIP);
  newHeaders.delete('host');

  async function tryFetch(hostname) {
    const url = new URL(request.url);
    url.hostname = hostname;
    url.protocol = 'https:';
    url.port = '443';
    return fetch(url, {
      method: request.method,
      headers: newHeaders,
      body: request.body,
      cf: { cacheTtl: 0 }
    });
  }

  const response = await tryFetch('haji-mix.up.railway.app');
  const resHeaders = new Headers(response.headers);
  resHeaders.set('Access-Control-Allow-Origin', '*');
  return new Response(await response.arrayBuffer(), {
    status: response.status,
    statusText: response.statusText,
    headers: resHeaders
  });
}