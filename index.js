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
      const host = req.get("host") || "localhost";
      proxyReq.setHeader("X-Forwarded-Host", host);
      // Get the real client IP, use the first IP if there are multiple in x-forwarded-for
      const forwardedFor = req.headers["x-forwarded-for"];
      const realIp = forwardedFor ? forwardedFor.split(",")[0].trim() : req.ip;
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
