// 長距離ドライブモード：専用マップ（季節ごとに別の道路・地形・景観・休憩施設・目的地）
// 市街地散策モードの City とは独立したデータ。チャンク管理・当たり判定・壁の処理は City の仕組みをそのまま使う
//
// 距離と時間の約束（第5章）：ゲーム内の時間は現実の32倍（現実45分＝ゲーム内24時間）。
// 道路の実距離も 1/32 に縮めて作り、表示する距離は「実距離×32」。時速80kmで走ると表示上も時速80kmで、
// 本線12,500m（表示400km）を5時間（現実9分22秒）で走り切り、09:00出発なら14:00に着く。
import { GB } from './geo.js?v=0.8.0';
import { L, FONT } from './textures.js?v=0.8.0';
import { City, CH } from './city.js?v=0.8.0';
import { rng, clamp, lerp } from './math.js?v=0.8.0';
import { MODELS, pickColor, isCommercial, plateClass } from './carmodels.js?v=0.8.0';

export const DIST_SCALE = 32, TIME_SCALE = 32;
export const ROUTE_LEN = 12500;   // 出発点 s=0 から目的地の駐車場入口まで（表示400km）
const S_START = -150, S_END = ROUTE_LEN + 100, STEP = 2;
// 休憩施設（表示km：110km・200km・290km）。時速80kmなら出発から1時間23分・2時間30分・3時間38分（どれも4時間より前）
export const FAC_KM = [['pa', 'PA', 110], ['sa', 'SA', 200], ['michi', 'MICHI', 290]];
// 道路の横断面（u は進行方向の左が正）：中央分離帯 |u|<0.45、上り（進行方向）は追越車線 u=2.6・走行車線 u=6.1、路肩〜7.85〜9.9、ガードレール 9.95
export const LANE_U = [6.1, 2.6], EDGE_U = 9.9, ROAD_HW = 10.5;

export const SEASONS = {
  spring: {
    name: '春', dest: '桜ヶ丘城', destLot: '桜ヶ丘城公園 駐車場', weather: 'clear', fac: ['花見坂PA', '桜川SA', '道の駅 はなさき'],
    grass: [0.55, 0.78, 0.38], far: [0.45, 0.62, 0.42], tree: 'sakura',
    curves: [[300, 900, 12], [1300, 2100, -18], [2400, 3000, 10], [4000, 4700, -15], [5200, 5800, 20], [7000, 7800, -25], [8150, 8750, 15], [9700, 10500, -20], [11000, 11800, 14], [12100, 12450, -8]],
    elev: [[-150, 0], [2000, 4], [2700, 6], [2850, 6], [4000, 10], [6250, 14], [7600, 30], [8150, 55], [8650, 42], [9062, 42], [10500, 32], [11800, 38], [12650, 40]],
    zones: [[-150, 1400, 'farm', 'farm'], [1400, 2650, 'river', 'farm'], [2650, 2950, 'valley', 'valley'], [2950, 3950, 'farm', 'farm'], [3950, 5300, 'sakura', 'sakura'], [5300, 6900, 'hills', 'farm'], [6900, 7500, 'sakuraT', 'sakuraT'], [7500, 7900, 'hills', 'hills'], [7900, 8400, 'mount', 'mount'], [8400, 10300, 'hills', 'farm'], [10300, 12700, 'town', 'town']],
    tunnels: [[8000, 8300, '桜峠トンネル']], bridges: [[2730, 2870, '花咲大橋']],
    sections: [[-150, '水瀬東IC'], [600, '水瀬平野'], [1400, '桜川沿い'], [2650, '花咲大橋'], [2950, '春の田園'], [3950, '桜並木の道'], [5300, '丘陵地帯'], [6900, '桜のトンネル'], [7900, '桜峠'], [8400, 'はなさき盆地'], [10300, '桜ヶ丘城下町']]
  },
  summer: {
    name: '夏', dest: '青凪高原リゾート', destLot: '青凪高原リゾート 駐車場', weather: 'clear', fac: ['潮騒PA', '青凪浜SA', '道の駅 たかはら'],
    grass: [0.36, 0.62, 0.28], far: [0.3, 0.5, 0.34], tree: 'green',
    curves: [[200, 800, -15], [1500, 2200, 12], [3000, 3200, -14], [4300, 5000, 18], [5300, 5900, -10], [7000, 7700, 30], [8000, 8700, -28], [9600, 10200, 25], [10600, 11200, -30], [11500, 12200, 20]],
    elev: [[-150, 6], [1400, 6], [2500, 5], [2650, 9], [2950, 9], [3100, 6], [3900, 8], [4300, 8], [5600, 6], [6250, 8], [7300, 30], [7900, 55], [8300, 72], [9062, 95], [9900, 135], [10800, 172], [11800, 210], [12650, 222]],
    zones: [[-150, 1400, 'hills', 'town'], [1400, 2600, 'cliff', 'sea'], [2600, 2950, 'bay', 'bay'], [2950, 3900, 'cliff', 'sea'], [3900, 4300, 'mount', 'mount'], [4300, 5000, 'cliff', 'sea'], [5000, 5800, 'hills', 'harbor'], [5800, 6700, 'hills', 'sea'], [6700, 8000, 'mount', 'hills'], [8000, 12700, 'plateau', 'plateau']],
    tunnels: [[3950, 4250, '潮見トンネル']], bridges: [[2620, 2930, '青凪ベイブリッジ']],
    sections: [[-150, '水瀬東IC'], [1400, '海岸バイパス'], [2600, '青凪ベイブリッジ'], [2950, '潮騒海岸'], [3900, '潮見トンネル'], [5000, '港町・汐見'], [5800, '青凪浜'], [6700, '青凪山地'], [8000, '青凪高原']]
  },
  autumn: {
    name: '秋', dest: '楓見山荘', destLot: '楓見山荘 駐車場', weather: 'clear', fac: ['紅葉台PA', '楓川SA', '道の駅 もみじ谷'],
    grass: [0.62, 0.58, 0.32], far: [0.62, 0.36, 0.2], tree: 'maple',
    curves: [[300, 800, 20], [1100, 1600, -25], [2000, 2500, 35], [2650, 3150, -30], [4000, 4400, 30], [4600, 5000, -35], [5200, 5600, 25], [5700, 6000, -15], [6800, 7200, 30], [7300, 7700, -30], [7900, 8300, 25], [8350, 8800, -20], [9600, 10000, 30], [10100, 10500, -35], [10700, 11100, 30], [11200, 11700, -25], [11900, 12400, 15]],
    elev: [[-150, 20], [1000, 35], [2000, 70], [3000, 100], [3437, 108], [4300, 132], [5000, 140], [5600, 152], [6250, 165], [7400, 192], [7900, 215], [8400, 232], [9062, 240], [9800, 255], [10600, 272], [11400, 285], [12650, 292]],
    zones: [[-150, 2000, 'hills', 'hills'], [2000, 3200, 'mount', 'mount'], [3200, 3900, 'hills', 'hills'], [3900, 4950, 'mount', 'gorge'], [4950, 5150, 'valley', 'valley'], [5150, 5950, 'mount', 'gorge'], [5950, 6700, 'hills', 'hills'], [6700, 7150, 'mount', 'mount'], [7150, 7700, 'mapleT', 'mapleT'], [7700, 8150, 'mount', 'gorge'], [8150, 8350, 'valley', 'valley'], [8350, 9700, 'hills', 'gorge'], [9700, 10400, 'village', 'village'], [10400, 12700, 'mount', 'mount']],
    tunnels: [[2600, 2900, '紅葉台トンネル'], [6820, 7000, '楓トンネル']], bridges: [[4990, 5110, 'もみじ渓谷橋'], [8190, 8310, '楓川橋']],
    sections: [[-150, '水瀬東IC'], [1000, '紅葉の丘'], [2000, '紅葉台'], [3900, 'もみじ渓谷'], [5950, '楓の森'], [7150, '紅葉のトンネル'], [7700, '楓川渓谷'], [9700, '山あいの集落・楓見'], [10400, '楓見山']]
  },
  winter: {
    name: '冬', dest: '雪灯温泉郷', destLot: '雪灯温泉郷 駐車場', weather: 'cloudy', fac: ['白樺PA', '雪見野SA', '道の駅 ゆきあかり'],
    grass: [0.93, 0.95, 0.98], far: [0.88, 0.9, 0.95], tree: 'snowpine',
    curves: [[400, 1200, 15], [1800, 2400, -12], [4000, 4600, 10], [5000, 5700, -25], [7000, 7600, 25], [7800, 8500, -25], [9700, 10300, 30], [10600, 11300, -25], [11600, 12200, 18]],
    elev: [[-150, 30], [1500, 35], [2400, 40], [3400, 45], [4200, 60], [4800, 80], [5300, 90], [5450, 90], [6250, 100], [7600, 128], [8400, 155], [9062, 165], [10000, 185], [11000, 198], [12650, 204]],
    zones: [[-150, 2300, 'snowfield', 'snowfield'], [2300, 3200, 'lake', 'snowfield'], [3200, 4100, 'snowfield', 'hills'], [4100, 4800, 'mount', 'mount'], [4800, 5250, 'hills', 'hills'], [5250, 5500, 'valley', 'valley'], [5500, 11200, 'snowwall', 'snowwall'], [11200, 12700, 'onsen', 'onsen']],
    tunnels: [[4250, 4650, '雪見トンネル']], bridges: [[5300, 5450, '白銀橋']],
    sections: [[-150, '水瀬東IC'], [800, '白銀の雪原'], [2300, '氷鏡湖'], [3200, '雪見野'], [4100, '雪見トンネル'], [5250, '白銀橋'], [5500, '雪の山道'], [11200, '雪灯温泉郷']]
  }
};

const smooth = t => t * t * (3 - 2 * t);
// 修正104：遠くからも見える目印（mat+100：霧のかかり方だけ変える。renderer.js 参照）
const LM = o => ({ ...o, mat: (o.mat || 0) + 100 });
const markLM = (gb, n0) => { const a = gb.a; for (let i = n0 + 11; i < a.length; i += 13) if (a[i] < 100) a[i] += 100; }; // GB の頂点（13要素。12番目が mat）
export class LongWorld {
  constructor(season) {
    const W = Object.create(City.prototype); // City の当たり判定・チャンク・壁の処理を流用（市街地の生成は行わない）
    Object.assign(W, { nodes: [], edges: [], lots: [], aabbs: [], hash: new Map(), walls: [], whash: new Map(), chunks: [], sigHeads: [], pedHeads: [], surfaces: [], tunnels: [], driveways: [], dhash: new Map(), stats: {}, mm: { blds: [], lots: [], lanes: [], polys: [], water: [], green: [] }, global: new GB(), globalDecal: new GB(), mountains: new GB(), dyn: [], bridges: [] });
    this.W = W; this.season = season; this.D = SEASONS[season]; this.R = rng({ spring: 11, summer: 22, autumn: 33, winter: 44 }[season]);
    this.buildRoute(); this.buildChunks(); this.facilities(); this.populate();
    // City と同じ名前で呼ばれるメソッド（main.js・player.js から使われる）を W に生やす
    const self = this;
    Object.assign(W, {
      ld: this, chunkAt: (x, z) => self.chunkAt(x, z), groundY: (x, z, cy) => self.groundY(x, z, cy), terrainY: (x, z) => self.groundY(x, z, 0),
      surfaceAt: (x, z) => self.surfaceAt(x, z), limitAt: () => ({ lim: 80, kind: 'byp' }), shopCarsOn: () => false, allowed: () => true,
      zoneClass: () => (season === 'winter' || season === 'autumn' ? 'mtn' : 'farm'), district: (x, z) => self.sectionName(self.project(x, z).s),
      inTunnelXZ: (x, z) => { const p = self.project(x, z); return Math.abs(p.u) < ROAD_HW && self.inTunnelS(p.s); }, mtnRoadAt: (x, z) => Math.abs(self.project(x, z).u) < ROAD_HW ? {} : null,
      sig: () => 'g', lanePos: () => [0, 0], headAt: () => 0, yAt: () => 0, shopCarsOn2: null
    });
  }
  // ---------- 路線（中心線） ----------
  buildRoute() {
    const D = this.D, N = Math.floor((S_END - S_START) / STEP) + 1;
    const facS = FAC_KM.map(f => f[2] * 1000 / DIST_SCALE); this.facS = facS;
    const straight = s => facS.some(f => s > f - 260 && s < f + 480) || s < 120 || s > ROUTE_LEN - 150;
    const S = new Float32Array(N), X = new Float32Array(N), Z = new Float32Array(N), Y = new Float32Array(N), Hd = new Float32Array(N);
    let x = 0, z = 0, h = 0;
    for (let i = 0; i < N; i++) {
      const s = S_START + i * STEP; S[i] = s;
      let k = 0; for (const [a, b, deg] of D.curves) if (s >= a && s < b) k += deg * Math.PI / 180 / (b - a) * (1 - Math.cos((s - a) / (b - a) * 2 * Math.PI)); // 緩和曲線つき（曲率は両端で0）
      if (straight(s)) k = 0;
      X[i] = x; Z[i] = z; Hd[i] = h;
      h += k * STEP; x += Math.sin(h) * STEP; z += Math.cos(h) * STEP;
    }
    // 縦断（高さ）：キーフレームをなめらかにつなぎ、休憩施設の前後は平らにする
    const E0 = D.elev, y0At = s => { let i = 0; while (i < E0.length - 2 && E0[i + 1][0] < s) i++; const [s0, y0] = E0[i], [s1, y1] = E0[i + 1], t = clamp((s - s0) / (s1 - s0), 0, 1); return y0 + (y1 - y0) * t; };
    // 休憩施設の前後（入口の手前300m〜出口の先520m）は平らにする：その区間の両端にキーフレームを足して、間のキーフレームは除く
    let E = E0.filter(([s]) => !facS.some(f => s > f - 650 && s < f + 870));
    for (const f of facS) { const yf = y0At(f + 110); E.push([f - 300, yf], [f + 520, yf]); }
    E.sort((a, b) => a[0] - b[0]);
    // 単調な3次補間（Fritsch–Carlson）：キーフレーム間の勾配が平均に近く、行き過ぎない
    const n = E.length, dl = [], m = [];
    for (let i = 0; i < n - 1; i++) dl.push((E[i + 1][1] - E[i][1]) / (E[i + 1][0] - E[i][0]));
    for (let i = 0; i < n; i++) m.push(i === 0 ? dl[0] : i === n - 1 ? dl[n - 2] : dl[i - 1] * dl[i] <= 0 ? 0 : (dl[i - 1] + dl[i]) / 2);
    for (let i = 0; i < n - 1; i++) { if (dl[i] === 0) { m[i] = m[i + 1] = 0; continue; } const a = m[i] / dl[i], b = m[i + 1] / dl[i], h2 = a * a + b * b; if (h2 > 9) { const t = 3 / Math.sqrt(h2); m[i] = t * a * dl[i]; m[i + 1] = t * b * dl[i]; } }
    const yAt = s => { let i = 0; while (i < n - 2 && E[i + 1][0] < s) i++; const h = E[i + 1][0] - E[i][0], t = clamp((s - E[i][0]) / h, 0, 1), t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * E[i][1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * E[i + 1][1] + (t3 - t2) * h * m[i + 1]; };
    for (let i = 0; i < N; i++) Y[i] = yAt(S[i]);
    Object.assign(this, { S, X, Z, Y, Hd, N });
    // 投影用の空間ハッシュ（40m格子）
    const H = this.hash = new Map();
    for (let i = 0; i < N; i += 2) { const k = Math.floor(X[i] / 40) * 100003 + Math.floor(Z[i] / 40); let a = H.get(k); if (!a) H.set(k, a = []); a.push(i); }
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let i = 0; i < N; i++) { x0 = Math.min(x0, X[i]); x1 = Math.max(x1, X[i]); z0 = Math.min(z0, Z[i]); z1 = Math.max(z1, Z[i]); }
    this.bb = { x0: x0 - 700, x1: x1 + 700, z0: z0 - 700, z1: z1 + 700 };
    this.lastI = 0;
  }
  idx(s) { return clamp((s - S_START) / STEP, 0, this.N - 1.001); }
  at(s) { const f = this.idx(s), i = Math.floor(f), t = f - i, j = Math.min(i + 1, this.N - 1); return { x: lerp(this.X[i], this.X[j], t), z: lerp(this.Z[i], this.Z[j], t), y: lerp(this.Y[i], this.Y[j], t), h: lerp(this.Hd[i], this.Hd[j], t) }; }
  roadY(s) { return this.at(s).y; }
  pos(s, u, dy = 0) { const p = this.at(s), c = Math.cos(p.h), sn = Math.sin(p.h); return [p.x + c * u, p.y + dy, p.z - sn * u]; }
  // 世界座標 → (s, u)。前回の結果の近くから探す（自車の連続した問い合わせを速くする）
  project(x, z) {
    const X = this.X, Z = this.Z, N = this.N; let bi = -1, bd = 1e18;
    const scan = (a, b) => { for (let i = Math.max(0, a); i <= Math.min(N - 1, b); i++) { const dx = X[i] - x, dz = Z[i] - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; bi = i; } } };
    scan(this.lastI - 30, this.lastI + 30);
    if (bd > 30 * 30 || bi === this.lastI - 30 || bi === this.lastI + 30) { bd = 1e18; bi = -1;
      for (let r = 1; r <= 12 && bi < 0; r++) { const gx = Math.floor(x / 40), gz = Math.floor(z / 40);
        for (let ix = gx - r; ix <= gx + r; ix++) for (let iz = gz - r; iz <= gz + r; iz++) { const a = this.hash.get(ix * 100003 + iz); if (a) for (const i of a) { const dx = X[i] - x, dz = Z[i] - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; bi = i; } } }
        if (bi >= 0) scan(bi - 3, bi + 3); }
      if (bi < 0) return { s: 0, u: 9999 }; }
    this.lastI = bi;
    // 隣の区間へ射影して s を細かく
    const i = clamp(bi, 0, N - 2), h = this.Hd[i], fx = Math.sin(h), fz = Math.cos(h), dx = x - X[i], dz = z - Z[i];
    const along = dx * fx + dz * fz, u = dx * Math.cos(h) - dz * Math.sin(h);
    return { s: this.S[i] + along, u };
  }
  inTunnelS(s) { return this.D.tunnels.some(([a, b]) => s > a && s < b); }
  inBridgeS(s) { return this.D.bridges.some(([a, b]) => s > a && s < b); }
  sectionName(s) { let n = this.D.sections[0][1]; for (const [a, nm] of this.D.sections) if (s >= a) n = nm; return n; }
  // ---------- 地形 ----------
  zoneW(s, side) { // 片側の地形タイプの重み（境目は120mでなめらかに切り替え）
    const out = {}; for (const z of this.D.zones) { const a = z[0], b = z[1], t = side > 0 ? z[2] : z[3]; const w = clamp(Math.min(s - a + 60, b - s + 60) / 120, 0, 1); if (w > 0) out[t] = (out[t] || 0) + w; }
    let tot = 0; for (const k in out) tot += out[k]; if (!tot) return { hills: 1 }; for (const k in out) out[k] /= tot; return out;
  }
  noise(s, u) { return Math.sin(s * 0.013 + u * 0.021) * Math.cos(s * 0.007 - u * 0.017) + 0.5 * Math.sin(s * 0.031 + u * 0.043 + 1.3); }
  typeH(t, s, a, ry) { // a = |u|（道路中心からの距離）。返すのは絶対高さ
    const n = this.noise(s, a), e = Math.max(0, a - 12);
    switch (t) {
      case 'farm': case 'snowfield': case 'town': case 'onsen': case 'village': case 'harbor': return ry - 0.6 + Math.min(e * 0.02, 2) + n * Math.min(1, e / 60) * 1.5 + (a > 260 ? (a - 260) * 0.25 : 0);
      case 'plateau': return ry - 0.5 + n * Math.min(1, e / 40) * 3 + Math.max(0, a - 180) * 0.2;
      case 'river': return a < 40 ? ry - 0.6 - e * 0.03 : a < 95 ? ry - 4.5 : ry - 0.6 + Math.min((a - 95) * 0.05, 3) + n * 1.5;
      case 'lake': return a < 25 ? ry - 0.6 - e * 0.08 : ry - 2.2;
      case 'hills': return ry - 0.4 + e * 0.12 + n * Math.min(1, e / 50) * 6 + Math.max(0, a - 160) * 0.25;
      case 'mount': return ry + Math.min(e * 0.7, 9) + e * 0.35 + n * Math.min(1, e / 30) * 10;
      case 'snowwall': return ry + Math.min(e * 0.5, 4) + Math.max(0, e - 10) * 0.32 + n * Math.min(1, e / 40) * 8;
      case 'cliff': return ry + Math.min(e * 0.8, 12) + e * 0.25 + n * Math.min(1, e / 30) * 8;
      case 'sea': return a < 16 ? ry - 0.8 - e * 0.8 : a < 45 ? Math.max(1.2, ry - 4 - (a - 16) * 0.06) - (a - 16) * 0.03 : -1.5 - (a - 45) * 0.1;
      case 'bay': return Math.min(ry - 3, -1.5 - e * 0.15);
      case 'gorge': return a < 22 ? ry - 0.8 - e * 0.5 : ry - 38 + Math.max(0, a - 70) * 0.5 + n * 3;
      case 'valley': return ry - 22 + Math.max(0, a - 120) * 0.3 + n * 2;
      case 'sakura': case 'sakuraT': return ry - 0.6 + Math.min(e * 0.02, 1.5) + n * Math.min(1, e / 60) + (a > 220 ? (a - 220) * 0.2 : 0);
      case 'mapleT': return ry + Math.min(e * 0.3, 6) + e * 0.2 + n * Math.min(1, e / 30) * 5;
      default: return ry;
    }
  }
  terrainH(s, u) {
    const ry = this.roadY(s), a = Math.abs(u), side = u >= 0 ? 1 : -1;
    // 休憩施設の敷地（左側 u=10〜135）と、出発地・目的地の広場は平ら
    for (const f of this.fac || []) if (f.side * u > 9 && f.side * u < 135 && s > f.s - 230 && s < f.s + 450) { const d = Math.max(0, f.side * u - 120, f.s - 200 - s, s - (f.s + 420)); return f.y - 0.05 + d * 0.3; }
    if (s > ROUTE_LEN - 20 || s < -100) return ry - 0.05;
    const w = this.zoneW(s, side); let h = 0; for (const t in w) h += w[t] * this.typeH(t, s, a, ry);
    // 修正104：休憩施設の手前 600m は、施設側の山・雪の壁を少しずつ低くして、遠くから建物と看板が見えるようにする（崖や雪の壁で隠れてポップインしない）
    for (const f of this.fac || []) if (f.side * u > 12 && f.side * u < 260 && s > f.s - 600 && s <= f.s - 230) { const t = smooth(clamp((s - (f.s - 600)) / 300, 0, 1)), flat = Math.min(h, ry - 0.4 + Math.max(0, f.side * u - 150) * 0.08); h = lerp(h, flat, t); }
    // 道路の肩（|u| 10.5〜13）は道路の高さから地形へなめらかに
    if (a < 13) h = lerp(ry - 0.05, h, smooth(clamp((a - ROAD_HW) / 2.5, 0, 1)));
    return h;
  }
  groundKind(s, u) {
    const a = Math.abs(u), w = this.zoneW(s, u >= 0 ? 1 : -1), season = this.season; let best = 'hills', bw = 0; for (const t in w) if (w[t] > bw) { bw = w[t]; best = t; }
    if (season === 'winter') return best === 'lake' && a > 25 ? 'ice' : 'snow';
    if ((best === 'sea' && a > 16) || best === 'bay') return 'sand';
    if (best === 'gorge' && a > 22) return 'rock';
    if ((best === 'farm' || best === 'sakura') && a > 25 && a < 240) return (Math.floor(s / 60) + Math.floor(a / 45)) % 3 === 0 ? 'field' : 'paddy';
    if (best === 'mount' || best === 'cliff' || best === 'mapleT' || (best === 'hills' && a > 60)) return 'forest';
    return 'grass';
  }
  // ---------- 接地・路面 ----------
  groundY(x, z, cy) {
    const p = this.project(x, z), a = Math.abs(p.u);
    const f = this.facAt(p.s, p.u); if (f) return f.y;
    if (p.s > ROUTE_LEN - 10 && p.s < ROUTE_LEN + 120 && a < 60) return this.endY;
    if (a <= ROAD_HW) return this.roadY(p.s);
    return this.terrainH(p.s, p.u);
  }
  surfaceAt(x, z) {
    const p = this.project(x, z), a = Math.abs(p.u);
    if (this.facAt(p.s, p.u)) return 1;
    if (p.s > ROUTE_LEN - 10 && p.s < ROUTE_LEN + 120 && a < 50) return 1;
    if (a <= 7.9) return 1;
    if (a <= EDGE_U) return this.season === 'winter' ? 3 : 1; // 冬は路肩が圧雪（少し滑る）
    return 0;
  }
  // 休憩施設の舗装の範囲（減速車線・駐車場・加速車線）にいれば施設を返す
  facAt(s, u) {
    for (const f of this.fac || []) { const lz = s - f.s, lx = u * f.side;
      if (lz > -170 && lz < 420 && lx > 9.0 && lx < 13.6) { if (lz > -60 && lz < 290) return f; const t = lz < 0 ? (lz + 170) / 110 : (420 - lz) / 130; if (lx < 9.9 + 3.6 * clamp(t, 0, 1)) return f; }
      if (lz > -5 && lz < 225 && lx >= 13.6 && lx < 112) return f; }
    return null;
  }
  // ---------- チャンク ----------
  buildChunks() {
    const b = this.bb, nx = Math.ceil((b.x1 - b.x0) / CH), nz = Math.ceil((b.z1 - b.z0) / CH);
    Object.assign(this, { cx0: b.x0, cz0: b.z0, ncx: nx, ncz: nz });
    for (let cz = 0; cz < nz; cz++) for (let cx = 0; cx < nx; cx++) this.W.chunks.push({ cx, cz, x: b.x0 + cx * CH + CH / 2, z: b.z0 + cz * CH + CH / 2, cmds: [], m: null });
    this.W.chunkAt = (x, z) => this.chunkAt(x, z);
  }
  chunkAt(x, z) { const cx = clamp(Math.floor((x - this.cx0) / CH), 0, this.ncx - 1), cz = clamp(Math.floor((z - this.cz0) / CH), 0, this.ncz - 1); return this.W.chunks[cz * this.ncx + cx]; }
  add(s, fn) { const p = this.at(s); this.W.add(p.x, p.z, fn); }
  // 緑の案内標識などの文字テクスチャ（動的レイヤー）
  newDyn(draw) { const k = this.W.dyn.length; if (k >= 90) return L.WHITE; const lay = L['DYN' + k]; this.W.dyn.push({ lay, draw }); return lay; }
  greenSign(lines, opt = {}) {
    return this.newDyn(ctx => { ctx.fillStyle = opt.bg || '#0b6b3a'; ctx.fillRect(0, 0, 256, 256); ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.strokeRect(6, 6, 244, 244);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const n = lines.length;
      lines.forEach((t, i) => { let sz = (i === 0 && n > 1 ? 54 : 46) * (opt.scale || 1); ctx.font = `800 ${sz}px ${FONT}`; const w = ctx.measureText(t).width; if (w > 225) { sz *= 225 / w; ctx.font = `800 ${sz}px ${FONT}`; } ctx.fillText(t, 128, 256 / (n + 1) * (i + 1)); }); });
  }
  // ---------- 生成 ----------
  facilities() {
    const D = this.D; this.fac = FAC_KM.map(([id, type, km], i) => { const s = km * 1000 / DIST_SCALE; return { id, type, km, s, side: 1, name: D.fac[i], y: this.roadY(s + 110) }; });
    this.endY = this.roadY(ROUTE_LEN);
  }
  populate() {
    const R = this.R, season = this.season, D = this.D;
    // 区間ごと（50m）に道路・地形・沿道の景観を組み立てる
    for (let s = S_START; s < S_END; s += 50) { const s0 = s, s1 = Math.min(S_END, s + 50); this.add((s0 + s1) / 2, g => this.segment(g, s0, s1)); }
    // 壁（ガードレール・中央分離帯）
    for (let s = S_START; s < ROUTE_LEN + 5; s += 8) {
      const a = this.pos(s, 0), b = this.pos(s + 8, 0), y0 = Math.min(a[1], b[1]) - 1.5, y1 = Math.max(a[1], b[1]) + 1.3;
      this.W.addWall(a[0], a[2], b[0], b[2], y0, y1); // 中央分離帯（反対車線へは出られない）
      for (const side of [1, -1]) { if (side > 0 && this.fac.some(f => s + 8 > f.s - 170 && s < f.s + 420)) continue;
        const p = this.pos(s, side * 9.95), q = this.pos(s + 8, side * 9.95); this.W.addWall(p[0], p[2], q[0], q[2], y0, y1); }
    }
    // 出発地の奥（s=-150）と、目的地の駐車場の囲い
    { const a = this.pos(S_START + 1, -10), b = this.pos(S_START + 1, 10); this.W.addWall(a[0], a[2], b[0], b[2], -50, 500); }
    for (const f of this.fac) this.facility(f);
    this.startArea(); this.destination(); this.destFar(); this.signs(); this.farView();
    this.feats = this.buildFeats();
  }
  // 修正117：ナビの観光案内・同乗者の反応の対象になる「実際に配置されている地物」の表（季節×区間×地物）。
  // 載せるのは、このルートに実物のジオメトリを置いているものだけ：橋（アーチと橋名板）・トンネル（坑口と名板）・地形タイプの区間（その区間に専用の景観を置いている：桜並木・桜のトンネル・川・海・港・高原・渓谷・紅葉のトンネル・集落・雪原・氷の湖・雪の壁・温泉街・城下町）・目的地。
  // side：+1 は zones の3番目（u>0 側）、-1 は4番目、0 は両側・道路上。案内の「左手／右手」はこの値から作る（u>0 が進行方向の左）
  buildFeats() {
    const D = this.D, out = [], add = (id, kind, name, s0, s1, side = 0) => out.push({ id, kind, name, s0, s1, side });
    for (const [a, b, nm] of D.bridges) add('brg:' + nm, 'bridge', nm, a, b);
    for (const [a, b, nm] of D.tunnels) add('tun:' + nm, 'tunnel', nm, a, b);
    const SHOW = { sakura: '桜並木', sakuraT: '桜のトンネル', river: '桜川', sea: '海', bay: '入り江', harbor: '港町・汐見の漁港', plateau: '青凪高原', gorge: 'もみじ渓谷', mapleT: '紅葉のトンネル', village: '山あいの集落・楓見', snowfield: '白銀の雪原', lake: '氷鏡湖', snowwall: '雪の壁', onsen: '雪灯温泉郷', town: '城下町' };
    const secName = s => { let n = ''; for (const [ss, nm] of D.sections) if (ss <= s + 1) n = nm; return n; };
    for (const z of D.zones) for (const [k, side] of [[z[2], 1], [z[3], -1]]) {
      if (!SHOW[k] || z[1] - z[0] < 150) continue;
      if (z[2] === z[3] && side < 0) continue; // 両側同じなら1件（side 0）
      if (k === 'river' && this.season !== 'spring') continue;
      if (k === 'town' && this.season !== 'spring') continue; // 夏の出発地の町並みは見どころにしない
      const sn = secName(z[0] + 1), nm = (k === 'gorge' || k === 'sea') && sn && !/トンネル|橋/.test(sn) ? sn : SHOW[k];
      if (k === 'snowfield' && out.some(o => o.kind === 'snowfield')) continue; // 雪原は全線に続くので最初の区間だけ
      const id = k + ':' + z[0];
      // 同じ種類が連続する区間は1つにまとめる
      const prev = out.find(o => o.kind === k && Math.abs(o.s1 - z[0]) < 1 && o.side === (z[2] === z[3] ? 0 : side)); if (prev) { prev.s1 = z[1]; continue; }
      add(id, k, nm, z[0], z[1], z[2] === z[3] ? 0 : side);
    }
    if (this.season === 'autumn') add('maple:hill', 'maple', '紅葉の丘', 1000, 2000, 0); // 秋は全線が紅葉の木（tree:'maple'）。丘の区間を見どころに
    add('dest', 'dest', D.dest, ROUTE_LEN - 1500, ROUTE_LEN, 0);
    return out.sort((p, q) => p.s0 - q.s0);
  }
  segment(g, s0, s1) {
    const season = this.season, D = this.D, R = rng(Math.floor(s0) * 7 + 3), ds = 10, W = season === 'winter';
    const tun = this.inTunnelS((s0 + s1) / 2), br = this.inBridgeS((s0 + s1) / 2);
    // 道路面：車道（アスファルト）と路肩。冬は車道を除雪済みの濃いアスファルト、路肩は圧雪
    for (let s = s0; s < s1 - 0.01; s += ds) {
      const e = Math.min(s1, s + ds), q = (u, ss) => this.pos(ss, u, 0);
      const strip = (u0, u1, o, gbk = g.s) => gbk.quadN(q(u0, s), q(u1, s), q(u1, e), q(u0, e), [0, 1, 0], o);
      if (s > ROUTE_LEN + 1) continue;
      const asph = { c: W ? [0.62, 0.64, 0.68] : [0.95, 0.95, 0.95], mat: 7, lay: L.ASPHALT };
      strip(-7.9, 7.9, asph);
      for (const side of [1, -1]) {
        const fopen = side > 0 && this.fac.some(f => e > f.s - 170 && s < f.s + 420);
        if (W) strip(side > 0 ? 7.9 : -EDGE_U, side > 0 ? EDGE_U : -7.9, { c: [0.9, 0.92, 0.96], lay: L.WHITE });
        else strip(side > 0 ? 7.9 : -EDGE_U, side > 0 ? EDGE_U : -7.9, asph);
        if (!fopen) strip(side > 0 ? EDGE_U : -ROAD_HW, side > 0 ? ROAD_HW : -EDGE_U, { c: W ? [0.95, 0.96, 1] : [0.55, 0.53, 0.5], lay: W ? L.WHITE : L.ROCK });
      }
      // 区画線（中央寄りの外側線・車線境界の破線・外側線）
      const line = (u, a, b, col = [1, 1, 1]) => { const p0 = this.pos(a, u - 0.075, 0.015), p1 = this.pos(a, u + 0.075, 0.015), p2 = this.pos(b, u + 0.075, 0.015), p3 = this.pos(b, u - 0.075, 0.015); g.d2.quadN(p0, p1, p2, p3, [0, 1, 0], { c: col }); };
      for (const side of [1, -1]) { line(side * 0.85, s, e); line(side * 7.85, s, e); if (Math.floor(s / 20) % 1 === 0) line(side * 4.35, s, Math.min(e, s + 8)); }
      // 中央分離帯（コンクリート）
      { const a0 = this.pos(s, -0.35), a1 = this.pos(s, 0.35), b0 = this.pos(e, -0.35), b1 = this.pos(e, 0.35), y = 0.8, cc = { c: [0.78, 0.78, 0.75] };
        g.s.quadN([a0[0], a0[1] + y, a0[2]], [a1[0], a1[1] + y, a1[2]], [b1[0], b1[1] + y, b1[2]], [b0[0], b0[1] + y, b0[2]], [0, 1, 0], cc);
        for (const [p, r] of [[a0, b0], [a1, b1]]) g.s.quadN([p[0], p[1], p[2]], [r[0], r[1], r[2]], [r[0], r[1] + y, r[2]], [p[0], p[1] + y, p[2]], [0, 0, 1], cc); }
      // ガードレール（橋は高欄、冬は雪をかぶる）
      for (const side of [1, -1]) {
        if (side > 0 && this.fac.some(f => e > f.s - 170 && s < f.s + 420)) continue;
        const u = side * 9.95;
        if (br) { const p = this.pos(s, u), r = this.pos(e, u), c = { c: [0.82, 0.82, 0.8] }; g.s.quadN([p[0], p[1], p[2]], [r[0], r[1], r[2]], [r[0], r[1] + 1.1, r[2]], [p[0], p[1] + 1.1, p[2]], [side, 0, 0], c); g.s.quadN([p[0], p[1] + 1.1, p[2]], [r[0], r[1] + 1.1, r[2]], [r[0] + 0, r[1] + 1.1, r[2]], [p[0], p[1] + 1.1, p[2]], [0, 1, 0], c); }
        else if (!tun) { const p = this.pos(s, u, 0.55), r = this.pos(e, u, 0.55); g.det.beam(p, r, 0.06, { c: [0.85, 0.86, 0.85] }); for (let t = s; t < e; t += 4) { const pp = this.pos(t, u); g.det.box(pp[0] - 0.05, pp[1], pp[2] - 0.05, pp[0] + 0.05, pp[1] + 0.75, pp[2] + 0.05, { c: [0.7, 0.7, 0.7] }); }
          if (W) { const a0 = this.pos(s, u, 0.62), b0 = this.pos(e, u, 0.62); g.det.beam(a0, b0, 0.05, { c: [1, 1, 1] }); } }
      }
    }
    // 橋：床版の下側・橋脚・下の川や谷の地面（道路の下まで続ける）
    if (br) for (let s = s0; s < s1; s += 10) { const e = s + 10;
      const pa = this.pos(s, -ROAD_HW), pb = this.pos(s, ROAD_HW), qa = this.pos(e, -ROAD_HW), qb = this.pos(e, ROAD_HW), cc = { c: [0.7, 0.7, 0.68] };
      g.s.quadN([pb[0], pb[1] - 1.4, pb[2]], [pa[0], pa[1] - 1.4, pa[2]], [qa[0], qa[1] - 1.4, qa[2]], [qb[0], qb[1] - 1.4, qb[2]], [0, -1, 0], cc);
      for (const [p, q] of [[pa, qa], [pb, qb]]) g.s.quadN([p[0], p[1] - 1.4, p[2]], [q[0], q[1] - 1.4, q[2]], [q[0], q[1], q[2]], [p[0], p[1], p[2]], [0, 0, 1], cc);
      if (Math.round(s) % 40 === 0) for (const u of [-5, 5]) { const p = this.pos(s, u), gy = this.terrainH(s, u > 0 ? 14 : -14) - 4; g.s.box(p[0] - 1, gy, p[2] - 1, p[0] + 1, p[1] - 1.4, p[2] + 1, { c: [0.72, 0.72, 0.7] }); }
      const under = (this.terrainH(s, 14) + this.terrainH(s, -14)) / 2 - 1;
      g.s.quadN([pa[0], under, pa[2]], [pb[0], under, pb[2]], [qb[0], under, qb[2]], [qa[0], under, qa[2]], [0, 1, 0], { c: this.season === 'winter' ? [0.92, 0.94, 0.98] : [0.5, 0.6, 0.45], lay: this.season === 'winter' ? L.WHITE : L.GRASS }); }
    // 修正117：橋だと一目で分かるように、両側にアーチ（上路から見える鋼製アーチと吊り材）を架け、橋の両端に橋名板を付ける
    for (const B of this.D.bridges) if (s1 > B[0] && s0 < B[1]) this.bridgeArch(g, Math.max(s0, B[0]), Math.min(s1, B[1]), B);
    // トンネル：側壁・天井・照明。坑口の上は山肌でふさぐ
    if (tun) for (let s = s0; s < s1; s += 10) { const e = s + 10, wallC = { c: [0.85, 0.84, 0.8], lay: L.TUNNELWALL };
      for (const side of [1, -1]) { const p = this.pos(s, side * 10.4), q = this.pos(e, side * 10.4); g.s.quadN([p[0], p[1], p[2]], [q[0], q[1], q[2]], [q[0], q[1] + 6.2, q[2]], [p[0], p[1] + 6.2, p[2]], [-side, 0, 0], wallC);
        const l0 = this.pos(s + 2, side * 10.3, 5), l1 = this.pos(s + 6, side * 10.3, 5); g.det.beam(l0, l1, 0.12, { c: [1, 0.85, 0.6], mat: 8 }); }
      const c0 = this.pos(s, -10.4, 6.2), c1 = this.pos(s, 10.4, 6.2), d0 = this.pos(e, -10.4, 6.2), d1 = this.pos(e, 10.4, 6.2); g.s.quadN(c1, c0, d0, d1, [0, -1, 0], { c: [0.5, 0.5, 0.5] });
      // 天井の上を山でふさぐ
      const top = Math.max(this.terrainH(s, 16), this.terrainH(s, -16), c0[1] + 6);
      g.s.quadN([c0[0], top, c0[2]], [c1[0], top, c1[2]], [d1[0], top, d1[2]], [d0[0], top, d0[2]], [0, 1, 0], { c: this.groundCol('forest'), lay: this.season === 'winter' ? L.WHITE : L.FOREST });
    }
    for (const [a, b, nm] of this.D.tunnels) for (const sp of [a, b]) if (sp >= s0 && sp < s1) { // 坑口（コンクリートの面・トンネル名）
      const dir = sp === a ? -1 : 1, P = (u, y) => this.pos(sp, u, y), top = Math.max(this.terrainH(sp, 16), this.terrainH(sp, -16), this.roadY(sp) + 12), H = top - this.roadY(sp), cc = { c: [0.75, 0.74, 0.7] };
      g.s.quadN(P(-14, 6.2), P(14, 6.2), P(14, H), P(-14, H), [0, 0, dir], cc);
      for (const side of [1, -1]) g.s.quadN(P(side * 10.4, 0), P(side * 16, 0), P(side * 16, H), P(side * 10.4, H), [0, 0, dir], cc);
      const lay = this.tunnelSign || (this.tunnelSign = {}); const sl = lay[nm] || (lay[nm] = this.greenSign([nm], { bg: '#2a2a2a', scale: 0.8 }));
      const sa = this.pos(sp + dir * 0.05, -4, 6.6), sb = this.pos(sp + dir * 0.05, 4, 6.6); g.s.panel(sa[0], sa[2], sb[0], sb[2], sa[1], sa[1] + 2, 0.05, [0, 0, dir], { c: [1, 1, 1], mat: 16, lay });
    }
    this.terrainSeg(g, s0, s1);
    this.scenery(g, s0, s1, R);
  }
  // 修正117：橋のアーチ（チャンクの範囲 s0〜s1 の分だけ作る）。B=[始点, 終点, 橋名]。アーチの高さは橋長の約12%（6〜22m）
  bridgeArch(g, s0, s1, B) {
    const [a, b, nm] = B, L0 = b - a, rise = Math.min(22, Math.max(6, L0 * 0.12)), col = { c: { spring: [0.92, 0.45, 0.5], summer: [0.95, 0.96, 0.98], autumn: [0.85, 0.3, 0.18], winter: [0.3, 0.5, 0.85] }[this.season] || [0.8, 0.8, 0.8] };
    const H = s => { const t = clamp((s - a) / L0, 0, 1); return 1.1 + rise * 4 * t * (1 - t); };
    for (const side of [1, -1]) { const u = side * 10.6;
      for (let s = s0; s < s1 - 0.01; s += 5) { const e = Math.min(s1, s + 5); g.s.beam(this.pos(s, u, H(s)), this.pos(e, u, H(e)), 0.45, col);
        if (Math.round(s - a) % 10 === 0 && H(s) > 2.2) g.s.beam(this.pos(s, u, 1.1), this.pos(s, u, H(s)), 0.07, { c: col.c.map(v => v * 0.85) }); }
    }
    // 上の横つなぎ（車両の上 7m 以上の所だけ）
    for (let s = Math.ceil((s0 - a) / 20) * 20 + a; s < s1; s += 20) if (H(s) > 7.5) g.s.beam(this.pos(s, -10.6, H(s)), this.pos(s, 10.6, H(s)), 0.3, col);
    // 橋名板（両端の親柱）
    const lay = (this.tunnelSign || (this.tunnelSign = {}))['br:' + nm] || (this.tunnelSign['br:' + nm] = this.greenSign([nm], { bg: '#3b3a36', scale: 0.8 }));
    for (const sp of [a, b]) if (sp >= s0 && sp < s1) for (const side of [1, -1]) { const p = this.pos(sp, side * 10.6), y = p[1];
      g.s.box(p[0] - 0.5, y, p[2] - 0.5, p[0] + 0.5, y + 2.6, p[2] + 0.5, { c: [0.7, 0.68, 0.64] });
      const dir = sp === a ? -1 : 1, q0 = this.pos(sp + dir * 0.52, side * 10.6 - 0.45, 1.3), q1 = this.pos(sp + dir * 0.52, side * 10.6 + 0.45, 1.3); g.s.panel(q0[0], q0[2], q1[0], q1[2], y + 1.3, y + 2.3, 0.03, [0, 0, dir], { c: [1, 1, 1], mat: 16, lay }); }
  }
  groundCol(k) {
    const sea = this.season, D = this.D;
    switch (k) { case 'snow': return [0.95, 0.96, 1]; case 'ice': return [0.55, 0.74, 0.9]; /* 修正117：凍った湖面は雪原と見分けられる青みの氷色に */ case 'sand': return [0.95, 0.88, 0.7]; case 'rock': return [0.62, 0.58, 0.52];
      case 'field': return sea === 'autumn' ? [0.82, 0.7, 0.4] : [0.75, 0.66, 0.5]; case 'paddy': return sea === 'spring' ? [0.75, 0.82, 0.9] : sea === 'summer' ? [0.55, 0.85, 0.4] : [0.85, 0.75, 0.42];
      case 'forest': return sea === 'autumn' ? [0.95, 0.55, 0.3] : sea === 'winter' ? [0.92, 0.94, 0.98] : sea === 'spring' ? [0.7, 0.85, 0.6] : [0.55, 0.78, 0.5];
      default: return D.grass; }
  }
  terrainSeg(g, s0, s1) {
    const US = [14, 20, 28, 40, 55, 75, 100, 135, 180, 240, 320, 420];
    const lay = k => k === 'snow' || k === 'ice' ? L.WHITE : k === 'sand' ? L.FIELD : k === 'rock' ? L.ROCK : k === 'field' ? L.FIELD : k === 'paddy' ? L.PADDY : k === 'forest' ? L.FOREST : L.GRASS;
    const ds = 10;
    for (const side of [1, -1]) for (let s = s0; s < s1 - 0.01; s += ds) { const e = Math.min(s1, s + ds);
      const u0s = [ROAD_HW, ...US];
      for (let j = 0; j < u0s.length - 1; j++) {
        const ua = side * u0s[j], ub = side * u0s[j + 1];
        if (u0s[j] > 60 && (Math.floor(s / ds) % 2)) continue; // 遠くは20m刻み（下で2区間分まとめる）
        const e2 = u0s[j] > 60 ? Math.min(s1, s + 2 * ds) : e;
        const P = (u, ss) => { const p = this.pos(ss, u); return [p[0], this.terrainH(ss, u), p[2]]; };
        const k = this.groundKind((s + e2) / 2, (ua + ub) / 2), o = { c: this.groundCol(k), lay: lay(k) };
        const A = P(ua, s), B = P(ub, s), Cc = P(ub, e2), Dd = P(ua, e2);
        if (side > 0) { g.s.tri(A, B, Cc, o, [0, 0], [0, 0], [0, 0], [A[0], A[1] - 50, A[2]]); g.s.tri(A, Cc, Dd, o, [0, 0], [0, 0], [0, 0], [A[0], A[1] - 50, A[2]]); }
        else { g.s.tri(A, Cc, B, o, [0, 0], [0, 0], [0, 0], [A[0], A[1] - 50, A[2]]); g.s.tri(A, Dd, Cc, o, [0, 0], [0, 0], [0, 0], [A[0], A[1] - 50, A[2]]); }
      }
      // 水面（川・湖・海辺・渓流）
      const w = this.zoneW((s + e) / 2, side);
      if (w.river > 0.3) this.water(g, s, e, side * 40, side * 95, this.roadY(s) - 3.8);
      if (w.gorge > 0.3) this.water(g, s, e, side * 60, side * 90, this.roadY(s) - 36.5);
      if (w.valley > 0.3) this.water(g, s, e, side * 12, side * 160, this.roadY(s) - 20.5);
    }
  }
  water(g, s, e, u0, u1, y) { const P = (u, ss) => { const p = this.pos(ss, u); return [p[0], y, p[2]]; }; g.s.quadN(P(u0, s), P(u1, s), P(u1, e), P(u0, e), [0, 1, 0], this.season === 'winter' ? { c: [0.8, 0.88, 0.95], lay: L.WHITE } : { c: [0.7, 0.85, 0.95], lay: L.WATER, mat: 21 }); }
  // ---------- 樹木・建物 ----------
  tree(gb, kind, x, y, z, sc, R) {
    const tr = { c: [0.38, 0.28, 0.2] };
    if (kind === 'sakura') { gb.cyl(x, y, z, 0.18 * sc, 2.4 * sc, 5, { c: [0.35, 0.25, 0.22] }); for (let k = 0; k < 4; k++) { const a = k * 1.7 + R() * 0.5, r = 1.6 * sc; gb.cbox(x + Math.cos(a) * r * 0.6, y + 3.2 * sc + R() * 0.8 * sc, z + Math.sin(a) * r * 0.6, 2.6 * sc, 1.8 * sc, 2.6 * sc, { c: [1, 0.78 + R() * 0.08, 0.86] }); } gb.cbox(x, y + 3.9 * sc, z, 3.2 * sc, 1.6 * sc, 3.2 * sc, { c: [0.99, 0.82, 0.9] }); return; }
    if (kind === 'maple') { const cols = [[0.92, 0.25, 0.12], [0.95, 0.5, 0.12], [0.95, 0.75, 0.2], [0.75, 0.15, 0.12]], c = cols[(R() * 4) | 0]; gb.cyl(x, y, z, 0.15 * sc, 2.6 * sc, 5, tr); gb.cbox(x, y + 3.6 * sc, z, 3.4 * sc, 2.6 * sc, 3.4 * sc, { c }); gb.cbox(x + 0.6 * sc, y + 4.8 * sc, z - 0.3 * sc, 2.2 * sc, 1.6 * sc, 2.2 * sc, { c: c.map(v => v * 1.05) }); return; }
    if (kind === 'pine' || kind === 'snowpine') { const h = 7 * sc, r = 1.9 * sc, cg = kind === 'snowpine' ? [0.32, 0.45, 0.35] : [0.28, 0.48, 0.32];
      gb.cyl(x, y, z, 0.2 * sc, 1.6 * sc, 4, tr);
      for (let l = 0; l < 3; l++) { const y0 = y + 1.2 * sc + l * 1.9 * sc, rr = r * (1 - l * 0.28);
        for (let k = 0; k < 6; k++) { const a0 = k / 6 * 6.283, a1 = (k + 1) / 6 * 6.283; gb.tri([x + Math.cos(a0) * rr, y0, z + Math.sin(a0) * rr], [x + Math.cos(a1) * rr, y0, z + Math.sin(a1) * rr], [x, y0 + 2.6 * sc, z], { c: cg, lay: L.TREE }, [0, 1], [1, 1], [0.5, 0], [x, y0 - 1, z]); }
        if (kind === 'snowpine') for (let k = 0; k < 6; k++) { const a0 = k / 6 * 6.283, a1 = (k + 1) / 6 * 6.283, r2 = rr * 0.62; gb.tri([x + Math.cos(a0) * r2, y0 + 1.0 * sc, z + Math.sin(a0) * r2], [x + Math.cos(a1) * r2, y0 + 1.0 * sc, z + Math.sin(a1) * r2], [x, y0 + 2.68 * sc, z], { c: [0.97, 0.98, 1] }, [0, 0], [0, 0], [0, 0], [x, y0 - 1, z]); } }
      return; }
    if (kind === 'birch') { gb.cyl(x, y, z, 0.13 * sc, 4.5 * sc, 5, { c: [0.95, 0.94, 0.9] }); gb.cbox(x, y + 5 * sc, z, 2.4 * sc, 2.4 * sc, 2.4 * sc, { c: [0.5, 0.75, 0.35], lay: L.TREE }); return; }
    // 広葉樹（夏の緑）
    gb.cyl(x, y, z, 0.17 * sc, 2.6 * sc, 5, tr); gb.cbox(x, y + 3.8 * sc, z, 3.6 * sc, 3 * sc, 3.6 * sc, { c: [0.3 + R() * 0.1, 0.55 + R() * 0.1, 0.25], lay: L.TREE }); gb.cbox(x - 0.4 * sc, y + 5.2 * sc, z + 0.3 * sc, 2.4 * sc, 1.8 * sc, 2.4 * sc, { c: [0.35, 0.62, 0.3], lay: L.TREE });
  }
  house(gb, x, y, z, yaw, R, opt = {}) { // 地方の木造家屋（瓦屋根・雪国は雪をかぶる）
    const w = 7 + R() * 3, d = 6 + R() * 3, h = 3 + (R() < 0.5 ? 2.8 : 0), wall = { c: opt.wall || [0.9, 0.86, 0.78], side: { lay: L.HOUSE, tw: 3.5, th: 2.9 } };
    gb.setXf(x, y, z, yaw);
    gb.box(-w / 2, -0.5, -d / 2, w / 2, h, d / 2, wall);
    gb.gable(-w / 2, -d / 2, w / 2, d / 2, h, 1.8, { c: opt.roof || [0.3, 0.32, 0.38], lay: L.KAWARA, tw: 2, gc: wall.c });
    if (this.season === 'winter') gb.box(-w / 2 - 0.4, h + 0.9, -d / 2 - 0.3, w / 2 + 0.4, h + 1.4, d / 2 + 0.3, { c: [0.97, 0.98, 1] });
    if (opt.lamp) gb.box(-0.3, 1.8, d / 2 + 0.05, 0.3, 2.3, d / 2 + 0.25, { c: [1, 0.75, 0.4], mat: 8 });
    gb.clearXf();
    return Math.max(w, d) / 2;
  }
  scenery(g, s0, s1, R) {
    const season = this.season, D = this.D, main = D.tree;
    for (const side of [1, -1]) {
      const w = this.zoneW((s0 + s1) / 2, side); let best = 'hills', bw = 0; for (const t in w) if (w[t] > bw) { bw = w[t]; best = t; }
      const facZone = side > 0 && this.fac.some(f => s1 > f.s - 240 && s0 < f.s + 460);
      if (facZone) continue;
      const place = (u, kind, sc) => { const s = s0 + R() * (s1 - s0), p = this.pos(s, side * u), y = this.terrainH(s, side * u); if (y < -1 && season === 'summer') return; this.tree(g.s, kind, p[0], y - 0.2, p[2], sc, R); };
      // 並木・トンネル状の並木（桜・紅葉）
      if (best === 'sakura' || best === 'sakuraT') { for (let s = s0; s < s1; s += best === 'sakuraT' ? 9 : 13) { const u = best === 'sakuraT' ? 12.5 : 14.5, p = this.pos(s, side * u), y = this.terrainH(s, side * u); this.tree(g.s, 'sakura', p[0], y - 0.2, p[2], best === 'sakuraT' ? 1.75 : 1.25, R);
          if (best === 'sakuraT') { const c = this.pos(s, side * 7.5, 0); g.s.cbox(c[0], this.roadY(s) + 7.6, c[2], 5, 1.2, 6, { c: [1, 0.8, 0.88], lay: L.TREE }); } } }
      if (best === 'mapleT') for (let s = s0; s < s1; s += 9) { const p = this.pos(s, side * 12.5), y = this.terrainH(s, side * 12.5); this.tree(g.s, 'maple', p[0], y - 0.2, p[2], 1.7, R); const c = this.pos(s, side * 7.5, 0); g.s.cbox(c[0], this.roadY(s) + 7.4, c[2], 5, 1.2, 6, { c: R() < 0.5 ? [0.92, 0.3, 0.12] : [0.95, 0.62, 0.15], lay: L.TREE }); }
      // 森・雑木林
      const forest = { mount: 9, cliff: 7, hills: 4, snowwall: 9, mapleT: 6, gorge: 5, plateau: 2, village: 2, lake: 1, snowfield: 2, valley: 3, river: 2, farm: 1, sakura: 1, town: 1, onsen: 2, harbor: 0, sea: 0, bay: 0, sakuraT: 2 }[best] || 2;
      for (let k = 0; k < forest; k++) { const u = 18 + R() * (best === 'plateau' ? 120 : 160); const kind = season === 'winter' ? 'snowpine' : season === 'autumn' ? (R() < 0.75 ? 'maple' : 'pine') : season === 'spring' ? (R() < 0.25 ? 'sakura' : R() < 0.5 ? 'pine' : 'green') : best === 'plateau' ? (R() < 0.5 ? 'birch' : 'green') : R() < 0.4 ? 'pine' : 'green'; place(u, kind, 0.9 + R() * 0.6); }
      if (best === 'river') for (let s = s0; s < s1; s += 16) { for (const u of [36, 100]) { const p = this.pos(s, side * u), y = this.terrainH(s, side * u); this.tree(g.s, season === 'spring' ? 'sakura' : 'green', p[0], y - 0.2, p[2], 1.3, R); } }
      // 集落・城下町・港町・温泉街の家並み
      if (['town', 'village', 'harbor', 'onsen'].includes(best) || (best === 'farm' && R() < 0.25)) {
        const n = best === 'farm' ? 1 : best === 'town' || best === 'onsen' ? 4 : 2;
        for (let k = 0; k < n; k++) { const s = s0 + R() * (s1 - s0), u = 24 + R() * (best === 'harbor' ? 18 : 70), p = this.pos(s, side * u), y = this.terrainH(s, side * u), at = this.at(s);
          this.house(g.s, p[0], y, p[2], at.h + (side > 0 ? Math.PI / 2 : -Math.PI / 2), R, best === 'onsen' ? { lamp: true, wall: [0.55, 0.4, 0.3] } : best === 'harbor' ? { wall: [0.85, 0.85, 0.82], roof: [0.25, 0.4, 0.55] } : {}); }
      }
      if (best === 'harbor' && side < 0 && R() < 0.6) { const s = s0 + 20, p = this.pos(s, -70), y = 0.3; g.s.box(p[0] - 3, -0.5, p[2] - 12, p[0] + 3, y + 0.4, p[2] + 12, { c: [0.7, 0.7, 0.68] }); const b = this.pos(s, -82); g.s.box(b[0] - 1.6, -0.2, b[2] - 5, b[0] + 1.6, 1.2, b[2] + 5, { c: [0.95, 0.95, 0.95] }); g.s.box(b[0] - 1, 1.2, b[2] - 1, b[0] + 1, 2.8, b[2] + 2, { c: [0.3, 0.45, 0.7] }); }
      if (best === 'onsen' && R() < 0.7) { const p = this.pos(s0 + 25, side * 30), y = this.terrainH(s0 + 25, side * 30); (this.steam || (this.steam = [])).push([p[0], y + 1, p[2]]); }
      this.extras(g, s0, s1, side, best, R); // 修正104：季節ごとの見どころ（区間ごとに変わる）
      if (best === 'snowwall') { // 雪壁（除雪で積み上がった雪）
        const a = this.pos(s0, side * 10.2), b = this.pos(s1, side * 10.2), c = this.pos(s1, side * 12.5), d = this.pos(s0, side * 12.5), hh = 2.6;
        g.s.quadN([a[0], a[1] + 0.6, a[2]], [b[0], b[1] + 0.6, b[2]], [c[0], c[1] + hh, c[2]], [d[0], d[1] + hh, d[2]], [0, 1, 0], { c: [0.95, 0.96, 1], lay: L.WHITE });
        g.s.quadN([a[0], a[1], a[2]], [b[0], b[1], b[2]], [b[0], b[1] + 0.6, b[2]], [a[0], a[1] + 0.6, a[2]], [-side, 0, 0], { c: [0.9, 0.92, 0.97], lay: L.WHITE });
      } else if (season === 'winter' && !this.inTunnelS((s0 + s1) / 2) && !this.inBridgeS((s0 + s1) / 2)) { const a = this.pos(s0, side * 10.4), b = this.pos(s1, side * 10.4), c = this.pos(s1, side * 12.6), d = this.pos(s0, side * 12.6);
        g.s.quadN([a[0], a[1] + 0.7, a[2]], [b[0], b[1] + 0.7, b[2]], [c[0], c[1] + 0.2, c[2]], [d[0], d[1] + 0.2, d[2]], [0, 1, 0], { c: [0.96, 0.97, 1], lay: L.WHITE }); }
    }
    // 照明（中央分離帯）。トンネルの前後・施設の前後
    if (Math.round(s0) % 150 === 0 || this.fac.some(f => s0 > f.s - 300 && s0 < f.s + 500)) { const p = this.pos(s0, 0); g.det.box(p[0] - 0.12, p[1] + 0.8, p[2] - 0.12, p[0] + 0.12, p[1] + 10, p[2] + 0.12, { c: [0.6, 0.6, 0.62] }); for (const side of [1, -1]) { const q = this.pos(s0, side * 2.2, 10); g.det.beam([p[0], p[1] + 10, p[2]], q, 0.08, { c: [0.6, 0.6, 0.62] }); g.det.box(q[0] - 0.3, q[1] - 0.25, q[2] - 0.3, q[0] + 0.3, q[1], q[2] + 0.3, { c: [1, 0.95, 0.8], mat: 8 }); } }
    // キロポスト（表示km：10kmごと＝実距離312.5mごと）
    for (let km = Math.ceil(Math.max(0, s0) * DIST_SCALE / 10000) * 10; km * 1000 / DIST_SCALE < s1 && km <= 400; km += 10) {
      const sk = km * 1000 / DIST_SCALE, p = this.pos(sk, 10.7), at = this.at(sk), lay = this.kpLay || (this.kpLay = {}), l = lay[km] || (lay[km] = this.greenSign([String(km)], { bg: '#1d4f9c' }));
      const c = Math.cos(at.h), sn = Math.sin(at.h);
      g.det.box(p[0] - 0.04, p[1], p[2] - 0.04, p[0] + 0.04, p[1] + 1.3, p[2] + 0.04, { c: [0.8, 0.8, 0.8] });
      g.det.panel(p[0] - c * 0.25, p[2] + sn * 0.25, p[0] + c * 0.25, p[2] - sn * 0.25, p[1] + 1.3, p[1] + 1.8, 0.05, [-sn, 0, -at.h * 0 - Math.cos(at.h)], { c: [1, 1, 1], mat: 16, lay: l });
    }
  }
  // ---------- 修正104：季節ごとの景観要素（第9章の要素に追加。区間の地形タイプごとに出るものが変わる） ----------
  // 低ポリの球（雪だるま・かまくら・ひまわりの花など）
  ball(gb, x, y, z, r, o, n = 6, half = false) { const rows = half ? Math.ceil(n / 2) : n, lo = half ? 0 : -Math.PI / 2, hi = Math.PI / 2, c = [x, y, z];
    const P = (i, j) => { const ph = lo + (hi - lo) * i / rows, a = j / n * Math.PI * 2; return [x + Math.cos(a) * Math.cos(ph) * r, y + Math.sin(ph) * r, z + Math.sin(a) * Math.cos(ph) * r]; };
    for (let i = 0; i < rows; i++) for (let j = 0; j < n; j++) { const A = P(i, j), B = P(i, j + 1), C = P(i + 1, j + 1), D = P(i + 1, j); gb.tri(A, C, B, o, [0, 0], [0, 0], [0, 0], c); gb.tri(A, D, C, o, [0, 0], [0, 0], [0, 0], c); } }
  extras(g, s0, s1, side, best, R) {
    const se = this.season, at = this.at((s0 + s1) / 2), yaw = at.h, P = (s, u) => { const p = this.pos(s, side * u); return [p[0], this.terrainH(s, side * u), p[2]]; };
    const tun = this.D.tunnels.some(([a, b]) => s1 > a - 40 && s0 < b + 40), brg = this.inBridgeS((s0 + s1) / 2); if (tun || brg) return;
    const farmy = best === 'farm' || best === 'hills' || best === 'valley' || best === 'village' || best === 'river';
    if (se === 'spring') {
      // 菜の花畑・チューリップ畑（色の帯。遠くからも見えるよう g.s）
      if (farmy && R() < 0.5) { const s = s0 + 5, u = 22 + R() * 30, tul = R() < 0.4, cols = tul ? [[1, 0.25, 0.3], [1, 0.85, 0.2], [1, 0.55, 0.75], [0.97, 0.97, 0.95]] : [[1, 0.88, 0.15]];
        for (let r = 0; r < 6; r++) { const a = P(s, u + r * 2.2), b = P(s + 36, u + r * 2.2), c = P(s + 36, u + r * 2.2 + 1.5), d = P(s, u + r * 2.2 + 1.5), col = cols[r % cols.length], h = 0.45;
          g.s.quadN([a[0], a[1] + h, a[2]], [b[0], b[1] + h, b[2]], [c[0], c[1] + h, c[2]], [d[0], d[1] + h, d[2]], [0, 1, 0], { c: col }); g.s.quadN([a[0], a[1] - 0.1, a[2]], [b[0], b[1] - 0.1, b[2]], [b[0], b[1] + h, b[2]], [a[0], a[1] + h, a[2]], [-side, 0, 0], { c: col.map(v => v * 0.8) }); } }
      // 鯉のぼりのある家（集落・田園・城下町）
      if ((farmy || best === 'town') && R() < 0.22) { const s = s0 + 10 + R() * 30, q = P(s, 30 + R() * 20); this.house(g.s, q[0] + 6, q[1], q[2], yaw + Math.PI / 2, R);
        g.s.cyl(q[0], q[1], q[2], 0.12, 11, 6, { c: [0.85, 0.85, 0.82] }); g.s.cbox(q[0], q[1] + 11.1, q[2], 0.5, 0.25, 0.5, { c: [1, 0.85, 0.2] });
        const dx = Math.cos(yaw) * side, dz = -Math.sin(yaw) * side; [[0, 0, 0.6], [1, 0.15, 0.15], [0.2, 0.35, 0.95]].forEach((c, k) => { const yy = q[1] + 10 - k * 1.5, L2 = 3.2 - k * 0.5; g.det.setXf(q[0], yy, q[2], yaw + Math.PI / 2); g.det.box(0.1, -0.35, -0.3, 0.1 + L2, 0.35, 0.3, { c }); g.det.box(0.1, -0.12, -0.31, 0.5, 0.12, 0.31, { c: [1, 1, 1] }); g.det.clearXf(); void dx; void dz; }); }
    }
    if (se === 'summer') {
      // ひまわり畑（遠くは黄色い帯、近くは一本ずつの花）
      if ((best === 'hills' || best === 'plateau') && R() < 0.45) { const s = s0 + 6, u = 20 + R() * 25;
        for (let r = 0; r < 5; r++) { const a = P(s, u + r * 2.4), b = P(s + 34, u + r * 2.4), c = P(s + 34, u + r * 2.4 + 1.6), d = P(s, u + r * 2.4 + 1.6), h = 1.6; g.s.quadN([a[0], a[1] + h, a[2]], [b[0], b[1] + h, b[2]], [c[0], c[1] + h, c[2]], [d[0], d[1] + h, d[2]], [0, 1, 0], { c: [1, 0.82, 0.1] });
          g.s.quadN([a[0], a[1], a[2]], [b[0], b[1], b[2]], [b[0], b[1] + h, b[2]], [a[0], a[1] + h, a[2]], [-side, 0, 0], { c: [0.3, 0.55, 0.2] });
          for (let k = 0; k < 7; k++) { const q = P(s + 2 + k * 5, u + r * 2.4 + 0.8); g.det.cbox(q[0], q[1] + 0.9, q[2], 0.08, 1.8, 0.08, { c: [0.3, 0.5, 0.2] }); g.det.cbox(q[0], q[1] + 1.95, q[2], 0.75, 0.75, 0.2, { c: [1, 0.8, 0.08] }); g.det.cbox(q[0], q[1] + 1.95, q[2], 0.3, 0.3, 0.24, { c: [0.35, 0.22, 0.1] }); } } }
      // 漁港の船（港町の区間は船を増やす：漁船・小型船、マストと旗）
      if (best === 'harbor' && side < 0) for (let k = 0; k < 3; k++) { const s = s0 + 8 + k * 15, b = this.pos(s, -(88 + R() * 25)), cols = [[0.95, 0.95, 0.95], [0.2, 0.45, 0.8], [0.85, 0.25, 0.2]], c = cols[(R() * 3) | 0];
        g.s.setXf(b[0], 0, b[2], yaw + (R() - 0.5) * 0.6); g.s.box(-1.8, -0.2, -5.5, 1.8, 1.1, 5.5, { c }); g.s.box(-1.9, 1.0, -5.6, 1.9, 1.2, 5.6, { c: [0.25, 0.25, 0.28] }); g.s.box(-1.1, 1.2, -2.5, 1.1, 3.0, 0.8, { c: [0.95, 0.95, 0.92] }); g.s.box(-0.07, 3.0, -1, 0.07, 7.5, -0.86, { c: [0.8, 0.8, 0.8] }); g.s.box(0.07, 6.5, -1, 1.3, 7.3, -0.95, { c: [0.95, 0.2, 0.2] }); g.s.clearXf(); }
    }
    if (se === 'autumn') {
      // 柿の木（橙の実）
      if (farmy && R() < 0.5) for (let k = 0; k < 2; k++) { const q = P(s0 + R() * 50, 18 + R() * 30); g.s.cyl(q[0], q[1], q[2], 0.16, 2.2, 5, { c: [0.35, 0.25, 0.18] }); g.s.cbox(q[0], q[1] + 3.3, q[2], 3.2, 2.2, 3.2, { c: [0.45, 0.4, 0.2], lay: L.TREE });
        for (let j = 0; j < 9; j++) g.det.cbox(q[0] + (R() - 0.5) * 3.2, q[1] + 2.4 + R() * 2.2, q[2] + (R() - 0.5) * 3.2, 0.28, 0.28, 0.28, { c: [1, 0.48, 0.08] }); }
      // 稲架け（木組みに稲束を掛けて干す）
      if ((best === 'farm' || best === 'village' || best === 'valley' || best === 'hills') && R() < 0.45) { const s = s0 + 8, u = 20 + R() * 20;
        for (let r = 0; r < 2; r++) { const a = P(s, u + r * 7), b = P(s + 30, u + r * 7); for (let k = 0; k <= 5; k++) { const t = k / 5, x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t, y = a[1] + (b[1] - a[1]) * t; g.s.box(x - 0.08, y, z - 0.08, x + 0.08, y + 2.3, z + 0.08, { c: [0.45, 0.33, 0.22] }); }
          g.s.beam([a[0], a[1] + 2.1, a[2]], [b[0], b[1] + 2.1, b[2]], 0.06, { c: [0.45, 0.33, 0.22] });
          const n = 18; for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t, y = a[1] + (b[1] - a[1]) * t; g.s.cbox(x, y + 1.55, z, 0.7, 1.1, 1.4, { c: [0.85, 0.7, 0.32] }); } } }
      // 渓流の滝（渓谷の区間：崖と白い流れ、滝つぼ）
      if (best === 'gorge' && R() < 0.22) { const s = s0 + 25, u = 46, top = P(s, u + 8), bot = P(s, u - 2), h = Math.max(10, top[1] - bot[1] + 14), at2 = this.at(s), c = Math.cos(at2.h), sn = Math.sin(at2.h);
        g.s.setXf(top[0], bot[1], top[2], at2.h + (side > 0 ? Math.PI / 2 : -Math.PI / 2)); g.s.box(-9, -2, 0, 9, h, 6, { c: [0.45, 0.42, 0.38], lay: L.ROCK, side: { lay: L.ROCK, tw: 4, th: 3 } }); g.s.clearXf();
        const w0 = [top[0] - c * 2.5, top[2] + sn * 2.5], w1 = [top[0] + c * 2.5, top[2] - sn * 2.5], nx = -side * c * 0, d = side > 0 ? -1 : 1, off = [Math.cos(at2.h + Math.PI / 2) * d * -0.2, -Math.sin(at2.h + Math.PI / 2) * d * -0.2]; void nx;
        g.s.quadN([w0[0] + off[0], bot[1] + 0.3, w0[1] + off[1]], [w1[0] + off[0], bot[1] + 0.3, w1[1] + off[1]], [w1[0] + off[0], bot[1] + h - 1, w1[1] + off[1]], [w0[0] + off[0], bot[1] + h - 1, w0[1] + off[1]], [0, 0, 1], { c: [0.92, 0.96, 1], lay: L.WATER, mat: 21 }, [[0, 4], [1, 4], [1, 0], [0, 0]]);
        g.s.quadN([w1[0] + off[0], bot[1] + 0.3, w1[1] + off[1]], [w0[0] + off[0], bot[1] + 0.3, w0[1] + off[1]], [w0[0] + off[0], bot[1] + h - 1, w0[1] + off[1]], [w1[0] + off[0], bot[1] + h - 1, w1[1] + off[1]], [0, 0, -1], { c: [0.92, 0.96, 1], lay: L.WATER, mat: 21 }, [[0, 4], [1, 4], [1, 0], [0, 0]]);
        this.ball(g.s, bot[0], bot[1] - 0.6, bot[2], 4, { c: [0.6, 0.78, 0.85], lay: L.WATER, mat: 21 }, 8, true); }
    }
    if (se === 'winter') {
      // かまくら（中にろうそくの灯り）と雪だるま
      if ((best === 'snowfield' || best === 'onsen' || best === 'hills' || best === 'lake' || best === 'valley') && R() < 0.35) { const q = P(s0 + R() * 40, 18 + R() * 22); this.ball(g.s, q[0], q[1] - 0.2, q[2], 1.9, { c: [0.97, 0.98, 1] }, 8, true);
        const at2 = this.at(s0), ex = -Math.cos(at2.h) * side * 1.75, ez = Math.sin(at2.h) * side * 1.75; g.s.cbox(q[0] + ex, q[1] + 0.55, q[2] + ez, 0.9, 1.1, 0.9, { c: [0.12, 0.1, 0.1] }); g.det.cbox(q[0] + ex * 0.9, q[1] + 0.45, q[2] + ez * 0.9, 0.12, 0.2, 0.12, { c: [1, 0.7, 0.35], mat: 18 }); }
      if ((best === 'snowfield' || best === 'onsen' || best === 'village' || best === 'hills') && R() < 0.35) { const q = P(s0 + R() * 40, 15 + R() * 20); this.ball(g.s, q[0], q[1] + 0.5, q[2], 0.65, { c: [0.98, 0.98, 1] }); this.ball(g.s, q[0], q[1] + 1.4, q[2], 0.42, { c: [0.98, 0.98, 1] }); g.det.cyl(q[0], q[1] + 1.72, q[2], 0.22, 0.3, 6, { c: [0.75, 0.2, 0.15] }); g.det.cbox(q[0] - Math.cos(yaw) * side * 0.4, q[1] + 1.45, q[2] + Math.sin(yaw) * side * 0.4, 0.07, 0.07, 0.07, { c: [0.1, 0.1, 0.1] }); }
      // 修正117：氷鏡湖（凍った湖）の上のわかさぎ釣りのテント（色とりどりの小屋）と、湖面に積もった雪の縞。湖だと一目で分かるように
      if (best === 'lake' && R() < 0.75) for (let k = 0; k < 3; k++) { const q = P(s0 + 8 + R() * 34, 45 + R() * 110), cols = [[0.9, 0.25, 0.2], [0.2, 0.45, 0.85], [0.95, 0.6, 0.1], [0.3, 0.65, 0.35]], c = cols[(R() * 4) | 0];
        g.s.setXf(q[0], q[1], q[2], yaw + R() * 1.5); g.s.box(-1.1, 0, -1.1, 1.1, 1.5, 1.1, { c }); g.s.box(-1.25, 1.5, -1.25, 1.25, 1.75, 1.25, { c: c.map(v => v * 0.8) }); g.s.box(-0.35, 0, 1.1, 0.35, 1.1, 1.12, { c: [0.15, 0.12, 0.1] }); g.s.clearXf(); }
      if (best === 'lake' && R() < 0.5) { const q = P(s0 + 12, 70 + R() * 60), at2 = this.at(s0); g.s.setXf(q[0], q[1] + 0.03, q[2], at2.h + 0.4); g.s.quadN([-14, 0, -3], [14, 0, -3], [14, 0, 3], [-14, 0, 3], [0, 1, 0], { c: [0.93, 0.95, 1], lay: L.WHITE }); g.s.clearXf(); }
      // 除雪車の作業（路肩の外で停車中のロータリー除雪車：黄色い車体・回転灯・雪の吹き上げ）
      if ((best === 'snowwall' || best === 'snowfield') && R() < 0.12) { const s = s0 + 20, q = this.pos(s, side * 14.2), y = this.terrainH(s, side * 14.2), at2 = this.at(s);
        g.s.setXf(q[0], y, q[2], at2.h); g.s.box(-1.3, 0.4, -2.5, 1.3, 2.4, 2.2, { c: [0.95, 0.72, 0.1] }); g.s.box(-1.25, 2.4, -0.6, 1.25, 3.4, 1.4, { c: [0.95, 0.72, 0.1] }); g.s.box(-1.2, 2.6, 1.38, 1.2, 3.25, 1.42, { c: [0.3, 0.4, 0.5] });
        g.s.box(-1.5, 0.2, 2.2, 1.5, 1.6, 3.4, { c: [0.85, 0.2, 0.15] }); for (const x of [-1.2, 1.2]) for (const z of [-1.5, 1.0]) g.s.box(x - 0.2, 0, z - 0.5, x + 0.2, 1, z + 0.5, { c: [0.1, 0.1, 0.1] }); g.s.cbox(0, 3.6, 0.4, 0.35, 0.3, 0.35, { c: [1, 0.55, 0.05], mat: 18 });
        g.s.cyl(-1.1, 1.6, 2.8, 0.25, 2.6, 6, { c: [0.9, 0.7, 0.1] }); for (let k = 0; k < 6; k++) g.s.cbox(side * (1.2 + k * 0.9), 4.3 + k * 0.55 - k * k * 0.14, 2.8 + k * 0.3, 0.8 + k * 0.25, 0.6 + k * 0.2, 0.8 + k * 0.25, { c: [0.98, 0.99, 1] }); /* 吹き上げた雪（道路と反対側へ） */ g.s.clearXf(); }
    }
  }
  // ---------- 休憩施設（SA・PA・道の駅） ----------
  facility(f) {
    const at = this.at(f.s), ox = at.x, oz = at.z, h = at.h, y = f.y, season = this.season, R = rng(Math.floor(f.s));
    const W = this.W, toW = (lx, lz) => [ox + Math.cos(h) * lx + Math.sin(h) * lz, oz - Math.sin(h) * lx + Math.cos(h) * lz];
    const asph = { c: season === 'winter' ? [0.7, 0.72, 0.76] : [0.95, 0.95, 0.95], mat: 7, lay: L.ASPHALT }, white = { c: [1, 1, 1] }, snowy = season === 'winter';
    const sign = this.greenSign(f.type === 'MICHI' ? ['道の駅', f.name.replace('道の駅 ', '')] : [f.name], { bg: f.type === 'MICHI' ? '#2c6e2c' : '#0b6b3a' });
    const big = f.type === 'SA', michi = f.type === 'MICHI';
    // 当たり判定：敷地の外周の柵（減速車線・加速車線の外側を含む）と建物
    const wall = (a, b) => { const p = toW(...a), q = toW(...b); W.addWall(p[0], p[1], q[0], q[1], y - 2, y + 1.5); };
    wall([9.95, -170], [13.6, -60]); wall([13.6, -60], [13.6, -5]); wall([13.6, -5], [112, -5]); wall([112, -5], [112, 225]); wall([112, 225], [13.6, 225]); wall([13.6, 225], [13.6, 290]); wall([13.6, 290], [9.95, 420]);
    const bld = (x0, z0, x1, z1) => { const ps = [toW(x0, z0), toW(x1, z0), toW(x1, z1), toW(x0, z1)]; for (let i = 0; i < 4; i++) W.addWall(ps[i][0], ps[i][1], ps[(i + 1) % 4][0], ps[(i + 1) % 4][1], y - 2, y + 20); };
    const B = big ? [70, 40, 104, 160] : michi ? [72, 50, 104, 150] : [64, 80, 92, 140]; bld(...B);
    f.exit = toW(11.7, 250); f.exitYaw = h; f.entrance = toW(11.7, 5);
    this.add(f.s + 100, g => {
      g.d1.setXf(ox, y, oz, h); g.s.setXf(ox, y, oz, h); g.det.setXf(ox, y, oz, h); g.d2.setXf(ox, y, oz, h); g.glow.setXf(ox, y, oz, h);
      // 舗装：減速車線（テーパー）→ 施設内の通路 → 駐車場 → 加速車線
      g.d1.quadN([9.9, 0.01, -170], [9.9, 0.01, -60], [13.6, 0.01, -60], [9.9, 0.01, -170], [0, 1, 0], asph);
      g.d1.flat(9.9, -60, 13.6, 290, 0.01, asph); g.d1.quadN([9.9, 0.01, 290], [9.9, 0.01, 420], [9.9, 0.01, 420], [13.6, 0.01, 290], [0, 1, 0], asph);
      g.d1.flat(13.6, -5, 112, 225, 0.01, asph);
      // 区画線：大型車（道路側・斜め駐車）と普通車（2列×縦に並ぶ）、通路の矢印
      for (let z = 20; z < 200; z += 16) g.d2.flat(17, z, 17.15, z + 13, 0.02, white);
      for (let row = 0; row < 3; row++) { const x0 = 30 + row * 12; for (let z = 10; z < 215; z += 2.6) g.d2.flat(x0, z, x0 + 5, z + 0.12, 0.02, white); }
      g.d2.flat(9.9 + 0.05, -60, 10.05, 290, 0.02, white);
      // 植栽帯（本線との間）と外周の植え込み
      const hedge = { c: season === 'winter' ? [0.92, 0.94, 0.98] : season === 'autumn' ? [0.6, 0.45, 0.2] : [0.3, 0.5, 0.25], lay: season === 'winter' ? L.WHITE : L.TREE };
      g.s.box(13.6, 0, 40, 16.5, 0.7, 180, hedge); g.s.box(109, 0, -5, 112, 1.0, 225, hedge);
      for (let z = 0; z < 225; z += 22) this.tree(g.s, season === 'spring' ? 'sakura' : season === 'autumn' ? 'maple' : season === 'winter' ? 'snowpine' : 'green', 110.5, 0, z + 5, 0.9, R);
      // 照明（駐車場の水銀灯）
      for (let x = 30; x < 100; x += 26) for (let z = 20; z < 210; z += 45) { g.det.cyl(x, 0, z, 0.12, 9, 6, { c: [0.55, 0.55, 0.58] }); g.det.box(x - 0.6, 8.7, z - 0.3, x + 0.6, 9.1, z + 0.3, { c: [1, 0.95, 0.85], mat: 8 }); g.glow.flat(x - 9, z - 9, x + 9, z + 9, 0.05, { c: [1, 0.95, 0.85], mat: 5, lay: L.GLOW }); }
      // 歩道（建物の前）
      g.d1.flat(64, B[1] - 6, B[0], B[3] + 6, 0.12, { c: [0.85, 0.83, 0.78], lay: L.SIDEWALK });
      // 本館
      const [x0, z0, x1, z1] = B;
      { // 季節の飾り：建物の前の歩道に沿ってワイヤーを張る（春＝桜色のぼんぼり、夏＝風鈴、秋＝紅葉色の提灯、冬＝イルミネーション）。電飾は夜に光る（mat 8）
        const x = x0 - 2.4, orn = { spring: [1, 0.72, 0.84], summer: [0.55, 0.82, 1], autumn: [1, 0.5, 0.18], winter: [1, 0.92, 0.65] }[season], post = { c: [0.35, 0.33, 0.3] };
        for (let z = z0; z <= z1; z += 8) g.det.box(x - 0.05, 0, z - 0.05, x + 0.05, 3.3, z + 0.05, post);
        g.det.box(x - 0.01, 3.15, z0, x + 0.01, 3.18, z1, post);
        for (let z = z0 + 1; z < z1; z += season === 'winter' ? 0.5 : 1.33) { const sz = season === 'winter' ? 0.06 : 0.16, dy = season === 'winter' ? 0 : 0.25 + (Math.floor(z) % 2) * 0.08;
          g.det.box(x - sz, 3.1 - dy - sz * 1.6, z - sz, x + sz, 3.1 - dy, z + sz, { c: orn, mat: 8 }); if (season === 'summer') g.det.box(x - 0.01, 2.6 - dy, z - 0.04, x + 0.01, 2.9 - dy, z + 0.04, { c: [0.95, 0.95, 0.9] }); }
      }
      if (big) { // SA：2階建て相当の大きな建物。道路側は全面ガラス（フードコート・レストラン・売店）、屋根の大看板
        g.s.box(x0, 0, z0, x1, 7.5, z1, LM({ c: [0.92, 0.9, 0.86], mat: 3, side: { lay: L.SHOP, tw: 6, th: 7.5 } }));
        g.s.box(x0 - 3, 7.5, z0 - 2, x1 + 1, 8.1, z1 + 2, LM({ c: [0.35, 0.38, 0.42] })); // 庇・屋根
        g.s.box(x0 - 0.05, 0.3, z0 + 4, x0, 6.5, z1 - 4, LM({ c: [0.55, 0.7, 0.85], mat: 3 }));
        for (const [zz, txt] of [[z0 + 25, 'フードコート'], [z0 + 65, 'レストラン'], [z0 + 100, 'ショッピング']]) { const l = this.lbl(txt); g.s.panel(x0 - 0.1, zz - 8, x0 - 0.1, zz + 8, 6.6, 7.4, 0.02, [-1, 0, 0], { c: [1, 1, 1], mat: 16, lay: l }); }
        g.s.panel(x0 - 1, (z0 + z1) / 2 - 14, x0 - 1, (z0 + z1) / 2 + 14, 8.3, 11.8, 0.05, [-1, 0, 0], LM({ c: [1, 1, 1], mat: 16, lay: sign }));
        // トイレ棟・自販機コーナー・休憩所（ベンチ・パラソル）
        g.s.box(x0 + 4, 0, z1 + 8, x1 - 6, 4.2, z1 + 22, { c: [0.85, 0.82, 0.76], side: { lay: L.SHOP, tw: 5, th: 4.2 } }); g.s.panel(x0 + 3.9, z1 + 10, x0 + 3.9, z1 + 20, 3.2, 4.0, 0.02, [-1, 0, 0], { c: [1, 1, 1], mat: 16, lay: this.lbl('トイレ') }); bld(x0 + 4, z1 + 8, x1 - 6, z1 + 22);
        for (let k = 0; k < 6; k++) g.s.box(x0 - 4, 0, z0 - 4 - k * 1.1, x0 - 3.2, 1.85, z0 - 3.1 - k * 1.1, { c: [[0.85, 0.2, 0.2], [0.2, 0.4, 0.8], [0.95, 0.95, 0.95]][k % 3], mat: 18 });
        for (let k = 0; k < 5; k++) { const z = z0 + 10 + k * 22; g.det.box(64, 0.4, z, 65.6, 0.5, z + 2.4, { c: [0.55, 0.38, 0.25] }); }
      } else if (michi) { // 道の駅：木造の物産館（切妻屋根）・レストラン・観光案内所・のぼり
        const wood = { c: [0.72, 0.52, 0.33], side: { lay: L.SHOP, tw: 5, th: 5 } };
        g.s.box(x0, 0, z0, x1, 5, z0 + 55, LM(wood)); g.s.gable(x0, z0, x1, z0 + 55, 5, 4, LM({ c: [0.3, 0.32, 0.36], lay: L.KAWARA, tw: 2, gc: [0.72, 0.52, 0.33] }));
        g.s.box(x0, 0, z0 + 60, x1, 4.5, z1, LM(wood)); g.s.gable(x0, z0 + 60, x1, z1, 4.5, 3.5, LM({ c: [0.45, 0.25, 0.18], lay: L.KAWARA, tw: 2, gc: [0.72, 0.52, 0.33] }));
        if (snowy) { g.s.box(x0 - 0.6, 6.2, z0 - 0.4, x1 + 0.6, 7.2, z0 + 55.4, LM({ c: [0.97, 0.98, 1] })); g.s.box(x0 - 0.6, 5.6, z0 + 59.6, x1 + 0.6, 6.4, z1 + 0.4, LM({ c: [0.97, 0.98, 1] })); }
        g.s.panel(x0 - 0.1, z0 + 10, x0 - 0.1, z0 + 45, 5.2, 8.6, 0.05, [-1, 0, 0], LM({ c: [1, 1, 1], mat: 16, lay: sign }));
        for (const [zz, txt] of [[z0 + 27, '地元物産館'], [z0 + 78, 'レストラン'], [z1 + 8, '観光案内所']]) g.s.panel(x0 - 0.12, zz - 7, x0 - 0.12, zz + 7, 3.6, 4.4, 0.02, [-1, 0, 0], { c: [1, 1, 1], mat: 16, lay: this.lbl(txt, '#5a3a1a') });
        g.s.box(x0 + 2, 0, z1 + 4, x0 + 14, 3.6, z1 + 14, { c: [0.9, 0.88, 0.82], side: { lay: L.SHOP, tw: 4, th: 3.6 } }); bld(x0 + 2, z1 + 4, x0 + 14, z1 + 14);
        const spec = this.lbl({ spring: '名物 桜もち・山菜', summer: '名物 とうもろこし', autumn: '名物 新そば・きのこ', winter: '名物 おでん・甘酒' }[season], '#8a1a1a');
        for (let k = 0; k < 8; k++) { const z = z0 + 4 + k * 6; g.det.cyl(x0 - 3, 0, z, 0.04, 3.2, 4, { c: [0.6, 0.6, 0.6] }); g.det.panel(x0 - 3, z + 0.05, x0 - 3, z + 0.95, 1, 3.1, 0, [-1, 0, 0], { c: [1, 1, 1], lay: L.NOBORI }); }
        g.det.panel(x0 - 6, z0 + 50, x0 - 6, z0 + 58, 1, 2.4, 0.03, [-1, 0, 0], { c: [1, 1, 1], mat: 16, lay: spec });
        for (let k = 0; k < 4; k++) g.det.box(x0 - 7, 0.4, z0 + 62 + k * 8, x0 - 5.4, 0.5, z0 + 64.4 + k * 8, { c: [0.55, 0.38, 0.25] });
      } else { // PA：トイレと小さな売店・自販機・展望デッキ
        g.s.box(x0, 0, z0, x1, 4.2, z1, LM({ c: [0.88, 0.85, 0.8], side: { lay: L.SHOP, tw: 5, th: 4.2 } })); g.s.box(x0 - 2, 4.2, z0 - 1, x1 + 1, 4.6, z1 + 1, LM({ c: [0.4, 0.42, 0.45] }));
        g.s.panel(x0 - 2.1, z0 + 15, x0 - 2.1, z0 + 45, 4.7, 7.7, 0.05, [-1, 0, 0], LM({ c: [1, 1, 1], mat: 16, lay: sign }));
        for (const [zz, txt] of [[z0 + 12, 'トイレ'], [z0 + 45, '売店']]) g.s.panel(x0 - 0.1, zz - 6, x0 - 0.1, zz + 6, 3.2, 4.0, 0.02, [-1, 0, 0], { c: [1, 1, 1], mat: 16, lay: this.lbl(txt) });
        for (let k = 0; k < 4; k++) g.s.box(x0 - 3, 0, z0 - 3 - k * 1.1, x0 - 2.2, 1.85, z0 - 2.1 - k * 1.1, { c: [[0.85, 0.2, 0.2], [0.2, 0.4, 0.8], [0.95, 0.95, 0.95]][k % 3], mat: 18 });
        // 展望デッキ（敷地の奥）
        g.s.box(96, 0, 160, 108, 1.2, 200, { c: [0.6, 0.45, 0.3] }); for (let z = 160; z <= 200; z += 4) g.det.box(107.6, 1.2, z, 107.8, 2.2, z + 0.1, { c: [0.45, 0.33, 0.22] }); g.det.beam([107.7, 2.2, 160], [107.7, 2.2, 200], 0.05, { c: [0.45, 0.33, 0.22] });
        g.det.panel(95.9, 172, 95.9, 188, 1.3, 2.9, 0.02, [-1, 0, 0], { c: [1, 1, 1], mat: 16, lay: this.lbl('展望スペース') }); bld(96, 160, 108, 200);
        for (let k = 0; k < 3; k++) g.det.box(92, 0.4, 165 + k * 10, 93.6, 0.5, 167.4 + k * 10, { c: [0.55, 0.38, 0.25] });
      }
      if (snowy) { if (!michi) g.s.box(x0 - 0.5, big ? 8.1 : 4.6, z0 - 0.5, x1 + 0.5, big ? 8.7 : 5.1, z1 + 0.5, LM({ c: [0.97, 0.98, 1] })); for (let k = 0; k < 6; k++) g.s.box(20 + k * 14, 0, -3, 24 + k * 14, 1.2, 0, { c: [0.95, 0.96, 1] }); }
      // 修正104：本線から遠くでも読める高いポール看板（施設名）。遠景モデルにも同じものを置く
      this.pylon(g.s, sign, big);
      // 入口の案内（本線から見える位置）
      g.s.box(10.2, 0, -150, 10.4, 6, -149.6, { c: [0.6, 0.6, 0.6] }); g.s.panel(9.4, -149.5, 13, -149.5, 3.6, 6, 0.02, [0, 0, -1], { c: [1, 1, 1], mat: 16, lay: this.lbl('入口 ↗', '#0b6b3a') }, [[1, 1], [0, 1], [0, 0], [1, 0]]);
      for (const k of ['d1', 's', 'det', 'd2', 'glow']) g[k].clearXf();
      // 駐車車両（普通車・大型車）
      const mk = (x, z, yaw, m) => { const p = toW(x, z), c = pickColor(m, R); W.bakeCar(g.det, m, c, p[0], p[1], h + yaw, y); };
      const cars = MODELS.filter(m => !m.semi && m.L < 5 && !isCommercial(m)), trucks = MODELS.filter(m => !m.semi && isCommercial(m) && m.L > 5);
      for (let row = 0; row < 3; row++) for (let z = 12; z < 212; z += 2.6) if (R() < (big ? 0.55 : 0.35)) { const m = cars[(R() * cars.length) | 0]; mk(32.5 + row * 12, z + 1.3, R() < 0.5 ? Math.PI / 2 : -Math.PI / 2, m); }
      if (big || michi) for (let z = 24; z < 196; z += 16) if (R() < 0.6 && trucks.length) mk(20.5, z + 6, 0, trucks[(R() * trucks.length) | 0]);
    });
    f.B = B;
    this.facFar(f, B, sign);
  }
  // 修正104：施設名のポール看板（高さ約20m、本線の手前から読める向き。ローカル座標：lx=道路中心からの横、lz=施設の起点からの前後）
  pylon(gb, sign, big) { const H = big ? 21 : 17, z = -40, w = big ? 15 : 12;
    gb.box(15.2, 0, z - 0.4, 16.0, H - 4.6, z + 0.4, LM({ c: [0.62, 0.64, 0.66] })); gb.box(15.0 + 0.6 - w / 2 - 0.4, H - 4.8, z - 0.35, 15.6 + w / 2 + 0.4, H + 0.2, z + 0.35, LM({ c: [0.2, 0.22, 0.24] }));
    gb.panel(15.6 - w / 2, z - 0.4, 15.6 + w / 2, z - 0.4, H - 4.6, H, 0, [0, 0, -1], LM({ c: [1, 1, 1], mat: 16, lay: sign }), [[1, 1], [0, 1], [0, 0], [1, 0]]); // 本線を来る車から見て左→右に読める向き
    gb.panel(15.6 - w / 2, z + 0.4, 15.6 + w / 2, z + 0.4, H - 4.6, H, 0, [0, 0, 1], LM({ c: [1, 1, 1], mat: 16, lay: sign })); }
  // 遠景用の簡易モデルを、そのチャンクの ch.far 用の GB（this.farL）に入れる（チャンクが未読み込み・描画範囲外のとき 2.6km まで描かれる）
  farGB(s) { const p = this.at(s), ch = this.chunkAt(p.x, p.z); this.farL = this.farL || new Map(); let gb = this.farL.get(ch); if (!gb) this.farL.set(ch, gb = new GB()); return gb; }
  facFar(f, B, sign) {
    const at = this.at(f.s), gb = this.farGB(f.s + 100), y = f.y, se = this.season, big = f.type === 'SA', michi = f.type === 'MICHI', [x0, z0, x1, z1] = B, snow = { c: [0.97, 0.98, 1] };
    gb.setXf(at.x, y, at.z, at.h);
    if (big) { gb.box(x0, 0, z0, x1, 7.5, z1, LM({ c: [0.92, 0.9, 0.86], side: { lay: L.SHOP, tw: 6, th: 7.5 } })); gb.box(x0 - 3, 7.5, z0 - 2, x1 + 1, 8.1, z1 + 2, LM({ c: [0.35, 0.38, 0.42] })); gb.box(x0 - 0.05, 0.3, z0 + 4, x0, 6.5, z1 - 4, LM({ c: [0.55, 0.7, 0.85] }));
      gb.panel(x0 - 1, (z0 + z1) / 2 - 14, x0 - 1, (z0 + z1) / 2 + 14, 8.3, 11.8, 0.05, [-1, 0, 0], LM({ c: [1, 1, 1], mat: 16, lay: sign })); gb.box(x0 + 4, 0, z1 + 8, x1 - 6, 4.2, z1 + 22, LM({ c: [0.85, 0.82, 0.76] })); }
    else if (michi) { const wood = { c: [0.72, 0.52, 0.33], side: { lay: L.SHOP, tw: 5, th: 5 } };
      gb.box(x0, 0, z0, x1, 5, z0 + 55, LM(wood)); gb.gable(x0, z0, x1, z0 + 55, 5, 4, LM({ c: [0.3, 0.32, 0.36], lay: L.KAWARA, tw: 2, gc: [0.72, 0.52, 0.33] })); gb.box(x0, 0, z0 + 60, x1, 4.5, z1, LM(wood)); gb.gable(x0, z0 + 60, x1, z1, 4.5, 3.5, LM({ c: [0.45, 0.25, 0.18], lay: L.KAWARA, tw: 2, gc: [0.72, 0.52, 0.33] }));
      gb.panel(x0 - 0.1, z0 + 10, x0 - 0.1, z0 + 45, 5.2, 8.6, 0.05, [-1, 0, 0], LM({ c: [1, 1, 1], mat: 16, lay: sign }));
      if (this.season === 'winter') { gb.box(x0 - 0.6, 6.2, z0 - 0.4, x1 + 0.6, 7.2, z0 + 55.4, LM(snow)); gb.box(x0 - 0.6, 5.6, z0 + 59.6, x1 + 0.6, 6.4, z1 + 0.4, LM(snow)); } }
    else { gb.box(x0, 0, z0, x1, 4.2, z1, LM({ c: [0.88, 0.85, 0.8], side: { lay: L.SHOP, tw: 5, th: 4.2 } })); gb.box(x0 - 2, 4.2, z0 - 1, x1 + 1, 4.6, z1 + 1, LM({ c: [0.4, 0.42, 0.45] })); gb.panel(x0 - 2.1, z0 + 15, x0 - 2.1, z0 + 45, 4.7, 7.7, 0.05, [-1, 0, 0], LM({ c: [1, 1, 1], mat: 16, lay: sign })); gb.box(96, 0, 160, 108, 1.2, 200, LM({ c: [0.6, 0.45, 0.3] })); }
    if (this.season === 'winter' && !michi) gb.box(x0 - 0.5, big ? 8.1 : 4.6, z0 - 0.5, x1 + 0.5, big ? 8.7 : 5.1, z1 + 0.5, LM(snow));
    this.pylon(gb, sign, big);
    // 照明塔と外周の木（シルエット）
    const tc = se === 'spring' ? [1, 0.8, 0.88] : se === 'autumn' ? [0.9, 0.4, 0.15] : se === 'winter' ? [0.9, 0.93, 0.97] : [0.3, 0.52, 0.28];
    for (let z = 5; z < 225; z += 22) gb.cbox(110.5, 3.6, z, 3.2, 3.4, 3.2, LM({ c: tc }));
    for (let x = 30; x < 100; x += 26) for (let z = 20; z < 210; z += 90) gb.box(x - 0.15, 0, z - 0.15, x + 0.15, 9, z + 0.15, LM({ c: [0.55, 0.55, 0.58] }));
    gb.clearXf();
  }
  lbl(txt, bg = '#1c3d6e') { const c = this.lblCache || (this.lblCache = {}); const key = txt + bg; return c[key] || (c[key] = this.newDyn(ctx => { ctx.fillStyle = bg; ctx.fillRect(0, 0, 256, 256); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.save(); ctx.scale(1, 4); let sz = 40; ctx.font = `800 ${sz}px ${FONT}`; const w = ctx.measureText(txt).width; if (w > 236) { sz *= 236 / w; ctx.font = `800 ${sz}px ${FONT}`; } ctx.fillText(txt, 128, 32); ctx.restore(); })); }
  // 出発地：水瀬東IC（料金所風の門と案内標識）
  startArea() {
    const s = -40, sg = this.greenSign(['水瀬東IC', '長距離ドライブ', '専用バイパス入口'], { scale: 0.85 }), sg2 = this.greenSign([this.D.dest, '400km'], { scale: 0.9 });
    this.add(s, g => { const L0 = this.pos(s, 10.5), R0 = this.pos(s, -10.5), at = this.at(s);
      for (const p of [L0, R0]) g.s.box(p[0] - 0.4, p[1], p[2] - 0.4, p[0] + 0.4, p[1] + 7, p[2] + 0.4, { c: [0.7, 0.72, 0.74] });
      g.s.beam([L0[0], L0[1] + 7, L0[2]], [R0[0], R0[1] + 7, R0[2]], 0.35, { c: [0.7, 0.72, 0.74] });
      const a = this.pos(s, 9, 0), b = this.pos(s, 1, 0); g.s.panel(a[0], a[2], b[0], b[2], a[1] + 7.3, a[1] + 11, 0.05, [-Math.sin(at.h), 0, -Math.cos(at.h)], { c: [1, 1, 1], mat: 16, lay: sg });
      const c = this.pos(s + 200, 9.6, 0), d = this.pos(s + 200, 13.6, 0), at2 = this.at(s + 200); g.s.box(d[0] - 0.1, d[1], d[2] - 0.1, d[0] + 0.1, d[1] + 5, d[2] + 0.1, { c: [0.6, 0.6, 0.6] }); g.s.panel(c[0], c[2], d[0], d[2], c[1] + 3, c[1] + 5.2, 0.05, [-Math.sin(at2.h), 0, -Math.cos(at2.h)], { c: [1, 1, 1], mat: 16, lay: sg2 });
      // 料金所風の建屋（反対側）と旗
      const t = this.pos(s - 30, -14); g.s.box(t[0] - 4, t[1], t[2] - 6, t[0] + 4, t[1] + 4, t[2] + 6, { c: [0.85, 0.85, 0.82], side: { lay: L.SHOP, tw: 4, th: 4 } });
    });
  }
  // 目的地：駐車場（クリア判定）と季節ごとの観光地
  destination() {
    const s = ROUTE_LEN, at = this.at(s), y = this.endY, h = at.h, season = this.season, R = rng(99), W = this.W;
    const toW = (lx, lz) => [at.x + Math.cos(h) * lx + Math.sin(h) * lz, at.z - Math.sin(h) * lx + Math.cos(h) * lz];
    const wall = (a, b) => { const p = toW(...a), q = toW(...b); W.addWall(p[0], p[1], q[0], q[1], y - 2, y + 2); };
    wall([-10, 0], [-45, 10]); wall([-45, 10], [-45, 95]); wall([-45, 95], [45, 95]); wall([45, 95], [45, 10]); wall([45, 10], [10, 0]);
    this.dest = { s, x: at.x, z: at.z, h, toW };
    if (season === 'winter') for (let k = 0; k < 6; k++) { const q = toW(-45 + k * 18, 132); (this.steam || (this.steam = [])).push([q[0], y + 5, q[1]]); }
    const sign = this.greenSign([this.D.destLot], { bg: '#7a3b1a', scale: 0.8 });
    this.add(s + 40, g => {
      for (const k of ['s', 'det', 'd1', 'd2', 'glow']) g[k].setXf(at.x, y, at.z, h);
      g.d1.flat(-45, 0, 45, 95, 0.01, { c: season === 'winter' ? [0.7, 0.72, 0.76] : [0.95, 0.95, 0.95], mat: 7, lay: L.ASPHALT });
      for (let x = -40; x < 40; x += 2.6) { g.d2.flat(x, 30, x + 0.12, 35, 0.02, { c: [1, 1, 1] }); g.d2.flat(x, 60, x + 0.12, 65, 0.02, { c: [1, 1, 1] }); }
      g.s.box(-3, 0, -2, -2.6, 5, -1.6, { c: [0.5, 0.35, 0.25] }); g.s.panel(-8, -1.5, 2, -1.5, 3, 5, 0.02, [0, 0, -1], { c: [1, 1, 1], mat: 16, lay: sign }, [[1, 1], [0, 1], [0, 0], [1, 0]]);
      for (let k = 0; k < 10; k++) this.tree(g.s, season === 'spring' ? 'sakura' : season === 'autumn' ? 'maple' : season === 'winter' ? 'snowpine' : 'birch', -48 + (k % 2) * 96, 0, 12 + k * 8, 1.1, R);
      const n0 = g.s.a.length; this.destLM(g, rng(98)); markLM(g.s, n0); // 修正104：観光地の建物は遠くからも見える目印（mat+100）
      for (const k of ['s', 'det', 'd1', 'd2', 'glow']) g[k].clearXf();
    });
  }
  // 目的地の観光地の建物（詳細モデルと遠景モデルで共通。遠景では g.det・g.glow も同じ GB に入れる）
  destLM(g, R) { const season = this.season;
      if (season === 'spring') { // 城郭公園と天守（石垣の上の三層の天守）
      g.s.box(-30, 0, 110, 30, 9, 170, { c: [0.62, 0.6, 0.55], lay: L.ROCK, side: { lay: L.ROCK, tw: 4, th: 3 } });
      let w2 = 22; for (let l = 0; l < 3; l++) { const y0 = 9 + l * 6.5; g.s.box(-w2 / 2, y0, 140 - w2 / 2 + 4, w2 / 2, y0 + 4.5, 140 + w2 / 2 - 4, { c: [0.97, 0.97, 0.95], side: { lay: L.OFFICE2, tw: 4, th: 4.5 } }); g.s.gable(-w2 / 2 - 2, 140 - w2 / 2 + 2, w2 / 2 + 2, 140 + w2 / 2 - 2, y0 + 4.5, 2.4, { c: [0.25, 0.3, 0.35], lay: L.KAWARA, tw: 2, gc: [0.97, 0.97, 0.95] }); w2 *= 0.75; }
      for (let k = 0; k < 24; k++) this.tree(g.s, 'sakura', -60 + R() * 120, 0, 100 + R() * 90, 1.3, R);
    } else if (season === 'summer') { // 高原のコテージ群
      for (let k = 0; k < 6; k++) { const x = -40 + k * 16, z = 120 + (k % 2) * 25; g.s.box(x - 5, 0, z - 4, x + 5, 3.4, z + 4, { c: [0.7, 0.5, 0.32], side: { lay: L.HOUSE, tw: 3, th: 3 } }); g.s.gable(x - 5, z - 4, x + 5, z + 4, 3.4, 2.6, { c: [0.25, 0.4, 0.35], lay: L.METAL, tw: 2, gc: [0.7, 0.5, 0.32] }); g.s.box(x - 5, 0, z - 7, x + 5, 0.4, z - 4, { c: [0.6, 0.45, 0.3] }); }
    } else if (season === 'autumn') { // 木造の旅館と庭園
      g.s.box(-35, 0, 110, 35, 7, 150, { c: [0.75, 0.6, 0.42], side: { lay: L.HOUSE_DARK, tw: 3, th: 3.5 } }); g.s.gable(-37, 108, 37, 152, 7, 4, { c: [0.25, 0.27, 0.3], lay: L.KAWARA, tw: 2, gc: [0.75, 0.6, 0.42] });
      g.s.panel(-8, 107.9, 8, 107.9, 5, 6.8, 0.05, [0, 0, -1], { c: [1, 1, 1], mat: 16, lay: this.lbl('楓見山荘', '#4a2a14') }, [[1, 1], [0, 1], [0, 0], [1, 0]]);
      for (let k = 0; k < 16; k++) this.tree(g.s, 'maple', -50 + R() * 100, 0, 95 + R() * 70, 1.2, R);
    } else { // 雪灯温泉郷：雪をかぶった旅館と湯けむり・街灯
      for (let k = 0; k < 6; k++) { const x = -45 + k * 18; g.s.box(x - 7, 0, 110, x + 7, 6, 125, { c: [0.6, 0.45, 0.32], side: { lay: L.HOUSE_DARK, tw: 3, th: 3 } }); g.s.box(x - 7.5, 6, 109.5, x + 7.5, 7.2, 125.5, { c: [0.97, 0.98, 1] }); g.s.box(x - 1, 2, 109.8, x + 1, 3.4, 110, { c: [1, 0.75, 0.4], mat: 8 }); }
      for (let k = 0; k < 8; k++) { const x = -42 + k * 12; g.det.cyl(x, 0, 100, 0.08, 3.5, 6, { c: [0.3, 0.25, 0.2] }); g.det.box(x - 0.3, 3.3, 99.7, x + 0.3, 3.9, 100.3, { c: [1, 0.7, 0.35], mat: 8 }); g.glow.flat(x - 6, 94, x + 6, 106, 0.05, { c: [1, 0.75, 0.4], mat: 5, lay: L.GLOW }); }
    }
  }
  destFar() { const d = this.dest, gb = this.farGB(d.s + 40), dummy = new GB(); gb.setXf(d.x, this.endY, d.z, d.h); const n0 = gb.a.length; this.destLM({ s: gb, det: gb, glow: dummy }, rng(98)); markLM(gb, n0); gb.clearXf(); }
  // 本線の案内標識（目的地までの距離・休憩施設の予告）
  signs() {
    const D = this.D;
    for (let km = 50; km < 400; km += 50) { const s = km * 1000 / DIST_SCALE + 30; if (this.fac.some(f => Math.abs(s - f.s) < 520)) continue; const lay = this.greenSign([D.dest, `${400 - km}km`]); this.gantry(s, lay); }
    // 休憩施設の予告（表示15km手前＝実距離470m）
    for (const f of this.fac) { const lay = this.greenSign([f.name, '15km'], { bg: f.type === 'MICHI' ? '#2c6e2c' : '#0b6b3a' }); this.gantry(f.s - 15000 / DIST_SCALE, lay); }
    // 修正104：施設の予告を増やす（表示10km＝門型、表示5km＝左側の大きなポール標識。施設名と残り距離）
    for (const f of this.fac) { const bg = f.type === 'MICHI' ? '#2c6e2c' : '#0b6b3a'; this.gantry(f.s - 10000 / DIST_SCALE, this.greenSign([f.name, '10km'], { bg }));
      const l5 = this.greenSign([f.name, '5km ↗'], { bg }), s5 = f.s - 5000 / DIST_SCALE;
      this.add(s5, g => { const p = this.pos(s5, 15), at = this.at(s5), a = this.pos(s5, 19.5), b = this.pos(s5, 10.5), n = [-Math.sin(at.h), 0, -Math.cos(at.h)];
        g.s.box(p[0] - 0.25, p[1] - 1, p[2] - 0.25, p[0] + 0.25, p[1] + 6, p[2] + 0.25, { c: [0.68, 0.7, 0.72] }); g.s.panel(a[0], a[2], b[0], b[2], p[1] + 5.6, p[1] + 9.6, 0.3, n, { c: [1, 1, 1], mat: 16, lay: l5 }); }); }
  }
  gantry(s, lay) {
    this.add(s, g => { const L0 = this.pos(s, 10.8), R0 = this.pos(s, 1.0), at = this.at(s), n = [-Math.sin(at.h), 0, -Math.cos(at.h)];
      for (const p of [L0, R0]) g.s.box(p[0] - 0.25, p[1], p[2] - 0.25, p[0] + 0.25, p[1] + 7.5, p[2] + 0.25, { c: [0.68, 0.7, 0.72] });
      g.s.beam([L0[0], L0[1] + 7.3, L0[2]], [R0[0], R0[1] + 7.3, R0[2]], 0.2, { c: [0.68, 0.7, 0.72] });
      const a = this.pos(s, 9.5), b = this.pos(s, 3.5); g.s.panel(a[0], a[2], b[0], b[2], a[1] + 6, a[1] + 9.5, 0.3, n, { c: [1, 1, 1], mat: 16, lay }); });
  }
  // 遠景：周囲の山並み（季節の色）と、読み込み前のチャンク用の粗い地形
  farView() {
    const b = this.bb, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, rad = Math.max(b.x1 - b.x0, b.z1 - b.z0) / 2 + 1500, R = rng(7), M = this.W.mountains, season = this.season;
    for (let k = 0; k < 90; k++) { const a = k / 90 * Math.PI * 2, d = rad + R() * 800, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, r = 500 + R() * 600, hgt = 250 + R() * 450;
      const c = season === 'winter' ? [0.85, 0.88, 0.95] : season === 'autumn' ? [0.6 + R() * 0.15, 0.38, 0.25] : season === 'summer' ? [0.32, 0.5, 0.4] : [0.45, 0.58, 0.5];
      for (let s2 = 0; s2 < 6; s2++) { const a0 = s2 / 6 * Math.PI * 2, a1 = (s2 + 1) / 6 * Math.PI * 2; M.tri([x + Math.cos(a0) * r, -5, z + Math.sin(a0) * r], [x + Math.cos(a1) * r, -5, z + Math.sin(a1) * r], [x, hgt, z], { c, mat: 9 }, [0, 0], [0, 0], [0, 0], [x, hgt / 3, z]); }
      if (season === 'winter' || R() < 0.3) for (let s2 = 0; s2 < 6; s2++) { const a0 = s2 / 6 * Math.PI * 2, a1 = (s2 + 1) / 6 * Math.PI * 2, rr = r * 0.3; M.tri([x + Math.cos(a0) * rr, hgt * 0.7, z + Math.sin(a0) * rr], [x + Math.cos(a1) * rr, hgt * 0.7, z + Math.sin(a1) * rr], [x, hgt + 1, z], { c: [0.97, 0.98, 1], mat: 9 }, [0, 0], [0, 0], [0, 0], [x, hgt / 2, z]); }
    }
    // 夏の海（右側の海・湾）：大きな面は250m角に分けて描く（深度の補間誤差対策）
    if (season === 'summer') { const G = this.W.global; for (let s = 1200; s < 7000; s += 125) for (let u = -1400; u < 1400; u += 125) { const z = this.zoneW(s, u >= 0 ? 1 : -1); if (!((z.sea || 0) + (z.bay || 0) + (z.harbor || 0) > 0.2)) continue; if (u >= 0 && !(z.bay > 0.2)) continue; if (Math.abs(u) < 12 && !(z.bay > 0.2)) continue;
      const p = [this.pos(s, u), this.pos(s, u + 125), this.pos(s + 125, u + 125), this.pos(s + 125, u)]; G.quadN([p[0][0], 0, p[0][2]], [p[1][0], 0, p[1][2]], [p[2][0], 0, p[2][2]], [p[3][0], 0, p[3][2]], [0, 1, 0], { c: [0.55, 0.78, 0.95], lay: L.WATER, mat: 21 }); } }
    // 読み込み前のチャンク用の粗い地形（50m刻み）
    this.farT = new Map();
    for (let s = S_START; s < S_END; s += 50) { const ch = this.chunkAt(this.at(s + 25).x, this.at(s + 25).z); let gb = this.farT.get(ch); if (!gb) this.farT.set(ch, gb = new GB());
      for (const side of [1, -1]) { const us = [0, 40, 120, 260, 450]; for (let j = 0; j < us.length - 1; j++) { const P = (u, ss) => { const p = this.pos(ss, side * u); return [p[0], u < 11 ? this.roadY(ss) - 0.3 : this.terrainH(ss, side * u) - 0.3, p[2]]; };
          const k = this.groundKind(s + 25, side * (us[j] + us[j + 1]) / 2), o = { c: us[j] === 0 ? [0.45, 0.45, 0.45] : this.groundCol(k), lay: us[j] === 0 ? L.ASPHALT : k === 'snow' ? L.WHITE : L.GRASS };
          const A = P(us[j], s), B = P(us[j + 1], s), C = P(us[j + 1], s + 50), Dd = P(us[j], s + 50);
          gb.tri(A, B, C, o, [0, 0], [0, 0], [0, 0], [A[0], A[1] - 100, A[2]]); gb.tri(A, C, Dd, o, [0, 0], [0, 0], [0, 0], [A[0], A[1] - 100, A[2]]); } } }
  }
  // NPC用：レーンの位置
  lanePoint(s, u) { const p = this.pos(s, u), at = this.at(s); return { x: p[0], y: p[1], z: p[2], h: at.h }; }
}
