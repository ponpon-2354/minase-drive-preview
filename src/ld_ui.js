// 長距離ドライブモードの画面：設定（季節・人数・同乗者・座席）→ 確認 → 開始、クリア画面
import { SEASONS } from './ld_world.js?v=0.9.0';
import { AGE_OPTS, OUTFIT_OPTS, SEAT_OPTS, SEASON_NAMES, CAR_CAPACITY, outfitAllowed, defaultOutfit, seatAllowed } from './passengers.js?v=0.9.0';
import { hhmm, dur, passengerLabel, outfitName, seatName } from './longdrive.js?v=0.9.0';

const SEASON_TEXT = {
  spring: ['桜並木・川沿いの桜・田園・桜の橋・桜のトンネル', '城下町を抜けて、満開の桜ヶ丘城でお花見'],
  summer: ['海岸バイパス・青い海・海辺の橋・海岸トンネル・港町', '高原の道をのぼって、コテージで過ごす'],
  autumn: ['紅葉の山・渓谷と渓流・紅葉トンネル・展望台', '山あいの集落を抜け、木造の宿で紅葉を眺める'],
  winter: ['雪の山道・雪の壁・雪化粧の森・凍った湖', '雪の橋とトンネルを越えて、湯けむりの温泉郷へ']
};
// 季節の見どころの絵（キャンバスに描く。季節ごとに色と景色を変える）
export function paintSeason(cv, season) {
  const c = cv.getContext('2d'), W = cv.width, H = cv.height, hz = H * 0.52;
  const sky = { spring: ['#9cc8f0', '#f3dbe6'], summer: ['#3d8de0', '#bfe4ff'], autumn: ['#7fa6d6', '#f2d6a8'], winter: ['#8ea2bf', '#e6ecf5'] }[season];
  let g = c.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]); c.fillStyle = g; c.fillRect(0, 0, W, hz);
  const mtn = (y, h, col, seed) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, hz); for (let x = 0; x <= W; x += W / 12) c.lineTo(x, y - Math.abs(Math.sin(x * 0.02 + seed)) * h); c.lineTo(W, hz); c.fill(); };
  mtn(hz, H * 0.22, season === 'winter' ? '#d9e2ee' : season === 'autumn' ? '#b5764a' : '#7f9fa0', 1);
  mtn(hz, H * 0.12, season === 'winter' ? '#f4f7fb' : season === 'autumn' ? '#c9542a' : season === 'summer' ? '#3d8a4a' : '#7fae6a', 3);
  const gr = { spring: '#8fc66a', summer: '#4f9a3c', autumn: '#b8913f', winter: '#f2f5fa' }[season];
  c.fillStyle = gr; c.fillRect(0, hz, W, H - hz);
  if (season === 'summer') { c.fillStyle = '#2a76c4'; c.fillRect(0, hz, W * 0.42, H * 0.2); c.fillStyle = 'rgba(255,255,255,.6)'; for (let k = 0; k < 6; k++) c.fillRect(W * 0.05 + k * W * 0.06, hz + 8 + (k % 3) * 9, W * 0.03, 2); }
  if (season === 'winter') { c.fillStyle = '#bcd3e6'; c.beginPath(); c.ellipse(W * 0.2, hz + H * 0.12, W * 0.16, H * 0.05, 0, 0, 7); c.fill(); }
  // 道路（遠近）
  c.fillStyle = season === 'winter' ? '#6d717a' : '#55585e'; c.beginPath(); c.moveTo(W * 0.47, hz); c.lineTo(W * 0.53, hz); c.lineTo(W * 0.9, H); c.lineTo(W * 0.1, H); c.fill();
  c.strokeStyle = '#f4f1e6'; c.lineWidth = 2; c.setLineDash([8, 10]); c.beginPath(); c.moveTo(W * 0.5, hz); c.lineTo(W * 0.5, H); c.stroke(); c.setLineDash([]);
  if (season === 'winter') { c.fillStyle = '#fbfdff'; c.beginPath(); c.moveTo(W * 0.47, hz); c.lineTo(W * 0.44, hz); c.lineTo(0, H); c.lineTo(W * 0.1, H); c.fill(); c.beginPath(); c.moveTo(W * 0.53, hz); c.lineTo(W * 0.56, hz); c.lineTo(W, H); c.lineTo(W * 0.9, H); c.fill(); }
  // 木
  const tree = (x, y, s) => {
    if (season === 'winter') { c.fillStyle = '#2d4a3a'; c.beginPath(); c.moveTo(x, y - 26 * s); c.lineTo(x - 9 * s, y); c.lineTo(x + 9 * s, y); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x, y - 26 * s); c.lineTo(x - 5 * s, y - 14 * s); c.lineTo(x + 5 * s, y - 14 * s); c.fill(); return; }
    c.fillStyle = '#5a4030'; c.fillRect(x - 1.5 * s, y - 10 * s, 3 * s, 10 * s);
    const col = season === 'spring' ? ['#ffd0e0', '#ffb8cf', '#fff0f5'] : season === 'autumn' ? ['#e0401c', '#f08a1c', '#f2c032'] : ['#3d8a3a', '#4fa04a', '#2f7a34'];
    for (let k = 0; k < 3; k++) { c.fillStyle = col[k]; c.beginPath(); c.arc(x + (k - 1) * 5 * s, y - 14 * s - (k % 2) * 4 * s, 8 * s, 0, 7); c.fill(); }
  };
  for (let k = 0; k < 9; k++) { const t = k / 8, y = hz + (H - hz) * (0.08 + t * 0.85), s = 0.35 + t * 1.2; tree(W * (0.44 - t * 0.4), y, s); if (season !== 'summer') tree(W * (0.56 + t * 0.4), y, s); }
  // 目的地の目印
  c.fillStyle = 'rgba(0,0,0,.35)';
  if (season === 'spring') { const x = W * 0.78, y = hz - 4; c.fillStyle = '#f5f3ee'; c.fillRect(x - 14, y - 26, 28, 26); c.fillStyle = '#3a4250'; c.beginPath(); c.moveTo(x - 20, y - 26); c.lineTo(x + 20, y - 26); c.lineTo(x, y - 38); c.fill(); c.fillStyle = '#f5f3ee'; c.fillRect(x - 8, y - 46, 16, 12); c.fillStyle = '#3a4250'; c.beginPath(); c.moveTo(x - 13, y - 46); c.lineTo(x + 13, y - 46); c.lineTo(x, y - 55); c.fill(); }
  if (season === 'summer') { const x = W * 0.8, y = hz + 4; c.fillStyle = '#b07a4a'; c.fillRect(x - 12, y - 14, 24, 14); c.fillStyle = '#2f6a5a'; c.beginPath(); c.moveTo(x - 16, y - 14); c.lineTo(x + 16, y - 14); c.lineTo(x, y - 26); c.fill(); }
  if (season === 'autumn') { const x = W * 0.8, y = hz + 2; c.fillStyle = '#6a4a30'; c.fillRect(x - 16, y - 12, 32, 12); c.fillStyle = '#3a3a40'; c.beginPath(); c.moveTo(x - 20, y - 12); c.lineTo(x + 20, y - 12); c.lineTo(x, y - 22); c.fill(); }
  if (season === 'winter') { c.fillStyle = 'rgba(255,255,255,.75)'; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(W * 0.78 + k * 6, hz - 10 - k * 9, 6 + k * 2, 0, 7); c.fill(); } c.fillStyle = '#ffd27a'; c.fillRect(W * 0.72, hz - 4, 8, 6); c.fillRect(W * 0.84, hz - 4, 8, 6); }
  if (season === 'winter' || season === 'spring') { c.fillStyle = season === 'winter' ? '#fff' : '#ffc6d8'; for (let k = 0; k < 40; k++) { const x = (k * 97 % W), y = (k * 53 % H); c.fillRect(x, y, 2, 2); } }
}

const opt = (arr, v, f = () => true) => arr.filter(([id]) => f(id)).map(([id, l]) => `<option value="${id}"${id === v ? ' selected' : ''}>${l}</option>`).join('');
export class LDSetup {
  // ui：{ $, driverText()（運転者の説明）, driver()（運転者の設定）, onChange(cfg), onStart(cfg), onBack() }
  constructor(ui) {
    this.ui = ui; this.view = 'edit'; this.err = '';
    this.cfg = { season: 'spring', n: 2, passengers: [] };
    const body = ui.$('ldsBody');
    body.addEventListener('change', e => this.onInput(e.target));
    body.addEventListener('click', e => { const b = e.target.closest('button'); if (b) this.onClick(b); });
  }
  open(preset) {
    if (preset) { this.cfg = JSON.parse(JSON.stringify({ season: preset.season, n: preset.passengers.length + 1, passengers: preset.passengers })); if (preset.otherSeason) { const ks = Object.keys(SEASONS); this.cfg.season = ks[(ks.indexOf(preset.season) + 1) % 4]; this.fixOutfits(); } }
    this.view = 'edit'; this.err = ''; this.sync(); this.render();
  }
  newP(i) { const used = this.cfg.passengers.map(p => p.seat), seat = SEAT_OPTS.map(s => s[0]).find(s => !used.includes(s)) || 'rearL'; const age = i === 0 ? '30' : 'child', sex = i === 0 ? 1 : 0; return { ch: { sex, age, outfit: defaultOutfit(this.cfg.season, age), seed: 21 + i * 7 }, seat: age === 'child' && seat === 'front' ? 'rearL' : seat }; }
  sync() { // 人数に合わせて同乗者の数をそろえる
    const want = clampN(this.cfg.n) - 1; while (this.cfg.passengers.length < want) this.cfg.passengers.push(this.newP(this.cfg.passengers.length)); this.cfg.passengers.length = want;
    this.fixOutfits(); this.fixSeats();
  }
  fixOutfits() { for (const p of this.cfg.passengers) if (!outfitAllowed(p.ch.outfit, this.cfg.season, p.ch.age)) p.ch.outfit = defaultOutfit(this.cfg.season, p.ch.age); }
  fixSeats() { // 重複・子どもの助手席を自動で直す
    const used = new Set();
    for (const p of this.cfg.passengers) { if (used.has(p.seat) || !seatAllowed(p.seat, p.ch.age)) p.seat = SEAT_OPTS.map(s => s[0]).find(s => !used.has(s) && seatAllowed(s, p.ch.age)); used.add(p.seat); }
  }
  validate() {
    const c = this.cfg, seats = c.passengers.map(p => p.seat);
    if (c.n + 0 > CAR_CAPACITY) return `乗車定員（${CAR_CAPACITY}名）を超えています`;
    if (new Set(seats).size !== seats.length) return '同じ座席に2人は座れません';
    if (c.passengers.some(p => !seatAllowed(p.seat, p.ch.age))) return '子どもは後席（ジュニアシート）に座ります';
    if (c.passengers.some(p => !outfitAllowed(p.ch.outfit, c.season, p.ch.age))) return 'この季節に合わない服装があります';
    return '';
  }
  onInput(el) {
    const c = this.cfg, i = +el.dataset.i, k = el.dataset.k;
    if (k === 'age') { c.passengers[i].ch.age = el.value; if (!outfitAllowed(c.passengers[i].ch.outfit, c.season, el.value)) c.passengers[i].ch.outfit = defaultOutfit(c.season, el.value); if (!seatAllowed(c.passengers[i].seat, el.value)) { this.fixSeats(); this.err = '子どもは助手席に座れないため、後席（ジュニアシート）に移しました'; } }
    else if (k === 'sex') c.passengers[i].ch.sex = +el.value;
    else if (k === 'outfit') c.passengers[i].ch.outfit = el.value;
    else if (k === 'seat') { const old = c.passengers[i].seat, other = c.passengers.find((p, j) => j !== i && p.seat === el.value); c.passengers[i].seat = el.value;
      if (other) { const used = new Set(c.passengers.filter(p => p !== other).map(p => p.seat)); // 入れ替え。子どもが助手席に回る場合は空いている後席へ
        other.seat = seatAllowed(old, other.ch.age) && !used.has(old) ? old : SEAT_OPTS.map(q => q[0]).find(q => !used.has(q) && seatAllowed(q, other.ch.age));
        this.err = other.seat === old ? '座席を入れ替えました' : '子どもは助手席に座れないため、空いている後席に移しました'; } }
    this.render(); this.ui.onChange(this.cfgOut());
  }
  onClick(b) {
    const a = b.dataset.a;
    if (a === 'season') { this.cfg.season = b.dataset.v; this.fixOutfits(); }
    else if (a === 'n') { this.cfg.n = +b.dataset.v; this.sync(); }
    else if (a === 'confirm') { const e = this.validate(); if (e) { this.err = e; } else this.view = 'confirm'; }
    else if (a === 'edit') this.view = 'edit';
    else if (a === 'start') { if (!this.validate()) { this.ui.onStart(this.cfgOut()); return; } }
    else if (a === 'back') { this.ui.onBack(); return; }
    if (a !== 'confirm' || this.view === 'confirm') this.err = a === 'confirm' ? '' : this.err;
    this.render(); this.ui.onChange(this.cfgOut());
  }
  cfgOut() { return { season: this.cfg.season, driver: this.ui.driver(), passengers: this.cfg.passengers.map(p => ({ ch: { ...p.ch }, seat: p.seat })) }; }
  render() {
    const c = this.cfg, D = SEASONS[c.season], body = this.ui.$('ldsBody');
    if (this.view === 'confirm') {
      const rows = [['季節', SEASON_NAMES[c.season]], ['人数', `${c.n}人`], ['運転者', this.ui.driverText()],
        ...c.passengers.map((p, i) => [`同乗者${i + 1}`, `${passengerLabel(p.ch)}・${outfitName(p.ch.outfit)}`]),
        ['座席', ['運転席：あなた', ...c.passengers.map((p, i) => `${seatName(p.seat)}：同乗者${i + 1}${p.ch.age === 'child' ? '（ジュニアシート）' : ''}`)].join('<br>')],
        ['車両', this.ui.carText()], ['出発', '水瀬東IC（長距離ドライブ専用バイパス入口）09:00'], ['目的地', `${D.dest}（約400km・到着予定 14:00 ごろ）`],
        ['休憩施設', D.fac.map((f, i) => `${f}（${[110, 200, 290][i]}km）`).join('<br>')]];
      body.innerHTML = `<h2>確認</h2><table class="ldt">${rows.map(r => `<tr><th>${r[0]}</th><td>${r[1]}</td></tr>`).join('')}</table>
        <p class="small">時間は現実の45分でゲーム内の24時間（現実1分＝ゲーム内32分）。距離も同じ割合で縮めています（実際の走行1km＝表示32km）。連続運転4時間を目安に休憩しましょう。</p>
        <div class="btns"><button data-a="edit">設定にもどる</button><button data-a="start" class="pri">ドライブ開始</button></div>`;
      return;
    }
    const ps = c.passengers.map((p, i) => `<div class="ldp"><b>同乗者${i + 1}</b>
      <select data-k="sex" data-i="${i}" aria-label="性別">${opt([['0', '男性'], ['1', '女性']], String(p.ch.sex))}</select>
      <select data-k="age" data-i="${i}" aria-label="年齢">${opt(AGE_OPTS, p.ch.age)}</select>
      <select data-k="outfit" data-i="${i}" aria-label="服装">${opt(OUTFIT_OPTS.map(o => [o[0], o[1]]), p.ch.outfit, id => outfitAllowed(id, c.season, p.ch.age))}</select>
      <select data-k="seat" data-i="${i}" aria-label="座席">${opt(SEAT_OPTS, p.seat, id => seatAllowed(id, p.ch.age))}</select></div>`).join('');
    body.innerHTML = `<h2>長距離ドライブ　旅の準備</h2>
      <div class="lds">${Object.keys(SEASONS).map(s => `<button data-a="season" data-v="${s}" class="ldsc${s === c.season ? ' on' : ''}"><canvas width="200" height="110" data-s="${s}"></canvas><b>${SEASON_NAMES[s]}　→ ${SEASONS[s].dest}</b><span>${SEASON_TEXT[s][0]}</span></button>`).join('')}</div>
      <div class="small" style="margin:4px 0 8px">${SEASON_TEXT[c.season][1]}</div>
      <div class="ldn"><b>人数</b>${[1, 2, 3].map(n => `<button data-a="n" data-v="${n}" class="${n === c.n ? 'on' : ''}">${n}人${n === 1 ? '（ひとり旅）' : ''}</button>`).join('')}</div>
      <div class="small">運転者：${this.ui.driverText()}（タイトルの VEHICLE SELECT で変更）</div>
      ${ps || '<div class="small" style="margin:6px 0">同乗者はいません。ひとりでゆっくり走ります。</div>'}
      <div class="small">子ども（約9歳）は後席のジュニアシートに座ります。座席は重ならないよう自動で調整します（定員${CAR_CAPACITY}名）。服装はその季節に合うものだけ選べます。</div>
      <div class="lderr">${this.err}</div>
      <div class="btns"><button data-a="back">タイトルへ</button><button data-a="confirm" class="pri">確認へ</button></div>`;
    body.querySelectorAll('canvas[data-s]').forEach(cv => paintSeason(cv, cv.dataset.s));
  }
}
const clampN = n => Math.max(1, Math.min(3, n | 0));

export function renderClear($, rec, clears) {
  const best = clears.filter(r => r.season === rec.season).length;
  $('ldcBody').innerHTML = `<div class="ldclear">CLEAR</div>
    <table class="ldt"><tr><th>季節</th><td>${rec.seasonName}</td></tr><tr><th>目的地</th><td>${rec.dest}</td></tr>
    <tr><th>総走行距離</th><td>${rec.km.toFixed(1)}km</td></tr><tr><th>総運転時間</th><td>${dur(rec.driveMin)}</td></tr>
    <tr><th>総経過時間</th><td>${dur(rec.totalMin)}（09:00 → ${hhmm(540 + rec.totalMin)}）</td></tr>
    <tr><th>休憩回数</th><td>${rec.rests}回${rec.restLog && rec.restLog.length ? '<br><span class="small">' + rec.restLog.map(r => `${r.name} ${r.at}〜${r.to}`).join('<br>') + '</span>' : ''}</td></tr>
    <tr><th>同行人数</th><td>${rec.people}人</td></tr></table>
    <div class="small">この季節のクリア ${best}回目（記録はこの端末に保存されます）</div>${ecoHtml(rec)}`;
  // 修正111：夕方・夜に着いたときはクリア画面も夕焼け／夜の色に
  const pn = $('ldcBody').closest('.panel'); if (pn) { pn.classList.toggle('tod-evening', rec.tod === 'evening'); pn.classList.toggle('tod-night', rec.tod === 'night'); }
  ecoStyle();
}
// 修正110：エコ運転スコア（点数・ランク・内訳・同乗者のひと言）。古い記録（eco なし）は表示しない
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function ecoHtml(rec) {
  const e = rec.eco; if (!e || typeof e.score !== 'number') return '';
  const rows = (e.items || []).map(i => `<tr><th>${esc(i.label)}</th><td>${esc(i.detail)}</td><td class="pts ${i.pts > 0 ? 'p' : i.pts < 0 ? 'm' : ''}">${i.pts > 0 ? '+' : ''}${i.pts}</td></tr>`).join('');
  const tod = rec.tod === 'evening' ? '🌇 夕焼けの到着' : rec.tod === 'night' ? '🌙 夜の到着' : '☀ 昼の到着';
  return `<div class="ldeco"><div class="ldeh">エコ運転スコア <b>${e.score}</b>点 <span class="rk rk${esc(e.rank)}">ランク${esc(e.rank)}</span><span class="tod">${tod}${rec.arrive ? '（' + esc(rec.arrive) + '）' : ''}</span></div>
    <table class="ldt eco">${rows}<tr><th>基本点</th><td></td><td class="pts">90</td></tr></table>
    ${e.comment ? `<div class="ecoc"><b>${esc(e.comment.who)}</b>「${esc(e.comment.text)}」</div>` : ''}</div>`;
}
function ecoStyle() { if (document.getElementById('ldecoCss')) return; const st = document.createElement('style'); st.id = 'ldecoCss';
  st.textContent = `.ldeco{margin-top:10px;padding:8px 10px;border-radius:6px;background:rgba(255,255,255,.07);text-align:left}.ldeh{font-size:15px;font-weight:700;display:flex;flex-wrap:wrap;gap:8px;align-items:baseline}.ldeh b{font-size:26px;color:#7fe08a}
  .rk{padding:1px 8px;border-radius:10px;background:#3a5;color:#fff;font-size:13px}.rkS{background:#d4a017}.rkA{background:#3a8f4a}.rkB{background:#3f7fbf}.rkC{background:#b87a2a}.rkD{background:#b8443a}.ldeh .tod{font-size:12px;opacity:.85;margin-left:auto}
  .ldt.eco td.pts{text-align:right;font-weight:700;width:3.5em}.ldt.eco td.p{color:#7fe08a}.ldt.eco td.m{color:#ff8a6a}.ldt.eco th,.ldt.eco td{font-size:12px;padding:2px 6px}.ecoc{margin-top:6px;font-size:13px}.ecoc b{color:#ffd37a;margin-right:4px;font-size:11px}
  .panel.tod-evening{background:linear-gradient(180deg,rgba(120,60,70,.94),rgba(40,30,50,.94))}.panel.tod-night{background:linear-gradient(180deg,rgba(14,20,44,.96),rgba(8,10,20,.96))}`;
  document.head.appendChild(st); }
