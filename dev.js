addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
 
  url.hostname = 'haji-mix.up.railway.app'
  url.protocol = 'https:'
  
  const modifiedRequest = new Request(url.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: 'follow'
  })
  
  modifiedRequest.headers.set('Origin', 'https://haji-mix.up.railway.app')
  
  try {
    const response = await fetch(modifiedRequest)
    
    const modifiedResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers)
    })
    
    modifiedResponse.headers.set('Access-Control-Allow-Origin', '*')
    modifiedResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    modifiedResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type')
    
    return modifiedResponse
  } catch (error) {
    return new Response('Proxy Error: ' + error.message, { status: 500 })
  }
}