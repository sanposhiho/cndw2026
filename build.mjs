// 日本語版と英語版を、それぞれ単独で開けるHTMLにまとめる。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = dirname(fileURLToPath(import.meta.url));
const { values } = parseArgs({ options: { 'out-dir': { type: 'string' } } });
const out = values['out-dir'] ? resolve(values['out-dir']) : root;
mkdirSync(out, { recursive: true });
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
console.log(photo ? `写真を埋め込みました: ${photo}` : '写真なし: assets/avatar.png などを置くと埋め込みます（無い場合は表示時に GitHub から読みます）');
// コメント表示機能。URL が空ならコメント機能と投稿用QRコードを入れない。
// URL を変えたら tools/qr.py で対応するSVGも作り直す（README参照）。
const COMMENTS_URL = 'https://comments.showcase.cloudnativedays.jp';
const SLIDES_URL = 'https://sanposhiho.showcase.cloudnativedays.jp';

function buildDeck(lang) {
  const localize = (ja, en) => lang === 'en' ? en : ja;
  const filename = localize('index.html', 'en.html');
  const alternate = localize('en.html', 'index.html');
  const alternateLang = localize('en', 'ja');
  const title = localize('Kubernetes Schedulingの最前線から見る景色', 'A View from the Front Lines of Kubernetes Scheduling');
  const source = src(localize('slides.html', 'slides.en.html'));
  const slides = photo
    ? source.replace(/data-photo="[^"]*"/, `data-photo="data:${mime(photo)};base64,${readFileSync(photo).toString('base64')}"`)
    : source;
  const qrLink = (file, url, label, kind) =>
    `<a class="qr-card ${kind}" href="${url}/" target="_blank" rel="noopener noreferrer"><div class="qr" aria-hidden="true">${readFileSync(join(root, 'assets', file), 'utf8').trim()}</div><p><b>${label}</b><span>${url.replace(/^https?:\/\//, '')}</span></p></a>`;
  const qrBlock = `<div class="qr-links">${COMMENTS_URL ? qrLink('comments-qr.svg', COMMENTS_URL, localize('質問やコメントはこちら！', 'Questions and comments'), 'cmqr') : ''}${qrLink('slides-qr.svg', SLIDES_URL, localize('スライド資料はこちら！', 'Slides (Japanese)'), 'slides-qr')}</div>`;
  const slidesOut = slides.replace(/<!--qr-links-->/g, qrBlock);
  console.log(COMMENTS_URL ? `コメント: ${COMMENTS_URL}` : 'コメント: なし');

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="alternate" hreflang="${alternateLang}" href="${alternate}">
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

${COMMENTS_URL ? `<aside id="cm" aria-label="${localize('コメントバー', 'Comments bar')}">
  <span class="cm-label">${localize('コメント', 'Comments')}</span>
  <div id="cm-track" aria-hidden="true"></div>
</aside>\n` : ''}
<div id="ov"><h2>${localize('スライド一覧（選ぶと移動、Esc で閉じる）', 'Slide overview (select a slide, Esc to close)')}</h2><div class="grid" id="ov-grid"></div></div>
<div id="blank"></div>
${COMMENTS_URL ? `<div id="cl" role="dialog" aria-modal="true" aria-labelledby="cl-h"><div class="box">
  <h2 id="cl-h">${localize('コメント一覧', 'Comments')}</h2>
  <p>${localize('このブラウザでスライドを開いていたあいだに届いたコメントです（古い順）。開いていなかった間の分は、サーバの管理ページで見られます。', 'Comments received while this browser had the slides open, oldest first. For comments received at other times, see the server’s admin page.')}</p>
  <label class="chk"><input type="checkbox" id="cl-q"> ${localize('「？」を含むものだけ', 'Only comments with a question mark')}</label>
  <ol id="cl-list"></ol>
  <div class="row">
    <button type="button" data-act="copy">${localize('コピー', 'Copy')}</button>
    <button type="button" data-act="save">${localize('comments.txt を保存', 'Save comments.txt')}</button>
    <button type="button" data-act="clear">${localize('一覧を空にする', 'Clear list')}</button>
    <button type="button" data-act="close">${localize('閉じる', 'Close')}</button>
  </div>
  <p id="cl-msg" role="status"></p>
</div></div>
` : ''}<div id="help">${localize('→ / Space 次へ　← 戻る　O 一覧　F 全画面　R もう一度動かす　B 暗転', '→ / Space Next　← Back　O Overview　F Full screen　R Replay　B Blackout')}${COMMENTS_URL ? localize('　C コメント表示　L コメント一覧', '　C Comments　L Comment list') : ''}</div>
<div id="toast" role="status"></div>
<a id="b-lang" href="${alternate}" lang="${alternateLang}" hreflang="${alternateLang}" aria-label="${localize('Switch to English', '日本語版に切り替える')}">${localize('English', '日本語')}</a>
<div id="tools">
  <button type="button" id="b-prev">${localize('戻る', 'Back')}</button>
  <button type="button" id="b-next">${localize('次へ', 'Next')}</button>
  <button type="button" id="b-ov">${localize('一覧', 'Overview')}</button>
  <button type="button" id="b-full">${localize('全画面', 'Full screen')}</button>${COMMENTS_URL ? `\n  <button type="button" id="b-cm">${localize('コメント', 'Comments')}</button>` : ''}
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
  writeFileSync(join(out, filename), html);

  const slideCount = [...slides.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<section class="slide\b/g)].length;
  console.log('built', filename, slideCount, 'slides,', (Buffer.byteLength(html) / 1024).toFixed(0), 'KB');
}

for (const lang of ['ja', 'en']) buildDeck(lang);
