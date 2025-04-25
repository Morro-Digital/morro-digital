const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();

app.use(
  "/api/directions",
  createProxyMiddleware({
    target: "https://api.openrouteservice.org/v2",
    changeOrigin: true,
    pathRewrite: {
      "^/api/directions": "/directions",
    },
    onProxyReq: (proxyReq, req, res) => {
      proxyReq.setHeader("Authorization", process.env.OPENROUTE_API_KEY);
    },
  })
);

app.listen(3000, () => {
  console.log("Proxy server running on port 3000");
});
