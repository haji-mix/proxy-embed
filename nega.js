const express = require('express');
const serverless = require('serverless-http');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Middleware to handle CORS (optional, if needed)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // Adjust for specific origins in production
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Proxy middleware configuration
app.use(
  '/',
  createProxyMiddleware({
    target: 'https://haji-mix.up.railway.app',
    changeOrigin: true,
    pathRewrite: { '^/': '' },
    // Handle errors during proxying
    onError: (err, req, res) => {
      console.error('Proxy error:', err);
      res.status(500).json({ error: 'Proxy error occurred' });
    },
    // Optional: Log proxy requests for debugging
    onProxyReq: (proxyReq, req, res) => {
      console.log(`Proxying request: ${req.method} ${req.url} -> ${proxyReq.getHeader('host')}${proxyReq.path}`);
    },
  })
);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Only run app.listen in non-serverless environments
if (process.env.NODE_ENV !== 'production' || !process.env.IS_SERVERLESS) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Proxy server running on port ${port}`);
  });
}

module.exports.handler = serverless(app);
