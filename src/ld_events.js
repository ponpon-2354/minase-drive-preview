// v0.8.0 長距離ドライブの演出と評価
//   修正109：同乗者の会話・リアクション（景色・イベントへの反応、年齢・性別でセリフが変わる、小さなお願いイベント）
//   修正110：エコ運転スコア（走行中は表示しない。クリア画面に点数・内訳・同乗者の一言）
//   修正111：天気の変化（にわか雨→雨上がりの虹、夏の入道雲、冬の晴れ間）と、到着時刻による昼／夕方／夜の判定
//   修正112：ラジオ風の観光・道路案内（見どころ・施設の手前。曲の切り替わり直後か一定間隔で表示）
// 状態は LongDrive.st.ev に plain なJSONで持つ（セーブ・再開をまたいで続く。古いセーブには無いので既定値で補う）。
// 天気の変化はセーブしない（再開時は季節の標準天候から。すでに通り過ぎた区間の変化は起こさない）。
// このモジュールは DOM・WebGL に触れない（字幕の表示は main.js が poll() の結果を出す）。
import { ROUTE_LEN, DIST_SCALE } from './ld_world.js?v=0.7.0';

const KM = DIST_SCALE / 1000; // 実距離1m → 表示km
const kmToS = km => km / KM;   // 表示km → 実距離m
const TALK_GAP = 100, TALK_GAP_HI = 40, RADIO_GAP = 45, SUB_GAP = 4; // 秒（現実時間）
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function seeded(s) { s = (s % 2147483646) + 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

// ---- 年齢層：子ども（約9歳）／10代／大人（20〜50代）／60代以上。大人は性別で語尾を変える ----
export function ageGroup(ch) { if (!ch) return 'adultF'; if (ch.age === 'child') return 'child'; if (ch.age === '10') return 'teen'; if (ch.age === '60') return 'senior'; return ch.sex ? 'adultF' : 'adultM'; }
const G = (child, teen, adultF, adultM, senior) => ({ child, teen, adultF, adultM: adultM || adultF, senior });

// ---- 同乗者のセリフ（{fac} 施設名、{dest} 目的地、{item} お願いの品） ----
const LINES = {
  sakura: G(['わー！ピンクの木がいっぱい！', 'さくら、さくら！花びらが飛んでる！'], ['桜めっちゃ咲いてる、写真撮りたい', 'うわ、桜並木すご'], ['桜並木、満開だね。きれい…', 'ちょうど見ごろに来られてよかったね'], ['見事な桜並木だな', 'いい時期に来たなあ、満開だ'], ['ほう、見事に咲いとるねえ', '桜を見ると春が来たと思うねえ']),
  sakuraT: G(['トンネルみたい！桜のトンネルだ！', 'うえもよこもぜんぶ桜！'], ['桜のトンネルじゃん、エモい', 'ここ動画撮っとこ'], ['桜のトンネル…ため息が出ちゃう', 'ゆっくり走ってくれてありがとう、よく見える'], ['桜のトンネルか、これは見事だ', 'この区間は景色を楽しもう'], ['長生きはするもんだねえ、こんな桜は初めてだよ']),
  bridge: G(['すごい！おっきい橋！', '下に川が見える！たかーい！'], ['橋長っ', '景色ひらけた、いい感じ'], ['わあ、見晴らしがいいね', '風が強いかも、気をつけてね'], ['大きな橋だな、眺めがいい', '橋の上は横風に注意だな'], ['立派な橋だねえ', 'いい眺めだ、川がきらきらしとる']),
  tunnel: G(['トンネルだ！まっくらになるよ！', 'トンネルの中で声出すとひびくかな？'], ['トンネル入ると耳ちょっと変になる', 'トンネル長そう'], ['トンネルだね。ライト大丈夫？', '出口が明るくてまぶしいかもね'], ['トンネルか。車間距離をとっていこう', '長いトンネルだな'], ['トンネルはいつもどきどきするねえ']),
  castle: G(['あっ！お城だ！ほんもののお城！', 'お城みえた！てっぺん金色？'], ['城見えてきた！テンション上がる', 'ガチの城じゃん'], ['見て、お城が見えてきたよ', 'もうすぐ桜ヶ丘城だね、楽しみ'], ['お、城が見えてきたぞ', 'あれが桜ヶ丘城か、立派だな'], ['お城が見えてきたねえ。懐かしいよ']),
  sea: G(['うみだー！！', '海キラキラしてる！およぎたい！'], ['海きた！夏って感じ', '海めっちゃ青い'], ['海が見えた！やっぱり夏は海だね', '窓を少し開けたら潮の香りがしそう'], ['海だ。いい天気でよかった', '海沿いは気持ちいいな'], ['海を見ると若いころを思い出すよ']),
  harbor: G(['船がいっぱい！あれ漁師さんの船？', 'かもめいる！'], ['港町っぽい、海鮮食べたい', 'あの船かっこいい'], ['港町だね。お魚おいしそう', 'のんびりした港だね'], ['漁港か、朝はにぎやかなんだろうな'], ['港の匂いがするねえ']),
  plateau: G(['すずしい！山の上だ！', '空ちかい！'], ['高原きた、空気うまそう', '景色ひろっ'], ['高原は涼しいね。空が近い', '登り坂、おつかれさま'], ['高原だ。だいぶ登ってきたな'], ['高原の風は気持ちがいいねえ']),
  maple: G(['葉っぱがまっかっか！', '黄色いのと赤いのがある！'], ['紅葉ガチ勢になりそう', '赤すぎて逆にすごい'], ['紅葉がきれい…絵みたい', '山が赤や黄色に染まってるね'], ['見事な紅葉だな', '今年は色づきがいいな'], ['紅葉はいいねえ、心が落ち着くよ']),
  gorge: G(['下に川がある！滝ある？', 'がけ、こわいけどすごい！'], ['渓谷やば、絶景', 'あとで滝見に行きたい'], ['渓谷だね。水がすごく澄んでる', 'カーブが多いから、ゆっくりでいいよ'], ['深い渓谷だな', 'このあたりはカーブが続くな'], ['渓流の音が聞こえるようだねえ']),
  village: G(['かきの木だ！オレンジのいっぱい！', 'わらがほしてある！'], ['田舎の景色いいな', '柿めっちゃなってる'], ['山あいの集落、のどかだね', '稲架けが並んでる。秋だね'], ['いい集落だな、のんびりしてる'], ['昔はうちもこうして稲を干したもんだよ']),
  snow: G(['ゆきだ！まっしろ！', 'ゆきだるまつくりたい！'], ['雪やば、一面まっしろ', '雪景色ってテンション上がる'], ['一面の雪景色…きれい', '路面、気をつけてね'], ['見渡すかぎり雪だな', '除雪してくれてるから走りやすいな'], ['雪の白さが目にしみるねえ']),
  lake: G(['みずうみこおってる！', 'あの上あるけるのかな？'], ['湖凍ってる、すげえ', 'スケートできそう'], ['湖が凍ってる…静かだね', '氷の湖って幻想的'], ['湖が凍ってるな、冷えるわけだ'], ['凍った湖は久しぶりに見たよ']),
  snowwall: G(['雪のかべ！おっきい！', 'かべのなかを走ってるみたい！'], ['雪の壁えぐい高さ', '雪の回廊じゃん'], ['雪の壁がこんなに高い…', '除雪してくれる人に感謝だね'], ['雪の壁か、すごい積雪だな'], ['これだけ雪が積もるとは、たいしたもんだ']),
  onsen: G(['ゆげがでてる！おんせんだ！', 'たまごのにおいする？'], ['湯けむり見えた、温泉街だ', '温泉はよ'], ['湯けむりが見えてきたね', 'もうすぐ温泉だね、楽しみ'], ['湯けむりだ。温泉街に着いたな'], ['ああ、温泉が待っとるねえ']),
  rainbow: G(['にじ！にじが出てる！', 'みて！にじ！なないろ！'], ['虹出てる！レア！', '虹きれい、写真撮っとこ'], ['見て、虹！雨上がりだね', '虹が出てる…いいことありそう'], ['お、虹だ。運がいいな'], ['虹とは縁起がいいねえ']),
  rain: G(['あめふってきた！', 'ワイパーうごいてる！'], ['雨きた、通り雨かな', '雨か〜'], ['雨が降ってきたね。ゆっくりでいいよ', '通り雨かな、すぐ止むといいね'], ['にわか雨だな。スピード控えめでいこう'], ['雨だねえ。気をつけてな']),
  cumulus: G(['くもがもくもく！アイスクリームみたい！'], ['入道雲でっか、夏だわ'], ['入道雲がすごいね、夏らしい'], ['大きな入道雲だな'], ['入道雲が立っとるねえ、夕立が来るかもしれん']),
  sunbeam: G(['おひさまでてきた！雪がキラキラ！'], ['晴れてきた、雪まぶしい'], ['晴れ間が出てきたね。雪がきらきら', 'まぶしいからサングラスあるといいね'], ['晴れてきたな、雪がまぶしい'], ['お日様が出るとありがたいねえ']),
  facNear: G(['もうすぐ{fac}？トイレいきたいかも', '{fac}ってなにがあるの？'], ['{fac}寄る？', 'そろそろ{fac}だって'], ['もうすぐ{fac}だね。休憩していく？', '{fac}で少し休もうか'], ['{fac}が近いな。寄っていくか？'], ['{fac}でひと休みしようかねえ']),
  destNear: G(['もうすぐ{dest}？やったー！', 'ついたらなにする？'], ['あと少しじゃん', '{dest}もうすぐ'], ['もうすぐ{dest}だね。運転ありがとう', 'あと少し、ラストスパートだね'], ['もうすぐ{dest}だ。長旅おつかれさま'], ['もうすぐだねえ。ありがとうね、運転']),
  fatigue: G(['ねえ、つかれてない？だいじょうぶ？'], ['ちょっと休憩したら？'], ['疲れてない？次で休憩しようよ', '無理しないでね。休憩も旅のうちだよ'], ['少し休んだほうがいいんじゃないか'], ['無理はいかんよ、少し休みなさい']),
  // お願いイベント
  ask: G(['ねえねえ、{fac}で{item}たべたい！', 'つぎの{fac}で{item}かってもいい？'], ['{fac}で{item}食べたいんだけど', '次の{fac}で{item}ある？寄りたい'], ['次の{fac}で{item}食べたいな。寄ってくれる？'], ['次の{fac}で{item}でもどうだ？'], ['{fac}で{item}をいただきたいねえ']),
  askDone: G(['{item}おいしかった！ありがとう！', 'やったー！{item}たべられた！'], ['{item}うまかった、ありがと', '{item}最高だった'], ['{item}おいしかったね、寄ってくれてありがとう'], ['{item}、うまかったな。ありがとう'], ['{item}、おいしかったよ。ありがとうね']),
  askMiss: G(['あ…{fac}すぎちゃった。まあいっか！'], ['{fac}通りすぎたけど、まあいいや'], ['{fac}、また今度にしようね'], ['{fac}は次の機会だな'], ['また今度でいいよ'])
};
const ITEMS = { spring: { child: 'さくらソフト', other: 'いちご大福' }, summer: { child: 'かき氷', other: 'ソフトクリーム' }, autumn: { child: '焼きいも', other: '栗おこわ' }, winter: { child: 'ココア', other: '肉まん' } };
// 同乗者のコメント（クリア画面：エコ運転スコアに応じて）
const ECO_COMMENT = {
  hi: G(['すっごくのりごこちよかった！ねむっちゃいそうだった', 'うんてんじょうず！'], ['運転うまくない？快適だった', '全然酔わなかった、さすが'], ['運転、とっても丁寧だったね。快適だったよ', 'ずっと安心して乗っていられたよ'], ['丁寧な運転だったな。疲れなかったよ'], ['上手な運転だったねえ。ゆったりできたよ']),
  mid: G(['たのしかった！またいこうね', 'ちょっとゆれたけど、だいじょうぶだったよ'], ['まあまあ快適だった', '楽しかった、また行こ'], ['楽しいドライブだったね。おつかれさま'], ['いいドライブだった。おつかれ'], ['楽しかったよ、おつかれさま']),
  lo: G(['ちょっとこわかった…', 'ブレーキでからだがまえにいった…'], ['ちょっと運転荒くなかった？', '急ブレーキびびった'], ['もう少しゆっくりでもいいかも。安全第一でね', 'ちょっとドキッとしたよ。次はのんびり行こう'], ['もう少し穏やかに走ってもいいかもな'], ['もう少しゆっくりでええんじゃよ'])
};

// ---- 季節ごとの見どころ（同乗者の反応とラジオ案内のきっかけ）。s は実距離（見どころの始まり） ----
function spotsFor(world) {
  const D = world.D, se = world.season, out = [], fz = (t) => D.zones.find(z => z[2] === t || z[3] === t);
  const add = (id, s, trig, radio, pri = 0) => { if (s > 60 && s < ROUTE_LEN + 20) out.push({ id, s, trig, radio, pri }); };
  for (const [a, b, nm] of D.bridges) add('brg:' + nm, a, 'bridge', `まもなく${nm}です。橋の上は横風にご注意ください`);
  for (const [a, b, nm] of D.tunnels) add('tun:' + nm, a, 'tunnel', `この先、${nm}。全長およそ${Math.round((b - a) * KM)}km、トンネル内はライトの点灯をお願いします`);
  const z = t => { const q = fz(t); return q ? q[0] + 60 : null; };
  if (se === 'spring') { add('sakura', z('sakura'), 'sakura', 'この先は桜並木の道。沿道の桜が見ごろを迎えています'); add('sakuraT', z('sakuraT'), 'sakuraT', 'まもなく桜のトンネルです。花びらで路面が見えにくい所があります。ゆっくりお楽しみください', 1);
    add('castle', ROUTE_LEN - 1500, 'castle', `前方に${D.dest}が見えてきます。城下町では観光の車が増えています`, 2); add('town', z('town'), null, '桜ヶ丘城下町に入ります。城跡公園の桜まつりは今日も開催中です'); add('river', z('river'), null, 'しばらく桜川沿いを走ります。川沿いの桜もきれいですよ'); }
  if (se === 'summer') { add('sea', z('sea') || 1460, 'sea', 'ここから海岸バイパス。右手に青い海が広がります', 1); add('harbor', z('harbor'), 'harbor', '港町・汐見を通過します。漁港の朝市は午前中がおすすめです'); add('plateau', z('plateau'), 'plateau', '青凪高原に入ります。標高が上がり、気温が下がってきます'); add('mount', z('mount'), null, 'この先は山あいの区間。上り坂が続きます'); }
  if (se === 'autumn') { add('maple', 1060, 'maple', '紅葉の丘を走行中。このあたりの紅葉は今が見ごろです'); add('gorge', z('gorge'), 'gorge', 'もみじ渓谷に入ります。カーブが続きますので速度にご注意ください', 1); add('mapleT', z('mapleT'), 'maple', 'まもなく紅葉のトンネル。赤と黄色の木々が道を包みます'); add('village', z('village'), 'village', '山あいの集落・楓見を通過します。稲架けと柿の木が秋の風物詩です'); }
  if (se === 'winter') { add('snow', 820, 'snow', '白銀の雪原を走行中。車線は除雪済みですが、路肩には雪が残っています'); add('lake', z('lake'), 'lake', 'まもなく左手に氷鏡湖。湖面が凍り、冬の名所になっています', 1); add('snowwall', z('snowwall'), 'snowwall', 'この先、雪の山道。両側に高い雪の壁が続きます'); add('onsen', z('onsen'), 'onsen', '雪灯温泉郷に入ります。湯けむりの上がる温泉街です', 1); }
  for (const f of world.fac) { add('fac:' + f.id, f.s - kmToS(10), 'facNear', `次の休憩施設は${f.name}、あと10kmです。${f.type === 'SA' ? 'フードコート・レストランがあります' : f.type === 'PA' ? '売店と展望スペースがあります' : '物産館とレストランがあります'}`); }
  add('destNear', ROUTE_LEN - kmToS(30), 'destNear', `目的地の${D.dest}まで、あと30kmです`, 2);
  return out.filter(o => o.s != null && isFinite(o.s)).sort((a, b) => a.s - b.s);
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

export class LDEvents {
  constructor({ world, season, party, st }) {
    this.world = world; this.season = season; this.party = party || []; this.st = st; this.opts = { talk: true, radio: true };
    const ev = st.ev = st.ev && typeof st.ev === 'object' ? st.ev : {};
    // 既定値で補う（古いセーブ互換）
    for (const [k, v] of Object.entries({ used: [], radio: [], spots: [], req: null, reqN: 0, fatT: -1, eco: null, seed: hash(String(st.startAt || 1) + season) })) if (ev[k] == null) ev[k] = v;
    ev.eco = Object.assign({ t: 0, cruiseT: 0, bandT: 0, acc: 0, brk: 0, idleT: 0, idleW: 0, weave: 0, maxKmh: 0 }, ev.eco || {});
    this.ev = ev; this.R = seeded(ev.seed); this.spots = spotsFor(world);
    this.pass = this.party.filter(p => p.role !== 'driver');
    this.clock = 0; this.lastTalk = -TALK_GAP + 25; this.lastRadio = -RADIO_GAP + 8; this.subUntil = 0; this.queue = []; this.radioQ = [];
    // 天気（セーブしない）：通り過ぎた区間の予定は済みにする
    this.base = world.D.weather || 'clear'; this.wx = { cur: this.base, fx: { rainbow: 0, cumulus: 0, sunbeam: 0 }, ev: null, log: [] };
    const s0 = st.maxS || 0; this.plan = weatherPlan(world, seeded(ev.seed + 7)).filter(p => p.s > s0 + 50);
    this.f = { acc: 0, v: null, accRun: 0, brkRun: 0, flips: [], sgn: 0, weaveCd: 0 };
    this.trackFlag = false;
  }
  // ---- 字幕 ----
  who(p) { return p ? p.name : ''; }
  fill(t, o = {}) { return t.replace('{fac}', o.fac || '').replace('{dest}', this.world.D.dest).replace('{item}', o.item || ''); }
  // きっかけに合うセリフを選ぶ（子どもがいれば、はしゃぐ系のきっかけは子ども優先。使ったセリフは避ける）
  line(trig, o = {}, who = null) {
    const L = LINES[trig]; if (!L || !this.pass.length) return null;
    const kidFirst = ['castle', 'tunnel', 'bridge', 'sea', 'rainbow', 'snowwall', 'harbor', 'sakuraT', 'snow', 'onsen'].includes(trig);
    let cands = who ? [who] : this.pass.slice();
    if (!who) { if (kidFirst && cands.some(p => p.ch.age === 'child')) cands = cands.filter(p => p.ch.age === 'child'); else if (trig === 'fatigue' && cands.some(p => p.ch.age !== 'child')) cands = cands.filter(p => p.ch.age !== 'child'); }
    const p = cands[Math.floor(this.R() * cands.length)], g = ageGroup(p.ch), arr = L[g] || L.adultF;
    const fresh = arr.map((t, i) => [t, `${trig}:${g}:${i}`]).filter(q => !this.ev.used.includes(q[1])), pickA = fresh.length ? fresh : arr.map((t, i) => [t, `${trig}:${g}:${i}`]);
    const [t, id] = pickA[Math.floor(this.R() * pickA.length)]; this.ev.used.push(id); if (this.ev.used.length > 120) this.ev.used.shift();
    return { kind: 'talk', who: this.who(p), text: this.fill(t, o), dur: Math.min(6, 2.6 + t.length * 0.09), trig, p };
  }
  say(trig, o = {}, hi = false, who = null) {
    if (!this.opts.talk || !this.pass.length) return false;
    if (this.clock - this.lastTalk < (hi ? TALK_GAP_HI : TALK_GAP)) return false;
    if (this.queue.some(q => q.kind === 'talk')) return false;
    const l = this.line(trig, o, who); if (!l) return false;
    this.queue.push(l); this.lastTalk = this.clock; return true;
  }
  trackChanged() { this.trackFlag = true; }
  poll() {
    if (this.clock < this.subUntil + SUB_GAP) return null;
    // ラジオ：曲の切り替わり直後か、前回から一定時間たったとき（見どころの直前は待たずに）
    let q = null;
    const ri = this.radioQ.findIndex(r => this.trackFlag || this.clock - this.lastRadio >= RADIO_GAP || r.urgent);
    if (this.queue.length && (ri < 0 || this.queue[0].hi)) q = this.queue.shift();
    else if (ri >= 0) { q = this.radioQ.splice(ri, 1)[0]; this.lastRadio = this.clock; this.trackFlag = false; }
    else if (this.queue.length) q = this.queue.shift();
    if (!q) return null;
    this.subUntil = this.clock + q.dur; (this.log || (this.log = [])).push({ t: +this.clock.toFixed(1), s: Math.round(this.s || 0), kind: q.kind, who: q.who, text: q.text });
    return { kind: q.kind, who: q.who, text: q.text, dur: q.dur };
  }
  // ---- 毎フレーム ----
  update(dt, f) {
    this.clock += dt; this.s = f.s; const ev = this.ev, s = f.s;
    this.weatherStep(dt, s);
    // 見どころ：ラジオは表示15〜25km手前（実470〜780m）で候補に入れ、セリフは見どころに着いたとき
    for (const sp of this.spots) {
      if (sp.radio && !ev.radio.includes(sp.id) && s > sp.s - kmToS(25) && s < sp.s + 60) { ev.radio.push(sp.id); if (this.opts.radio) this.radioQ.push({ kind: 'radio', who: 'ラジオ', text: '📻 ' + sp.radio, dur: Math.min(7, 3 + sp.radio.length * 0.07), id: sp.id, sAt: sp.s }); }
      if (sp.trig && !ev.spots.includes(sp.id) && s > sp.s - 20 && s < sp.s + 300) { if (sp.trig === 'facNear') { const fc = this.world.fac.find(q => 'fac:' + q.id === sp.id); if (ev.req && ev.req.state === 'asked' && ev.req.fac === fc.id) { ev.spots.push(sp.id); continue; } if (this.say('facNear', { fac: fc.name })) ev.spots.push(sp.id); }
        else if (this.say(sp.trig, {}, sp.pri > 0)) ev.spots.push(sp.id); }
      else if (sp.trig && !ev.spots.includes(sp.id) && s >= sp.s + 300) ev.spots.push(sp.id); // 間に合わなかった反応は捨てる（後から言わない）
    }
    for (const r of this.radioQ) r.urgent = s > r.sAt - 150; // 見どころの直前まで出せなかったら優先
    this.radioQ = this.radioQ.filter(r => s < r.sAt + 120); // 通り過ぎた案内は出さない
    // お願いイベント（1回のドライブで2回まで）
    const req = ev.req;
    if ((!req || req.state !== 'asked') && ev.reqN < 2 && this.pass.length && this.clock > 50) {
      const nf = this.world.fac.find(q => q.s > s + 650 && q.s < s + 2600 && !(this.st.restedIds || []).includes(q.id));
      if (nf && this.R() < dt * 0.05) { const p = this.pass.find(q => q.ch.age === 'child') || this.pass[Math.floor(this.R() * this.pass.length)], it = ITEMS[this.season][p.ch.age === 'child' ? 'child' : 'other'];
        const l = this.line('ask', { fac: nf.name, item: it }, p); if (l && this.opts.talk && !this.queue.length) { l.hi = true; this.queue.push(l); this.lastTalk = this.clock; ev.req = { fac: nf.id, item: it, who: this.pass.indexOf(p), state: 'asked' }; ev.reqN++; }
        else if (!this.opts.talk) ev.reqN = 2; }
    }
    if (req && req.state === 'asked') { const fc = this.world.fac.find(q => q.id === req.fac); if (fc && s > fc.s + 470) { req.state = 'missed'; this.say('askMiss', { fac: fc.name, item: req.item }, true, this.pass[req.who]); } }
    // 疲れた運転者への気遣い（大人の同乗者、休憩ごとに1回）
    if ((this.st.fatigue || 0) >= 70 && ev.fatT !== (this.st.rests || 0)) { if (this.say('fatigue', {}, true)) ev.fatT = this.st.rests || 0; }
    this.eco(dt, f);
  }
  restStart(fac) { const r = this.ev.req; if (r && r.state === 'asked' && r.fac === fac.id) { r.state = 'done'; this.pendDone = { item: r.item, fac: fac.name, who: this.pass[r.who] }; } }
  restEnd() { if (this.pendDone) { const d = this.pendDone; this.pendDone = null; const l = this.line('askDone', { item: d.item, fac: d.fac }, d.who); if (l && this.opts.talk) { l.hi = true; this.queue.unshift(l); this.lastTalk = this.clock; this.subUntil = Math.min(this.subUntil, this.clock - SUB_GAP); } } }
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
    if (this.pass.length) { const p = this.pass.find(q => q.ch.age === 'child') || this.pass[0], g = ageGroup(p.ch), L = ECO_COMMENT[score >= 85 ? 'hi' : score >= 60 ? 'mid' : 'lo'], arr = L[g] || L.adultF; comment = { who: p.name, text: arr[hash(String(score) + p.name) % arr.length] }; }
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
        if (t > 50 && !e.said) { e.said = 1; } if (t > 10 && !e.rs) { e.rs = 1; this.say('rain', {}, true); } if (t > 60 && !e.rb) { e.rb = 1; if (this.opts.radio) this.radioQ.unshift({ kind: 'radio', who: 'ラジオ', text: '📻 雨が上がりました。進行方向に虹が見えています', dur: 4.5, sAt: s + 400, urgent: true }); } if (t > 64 && !e.rbs) { e.rbs = 1; this.say('rainbow', {}, true); }
        if (t > 112) W.ev = null; }
      else if (e.type === 'cumulus') { cu = t < 30 ? t / 30 : t < 70 ? 1 : 0; if (t > 25 && !e.s1) { e.s1 = 1; this.say('cumulus', {}, true); } if (t > 90) W.ev = null; }
      else if (e.type === 'sunny') { cur = 'clear'; sb = t < 45 ? 1 : 0; if (t > 8 && !e.s1) { e.s1 = 1; this.say('sunbeam', {}, true); } if (t > 55) W.ev = null; }
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
