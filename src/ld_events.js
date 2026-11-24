// v0.8.0 長距離ドライブの演出と評価
//   修正109：同乗者の会話・リアクション（景色・イベントへの反応、小さなお願いイベント）
//   修正110：エコ運転スコア（走行中は表示しない。クリア画面に点数・内訳・同乗者の一言）
//   修正111：天気の変化（にわか雨→雨上がりの虹、夏の入道雲、冬の晴れ間）と、到着時刻による昼／夕方／夜の判定
//   修正112（2026-11-24 改訂）：見どころの案内は「ナビの観光案内」（kind 'nav'）。ラジオ（kind 'radio'）は位置に依存しないトークだけを曲間に。
//                              距離・到着予想・次の施設までの距離は HUD とナビの進路案内の担当で、ここでは出さない
//   修正115：会話の文脈（直近に食べた物・お願いした物・話題）を st.ev.ctx に持ち、矛盾する提案・同じ話題の繰り返しを避ける。同じセリフはそのドライブ中は再選出しない
//   修正117：ナビの観光案内と景色のリアクションは、ルートに実際に置かれた地物（world.feats）からだけ作る
//   修正118：セリフは性別×年齢帯の8区分（ld_lines.js）
// 状態は LongDrive.st.ev に plain なJSONで持つ（セーブ・再開をまたいで続く。古いセーブには無いので既定値で補う）。天気の変化はセーブしない。
// このモジュールは DOM・WebGL に触れない（字幕の表示は main.js が poll() の結果を出す）。
import { ROUTE_LEN, DIST_SCALE } from './ld_world.js?v=0.9.0';
import { LINES, ECO_COMMENT, NAV, KIND_TRIG, RADIO, FOOD, CAT, mealFor, voiceKey, band } from './ld_lines.js?v=0.9.0';
export { voiceKey, band, mealFor };

const KM = DIST_SCALE / 1000; // 実距離1m → 表示km
const kmToS = km => km / KM;   // 表示km → 実距離m
const TALK_GAP = 90, TALK_GAP_HI = 35, SUB_GAP = 4, NAV_GAP = 6; // 秒（現実時間）
const NAV_LEAD = [780, 470]; // ナビの観光案内を出す範囲：地物の 表示25km〜15km 手前（実 780〜470m）
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function seeded(s) { s = (s % 2147483646) + 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
// 旧API互換（v0.8.0 開発途中の ageGroup）：性別×年齢帯のキーを返す
export const ageGroup = voiceKey;

// ---- 見どころ（ナビの観光案内と同乗者の反応）：world.feats（実際に置いた地物）から作る ----
export function spotsFor(world) {
  const D = world.D, se = world.season, out = [];
  const feats = world.feats || [...D.bridges.map(([a, b, nm]) => ({ id: 'brg:' + nm, kind: 'bridge', name: nm, s0: a, s1: b, side: 0 })), ...D.tunnels.map(([a, b, nm]) => ({ id: 'tun:' + nm, kind: 'tunnel', name: nm, s0: a, s1: b, side: 0 }))];
  const sideT = sd => sd > 0 ? '左手に' : sd < 0 ? '右手に' : '';
  for (const f of feats) {
    if (f.s0 > ROUTE_LEN + 20) continue;
    const t = f.kind === 'dest' ? NAV.dest[se] : NAV[f.kind], trig = f.kind === 'dest' ? (se === 'spring' ? 'castle' : 'destView') : KIND_TRIG[f.kind] || null;
    const at = Math.max(f.s0, 40); // 出発地点から始まる地物は出発直後に
    out.push({ id: f.id, feat: f.id, kind: f.kind, s: at, s1: f.s1, nav: t ? t.replace('{name}', f.name).replace('{side}', sideT(f.side)) : null, trig, pri: f.kind === 'dest' ? 2 : ['sakuraT', 'lake', 'bridge', 'sea', 'onsen', 'mapleT'].includes(f.kind) ? 1 : 0 });
  }
  for (const f of world.fac) out.push({ id: 'fac:' + f.id, feat: 'fac:' + f.id, kind: 'fac', fac: f, s: f.s - 140, s1: f.s, nav: NAV.fac[f.type].replace('{name}', f.name), trig: null, pri: 0 });
  for (const f of world.fac) out.push({ id: 'facNear:' + f.id, kind: 'facNear', fac: f, s: f.s - kmToS(10), s1: f.s, nav: null, trig: 'facNear', pri: 0 });
  out.push({ id: 'destNear', kind: 'destNear', s: ROUTE_LEN - kmToS(30), s1: ROUTE_LEN, nav: null, trig: 'destNear', pri: 2 });
  return out.filter(o => isFinite(o.s)).sort((a, b) => a.s - b.s);
}
// ---- 天気の変化の予定（季節ごと。s は実距離。開始直後・施設の直前・目的地の直前は避ける） ----
function weatherPlan(world, R) {
  const se = world.season, avoid = s => world.fac.some(f => s > f.s - 500 && s < f.s + 520) || s > ROUTE_LEN - 900 || s < 600, out = [];
  const pick = (a, b) => { for (let i = 0; i < 40; i++) { const s = kmToS(a) + R() * (kmToS(b) - kmToS(a)); if (!avoid(s)) return s; } return kmToS(a); };
  if (se === 'spring') { out.push({ type: 'shower', s: pick(120, 180) }); out.push({ type: 'cloud', s: pick(300, 330) }); }
  if (se === 'summer') { out.push({ type: 'cumulus', s: pick(60, 100) }); out.push({ type: 'shower', s: pick(230, 280) }); }
  if (se === 'autumn') { out.push({ type: 'cloud', s: pick(50, 80) }); out.push({ type: 'shower', s: pick(150, 190) }); }
  if (se === 'winter') { out.push({ type: 'sunny', s: pick(40, 90) }); out.push({ type: 'sunny', s: pick(230, 280) }); }
  return out.sort((a, b) => a.s - b.s);
}
const KID_FIRST = ['castle', 'tunnel', 'bridge', 'sea', 'rainbow', 'snowwall', 'harbor', 'sakuraT', 'snow', 'onsen', 'lake', 'destView'];

export class LDEvents {
  constructor({ world, season, party, st }) {
    this.world = world; this.season = season; this.party = party || []; this.st = st; this.opts = { talk: true, nav: true, radio: true };
    const ev = st.ev = st.ev && typeof st.ev === 'object' ? st.ev : {};
    // 既定値で補う（古いセーブ互換）
    for (const [k, v] of Object.entries({ used: [], radio: [], nav: [], spots: [], req: null, reqN: 0, fatT: -1, eco: null, trk: 0, seed: hash(String(st.startAt || 1) + season) })) if (ev[k] == null || (Array.isArray(v) && !Array.isArray(ev[k])) || (typeof v === 'number' && typeof ev[k] !== 'number')) ev[k] = v; // 型の違う古い値も既定値に
    ev.ctx = Object.assign({ ate: [], asked: [], topics: [] }, ev.ctx && typeof ev.ctx === 'object' ? ev.ctx : {}); for (const k of ['ate', 'asked', 'topics']) if (!Array.isArray(ev.ctx[k])) ev.ctx[k] = [];
    if (ev.req && typeof ev.req !== 'object') ev.req = null;
    ev.eco = Object.assign({ t: 0, cruiseT: 0, bandT: 0, acc: 0, brk: 0, idleT: 0, idleW: 0, weave: 0, maxKmh: 0 }, ev.eco || {});
    this.ev = ev; this.R = seeded(ev.seed); this.spots = spotsFor(world);
    this.pass = this.party.filter(p => p.role !== 'driver');
    this.clock = 0; this.lastTalk = -TALK_GAP + 25; this.subUntil = -SUB_GAP; this.queue = []; this.navQ = []; this.radioQ = []; this.log = [];
    // 天気（セーブしない）：通り過ぎた区間の予定は済みにする
    this.base = world.D.weather || 'clear'; this.wx = { cur: this.base, fx: { rainbow: 0, cumulus: 0, sunbeam: 0 }, ev: null, log: [] };
    const s0 = st.maxS || 0; this.plan = weatherPlan(world, seeded(ev.seed + 7)).filter(p => p.s > s0 + 50);
    this.f = { acc: 0, v: null, accRun: 0, brkRun: 0, flips: [], sgn: 0, weaveCd: 0 };
    this.s = s0;
  }
  // ---- 字幕 ----
  who(p) { return p ? p.name : ''; }
  fill(t, o = {}) { return t.replace(/\{fac\}/g, o.fac || '').replace(/\{dest\}/g, this.world.D.dest).replace(/\{item\}/g, o.item || ''); }
  // きっかけに合うセリフを選ぶ（子どもがいれば、はしゃぐ系のきっかけは子ども優先）。一度出たセリフはそのドライブ中は出さない（候補が尽きたら黙る）
  line(trig, o = {}, who = null, reuse = false) {
    const L = LINES[trig]; if (!L || !this.pass.length) return null;
    let cands = who ? [who] : this.pass.slice();
    if (!who) { if (KID_FIRST.includes(trig) && cands.some(p => p.ch.age === 'child') && this.R() < 0.6) cands = cands.filter(p => p.ch.age === 'child'); else if (trig === 'fatigue' && cands.some(p => p.ch.age !== 'child')) cands = cands.filter(p => p.ch.age !== 'child'); }
    // 話せるセリフが残っている人から選ぶ
    const opts = []; for (const p of cands) { const k = voiceKey(p.ch); L[k].forEach((t, i) => { const id = `${trig}:${k}:${i}`; if (reuse || !this.ev.used.includes(id)) opts.push([p, k, t, id]); }); }
    if (!opts.length) return null;
    const byP = cands.filter(p => opts.some(q => q[0] === p)), p = byP[Math.floor(this.R() * byP.length)], mine = opts.filter(q => q[0] === p), [, k, t, id] = mine[Math.floor(this.R() * mine.length)];
    if (!this.ev.used.includes(id)) this.ev.used.push(id);
    const text = this.fill(t, o);
    return { kind: 'talk', who: this.who(p), text, dur: Math.min(6, 2.6 + text.length * 0.09), trig, key: k, p };
  }
  // 直近に同じ話題を出していないか（修正115：景色の話題は 実1500m≒表示48km 以内に繰り返さない）
  recentTopic(k) { return this.ev.ctx.topics.some(q => q.k === k && this.s - q.s < 1500); }
  say(trig, o = {}, hi = false, who = null) {
    if (!this.opts.talk || !this.pass.length) return false;
    if (this.clock - this.lastTalk < (hi ? TALK_GAP_HI : TALK_GAP)) return false;
    if (this.queue.some(q => q.kind === 'talk')) return false;
    if (!hi && this.recentTopic(trig)) return false;
    const l = this.line(trig, o, who); if (!l) return false;
    this.queue.push(l); this.lastTalk = this.clock; this.ev.ctx.topics.push({ k: trig, s: Math.round(this.s) }); if (this.ev.ctx.topics.length > 30) this.ev.ctx.topics.shift(); return true;
  }
  // BGM の曲が変わった（main.js の onTrack から）：3曲のうち2回、ラジオのトークを曲間に差し込む（位置に依存しない内容。そのドライブで同じトークは繰り返さない）
  trackChanged() {
    const ev = this.ev; ev.trk++; if (!this.opts.radio || ev.trk % 3 === 0) return; // 3曲のうち2回の曲間に
    const pool = RADIO[this.season] || [], left = pool.map((t, i) => [t, `r:${this.season}:${i}`]).filter(q => !ev.radio.includes(q[1])); if (!left.length) return;
    const [t, id] = left[Math.floor(this.R() * left.length)]; ev.radio.push(id);
    this.radioQ = [{ kind: 'radio', who: 'ラジオ', text: '📻 ' + t, dur: Math.min(8, 3.2 + t.length * 0.07), id, until: this.clock + 30 }];
  }
  poll() {
    if (this.clock < this.subUntil + SUB_GAP) return null;
    this.radioQ = this.radioQ.filter(r => this.clock < r.until); // 曲間を逃したトークは捨てる
    let q = null;
    // 優先順：ナビの観光案内（実物の手前で出す必要がある）→ 休憩明け・お願い等の優先セリフ → ラジオ（曲間）→ 景色へのセリフ
    if (this.navQ.length && (this.navQ[0].urgent || !this.queue.some(x => x.hi))) q = this.navQ.shift();
    else if (this.queue.length && this.queue[0].hi) q = this.queue.shift();
    else if (this.radioQ.length) q = this.radioQ.shift();
    else if (this.queue.length) q = this.queue.shift();
    if (!q) return null;
    this.subUntil = this.clock + q.dur + (q.kind === 'nav' ? NAV_GAP - SUB_GAP : 0);
    this.log.push({ t: +this.clock.toFixed(1), s: Math.round(this.s || 0), kind: q.kind, who: q.who, text: q.text, feat: q.feat || null, key: q.key || null });
    return { kind: q.kind, who: q.who, text: q.text, dur: q.dur };
  }
  // ---- 毎フレーム ----
  update(dt, f) {
    this.clock += dt; this.s = f.s; const ev = this.ev, s = f.s;
    this.weatherStep(dt, s);
    for (const sp of this.spots) {
      // ナビの観光案内：地物の 実780〜470m 手前で候補に入れる（間に合わなければ直前まで。通り過ぎたら出さない）
      if (sp.nav && !ev.nav.includes(sp.id) && s > sp.s - NAV_LEAD[0] && s < sp.s + 40) { ev.nav.push(sp.id); if (this.opts.nav) this.navQ.push({ kind: 'nav', who: 'ナビ', text: '🧭 ' + sp.nav, dur: Math.min(7, 3 + sp.nav.length * 0.07), id: sp.id, feat: sp.feat, sAt: sp.s }); }
      // 同乗者の反応：地物に着いたとき（入って 実300m まで）
      if (sp.trig && !ev.spots.includes(sp.id) && s > sp.s - 20 && s < Math.min(sp.s1 + 20, sp.s + 300)) {
        if (sp.kind === 'facNear') { if (ev.req && ev.req.state === 'asked' && ev.req.fac === sp.fac.id) { ev.spots.push(sp.id); continue; } if (this.say('facNear', { fac: sp.fac.name })) ev.spots.push(sp.id); }
        else if (this.say(sp.trig, {}, sp.pri > 0)) ev.spots.push(sp.id);
      } else if (sp.trig && !ev.spots.includes(sp.id) && s >= Math.min(sp.s1 + 20, sp.s + 300)) ev.spots.push(sp.id); // 間に合わなかった反応は捨てる
    }
    for (const r of this.navQ) r.urgent = s > r.sAt - 150;
    this.navQ = this.navQ.filter(r => s < r.sAt + 40);
    this.askStep(dt, s);
    // 疲れた運転者への気遣い（大人の同乗者、休憩ごとに1回）
    if ((this.st.fatigue || 0) >= 70 && ev.fatT !== (this.st.rests || 0)) { if (this.say('fatigue', {}, true)) ev.fatT = this.st.rests || 0; }
    this.eco(dt, f);
  }
  // ---- お願いイベント（修正109・115）：1回のドライブで2回まで。直近に食べた品・同じ系統・前にお願いした品は避け、無ければ食べ物以外のお願い ----
  recentAte() { const s = this.s, fac = this.world.fac; return this.ev.ctx.ate.filter(a => { const nx = fac.find(f => f.s > a.s + 100); return !nx || s < nx.s + 470; }); } // 食べてから次の休憩施設を過ぎるまで
  pickFood(p) {
    const ate = this.recentAte(), names = new Set(ate.map(a => a.item)), cats = new Set(ate.map(a => a.cat).filter(c => c !== 'drink'));
    let list = (FOOD[this.season] || []).filter(([n, c]) => !names.has(n) && !cats.has(c) && !this.ev.ctx.asked.includes(n));
    if (p.ch.age === 'child') { const sw = list.filter(([, c]) => c === 'sweet' || c === 'cold'); if (sw.length) list = sw; }
    return list.length ? list[Math.floor(this.R() * list.length)][0] : null;
  }
  askStep(dt, s) {
    const ev = this.ev, req = ev.req;
    if ((!req || req.state !== 'asked') && ev.reqN < 2 && this.pass.length && this.clock > 50 && this.opts.talk) {
      const nf = this.world.fac.find(q => q.s > s + 650 && q.s < s + 2600 && !(this.st.restedIds || []).includes(q.id));
      if (nf && this.R() < dt * 0.05 && !this.queue.length && this.clock - this.lastTalk > TALK_GAP_HI) {
        const kid = this.pass.find(q => q.ch.age === 'child'), p = kid && this.R() < 0.6 ? kid : this.pass[Math.floor(this.R() * this.pass.length)], it = this.pickFood(p);
        const l = it ? this.line('ask', { fac: nf.name, item: it }, p) : this.line('askNF', { fac: nf.name }, p);
        if (l) { l.hi = true; this.queue.push(l); this.lastTalk = this.clock; ev.req = { fac: nf.id, item: it, who: this.pass.indexOf(p), state: 'asked' }; ev.reqN++; if (it) ev.ctx.asked.push(it); }
      }
    }
    if (req && req.state === 'asked') { const fc = this.world.fac.find(q => q.id === req.fac); if (fc && s > fc.s + 470) { req.state = 'missed'; this.say('askMiss', { fac: fc.name, item: req.item }, true, this.pass[req.who]); } }
  }
  // 休憩の開始（longdrive.startRest）。お願いの施設なら、その品をムービーの食事に加える。戻り値＝ムービーで食べるもの（cutscene と共用）
  restStart(fac) {
    const r = this.ev.req; let reqItem = null;
    if (r && r.state === 'asked' && r.fac === fac.id) { r.state = 'done'; reqItem = r.item || null; this.pendDone = { item: r.item, fac: fac.name, who: this.pass[r.who] }; }
    else if (r && r.state === 'asked') r.state = 'dropped'; // 別の施設で先に休憩したら、そのお願いは見送り（後で同じ品を求め直さない）
    const meal = mealFor(fac.type, this.season, reqItem);
    for (const it of meal.items) this.ev.ctx.ate.push({ item: it, cat: CAT[it] || 'meal', s: Math.round(fac.s), fac: fac.id });
    if (this.ev.ctx.ate.length > 20) this.ev.ctx.ate.splice(0, this.ev.ctx.ate.length - 20);
    this.lastMeal = meal; return meal;
  }
  // 休憩の終わり：お願いがかなった喜び、または食べたものの話（どちらか1つ）
  restEnd() {
    let l = null;
    if (this.pendDone) { const d = this.pendDone; this.pendDone = null; l = d.item ? this.line('askDone', { item: d.item, fac: d.fac }, d.who, true) : this.line('askDoneNF', { fac: d.fac }, d.who, true); }
    else if (this.lastMeal && this.pass.length) { const p = this.pass[Math.floor(this.R() * this.pass.length)], item = p.ch.age === 'child' ? this.lastMeal.sweet : this.lastMeal.main; l = this.line('ateRecall', { item }, p); }
    this.lastMeal = null;
    if (l && this.opts.talk) { l.hi = true; this.queue.unshift(l); this.lastTalk = this.clock; this.subUntil = Math.min(this.subUntil, this.clock - SUB_GAP); }
  }
  // ---- 修正110 エコ運転スコア ----
  eco(dt, f) {
    const E = this.ev.eco, F = this.f, kmh = f.kmh, main = Math.abs(f.u) < 9.9;
    // 前後加速度：表示速度の変化をなめらかにして求める（自車の物理のぶれを拾わない）
    if (F.v == null) F.v = kmh; const a = (kmh - F.v) / 3.6 / Math.max(dt, 1e-3); F.v = kmh; F.acc += (a - F.acc) * (1 - Math.exp(-dt / 0.25)); const acc = f.acc != null ? f.acc : F.acc;
    E.t += dt; E.maxKmh = Math.max(E.maxKmh, kmh);
    if (f.cruise) E.cruiseT += dt;
    if (main && kmh >= 70 && kmh <= 100) E.bandT += dt;
    // 急加速：加速度2.0m/s²超、またはアクセル全開で1.0m/s²超が0.6秒続いたら1回
    if (acc > 2.0 || (f.thr >= 0.95 && acc > 1.0 && kmh > 20)) { F.accRun += dt; if (F.accRun >= 0.6 && !F.accHit) { E.acc++; F.accHit = true; } } else { F.accRun = 0; F.accHit = false; }
    // 急ブレーキ：減速度3.5m/s²超が0.5秒続いたら1回（軽く踏んで速度を合わせるのは数えない）
    if (acc < -3.5 && kmh > 15) { F.brkRun += dt; if (F.brkRun >= 0.5 && !F.brkHit) { E.brk++; F.brkHit = true; } } else { F.brkRun = 0; F.brkHit = false; }
    // 無駄なアイドリング：停車してエンジンがかかったまま30秒を超えた時間
    if (kmh < 1 && f.engineOn !== false) { E.idleW += dt; if (E.idleW > 30) E.idleT += dt; } else E.idleW = 0;
    // 蛇行：50km/h超でハンドルの左右の切り返しが2秒間に4回以上
    F.weaveCd -= dt; const sg = Math.abs(f.steer) > 0.45 ? Math.sign(f.steer) : 0;
    if (kmh > 50 && sg && sg !== F.sgn) { if (F.sgn) F.flips.push(this.clock); F.sgn = sg; }
    F.flips = F.flips.filter(t => this.clock - t < 2); if (F.flips.length >= 4 && F.weaveCd <= 0) { E.weave++; F.weaveCd = 3; F.flips = []; }
  }
  ecoResult() {
    const E = this.ev.eco, T = Math.max(1, E.t), band = E.bandT / T, cruise = E.cruiseT / T, items = [];
    const it = (label, pts, detail) => { items.push({ label, pts: Math.round(pts), detail }); return Math.round(pts); };
    let sc = 90;
    sc += it('速度キープの活用', Math.min(10, cruise / 0.5 * 10), `走行時間の${Math.round(cruise * 100)}%`);
    sc += it('推奨速度帯（70〜100km/h）', band >= 0.85 ? 0 : -Math.min(30, (0.85 - band) * 45), `本線走行の${Math.round(band * 100)}%`);
    sc += it('急加速', -Math.min(20, E.acc * 4), `${E.acc}回`);
    sc += it('急ブレーキ', -Math.min(25, E.brk * 5), `${E.brk}回`);
    sc += it('蛇行', -Math.min(15, E.weave * 3), `${E.weave}回`);
    sc += it('無駄なアイドリング', -Math.min(10, E.idleT / 30), `${Math.round(E.idleT)}秒`);
    const score = Math.max(0, Math.min(100, Math.round(sc))), rank = score >= 95 ? 'S' : score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D';
    let comment = null;
    if (this.pass.length) { const p = this.pass.find(q => q.ch.age === 'child') || this.pass[0], g = voiceKey(p.ch), L = ECO_COMMENT[score >= 85 ? 'hi' : score >= 60 ? 'mid' : 'lo'], arr = L[g]; comment = { who: p.name, text: arr[hash(String(score) + p.name) % arr.length], key: g }; } // 修正118：性別×年齢帯で一言を変える
    return { score, rank, items, comment };
  }
  // ---- 修正111 天気 ----
  weatherStep(dt, s) {
    const W = this.wx, fx = W.fx, ap = (k, to, rate) => { fx[k] += Math.max(-rate * dt, Math.min(rate * dt, to - fx[k])); };
    if (!W.ev && this.plan.length && s >= this.plan[0].s) { W.ev = { ...this.plan.shift(), t: 0 }; W.log.push({ t: +this.clock.toFixed(0), s: Math.round(s), type: W.ev.type }); }
    const e = W.ev; let cur = this.base, rb = 0, cu = 0, sb = 0;
    if (e) { e.t += dt; const t = e.t;
      if (e.type === 'shower') { // 曇り10秒 → にわか雨40秒 → 晴れ。雨上がりに虹（5秒で現れ、40秒見えて、10秒で消える）
        if (t < 10) cur = 'cloudy'; else if (t < 50) cur = 'rain'; else { cur = this.base === 'cloudy' ? 'cloudy' : 'clear'; rb = t < 56 ? 0 : t < 100 ? 1 : 0; }
        if (t > 50 && !e.said) { e.said = 1; } if (t > 10 && t < 45 && !e.rs) { if (this.say('rain', {}, true)) e.rs = 1; } // 言えなかったら雨の間は再試行 if (t > 64 && t < 98 && !e.rbs) { if (this.say('rainbow', {}, true)) e.rbs = 1; }
        if (t > 112) W.ev = null; }
      else if (e.type === 'cumulus') { cu = t < 30 ? t / 30 : t < 70 ? 1 : 0; if (t > 25 && t < 70 && !e.s1) { if (this.say('cumulus', {}, true)) e.s1 = 1; } if (t > 90) W.ev = null; }
      else if (e.type === 'sunny') { cur = 'clear'; sb = t < 45 ? 1 : 0; if (t > 8 && t < 45 && !e.s1) { if (this.say('sunbeam', {}, true)) e.s1 = 1; } if (t > 55) W.ev = null; }
      else if (e.type === 'cloud') { cur = 'cloudy'; if (t > 50) W.ev = null; }
    }
    W.cur = cur; ap('rainbow', rb, rb ? 0.2 : 0.1); ap('cumulus', cu, 0.05); ap('sunbeam', sb, 0.25);
    W.maxRainbow = Math.max(W.maxRainbow || 0, fx.rainbow);
  }
  weather() { return this.wx.cur; }
  fx() { return this.wx.fx; }
  // 到着時刻（ゲーム内の分）から、到着ムービー・クリア画面の空の版を決める：16:30〜18:30 夕方、18:30〜05:00 夜、それ以外は昼
  static tod(min) { const m = ((min % 1440) + 1440) % 1440; return m >= 990 && m < 1110 ? 'evening' : m >= 1110 || m < 300 ? 'night' : 'day'; }
}
