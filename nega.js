const express = require('express');
const serverless = require('serverless-http');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

app.use(
  '/',
  createProxyMiddleware({
    target: 'https://haji-mix.up.railway.app',
    changeOrigin: true, 
    pathRewrite: { '^/': '' },
  })
);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Proxy server running on port ${port}`);
});

exports.handler = serverless(app);
