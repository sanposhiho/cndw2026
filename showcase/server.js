'use strict';
// スライドを配信するだけのサーバ。コメントは各ブラウザからコメントサーバへ直接取りに行く。
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

const PORT = Number(process.env.PORT || 8080);
const html = fs.readFileSync(path.join(__dirname, 'index.html'));
const compressed = zlib.gzipSync(html);
const etag = 'W/"' + crypto.createHash('sha256').update(html).digest('hex') + '"';

const server = http.createServer((req, res) => {
  const headers = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { ...headers, Allow: 'GET, HEAD' });
    res.end(); return;
  }
  let pathname;
  try { pathname = new URL(req.url, 'http://localhost').pathname; }
  catch { res.writeHead(400, headers); res.end(); return; }
  if (pathname === '/healthz') {
    res.writeHead(200, { ...headers, 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': 2, 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : 'ok'); return;
  }
  if (pathname !== '/' && pathname !== '/index.html') {
    res.writeHead(404, headers); res.end(); return;
  }
  const pageHeaders = { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', ETag: etag, Vary: 'Accept-Encoding' };
  // 読み直したときは更新を確認し、内容が同じならHTMLの再送を省く。
  if (String(req.headers['if-none-match'] || '').split(',').map(v => v.trim()).some(v => v === '*' || v.replace(/^W\//, '') === etag.slice(2))) {
    res.writeHead(304, pageHeaders); res.end(); return;
  }
  const gzip = String(req.headers['accept-encoding'] || '').split(',').some(value => {
    const [encoding, ...params] = value.trim().split(';');
    const q = params.map(p => p.trim()).find(p => /^q=/i.test(p));
    return encoding.toLowerCase() === 'gzip' && (!q || Number(q.slice(2)) > 0);
  });
  const body = gzip ? compressed : html;
  res.writeHead(200, { ...pageHeaders, 'Content-Length': body.length, ...(gzip ? { 'Content-Encoding': 'gzip' } : {}) });
  res.end(req.method === 'HEAD' ? undefined : body);
});

server.requestTimeout = 10000;
server.headersTimeout = 8000;
server.on('error', err => { console.error(err.message); process.exit(1); });
server.listen(PORT, () => console.log(`slides: listening on :${PORT} (${html.length} bytes)`));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
});
