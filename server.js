// Unified PulseMesh server: serves static app + OTP API on one port.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { createOtpHandler } = require('./otp-server');

const PORT = Number(process.env.PORT || 8787);
const ROOT = __dirname;
const otpHandler = createOtpHandler();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const handled = await otpHandler(req, res);
  if (handled !== false) return;

  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const safePath = path.normalize(reqPath).replace(/^\.\.(\/|\\|$)/, '');
  const fullPath = path.join(ROOT, safePath);

  if (!fullPath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  sendFile(res, fullPath);
});

server.listen(PORT, () => {
  console.log(`PulseMesh server running at http://localhost:${PORT}`);
  console.log('Open the URL above; OTP and app are served from same origin.');
});
