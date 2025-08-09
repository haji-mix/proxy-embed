const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();

app.use(
  "/",
  createProxyMiddleware({
    target: "https://proxy.lkpanio25.workers.dev",
    changeOrigin: true,
    pathRewrite: { "^/": "" },
    onProxyReq: (proxyReq, req) => {
      const realIp = req.ip;
      proxyReq.setHeader("X-Forwarded-For", realIp);
    },
    onError: (err, req, res) => {
      res.status(500).send("Proxy error");
    },
  })
);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Proxy server running on port ${port}`);
});