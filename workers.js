addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

const rateLimitStore = new Map();

async function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
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

async function handleRequest(request) {
  try {
    const userAgent = request.headers.get('user-agent') || '';
    if (!userAgent || /bot|crawler|spider/i.test(userAgent)) {
      return new Response('Bot detected', { status: 403 });
    }
    const clientIP = request.headers.get('cf-connecting-ip') || 'unknown';
    if (await isRateLimited(clientIP)) {
      return new Response('Hina ng ddos mo tanga!', { status: 403 });
    }
    if (!['GET', 'POST'].includes(request.method)) {
      return new Response('Method not allowed', { status: 405 });
    }

    const url = new URL(request.url);

    url.hostname = 'haji-mix.up.railway.app';
    url.protocol = 'https:';
    url.port = '443';
    const newHeaders = new Headers(request.headers);
    newHeaders.set('x-forwarded-host', request.headers.get('X-Forwarded-Host'));
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