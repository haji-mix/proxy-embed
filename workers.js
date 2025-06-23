addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  try {
    const url = new URL(request.url);

    // Only allow GET and POST
    if (!['GET', 'POST'].includes(request.method)) {
      return new Response('Method not allowed', { status: 405 });
    }

    url.hostname = 'haji-mix.up.railway.app';
    url.protocol = 'https:';
    url.port = '443';
    const newHeaders = new Headers(request.headers);
    newHeaders.set('x-forwarded-host', request.headers.get('X-Forwarded-Host'));
    // Forward the real client IP
    const realIp = request.headers.get('cf-connecting-ip');
    if (realIp) {
      newHeaders.set('x-forwarded-for', realIp);
      newHeaders.set('cf-connecting-ip', realIp);
    }
    newHeaders.delete('host');
    const response = await fetch(url, {
      method: request.method,
      headers: newHeaders,
      body: request.body,
      cf: { cacheTtl: 0 }
    });

    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    return newResponse;

  } catch (error) {
    return new Response('Internal Server Error', { status: 500 });
  }
}