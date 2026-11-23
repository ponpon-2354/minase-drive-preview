// 水瀬市ドライブ：メインループ・カメラ・時間/天候・UI・入力
import { Renderer } from './renderer.js?v=0.8.0';
import { City, auditGround, auditLaneBlock } from './city.js?v=0.8.0';
import { GB } from './geo.js?v=0.8.0';
import { M4, clamp, lerp, rng } from './math.js?v=0.8.0';
import { buildPlayerCar, MIRA_COLORS, MODELS, VARIATIONS, buildHull, buildMiraNPC, tractorDef, buildTrailer } from './carmodels.js?v=0.8.0';
import { Player } from './player.js?v=0.8.0';
import { Traffic } from './traffic.js?v=0.8.0';
import { Sound, Music, TRACKS } from './audio.js?v=0.8.0';
import { saveGame, loadGame, clearSave } from './save.js?v=0.8.0';
import { L, plateUV, renderLayer } from './textures.js?v=0.8.0';
import { installNav, LABELS as MAP_LABELS } from './nav.js?v=0.8.0';
import { districtCoverage } from './districts.js?v=0.8.0';
import { buildPerson, buildDriver, buildBike, buildMoto, Peds, AGES, SEXES, OUTFITS, buildHands, buildStanding } from './people.js?v=0.8.0';
import { BIKE_M, MOTO_M } from './traffic.js?v=0.8.0';
import { LongDrive, START_MIN, hhmm, dur, fatigueStage } from './longdrive.js?v=0.8.0';
import { Cutscene } from './cutscene.js?v=0.8.0';
import { LDSetup, renderClear } from './ld_ui.js?v=0.8.0';
import { buildChar, buildPassengersInCar, driverChar, SEASON_NAMES } from './passengers.js?v=0.8.0';
import { loadLD, getClears, loadLDPrefs, saveLDPrefs } from './save.js?v=0.8.0';
import { LDMusic } from './ld_music.js?v=0.8.0';
// v0.7.0 長距離ドライブ：LD（進行中のドライブ）、cut（再生中のムービー）、ldSetup（設定画面）
let LD = null, cut = null, ldSetup = null, ldPrev = null, ldSv = null, mmLabels = null;
// v0.8.0：長距離専用BGM（修正102・103）と、その設定（BGM・同乗者のセリフ・ラジオ案内のON/OFF。端末に保存）
let ldMusic = null; const LDP = loadLDPrefs();

const $ = id => document.getElementById(id);
const MOBILE = matchMedia('(pointer:coarse)').matches;
const npcDraw = { near300: 0, drawn300: 0 };
let accelHold = null, keyHold = null, keyKeepT = 0, rBeepT = 0, spdHist = [];
// 速度キープに入れる条件（タッチ・キー共通）：Dで5km/h超、直近0.5秒の加速度が1.5m/s²未満（ゆるやかな加速中でもよい）
// 加速度はゲーム内時間で測る（処理落ちで実時間とずれても正しく判定）
// 修正120：速度キープの作動条件に「速度が落ち着いていること」を加える：直近1.0秒の速度が今の速度から±2km/h以内（まだ加速・減速が続いている間は作動しない）。
// keepCond.why：'acc' 速度が変化中、'wait' 記録が1秒に満たない
function keepCond() { const now = T; spdHist.push([now, player.kmh]); while (spdHist.length > 2 && now - spdHist[1][0] >= 1.0) spdHist.shift(); const span = now - spdHist[0][0]; let dev = 0; for (const h of spdHist) dev = Math.max(dev, Math.abs(h[1] - player.kmh)); keepCond.why = span < 0.9 ? 'wait' : dev > 2 ? 'acc' : ''; return player.kmh > 5 && player.gear === 'D' && player.input.brk < 0.05 && span >= 0.9 && dev <= 2; }
function engageKeep() { player.cruiseV = player.vx; toast(`速度キープ ${Math.round(player.kmh)}km/h（ブレーキ・スライド・Rで解除）`, 1600); snd.beep(1100, 0.05, 2); const el = $('bA'); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 700); } // 修正82：周辺300m以内の交通車両数と、実際に描いた数
const S = { det: MOBILE ? 240 : 300, camD: 5.6, camH: 2.2, npc: 1, auto: 1, draw: MOBILE ? 320 : 380, res: MOBILE ? 0.75 : 0.85, vol: 0.7, assist: 1, dbg: 0, flow: 1, weather: 'auto', bgm: 'auto', bgmVol: 0.5, aeb: 1, amb: 1, lim: 0, ac: 0, is: 1 };
const S0 = { ...S };
const DEV = new URLSearchParams(location.search).has('dev');
const START = { x: -60, z: -379.9, yaw: Math.PI / 2 };
// ワープ先：座標は目安。実際の出現位置は lanePos() で最寄り道路の左端車線に合わせる
const WARPS = [['駅前（スタート地点）', -60, -379.9, Math.PI / 2], ['国道ロードサイド（片側3車線）', 620, -8, Math.PI / 2], ['バイパス（高架の手前）', 1005, -420, 0], ['みなせ峠 入口', -501, -1020, Math.PI], ['道の駅 みなせ峠', 'pad'], ['水瀬川の橋', 2, 470, 0], ['田園地帯', -998, 1300, 0], ['水瀬工業団地', -1700, -5, Math.PI / 2], ['郊外住宅地', -998, -760, 0], ['本町通り（旧路面電車通り・片側3車線）', -300, 6, -Math.PI / 2], ['学園地区（水瀬大学前）', 250, 1252, Math.PI / 2], ['ニュータウン（若葉台）', 1120, 1333, Math.PI / 2], ['水瀬駅 北口（ホームの電車が見える）', 40, -504.9, Math.PI / 2]];
let color = 0, state = 'load', R, city, player, traffic, snd, music, car = {}, npcMesh = [], npcLod = [], meshes = {};
let gameMin = 7 * 60 + 30, weather = 'clear', wetK = 0, cloudK = 0, rainK = 0, weatherT = 240;
let camMode = 0, cam = { p: [0, 50, 0], look: [0, 0, 0] }, lightMode = 0, wink = 0, winkYaw = 0, horn = false, T = 0;
let perfT = 0, perfN = 0, perfK = 1, resK = 1, lastSave = 0, distName = '', selYaw = 0, prevState = 'title';
let rebuildDriver = () => { }, driver = { age: 1, sex: 0, outfit: 0 }, peds = null, pedMesh = [];
const odo = { real: 0, disp: 0 }; // 速度表示の検証用（実移動距離と表示速度の積分）
let gSpd = 0, lastPos = null, tunK = 0, errN = 0, chimeDone = -1, nav = null, mmZoom = 1;
const trainNote = {};
const keys = {}, touch = {};
const WMAX = 2.2, wheel = { ang: 0, update: null, held: () => false }; // 修正119：ハンドルの最大回転角（ラジアン、約126°）で入力 steer が ±1

// トースト：重なったときは順番に表示（同じ文言は連続させない）
const toastQ = [];
function toast(msg, t = 1600) {
  if (toastQ.some(q => q[0] === msg) || toast.cur === msg) return;
  toastQ.push([msg, t]); if (toastQ.length > 4) toastQ.shift(); if (!toast.busy) toastNext();
}
function toastNext() {
  const el = $('toast'), q = toastQ.shift();
  if (!q) { toast.busy = false; toast.cur = null; el.classList.remove('on'); return; }
  toast.busy = true; toast.cur = q[0]; el.textContent = q[0]; el.classList.add('on');
  clearTimeout(toast.h); toast.h = setTimeout(toastNext, toastQ.length ? Math.min(q[1], 1200) : q[1]);
}
function show(id) { for (const s of ['load', 'title', 'select', 'settings', 'howto', 'pause', 'map', 'ldset', 'ldclear']) $(s).classList.toggle('on', s === id); }
const frame = () => new Promise(r => requestAnimationFrame(r));

// ---------------- 起動 ----------------
async function boot() {
  const bar = $('lbar'), msg = $('lmsg');
  try {
    R = new Renderer($('gl'));
    bar.style.width = '15%'; msg.textContent = '道路ネットワークと街区を生成中…'; await frame();
    city = new City();
    for (const d of city.dyn || []) R.setLayer(d.lay, renderLayer(d.draw)); R.mips(); // 案内標識・橋名板
    bar.style.width = '45%'; msg.textContent = '車両モデル（50車種）を生成中…'; await frame();
    for (const m0 of MODELS) { const m = m0.semi ? tractorDef(m0) : m0; const g = new GB(); buildHull(m, g, { lod: 0 }); npcMesh[m.id] = R.mesh(g.build()); const g1 = new GB(); buildHull(m, g1, { lod: 1 }); npcLod[m.id] = R.mesh(g1.build()); if (m0.semi) { const t0 = new GB(); buildTrailer(t0, m0, 0); meshes.trailer = R.mesh(t0.build()); const t1 = new GB(); buildTrailer(t1, m0, 1); meshes.trailerLod = R.mesh(t1.build()); } }
    const pc = buildPlayerCar(); car.def = pc;
    rebuildDriver = () => { for (const k of ['driver', 'hands', 'stand']) if (car[k]) R.free(car[k]); const g = new GB(); buildDriver(g, driver, pc.eye, pc.steerPos); car.driver = R.mesh(g.build()); const h = new GB(); buildHands(h, driver); car.hands = R.mesh(h.build()); const s = new GB(); buildStanding(s, driver); car.stand = R.mesh(s.build()); };
    rebuildDriver();
    for (const k of ['body', 'glass', 'interior', 'wheel', 'wheelR', 'steer', 'needle', 'meterGlow']) car[k] = R.mesh(pc[k].build());
    { const g = new GB(); buildMiraNPC(g); npcMesh[0] = R.mesh(g.build()); }
    // 二輪車（乗員つき）・歩行者・運転者
    { const g = new GB(); buildBike(g, [1, 1, 1], true, 5); npcMesh[BIKE_M.id] = npcLod[BIKE_M.id] = R.mesh(g.build()); }
    { const g = new GB(); buildMoto(g, [1, 1, 1], 9); npcMesh[MOTO_M.id] = npcLod[MOTO_M.id] = R.mesh(g.build()); }
    // 歩行者：大人12通り＋子供3通り（ランドセル・黄色い帽子）＋お年寄り3通り（前かがみ・杖）
    for (let k = 0; k < 18; k++) pedMesh[k] = ['walk0', 'walk1', 'stand'].map(pose => { const g = new GB(); const child = k >= 12 && k < 15, old = k >= 15; buildPerson(g, { age: child ? 0 : old ? 2 : k % 2, sex: (k >> 1) % 2, outfit: k === 7 || k === 10 ? 3 : k % 5 === 4 ? 2 : k % 3 === 1 ? 1 : 0, pose, seed: k + 1, child, cane: old && k !== 16 }); return R.mesh(g.build()); });
    { const g = new GB(); g.box(-0.55, 0.2, -1.1, 0.55, 1.1, 0.6, { c: [0.95, 0.7, 0.1] }); g.box(-0.5, 1.1, -1.0, 0.5, 2.1, -0.2, { c: [0.2, 0.22, 0.24] }); g.box(-0.45, 0.1, 0.6, -0.4, 2.4, 0.7, { c: [0.3, 0.3, 0.3] }); g.box(0.4, 0.1, 0.6, 0.45, 2.4, 0.7, { c: [0.3, 0.3, 0.3] }); g.box(-0.5, 0.1, 0.7, 0.5, 0.15, 1.6, { c: [0.6, 0.6, 0.6] }); for (const [x, z] of [[-0.5, -0.8], [0.5, -0.8], [-0.5, 0.4], [0.5, 0.4]]) g.cylX(x, 0.22, z, 0.22, 0.15, 8, { c: [0.1, 0.1, 0.1] }); meshes.fork = R.mesh(g.build()); } // フォークリフト
    // 遠景シルエット（読み込み範囲の外にある建物を低ポリの箱で表示）
    for (const ch of city.chunks) { // 遠景：建物の箱＋（山間部は）粗い地形
      const g = new GB(), gt = new GB();
      for (const [x0, z0, x1, z1, h] of (city.farBoxes && city.farBoxes.get(ch)) || []) if (h >= 9) g.box(x0, 0, z0, x1, h, z1, { c: [0.62, 0.64, 0.68], mat: 23, noTop: true }); // 戸建ては省き、中高層だけ
      const ft = city.farTerrain && city.farTerrain.get(ch); if (ft) ft(gt);
      if (g.count) ch.far = R.mesh(g.build()); if (gt.count) ch.farT = R.mesh(gt.build());
    }
    // 修正97-3：車の接地影は黒い長方形ではなく、角の丸い形で縁がぼける影（中心が濃く、外周で0になる）
    meshes.blob = R.mesh((() => { const g = new GB(), N = 28, P = (k, sc) => { const a = k / N * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); return [0.5 * sc * Math.sign(c) * Math.abs(c) ** 0.5, 0.04, 0.5 * sc * Math.sign(s) * Math.abs(s) ** 0.5]; };
      const dark = { c: [1, 1, 1], mat: 26 };
      for (let k = 0; k < N; k++) { const a0 = P(k, 0.78), a1 = P(k + 1, 0.78), b0 = P(k, 1.06), b1 = P(k + 1, 1.06);
        g.tri([0, 0.04, 0], a1, a0, dark, [0, 0], [0, 0], [0, 0], [0, 1, 0]);
        g.tri(a0, a1, b1, dark, [0, 0], [0, 0], [0, 0], [0, 1, 0]); g.tri(a0, b1, b0, dark, [0, 0], [0, 0], [0, 0], [0, 1, 0]);}
      // 外周（b0/b1）の頂点の濃さを0にする
      const a = g.a; for (let i = 0; i < a.length; i += 13) { const r = Math.hypot(a[i] / 0.5, a[i + 2] / 0.5); if (r > 0.95) { a[i + 6] = 0; a[i + 7] = 0; a[i + 8] = 0; } }
      return g.build(); })());
    meshes.stars = R.mesh(starGeo()); meshes.clouds = R.mesh(cloudGeo()); meshes.ped = R.mesh(pedSigGeo()); meshes.puff = R.mesh((() => { const g = new GB(); g.quadN([-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0], [0, 0, 1], { c: [0.85, 0.85, 0.85], mat: 25, lay: L.CLOUD }, [[0, 1], [1, 1], [1, 0], [0, 0]]); return g.build(); })());
    meshes.global = R.mesh(city.global.build()); meshes.gdecal = R.mesh(city.globalDecal.build());
    meshes.mtn = R.mesh(city.mountains.build()); meshes.train = R.mesh(city.trainGeo.build());
    meshes.sky = R.mesh(skyDome()); meshes.lamps = R.mesh(lampGeo()); meshes.rain = R.mesh(rainGeo(), R.gl.LINES); meshes.studio = R.mesh(studioGeo());
    { const g = new GB(); g.cbox(0, 0.12, 0, 0.5, 0.22, 0.18, { c: [1, 0.85, 0.35], mat: 18 }); g.cbox(0, 0.005, 0, 0.56, 0.03, 0.22, { c: [0.15, 0.15, 0.15] }); meshes.andon = R.mesh(g.build()); } // タクシーの行灯
    bar.style.width = '60%'; msg.textContent = '周辺エリアを読み込み中…'; await frame();
    player = new Player(city); { const w = warpPos(START.x, START.z, START.yaw); player.reset(w.x, w.z, w.yaw); }
    nav = installNav(city, { $, toast, get player() { return player; } });
    traffic = new Traffic(city, rng(Date.now() & 0xffff));
    peds = new Peds(city, rng(77)); traffic.peds = peds;
    player.onReset = () => syncGear();
    snd = new Sound(); music = new Music(snd); ldMusic = new LDMusic(snd);
    { const si = snd.init.bind(snd); snd.init = () => { si(); music.init(); music.mode = S.bgm; music.setVol(S.bgmVol); ldMusic.init(); ldMusic.setVol(LDP.vol); }; }
    const sv = await loadGame();
    if (sv) applySave(sv);
    // 開始地点周辺のチャンクを先に読み込む
    const near = city.chunks.map(c => [c, Math.hypot(c.x - player.x, c.z - player.z)]).sort((a, b) => a[1] - b[1]);
    let k = 0;
    for (const [c, d] of near) { if (d < S.draw + 300) { city.buildChunk(c, R); k++; if (k % 3 === 0) { bar.style.width = (60 + Math.min(38, k * 2)) + '%'; await frame(); } } }
    buildMinimap();
    initUI();
    $('mContinue').hidden = !sv;
    ldSv = await loadLD(); $('mLDCont').hidden = !(ldSv && ldSv.cfg && ldSv.st && ldSv.st.phase !== 'clear');
    if (ldSv && !$('mLDCont').hidden) $('mLDCont').textContent = `長距離ドライブのつづき（${SEASON_NAMES[ldSv.cfg.season] || ''}・${hhmm(ldSv.min || 540)}）`;
    show('title'); state = 'title';
    { let nx = null; try { nx = JSON.parse(sessionStorage.getItem('ldNext') || 'null'); sessionStorage.removeItem('ldNext'); } catch (e) { /* none */ } // クリア画面の「同じ季節でもう一度」「別の季節で」
      if (nx && nx.cfg) { if (nx.same) startLD(nx.cfg, null); else openLDSet({ ...nx.cfg, otherSeason: true }); } }
    console.log('city stats', city.stats, 'lotsAI', city.stats.lotsAI, 'aabbs', city.aabbs.length, 'variations', VARIATIONS);
    if (DEV) window.G = { M4, meshes, auditGround: (st = 5) => auditGround(city, st), auditLaneBlock: (st = 2) => auditLaneBlock(city, st), perf: (p, r) => { perfK = p; resK = r; S.auto = false; }, perfV: () => [perfK, resK], trains: t => trains(t ?? T), T: () => T, peds: () => peds, car, odo, hist: () => loop.hist, prof: () => streamChunks.prof, models: MODELS, get player() { return player; }, get traffic() { return traffic; }, get city() { return city; }, get LD() { return LD; }, get ldMusic() { return ldMusic; }, LDP, get cut() { return cut; }, startLD: (cfg, sv) => startLD(cfg, sv), cutTest: (kind, season, n, type = 'SA') => { const ps = [{ ch: driverChar(driver, season), role: 'driver', name: 'あなた' }, { ch: { sex: 1, age: '30', outfit: 'casual', seed: 21 }, role: 'p1', name: '30代女性' }, { ch: { sex: 0, age: n === 3 ? 'child' : '60', outfit: n === 3 ? 'kids' : 'coat', seed: 28 }, role: 'p2', name: n === 3 ? '男の子' : '60代男性' }].slice(0, n);
      startMovie(kind, { season, party: ps, fac: { id: 'x', type, name: { SA: 'テストSA', PA: 'テストPA', MICHI: '道の駅 テスト' }[type] }, from: 600, to: 645 }, () => { state = 'title'; show('title'); }); }, ldTo: (s, u = 6.1) => { const q = LD.poseAtS(s, u); player.reset(q.x, q.z, q.yaw, q.y + 1); lastPos = null; cam.mode = -1; LD.lastPos = null; }, ldset: p => openLDSet(p), setMin: m => { gameMin = m; }, S, R, setCam: m => { camMode = m; markToggles(); }, setTime: h => { gameMin = h * 60; }, setWeather: w => { S.weather = w; weather = w; }, tp: (x, z, yaw) => player.reset(x, z, yaw, 1000), warp: i => LD ? null : doWarp(i), nav: () => nav, gSpd: () => gSpd, state: () => state, sel: () => openSelect('title'), stats: () => ({ fps: tick.fps, ms: loop.ms, draws: R.stats.draws, tris: R.stats.tris, npc: traffic.cars.length, target: traffic.target, parked: traffic.stats.parkedNow, chunks: city.chunks.filter(c => c.m).length, npcNear300: npcDraw.near300, npcDrawn300: npcDraw.drawn300 }), cityStats: () => ({ ...city.stats, dockSlots: city.lots.filter(l => l.truck).reduce((t, l) => t + l.slots.length, 0), dockFree: city.lots.filter(l => l.truck).reduce((t, l) => t + l.slots.filter(q => q.occ !== 'static').length, 0), dockLotsOnRoad: city.lots.filter(l => l.truck && l.edge).length }), coverage: () => districtCoverage(city) };
    requestAnimationFrame(loop);
  } catch (e) { console.error(e); $('err').textContent = 'エラー: ' + e.message + '（再読み込みしてください）'; }
}

function skyDome() {
  const g = new GB(), n = 16, rs = [0, 0.08, 0.2, 0.45, 0.75, 1];
  for (let i = 0; i < n; i++) for (let j = 0; j < rs.length - 1; j++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, e0 = rs[j] * Math.PI / 2, e1 = rs[j + 1] * Math.PI / 2;
    const P = (a, e) => [Math.cos(a) * Math.cos(e), Math.sin(e) - 0.05, Math.sin(a) * Math.cos(e)];
    const c0 = [rs[j], 0, 0], c1 = [rs[j + 1], 0, 0];
    g.vert(P(a0, e0), [0, 1, 0], c0, [0, 0], 6, 0); g.vert(P(a1, e0), [0, 1, 0], c0, [0, 0], 6, 0); g.vert(P(a1, e1), [0, 1, 0], c1, [0, 0], 6, 0);
    g.vert(P(a0, e0), [0, 1, 0], c0, [0, 0], 6, 0); g.vert(P(a1, e1), [0, 1, 0], c1, [0, 0], 6, 0); g.vert(P(a0, e1), [0, 1, 0], c1, [0, 0], 6, 0);
  }
  return g.build();
}
function lampGeo() { // 信号灯（ローカル：-z面）。左から青・黄・赤（運転者から見て）
  const g = new GB(), cols = [[0.1, 0.95, 0.75], [1, 0.72, 0.08], [1, 0.12, 0.08]], xs = [0.42, 0, -0.42];
  for (let k = 0; k < 3; k++) for (let i = 0; i < 10; i++) {
    const a0 = i / 10 * Math.PI * 2, a1 = (i + 1) / 10 * Math.PI * 2, r = 0.15;
    g.tri([xs[k], 0, -0.17], [xs[k] + Math.cos(a0) * r, Math.sin(a0) * r, -0.17], [xs[k] + Math.cos(a1) * r, Math.sin(a1) * r, -0.17], { c: cols[k], mat: 12 + k });
  }
  return g.build();
}
function starGeo() { // 星：上半球にランダム配置（夜だけ加算合成で表示）
  const g = new GB(), r = rng(31);
  for (let i = 0; i < 520; i++) { const a = r() * Math.PI * 2, e = Math.asin(0.08 + r() * 0.92), s = 4 + r() * 7 * (r() < 0.1 ? 2 : 1), x = Math.cos(a) * Math.cos(e) * 3800, y = Math.sin(e) * 3800, z = Math.sin(a) * Math.cos(e) * 3800, b = 0.6 + r() * 0.4;
    const n = [-x / 3800, -y / 3800, -z / 3800], u = norm([-n[2], 0, n[0]]), v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
    g.quadN([x - u[0] * s - v[0] * s, y - u[1] * s - v[1] * s, z - u[2] * s - v[2] * s], [x + u[0] * s - v[0] * s, y + u[1] * s - v[1] * s, z + u[2] * s - v[2] * s], [x + u[0] * s + v[0] * s, y + u[1] * s + v[1] * s, z + u[2] * s + v[2] * s], [x - u[0] * s + v[0] * s, y - u[1] * s + v[1] * s, z - u[2] * s + v[2] * s], n, { c: [b, b, b * 1.05], mat: 24 }); }
  return g.build();
}
function cloudGeo() { // 雲：高度700〜1100mの板（時間でゆっくり流す）
  const g = new GB(), r = rng(47);
  for (let i = 0; i < 70; i++) { const x = (r() - 0.5) * 9000, z = (r() - 0.5) * 9000, y = 700 + r() * 400, w = 300 + r() * 500, d = w * (0.5 + r() * 0.4); g.quadN([x - w, y, z - d], [x + w, y, z - d], [x + w, y, z + d], [x - w, y, z + d], [0, -1, 0], { c: [1, 1, 1], mat: 25, lay: L.CLOUD }, [[0, 0], [1, 0], [1, 1], [0, 1]]); }
  return g.build();
}
function pedSigGeo() { // 歩行者用信号（上：赤、下：青）。-z面が正面
  const g = new GB();
  g.cbox(0, 0, 0, 0.36, 0.78, 0.22, { c: [0.45, 0.47, 0.46] });
  g.cbox(0, 0.18, -0.115, 0.26, 0.3, 0.02, { c: [1, 0.15, 0.1], mat: 14 }); g.cbox(0, -0.18, -0.115, 0.26, 0.3, 0.02, { c: [0.1, 0.9, 0.7], mat: 12 });
  return g.build();
}
function rainGeo() {
  const g = new GB(), r = rng(5);
  for (let i = 0; i < 900; i++) { const x = (r() - 0.5) * 50, y = r() * 24, z = (r() - 0.5) * 50; g.line([x, y, z], [x + 0.05, y - 0.9, z], [0.75, 0.78, 0.85]); }
  return g.build();
}
function studioGeo() {
  const g = new GB();
  g.cyl(0, -0.05, 0, 3.4, 0.05, 32, { c: [0.25, 0.26, 0.29] });
  g.flat(-40, -40, 40, 40, -0.06, { c: [0.08, 0.085, 0.1] });
  return g.build();
}

// ---------------- 環境（時間・天候） ----------------
const KEYS = [
  [0, [0.02, 0.03, 0.07], [0.05, 0.07, 0.16], [0.05, 0.06, 0.1], [0.12, 0.13, 0.2], 1],
  [4.8, [0.02, 0.03, 0.07], [0.05, 0.07, 0.16], [0.05, 0.06, 0.1], [0.12, 0.13, 0.2], 1],
  [6.0, [0.62, 0.52, 0.52], [0.32, 0.38, 0.6], [0.75, 0.5, 0.35], [0.33, 0.33, 0.4], 0.55],
  [7.5, [0.7, 0.78, 0.86], [0.36, 0.55, 0.85], [1.0, 0.92, 0.8], [0.44, 0.46, 0.52], 0],
  [12, [0.72, 0.8, 0.9], [0.3, 0.52, 0.88], [1.05, 1.0, 0.94], [0.47, 0.49, 0.54], 0],
  [16.3, [0.74, 0.76, 0.82], [0.36, 0.52, 0.8], [1.0, 0.86, 0.68], [0.44, 0.43, 0.47], 0],
  [17.6, [0.95, 0.6, 0.42], [0.35, 0.4, 0.62], [0.95, 0.55, 0.3], [0.38, 0.33, 0.36], 0.3],
  [18.6, [0.32, 0.26, 0.38], [0.12, 0.14, 0.3], [0.3, 0.22, 0.3], [0.2, 0.2, 0.3], 0.85],
  [19.8, [0.03, 0.04, 0.09], [0.05, 0.07, 0.17], [0.06, 0.07, 0.12], [0.13, 0.14, 0.22], 1],
  [24, [0.02, 0.03, 0.07], [0.05, 0.07, 0.16], [0.05, 0.06, 0.1], [0.12, 0.13, 0.2], 1]
];
function envAt(h) {
  let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] <= h) i++;
  const a = KEYS[i], b = KEYS[i + 1], t = clamp((h - a[0]) / (b[0] - a[0]), 0, 1);
  const mix = (u, v) => u.map((x, k) => lerp(x, v[k], t));
  return { fog: mix(a[1], b[1]), zen: mix(a[2], b[2]), sunC: mix(a[3], b[3]), amb: mix(a[4], b[4]), night: lerp(a[5], b[5], t) };
}
function envUniforms(dt) {
  const h = gameMin / 60;
  // 天候の遷移
  const tc = weather === 'cloudy' ? 1 : weather === 'rain' ? 1 : 0, tr = weather === 'rain' ? 1 : 0;
  cloudK += clamp(tc - cloudK, -dt * 0.15, dt * 0.15); rainK += clamp(tr - rainK, -dt * 0.2, dt * 0.2);
  wetK += clamp(tr - wetK, -dt * 0.03, dt * 0.08);
  const E = envAt(h);
  const gray = c => { const l = (c[0] + c[1] + c[2]) / 3; return c.map(x => lerp(x, l, 0.75)); };
  let fog = E.fog, zen = E.zen;
  fog = fog.map((x, k) => lerp(x, gray(E.fog)[k] * (1 - rainK * 0.25), cloudK));
  zen = zen.map((x, k) => lerp(x, gray(E.zen)[k] * 1.1 * (1 - rainK * 0.3), cloudK));
  const sunC = E.sunC.map(x => x * (1 - cloudK * 0.55 - rainK * 0.2)), amb = E.amb.map(x => x * (1 - rainK * 0.12));
  const night = clamp(E.night + rainK * 0.25 + cloudK * 0.08, 0, 1);
  const a = (h - 6) / 12 * Math.PI, up = Math.sin(a);
  const sun = up > 0.05 ? norm([Math.cos(a) * 0.75, up, 0.45]) : norm([0.3, 0.8, 0.4]);
  const draw = S.draw;
  const fogN = lerp(120, 30, rainK) , fogF = lerp(draw + 220, 330, rainK);
  return { fog, zen, sun, sunC, amb, night, wet: wetK, fogN, fogF, hour: h };
}
const norm = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
function autoWeather(dtMin) {
  if (S.weather !== 'auto') { weather = S.weather; return; }
  weatherT -= dtMin;
  if (weatherT <= 0) {
    const r = Math.random(); const nw = r < 0.5 ? 'clear' : r < 0.8 ? 'cloudy' : 'rain';
    if (nw !== weather) toast({ clear: '天気：晴れ', cloudy: '天気：曇り', rain: '天気：雨が降ってきた' }[nw]);
    weather = nw; weatherT = 180 + Math.random() * 240;
  }
}

// ---------------- 入力 ----------------
function initUI() {
  // タッチボタン
  const hold = (id, k) => {
    const el = $(id);
    const on = e => { e.preventDefault(); touch[k] = true; el.classList.add('on'); try { el.setPointerCapture(e.pointerId); } catch (_) { } snd.init(); };
    const off = e => { touch[k] = false; el.classList.remove('on'); };
    el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
  };
  hold('bL', 'left'); hold('bR', 'right'); hold('bB', 'brk'); hold('tHorn', 'horn');
  // 修正89：縦スライド式アクセル。下38%はエコ（開度20〜35%）、上へずらすほど加速（35〜100%）。指を止めるとその速度をキープ（保持時間は修正100で1.0秒）
  // 修正100：速度キープの作動条件をゆるめ、作動までの進み具合を表示する
  //  ・指を止める時間は1.0秒。止まっているとみなすブレはスライダーの高さの±8%（最低14px）
  //  ・速度の条件は「急加速でないこと」（直近0.5秒の加速度が1.5m/s²未満）。作動した瞬間の速度をキープ
  //  ・作動までの進み具合はアクセルの上端のバーで表示。作動時はボタンが点滅し、HUDに「キープ中 ◯◯km/h」
  // 修正120：加速の意思がある間は作動しない（指を上へ動かしている間・上がり続けている間は保持カウントを進めず、止まってから数え始める）。
  //  キープ中にスライダーをさらに押し上げると、キープを解いてスライダーの開度で加速（上書き）。指が止まって速度が落ち着けば、その速度で保持し直す
  { const el = $('bA'), lv = $('bAlv'), kp = $('bAkp'), kpt = el.querySelector('.kpt'); let pid = null, y0 = 0, tStill = 0, yLast = 0, upT = -1e9;
    const setY = e => { const r = el.getBoundingClientRect(), f = clamp(1 - (e.clientY - r.top) / r.height, 0, 1); touch.thrV = f < 0.38 ? 0.2 + f / 0.38 * 0.15 : 0.35 + (f - 0.38) / 0.62 * 0.65; lv.style.height = (f * 100).toFixed(0) + '%'; return f; };
    const tol = () => Math.max(14, el.getBoundingClientRect().height * 0.08);
    el.addEventListener('pointerdown', e => { e.preventDefault(); snd.init(); pid = e.pointerId; try { el.setPointerCapture(pid); } catch (_) { } touch.thr = true; el.classList.add('on'); if (player.cruiseV != null) { player.cruiseV = null; toast('速度キープを解除', 900); } y0 = yLast = e.clientY; tStill = performance.now(); setY(e); });
    el.addEventListener('pointermove', e => { if (e.pointerId !== pid) return; const now = performance.now();
      if (e.clientY < yLast - 1) { upT = now; tStill = now; if (player.cruiseV != null && e.clientY < y0 - 6) { player.cruiseV = null; toast('加速（速度キープを上書き）', 900); y0 = e.clientY; } } // 上へ動かしている＝加速の意思
      yLast = e.clientY;
      if (Math.abs(e.clientY - y0) > tol()) { y0 = e.clientY; tStill = now; if (player.cruiseV != null) { player.cruiseV = null; toast('速度キープを解除', 900); } } setY(e); });
    const off = e => { if (e.pointerId !== pid) return; pid = null; touch.thr = false; touch.thrV = 0; el.classList.remove('on'); lv.style.height = '0'; kp.style.width = '0'; el.classList.remove('arm'); };
    el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
    accelHold = () => {
      const now = performance.now(), ok = keepCond();
      if (pid == null || player.cruiseV != null) { kp.style.width = '0'; el.classList.remove('arm'); el.classList.remove('accing'); return; }
      const accing = now - upT < 250 || keepCond.why === 'acc'; el.classList.toggle('accing', accing); if (kpt) kpt.textContent = accing ? '加速中はキープしません' : '指を止めるとキープ';
      if (!ok || now - upT < 250) tStill = now; // 加速中（指を上げている・速度が変化中）・ブレーキ中は待ち時間を数え直す（バーは進まない）
      const prog = clamp((now - tStill) / 1000, 0, 1);
      kp.style.width = (prog * 100).toFixed(0) + '%'; el.classList.toggle('arm', prog > 0.05);
      if (prog >= 1) engageKeep(); }; }
  // 修正119：ハンドル操作。ハンドルをドラッグで回した角度（±WMAX）→ 入力 steer（±1）。前輪の切れ角は player の車速感応（修正89）で決まる。
  //  指を離すとハンドルは中立へ戻る（セルフアライニング：速いほど早く戻る）
  { const wh = $('wheel'), img = $('wheelImg'); let wid = null, aPrev = 0;
    const angOf = e => { const r = wh.getBoundingClientRect(); return Math.atan2(e.clientX - (r.left + r.width / 2), (r.top + r.height / 2) - e.clientY); };
    wh.addEventListener('pointerdown', e => { e.preventDefault(); snd.init(); wid = e.pointerId; try { wh.setPointerCapture(wid); } catch (_) { } aPrev = angOf(e); wh.classList.add('on'); });
    wh.addEventListener('pointermove', e => { if (e.pointerId !== wid) return; const a = angOf(e); let d = a - aPrev; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; aPrev = a; wheel.ang = clamp(wheel.ang + d, -WMAX, WMAX); });
    const off = e => { if (e.pointerId !== wid) return; wid = null; wh.classList.remove('on'); };
    wh.addEventListener('pointerup', off); wh.addEventListener('pointercancel', off); wh.addEventListener('lostpointercapture', off);
    wheel.update = dt => { if (wid == null && wheel.ang) { const k = 3 + Math.abs(player.kmh) / 15; wheel.ang *= Math.exp(-k * dt); if (Math.abs(wheel.ang) < 0.005) wheel.ang = 0; } touch.wheel = -wheel.ang / WMAX; img.style.transform = `rotate(${wheel.ang.toFixed(3)}rad)`; };
    wheel.held = () => wid != null; }
  // キーボードのKキーも同じ条件（速度が安定してから入る）。押した時点で条件を満たしていれば1.0秒後に作動
  keyHold = () => { if (!keyKeepT) return; const now = performance.now(); if (player.cruiseV != null || player.gear !== 'D') { keyKeepT = 0; return; } if (!keepCond()) { keyKeepT = now; return; } if (now - keyKeepT >= 1000) { keyKeepT = 0; engageKeep(); } else if (now - keyKeepT > 8000) keyKeepT = 0; };
  const tap = (id, f) => $(id).addEventListener('pointerdown', e => { e.preventDefault(); snd.init(); f(); });
  tap('tBgm', cycleBgm); tap('ldNextB', ldNext); tap('ldBgmB', cycleBgm); $('ldSong').addEventListener('pointerdown', e => { e.preventDefault(); snd.init(); ldNext(); }); tap('tCam', cycleCam); tap('tLight', cycleLight); tap('tWL', () => setWink(-1)); tap('tWR', () => setWink(1)); tap('bDR', toggleRev); tap('tMenu', pause); tap('tMap', openMap);
  $('mm').style.pointerEvents = 'auto'; $('mm').addEventListener('pointerdown', e => { e.preventDefault(); mmZoom = (mmZoom + 1) % 3; toast('ミニマップ：' + ['標準', '広域', '詳細'][mmZoom], 900); });
  $('mapClose').onclick = closeMap; $('mapClear').onclick = () => { nav.clear(); toast('目的地を消しました'); };
  addEventListener('keydown', e => {
    keys[e.code] = true;
    if (state === 'drive') {
      if (e.code === 'KeyC') cycleCam(); if (e.code === 'KeyL') cycleLight(); if (e.code === 'KeyQ') setWink(-1); if (e.code === 'KeyE') setWink(1);
      if (e.code === 'KeyR') toggleRev(); if (e.code === 'KeyK') { if (player.cruiseV != null) { player.cruiseV = null; toast('速度キープを解除', 900); } else if (player.gear === 'D') { keyKeepT = performance.now(); toast('速度が安定したらキープします', 1100); } } if (e.code === 'KeyM') cycleBgm(); if (LD && (e.code === 'KeyB' || e.code === 'Period')) ldNext(); if (e.code === 'Escape' || e.code === 'KeyP') pause(); if (e.code === 'KeyN') openMap();
    } else if (state === 'movie' && (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space')) { if (cut) cut.finish(); e.preventDefault(); }
    else if (state === 'pause' && e.code === 'Escape') resume();
    else if (state === 'map' && (e.code === 'Escape' || e.code === 'KeyN')) closeMap();
    if (state === 'drive' && /Arrow|Space/.test(e.code)) e.preventDefault();
    snd.init();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  // フォーカスが外れたら自動で一時停止（キーの押しっぱなし防止）
  const lost = () => { for (const k in keys) keys[k] = false; for (const k in touch) { touch[k] = false; } document.querySelectorAll('.tb.on').forEach(b => { if (!b.classList.contains('rev')) b.classList.remove('on'); }); if (state === 'drive' && !bench) { doSave(true); pause(); } };
  addEventListener('blur', lost); addEventListener('pagehide', lost);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { lost(); snd.suspend(); } else snd.resume(); });
  // iOS Safari / LINE内ブラウザ：ピンチ・ダブルタップ拡大と画面のずれを防ぐ
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
  document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
  let lastTouch = 0; document.addEventListener('touchend', e => { const n = Date.now(); if (n - lastTouch < 350 && !e.target.closest('select,input,button,#mapC')) e.preventDefault(); lastTouch = n; }, { passive: false });
  document.addEventListener('touchmove', e => { if (e.touches.length > 1 || !e.target.closest('.panel,#mapC')) e.preventDefault(); }, { passive: false });
  const fixVP = () => { window.scrollTo(0, 0); document.body.scrollTop = 0; };
  if (window.visualViewport) { visualViewport.addEventListener('resize', fixVP); visualViewport.addEventListener('scroll', fixVP); }
  document.addEventListener('focusout', () => setTimeout(fixVP, 50));
  document.querySelectorAll('select').forEach(s => s.addEventListener('change', () => { s.blur(); fixVP(); }));
  // ボタンが pointer 系で反応しない環境（古いWebView）向けの click 代替
  document.querySelectorAll('.menu button, .btns button').forEach(b => { if (!b.onclick) return; });
  // メニュー
  $('mStart').onclick = () => { snd.init(); if ($('mContinue').hidden) startDrive(); else { player.reset(START.x, START.z, START.yaw); startDrive(); } };
  $('mContinue').onclick = () => { snd.init(); startDrive(); };
  $('mLD').onclick = () => { snd.init(); openLDSet(null); };
  $('mLDCont').onclick = () => { snd.init(); if (ldSv) startLD(ldSv.cfg, ldSv); };
  $('cutSkip').onclick = () => { if (cut) cut.finish(); };
  $('ldcTitle').onclick = () => location.reload();
  $('ldcSame').onclick = () => { try { sessionStorage.setItem('ldNext', JSON.stringify({ same: 1, cfg: LD.cfg })); } catch (e) { /* none */ } location.reload(); };
  $('ldcOther').onclick = () => { try { sessionStorage.setItem('ldNext', JSON.stringify({ same: 0, cfg: LD.cfg })); } catch (e) { /* none */ } location.reload(); };
  $('mVehicle').onclick = () => openSelect('title');
  $('mSettings').onclick = () => openSettings('title');
  $('mHow').onclick = () => { show('howto'); prevState = 'title'; };
  $('howBack').onclick = () => show('title');
  $('selBack').onclick = () => closeSelect();
  $('selOk').onclick = () => { closeSelect(); doSave(true); };
  $('setBack').onclick = () => { applySettings(); doSave(true); show(prevState === 'pause' ? 'pause' : 'title'); if (prevState === 'pause') pauseInfo(); }; // 設定で変えた時刻をポーズ画面にすぐ反映
  $('sBench').onclick = () => { applySettings(); snd.init(); startBench(); };
  $('benchCopy').onclick = async () => { try { await navigator.clipboard.writeText($('benchOut').textContent); toast('コピーしました'); } catch (e) { toast('コピーできませんでした。文字を長押しで選択してください'); } };
  $('benchClose').onclick = () => $('bench').classList.remove('on');
  $('pResume').onclick = resume; $('pVehicle').onclick = () => openSelect('pause'); $('pSettings').onclick = () => openSettings('pause');
  $('pSave').onclick = async () => { const b = $('pSave'); b.disabled = true; b.textContent = 'セーブ中…'; const w = await doSave(true); b.disabled = false; b.textContent = 'セーブ'; toast(w === 'memory' ? 'セーブできませんでした（この端末では保存領域が使えません）' : 'セーブしました（' + w + '）', 2200); };
  $('sReset').onclick = async () => { const b = $('sReset'); if (!b.dataset.arm) { b.dataset.arm = 1; b.textContent = 'もう一度押すと消去'; setTimeout(() => { delete b.dataset.arm; b.textContent = 'セーブデータを消去'; }, 3000); return; } delete b.dataset.arm; b.textContent = 'セーブデータを消去'; await clearSave(); Object.assign(S, S0); color = 0; gameMin = 7 * 60 + 30; const w = warpPos(START.x, START.z, START.yaw); player.reset(w.x, w.z, w.yaw); openSettings(prevState); $('mContinue').hidden = true; toast('セーブデータを消去しました', 2000); };
  $('pRespawn').onclick = () => { if (LD) { LD.rescue(player); clearAround(player.x, player.z); cam.mode = -1; lastPos = null; } else doWarp(+$('pWarp').value); resume(); };
  $('pWarp').innerHTML = WARPS.map((w, i) => `<option value="${i}">${w[0]}</option>`).join('');
  $('pMap').onclick = () => { resume(); openMap(); }; // 修正116：長距離のタッチ画面では上段の「地図」をポーズメニューへ移した（市街地でも使える）
  $('pTitle').onclick = async () => { await doSave(true); if (LD) { location.reload(); return; } $('mContinue').hidden = false; state = 'title'; show('title'); setHud(false); };
  $('err').addEventListener('pointerdown', () => { if (state !== 'load') { $('err').textContent = ''; errN = 0; } });
  // 色チップ
  $('chips').innerHTML = MIRA_COLORS.map((c, i) => `<button class="chip" data-i="${i}" style="background:${c.hex}" aria-label="${c.name}"></button>`).join('');
  $('chips').onclick = e => { const b = e.target.closest('.chip'); if (b) { color = +b.dataset.i; markChips(); } };
  for (const [id, k] of [['dAge', 'age'], ['dSex', 'sex'], ['dOut', 'outfit']]) $(id).onchange = () => { driver[k] = +$(id).value; rebuildDriver(); $('cname').textContent = MIRA_COLORS[color].name + '　運転者：' + AGES[driver.age] + '・' + SEXES[driver.sex] + '・' + OUTFITS[driver.outfit]; };
}
function markChips() { document.querySelectorAll('.chip').forEach((b, i) => b.classList.toggle('on', i === color)); $('cname').textContent = MIRA_COLORS[color].name + '　運転者：' + AGES[driver.age] + '・' + SEXES[driver.sex] + '・' + OUTFITS[driver.outfit]; $('dAge').value = driver.age; $('dSex').value = driver.sex; $('dOut').value = driver.outfit; }
function openSelect(from) { prevState = from; state = 'select'; show('select'); setHud(false); markChips(); }
function closeSelect() { if (prevState === 'pause') { state = 'pause'; show('pause'); } else { state = 'title'; show('title'); } }
function openSettings(from) {
  prevState = from; show('settings');
  $('sTime').value = 'keep'; $('sFlow').value = String(S.flow); $('sWeather').value = S.weather;
  $('sCamD').value = S.camD; $('sCamH').value = S.camH; $('sNpc').value = String(S.npc); $('sAuto').value = String(S.auto); $('sAeb').value = String(S.aeb); $('sAmb').value = String(S.amb); $('sLim').value = String(S.lim); $('sAc').value = String(S.ac); $('sIs').value = String(S.is);
  $('sLdBgm').value = LDP.bgm ? '1' : '0'; $('sLdTalk').value = LDP.talk ? '1' : '0'; $('sLdRadio').value = LDP.radio ? '1' : '0'; $('sLdNav').value = LDP.nav ? '1' : '0'; $('sLdVol').value = LDP.vol; $('sSteer').value = LDP.steer;
  $('sBgm').value = S.bgm; $('sBgmVol').value = S.bgmVol; $('sDraw').value = S.draw; $('sRes').value = S.res; $('sVol').value = S.vol; $('sAssist').value = String(S.assist); $('sDbg').value = String(S.dbg); $('sDet').value = S.det;
}
function applySettings() {
  const t = $('sTime').value; if (t !== 'keep' && !LD) gameMin = parseFloat(t) * 60; // 長距離ドライブ中は時刻・天候を変えない（現実45分＝24時間の進行を守る）
  S.flow = +$('sFlow').value; S.weather = $('sWeather').value; if (S.weather !== 'auto' && !LD) weather = S.weather;
  if (music) music.kick(); // 修正97-7：時刻・天候を変えたらBGMをすぐ切り替える
  S.camD = +$('sCamD').value; S.camH = +$('sCamH').value; S.npc = +$('sNpc').value; S.auto = +$('sAuto').value; S.aeb = +$('sAeb').value; S.amb = +$('sAmb').value; S.lim = +$('sLim').value; S.ac = +$('sAc').value; S.is = +$('sIs').value;
  S.draw = +$('sDraw').value; S.res = +$('sRes').value; S.vol = +$('sVol').value; S.assist = +$('sAssist').value; S.dbg = +$('sDbg').value; S.det = +$('sDet').value;
  S.bgm = $('sBgm').value; S.bgmVol = +$('sBgmVol').value; music.mode = S.bgm; music.setVol(S.bgmVol);
  LDP.bgm = $('sLdBgm').value === '1'; LDP.talk = $('sLdTalk').value === '1'; LDP.radio = $('sLdRadio').value === '1'; LDP.nav = $('sLdNav').value === '1'; LDP.vol = +$('sLdVol').value; LDP.steer = $('sSteer').value === 'buttons' ? 'buttons' : 'wheel'; saveLDPrefs(LDP); steerUI();
  if (ldMusic) { ldMusic.setVol(LDP.vol); if (LD) ldMusic.setOn(LDP.bgm); } if (LD) { LD.ev.opts.talk = LDP.talk; LD.ev.opts.radio = LDP.radio; LD.ev.opts.nav = LDP.nav; markToggles(); ldSongUI(); }
  snd.setVol(S.vol); player.assist = !!S.assist; // perfK（自動調整の結果）は設定変更でリセットしない
}
// ---------- ワープ（最寄り道路の左端車線・NPC/障害物を避ける） ----------
function warpPos(x, z, yaw) {
  let best = null, bd = 1e9;
  for (const e of city.edges) {
    const n = e.pts.length; let s0 = 0;
    for (let i = 0; i < n - 1; i++) {
      const a = e.pts[i], b = e.pts[i + 1], vx = b[0] - a[0], vz = b[1] - a[1], l2 = vx * vx + vz * vz || 1, tt = clamp(((x - a[0]) * vx + (z - a[1]) * vz) / l2, 0, 1);
      const d = Math.hypot(a[0] + vx * tt - x, a[1] + vz * tt - z), hd = Math.atan2(vx, vz);
      if (Math.cos(hd - yaw) > 0.7 && d < bd) { bd = d; best = { e, s: s0 + Math.sqrt(l2) * tt }; }
      s0 += Math.sqrt(l2);
    }
  }
  if (!best || bd > 60) return { x, z, yaw };
  const e = best.e, k = e.lanes - 1;
  // 修正97-6：左車線の中央に出す。細い1車線道路（峠道など）では中央線から少し離し、曲線では交差点の出口のすぐ先を避けて30m以上先に出す
  const off = e.lanes === 1 && e.lw < 3.1 ? 0.3 : 0;
  let s = clamp(best.s, e.straight ? 8 : Math.min(30, e.len / 2), e.len - 8);
  const blocked = (p) => [...city.query(p[0], p[1], 3)].some(b => b.kind !== 'x' && b.y1 > 0.3 && p[0] > b.x0 - 1.0 - 0.8 && p[0] < b.x1 + 1.0 + 0.8 && p[1] > b.z0 - 1.0 - 1.7 && p[1] < b.z1 + 1.0 + 1.7);
  let p = city.lanePos(e, k, s, off);
  const blockedAhead = s0 => [0, 2.5, 5, 7.5].some(a => blocked(city.lanePos(e, k, Math.min(e.len - 1, s0 + a), off))); // 前方5m以内も空いていること
  for (let tries = 0; tries < 16 && blockedAhead(s); tries++) { s = clamp(s + 4, 8, e.len - 12); p = city.lanePos(e, k, s, off); }
  return { x: p[0], z: p[1], yaw: city.headAt(e, s), y: city.yAt(e, s) };
}
function clearAround(x, z, r = 6) { for (const c of traffic.cars.slice()) if (!c.persist && (c.x - x) ** 2 + (c.z - z) ** 2 < r * r) traffic.remove(c); }
function doWarp(i) {
  const w = WARPS[i];
  if (w[1] === 'pad') { // 道の駅：駐車場の中央で、峠道（出口）の方を向いて出現
    const p = city.restPad, cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2 + 2; // 中央に出現し、出口（峠道）を向く
    let [tx, tz] = p.exit || [cx, cz + 20];
    player.reset(cx, cz, Math.atan2(tx - cx, tz - cz), p.y + 1);
  } else { const q = warpPos(w[1], w[2], w[3]); player.reset(q.x, q.z, q.yaw, (q.y || 0) + 1); }
  clearAround(player.x, player.z); cam.mode = -1; lastPos = null;
}
// ---------- 性能測定（実機で実行して結果をコピー） ----------
let bench = null;
const BENCH_SPOTS = [['駅前', -60, -379.9, Math.PI / 2], ['本町通り', -300, 4.9, -Math.PI / 2], ['商店街', -248.5, -200, 0], ['国道ロードサイド', 640, -5.25, Math.PI / 2], ['郊外住宅地', -998.4, -760, 0], ['水瀬川の橋', 1.6, 470, 0], ['みなせ峠', -501.5, -1100, Math.PI], ['田園地帯', -998.4, 1300, 0]];
function startBench() {
  bench = { i: -1, res: [] };
  show(null); state = 'drive'; setHud(true); camMode = 0; nextSpot();
}
function nextSpot() {
  Object.assign(bench, { i: bench.i + 1, t: 0, n: 0, sum: 0, worst: 0, tris: 0, draws: 0 });
  if (bench.i >= BENCH_SPOTS.length) return finishBench();
  const p = BENCH_SPOTS[bench.i]; player.reset(p[1], p[2], p[3], 1000); cam.mode = -1;
  toast(`性能測定中 ${bench.i + 1}/${BENCH_SPOTS.length}：${p[0]}`, 4000);
}
function benchTick(dt) {
  bench.t += dt;
  if (bench.t < 2.0) return; // 読み込み待ち
  const rd = Math.min(1, loop.raw || dt); bench.n++; bench.sum += rd; bench.worst = Math.max(bench.worst, rd); bench.tris = Math.max(bench.tris, R.stats.tris); bench.draws = Math.max(bench.draws, R.stats.draws);
  if (bench.t > 6.0) {
    const p = BENCH_SPOTS[bench.i];
    bench.res.push(`${p[0]}: 平均 ${(bench.n / bench.sum).toFixed(1)}fps / 最悪 ${(bench.worst * 1000).toFixed(0)}ms / ${(bench.tris / 1000).toFixed(0)}k三角形 / 描画${bench.draws}回 / NPC${traffic.cars.length}台`);
    nextSpot();
  }
}
function finishBench() {
  const gl = R.gl, dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '不明';
  const head = `水瀬市ドライブ v0.4 性能測定\n端末: ${navigator.userAgent.slice(0, 120)}\nGPU: ${gpu}\n画面: ${innerWidth}x${innerHeight} DPR${devicePixelRatio} 描画解像度${R.cv.width}x${R.cv.height}\n設定: 描画距離${S.draw}m 解像度${S.res} 細部${S.det}m 交通量×${S.npc} 自動調整${S.auto ? 'ON' : 'OFF'}`;
  const txt = head + '\n' + bench.res.join('\n');
  bench = null; player.reset(START.x, START.z, START.yaw); state = 'pause'; show('pause'); setHud(false);
  $('benchOut').textContent = txt; $('bench').classList.add('on');
}
function startDrive() { state = 'drive'; show(null); setHud(true); markToggles(); toast('水瀬市へようこそ　' + MIRA_COLORS[color].name + ' のミライース'); }
function openMap() { if (state !== 'drive') return; state = 'map'; show('map'); setHud(false); $('mapClear').hidden = !!LD; $('mapMsg').textContent = LD ? '長距離ドライブの路線図（休憩施設と目的地）' : '地図をドラッグで移動・ピンチ/ホイールで拡大。タップで目的地を設定'; nav.open(MM, MMX0, MMZ0, MMS); }
function closeMap() { nav.close(); state = 'drive'; show(null); setHud(true); }
function pause() { if (state !== 'drive') return; state = 'pause'; show('pause'); setHud(false); pauseInfo(); }
function pauseInfo() { if (LD) { const st = LD.st; $('pInfo').textContent = `長距離ドライブ（${SEASON_NAMES[LD.season]}）　${hhmm(gameMin)}\n現在地：${city.district(player.x, player.z)}　目的地 ${LD.D.dest} まで ${LD.remainKm().toFixed(0)}km\n走行 ${st.totalKm.toFixed(1)}km ／ 運転 ${dur(st.driveMin)} ／ 連続 ${dur(st.contMin)}\n疲労度 ${st.fatigue.toFixed(0)}%（${fatigueStage(st.fatigue)[1]}）／ 休憩 ${st.rests}回`; $('pInfo').style.whiteSpace = 'pre-line'; return; } const h = Math.floor(gameMin / 60), m = Math.floor(gameMin % 60); $('pInfo').textContent = `現在地：${city.district(player.x, player.z)}　${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}　${{ clear: '晴れ', cloudy: '曇り', rain: '雨' }[weather]}\nNPC ${traffic.cars.length}台（駐車中 ${traffic.stats.parkedNow}）／ 車両データ ${MODELS.length}車種・${VARIATIONS}通り`; $('pInfo').style.whiteSpace = 'pre-line'; }
function resume() { state = 'drive'; show(null); setHud(true); }
const TOUCHUI = MOBILE || navigator.maxTouchPoints > 0 || 'ontouchstart' in window; // PC（マウス・キーボード）ではタッチ操作のボタンを出さない
function steerUI() { document.body.classList.toggle('whl', LDP.steer === 'wheel'); if (LDP.steer !== 'wheel') { wheel.ang = 0; touch.wheel = 0; } }
function setHud(on) { steerUI(); $('hud').classList.toggle('on', on); if (!on) { $('trainBan').classList.remove('on'); if (trainBanner.st) trainBanner.st.key = ''; } $('touch').classList.toggle('on', on && TOUCHUI); document.body.classList.toggle('pc', !TOUCHUI); }
function cycleBgm() {
  if (LD) { LDP.bgm = !LDP.bgm; saveLDPrefs(LDP); ldMusic.setOn(LDP.bgm); toast('BGM：' + (LDP.bgm ? 'ON（' + SEASON_NAMES[LD.season] + 'のドライブ曲・シャッフル再生）' : 'OFF（エンジン音・環境音のみ）'), 1600); markToggles(); ldSongUI(); return; } // 修正102：長距離ドライブ中はON/OFFの切り替え（設定は保存）
  const modes = ['auto', ...TRACKS.map(t => t.id), 'off'], i = (modes.indexOf(S.bgm) + 1) % modes.length;
  S.bgm = modes[i]; music.mode = S.bgm;
  toast('BGM：' + (S.bgm === 'auto' ? '自動（場所・時間・天気で選曲）' : S.bgm === 'off' ? 'OFF' : TRACKS.find(t => t.id === S.bgm).name), 1600);
}
function cycleCam() { camMode = (camMode + 1) % 3; toast(['三人称視点', '運転席視点', 'ボンネット視点'][camMode], 900); markToggles(); }
function cycleLight() { lightMode = (lightMode + 1) % 3; toast('ライト：' + ['自動', 'ON', 'OFF'][lightMode], 900); markToggles(); }
function markToggles() { document.body.classList.toggle('cock', camMode === 1); $('tCam').textContent = ['視点:後方', '視点:運転席', '視点:ボンネット'][camMode]; $('tLight').textContent = 'ライト:' + ['自動', 'ON', 'OFF'][lightMode]; $('tLight').classList.toggle('on', lightMode === 1); $('ldBgmB').textContent = LDP.bgm ? 'BGM ON' : 'BGM OFF'; $('ldBgmB').classList.toggle('on', LDP.bgm); $('tBgm').textContent = LD ? (LDP.bgm ? 'BGM:ON' : 'BGM:OFF') : S.bgm === 'off' ? 'BGM:OFF' : 'BGM'; }
function setWink(d) { wink = wink === d ? 0 : d; winkYaw = player.yaw; }
function syncGear() { if (!$('bDR')) return; const rv = player && player.gear === 'R'; $('bDR').textContent = rv ? 'R' : 'D'; $('bDR').classList.toggle('rev', !!rv); $('gear').classList.toggle('rev', !!rv); $('gear').textContent = rv ? 'R' : 'D'; $('spd').classList.toggle('rev', !!rv); }
function toggleRev() { player.gearReq = true; } // 結果は player.gearResult で受け取り、gearFeedback() で知らせる
function gearFeedback() {
  const r = player.gearResult; if (!r) return; player.gearResult = null;
  if (r === 'ok') { const rv = player.gear === 'R'; snd.beep(rv ? 1400 : 900, 0.07, rv ? 2 : 1); toast(rv ? 'R：バック（後退）' : 'D：前進', 1100); $('gear').animate?.([{ transform: 'scale(1.8)' }, { transform: 'scale(1)' }], 300); }
  else { snd.beep(300, 0.18, 1); navigator.vibrate?.(120); toast('止まってから切り替えてください（ブレーキで停止）', 1500); }
  syncGear();
}

// ---------------- セーブ ----------------
// 読み込んだセーブは型と範囲を検査してから使う（壊れた値で起動できなくなるのを防ぐ）
function applySave(sv) {
  if (!sv || typeof sv !== 'object') return;
  const num = (v, a, b) => typeof v === 'number' && isFinite(v) && v >= a && v <= b;
  if (num(sv.color, 0, MIRA_COLORS.length - 1)) color = sv.color | 0;
  if (num(sv.x, -2050, 2050) && num(sv.z, -2050, 2050) && num(sv.yaw, -100, 100)) {
    const y = num(sv.y, -5, 60) ? sv.y : 0; // v2から高さも保存（バイパス高架の上で再開できるように）
    player.reset(sv.x, sv.z, sv.yaw, y + 1);
    if (Math.abs(player.y - y) > 3 && !city.allowed(sv.x, sv.z)) { const w = warpPos(START.x, START.z, START.yaw); player.reset(w.x, w.z, w.yaw); }
  }
  if (num(sv.time, 0, 1440)) gameMin = sv.time;
  if (sv.driver && num(sv.driver.age, 0, 2) && num(sv.driver.sex, 0, 1) && num(sv.driver.outfit, 0, 2)) { let o = sv.driver.outfit | 0; if (!(sv.v >= 3)) o = [1, 2, 0][o]; driver = { age: sv.driver.age | 0, sex: sv.driver.sex | 0, outfit: o }; rebuildDriver(); } // v2（カジュアル/スーツ/作業着）→v3（普段着/カジュアル/スーツ）
  if (['clear', 'cloudy', 'rain'].includes(sv.weather)) weather = sv.weather;
  if (sv.settings && typeof sv.settings === 'object') for (const k in S0) { const v = sv.settings[k]; if (typeof v === typeof S0[k] && (typeof v !== 'number' || isFinite(v))) S[k] = v; }
  if (!(sv.v >= 2) && S.npc > 2) S.npc = S.npc <= 20 ? 0.7 : S.npc >= 40 ? 1.2 : 1; // v1（台数指定）→ v2（交通量の倍率）
  S.npc = [0.7, 1, 1.2].includes(S.npc) ? S.npc : 1; S.res = clamp(S.res, 0.5, 1); S.draw = clamp(S.draw, 200, 650); S.det = clamp(S.det, 120, 500);
  player.assist = !!S.assist; snd.setVol(S.vol); if (music) { music.mode = S.bgm; music.setVol(S.bgmVol); } if (ldMusic) ldMusic.setVol(LDP.vol);
}
async function doSave() {
  lastSave = T;
  if (LD) return state === 'ldclear' ? 'clear' : LD.save(player); // 長距離ドライブは専用のセーブ（市街地のセーブは変えない）
  return saveGame({ v: 3, color, x: player.x, y: player.y, z: player.z, yaw: player.yaw, time: gameMin, weather, driver: { ...driver }, settings: { ...S }, at: Date.now() });
}

// ---------------- ミニマップ ----------------
let MM;
let MMX0 = -2100, MMZ0 = -2100, MMS = 0.32;
function buildMinimap() {
  const W = Math.ceil(4200 * MMS);
  MM = document.createElement('canvas'); MM.width = W; MM.height = W;
  const c = MM.getContext('2d'), X = x => (x - MMX0) * MMS, Z = z => (z - MMZ0) * MMS, rect = (r, col) => { c.fillStyle = col; c.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * MMS, (r.z1 - r.z0) * MMS); };
  c.fillStyle = '#33452c'; c.fillRect(0, 0, W, W);
  c.fillStyle = '#26381f'; c.fillRect(0, 0, W, Z(-1000));
  for (const r of city.mm.green) rect(r, '#3d5a2c');
  rect({ x0: -505, x1: 505, z0: -505, z1: 505 }, '#3b3d3a');
  for (const r of city.mm.water) rect(r, '#2e5f86');
  for (const r of city.mm.lots) rect(r, '#4a4a48');
  for (const r of city.mm.blds) rect(r, '#6c6d74');
  for (const l of city.mm.lanes) {
    c.fillStyle = c.strokeStyle = l.kind === 'art' || l.kind === 'nat' ? '#f0d9a0' : l.kind === 'byp' ? '#9fd0f0' : l.kind === 'lane' ? '#8d8d88' : '#d8d8d0';
    if (l.poly) { c.lineWidth = 2 * l.w * MMS; c.beginPath(); l.poly.forEach((p, i) => i ? c.lineTo(X(p[0]), Z(p[1])) : c.moveTo(X(p[0]), Z(p[1]))); c.stroke(); continue; }
    const ext = l.kind === 'lane' ? 0 : l.w;
    if (l.axis === 'ns') c.fillRect(X(l.c - l.w), Z(l.a - ext), 2 * l.w * MMS, (l.b - l.a + 2 * ext) * MMS);
    else c.fillRect(X(l.a - ext), Z(l.c - l.w), (l.b - l.a + 2 * ext) * MMS, 2 * l.w * MMS);
  }
  c.fillStyle = '#9aa3b5'; c.fillRect(0, Z(-450), W, 10 * MMS);
}
function drawMinimap() {
  const cv = $('mm'), c = cv.getContext('2d'), W = cv.width, k = 2.4 * 0.5 / MMS * [1, 0.45, 2.0][mmZoom] * (player.kmh > 70 && mmZoom === 0 ? 0.7 : 1);
  c.save(); c.clearRect(0, 0, W, W); c.beginPath(); c.arc(W / 2, W / 2, W / 2, 0, 7); c.clip();
  c.fillStyle = '#2c3b27'; c.fillRect(0, 0, W, W);
  c.translate(W / 2, W / 2); c.rotate(Math.PI + player.yaw); c.scale(k, k);
  c.translate(-(player.x - MMX0) * MMS, -(player.z - MMZ0) * MMS);
  c.drawImage(MM, 0, 0);
  nav.drawMini(c, x => (x - MMX0) * MMS, z => (z - MMZ0) * MMS, k);
  c.fillStyle = '#ffffff';
  for (const n of traffic.cars) { c.fillRect((n.x - MMX0) * MMS - 0.8, (n.z - MMZ0) * MMS - 0.8, 1.6, 1.6); }
  // 信号（現在の状態）
  for (const h of city.sigHeads || []) {
    const dx = h.x - player.x, dz = h.z - player.z; if (dx * dx + dz * dz > 120 * 120) continue;
    const s = city.sig(h.node, h.axis, T); c.fillStyle = s === 'g' ? '#19c3a0' : s === 'y' ? '#ffb63a' : '#ff4b3a';
    c.fillRect((h.x - MMX0) * MMS - 0.7, (h.z - MMZ0) * MMS - 0.7, 1.4, 1.4);
  }
  c.restore();
  // 修正97-5：ミニマップにも地名を表示（標準・広域のとき。文字は回転させずに読める向きで、画面上12〜13px相当）
  if (mmZoom !== 2) { const a = Math.PI + player.yaw, ca = Math.cos(a), sa = Math.sin(a), fs = mmZoom === 1 ? 26 : 24;
    c.save(); c.beginPath(); c.arc(W / 2, W / 2, W / 2 - 4, 0, 7); c.clip(); c.font = `800 ${fs}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.75)'; c.fillStyle = '#ffe9b8';
    for (const [n, x, z] of (mmLabels || MAP_LABELS)) { const lx = (x - player.x) * MMS * k, lz = (z - player.z) * MMS * k, sx = W / 2 + lx * ca - lz * sa, sy = W / 2 + lx * sa + lz * ca; if (Math.hypot(sx - W / 2, sy - W / 2) > W / 2 - 22) continue; c.strokeText(n, sx, sy); c.fillText(n, sx, sy); }
    c.restore(); }
  c.fillStyle = '#ffb63a'; c.beginPath(); c.moveTo(W / 2, W / 2 - 12); c.lineTo(W / 2 - 8, W / 2 + 9); c.lineTo(W / 2, W / 2 + 4); c.lineTo(W / 2 + 8, W / 2 + 9); c.fill();
  c.fillStyle = '#fff'; c.font = '700 18px sans-serif'; c.textAlign = 'center';
  const a = Math.PI + player.yaw; // 北マーク（地図の回転に合わせて縁を回る）
  c.fillText('N', W / 2 + Math.sin(a) * (W / 2 - 18), W / 2 - Math.cos(a) * (W / 2 - 18) + 6);
}

// ---------------- メインループ ----------------
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  loop.raw = (now - last) / 1000;
  if (DEV) { (loop.hist = loop.hist || []).push(loop.raw); if (loop.hist.length > 900) loop.hist.shift(); }
  let dt = Math.min(DEV && window.G && G.dtCap ? G.dtCap : 0.05, loop.raw); last = now; // 開発用：G.dtCap でヘッドレス検証を早回しできる（通常は1フレーム最大0.05秒）
  T += dt;
  const t0 = performance.now();
  try { tick(dt); } catch (e) { // 例外はHUDに表示し、続くようならタイトルへ戻す
    console.error(e); errN++; $('err').textContent = 'エラー: ' + e.message + (errN > 30 ? '（タイトルに戻りました）' : '');
    if (errN > 30 && state !== 'title') { state = 'title'; show('title'); setHud(false); errN = 0; }
  }
  loop.ms = (loop.ms || 0) * 0.95 + (performance.now() - t0) * 0.05;
}
function tick(dt) {
  R.resize(S.res * resK);
  const aspect = R.cv.width / R.cv.height;
  if (state === 'select') { renderSelect(dt, aspect); return; }
  if (state === 'ldset') { renderLDSet(dt, aspect); return; }
  if (state === 'movie' && cut) { cut.render(dt, aspect); if (snd.ok) snd.update({ rpm: 800, thr: 0, kmh: 0, brake: 0, slip: 0, rain: false, horn: false, npcNear: 0, cityK: 0, cockpit: false, engine: 0, amb: null }); return; }
  if (state === 'ldclear') { tick.cl = (tick.cl || 0) + dt; }
  if (state === 'pause' && (tick.pi = (tick.pi || 0) + dt) > 0.5) { tick.pi = 0; pauseInfo(); }
  const driving = state === 'drive';
  // 時間
  if (LD) { if (driving) gameMin = Math.min(1439, gameMin + dt * LD.flow); weather = LD.ev.weather(); } // 長距離：現実1秒＝ゲーム内32/60分。天候は季節の標準＋ときどきの変化（修正111）
  else if (driving || state === 'title') { gameMin = (gameMin + dt * S.flow) % 1440; autoWeather(dt * S.flow); }
  const env = envUniforms(driving || state === 'title' ? dt : 0);
  // トンネル：入口・出口で明るさを1.5秒かけて変える
  const inTunP = city.inTunnelXZ(player.x, player.z) && !!city.mtnRoadAt(player.x, player.z);
  tunK += clamp((inTunP ? 1 : 0) - tunK, -dt / 1.5, dt / 1.5);
  // 入力→物理
  if (driving) {
    const thr = (keys.ArrowUp || keys.KeyW) ? 1 : touch.thr ? (touch.thrV || 0.3) : 0, brk = (keys.ArrowDown || keys.KeyS || keys.Space || touch.brk) ? 1 : 0;
    if (accelHold) accelHold(); if (keyHold) keyHold();
    player.limiter = !!S.lim; player.ac = !!S.ac; player.isEnabled = !!S.is;
    if (wheel.update) wheel.update(dt);
    const kb = ((keys.ArrowLeft || keys.KeyA) ? 1 : 0) - ((keys.ArrowRight || keys.KeyD) ? 1 : 0), btn = (touch.left ? 1 : 0) - (touch.right ? 1 : 0);
    const st = kb || (TOUCHUI && LDP.steer === 'wheel' ? touch.wheel || 0 : btn); // 修正119：キーボード優先。タッチはハンドル（既定）かボタン
    player.input = bench ? { thr: 0, brk: 1, steer: 0 } : { thr, brk, steer: st };
    if (DEV && LD && window.G && G.ap) player.input = apInput(G.ap); // 開発用の自動運転（自己テスト：長距離の時間・休憩・到着の確認）
    horn = !!(keys.KeyH || touch.horn);
    player.aeb = S.aeb ? aebCheck() : 0;
    const n = Math.ceil(dt / 0.008), h = dt / n, wet = (LD ? Math.min(0.35, wetK) : wetK) * (1 - tunK); // 修正111：長距離のにわか雨では路面の滑りやすさを強めない（運転を理不尽に難しくしない）
    for (let i = 0; i < n; i++) player.step(h, { rain: wet > 0.5, wet }, traffic.cars);
    gearFeedback();
    if (player.edgeHit && LD) { toast('コースの外には出られません', 1800); player.edgeHit = 0; }
    if (player.edgeHit) { toast(player.edgeHit === 2 ? '川には入れません。橋を渡ってください' : 'ここから先は水瀬市の外です。ハンドルを切るかバックで戻れます', 2200); player.edgeHit = 0; }
    if (player.needRescue && LD) { player.needRescue = false; LD.rescue(player); clearAround(player.x, player.z); cam.mode = -1; lastPos = null; toast('動けなくなったので道路に戻しました', 2200); }
    if (player.needRescue) { player.needRescue = false; const w = warpPos(player.x, player.z, player.yaw); player.reset(w.x, w.z, w.yaw, (w.y || 0) + 1); clearAround(player.x, player.z); cam.mode = -1; lastPos = null; toast('動けなくなったので近くの道路に戻しました', 2200); }
    // 表示速度：位置の変化から求めた対地速度をなめらかにしたもの
    if (lastPos) { const dd = Math.hypot(player.x - lastPos[0], player.z - lastPos[1], (player.y - lastPos[2]) * 0.5), v = dd / Math.max(dt, 1e-3); gSpd += (Math.min(v, 80) - gSpd) * (1 - Math.exp(-dt * 6)); odo.real += dd; odo.disp += gSpd * dt; }
    lastPos = [player.x, player.z, player.y];
    nav.update(dt);
    if (LD) { LD.update(dt, player, gSpd); if (LD && state === 'drive') { const q = LD.ev.poll(); if (q) showSub(q); } }
    subT -= dt; if (subT <= 0 && $('ldSub').classList.contains('on')) $('ldSub').classList.remove('on');
    if (player.hit > 0.15) { snd.thump(player.hit * 0.6); player.hit = 0; } else player.hit *= 0.9;
    // ウインカー自動キャンセル
    if (wink && Math.abs(player.steer) < 0.05 && Math.abs(((player.yaw - winkYaw + 9 * Math.PI) % (2 * Math.PI)) - Math.PI) > 1.1) wink = 0;
  }
  // カメラ
  const pM = M4.trs(player.x, player.y, player.z, player.yaw, player.pitch + (player.slopeV || 0), player.roll);
  const fwd = [Math.sin(player.yaw), 0, Math.cos(player.yaw)];
  let near = 0.3, fov = 60;
  if (state === 'title' || state === 'load') {
    const a = T * 0.05;
    cam.p = [START.x + 40 + Math.cos(a) * 160, 95, START.z + 120 + Math.sin(a) * 160]; cam.look = [START.x + 40, 0, START.z + 120];
  } else if (camMode === 0) {
    const tp = [player.x - fwd[0] * S.camD, player.y + S.camH, player.z - fwd[2] * S.camD];
    const k = 1 - Math.exp(-dt * 7);
    if (cam.mode !== 0) { cam.p = tp; cam.mode = 0; }
    cam.p = cam.p.map((v, i) => lerp(v, tp[i], k));
    // 建物にめり込みにくいよう距離を保つ
    const dx = cam.p[0] - player.x, dz = cam.p[2] - player.z, d = Math.hypot(dx, dz);
    if (d > S.camD * 1.25) { cam.p[0] = player.x + dx / d * S.camD * 1.25; cam.p[2] = player.z + dz / d * S.camD * 1.25; }
    cam.look = [player.x + fwd[0] * 3, player.y + 0.9, player.z + fwd[2] * 3];
  } else {
    const eye = camMode === 1 ? car.def.eye : [0, 1.06, 0.72];
    cam.p = M4.apply(pM, ...eye); const f2 = M4.apply(pM, eye[0], eye[1] - (camMode === 1 ? 0.005 : 0.04), eye[2] + 1); // 修正114：運転者視点はほぼ水平に前を見る（ダッシュボードが画面下部に収まり、信号・標識まで見通せる）
    cam.look = f2; cam.mode = camMode; near = camMode === 1 ? 0.05 : 0.15; fov = camMode === 1 ? 66 : 62;
  }
  const up = camMode > 0 && state !== 'title' ? [pM[4], pM[5], pM[6]] : [0, 1, 0];
  if (DEV && window.G && G.camOv) { const o = G.camOv; cam.p = [o[0], o[1], o[2]]; cam.look = [o[3], o[4], o[5]]; }
  const view = M4.lookAt(cam.p, cam.look, up), proj = M4.persp(fov * Math.PI / 180, aspect, near, 4300);
  const vp = M4.mul(proj, view), planes = M4.frustum(vp);
  // 交通
  if (driving || state === 'title') {
    traffic.base = S.npc; traffic.perfK = perfK; traffic.wet = wetK;
    traffic.update(dt, T, env.hour, player, { speedK: rainK > 0.5 && !LD ? 0.85 : 1 }, planes); // 長距離は車線ごとの速度帯（修正105）を保つ
    traffic.drawDist = S.draw; player.hour = env.hour; player.zoneCap = ['res', 'nt', 'gak'].includes(city.zoneClass(player.x, player.z)) ? 70 / 3.6 : 0;
    if (traffic.events && traffic.events.length) { for (const ev of traffic.events.splice(0)) if (ev.t === 'horn' && Math.hypot(ev.x - player.x, ev.z - player.z) < 60) snd.beep(420, 0.22, 1); }
    peds.update(dt, state === 'title' ? { x: cam.look[0], z: cam.look[2], vx: 0 } : player, env.hour, city.zoneClass(player.x, player.z), perfK, rainK > 0.5, T, planes, traffic, M4);
  }
  // チャンクの読み込み・解放
  streamChunks();
  // 描画
  const lightsOn = lightMode === 1 || (lightMode === 0 && (env.night > 0.35 || (rainK > 0.5 && env.night > 0.15) || tunK > 0.2)); // オートライト：暗いときだけ（昼の雨では点けない）
  const hP = M4.apply(pM, 0, 0.75, car.def.p.L / 2), hD = norm([pM[8], pM[9] - 0.07, pM[10]]); // 車体の上下の傾きに追従
  if (tunK > 0) { const L2 = (a, b) => a + (b - a) * tunK; env.sunC = env.sunC.map(x => x * L2(1, 0.1)); env.amb = env.amb.map(x => x * L2(1, 0.45)); env.fog = env.fog.map(x => x * L2(1, 0.35)); }
  env.rainVis = rainK * (1 - tunK);
  if (music) {
    const z = LD ? (zcMtn() ? -2000 : 0) : player.z, zc = city.zoneClass(player.x, player.z), rural = zc === 'farm';
    // 修正97-7：雨は「降り具合（徐々に変わる）」ではなく現在の天気で判定し、時刻・天候の変更に即座に追随させる
    const tr = music.update({ night: env.night > 0.6, rain: weather === 'rain', mountain: z < -1050, rural }, (driving || state === 'title') && !LD); // 長距離ドライブ中は専用BGM（ldMusic）に任せる
    if (tr !== tick.track) { tick.track = tr; if (tr && driving) toast('♪ ' + tr.name, 2200); }
  }
  const zc = city.zoneClass(cam.p[0], cam.p[2]), hr = env.hour;
  // 窓の点灯率：住宅は夕方〜夜に多く深夜は少なく、事務所は勤務時間に多い（しきい値が低いほど多く点く）
  const litRes = hr >= 17 && hr < 23 ? 0.4 : hr >= 23 || hr < 1 ? 0.6 : hr < 5 ? 0.92 : hr < 8 ? 0.55 : 0.8;
  const litOff = hr >= 8 && hr < 19 ? 0.25 : hr < 22 && hr >= 19 ? 0.7 : 0.93;
  const urban = { center: 1, res: 0.7, sub: 0.45, farm: 0.1, mtn: 0 }[zc] * (1 - tunK);
  R.mips();
  R.frame({ vp, fog: env.fog, sun: env.sun, sunC: env.sunC, amb: env.amb, cam: cam.p, fogN: env.fogN, fogF: env.fogF, night: env.night, wet: env.wet * (1 - tunK), hOn: lightsOn ? 1 : 0, hP, hD, lit: [litRes, litOff], urban, time: T });
  drawWorld(env, planes, pM, lightsOn);
  // サウンド・HUD
  if (driving) {
    let npcNear = 0; for (const c of traffic.cars) { const d2 = (c.x - player.x) ** 2 + (c.z - player.z) ** 2; npcNear += c.v / 14 / (1 + d2 / 60); }
    let npcV = 0, wv = 0; for (const c of traffic.cars) { const d2 = (c.x - player.x) ** 2 + (c.z - player.z) ** 2; if (d2 < 900) { const w = 1 / (1 + d2 / 60); npcV += Math.abs(c.v) * w; wv += w; } }
    const h = env.hour, day = h > 5.5 && h < 18.5, zc2 = city.zoneClass(player.x, player.z), A = S.amb ? 1 : 0;
    const amb = { bird: A * (day && zc2 !== 'center' ? (zc2 === 'farm' || zc2 === 'mtn' ? 1 : 0.4) : 0) * (rainK > 0.5 ? 0 : 1), insect: A * (!day && zc2 !== 'center' && rainK < 0.5 ? 1 : 0), river: A * Math.max(0, 1 - Math.abs(player.z - 565) / 90), crowd: A * (zc2 === 'center' && h > 7 && h < 21 ? 1 : 0) * (1 - tunK) };
    snd.update({ rpm: player.rpm, thr: player.input.thr, kmh: gSpd * 3.6, brake: player.input.brk, slip: player.slip, rain: rainK > 0.4 && tunK < 0.5, horn, npcNear, npcV: wv ? npcV / wv : 0, cityK: zc2 === 'center' ? 1 : 0.3, cockpit: camMode > 0, amb, engine: player.engineOn ? 1 : 0 });
    if (player.restarted) { player.restarted = false; snd.starter(); }
    if (player.bump > 0.08) { snd.bump(player.bump); player.bump = 0; }
    // R：車内のバックブザー「ピー、ピー」
    if (player.gear === 'R') { rBeepT -= dt; if (rBeepT <= 0) { snd.beep(2050, 0.32, 1); rBeepT = 0.75; } } else rBeepT = 0;
    // 修正95：列車の走行音（一番近い列車との距離）と、駅の近くでの到着案内
    if (!LD) { const tr = trains(T); let dmin = 1e9, vk = 0; for (const t of tr) { const cx = Math.max(t.x, Math.min(player.x, t.x + 82)), d = Math.hypot(cx - player.x, t.z - player.z, 10); if (d < dmin) { dmin = d; vk = t.stopped ? 0.15 : 1; } }
      snd.train(Math.max(0, 1 - dmin / 260), vk);
      if (Math.hypot(player.x - 100, player.z + 445) < 380) for (const t of tr) { const dn = t.dir > 0 ? '東行き' : '西行き';
        if (!t.stopped && t.next < 20 && t.next > 0 && trainNote[t.dir] !== Math.round(T + t.next)) { trainNote[t.dir] = Math.round(T + t.next); snd.stationBell(); toast(`🚃 まもなく水瀬駅に${dn}の電車が到着します`, 3200); }
        } }
    // 修正107：停車中の案内はトーストではなく専用のバナーにして、列車の実際の状態に連動させる（停車している間だけ表示し、発車したら消す）。
    // 万一状態がずれても、表示し始めてから12秒（停車10秒＋余裕）で必ず消す
    trainBanner(!LD && Math.hypot(player.x - 100, player.z + 445) < 380 ? trains(T).filter(t => t.stopped) : [], dt);
    // 夕方5時のチャイム（防災無線）
    if (S.amb && !LD && gameMin >= 1020 && gameMin < 1022 && chimeDone !== Math.floor(gameMin / 1440)) { chimeDone = Math.floor(gameMin / 1440); snd.chime(); toast('♪ 夕方5時のチャイム', 2500); }
    if (gameMin < 1000) chimeDone = -1;
    const b = (T % 0.8) < 0.4; if (wink && b !== tick.b) snd.tick(); tick.b = b;
    hud(env, lightsOn, b);
    if (T - lastSave > 15) doSave();
  } else if (snd.ok) snd.update({ rpm: 800, thr: 0, kmh: 0, brake: 0, slip: 0, rain: false, horn: false, npcNear: 0, cityK: 0, cockpit: false, engine: 0, amb: null });
  // 性能自動調整
  if (bench) benchTick(dt);
  perfT += dt; perfN++;
  if (perfT > 2) {
    const fps = perfN / perfT; tick.fps = fps;
    if (S.auto && driving) {
      if (fps < 28) { perfK = Math.max(0.5, perfK - 0.15); resK = Math.max(0.65, resK - 0.08); }
      else if (fps > 52) { perfK = Math.min(1, perfK + 0.1); resK = Math.min(1, resK + 0.05); }
    }
    perfT = 0; perfN = 0;
  }
}
// 衝突被害軽減ブレーキ：前方の車との衝突までの時間（TTC）が短いと自動でブレーキ
function aebCheck() {
  const p = player, v = p.vx; if (Math.abs(v) < 1.5) return 0;
  const sg = Math.sign(v), f = [Math.sin(p.yaw) * sg, Math.cos(p.yaw) * sg], r = [f[1], -f[0]];
  let ttc = 99;
  for (const c of traffic.cars) {
    const dx = c.x - p.x, dz = c.z - p.z; if (dx * dx + dz * dz > 2500 || Math.abs((c.y || 0) - p.y) > 2.5) continue;
    const al = dx * f[0] + dz * f[1], lat = Math.abs(dx * r[0] + dz * r[1]); if (al < 0 || lat > (c.m.W + 1.48) / 2 + 0.2) continue;
    const cv = (c.v || 0) * (Math.sin(c.yaw) * f[0] + Math.cos(c.yaw) * f[1]), close = Math.abs(v) - cv;
    const gap = al - c.m.L / 2 - 1.8; if (close > 0.5) ttc = Math.min(ttc, Math.max(0, gap) / close);
  }
  const on = ttc < 1.1 ? 1 : ttc < 1.6 ? 0.45 : 0;
  if (on && !aebCheck.on) snd.beep(2000, 0.06, 3);
  aebCheck.on = on > 0.5; return on;
}
// チャンクの読み込み：近い順＋進行方向を優先し、1フレームあたりの処理時間に上限を設けて少しずつ組み立てる
function streamChunks() {
  const tp = state === 'title' ? cam.look : [player.x, 0, player.z];
  const sp = state === 'title' ? 0 : Math.min(40, Math.abs(player.vx || 0));
  const ax = tp[0] + Math.sin(player.yaw) * sp * 4, az = tp[2] + Math.cos(player.yaw) * sp * 4; // 約4秒先
  const loadR = S.draw + 280 + sp * 4, freeR = S.draw + 560 + sp * 4;
  const t0 = performance.now(), budget = MOBILE ? 6 : 8;
  let want = null, wd = 1e9;
  for (const c of city.chunks) {
    const d = Math.hypot(c.x - tp[0], c.z - tp[2]);
    if (c.m) { if (d > freeR) city.freeChunk(c, R); continue; }
    if (c.pend && d > freeR) { c.pend = null; continue; }
    if (d < loadR) { const pr = Math.hypot(c.x - ax, c.z - az) * 0.6 + d * 0.4 - (c.pend ? 200 : 0); if (pr < wd) { wd = pr; want = c; } }
  }
  // 時間の許す限り続けて組み立てる（最低でも1回は進める）
  for (let n = 0; want && n < 4; n++) {
    const ts = performance.now(), done = city.buildChunkStep(want, R, t0 + budget);
    if (DEV) (streamChunks.prof = streamChunks.prof || []).push([Math.round(want.x), Math.round(want.z), +(performance.now() - ts).toFixed(1), done ? 1 : 0]);
    if (!done || performance.now() - t0 > budget) break;
    want = null; wd = 1e9;
    for (const c of city.chunks) { if (c.m) continue; const d = Math.hypot(c.x - tp[0], c.z - tp[2]); if (d < loadR) { const pr = Math.hypot(c.x - ax, c.z - az) * 0.6 + d * 0.4; if (pr < wd) { wd = pr; want = c; } } }
  }
}
function trainBanner(stopped, dt) {
  const el = $('trainBan'), st = trainBanner.st || (trainBanner.st = { key: '', t: 0 });
  const key = stopped.map(t => t.dir + ':' + Math.round(T - (10 - t.left))).join(',');
  if (!stopped.length) { st.key = ''; st.t = 0; el.classList.remove('on'); return; }
  if (key !== st.key) { st.key = key; st.t = 0; el.textContent = stopped.map(t => `🚃 ${t.dir > 0 ? '東行き' : '西行き'}の電車が水瀬駅に停車中（発車まで約${Math.ceil(t.left)}秒）`).join('　'); }
  else el.textContent = stopped.map(t => `🚃 ${t.dir > 0 ? '東行き' : '西行き'}の電車が水瀬駅に停車中（発車まで約${Math.ceil(t.left)}秒）`).join('　');
  st.t += dt; el.classList.toggle('on', st.t < 12);
}
// 列車（上下線に各2編成＝計4編成）：等速で走り、水瀬駅（ホーム中央 x=100）で10秒停車。列車の中心がホーム中央に来る位置で止まる
function trains(T) {
  const out = [];
  // 上下線とも2編成ずつ（約3分間隔で水瀬駅に到着）。next は次に駅に着くまでの秒数
  for (const [dir, zc, ph0] of [[1, -446.65, 0], [-1, -443.35, 90]]) for (let k = 0; k < 2; k++) {
    const v = 14, D = 4800 + 82, Ds = dir > 0 ? 2541 : 2341, t1 = Ds / v, cyc = D / v + 10, ph = ph0 + k * cyc / 2, tt = ((T + ph) % cyc + cyc) % cyc;
    const st = tt >= t1 && tt < t1 + 10, d = tt < t1 ? tt * v : st ? Ds : Ds + (tt - t1 - 10) * v;
    const x = dir > 0 ? -2482 + d : 2482 - d;
    out.push({ x, z: zc, yaw: dir > 0 ? 0 : Math.PI, dir, center: x + dir * 41, stopped: st, left: st ? t1 + 10 - tt : 0, next: st ? 0 : tt < t1 ? t1 - tt : cyc - tt + t1 });
  }
  return out;
}
function trainInfo(T) { // デバッグ表示用：上下線それぞれ次の到着までの秒数
  const tr = trains(T), f = d => { const a = tr.filter(t => t.dir === d); return a.some(t => t.stopped) ? '停車中' : `あと${Math.min(...a.map(t => t.next)).toFixed(0)}秒`; };
  return `列車 東行き ${f(1)}／西行き ${f(-1)}`;
}
function drawWorld(env, planes, pM, lightsOn) {
  const r = R, gl = r.gl;
  // 空
  gl.depthMask(false); r.draw(meshes.sky, new Float32Array([4000, 0, 0, 0, 0, 4000, 0, 0, 0, 0, 4000, 0, cam.p[0], cam.p[1], cam.p[2], 1]), env.zen); gl.depthMask(true);
  const camT = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, cam.p[0], 0, cam.p[2], 1]);
  if (env.night > 0.3 && cloudK < 0.8) { r.blend('add'); r.alpha((env.night - 0.3) / 0.7 * (1 - cloudK)); gl.depthMask(false); r.draw(meshes.stars, new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, cam.p[0], cam.p[1], cam.p[2], 1])); gl.depthMask(true); r.blend(null); r.alpha(1); }
  { const ox = (T * 6) % 9000; r.blend('alpha'); r.alpha(Math.min(1, 0.5 + cloudK * 0.5) * (1 - tunK)); gl.depthMask(false); for (const sx of [ox, ox - 9000]) r.draw(meshes.clouds, new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, sx, 0, 0, 1])); gl.depthMask(true); r.blend(null); r.alpha(1); void camT; }
  r.draw(meshes.mtn); r.draw(meshes.global);
  r.decal(1); r.draw(meshes.gdecal); r.decal(0);
  const vis = [];
  for (const c of city.chunks) {
    const d = Math.hypot(c.x - cam.p[0], c.z - cam.p[2]); c.dd = d;
    // 修正81：チャンクの判定球は地形の実際の高さ（山間部は最大300m級）に合わせる。y=10固定だと見下ろし・見上げで山のチャンクを落として透けていた
    if (c.yc == null) { let lo = 1e9, hi = -1e9; for (let a = -125; a <= 125; a += 31.25) for (let b = -125; b <= 125; b += 31.25) { const y = city.terrainY(c.x + a, c.z + b); lo = Math.min(lo, y); hi = Math.max(hi, y); } c.yc = (lo + hi) / 2 + 15; c.yr = Math.hypot(177, (hi - lo) / 2 + 40); }
    const inV = M4.sphereIn(planes, c.x, c.yc, c.z, c.yr);
    if (c.m && d < S.draw + 180 && inV) vis.push(c);
    else if (inV) { // 読み込み前・範囲外のチャンクは低ポリの地形とシルエットで埋める（霧で見えない距離は描かない）
      if (c.farT && d < S.draw + 400) r.draw(c.farT);
      if (c.far && d < 2600) r.draw(c.far);
    }
  }
  const detD = S.det * (0.6 + 0.4 * perfK); // 重いときは細部（小物・駐車車両）の表示距離も縮める
  const hrNow = env.hour, ncOn = [0, 1, 2].map(b => city.shopCarsOn(b, hrNow)); // 店舗の駐車車両（閉店後は段階的に帰る）
  for (const c of vis) { r.draw(c.m.s); if (c.dd < detD) { r.draw(c.m.det); for (let b = 0; b < 3; b++) if (ncOn[b]) r.draw(c.m['nc' + b]); } }
  r.decal(1); for (const c of vis) r.draw(c.m.d1);
  r.decal(3); for (const c of vis) r.draw(c.m.d2); if (env.wet > 0.3) for (const c of vis) r.draw(c.m.pud); r.decal(0); // 水たまりは雨のときだけ
  // 落ち影（建物）と車の接地影
  const shA = 0.3 * (1 - env.night * 0.75) * (1 - cloudK * 0.6) * (1 - tunK);
  if (shA > 0.02 && !S.noSh) {
    r.blend('alpha'); r.alpha(shA); gl.depthMask(false); r.decal(2);
    for (const c of vis) r.draw(c.m.sh);
    const bm = new Float32Array(16);
    for (const c of traffic.cars) { const dx = c.x - cam.p[0], dz = c.z - cam.p[2]; if (dx * dx + dz * dz > 60 * 60) continue; const s = M4.trs(c.x, c.y || 0, c.z, c.yaw, 0, 0, bm); s[0] *= c.m.W * 1.05; s[1] *= c.m.W * 1.05; s[2] *= c.m.W * 1.05; s[8] *= c.m.L * 1.02; s[9] *= c.m.L * 1.02; s[10] *= c.m.L * 1.02; r.draw(meshes.blob, s); }
    { const s = M4.trs(player.x, player.y, player.z, player.yaw, player.slopeV || 0, 0, bm); for (const k of [0, 1, 2]) { s[k] *= 1.5; s[8 + k] *= 3.45; } r.draw(meshes.blob, s); }
    r.decal(0); gl.depthMask(true); r.blend(null); r.alpha(1);
  }
  for (const c of vis) if (c.dd < detD) r.draw(c.m.lines);
  // 信号灯
  const T0 = T;
  for (const h of city.sigHeads || []) {
    const dx = h.x - cam.p[0], dz = h.z - cam.p[2]; if (dx * dx + dz * dz > 260 * 260) continue;
    if (!M4.sphereIn(planes, h.x, h.y, h.z, 1)) continue;
    const s = city.sig(h.node, h.axis, T0);
    r.draw(meshes.lamps, M4.trs(h.x, h.y, h.z, h.yaw), null, null, s === 'g' ? [1, 0, 0] : s === 'y' ? [0, 1, 0] : [0, 0, 1]);
  }
  // 歩行者用信号：交差する車道の信号と同じ位相（黄・全赤では赤、青の最後は点滅）
  for (const h of city.pedHeads || []) {
    const dx = h.x - cam.p[0], dz = h.z - cam.p[2]; if (dx * dx + dz * dz > 100 * 100 || !M4.sphereIn(planes, h.x, 2.6, h.z, 1)) continue;
    const s = city.sig(h.node, h.axis, T0), s4 = city.sig(h.node, h.axis, T0 + 4), green = s === 'g' && (s4 === 'g' || (T0 % 0.6) < 0.3);
    r.draw(meshes.ped, M4.trs(h.x, 2.6, h.z, h.yaw), null, null, green ? [1, 0, 0] : [0, 0, 1]);
  }
  r.gl.uniform3fv(r.u.uSig, [0, 0, 0]);
  // 歩行者
  for (const q of peds.list) { if (!pedMesh[q.type]) continue; const dx = q.x - cam.p[0], dz = q.z - cam.p[2]; if (dx * dx + dz * dz > (perfK < 0.8 ? 50 : 80) ** 2 || !M4.sphereIn(planes, q.x, 1, q.z, 1.2)) continue; r.draw(pedMesh[q.type][q.moving ? ((q.t * 1.3) | 0) % 2 : 2], M4.trs(q.rx ?? q.x, q.onRoad ? 0.01 : 0.13, q.rz ?? q.z, q.yaw)); }
  // 工業団地のフォークリフトと作業員
  for (const fk of city.forklifts || []) { const dx = fk.x - cam.p[0], dz = fk.z - cam.p[2]; if (dx * dx + dz * dz > 120 * 120) continue; const k = Math.sin(T * 0.35 + fk.ph), x = fk.x + fk.ax * k * fk.amp, z = fk.z + fk.az * k * fk.amp, yaw = fk.yaw + (Math.cos(T * 0.35 + fk.ph) < 0 ? Math.PI : 0); r.draw(meshes.fork, M4.trs(x, 0, z, yaw)); }
  for (const w of city.workers || []) { const dx = w.x - cam.p[0], dz = w.z - cam.p[2]; if (dx * dx + dz * dz > 90 * 90) continue; r.draw(pedMesh[w.type][2], M4.trs(w.x, 0, w.z, w.yaw)); }
  // 電車（高架）
  // 列車（上下線に各2編成＝計4編成）。水瀬駅（ホーム中央 x=100）で10秒停車
  // 修正95：駅の近く（駅から600m以内）では描画距離に関係なく上下線とも描く
  const nearSta = Math.hypot(cam.p[0] - 100, cam.p[2] + 445) < 600;
  if (!LD) for (const t of trains(T)) if (nearSta || Math.abs(t.x - cam.p[0]) < S.draw + 200) r.draw(meshes.train, M4.trs(t.x, 0, t.z, t.yaw, 0, 0));
  // NPC車両
  const lightsNpc = env.night > 0.35 || rainK > 0.5 ? 1 : 0;
  const mtx = new Float32Array(16);
  let near300 = 0, drawn300 = 0;
  for (const c of traffic.cars) {
    const dx = c.x - cam.p[0], dz = c.z - cam.p[2], d2 = dx * dx + dz * dz;
    // 自車の周囲300m以内は視錐台で間引かず必ず描く（山道の高低差やカメラのピッチで見えている車を落とさない）。
    // それより遠い車は、車の実際の高さ（c.y）と実寸（全長・全高）を含む球で判定する
    const pdx = c.x - player.x, pdz = c.z - player.z, nearP = pdx * pdx + pdz * pdz < 300 * 300;
    if (nearP) near300++;
    if (!nearP && (d2 > (S.draw + 50) ** 2 || !M4.sphereIn(planes, c.x, (c.y || 0) + c.m.H / 2, c.z, Math.hypot(c.m.L, c.m.H, c.m.W) / 2 + 1))) continue;
    if (nearP) drawn300++;
    M4.trs(c.x, c.y || 0, c.z, c.yaw, (c.brake && c.v > 1 ? 0.012 : 0) - Math.atan(c.slope || 0), 0, mtx);
    const lN = lightsNpc || (c.z < -1600 && city.inTunnelXZ(c.x, c.z)) ? 1 : 0; // トンネル内は昼でも点灯
    const pl = c.plate ? plateUV(c.plate.cls, c.plate.i) : null;
    if (c.m.semi && c.tr) { // セミトレーラー：トラクタとトレーラーを連結角を付けて描く
      const near = dx * dx + dz * dz < 3600, pt = -Math.atan(c.slope || 0), cl = traffic.carL(c, lN);
      r.draw((near ? npcMesh : npcLod)[c.m.id], M4.trs(c.tr.x, c.y || 0, c.tr.z, c.tr.yaw, pt, 0, mtx), c.tint, [cl[0], 0, cl[2], cl[3]], null, pl ? [pl[0], pl[1], pl[2], 0] : null, 0);
      r.draw(near ? meshes.trailer : meshes.trailerLod, M4.trs(c.trl.x, c.y || 0, c.trl.z, c.trl.yaw, pt, 0, mtx), c.tint, cl, null, null, c.revOn ? 1 : 0);
      continue;
    }
    r.draw((dx * dx + dz * dz < 3600 || c.m.id === 0 ? npcMesh : npcLod)[c.m.id], mtx, c.tint, traffic.carL(c, lN), null, pl ? [pl[0], pl[1], pl[2], 0] : null, c.revOn ? 1 : 0);
    if (c.taxi) r.draw(meshes.andon, M4.trs(c.x, (c.y || 0) + c.m.H, c.z, c.yaw, 0, 0, mtx));
  }
  npcDraw.near300 = near300; npcDraw.drawn300 = drawn300;
  // プレイヤー車両
  const blink = (T % 0.8) < 0.4, pl = player, def = car.def, tint = MIRA_COLORS[color].rgb;
  const carL = [lightsOn ? 1 : 0, pl.braking ? 1 : 0, wink < 0 && blink ? 1 : 0, wink > 0 && blink ? 1 : 0];
  // 運転席・ボンネット視点でもボンネットやピラーが見えるよう車体は常に描く
  r.draw(car.body, pM, tint, carL, null, null, pl.gear === 'R' ? 1 : 0);
  const base = M4.trs(pl.x, pl.y, pl.z, pl.yaw, pl.slopeV || 0, 0);
  for (const [wx, wz, front] of def.wheelPos) {
    const lm = M4.trs(wx, def.p.r, wz, front ? pl.steer : 0, pl.wheelRot, 0);
    r.draw(wx < 0 ? car.wheelR : car.wheel, M4.mul(base, lm));
  }
  r.draw(car.interior, pM);
  if (camMode !== 1 || state !== 'drive') r.draw(car.driver, pM); // 運転席視点では自分の体は描かない
  if (LD && car.pass) r.draw(car.pass, pM); // 同乗者（設定した服装・座席。子どもはジュニアシート）
  const sp = def.steerPos;
  { const sm = M4.mul(pM, M4.trs(sp[0], sp[1], sp[2], 0, 0.42, -pl.steer * 4)); r.draw(car.steer, sm); r.draw(car.hands, sm); } // 手はハンドルと一緒に回る
  const th = 0.75 * Math.PI + Math.min(140, pl.kmh) / 140 * 1.5 * Math.PI;
  const mp = def.meterPos;
  r.draw(car.needle, M4.mul(pM, M4.trs(mp[0], mp[1], mp[2], 0, 0, th - 1.5 * Math.PI)));
  // 半透明
  if (pl.ecoNow && pl.gear === 'D' && state === 'drive') { r.blend('alpha'); r.alpha(0.35); r.draw(car.meterGlow, pM); } // エコ運転中はメーター照明がグリーン
  r.blend('alpha'); r.alpha(camMode === 1 && state === 'drive' ? 0.12 : 0.42); r.draw(car.glass, pM, null, null); // 追走視点でも運転者が見えるよう透過を強めに
  if (env.rainVis > 0.05) { r.alpha(0.35 * env.rainVis); r.draw(meshes.rain, M4.trs(cam.p[0], cam.p[1] - 8 - ((T * 22) % 24) + 12, cam.p[2], 0)); }
  // 工場の煙突の煙
  r.blend('alpha'); gl.depthMask(false);
  for (const [x, y, z] of city.smokes || []) { if ((x - cam.p[0]) ** 2 + (z - cam.p[2]) ** 2 > (S.draw + 100) ** 2) continue; for (let k = 0; k < 6; k++) { const ph = ((T * 0.12 + k / 6) % 1), s = 2 + ph * 9; r.alpha(0.5 * (1 - ph)); const mm = M4.trs(x + ph * 22, y + 1 + ph * 30, z + ph * 6, Math.atan2(cam.p[0] - x, cam.p[2] - z)); for (const q of [0, 1, 2, 4, 5, 6, 8, 9, 10]) mm[q] *= s; r.draw(meshes.puff, mm); } }
  gl.depthMask(true);
  if (env.night > 0.05) { r.blend('add'); r.alpha(env.night * 0.5); for (const c of vis) r.draw(c.m.glow); }
  r.alpha(1); r.blend(null);
  if (LD) LD.extraDraw(r, cam, T, M4, meshes);
}

function renderSelect(dt, aspect) {
  selYaw += dt * 0.5;
  const pM = M4.trs(0, 0, 0, selYaw, 0, 0);
  const view = M4.lookAt([4.4, 1.8, 4.4], [0, aspect < 1 ? -0.9 : -0.2, 0], [0, 1, 0]), proj = M4.persp(aspect < 1 ? 1.0 : 0.7, aspect, 0.1, 200);
  const vp = M4.mul(proj, view);
  R.frame({ vp, fog: [0.08, 0.085, 0.1], sun: norm([0.4, 0.8, 0.5]), sunC: [1, 0.97, 0.92], amb: [0.42, 0.44, 0.5], cam: [4.4, 1.8, 4.4], fogN: 30, fogF: 120, night: 0, wet: 0, hOn: 0, hP: [0, 0, 0], hD: [0, 0, 1] });
  R.draw(meshes.studio);
  const def = car.def, tint = MIRA_COLORS[color].rgb;
  R.draw(car.body, pM, tint, [0.6, 0, 0, 0]);
  for (const [wx, wz] of def.wheelPos) R.draw(wx < 0 ? car.wheelR : car.wheel, M4.mul(pM, M4.trs(wx, def.p.r, wz, 0, 0, 0)));
  R.draw(car.interior, pM); R.draw(car.driver, pM);
  { const sp = def.steerPos; R.draw(car.hands, M4.mul(pM, M4.trs(sp[0], sp[1], sp[2], 0, 0.42, 0))); }
  R.draw(car.stand, M4.trs(1.9, 0, -0.6, 0.55)); // 車の横に立つ運転者（全身プレビュー）
  R.blend('alpha'); R.alpha(0.4); R.draw(car.glass, pM); R.alpha(1); R.blend(null);
}

function hud(env, lightsOn, blink) {
  $('sV').textContent = Math.round(gSpd * 3.6 < 0.6 ? 0 : gSpd * 3.6);
  $('rpmI').style.width = Math.min(100, player.rpm / 6800 * 100).toFixed(1) + '%';
  $('iAeb').classList.toggle('on', player.aeb > 0.5);
  $('gear').textContent = player.gear;
  $('spd').classList.toggle('eco', !!player.ecoNow && player.gear === 'D'); $('spd').classList.toggle('rev', player.gear === 'R');
  $('iEco').classList.toggle('on', !!player.ecoNow && player.gear === 'D'); $('iIS').classList.toggle('on', !player.engineOn);
  $('iKeep').classList.toggle('on', player.cruiseV != null); if (player.cruiseV != null) $('iKeep').textContent = `キープ中 ${Math.round(player.cruiseV * 3.6)}km/h`;
  $('iLim').classList.toggle('on', !!S.lim); $('iLim').textContent = S.lim ? (player.limitV ? `LIM ${Math.round(player.limitV * 3.6)}` : 'LIM ―') : 'LIM';
  $('iAc').classList.toggle('on', !!S.ac); $('bA').classList.toggle('keep', player.cruiseV != null);
  $('iWL').classList.toggle('on', wink < 0 && blink); $('iWR').classList.toggle('on', wink > 0 && blink);
  $('iLight').classList.toggle('on', lightsOn);
  const h = Math.floor(gameMin / 60), m = Math.floor(gameMin % 60);
  const w = { clear: '晴れ', cloudy: '曇り', rain: '雨' }[weather];
  const dn = city.district(player.x, player.z);
  if (dn !== distName) { distName = dn; $('iDist').textContent = dn; }
  $('iTime').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}　${w}`;
  drawMinimap();
  if (S.dbg) {
    const loaded = city.chunks.filter(c => c.m).length;
    $('dbg').textContent = `FPS ${(tick.fps || 0).toFixed(0)}  draw ${R.stats.draws}  tri ${(R.stats.tris / 1000).toFixed(0)}k\nNPC 走行${traffic.moving}/${traffic.target}（地区目標${traffic.zoneTarget}・${traffic.zone}）駐車${traffic.stats.parkedNow}\n周辺300m 交通車両${npcDraw.near300}台／描画${npcDraw.drawn300}台\n${trainInfo(T)}\nchunk ${loaded}/${city.chunks.length}  perf×${perfK.toFixed(2)}\npos ${player.x.toFixed(0)}, ${player.y.toFixed(1)}, ${player.z.toFixed(0)}`;
  } else $('dbg').textContent = '';
}

// ================= v0.7.0 長距離ドライブモード =================
const zcMtn = () => !!LD && (LD.season === 'autumn' || LD.season === 'winter');
let ldPv = null;
function driverText() { return `${AGES[driver.age]}・${SEXES[driver.sex]}・${OUTFITS[driver.outfit]}`; }
function openLDSet(preset) {
  state = 'ldset'; show('ldset'); setHud(false);
  if (!ldSetup) ldSetup = new LDSetup({ $, driverText, driver: () => ({ ...driver }), carText: () => `ミライース（${MIRA_COLORS[color].name}）`,
    onChange: cfg => buildLDPreview(cfg), onStart: cfg => startLD(cfg, null), onBack: () => { state = 'title'; show('title'); } });
  ldSetup.open(preset); buildLDPreview(ldSetup.cfgOut());
}
// 設定画面の3Dプレビュー：車のまわりに立つ一行（季節の服装）と、車内の座席
function buildLDPreview(cfg) {
  if (ldPv) { for (const m of ldPv.stand) R.free(m); if (ldPv.pass) R.free(ldPv.pass); }
  const all = [driverChar(cfg.driver, cfg.season), ...cfg.passengers.map(p => p.ch)];
  ldPv = { stand: all.map(ch => { const g = new GB(); buildChar(g, ch, cfg.season, 'stand', {}); return R.mesh(g.build()); }), pass: null, season: cfg.season };
  const g = new GB(); buildPassengersInCar(g, cfg.passengers, cfg.season); if (g.count) ldPv.pass = R.mesh(g.build());
}
function renderLDSet(dt, aspect) {
  selYaw += dt * 0.35;
  const pM = M4.trs(0, 0, 0, selYaw, 0, 0), eye = [5.2, 2.0, 5.0], port = aspect < 1;
  const view = M4.lookAt(eye, [0.6, 0.5, 0], [0, 1, 0]), proj = M4.persp(port ? 1.05 : 0.72, aspect, 0.1, 200);
  if (port) proj[9] = -0.38; else proj[8] = 0.36; // 設定パネルに隠れない位置に寄せる
  const vp = M4.mul(proj, view), sea = ldPv ? ldPv.season : 'spring';
  const fog = { spring: [0.2, 0.16, 0.18], summer: [0.1, 0.16, 0.22], autumn: [0.2, 0.13, 0.08], winter: [0.17, 0.19, 0.24] }[sea];
  R.frame({ vp, fog, sun: norm([0.4, 0.8, 0.5]), sunC: [1, 0.97, 0.92], amb: [0.45, 0.46, 0.52], cam: eye, fogN: 30, fogF: 120, night: 0, wet: 0, hOn: 0, hP: [0, 0, 0], hD: [0, 0, 1] });
  R.draw(meshes.studio);
  const def = car.def, tint = MIRA_COLORS[color].rgb;
  R.draw(car.body, pM, tint, [0.6, 0, 0, 0]);
  for (const [wx, wz] of def.wheelPos) R.draw(wx < 0 ? car.wheelR : car.wheel, M4.mul(pM, M4.trs(wx, def.p.r, wz, 0, 0, 0)));
  R.draw(car.interior, pM);
  if (ldPv && ldPv.pass) R.draw(ldPv.pass, pM);
  if (ldPv) ldPv.stand.forEach((m, i) => R.draw(m, M4.trs(1.6 + i * 0.75, 0, 1.4 + i * 0.35, 0.75)));
  R.blend('alpha'); R.alpha(0.3); R.draw(car.glass, pM); R.alpha(1); R.blend(null);
}
async function startLD(cfg, sv) {
  state = 'load'; show('load'); setHud(false); if (cut) { cut.finish(); cut = null; }
  $('lmsg').textContent = `${SEASON_NAMES[cfg.season]}の長距離ドライブ（400km）を準備中…`; $('lbar').style.width = '10%'; await frame(); await frame();
  // 市街地の読み込み済みチャンク・遠景を解放してメモリを空ける（市街地のセーブはそのまま）
  for (const c of city.chunks) { if (c.m) city.freeChunk(c, R); c.pend = null; if (c.far) { R.free(c.far); c.far = null; } if (c.farT) { R.free(c.farT); c.farT = null; } }
  for (const k of ['global', 'gdecal', 'mtn']) if (meshes[k]) R.free(meshes[k]);
  const ctx = { R, $, snd, toast, getMin: () => gameMin, setMin: m => { gameMin = m; }, get player() { return player; }, onMovie: startMovie, onClear: showClear };
  LD = new LongDrive(ctx, cfg, sv);
  LD.ev.opts.talk = LDP.talk; LD.ev.opts.radio = LDP.radio; LD.ev.opts.nav = LDP.nav;
  ldMusic.setSeason(cfg.season); ldMusic.setOn(LDP.bgm); ldMusic.setVol(LDP.vol); ldMusic.onTrack = onLDTrack;
  city = LD.city; traffic = LD.traffic; peds = LD.peds; traffic.peds = peds; nav = LD.nav;
  $('lbar').style.width = '35%'; $('lmsg').textContent = '道路と景色を組み立て中…'; await frame();
  for (const d of city.dyn) R.setLayer(d.lay, renderLayer(d.draw)); R.mips();
  meshes.global = R.mesh(city.global.build()); meshes.gdecal = R.mesh(city.globalDecal.build()); meshes.mtn = R.mesh(city.mountains.build());
  for (const [ch, gb] of LD.world.farT) if (gb.count) ch.farT = R.mesh(gb.build());
  if (LD.world.farL) for (const [ch, gb] of LD.world.farL) if (gb.count) ch.far = R.mesh(gb.build()); // 修正104：休憩施設・目的地の遠景用の簡易モデル（チャンクが未読み込み・描画範囲外のとき 2.6km まで描く）
  MM = LD.mm.canvas; MMX0 = LD.mm.x0; MMZ0 = LD.mm.z0; MMS = LD.mm.s; mmLabels = LD.mm.labels;
  weather = LD.D.weather || 'clear'; gameMin = sv && typeof sv.min === 'number' ? sv.min : START_MIN;
  player.city = city;
  const pose = sv && sv.pos && sv.st.phase === 'drive' ? sv.pos : sv && sv.st.maxS ? LD.poseAtS(Math.max(20, sv.st.maxS)) : LD.startPose();
  player.reset(pose.x, pose.z, pose.yaw, (pose.y || 0) + 1); player.cruiseV = null; lastPos = null; gSpd = 0; cam.mode = -1;
  { const g = new GB(); buildPassengersInCar(g, cfg.passengers, cfg.season); if (car.pass) R.free(car.pass); car.pass = g.count ? R.mesh(g.build()) : null; }
  document.body.classList.add('ld'); $('pWarp').closest('.row').hidden = true; $('pRespawn').textContent = '道路に戻る（動けないとき）';
  const near = city.chunks.map(c => [c, Math.hypot(c.x - player.x, c.z - player.z)]).sort((a, b) => a[1] - b[1]);
  let k = 0; for (const [c, d] of near) { if (d < S.draw + 300) { city.buildChunk(c, R); if (++k % 3 === 0) { $('lbar').style.width = (40 + Math.min(55, k * 3)) + '%'; await frame(); } } }
  state = 'drive'; show(null); setHud(true); markToggles(); ldMusic.setScene('drive');
  if (sv && sv.st.phase === 'rest' && sv.st.restFac) { const f = LD.world.fac.find(q => q.id === sv.st.restFac); if (f) LD.finishRest(f); } // 休憩ムービー中に中断していた場合は休憩を済ませて出口から
  else if (sv && sv.st.phase === 'ending') LD.startEnding();
  else if (!sv) { toast('09:00　水瀬東ICを出発しました', 3600); LD.saveNow(); }
  else toast(`${hhmm(gameMin)}　長距離ドライブを再開しました`, 2400);
}
// 修正102：曲名の表示（HUD の曲名チップ＋切り替え時に短い案内）と、次の曲へ
function onLDTrack(song, scene) { ldSongUI(); if (scene === 'drive') { if (LD) LD.ev.trackChanged(song.title); if (state === 'drive' && LDP.bgm) toast('♪ ' + song.title, 2000); } }
function ldSongUI() { const el = $('ldSong'), c = ldMusic && ldMusic.current(); el.textContent = !LDP.bgm ? '♪ BGM OFF' : c ? `♪ ${c.title}` : '♪ ―'; el.classList.toggle('off', !LDP.bgm); }
function ldNext() { if (!LD || state !== 'drive') return; if (!LDP.bgm) { toast('BGMはOFFです（BGMボタン／Mキーで ON）', 1400); return; } ldMusic.next(); const el = $('ldSong'); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
// 修正109・112：同乗者のセリフ・ラジオ案内の字幕（画面下。運転の邪魔にならない大きさ）
let subT = 0;
function showSub(q) { const el = $('ldSub'); el.className = 'on ' + q.kind; el.innerHTML = ''; const w = document.createElement('b'); w.textContent = q.kind === 'radio' ? 'ラジオ' : q.kind === 'nav' ? 'ナビの観光案内' : q.who; const t = document.createElement('span'); t.textContent = q.kind === 'radio' ? q.text.replace(/^📻 ?/, '📻 ') : q.kind === 'nav' ? q.text.replace(/^🧭 ?/, '🧭 ') : '「' + q.text + '」'; el.append(w, t); subT = q.dur; }
function startMovie(kind, info, done) {
  for (const k in keys) keys[k] = false; for (const k in touch) touch[k] = false;
  player.cruiseV = null; player.vx = 0; player.vy = 0; player.input = { thr: 0, brk: 1, steer: 0 };
  state = 'movie'; setHud(false); show(null);
  if (LD && ldMusic) ldMusic.setScene(kind === 'rest' ? 'rest' : 'arrive', { type: info.fac && info.fac.type }); // 修正103：休憩は穏やかな曲、到着は季節の到着テーマ（OFFなら無音）
  cut = new Cutscene({ R, M4, meshes, $ }, kind, info, () => { cut = null; done(); if (state === 'movie') { state = 'drive'; setHud(true); cam.mode = -1; lastPos = null; if (LD && ldMusic) ldMusic.setScene('drive'); } });
}
function showClear(rec) { state = 'ldclear'; setHud(false); renderClear($, rec, getClears()); show('ldclear'); }

function apInput(ap) { // 開発用：車線の中心をたどり、指定速度を保つ。休憩施設に寄るときは減速車線へ
  const w = LD.world, p = w.project(player.x, player.z), f = w.fac.find(q => !LD.st.restedIds.includes(q.id) && ap.rest && ap.rest.includes(q.id) && p.s > q.s - 420 && p.s < q.s + 60);
  let u = ap.u ?? 6.1; if (f) u = p.s > f.s - 260 ? 12.2 : 6.1;
  const la = Math.max(10, gSpd * 0.9), q = w.pos(p.s + la, u), des = Math.atan2(q[0] - player.x, q[2] - player.z);
  let e = des - player.yaw; while (e > Math.PI) e -= 2 * Math.PI; while (e < -Math.PI) e += 2 * Math.PI;
  const v = f && p.s > f.s - 200 ? Math.min(ap.v, 40) : ap.v, kmh = gSpd * 3.6;
  return { thr: kmh < v - 2 ? 1 : kmh < v ? 0.4 : 0, brk: kmh > v + 6 ? 0.6 : 0, steer: clamp(e * (ap.k ?? 3), -1, 1) };
}
boot();
