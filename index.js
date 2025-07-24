const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const http = require("http");

const app = express();

const primaryProxy = createProxyMiddleware({
  target: "https://proxy.lkpanio25.workers.dev",
  changeOrigin: true,
  pathRewrite: { "^/": "" },
  onProxyReq: (proxyReq, req) => {
    const realIp = req.ip;
    proxyReq.setHeader("X-Forwarded-For", realIp);
  },
  selfHandleResponse: true,
});

app.use(primaryProxy);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Proxy server running on port ${port}`);
});
