'use strict';
// コメントサーバ。聴衆のスマホから投稿を受け取り、発表中のスライドに渡す。
// 状態はメモリにだけ持つ。Pod が作り直されたら、コメントも停止の状態も消える。
// 外部のパッケージは使わない（Node の標準ライブラリだけ）。
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 8080);
// 管理用の合言葉の SHA-256（16進）。合言葉そのものはここにも YAML にも書かない。空なら管理の操作はできない
const ADMIN_SHA256 = String(process.env.ADMIN_SHA256 || '').trim().toLowerCase();
const MAX_LEN = 40;          // 1コメントの文字数
const MAX_NAME_LEN = 20;     // 任意の表示名の文字数（コメント本文とは別）
const KEEP = 1000;           // 覚えておく件数（管理ページの一覧で見返せる分）
const FRESH_MS = 15000;      // スライドに渡すのは、この時間より新しいものだけ（繋ぎ直したときに古いものを流さない）
const MIN_GAP_MS = 1500;     // 同じ人が続けて送れる間隔
const GLOBAL_PER_SEC = 5;    // 全体で1秒に受け付ける件数（スライドに流せる量に合わせる。超えた分は「混み合っています」と返す）
const BODY_MAX = 2048;

const page = name => fs.readFileSync(path.join(__dirname, name));
const PAGES = { '/': page('post.html'), '/admin': page('admin.html') };

let items = [];              // { id, t, name, quick, at }
let lastId = 0;
let paused = false;          // 止めている間は投稿を受け付けず、スライドにも渡さない
let epoch = Date.now();      // 変わったら、スライドは流れているコメントを全部消す
const seen = new Map();      // 投稿者ごとの最後の投稿時刻
let bucket = { sec: 0, n: 0 };
let stats = { ok: 0, rejected: 0 };

// 制御文字、改行、文字の向きを変える記号、見えない文字を取り除く（絵文字をつなぐ U+200D は残す）。
// 文字の上下に記号を積み上げて縦に伸ばすいたずらは、積み上げを2つまでにして防ぐ
const clean = s => String(s).normalize('NFC')
  .replace(/[\u0000-\u001f\u007f-\u009f\u200b\u200c\u200e\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, ' ')
  .replace(/(\p{M}{2})\p{M}+/gu, '$1')
  .replace(/\s+/g, ' ').trim();

const send = (res, code, body, headers = {}) => {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  res.writeHead(code, {
    'Content-Type': typeof body === 'string' || Buffer.isBuffer(body) ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Content-Length': buf.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers,
  });
  res.end(buf);
};
// スライドは別の場所（手元のファイルなど）から読みに来るので、読むだけの API は誰からでも読めるようにする
const CORS = { 'Access-Control-Allow-Origin': '*' };

const readJson = req => new Promise((resolve, reject) => {
  let size = 0; const chunks = [];
  // 大きすぎる本文は、覚えずに読み捨てる（接続は切らずに 400 を返す）
  req.on('data', c => { size += c.length; if (size <= BODY_MAX) chunks.push(c); });
  req.on('end', () => {
    if (size > BODY_MAX) return reject(new Error('too large'));
    try { const j = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('not an object'); resolve(j); }
    catch (e) { reject(e); }
  });
  req.on('error', reject);
});

const isAdmin = req => {
  if (!/^[0-9a-f]{64}$/.test(ADMIN_SHA256)) return false;
  const m = /^Bearer\s+(.{8,200})$/.exec(req.headers.authorization || '');
  if (!m) return false;
  const got = crypto.createHash('sha256').update(m[1]).digest();
  return crypto.timingSafeEqual(got, Buffer.from(ADMIN_SHA256, 'hex'));
};

const state = () => ({ paused, epoch, last: lastId });

async function handle(req, res) {
  let url;
  try { url = new URL(req.url, 'http://x'); } catch (e) { return send(res, 400, { error: 'bad_request' }); }
  const p = url.pathname;

  if (req.method === 'GET' && PAGES[p]) {
    return send(res, 200, PAGES[p], {
      'Content-Type': 'text/html; charset=utf-8', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src data:; base-uri 'none'; form-action 'none'",
    });
  }
  if (req.method === 'GET' && p === '/healthz') return send(res, 200, 'ok');
  if (req.method === 'GET' && p === '/api/state') return send(res, 200, state(), CORS);

  // スライドが1秒おきに読みに来る。since より後のコメントだけを返す。since がなければ「今から」
  if (req.method === 'GET' && p === '/api/poll') {
    const since = Number(url.searchParams.get('since'));
    const now = Date.now();
    // 管理ページ用：覚えている分を、止めている間も、古いものも含めて返す（since より後だけ）。投稿の時刻も付ける
    if (url.searchParams.get('all') === '1' && isAdmin(req)) {
      const from = Number.isFinite(since) && since > 0 ? since : 0;
      return send(res, 200, { ...state(), items: items.filter(c => c.id > from).map(c => ({ id: c.id, t: c.t, name: c.name, quick: c.quick, at: c.at })) });
    }
    let out = [];
    if (!paused && url.searchParams.has('since') && Number.isFinite(since) && since >= 0) out = items.filter(c => c.id > since && now - c.at < FRESH_MS).slice(-30);
    return send(res, 200, { ...state(), items: out.map(c => ({ id: c.id, t: c.t, name: c.name, quick: c.quick })) }, CORS);
  }

  if (req.method === 'POST' && p === '/api/comments') {
    if (paused) return send(res, 503, { error: 'paused' });
    let body;
    try { body = await readJson(req); } catch (e) { return send(res, 400, { error: 'bad_request' }); }
    if (typeof body.t !== 'string' || (body.name !== undefined && typeof body.name !== 'string')) return send(res, 400, { error: 'bad_request' });
    if (body.quick !== undefined && typeof body.quick !== 'boolean') return send(res, 400, { error: 'bad_request' });
    const t = clean(body.t);
    const name = clean(body.name || '');
    const quick = body.quick === true;
    const who = (typeof body.c === 'string' ? clean(body.c).slice(0, 64) : '') || 'anon';
    const len = [...t].length;
    if (!len) { stats.rejected++; return send(res, 400, { error: 'empty' }); }
    if (len > MAX_LEN) { stats.rejected++; return send(res, 400, { error: 'too_long', max: MAX_LEN }); }
    if ([...name].length > MAX_NAME_LEN) { stats.rejected++; return send(res, 400, { error: 'name_too_long', max: MAX_NAME_LEN }); }
    const now = Date.now();
    if (now - (seen.get(who) || 0) < MIN_GAP_MS) { stats.rejected++; return send(res, 429, { error: 'slow_down' }); }
    const sec = Math.floor(now / 1000);
    if (bucket.sec !== sec) bucket = { sec, n: 0 };
    if (bucket.n >= GLOBAL_PER_SEC) { stats.rejected++; return send(res, 429, { error: 'busy' }); }
    bucket.n++; seen.set(who, now);
    lastId = Math.max(lastId + 1, now);          // 時刻をもとにした番号。作り直されても番号が戻らない
    items.push({ id: lastId, t, name, quick, at: now });
    if (items.length > KEEP) items = items.slice(-KEEP);
    stats.ok++;
    return send(res, 200, { ok: true });
  }

  // 一括で止める／再開する。止めるとスライドに流れているコメントも消える
  if (req.method === 'POST' && p === '/api/admin') {
    // 間違いが続いても締め出さない。締め出すと、外から間違いを送り続けるだけで、止める操作を妨害できてしまう。
    // 合言葉は十分に長いランダムな文字列なので、総当たりでは当たらない
    const now = Date.now();
    if (!isAdmin(req)) return send(res, 401, { error: 'unauthorized' });
    let body;
    try { body = await readJson(req); } catch (e) { return send(res, 400, { error: 'bad_request' }); }
    if (body.action === 'pause') { paused = true; epoch = now; }
    else if (body.action === 'resume') { paused = false; }
    else if (body.action === 'clear') { epoch = now; items = []; }
    else if (body.action !== 'check') return send(res, 400, { error: 'unknown_action' });
    console.log(`admin: ${body.action} -> paused=${paused}`);
    return send(res, 200, state());
  }

  if (req.method === 'OPTIONS') return send(res, 204, '', { ...CORS, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '600' });
  return send(res, 404, { error: 'not_found' });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(e => { console.error('error:', e && e.message); if (!res.headersSent) send(res, 500, { error: 'internal' }); });
});
server.requestTimeout = 10000; server.headersTimeout = 8000; server.keepAliveTimeout = 65000;

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of seen) if (now - v > 60000) seen.delete(k);
  if (stats.ok || stats.rejected) { console.log(`comments: accepted=${stats.ok} rejected=${stats.rejected} paused=${paused}`); stats = { ok: 0, rejected: 0 }; }
}, 60000).unref();

// 想定外のエラーで落ちると、止めている状態まで消える。記録だけして動き続ける
process.on('uncaughtException', e => console.error('uncaught:', e && e.stack || e));
process.on('unhandledRejection', e => console.error('unhandled:', e && e.stack || e));

server.on('error', e => { console.error('listen failed:', e && e.message); process.exit(1); });   // 起動できないときは、作り直してもらう
server.listen(PORT, () => console.log(`comments: listening on :${PORT} admin=${/^[0-9a-f]{64}$/.test(ADMIN_SHA256) ? 'on' : 'off'}`));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); });
