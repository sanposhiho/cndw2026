// src/ のファイルとフォントを1つの index.html にまとめる
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = f => readFileSync(join(root, 'src', f), 'utf8');
const face = (family, file, weight) => {
  const b64 = readFileSync(join(root, 'fonts', file)).toString('base64');
  return `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2")}`;
};
const fonts = [
  face('IBM Plex Sans', 'ibm-plex-sans-latin-500-normal.woff2', 500),
  face('IBM Plex Sans', 'ibm-plex-sans-latin-600-normal.woff2', 600),
  face('IBM Plex Sans', 'ibm-plex-sans-latin-700-normal.woff2', 700),
  face('IBM Plex Mono', 'ibm-plex-mono-latin-500-normal.woff2', 500),
  face('IBM Plex Mono', 'ibm-plex-mono-latin-600-normal.woff2', 600),
].join('\n');

// 2枚目の写真：assets/avatar.(png|jpg|jpeg|webp) があれば埋め込む。無ければ表示時に GitHub から読む
const photo = ['png', 'jpg', 'jpeg', 'webp'].map(e => join(root, 'assets', 'avatar.' + e)).find(existsSync);
const mime = f => 'image/' + f.split('.').pop().replace('jpg', 'jpeg');
const slides = photo
  ? src('slides.html').replace(/data-photo="[^"]*"/, `data-photo="data:${mime(photo)};base64,${readFileSync(photo).toString('base64')}"`)
  : src('slides.html');
console.log(photo ? `写真を埋め込みました: ${photo}` : '写真なし: assets/avatar.png などを置くと埋め込みます（無い場合は表示時に GitHub から読みます）');
// コメントを流す機能。URL が空ならコメント機能と投稿用QRコードを入れない。
// URL を変えたら tools/qr.py で対応するSVGも作り直す（README参照）。
const COMMENTS_URL = 'https://comments.showcase.cloudnativedays.jp';
const SLIDES_URL = 'https://sanposhiho.showcase.cloudnativedays.jp';
const qrLink = (file, url, label, kind) =>
  `<a class="qr-card ${kind}" href="${url}/" target="_blank" rel="noopener noreferrer"><div class="qr">${readFileSync(join(root, 'assets', file), 'utf8').trim()}</div><p><b>${label}</b><span>${url.replace(/^https?:\/\//, '')}</span></p></a>`;
const qrBlock = `<div class="qr-links">${COMMENTS_URL ? qrLink('comments-qr.svg', COMMENTS_URL, '質問やコメントはこちら！', 'cmqr') : ''}${qrLink('slides-qr.svg', SLIDES_URL, 'スライド資料はこちら！', 'slides-qr')}</div>`;
const slidesOut = slides.replace(/<!--qr-links-->/g, qrBlock);
console.log(COMMENTS_URL ? `コメント: ${COMMENTS_URL}` : 'コメント: なし');

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kubernetes Schedulingの最前線から見る景色</title>
<style>
${src('deck.css')}</style>
</head>
<body${COMMENTS_URL ? ` data-comments="${COMMENTS_URL}"` : ''}>
<div id="stage">
<div id="deck">
${slidesOut}
  <div id="rail"><span class="part" id="rail-part"></span><span class="track" id="rail-track"></span><span class="dots" id="rail-dots"></span><span class="page" id="rail-page"></span><div class="bar"><i id="rail-bar"></i></div></div>
</div>
</div>

<div id="ov"><h2>スライド一覧（選ぶと移動、Esc で閉じる）</h2><div class="grid" id="ov-grid"></div></div>
<div id="blank"></div>
${COMMENTS_URL ? `<div id="cl" role="dialog" aria-modal="true" aria-labelledby="cl-h"><div class="box">
  <h2 id="cl-h">コメント一覧</h2>
  <p>このブラウザでスライドを開いていたあいだに届いたコメントです（古い順）。開いていなかった間の分は、サーバの管理ページで見られます。</p>
  <label class="chk"><input type="checkbox" id="cl-q"> 「？」を含むものだけ</label>
  <ol id="cl-list"></ol>
  <div class="row">
    <button type="button" data-act="copy">コピー</button>
    <button type="button" data-act="save">comments.txt を保存</button>
    <button type="button" data-act="clear">一覧を空にする</button>
    <button type="button" data-act="close">閉じる</button>
  </div>
  <p id="cl-msg" role="status"></p>
</div></div>
` : ''}<div id="help">→ / Space 次へ　← 戻る　O 一覧　F 全画面　R もう一度動かす　B 暗転${COMMENTS_URL ? '　C コメント表示　L コメント一覧' : ''}</div>
<div id="toast" role="status"></div>
<div id="tools">
  <button type="button" id="b-prev">戻る</button>
  <button type="button" id="b-next">次へ</button>
  <button type="button" id="b-ov">一覧</button>
  <button type="button" id="b-full">全画面</button>${COMMENTS_URL ? '\n  <button type="button" id="b-cm">コメント</button>' : ''}
</div>

<script>
${src('engine.js')}
${src('scenes.js')}
Deck.start();
</script>

<!-- 欧文フォント（IBM Plex Sans / Mono、SIL Open Font License）。オフラインでも同じ見た目になるよう埋め込み -->
<style>
${fonts}
</style>
</body>
</html>
`;
writeFileSync(join(root, 'index.html'), html);

const slideCount = [...slides.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<section class="slide\b/g)].length;
console.log('built', slideCount, 'slides,', (html.length / 1024).toFixed(0), 'KB');
