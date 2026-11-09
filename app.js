/* ============================================================
   针尖上的脑电波 —— 互动科普实验室：界面与演示流程
   ============================================================ */
(function (global) {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const fmt = (v, n) => (v == null || isNaN(v) ? '—' : Number(v).toFixed(n == null ? 1 : n));

  const NAV = [
    { key: 'dashboard', icon: '◈', label: '互动总览' },
    { key: 'eeg', icon: '∿', label: '看懂波形' },
    { key: 'eval', icon: '◎', label: '读懂指标' },
    { key: 'lab', icon: '✎', label: '动手调一调' },
    { key: 'state', icon: '✦', label: '脑状态' },
    { key: 'tcm', icon: '医', label: '针灸卡片' },
    { key: 'method', icon: '⚖', label: '科学方法' },
    { key: 'history', icon: '⟲', label: '实验记录' },
    { key: 'report', icon: '▤', label: '实验报告' },
  ];

  const App = {
    current: 'dashboard',
    reportSource: { type: 'current' },
    selectedHistory: null,
    lastRender: 0,
    lastUi: 0,
  };

  /* ================= 页面模板 ================= */
  function pageDashboard() {
    return `
      <div class="page-head">
        <div>
          <div class="page-eyebrow">Start Here</div>
          <div class="page-title">互动总览</div>
          <div class="page-sub">本页面全部波形与数值由程序按生理规律合成，用于讲清楚「脑电是怎么被读出来的」</div>
        </div>
        <div class="right">
          <span class="pill" id="dash-phase">待机</span>
          <span class="pill" id="dash-session">记录 —</span>
        </div>
      </div>
      <div class="card start-card" id="start-card">
        <div class="start-kicker">READY · 等待开始</div>
        <div class="start-title">开始一次「针灸过程脑电观察」演示</div>
        <div class="start-desc">
          点击后按 基线采集 → 进针 → 留针 → 起针 → 复评 的顺序播放约 69 秒，
          你会看到波形、频段功率和各项指标如何随之变化。<br>
          <b>请注意：这是一次原理演示，不是疗效证据。</b>看完可以到「科学方法」页了解为什么。
        </div>
        <button class="btn btn-primary btn-start-big" id="btn-start-big">开始演示</button>
        <div class="start-note">无需联网 · 全部在本地浏览器中运行</div>
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="card-title"><span class="dot"></span>演示阶段
          <span class="extra" id="dash-phase-clock">—</span>
        </div>
        <div class="timeline" id="dash-timeline"></div>
      </div>
      <div class="grid grid-main">
        <div>
          <div class="card">
            <div class="card-title"><span class="dot"></span>8 通道脑电波形
              <span class="extra">250 Hz · ±70 μV</span>
            </div>
            <div class="canvas-wrap"><canvas id="dash-wave" style="height:220px"></canvas></div>
            <div class="canvas-legend" id="dash-wave-legend"></div>
          </div>
          <div class="card">
            <div class="card-title"><span class="dot"></span>脑电特征指数（BFI）变化
              <span class="extra" id="dash-trend-extra">—</span>
            </div>
            <div class="canvas-wrap"><canvas id="dash-trend" style="height:190px"></canvas></div>
          </div>
        </div>
        <div>
          <div class="card gold">
            <div class="card-title"><span class="dot"></span>脑电特征指数（BFI）</div>
            <div class="gauge-box">
              <canvas id="dash-gauge" style="height:190px"></canvas>
              <span id="dash-level" class="level-tag level-effective">待观察</span>
              <div class="baseline-line" id="dash-baseline">—</div>
            </div>
            <div class="hint" style="margin-top:8px">BFI 只把几个脑电特征压成一个 0–100 的演示分数，用来说明「指标可以这样算」，不代表任何疗效判断。</div>
          </div>
          <div class="card">
            <div class="card-title"><span class="dot"></span>四个脑状态指标</div>
            <div class="canvas-wrap"><canvas id="dash-radar" style="height:200px"></canvas></div>
          </div>
        </div>
      </div>
      <div class="grid grid-4 mt16">
        <div class="metric"><div class="metric-value" id="dash-quality">—</div><div class="metric-label">信号质量</div></div>
        <div class="metric green"><div class="metric-value" id="dash-impedance">—</div><div class="metric-label">平均电极阻抗 (kΩ)</div></div>
        <div class="metric gold"><div class="metric-value" id="dash-ab">—</div><div class="metric-label">当前 α/β 比值</div></div>
        <div class="metric amber"><div class="metric-value" id="dash-fps">250<small>Hz</small></div><div class="metric-label">采样率</div></div>
      </div>`;
  }

  function pageEeg() {
    return `
      <div class="page-head">
        <div>
          <div class="page-eyebrow">Read The Wave</div>
          <div class="page-title">看懂波形</div>
          <div class="page-sub">国际 10-20 系统 Fp1/Fp2/F3/F4/C3/C4/O1/O2 · 250 Hz · 24 bit</div>
        </div>
        <div class="right"><span class="pill live">● 正在播放</span></div>
      </div>
      <div class="card">
        <div class="card-title"><span class="dot"></span>8 通道脑电波形
          <span class="extra">进针 / 起针时刻以虚线标注</span>
        </div>
        <div class="canvas-wrap"><canvas id="eeg-wave" style="height:330px"></canvas></div>
        <div class="canvas-legend" id="eeg-legend"></div>
      </div>
      <div class="grid grid-half mt16">
        <div class="card">
          <div class="card-title"><span class="dot"></span>频段功率占比
            <span class="extra">FFT 512 点 · 0.5–45 Hz</span>
          </div>
          <div class="canvas-wrap"><canvas id="eeg-spec" style="height:210px"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title"><span class="dot"></span>α 波地形分布
            <span class="extra">枕区 α 节律</span>
          </div>
          <div class="canvas-wrap"><canvas id="eeg-topo" style="height:250px"></canvas></div>
        </div>
      </div>
      <div class="card mt16">
        <div class="card-title"><span class="dot"></span>通道特征与电极状态</div>
        <table class="table">
          <thead><tr><th>通道</th><th>电极</th><th>α 功率（相对）</th><th>阻抗 (kΩ)</th><th>状态</th></tr></thead>
          <tbody id="eeg-table"></tbody>
        </table>
        <div class="hint" style="margin-top:10px">波形与指标由内置生理模型实时合成，不连接任何硬件；阻抗「偏高」时信号会更噪，这本身也是科普点：好数据先要好电极。</div>
      </div>`;
  }

  function pageEval() {
    return `
      <div class="page-head">
        <div>
          <div class="page-eyebrow">Read The Index</div>
          <div class="page-title">读懂指标</div>
          <div class="page-sub">把几个脑电特征按自定义权重合成一个 0–100 的演示指数（BFI）——权重是本作品自定的，未经临床验证</div>
        </div>
        <div class="right"><span class="pill" id="eval-phase">待机</span></div>
      </div>
      <div class="grid grid-main">
        <div>
          <div class="card gold">
            <div class="card-title"><span class="dot"></span>脑电特征指数（BFI）</div>
            <div style="display:flex;gap:22px;align-items:center;flex-wrap:wrap">
              <div class="gauge-box" style="flex:0 0 230px">
                <canvas id="eval-gauge" style="height:200px;width:230px"></canvas>
                <span id="eval-level" class="level-tag level-effective">待观察</span>
              </div>
              <div style="flex:1;min-width:220px">
                <div class="baseline-line" id="eval-baseline">—</div>
                <div style="font-size:11px;color:var(--text-tertiary);line-height:1.9;margin-top:10px" id="eval-conclusion">—</div>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-title"><span class="dot"></span>指标构成
              <span class="extra">演示权重 · 可自行讨论是否合理</span>
            </div>
            <div id="eval-weights"></div>
            <div class="hint" style="margin-top:10px">看到一个「综合分」时，第一件事应当是问：它由哪几项组成、每项权重多少、谁定的权重。这里把三件事都摊开给你看。</div>
          </div>
          <div class="card">
            <div class="card-title"><span class="dot"></span>分数是怎么算出来的</div>
            <div class="hint" style="line-height:2">
              1）对每个通道做 512 点 FFT，得到 δ/θ/α/β/γ 五个频段的相对功率；<br>
              2）由 α 相对功率、α/β 比值、前额 α 偏侧等特征算出「脑电特征分」；<br>
              3）与另外几项演示用参考值按权重相加，归一化到 0–100；<br>
              4）在 基线/复评 两个时点各算一次，比较「较基线变化」。<br>
              <b>注意：这只是「指标可以这样构造」的示例，不是临床量表，也不能据它判断任何治疗效果。</b>
            </div>
          </div>
        </div>
        <div>
          <div class="card">
            <div class="card-title"><span class="dot"></span>BFI 变化曲线
              <span class="extra" id="eval-trend-extra">—</span>
            </div>
            <div class="canvas-wrap"><canvas id="eval-trend" style="height:230px"></canvas></div>
          </div>
          <div class="card">
            <div class="card-title"><span class="dot"></span>指标记录
              <span class="extra" id="eval-count">0 次</span>
            </div>
            <table class="table">
              <thead><tr><th>时间</th><th>阶段</th><th>BFI</th><th>状态</th></tr></thead>
              <tbody id="eval-table"></tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  function pageLab() {
    return `
      <div class="page-head">
        <div>
          <div class="page-eyebrow">Try It Yourself</div>
          <div class="page-title">动手调一调</div>
          <div class="page-sub">拖动头部、点一个穴位落针，再看波形怎么跟着变</div>
        </div>
        <div class="right"><span class="pill" id="needle-pill">未选穴位</span></div>
      </div>
      <div class="grid grid-main">
        <div>
          <div class="card">
            <div class="card-title"><span class="dot"></span>头部模型（拖拽旋转 · 点击落针）
              <span class="extra">
                <button class="btn" id="needle-front" style="padding:2px 8px;font-size:10px">正面</button>
                <button class="btn" id="needle-clear" style="padding:2px 8px;font-size:10px;margin-left:4px">拔针</button>
              </span>
            </div>
            <div class="canvas-wrap"><canvas id="needle3d" style="height:360px;touch-action:none;cursor:grab"></canvas></div>
            <div class="canvas-legend">
              <span><span class="legend-dot" style="background:#38BDF8"></span>穴位</span>
              <span><span class="legend-dot" style="background:#34D399"></span>当前落针点</span>
              <span>共 ${ACUPOINTS.length} 个点位 · 拖拽旋转 · 点击落针</span>
            </div>
          </div>
          <div class="card">
            <div class="card-title"><span class="dot"></span>合成波形（1 秒窗口）
              <span class="extra" id="lab-wave-hint">蓝=α 成分 · 绿=β 成分 · 灰=噪声 · 白=叠加</span>
            </div>
            <div class="canvas-wrap"><canvas id="lab-wave" style="height:240px"></canvas></div>
            <div class="canvas-legend">
              <span><span class="legend-dot" style="background:#38BDF8"></span>α 成分（约 10 Hz）</span>
              <span><span class="legend-dot" style="background:#34D399"></span>β 成分（约 20 Hz）</span>
              <span><span class="legend-dot" style="background:#7C8DA6"></span>噪声</span>
              <span><span class="legend-dot" style="background:#E8F1FF"></span>叠加结果</span>
            </div>
          </div>
        </div>
        <div>
          <div class="card gold">
            <div class="card-title"><span class="dot"></span>当前穴位</div>
            <div id="needle-info"></div>
          </div>
          <div class="card">
            <div class="card-title"><span class="dot"></span>这个穴位对波形的影响
              <span class="extra">1.00 = 不变</span>
            </div>
            <div id="needle-bands"></div>
          </div>
          <div class="card">
            <div class="card-title"><span class="dot"></span>滑杆微调</div>
            <div class="slider-row"><label>α 成分强度</label><input id="p-alpha" type="range" min="0" max="1" step="0.05" value="0.6"><output id="o-alpha">0.60</output></div>
            <div class="slider-row"><label>β 成分强度</label><input id="p-beta" type="range" min="0" max="1" step="0.05" value="0.3"><output id="o-beta">0.30</output></div>
            <div class="slider-row"><label>噪声强度</label><input id="p-noise" type="range" min="0" max="1" step="0.05" value="0.2"><output id="o-noise">0.20</output></div>
            <div class="hint">滑杆调的是「底子」，穴位调的是在这个底子上乘一个倍数。</div>
          </div>
        </div>
      </div>
      <div class="card mt16">
        <div class="card-title"><span class="dot"></span>怎么读 · 试着回答</div>
        <div class="hint" style="line-height:2">
          真实脑电是无数神经活动的叠加，肉眼只是一条乱七八糟的曲线；把它拆成「哪个频率的成分多」需要 <b>傅里叶变换</b>，这就是「看懂波形」页频段功率图的来源。<br><br>
          · 把 α 调到 1、噪声调到 0，波形像什么？和「闭眼放松时后枕部 α 节律增强」对得上吗？<br>
          · 先选一个穴位（比如百会），再拔针，波形有什么变化？变化的是哪条曲线？<br>
          · 把噪声调到 1，还能看出 10 Hz 节律吗？看不出该用什么方法？<br>
          · 如果要把「选 A 穴和选 B 穴效果不同」写成结论，还缺什么？
        </div>
      </div>`;
  }

  /* ================= 3D 扎针（自研极简 3D：点云 + 透视投影，无第三方库） ================= */
  const HEAD_R = { x: 0.78, y: 0.98, z: 0.84 };

  const ACUPOINTS = [
    { key: 'gv20', name: '百会', code: 'GV20', p: [0, 0.97, 0.06],
      loc: '头顶正中线与两耳尖连线交点', eeg: '中线顶部，靠近 Cz 上方区域',
      eff: { delta: 1.0, theta: 1.10, alpha: 1.25, beta: 0.85, gamma: 1.0 } },
    { key: 'gv24', name: '神庭', code: 'GV24', p: [0, 0.60, 0.74],
      loc: '前发际正中直上 0.5 寸', eeg: '前额中线，接近 Fp1/Fp2 之间',
      eff: { delta: 1.0, theta: 1.05, alpha: 1.18, beta: 0.92, gamma: 1.10 } },
    { key: 'exhn3', name: '印堂', code: 'EX-HN3', p: [0, 0.26, 0.86],
      loc: '两眉头连线中点', eeg: '前额区，对应 Fp1/Fp2，易受眼动干扰',
      eff: { delta: 1.05, theta: 1.0, alpha: 1.15, beta: 0.90, gamma: 1.20 } },
    { key: 'exhn5l', name: '太阳（左）', code: 'EX-HN5', p: [-0.70, 0.24, 0.44],
      loc: '眉梢与目外眦之间向后约一横指', eeg: '颞侧，接近 F7/T3 方向',
      eff: { delta: 1.0, theta: 1.05, alpha: 1.10, beta: 0.80, gamma: 1.0 } },
    { key: 'exhn5r', name: '太阳（右）', code: 'EX-HN5', p: [0.70, 0.24, 0.44],
      loc: '眉梢与目外眦之间向后约一横指', eeg: '颞侧，接近 F8/T4 方向',
      eff: { delta: 1.0, theta: 1.05, alpha: 1.10, beta: 0.80, gamma: 1.0 } },
    { key: 'gb8l', name: '率谷（左）', code: 'GB8', p: [0.72, 0.60, 0.06],
      loc: '耳尖直上入发际 1.5 寸', eeg: '颞顶区，接近 T3/P3 方向',
      eff: { delta: 1.0, theta: 1.10, alpha: 1.05, beta: 0.85, gamma: 1.0 } },
    { key: 'gb8r', name: '率谷（右）', code: 'GB8', p: [-0.72, 0.60, 0.06],
      loc: '耳尖直上入发际 1.5 寸', eeg: '颞顶区，接近 T4/P4 方向',
      eff: { delta: 1.0, theta: 1.10, alpha: 1.05, beta: 0.85, gamma: 1.0 } },
    { key: 'gb20l', name: '风池（左）', code: 'GB20', p: [-0.34, -0.26, -0.80],
      loc: '枕骨下，胸锁乳突肌与斜方肌之间凹陷', eeg: '后枕区，靠近 α 节律最明显的位置',
      eff: { delta: 1.05, theta: 1.15, alpha: 1.22, beta: 0.90, gamma: 1.0 } },
    { key: 'gb20r', name: '风池（右）', code: 'GB20', p: [0.34, -0.26, -0.80],
      loc: '枕骨下，胸锁乳突肌与斜方肌之间凹陷', eeg: '后枕区，靠近 α 节律最明显的位置',
      eff: { delta: 1.05, theta: 1.15, alpha: 1.22, beta: 0.90, gamma: 1.0 } },
    { key: 'st8l', name: '头维（左）', code: 'ST8', p: [-0.62, 0.56, 0.46],
      loc: '额角发际直上 0.5 寸', eeg: '额区外侧，接近 F3 前上方',
      eff: { delta: 1.0, theta: 1.0, alpha: 1.08, beta: 0.88, gamma: 1.05 } },
    { key: 'st8r', name: '头维（右）', code: 'ST8', p: [0.62, 0.56, 0.46],
      loc: '额角发际直上 0.5 寸', eeg: '额区外侧，接近 F4 前上方',
      eff: { delta: 1.0, theta: 1.0, alpha: 1.08, beta: 0.88, gamma: 1.05 } },
  ];

  const Needle = {
    yaw: 0.45, pitch: -0.10, sel: -1, hover: -1,
    insert: 0, drag: null, last: 0, pts: null,
  };

  function needleModelPoints() {
    if (Needle.pts) return Needle.pts;
    const out = [];
    // 头部：费波那契球采样
    const N = 700;
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const th = Math.PI * (3 - Math.sqrt(5)) * i;
      out.push([Math.cos(th) * r * HEAD_R.x, y * HEAD_R.y, Math.sin(th) * r * HEAD_R.z]);
    }
    // 耳朵：两侧小椭球
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 70; i++) {
        const y = 1 - (i / 69) * 2;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const th = Math.PI * (3 - Math.sqrt(5)) * i;
        out.push([
          sx * (0.74 + Math.cos(th) * r * 0.08),
          0.02 + y * 0.20,
          -0.02 + Math.sin(th) * r * 0.13,
        ]);
      }
    }
    // 颈部：圆柱侧面网格
    for (let row = 0; row < 6; row++) {
      const yy = -0.92 - row * 0.055;
      const rr = 0.30 - row * 0.004;
      for (let i = 0; i < 44; i++) {
        const th = (i / 44) * Math.PI * 2;
        out.push([Math.cos(th) * rr, yy, Math.sin(th) * rr * 0.86]);
      }
    }
    // 肩部：椭圆渐扩网格
    for (let row = 0; row < 7; row++) {
      const p = row / 6;                       // 0 靠近脖子 → 1 外沿
      const yy = -1.26 - p * 0.30 - Math.sin(p * Math.PI) * 0.04;
      const rx = 0.34 + p * 0.95;
      const rz = 0.30 + p * 0.42;
      for (let i = 0; i < 52; i++) {
        const th = (i / 52) * Math.PI * 2;
        out.push([Math.cos(th) * rx, yy, Math.sin(th) * rz]);
      }
    }
    Needle.pts = out;
    return out;
  }

  function needleRot(p) {
    const cy = Math.cos(Needle.yaw), sy = Math.sin(Needle.yaw);
    const cp = Math.cos(Needle.pitch), sp = Math.sin(Needle.pitch);
    const x = p[0] * cy + p[2] * sy;
    const z = -p[0] * sy + p[2] * cy;
    const y = p[1] * cp - z * sp;
    const z2 = p[1] * sp + z * cp;
    return [x, y, z2];
  }

  function needleProject(w, h) {
    const cx = w / 2, cy = h * 0.50, scale = Math.min(w, h) * 0.30;
    return (p) => {
      const r = needleRot(p);
      const s = scale / (1 - r[2] * 0.16);
      return { x: cx + r[0] * s, y: cy - r[1] * s, z: r[2], s };
    };
  }

  function needleDraw(dt) {
    const cv = $('#needle3d');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const wantIn = Needle.sel >= 0 ? 1 : 0;
    Needle.insert += (wantIn - Needle.insert) * Math.min(1, dt * 4.5);

    const project = needleProject(w, h);
    const cx = w / 2, cy = h * 0.50;

    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(w, h) * 0.55);
    g.addColorStop(0, 'rgba(56,189,248,.09)');
    g.addColorStop(1, 'rgba(56,189,248,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const pts = needleModelPoints().map((p) => ({ ...project(p) })).sort((a, b) => a.z - b.z);
    for (const q of pts) {
      const depth = (q.z + 1.2) / 2.4;
      const a = 0.06 + depth * 0.30;
      const size = 0.7 + depth * 1.15;
      ctx.fillStyle = `rgba(${q.z > 0 ? '150,215,255' : '90,130,180'},${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(q.x, q.y, size, 0, Math.PI * 2); ctx.fill();
    }

    const marks = ACUPOINTS.map((a, i) => ({ ...project(a.p), i, a })).sort((m, n) => m.z - n.z);
    for (const m of marks) {
      const front = m.z > -0.10;
      if (!front && m.i !== Needle.sel) continue;
      const isSel = m.i === Needle.sel;
      const isHover = m.i === Needle.hover;
      const r = isSel ? 7.5 : isHover ? 6 : 4.2;
      const color = isSel ? '#34D399' : '#38BDF8';
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = isSel ? 16 : 9;
      ctx.fillStyle = color;
      ctx.globalAlpha = front ? 0.95 : 0.35;
      ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (isSel || isHover || front) {
        ctx.font = '11px "Microsoft YaHei"';
        ctx.fillStyle = isSel ? '#A7F3D0' : 'rgba(200,220,245,.78)';
        ctx.textAlign = 'left';
        ctx.fillText(m.a.name, m.x + r + 5, m.y + 3.5);
      }
    }

    if (Needle.sel >= 0 && Needle.insert > 0.01) {
      const a = ACUPOINTS[Needle.sel];
      const L = Math.hypot(a.p[0] / HEAD_R.x, a.p[1] / HEAD_R.y, a.p[2] / HEAD_R.z) || 1;
      const n = [a.p[0] / HEAD_R.x / L, a.p[1] / HEAD_R.y / L, a.p[2] / HEAD_R.z / L];
      const out = [a.p[0] + n[0] * 0.95, a.p[1] + n[1] * 0.95, a.p[2] + n[2] * 0.95];
      const t = Needle.insert;
      const tip = [a.p[0] + n[0] * (0.95 - t * 1.10), a.p[1] + n[1] * (0.95 - t * 1.10), a.p[2] + n[2] * (0.95 - t * 1.10)];
      const P1 = project(out), P2 = project(tip);
      ctx.save();
      ctx.strokeStyle = 'rgba(226,240,255,.95)';
      ctx.lineWidth = 2.2;
      ctx.shadowColor = '#A7F3D0'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(P1.x, P1.y); ctx.lineTo(P2.x, P2.y); ctx.stroke();
      ctx.strokeStyle = 'rgba(56,189,248,.9)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(P1.x, P1.y);
      ctx.lineTo(P1.x + (P2.x - P1.x) * 0.10, P1.y + (P2.y - P1.y) * 0.10);
      ctx.stroke();
      ctx.restore();
      if (t > 0.92) {
        const ring = ((performance.now() / 900) % 1);
        ctx.strokeStyle = `rgba(52,211,153,${((1 - ring) * 0.6).toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(P2.x, P2.y, 5 + ring * 16, 0, Math.PI * 2); ctx.stroke();
      }
    }

    ctx.textAlign = 'left';
    ctx.font = '11px Consolas, monospace';
    ctx.fillStyle = 'rgba(140,165,195,.65)';
    ctx.fillText('拖拽旋转 · 点击穴位落针', 12, h - 14);
  }

  function updateNeedlePanel() {
    const info = $('#needle-info');
    const bands = $('#needle-bands');
    const pill = $('#needle-pill');
    if (!info) return;
    const a = Needle.sel >= 0 ? ACUPOINTS[Needle.sel] : null;
    if (pill) pill.textContent = a ? ('已选：' + a.name) : '未选穴位';
    if (!a) {
      info.innerHTML = `<div class="hint" style="line-height:2">拖动头部模型，点任意穴位把针插进去。<br>选中后，<b>其他页面</b>的波形也会跟着变成这个穴位对应的演示设定。</div>`;
      if (bands) bands.innerHTML = `<div class="hint">先选一个穴位</div>`;
      return;
    }
    const rows = [
      ['δ 德尔塔', a.eff.delta, '#7C8DA6'],
      ['θ 西塔', a.eff.theta, '#A78BFA'],
      ['α 阿尔法', a.eff.alpha, '#38BDF8'],
      ['β 贝塔', a.eff.beta, '#34D399'],
      ['γ 伽马', a.eff.gamma, '#FBBF24'],
    ];
    if (bands) {
      bands.innerHTML = rows.map(([label, v, color]) => {
        const pct = Math.min(100, (v / 1.4) * 100);
        const c = v > 1.02 ? '#34D399' : v < 0.98 ? '#F87171' : '#6A80A0';
        return `<div class="weight-row">
          <span class="weight-name">${label}</span>
          <span class="weight-pct" style="color:${c}">×${v.toFixed(2)}</span>
          <div class="weight-track"><div class="weight-fill" style="width:${pct.toFixed(0)}%;background:linear-gradient(90deg,${color}88,${color})"></div></div>
          <span class="weight-val" style="color:${c}">${v > 1.02 ? '↑' : v < 0.98 ? '↓' : '—'}</span>
        </div>`;
      }).join('');
    }
    info.innerHTML = `
      <div style="font-size:15px;font-weight:700;color:var(--text)">${a.name}
        <span style="font-size:11px;color:var(--text-tertiary);font-weight:400;margin-left:6px">${a.code}</span></div>
      <div class="hint" style="margin-top:8px;line-height:1.95">
        <b>传统定位：</b>${a.loc}<br>
        <b>与脑电的关系：</b>${a.eeg}
      </div>
      <div class="hint" style="margin-top:8px;padding:8px 10px;border-left:2px solid var(--amber);background:rgba(251,191,36,.07)">
        这个穴位的「频段权重」是<b>本作品自定的演示设定</b>，用来展示「不同点位可以给出不同曲线」，<b>不是实验测出来的结果</b>。
      </div>`;
  }

  function bindNeedle() {
    const cv = $('#needle3d');
    if (!cv || cv._bound) return;
    cv._bound = true;
    const pick = (ev) => {
      const r = cv.getBoundingClientRect();
      const x = ev.clientX - r.left, y = ev.clientY - r.top;
      const project = needleProject(cv.clientWidth, cv.clientHeight);
      let best = -1, bestD = 26;
      ACUPOINTS.forEach((a, i) => {
        const pp = project(a.p);
        const d = Math.hypot(pp.x - x, pp.y - y);
        if (d < bestD) { bestD = d; best = i; }
      });
      return best;
    };
    cv.addEventListener('pointerdown', (ev) => {
      try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
      Needle.drag = { x: ev.clientX, y: ev.clientY, yaw: Needle.yaw, pitch: Needle.pitch, moved: 0 };
    });
    cv.addEventListener('pointermove', (ev) => {
      if (Needle.drag) {
        const dx = ev.clientX - Needle.drag.x, dy = ev.clientY - Needle.drag.y;
        Needle.drag.moved = Math.max(Needle.drag.moved, Math.hypot(dx, dy));
        Needle.yaw = Needle.drag.yaw + dx * 0.008;
        Needle.pitch = Math.max(-0.6, Math.min(0.6, Needle.drag.pitch + dy * 0.005));
      } else {
        Needle.hover = pick(ev);
        cv.style.cursor = Needle.hover >= 0 ? 'pointer' : 'grab';
      }
    });
    const endDrag = (ev) => {
      const d = Needle.drag;
      Needle.drag = null;
      if (!d) return;
      if (d.moved < 6) {
        const i = pick(ev);
        Needle.sel = i;
        Needle.insert = 0;
        Sim.setPointEffect(i >= 0 ? ACUPOINTS[i].eff : null);
        updateNeedlePanel();
      }
    };
    cv.addEventListener('pointerup', endDrag);
    cv.addEventListener('pointercancel', () => { Needle.drag = null; });
    cv.addEventListener('pointerleave', () => { Needle.hover = -1; });

    const btnFront = $('#needle-front');
    if (btnFront) btnFront.addEventListener('click', () => {
      Needle.yaw = 0; Needle.pitch = -0.05;
    });
    const btnClear = $('#needle-clear');
    if (btnClear) btnClear.addEventListener('click', () => {
      Needle.sel = -1; Needle.insert = 0;
      Sim.setPointEffect(null);
      updateNeedlePanel();
    });
  }

  function pageMethod() {
    return `
      <div class="page-head">
        <div>
          <div class="page-eyebrow">How Science Works</div>
          <div class="page-title">科学方法</div>
          <div class="page-sub">从一个「看起来有变化」的观察，到一个能站得住的结论，中间隔着这些步骤</div>
        </div>
      </div>
      <div class="card">
        <div class="card-title"><span class="dot"></span>核心一句：相关不等于因果</div>
        <div class="hint" style="line-height:2;font-size:13px">
          在留针期间看到 α 波上升，只能说「这两件事同时发生了」。<br>
          可能是针刺带来的，也可能是<b>躺下、闭眼、安静了 10 分钟</b>带来的，还可能是<b>受试者知道自己在被观察</b>（安慰剂效应）带来的。<br>
          要区分这几种可能，必须做对照。
        </div>
      </div>
      <div class="grid grid-2 mt16">
        <div class="card"><div class="card-title"><span class="dot"></span>① 对照</div><div class="hint" style="line-height:1.95">
          设一组「不扎针、但同样躺着闭眼同样时长」的对照组。<br>如果两组α波都上升，那变化就未必与针刺有关。</div></div>
        <div class="card"><div class="card-title"><span class="dot"></span>② 随机</div><div class="hint" style="line-height:1.95">
          谁进哪一组不能自己挑，要用随机分配。<br>否则容易把「本来就放松的人」都分进针刺组，结果被高估。</div></div>
        <div class="card"><div class="card-title"><span class="dot"></span>③ 盲法</div><div class="hint" style="line-height:1.95">
          受试者不知道自己被分到哪组叫单盲；连操作者和数据分析者都不知道叫双盲。<br>目的是压住心理预期与主观判读。</div></div>
        <div class="card"><div class="card-title"><span class="dot"></span>④ 样本量与统计</div><div class="hint" style="line-height:1.95">
          一个人一次的变化说明不了什么，个体波动本来就很大。<br>要够多样本，再用统计检验判断「这个差别是否可能只是碰巧」。</div></div>
      </div>
      <div class="card mt16">
        <div class="card-title"><span class="dot"></span>针刺研究里常用的「安慰针」</div>
        <div class="hint" style="line-height:2">
          针刺很难设盲，于是研究者设计了 Sham（假针）对照：用不刺入皮肤的钝头针、或在非穴位处轻刺、或用可回缩的针具，
          让受试者感觉「扎了」，但不产生真正的刺激。比较真针与假针的差别，才能把<b>手法本身的作用</b>从<b>「被扎的感觉 + 期待」</b>中分离出来。
        </div>
      </div>
      <div class="card mt16">
        <div class="card-title"><span class="dot"></span>这份演示的局限（写清楚才算诚实）</div>
        <div class="hint" style="line-height:2">
          · 波形是程序按预设规律合成的，不是真人采集；<br>
          · 指标权重由本作品自行设定，未经专家共识与临床验证；<br>
          · 只有一个「受试者」，没有对照组、没有随机、没有统计检验；<br>
          · 因此本作品能说明「脑电可以这样被读出来」，<b>不能</b>说明针刺有什么效果。
        </div>
      </div>
      <div class="card mt16">
        <div class="card-title"><span class="dot"></span>小测验：你的判断过关吗？</div>
        <div id="quiz"></div>
      </div>`;
  }

  function pageState() {
    return `
      <div class="page-head">
        <div>
          <div class="page-eyebrow">Brain States</div>
          <div class="page-title">脑状态</div>
          <div class="page-sub">由频段相对功率与前额 α 偏侧推导 · 规则计算，不是机器学习模型</div>
        </div>
        <div class="right"><span class="pill" id="state-phase">待机</span></div>
      </div>
      <div class="grid grid-main">
        <div class="card">
          <div class="card-title"><span class="dot"></span>四维状态雷达</div>
          <div class="canvas-wrap"><canvas id="state-radar" style="height:360px"></canvas></div>
        </div>
        <div>
          <div class="grid grid-2" id="state-cards"></div>
          <div class="card mt16">
            <div class="card-title"><span class="dot"></span>判定说明</div>
            <div class="hint">放松度 ≈ α 相对功率；专注度 ≈ β/θ 结构；疲劳度 ≈ (δ+θ)/β 升高；情绪指数 ≈ 前额 α 不对称。分数 0–100，置信度随信号质量变化。</div>
          </div>
        </div>
      </div>`;
  }

  function pageTcm() {
    return `
      <div class="page-head">
        <div>
          <div class="page-eyebrow">Knowledge Cards</div>
          <div class="page-title">针灸卡片</div>
          <div class="page-sub">关于经络、穴位与「脑电怎么和针灸搭上关系」的科普卡片</div>
        </div>
        <div class="right"><span class="pill warn">科普内容 · 不作诊疗建议</span></div>
      </div>
      <div class="grid grid-half">
        <div class="card">
          <div class="card-title"><span class="dot"></span>经络是什么？</div>
          <div class="hint" style="line-height:2">
            经络是中医用来描述人体「联系与运行」的一套体系，由经脉与络脉组成，把体表、脏腑、肢体连成一个整体。
            它并非解剖学上可以直接切出来的管道，而是长期临床观察与理论建构的产物。<br>
            在现代研究中，人们尝试用脑电、功能核磁、皮肤电阻、筋膜与神经通路等角度去观察穴位的刺激效应，结论仍在积累中。
          </div>
        </div>
        <div class="card">
          <div class="card-title"><span class="dot"></span>穴位怎么找？</div>
          <div class="hint" style="line-height:2">
            传统定位靠「骨度分寸」「体表标志」和「同身寸」——用手指宽度、骨突、肌肉凹陷等体表参照来定位。<br>
            现代标准（如世界卫生组织经穴定位标准）用解剖学描述 + 骨度分寸把位置讲得更精确。同一个穴位，不同人、不同体型都会有误差。
          </div>
        </div>
      </div>
      <div class="grid grid-3 mt16">
        <div class="card"><div class="card-title"><span class="dot"></span>百会 GV20</div><div class="hint">定位：头顶正中线与两耳尖连线的交点。<br>传统认识：升阳举陷、醒脑安神。<br><b>与脑电的关系：</b>位于头顶，靠近中线电极位置，因此常被选作观察位点之一。</div></div>
        <div class="card"><div class="card-title"><span class="dot"></span>印堂 EX-HN3</div><div class="hint">定位：两眉头连线的中点。<br>传统认识：宁心安神、疏风止痛。<br><b>与脑电的关系：</b>对应前额电极 Fp1/Fp2 附近，前额区容易受眼动与肌肉伪迹干扰。</div></div>
        <div class="card"><div class="card-title"><span class="dot"></span>风池 GB20</div><div class="hint">定位：枕骨下方，胸锁乳突肌与斜方肌之间的凹陷处。<br>传统认识：平肝熄风、通利头目。<br><b>与脑电的关系：</b>位于后枕部，靠近 α 节律最明显的区域。</div></div>
      </div>
      <div class="card mt16">
        <div class="card-title"><span class="dot"></span>怎么看「留针 20 分钟」这类说法</div>
        <div class="hint" style="line-height:2">
          传统文献里对留针时长、手法（补泻）、取穴都有讲究，这是中医理论体系的一部分。<br>
          但从研究角度看，「留针多久更好」是一个需要用对照实验回答的经验问题：不同穴位、不同人群、不同病证，答案可能并不一样。<br>
          <b>本卡片只做知识介绍，不构成任何操作或治疗建议。</b>
        </div>
      </div>
      <div class="card mt16">
        <div class="card-title"><span class="dot"></span>常见误区速览</div>
        <div class="hint" style="line-height:2">
          · 「脑电有变化 = 治疗有效」——不成立，变化可能来自放松、安静、期待，也可能只是噪声。<br>
          · 「α 波升高就是好」——α 波高低与状态有关，但没有绝对的「越好越高」。<br>
          · 「越贵/越痛的针越有效」——需要证据支持，不能凭感觉。
        </div>
      </div>`;
  }

  function pageHistory() {
    return `
      <div class="page-head">
        <div>
          <div class="page-eyebrow">Records</div>
          <div class="page-title">实验记录</div>
          <div class="page-sub">每条记录是一次演示：BFI 从基线到复评的变化</div>
        </div>
        <div class="right"><span class="pill">共 <span id="hist-count">0</span> 条记录</span></div>
      </div>
      <div id="hist-list"></div>
      <div class="card mt16" id="hist-detail" style="display:none"></div>`;
  }

  function pageReport() {
    return `
      <div class="page-head">
        <div>
          <div class="page-eyebrow">Lab Report</div>
          <div class="page-title">实验报告</div>
          <div class="page-sub">把一次演示的过程、数值和「它能说明什么、不能说明什么」一起写下来</div>
        </div>
        <div class="right">
          <button class="btn" id="rep-print" style="display:none">打印 / 另存为 PDF</button>
        </div>
      </div>
      <div class="report-toolbar no-print" id="rep-hintbar" style="display:none">
        <span class="hint" id="rep-hint">提示：打印对话框中选择「另存为 PDF」即可导出。</span>
      </div>
      <div class="card start-card" id="rep-placeholder">
        <div class="start-kicker">REPORT · 待生成</div>
        <div class="start-title">实验报告</div>
        <div class="start-desc" id="rep-placeholder-desc">
          点击下方按钮，把本次演示的阶段、脑电特征指数与指标构成整理成一页可打印的检验记录。
        </div>
        <button class="btn btn-primary btn-start-big" id="rep-generate">生成报告</button>
        <div class="start-note">预计耗时 2–3 秒</div>
        <div id="rep-progress" style="display:none;max-width:520px;margin:18px auto 0">
          <div class="gen-track"><div class="gen-fill" id="rep-progress-fill"></div></div>
          <div class="gen-status" id="rep-progress-status">正在汇总实验数据…</div>
        </div>
      </div>
      <div class="report-paper" id="report-paper" style="display:none"></div>`;
  }

  const PAGE_FN = { dashboard: pageDashboard, eeg: pageEeg, eval: pageEval, lab: pageLab, needle: pageLab, state: pageState, tcm: pageTcm, method: pageMethod, history: pageHistory, report: pageReport };

  /* ================= 初始化 ================= */
  function buildNav() {
    const nav = $('#nav');
    nav.innerHTML = NAV.map((n) =>
      `<div class="nav-item" data-page="${n.key}"><span class="ico">${n.icon}</span>${n.label}</div>`
    ).join('') + `
      <div class="nav-sep"></div>
      <div class="nav-foot">
        v2.0 · 科普版<br>
        脑电原理互动演示<br>
        不涉及诊疗与疗效
      </div>`;
    nav.addEventListener('click', (e) => {
      const item = e.target.closest('.nav-item');
      if (item) go(item.dataset.page);
    });
  }

  function buildMain() {
    const main = $('#main');
    main.innerHTML = NAV.map((n) => `<section class="page" id="page-${n.key}" style="display:none">${PAGE_FN[n.key]()}</section>`).join('');
    $$('.page').forEach((p) => { p.style.display = 'none'; });
  }

  function go(key) {
    if (key === 'needle') key = 'lab';   // 旧的「3D 扎针」页已并入动手调一调
    if (!PAGE_FN[key]) key = 'dashboard';
    App.current = key;
    $$('.nav-item').forEach((el) => el.classList.toggle('active', el.dataset.page === key));
    $$('.page').forEach((el) => { el.style.display = el.id === 'page-' + key ? '' : 'none'; });
    if (key === 'history') renderHistory();
    if (key === 'report') prepareReport();
    if (key === 'tcm') renderTcm();
    render(0, true);
  }

  /* ================= 顶部控制 ================= */
  function startTest() {
    Sim.start();
    App.reportSource = { type: 'current' };
    const pause = $('#btn-pause');
    if (pause) { pause.disabled = false; pause.textContent = '暂停'; }
    go('dashboard');
    toast('演示已开始：基线采集 → 进针 → 留针 → 起针 → 复评');
  }

  function bindControls() {
    $('#btn-start').addEventListener('click', startTest);
    const big = document.getElementById('btn-start-big');
    if (big) big.addEventListener('click', startTest);
    $('#btn-pause').addEventListener('click', () => {
      const s = Sim.state;
      if (s.running) { Sim.pause(); $('#btn-pause').textContent = '继续'; }
      else if (s.phase !== 'idle' && s.phase !== 'done') { Sim.resume(); $('#btn-pause').textContent = '暂停'; }
    });
    $('#btn-reset').addEventListener('click', () => {
      Sim.reset();
      App.reportSource = { type: 'current' };
      $('#btn-pause').textContent = '暂停';
      $('#btn-pause').disabled = true;
      go('dashboard');
    });
    $('#speed-group').addEventListener('click', (e) => {
      const b = e.target.closest('.speed');
      if (!b) return;
      Sim.setSpeed(Number(b.dataset.speed));
      $$('.speed').forEach((x) => x.classList.toggle('active', x === b));
    });
    window.addEventListener('hashchange', () => {
      const key = location.hash.replace('#', '');
      if (key && key !== App.current) go(key);
    });
    const gen = document.getElementById('rep-generate');
    if (gen) gen.addEventListener('click', () => generateReport(false));
  }

  /* ---- 动手调一调：合成波形教学演示 ---- */
  const Lab = { alpha: 0.6, beta: 0.3, noise: 0.2, t: 0, am: 1, bm: 1 };

  function bindLab() {
    const bind = (id, out, key) => {
      const el = $('#' + id);
      if (!el) return;
      el.addEventListener('input', () => {
        Lab[key] = Number(el.value);
        const o = $('#' + out);
        if (o) o.textContent = Number(el.value).toFixed(2);
      });
    };
    bind('p-alpha', 'o-alpha', 'alpha');
    bind('p-beta', 'o-beta', 'beta');
    bind('p-noise', 'o-noise', 'noise');
  }

  function renderLab() {
    const cv = $('#lab-wave');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const mid = h / 2;
    const amp = h * 0.36;
    const sec = 1;                     // 1 秒窗口
    const n = 600;
    Lab.t += 0.016;
    const t0 = Lab.t;

    // 网格
    ctx.strokeStyle = 'rgba(255,255,255,.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = (w * i) / 10;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }

    const drawTrace = (fn, color, width, alpha) => {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const x = (i / n) * w;
        const t = t0 + (i / n) * sec;
        const y = mid - fn(t) * amp;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha == null ? 1 : alpha;
      ctx.lineWidth = width;
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    // 穴位影响：把该穴位设定的频段权重平滑地乘到 α / β 成分上
    const pe = Needle.sel >= 0 ? ACUPOINTS[Needle.sel].eff : null;
    Lab.am += ((pe ? pe.alpha : 1) - Lab.am) * 0.12;
    Lab.bm += ((pe ? pe.beta : 1) - Lab.bm) * 0.12;

    const aWave = (t) => Math.sin(2 * Math.PI * 10 * t) * Lab.alpha * 0.55 * Lab.am;
    const bWave = (t) => Math.sin(2 * Math.PI * 20 * t) * Lab.beta * 0.35 * Lab.bm;
    const nWave = (t) => (Math.sin(2 * Math.PI * 37 * t) * 0.5 + Math.sin(2 * Math.PI * 53 * t) * 0.5) * Lab.noise * 0.5;

    drawTrace(aWave, '#38BDF8', 1.2, 0.55);
    drawTrace(bWave, '#34D399', 1.2, 0.55);
    drawTrace(nWave, '#7C8DA6', 1, 0.5);
    drawTrace((t) => aWave(t) + bWave(t) + nWave(t), '#E8F1FF', 1.8, 1);

    ctx.fillStyle = 'rgba(232,241,255,.55)';
    ctx.font = '10px Consolas, monospace';
    ctx.fillText('+1', 6, 12);
    ctx.fillText('-1', 6, h - 6);
    ctx.fillText('1 秒', w - 34, h - 6);
  }

  /* ---- 科学方法：小测验 ---- */
  const QUIZ = [
    {
      q: '某次演示中留针期间 α 波上升了，下面哪句话是站得住的？',
      opts: [
        { t: '针刺让大脑放松了，说明有效', ok: false },
        { t: '这次观察里 α 波比基线高，但原因还需要对照实验才能判断', ok: true },
        { t: 'α 波上升就是疗效指标', ok: false },
      ],
      why: '只观察到两件事同时发生，不能推出因果。躺下闭眼、安静等待、被观察的期待都可能带来同样的变化。',
    },
    {
      q: '为什么针刺研究里要设计「假针 / Sham」对照？',
      opts: [
        { t: '为了让实验看起来更专业', ok: false },
        { t: '为了把「真刺入的刺激」和「被扎的感觉 + 期待」分开', ok: true },
        { t: '因为假针比真针更安全', ok: false },
      ],
      why: '针刺难以对受试者设盲，Sham 对照用来剥离心理预期与体感带来的影响。',
    },
    {
      q: '只有 1 个人、1 次演示，最合理的结论是？',
      opts: [
        { t: '可以推广到所有人', ok: false },
        { t: '先把它当成一次方法演示，个体差异和波动都还没有被排除', ok: true },
        { t: '只要数值变化大就说明有效', ok: false },
      ],
      why: '样本量太小，个体波动本来就会产生大幅变化，需要更多样本和统计检验。',
    },
  ];

  function bindQuiz() {
    const box = $('#quiz');
    if (!box || box._bound) return;
    box._bound = true;
    box.innerHTML = QUIZ.map((item, qi) => `
      <div class="quiz-item" data-q="${qi}">
        <div class="quiz-q">${qi + 1}. ${item.q}</div>
        ${item.opts.map((o, oi) => `<button class="quiz-opt" data-q="${qi}" data-o="${oi}">${o.t}</button>`).join('')}
        <div class="quiz-why" id="quiz-why-${qi}" style="display:none"></div>
      </div>`).join('');
    box.addEventListener('click', (e) => {
      const btn = e.target.closest('.quiz-opt');
      if (!btn) return;
      const qi = Number(btn.dataset.q), oi = Number(btn.dataset.o);
      const item = QUIZ[qi];
      const why = document.getElementById('quiz-why-' + qi);
      box.querySelectorAll(`.quiz-opt[data-q="${qi}"]`).forEach((b) => b.classList.remove('right', 'wrong'));
      btn.classList.add(item.opts[oi].ok ? 'right' : 'wrong');
      if (why) {
        why.style.display = '';
        why.className = 'quiz-why ' + (item.opts[oi].ok ? 'right' : 'wrong');
        why.innerHTML = (item.opts[oi].ok ? '✔ 答对了。' : '✘ 再想想。') + item.why;
      }
    });
  }

  let toastTimer = null;
  function toast(msg) {
    let el = $('#toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.style.cssText = 'position:fixed;left:50%;bottom:52px;transform:translateX(-50%);background:rgba(17,31,52,.96);border:1px solid rgba(56,189,248,.4);color:#E8F1FF;padding:9px 18px;border-radius:9px;font-size:12px;z-index:99;box-shadow:0 8px 30px rgba(0,0,0,.4);transition:opacity .3s';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 2600);
  }

  /* ================= 渲染 ================= */
  function phaseSteps() {
    return Sim.PHASES.filter((p) => ['baseline', 'insert', 'retain', 'remove', 'post'].includes(p.key));
  }

  function renderPhase() {
    const s = Sim.state;
    const m = Sim.getMetrics();
    const clock = $('#dash-phase-clock');
    const phasePill = $('#dash-phase');
    const sessionPill = $('#dash-session');
    const tl = $('#dash-timeline');
    const simStatus = $('#sim-status');
    const simPhase = $('#sim-phase');
    const cur = s.phase;

    const stateLabel = Sim.PHASE_MAP[s.phase] ? Sim.PHASE_MAP[s.phase].label : '待机';
    if (phasePill) phasePill.textContent = '● ' + stateLabel;
    if (sessionPill) sessionPill.textContent = s.sessionId ? ('记录 ' + s.sessionId) : '记录 —';
    if (clock && m) clock.textContent = `第 ${Math.floor(s.t / 60)} 分 ${String(Math.floor(s.t % 60)).padStart(2, '0')} 秒`;
    else if (clock) clock.textContent = '—';
    if (simPhase) simPhase.textContent = '阶段：' + stateLabel;
    if (simStatus) simStatus.textContent = s.running ? '● 正在播放' : (cur === 'done' ? '演示完成 · 可重置后重播' : (cur === 'idle' ? '待机中 · 点击「开始演示」' : '已暂停'));

    if (tl) {
      const steps = phaseSteps();
      const idx = steps.findIndex((p) => p.key === cur);
      tl.innerHTML = steps.map((p, i) => {
        const done = cur === 'done' || i < idx;
        const active = i === idx && cur !== 'done';
        let bar = '';
        if (active) {
          const prog = Math.min(1, s.phaseT / p.dur);
          bar = `<div class="tl-bar" style="width:${(prog * 100).toFixed(1)}%"></div>`;
        }
        return `<div class="tl-step ${done ? 'done' : ''} ${active ? 'active' : ''}">
          <div class="tl-name">${p.label}</div>
          <div class="tl-desc">${p.desc}</div>${bar}</div>`;
      }).join('');
    }

    const startCard = $('#start-card');
    if (startCard) startCard.style.display = (cur === 'idle') ? '' : 'none';
    const btnStart = $('#btn-start');
    if (btnStart) btnStart.textContent = (cur === 'idle' || cur === 'done') ? '开始演示' : '重新演示';
    const btnPause = $('#btn-pause');
    if (btnPause) btnPause.disabled = !s.running && (cur === 'idle' || cur === 'done');

    ['eval-phase', 'state-phase'].forEach((id) => {
      const el = $('#' + id);
      if (el) el.textContent = stateLabel;
    });
  }

  function renderDashboard() {
    const m = Sim.getMetrics();
    const s = Sim.state;
    // 波形
    Charts.drawWave($('#dash-wave'), Sim.waveform(3), {
      seconds: 3, totalSeconds: s.t, events: s.events.slice(-4), showValues: true,
    });
    const legend = $('#dash-wave-legend');
    if (legend) legend.innerHTML = Sim.CH_NAMES.map((n, i) =>
      `<span><span class="legend-dot" style="background:${['#7DD3FC', '#38BDF8', '#A78BFA', '#C4B5FD', '#34D399', '#6EE7B7', '#FBBF24', '#FCD34D'][i]}"></span>${n}</span>`
    ).join('');

    Charts.drawGauge($('#dash-gauge'), m ? m.aeqi : null, m ? m.level : null);
    Charts.drawTrend($('#dash-trend'), s.evals, {});
    Charts.drawRadar($('#dash-radar'), m ? m.dims : null);

    const set = (id, txt) => { const el = $('#' + id); if (el) el.textContent = txt; };
    set('dash-quality', m ? (m.quality * 100).toFixed(0) + '%' : '—');
    set('dash-impedance', m ? (m.impedance.reduce((a, b) => a + b, 0) / m.impedance.length).toFixed(1) : '—');
    set('dash-ab', m ? m.alphaBeta.toFixed(2) : '—');
    const trendExtra = $('#dash-trend-extra');
    if (trendExtra) trendExtra.textContent = s.evals.length ? `本次 ${s.evals.length} 个记录点` : '等待记录';

    const lv = $('#dash-level');
    if (lv) {
      if (m) { lv.textContent = m.level.label; lv.className = 'level-tag ' + m.level.cls; }
      else { lv.textContent = '待观察'; lv.className = 'level-tag level-effective'; }
    }
    const b = $('#dash-baseline');
    if (b) {
      if (m && m.vsBaseline) {
        const d = m.vsBaseline.aeqi_delta;
        b.innerHTML = `较基线 <b style="color:${d >= 0 ? '#34D399' : '#F87171'}">${d >= 0 ? '+' : ''}${d.toFixed(1)}</b>
          <span style="font-size:11px;color:var(--text-tertiary)">（基线 ${m.vsBaseline.baseline_aeqi.toFixed(1)}）</span>`;
      } else {
        b.textContent = '尚未完成基线采集';
      }
    }
  }

  function renderEeg() {
    const m = Sim.getMetrics();
    const s = Sim.state;
    Charts.drawWave($('#eeg-wave'), Sim.waveform(4), {
      seconds: 4, totalSeconds: s.t, events: s.events.slice(-4), showValues: true,
    });
    Charts.drawSpectrum($('#eeg-spec'), m);
    Charts.drawTopo($('#eeg-topo'), m);
    const tb = $('#eeg-table');
    if (!tb) return;
    const ab = m ? m.alphaBeta : 0;
    const maxA = m ? Math.max.apply(null, m.alphaByCh) || 1 : 1;
    tb.innerHTML = Sim.CH_NAMES.map((n, i) => {
      const alpha = m ? (m.alphaByCh[i] / maxA * 100).toFixed(0) + '%' : '—';
      const imp = m ? m.impedance[i].toFixed(1) : '—';
      const ok = m && parseFloat(imp) < 10;
      return `<tr><td class="mono">${i + 1}</td><td>${n}</td><td class="mono">${alpha}</td>
        <td class="mono">${imp}</td>
        <td><span class="pill ${ok ? 'live' : 'warn'}">${ok ? '良好' : '偏高'}</span></td></tr>`;
    }).join('');
    const legend = $('#eeg-legend');
    if (legend) legend.innerHTML = `<span>α/β = <b class="mono" style="color:#38BDF8">${ab ? ab.toFixed(2) : '—'}</b></span>
      <span>θ/β = ${m ? m.thetaBeta.toFixed(2) : '—'}</span>
      <span>(α+θ)/β = ${m ? m.alphaThetaBeta.toFixed(2) : '—'}</span>
      <span>前额 α 偏侧 = ${m ? m.faa.toFixed(3) : '—'}</span>`;
  }

  function renderEval() {
    const m = Sim.getMetrics();
    const s = Sim.state;
    Charts.drawGauge($('#eval-gauge'), m ? m.aeqi : null, m ? m.level : null);
    Charts.drawTrend($('#eval-trend'), s.evals, {});
    const lv = $('#eval-level');
    if (lv) {
      if (m) { lv.textContent = m.level.label; lv.className = 'level-tag ' + m.level.cls; }
      else { lv.textContent = '待观察'; lv.className = 'level-tag level-effective'; }
    }
    const base = $('#eval-baseline');
    if (base) {
      if (m && m.vsBaseline) {
        const d = m.vsBaseline.aeqi_delta;
        base.innerHTML = `较基线 <b style="color:${d >= 0 ? '#34D399' : '#F87171'}">${d >= 0 ? '+' : ''}${d.toFixed(1)}</b>
          <span style="font-size:11px;color:var(--text-tertiary)">基线 ${m.vsBaseline.baseline_aeqi.toFixed(1)} · 已完成 ${s.evals.filter((e) => !e.isBaseline).length} 次复评</span>`;
      } else base.textContent = '待完成基线采集（基线阶段结束后自动记录）';
    }
    const conc = $('#eval-conclusion');
    if (conc) {
      if (m && s.evals.length) {
        const nonBase = s.evals.filter((e) => !e.isBaseline);
        const avg = nonBase.length ? nonBase.reduce((a, b) => a + b.aeqi, 0) / nonBase.length : m.aeqi;
        const d = m.vsBaseline ? m.vsBaseline.aeqi_delta : 0;
        conc.innerHTML = `${m.phaseLabel}阶段：BFI <b>${m.aeqi.toFixed(1)}</b>（${m.level.label}），` +
          `复评均值 ${avg.toFixed(1)}，较基线 <b style="color:${d >= 0 ? '#34D399' : '#F87171'}">${d >= 0 ? '+' : ''}${d.toFixed(1)}</b>。` +
          `α/β 比值 ${m.alphaBeta.toFixed(2)}。<b>注意：这只说明信号特征变了，不能说明任何治疗效果。</b>`;
      } else {
        conc.textContent = '点击顶部「开始演示」，会依次播放 基线 → 进针 → 留针 → 起针 → 复评，并自动记录每个时点的 BFI。';
      }
    }
    // 权重条
    const wEl = $('#eval-weights');
    if (wEl) {
      const dims = [
        { key: 'eeg', label: '脑电特征', w: 60, color: '#38BDF8', v: m ? m.parts.eeg : null },
        { key: 'physiology', label: '生理参考', w: 10, color: '#34D399', v: m ? m.parts.physiology : null },
        { key: 'subjective', label: '主观参考', w: 15, color: '#A78BFA', v: m ? m.parts.subjective : null },
        { key: 'tcm', label: '中医参考', w: 15, color: '#FBBF24', v: m ? m.parts.tcm : null },
      ];
      wEl.innerHTML = dims.map((d) => `<div class="weight-row">
        <span class="weight-name">${d.label}</span>
        <span class="weight-pct">${d.w}%</span>
        <div class="weight-track"><div class="weight-fill" style="width:${d.v == null ? 0 : d.v}%;background:linear-gradient(90deg,${d.color}88,${d.color})"></div></div>
        <span class="weight-val" style="color:${d.v == null ? 'var(--text-tertiary)' : d.color}">${d.v == null ? '—' : d.v.toFixed(0)}</span>
      </div>`).join('');
    }
    // 记录表
    const tb = $('#eval-table');
    const cnt = $('#eval-count');
    if (cnt) cnt.textContent = s.evals.length + ' 次';
    if (tb) {
      const rows = s.evals.slice(-6).reverse();
      tb.innerHTML = rows.length ? rows.map((e) =>
        `<tr class="${e.isBaseline ? 'hl' : ''}"><td class="mono">${fmtSec(e.t)}</td><td>${e.isBaseline ? '基线' : e.phaseLabel}</td>
         <td class="mono" style="color:${e.level.color}">${e.aeqi.toFixed(1)}</td><td>${e.level.label}</td></tr>`
      ).join('') : '<tr><td colspan="4" style="color:var(--text-tertiary)">暂无记录</td></tr>';
    }
    const tx = $('#eval-trend-extra');
    if (tx) tx.textContent = s.evals.length ? `${s.evals.length} 个点 · 基线已标注` : '';
  }

  function fmtSec(t) {
    const mm = Math.floor(t / 60);
    const ss = Math.floor(t % 60);
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }

  function renderState() {
    const m = Sim.getMetrics();
    Charts.drawRadar($('#state-radar'), m ? m.dims : null);
    const wrap = $('#state-cards');
    if (!wrap) return;
    const defs = Sim.DIM_DEF;
    wrap.innerHTML = defs.map((d) => {
      const v = m ? m.dims[d.key] : null;
      const score = v ? v.score : 0;
      return `<div class="state-card">
        <div class="state-name">${d.label}</div>
        <div class="state-score" style="color:${d.color}">${v ? v.score : '—'}</div>
        <div class="state-verdict">${v ? (v.verdict + ' · 置信度 ' + (v.confidence * 100).toFixed(0) + '%') : '等待采集'}</div>
        <div class="mini-track"><div class="mini-fill" style="width:${score}%;background:linear-gradient(90deg,${d.color}66,${d.color})"></div></div>
      </div>`;
    }).join('');
  }

  function renderTcm() {
    // 针灸卡片页为静态科普内容，无需实时刷新
  }

  /* ================= 历史 ================= */
  function renderHistory() {
    const list = $('#hist-list');
    if (!list) return;
    const cur = Sim.state;
    const rows = [];
    if (cur.evals.length) {
      const last = cur.evals[cur.evals.length - 1];
      rows.push({
        id: cur.sessionId || 'AEQ-CURRENT',
        name: '本次演示记录',
        time: new Date().toLocaleString('zh-CN'),
        baseline: cur.baselineEval ? cur.baselineEval.aeqi : null,
        peak: last.aeqi,
        level: last.level,
        current: true,
      });
    }
    Sim.historySessions().forEach((h) => rows.push({
      id: h.id, name: h.name, time: new Date(h.startAt).toLocaleString('zh-CN'),
      baseline: h.baseline, peak: h.peak, level: h.level, current: false,
    }));
    const cnt = $('#hist-count');
    if (cnt) cnt.textContent = rows.length;
    list.innerHTML = rows.map((r, i) => {
      const delta = r.baseline != null ? (r.peak - r.baseline) : null;
      return `<div class="session-row" data-idx="${i}">
        <div><div class="name">${r.name} ${r.current ? '<span class="pill live" style="margin-left:6px">当前</span>' : ''}</div>
          <div class="muted">${r.id} · ${r.time}</div></div>
        <div><div class="muted">基线 → 复评</div><div>${r.baseline == null ? '—' : r.baseline.toFixed(1) + ' → ' + r.peak.toFixed(1)}</div></div>
        <div><div class="muted">BFI 变化</div><div style="color:#34D399">${delta == null ? '—' : (delta >= 0 ? '+' : '') + delta.toFixed(1)}</div></div>
        <div><div class="muted">特征状态</div><div style="color:${r.level.color}">${r.level.label}</div></div>
        <div><div class="muted">演示时长</div><div>69 秒</div></div>
        <div><button class="btn" data-report="${i}">查看报告</button></div>
      </div>`;
    }).join('');
    list.querySelectorAll('[data-report]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.report);
        const r = rows[idx];
        App.reportSource = { type: 'history', row: r };
        go('report');
      });
    });
  }

  /* ================= 报告 ================= */
  function reportData() {
    const src = App.reportSource;
    if (src.type === 'history' && src.row) {
      return {
        kind: 'history',
        id: src.row.id,
        name: src.row.name,
        baseline: src.row.baseline,
        peak: src.row.peak,
        level: src.row.level,
        startAt: src.row.time,
        evals: src.row.current && Sim.state.evals.length ? Sim.state.evals : null,
        metrics: null,
      };
    }
    const s = Sim.state;
    const m = Sim.getMetrics();
    return {
      kind: 'current',
      id: s.sessionId || 'AEQ-待开始',
      name: '本次演示记录（程序合成信号）',
      baseline: s.baselineEval ? s.baselineEval.aeqi : null,
      peak: m ? m.aeqi : null,
      level: m ? m.level : null,
      startAt: new Date().toLocaleString('zh-CN'),
      evals: s.evals,
      metrics: m,
      session: s,
    };
  }

  /* ================= 报告生成 ================= */
  let reportBusy = false;

  function prepareReport() {
    reportBusy = false;
    const ph = $('#rep-placeholder');
    const paper = $('#report-paper');
    const pr = $('#rep-print');
    const hb = $('#rep-hintbar');
    if (ph) { ph.style.display = ''; ph.classList.remove('generating'); }
    if (paper) { paper.style.display = 'none'; paper.innerHTML = ''; }
    if (pr) pr.style.display = 'none';
    if (hb) hb.style.display = 'none';
    const btn = $('#rep-generate');
    if (btn) { btn.disabled = false; btn.textContent = '生成报告'; }
    const prog = $('#rep-progress');
    if (prog) prog.style.display = 'none';
    const fill = $('#rep-progress-fill');
    if (fill) fill.style.width = '0%';
    const status = $('#rep-progress-status');
    if (status) status.textContent = '正在汇总实验数据…';
    const desc = $('#rep-placeholder-desc');
    if (desc) {
      desc.textContent = App.reportSource.type === 'history'
        ? '已载入一条实验记录，点击下方按钮根据该条数据生成可打印的记录。'
        : '点击下方按钮，把本次演示的阶段、脑电特征指数与指标构成整理成一页可打印的检验记录。';
    }
  }

  function generateReport(instant) {
    if (reportBusy) return;
    reportBusy = true;
    const btn = $('#rep-generate');
    const prog = $('#rep-progress');
    const fill = $('#rep-progress-fill');
    const status = $('#rep-progress-status');
    const steps = ['正在汇总实验数据…', '正在计算指标构成…', '正在整理解读说明…', '正在排版记录…'];
    if (btn) { btn.disabled = true; btn.textContent = '生成中…'; }
    if (prog) prog.style.display = '';
    if (fill) fill.style.width = '0%';
    if (status) status.textContent = steps[0];
    const dur = instant ? 600 : 2400;
    const t0 = performance.now();
    const timer = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / dur);
      if (fill) fill.style.width = (p * 100).toFixed(1) + '%';
      const idx = Math.min(steps.length - 1, Math.floor(p * steps.length));
      if (status) status.textContent = steps[idx];
      if (p >= 1) {
        clearInterval(timer);
        finishReport();
      }
    }, 80);
  }

  function finishReport() {
    reportBusy = false;
    const ph = $('#rep-placeholder');
    const paper = $('#report-paper');
    const pr = $('#rep-print');
    const hb = $('#rep-hintbar');
    if (ph) ph.style.display = 'none';
    if (paper) paper.style.display = '';
    if (pr) pr.style.display = '';
    if (hb) hb.style.display = '';
    renderReport();
    toast('实验记录已生成');
  }

  function renderReport() {
    const paper = $('#report-paper');
    if (!paper) return;
    const d = reportData();
    const m = d.metrics;
    const evals = d.evals || [];
    const latest = evals.length ? evals[evals.length - 1] : null;
    const avg = evals.length ? evals.reduce((a, b) => a + b.aeqi, 0) / evals.length : null;
    const dimRows = m ? [
      ['脑电特征分', fmt(m.parts.eeg)],
      ['生理参考分', fmt(m.parts.physiology)],
      ['主观参考分', fmt(m.parts.subjective)],
      ['中医参考分', fmt(m.parts.tcm)],
      ['α/β 比值', fmt(m.alphaBeta, 2)],
    ] : [
      ['脑电特征分', '—'], ['生理参考分', '—'], ['主观参考分', '—'], ['中医参考分', '—'],
    ];

    const tableRows = evals.slice(-12).map((e, i) => `<tr>
      <td>${i + 1}</td><td>${fmtSec(e.t)}</td><td>${e.isBaseline ? '基线' : e.phaseLabel}</td>
      <td class="num">${e.aeqi.toFixed(1)}</td><td>${e.level.label}</td>
      <td class="num">${fmt(e.eeg)}</td><td class="num">${fmt(e.subjective)}</td></tr>`).join('');

    paper.innerHTML = `
      <div class="r-head">
        <div>
          <div class="r-brand">针尖上的脑电波</div>
          <div class="r-brand-sub">Acupuncture &amp; EEG · Interactive Science Demo</div>
        </div>
        <div class="r-meta">
          <div>记录编号：DEMO-${String(d.id || '').slice(-4)}</div>
          <div>生成时间：${d.startAt}</div>
        </div>
      </div>
      <h1 class="r-title">脑电互动演示记录</h1>
      <div class="r-sub">8 通道合成脑电信号 · 250 Hz · 本记录用于科普演示，不构成任何检查或诊断结论</div>

      <div class="r-section">一、实验信息</div>
      <div class="r-info">
        <div><span>记录名称：</span><b>${d.name}</b></div>
        <div><span>信号来源：</span><b>程序按生理规律合成（非真人采集）</b></div>
        <div><span>演示阶段：</span><b>基线 → 进针 → 留针 → 起针 → 复评</b></div>
        <div><span>采样率：</span><b>250 Hz</b></div>
        <div><span>记录点数：</span><b>${evals.length} 次</b></div>
        <div><span>对照组：</span><b>无（本演示未设置对照）</b></div>
      </div>

      <div class="r-section">二、脑电特征指数（BFI）</div>
      ${latest || d.peak != null ? `
      <div class="r-aeqi">
        <div>
          <div class="r-score">${fmt(d.peak)}</div>
          <div class="r-score-label">末次 BFI（0–100）</div>
        </div>
        <ul>
          <li>特征状态：<b style="color:${(d.level && d.level.color) || '#0f766e'}">${d.level ? d.level.label : '—'}</b></li>
          <li>基线 BFI：<b>${fmt(d.baseline)}</b>${d.baseline != null && d.peak != null ? ` → 较基线 <b>${d.peak - d.baseline >= 0 ? '+' : ''}${(d.peak - d.baseline).toFixed(1)}</b>` : ''}</li>
          <li>平均 BFI：<b>${fmt(avg)}</b></li>
          <li>α/β 比值：<b>${m ? fmt(m.alphaBeta, 2) : '—'}</b></li>
        </ul>
      </div>` : `<div class="r-info" style="margin-top:6px"><div><span>尚无记录：</span><b>请先开始演示并完成一次复评</b></div></div>`}

      <div class="r-section">三、指标构成</div>
      <div class="r-info">${dimRows.map(([k, v]) => `<div><span>${k}：</span><b>${v}</b></div>`).join('')}</div>
      <div class="r-note">权重（脑电 60% / 生理 10% / 主观 15% / 中医 15%）由本作品自行设定，未经专家共识与临床验证。</div>

      ${tableRows ? `
      <div class="r-section">四、记录明细</div>
      <table class="r-table">
        <thead><tr><th>#</th><th>时间</th><th>阶段</th><th>BFI</th><th>特征状态</th><th>脑电分</th><th>主观分</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>` : ''}

      <div class="r-section">${tableRows ? '五' : '四'}、怎么解读这份记录</div>
      <div class="r-conclusion">${conclusionText(d, latest)}</div>

      <div class="r-foot">
        <div>说明：本记录由「针尖上的脑电波」科普互动作品自动生成。波形为程序合成，指标为演示用自定算法，<b>不能</b>用于判断任何治疗是否有效，也不构成医疗建议。</div>
        <div class="r-sign">
          <span>观看者（可选）：________________</span>
          <span>日期：________________</span>
        </div>
      </div>`;
    const btn = $('#rep-print');
    if (btn && !btn._bound) { btn._bound = true; btn.addEventListener('click', () => window.print()); }
    const hint = $('#rep-hint');
    if (hint) hint.textContent = d.kind === 'current'
      ? '提示：打印对话框中选择「另存为 PDF」即可导出本次记录。'
      : '提示：这是从实验记录页载入的一条记录。';
  }

  function conclusionText(d, latest) {
    if (d.peak == null) return '本次演示尚未产生记录。请返回总览点击「开始演示」，会依次播放 基线 → 进针 → 留针 → 起针 → 复评。';
    const delta = d.baseline != null ? d.peak - d.baseline : null;
    const trend = delta == null ? '尚无基线对比' : delta >= 0 ? `较基线上升 ${delta.toFixed(1)} 分` : `较基线下降 ${Math.abs(delta).toFixed(1)} 分`;
    return `本次演示共记录 ${d.evals ? d.evals.length : '多'} 个时点，末次 BFI 为 ${fmt(d.peak)}（${d.level ? d.level.label : '—'}），${trend}。` +
      `在留针阶段可以看到 α 相对功率升高、β 相对功率下降，这是本演示预设的生理变化。` +
      `能得出的结论只有一句：<b>这套方法可以把这个变化读出来、量化下来。</b>` +
      `不能得出「针刺有效」的结论——因为没有对照组、没有随机分配、没有盲法、只有一次演示，` +
      `而且躺在安静环境里闭眼几分钟本身也会让 α 波上升。` +
      `真要回答「有没有效」，需要按「科学方法」页说的做对照实验。`;
  }

  /* ================= 主循环 ================= */
  function render(dt, force) {
    const now = performance.now();
    if (dt === 0) {
      // 首次 / 切页：强制全量渲染
      force = true;
    }
    if (force || now - App.lastRender > 120) {
      App.lastRender = now;
      renderPhase();
      switch (App.current) {
        case 'dashboard': renderDashboard(); break;
        case 'eeg': renderEeg(); break;
        case 'eval': renderEval(); break;
        case 'lab': renderLab(); updateNeedlePanel(); break;
        case 'state': renderState(); break;
        case 'tcm': renderTcm(); break;
        case 'method': break;
        case 'history': break;
        case 'report': break;
      }
    }
  }

  function loop(now) {
    if (!App.lastTick) App.lastTick = now;
    const dt = Math.min((now - App.lastTick) / 1000, 0.25);
    App.lastTick = now;
    Sim.advance(dt);
    render(dt);
    if (App.current === 'lab') needleDraw(dt);
    requestAnimationFrame(loop);
  }

  /* ================= 启动 ================= */
  function boot() {
    buildNav();
    buildMain();
    bindControls();
    bindLab();
    bindQuiz();
    bindNeedle();
    go('dashboard');
    Sim.setSpeed(1);
    requestAnimationFrame(loop);

    // 录屏/截图调试参数：?page=eval&fast=45 可跳转到指定页面并预跑 N 秒
    const params = new URLSearchParams(location.search);
    const page = params.get('page');
    const fast = Number(params.get('fast') || 0);
    if (fast > 0) {
      Sim.start();
      for (let i = 0; i < fast * 20; i++) Sim.advance(0.05);
      Sim.state.running = false; // 预跑后停住，便于截图
    }
    if (page && PAGE_FN[page]) go(page);
    // 截图调试：?page=lab&sel=0 预选某个穴位并插好针
    if (App.current === 'lab') {
      const sel = Number(params.get('sel') === null ? -1 : params.get('sel'));
      if (sel >= 0 && ACUPOINTS[sel]) {
        Needle.sel = sel; Needle.insert = 1;
        Sim.setPointEffect(ACUPOINTS[sel].eff);
      }
      updateNeedlePanel();
      needleDraw(0.016);
    }
    // 截图调试：?page=report&fast=52&report=1 直接生成报告
    if (params.get('report') === '1' && App.current === 'report') {
      generateReport(true);
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
  App.lab = Lab;
  App.needle = Needle;
  global.App = App;
}(window));
