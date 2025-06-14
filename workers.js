addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  url.hostname = 'haji-mix.up.railway.app';
  url.port = '80'; // or '443' for HTTPS
  const response = await fetch(url, request);
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Access-Control-Allow-Origin', '*'); // Automates CORS
  return newResponse;
}
