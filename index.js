const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const http = require("http");

const app = express();

const PRIMARY_BACKEND = "https://proxy.lkpanio25.workers.dev";
const FALLBACK_BACKEND = "https://haji-mix-api.onrender.com";

const primaryProxy = createProxyMiddleware({
  target: PRIMARY_BACKEND,
  changeOrigin: true,
  pathRewrite: { "^/": "" },
  onProxyReq: (proxyReq, req) => {
    const realIp = req.ip;
    proxyReq.setHeader("X-Forwarded-For", realIp);
  },
  selfHandleResponse: true,
});

const fallbackProxy = createProxyMiddleware({
  target: FALLBACK_BACKEND,
  changeOrigin: true,
  pathRewrite: { "^/": "" },
  onProxyReq: (proxyReq, req) => {
    const realIp = req.ip;
    proxyReq.setHeader("X-Forwarded-For", realIp);
  },
});

app.use(async (req, res, next) => {
  primaryProxy(req, res, async (err) => {
    if (err || res.statusCode >= 400) {
      fallbackProxy(req, res, (fallbackErr) => {
        if (fallbackErr) {
          res.status(500).send("Proxy error (fallback failed)");
        }
      });
    }
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Proxy server running on port ${port}`);
});
