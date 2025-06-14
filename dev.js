addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request).catch(err => 
    new Response(`Proxy Error: ${err.message}`, { status: 500 })
  ));
});

async function handleRequest(request) {
  // Validate request
  if (!request.url) {
    return new Response('Invalid request URL', { status: 400 });
  }

  try {
    const url = new URL(request.url);
    
    // Modify URL
    url.hostname = 'haji-mix.up.railway.app';
    url.protocol = 'https:';

    // Create new request with modified URL
    const modifiedRequest = new Request(url.toString(), {
      method: request.method,
      headers: new Headers(request.headers),
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
      redirect: 'follow'
    });

    // Set Origin header
    modifiedRequest.headers.set('Origin', 'https://haji-mix.up.railway.app');

    // Fetch the response
    const response = await fetch(modifiedRequest);

    // Create new response with CORS headers
    const modifiedResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers)
    });

    // Set CORS headers
    modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');
    modifiedResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    modifiedResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return modifiedResponse;
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(`Proxy Error: ${error.message}`, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}
