const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://192.168.0.2:8000',
      changeOrigin: true,
      ws: true,
      pathRewrite: { '^/api': '' }, // 이 줄!
    })
  );
};
