# proxy-embed

A simple reverse proxy server to hide your actual website URL. This project supports both Vercel Edge Functions (recommended for most users) and the classic Express.js server. Edge Functions provide better security, global distribution, and up to 30 seconds timeout even on the free plan, but the Express.js method is still available for flexibility.

## Features
- Hides your real backend URL from clients
- Adds forwarding headers (e.g., X-Forwarded-For)
- Can be deployed on Vercel Edge Functions, traditional Vercel serverless, or Cloudflare Workers
- Global CDN-like edge network for fast, distributed responses (Edge)
- Up to 30 seconds timeout on Vercel Edge (free plan)
- Classic Express.js server for local or custom hosting

## Which Method Should I Use?

| Use Case                        | Recommended Method         |
|---------------------------------|---------------------------|
| Fast, secure, global proxy      | **Vercel Edge Function**  |
| Need more than 10s timeout      | **Vercel Edge Function**  |
| Local development/testing       | **Express.js**            |
| Deploy to custom Node.js host   | **Express.js**            |
| Need full Node.js/npm support   | **Express.js**            |
| Deploy to Cloudflare Workers    | **Cloudflare Worker**     |

## Security & DDoS Protection

**proxy-embed** helps you defend your infrastructure and reduce your attack surface:

- **Hide Your Real Backend:**
  - Attackers cannot see or directly target your real backend server. All requests go through the proxy, keeping your infrastructure private.
- **Reduce Attack Surface:**
  - By exposing only the proxy, you limit what attackers can see and reach. This makes it harder for them to exploit vulnerabilities in your backend.
- **Leverage Edge Security:**
  - Deploying on Vercel Edge or Cloudflare Workers means you benefit from their built-in security, global distribution, and basic DDoS mitigation features.
- **Automatic Scaling & Isolation:**
  - Edge Functions are stateless and isolated per request, reducing risk of server compromise and making DDoS harder.
- **Add Your Own Protections:**
  - Easily extend the proxy with rate limiting, authentication, or IP filtering to further protect your services.

### Security Feature Comparison

| Feature                | Provided by proxy-embed? | Provided by Vercel Edge/Cloudflare? |
|------------------------|:-----------------------:|:-----------------------------------:|
| Hide backend URL       | ✔️                      | N/A                                 |
| DDoS protection        | ❌                      | ✔️ (Cloudflare), Basic (Vercel Edge) |
| Rate limiting          | ❌ (add yourself)       | ✔️ (Cloudflare), Basic (Vercel Edge) |
| IP blocking/filtering  | ❌ (add yourself)       | ✔️ (Cloudflare), Basic (Vercel Edge) |

> **Note:** While proxy-embed helps hide your backend and reduce risk, it does not provide full DDoS protection by itself. For strong DDoS defense, use Cloudflare Workers or put Cloudflare in front of your proxy, and consider adding rate limiting or other security features.

## How it Works
- **Vercel Edge Function** (`api/edge.js`):
  - Acts as a reverse proxy using the Fetch API (no Express required).
  - Forwards all requests to a target URL (default: `https://proxy.lkpanio25.workers.dev`).
  - Adds headers to help identify the original client.
  - Runs on Vercel's global edge network (CDN-like), with up to 30 seconds timeout.
- **Express.js server** (`index.js`):
  - Classic Node.js/Express reverse proxy using `http-proxy-middleware`.
  - Forwards all requests to a target URL (default: `https://proxy.lkpanio25.workers.dev`).
  - Adds headers to help identify the original client and host.
  - Can be run locally or deployed to any Node.js host (including Vercel, with 10s timeout on free plan).
- **Cloudflare Worker** (`workers.js`):
  - Receives requests and forwards them to your real backend (default: `haji-mix.up.railway.app`).
  - Sets CORS headers to allow all origins.

## Quick Start (Local - Express.js)

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Run the proxy server (Express):**
   ```bash
   npm start
   ```
   The server will run on [http://localhost:3000](http://localhost:3000) by default.

3. **Change the target URL:**
   - Edit the `target` in `index.js` to your desired backend or worker URL.

## Deploy to Vercel Edge Function (Recommended)

1. Make sure you have a Vercel account and the Vercel CLI installed.
2. Deploy with:
   ```bash
   vercel --prod
   ```
   - The `vercel.json` configures Vercel to use `api/edge.js` as an Edge Function with up to 30 seconds timeout.
   - Your proxy endpoint will be at `/api/edge`.

3. **(Optional) Connect Your Own Domain:**
   - Go to your project dashboard on [Vercel](https://vercel.com/dashboard).
   - Add your custom domain and follow the DNS instructions.

## Deploy to Vercel (Classic Serverless/Express)

1. Make sure you have a Vercel account and the Vercel CLI installed.
2. Edit `vercel.json` to use `index.js` as a serverless function (remove or comment out the Edge config).
3. Deploy with:
   ```bash
   vercel --prod
   ```
   - Note: On the free plan, serverless functions have a 10s timeout limit.

## Deploy to Cloudflare Workers

1. Install [Wrangler](https://developers.cloudflare.com/workers/wrangler/):
   ```bash
   npm install -g wrangler
   ```
2. Configure your `wrangler.toml` (edit name, bindings, etc. as needed).
3. Publish your worker:
   ```bash
   wrangler publish
   ```

## File Overview
- `api/edge.js` - Vercel Edge Function reverse proxy (Edge API, no Express)
- `index.js` - Express.js reverse proxy server (Node.js/local testing or classic Vercel serverless)
- `workers.js` - Cloudflare Worker proxy script
- `package.json` - Project dependencies and scripts
- `vercel.json` - Vercel deployment config
- `wrangler.toml` - Cloudflare Worker config

## Example Use Case
You want to hide your real backend (e.g., Railway, Heroku, etc.) from the public. Deploy this proxy, point your frontend to it, and let it forward requests securely.

## Notes
- **Security:** This is a basic proxy. Add authentication, rate limiting, or logging as needed for production.
- **Customization:** Change the target URLs in `api/edge.js`, `index.js`, and `workers.js` to fit your needs.

## Author
Kenneth Panio
