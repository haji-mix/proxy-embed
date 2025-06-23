const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

app.use(
  '/',
  createProxyMiddleware({
    target: 'https://proxy.lkpanio25.workers.dev',
    changeOrigin: true,
    pathRewrite: { '^/': '' },
    onProxyReq: (proxyReq, req) => {
      const host = req.get('host') || 'localhost';
      proxyReq.setHeader('X-Forwarded-Host', host);
      // Append the real client IP to the X-Forwarded-For chain
      const existing = req.headers['x-forwarded-for'];
      const remote = req.connection.remoteAddress;
      const realIp = existing ? `${existing}, ${remote}` : remote;
      proxyReq.setHeader('X-Forwarded-For', realIp);
    },
    onError: (err, req, res) => {
      res.status(500).send('Proxy error');
    }
  })
);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Proxy server running on port ${port}`);
});