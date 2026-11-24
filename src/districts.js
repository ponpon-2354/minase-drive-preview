// v0.5 新しい地区：学園地区（大学キャンパス・学生街）とニュータウン（曲線道路・袋小路・小学校・公園）、
// 既存の郊外に旧街道（斜めに抜ける細い道）。道路は格子ではなく曲線のポリラインで、道路網（信号・NPC・ナビ）に接続する
import { L } from './textures.js?v=0.9.0';
import { rng, clamp } from './math.js?v=0.9.0';
import { MODELS, pickModel, pickColor, pickPassenger, pickFit } from './carmodels.js?v=0.9.0';
import { installDyn, txt } from './props.js?v=0.9.0';

// 区間の定義（両端は交差点ノード。途中点はなめらかな曲線にする）。axis は信号の位相に使う向き
export const CURVES = [
  // 学園地区（x 0〜1000, z 1000〜2000）。交差点で曲線同士がほぼ直角に出会うように制御点をとる
  { kind: 'gak', axis: 'ew', name: '学園通り', pts: [[0, 1280], [60, 1280], [120, 1278]] },
  { kind: 'gak', axis: 'ew', name: '学園通り', pts: [[120, 1278], [210, 1266], [300, 1248]] },
  { kind: 'gak', axis: 'ew', name: '学園通り', pts: [[300, 1248], [400, 1238], [500, 1236]] },
  { kind: 'gak', axis: 'ew', name: '学園通り', pts: [[500, 1236], [610, 1242], [720, 1265]] },
  { kind: 'gak', axis: 'ew', name: '学園通り', pts: [[720, 1265], [800, 1292], [880, 1318]] },
  { kind: 'gak', axis: 'ew', name: '学園通り', pts: [[880, 1318], [940, 1322], [1000, 1322]] },
  { kind: 'gak', axis: 'ns', name: '大学前通り', pts: [[500, 1000], [500, 1120], [500, 1236]] },
  { kind: 'gak', axis: 'ns', name: '大学前通り', pts: [[500, 1236], [500, 1290], [500, 1322]], dead: 1 }, // 正門前の車寄せ（転回場）
  { kind: 'gak', axis: 'ns', name: '寮前通り', pts: [[120, 1278], [128, 1400], [140, 1560], [150, 1760]] },
  { kind: 'gak', axis: 'ns', name: '桜ヶ丘通り', pts: [[880, 1318], [872, 1450], [858, 1600], [850, 1742]] },
  { kind: 'gak', axis: 'ns', name: '南町通り', pts: [[300, 1000], [300, 1120], [300, 1248]] },
  { kind: 'gak', axis: 'ns', name: '川端通り', pts: [[720, 1000], [722, 1130], [720, 1265]] },
  { kind: 'gak', axis: 'ew', name: '学園北通り', pts: [[0, 1760], [75, 1760], [150, 1760]] },
  { kind: 'gak', axis: 'ew', name: '学園北通り', pts: [[150, 1760], [250, 1782], [350, 1800]] },
  { kind: 'gak', axis: 'ew', name: '学園北通り', pts: [[350, 1800], [470, 1800], [600, 1790]] },
  { kind: 'gak', axis: 'ew', name: '学園北通り', pts: [[600, 1790], [730, 1764], [850, 1742]] },
  { kind: 'gak', axis: 'ew', name: '学園北通り', pts: [[850, 1742], [930, 1734], [1000, 1732]] },
  { kind: 'gak', axis: 'ns', name: '北山通り', pts: [[350, 1800], [352, 1900], [350, 2000]] },
  { kind: 'gak', axis: 'ns', name: '見晴らし通り', pts: [[600, 1790], [610, 1900], [620, 2000]] },
  // ニュータウン（x 1000〜2000, z 1000〜2000）
  { kind: 'nt', axis: 'ew', name: '若葉通り', pts: [[1000, 1322], [1150, 1330], [1350, 1262]] },
  { kind: 'nt', axis: 'ew', name: '若葉通り', pts: [[1350, 1262], [1450, 1270], [1550, 1300]] },
  { kind: 'nt', axis: 'ew', name: '若葉通り', pts: [[1550, 1300], [1650, 1340], [1750, 1380]] },
  { kind: 'nt', axis: 'ew', name: '若葉通り', pts: [[1750, 1380], [1815, 1394], [1880, 1400]] },
  { kind: 'nt', axis: 'ew', name: '若葉通り', pts: [[1880, 1400], [1940, 1401], [2000, 1400]] },
  { kind: 'nt', axis: 'ew', name: 'けやき通り', pts: [[1000, 1732], [1090, 1728], [1180, 1722]] },
  { kind: 'nt', axis: 'ew', name: 'けやき通り', pts: [[1180, 1722], [1290, 1738], [1400, 1780]] },
  { kind: 'nt', axis: 'ew', name: 'けやき通り', pts: [[1400, 1780], [1520, 1785], [1620, 1760]] },
  { kind: 'nt', axis: 'ew', name: 'けやき通り', pts: [[1620, 1760], [1760, 1716], [1900, 1692]] },
  { kind: 'nt', axis: 'ew', name: 'けやき通り', pts: [[1900, 1692], [1950, 1686], [2000, 1684]] },
  { kind: 'nt', axis: 'ns', name: 'さくら坂', pts: [[1550, 1300], [1545, 1400], [1490, 1530], [1560, 1680], [1620, 1760]] },
  { kind: 'nt', axis: 'ns', name: 'ひかり台通り', pts: [[1300, 1000], [1300, 1080], [1330, 1180], [1350, 1262]] },
  { kind: 'nt', axis: 'ns', name: 'みどり台通り', pts: [[1700, 1000], [1702, 1100], [1730, 1250], [1750, 1380]] },
  { kind: 'nt', axis: 'ns', name: '東が丘通り', pts: [[1880, 1400], [1900, 1550], [1900, 1692]] },
  { kind: 'nt', axis: 'ns', name: 'もみじ台通り', pts: [[1180, 1722], [1185, 1860], [1200, 2000]] },
  // 袋小路（クルドサック）
  { kind: 'ntc', axis: 'ns', name: 'あおば台', pts: [[1400, 1780], [1395, 1860], [1370, 1930]], dead: 1 },
  { kind: 'ntc', axis: 'ns', name: 'ひばり台', pts: [[1620, 1760], [1640, 1840], [1660, 1910]], dead: 1 },
  // 旧街道（郊外を斜めに抜ける細い道。両端は五差路・T字路になる）
  { kind: 'kaido', axis: 'ns', name: '旧水瀬街道', pts: [[-1500, -1000], [-1458, -958], [-1400, -905], [-1300, -820], [-1180, -660], [-1080, -580], [-1042, -542], [-1000, -500]] }
];
export const DISTRICTS = { gakuen: { x0: 0, x1: 1000, z0: 1000, z1: 2000, name: '学園地区' }, newtown: { x0: 1000, x1: 2000, z0: 1000, z1: 2000, name: 'ニュータウン' } };
export function inNewDistrict(x, z) { return x >= -1 && z >= 999; }

// Catmull-Rom で5m間隔の点列に
export function curvePts(cp) {
  const out = [], P = [cp[0], ...cp, cp[cp.length - 1]];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]], n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 5));
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3))); }
  }
  out.push(cp[cp.length - 1].slice());
  return out.map(p => [p[0], p[1], 0]);
}
// 道路の帯（建物を置かない範囲）
export function corridorDist(city, x, z) {
  let bd = 1e9;
  for (const c of city.corridors || []) for (let i = 0; i < c.pts.length - 1; i++) {
    const a = c.pts[i], b = c.pts[i + 1], vx = b[0] - a[0], vz = b[1] - a[1], l2 = vx * vx + vz * vz || 1, t = clamp(((x - a[0]) * vx + (z - a[1]) * vz) / l2, 0, 1);
    const d = Math.hypot(a[0] + vx * t - x, a[1] + vz * t - z) - c.w; if (d < bd) bd = d;
  }
  return bd;
}

// 直線道路（格子の道）の上には置かない
function footClear(city, x, z, yaw, w, d) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw), nu = Math.max(2, Math.ceil(w / 2)), nv = Math.max(2, Math.ceil(d / 2));
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
    const u = (i / nu - 0.5) * w, v = 0.8 + j / nv * (d - 0.8), qx = x + rx * u + fx * v, qz = z + rz * u + fz * v;
    if (straightHit(city, qx, qz)) return false;
    for (const l of city.mm.lanes) { if ((l.kind !== 'lane' && l.kind !== 'farm') || l.poly) continue; const m = (l.w || 2.5) + 0.4; if (l.axis === 'ns' ? (Math.abs(qx - l.c) < m && qz > l.a - m && qz < l.b + m) : (Math.abs(qz - l.c) < m && qx > l.a - m && qx < l.b + m)) return false; }
  }
  return true;
}
function straightHit(city, x, z) { for (const r of city.roads) { const e = r.sp.ext + 1; if (r.axis === 'ns' ? (Math.abs(x - r.c) < e && z > r.a - e && z < r.b + e) : (Math.abs(z - r.c) < e && x > r.a - e && x < r.b + e)) return true; } return false; }
// ---------- 小さな建物ビルダー（回転可能。ローカル座標で組んで setXf で置く） ----------
const WALLS = [[0.95, 0.94, 0.9], [0.88, 0.86, 0.82], [0.93, 0.9, 0.84], [0.8, 0.84, 0.86], [0.9, 0.88, 0.92], [0.98, 0.96, 0.92], [0.72, 0.7, 0.66], [0.86, 0.8, 0.72]];
const ROOFS = [[0.3, 0.32, 0.36], [0.22, 0.24, 0.28], [0.45, 0.3, 0.25], [0.35, 0.4, 0.45], [0.55, 0.52, 0.48]];
function aabb(x, z, yaw, w, d) { const c = Math.cos(yaw), s = Math.sin(yaw), ex = Math.abs(c) * w / 2 + Math.abs(s) * d / 2, ez = Math.abs(s) * w / 2 + Math.abs(c) * d / 2; return { x0: x - ex, x1: x + ex, z0: z - ez, z1: z + ez }; }
// 新しい建売住宅（2階建て・片流れや陸屋根も混ぜる）。原点＝敷地の道路側中央、+z が道路と反対（奥）
function newHouse(g, R, city, opt = {}) {
  const w = 8.5 + R() * 2, d = 7.5 + R() * 2, H = 5.8 + R() * 0.6, wc = WALLS[R() * WALLS.length | 0], rc = ROOFS[R() * ROOFS.length | 0], z0 = 5.5, t = R();
  g.s.box(-w / 2, 0, z0, w / 2, H, z0 + d, { c: wc, mat: 3, side: { lay: L.HOUSE, tw: 7, th: 5.6 }, top: { lay: L.ROOF, tw: 6 } });
  if (t < 0.35) g.s.box(-w / 2 - 0.2, H, z0 - 0.2, w / 2 + 0.2, H + 0.35, z0 + d + 0.2, { c: [0.85, 0.85, 0.83] }); // 陸屋根
  else if (t < 0.6) g.s.quadN([-w / 2 - 0.3, H + 1.6, z0 - 0.4], [w / 2 + 0.3, H + 1.6, z0 - 0.4], [w / 2 + 0.3, H, z0 + d + 0.4], [-w / 2 - 0.3, H, z0 + d + 0.4], [0, 0.97, 0.25], { c: rc, lay: L.METAL }); // 片流れ
  else g.s.gable(-w / 2, z0, w / 2, z0 + d, H, 1.7, { c: rc, lay: L.METAL, tw: 2, gc: wc }, 0.45);
  g.s.box(-w / 2 + 0.6, 2.6, z0 - 0.9, -w / 2 + 3.6, 2.75, z0, { c: [0.85, 0.85, 0.83] }); // 玄関庇
  g.det.cbox(w / 2 + 0.5, 0.35, z0 + d * 0.5, 0.75, 0.6, 0.3, { c: [0.9, 0.9, 0.88] }); // 室外機
  g.d1.flat(-w / 2 - 1, 0, w / 2 + 1, z0, 0.02, { c: [0.85, 0.85, 0.82], lay: L.SIDEWALK }, 3); // 駐車スペース（土間コン）
  g.det.box(-w / 2 - 1.2, 0, z0 + d + 1.5, w / 2 + 1.2, 1.1, z0 + d + 1.7, { c: [0.45, 0.6, 0.38], lay: L.TREE }); // 生垣
  if (R() < 0.5) city.tree(g.det, w / 2 + 1.5, z0 + d + 0.6, R);
  return { w: w + 2.4, d: z0 + d + 2 };
}
function place(city, x, z, yaw, w, d, fn, kind = 'b') { // 回転した建物の当たり判定（AABB）と描画登録
  const c = Math.cos(yaw), s = Math.sin(yaw), cx = x + s * d / 2, cz = z + c * d / 2, bb = aabb(cx, cz, yaw, w, d);
  // v0.6 斜めの建物は外接AABB1個だと角が曲線道路にはみ出して「見えない壁」になるため、外周を約3m角のセルに分けて当たり判定を置く
  const ax = Math.abs(Math.sin(2 * yaw)) < 0.02;
  if (ax) city.addBox(bb.x0 + 0.6, bb.z0 + 0.6, bb.x1 - 0.6, bb.z1 - 0.6, kind);
  else { const fx = s, fz = c, rx = c, rz = -s, W = w - 1.2, D = d - 1.2, nu = Math.max(1, Math.round(W / 3)), nv = Math.max(1, Math.round(D / 3));
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { if (i > 0 && j > 0 && i < nu - 1 && j < nv - 1) continue;
      const u0 = -W / 2 + W * i / nu, u1 = -W / 2 + W * (i + 1) / nu, v0 = 0.6 + D * j / nv, v1 = 0.6 + D * (j + 1) / nv; let X0 = 1e9, X1 = -1e9, Z0 = 1e9, Z1 = -1e9;
      for (const [u, v] of [[u0, v0], [u1, v0], [u0, v1], [u1, v1]]) { const qx = x + rx * u + fx * v, qz = z + rz * u + fz * v; X0 = Math.min(X0, qx); X1 = Math.max(X1, qx); Z0 = Math.min(Z0, qz); Z1 = Math.max(Z1, qz); }
      const sh = (Math.min(X1 - X0, Z1 - Z0) - Math.min(u1 - u0, v1 - v0)) * 0.25; city.addBox(X0 + sh, Z0 + sh, X1 - sh, Z1 - sh, kind); } }
  city.mm.blds.push({ ...bb, h: 7 });
  city.add(cx, cz, g => { for (const k of ['s', 'det', 'd1', 'd2', 'glow']) g[k].setXf(x, 0, z, yaw); fn(g); for (const k of ['s', 'det', 'd1', 'd2', 'glow']) g[k].clearXf(); });
}
// 道路沿いに並べる（曲線道路の両側）。fn(R) は {w,d,build} を返す
function frontage(city, e, side, s0, s1, setback, pick, used) {
  const R = rng(e.id * 131 + (side > 0 ? 7 : 3));
  for (let s = s0; s < s1;) {
    const it = pick(R, s); if (!it) { s += 8; continue; }
    const sm = s + it.w / 2; if (sm > s1) break;
    const o = side * (e.sp.ext + 1.6 + setback), p = city.edgePt(e, sm, o), hd = city.headAt(e, sm), yaw = hd + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
    // 道路と反対向きに奥行きをとる。ほかの道路の帯・既存の建物と重なる場合は飛ばす
    const back = [p[0] + Math.sin(yaw) * it.d, p[2] + Math.cos(yaw) * it.d], mid = [(p[0] + back[0]) / 2, (p[2] + back[1]) / 2];
    const clear = [p, [back[0], 0, back[1]], [mid[0], 0, mid[1]]].every(q => corridorDist(city, q[0], q[2]) > 0.3 && city.allowed(q[0], q[2]) && Math.abs(q[0]) < 1990 && q[2] < 1990 && !straightHit(city, q[0], q[2]) && !used.some(u => q[0] > u.x0 && q[0] < u.x1 && q[2] > u.z0 && q[2] < u.z1)) && !(it.avoid && it.avoid(p));
    // v0.6 敷地全体（2m間隔のサンプル）が生活道路・直線道路にかからないこと（前・中・奥の3点だけだと斜めの敷地の角が車線をふさいでいた）
    const ok2 = clear && footClear(city, p[0], p[2], yaw, it.w, it.d);
    if (ok2) { const fr = aabb((p[0] + back[0]) / 2, (p[2] + back[1]) / 2, yaw, it.w, it.d); used.push(fr); it.build(p[0], p[2], yaw); }
    s += it.w + 1.5;
  }
}

export function districtsPost(city) {
  installDyn(city);
  hospitalPost(city);
  const st = city.stats, pois = city.pois = city.pois || [], used = city.usedRects = city.usedRects || [];
  city.pedAreas = city.pedAreas || [];
  const asph = { c: [1, 1, 1], mat: 7, lay: L.ASPHALT }, walk = { c: [0.8, 0.79, 0.76], lay: L.SIDEWALK };
  const edges = city.edges.filter(e => e.seg && e.seg.curve && e.seg.fwd === e);
  // ---- 曲線道路の路面・歩道・街路樹・街灯 ----
  for (const e of edges) {
    const sp = e.sp, mid = city.edgePt(e, e.len / 2, 0), A = city.nodes[e.from], B = city.nodes[e.to];
    const deg = n => n.ns.length + n.ew.length, tA = deg(A) >= 3 ? Math.max(A.hx, A.hz) : 0, tB = e.len - (deg(B) >= 3 ? Math.max(B.hx, B.hz) : 0), // 交差点の中には歩道を入れない
      lamp = sp.kind === 'gak' || sp.kind === 'nt';
    const treeSp = { gak: 12, nt: 14, ntc: 18, kaido: 0 }[sp.kind] || 0;
    for (let q0 = 0; q0 < e.len; q0 += 100) {
      const q1 = Math.min(e.len, q0 + 100), m = city.edgePt(e, (q0 + q1) / 2, 0);
      city.add(m[0], m[2], g => {
        city.band(g.d1, e, q0 - (q0 === 0 ? 6 : 0), q1 + (q1 === e.len ? 6 : 0), -sp.hw, sp.hw, asph);
        if (sp.sw > 0) for (const sg of [1, -1]) { const o0 = sg * sp.hw, o1 = sg * sp.ext;
          // 生活道路との接続部分は歩道を切り下げる（段差なしで出入りできる）
          let a = Math.max(q0, tA + 1); const b = Math.min(q1, tB - 1);
          for (const cs of cutS(city, e, sg)) { if (cs + 4 < a || cs - 4 > b) continue; if (cs - 4 > a) city.band(g.s, e, a, cs - 4, Math.min(o0, o1), Math.max(o0, o1), walk, 0.12); city.band(g.d1, e, Math.max(a, cs - 4), Math.min(b, cs + 4), Math.min(o0, o1), Math.max(o0, o1), { c: [0.75, 0.75, 0.73], lay: L.SIDEWALK }, 0.0005); a = cs + 4; }
          if (b > a) city.band(g.s, e, a, b, Math.min(o0, o1), Math.max(o0, o1), walk, 0.12); }
        else city.band(g.d1, e, q0, q1, sp.hw, sp.hw + 1.2, { c: [0.6, 0.62, 0.42], lay: L.GRASS }, -0.01);
      });
    }
    // 街路樹（路線ごとに樹種を変える：学園通り＝いちょう、若葉通り＝けやき、けやき通り＝さくら）
    const species = sp.kind === 'gak' ? 1 : /けやき/.test(e.seg.name) ? 2 : 0;
    if (treeSp && sp.sw > 1.5) for (let s = 10; s < e.len - 10; s += treeSp) for (const sg of [1, -1]) {
      const p = city.edgePt(e, s, sg * (sp.hw + sp.sw * 0.55)); if (city.inDrive(p[0], p[2])) continue;
      city.addBox(p[0] - 0.3, p[2] - 0.3, p[0] + 0.3, p[2] + 0.3, 'p');
      const Rt = rng(e.id * 7 + s * 3 + sg);
      city.add(p[0], p[2], g => streetTree(city, g.det, p[0], p[2], species, Rt));
    }
    if (lamp) for (let s = 18; s < e.len - 10; s += 34) { const sg = (Math.floor(s / 34) % 2) ? 1 : -1, p = city.edgePt(e, s, sg * (sp.hw + 0.5)); city.addBox(p[0] - 0.15, p[2] - 0.15, p[0] + 0.15, p[2] + 0.15, 'p'); const d = [Math.sin(city.headAt(e, s)) * sg, Math.cos(city.headAt(e, s)) * sg]; city.add(p[0], p[2], g => city.streetLight(g, p[0], p[2], d, sp.hw * 0.45, sp.kind === 'gak')); }
    // カーブ区間の矢羽根（視線誘導）とガードパイプ（旧街道の外側）
    if (sp.kind === 'kaido') for (let s = 30; s < e.len - 30; s += 60) { const p = city.edgePt(e, s, sp.hw + 0.8); city.addBox(p[0] - 0.12, p[2] - 0.12, p[0] + 0.12, p[2] + 0.12, 'p'); city.add(p[0], p[2], g => { g.det.cyl(p[0], 0, p[2], 0.05, 2.4, 4, { c: [0.75, 0.75, 0.75] }); g.det.cbox(p[0], 2.0, p[2], 0.5, 0.5, 0.05, { c: [0.95, 0.85, 0.1] }); }); }
    // 袋小路の転回場
    if (e.seg.dead) { const n = B.ctrl === 'none' && city.extraNb.get(B).size === 1 ? B : A; city.add(n.x, n.z, g => { const r = 11; for (let k = 0; k < 20; k++) { const a0 = k / 20 * Math.PI * 2, a1 = (k + 1) / 20 * Math.PI * 2; g.d1.tri([n.x, 0, n.z], [n.x + Math.cos(a0) * r, 0, n.z + Math.sin(a0) * r], [n.x + Math.cos(a1) * r, 0, n.z + Math.sin(a1) * r], asph, [n.x / 8, n.z / 8], [(n.x + Math.cos(a0) * r) / 8, (n.z + Math.sin(a0) * r) / 8], [(n.x + Math.cos(a1) * r) / 8, (n.z + Math.sin(a1) * r) / 8], [n.x, 1, n.z]); } g.s.cyl(n.x, 0, n.z, 3, 0.2, 12, { c: [0.75, 0.74, 0.7] }); g.s.cyl(n.x, 0.2, n.z, 2.7, 0.02, 12, { c: [0.5, 0.7, 0.4], lay: L.GRASS }); city.tree(g.det, n.x, n.z, rng(n.id)); }); city.addBox(n.x - 2.6, n.z - 2.6, n.x + 2.6, n.z + 2.6, 'w', -50, 0.6); city.mm.lots.push({ x0: n.x - 11, x1: n.x + 11, z0: n.z - 11, z1: n.z + 11 }); st.culdesac = (st.culdesac || 0) + 1; }
    for (const n of [A, B]) if (!n.cfill) { n.cfill = 1; if (!n.ns.some(r => !r.curve) && !n.ew.some(r => !r.curve)) city.add(n.x, n.z, g => g.d1.flat(n.x - n.hx - 1, n.z - n.hz - 1, n.x + n.hx + 1, n.z + n.hz + 1, 0.001, asph, 8)); }
  }
  const byName = n => edges.filter(e => e.seg.name === n);
  // ---- 学園地区 ----
  const dynSign = (lines, bg, fg) => city.newDyn((ctx, S) => { ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S); ctx.strokeStyle = fg; ctx.lineWidth = 6; ctx.strokeRect(8, 8, S - 16, S - 16); lines.forEach((l, i) => txt(ctx, l[0], S / 2, l[1], l[2], fg, 'center', 230)); });
  if (city.stationRoadText) { // 駅前ロータリーの路面表示
    const { f, roadTxt } = city.stationRoadText, mk = s => city.newDyn((ctx, S) => { ctx.clearRect(0, 0, S, S); txt(ctx, s, S / 2, S / 2, 72, '#ffffff', 'center', 240); });
    const tx = mk('タクシー'), bs = mk('バス'), yaw = Math.atan2(f.inv[0], f.inv[1]);
    const a = f.W(f.F / 2 - 6, 3), b = f.W(f.F / 2 + 6, 3); if (tx != null) roadTxt(tx, a[0], a[1], yaw, 4.5); if (bs != null) roadTxt(bs, b[0], b[1], yaw, 4.5);
    (city.pois = city.pois || []).push({ t: 'station', x: city.stationLabel[0], z: city.stationLabel[1], name: '水瀬駅' });
  }
  const univ = dynSign([['水瀬大学', 100, 54], ['MINASE UNIVERSITY', 170, 20]], '#f4f1e8', '#1d3c6e');
  const school = dynSign([['みなせ市立', 80, 30], ['若葉小学校', 150, 46]], '#ffffff', '#1f5d2c');
  campus(city, univ);
  // 学生寮・ワンルーム（学園通りの西、幹線沿い）
  for (let k = 0; k < 4; k++) { const z0 = 1335 + k * 95, x0 = 24; if (k === 3 && z0 + 60 > 1730) break; dorm(city, x0, z0, k); }
  newtownCore(city, school);
  // v0.5.2 生活道路（曲線道路の間を埋める細い道）。曲線道路とはほぼ直角に接続し、歩道を切り下げる
  districtLanes(city);
  // 学生向けの店（学園通りの南側と大学前通り）
  const shopTypes = ['CONBINI3', 'TEISHOKU', 'BOOKS2', 'KARAOKE', 'FURUGI', 'CAFE', 'RAMEN', 'IZAKAYA', 'BAKERY', 'CLEANING', 'BEAUTY'];
  let shopK = 0;
  const shopPick = (R) => { const k = shopTypes[shopK % shopTypes.length]; return { w: k === 'CONBINI3' ? 20 : 9 + R() * 3, d: k === 'CONBINI3' ? 26 : 12, build: (x, z, yaw) => { shopK++; studentShop(city, x, z, yaw, k, R); } }; };
  for (const e of byName('大学前通り')) { frontage(city, e, 1, 12, e.len - 14, 0.4, shopPick, used); frontage(city, e, -1, 12, e.len - 14, 0.4, shopPick, used); }
  st.studentShops = shopK;
  // 南側・北側の住宅とアパート
  const aptPick = (R) => R() < 0.45 ? { w: 16, d: 13, build: (x, z, yaw) => place(city, x, z, yaw, 16, 13, g => oneRoom(g, R)) } : { w: 11, d: 16, build: (x, z, yaw) => place(city, x, z, yaw, 11, 16, g => newHouse(g, R, city)) };
  for (const e of byName('学園通り')) frontage(city, e, -1, 12, e.len - 12, 0.4, (R, s) => (e.from === city.nodeAt(0, 1280)?.id && s < 380) || shopK < 14 ? shopPick(R) : aptPick(R), used);
  for (const e of byName('学園北通り')) frontage(city, e, 1, 15, e.len - 15, 0.5, aptPick, used);
  for (const e of byName('学園通り')) frontage(city, e, 1, 14, e.len - 14, 0.5, (R, s) => (s < 60 ? null : aptPick(R)), used);
  // ---- ニュータウン ----
  const housePick = (R) => { const big = R() < 0.12; return big ? { w: 20, d: 22, build: (x, z, yaw) => place(city, x, z, yaw, 20, 22, g => newMansion(g, R)) } : { w: 11.5, d: 17, build: (x, z, yaw) => { place(city, x, z, yaw, 11.5, 17, g => { newHouse(g, R, city); }); const m = R() < 0.6 ? pickFit(R, 'res', 4.5, 2.0) : null; if (m) { const c = pickColor(m, R), ox = x + Math.sin(yaw) * 2.6, oz = z + Math.cos(yaw) * 2.6; city.addCarBox(ox, oz, yaw, m); city.add(ox, oz, g => city.bakeCar(g.det, m, c, ox, oz, yaw + (R() < 0.5 ? Math.PI : 0))); } } }; };
  let nh = 0;
  for (const e of edges) if (['nt', 'ntc'].includes(e.sp.kind)) for (const sg of [1, -1]) { const n0 = used.length; frontage(city, e, sg, 10, e.len - (e.seg.dead ? 2 : 12), 0.6, housePick, used); nh += used.length - n0; }
  // 学園地区の南端（川沿いの住宅地との間）にも住宅
  for (const e of byName('大学前通り')) for (const sg of [1, -1]) frontage(city, e, sg, 40, e.len - 30, 14, housePick, used);
  st.newtownHouses = nh;
  // ---- 旧街道：沿道の古い家並み（瓦屋根・板塀） ----
  for (const e of byName('旧水瀬街道')) for (const sg of [1, -1]) frontage(city, e, sg, 15, e.len - 15, 0.6, (R) => ({ w: 10, d: 11, build: (x, z, yaw) => place(city, x, z, yaw, 10, 11, g => oldHouse(g, R)) }), used);
  // v0.5.2 まだ家並みのない曲線道路（寮前通り・桜ヶ丘通り・南町通りなど）にも沿道の住宅・アパートを並べる
  for (const e of edges) if ((e.sp.kind === 'gak' || e.sp.kind === 'nt') && !['大学前通り', '学園通り', '学園北通り'].includes(e.seg.name) && !e._front) for (const sg of [1, -1]) { e._front = 1; frontage(city, e, sg, 12, e.len - 12, 0.6, e.sp.kind === 'gak' ? aptPick : housePick, used); }
  // v0.5.2 空き地をなくす：生活道路で区切った街区を、道路に面した住宅・アパート・駐車場などで埋める
  districtInfill(city);
  // 地区名・施設
  pois.push({ t: 'univ', x: 520, z: 1520, name: '水瀬大学' }, { t: 'school', x: 1190, z: 1520, name: '若葉小学校' }, { t: 'park', x: 1385, z: 1460, name: 'わかば公園' }, { t: 'shop', x: 1700, z: 1470, name: 'スーパー わかば' }, { t: 'shop', x: 1800, z: 1470, name: 'クリニックモール' });
  city.pedAreas.push({ x0: 300, x1: 760, z0: 1340, z1: 1700, w: 3.0, campus: true, name: 'campus' }, { x0: 1330, x1: 1440, z0: 1410, z1: 1510, w: 0.8, name: 'park' });
}
function streetTree(city, gb, x, z, sp, R) {
  if (sp === 2) { // さくら（樹冠の下端は約3m）
    gb.cyl(x, 0, z, 0.16, 3.0, 6, { c: [0.35, 0.26, 0.22] }, false);
    gb.cbox(x, 3.9, z, 3.6, 1.8, 3.6, { c: [0.85, 0.7, 0.76] }); gb.cbox(x + 0.7, 4.7, z - 0.4, 2.2, 1.1, 2.2, { c: [0.87, 0.74, 0.8] });
  } else city.tree(gb, x, z, R, sp === 1 ? 1 : 0); // いちょう／けやき
}
// 大学キャンパス
function campus(city, univ) {
  const st = city.stats, R = rng(808);
  city.usedRects.push({ x0: 248, x1: 802, z0: 1328, z1: 1706 }); // キャンパス全体（生活道路・住宅を入れない）
  const B = (x0, z0, x1, z1, h, o, extra) => { city.addBox(x0, z0, x1, z1); city.mm.blds.push({ x0, z0, x1, z1, h }); city.usedRects.push({ x0, x1, z0, z1 }); city.add((x0 + x1) / 2, (z0 + z1) / 2, g => { g.s.box(x0, 0, z0, x1, h, z1, o); extra && extra(g); }); };
  // 敷地（芝生・通路）とフェンス、正門
  city.add(520, 1520, g => {
    g.d1.flat(250, 1345, 800, 1700, 0.02, { c: [0.85, 0.95, 0.8], lay: L.GRASS }, 12);
    g.d1.flat(495, 1330, 545, 1700, 0.03, { c: [0.9, 0.88, 0.84], lay: L.SIDEWALK }, 3); // 中央の並木道
    g.d1.flat(300, 1420, 760, 1440, 0.03, { c: [0.9, 0.88, 0.84], lay: L.SIDEWALK }, 3);
    for (let z = 1350; z < 1700; z += 14) for (const x of [490, 550]) city.tree(g.det, x, z, rng(x * 7 + z));
  });
  for (const [x0, x1] of [[250, 490], [550, 800]]) { city.addWall(x0, 1336, x1, 1336, -1, 1.6); city.add((x0 + x1) / 2, 1336, g => { g.s.box(x0, 0, 1335.8, x1, 0.5, 1336.2, { c: [0.7, 0.68, 0.64] }); for (let x = x0; x < x1; x += 3) g.det.box(x, 0.5, 1335.95, x + 0.06, 1.6, 1336.05, { c: [0.3, 0.32, 0.3] }); g.det.box(x0, 1.5, 1335.95, x1, 1.56, 1336.05, { c: [0.3, 0.32, 0.3] }); }); }
  city.add(520, 1334, g => { for (const x of [489, 551]) { g.s.box(x - 1.5, 0, 1332, x + 1.5, 3.2, 1338, { c: [0.62, 0.58, 0.52] }); } g.s.panel(552.6, 1331.9, 549.4, 1331.9, 1.0, 3.0, 0.01, [0, 0, -1], { c: [1, 1, 1], mat: 16, lay: univ ?? L.SG_STATION }); });
  for (const x of [489, 551]) city.addBox(x - 1.5, 1332, x + 1.5, 1338);
  // 講義棟・図書館・体育館・学生会館
  const lec = { c: [0.86, 0.84, 0.8], mat: 3, side: { lay: L.OFFICE2, tw: 12, th: 7.2 }, top: { lay: L.ROOF, tw: 8 } };
  B(290, 1360, 470, 1405, 18, lec); B(570, 1360, 760, 1405, 18, lec); B(290, 1640, 470, 1690, 14.4, lec);
  B(455, 1470, 585, 1530, 13, { c: [0.6, 0.72, 0.82], mat: 3, side: { lay: L.OFFICE, tw: 8, th: 4.3 }, top: { lay: L.ROOF, tw: 8 } }, g => { for (let k = 0; k < 10; k++) { const a0 = k / 10 * Math.PI, a1 = (k + 1) / 10 * Math.PI; g.s.quadN([455, 13 + Math.sin(a0) * 8, 1500 - Math.cos(a0) * 30], [585, 13 + Math.sin(a0) * 8, 1500 - Math.cos(a0) * 30], [585, 13 + Math.sin(a1) * 8, 1500 - Math.cos(a1) * 30], [455, 13 + Math.sin(a1) * 8, 1500 - Math.cos(a1) * 30], [0, Math.sin((a0 + a1) / 2), -Math.cos((a0 + a1) / 2)], { c: [0.55, 0.62, 0.66], lay: L.METAL }); } });
  B(620, 1470, 760, 1560, 9, { c: [0.8, 0.8, 0.78], side: { lay: L.METAL, tw: 6, th: 9 } }, g => { for (let k = 0; k < 12; k++) { const a0 = k / 12 * Math.PI, a1 = (k + 1) / 12 * Math.PI; g.s.quadN([620 + 70 - Math.cos(a0) * 70, 9 + Math.sin(a0) * 9, 1470], [620 + 70 - Math.cos(a1) * 70, 9 + Math.sin(a1) * 9, 1470], [620 + 70 - Math.cos(a1) * 70, 9 + Math.sin(a1) * 9, 1560], [620 + 70 - Math.cos(a0) * 70, 9 + Math.sin(a0) * 9, 1560], [-Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0], { c: [0.45, 0.55, 0.6], lay: L.METAL }); } });
  B(600, 1600, 720, 1650, 10.8, { c: [0.9, 0.86, 0.78], mat: 3, side: { lay: L.SHOP, tw: 8, th: 3.6 }, top: { lay: L.ROOF, tw: 8 } });
  // グラウンド（陸上トラック）
  city.add(380, 1540, g => { g.d1.flat(300, 1450, 465, 1625, 0.035, { c: [0.72, 0.4, 0.3] }); g.d1.flat(312, 1462, 453, 1613, 0.04, { c: [0.45, 0.65, 0.35], lay: L.GRASS }, 6); for (const z of [1450, 1625]) g.det.box(300, 0, z - 0.05, 465, 2.5, z + 0.05, { c: [0.3, 0.45, 0.35] }); });
  st.campus = 1;
}
function dorm(city, x0, z0, k) {
  const R = rng(900 + k), w = 50, d = 16, H = 4 * 3.0, col = [[0.88, 0.85, 0.78], [0.8, 0.82, 0.84], [0.9, 0.84, 0.76], [0.85, 0.85, 0.85]][k % 4];
  city.addBox(x0, z0, x0 + d, z0 + w); city.mm.blds.push({ x0, z0, x1: x0 + d, z1: z0 + w, h: H }); city.usedRects.push({ x0, x1: x0 + d, z0, z1: z0 + w });
  city.add(x0 + d / 2, z0 + w / 2, g => {
    g.s.box(x0, 0, z0, x0 + d, H, z0 + w, { c: col, mat: 3, side: { lay: L.MANSION, tw: 13.6, th: 11.8 }, top: { lay: L.ROOF, tw: 8 } });
    for (let f = 1; f < 4; f++) { const y = f * 3.0; g.s.box(x0 + d, y - 0.1, z0 + 1, x0 + d + 1.2, y + 0.05, z0 + w - 1, { c: [0.85, 0.85, 0.83] }); g.det.box(x0 + d + 1.1, y + 0.05, z0 + 1, x0 + d + 1.2, y + 1.0, z0 + w - 1, { c: [0.75, 0.78, 0.8] }); for (let z = z0 + 3; z < z0 + w - 2; z += 4) g.det.cbox(x0 + d + 0.6, y + 0.35, z, 0.5, 0.55, 0.75, { c: [0.9, 0.9, 0.88] }); }
    for (let b = 0; b < 8; b++) city.bike(g.det, x0 + d + 2.5, z0 + 4 + b * 0.7, Math.PI / 2, b + k, 0);
    if (R() < 2) g.s.panel(x0 + d + 0.01, z0 + w / 2 - 3, x0 + d + 0.01, z0 + w / 2 + 3, 1.2, 2.4, 0.01, [1, 0, 0], { c: [1, 1, 1], mat: 16, lay: L.SG_MANSION ?? L.SG_SHOP1 });
  });
  city.stats.dorms = (city.stats.dorms || 0) + 1;
}
function oneRoom(g, R) { // ワンルームアパート（2階建て・外廊下）
  const col = WALLS[R() * WALLS.length | 0];
  g.s.box(-7, 0, 4, 7, 5.8, 12, { c: col, mat: 3, side: { lay: L.MANSION, tw: 13.6, th: 11.8 }, top: { lay: L.ROOF, tw: 8 } });
  g.s.box(-7.2, 2.8, 2.8, 7.2, 2.95, 4, { c: [0.8, 0.8, 0.8] }); g.det.box(-7.2, 2.95, 2.8, 7.2, 3.95, 2.9, { c: [0.6, 0.62, 0.64] });
  g.det.beam([6.6, 0, 3.2], [6.6, 2.8, 0.8], 0.4, { c: [0.6, 0.62, 0.64] }); // 外階段
  for (let i = 0; i < 4; i++) g.det.cbox(-5 + i * 3.4, 0.6, 12.4, 0.7, 0.55, 0.3, { c: [0.9, 0.9, 0.88] });
  return {};
}
function newMansion(g, R) { // 新しい分譲マンション（バルコニー・ガラスの手すり）
  const fl = 5 + (R() * 4 | 0), H = fl * 3.0, col = [[0.93, 0.92, 0.9], [0.82, 0.8, 0.78], [0.7, 0.62, 0.55]][R() * 3 | 0];
  g.s.box(-9, 0, 4, 9, H, 20, { c: col, mat: 3, side: { lay: L.MANSION, tw: 13.6, th: 11.8 }, top: { lay: L.ROOF, tw: 8 } });
  for (let f = 1; f < fl; f++) { const y = f * 3.0; g.s.box(-9, y - 0.12, 2.6, 9, y + 0.05, 4, { c: [0.9, 0.9, 0.88] }); g.det.box(-9, y + 0.05, 2.6, 9, y + 1.05, 2.7, { c: [0.6, 0.72, 0.8] }); }
  g.s.box(-3, 0, 1.5, 3, 3.2, 4, { c: [0.55, 0.6, 0.65], mat: 3, side: { lay: L.SHOP, tw: 6, th: 3.2 } }); // エントランス
  g.det.cyl(6, H, 12, 1.2, 2.4, 8, { c: [0.85, 0.85, 0.82] }); // 給水タンク
  return {};
}
function oldHouse(g, R) { // 旧街道の古い家（瓦屋根・板塀・格子戸）
  const wc = [[0.62, 0.48, 0.34], [0.72, 0.62, 0.5], [0.8, 0.76, 0.68]][R() * 3 | 0];
  g.s.box(-4.5, 0, 1.0, 4.5, 3.0, 9, { c: wc, mat: 3, side: { lay: L.HOUSE, tw: 7, th: 5.6 } });
  g.s.gable(-4.5, 1.0, 4.5, 9, 3.0, 2.2, { c: [0.28, 0.3, 0.34], lay: L.KAWARA, tw: 2, gc: wc }, 0.7);
  g.s.box(-4.5, 2.6, 0.2, 4.5, 2.75, 1.0, { c: [0.3, 0.32, 0.35], lay: L.KAWARA }); // 下屋
  g.det.box(-4.8, 0, 9.6, 4.8, 1.8, 9.75, { c: [0.45, 0.35, 0.25] }); // 板塀
  return {};
}
// 学生向けの店（間口の小さい店：看板・暖簾・メニュー看板。コンビニは駐車場つき）
function studentShop(city, x, z, yaw, k, R) {
  const conv = k.startsWith('CONBINI'), lay = L['SG_' + k] ?? L.SG_SHOP1;
  if (conv) {
    place(city, x, z, yaw, 20, 26, g => {
      g.d1.flat(-10, 0, 10, 12, 0.02, { c: [0.95, 0.95, 0.95], mat: 7, lay: L.ASPHALT }, 6);
      for (let i = 0; i < 4; i++) g.d2.flat(-8 + i * 4.2, 3, -7.9 + i * 4.2, 9, 0.03, { c: [0.95, 0.95, 0.93] });
      g.s.box(-9, 0, 12, 9, 4.2, 25, { c: [0.95, 0.95, 0.94], mat: 3, side: { lay: L.SHOP, tw: 6, th: 4.2 }, top: { lay: L.ROOF, tw: 6 } });
      g.s.box(-9.1, 3.1, 11.9, 9.1, 4.2, 12.1, { c: [0.2, 0.6, 0.35], mat: 18 }); // 看板帯（夜も明るい）
      g.s.panel(-5, 11.86, 5, 11.86, 3.15, 4.15, 0, [0, 0, -1], { c: [1, 1, 1], mat: 16, lay }, [[1, 1], [0, 1], [0, 0], [1, 0]]);
      g.glow.flat(-12, -2, 12, 13, 0.06, { c: [0.95, 0.98, 1], mat: 5, lay: L.GLOW });
      city.nobori(g.det, -9.5, 11, 0); city.nobori(g.det, 9.5, 11, 0);
      g.det.cbox(7, 0.5, 11.4, 1.4, 1.0, 0.6, { c: [0.3, 0.35, 0.4] }); // ゴミ箱
    });
    city.stats.conbini = (city.stats.conbini || 0) + 1;
    const c = [x + Math.sin(yaw) * 6, z + Math.cos(yaw) * 6]; (city.pois = city.pois || []).push({ t: 'conv', x: c[0], z: c[1], name: 'ことりマート' });
    for (let i = 0; i < 4; i++) if (R() < 0.65) { const m = pickFit(R, 'pass', 4.95), lx = -6 + i * 4.2, lz = 6, cx = x + Math.cos(yaw) * lx + Math.sin(yaw) * lz, cz = z - Math.sin(yaw) * lx + Math.cos(yaw) * lz, b = i === 0 ? null : i % 3; city.addCarBox(cx, cz, yaw, m, b); city.add(cx, cz, g => city.bakeCar(b == null ? g.det : g['nc' + b], m, pickColor(m, R), cx, cz, yaw + Math.PI)); } // 24時間営業：1台は夜も残る
    return;
  }
  const w = 9, h = 3.2 + (R() < 0.5 ? 2.8 : 0), wc = WALLS[R() * WALLS.length | 0];
  place(city, x, z, yaw, w + 1, 12, g => {
    g.s.box(-w / 2, 0, 1.5, w / 2, h, 12, { c: wc, mat: 3, side: { lay: L.HOUSE, tw: 7, th: 5.6 }, top: { lay: L.ROOF, tw: 6 } });
    g.s.box(-w / 2 + 0.5, 0, 1.45, w / 2 - 0.5, 2.6, 1.5, { c: [1, 1, 1], mat: 3, lay: L.SHOP }); // ショーウィンドウ
    g.s.panel(w / 2 - 0.3, 1.38, -w / 2 + 0.3, 1.38, 2.75, 3.15, 0, [0, 0, -1], { c: [1, 1, 1], mat: 16, lay });
    g.s.box(-w / 2, 2.6, 0.4, w / 2, 2.7, 1.5, { c: [0.35, 0.4, 0.45] }); // 庇
    if (/RAMEN|TEISHOKU|IZAKAYA/.test(k)) for (let i = 0; i < 4; i++) g.det.quadN([-1.6 + i * 0.8, 1.9, 1.3], [-0.85 + i * 0.8, 1.9, 1.3], [-0.85 + i * 0.8, 2.6, 1.3], [-1.6 + i * 0.8, 2.6, 1.3], [0, 0, -1], { c: k === 'IZAKAYA' ? [0.6, 0.12, 0.1] : [0.15, 0.2, 0.35] }); // 暖簾
    g.det.box(w / 2 - 1.6, 0, 0.4, w / 2 - 0.8, 1.1, 0.5, { c: [0.15, 0.15, 0.15] }); // メニュー看板
    g.det.box(w / 2 - 1.55, 0.3, 0.38, w / 2 - 0.85, 1.0, 0.39, { c: [0.95, 0.92, 0.8] });
  });
  const food = /RAMEN|TEISHOKU|IZAKAYA|CAFE|BAKERY/.test(k);
  (city.pois = city.pois || []).push({ t: food ? 'food' : 'shop', x: x + Math.sin(yaw) * 6, z: z + Math.cos(yaw) * 6, name: { TEISHOKU: '定食 まるや', BOOKS2: '書店', KARAOKE: 'カラオケ ポップ', FURUGI: '古着屋 ふるる', CAFE: 'カフェ こもれび', RAMEN: 'ラーメン 龍門', IZAKAYA: '居酒屋 ほたる', BAKERY: 'ベーカリー 麦の穂', CLEANING: 'クリーニング', BEAUTY: 'ヘアサロン' }[k] || '店' });
  city.stats.restaurants = (city.stats.restaurants || 0) + (food ? 1 : 0);
}
// ニュータウンの中心：小学校・公園（遊具・噴水）・スーパーとクリニックモール・マンション
function newtownCore(city, schoolSign) {
  const used = city.usedRects, R = rng(1717);
  const B = (x0, z0, x1, z1, h, o, extra, kind = 'b') => { city.addBox(x0, z0, x1, z1, kind); city.mm.blds.push({ x0, z0, x1, z1, h }); city.add((x0 + x1) / 2, (z0 + z1) / 2, g => { if (o) g.s.box(x0, 0, z0, x1, h, z1, o); extra && extra(g); }); };
  // 小学校
  used.push({ x0: 1070, x1: 1310, z0: 1390, z1: 1650 });
  city.add(1190, 1520, g => { g.d1.flat(1075, 1395, 1305, 1645, 0.02, { c: [0.78, 0.68, 0.52], lay: L.FIELD }, 6); });
  B(1080, 1560, 1300, 1580, 11, { c: [0.93, 0.92, 0.88], mat: 3, side: { lay: L.OFFICE2, tw: 12, th: 7.2 }, top: { lay: L.ROOF, tw: 8 } }, g => { g.s.box(1180, 11, 1565, 1200, 15, 1575, { c: [0.93, 0.92, 0.88] }); g.s.cyl(1190, 13, 1564.9, 1.2, 0.1, 12, { c: [0.95, 0.95, 0.95], mat: 18 }); });
  B(1230, 1600, 1300, 1640, 9, { c: [0.75, 0.8, 0.82], side: { lay: L.METAL, tw: 6, th: 9 } }, g => g.s.gable(1230, 1600, 1300, 1640, 9, 3, { c: [0.4, 0.5, 0.6], lay: L.METAL, tw: 3 }));
  for (const [x0, z0, x1, z1] of [[1075, 1395, 1305, 1396], [1075, 1644, 1305, 1645], [1075, 1395, 1076, 1645], [1304, 1395, 1305, 1645]]) { city.addWall(x0, z0, x1, z1, -1, 1.8); city.add((x0 + x1) / 2, (z0 + z1) / 2, g => g.det.box(x0, 0, z0, x1, 1.8, z1, { c: [0.35, 0.45, 0.4] })); }
  B(1150, 1385, 1152, 1395, 2.6, { c: [0.62, 0.6, 0.55] }, g => { g.s.box(1170, 0, 1385, 1172, 2.6, 1395, { c: [0.62, 0.6, 0.55] }); g.s.panel(1150, 1384.9, 1144, 1384.9, 0.8, 2.4, 0, [0, 0, -1], { c: [1, 1, 1], mat: 16, lay: schoolSign ?? L.SG_SHOP1 }); });
  // 公園
  used.push({ x0: 1320, x1: 1450, z0: 1400, z1: 1520 });
  city.add(1385, 1460, g => {
    g.d1.flat(1322, 1402, 1448, 1518, 0.03, { c: [1, 1, 1], lay: L.GRASS }, 8);
    g.d1.flat(1360, 1440, 1410, 1480, 0.04, { c: [0.85, 0.8, 0.7], lay: L.SIDEWALK }, 3);
    g.s.cyl(1385, 0, 1460, 5, 0.6, 16, { c: [0.75, 0.74, 0.7] }); g.s.cyl(1385, 0.6, 1460, 4.6, 0.02, 16, { c: [0.6, 0.8, 0.95], mat: 21, lay: L.WATER }); g.s.cyl(1385, 0.6, 1460, 0.4, 2.2, 8, { c: [0.75, 0.74, 0.7] }); // 噴水
    // すべり台・ブランコ・ジャングルジム・砂場
    g.det.box(1335, 0, 1490, 1337, 2.2, 1492, { c: [0.9, 0.3, 0.2] }); g.det.quadN([1336, 2.2, 1492], [1338, 2.2, 1492], [1338, 0.1, 1499], [1336, 0.1, 1499], [0, 0.95, 0.3], { c: [0.95, 0.75, 0.2] });
    for (const x of [1345, 1351]) g.det.beam([x, 0, 1505], [x, 2.6, 1505], 0.06, { c: [0.2, 0.4, 0.8] }); g.det.beam([1345, 2.6, 1505], [1351, 2.6, 1505], 0.06, { c: [0.2, 0.4, 0.8] }); for (const x of [1347, 1349]) g.det.box(x - 0.3, 0.5, 1504.8, x + 0.3, 0.55, 1505.2, { c: [0.8, 0.2, 0.2] });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.det.beam([1420 + i, 0, 1495], [1420 + i, 3, 1495], 0.03, { c: [0.2, 0.7, 0.3] }); g.det.beam([1420, j, 1495], [1423, j, 1495], 0.03, { c: [0.2, 0.7, 0.3] }); }
    g.d1.flat(1420, 1410, 1432, 1420, 0.05, { c: [0.85, 0.78, 0.6], lay: L.FIELD });
    for (let k = 0; k < 10; k++) city.tree(g.det, 1325 + (k % 5) * 30, k < 5 ? 1405 : 1515, rng(k + 51));
    for (const x of [1365, 1400]) { g.det.box(x, 0.4, 1436, x + 1.8, 0.48, 1436.5, { c: [0.6, 0.42, 0.28] }); }
  });
  for (const [x, z] of [[1336, 1491], [1348, 1505], [1421, 1495]]) city.addBox(x - 1.2, z - 1.2, x + 1.2, z + 1.2, 'p');
  city.addBox(1380, 1455, 1390, 1465, 'w', -50, 0.6);
  // スーパー＋クリニックモール（共用駐車場）
  used.push({ x0: 1600, x1: 1860, z0: 1420, z1: 1560 });
  B(1610, 1500, 1720, 1555, 7, { c: [0.93, 0.93, 0.9], mat: 3, side: { lay: L.SHOP, tw: 8, th: 4.5 }, top: { lay: L.ROOF, tw: 8 } }, g => { g.s.panel(1690, 1499.9, 1640, 1499.9, 5, 7, 0.02, [0, 0, -1], { c: [1, 1, 1], mat: 16, lay: L.SG_SUPER2 }); g.s.box(1610, 3.3, 1497, 1720, 3.5, 1500, { c: [0.3, 0.6, 0.35] }); });
  B(1740, 1505, 1850, 1555, 8, { c: [0.88, 0.92, 0.95], mat: 3, side: { lay: L.OFFICE, tw: 8, th: 4 }, top: { lay: L.ROOF, tw: 8 } }, g => g.s.panel(1820, 1504.9, 1770, 1504.9, 5.5, 7.5, 0.02, [0, 0, -1], { c: [1, 1, 1], mat: 16, lay: L.SG_CLINIC }));
  city.mm.lots.push({ x0: 1605, x1: 1855, z0: 1425, z1: 1495 });
  const lotCars = [];
  for (let i = 0; i < 18; i++) for (const row of [1440, 1478]) { if (R() > 0.55) continue; const m = pickFit(R, 'pass', 4.95), x = 1615 + i * 13, yaw = row < 1460 ? 0 : Math.PI, b = i % 3; lotCars.push([m, pickColor(m, R), x, row, yaw + (R() < 0.7 ? Math.PI : 0), b]); city.addCarBox(x, row, yaw, m, b); }
  city.add(1730, 1460, g => { g.d1.flat(1605, 1425, 1855, 1495, 0.02, { c: [0.95, 0.95, 0.95], mat: 7, lay: L.ASPHALT }, 8); for (let i = 0; i < 19; i++) for (const row of [1440, 1478]) g.d2.flat(1608.5 + i * 13, row - 2.6, 1608.6 + i * 13, row + 2.6, 0.03, { c: [0.95, 0.95, 0.93] }); g.glow.flat(1600, 1420, 1860, 1500, 0.06, { c: [0.95, 0.95, 1], mat: 5, lay: L.GLOW }); });
  city.add(1730, 1458, g => { for (const [m, col, x, z, yaw, b] of lotCars) city.bakeCar(g['nc' + b], m, col, x, z, yaw); }); // 閉店後は消える（3段階）
  // 分譲マンション
  for (const [x0, z0] of [[1928, 1430], [1928, 1560]]) { used.push({ x0, x1: x0 + 24, z0, z1: z0 + 26 }); place(city, x0, z0 + 13, Math.PI / 2, 20, 22, g => newMansion(g, rng(x0 + z0))); }
  (city.pois = city.pois || []).push({ t: 'shop', x: 1660, z: 1490, name: 'スーパー わかば' });
}

// v0.5.1 総合病院：正面玄関の大庇、救急入口（赤い看板・救急車・夜間照明）、屋上ヘリポート
function hospitalPost(city) {
  const hp = city.hospital; if (!hp) return;
  const { f, H } = hp, F = f.F, W = f.W, uc = (30 + F - 6) / 2;
  const du = [W(1, 0)[0] - W(0, 0)[0], W(1, 0)[1] - W(0, 0)[1]], dw = [W(0, 1)[0] - W(0, 0)[0], W(0, 1)[1] - W(0, 0)[1]];
  const er = city.newDyn((ctx, S) => { ctx.fillStyle = '#c0392b'; ctx.fillRect(0, 0, S, S); ctx.fillStyle = '#fff'; ctx.fillRect(14, 14, 90, S - 28); ctx.fillStyle = '#c0392b'; ctx.fillRect(49, 40, 20, S - 80); ctx.fillRect(24, S / 2 - 10, 70, 20); txt(ctx, '救急外来', S / 2 + 52, S / 2 - 30, 58, '#ffffff', 'center', 140); txt(ctx, 'EMERGENCY', S / 2 + 52, S / 2 + 42, 30, '#ffffff', 'center', 140); });
  const rect = (u0, u1, w0, w1) => city.frect(f, u0, u1, w0, w1);
  const at = (u, w) => W(u, w);
  const c0 = at(uc, 20);
  city.add(c0[0], c0[1], g => {
    // 正面玄関の大庇と柱
    const cp = rect(uc - 8, uc + 8, 17, 24); g.s.box(cp.x0, 3.6, cp.z0, cp.x1, 3.95, cp.z1, { c: [0.82, 0.85, 0.88] });
    for (const u of [uc - 7, uc + 7]) { const q = at(u, 17.6); g.s.cyl(q[0], 0, q[1], 0.25, 3.6, 8, { c: [0.9, 0.9, 0.9] }); }
    g.glow.flat(cp.x0 - 3, cp.z0 - 3, cp.x1 + 3, cp.z1 + 3, 0.06, { c: [1, 0.97, 0.9], mat: 5, lay: L.GLOW });
    // 救急入口（建物の側面）：庇・看板・救急車
    const ec = rect(20, 30, 50, 66); g.s.box(ec.x0, 4.0, ec.z0, ec.x1, 4.35, ec.z1, { c: [0.85, 0.86, 0.88] });
    for (const w of [51, 65]) { const q = at(20.6, w); g.s.cyl(q[0], 0, q[1], 0.2, 4.0, 8, { c: [0.9, 0.9, 0.9] }); }
    if (er != null) { const a = at(20, 52), b = at(20, 64); g.s.panel(a[0], a[1], b[0], b[1], 4.35, 5.6, 0.1, [-du[0], 0, -du[1]], { c: [1, 1, 1], mat: 16, lay: er }); }
    g.glow.flat(ec.x0 - 3, ec.z0, ec.x1, ec.z1, 0.06, { c: [1, 0.95, 0.9], mat: 5, lay: L.GLOW });
    const am = at(25, 58), alongZ = Math.abs(dw[1]) > 0.5, bw = alongZ ? 1.95 : 5.4, bd = alongZ ? 5.4 : 1.95;
    g.s.cbox(am[0], 0.35 + 1.15, am[1], bw, 2.3, bd, { c: [0.97, 0.97, 0.97] });
    g.s.cbox(am[0], 1.25, am[1], bw + 0.04, 0.22, bd + 0.04, { c: [0.85, 0.12, 0.1] });
    g.s.cbox(am[0], 1.9, am[1], bw + 0.03, 0.55, bd * 0.55 + 0.03, { c: [0.15, 0.2, 0.25] }); // 窓帯
    for (const k of [-1, 1]) g.s.cbox(am[0] + (alongZ ? 0 : k * 2.4) + (alongZ ? k * 0.0 : 0), 0.35, am[1] + (alongZ ? k * 1.8 : 0), alongZ ? 2.0 : 0.6, 0.6, alongZ ? 0.6 : 2.0, { c: [0.1, 0.1, 0.1] }); // タイヤ
    const lt = [am[0] - dw[0] * 2.3, am[1] - dw[1] * 2.3]; g.det.cbox(lt[0], 2.75, lt[1], 1.2, 0.18, 0.35, { c: [1, 0.15, 0.1], mat: 8 }); // 赤色灯
    // 屋上ヘリポート
    const b = rect(30, F - 6, 24, 70), cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, rr = Math.min(9, (Math.min(b.x1 - b.x0, b.z1 - b.z0)) / 2 - 1.5);
    g.s.cyl(cx, H, cz, rr, 0.06, 32, { c: [0.3, 0.42, 0.35] });
    g.s.cyl(cx, H + 0.06, cz, rr * 0.82, 0.02, 32, { c: [0.95, 0.95, 0.95] });
    g.s.cyl(cx, H + 0.08, cz, rr * 0.75, 0.02, 32, { c: [0.3, 0.42, 0.35] });
    const hs = rr * 0.4, ht = 0.1, a1 = alongZ ? 1 : 0; // 「H」の字（3本の白線）
    const box2 = (u0, u1, v0, v1) => alongZ ? g.s.box(cx + u0, H + 0.1, cz + v0, cx + u1, H + 0.12, cz + v1, { c: [0.97, 0.97, 0.97] }) : g.s.box(cx + v0, H + 0.1, cz + u0, cx + v1, H + 0.12, cz + u1, { c: [0.97, 0.97, 0.97] });
    void a1; void ht;
    box2(-hs * 0.6 - 0.5, -hs * 0.6 + 0.5, -hs, hs); box2(hs * 0.6 - 0.5, hs * 0.6 + 0.5, -hs, hs); box2(-hs * 0.6, hs * 0.6, -0.5, 0.5);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.det.cbox(cx + Math.cos(a) * rr, H + 0.12, cz + Math.sin(a) * rr, 0.25, 0.15, 0.25, { c: [1, 0.85, 0.3], mat: 8 }); }
    g.s.box(b.x0, H, b.z0, b.x1, H + 1.1, b.z0 + 0.15, { c: [0.8, 0.8, 0.8] }); g.s.box(b.x0, H, b.z1 - 0.15, b.x1, H + 1.1, b.z1, { c: [0.8, 0.8, 0.8] });
  });
  const am = at(25, 58); city.addBox(am[0] - 2.8, am[1] - 2.8, am[0] + 2.8, am[1] + 2.8);
  for (const w of [51, 65]) { const q = at(20.6, w); city.addBox(q[0] - 0.25, q[1] - 0.25, q[0] + 0.25, q[1] + 0.25, 'p'); }
  for (const u of [uc - 7, uc + 7]) { const q = at(u, 17.6); city.addBox(q[0] - 0.3, q[1] - 0.3, q[0] + 0.3, q[1] + 0.3, 'p'); }
  (city.pois = city.pois || []).push({ t: 'hosp', x: c0[0], z: c0[1], name: '水瀬総合病院' });
}

// ================= v0.5.2 生活道路と街区の充填 =================
const DIST_RECTS = [{ x0: 0, x1: 1000, z0: 1000, z1: 2000, k: 'gak' }, { x0: 1000, x1: 2000, z0: 1000, z1: 2000, k: 'nt' }];
function gridExt(city, axis, c) { let e = 0; for (const r of city.roads) if (!r.curve && r.axis === axis && r.c === c) e = Math.max(e, r.sp.ext); return e || 8; }
function nearCurve(city, x, z) { // 最も近い曲線道路：中心線までの距離・向き・道路
  let bd = 1e9, dir = null, cs = null;
  for (const c of city.curveCorr) { if (x < c.bb[0] - 60 || x > c.bb[2] + 60 || z < c.bb[1] - 60 || z > c.bb[3] + 60) continue;
    for (let i = 0; i < c.pts.length - 1; i++) { const a = c.pts[i], b = c.pts[i + 1], vx = b[0] - a[0], vz = b[1] - a[1], l2 = vx * vx + vz * vz || 1, t = clamp(((x - a[0]) * vx + (z - a[1]) * vz) / l2, 0, 1), d = Math.hypot(a[0] + vx * t - x, a[1] + vz * t - z); if (d < bd) { bd = d; const l = Math.sqrt(l2); dir = [vx / l, vz / l]; cs = c; } } }
  return { d: bd, dir, c: cs };
}
function districtLanes(city) {
  city.curveCorr = city.corridors.filter(c => !c.lane).map(c => { const xs = c.pts.map(p => p[0]), zs = c.pts.map(p => p[1]); return { ...c, bb: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)], hw: c.hw ?? c.w - 1 }; });
  for (const s of city.curveSegs) { const cc = city.curveCorr.find(c => c.pts === s.full); if (cc) { cc.hw = s.road.sp.hw; cc.ext = s.road.sp.ext; } }
  const big = city.usedRects.filter(r => (r.x1 - r.x0) * (r.z1 - r.z0) > 600).map(r => ({ x0: r.x0 - 3, x1: r.x1 + 3, z0: r.z0 - 3, z1: r.z1 + 3 }));
  const jn = city.nodes.filter(n => n.ns.length + n.ew.length >= 3 && (n.ns.some(r => r.curve) || n.ew.some(r => r.curve)));
  const cuts = city.swCuts = city.swCuts || [], lanes = city.dLanes = [], asph = { c: [0.95, 0.95, 0.95], mat: 7, lay: L.ASPHALT };
  for (const D of DIST_RECTS) {
    const mx0 = gridExt(city, 'ns', D.x0), mx1 = gridExt(city, 'ns', D.x1), mz0 = gridExt(city, 'ew', D.z0), mz1 = gridExt(city, 'ew', D.z1);
    const X0 = D.x0 + mx0, X1 = D.x1 - mx1, Z0 = D.z0 + mz0, Z1 = D.z1 - mz1;
    const nx = Math.round((X1 - X0) / 100), nz = Math.round((Z1 - Z0) / 100);
    const lines = [];
    for (let i = 1; i < nx; i++) lines.push({ axis: 'ns', c: Math.round(X0 + (X1 - X0) * i / nx), a: X0, b: X1 === X1 ? Z0 : 0, e: Z1 });
    for (let i = 1; i < nz; i++) lines.push({ axis: 'ew', c: Math.round(Z0 + (Z1 - Z0) * i / nz), a: X0, b: X1 });
    D.lines = lines; D.X0 = X0; D.X1 = X1; D.Z0 = Z0; D.Z1 = Z1;
    for (const ln of lines) {
      const ns = ln.axis === 'ns', A = ns ? Z0 : X0, Bn = ns ? Z1 : X1, dir = ns ? [0, 1] : [1, 0];
      const P = t => ns ? [ln.c, t] : [t, ln.c];
      const state = t => { const [x, z] = P(t); if (big.some(r => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1)) return 'ex';
        if (jn.some(n => Math.hypot(n.x - x, n.z - z) < 22)) return 'ex'; // 曲線道路の交差点のすぐ脇には生活道路をつながない
        const n = nearCurve(city, x, z); if (!n.c) return 'ok'; const dot = Math.abs(n.dir[0] * dir[0] + n.dir[1] * dir[1]);
        if (n.d < n.c.ext + 4) return 'cor'; if (n.d < n.c.ext + 34 && dot > 0.75) return 'par'; return 'ok'; };
      const st = []; for (let t = A; t <= Bn; t += 2) st.push([t, state(t)]);
      let i = 0;
      while (i < st.length) {
        if (st[i][1] !== 'ok') { i++; continue; }
        let j = i; while (j + 1 < st.length && st[j + 1][1] === 'ok') j++;
        let t0 = st[i][0], t1 = st[j][0];
        const before = i > 0 ? st[i - 1][1] : 'edge', after = j + 1 < st.length ? st[j + 1][1] : 'edge';
        if (t1 - t0 >= 24 || (before === 'cor' && after === 'cor')) {
          // 端の処理：曲線道路なら車道の端まで延ばして歩道を切り下げ、外周の格子道路なら車道の端まで延ばす
          const ext = (t, sg) => { let tt = t; for (let k = 0; k < 40; k++) { const [x, z] = P(tt + sg * 0.5), n = nearCurve(city, x, z); if (!n.c || n.d <= n.c.hw - 0.4) break; tt += sg * 0.5; } const [x, z] = P(tt), n = nearCurve(city, x, z); const q = P(tt - sg * (n.c ? (n.c.ext - n.c.hw) / 2 : 0)); if (n.c && n.d < n.c.hw + 1) cuts.push({ x: q[0], z: q[1] }); return tt; };
          if (before === 'cor') t0 = ext(t0, -1); else if (before === 'edge') t0 = A - (ns ? mz0 : mx0) + 0.5 + (ns ? gridHw(city, 'ew', D.z0) : gridHw(city, 'ns', D.x0)) - 0.5;
          if (after === 'cor') t1 = ext(t1, 1); else if (after === 'edge') t1 = Bn + (ns ? mz1 : mx1) - (ns ? gridHw(city, 'ew', D.z1) : gridHw(city, 'ns', D.x1));
          const piece = ns ? { axis: 'ns', c: ln.c, a: t0, b: t1 } : { axis: 'ew', c: ln.c, a: t0, b: t1 };
          // 外周の格子道路に出るところは歩道を切り下げる（段差なしで出入り）
          for (const [end, isEdge, gc] of [[t0, before === 'edge', ns ? D.z0 : D.x0], [t1, after === 'edge', ns ? D.z1 : D.x1]]) if (isEdge) {
            const lo = Math.min(end, gc), hi = Math.max(end, gc) + (end > gc ? 0 : 0);
            const r = ns ? { x0: ln.c - 2.7, x1: ln.c + 2.7, z0: Math.min(gc, end) - 1, z1: Math.max(gc, end) + 3 * Math.sign(end - gc) * 0 + 1 } : { x0: Math.min(gc, end) - 1, x1: Math.max(gc, end) + 1, z0: ln.c - 2.7, z1: ln.c + 2.7 };
            void lo; void hi; city.addDriveway(r);
          }
          lanes.push(piece);
        }
        i = j + 1;
      }
    }
  }
  for (const l of lanes) {
    const ns = l.axis === 'ns', x0 = ns ? l.c - 2.5 : l.a, x1 = ns ? l.c + 2.5 : l.b, z0 = ns ? l.a : l.c - 2.5, z1 = ns ? l.b : l.c + 2.5;
    for (let t = l.a; t < l.b; t += 100) { const t1 = Math.min(l.b, t + 100), m = ns ? [l.c, (t + t1) / 2] : [(t + t1) / 2, l.c]; city.add(m[0], m[1], g => g.d1.flat(ns ? x0 : t, ns ? t : z0, ns ? x1 : t1, ns ? t1 : z1, 0.002, asph, 8)); }
    city.mm.lanes.push({ axis: l.axis, c: l.c, a: l.a, b: l.b, w: 2.5, kind: 'lane' });
    city.corridors.push({ pts: ns ? [[l.c, l.a], [l.c, l.b]] : [[l.a, l.c], [l.b, l.c]], w: 2.9, lane: true });
  }
  city.stats.districtLanes = lanes.length; city.stats.districtLaneKm = +(lanes.reduce((t, l) => t + l.b - l.a, 0) / 1000).toFixed(2);
}
function gridHw(city, axis, c) { let e = 0; for (const r of city.roads) if (!r.curve && r.axis === axis && r.c === c) e = Math.max(e, r.sp.hw); return e || 4; }
function districtInfill(city) {
  const used = city.usedRects, R = rng(4242), filled = city.dFilled = [];
  const ov = (a, b, m = 0.3) => a.x0 < b.x1 - m && a.x1 > b.x0 + m && a.z0 < b.z1 - m && a.z1 > b.z0 + m;
  const grid = new Map(), key = (i, j) => i + ',' + j; // usedRects の空間ハッシュ（50m）
  const addG = r => { for (let i = Math.floor(r.x0 / 50); i <= Math.floor(r.x1 / 50); i++) for (let j = Math.floor(r.z0 / 50); j <= Math.floor(r.z1 / 50); j++) { const k = key(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(r); } };
  for (const r of used) addG(r);
  const hitUsed = r => { for (let i = Math.floor(r.x0 / 50); i <= Math.floor(r.x1 / 50); i++) for (let j = Math.floor(r.z0 / 50); j <= Math.floor(r.z1 / 50); j++) for (const u of grid.get(key(i, j)) || []) if (ov(r, u)) return true; return false; };
  const check = pr => { if (hitUsed(pr)) return 'skip'; if (city.corridorHit(pr)) return 'green'; return 'ok'; };
  const log = (pr, k) => { filled.push({ ...pr, k }); addG(pr); };
  let parcels = 0, greens = 0;
  const rows = (r, side) => { city.fillParcels(r, side, R, { check: pr => { const c = check(pr); if (c === 'ok') { parcels++; log(pr, 'p'); } else if (c === 'green') { greens++; log(pr, 'g'); } return c; } }); };
  for (const D of DIST_RECTS) {
    const xsL = D.lines.filter(l => l.axis === 'ns').map(l => l.c), zsL = D.lines.filter(l => l.axis === 'ew').map(l => l.c);
    const bx = [D.X0, ...xsL.flatMap(x => [x - 2.5, x + 2.5]), D.X1], bz = [D.Z0, ...zsL.flatMap(z => [z - 2.5, z + 2.5]), D.Z1];
    // 地面（住宅地の土・砂利）：曲線道路の帯や公園の下にもしいておく
    for (let x = D.X0; x < D.X1; x += 125) for (let z = D.Z0; z < D.Z1; z += 125) { const x1 = Math.min(D.X1, x + 125), z1 = Math.min(D.Z1, z + 125); city.add((x + x1) / 2, (z + z1) / 2, g => g.s.flat(x, z, x1, z1, -0.005, { c: [0.8, 0.79, 0.74], lay: L.SIDEWALK }, 4)); } // 土間コン・砂利の敷地
    for (let i = 0; i < bx.length; i += 2) for (let j = 0; j < bz.length; j += 2) {
      const sb = { x0: bx[i], x1: bx[i + 1], z0: bz[j], z1: bz[j + 1] }, w = sb.x1 - sb.x0, d = sb.z1 - sb.z0; if (w < 12 || d < 12) continue;
      const dep = Math.min(17, d / 2, 17);
      rows({ x0: sb.x0, x1: sb.x1, z0: sb.z0, z1: sb.z0 + dep }, 'n');
      if (d > 2 * dep - 0.1) rows({ x0: sb.x0, x1: sb.x1, z0: sb.z1 - dep, z1: sb.z1 }, 's');
      if (d - 2 * dep > 12 && w > 2 * 17) { rows({ x0: sb.x0, x1: sb.x0 + 17, z0: sb.z0 + dep, z1: sb.z1 - dep }, 'w'); rows({ x0: sb.x1 - 17, x1: sb.x1, z0: sb.z0 + dep, z1: sb.z1 - dep }, 'e'); }
      const ir = { x0: sb.x0 + 18, x1: sb.x1 - 18, z0: sb.z0 + dep + 1, z1: sb.z1 - dep - 1 };
      if (ir.x1 - ir.x0 < 10 || ir.z1 - ir.z0 < 10) continue;
      // 街区の奥：住宅の背中合わせ・家庭菜園・児童遊園・月極駐車場・マンション（曲線道路の帯や既存施設は避ける）
      const D2 = Math.min(17, (ir.z1 - ir.z0) / 2);
      for (let z = ir.z0; z < ir.z1 - 6; z += D2) {
        const r = { x0: ir.x0, x1: ir.x1, z0: z, z1: Math.min(ir.z1, z + D2) }, k = R();
        if (r.z1 - r.z0 < 6) continue;
        if (k < 0.12 && !hitUsed(r) && !city.corridorHit(r)) { city.homeGarden(r, 's', R); log(r, 'garden'); continue; }
        if (k < 0.2 && !hitUsed(r) && !city.corridorHit(r) && r.x1 - r.x0 < 40) { city.kidsPark(r, 's', R); log(r, 'kids'); continue; }
        rows(r, (z - ir.z0) / D2 % 2 < 1 ? 'n' : 's');
      }
    }
  }
  city.stats.districtParcels = parcels; city.stats.districtGreens = greens;
}

// 曲線道路 e の片側 sg の歩道で、生活道路が横切る位置（道路に沿った距離 s）。歩道の中心線を0.5mおきに調べ、生活道路の舗装（幅5m）に入る区間の中央を返す
function cutS(city, e, sg) {
  const key = '_cut' + sg; if (e[key]) return e[key];
  const out = [], L = city.dLanes || [], o = sg * (e.sp.hw + e.sp.sw / 2);
  let run = null;
  for (let s = 0; s <= e.len; s += 0.5) {
    const p = city.edgePt(e, s, o); let hit = false;
    for (const l of L) { const ns = l.axis === 'ns', u = ns ? p[0] : p[2], t = ns ? p[2] : p[0]; if (Math.abs(u - l.c) < 2.6 && t > l.a - 0.5 && t < l.b + 0.5) { hit = true; break; } }
    if (hit && run == null) run = s; else if (!hit && run != null) { out.push((run + s) / 2); run = null; }
  }
  if (run != null) out.push((run + e.len) / 2);
  return e[key] = out;
}

// 修正92：学園地区・ニュータウンの空き地率（実行時に計算）。4m格子の各点が、道路（格子・曲線の車道＋歩道）／生活道路／施設・沿道建物の敷地／
// 区画（住宅・駐車場・緑地など）／当たり判定のある構造物 のどれにも入らなければ「空き地」と数える
export function districtCoverage(city, step = 4) {
  const cnt = { road: 0, lane: 0, facility: 0, parcel: 0, green: 0, empty: 0 }, inR = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
  for (let z = 1000 + step / 2; z < 2000; z += step) for (let x = step / 2; x < 2000; x += step) {
    let k = null;
    for (const r of city.roads) if (!r.curve && (r.axis === 'ns' ? Math.abs(x - r.c) < r.sp.ext && z >= r.a && z <= r.b : Math.abs(z - r.c) < r.sp.ext && x >= r.a && x <= r.b)) { k = 'road'; break; }
    if (!k) for (const c of city.curveCorr || []) { if (x < c.bb[0] - 15 || x > c.bb[2] + 15 || z < c.bb[1] - 15 || z > c.bb[3] + 15) continue; for (let i = 0; i < c.pts.length - 1 && !k; i++) { const a = c.pts[i], b = c.pts[i + 1], vx = b[0] - a[0], vz = b[1] - a[1], t = clamp(((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz || 1), 0, 1); if (Math.hypot(a[0] + vx * t - x, a[1] + vz * t - z) < (c.ext || 8)) k = 'road'; } if (k) break; }
    if (!k) for (const l of city.dLanes || []) if (l.axis === 'ns' ? Math.abs(x - l.c) < 2.5 && z >= l.a && z <= l.b : Math.abs(z - l.c) < 2.5 && x >= l.a && x <= l.b) { k = 'lane'; break; }
    if (!k) for (const r of city.usedRects) if (inR(r, x, z)) { k = 'facility'; break; }
    if (!k) for (const r of city.dFilled || []) if (inR(r, x, z)) { k = r.k === 'g' ? 'green' : 'parcel'; break; }
    if (!k && [...city.query(x, z, 1)].length) k = 'parcel';
    cnt[k || 'empty']++;
  }
  const tot = Object.values(cnt).reduce((a, b) => a + b, 0), pct = {}; for (const k in cnt) pct[k] = +(cnt[k] / tot * 100).toFixed(2);
  return { step, samples: tot, pct };
}
