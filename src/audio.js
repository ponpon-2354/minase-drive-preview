// サウンド：WebAudioによる合成音（仮素材。外部音声ファイルは未使用）
export class Sound {
  constructor() { this.ok = false; this.vol = 0.7; }
  init() {
    if (this.ok) { this.ctx.resume?.(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const ctx = this.ctx = new AC();
      const master = this.master = ctx.createGain(); master.gain.value = this.vol; master.connect(ctx.destination);
      const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const noise = () => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(); return s; };
      const chain = (src, type, f, q, g) => { const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const gn = ctx.createGain(); gn.gain.value = g; src.connect(fl); fl.connect(gn); gn.connect(master); return { fl, gn }; };
      // エンジン（3気筒：点火周波数 = rpm/60*1.5）
      const eg = ctx.createGain(); eg.gain.value = 0; const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 800; ef.Q.value = 2;
      // 3気筒らしい「ブルブル」：クランク1回転ごとの脈動（点火周波数の1/3）で音量を揺らす
      const am = ctx.createGain(); am.gain.value = 1; this.amLfo = ctx.createOscillator(); this.amLfo.type = 'sine'; this.amDepth = ctx.createGain(); this.amDepth.gain.value = 0.2; this.amLfo.connect(this.amDepth); this.amDepth.connect(am.gain); this.amLfo.start();
      ef.connect(am); am.connect(eg); eg.connect(master);
      // 高回転の乾いた唸り（ソフトクリップした倍音）
      const ws = ctx.createWaveShaper(), cv = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; cv[i] = Math.tanh(x * 4) * 0.8; } ws.curve = cv;
      const gf = ctx.createBiquadFilter(); gf.type = 'bandpass'; gf.frequency.value = 900; gf.Q.value = 1.2; this.growl = ctx.createGain(); this.growl.gain.value = 0;
      this.growlF = gf;
      this.o1 = ctx.createOscillator(); this.o1.type = 'sawtooth'; this.o2 = ctx.createOscillator(); this.o2.type = 'square'; this.o3 = ctx.createOscillator(); this.o3.type = 'triangle';
      const g1 = ctx.createGain(); g1.gain.value = 0.5; const g2 = ctx.createGain(); g2.gain.value = 0.25; const g3 = ctx.createGain(); g3.gain.value = 0.4;
      this.o1.connect(g1); this.o2.connect(g2); this.o3.connect(g3); g1.connect(ef); g2.connect(ef); g3.connect(ef);
      g1.connect(ws); ws.connect(gf); gf.connect(this.growl); this.growl.connect(master);
      this.o1.start(); this.o2.start(); this.o3.start();
      const en = chain(noise(), 'bandpass', 300, 1, 0); en.fl.disconnect(); en.fl.connect(ef); this.engNoise = en;
      this.eg = eg; this.ef = ef;
      this.road = chain(noise(), 'lowpass', 380, 0.7, 0);
      this.roar = chain(noise(), 'lowpass', 140, 0.9, 0); // 高速域の「ゴーッ」（防音材の薄い軽自動車）
      this.wind = chain(noise(), 'bandpass', 1100, 0.6, 0);
      this.rain = chain(noise(), 'highpass', 2500, 0.4, 0);
      this.city = chain(noise(), 'lowpass', 220, 0.5, 0);
      this.npc = chain(noise(), 'lowpass', 160, 1.5, 0);
      this.squeal = chain(noise(), 'bandpass', 2600, 8, 0);
      this.npcHum = ctx.createOscillator(); this.npcHum.type = 'sawtooth'; this.npcHum.frequency.value = 55;
      const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 180; this.npcG = ctx.createGain(); this.npcG.gain.value = 0;
      this.npcHum.connect(nf); nf.connect(this.npcG); this.npcG.connect(master); this.npcHum.start();
      // クラクション
      this.hg = ctx.createGain(); this.hg.gain.value = 0; const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 2200; hf.connect(this.hg); this.hg.connect(master);
      for (const f of [415, 500]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = 0.12; o.connect(g); g.connect(hf); o.start(); }
      this.ok = true;
    } catch (e) { console.warn('audio', e); }
  }
  setVol(v) { this.vol = v; if (this.ok) this.master.gain.value = v; }
  tick() { // ウインカー音
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = 1500; g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.04);
  }
  thump(k) {
    if (!this.ok || k < 0.05) return;
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    g.gain.setValueAtTime(Math.min(0.6, k), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.32);
  }
  update(s) { // s: {rpm, thr, kmh, brake, slip, rain, horn, npcNear, cityK, cockpit, engine}
    if (!this.ok) return;
    const t = this.ctx.currentTime, k = 0.06;
    const f = Math.max(10, s.rpm) / 60 * 1.5;
    this.o1.frequency.setTargetAtTime(f, t, 0.03); this.o2.frequency.setTargetAtTime(f * 0.5, t, 0.03); this.o3.frequency.setTargetAtTime(f * 2, t, 0.03);
    this.amLfo.frequency.setTargetAtTime(f / 3, t, 0.03); this.amDepth.gain.setTargetAtTime(0.12 + Math.min(1, s.rpm / 6800) * 0.25, t, 0.1);
    this.engNoise.fl.frequency.setTargetAtTime(f * 3, t, 0.05);
    const ins = s.cockpit ? 0.8 : 1;
    this.ef.frequency.setTargetAtTime((350 + s.rpm * 0.22 + s.thr * 900) * ins, t, 0.05);
    const eng = s.engine ?? 1; // 0：メニュー中・アイドリングストップ中はエンジン音を止める
    const hi = Math.max(0, (s.rpm - 3800) / 3000); // 高回転ほど3気筒の唸りを強く
    this.eg.gain.setTargetAtTime((0.09 + s.thr * 0.14 + s.rpm / 6800 * 0.1) * (s.thr < 0.05 && s.kmh > 10 ? 0.65 : 1) * eng, t, eng < 1 ? 0.12 : k);
    this.engNoise.gn.gain.setTargetAtTime((0.05 + s.thr * 0.12) * eng, t, k);
    this.growl.gain.setTargetAtTime(Math.min(0.12, hi * hi * 0.12 * (0.4 + s.thr * 0.6)) * eng, t, 0.08); this.growlF.frequency.setTargetAtTime(600 + s.rpm * 0.12, t, 0.08);
    // ロードノイズと風切り音：50〜60km/hを境に大きく混ぜる
    const v = s.kmh / 100, sm = (a, b, x) => { const q = Math.min(1, Math.max(0, (x - a) / (b - a))); return q * q * (3 - 2 * q); }, hv = sm(0.48, 0.9, v);
    this.road.gn.gain.setTargetAtTime((Math.min(0.2, v * 0.22) + hv * 0.16) * (s.rain ? 1.4 : 1), t, k);
    this.road.fl.frequency.setTargetAtTime(250 + v * 500 + (s.rain ? 600 : 0), t, k);
    this.roar.gn.gain.setTargetAtTime(hv * 0.32 + Math.max(0, v - 0.9) * 0.2, t, 0.15);
    this.wind.gn.gain.setTargetAtTime(Math.min(0.36, v * v * 0.08 + sm(0.55, 1.1, v) * 0.24), t, k);
    this.rain.gn.gain.setTargetAtTime(s.rain ? (s.cockpit ? 0.16 : 0.09) : 0, t, 0.3);
    this.city.gn.gain.setTargetAtTime(0.03 + s.cityK * 0.05, t, 0.5);
    this.npc.gn.gain.setTargetAtTime(Math.min(0.25, s.npcNear * 0.6), t, 0.1);
    this.npcG.gain.setTargetAtTime(Math.min(0.08, s.npcNear * 0.2), t, 0.1);
    this.npcHum.frequency.setTargetAtTime(45 + Math.min(60, (s.npcV || 0) * 3.2), t, 0.2); // すれ違う車の速さで音程が変わる
    this.npc.fl.frequency.setTargetAtTime(140 + Math.min(500, (s.npcV || 0) * 25), t, 0.2);
    this.squeal.gn.gain.setTargetAtTime(s.slip ? 0.12 : (s.brake > 0.7 && s.kmh > 5 && s.kmh < 40 ? 0.05 : 0), t, 0.05);
    this.hg.gain.setTargetAtTime(s.horn ? 0.3 : 0, t, 0.01);
    this.ambient(s.amb || null);
  }
  // セルモーターの「キュルル」（アイドリングストップからの再始動）
  starter() {
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), lf = ctx.createOscillator(), lg = ctx.createGain(), fl = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(150, t); o.frequency.linearRampToValueAtTime(210, t + 0.32); fl.type = 'lowpass'; fl.frequency.value = 900;
    lf.frequency.value = 28; lg.gain.value = 0.05; lf.connect(lg); lg.connect(g.gain);
    g.gain.setValueAtTime(0.07, t); g.gain.linearRampToValueAtTime(0.0001, t + 0.38);
    o.connect(fl); fl.connect(g); g.connect(this.master); o.start(t); lf.start(t); o.stop(t + 0.4); lf.stop(t + 0.4);
  }
  // 路面の段差の突き上げ「ゴトッ」
  bump(k) {
    if (!this.ok || k < 0.05) return;
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(Math.min(0.35, k * 0.35), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.18);
  }
  // 環境音：地区ごとに 鳥・虫・川・街のざわめき（合成音）
  ambient(a) {
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime;
    if (!this.amb) {
      const mk = (type, f, q) => { const s = ctx.createBufferSource(); const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; s.buffer = b; s.loop = true; s.start(); const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(this.master); return g; };
      this.amb = { river: mk('bandpass', 700, 0.5), insect: mk('bandpass', 4200, 12), crowd: mk('bandpass', 500, 0.8), nextBird: 0 };
    }
    const A = a || {}, k = 1.2;
    this.amb.river.gain.setTargetAtTime((A.river || 0) * 0.08, t, k);
    this.amb.insect.gain.setTargetAtTime((A.insect || 0) * 0.025, t, k);
    this.amb.crowd.gain.setTargetAtTime((A.crowd || 0) * 0.03, t, k);
    if ((A.bird || 0) > 0 && t > this.amb.nextBird) { // ときどき小鳥のさえずり
      this.amb.nextBird = t + 2 + Math.random() * 6;
      for (let n = 0; n < 2 + (Math.random() * 3 | 0); n++) { const o = ctx.createOscillator(), g = ctx.createGain(), t0 = t + n * 0.16, f = 2600 + Math.random() * 1600; o.type = 'sine'; o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(f * 1.35, t0 + 0.08); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.03 * A.bird, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12); o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + 0.15); }
    }
  }
  // 夕方5時のチャイム（ウェストミンスターの鐘のメロディー：パブリックドメイン）
  chime() {
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.1, N = { E4: 329.6, C4: 261.6, D4: 293.7, G3: 196 };
    const seq = ['E4', 'C4', 'D4', 'G3', null, 'G3', 'D4', 'E4', 'C4'];
    seq.forEach((n, i) => { if (!n) return; const t0 = t + i * 0.9; for (const [m, a] of [[1, 0.05], [2.01, 0.015], [3.02, 0.008]]) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = N[n] * m; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(a, t0 + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.6); o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + 2.7); } });
  }
  // 修正95：駅の接近案内（ピンポーン）と、列車の走行音（近いほど大きい低い走行音＋レールの継ぎ目の音）
  stationBell() {
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.05;
    for (const [f, t0] of [[880, 0], [698.5, 0.55]]) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + t0); g.gain.exponentialRampToValueAtTime(0.06, t + t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + t0 + 1.4); o.connect(g); g.connect(this.master); o.start(t + t0); o.stop(t + t0 + 1.5); }
  }
  train(k, v = 1) {
    if (!this.ok) return;
    const ctx = this.ctx;
    if (!this.trn) { const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; const g = ctx.createGain(); g.gain.value = 0; src.connect(lp); lp.connect(g); g.connect(this.master); src.start(); this.trn = { g, last: 0 }; }
    this.trn.g.gain.setTargetAtTime(Math.min(0.12, k * 0.12 * v), ctx.currentTime, 0.3);
    if (k > 0.15 && v > 0.2 && ctx.currentTime - this.trn.last > 0.9 / v) { this.trn.last = ctx.currentTime; for (const dt of [0, 0.12]) { const t = ctx.currentTime + dt, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); g.gain.setValueAtTime(Math.min(0.08, k * 0.08), t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.14); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.15); } } // ガタンゴトン
  }
  // 操作音（Rギア切替など）
  beep(f = 1200, d = 0.08, n = 1) {
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (let i = 0; i < n; i++) { const o = ctx.createOscillator(), g = ctx.createGain(), t0 = t + i * (d + 0.05); o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(0.04, t0); g.gain.setValueAtTime(0.0001, t0 + d); o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + d + 0.01); }
  }
  suspend() { if (this.ok) this.ctx.suspend(); }
  resume() { if (this.ok) this.ctx.resume(); }
}

// ================= BGM：WebAudioによる自動演奏（オリジナルの手続き生成曲。外部音源なし） =================
const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
const Q = { M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], D7: [0, 4, 7, 10], m9: [0, 3, 7, 10, 14], M: [0, 4, 7], m: [0, 3, 7], sus: [0, 5, 7, 10], add9: [0, 4, 7, 14] };
export const TRACKS = [
  { id: 'pop', name: 'Minase City Pop（昼の街）', bpm: 104, key: 57, prog: [[5, 'M7'], [7, 'D7'], [4, 'm7'], [9, 'm7'], [2, 'm7'], [7, 'sus'], [0, 'M7'], [0, 'add9']], kick: '1000001010000000', snare: '0000100000001000', hat: '1010101010101011', bass: 'pop', lead: 'sq', ep: true, seed: 11 },
  { id: 'night', name: 'Midnight Bypass（夜のドライブ）', bpm: 92, key: 53, prog: [[2, 'm9'], [7, 'sus'], [0, 'M7'], [9, 'm9'], [5, 'M7'], [4, 'm7'], [2, 'm7'], [7, 'D7']], kick: '1000000010100000', snare: '0000100000001000', hat: '0010001000100010', bass: 'night', lead: 'tri', ep: true, pad: true, seed: 23 },
  { id: 'rain', name: 'Rainy Window（雨の日）', bpm: 76, key: 55, prog: [[9, 'm9'], [5, 'M7'], [0, 'add9'], [7, 'sus'], [9, 'm9'], [4, 'm7'], [5, 'M7'], [7, 'sus']], kick: '1000000000100000', snare: '0000000010000000', hat: '0000100000001000', bass: 'soft', lead: 'tri', ep: true, pad: true, seed: 37 },
  { id: 'euro', name: 'Minase Touge Beat（峠）', bpm: 150, key: 50, prog: [[0, 'm'], [8, 'M'], [10, 'M'], [0, 'm'], [5, 'm'], [8, 'M'], [10, 'M'], [10, 'M']], kick: '1000100010001000', snare: '0000100000001000', hat: '0010001000100010', bass: 'euro', lead: 'saw', arp: true, seed: 51 },
  { id: 'country', name: 'Sunday Countryside（郊外・田園）', bpm: 98, key: 55, prog: [[0, 'M'], [5, 'M'], [0, 'M'], [7, 'M'], [9, 'm'], [5, 'M'], [0, 'M'], [7, 'D7']], kick: '1000000010000000', snare: '0000100000001000', hat: '1010101010101010', bass: 'walk', lead: 'sq', ep: false, pad: true, seed: 63 }
];
function seeded(s) { return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
// 2小節単位のフレーズでメロディを生成（A A' B A の構成）
function makeMelody(t) {
  const R = seeded(t.seed * 977 + 3), rh = [];
  const templ = t.id === 'euro' ? ['1010101011101010', '1011101010111010'] : t.id === 'rain' || t.id === 'night' ? ['1000001000100000', '1000100000000010', '0010001010000000'] : ['1001001010000100', '1000101000101000', '0010100100100100'];
  for (let i = 0; i < 4; i++) rh.push(templ[Math.floor(R() * templ.length)]);
  const bars = [];
  let last = t.key + 15;
  const scale = [0, 2, 4, 5, 7, 9, 11];
  const phrase = (b0) => {
    const out = [];
    for (let b = 0; b < 2; b++) {
      const ch = t.prog[(b0 + b) % t.prog.length], tones = Q[ch[1]].map(x => (x + ch[0]) % 12), r = rh[(b0 / 2 + b) % rh.length], notes = [];
      for (let st = 0; st < 16; st++) {
        if (r[st] !== '1') { notes.push(null); continue; }
        const strong = st % 4 === 0;
        let best = last, bd = 1e9;
        for (let n = t.key + 7; n <= t.key + 26; n++) {
          const pc = ((n - t.key) % 12 + 12) % 12;
          const isChord = tones.includes(pc), isScale = scale.includes(pc);
          if (!(strong ? isChord : isScale)) continue;
          const d = Math.abs(n - last) + R() * 4 + (isChord ? 0 : 1.5);
          if (d < bd && n !== last) { bd = d; best = n; }
        }
        last = best; notes.push(best);
      }
      out.push(notes);
    }
    return out;
  };
  // 32小節：A A' B A | C C' B' A''（Cはサビ前の展開、各2小節フレーズ×16）
  const A = phrase(0), B = phrase(4), A2 = A.map((bar, i) => i === 1 ? phrase(2)[1] : bar);
  const C = phrase(6), C2 = phrase(2), B2 = B.map((bar, i) => i === 1 ? phrase(6)[1] : bar), A3 = A2.map(bar => bar.map(n => n && R() < 0.25 ? n + (R() < 0.5 ? 2 : -2) : n));
  bars.push(...A, ...A2, ...B, ...A, ...A2, ...B2, ...A, ...A2, ...C, ...C2, ...C, ...B2, ...B, ...A2, ...B2, ...A3);
  return bars;
}
export class Music {
  constructor(snd) { this.snd = snd; this.on = false; this.mode = 'auto'; this.cur = null; this.vol = 0.5; this.step = 0; }
  init() {
    if (this.ctx || !this.snd.ok) return;
    const ctx = this.ctx = this.snd.ctx;
    this.out = ctx.createGain(); this.out.gain.value = 0; this.out.connect(this.snd.master);
    // 簡易リバーブ（フィードバックディレイ）
    const dl = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain(), lp = ctx.createBiquadFilter();
    dl.delayTime.value = 0.23; fb.gain.value = 0.32; wet.gain.value = 0.22; lp.type = 'lowpass'; lp.frequency.value = 2500;
    this.bus = ctx.createGain(); this.bus.connect(this.out); this.bus.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(this.out);
    const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = nb;
    this.timer = setInterval(() => this.sched(), 25);
  }
  setVol(v) { this.vol = v; }
  pick(ctx) { // ctx: {night, rain, mountain, rural}
    if (this.mode === 'off') return null;
    if (this.mode !== 'auto') return TRACKS.find(t => t.id === this.mode);
    if (ctx.mountain) return TRACKS[3];
    if (ctx.rain) return TRACKS[2];
    if (ctx.night) return TRACKS[1];
    if (ctx.rural) return TRACKS[4];
    return TRACKS[0];
  }
  kick() { this.kickT = 1; } // 次の update で短いフェード（0.35秒）で切り替える
  update(ctxInfo, active) {
    if (!this.ctx) return null;
    const want = active ? this.pick(ctxInfo) : null;
    const t = this.ctx.currentTime;
    if (want !== this.cur) {
      const q = this.kickT; this.kickT = 0;
      if (!this.fading) { this.fading = true; this.out.gain.setTargetAtTime(0, t, q ? 0.1 : 0.4); this.fadeAt = t + (q ? 0.35 : 1.4); this.next = want; }
      else { this.next = want; if (q) this.fadeAt = Math.min(this.fadeAt, t + 0.35); }
    }
    else if (!this.fading) this.kickT = 0;
    if (this.fading && t > this.fadeAt) {
      this.fading = false; this.cur = this.next; this.step = 0; this.nextTime = t + 0.1;
      if (this.cur) this.mel = makeMelody(this.cur);
    }
    if (!this.fading) this.out.gain.setTargetAtTime(this.cur ? this.vol * 0.55 : 0, t, 0.3);
    return this.cur;
  }
  sched() {
    if (!this.cur || this.fading) return;
    const ctx = this.ctx, tr = this.cur, spb = 60 / tr.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.15) { this.play(tr, this.step, this.nextTime, spb); this.step++; this.nextTime += spb; }
  }
  env(g, t, a, peak, dec, sus = 0.0001) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + dec); }
  osc(type, f, t, dur, peak, dec, filt, dest = this.bus, detune = 0) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; o.detune.value = detune;
    let n = o; if (filt) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filt; o.connect(fl); n = fl; }
    n.connect(g); g.connect(dest); this.env(g, t, 0.005, peak, dec); o.start(t); o.stop(t + dur + 0.05);
  }
  hit(type, t, vol) {
    const ctx = this.ctx;
    if (type === 'kick') { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + 0.32); return; }
    const s = ctx.createBufferSource(); s.buffer = this.noise; const f = ctx.createBiquadFilter(), g = ctx.createGain();
    if (type === 'snare') { f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.8; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16); this.osc('triangle', 185, t, 0.08, vol * 0.5, 0.07); }
    else { f.type = 'highpass'; f.frequency.value = 7500; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04); }
    s.connect(f); f.connect(g); g.connect(this.bus); s.start(t, Math.random() * 0.5); s.stop(t + 0.2);
  }
  play(tr, step, t, spb) {
    const st = step % 16, bi = Math.floor(step / 16), sec = bi % 32; // 32小節で1コーラス
    const bridge = sec >= 16 && sec < 22, brk = sec >= 22 && sec < 24; // 展開部は和音進行をずらす／ブレイクはドラムを抜く
    const bar = (bi + (bridge ? 3 : 0)) % tr.prog.length, ch = tr.prog[bar], root = tr.key + ch[0] + (bridge && tr.id !== 'euro' ? 0 : 0), tones = Q[ch[1]];
    const intro = step < 32; // 最初の2小節はドラム控えめ
    const fill = sec % 8 === 7 && st >= 12; // 8小節ごとのフィル
    if (fill && st % 1 === 0 && !brk) this.hit('snare', t, 0.12 + (st - 12) * 0.05);
    if (brk && st !== 0) { if (tr.pad && st === 8) { } } else {
    if (tr.kick[st] === '1') this.hit('kick', t, tr.id === 'rain' ? 0.35 : 0.7);
    if (tr.snare[st] === '1' && !(intro && tr.id === 'rain')) this.hit('snare', t, tr.id === 'euro' ? 0.4 : 0.28);
    if (tr.hat[st] === '1') this.hit('hat', t, st % 4 === 2 ? 0.14 : 0.08);
    }
    // ベース
    const bRoot = root - 24 + (ch[0] > 6 ? -12 : 0) + 12;
    const bp = { pop: '1000101000101010', night: '1000000010000010', soft: '1000000000000000', euro: '0010001000100010', walk: '1000100010001000' }[tr.bass];
    if (bp[st] === '1') {
      let n = bRoot; if (tr.bass === 'pop' && st % 8 === 6) n += 12; if (tr.bass === 'walk') n = bRoot + [0, 4, 7, 9][st / 4 | 0];
      const type = tr.bass === 'euro' ? 'sawtooth' : tr.bass === 'pop' ? 'sawtooth' : 'triangle';
      this.osc(type, mtof(n), t, spb * 3, tr.bass === 'soft' ? 0.35 : 0.3, spb * (tr.bass === 'soft' ? 14 : 3), tr.bass === 'euro' ? 900 : 520);
    }
    // コード（エレピ／パッド）
    if (tr.ep && (st === 0 || (tr.id === 'pop' && (st === 6 || st === 10)))) for (const iv of tones) {
      const f = mtof(root + iv + 12); this.osc('sine', f, t, spb * 7, 0.06, spb * 7, null); this.osc('sine', f * 2.003, t, spb * 2, 0.025, spb * 2, null);
    }
    if (tr.pad && st === 0) for (const iv of tones.slice(0, 4)) for (const dt of [-7, 7]) this.osc('sawtooth', mtof(root + iv + 12), t, spb * 16, 0.018, spb * 16, 1100, this.bus, dt);
    if (tr.arp) { const n = root + 12 + tones[st % tones.length] + (st % 8 >= 4 ? 12 : 0); this.osc('sawtooth', mtof(n), t, spb, 0.05, spb * 0.9, 2400); }
    // メロディ（8小節目以降に入る）
    if (step >= 32) {
      const mb = this.mel[Math.floor(step / 16) % this.mel.length], n = mb && mb[st];
      if (n) {
        const len = spb * (tr.id === 'euro' ? 1.6 : 3);
        if (tr.lead === 'saw') { this.osc('sawtooth', mtof(n), t, len, 0.07, len, 3200, this.bus, -6); this.osc('sawtooth', mtof(n), t, len, 0.07, len, 3200, this.bus, 6); }
        else if (tr.lead === 'sq') this.osc('square', mtof(n), t, len, 0.055, len, 2200);
        else this.osc('triangle', mtof(n), t, len, 0.12, len * 1.5, null);
      }
    }
  }
}
