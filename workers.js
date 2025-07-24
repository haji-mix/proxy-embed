addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const clientIP = request.headers.get('cf-connecting-ip') || '';
  const newHeaders = new Headers(request.headers);
  const forwardedHost = request.headers.get('X-Forwarded-Host');
  if (forwardedHost) newHeaders.set('x-forwarded-host', forwardedHost);
  newHeaders.set('cf-connecting-ip', clientIP);
  newHeaders.delete('host');

  const body = request.body ? await request.arrayBuffer() : undefined;

  async function tryFetch(hostname) {
    const url = new URL(request.url);
    url.hostname = hostname;
    url.protocol = 'https:';
    url.port = '443';
    return fetch(url, {
      method: request.method,
      headers: newHeaders,
      body,
      cf: { cacheTtl: 0 }
    });
  }

  const fallbackStatus = [502, 503, 301];
  let response = await tryFetch('haji-mix.up.railway.app');
  if (fallbackStatus.includes(response.status)) {
    response = await tryFetch('haji-mix-api.onrender.com');
  }
  if (!fallbackStatus.includes(response.status)) {
    const resHeaders = new Headers(response.headers);
    resHeaders.set('Access-Control-Allow-Origin', '*');
    return new Response(await response.arrayBuffer(), {
      status: response.status,
      statusText: response.statusText,
      headers: resHeaders
    });
  }
  return new Response('Internal Server Error', { status: 500 });
}