/* ============================================================
   智慧针疗 —— Canvas 图表（无第三方依赖）
   ============================================================ */
(function (global) {
  'use strict';

  const CH_COLORS = ['#7DD3FC', '#38BDF8', '#A78BFA', '#C4B5FD', '#34D399', '#6EE7B7', '#FBBF24', '#FCD34D'];
  const GRID = 'rgba(120,160,215,0.10)';
  const AXIS = 'rgba(120,160,215,0.22)';
  const TEXT = '#6A80A0';
  const TEXT2 = '#9DB1CC';
  const MONO = '11px Consolas, monospace';

  function surface(cv) {
    const dpr = Math.min(global.devicePixelRatio || 1, 2);
    const w = cv.clientWidth || 600;
    const h = cv.clientHeight || 300;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  function text(ctx, s, x, y, color, font, align) {
    ctx.fillStyle = color || TEXT;
    ctx.font = font || '10px "Microsoft YaHei", sans-serif';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }

  /* ---------------- 多通道波形 ---------------- */
  function drawWave(cv, chans, opt) {
    const o = opt || {};
    const { ctx, w, h } = surface(cv);
    const n = chans[0] ? chans[0].length : 0;
    if (!n) {
      text(ctx, '等待采集数据…', w / 2, h / 2, TEXT, '12px "Microsoft YaHei"', 'center');
      return;
    }
    const padL = 42, padR = 54, padT = 8, padB = 14;
    const laneH = (h - padT - padB) / chans.length;
    const plotW = w - padL - padR;
    const half = (laneH / 2) * 0.82;
    const scale = o.scale || 70; // ±μV 映射到 lane 半高

    // 网格：每秒一条竖线
    const seconds = o.seconds || 4;
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    for (let s = 0; s <= seconds; s++) {
      const x = padL + (s / seconds) * plotW;
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, h - padB); ctx.stroke();
    }
    // 阶段事件竖线（进针/起针）
    if (o.events && o.events.length) {
      for (const ev of o.events) {
        const dt = (o.totalSeconds || 0) - ev.t;
        if (dt < 0 || dt > seconds) continue;
        const x = padL + (1 - dt / seconds) * plotW;
        ctx.strokeStyle = 'rgba(251,191,36,0.45)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, h - padB); ctx.stroke();
        ctx.setLineDash([]);
        text(ctx, ev.label, x + 4, padT + 8, 'rgba(251,191,36,0.9)', '10px "Microsoft YaHei"');
      }
    }

    for (let ch = 0; ch < chans.length; ch++) {
      const baseY = padT + laneH * ch + laneH / 2;
      // 通道分隔线
      if (ch > 0) {
        ctx.strokeStyle = 'rgba(120,160,215,0.06)';
        ctx.beginPath(); ctx.moveTo(padL, padT + laneH * ch); ctx.lineTo(w - padR, padT + laneH * ch); ctx.stroke();
      }
      // 零线
      ctx.strokeStyle = 'rgba(120,160,215,0.08)';
      ctx.beginPath(); ctx.moveTo(padL, baseY); ctx.lineTo(w - padR, baseY); ctx.stroke();

      text(ctx, Sim.CH_NAMES[ch], padL - 8, baseY, TEXT2, '10px Consolas, monospace', 'right');

      ctx.strokeStyle = CH_COLORS[ch % CH_COLORS.length];
      ctx.lineWidth = 1;
      ctx.beginPath();
      const step = Math.max(1, Math.floor(n / plotW));
      for (let x = 0; x < plotW; x++) {
        const i0 = Math.floor((x / plotW) * (n - 1));
        const i1 = Math.min(n - 1, i0 + step);
        let mn = Infinity, mx = -Infinity;
        for (let i = i0; i <= i1; i++) { const v = chans[ch][i]; if (v < mn) mn = v; if (v > mx) mx = v; }
        const y1 = baseY - (mx / scale) * half;
        const y2 = baseY - (mn / scale) * half;
        const px = padL + x;
        if (x === 0) ctx.moveTo(px, y1); else ctx.lineTo(px, y1);
        ctx.lineTo(px, y2);
      }
      ctx.stroke();

      // 末端当前值
      const last = chans[ch][n - 1];
      if (o.showValues !== false) {
        text(ctx, last.toFixed(0), w - padR + 6, baseY, TEXT, MONO);
      }
    }
    text(ctx, 'μV', w - padR + 6, h - 6, TEXT);
  }

  /* ---------------- 频谱 ---------------- */
  function drawSpectrum(cv, m) {
    const { ctx, w, h } = surface(cv);
    if (!m) { text(ctx, '等待评估…', w / 2, h / 2, TEXT, '12px "Microsoft YaHei"', 'center'); return; }
    const padL = 10, padR = 10, padT = 16, padB = 26;
    const n = Sim.BANDS.length;
    const gap = 12;
    const bw = (w - padL - padR - gap * (n - 1)) / n;
    const rel = m.rel;
    const maxV = 0.62;
    Sim.BANDS.forEach((b, i) => {
      const x = padL + i * (bw + gap);
      const v = Math.min(rel[b.key], maxV);
      const bh = (v / maxV) * (h - padT - padB);
      const y = h - padB - bh;
      const g = ctx.createLinearGradient(0, y, 0, h - padB);
      g.addColorStop(0, b.color);
      g.addColorStop(1, b.color + '22');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, bw, bh);
      ctx.fillStyle = b.color;
      ctx.fillRect(x, y, bw, 2);
      text(ctx, b.name, x + bw / 2, h - padB + 10, TEXT2, '11px "Microsoft YaHei"', 'center');
      text(ctx, (rel[b.key] * 100).toFixed(0) + '%', x + bw / 2, y - 8, b.color, '10px Consolas, monospace', 'center');
    });
    text(ctx, '相对功率占比', padL, 6, TEXT, '9px "Microsoft YaHei"');
  }

  /* ---------------- 脑地形图（α 功率） ---------------- */
  const TOPO_POS = {
    Fp1: [-0.30, 0.66], Fp2: [0.30, 0.66],
    F3: [-0.46, 0.30], F4: [0.46, 0.30],
    C3: [-0.52, -0.06], C4: [0.52, -0.06],
    O1: [-0.30, -0.66], O2: [0.30, -0.66],
  };

  function drawTopo(cv, m) {
    const { ctx, w, h } = surface(cv);
    const cx = w / 2, cy = h / 2 + 4;
    const R = Math.min(w, h) * 0.40;
    // 头形
    ctx.strokeStyle = AXIS;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    // 鼻子
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.12, cy - R);
    ctx.lineTo(cx, cy - R * 1.16);
    ctx.lineTo(cx + R * 0.12, cy - R);
    ctx.stroke();
    // 耳朵
    ctx.beginPath(); ctx.arc(cx - R, cy, R * 0.16, Math.PI * 0.4, Math.PI * 1.6); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + R, cy, R * 0.16, Math.PI * 1.4, Math.PI * 0.6); ctx.stroke();
    // 中线
    ctx.strokeStyle = 'rgba(120,160,215,0.07)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
    ctx.setLineDash([]);

    if (!m) {
      text(ctx, '等待采集…', cx, cy, TEXT, '11px "Microsoft YaHei"', 'center');
      return;
    }
    const vals = Object.keys(TOPO_POS).map((k) => {
      const i = Sim.CH_NAMES.indexOf(k);
      return Math.log10(m.abs.alpha / (m.impedance[i] * 0.1) + 1);
    });
    const mn = Math.min(...vals), mx = Math.max(...vals);
    Object.keys(TOPO_POS).forEach((k, idx) => {
      const [nx, ny] = TOPO_POS[k];
      // 屏幕 y 轴向下：额区（ny=+）应画在上方
      const x = cx + nx * R, y = cy - ny * R;
      const p = mx > mn ? (vals[idx] - mn) / (mx - mn) : 0.5;
      const color = mix([56, 189, 248], [251, 191, 36], p);
      // 光晕
      const g = ctx.createRadialGradient(x, y, 0, x, y, 26);
      g.addColorStop(0, 'rgba(' + color.join(',') + ',0.55)');
      g.addColorStop(1, 'rgba(' + color.join(',') + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgb(' + color.join(',') + ')';
      ctx.beginPath(); ctx.arc(x, y, 4.4, 0, Math.PI * 2); ctx.fill();
      text(ctx, k, x, y - 12, TEXT2, '9px Consolas, monospace', 'center');
    });
    // 色标
    const grad = ctx.createLinearGradient(cx - 50, h - 14, cx + 50, h - 14);
    grad.addColorStop(0, 'rgb(56,189,248)');
    grad.addColorStop(1, 'rgb(251,191,36)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - 50, h - 16, 100, 4);
    text(ctx, '低', cx - 62, h - 14, TEXT, '9px "Microsoft YaHei"', 'right');
    text(ctx, '高', cx + 62, h - 14, TEXT, '9px "Microsoft YaHei"', 'left');
  }

  function mix(a, b, p) {
    return a.map((v, i) => Math.round(v + (b[i] - v) * p));
  }

  /* ---------------- 仪表盘 ---------------- */
  function levelColor(level) { return level ? level.color : '#38BDF8'; }

  function drawGauge(cv, score, level) {
    const { ctx, w, h } = surface(cv);
    const cx = w / 2, cy = h / 2 + 8;
    const R = Math.min(w, h * 1.35) * 0.42;
    const start = Math.PI * 0.78, end = Math.PI * 2.22;
    const color = levelColor(level);
    ctx.lineCap = 'round';
    // 轨道
    ctx.strokeStyle = 'rgba(120,160,215,0.13)';
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(cx, cy, R, start, end); ctx.stroke();
    // 进度
    const p = Math.max(0, Math.min(1, score / 100));
    if (p > 0.002) {
      const g = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      g.addColorStop(0, color + '99');
      g.addColorStop(0.6, color);
      g.addColorStop(1, '#BAE6FD');
      ctx.strokeStyle = g;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(cx, cy, R, start, start + (end - start) * p); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    // 中心数字
    ctx.fillStyle = '#E8F1FF';
    ctx.font = '700 ' + Math.round(h * 0.24) + 'px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(score == null ? '—' : score.toFixed(1), cx, cy + 2);
    text(ctx, 'BFI', cx, cy + h * 0.20, TEXT, '10px Consolas, monospace', 'center');
    text(ctx, '0', cx - R * 0.88, cy + R * 0.62, TEXT, '9px Consolas', 'center');
    text(ctx, '100', cx + R * 0.88, cy + R * 0.62, TEXT, '9px Consolas', 'center');
  }

  /* ---------------- 趋势 ---------------- */
  function drawTrend(cv, evals, opt) {
    const o = opt || {};
    const { ctx, w, h } = surface(cv);
    const padL = 30, padR = 16, padT = 14, padB = 22;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const yOf = (v) => padT + plotH * (1 - v / 100);
    const xOf = (i, n) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);

    // 等级带
    const bandsDef = [
      [80, 100, 'rgba(52,211,153,.07)'],
      [60, 80, 'rgba(56,189,248,.06)'],
      [40, 60, 'rgba(251,191,36,.05)'],
      [20, 40, 'rgba(249,115,22,.05)'],
      [0, 20, 'rgba(248,113,113,.06)'],
    ];
    bandsDef.forEach(([a, b, c]) => {
      ctx.fillStyle = c;
      ctx.fillRect(padL, yOf(b), plotW, yOf(a) - yOf(b));
    });
    // 网格
    ctx.strokeStyle = GRID;
    [20, 40, 60, 80].forEach((v) => {
      ctx.beginPath(); ctx.moveTo(padL, yOf(v)); ctx.lineTo(w - padR, yOf(v)); ctx.stroke();
      text(ctx, v, padL - 6, yOf(v), TEXT, '9px Consolas', 'right');
    });

    if (!evals || !evals.length) {
      text(ctx, '完成一次演示后生成变化曲线', w / 2, h / 2, TEXT, '11px "Microsoft YaHei"', 'center');
      return;
    }
    // 采样点（最多 80 个）
    const step = Math.max(1, Math.ceil(evals.length / 80));
    const pts = evals.filter((_, i) => i % step === 0 || i === evals.length - 1);

    // 面积
    ctx.beginPath();
    pts.forEach((e, i) => {
      const x = xOf(i, pts.length), y = yOf(e.aeqi);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    const lastX = xOf(pts.length - 1, pts.length);
    ctx.lineTo(lastX, h - padB); ctx.lineTo(padL, h - padB); ctx.closePath();
    const g = ctx.createLinearGradient(0, padT, 0, h - padB);
    g.addColorStop(0, 'rgba(56,189,248,.20)');
    g.addColorStop(1, 'rgba(56,189,248,0)');
    ctx.fillStyle = g; ctx.fill();

    // 折线
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach((e, i) => {
      const x = xOf(i, pts.length), y = yOf(e.aeqi);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 基线点
    const base = pts.find((e) => e.isBaseline) || (evals[0] && evals[0].isBaseline ? evals[0] : null);
    if (base) {
      const bi = pts.indexOf(base);
      if (bi >= 0) {
        const x = xOf(bi, pts.length), y = yOf(base.aeqi);
        ctx.fillStyle = '#A78BFA';
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
        text(ctx, '基线 ' + base.aeqi.toFixed(1), x, y - 12, '#A78BFA', '9px Consolas', 'center');
      }
    }
    // 端点
    const last = pts[pts.length - 1];
    const lx = xOf(pts.length - 1, pts.length), ly = yOf(last.aeqi);
    ctx.fillStyle = levelColor(last.level);
    ctx.shadowColor = levelColor(last.level); ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(lx, ly, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    text(ctx, last.aeqi.toFixed(1), Math.min(lx, w - padR - 10), ly - 13, levelColor(last.level), '10px Consolas', 'center');
    text(ctx, 't=0', padL, h - 8, TEXT, '9px "Microsoft YaHei"', 'left');
    text(ctx, '针刺进程', w - padR, h - 8, TEXT, '9px "Microsoft YaHei"', 'right');
  }

  /* ---------------- 四维雷达 ---------------- */
  function drawRadar(cv, dims) {
    const { ctx, w, h } = surface(cv);
    const cx = w / 2, cy = h / 2 + 4;
    const R = Math.min(w, h) * 0.34;
    const keys = Sim.DIM_DEF.map((d) => d.key);
    const n = keys.length;
    const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const pt = (i, r) => [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r];

    // 网格
    for (let ring = 1; ring <= 4; ring++) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const [x, y] = pt(i, R * ring / 4);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(120,160,215,' + (ring === 4 ? 0.20 : 0.08) + ')';
      ctx.stroke();
    }
    for (let i = 0; i < n; i++) {
      const [x, y] = pt(i, R);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y);
      ctx.strokeStyle = 'rgba(120,160,215,0.08)'; ctx.stroke();
    }
    // 数据面
    if (dims) {
      ctx.beginPath();
      keys.forEach((k, i) => {
        const v = (dims[k] ? dims[k].score : 0) / 100;
        const [x, y] = pt(i, R * Math.max(0.04, v));
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath();
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, 'rgba(56,189,248,.32)');
      g.addColorStop(1, 'rgba(139,92,246,.16)');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#38BDF8'; ctx.lineWidth = 1.8; ctx.stroke();
      keys.forEach((k, i) => {
        const [x, y] = pt(i, R * Math.max(0.04, (dims[k] ? dims[k].score : 0) / 100));
        ctx.fillStyle = '#7DD3FC';
        ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill();
      });
    }
    // 标签
    Sim.DIM_DEF.forEach((d, i) => {
      const [x, y] = pt(i, R + 24);
      const v = dims ? dims[d.key].score : '—';
      text(ctx, d.label, x, y - 5, d.color, '10px "Microsoft YaHei"', 'center');
      text(ctx, String(v), x, y + 9, TEXT2, '10px Consolas', 'center');
    });
  }

  global.Charts = { drawWave, drawSpectrum, drawTopo, drawGauge, drawTrend, drawRadar, levelColor };
}(window));
