export default async function handler(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\//, "");
  const targetUrl = `https://proxy.lkpanio25.workers.dev/${path}${url.search}`;

  const realIp = request.headers.get('x-forwarded-for') || '';

  const headers = new Headers(request.headers);
  headers.set('X-Forwarded-For', realIp);
  headers.delete('host');

  try {
    const proxyResponse = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'manual',
    });
    return new Response(proxyResponse.body, {
      status: proxyResponse.status,
      statusText: proxyResponse.statusText,
      headers: proxyResponse.headers,
    });
  } catch (err) {
    return new Response('Proxy error', { status: 500 });
  }
} 