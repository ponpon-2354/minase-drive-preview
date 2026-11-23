// NPC交通AI：道路ネットワーク（直線・曲線・高低差）追従、IDM車間制御、信号/一時停止、右折待ち、車線変更、
// 駐車場の入出庫、駅前ロータリーの周回車両
import { clamp, angDiff, bez, M4 } from './math.js?v=0.8.0';
import { pickModel, pickColor, plateClass, MODELS, isCommercial } from './carmodels.js?v=0.8.0';
import { PLATES } from './textures.js?v=0.8.0';

// 運転傾向：速度超過では表現せず、加速度・車間・発進の機敏さで差をつける（目標速度の上限は制限速度）
const STYLES = [
  { name: '慎重', f: 0.9, T: 1.9, ak: 0.75, bk: 0.85, react: 0.9 },
  { name: '標準', f: 0.97, T: 1.45, ak: 1.0, bk: 1.0, react: 0.5 },
  { name: 'やや速い', f: 1.0, T: 1.1, ak: 1.25, bk: 1.15, react: 0.25 }
];
// v0.5：ひときわ速い個体（7%：制限の1.3〜1.6倍）と、ごく稀な煽り運転型（1.5%：車間を半分まで詰める・パッシング／短いクラクション。衝突はしない）
const FAST = { name: '特に速い', f: 1.45, T: 1.0, ak: 1.6, bk: 1.25, react: 0.2, fast: 1 };
const TAIL = { name: '煽り', f: 1.12, T: 0.7, ak: 1.4, bk: 1.3, react: 0.2, tail: 1 };
export const STYLE_RATE = { fast: 0.07, tail: 0.015 };
function pickStyle(R) { const x = R(); return x < STYLE_RATE.tail ? TAIL : x < STYLE_RATE.tail + STYLE_RATE.fast ? FAST : STYLES[R() * 3 | 0]; }
// 地区別の走行中NPC目標台数（プレイヤー周辺）
export const ZONE_TARGET = { center: 32, res: 19, sub: 12, farm: 8, mtn: 3, gak: 20, nt: 15 };
// 自転車・原付（道路の左端を走る。駐車場には入らない）
export const BIKE_M = { id: -2, name: '自転車', cat: 'bike', L: 1.8, W: 0.6, H: 1.7, acc: 0.7, vmax: 5.2, colors: [{ rgb: [0.85, 0.85, 0.85] }, { rgb: [0.2, 0.3, 0.6] }, { rgb: [0.7, 0.15, 0.2] }, { rgb: [0.15, 0.15, 0.15] }], cw: [3, 2, 2, 2] };
export const MOTO_M = { id: -3, name: '原付スクーター', cat: 'moto', L: 1.9, W: 0.7, H: 1.6, acc: 1.6, vmax: 8.3, plate: 'k', colors: [{ rgb: [0.85, 0.1, 0.1] }, { rgb: [0.95, 0.95, 0.95] }, { rgb: [0.15, 0.15, 0.18] }, { rgb: [0.2, 0.45, 0.8] }], cw: [2, 3, 3, 2] };

export class Traffic {
  constructor(city, R) {
    this.city = city; this.R = R; this.cars = []; this.byEdge = new Map(); this.base = 1; this.perfK = 1; this.nextId = 1;
    this.stats = { spawned: 0, parkedNow: 0 };
    this.initSpecial();
  }
  timeFactor(h) {
    if (h < 5) return 0.3; if (h < 7) return 0.6; if (h < 9) return 1.0; if (h < 16) return 0.75; if (h < 19) return 1.0; if (h < 22) return 0.6; return 0.4;
  }
  // ---- 駅前ロータリー（常駐） ----
  initSpecial() {
    const city = this.city;
    for (const lp of city.loops) lp.cars.forEach((d, i) => {
      const n = lp.pts.length, k = Math.floor(i * n / lp.cars.length), p = lp.pts[k];
      const c = { id: this.nextId++, m: d.m, tint: d.rgb, x: p[0], z: p[1], y: 0, yaw: 0, v: 0, st: 'loop', loop: lp, li: (k + 1) % n, persist: true, stuck: 0, ghost: 0, hitT: 0, wink: 0, brake: false, dwell: 0, drv: { f: 1, T: 1.4, a: 1.5, b: 3 } };
      c.taxi = d.m.name === 'クラウン'; c.plate = c.taxi ? { cls: 'g500', i: i } : this.plateFor(d.m);
      this.cars.push(c);
    });
  }
  mk(m, col, e, k, s, st) {
    const city = this.city, p = city.lanePos(e, k, s);
    const c = {
      id: this.nextId++, m, col, tint: col.rgb, x: p[0], z: p[1], y: city.yAt(e, s), yaw: city.headAt(e, s), v: 0, st: 'lane', e: e.id, k, s, lat: 0,
      drv: { f: st.fast ? 1.3 + this.R() * 0.3 : Math.min(1, st.f * (0.97 + this.R() * 0.03)) * (st.tail ? 1.12 : 1), T: st.T, fast: !!st.fast, tail: !!st.tail, a: m.acc * st.ak, b: 3.0 * st.bk, style: st.name, react: st.react }, stuck: 0, hitT: 0, wink: 0, brake: false, plate: this.plateFor(m)
    };
    return c;
  }
  // ナンバー：分類ごとに番号の空きから割り当て、同時に表示される車で重複させない
  plateFor(m) {
    const cls = m.taxi ? 'g500' : plateClass(m);
    const n = (PLATES[cls] || 1) * 8;
    const used = new Set(this.cars.filter(c => c.plate && c.plate.cls === cls).map(c => c.plate.i));
    let i = (this.nextId * 7) % n; for (let k = 0; k < n && used.has(i); k++) i = (i + 1) % n;
    return { cls, i };
  }
  // ---- 経路 ----
  plan(c, avoid) {
    const city = this.city, e = city.edges[c.e], node = city.nodes[e.to];
    if (c.parkPlan && c.parkPlan.slot.occ === c) c.parkPlan.slot.occ = null;
    c.conn = null; c.committed = false; c.stopDone = false; c.stopT = 0; c.parkPlan = null;
    let opts = node.out.map(i => city.edges[i]).filter(o => o.id !== e.rev && o.id !== avoid);
    if (!opts.length) opts = e.rev != null ? [city.edges[e.rev]] : city.nodes[e.to].out.map(i => city.edges[i]);
    const turnOf = o => { const cr = e.dEnd[0] * o.d[1] - e.dEnd[1] * o.d[0]; return Math.abs(cr) < 0.3 ? 0 : cr > 0 ? 1 : -1; };
    const tk = c.m.cat === 'trk' && c.m.L > 5.5 && !c.m.semi;
    const w = opts.map(o => (turnOf(o) === 0 ? 0.5 : 0.25) * (0.35 + o.dens) * (tk && o.lots.some(l => l.truck) ? 5 : 1)); // トラックは荷捌き場のある道へ曲がりやすい
    let t = w.reduce((a, b) => a + b, 0), x = this.R() * t, pick = opts[0];
    for (let i = 0; i < opts.length; i++) { x -= w[i]; if (x <= 0) { pick = opts[i]; break; } }
    const turn = turnOf(pick);
    const k2 = turn > 0 ? 0 : turn < 0 ? pick.lanes - 1 : Math.min(c.k, pick.lanes - 1);
    c.next = { e: pick.id, k: k2, turn };
    if (!avoid && e.lots.length && c.m.cat !== 'bike' && c.m.cat !== 'moto' && c.s < 10) {
      const lot = e.lots[this.R() * e.lots.length | 0];
      // 荷捌き場（工業団地）は中・大型トラックだけ、普通の駐車場は乗用車・軽トラなど
      // 修正84：用途・営業時間・枠の寸法を照合（店舗は営業時間内だけ、乗用車だけ、2.6m×5mに収まる車だけ）
      const h = this.hour ?? 12, k = lot.kind, open = k === 'conv' ? true : k === 'staff' ? h >= 6 && h < 21 : k === 'dock' ? h >= 5 && h < 23 : h >= 8 && h < 21;
      const okT = !open ? false : lot.truck ? (c.m.cat === 'trk' && c.m.L > 5.5 && c.m.L < 12.5 && !c.m.semi) : (!isCommercial(c.m) || (k === 'staff' && c.m.plate === 'k')) && c.m.L <= 4.95 && c.m.W <= 2.3;
      const free = okT && this.R() < (lot.truck ? 0.65 : 0.22) ? lot.slots.filter(s => !s.occ) : [];
      if (free.length && lot.sE - c.s > 25) { const sl = free[this.R() * free.length | 0]; sl.occ = c; c.parkPlan = { lot, slot: sl }; }
    }
  }
  getConn(c) {
    if (c.conn && c.conn.k === c.k) return c.conn;
    if (!c.next) return null;
    const city = this.city, e = city.edges[c.e], e2 = city.edges[c.next.e];
    const p0 = city.lanePos(e, c.k, e.len), p2 = city.lanePos(e2, c.next.k, 0), d1 = e.dEnd, d2 = e2.d;
    let p1;
    const den = d1[0] * d2[1] - d1[1] * d2[0];
    if (Math.abs(den) < 0.2) p1 = [(p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2];
    else { const t = ((p2[0] - p0[0]) * d2[1] - (p2[1] - p0[1]) * d2[0]) / den; p1 = [p0[0] + d1[0] * t, p0[1] + d1[1] * t]; }
    const tab = [0]; let prev = p0, len = 0;
    for (let i = 1; i <= 12; i++) { const q = bez(p0, p1, p2, i / 12); len += Math.hypot(q[0] - prev[0], q[1] - prev[1]); tab.push(len); prev = q; }
    c.conn = { p0, p1, p2, len, tab, k: c.k, wait: len * 0.3, y: city.yAt(e, e.len) };
    if (c.next.turn > 0) {
      const n = city.nodes[e.to], lx = d1[1], lz = -d1[0];
      for (let d = 0; d < len; d += 0.5) {
        const q = this.connAt(c.conn, d);
        if ((q[0] - n.x) * lx + (q[1] - n.z) * lz < 1.05) { c.conn.wait = Math.max(0, d - c.m.L * 0.42); break; }
      }
    }
    return c.conn;
  }
  connAt(cn, d) {
    d = clamp(d, 0, cn.len);
    let i = 1; while (i < 12 && cn.tab[i] < d) i++;
    const t = (i - 1 + (d - cn.tab[i - 1]) / Math.max(1e-6, cn.tab[i] - cn.tab[i - 1])) / 12;
    const p = bez(cn.p0, cn.p1, cn.p2, t), q = bez(cn.p0, cn.p1, cn.p2, Math.min(1, t + 0.02)), r = bez(cn.p0, cn.p1, cn.p2, Math.max(0, t - 0.02));
    return [p[0], p[1], Math.atan2(q[0] - r[0], q[1] - r[1])];
  }
  pathPoint(c, d) {
    const city = this.city;
    if (c.st === 'lane') {
      const e = city.edges[c.e], s = c.s + d;
      if (s <= e.len || !c.next) return city.lanePos(e, c.k, Math.min(s, e.len), c.lat + (c.side || 0));
      const cn = this.getConn(c), r = s - e.len;
      if (r <= cn.len) return this.connAt(cn, r);
      return city.lanePos(city.edges[c.next.e], c.next.k, r - cn.len);
    }
    if (c.st === 'inter') {
      const cn = c.conn, r = c.d + d;
      if (r <= cn.len) return this.connAt(cn, r);
      const e2 = city.edges[c.next.e];
      return city.lanePos(e2, c.next.k, Math.min(r - cn.len, e2.len));
    }
    return [c.x + Math.sin(c.yaw) * d, c.z + Math.cos(c.yaw) * d];
  }
  // ---- 生成・削除 ----
  spawn(px, pz, planes) {
    const city = this.city, R = this.R, C = this.cand || [];
    if (!C.length) return null;
    for (let tries = 0; tries < 12; tries++) {
      const [e, s0] = C[R() * C.length | 0];
      if (R() > e.dens * 1.5 + 0.15) continue;
      const s = clamp(s0 + (R() - 0.5) * 30, 8, Math.max(8, e.len - 20)), k = R() * e.lanes | 0;
      const p = city.lanePos(e, k, s), y = city.yAt(e, s);
      const d = Math.hypot(p[0] - px, p[1] - pz);
      if (d < 45 || d > 300) continue;
      if (d < (this.drawDist || 380) && M4.sphereIn(planes, p[0], y + 1, p[1], 4)) continue; // 視界内には出現させない
      if (this.cars.some(o => (o.x - p[0]) ** 2 + (o.z - p[1]) ** 2 < 144)) continue;
      const kd = e.sp.kind, two = R(), small = ['minor', 'out', 'ring', 'shop', 'gak', 'nt', 'ntc', 'kaido'].includes(kd) && this.zone !== 'mtn';
      // 二輪：住宅地・学園地区で多く（登下校の時間帯はさらに増える）。夜は商用車（配送・物流）の比率が上がる
      const hr = this.hour ?? 12, school = (hr > 7 && hr < 9.5) || (hr > 15.5 && hr < 18.5), night = hr >= 22 || hr < 5;
      const bikeP = night ? 0.03 : (this.zone === 'gak' ? 0.28 : this.zone === 'nt' || this.zone === 'res' || this.zone === 'center' ? 0.16 : 0.1) * (school ? 1.5 : 1), motoP = night ? 0.05 : 0.1;
      const truckK = (this.zone === 'ind' || kd === 'nat' || kd === 'byp' ? 4.5 : this.zone === 'farm' ? 1.5 : this.zone === 'nt' || this.zone === 'gak' ? 0.5 : 1) * (night ? 3.5 : 1);
      const m = (small || kd === 'art') && two < bikeP * (small ? 1 : 0.4) ? BIKE_M : (small || kd === 'art' || kd === 'nat') && two < bikeP + motoP ? MOTO_M : this.pickM(R, truckK, kd), col = pickColor(m, R), st = (m.cat === 'bike' || m.cat === 'moto') ? STYLES[1] : pickStyle(R);
      const two2 = m.cat === 'bike' || m.cat === 'moto';
      const c = this.mk(m, col, e, two2 ? e.lanes - 1 : k, s, st);
      if (two2) { c.side = Math.min(0.55, e.lw * 0.5 - 0.7); c.drv.f = 1; this.stats.twoWheel = (this.stats.twoWheel || 0) + 1; this.stats[m.cat] = (this.stats[m.cat] || 0) + 1; }
      if (c.drv.fast) this.stats.fast = (this.stats.fast || 0) + 1; if (c.drv.tail) this.stats.tail = (this.stats.tail || 0) + 1;
      c.v = Math.min(e.lim / 3.6 * c.drv.f, m.vmax, city.vcAt(e, s)) * 0.7;
      this.plan(c);
      this.cars.push(c); this.stats.spawned++;
      return c;
    }
    return null;
  }
  // セミトレーラーは国道・バイパス・工業団地だけに出す
  pickM(R, truckK, kd) { if (this.zone === 'ind' && R() < 0.4) { const T = this.indTrucks || (this.indTrucks = MODELS.filter(m => m.cat === 'trk' && m.L > 5.5 && m.L < 12.5 && !m.semi)); return T[R() * T.length | 0]; } // 工業団地は中・大型トラックを多めに
    for (let k = 0; k < 8; k++) { const m = pickModel(R, truckK, true); if (!m.semi || kd === 'nat' || kd === 'byp' || this.zone === 'ind') return m; } return pickModel(R, 0); }
  remove(c) {
    if (c.parkPlan && c.parkPlan.slot.occ === c) c.parkPlan.slot.occ = null;
    if (c.parkPlan && c.parkPlan.lot.gate === c) c.parkPlan.lot.gate = null;
    const i = this.cars.indexOf(c); if (i >= 0) this.cars.splice(i, 1);
  }
  // ---- 更新 ----
  update(dt, T, hour, player, env, planes) {
    const city = this.city, px = player.x, pz = player.z;
    this.hour = hour; this.T = T;
    this.wet = env.wet || 0;
    // 地区別の目標台数（走行中のみ数える）×時間帯×設定×性能（性能による削減は50%まで）
    if (!this.areaT || Math.abs(T - this.areaT) > 1) {
      this.areaT = T; const C = [];
      for (const e of city.edges) {
        if (!e.samp) { e.samp = []; for (let s = 0; s <= e.len; s += 20) e.samp.push([s, city.lanePos(e, 0, s)]); }
        for (const [s, p] of e.samp) { const d2 = (p[0] - px) ** 2 + (p[1] - pz) ** 2; if (d2 > 50 * 50 && d2 < 300 * 300) C.push([e, s]); }
      }
      this.cand = C;
      this.zone = city.zoneClass ? city.zoneClass(px, pz) : 'center';
    }
    const zt = ZONE_TARGET[this.zone === 'ind' ? 'sub' : this.zone] || 12;
    this.zoneTarget = Math.round(zt * this.timeFactor(hour) * this.base);
    this.target = Math.max(1, Math.round(this.zoneTarget * Math.max(0.5, this.perfK)));
    const moving = this.cars.filter(c => c.st !== 'park' && !c.persist).length;
    this.moving = moving;
    if (moving < this.target) { this.spawn(px, pz, planes); if (moving < this.target - 6) this.spawn(px, pz, planes); }
    for (const c of [...this.cars]) {
      if (c.persist) continue;
      const d2 = (c.x - px) ** 2 + (c.z - pz) ** 2;
      const vis = M4.sphereIn(planes, c.x, c.y + 1, c.z, 3);
      // 再計画でも解けない立ち往生は、視界外かつ150m以遠でのみ消す
      // 消去は「視界外」かつ十分遠い場合だけ（描画距離＋100m、最低450m）。視界内でも描画距離のずっと先（＋300m）なら消す
      const far = Math.max(450, (this.drawDist || 380) + 100);
      if ((!vis && d2 > far * far) || d2 > (far + 300) ** 2 || (moving > this.target + 6 && d2 > 160 * 160 && !vis) || (c.stuck > 60 && !vis && d2 > 150 * 150)) this.remove(c);
    }
    this.byEdge.clear();
    const add = (id, o) => { let a = this.byEdge.get(id); if (!a) this.byEdge.set(id, a = []); a.push(o); };
    for (const c of this.cars) {
      if (c.st === 'lane') add(c.e, c);
      else if ((c.st === 'wp' || c.st === 'join') && c.parkPlan && (c.st === 'join' || (!c.exiting && c.wi < 2))) {
        const e = c.parkPlan.lot.edge, s = (c.x - e.x0) * e.d[0] + (c.z - e.z0) * e.d[1];
        add(e.id, { s, k: e.lanes - 1, v: 0, m: c.m, proxy: c });
      }
    }
    const ob = this.cars.map(c => ({ c, x: c.x, z: c.z, y: c.y, fx: Math.sin(c.yaw), fz: Math.cos(c.yaw), hl: c.m.L / 2 - c.m.W / 2, r: c.m.W / 2, v: c.v }));
    ob.push({ c: player, x: px, z: pz, y: player.y, fx: Math.sin(player.yaw), fz: Math.cos(player.yaw), hl: 1.0, r: 0.74, v: Math.abs(player.vx), player: true });
    this.ob = ob;
    this.blink = (T % 0.8) < 0.4;
    let parked = 0;
    for (const c of this.cars) {
      const near = (c.x - px) ** 2 + (c.z - pz) ** 2 < 140 * 140;
      if (c.st === 'park') { parked++; this.updPark(c, dt); continue; }
      if (c.st === 'wp') { this.updWp(c, dt); continue; }
      if (c.st === 'join') { this.updJoin(c, dt, player); continue; }
      if (c.st === 'loop') { this.updLoop(c, dt); continue; }
      this.updDrive(c, dt, T, near, env, player);
    }
    this.stats.parkedNow = parked;
  }
  idm(c, v, v0, gap, dv, s0) {
    const a = c.drv.a, b = c.drv.b;
    const free = 1 - Math.pow(v / Math.max(v0, 0.1), 4);
    if (gap === Infinity) return a * free;
    const ss = s0 + Math.max(0, v * c.drv.T + v * dv / (2 * Math.sqrt(a * b)));
    return a * (free - (ss / Math.max(gap, 0.05)) ** 2);
  }
  sense(c, look) {
    let best = Infinity, vl = 0, pl = false;
    const W2 = c.m.W / 2, step = 1.5, d0 = c.m.L / 2 + 0.4;
    const cand = [];
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    for (const o of this.ob) {
      if (o.c === c || Math.abs(o.y - c.y) > 3) continue;
      const dx = o.x - c.x, dz = o.z - c.z, dd = dx * dx + dz * dz;
      if (dd > (look + o.hl + 8) ** 2) continue;
      if (dx * fx + dz * fz < -1 - o.hl) continue;
      cand.push(o);
    }
    if (!cand.length) return { gap: Infinity, vl: 0 };
    for (let d = d0; d < look; d += step) {
      const p = this.pathPoint(c, d);
      for (const o of cand) {
        const ax = o.x - o.fx * o.hl, az = o.z - o.fz * o.hl, bx = o.x + o.fx * o.hl, bz = o.z + o.fz * o.hl;
        const vx = bx - ax, vz = bz - az, t = clamp(((p[0] - ax) * vx + (p[1] - az) * vz) / Math.max(1e-6, vx * vx + vz * vz), 0, 1);
        const qx = ax + vx * t - p[0], qz = az + vz * t - p[1];
        if (qx * qx + qz * qz < (o.r + W2 * 0.75) ** 2) {
          const g = d - c.m.L / 2 - 0.2;
          if (g < best) { best = g; vl = o.v * (o.fx * fx + o.fz * fz); pl = !!o.player; }
        }
      }
      if (best < Infinity) break;
    }
    return { gap: Math.max(0, best), vl, player: pl };
  }
  laneFree(e, k, s, self) {
    const a = this.byEdge.get(e.id); if (!a) return true;
    for (const o of a) {
      if (o === self || o.proxy === self || o.k !== k) continue;
      const half = 0, vs = self.v, vo = o.v || 0;
      if (o.s <= s && s - o.s < 9 + half + Math.max(0, vo - vs) * 2.5) return false;
      if (o.s > s && o.s - s < 11 + half + Math.max(0, vs - vo) * 2) return false;
    }
    return true;
  }
  crossClear(node, axis, self) {
    for (const o of this.ob) {
      if (o.c === self) continue;
      const dx = o.x - node.x, dz = o.z - node.z;
      if (Math.abs(dx) < node.hx + 0.5 && Math.abs(dz) < node.hz + 0.5 && Math.abs(o.y - self.y) < 3) return false;
      const d = Math.hypot(dx, dz); if (d > 32 || o.v < 1) continue;
      const along = axis === 'ns' ? Math.abs(o.fx) > 0.7 : Math.abs(o.fz) > 0.7;
      if (along && (dx * o.fx + dz * o.fz) < 0) return false;
    }
    return true;
  }
  oncoming(c, node, e) {
    const d = e.dEnd;
    for (const o of this.ob) {
      if (o.c === c) continue;
      const dx = o.x - node.x, dz = o.z - node.z;
      const ahead = dx * d[0] + dz * d[1];
      if (ahead < 0 || ahead > 42) continue;
      if (Math.abs(dx * d[1] - dz * d[0]) > 8) continue;
      if (o.fx * d[0] + o.fz * d[1] > -0.7 || o.v < 1.2) continue;
      if (!o.player && o.c.st === 'inter' && o.c.next && o.c.next.turn > 0) continue;
      return true;
    }
    return false;
  }
  updDrive(c, dt, T, near, env, player) {
    const city = this.city, m = c.m;
    let e = city.edges[c.e];
    let v0 = Math.min(e.lim / 3.6 * c.drv.f, m.vmax) * env.speedK;
    if (e.work && c.st === 'lane' && c.s > e.work[0] - 25 && c.s < e.work[1]) v0 = Math.min(v0, 4.2); // 工事区間は徐行
    let acc = Infinity, waiting = false;
    const apply = (gap, dv, s0) => { const a = this.idm(c, c.v, v0, gap, dv, s0); if (a < acc) acc = a; };
    if (c.st === 'lane') {
      // カーブ手前の減速
      if (e.vc) for (const ah of [0, 10, 22, 36, 52]) { const vc = city.vcAt(e, c.s + ah) * (1 - 0.18 * this.wet) * clamp(6.5 / Math.max(5, m.L), 0.7, 1); v0 = Math.min(v0, Math.sqrt(vc * vc + 2 * 2.2 * ah)); }
      // 車線：右左折・駐車の準備＞追い越し中＞原則左車線
      if (c.ovT > 0) c.ovT -= dt;
      let want = c.parkPlan ? e.lanes - 1 : c.next.turn > 0 ? 0 : c.next.turn < 0 ? e.lanes - 1 : c.ovT > 0 ? c.k : e.lanes - 1;
      // 片側3車線：交差点の手前70mでは中央寄りの車線を右折待ち用に空ける（直進・左折は外側2車線）
      if (e.lanes >= 3 && c.next && c.next.turn <= 0 && e.len - c.s < 70 && want === 0) want = 1;
      if (c.drv.fast && e.lanes > 1 && c.next && c.next.turn === 0 && e.len - c.s > 70) { const sn = this.sense(c, 40); if (sn.gap < 35 && sn.vl < v0 * 0.9 && c.k > 0) { want = c.k - 1; c.ovT = 6; } }
      if (e.lanes > 1 && c.next.turn === 0 && !c.parkPlan && c.k > 0 && near && c.s < e.len - 70) {
        const sn = this.sense(c, 30);
        if (sn.gap < 25 && sn.vl < v0 * 0.85 && sn.vl < c.v + 0.5 && !(e.lanes >= 3 && c.k - 1 === 0 && e.len - c.s < 90)) { want = c.k - 1; c.ovT = 8; }
      }
      if (want !== c.k && c.s < e.len - 10 && Math.abs(c.lat) < 0.2 && this.laneFree(e, want, c.s, c)) { c.lat = (c.k - want) * e.lw; c.k = want; c.conn = null; }
      c.lat -= Math.sign(c.lat) * Math.min(Math.abs(c.lat), 1.1 * dt);
      const toEnd = e.len - c.s - m.L / 2;
      const lk = clamp(5.5 / Math.max(5, m.L), 0.5, 1); // 長い車ほど交差点・カーブで遅く
      if (c.next && c.next.turn !== 0) v0 = Math.min(v0, Math.sqrt(((c.next.turn > 0 ? 4.2 : 5.0) * lk) ** 2 + 2 * 1.2 * Math.max(0, toEnd)));
      // 交差点の先に自車1台分の空きがなければ停止線で待つ（交差点内で固まるのを防ぐ）
      if (c.next && toEnd < 12 && !c.boxOK) {
        const e2 = city.edges[c.next.e], room = m.L + 3; let occ = false;
        for (const o of this.byEdge.get(e2.id) || []) if (o.k === c.next.k && o.s < room && o !== c) { occ = true; break; }
        if (!occ) for (const o of this.cars) if (o !== c && o.st === 'inter' && o.next && o.next.e === e2.id && o.next.k === c.next.k && o.v < 1) { occ = true; break; }
        if (occ) { apply(Math.max(0, toEnd - 0.6), c.v, 0.4); waiting = true; } else if (toEnd < 2) c.boxOK = true;
      }
      if (c.parkPlan) {
        const pp = c.parkPlan, toLot = pp.lot.sE - 7 - c.s;
        v0 = Math.min(v0, Math.sqrt(3 ** 2 + 2 * 1.4 * Math.max(0, toLot)));
        if (toLot < 1) {
          if (c.k === e.lanes - 1 && c.v < 5) { this.enterLot(c); return; }
          pp.slot.occ = null; c.parkPlan = null;
        }
      }
      if (e.ctrl === 'signal' && !c.committed) {
        const sg = city.sig(city.nodes[e.to], e.axis, T);
        if (sg === 'g') { if (toEnd < 2) c.committed = true; }
        else {
          const stopD = c.v * c.v / (2 * 3.6);
          if (sg === 'y' && stopD > toEnd - 0.5 && toEnd < 25) c.committed = true;
          else { apply(Math.max(0, toEnd - 0.6), c.v, 0.4); waiting = true; }
        }
      } else if (e.ctrl === 'stop' && !c.stopDone) {
        apply(Math.max(0, toEnd - 0.4), c.v, 0.3); waiting = true;
        if (toEnd < 2.0 && c.v < 0.4) { c.stopT += dt; if (c.stopT > 1.0 && this.crossClear(city.nodes[e.to], e.axis, c)) c.stopDone = true; }
      }
      if (near) { const sn = this.sense(c, Math.min(42, 8 + c.v * 2.6)); if (sn.gap < Infinity) { apply(sn.gap, c.v - sn.vl, c.drv.tail ? 2.5 : 2.0);
        if (c.drv.tail && sn.gap < 9 && c.v > 6 && sn.vl < c.v + 0.3) { c.tailT = (c.tailT || 0) + dt; if (c.tailT > 4 && !c.flashT) { c.flashT = 1.2; c.tailT = -6; if (sn.player || this.R() < 0.3) (this.events = this.events || []).push({ t: this.R() < 0.5 ? 'horn' : 'flash', x: c.x, z: c.z, player: !!sn.player }); } } } }
      else {
        const a = this.byEdge.get(c.e); let best = null;
        if (a) for (const o of a) if (o !== c && o.k === c.k && o.s > c.s && (!best || o.s < best.s)) best = o;
        if (best) apply(best.s - c.s - (best.m.L + m.L) / 2, c.v - best.v, 2.0);
      }
    } else {
      const cn = c.conn;
      if (c.next.turn !== 0) v0 = Math.min(v0, (c.next.turn > 0 ? 4.2 : 5.2) * clamp(5.5 / Math.max(5, m.L), 0.5, 1)); // 右折は左折より慎重に。大型はさらに遅く
      if (c.next.turn > 0 && !c.goRight) {
        if (this.oncoming(c, city.nodes[e.to], e)) { if (c.d < cn.wait + 0.5) { apply(Math.max(0, cn.wait - c.d), c.v, 0.2); waiting = true; } }
        else if (c.d > cn.wait - 1.5) c.goRight = true;
      }
      { const sn = this.sense(c, Math.min(30, 8 + c.v * 2.4)); if (sn.gap < Infinity) apply(sn.gap, c.v - sn.vl, 1.6); }
    }
    // 横断中の歩行者の手前では止まる
    if (this.peds && c.v > 0.05 || (this.peds && c.st === 'inter')) for (const q of this.peds.list) { if (!q.onRoad) continue; const dx = q.x - c.x, dz = q.z - c.z, f = dx * Math.sin(c.yaw) + dz * Math.cos(c.yaw), lat = Math.abs(dx * Math.cos(c.yaw) - dz * Math.sin(c.yaw)); if (f > 0 && f < 14 + c.v * 1.2 && lat < c.m.W / 2 + 1.2) { apply(Math.max(0, f - c.m.L / 2 - 2.5), c.v, 0.5); waiting = true; } }
    if (c.hitT > 0) { c.hitT -= dt; acc = -8; waiting = true; if (c.hazard > 0) c.hazard -= dt; }
    if (acc === Infinity) acc = this.idm(c, c.v, v0, Infinity, 0, 2);
    // 坂道（上りでわずかに加速が鈍る）
    acc = clamp(acc, -8.5, c.drv.a * (1 - clamp(c.slope || 0, -0.1, 0.1) * 3));
    c.brake = acc < -0.6 || c.v < 0.2;
    c.v = Math.max(0, c.v + acc * dt);
    // 立ち往生：30秒で経路を再計画（次の交差点で別方向へ）
    if (c.v < 0.1) { c.stuck += dt; if (c.stuck > 30 && !c.replanned && c.st === 'lane' && c.next) { const old = c.next.e; this.plan(c, old); c.replanned = true; } } else if (c.v > 0.5) { c.stuck = 0; c.replanned = false; }
    // 発進の遅れ（慎重な人ほどゆっくり）
    if (c.v < 0.05 && acc > 0) { c.startT = (c.startT || 0) + dt; if (c.startT < c.drv.react) acc = 0; } else if (c.v > 0.5) c.startT = 0;
    let px, pz, hy, entered = false;
    if (c.st === 'lane' && c.hitT > 0 && Math.hypot(c.x - player.x, c.z - player.z) < c.m.L / 2 + 2.2) c.s = Math.max(0, c.s - 1.2 * dt); // 押されたら少し下がる
    if (c.st === 'lane') {
      c.s += c.v * dt;
      if (c.s >= e.len && c.next) { this.getConn(c); c.st = 'inter'; c.d = c.s - e.len; c.goRight = false; entered = true; }
      else {
        c.s = Math.min(c.s, e.len);
        const p = city.lanePos(e, c.k, c.s, c.lat + (c.side || 0)); px = p[0]; pz = p[1];
        hy = city.headAt(e, c.s) + (c.v > 0.5 && Math.abs(c.lat) > 0.01 ? clamp(-Math.sign(c.lat) * 1.1 / Math.max(c.v, 2), -0.2, 0.2) : 0);
        const y0 = city.yAt(e, c.s); c.slope = (city.yAt(e, c.s + 2) - city.yAt(e, c.s - 2)) / 4; c.y = y0;
      }
    }
    if (c.st === 'inter') {
      if (!entered) c.d += c.v * dt;
      const cn = c.conn;
      if (c.d >= cn.len) {
        const r = c.d - cn.len;
        c.e = c.next.e; c.k = c.next.k; c.s = r; c.lat = 0; c.st = 'lane'; c.boxOK = false;
        e = city.edges[c.e]; this.plan(c);
        const p = city.lanePos(e, c.k, c.s); px = p[0]; pz = p[1]; hy = city.headAt(e, c.s); c.y = city.yAt(e, c.s);
      } else { const p = this.connAt(cn, c.d); px = p[0]; pz = p[1]; hy = p[2]; c.y = cn.y; c.slope = 0; }
    }
    if (c.flashT > 0) c.flashT -= dt;
    if (m.semi) { // セミトレーラー：トラクタの後輪はけん引されるように内側を通り、トレーラーの車軸はキングピンにけん引される（連結角が付く）
      const S = m.semi, front = m.L / 2 - 1.2, fx = px + Math.sin(hy) * front, fz = pz + Math.cos(hy) * front, wb = m.wb;
      if (!c.rear || Math.hypot(c.rear[0] - fx, c.rear[1] - fz) > wb * 1.6) { c.rear = [fx - Math.sin(hy) * wb, fz - Math.cos(hy) * wb]; c.trlA = null; }
      let dx = fx - c.rear[0], dz = fz - c.rear[1]; let l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; c.rear = [fx - dx * wb, fz - dz * wb];
      const kx = c.rear[0] + dx * 0.3, kz = c.rear[1] + dz * 0.3, kwb = S.kwb;
      if (!c.trlA || Math.hypot(c.trlA[0] - kx, c.trlA[1] - kz) > kwb * 1.5) c.trlA = [kx - dx * kwb, kz - dz * kwb];
      let ex = kx - c.trlA[0], ez = kz - c.trlA[1]; l = Math.hypot(ex, ez) || 1; ex /= l; ez /= l; c.trlA = [kx - ex * kwb, kz - ez * kwb];
      const ty = Math.atan2(dx, dz), ky = Math.atan2(ex, ez), tc = S.tL / 2 - 1.2 - wb / 2; // トラクタ中心（前輪と後輪の中点からの前方オフセット）
      c.tr = { x: (fx + c.rear[0]) / 2 + dx * tc, z: (fz + c.rear[1]) / 2 + dz * tc, yaw: ty };
      c.trl = { x: kx - ex * (S.kL / 2 - S.kf), z: kz - ez * (S.kL / 2 - S.kf), yaw: ky };
      c.art = angDiff(ty, ky);
      // 全体の中心（追従・当たり判定の基準）は先端と後端の中点
      const tail = [kx - ex * (S.kL - S.kf), kz - ez * (S.kL - S.kf)], tip = [fx + dx * 1.2, fz + dz * 1.2];
      c.x = (tip[0] + tail[0]) / 2; c.z = (tip[1] + tail[1]) / 2; c.yaw = Math.atan2(tip[0] - tail[0], tip[1] - tail[1]);
    } else if (m.L > 5.5) { // 内輪差：前輪の位置を経路に乗せ、後輪はけん引されるように内側を通る（向きの変化は自然に車長で制限される）
      const wb = m.L * 0.62, fx = px + Math.sin(hy) * wb * 0.5, fz = pz + Math.cos(hy) * wb * 0.5;
      if (!c.rear || Math.hypot(c.rear[0] - fx, c.rear[1] - fz) > wb * 1.6) c.rear = [fx - Math.sin(hy) * wb, fz - Math.cos(hy) * wb];
      let dx = fx - c.rear[0], dz = fz - c.rear[1]; const l = Math.hypot(dx, dz) || 1; c.rear = [fx - dx / l * wb, fz - dz / l * wb];
      c.x = (fx + c.rear[0]) / 2; c.z = (fz + c.rear[1]) / 2; c.yaw = Math.atan2(dx, dz);
    } else {
    c.x = px; c.z = pz;
    const dy = angDiff(c.yaw, hy);
    c.yaw += clamp(dy, -3.0 * dt, 3.0 * dt);
    if (Math.abs(dy) < 0.4) c.yaw += dy * Math.min(1, dt * 8);
    }
    const toEnd2 = c.st === 'lane' ? e.len - c.s : 0;
    c.wink = c.parkPlan ? (c.parkPlan.lot.sE - c.s < 30 ? -1 : 0) : c.next && (c.st === 'inter' || toEnd2 < 35) ? c.next.turn : 0;
    if (Math.abs(c.lat) > 0.3 && c.st === 'lane') c.wink = c.lat > 0 ? 1 : -1;
  }
  updLoop(c, dt) {
    const lp = c.loop, n = lp.pts.length;
    if (c.dwell > 0) { c.dwell -= dt; c.v = 0; c.brake = true; c.wink = -1; return; }
    const w = lp.pts[c.li], dx = w[0] - c.x, dz = w[1] - c.z, dist = Math.hypot(dx, dz);
    let vt = lp.vt || 4.2;
    for (const o of this.ob) {
      if (o.c === c) continue;
      const ox = o.x - c.x, oz = o.z - c.z, od = Math.hypot(ox, oz);
      if (od < c.m.L / 2 + o.hl + 3 && (ox * Math.sin(c.yaw) + oz * Math.cos(c.yaw)) > od * 0.6) { vt = 0; break; }
    }
    c.v += clamp(vt - c.v, -5 * dt, 1.5 * dt); c.v = Math.max(0, c.v); c.brake = c.v < 0.3;
    const step = c.v * dt;
    if (dist > 0.01) { const ty = Math.atan2(dx, dz); c.yaw += clamp(angDiff(c.yaw, ty), -1.2 * dt, 1.2 * dt); if (Math.abs(angDiff(c.yaw, ty)) > 1) c.yaw = ty; }
    if (step >= dist) {
      c.x = w[0]; c.z = w[1];
      if (lp.stops.includes(c.li)) c.dwell = 12 + this.R() * 25;
      c.li = (c.li + 1) % n;
    } else { c.x += dx / dist * step; c.z += dz / dist * step; }
    c.wink = 0;
  }
  // ---- 駐車場 ----
  enterLot(c) {
    const { lot, slot } = c.parkPlan, f = lot.f, e = lot.edge, city = this.city;
    const r = slot.row, aw = lot.aisle(r);
    const q = city.lanePos(e, e.lanes - 1, lot.sE - 3, 0.8);
    // バック駐車：枠を少し通り過ぎて一旦停止し、後退で枠に入る
    const away = slot.u > lot.entU ? 1 : -1;
    const curb = f.W(lot.entU, -lot.sw - 0.8), inside = f.W(lot.entU, 1.8), a1 = f.W(lot.entU, aw), a2 = lot.truck ? f.W(slot.u + away * 9, aw - 2.5) : f.W(slot.u + away * 4.2, aw - 0.6);
    c.wps = [{ x: q[0], z: q[1] }, { x: curb[0], z: curb[1] }, { x: inside[0], z: inside[1] }, { x: a1[0], z: a1[1] }, { x: a2[0], z: a2[1], pause: 1.2 }, { x: slot.x, z: slot.z, last: true, rev: true }];
    c.wi = 0; c.st = 'wp'; c.exiting = false; c.v = Math.min(c.v, 3);
  }
  updWp(c, dt) {
    const w = c.wps[c.wi];
    const dx = w.x - c.x, dz = w.z - c.z, dist = Math.hypot(dx, dz);
    if (c.pauseT > 0) { c.pauseT -= dt; c.v = 0; c.brake = true; return; }
    c.revOn = !!w.rev;
    let vt = w.rev ? 1.4 : 2.8;
    if (w.last) vt = Math.min(vt, dist * 0.9 + 0.25);
    for (const o of this.ob) {
      if (o.c === c) continue;
      const ox = o.x - c.x, oz = o.z - c.z, od = Math.hypot(ox, oz);
      if (od < c.m.L / 2 + 2.5 && dist > 0.01 && (ox * dx + oz * dz) / (od * dist + 1e-6) > 0.5 && !(o.c.st === 'park' && od > 2.6)) { vt = 0; break; }
    }
    // 駐車場の出入口は1台ずつ（入口通路の占有）
    const lot = c.parkPlan && c.parkPlan.lot;
    if (lot) {
      const need = (!c.exiting && c.wi >= 1 && c.wi <= 3) || (c.exiting && c.wi >= 1);
      if (need) {
        if (lot.gate && lot.gate !== c && this.cars.includes(lot.gate)) {
          if (!c.exiting && c.wi <= 1) { // 入口がふさがっている：入庫をあきらめて通過
            const e = this.city.edges[c.e], sNow = clamp((c.x - e.x0) * e.d[0] + (c.z - e.z0) * e.d[1], 0, e.len - 0.1), lp = this.city.lanePos(e, e.lanes - 1, sNow);
            c.parkPlan.slot.occ = null; c.parkPlan = null; c.st = 'lane'; c.k = e.lanes - 1; c.s = sNow; c.lat = Math.hypot(c.x - lp[0], c.z - lp[1]) * 0; c.conn = null;
            return;
          }
          vt = 0;
        } else lot.gate = c;
      }
      if (!c.exiting && c.wi >= 4 && lot.gate === c) lot.gate = null;
    }
    c.v += clamp(vt - c.v, -4 * dt, 1.5 * dt); c.v = Math.max(0, c.v);
    if (vt === 0 && c.v < 0.3) c.v = 0;
    c.brake = vt < c.v || c.v < 0.2;
    const step = c.v * dt;
    if (dist > 0.01) {
      const md = Math.atan2(dx, dz), ty = w.rev ? md + Math.PI : md;
      if (dist > 0.4) c.yaw += clamp(angDiff(c.yaw, ty), -Math.max(0.5, c.v / 2.6) * dt, Math.max(0.5, c.v / 2.6) * dt);
    }
    if (step >= dist) {
      c.x = w.x; c.z = w.z; c.wi++; if (w.pause) { c.pauseT = w.pause; c.v = 0; }
      if (c.wi >= c.wps.length) {
        if (!c.exiting) {
          c.st = 'park'; c.v = 0; c.revOn = false; c.yaw = c.parkPlan.slot.yaw + Math.PI;
          const k = c.parkPlan.lot.kind, R = this.R();
          c.parkT = k === 'big' ? 240 + R * 660 : k === 'conv' ? 60 + R * 120 : k === 'dock' ? 60 + R * 120 : 120 + R * 280; if (k === 'dock') this.stats.docked = (this.stats.docked || 0) + 1; // 施設別の滞在時間
        }
        else { c.st = 'join'; c.v = 0; }
      }
    } else { c.x += dx / dist * step; c.z += dz / dist * step; }
    c.wink = c.exiting ? -1 : (c.wi < 3 ? -1 : 0);
  }
  updPark(c, dt) {
    c.parkT -= dt; c.brake = false; c.wink = 0;
    if (c.parkT <= 0) {
      const { lot, slot } = c.parkPlan, f = lot.f, aw = lot.aisle(slot.row);
      // 後ろ向きに停めているので前進で出庫
      const out = f.W(slot.u, aw + 0.4), mid = f.W(lot.entU + (slot.u > lot.entU ? 2.5 : -2.5), aw), a1 = f.W(lot.entU, aw), inside = f.W(lot.entU, 1.6), curb = f.W(lot.entU, -lot.sw - 0.4);
      c.wps = [{ x: out[0], z: out[1] }, { x: mid[0], z: mid[1] }, { x: a1[0], z: a1[1] }, { x: inside[0], z: inside[1] }, { x: curb[0], z: curb[1], last: true }];
      c.wi = 0; c.st = 'wp'; c.exiting = true;
    }
  }
  updJoin(c, dt, player) {
    const { lot, slot } = c.parkPlan, e = lot.edge;
    c.brake = true; c.wink = -1;
    const a = this.byEdge.get(e.id) || [];
    // 前方（入口付近）が空いていて、後方から走ってくる車がいなければ合流（停止中の列の前には譲ってもらう）
    let clear = !a.some(o => o.proxy !== c && !(o.proxy && o.proxy.parkPlan && o.proxy.parkPlan.lot === lot) && o.k === e.lanes - 1 && ((o.s > lot.sE - 2 && o.s < lot.sE + 10) || (o.s > lot.sE - 38 && o.s <= lot.sE - 2 && o.v > 1.5)));
    const jp = this.city.lanePos(e, e.lanes - 1, lot.sE + 2);
    if (Math.hypot(player.x - jp[0], player.z - jp[1]) < 18) clear = false;
    for (const o of this.cars) if (o !== c && o.st === 'inter' && o.next && o.next.e === e.id) clear = false;
    if (clear) {
      if (lot.gate === c) lot.gate = null;
      slot.occ = null; c.parkPlan = null;
      c.st = 'lane'; c.e = e.id; c.k = e.lanes - 1; c.s = lot.sE + 1;
      const lanePt = this.city.lanePos(e, c.k, c.s);
      c.lat = Math.hypot(c.x - lanePt[0], c.z - lanePt[1]);
      c.v = 1.5; this.plan(c);
    }
  }
  carL(c, lights) {
    if (c.flashT > 0) lights = (c.flashT * 5 | 0) % 2 ? 1 : lights; // パッシング
    if (c.hazard > 0) return [lights, c.brake ? 1 : 0, this.blink ? 1 : 0, this.blink ? 1 : 0];
    return [lights, c.brake ? 1 : 0, (c.wink < 0 && this.blink) ? 1 : 0, (c.wink > 0 && this.blink) ? 1 : 0];
  }
}
