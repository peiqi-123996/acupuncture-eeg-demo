/* ============================================================
   针尖上的脑电波 —— 生理信号引擎
   不连接任何硬件：8 通道脑电由内置模型按「针刺阶段」合成，
   再从合成信号里做 FFT，得到频段功率 / 脑电特征指数(BFI) / 四个脑状态指标。
   ============================================================ */
(function (global) {
  'use strict';

  const FS = 250;
  const CH_NAMES = ['Fp1', 'Fp2', 'F3', 'F4', 'C3', 'C4', 'O1', 'O2'];
  // 各通道对各频段的敏感性（枕区 α 强、额区易受眼电影响）
  const CH_ALPHA = [0.55, 0.55, 0.80, 0.80, 0.95, 0.95, 1.35, 1.35];
  const CH_NOISE = [1.5, 1.5, 1.2, 1.2, 1.0, 1.0, 0.9, 0.9];

  const BANDS = [
    { key: 'delta', name: 'δ', lo: 0.5, hi: 4, f: 2, color: '#7C8DA6' },
    { key: 'theta', name: 'θ', lo: 4, hi: 8, f: 6, color: '#A78BFA' },
    { key: 'alpha', name: 'α', lo: 8, hi: 13, f: 10, color: '#38BDF8' },
    { key: 'beta', name: 'β', lo: 13, hi: 30, f: 20, color: '#34D399' },
    { key: 'gamma', name: 'γ', lo: 30, hi: 45, f: 38, color: '#FBBF24' },
  ];

  const PHASES = [
    { key: 'idle', label: '待机', dur: 0, desc: '点击「开始演示」启动' },
    { key: 'baseline', label: '基线采集', dur: 12, desc: '静息态 · 进针前先记录一段（闭眼放松）' },
    { key: 'insert', label: '进针', dur: 4, desc: '百会 / 印堂进针 · 记录进针瞬态' },
    { key: 'retain', label: '留针', dur: 40, desc: '留针观察 · 观察脑电是否随之变化' },
    { key: 'remove', label: '起针', dur: 3, desc: '起针 · 记录起针瞬态' },
    { key: 'post', label: '复评', dur: 10, desc: '结束后再记一段 · 与基线对比' },
    { key: 'done', label: '完成', dur: 0, desc: '本次演示结束' },
  ];
  const PHASE_MAP = Object.fromEntries(PHASES.map((p) => [p.key, p]));

  // 各阶段的目标频段幅值（μV）——本演示预设：进针后 α 上升、β 下降（仅用于演示「变化」）
  const ENV = {
    idle: { delta: 6, theta: 5, alpha: 13, beta: 12, gamma: 1.8 },
    baseline: { delta: 7, theta: 6, alpha: 15, beta: 12, gamma: 2.0 },
    insert: { delta: 8, theta: 7, alpha: 15, beta: 12, gamma: 2.2 },
    retain: { delta: 6, theta: 9, alpha: 21, beta: 13, gamma: 2.6 },
    remove: { delta: 6.5, theta: 8.5, alpha: 21, beta: 12.8, gamma: 2.4 },
    post: { delta: 6, theta: 8.5, alpha: 21, beta: 12.5, gamma: 2.4 },
  };

  const LEVELS = [
    { min: 80, key: 'excellent', label: '高同步', cls: 'level-excellent', color: '#34D399' },
    { min: 60, key: 'good', label: '较同步', cls: 'level-good', color: '#38BDF8' },
    { min: 40, key: 'effective', label: '中等', cls: 'level-effective', color: '#FBBF24' },
    { min: 20, key: 'weak', label: '偏低', cls: 'level-weak', color: '#F97316' },
    { min: 0, key: 'worse', label: '低同步', cls: 'level-worse', color: '#F87171' },
  ];

  const DIM_DEF = [
    { key: 'relaxation', label: '放松度', high: '放松', low: '紧张', color: '#38BDF8' },
    { key: 'focus', label: '专注度', high: '专注', low: '分心', color: '#22D3EE' },
    { key: 'fatigue', label: '疲劳度', high: '疲劳', low: '精神', color: '#F87171' },
    { key: 'emotion', label: '情绪指数', high: '积极平稳', low: '紧张焦虑', color: '#A78BFA' },
  ];

  const CAP = FS * 6; // 6 秒环形缓冲
  const FFT_N = 512;

  const S = {
    running: false,
    speed: 1,
    t: 0,
    phase: 'idle',
    phaseT: 0,
    phaseProgress: 0,
    buffers: CH_NAMES.map(() => new Float32Array(CAP)),
    head: 0,
    written: 0,
    amp: Object.assign({}, ENV.baseline),
    phaseAcc: CH_NAMES.map(() => BANDS.map(() => Math.random() * Math.PI * 2)),
    artifactT: 0,
    artifactSign: 1,
    blinkT: 2.5,
    metricAcc: 0,
    metrics: null,
    evals: [],
    baselineEval: null,
    baselineAB: null,
    events: [],
    sessionId: '',
    patient: { name: '演示样本', sex: '—', age: 0, disease: '（无真实受试者）' },
    operator: '演示者',
    ui: { vas: 7, deqi: 0, symptomImp: 2, manual: false },
    sessionStart: 0,
    elapsedReal: 0,
  };

  /* ---------------- 工具 ---------------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const rand = (a, b) => a + Math.random() * (b - a);
  const fmt = (v, n) => (v == null ? '—' : Number(v).toFixed(n == null ? 1 : n));

  function levelOf(score) {
    for (const l of LEVELS) if (score >= l.min) return l;
    return LEVELS[LEVELS.length - 1];
  }

  /* ---------------- FFT ---------------- */
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let tc = re[i]; re[i] = re[j]; re[j] = tc;
        tc = im[i]; im[i] = im[j]; im[j] = tc;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len;
      const wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ur = re[i + k], ui = im[i + k];
          const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
          const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
          re[i + k] = ur + vr; im[i + k] = ui + vi;
          re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
          const ncr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr;
          cr = ncr;
        }
      }
    }
  }

  /* ---------------- 信号合成 ---------------- */
  function pushSample(volts) {
    for (let ch = 0; ch < CH_NAMES.length; ch++) {
      S.buffers[ch][S.head] = volts[ch];
    }
    S.head = (S.head + 1) % CAP;
    S.written++;
  }

  function inArtifact() {
    if (S.artifactT <= 0) return 0;
    return S.artifactT;
  }

  function nextSample(t) {
    // 幅度平滑：τ≈2.2s，避免阶段切换时波形"跳变"
    const target = ENV[S.phase] || ENV.baseline;
    const k = 1 - Math.exp(-1 / (FS * 2.2));
    for (const b of BANDS) S.amp[b.key] = lerp(S.amp[b.key], target[b.key], k);

    // 进针/起针瞬态：大幅随机伪迹，持续约 1.2s 后衰减
    let art = 0;
    if (S.artifactT > 0) {
      S.artifactT -= 1 / FS;
      const env = clamp(S.artifactT / 1.2, 0, 1);
      art = S.artifactSign * rand(-1, 1) * 60 * env * env;
    }
    // 眼电眨眼：仅前额两通道，约 4–9 秒一次
    let blink = 0;
    S.blinkT -= 1 / FS;
    if (S.blinkT <= 0) {
      S.blinkT = rand(4, 9);
      S._blinkLeft = 0.35;
      S._blinkAmp = rand(18, 34);
    }
    if (S._blinkLeft > 0) {
      S._blinkLeft -= 1 / FS;
      const e = clamp(S._blinkLeft / 0.35, 0, 1);
      blink = S._blinkAmp * Math.sin(Math.PI * (1 - e));
    }
    // 得气爆发：留针前 3 秒 θ/γ 升高
    let deqi = 1;
    if (S.phase === 'retain' && S.phaseT < 3.2) {
      deqi = 1 + 0.55 * Math.sin(Math.PI * clamp(S.phaseT / 3.2, 0, 1));
    }

    const out = new Array(8);
    for (let ch = 0; ch < 8; ch++) {
      let v = 0;
      const al = S.phaseAcc[ch];
      for (let bi = 0; bi < BANDS.length; bi++) {
        const b = BANDS[bi];
        al[bi] += (2 * Math.PI * b.f) / FS;
        if (al[bi] > 2 * Math.PI) al[bi] -= 2 * Math.PI;
        let a = S.amp[b.key];
        if (b.key === 'alpha') a *= CH_ALPHA[ch];
        if (b.key === 'theta' || b.key === 'gamma') a *= deqi;
        v += a * Math.sin(al[bi]);
      }
      v += rand(-1, 1) * CH_NOISE[ch] * 1.6;
      if (ch === 0 || ch === 1) v += blink;
      v += art * rand(0.5, 1);
      out[ch] = v;
    }
    return out;
  }

  /* ---------------- 由信号计算指标 ---------------- */
  function latest(n) {
    const out = [];
    for (let ch = 0; ch < 8; ch++) {
      const arr = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const idx = (S.head - n + i + CAP) % CAP;
        arr[i] = S.buffers[ch][idx];
      }
      out.push(arr);
    }
    return out;
  }

  function computeBandPowers(chBuf) {
    const abs = { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 };
    const perCh = [];
    const hann = new Float32Array(FFT_N);
    for (let i = 0; i < FFT_N; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_N - 1));

    for (let ch = 0; ch < 8; ch++) {
      const re = new Float64Array(FFT_N);
      const im = new Float64Array(FFT_N);
      let mean = 0;
      for (let i = 0; i < FFT_N; i++) mean += chBuf[ch][i];
      mean /= FFT_N;
      for (let i = 0; i < FFT_N; i++) re[i] = (chBuf[ch][i] - mean) * hann[i];
      fft(re, im);
      const chBands = { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 };
      const df = FS / FFT_N;
      for (let k = 1; k < FFT_N / 2; k++) {
        const f = k * df;
        if (f < 0.5 || f > 45) continue;
        const p = re[k] * re[k] + im[k] * im[k];
        for (const b of BANDS) {
          if (f >= b.lo && f < b.hi) { chBands[b.key] += p; break; }
        }
      }
      for (const b of BANDS) abs[b.key] += chBands[b.key];
      // 前额 α 用于情绪偏侧
      perCh.push(chBands);
    }
    const rel = {};
    const sumAll = BANDS.reduce((s, b) => s + abs[b.key], 0) || 1;
    for (const b of BANDS) rel[b.key] = abs[b.key] / sumAll;
    return { abs, rel, perCh: perCh };
  }

  function buildMetrics() {
    const chBuf = latest(FFT_N);
    const bp = computeBandPowers(chBuf);
    const abs = bp.abs, rel = bp.rel;

    const alphaBeta = abs.alpha / Math.max(abs.beta, 1e-9);
    const thetaBeta = abs.theta / Math.max(abs.beta, 1e-9);
    const atb = (abs.alpha + abs.theta) / Math.max(abs.beta, 1e-9);
    const faa = (bp.perCh[0].alpha - bp.perCh[1].alpha) /
      Math.max(bp.perCh[0].alpha + bp.perCh[1].alpha, 1e-9);

    const ph = S.phase;
    const prog = clamp(S.phaseT / Math.max(PHASE_MAP[ph].dur, 1), 0, 1);
    const therapy = ph === 'baseline' || ph === 'idle' ? 0
      : ph === 'insert' ? 0.15
        : ph === 'retain' ? 0.25 + 0.75 * clamp(S.phaseT / 36, 0, 1)
          : 1;

    // ---- 脑电维度：相对基线的 α/β 改善 ----
    const abBase = S.baselineAB || alphaBeta;
    const ratio = alphaBeta / Math.max(abBase, 1e-9);
    // α/β 功率比从基线约 1.5 升到针刺中约 2.6，对应得分 ~48 → ~65
    let eegScore = 48 + 20 * Math.log2(Math.max(ratio, 0.25));
    eegScore = clamp(eegScore, 0, 100);

    // ---- 生理维度：生理 HRV 提升 ----
    let physiologyScore = 55 + 16 * therapy + rand(-1.2, 1.2);

    // ---- 主观维度：VAS / 得气（可手动调）----
    let vas = S.ui.vas, deqiSelf = S.ui.deqi, symptomImp = S.ui.symptomImp;
    if (!S.ui.manual) {
      if (ph === 'idle') { vas = 7; deqiSelf = 0; symptomImp = 2; }
      else if (ph === 'baseline') { vas = 7; deqiSelf = 0; symptomImp = 2; }
      else if (ph === 'insert') { vas = 6.4; deqiSelf = 2; symptomImp = 3; }
      else if (ph === 'retain') { vas = 7 - 2.6 * clamp(S.phaseT / 30, 0, 1); deqiSelf = 3.6 * clamp(S.phaseT / 8, 0, 1); symptomImp = 2 + 3 * clamp(S.phaseT / 25, 0, 1); }
      else { vas = 4.2; deqiSelf = 3.8; symptomImp = 5.4; }
      S.ui.vas = vas; S.ui.deqi = deqiSelf; S.ui.symptomImp = symptomImp;
    }
    let subjectiveScore = clamp(100 - vas * 8 + deqiSelf * 3.2, 0, 100);

    // ---- 中医症状维度 ----
    let tcmScore = clamp(40 + 22 * therapy + symptomImp * 1.5, 0, 100);

    // ---- 四维状态 ----
    const relaxation = clamp(8 + rel.alpha * 115 + rnd1(), 0, 100);
    const focus = clamp(28 + rel.beta * 120 - rel.theta * 40 + rnd1(), 0, 100);
    const fatigue = clamp(92 - rel.alpha * 120 + rel.delta * 70 + rnd1(), 0, 100);
    const emotion = clamp(52 + faa * 120, 0, 100);

    // ---- AEQI 四维加权 ----
    const weights = { eeg: 0.60, physiology: 0.10, subjective: 0.15, tcm: 0.15 };
    const parts = {
      eeg: clamp(eegScore, 0, 100),
      physiology: clamp(physiologyScore, 0, 100),
      subjective: clamp(subjectiveScore, 0, 100),
      tcm: clamp(tcmScore, 0, 100),
    };
    let aeqi = 0;
    for (const k in weights) aeqi += weights[k] * parts[k];
    aeqi = clamp(aeqi + (Math.random() - 0.5) * 0.6, 0, 100);

    const level = levelOf(aeqi);
    const vsBaseline = S.baselineEval
      ? {
        aeqi_delta: +(aeqi - S.baselineEval.aeqi).toFixed(1),
        baseline_aeqi: +S.baselineEval.aeqi.toFixed(1),
        minutes_since: +(((S.t - (S.baselineEval.t || 0)) / 60)).toFixed(0),
      }
      : null;

    const quality = 0.93 + Math.random() * 0.06;
    const impedance = CH_NAMES.map((_, i) => +(4 + (i % 3) * 0.8 + Math.random() * 1.6).toFixed(1));

    return {
      phase: ph,
      phaseLabel: PHASE_MAP[ph].label,
      phaseProgress: prog,
      elapsed: +S.t.toFixed(1),
      rel, abs,
      alphaByCh: bp.perCh.map((c) => c.alpha),
      alphaBeta: +alphaBeta.toFixed(2),
      thetaBeta: +thetaBeta.toFixed(2),
      alphaThetaBeta: +atb.toFixed(2),
      faa: +faa.toFixed(3),
      eegScore: +eegScore.toFixed(1),
      physiologyScore: +physiologyScore.toFixed(1),
      subjectiveScore: +subjectiveScore.toFixed(1),
      tcmScore: +tcmScore.toFixed(1),
      aeqi: +aeqi.toFixed(1),
      level,
      dims: {
        relaxation: { score: Math.round(relaxation), verdict: relaxation >= 60 ? '放松' : relaxation >= 40 ? '一般' : '紧张', confidence: +(quality * 0.98).toFixed(2) },
        focus: { score: Math.round(focus), verdict: focus >= 60 ? '专注' : focus >= 40 ? '一般' : '分心', confidence: +(quality * 0.93).toFixed(2) },
        fatigue: { score: Math.round(fatigue), verdict: fatigue >= 60 ? '疲劳' : fatigue >= 40 ? '一般' : '精神', confidence: +(quality * 0.9).toFixed(2) },
        emotion: { score: Math.round(emotion), verdict: emotion >= 60 ? '积极平稳' : emotion >= 40 ? '一般' : '紧张焦虑', confidence: +(quality * 0.86).toFixed(2) },
      },
      quality: +quality.toFixed(2),
      impedance,
      vsBaseline,
      ui: { vas: +vas.toFixed(1), deqi: +deqiSelf.toFixed(1), symptomImp: +symptomImp.toFixed(1) },
      weights,
      parts,
    };
  }

  function rnd1() { return (Math.random() - 0.5) * 2; }

  /* ---------------- 阶段机 ---------------- */
  function pushEval(isBaseline) {
    const m = S.metrics;
    if (!m) return;
    const ev = {
      t: S.t,
      phase: m.phase,
      phaseLabel: m.phaseLabel,
      aeqi: m.aeqi,
      level: m.level,
      eeg: m.eegScore,
      physiology: m.physiologyScore,
      subjective: m.subjectiveScore,
      tcm: m.tcmScore,
      relaxation: m.dims.relaxation.score,
      focus: m.dims.focus.score,
      fatigue: m.dims.fatigue.score,
      emotion: m.dims.emotion.score,
      isBaseline: !!isBaseline,
    };
    if (isBaseline) S.baselineEval = ev;
    S.evals.push(ev);
    if (S.evals.length > 150) S.evals.shift();
  }

  function setPhase(key) {
    const prev = S.phase;
    S.phase = key;
    S.phaseT = 0;
    if (key !== 'idle' && PHASE_MAP[key]) {
      S.events.push({ t: S.t, key, label: PHASE_MAP[key].label });
    }
    if (key === 'insert') { S.artifactT = 1.2; S.artifactSign = 1; }
    if (key === 'remove') { S.artifactT = 0.9; S.artifactSign = -1; }
    if (prev === 'baseline' && key === 'insert') {
      // 基线结束：把当前状态记为基线评估
      S.baselineAB = S.metrics ? S.metrics.alphaBeta : null;
      pushEval(true);
    }
    if (key === 'done') {
      S.running = false;
      S.metrics = buildMetrics();
      pushEval(false);
    }
  }

  function nextPhase() {
    const order = ['baseline', 'insert', 'retain', 'remove', 'post', 'done'];
    const i = order.indexOf(S.phase);
    if (i >= 0 && i < order.length - 1) setPhase(order[i + 1]);
  }

  function advancePhase(dt) {
    if (!S.running || S.phase === 'done') return;
    S.phaseT += dt;
    const p = PHASE_MAP[S.phase];
    let guard = 0;
    while (p && S.phaseT >= p.dur && guard < 5) {
      const over = S.phaseT - p.dur;
      nextPhase();
      if (!S.running) break;
      S.phaseT = over;
      guard++;
    }
  }

  /* ---------------- 对外接口 ---------------- */
  function start() {
    S.t = 0;
    S.running = true;
    S.evals = [];
    S.events = [];
    S.baselineEval = null;
    S.baselineAB = null;
    S.head = 0;
    S.written = 0;
    for (const b of S.buffers) b.fill(0);
    S.metrics = null;
    S.metricAcc = 0;
    S.phase = 'idle';
    S.phaseT = 0;
    S.sessionStart = Date.now();
    S.sessionId = 'DEMO-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' +
      String(Math.floor(Math.random() * 9000) + 1000);
    S.ui = { vas: 7, deqi: 0, symptomImp: 2, manual: false };
    S.amp = Object.assign({}, ENV.baseline);
    S._lastEvalT = 0;
    setPhase('baseline');
  }

  function resume() {
    if (S.phase === 'done') { start(); return; }
    S.running = true;
  }

  function pause() { S.running = false; }

  function reset() {
    S.running = false;
    S.phase = 'idle';
    S.t = 0; S.phaseT = 0;
    S.evals = []; S.events = []; S.baselineEval = null; S.baselineAB = null;
    S.metrics = null; S.metricAcc = 0;
    S.head = 0; S.written = 0;
    for (const b of S.buffers) b.fill(0);
    S.ui = { vas: 7, deqi: 0, symptomImp: 2, manual: false };
    S._lastEvalT = 0;
  }

  function setSpeed(v) { S.speed = v; }

  function setUi(key, val) {
    S.ui[key] = val;
    if (key !== 'manual') S.ui.manual = true;
  }

  /** 主循环每帧调用：realDt 为真实秒数 */
  function advance(realDt) {
    S.elapsedReal += realDt;
    if (!S.running || S.phase === 'done') return;
    const dt = Math.min(realDt * S.speed, 0.6);
    const n = Math.max(1, Math.round(dt * FS));
    for (let i = 0; i < n; i++) {
      S.t += 1 / FS;
      advancePhase(1 / FS);
      if (!S.running) break;
      pushSample(nextSample(S.t));
    }
    S.metricAcc += dt;
    if (S.metricAcc >= 0.5) {
      S.metricAcc = 0;
      S.metrics = buildMetrics();
      if (S.phase !== 'baseline' && S.evals.length < 150) {
        // 每 2 秒记录一个评估点（基线点已经在阶段切换时记过）
        if (!S._lastEvalT || S.t - S._lastEvalT >= 2) {
          S._lastEvalT = S.t;
          if (S.phase !== 'insert' || S.phaseT > 1.5) pushEval(false);
        }
      }
    }
  }

  /** 取最近 seconds 秒的波形（返回 8 个数组） */
  function waveform(seconds) {
    const n = Math.min(Math.round(seconds * FS), S.written, CAP);
    const out = [];
    for (let ch = 0; ch < 8; ch++) {
      const arr = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const idx = (S.head - n + i + CAP) % CAP;
        arr[i] = S.buffers[ch][idx];
      }
      out.push(arr);
    }
    return out;
  }

  function historySessions() {
    const now = Date.now();
    const mk = (id, daysAgo, name, disease, start, end, base, peak) => ({
      id, name, disease, startAt: now - daysAgo * 864e5,
      durationMin: 30,
      baseline: base, peak,
      evals: Array.from({ length: 8 }, (_, i) => {
        const p = i / 7;
        return { t: i * 150, aeqi: +(base + (peak - base) * p + Math.sin(i) * 0.8).toFixed(1) };
      }),
      level: levelOf(peak),
    });
    return [
      mk('DEMO-20261028-1042', 6, '演示记录 01 · 百会 + 印堂', '合成信号', 0, 30, 52.4, 63.8),
      mk('DEMO-20261030-1518', 4, '演示记录 02 · 百会 + 印堂', '合成信号', 0, 30, 56.1, 69.4),
      mk('DEMO-20261101-0915', 2, '演示记录 03 · 风池 + 颈夹脊', '合成信号', 0, 30, 49.7, 62.2),
    ];
  }

  global.Sim = {
    FS, CH_NAMES, BANDS, PHASES, PHASE_MAP, LEVELS, DIM_DEF, ENV,
    state: S,
    start, resume, pause, reset, setSpeed, setUi, advance,
    waveform, getMetrics: () => S.metrics, historySessions, levelOf,
    fmt, clamp,
  };
}(window));
