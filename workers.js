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
    return fetch(url, {
      method: request.method,
      headers: newHeaders,
      body: request.body,
      cf: { cacheTtl: 0 }
    });
  }

  const fallbackStatus = [502, 503, 404];
  let response = await tryFetch('haji-mix.up.railway.app');
  if (fallbackStatus.includes(response.status)) {
    const fallbackResponse = await tryFetch('haji-mix-api.onrender.com');
    const resHeaders = new Headers(fallbackResponse.headers);
    resHeaders.set('Access-Control-Allow-Origin', '*');
    return new Response(await fallbackResponse.arrayBuffer(), {
      status: fallbackResponse.status,
      statusText: fallbackResponse.statusText,
      headers: resHeaders
    });
  }
  const resHeaders = new Headers(response.headers);
  resHeaders.set('Access-Control-Allow-Origin', '*');
  return new Response(await response.arrayBuffer(), {
    status: response.status,
    statusText: response.statusText,
    headers: resHeaders
  });
}