// v0.8.0 修正102・103：長距離ドライブ専用BGM（季節ごとに10曲・休憩用・到着テーマ）
// すべて Web Audio のコード生成によるオリジナル曲（音源ファイル・外部ライブラリなし）。実在の楽曲の旋律は使わない。
// 季節の方向性：春＝アコースティックギター・ピアノ中心の軽快な曲／夏＝トロピカルなパーカッション・ブラス・スティールパン・コーラス風パッドの海辺のドライブソング
//   （特定アーティストの曲の旋律は模倣しない。編成とノリのみ参考）／秋＝ナイロンギター・ウォーキングベース・ブラシのジャズ／ボサノバ／冬＝ベル・ストリングス・コーラス・スレイベルのクリスマス風
// 再生はシャッフル（ShuffleBag：一巡するまで重複なし、巡目の境目でも直前の曲を出さない）。市街地散策モードのBGM（audio.js の Music）とは別系統で、互いに影響しない。
// このモジュールは読み込み時にブラウザAPIへ触れない（node から import して曲数・シャッフルを検証できる）。

const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
const CH = { M: [0, 4, 7], m: [0, 3, 7], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], D7: [0, 4, 7, 10], m9: [0, 3, 7, 10, 14], M9: [0, 4, 7, 11, 14], add9: [0, 4, 7, 14], sus: [0, 5, 7, 10], M6: [0, 4, 7, 9], m6: [0, 3, 7, 9], D9: [0, 4, 7, 10, 14] };
function seeded(s) { s = (Math.floor(s) % 2147483646) + 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

// ---- 季節ごとの曲（コード進行は度数[半音, 和音]。編成 inst、リズム rh、拍子 meter（4 または 3）） ----
const PROG = {
  pop1: [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M']], pop2: [[5, 'M7'], [7, 'D7'], [4, 'm7'], [9, 'm7']], pop3: [[0, 'add9'], [9, 'm7'], [5, 'M7'], [7, 'sus']],
  pop4: [[0, 'M'], [4, 'm'], [5, 'M'], [7, 'M']], pop5: [[9, 'm'], [5, 'M'], [0, 'M'], [7, 'M']], pop6: [[0, 'M7'], [5, 'M7'], [2, 'm7'], [7, 'D7']],
  sum1: [[0, 'M7'], [2, 'm7'], [5, 'M7'], [7, 'D7']], sum2: [[5, 'M7'], [7, 'M'], [4, 'm7'], [9, 'm']], sum3: [[0, 'M'], [5, 'M'], [7, 'M'], [5, 'M']], sum4: [[0, 'add9'], [7, 'M'], [9, 'm7'], [5, 'M7'], [2, 'm7'], [7, 'sus']],
  jaz1: [[2, 'm9'], [7, 'D9'], [0, 'M9'], [9, 'm7']], jaz2: [[0, 'M7'], [9, 'm7'], [2, 'm7'], [7, 'D7']], jaz3: [[5, 'M7'], [4, 'm7'], [2, 'm7'], [0, 'M7']], jaz4: [[9, 'm9'], [2, 'm7'], [7, 'D7'], [0, 'M7']], bos1: [[0, 'M7'], [0, 'M7'], [2, 'D7'], [2, 'D7'], [2, 'm7'], [7, 'D7'], [0, 'M6'], [7, 'D7']],
  xm1: [[0, 'M'], [5, 'M'], [0, 'M'], [7, 'M']], xm2: [[0, 'M'], [9, 'm'], [5, 'M'], [7, 'D7']], xm3: [[0, 'M'], [0, 'D7'], [5, 'M'], [5, 'm']], xm4: [[0, 'M6'], [4, 'm7'], [5, 'M7'], [7, 'D7']], xm5: [[0, 'add9'], [7, 'M'], [9, 'm'], [4, 'm'], [5, 'M'], [0, 'M'], [5, 'M'], [7, 'D7']]
};
// 1曲の定義を作る（季節の既定に曲ごとの差分を重ねる）
const S = (season, n, title, o) => ({ id: `${season}${n}`, season, title, seed: (season.charCodeAt(0) * 131 + n * 977 + 7), ...o });
export const LD_SONGS = {
  spring: [
    S('spring', 1, 'Sakura Breeze', { bpm: 112, key: 62, prog: PROG.pop1, inst: 'guitar', lead: 'piano', rh: 'pop' }),
    S('spring', 2, '菜の花ライン', { bpm: 104, key: 65, prog: PROG.pop3, inst: 'piano', lead: 'flute', rh: 'pop' }),
    S('spring', 3, 'Morning Petal Drive', { bpm: 120, key: 60, prog: PROG.pop4, inst: 'guitar', lead: 'whistle', rh: 'shuffle' }),
    S('spring', 4, '春風ハイウェイ', { bpm: 116, key: 67, prog: PROG.pop2, inst: 'guitar', lead: 'piano', rh: 'pop' }),
    S('spring', 5, 'Blue Sky Picnic', { bpm: 98, key: 64, prog: PROG.pop6, inst: 'piano', lead: 'glock', rh: 'light' }),
    S('spring', 6, 'はなさき盆地へ', { bpm: 108, key: 57, prog: PROG.pop5, inst: 'guitar', lead: 'flute', rh: 'pop' }),
    S('spring', 7, 'Cherry Tunnel Waltz', { bpm: 132, key: 65, prog: PROG.pop3, inst: 'piano', lead: 'piano', rh: 'waltz', meter: 3 }),
    S('spring', 8, 'Spring Window', { bpm: 94, key: 62, prog: PROG.pop2, inst: 'piano', lead: 'flute', rh: 'light' }),
    S('spring', 9, '城下町スキップ', { bpm: 126, key: 60, prog: PROG.pop1, inst: 'guitar', lead: 'whistle', rh: 'shuffle' }),
    S('spring', 10, 'Hanami Road Trip', { bpm: 114, key: 63, prog: PROG.pop4, inst: 'guitar', lead: 'piano', rh: 'pop' })
  ],
  summer: [
    S('summer', 1, 'Shiosai Highway', { bpm: 124, key: 64, prog: PROG.sum1, inst: 'pan', lead: 'brass', rh: 'tropic' }),
    S('summer', 2, '青凪サンセット', { bpm: 102, key: 62, prog: PROG.sum2, inst: 'pan', lead: 'pan', rh: 'tropic' }),
    S('summer', 3, 'Coconut Breeze', { bpm: 116, key: 67, prog: PROG.sum3, inst: 'guitar', lead: 'brass', rh: 'tropic' }),
    S('summer', 4, '波音ドライブ', { bpm: 130, key: 65, prog: PROG.sum4, inst: 'pan', lead: 'whistle', rh: 'surf' }),
    S('summer', 5, 'Tropical Bypass', { bpm: 120, key: 60, prog: PROG.pop1, inst: 'pan', lead: 'brass', rh: 'surf' }),
    S('summer', 6, 'Summer Chorus Line', { bpm: 110, key: 64, prog: PROG.sum1, inst: 'guitar', lead: 'choir', rh: 'tropic' }),
    S('summer', 7, '汐見ハーバー', { bpm: 96, key: 69, prog: PROG.sum2, inst: 'pan', lead: 'pan', rh: 'reggae' }),
    S('summer', 8, 'Sunshine Steel Pan', { bpm: 118, key: 62, prog: PROG.sum3, inst: 'pan', lead: 'pan', rh: 'tropic' }),
    S('summer', 9, '入道雲を追いかけて', { bpm: 136, key: 67, prog: PROG.pop5, inst: 'guitar', lead: 'brass', rh: 'surf' }),
    S('summer', 10, 'Beach Radio', { bpm: 106, key: 65, prog: PROG.sum4, inst: 'pan', lead: 'choir', rh: 'reggae' })
  ],
  autumn: [
    S('autumn', 1, 'Kaede Bossa', { bpm: 88, key: 62, prog: PROG.bos1, inst: 'nylon', lead: 'flute', rh: 'bossa' }),
    S('autumn', 2, '紅葉トンネル', { bpm: 96, key: 65, prog: PROG.jaz1, inst: 'nylon', lead: 'vibes', rh: 'bossa' }),
    S('autumn', 3, 'Mountain Café', { bpm: 104, key: 60, prog: PROG.jaz2, inst: 'epiano', lead: 'sax', rh: 'swing' }),
    S('autumn', 4, 'Amber Road', { bpm: 84, key: 63, prog: PROG.jaz3, inst: 'nylon', lead: 'flute', rh: 'bossa' }),
    S('autumn', 5, '渓谷のボサノバ', { bpm: 92, key: 57, prog: PROG.bos1, inst: 'nylon', lead: 'vibes', rh: 'bossa' }),
    S('autumn', 6, 'Slow Curve Jazz', { bpm: 100, key: 65, prog: PROG.jaz4, inst: 'epiano', lead: 'sax', rh: 'swing' }),
    S('autumn', 7, '山あいの夕べ', { bpm: 78, key: 62, prog: PROG.jaz3, inst: 'epiano', lead: 'vibes', rh: 'ballad' }),
    S('autumn', 8, 'Brushwork Sunday', { bpm: 112, key: 67, prog: PROG.jaz2, inst: 'epiano', lead: 'sax', rh: 'swing' }),
    S('autumn', 9, 'Cinnamon Valley', { bpm: 90, key: 60, prog: PROG.jaz1, inst: 'nylon', lead: 'flute', rh: 'bossa' }),
    S('autumn', 10, '楓見ワルツ', { bpm: 120, key: 65, prog: PROG.jaz4, inst: 'epiano', lead: 'vibes', rh: 'jwaltz', meter: 3 })
  ],
  winter: [
    S('winter', 1, 'Snowlight Bells', { bpm: 112, key: 67, prog: PROG.xm1, inst: 'strings', lead: 'bell', rh: 'sleigh' }),
    S('winter', 2, '雪灯りのワルツ', { bpm: 126, key: 65, prog: PROG.xm4, inst: 'strings', lead: 'bell', rh: 'waltz', meter: 3 }),
    S('winter', 3, 'Silver Sleigh Road', { bpm: 128, key: 62, prog: PROG.xm2, inst: 'piano', lead: 'glock', rh: 'sleigh' }),
    S('winter', 4, '白銀ホリデー', { bpm: 118, key: 60, prog: PROG.xm5, inst: 'strings', lead: 'choir', rh: 'sleigh' }),
    S('winter', 5, 'Hot Cocoa Drive', { bpm: 96, key: 65, prog: PROG.xm3, inst: 'piano', lead: 'bell', rh: 'light' }),
    S('winter', 6, 'Winter Candle', { bpm: 84, key: 63, prog: PROG.xm4, inst: 'strings', lead: 'choir', rh: 'ballad' }),
    S('winter', 7, '温泉郷の灯', { bpm: 92, key: 62, prog: PROG.xm2, inst: 'piano', lead: 'bell', rh: 'light' }),
    S('winter', 8, 'Frosty Window', { bpm: 120, key: 67, prog: PROG.xm1, inst: 'strings', lead: 'glock', rh: 'sleigh' }),
    S('winter', 9, 'Twinkle Highway', { bpm: 132, key: 64, prog: PROG.xm5, inst: 'piano', lead: 'bell', rh: 'sleigh' }),
    S('winter', 10, '雪見野キャロル', { bpm: 108, key: 60, prog: PROG.xm3, inst: 'strings', lead: 'choir', rh: 'waltz', meter: 3 })
  ]
};
// 休憩ムービー用（季節ごとに穏やかなアレンジ。施設の種類で編成を少し変える）
export const LD_REST = {
  spring: S('spring', 'R', '休憩：花見ラウンジ', { bpm: 80, key: 62, prog: PROG.pop6, inst: 'piano', lead: 'flute', rh: 'calm', rest: true }),
  summer: S('summer', 'R', '休憩：潮風テラス', { bpm: 84, key: 64, prog: PROG.sum2, inst: 'pan', lead: 'pan', rh: 'calm', rest: true }),
  autumn: S('autumn', 'R', '休憩：もみじ茶屋', { bpm: 76, key: 60, prog: PROG.jaz3, inst: 'nylon', lead: 'vibes', rh: 'calm', rest: true }),
  winter: S('winter', 'R', '休憩：ぬくもり食堂', { bpm: 78, key: 65, prog: PROG.xm4, inst: 'strings', lead: 'bell', rh: 'calm', rest: true })
};
// 到着テーマ（最初に短いファンファーレ、そのあと穏やかな曲をくり返す）
export const LD_ARRIVE = {
  spring: S('spring', 'A', '到着：桜ヶ丘の春', { bpm: 88, key: 65, prog: PROG.pop3, inst: 'guitar', lead: 'piano', rh: 'calm', fanfare: 'brass' }),
  summer: S('summer', 'A', '到着：高原の夏休み', { bpm: 92, key: 67, prog: PROG.sum1, inst: 'pan', lead: 'pan', rh: 'calm', fanfare: 'brass' }),
  autumn: S('autumn', 'A', '到着：楓見の夕べ', { bpm: 80, key: 62, prog: PROG.jaz3, inst: 'nylon', lead: 'vibes', rh: 'calm', fanfare: 'vibes' }),
  winter: S('winter', 'A', '到着：雪灯の湯', { bpm: 84, key: 60, prog: PROG.xm4, inst: 'strings', lead: 'bell', rh: 'calm', fanfare: 'bell' })
};
const SEASON_KEYS = ['spring', 'summer', 'autumn', 'winter'];

// ---- シャッフル袋：一巡するまで同じ曲を出さず、巡目の境目でも直前と同じ曲を出さない ----
export class ShuffleBag {
  constructor(n, rnd = Math.random, last = -1) { this.n = n; this.rnd = rnd; this.last = last; this.bag = []; }
  refill() { const a = []; for (let i = 0; i < this.n; i++) a.push(i); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    if (this.n > 1 && a[a.length - 1] === this.last) { const j = Math.floor(this.rnd() * (a.length - 1)); [a[a.length - 1], a[j]] = [a[j], a[a.length - 1]]; } // 末尾から取り出すので、最初に出る曲が直前と同じにならないよう入れ替え
    this.bag = a; }
  next() { if (!this.bag.length) this.refill(); const i = this.bag.pop(); this.last = i; return i; }
}

// ---- メロディ（季節ごとの音階とリズムの型。2小節フレーズを A A' B A ... と並べる） ----
const RHY = {
  4: { pop: ['1001001010000100', '1000101000101000', '0010100100100100', '1010001000101000'], light: ['1000001000100000', '1000100010000010', '0010001010000000'],
    shuffle: ['1001001010010010', '1000101010001000', '1001001000100100'], tropic: ['1001001010000100', '0010100100101000', '1010001010100000'], surf: ['1010101000101000', '1000101010101000', '1011001010000000'],
    reggae: ['0010001000100010', '1000001000100000', '0010100000101000'], bossa: ['1000001000100000', '1001000010000010', '0010000010100000'], swing: ['1000101000001010', '1010000010001000', '0000101010001000'],
    ballad: ['1000000010000000', '1000001000000000', '0000100000100000'], sleigh: ['1010101010000000', '1000101000101000', '1010100010100000'], calm: ['1000000010000000', '1000001000000000', '0000000010000000'] },
  3: { waltz: ['100000100010', '100010001000', '100000001000'], jwaltz: ['100000101000', '100010000010', '001000100000'] }
};
const SCALE = { spring: [0, 2, 4, 7, 9], summer: [0, 2, 4, 5, 7, 9, 11], autumn: [0, 2, 3, 4, 5, 7, 9, 10, 11], winter: [0, 2, 4, 5, 7, 9, 11] };
// 2小節のモチーフ（リズム＋音の上下の動き）を A A' B A C C' B A'' と並べ、各小節の実際の和音に合わせて音高を決める
// （強拍は和音の音、弱拍は季節の音階の音。モチーフを繰り返しても和音とぶつからない）
function makeMelody(song) {
  const sd = Number.isFinite(song.seed) ? song.seed : [...String(song.id)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 100003, 7); // 修正103：休憩・到着の曲は seed を持たない（null）ので id から作る（以前は NaN で旋律の生成が例外になり無音だった）
  const R = seeded(sd * 31 + 5), M = song.meter || 4, spBar = M * 4, pool = RHY[M][song.rh] || (M === 3 ? RHY[3].waltz : RHY[4].pop);
  const scale = SCALE[song.season] || SCALE.spring, key = song.key, len = song.prog.length;
  const motif = () => { const bars = []; for (let b = 0; b < 2; b++) { const r = pool[Math.floor(R() * pool.length)], steps = []; for (let st = 0; st < spBar; st++) steps.push(r[st] === '1' ? Math.round((R() - 0.45) * 4) : null); bars.push(steps); } return bars; };
  const A = motif(), B = motif(), C = motif(), A2 = [A[0], motif()[1]], A3 = [A[0], A[1].map(x => x == null ? x : x + (R() < 0.3 ? 1 : 0))], C2 = [C[0], motif()[1]];
  const form = [A, A2, B, A, C, C2, B, A3], nBars = len === 6 ? 24 : 32, mel = [];
  let last = key + 16;
  for (let j = 0; j < nBars; j++) { const mot = form[Math.floor(j / 2) % form.length][j % 2], ch = song.prog[(j + 2) % len], tones = CH[ch[1]].map(x => (x + ch[0]) % 12), notes = [];
    for (let st = 0; st < spBar; st++) { const d = mot[st]; if (d == null) { notes.push(null); continue; }
      const strong = st % (M === 3 ? 4 : 8) === 0, want = last + d * 2; let best = last, bd = 1e9;
      for (let n = key + 7; n <= key + 26; n++) { const pc = ((n - key) % 12 + 12) % 12, isC = tones.includes(pc); if (!(strong ? isC : isC || scale.includes(pc))) continue; const dd = Math.abs(n - want) + (isC ? 0 : 0.6); if (dd < bd) { bd = dd; best = n; } }
      last = best; notes.push(best); }
    mel.push(notes); }
  return mel;
}

// ---- 再生エンジン ----
export class LDMusic {
  constructor(snd) { this.snd = snd; this.ctx = null; this.on = true; this.vol = 0.5; this.season = 'spring'; this.scene = 'none'; this.cur = null; this.history = []; this.onTrack = null; this.bag = null; this.opt = {}; this.voices = 0; }
  init() {
    if (this.ctx || !this.snd || !this.snd.ok) return !!this.ctx;
    const ctx = this.ctx = this.snd.ctx;
    this.out = ctx.createGain(); this.out.gain.value = 0; this.out.connect(this.snd.master);
    // 簡易リバーブ（2本のフィードバックディレイ）。冬・秋は少し深め
    this.bus = ctx.createGain(); this.bus.connect(this.out);
    this.wet = ctx.createGain(); this.wet.gain.value = 0.22; this.wet.connect(this.out);
    for (const [t, fbv] of [[0.19, 0.3], [0.27, 0.28]]) { const dl = ctx.createDelay(1), fb = ctx.createGain(), lp = ctx.createBiquadFilter(); dl.delayTime.value = t; fb.gain.value = fbv; lp.type = 'lowpass'; lp.frequency.value = 2600; this.bus.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(this.wet); }
    const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noise = nb;
    this.timer = setInterval(() => this.sched(), 25);
    if (this.scene !== 'none') this.start(this.pickFor(this.scene), 0.05);
    return true;
  }
  setSeason(se) { if (!LD_SONGS[se]) se = 'spring'; if (se === this.season && this.bag) return; this.season = se; this.bag = new ShuffleBag(LD_SONGS[se].length);
    if (this.cur && this.scene !== 'none') { this.scene = 'none'; this.fadeTo(null, 0.3); } } // 別の季節で始め直したとき、前の季節の曲を引きずらない（次の setScene で新しい季節の曲から）
  setVol(v) { this.vol = v; if (this.ctx && this.cur && this.on) this.out.gain.setTargetAtTime(this.level(), this.ctx.currentTime, 0.3); }
  level() { return this.vol * 1.4; } // 修正122：既定の出力を引き上げ（旧 vol×0.5×BGM音量0.5＝0.25 → 長距離BGM音量の既定0.8×1.4＝1.12、約+13dB）。100km/h巡航の走行音とほぼ同じ大きさ（自己テストで計測）
  setOn(on) { on = !!on; if (on === this.on) return; this.on = on;
    if (!on) { this.fadeTo(null, 0.4); return; }
    if (this.scene !== 'none') this.start(this.pickFor(this.scene), 0.6); }
  // 'drive' | 'rest' | 'arrive' | 'none'
  setScene(scene, opt = {}) { if (scene === this.scene && scene !== 'rest') return this.cur; this.scene = scene; this.opt = opt;
    if (scene === 'none') { this.fadeTo(null, 1.2); return null; }
    return this.start(this.pickFor(scene), 1.2); }
  pickFor(scene) { if (!this.bag) this.setSeason(this.season);
    if (scene === 'rest') return LD_REST[this.season]; if (scene === 'arrive') return LD_ARRIVE[this.season];
    const i = this.bag.next(), s = LD_SONGS[this.season][i]; this.history.push(s.id); return s; }
  next() { if (this.scene !== 'drive') return this.cur; return this.start(this.pickFor('drive'), 0.25); }
  current() { return this.cur ? { id: this.cur.id, title: this.cur.title, season: this.cur.season, scene: this.scene } : null; }
  stop() { this.scene = 'none'; this.fadeTo(null, 0.3); }
  update() { }
  // 曲の切り替え：今の曲をフェードアウト → 新しい曲を頭からフェードイン（OFF のときは曲だけ記録して鳴らさない）
  start(song, fade) {
    this.cur = song; if (this.onTrack && song) try { this.onTrack(song, this.scene); } catch (e) { /* UI 側の例外で音を止めない */ }
    if (!this.ctx) return song;
    if (!this.on) { this.fadeTo(null, 0.3); return song; }
    this.fadeTo(song, fade); return song;
  }
  fadeTo(song, fade) {
    if (!this.ctx) return; const t = this.ctx.currentTime, g = this.out.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(Math.max(0.0001, g.value), t); g.linearRampToValueAtTime(0.0001, t + fade);
    this.play = null; // フェードアウトの間は新しい音を出さない（鳴っている音は自然に減衰）
    clearTimeout(this.fadeH);
    this.fadeH = setTimeout(() => { if (!song || this.cur !== song || !this.on) return; const t2 = this.ctx.currentTime;
      this.play = { song, mel: makeMelody(song), step: 0, next: t2 + 0.08, spb: 60 / song.bpm / 4, meter: song.meter || 4, bars: song.rest || song.fanfare ? 1e9 : Math.max(24, Math.round(150 * song.bpm / 60 / (song.meter || 4))), fan: song.fanfare ? 1 : 0 };
      g.cancelScheduledValues(t2); g.setValueAtTime(0.0001, t2); g.linearRampToValueAtTime(this.level(), t2 + Math.min(1.5, fade + 0.3)); }, fade * 1000 + 30);
  }
  sched() {
    const P = this.play; if (!P || !this.ctx) return;
    const now = this.ctx.currentTime;
    while (P.next < now + 0.15) {
      const spBar = P.meter * 4, bar = Math.floor(P.step / spBar);
      if (bar >= P.bars) { // 曲の終わり：最後の小節で減衰させて、シャッフルの次の曲へ
        this.play = null; if (this.scene === 'drive') this.start(this.pickFor('drive'), 1.0); return; }
      this.note(P, P.step, P.next); P.step++; P.next += P.spb;
    }
  }
  // ---- 音色 ----
  env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  osc(type, f, t, dur, peak, a, dec, filt, detune = 0, dest = this.bus) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; if (detune) o.detune.value = detune;
    let n = o; if (filt) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filt; o.connect(fl); n = fl; }
    n.connect(g); g.connect(dest); this.env(g, t, a, peak, dec); o.start(t); o.stop(t + Math.max(dur, a + dec) + 0.05);
  }
  noiseHit(t, type, f, q, vol, dec, off = 0) { const ctx = this.ctx, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = this.noise; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.004 + off); g.gain.exponentialRampToValueAtTime(0.0001, t + dec); s.connect(fl); fl.connect(g); g.connect(this.bus); s.start(t, Math.random() * 0.5); s.stop(t + dec + 0.05); }
  inst(kind, n, t, len, vel = 1) {
    const f = mtof(n);
    switch (kind) {
      case 'piano': this.osc('triangle', f, t, len, 0.09 * vel, 0.004, len * 1.6, 3000); this.osc('sine', f * 2, t, len, 0.03 * vel, 0.004, len * 0.6); break;
      case 'guitar': this.osc('sawtooth', f, t, len, 0.05 * vel, 0.003, Math.min(0.9, len * 1.3), 1800); this.osc('triangle', f * 2, t, len, 0.02 * vel, 0.002, 0.25); break; // アコースティックギター風（はじいた音）
      case 'nylon': this.osc('triangle', f, t, len, 0.09 * vel, 0.006, Math.min(1.1, len * 1.5), 1400); this.osc('sine', f * 2, t, len, 0.02 * vel, 0.004, 0.3); break;
      case 'epiano': this.osc('sine', f, t, len, 0.08 * vel, 0.006, len * 1.8); this.osc('sine', f * 3.01, t, len, 0.015 * vel, 0.002, 0.35); break;
      case 'pan': this.osc('sine', f, t, len, 0.09 * vel, 0.003, 0.7); this.osc('sine', f * 2.0, t, len, 0.04 * vel, 0.003, 0.45); this.osc('sine', f * 3.01, t, len, 0.015 * vel, 0.002, 0.25); break; // スティールパン風
      case 'brass': this.osc('sawtooth', f, t, len, 0.05 * vel, 0.03, len * 0.9, 1500, -6); this.osc('sawtooth', f, t, len, 0.05 * vel, 0.03, len * 0.9, 1500, 7); break; // ブラス風のスタブ
      case 'flute': this.osc('sine', f, t, len, 0.09 * vel, 0.05, len * 1.2); this.osc('triangle', f * 2, t, len, 0.012 * vel, 0.05, len); break;
      case 'whistle': this.osc('sine', f * 2, t, len, 0.06 * vel, 0.03, len * 1.1); break;
      case 'glock': this.osc('sine', f * 2, t, len, 0.06 * vel, 0.002, 0.9); this.osc('sine', f * 2 * 2.76, t, len, 0.012 * vel, 0.002, 0.3); break;
      case 'bell': this.osc('sine', f * 2, t, len, 0.07 * vel, 0.002, 1.4); this.osc('sine', f * 2 * 2.76, t, len, 0.02 * vel, 0.002, 0.6); this.osc('sine', f * 2 * 5.4, t, len, 0.006 * vel, 0.001, 0.25); break; // ベル風
      case 'vibes': this.osc('sine', f, t, len, 0.08 * vel, 0.003, 1.2); this.osc('sine', f * 4, t, len, 0.012 * vel, 0.002, 0.3); break;
      case 'sax': this.osc('sawtooth', f, t, len, 0.04 * vel, 0.04, len * 1.1, 1200); this.osc('square', f, t, len, 0.015 * vel, 0.04, len, 900); break;
      case 'choir': for (const dt of [-8, 8]) this.osc('triangle', f, t, len, 0.035 * vel, 0.15, len * 1.4, 1100, dt); break; // コーラス風（ゆっくり立ち上がる2声）
      case 'strings': for (const dt of [-9, 9]) this.osc('sawtooth', f, t, len, 0.016 * vel, 0.25, len * 1.2, 1300, dt); break;
      default: this.osc('triangle', f, t, len, 0.08 * vel, 0.005, len);
    }
  }
  // 1ステップ（16分音符）ぶんの演奏
  note(P, step, t) {
    const song = P.song, M = P.meter, spBar = M * 4, st = step % spBar, bi = Math.floor(step / spBar), spb = P.spb, se = song.season, rh = song.rh, calm = rh === 'calm' || rh === 'ballad';
    const ch = song.prog[bi % song.prog.length], root = song.key + ch[0], tones = CH[ch[1]];
    const last = bi >= P.bars - 1, intro = bi < 2, vel = last ? Math.max(0.15, 1 - st / spBar) : 1;
    // 到着テーマの冒頭：短いファンファーレ（主和音の分散 → 和音の伸ばし）
    if (P.fan && bi < 2) { if (bi === 0 && st % 2 === 0 && st < 12) { const k = st / 2; this.inst(song.fanfare, root + 12 + [0, 4, 7, 12, 7, 12][k], t, spb * 2, 1.2); }
      if (bi === 1 && st === 0) for (const iv of [0, 4, 7, 12]) this.inst(song.fanfare, root + 12 + iv, t, spb * 14, 1); return; }
    // ---- リズム ----
    const R4 = (p) => p[st] === '1';
    if (!calm && !(intro && st % 4)) {
      if (rh === 'pop' || rh === 'shuffle' || rh === 'surf') { if (R4('1000001010000000')) this.kick(t, 0.5); if (R4('0000100000001000')) this.noiseHit(t, 'bandpass', 1900, 0.8, 0.12, 0.14); if (st % 2 === 0) this.noiseHit(t, 'highpass', 7500, 1, st % 4 === 2 ? 0.05 : 0.03, 0.04); if (rh === 'surf' && st % 2 === 1) this.noiseHit(t, 'highpass', 6000, 1, 0.025, 0.05); }
      if (rh === 'light') { if (R4('1000000010000000')) this.kick(t, 0.35); if (st % 4 === 2) this.noiseHit(t, 'highpass', 8000, 1, 0.03, 0.05); }
      if (rh === 'tropic' || rh === 'reggae') { // トロピカル：コンガ/ボンゴ風・シェイカー・リムショット
        if (R4(rh === 'reggae' ? '0000000010000000' : '1000001010000000')) this.kick(t, 0.45);
        if (R4('0010001000100110')) this.conga(t, R4('0000000000000100') ? 330 : 220);
        if (R4('1001000010100000')) this.conga(t, 400, 0.08);
        this.noiseHit(t, 'bandpass', 5200, 1.5, st % 4 === 2 ? 0.05 : 0.025, 0.06, 0.01); // シェイカー
        if (R4('0000100000001000')) this.noiseHit(t, 'bandpass', 2400, 3, 0.08, 0.05); }
      if (rh === 'bossa') { // ボサノバ：ブラシ・リムのクラーベ・低いキック
        if (R4('1000001010000010')) this.kick(t, 0.28); if (R4('1001001000100100')) this.noiseHit(t, 'bandpass', 1700, 4, 0.05, 0.04);
        this.noiseHit(t, 'bandpass', 3500, 0.7, 0.022, spb * 1.8, 0.02); }
      if (rh === 'swing') { if (R4('1000000010000000')) this.kick(t, 0.25); if (R4('1000101110001011')) this.noiseHit(t, 'highpass', 6000, 1, 0.035, 0.12); if (R4('0000100000001000')) this.noiseHit(t, 'bandpass', 2200, 0.6, 0.06, 0.25, 0.03); }
      if (rh === 'sleigh') { if (R4('1000000010000000')) this.kick(t, 0.4); if (R4('0000100000001000')) this.noiseHit(t, 'bandpass', 1900, 0.8, 0.09, 0.14); if (st % 2 === 0) { this.noiseHit(t, 'highpass', 8500, 2, 0.05, 0.09); this.noiseHit(t + spb * 0.5, 'highpass', 9500, 2, 0.03, 0.06); } } // スレイベル風
      if (rh === 'waltz' || rh === 'jwaltz') { if (st === 0) this.kick(t, 0.35); if (st === 4 || st === 8) this.noiseHit(t, rh === 'jwaltz' ? 'bandpass' : 'highpass', rh === 'jwaltz' ? 3000 : 7000, 1, 0.04, 0.12); if (se === 'winter' && st % 2 === 0) this.noiseHit(t, 'highpass', 9000, 2, 0.03, 0.07); }
    }
    // ---- ベース ----
    const bRoot = root - 24 + (ch[0] > 6 ? -12 : 0);
    if (M === 3) { if (st === 0) this.osc('triangle', mtof(bRoot), t, spb * 4, 0.2 * vel, 0.01, spb * 4, 600); }
    else if (rh === 'swing' || (se === 'autumn' && !calm)) { if (st % 4 === 0) { const wk = [0, tones[1] || 4, 7, ch[1].includes('m') ? 10 : 9][st / 4 | 0]; this.osc('triangle', mtof(bRoot + wk), t, spb * 3.5, 0.2 * vel, 0.01, spb * 3.5, 700); } } // ウォーキングベース
    else if (rh === 'reggae') { if (st === 0 || st === 10) this.osc('sine', mtof(bRoot), t, spb * 3, 0.26 * vel, 0.01, spb * 3); }
    else if (calm) { if (st === 0) this.osc('triangle', mtof(bRoot), t, spb * 12, 0.15 * vel, 0.02, spb * 12, 500); }
    else if (R4('1000001010001000')) this.osc(se === 'summer' ? 'sine' : 'triangle', mtof(bRoot + (st === 10 ? 7 : 0)), t, spb * 2.5, 0.22 * vel, 0.006, spb * 2.5, 650);
    // ---- 和音（編成ごとの伴奏） ----
    const chordN = iv => root + iv + (root + iv < song.key + 2 ? 12 : 0);
    const inst = song.inst;
    if (inst === 'guitar') { const pat = M === 3 ? '100010001000' : calm ? '1000000010000000' : '1000101000101010'; if (pat[st] === '1') tones.forEach((iv, k) => this.inst('guitar', chordN(iv), t + k * 0.014 * (st % 4 === 2 ? -1 : 1) + (st % 4 === 2 ? 0.04 : 0), spb * 2, 0.8 * vel)); } // ストローク
    else if (inst === 'piano') { const pat = M === 3 ? '100010001000' : calm ? '1000000000000000' : '1000001000100000'; if (pat[st] === '1') tones.forEach(iv => this.inst('piano', chordN(iv), t, spb * (calm ? 14 : 4), 0.55 * vel)); }
    else if (inst === 'nylon') { const pat = M === 3 ? '100010001000' : '1001001000100100'; if (pat[st] === '1') tones.slice(st ? 1 : 0, st ? 4 : 2).forEach(iv => this.inst('nylon', chordN(iv), t, spb * 3, 0.6 * vel)); }
    else if (inst === 'epiano') { const pat = M === 3 ? '100000001000' : rh === 'swing' ? '0010000000100000' : '1000000010000000'; if (pat[st] === '1') tones.forEach(iv => this.inst('epiano', chordN(iv), t, spb * 6, 0.5 * vel)); }
    else if (inst === 'pan') { const pat = M === 3 ? '100010001000' : calm ? '1000000010000000' : rh === 'reggae' ? '0000100000001000' : '0010001000100010'; if (pat[st] === '1') tones.slice(0, 3).forEach(iv => this.inst(rh === 'reggae' ? 'guitar' : 'pan', chordN(iv), t, spb * 2, 0.45 * vel)); }
    else if (inst === 'strings') { if (st === 0) tones.slice(0, 4).forEach(iv => this.inst('strings', chordN(iv), t, spb * spBar, vel)); }
    // 夏：ブラス風のスタブとコーラス風パッド／冬：コーラスのパッドとベルの合いの手／春：グロッケンのきらめき
    if (se === 'summer' && !calm && !intro) { if ((bi % 4 === 3) && (st === 6 || st === 10)) tones.slice(0, 3).forEach(iv => this.inst('brass', chordN(iv) + 12, t, spb * 1.2, 0.8)); if (st === 0) tones.slice(0, 3).forEach(iv => this.inst('choir', chordN(iv), t, spb * spBar, 0.5)); }
    if (se === 'winter' && st === 0) tones.slice(0, 3).forEach(iv => this.inst('choir', chordN(iv), t, spb * spBar, calm ? 0.6 : 0.45));
    if (se === 'winter' && !calm && bi % 2 === 1 && st === spBar - 4) this.inst('bell', root + 24, t, spb * 4, 0.6);
    if (se === 'spring' && !intro && bi % 4 === 3 && st >= spBar - 4 && st % 2 === 0) this.inst('glock', root + 12 + tones[(st / 2) % tones.length], t, spb * 2, 0.5);
    if (se === 'autumn' && calm && st === 0) tones.forEach(iv => this.inst('epiano', chordN(iv), t, spb * spBar, 0.4));
    // ---- メロディ（3小節目以降） ----
    if (bi >= 2 && !(last && st > spBar / 2)) {
      const mb = P.mel[(bi - 2) % P.mel.length], n = mb && mb[st]; // mel[j] は song.prog[(j+2)%len] の和音に合わせてある
      if (n) { const len = spb * (calm ? 6 : song.lead === 'brass' ? 2 : 3); this.inst(song.lead, n, t, len, vel * (calm ? 0.8 : 1)); }
    }
  }
  kick(t, vol) { const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.26); o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + 0.28); }
  conga(t, f, vol = 0.12) { const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f * 1.4, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.03); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + 0.2); }
}
export const LD_SEASONS = SEASON_KEYS;
