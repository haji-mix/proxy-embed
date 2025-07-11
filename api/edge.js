export default async function handler(request) {
  // Tagalog: Pinapasa ng Edge Function na ito ang lahat ng request sa external proxy server
  const url = new URL(request.url);
  // Tagalog: I-rewrite ang path para tanggalin ang leading slash
  const path = url.pathname.replace(/^\//, "");
  const targetUrl = `https://proxy.lkpanio25.workers.dev/${path}${url.search}`;

  // Tagalog: Kunin ang IP address mula sa headers (hindi lahat ng environment ay nagbibigay nito)
  const realIp = request.headers.get('x-forwarded-for') || '';

  // Tagalog: Kopyahin ang lahat ng headers maliban sa host
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
    // Tagalog: Ibalik ang response mula sa proxy
    return new Response(proxyResponse.body, {
      status: proxyResponse.status,
      statusText: proxyResponse.statusText,
      headers: proxyResponse.headers,
    });
  } catch (err) {
    // Tagalog: Error handling kapag pumalya ang proxy
    return new Response('Proxy error', { status: 500 });
  }
} 