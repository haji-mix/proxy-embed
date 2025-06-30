# proxy-embed

A simple reverse proxy server to hide your actual website URL. This project includes both an Express.js server and a Cloudflare Worker for flexible proxying.

## Features
- Hides your real backend URL from clients
- Adds forwarding headers (e.g., X-Forwarded-Host, X-Forwarded-For)
- Can be deployed on Vercel (Node.js) or Cloudflare Workers
- Allows CORS for all origins (Cloudflare Worker)

## How it Works
- **Express.js server** (`index.js`):
  - Acts as a reverse proxy using `http-proxy-middleware`.
  - Forwards all requests to a target URL (default: `https://proxy.lkpanio25.workers.dev`).
  - Adds headers to help identify the original client and host.
- **Cloudflare Worker** (`workers.js`):
  - Receives requests and forwards them to your real backend (default: `haji-mix.up.railway.app`).
  - Sets CORS headers to allow all origins.

## Quick Start (Local)

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Run the proxy server:**
   ```bash
   npm start
   ```
   The server will run on [http://localhost:3000](http://localhost:3000) by default.

3. **Change the target URL:**
   - Edit the `target` in `index.js` to your desired backend or worker URL.

## Deploy to Vercel

1. Make sure you have a Vercel account and the Vercel CLI installed.
2. Deploy with:
   ```bash
   vercel --prod
   ```
   - The `vercel.json` configures Vercel to use `index.js` as a serverless function.

## Connect Your Own Domain on Vercel

After deploying to Vercel, you can connect your own custom domain:

1. Go to your project dashboard on [Vercel](https://vercel.com/dashboard).
2. Select your project.
3. Click on the "Settings" tab, then go to the "Domains" section.
4. Click "Add" and enter your custom domain (e.g., `yourdomain.com`).
5. Follow the instructions to update your DNS records (usually adding a CNAME or A record pointing to Vercel).
6. Once DNS is set up, your proxy will be accessible via your custom domain.

For more details, see the [Vercel Custom Domains documentation](https://vercel.com/docs/concepts/projects/custom-domains).

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
- `index.js` - Express.js reverse proxy server (Node.js/Vercel)
- `workers.js` - Cloudflare Worker proxy script
- `package.json` - Project dependencies and scripts
- `vercel.json` - Vercel deployment config
- `wrangler.toml` - Cloudflare Worker config

## Example Use Case
You want to hide your real backend (e.g., Railway, Heroku, etc.) from the public. Deploy this proxy, point your frontend to it, and let it forward requests securely.

## Notes
- **Security:** This is a basic proxy. Add authentication, rate limiting, or logging as needed for production.
- **Customization:** Change the target URLs in `index.js` and `workers.js` to fit your needs.

## Author
Kenneth Panio
