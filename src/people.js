// 人物（運転者・歩行者）と二輪車のローポリモデル、歩行者の簡易AI
// 運転者は 年代3 × 性別2 × 服装3 = 18 通りをパラメータから生成（実在人物・キャラクターではない汎用の人形）
import { rng } from './math.js?v=0.9.3';

export const AGES = ['青年', '壮年', '老人'], SEXES = ['男性', '女性'], OUTFITS = ['普段着', 'カジュアル', 'スーツ'];
const SKIN = [[0.93, 0.78, 0.66], [0.88, 0.72, 0.6], [0.85, 0.7, 0.6]];
const HAIR = [[0.12, 0.09, 0.07], [0.2, 0.15, 0.1], [0.72, 0.72, 0.7]];
function outfitCols(o, R) { // 0=普段着（落ち着いた色） 1=カジュアル（明るい色） 2=スーツ 3=作業着（工場・現場用）
  if (o === 2) return { top: [0.14, 0.17, 0.28], inner: [0.95, 0.95, 0.95], leg: [0.2, 0.21, 0.26], shoe: [0.08, 0.07, 0.06] };
  if (o === 3) return { top: [0.35, 0.42, 0.3], inner: [0.3, 0.36, 0.26], leg: [0.25, 0.28, 0.22], shoe: [0.15, 0.12, 0.1] };
  if (o === 0) { const tops = [[0.55, 0.55, 0.52], [0.72, 0.66, 0.55], [0.3, 0.35, 0.45], [0.45, 0.4, 0.35], [0.8, 0.78, 0.74]]; return { top: tops[R() * tops.length | 0], inner: [0.9, 0.9, 0.88], leg: [0.45, 0.42, 0.35], shoe: [0.3, 0.25, 0.2] }; }
  const tops = [[0.85, 0.3, 0.25], [0.25, 0.5, 0.75], [0.95, 0.92, 0.85], [0.4, 0.6, 0.4], [0.9, 0.75, 0.3], [0.55, 0.4, 0.6]];
  return { top: tops[R() * tops.length | 0], inner: [0.95, 0.95, 0.95], leg: [0.25, 0.32, 0.5], shoe: [0.85, 0.85, 0.85] };
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
// pose: 'sit'（運転席。hands=[左手, 右手]の目標位置）/ 'walk0' / 'walk1' / 'stand' / 'ride'
export function buildPerson(gb, p) {
  const R = rng((p.seed || 1) * 97 + p.age * 13 + p.sex * 7 + p.outfit), sex = p.sex, age = p.age;
  const H = p.child ? 1.2 : (sex ? 1.58 : 1.71) * (age === 2 ? 0.96 : 1), k = H / 1.7, skin = { c: SKIN[age] }, hair = { c: HAIR[age === 2 ? 2 : R() < 0.2 ? 1 : 0] };
  const C = outfitCols(p.outfit, R), top = { c: C.top }, leg = { c: C.leg }, shoe = { c: C.shoe };
  const pose = p.pose || 'stand', sit = pose === 'sit' || pose === 'ride';
  const hipY = sit ? 0 : 0.86 * k, sw = pose === 'walk0' ? 1 : pose === 'walk1' ? -1 : 0;
  const lean = sit ? -0.12 : 0.02 * Math.abs(sw) + (age === 2 && !p.child ? 0.06 : 0); // 座ると背もたれに寄りかかる。老人は少し前かがみ
  const shY = hipY + 0.5 * k, neck = [0, shY + 0.04 * k, lean * 0.5 * k], hw = (sex ? 0.17 : 0.2) * k;
  // 胴体（上着）・腰
  gb.box(-hw, hipY, -0.11 * k + lean * 0.3, hw, shY, 0.11 * k + lean * 0.3, top);
  if (p.outfit === 1) gb.box(-0.05 * k, shY - 0.18 * k, 0.11 * k + lean * 0.3, 0.05 * k, shY, 0.115 * k + lean * 0.3, { c: C.inner }); // シャツの襟元
  gb.box(-hw * 0.95, hipY - 0.1 * k, -0.11 * k, hw * 0.95, hipY + 0.02, 0.11 * k, leg);
  // 頭・髪
  const hy = shY + 0.06 * k, hz = lean * 0.6 * k;
  gb.box(-0.085 * k, hy, hz - 0.1 * k, 0.085 * k, hy + 0.22 * k, hz + 0.1 * k, skin);
  gb.box(-0.095 * k, hy + 0.15 * k, hz - 0.115 * k, 0.095 * k, hy + 0.255 * k, hz + 0.09 * k, hair);
  if (sex) gb.box(-0.1 * k, hy + 0.02 * k, hz - 0.13 * k, 0.1 * k, hy + 0.2 * k, hz - 0.04 * k, hair); // 長い後ろ髪
  else gb.box(-0.095 * k, hy + 0.08 * k, hz - 0.12 * k, 0.095 * k, hy + 0.17 * k, hz - 0.07 * k, hair);
  if (age === 2 && !sex) gb.box(-0.06 * k, hy + 0.09 * k, hz + 0.1 * k, 0.06 * k, hy + 0.12 * k, hz + 0.105 * k, { c: [0.2, 0.2, 0.2] }); // 眼鏡
  if (p.child) { gb.box(-hw * 0.9, hipY + 0.2 * k, -0.11 * k - 0.16, hw * 0.9, shY, -0.11 * k, { c: sex ? [0.8, 0.15, 0.2] : [0.1, 0.1, 0.12] }); gb.box(-0.1 * k, hy + 0.2 * k, hz - 0.12 * k, 0.1 * k, hy + 0.27 * k, hz + 0.12 * k, { c: [0.95, 0.85, 0.2] }); } // ランドセルと黄色い帽子
  if (age === 2 && p.cane && !sit) gb.beam([hw + 0.12, 0.02, 0.22], [hw + 0.08, hipY, 0.12], 0.02, { c: [0.35, 0.25, 0.18] }); // 杖
  if (p.helmet) gb.box(-0.12 * k, hy + 0.1 * k, hz - 0.13 * k, 0.12 * k, hy + 0.3 * k, hz + 0.13 * k, { c: p.helmet });
  // 脚（v0.6.1 運転席では footY で足を床の上に置き、車体の下へはみ出さないようにする）
  for (const s of [-1, 1]) {
    const hx = s * hw * 0.5;
    if (sit) { const fy = p.footY != null ? Math.max(hipY - 0.38 * k, p.footY) : hipY - 0.38 * k, knee = [hx, hipY + 0.05 + (fy - (hipY - 0.38 * k)) * 0.5, 0.42 * k], foot = [hx * 1.1, fy, 0.55 * k + (fy - (hipY - 0.38 * k)) * 0.4]; gb.beam([hx, hipY, 0.02], knee, 0.075 * k, leg); gb.beam(knee, foot, 0.065 * k, leg); gb.cbox(foot[0], foot[1] + 0.03, foot[2] + 0.06, 0.1 * k, 0.07, 0.22 * k, shoe); }
    else { const a = sw * s * 0.38, knee = [hx, hipY * 0.5, Math.sin(a) * hipY * 0.5], foot = [hx, 0.05, Math.sin(a) * hipY * 0.85 + (a < 0 ? -0.04 : 0.04)]; gb.beam([hx, hipY, 0], knee, 0.07 * k, leg); gb.beam(knee, foot, 0.06 * k, leg); gb.cbox(foot[0], 0.04, foot[2] + 0.05, 0.1 * k, 0.08, 0.24 * k, shoe); }
  }
  // 腕（運転中はハンドルを握る）
  for (const s of [-1, 1]) {
    const sh = [s * (hw + 0.035 * k), shY - 0.05 * k, lean * 0.3 * k];
    let hand;
    if (p.hands) hand = p.hands[s < 0 ? 0 : 1];
    else { const a = -sw * s * 0.45; hand = [s * (hw + 0.06 * k), shY - 0.55 * k, Math.sin(a) * 0.5 * k]; }
    const mid = [(sh[0] + hand[0]) / 2 + s * 0.06 * k, (sh[1] + hand[1]) / 2 - 0.05 * k, (sh[2] + hand[2]) / 2 - (p.hands ? 0.05 : 0)];
    gb.beam(sh, mid, 0.06 * k, top); gb.beam(mid, hand, 0.05 * k, p.outfit === 1 ? top : top);
    if (!p.noHands) gb.cbox(hand[0], hand[1], hand[2], 0.08 * k, 0.08 * k, 0.09 * k, skin);
  }
  return { H, eyeY: hy + 0.13 * k, eyeZ: hz + 0.1 * k };
}
// 運転者：目の位置 eye（車体座標）と、ハンドル中心 steer から、座面基準のモデルを置く
export function buildDriver(gb, sel, eye, steer, steerR = 0.18, floorY = 0.26) {
  const tmp = { age: sel.age, sex: sel.sex, outfit: sel.outfit, pose: 'sit', seed: 3 };
  // まず仮に作って目の高さを測り、目が eye に来るよう平行移動
  const probe = buildPerson({ box() { }, beam() { }, cbox() { } }, tmp);
  const ox = eye[0], oy = Math.max(eye[1] - probe.eyeY, eye[1] - 0.69), oz = eye[2] - probe.eyeZ; // 修正113：背の低い人でも腰が座面（y≈0.5）より沈まないように。腰は座面の上・背もたれの前
  const hands = [[steer[0] - ox - steerR * 0.9, steer[1] - oy + 0.04, steer[2] - oz - 0.03], [steer[0] - ox + steerR * 0.9, steer[1] - oy + 0.04, steer[2] - oz - 0.03]];
  gb.setXf(ox, oy, oz, 0); buildPerson(gb, { ...tmp, hands, noHands: true, footY: floorY + 0.01 - oy }); gb.clearXf();
}
// ハンドルを握る手（ハンドルと一緒に回すため別のメッシュ。ハンドル座標：リムは半径 r の円）
export function buildHands(gb, sel, r = 0.17) {
  const skin = { c: SKIN[sel.age] }, cuff = { c: sel.outfit === 2 ? [0.95, 0.95, 0.95] : [0.35, 0.35, 0.38] };
  for (const s of [-1, 1]) { gb.cbox(s * r * 0.95, 0.035, -0.015, 0.075, 0.085, 0.09, skin); gb.cbox(s * r * 0.95, 0.035, -0.075, 0.07, 0.07, 0.05, cuff); }
}
export function buildStanding(gb, sel) { buildPerson(gb, { ...sel, pose: 'stand', seed: 3 }); }
export function buildBike(gb, rgb, rider = true, seed = 1) { // 自転車＋乗員（原点＝車体中心、+z前）
  const c = { c: rgb, mat: 1 }, blk = { c: [0.1, 0.1, 0.1] };
  for (const z of [-0.55, 0.55]) gb.cylX(0, 0.34, z, 0.34, 0.04, 8, blk, false);
  gb.beam([0, 0.34, -0.55], [0, 0.82, 0.05], 0.025, c); gb.beam([0, 0.82, 0.05], [0, 0.34, 0.55], 0.025, c); gb.beam([0, 0.45, -0.12], [0, 0.88, -0.25], 0.025, c);
  gb.beam([0, 0.82, 0.4], [0, 1.0, 0.45], 0.02, c); gb.box(-0.28, 0.98, 0.42, 0.28, 1.02, 0.48, blk); gb.cbox(0, 0.9, -0.25, 0.12, 0.05, 0.22, blk);
  gb.cbox(0, 0.88, 0.62, 0.3, 0.2, 0.25, { c: [0.4, 0.4, 0.42] });
  if (rider) { const R = rng(seed); gb.setXf(0, 0.92, -0.3, 0); buildPerson(gb, { age: R() * 3 | 0, sex: R() < 0.5 ? 1 : 0, outfit: R() < 0.7 ? 0 : 2, pose: 'ride', seed, hands: [[-0.26, 0.1, 0.72], [0.26, 0.1, 0.72]] }); gb.clearXf(); }
}
export function buildMoto(gb, rgb, seed = 1) { // 原付スクーター＋乗員（ヘルメット）
  const c = { c: rgb, mat: 1 }, blk = { c: [0.1, 0.1, 0.1] };
  for (const z of [-0.62, 0.62]) gb.cylX(0, 0.25, z, 0.25, 0.1, 10, blk);
  gb.box(-0.2, 0.3, -0.75, 0.2, 0.7, 0.1, c); gb.box(-0.16, 0.3, 0.1, 0.16, 0.5, 0.5, c); gb.box(-0.18, 0.5, 0.42, 0.18, 1.05, 0.62, c);
  gb.box(-0.17, 0.7, -0.6, 0.17, 0.8, 0.05, blk); gb.box(-0.33, 1.02, 0.5, 0.33, 1.06, 0.56, blk);
  gb.cbox(0, 0.92, 0.63, 0.16, 0.1, 0.03, { c: [1, 1, 0.9], mat: 2 }); gb.cbox(0, 0.62, -0.76, 0.14, 0.06, 0.03, { c: [0.9, 0.1, 0.1], mat: 4 });
  const R = rng(seed); gb.setXf(0, 0.82, -0.32, 0); buildPerson(gb, { age: R() < 0.5 ? 0 : 1, sex: R() < 0.3 ? 1 : 0, outfit: R() < 0.5 ? 0 : 2, pose: 'ride', seed, helmet: [[0.9, 0.9, 0.9], [0.15, 0.15, 0.15], [0.8, 0.15, 0.1]][R() * 3 | 0], hands: [[-0.3, 0.22, 0.8], [0.3, 0.22, 0.8]] }); gb.clearXf();
}

// ---- 歩行者：歩道を歩き、信号交差点では歩行者用信号に従って横断歩道を渡る。信号のない横断歩道は車が途切れてから渡る。
// 駅前広場・キャンパス・公園は「エリア」内を歩き回る。車が近づくと道をあける（轢く表現はしない） ----
const sideOf = (e, x, z) => { const dx = x - e.x0, dz = z - e.z0; return [dx * e.d[0] + dz * e.d[1], dx * e.d[1] - dz * e.d[0]]; }; // [s, o]（直線の道路）
export class Peds {
  constructor(city, R) { this.city = city; this.R = R; this.list = []; this.cand = []; this.ct = 0; this.target = 0; this.stats = { cross: 0, midCross: 0 }; }
  update(dt, player, hour, zone, perfK, rain, T = 0, planes = null, traffic = null, M4 = null) {
    const city = this.city, R = this.R, px = player.x, pz = player.z;
    const base = { center: 40, res: 14, sub: 9, ind: 5, farm: 2, mtn: 0, gak: 22, nt: 12 }[zone] ?? 4;
    const tf = hour < 5 ? 0.03 : hour < 6.5 ? 0.25 : hour < 20 ? 1 : hour < 23 ? 0.45 : 0.12;
    const peak = (hour > 7 && hour < 9) || (hour > 16 && hour < 18.5) ? 1.4 : 1;
    this.target = Math.round(base * tf * peak * Math.max(0.5, perfK) * (rain ? 0.6 : 1));
    // エリア（駅前広場・キャンパス・公園）ごとの目標
    const areas = (city.pedAreas || []).filter(a => Math.hypot(Math.max(a.x0 - px, 0, px - a.x1), Math.max(a.z0 - pz, 0, pz - a.z1)) < 220);
    const inView = (x, z) => planes && M4 && M4.sphereIn(planes, x, 1, z, 1.2);
    // ワープ直後（瞬間移動）は場面転換なので、視界内にもまとめて配置する（着いた瞬間に誰もいない状態を防ぐ）
    if (this.lpx == null || Math.hypot(px - this.lpx, pz - this.lpz) > 50) { this.seedT = 1.2; this.ct = 0; }
    this.lpx = px; this.lpz = pz; this.seedT = Math.max(0, (this.seedT || 0) - dt);
    const seed = this.seedT > 0;
    this.ct -= dt;
    if (this.ct <= 0) {
      this.ct = 1.5; this.cand = []; this.candV = null;
      for (const e of city.edges) { if ((e.sp.sw <= 0 && e.sp.kind !== 'minor' && e.sp.kind !== 'out') || e.sp.kind === 'mtn') continue; // 歩道のない生活道路・郊外の道は路肩を歩く
        for (let s = 6; s < e.len - 6; s += 12) { const q = city.edgePt(e, s, e.sp.hw + 1); const d = Math.hypot(q[0] - px, q[2] - pz); if (d > (seed ? 8 : 22) && d < 140) this.cand.push([e, s]); } }
    }
    for (let rep = seed ? 12 : 1; rep > 0; rep--) {
    const nArea = this.list.filter(q => q.area).length, areaWant = Math.round(areas.reduce((t, a) => t + a.w * 9, 0) * tf * peak * (rain ? 0.6 : 1) * (a => a)(1));
    if (nArea < areaWant && areas.length) { // エリアに出現（視界の外、または30m以上先）
      const a = areas[R() * areas.length | 0], x = a.x0 + R() * (a.x1 - a.x0), z = a.z0 + R() * (a.z1 - a.z0), d = Math.hypot(x - px, z - pz);
      if ((seed || d > 30 || !inView(x, z)) && !city.inDrive(x, z, 0.3)) this.list.push(this.mk({ area: a, x, z, tx: x, tz: z }));
    } else if (this.list.length - nArea < this.target && this.cand.length) {
      if (seed && !this.candV) this.candV = this.cand.filter(([e, s]) => { const q = city.edgePt(e, s, e.sp.hw + 1); return inView(q[0], q[2]); });
      const pool = seed && this.candV.length && R() < 0.75 ? this.candV : this.cand;
      const [e, s] = pool[R() * pool.length | 0], sp = e.sp, sh = sp.sw <= 0, o = (sh ? sp.hw - 0.3 : sp.hw + 0.6 + R() * Math.max(0.2, sp.sw - 1.2)) * (sp.oneway || R() < 0.5 ? 1 : -1);
      const p = city.edgePt(e, s, o), d = Math.hypot(p[0] - px, p[2] - pz);
      if ((seed || d > 45 || !inView(p[0], p[2])) && (sh || !city.inDrive(p[0], p[2], 0.3))) this.list.push(this.mk({ e, s, o, dir: R() < 0.5 ? 1 : -1, x: p[0], z: p[2] }));
    }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const q = this.list[i];
      if (Math.hypot(q.x - px, q.z - pz) > 190 && !inView(q.x, q.z)) { this.list.splice(i, 1); continue; }
      if (q.area) this.updArea(q, dt, R);
      else if (q.path) this.updCross(q, dt, T, traffic);
      else this.updWalk(q, dt, T, R);
      // 車が近づいたら道をあける
      const dx = q.x - player.x, dz = q.z - player.z, d = Math.hypot(dx, dz);
      if (d < 3.4 && Math.abs(player.vx) > 0.3) { q.dodge = Math.min(2.4, (q.dodge || 0) + dt * 3); q.dx = dx / (d || 1); q.dz = dz / (d || 1); } else q.dodge = Math.max(0, (q.dodge || 0) - dt * 0.6);
      q.rx = q.x + (q.dodge ? q.dx * q.dodge : 0); q.rz = q.z + (q.dodge ? q.dz * q.dodge : 0);
      if (q.path && q.dodge > 0.5) { q.pause = 1.5; }
    }
  }
  mk(o) { const R = this.R, h = this.city.zoneClass ? this.city.zoneClass(o.x, o.z) : ''; const child = R() < (h === 'nt' || h === 'res' ? 0.18 : 0.06), old = !child && R() < 0.2; return { v: child ? 1.3 + R() * 0.3 : old ? 0.85 + R() * 0.2 : 1.15 + R() * 0.4, t: R() * 9, wait: 0, type: child ? 12 + (R() * 3 | 0) : old ? 15 + (R() * 3 | 0) : R() * 12 | 0, yaw: 0, dodge: 0, child, old, ...o }; }
  updArea(q, dt, R) {
    if (q.wait > 0) { q.wait -= dt; q.moving = false; return; }
    const dx = q.tx - q.x, dz = q.tz - q.z, d = Math.hypot(dx, dz);
    if (d < 0.5) { q.wait = R() < 0.5 ? 1 + R() * 6 : 0; const a = q.area; q.tx = a.x0 + R() * (a.x1 - a.x0); q.tz = a.z0 + R() * (a.z1 - a.z0); if (this.city.inDrive(q.tx, q.tz, 0.3)) { q.tx = q.x; q.tz = q.z; } return; }
    q.x += dx / d * q.v * dt; q.z += dz / d * q.v * dt; q.yaw = Math.atan2(dx, dz); q.moving = true; q.t += dt * q.v * 1.6;
  }
  updWalk(q, dt, T, R) {
    const city = this.city, e = q.e;
    if (q.wait > 0) { q.wait -= dt; q.moving = false; }
    else {
      q.s += q.dir * q.v * dt; q.t += dt * q.v * 1.6; q.moving = true;
      // 信号のない横断歩道：ときどき渡る（左右の車が途切れるのを待つ）
      if (city.crosswalks && !e.sp.oneway) for (const cw of city.crosswalks) if (cw.e === e.id && Math.abs(q.s - cw.s) < 0.4 && R() < 0.5 && !q.cwDone) {
        q.cwDone = cw; const sg = Math.sign(q.o) || 1, a = city.edgePt(e, cw.s, sg * (e.sp.hw + 0.4)), b = city.edgePt(e, cw.s, -sg * (e.sp.hw + 0.4)), c2 = city.edgePt(e, cw.s, -q.o);
        q.path = [[q.x, q.z], [a[0], a[2]], [b[0], b[2]], [c2[0], c2[2]]]; q.pi = 0; q.mid = cw; q.after = { e, s: cw.s, o: -q.o, dir: R() < 0.5 ? 1 : -1 }; return;
      }
      if (q.cwDone && Math.abs(q.s - q.cwDone.s) > 3) q.cwDone = null;
      if (q.s < 2 || q.s > e.len - 2) {
        q.s = Math.max(2, Math.min(e.len - 2, q.s));
        const node = city.nodes[q.dir > 0 ? e.to : e.from];
        // 信号交差点：歩行者用信号に従って、横断歩道の上を渡る
        if (node.ctrl === 'signal' && e.straight && R() < 0.75) { if (this.planCross(q, node)) return; }
        q.wait = R() < 0.5 ? 2 + R() * 6 : 0; q.dir = -q.dir;
      } else if (R() < dt * 0.02) q.wait = 2 + R() * 5;
    }
    const p = city.edgePt(e, q.s, q.o); q.x = p[0]; q.z = p[2]; q.yaw = Math.atan2(e.d[0] * q.dir, e.d[1] * q.dir) + (e.straight ? 0 : 0);
    if (!e.straight) { const h = city.headAt(e, q.s); q.yaw = q.dir > 0 ? h : h + Math.PI; }
  }
  // 交差する道路を渡る経路：歩道の端 →（外側へ）横断歩道の端 → 横断歩道を渡る → 向こうの歩道
  planCross(q, node) {
    const city = this.city, e = q.e, wd = q.dir > 0 ? e.dEnd : [-e.d[0], -e.d[1]];
    let e2 = null; for (const id of node.out) { const o = city.edges[id]; if (o.straight && o.sp.sw > 0 && o.d[0] * wd[0] + o.d[1] * wd[1] > 0.95) e2 = o; }
    if (!e2) return false;
    const P0 = [q.x, q.z], [s2, o2] = sideOf(e2, q.x, q.z), Pc = city.edgePt(e2, 1.5, o2), out = Math.sign(q.o) * (e.sp.sw / 2 + 2.6);
    const left = [e.d[1], -e.d[0]], ox = left[0] * out, oz = left[1] * out;
    q.path = [P0, [P0[0] + ox, P0[1] + oz], [Pc[0] + ox, Pc[2] + oz], [Pc[0], Pc[2]]]; q.pi = 0; q.node = node; q.axis = e.axis; void s2;
    q.after = { e: e2, s: 1.5, o: o2, dir: 1 };
    return true;
  }
  updCross(q, dt, T, traffic) {
    const P = q.path, a = P[q.pi], b = P[q.pi + 1];
    if (q.pause > 0) { q.pause -= dt; q.moving = false; return; }
    // 横断の開始前に待つ：信号は青（残り6秒以上）、信号のない横断歩道は左右35m以内に近づく車がないこと
    if (q.pi === 1 && !q.go) {
      q.moving = false; q.onRoad = false;
      let ok;
      if (q.node) { const c = this.city, g = c.sig(q.node, q.axis, T) === 'g' && c.sig(q.node, q.axis, T + 6) === 'g'; ok = g; }
      else { ok = !(traffic && traffic.cars.some(c => { const d = Math.hypot(c.x - q.x, c.z - q.z); return d < 35 && c.v > 0.5 && ((q.x - c.x) * Math.sin(c.yaw) + (q.z - c.z) * Math.cos(c.yaw)) > -2; })); }
      q.waitT = (q.waitT || 0) + dt;
      if (ok && q.waitT > 0.8) { q.go = true; this.stats[q.node ? 'cross' : 'midCross']++; } else { q.yaw = Math.atan2(b[0] - a[0], b[1] - a[1]); return; }
    }
    let v = q.v;
    if (q.pi === 1 && q.node) { const sg = this.city.sig(q.node, q.axis, T); if (sg !== 'g') v *= 1.7; } // 点滅・赤になったら小走り
    q.onRoad = q.pi === 1;
    const dx = b[0] - q.x, dz = b[1] - q.z, d = Math.hypot(dx, dz);
    if (d < v * dt + 0.05) { q.x = b[0]; q.z = b[1]; q.pi++; if (q.pi >= P.length - 1) { Object.assign(q, q.after); q.path = null; q.go = false; q.waitT = 0; q.onRoad = false; q.node = null; q.mid = null; q.cwDone = q.e && this.city.crosswalks ? (this.city.crosswalks.find(c => c.e === q.e.id && Math.abs(c.s - q.s) < 1) || null) : null; } return; }
    q.x += dx / d * v * dt; q.z += dz / d * v * dt; q.yaw = Math.atan2(dx, dz); q.moving = true; q.t += dt * v * 1.6;
  }
}
