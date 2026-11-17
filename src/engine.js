/* =====================================================================
   スライドの進行と、図（シーン）を動かす小さなエンジン
   ・スライドは <section class="slide">。data-s="2" を付けた要素はステップ2で現れる
   ・図は SCENES に登録した定義（build と steps）から組み立てる
   ===================================================================== */
const SCENES = {};

class Scene {
  constructor(root, def) {
    this.root = root; this.def = def;
    this.el = {}; this.base = {}; this.geo = {}; this.anims = []; this.auto = 0; this.shown = null;
    def.build(this.builder(), this.geo);
    this.count = def.steps.length - 1;
  }

  /* 図の部品を置くための道具。座標は 1920×1080 の盤面上の px */
  builder() {
    const sc = this;
    const P = t => (typeof t === 'string' ? sc.geo[t] : t);
    const add = (id, cls, st, html) => {
      const e = document.createElement('div');
      e.className = 'sc ' + cls;
      if (html != null) { e.innerHTML = html; e._html = html; }
      sc.root.appendChild(e);
      id = id || '_' + sc.auto++;
      if (sc.el[id]) throw new Error('duplicate id: ' + id);
      sc.el[id] = e;
      sc.base[id] = Object.assign({ x: 0, y: 0, o: 1, s: 1, r: 0, cls: {}, html }, st);
      return id;
    };
    const seg = (id, a, b, cls) => {
      a = P(a); b = P(b);
      const dx = b[0] - a[0], dy = b[1] - a[1];
      return add(id, cls, { x: a[0], y: a[1], w: Math.hypot(dx, dy), r: Math.atan2(dy, dx) * 180 / Math.PI });
    };
    return {
      P,
      /* Nodeのトレイ。スロットの位置は "id:0", "id:1" … で参照できる */
      node(id, x, y, o = {}) {
        const cols = o.cols || 2, rows = o.rows || 1, T = o.tile || 76, G = o.gap || 14;
        const w = cols * T + (cols + 1) * G, h = rows * T + (rows + 1) * G;
        let slots = '';
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const sx = G + c * (T + G), sy = G + r * (T + G);
          slots += `<div class="slot" style="left:${sx - 3}px;top:${sy - 3}px;width:${T}px;height:${T}px;border-radius:${T > 60 ? 18 : 14}px"></div>`;
          sc.geo[id + ':' + (r * cols + c)] = [x + sx, y + sy];
        }
        add(id, 'tray', { x, y, w, h }, slots);
        if (o.label) add(id + '.l', 'tlabel', { x: x + 6, y: o.labelTop ? y - 38 : y + h + 12 }, o.label);
        sc.geo[id] = [x, y, w, h];
        return this;
      },
      pod(id, at, o = {}) {
        const p = P(at);
        add(id, 'pod ' + (o.c || 'a') + (o.cls ? ' ' + o.cls : ''), { x: p[0], y: p[1], o: o.hide ? 0 : 1 }, o.label == null ? '' : String(o.label));
        return this;
      },
      box(id, x, y, w, h, cls, html) { add(id, 'box ' + (cls || ''), { x, y, w, h }, html); return this; },
      band(id, x, y, w, h, cls, tag) { add(id, 'band ' + (cls || ''), { x, y, w, h }, tag ? `<span class="tag">${tag}</span>` : ''); return this; },
      text(id, x, y, html, cls, w) { add(id, 'txt ' + (cls || ''), { x, y, w }, html); return this; },
      chip(id, x, y, html, cls) { add(id, 'chip ' + (cls || ''), { x, y }, html); return this; },
      badge(id, x, y, kind) {
        const d = kind === 'ok' ? 'M5 12.6l4.6 4.6L19 7.4' : 'M6.5 6.5l11 11M17.5 6.5l-11 11';
        add(id, 'badge ' + kind, { x, y }, `<svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true"><path d="${d}" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
        return this;
      },
      score(id, x, y, w, html) { add(id, 'score', { x, y, w }, html); return this; },
      link(id, a, b, cls) { seg(id, a, b, 'link ' + (cls || '')); return this; },
      arrow(id, a, b) { seg(id, a, b, 'arrow'); return this; },
      hide(...ids) { ids.flat().forEach(id => { sc.base[id].o = 0; }); return this; },
    };
  }

  /* 1ステップ分の変化を書くための道具 */
  recorder(st, hints) {
    const sc = this;
    const P = t => (typeof t === 'string' ? sc.geo[t] : t);
    const S = id => { if (!st[id]) throw new Error('unknown id in scene: ' + id); return st[id]; };
    const H = (id, o) => { if (o) hints[id] = Object.assign(hints[id] || {}, o); };
    const each = (ids, fn) => [].concat(ids).forEach(fn);
    const api = {
      move(id, at, o) {
        const p = P(at); S(id).x = p[0]; S(id).y = p[1];
        if (o && o.via) o = Object.assign({}, o, { via: o.via.map(P) });
        H(id, o); return api;
      },
      show(ids, o) { each(ids, id => { S(id).o = 1; H(id, o); }); return api; },
      hide(ids, o) { each(ids, id => { S(id).o = 0; H(id, o); }); return api; },
      dim(ids, o) { each(ids, id => { S(id).o = 0.3; H(id, o); }); return api; },
      // o.at（ミリ秒）を付けると、そのクラスだけを遅らせて切り替える（移動の遅れは変えない）
      cls(ids, name, on = true, o) {
        each(ids, id => {
          S(id).cls[name] = on;
          if (o && o.at != null) { const h = hints[id] || (hints[id] = {}); (h.at || (h.at = {}))[name] = o.at; }
          else H(id, o);
        });
        return api;
      },
      set(id, props, o) { Object.assign(S(id), props); H(id, o); return api; },
      html(id, html) { S(id).html = html; return api; },
    };
    return api;
  }

  stateAt(k, extra) {
    const st = {};
    for (const id in this.base) st[id] = Object.assign({}, this.base[id], { cls: Object.assign({}, this.base[id].cls) });
    let hints = {};
    for (let i = 0; i <= k; i++) { hints = {}; this.def.steps[i](this.recorder(st, hints), this.geo); }
    if (extra) { hints = {}; extra(this.recorder(st, hints), this.geo); }
    return { st, hints };
  }

  paint(st, hints, animate) {
    this.anims.forEach(a => a.cancel()); this.anims = [];
    (this.timers || []).forEach(clearTimeout); this.timers = [];
    if (!animate) this.root.classList.add('no-anim');
    const tf = q => `translate(${q.x}px,${q.y}px) rotate(${q.r || 0}deg) scale(${q.s})`;
    for (const id in st) {
      const e = this.el[id], s = st[id], prev = this.shown && this.shown[id];
      const h = animate ? hints[id] || {} : {};
      e.style.setProperty('--dly', (h.delay || 0) + 'ms');
      e.style.setProperty('--dur', (h.dur || 720) + 'ms');
      e.style.transform = tf(s);
      e.style.opacity = s.o;
      if (s.w != null) e.style.width = s.w + 'px';
      if (s.h != null) e.style.height = s.h + 'px';
      const names = e._names || (e._names = new Set());   // 一度でも付けたクラスは覚えておき、戻るときに外す
      for (const c in s.cls) names.add(c);
      names.forEach(c => {
        const on = !!s.cls[c];
        // delay 付きのステップでは、見た目の切り替えも同じだけ遅らせる
        const d = h.at && h.at[c] != null ? h.at[c] : h.delay;
        // 待ってから切り替えるときは、色の変化（transition）まで二重に待たせない
        if (d && e.classList.contains(c) !== on) this.timers.push(setTimeout(() => { e.style.setProperty('--dly', '0ms'); e.classList.toggle(c, on); }, d));
        else e.classList.toggle(c, on);
      });
      if (s.html !== undefined && e._html !== s.html) { e.innerHTML = s.html; e._html = s.html; }
      if (animate && h.via && prev && e.animate) {
        const pts = [prev].concat(h.via.map(v => Object.assign({}, s, { x: v[0], y: v[1] })), [s]);
        e.classList.add('waapi');
        const a = e.animate(pts.map(q => ({ transform: tf(q) })),
          { duration: h.dur || 1300, delay: h.delay || 0, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'backwards' });
        a.onfinish = a.oncancel = () => e.classList.remove('waapi');
        this.anims.push(a);
      }
    }
    if (!animate) { void this.root.offsetWidth; this.root.classList.remove('no-anim'); }
    this.shown = st;
  }

  render(k, animate) { const r = this.stateAt(Math.min(k, this.count)); this.paint(r.st, k > this.count ? {} : r.hints, animate); }

  /* 全ステップを通して図が占める範囲を測り、スライドの空き（area）いっぱいに拡大して中央に置く */
  fit(area) {
    if (this.def.fit === false) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const grow = (ax, ay, bx, by) => { x0 = Math.min(x0, ax, bx); y0 = Math.min(y0, ay, by); x1 = Math.max(x1, ax, bx); y1 = Math.max(y1, ay, by); };
    for (let k = 0; k <= this.count; k++) {
      const st = this.stateAt(k).st;
      this.paint(st, {}, false);
      for (const id in st) {
        const s = st[id], e = this.el[id];
        if (!s.o) continue;
        const w = e.offsetWidth, h = e.offsetHeight;
        if (s.r) { const a = s.r * Math.PI / 180; grow(s.x, s.y, s.x + w * Math.cos(a), s.y + w * Math.sin(a)); continue; }
        grow(s.x, s.y, s.x + w, s.y + h);
        const tag = e.querySelector(':scope > .tag');
        if (tag) grow(s.x + 20, s.y - 26, s.x + 26 + tag.offsetWidth, s.y);
      }
    }
    const pad = 12; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    const aw = area.x1 - area.x0, ah = area.y1 - area.y0;
    const sc = Math.min(aw / (x1 - x0), ah / (y1 - y0), this.def.maxScale || 1.4);
    const tx = area.x0 + (aw - (x1 - x0) * sc) / 2 - x0 * sc;
    const ty = area.y0 + (ah - (y1 - y0) * sc) / 2 - y0 * sc;
    this.root.style.transformOrigin = '0 0';
    this.root.style.transform = `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${sc.toFixed(4)})`;
    this.scale = sc;
  }

  /* スライドに入った瞬間の「登場」。steps[0] が落ち着いた状態で、intro はその手前 */
  playIntro() {
    if (!this.def.intro) return;
    const pre = this.stateAt(0, this.def.intro);
    this.paint(pre.st, {}, false);
    clearTimeout(this.introTimer);
    this.introTimer = setTimeout(() => { const r = this.stateAt(0); this.paint(r.st, pre.hints, true); }, 380);
  }
}

const Deck = (() => {
  const W = 1920, H = 1080;
  const TRACK = ['Gang', 'Topology', 'Preemption', '階層'];   // 機能パートの現在地表示（スライドの data-track="2" など）
  let deck, slides = [], cur = 0, step = 0, started = false;
  let toolsTimer = null;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function fit() {
    const st = $('stage'), sw = st.clientWidth, sh = st.clientHeight;
    const s = Math.min(sw / W, sh / H);
    deck.style.transform = `translate(${(sw - W * s) / 2}px,${(sh - H * s) / 2}px) scale(${s})`;
  }

  function prepare(s) {
    const scEl = s.querySelector('.scene[data-scene]');
    if (scEl) {
      const def = SCENES[scEl.dataset.scene];
      if (def) s._scene = new Scene(scEl, def); else console.warn('scene not found:', scEl.dataset.scene);
      // 図に使える範囲。見出しの下から、下の一言（.cap）や進行バーの上まで。data-area="上,下" で上書きできる
      const a = (scEl.dataset.area || '').split(',').map(Number);
      s._area = {
        x0: 96, x1: 1824,
        y0: a[0] || (s.querySelector('.stages') ? 372 : s.querySelector('.hl small') ? 252 : 214),
        y1: a[1] || (s.querySelector('.cap, .agenda') ? 898 : 996),
      };
    }
    let n = s._scene ? s._scene.count : 0;
    const range = v => { const p = String(v).split('-').map(Number); return [p[0], p.length > 1 ? p[1] : Infinity]; };
    s._rev = Array.from(s.querySelectorAll('[data-s]')).map(e => { const r = range(e.dataset.s); n = Math.max(n, r[0]); return [e, r[0], r[1]]; });
    s._cur = Array.from(s.querySelectorAll('[data-cur]')).map(e => { const r = range(e.dataset.cur); if (r[1] === Infinity) r[1] = r[0]; n = Math.max(n, r[0]); return [e, r[0], r[1]]; });
    s._ons = [];
    s.querySelectorAll('[data-on]').forEach(e => e.dataset.on.split(';').forEach(p => {
      const m = p.trim().split(':'); const r = range(m[0]); n = Math.max(n, r[0]); s._ons.push([e, r[0], r[1], m[1]]);
    }));
    if (s.dataset.steps) n = Math.max(n, +s.dataset.steps);
    s._n = n;
  }

  function paint(s, k, animate) {
    if (!animate) s.classList.add('no-anim');
    s._rev.forEach(([e, a, b]) => e.classList.toggle('on', k >= a && k <= b));
    s._cur.forEach(([e, a, b]) => { e.classList.toggle('cur', k >= a && k <= b); e.classList.toggle('done', k > b); });
    s._ons.forEach(([e, a, b, c]) => e.classList.toggle(c, k >= a && k <= b));
    if (s._scene) s._scene.render(k, animate);
    if (!animate) { void s.offsetWidth; s.classList.remove('no-anim'); }
  }

  function show(n, k, how) {
    n = clamp(n, 0, slides.length - 1);
    const s = slides[n];
    k = clamp(k == null ? 0 : k, 0, s._n);
    if (n !== cur || !started) {
      slides[cur].classList.remove('active');
      s.classList.add('active');
      paint(s, k, false);
      if (how === 'fwd' && k === 0 && s._scene) s._scene.playIntro();
    } else {
      paint(s, k, how === 'fwd');
    }
    cur = n; step = k; started = true;
    deck.classList.toggle('is-cover', s.classList.contains('cover'));
    $('rail-part').textContent = s.dataset.part || '';
    $('rail-page').textContent = (n + 1) + ' / ' + slides.length;
    $('rail-bar').style.width = ((n + 1) / slides.length * 100) + '%';
    // いまどの機能の話か（data-track）と、このスライドの残りクリック数
    const tr = parseFloat(s.dataset.track);
    $('rail-track').innerHTML = isNaN(tr) ? '' : TRACK.map((name, i) =>
      `<span class="${i + 1 === tr ? 'cur' : i + 1 <= Math.floor(tr) ? 'done' : ''}">${name}</span>`).join('');
    $('rail-dots').innerHTML = s._n ? Array.from({ length: s._n }, (_, i) => `<i class="${i < k ? 'on' : ''}"></i>`).join('') : '';
    try { history.replaceState(null, '', '#p' + (n + 1)); } catch (e) { /* 埋め込み表示では使えないことがある */ }
  }
  const next = () => (step < slides[cur]._n ? show(cur, step + 1, 'fwd') : cur < slides.length - 1 && show(cur + 1, 0, 'fwd'));
  const prev = () => (step > 0 ? show(cur, step - 1, 'back') : cur > 0 && show(cur - 1, slides[cur - 1]._n, 'back'));

  /* いまのスライドの動きをもう一度見せる */
  function replay() {
    const s = slides[cur];
    if (step === 0) { if (s._scene) s._scene.playIntro(); return; }
    paint(s, step - 1, false); paint(s, step, true);
  }
  /* ---- KEP の数のグラフ（積み上げ棒） ----
     データは figure の data-kep に [リリース, 年, WAS, DRA, その他] の並びで持つ。凡例・目盛り・棒・表はここで組み立てる */
  function buildKepCharts() {
    const SER = [['w', 'WAS', 2], ['d', 'DRA', 3], ['o', 'その他', 4]], H = 460;   // 上から積む順。H は目盛りの上端までの高さ
    document.querySelectorAll('.kchart[data-kep]').forEach(fig => {
      let rows; try { rows = JSON.parse(fig.dataset.kep); } catch (e) { return; }
      const tot = r => r[2] + r[3] + r[4];
      const top = Math.ceil((Math.max(...rows.map(tot)) + 1) / 5) * 5, u = H / top;   // 目盛りは5刻み
      const years = []; rows.forEach(r => { const y = years[years.length - 1]; if (y && y[0] === r[1]) y[1]++; else years.push([r[1], 1]); });
      const nb = Math.min(+fig.dataset.base || 0, rows.length), base = rows.slice(0, nb);
      const avg = nb ? Math.round(base.reduce((a, r) => a + tot(r), 0) / nb) : 0;
      const last = rows.length - 1;
      const cols = rows.map((r, i) => {
        const segs = SER.filter(s => r[s[2]] > 0).map(s => `<i class="${s[0]}" style="--n:${r[s[2]]}"></i>`).join('');
        let ends = '';
        if (i === last) {   // 右端の棒にだけ、合計と内訳を直接書く。細すぎる区分には書かない（凡例と hover で読める）
          ends = `<div class="kcap klate">${tot(r)}</div>`;
          let below = 0;
          SER.slice().reverse().forEach(s => { const n = r[s[2]]; if (n * u >= 30) ends += `<div class="kend klate" style="--c:${below + n / 2}">${s[1]}<b>${n}</b></div>`; below += n; });
        }
        return `<div class="kcol" tabindex="0" style="--i:${i};--tot:${tot(r)}"><div class="kbar">${segs}</div>` +
          `<div class="ktip">${esc(r[0])}　${tot(r)}本（${SER.map(s => `${s[1]} ${r[s[2]]}`).join('／')}）</div>${ends}<div class="kver">${esc(r[0])}</div></div>`;
      }).join('');
      fig.setAttribute('role', 'group');
      fig.setAttribute('aria-label', 'SIG Scheduling が持つ KEP の数（リリースごと）');
      fig.innerHTML =
        `<div class="klegend"><span><i class="w"></i>Workload-aware Scheduling（WAS）</span><span><i class="d"></i>DRA</span><span><i class="o"></i>その他</span></div>` +
        `<div class="kplot" aria-hidden="true" style="--u:${u}px;--top:${top};--cols:${rows.length}">` +
          `<div class="kgrid">${Array.from({ length: top / 5 }, (_, i) => `<span data-t="${i * 5}" style="--t:${i * 5}"></span>`).join('')}</div>` +
          `<div class="kcols">${cols}</div>` +
          (nb ? `<div class="kbase klate" style="--k:${nb};--h:${Math.max(...base.map(tot))}"><span>平均 約${avg}本</span></div>` : '') +
          `<div class="kyears">${years.map(y => `<span style="--k:${y[1]}">${y[0]}年</span>`).join('')}</div>` +
        `</div>` +
        `<div class="sr-only"><table><caption>SIG Scheduling が持つ KEP の数（リリースごと）</caption><thead><tr><th>リリース</th><th>WAS</th><th>DRA</th><th>その他</th><th>合計</th></tr></thead><tbody>` +
          rows.map(r => `<tr><th>${esc(r[0])}（${r[1]}年）</th><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td><td>${tot(r)}</td></tr>`).join('') + `</tbody></table></div>`;
    });
  }

  /* ---- 一覧 ---- */
  function buildOverview() {
    $('ov-grid').innerHTML = slides.map((s, i) =>
      `<button type="button" data-i="${i}"><b>${i + 1}</b><span>${s.dataset.title || ''}<small>${s.dataset.part || ''}</small></span></button>`).join('');
    $('ov-grid').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      toggleOv(false); show(+b.dataset.i, 0, 'jump');
    });
  }
  function toggleOv(on) {
    const ov = $('ov'); on = on == null ? !ov.classList.contains('show') : on;
    ov.classList.toggle('show', on);
    if (on) { ov.querySelectorAll('button').forEach((b, i) => b.classList.toggle('cur', i === cur)); const c = ov.querySelector('button.cur'); if (c) c.focus(); }
  }

  function fullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else { const p = document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => {}); }
    } catch (e) { /* 埋め込み表示では使えないことがある */ }
  }

  function onKey(e) {
    // 文字を打っている間は、スライドの操作をしない（Esc で入力欄から出る）
    const tg = e.target, tag = tg && tg.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT') { if (e.key === 'Escape') { tg.blur(); e.preventDefault(); } return; }
    if ($('cl') && $('cl').classList.contains('show')) { if (e.key === 'Escape' || e.key === 'l' || e.key === 'L') { cmCloseList(); e.preventDefault(); } return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key, ovOpen = $('ov').classList.contains('show');
    if (ovOpen) { if (k === 'Escape' || k === 'o' || k === 'O') { toggleOv(false); e.preventDefault(); } return; }
    const map = {
      ArrowRight: next, PageDown: next, ' ': next, Enter: next,
      ArrowLeft: prev, PageUp: prev, Backspace: prev,
      ArrowDown: () => show(cur + 1, 0, 'jump'), ArrowUp: () => show(cur - 1, 0, 'jump'),
      Home: () => show(0, 0, 'jump'), End: () => show(slides.length - 1, 0, 'jump'),
      o: () => toggleOv(), Escape: () => toggleOv(),
      f: fullscreen,
      r: replay, c: cmToggle, l: cmOpenList,
      b: () => $('blank').classList.toggle('show'), '.': () => $('blank').classList.toggle('show'),
    };
    const fn = map[k] || map[k.toLowerCase()];
    if (fn) { fn(); e.preventDefault(); }
  }

  function wake() {
    $('tools').classList.add('show');
    clearTimeout(toolsTimer);
    toolsTimer = setTimeout(() => { $('tools').classList.remove('show'); $('help').classList.remove('show'); }, 2800);
  }

  /* ---------- コメント（会場からの投稿を、スライドの上に右から左へ流す） ----------
     <body data-comments="https://…"> のサーバを1秒おきに読みに行く。?comments=URL で差し替え、?comments=off で無効。
     サーバに繋がらないあいだは何も出さない（QRコードも出さない）。発表はそのまま続けられる。
     C キーで、流れているコメントとQRコードをまとめて消す／戻す。サーバ側で止められたときも消える */
  const CM = { url: '', on: true, live: false, paused: false, since: null, epoch: null, fail: 0, queue: [], lanes: [], lastLane: -1, count: 0, layer: null, log: [] };
  const CM_LANE = 74, CM_LANES = 8, CM_DUR = 7000, CM_MAX = 12, CM_GAP = 70, CM_QUEUE = 12;   // 待ちが長いと、話が進んだあとに遅れて出てしまうので、待たせる数は少なくする
  // 流す範囲は、見出しの下から下の一言の上まで（図に使っている範囲と同じ）。見出しと一言には重ねない
  function cmArea() {
    const a = slides[cur] && slides[cur]._area;
    const top = a ? a.y0 + 8 : 270, bottom = a ? a.y1 - 6 : 880;
    return { top, n: clamp(Math.floor((bottom - top) / CM_LANE), 1, CM_LANES) };
  }
  function cmPaint() {
    document.body.classList.toggle('cm-live', CM.on && CM.live && !CM.paused);
  }
  function cmClear() {
    CM.queue = []; CM.lanes = []; CM.lastLane = -1; CM.count = 0;
    if (CM.layer) CM.layer.textContent = '';
  }
  // 重ならずに流せる行からランダムに選ぶ。候補が複数あれば、直前と同じ行は避ける。置けなければ false
  function cmPlace(text) {
    const e = document.createElement('div'); e.className = 'c'; e.textContent = text; e.dataset.t = text;
    CM.layer.appendChild(e);
    const w = e.offsetWidth, now = performance.now(), speed = (W + w) / CM_DUR, area = cmArea();
    const available = [];
    for (let i = 0; i < area.n; i++) {
      const L = CM.lanes[i];
      if (L) {
        const entered = (now - L.t0) * L.speed >= L.w + CM_GAP;   // 前のコメントが、右端から入り切ったか
        const catches = now + W / speed < L.t0 + CM_DUR;           // 前のコメントが消える前に、追いついてしまうか
        if (!entered || catches) continue;
      }
      available.push(i);
    }
    if (!available.length) { e.remove(); return false; }
    const choices = available.length > 1 ? available.filter(i => i !== CM.lastLane) : available;
    const i = choices[Math.floor(Math.random() * choices.length)];
    CM.lastLane = i;
    CM.lanes[i] = { t0: now, w, speed };
    e.style.top = (area.top + i * CM_LANE) + 'px';
    CM.count++;
    const done = () => { if (e.parentNode) { e.remove(); CM.count = Math.max(0, CM.count - 1); cmPump(); } };
    if (e.animate) e.animate([{ transform: `translateX(${W}px)` }, { transform: `translateX(${-w}px)` }], { duration: CM_DUR, easing: 'linear', fill: 'forwards' }).onfinish = done;
    else setTimeout(done, 3000);
    return true;
  }
  function cmPump() {
    clearTimeout(CM.pump);
    while (CM.queue.length && CM.count < CM_MAX && cmPlace(CM.queue[0])) CM.queue.shift();
    if (CM.queue.length) CM.pump = setTimeout(cmPump, 250);
  }
  function cmAdd(text) {
    if (!CM.on || CM.paused || !CM.layer || typeof text !== 'string' || !text) return;
    CM.queue.push(text.slice(0, 80));
    if (CM.queue.length > CM_QUEUE) CM.queue.splice(0, CM.queue.length - CM_QUEUE);   // たまりすぎたら古いものから捨てる
    cmPump();
  }
  /* 受け取ったコメントの記録。流れて消えたあとも、一覧で見返せるようにする（質問を見逃さないため）。
     表示を消しているあいだ（C）に届いた分も記録する。このブラウザの中に残るので、開き直しても消えない。
     スライドを開いていなかった間の投稿は、ここには入らない（サーバの管理ページで見られる） */
  const CM_LS = 'cndw2026-comments-v1', CM_KEEP = 2000;
  const cmIsQ = t => /[?？]/.test(t);
  const hms = at => { const d = new Date(at), p = n => String(n).padStart(2, '0'); return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
  function cmLoadLog() {
    try { const a = JSON.parse(localStorage.getItem(CM_LS) || '[]'); if (Array.isArray(a)) CM.log = a.filter(c => c && typeof c.t === 'string' && Number.isFinite(c.at)).slice(-CM_KEEP); }
    catch (e) { /* 残せない表示では、開いているあいだだけ覚える */ }
  }
  function cmSaveLog() {
    clearTimeout(CM.saveT);
    CM.saveT = setTimeout(() => { try { localStorage.setItem(CM_LS, JSON.stringify(CM.log)); } catch (e) { /* 同上 */ } }, 300);
  }
  function cmLog(c) {
    if (!c || typeof c.t !== 'string' || !c.t) return false;
    const id = Number(c.id) || 0, last = CM.log.length ? CM.log[CM.log.length - 1].id : 0;
    if (id && id <= last) return false;   // 同じものを二度入れない
    CM.log.push({ id: id || Date.now(), t: c.t.slice(0, 80), at: Date.now(), n: cur + 1 });
    if (CM.log.length > CM_KEEP) CM.log.splice(0, CM.log.length - CM_KEEP);
    return true;
  }
  function cmListPaint() {
    if ($('cl') && $('cl').classList.contains('show')) cmDrawList(false);
  }
  /* コメント一覧（すべて、古い順）。L キーで開く。コピーと保存ができる */
  const clMsg = t => { $('cl-msg').textContent = t; };
  let clArmed = false;
  function clArm(on) { clArmed = on; $('cl').querySelector('[data-act="clear"]').textContent = on ? 'もう一度押すと、空にします' : '一覧を空にする'; }
  function cmShown() { return $('cl-q').checked ? CM.log.filter(c => cmIsQ(c.t)) : CM.log; }
  function cmDrawList(toEnd) {
    const ol = $('cl-list'), a = cmShown(), stick = toEnd || ol.scrollTop + ol.clientHeight >= ol.scrollHeight - 8;
    $('cl-h').textContent = `コメント一覧（${CM.log.length}件${$('cl-q').checked ? `、うち「？」を含むもの ${a.length}件` : ''}）`;
    ol.innerHTML = a.length ? a.map(c => `<li${cmIsQ(c.t) ? ' class="q"' : ''}><time>${hms(c.at)}</time><i>${c.n}枚目</i><span>${esc(c.t)}</span></li>`).join('')
      : '<li class="none">まだありません</li>';
    if (stick) ol.scrollTop = ol.scrollHeight;   // いちばん新しいものが見える位置に
  }
  const cmText = () => '時刻\tスライド\tコメント\n' + cmShown().map(c => `${hms(c.at)}\t${c.n}\t${c.t}`).join('\n') + '\n';
  function cmOpenList() {
    if (!CM.url) return;
    const cl = $('cl');
    if (cl.classList.contains('show')) return cmCloseList();
    clArm(false); clMsg(''); cl.classList.add('show'); cmDrawList(true);
    cl.querySelector('[data-act="close"]').focus();
  }
  function cmCloseList() { $('cl').classList.remove('show'); }
  function cmCopyList() {
    const text = cmText(), n = cmShown().length;
    const byHand = () => {
      const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;left:-999px;top:0';
      document.body.appendChild(t); t.select(); let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { /* 使えない表示 */ }
      t.remove(); clMsg(ok ? `${n}件をコピーしました。` : 'コピーできませんでした。「comments.txt を保存」を使ってください。');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => clMsg(`${n}件をコピーしました。`), byHand);
    else byHand();
  }
  function cmSaveList() {
    const data = cmText(), n = cmShown().length, fail = () => clMsg('保存できませんでした。「コピー」を使ってください。');
    if (!window.claude || typeof window.claude.use !== 'function') {
      try {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([data], { type: 'text/plain' })); a.download = 'comments.txt';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        clMsg(`${n}件を comments.txt に書き出しました。`);
      } catch (e) { fail(); }
      return;
    }
    Promise.resolve().then(() => window.claude.use('downloads')).then(d => {
      if (!d) return clMsg('この表示では保存できません。「コピー」を使ってください。');
      return d.save({ filename: 'comments.txt', data }).then(() => clMsg(`${n}件を comments.txt に保存しました。`), e => (e && e.code === 'declined' ? clMsg('保存をやめました。') : fail()));
    }).catch(fail);
  }
  function cmClearList() {
    if (!clArmed) return clArm(true);
    CM.log = []; cmSaveLog(); clArm(false); cmDrawList(true);
    clMsg('一覧を空にしました。');
  }

  async function cmPoll() {
    let wait = 1000;
    const ac = window.AbortController ? new AbortController() : null;
    const kill = setTimeout(() => { if (ac) ac.abort(); }, 4000);
    try {
      const r = await fetch(CM.url + '/api/poll' + (CM.since != null ? '?since=' + CM.since : ''), { cache: 'no-store', signal: ac ? ac.signal : undefined });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      CM.fail = 0; CM.live = true;
      if (CM.epoch != null && j.epoch !== CM.epoch) cmClear();   // 管理ページで止められた／消された
      CM.epoch = j.epoch; CM.paused = !!j.paused;
      if (CM.paused) cmClear();
      if (Number.isFinite(j.last)) CM.since = j.last;
      let got = 0;
      (j.items || []).forEach(c => { if (cmLog(c)) got++; cmAdd(c && c.t); });
      if (got) { cmSaveLog(); cmListPaint(); }
    } catch (e) {
      CM.fail++;
      if (CM.fail >= 3 && CM.live) { CM.live = false; cmClear(); }
      wait = Math.min(8000, 1000 * Math.pow(2, Math.min(CM.fail, 3)));   // 繋がらないときは間隔をあける（最長8秒）
    }
    clearTimeout(kill);
    cmPaint();
    setTimeout(cmPoll, wait);
  }
  function cmToggle() {
    if (!CM.url) return;
    CM.on = !CM.on;
    if (!CM.on) cmClear();
    cmPaint();
    toast(CM.on ? 'コメント表示 オン' : 'コメント表示 オフ');
  }
  function toast(text) {
    const t = $('toast'); if (!t) return;
    t.textContent = text; t.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('show'), 1600);
  }
  function initComments() {
    let url = document.body.dataset.comments || '';
    try { const q = new URLSearchParams(location.search).get('comments'); if (q != null) url = q; } catch (e) { /* そのまま */ }
    if (!url || url === 'off' || !/^https?:\/\//.test(url) || !window.fetch) return;
    CM.url = url.replace(/\/+$/, '');
    CM.layer = document.createElement('div'); CM.layer.id = 'cm'; CM.layer.setAttribute('aria-hidden', 'true');
    deck.appendChild(CM.layer);
    cmLoadLog();
    $('cl').addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) { if (e.target === $('cl')) cmCloseList(); return; }
      if (b.dataset.act !== 'clear') clArm(false);
      ({ copy: cmCopyList, save: cmSaveList, clear: cmClearList, close: cmCloseList })[b.dataset.act]();
    });
    $('cl-q').addEventListener('change', () => { cmDrawList(true); $('cl-q').blur(); });
    cmPaint(); cmListPaint();
    cmPoll();
  }

  function start() {
    deck = $('deck');
    buildKepCharts();
    slides = Array.from(deck.querySelectorAll('.slide'));
    slides.forEach(prepare);
    slides.forEach(s => paint(s, 0, false));
    const fitScenes = () => slides.forEach(s => {
      if (!s._scene || s._scene.def.fit === false) return;
      s._scene.fit(s._area);
      paint(s, s === slides[cur] ? step : 0, false);
    });
    fitScenes();
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', fitScenes);   // フォントが届いたら測り直す
    // 写真：読めたら頭文字の上に重ねる。読めなければ頭文字のまま
    document.querySelectorAll('img[data-photo]').forEach(img => {
      img.addEventListener('load', () => img.parentNode.classList.add('has-photo'));
      img.addEventListener('error', () => img.remove());
      img.src = img.dataset.photo;
    });
    buildOverview();
    initComments();
    fit();
    addEventListener('resize', fit);
    addEventListener('orientationchange', fit);
    if (window.ResizeObserver) new ResizeObserver(fit).observe($('stage'));
    addEventListener('keydown', onKey);

    // タップ / クリック：左4分の1で戻る、それ以外で進む。横スワイプでも移動
    let down = null;
    deck.addEventListener('pointerdown', e => { if (e.button === 0) down = { x: e.clientX, y: e.clientY }; });
    deck.addEventListener('pointerup', e => {
      if (!down || e.target.closest('a,button')) { down = null; return; }
      const dx = e.clientX - down.x, dy = e.clientY - down.y; down = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) return dx < 0 ? next() : prev();
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return e.clientX < $('stage').clientWidth * 0.25 ? prev() : next();
    });
    addEventListener('pointermove', wake);
    addEventListener('pointerdown', wake);
    $('blank').addEventListener('click', () => $('blank').classList.remove('show'));
    const btn = { 'b-prev': prev, 'b-next': next, 'b-ov': () => toggleOv(), 'b-full': fullscreen, 'b-cm': cmToggle };
    Object.keys(btn).forEach(id => { if ($(id)) $(id).addEventListener('click', e => { btn[id](); e.currentTarget.blur(); }); });

    // 印刷（PDF書き出し）のときは、全スライドを最終ステップにして並べる
    addEventListener('beforeprint', () => slides.forEach(s => paint(s, s._n, false)));
    addEventListener('afterprint', () => { slides.forEach(s => paint(s, 0, false)); paint(slides[cur], step, false); });

    const m = /^#p(\d+)$/.exec(location.hash);
    show(m ? +m[1] - 1 : 0, 0, 'jump');
    if (cur === 0 && slides[0]._scene) slides[0]._scene.playIntro();
    addEventListener('hashchange', () => { const h = /^#p(\d+)$/.exec(location.hash); if (h && +h[1] - 1 !== cur) show(+h[1] - 1, 0, 'jump'); });
    $('help').classList.add('show'); wake();
  }

  return { start, show, next, prev, get slides() { return slides; }, get pos() { return [cur, step]; } };
})();
