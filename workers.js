addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

const rateLimitStore = new Map();
const TURNSTILE_SITE_KEY = '0x4AAAAAABhzjcsq3RVnZwqK'; // TODO: Replace with your Turnstile site key
const TURNSTILE_SECRET_KEY = '0x4AAAAAABhzjUGConzDqwpi-6GIUnlVzek'; // TODO: Replace with your Turnstile secret key

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

function getCookie(request, name) {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return null;
  const match = cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(response, name, value, options = {}) {
  let cookie = `${name}=${encodeURIComponent(value)}`;
  if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;
  if (options.path) cookie += `; Path=${options.path}`;
  if (options.secure) cookie += '; Secure';
  if (options.httpOnly) cookie += '; HttpOnly';
  response.headers.append('Set-Cookie', cookie);
}

function captchaPage(siteKey) {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>CAPTCHA Challenge</title>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  </head>
  <body>
    <h2>Complete the CAPTCHA</h2>
    <form action="/captcha-verify" method="POST">
      <div class="cf-turnstile" data-sitekey="${siteKey}"></div>
      <button type="submit">Submit</button>
    </form>
  </body>
  </html>`;
}

async function verifyTurnstile(token, ip) {
  const formData = new URLSearchParams();
  formData.append('secret', TURNSTILE_SECRET_KEY);
  formData.append('response', token);
  if (ip) formData.append('remoteip', ip);
  const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const data = await resp.json();
  return data.success;
}

async function handleRequest(request) {
  try {
    const url = new URL(request.url);
    // CAPTCHA verification endpoint
    if (url.pathname === '/captcha-verify' && request.method === 'POST') {
      const form = await request.formData();
      const token = form.get('cf-turnstile-response');
      const clientIP = request.headers.get('cf-connecting-ip') || 'unknown';
      if (!token) {
        return new Response('Missing CAPTCHA token', { status: 400 });
      }
      const valid = await verifyTurnstile(token, clientIP);
      if (valid) {
        const resp = new Response('CAPTCHA passed! You may now access the site.', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        });
        setCookie(resp, 'cf_captcha_passed', '1', { maxAge: 3600, path: '/', secure: true });
        return resp;
      } else {
        return new Response('CAPTCHA failed. Try again.', { status: 403 });
      }
    }

    // Check for CAPTCHA cookie
    const captchaCookie = getCookie(request, 'cf_captcha_passed');
    if (!captchaCookie) {
      const userAgent = request.headers.get('user-agent') || '';
      if (!userAgent || /bot|crawler|spider/i.test(userAgent)) {
        return new Response(captchaPage(TURNSTILE_SITE_KEY), { status: 403, headers: { 'Content-Type': 'text/html' } });
      }
      const clientIP = request.headers.get('cf-connecting-ip') || 'unknown';
      if (await isRateLimited(clientIP)) {
        return new Response(captchaPage(TURNSTILE_SITE_KEY), { status: 403, headers: { 'Content-Type': 'text/html' } });
      }
    }

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