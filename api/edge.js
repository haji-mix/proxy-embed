export default async function handler(request) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\//, "");
    const targetUrl = `https://proxy.lkpanio25.workers.dev/${path}${url.search}`;

    const realIp = request.headers.get('x-forwarded-for') || '';

    const headers = new Headers(request.headers);
    headers.set('X-Forwarded-For', realIp);
    headers.delete('host');
    headers.delete('Host');

    const proxyResponse = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'manual',
    });

    const responseHeaders = new Headers();
    proxyResponse.headers.forEach((value, key) => {
      if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return new Response(proxyResponse.body, {
      status: proxyResponse.status,
      statusText: proxyResponse.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error('Proxy error:', err);
    return new Response(`Proxy error: ${err.message}`, { 
      status: 500,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
  }
}