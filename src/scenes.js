/* =====================================================================
   図（シーン）の定義
   build(b)  : 部品を置く。b.node / b.pod / b.band / b.box / b.text / b.chip …
   steps[k]  : ステップ k で何が変わるか。steps[0] は最初の状態
   座標は図の中だけで意味を持つ px。図全体はスライドの空きに合わせて自動で拡大・中央寄せされる
   "n1:0" は Node n1 の 0 番スロットの位置
   Podに cls: 'act' を付けると、働いているかどうかのメーターが出る。t.cls(id, 'run') で動き出し、外すと止まる
   t.cls(id, 'run', true, { at: 1200 }) のように at を付けると、Podが着くのを待ってから切り替えられる
   ===================================================================== */
const T = 76, STEP = 90;                       // タイルの大きさと、横に並べるときの間隔
const row = (x, y, n, d = STEP) => Array.from({ length: n }, (_, i) => [x + i * d, y]);
const mid = p => [p[0] + T / 2, p[1] + T / 2];  // タイルの中心

/* ---------- 表紙：Podが1つずつ集まり、枠で束ねられる ---------- */
SCENES.title = {
  fit: false,
  build(b) {
    b.band('band', 1094, 742, 716, 180, '');
    row(1128, 776, 5, 134).forEach((p, i) => b.pod('t' + i, p, { cls: 'lg' }));
  },
  intro(t) {
    const from = [[980, 420], [1420, 300], [1700, 520], [1220, 560], [1560, 400]];
    from.forEach((p, i) => t.set('t' + i, { x: p[0], y: p[1], o: 0 }, { delay: i * 260, dur: 900 }));
    t.hide('band', { delay: 1700 });
  },
  steps: [() => {}],
};
SCENES.outro = SCENES.title;   // 最後のスライドで、表紙と同じ絵をもう一度

/* ---------- 今日の主題：Pod 1つ → まとまり ---------- */
SCENES.thesis = {
  build(b) {
    b.pod('one', [344, 372], { cls: 'lg' });
    b.text('l1', 170, 532, 'Pod scheduling', 'big center', 460);
    b.text('l1s', 170, 600, localize('Podを1つずつ見て、<br>どのNodeに置くか決める', 'Choose a node<br>for each Pod individually'), 'sub center', 460);
    b.arrow('ar', [650, 428], [810, 428]);
    b.band('band', 861, 364, 398, 128, '');
    row(887, 390, 4).forEach((p, i) => b.pod('g' + i, p));
    b.text('l2', 830, 532, 'Workload scheduling', 'big center', 460);
    b.text('l2s', 830, 600, localize('Podのまとまりを見て、<br>全員の置き場所をまとめて決める', 'Consider the group and<br>place all its Pods together'), 'sub center', 460);
    b.hide('ar', 'band', 'g0', 'g1', 'g2', 'g3', 'l2', 'l2s');
  },
  steps: [
    () => {},
    t => {
      t.show('ar');
      t.show(['g0', 'g1', 'g2', 'g3'], { delay: 250 });
      t.show(['band', 'l2', 'l2s'], { delay: 600 });
    },
  ],
};

/* ---------- Schedulerの仕事 ---------- */
SCENES.job = {
  build(b) {
    b.text('lp', 150, 440, localize('新しいPod', 'New Pod'), 'mid center', 276);
    b.pod('p', [250, 500]);
    b.chip('c', 166, 612, localize('nodeName: <span style="opacity:.55">未定</span>', 'nodeName: <span style="opacity:.55">unset</span>'), 'line');
    b.arrow('a1', [372, 538], [530, 538]);
    b.box('sch', 560, 398, 420, 280, 'ink',
      '<div style="padding:34px 38px"><div style="font:600 40px var(--font-code)">kube-scheduler</div>' +
      localize('<div style="font-size:28px;margin-top:8px;color:#B9C6E6;font-weight:500;white-space:nowrap">どのNodeに置くか決める</div></div>', '<div style="font-size:28px;margin-top:8px;color:#B9C6E6;font-weight:500;white-space:nowrap">Choose a node</div></div>'));
    b.arrow('a2', [1000, 538], [1090, 538]);
    b.node('n1', 1120, 300, { cols: 3, label: 'node-1' });
    b.node('n2', 1120, 500, { cols: 3, label: 'node-2' });
    b.node('n3', 1120, 700, { cols: 3, label: 'node-3' });
    ['n1:0', 'n1:1', 'n1:2', 'n2:0', 'n3:0', 'n3:1'].forEach(s => b.pod(null, s, { c: 'g' }));
  },
  steps: [
    () => {},
    t => t.move('p', [732, 570]),
    t => { t.move('p', 'n2:1'); t.cls('n2', 'hot'); t.cls('c', 'k8s').cls('c', 'line', false).html('c', 'nodeName: node-2'); },
  ],
};

/* ---------- Filter → Score → Bind ---------- */
SCENES.filter = {
  build(b) {
    const xs = [158, 466, 774, 1082], y = 600;
    b.pod('p', [724, 388]);
    b.text('lp', 822, 406, localize('このPodを置きたい', 'Pod to schedule'), 'mid');
    xs.forEach((x, i) => b.node('n' + (i + 1), x, y, { cols: 3, label: 'node-' + (i + 1) }));
    ['n1:0', 'n1:1', 'n1:2', 'n3:0', 'n3:1'].forEach((s, i) => b.pod('f' + i, s, { c: 'g' }));
    b.pod(null, 'n2:0', { c: 'g' });
    b.badge('x1', xs[0] + 246, y - 34, 'ng').badge('x3', xs[2] + 246, y - 34, 'ng');
    b.text('r1', xs[0], y + 152, localize('空きがない', 'No capacity'), 'center c-ng', 284);
    b.text('r3', xs[2], y + 152, localize('条件に合わない<span class="tiny" style="display:block;color:var(--ng)">（taint など）</span>', 'Constraints not met<span class="tiny" style="display:block;color:var(--ng)">(e.g. taints)</span>'), 'center c-ng', 284);
    b.score('s2', xs[1], y - 74, 284, '64').score('s4', xs[3], y - 74, 284, '90');
    b.hide('x1', 'x3', 'r1', 'r3', 's2', 's4');
  },
  steps: [
    () => {},
    t => { t.dim(['n1', 'n3', 'n1.l', 'n3.l', 'f0', 'f1', 'f2', 'f3', 'f4']); t.show(['x1', 'x3', 'r1', 'r3']); },
    t => t.show('s2').show('s4', { delay: 200 }),
    t => { t.cls('n4', 'hot').cls('s4', 'best'); t.move('p', 'n4:0', { dur: 900 }); t.hide('lp'); },
  ],
};

/* ---------- Podを1つずつ ---------- */
SCENES.onebyone = {
  build(b) {
    b.text('lq', 96, 372, 'Scheduling Queue', 'tiny');
    b.box('lane', 96, 420, 420, 150, 'lane');
    [416, 326, 236, 146].forEach((x, i) => b.pod('p' + (i + 1), [x, 457], { label: i + 1, cls: 'act' }));
    b.arrow('a1', [530, 495], [600, 495]);
    b.box('sch', 620, 380, 380, 230, 'ink',
      '<div style="padding:28px 34px"><div style="font:600 36px var(--font-code)">kube-scheduler</div>' +
      '<div style="font-size:28px;margin-top:6px;color:#B9C6E6;font-weight:500;white-space:nowrap">Filter → Score → Bind</div></div>');
    b.arrow('a2', [1014, 495], [1084, 495]);
    b.node('nA', 1104, 350).node('nB', 1318, 350).node('nC', 1104, 540).node('nD', 1318, 540);
    ['nA:0', 'nC:0', 'nD:1'].forEach(s => b.pod(null, s, { c: 'g' }));
  },
  steps: [
    () => {},
    t => {
      t.move('p1', 'nB:0', { via: [[772, 506]], dur: 1500 });
      t.cls('p1', 'run', true, { at: 1500 });   // 置かれたPodから、すぐに働き始める
      t.move('p2', [416, 457], { delay: 300 }).move('p3', [326, 457], { delay: 300 }).move('p4', [236, 457], { delay: 300 });
    },
    t => {
      t.move('p2', 'nA:1', { via: [[772, 506]], dur: 1200 });
      t.move('p3', 'nD:0', { via: [[772, 506]], dur: 1200, delay: 800 });
      t.move('p4', 'nB:1', { via: [[772, 506]], dur: 1200, delay: 1600 });
      t.cls('p2', 'run', true, { at: 1200 }).cls('p3', 'run', true, { at: 2000 }).cls('p4', 'run', true, { at: 2800 });
    },
  ],
};

/* ---------- 全員そろわないと始まらない ---------- */
SCENES.idle = {
  build(b) {
    b.band('job', 124, 444, 398, 128, 'dotted', localize('学習Job: Worker ×4', 'Training Job: 4 workers'));
    row(150, 470, 4).forEach((p, i) => b.pod('a' + (i + 1), p, { label: 'A', cls: 'act' }));
    b.text('need', 124, 596, localize('Pod 1つにつき GPU 1枚が必要', 'Each Pod needs 1 GPU'), 'sub');
    b.text('free', 700, 396, localize('空いているGPUは3枚', '3 GPUs available'), 'mid');
    b.node('n1', 700, 470, { label: 'GPU Node 1' }).node('n2', 950, 470, { label: 'GPU Node 2' });
    b.pod(null, 'n1:0', { c: 'g' });
    b.chip('pend', 404, 366, 'Pending', 'ng').hide('pend');
  },
  steps: [
    () => {},
    t => t.move('a1', 'n1:1').move('a2', 'n2:0', { delay: 250 }).move('a3', 'n2:1', { delay: 500 }),
    t => { t.cls('a4', 'wait'); t.show('pend'); t.cls(['a1', 'a2', 'a3'], 'idle', true, { delay: 1000 }); },
  ],
};

/* ---------- 2つのJobが取り合う ---------- */
SCENES.deadlock = {
  build(b) {
    b.band('ja', 124, 354, 398, 128, 'dotted', localize('Job A: 4つ必要', 'Job A: needs 4 GPUs'));
    b.band('jb', 124, 584, 398, 128, 'dotted b', localize('Job B: 4つ必要', 'Job B: needs 4 GPUs'));
    row(150, 380, 4).forEach((p, i) => b.pod('a' + (i + 1), p, { label: 'A', cls: 'act' }));
    row(150, 610, 4).forEach((p, i) => b.pod('b' + (i + 1), p, { c: 'b', label: 'B', cls: 'act' }));
    b.text('free', 760, 416, localize('空いているGPUは6枚', '6 GPUs available'), 'mid');
    b.node('n1', 760, 490, { label: 'GPU Node 1' }).node('n2', 990, 490, { label: 'GPU Node 2' }).node('n3', 1220, 490, { label: 'GPU Node 3' });
    b.chip('ca', 540, 400, '3 / 4', 'ng').chip('cb', 540, 630, '3 / 4', 'ng').hide('ca', 'cb');
  },
  steps: [
    () => {},
    t => {
      [['a1', 'n1:0'], ['b1', 'n1:1'], ['a2', 'n2:0'], ['b2', 'n2:1'], ['a3', 'n3:0'], ['b3', 'n3:1']]
        .forEach(([id, s], i) => t.move(id, s, { delay: i * 260 }));
    },
    t => {
      t.cls(['a4', 'b4'], 'wait').show(['ca', 'cb']);
      t.cls(['a1', 'a2', 'a3', 'b1', 'b2', 'b3'], 'idle');
    },
  ],
};

/* ---------- Workload と PodGroup ---------- */
SCENES.api = {
  build(b) {
    const loose = [[860, 400], [990, 540], [1120, 420], [1230, 560]];
    loose.forEach((p, i) => b.pod('p' + i, p));
    b.band('pg', 820, 460, 398, 128, '', 'PodGroup');
    b.text('tpg', 1256, 478, localize('一緒に置きたい<br>Podのまとまり', 'Pods to schedule<br>as a group'), 'mid');
    b.box('wl', 110, 404, 470, 240, '',
      '<div style="padding:30px 36px"><div style="font:600 40px var(--font-code)">Workload</div>' +
      localize('<div style="font-size:30px;font-weight:500;color:var(--ink-2);margin:6px 0 18px;white-space:nowrap">方針を書いた設計図</div>', '<div style="font-size:30px;font-weight:500;color:var(--ink-2);margin:6px 0 18px;white-space:nowrap">A template with policies</div>') +
      '<span class="chip">gang: minCount 4</span></div>');
    b.arrow('ar', [600, 524], [796, 524]);
    b.text('tar', 598, 470, localize('この方針で作る', 'Uses this template'), 'tiny center', 200);
    b.hide('pg', 'tpg', 'wl', 'ar', 'tar');
  },
  steps: [
    () => {},
    t => { row(846, 486, 4).forEach((p, i) => t.move('p' + i, p)); t.show(['pg', 'tpg'], { delay: 450 }); },
    t => t.show(['wl', 'ar', 'tar']),
  ],
};

/* ---------- Gang Scheduling：全部置けるときだけ ---------- */
SCENES.gang = {
  build(b) {
    b.band('pg', 124, 464, 398, 128, '', 'PodGroup  minCount: 4');
    row(150, 490, 4).forEach((p, i) => b.pod('a' + (i + 1), p, { label: 'A', cls: 'act' }));
    b.box('q', 580, 448, 300, 160, '', localize('<div class="txt mid center" style="padding:30px 0">4つ全部<br>置ける？</div>', '<div class="txt mid center" style="padding:30px 0">Do all<br>4 Pods fit?</div>'));
    b.badge('ng', 848, 420, 'ng').badge('ok', 848, 420, 'ok');
    b.text('v1', 450, 636, localize('空きは3つ。<b>1つも置かない</b>', '3 slots free. <b>Schedule none</b>'), 'mid center', 560);
    b.text('v2', 450, 636, localize('空きが4つ。<b>全員を同時に置く</b>', '4 slots free. <b>Schedule all</b>'), 'mid center', 560);
    b.node('n1', 1000, 490, { label: 'GPU Node 1' }).node('n2', 1230, 490, { label: 'GPU Node 2' });
    b.pod('x', 'n1:0', { c: 'g' });
    b.chip('done', 1000, 416, localize('他のPodが終了', 'Another Pod finishes'), 'jp line');
    b.hide('ng', 'ok', 'v1', 'v2', 'done');
  },
  steps: [
    () => {},
    t => t.show(['ng', 'v1']),
    t => { t.hide(['ng', 'v1']); t.set('x', { o: 0 }); t.show('done'); },
    t => {
      t.show(['ok', 'v2']); t.hide(['pg', 'done']);
      ['n1:0', 'n1:1', 'n2:0', 'n2:1'].forEach((s, i) => t.move('a' + (i + 1), s, { delay: 250 }));
      t.cls(['a1', 'a2', 'a3', 'a4'], 'run', true, { at: 1000 });   // 全員そろった瞬間に、全員が働き始める
    },
  ],
};

/* ---------- PodGroup Scheduling Cycle ---------- */
SCENES.cycle = {
  build(b) {
    b.text('lq', 96, 372, 'Scheduling Queue', 'tiny');
    b.box('lane', 96, 416, 500, 300, 'lane');
    b.band('pg', 130, 476, 398, 128, '', 'PodGroup');
    row(156, 502, 4).forEach((p, i) => b.pod('a' + (i + 1), p, { label: 'A', cls: 'act' }));
    b.pod(null, [156, 622], { c: 'g' }).pod(null, [246, 622], { c: 'g' });
    b.text('ls', 346, 644, localize('単体のPod', 'Single Pod'), 'tiny');
    b.box('snap', 660, 440, 800, 250, 'zone');
    b.chip('csnap', 684, 418, localize('まだ確定ではない', 'Tentative placement'), 'jp ink');
    b.node('n1', 700, 520).node('n2', 970, 520).node('n3', 1240, 520);
    b.pod(null, 'n1:0', { c: 'g' }).pod(null, 'n3:1', { c: 'g' });
    b.text('chk', 660, 704, localize('4 / 4 置ける', 'All 4 Pods fit'), 'big center', 800);
    b.badge('ok', 1210, 698, 'ok');
    b.hide('snap', 'csnap', 'chk', 'ok');
  },
  steps: [
    () => {},
    t => {
      t.show(['snap', 'csnap']).cls('pg', 'dotted');
      ['n1:1', 'n2:0', 'n2:1', 'n3:0'].forEach((s, i) => { t.move('a' + (i + 1), s, { delay: 350 + i * 300 }); t.cls('a' + (i + 1), 'ghost'); });
    },
    t => t.show(['chk', 'ok']),
    t => { t.cls(['a1', 'a2', 'a3', 'a4'], 'ghost', false).cls(['a1', 'a2', 'a3', 'a4'], 'run', true, { at: 350 }); t.hide(['snap', 'csnap', 'pg']); },
  ],
};

/* ---------- Topology：なぜ近くに置きたいか ---------- */
SCENES.tasWhy = {
  build(b, geo) {
    const xs = [600, 920, 1240], y = 370;
    xs.forEach((x, i) => {
      b.box('rk' + (i + 1), x, y, 300, 350, 'rack');
      b.text(null, x + 24, y + 16, 'Rack ' + (i + 1), 'tiny');
      b.node('r' + (i + 1) + 'a', x + 53, y + 70).node('r' + (i + 1) + 'b', x + 53, y + 210);
    });
    ['r1a:0', 'r1a:1', 'r1b:0', 'r2a:0', 'r2b:1'].forEach(s => b.pod(null, s, { c: 'g' }));
    b.band('pg', 124, 474, 398, 128, '', 'PodGroup');
    row(150, 500, 4).forEach((p, i) => b.pod('a' + (i + 1), p, { label: 'A', cls: 'act' }));
    const sc = ['r1b:1', 'r2a:1', 'r2b:0', 'r3a:0'].map(s => mid(geo[s]));
    b.link('l1', sc[0], sc[1], 'ng').link('l2', sc[1], sc[3], 'ng').link('l3', sc[2], sc[3], 'ng').link('l4', sc[0], sc[2], 'ng');
    const co = ['r3a:0', 'r3a:1', 'r3b:1', 'r3b:0'].map(s => mid(geo[s]));
    co.forEach((p, i) => b.link('k' + i, p, co[(i + 1) % 4], 'ok'));
    b.hide('l1', 'l2', 'l3', 'l4', 'k0', 'k1', 'k2', 'k3');
  },
  steps: [
    () => {},
    t => {
      ['r1b:1', 'r2a:1', 'r2b:0', 'r3a:0'].forEach((s, i) => t.move('a' + (i + 1), s, { delay: i * 150 }));
      t.hide('pg'); t.show(['l1', 'l2', 'l3', 'l4'], { delay: 1000 });
      t.cls(['a1', 'a2', 'a3', 'a4'], 'slow').cls(['a1', 'a2', 'a3', 'a4'], 'run', true, { at: 1000 });   // 動いてはいるが、通信待ちで遅い
    },
    t => {
      t.hide(['l1', 'l2', 'l3', 'l4']);
      ['r3a:0', 'r3a:1', 'r3b:0', 'r3b:1'].forEach((s, i) => t.move('a' + (i + 1), s));
      t.cls('rk3', 'hot'); t.show(['k0', 'k1', 'k2', 'k3'], { delay: 800 });
      t.cls(['a1', 'a2', 'a3', 'a4'], 'slow', false, { at: 800 });
    },
  ],
};

/* ---------- Topology：候補ごとに試す ---------- */
SCENES.tasHow = {
  build(b) {
    const xs = [480, 800, 1120], y = 440, o = { cols: 3, tile: 56, gap: 12 };
    xs.forEach((x, i) => {
      const n = i + 1;
      b.box('rk' + n, x, y, 300, 268, 'rack');
      b.text('rl' + n, x + 22, y + 12, 'Rack ' + n, 'tiny');
      b.node('r' + n + 'a', x + 42, y + 58, o).node('r' + n + 'b', x + 42, y + 160, o);
      b.chip('cand' + n, x + localize(150, 90), y - 22, localize('候補 ', 'Candidate ') + n, 'jp ink');
      b.score('s' + n, x, y + 290, 300, n === 2 ? localize('90<span style="font-size:28px;font-weight:600"> 点</span>', '90<span style="font-size:28px;font-weight:600"> pts</span>') : localize('60<span style="font-size:28px;font-weight:600"> 点</span>', '60<span style="font-size:28px;font-weight:600"> pts</span>'));
    });
    ['r1a:0', 'r1a:1', 'r1a:2', 'r1b:0'].forEach((s, i) => b.pod('q' + i, s, { c: 'g', cls: 'sm' }));
    ['r2a:0', 'r2a:1'].forEach(s => b.pod(null, s, { c: 'g', cls: 'sm' }));
    b.band('pg', 100, 516, 320, 116, '', 'PodGroup');
    row(127, 546, 4, 70).forEach((p, i) => b.pod('a' + (i + 1), p, { cls: 'sm' }));
    b.chip('topo', 100, 650, 'topology: rack', 'line');
    const gh = { g1: ['r1b:1', 'r1b:2'], g2: ['r2a:2', 'r2b:0', 'r2b:1', 'r2b:2'], g3: ['r3a:0', 'r3a:1', 'r3a:2', 'r3b:0'] };
    Object.keys(gh).forEach(k => gh[k].forEach((s, i) => b.pod(k + i, s, { cls: 'sm ghost', hide: true })));
    b.badge('ng1', xs[0] + 262, y - 30, 'ng').badge('ok2', xs[1] + 262, y - 30, 'ok').badge('ok3', xs[2] + 262, y - 30, 'ok');
    b.text('f1', xs[0], y + 290, localize('2 / 4 しか置けない', 'Only 2 / 4 fit'), 'center c-ng', 300);
    b.hide('cand1', 'cand2', 'cand3', 's1', 's2', 's3', 'ng1', 'ok2', 'ok3', 'f1');
  },
  steps: [
    () => {},
    t => t.show(['cand1', 'cand2', 'cand3']),
    // Filter：候補ごとに全員を仮置きしてみて、入らない候補を外す
    t => {
      t.show(['g10', 'g11']).show(['g20', 'g21', 'g22', 'g23'], { delay: 250 }).show(['g30', 'g31', 'g32', 'g33'], { delay: 500 });
      t.show(['ng1', 'f1'], { delay: 900 }).show('ok2', { delay: 1100 }).show('ok3', { delay: 1300 });
      t.dim(['rk1', 'rl1', 'r1a', 'r1b', 'q0', 'q1', 'q2', 'q3', 'cand1'], { delay: 1500 });
    },
    // Score：残った候補に点数をつけ、一番高いところに全員を置く
    t => {
      t.show(['s2', 's3']);
      t.cls('s2', 'best').cls('rk2', 'hot', true, { delay: 900 });
      t.hide(['g10', 'g11']);
      t.hide(['g20', 'g21', 'g22', 'g23', 'g30', 'g31', 'g32', 'g33', 'pg', 'topo'], { delay: 1100 });
      ['r2a:2', 'r2b:0', 'r2b:1', 'r2b:2'].forEach((s, i) => t.move('a' + (i + 1), s, { delay: 1100 }));
    },
  ],
};

/* ---------- Pod単位のPreemption ---------- */
SCENES.preemptPod = {
  build(b) {
    b.text('lq', 96, 392, 'Scheduling Queue', 'tiny');
    b.box('lane', 96, 440, 420, 160, 'lane');
    b.pod('h', [268, 482], { c: 'h', label: 'H', hide: true, cls: 'act' });
    b.chip('ch', 96, 622, localize('優先度: 高', 'High priority'), 'jp rose').hide('ch');
    b.chip('cb', 700, 404, localize('学習Job B（優先度: 低）', 'Training Job B (low priority)'), 'jp amber');
    b.node('n1', 700, 480, { label: 'GPU Node 1' }).node('n2', 950, 480, { label: 'GPU Node 2' });
    ['n1:0', 'n1:1', 'n2:0', 'n2:1'].forEach((s, i) => b.pod('b' + (i + 1), s, { c: 'b', label: 'B', cls: 'act' }));
    b.chip('ev', 850, 322, localize('追い出される', 'Preempted'), 'jp ng').hide('ev');
  },
  steps: [
    t => t.cls(['b1', 'b2', 'b3', 'b4'], 'run'),   // 学習Job B は、4つそろって働いている
    t => t.show(['h', 'ch']),
    t => {
      t.set('b2', { x: 804, y: 376, o: 0 }); t.show('ev');
      t.move('h', 'n1:1', { delay: 450 }); t.hide('ch');
      t.cls('h', 'run', true, { at: 1200 });
    },
    t => { t.cls(['b1', 'b3', 'b4'], 'idle').cls(['b1', 'b2', 'b3', 'b4'], 'run', false); t.hide('ev'); },
  ],
};

/* ---------- Workload-Aware Preemption ---------- */
SCENES.wap = {
  build(b) {
    b.text('lq', 96, 372, 'Scheduling Queue', 'tiny');
    b.box('lane', 96, 420, 440, 200, 'lane');
    b.band('bh', 124, 466, 218, 128, 'h', 'PodGroup H');
    b.chip('hp', 362, 508, localize('優先度: 高', 'High priority'), 'jp rose');
    b.pod('h1', [150, 492], { c: 'h', label: 'H', cls: 'act' }).pod('h2', [240, 492], { c: 'h', label: 'H', cls: 'act' });
    b.text('rule', 96, 640, localize('追い出すのは、H全員の場所が空くときだけ', 'Preempt only if all of H can fit'), 'tiny');
    b.node('n1', 760, 492, { label: 'GPU Node 1' }).node('n2', 1050, 492, { label: 'GPU Node 2' });
    b.band('bb', 732, 458, 540, 190, 'b', 'PodGroup B  disruptionMode: all');
    ['n1:0', 'n1:1', 'n2:0', 'n2:1'].forEach((s, i) => b.pod('b' + (i + 1), s, { c: 'b', label: 'B', cls: 'act' }));
    b.text('deleted', 732, 372, localize('PodGroup BのPodをすべて削除する', 'Delete all Pods in PodGroup B'), 'sub center', 540);
    b.text('freed', 1050, 662, localize('空いた2枚は、すぐ他のPodが使える', '2 GPUs are free for other Pods'), 'tiny');
    b.chip('m1', 700, 764, 'disruptionMode: all', 'amber');
    b.text('m1t', 1044, 768, localize('全員まとめて（学習Jobなど）', 'All together (e.g. training)'), 'sub');
    b.chip('m2', 700, 830, 'disruptionMode: single', 'line');
    b.text('m2t', 1094, 834, localize('1 Podずつ（推論サービスなど）', 'One Pod at a time (e.g. inference)'), 'sub');
    b.hide('bh', 'hp', 'h1', 'h2', 'rule', 'deleted', 'freed', 'm1', 'm1t', 'm2', 'm2t');
  },
  steps: [
    t => t.cls(['b1', 'b2', 'b3', 'b4'], 'run'),
    t => t.show(['bh', 'hp', 'h1', 'h2', 'rule']),
    // BのPodをすべて削除し、そのあとHが入る
    t => {
      t.hide(['b1', 'b2', 'b3', 'b4', 'bb']);
      t.cls(['b1', 'b2', 'b3', 'b4'], 'run', false);
      t.cls(['h1', 'h2'], 'run', true, { at: 1950 });
      t.hide('rule').show('deleted', { delay: 500 });
      t.move('h1', 'n1:0', { delay: 1200 }).move('h2', 'n1:1', { delay: 1200 });
      t.hide(['bh', 'hp'], { delay: 1200 }).show('freed', { delay: 2000 });
    },
    t => { t.show(['m1', 'm1t', 'm2', 'm2t']); t.hide('deleted'); },
  ],
};

/* ---------- CompositePodGroup：入れ子 ---------- */
SCENES.cpg = {
  build(b) {
    const gx = [452, 832, 1212], y = 500;
    b.band('cpg', 386, 400, 1148, 268, 'k', 'CompositePodGroup');
    gx.forEach((x, g) => {
      b.band('pg' + g, x - 26, y - 26, 308, 128, '', 'PodGroup');
      row(x, y, 3).forEach((p, j) => b.pod('p' + g + j, p, { label: j === 0 ? 'L' : 'W', cls: j === 0 ? 'lead' : '' }));
    });
    b.hide('cpg', 'pg0', 'pg1', 'pg2');
  },
  steps: [
    () => {},
    t => t.show(['pg0', 'pg1', 'pg2']),
    t => t.show('cpg'),
  ],
};

/* ---------- CompositePodGroup：階層ごとのルール ---------- */
SCENES.cpgPolicy = {
  build(b) {
    const o = { cols: 3, tile: 56, gap: 12 };
    b.band('cpg', 110, 326, 580, 478, 'k', 'CompositePodGroup');
    b.chip('cz', 420, 352, 'topology: zone', 'line');
    [0, 1, 2].forEach(g => {
      const y = 424 + g * 124;
      b.band('pg' + g, 150, y, 236, 96, '');
      row(170, y + 20, 3, 68).forEach((p, j) => b.pod('p' + g + j, p, { cls: 'sm' + (j === 0 ? ' lead' : ''), label: j === 0 ? 'L' : 'W' }));
      b.chip('cr' + g, 420, y + 24, 'topology: rack', 'line');
    });
    [['A', 740], ['B', 1170]].forEach(([z, x]) => {
      b.box('z' + z, x, 326, 400, 478, 'zone');
      b.text(null, x + 26, 340, 'Zone ' + z, 'tiny');
      [0, 1, 2].forEach(r => {
        const y = 392 + r * 132;
        b.box('rk' + z + r, x + 24, y, 352, 112, 'rack');
        b.text(null, x + 44, y + 38, 'Rack ' + (r + 1), 'tiny');
        b.node('t' + z + r, x + 142, y + 16, o);
      });
    });
    ['tB0:0', 'tB0:1', 'tB1:0'].forEach((s, i) => b.pod('gB' + i, s, { c: 'g', cls: 'sm' }));
    b.badge('okA', 1102, 296, 'ok').badge('ngB', 1532, 296, 'ng').hide('okA', 'ngB');
  },
  steps: [
    () => {},
    t => {
      t.cls('zA', 'hot').show(['okA', 'ngB']); t.cls('cz', 'k8s').cls('cz', 'line', false);
      t.dim(['zB', 'rkB0', 'rkB1', 'rkB2', 'tB0', 'tB1', 'tB2', 'gB0', 'gB1', 'gB2']);
    },
    t => {
      [0, 1, 2].forEach(g => {
        [0, 1, 2].forEach(j => t.move('p' + g + j, 'tA' + g + ':' + j, { delay: g * 250 }));
        t.cls('pg' + g, 'dotted').cls('cr' + g, 'k8s').cls('cr' + g, 'line', false).cls('rkA' + g, 'hot', true, { delay: g * 250 + 500 });
      });
      t.cls('cz', 'k8s', false).cls('cz', 'line');
    },
    t => { [0, 1, 2].forEach(g => t.cls('cr' + g, 'k8s', false).cls('cr' + g, 'line')); },
  ],
};
