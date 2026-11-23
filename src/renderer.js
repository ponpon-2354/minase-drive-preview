// 軽量WebGL2レンダラー（PS2風：頂点カラー＋ランバート＋フォグ＋単一スポットライト）
import { STRIDE } from './geo.js?v=0.8.0';
import { TS, LAYER_COUNT, buildLayers } from './textures.js?v=0.8.0';

const VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec3 aC;
layout(location=3) in vec2 aUV; layout(location=4) in vec2 aML;
uniform mat4 uVP, uM;
out vec3 vW, vN, vC; out vec2 vUV; flat out float vMat; flat out float vLay;
void main(){ vec4 w=uM*vec4(aP,1.); vW=w.xyz; vN=mat3(uM)*aN; vC=aC; vUV=aUV; vMat=aML.x; vLay=aML.y; gl_Position=uVP*w; }`;

const FS = `#version 300 es
precision highp float; precision mediump sampler2DArray;
in vec3 vW, vN, vC; in vec2 vUV; flat in float vMat; flat in float vLay;
uniform sampler2DArray uTex;
uniform vec3 uSun, uSunC, uAmb, uFog, uCam, uTint, uHP, uHD, uSig;
uniform float uFogN, uFogF, uNight, uWet, uHOn, uAlpha;
uniform vec4 uCarL, uPlate; uniform vec2 uLit; uniform float uRev, uUrban, uTime;
out vec4 o;
void main(){
  int m=int(vMat+.5); bool land=m>=100; if(land) m-=100; // 修正104：mat+100 は「遠くからも見える目印」（休憩施設・目的地の建物と看板）。霧のかかり方だけを変える
  vec4 t = m==19 && uPlate.z>=0. ? texture(uTex, vec3(vUV*vec2(.5,.25)+uPlate.xy, uPlate.z)) : m==21 ? texture(uTex, vec3(vUV+vec2(0.,uTime*.03), vLay)) : texture(uTex, vec3(vUV, vLay));
  if(m==17 && t.a<.5) discard;
  if(m==22 && uWet<.3) discard;
  if(m==24){ o=vec4(vC*t.rgb,uAlpha); return; }
  if(m==26){ o=vec4(0.,0.,0.,uAlpha*vC.r); return; } // 修正97-3：柔らかい接地影（頂点色の赤＝濃さ）
  if(m==25){ o=vec4(vC*t.rgb*clamp(uAmb*1.3+uSunC*.75,0.,1.2),t.a*uAlpha); return; }
  vec3 base=vC*t.rgb; if(m==1) base*=uTint;
  float dist=length(vW-uCam);
  if(m==6){ o=vec4(mix(uFog,uTint,clamp(vC.r,0.,1.)),1.); return; }
  if(m==5){ vec3 c=base; float f=clamp((dist-uFogN)/(uFogF-uFogN),0.,1.); o=vec4(mix(c,uFog,f*.7),uAlpha); return; }
  vec3 n=normalize(vN); if(!gl_FrontFacing) n=-n;
  float d=max(dot(n,uSun),0.);
  vec3 lit=base*(uAmb+uSunC*d+vec3(.16,.14,.11)*uNight*uUrban);
  if(uHOn>0.){
    vec3 L=vW-uHP; float ds=length(L); vec3 Ld=L/max(ds,.001);
    // 修正97-2：ヘッドライトの照射範囲を実車に近い幅（左右約35度）にし、高い所（屋根・樹冠・ハウスの上）は照らさない
    float sp=smoothstep(.80,.93,dot(Ld,uHD))*clamp(1.-ds/90.,0.,1.)*(.5+.5*smoothstep(.9,.97,dot(Ld,uHD)))*clamp(1.-(vW.y-uHP.y-.8)/3.5,0.,1.);
    lit+=base*sp*(max(dot(n,-Ld),0.)*.75+.25)*2.0*uHOn;
  }
  if(m==7||m==22){
    vec3 V=normalize(uCam-vW); vec3 R=reflect(-uSun,n);
    float s=pow(max(dot(R,V),0.),20.)*uWet; float fr=pow(1.-clamp(V.y,0.,1.),5.)*uWet;
    float wk = m==22 ? min(1.,uWet*1.4) : 1.; lit*=1.-uWet*.3*wk; lit=mix(lit,uFog*.85,fr*.6*wk + (m==22 ? .35*uWet : 0.)); lit+=uSunC*s*.5*wk;
  }
  vec3 e=vec3(0.);
  if(m==2) e=vC*uCarL.x*1.3;
  else if(m==3){ float a=textureLod(uTex, vec3(vUV, vLay), 0.).a; float on = a<.003 ? 0. : (a<.5 ? step(uLit.x, a*2.) : step(uLit.y, (a-.5)*2.)); vec3 wc = fract(a*37.)<.14 ? vec3(.62,.75,1.) : fract(a*53.)<.3 ? vec3(1.,.93,.8) : vec3(1.,.82,.55); e=wc*on*uNight*.8; }
  else if(m==4) e=vC*(uCarL.x*.5+uCarL.y*1.3);
  else if(m==8) e=vC*uNight*1.6;
  else if(m==10) e=vC*uCarL.z*1.6;
  else if(m==11) e=vC*uCarL.w*1.6;
  else if(m==12){ lit*=.12; e=vC*uSig.x*1.5; }
  else if(m==13){ lit*=.12; e=vC*uSig.y*1.5; }
  else if(m==14){ lit*=.12; e=vC*uSig.z*1.5; }
  else if(m==16) e=t.rgb*vC*uNight*.85;
  else if(m==18) e=vC*1.3;
  else if(m==20) e=vC*uRev*1.4;
  vec3 c=lit+e;
  float f=clamp((dist-uFogN)/(uFogF-uFogN),0.,1.);
  if(m==9) f=.45+uWet*.3;
  if(m==23){ f=.3+.55*clamp((dist-uFogF*.7)/2500.,0.,1.); c+=vec3(1.,.85,.6)*uNight*uUrban*.18*step(.5,fract(vW.y*.33)); }
  if(land) f=min(f,.22+.6*clamp((dist-300.)/3200.,0.,1.)); // 近くでは周りと同じ霧、遠くでは遠景の山並みのように霞んで見える（詳細モデルと遠景モデルで同じ式なので切り替わりが目立たない）
  o=vec4(mix(c,uFog,f),uAlpha);
}`;

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance', alpha: false });
    if (!gl) throw new Error('WebGL 2.0 に対応したブラウザが必要です');
    this.gl = gl;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    this.p = p; gl.useProgram(p);
    this.u = {};
    for (const n of ['uVP', 'uM', 'uTex', 'uSun', 'uSunC', 'uAmb', 'uFog', 'uCam', 'uTint', 'uHP', 'uHD', 'uSig', 'uFogN', 'uFogF', 'uNight', 'uWet', 'uHOn', 'uAlpha', 'uCarL', 'uPlate', 'uLit', 'uRev', 'uUrban', 'uTime']) this.u[n] = gl.getUniformLocation(p, n);
    // テクスチャ配列
    const tex = this.tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, TS, TS, LAYER_COUNT, 0, gl.RGBA, gl.UNSIGNED_BYTE, buildLayers());
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    const an = gl.getExtension('EXT_texture_filter_anisotropic');
    if (an) gl.texParameterf(gl.TEXTURE_2D_ARRAY, an.TEXTURE_MAX_ANISOTROPY_EXT, 4);
    gl.uniform1i(this.u.uTex, 0);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    this.ident = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    this.stats = { draws: 0, tris: 0, meshes: 0 };
    this.white = [1, 1, 1]; this.noCar = [0, 0, 0, 0]; this.noPlate = [0, 0, -1, 0];
  }
  mesh(data, mode) {
    const gl = this.gl;
    if (!data.length) return null;
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const B = STRIDE * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, B, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, B, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, B, 24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 2, gl.FLOAT, false, B, 36);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 2, gl.FLOAT, false, B, 44);
    gl.bindVertexArray(null);
    this.stats.meshes++;
    return { vao, buf, count: data.length / STRIDE, mode: mode ?? gl.TRIANGLES };
  }
  free(m) { if (!m) return; this.gl.deleteBuffer(m.buf); this.gl.deleteVertexArray(m.vao); this.stats.meshes--; }
  resize(scale) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * scale;
    const w = Math.max(1, Math.round(this.cv.clientWidth * dpr)), h = Math.max(1, Math.round(this.cv.clientHeight * dpr));
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
    this.gl.viewport(0, 0, w, h);
  }
  frame(F) { // F: 環境ユニフォーム
    const gl = this.gl, u = this.u;
    gl.clearColor(F.fog[0], F.fog[1], F.fog[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(u.uVP, false, F.vp);
    gl.uniform3fv(u.uSun, F.sun); gl.uniform3fv(u.uSunC, F.sunC); gl.uniform3fv(u.uAmb, F.amb); gl.uniform3fv(u.uFog, F.fog);
    gl.uniform3fv(u.uCam, F.cam); gl.uniform1f(u.uFogN, F.fogN); gl.uniform1f(u.uFogF, F.fogF);
    gl.uniform1f(u.uNight, F.night); gl.uniform1f(u.uWet, F.wet);
    gl.uniform1f(u.uHOn, F.hOn); gl.uniform3fv(u.uHP, F.hP); gl.uniform3fv(u.uHD, F.hD);
    gl.uniform1f(u.uAlpha, 1); gl.uniform3fv(u.uSig, [0, 0, 0]);
    gl.uniform2fv(u.uLit, F.lit || [0.5, 0.5]); gl.uniform1f(u.uUrban, F.urban || 0); gl.uniform1f(u.uTime, F.time || 0); gl.uniform1f(u.uRev, 0); gl.uniform4fv(u.uPlate, [0, 0, -1, 0]);
    this.stats.draws = 0; this.stats.tris = 0;
  }
  setLayer(i, data) { const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex); gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, TS, TS, 1, gl.RGBA, gl.UNSIGNED_BYTE, data); this.dirty = true; }
  mips() { if (this.dirty) { const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex); gl.generateMipmap(gl.TEXTURE_2D_ARRAY); this.dirty = false; } }
  draw(m, model, tint, carL, sig, plate, rev) {
    if (!m) return;
    const gl = this.gl, u = this.u;
    gl.uniformMatrix4fv(u.uM, false, model || this.ident);
    gl.uniform3fv(u.uTint, tint || this.white);
    gl.uniform4fv(u.uCarL, carL || this.noCar);
    if (sig) gl.uniform3fv(u.uSig, sig);
    if (plate || this._pl) { gl.uniform4fv(u.uPlate, plate || this.noPlate); this._pl = !!plate; }
    if (rev !== undefined || this._rv) { gl.uniform1f(u.uRev, rev || 0); this._rv = !!rev; }
    gl.bindVertexArray(m.vao); gl.drawArrays(m.mode, 0, m.count);
    this.stats.draws++; this.stats.tris += m.count / 3;
  }
  alpha(a) { this.gl.uniform1f(this.u.uAlpha, a); }
  blend(mode) {
    const gl = this.gl;
    if (!mode) { gl.disable(gl.BLEND); gl.depthMask(true); return; }
    gl.enable(gl.BLEND); gl.depthMask(false);
    // 画面のα値は変えない（キャンバスが透けて黒く見えるのを防ぐ）
    if (mode === 'add') gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ZERO, gl.ONE); else gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
  }
  decal(lv) { const gl = this.gl; if (lv) { gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-lv, -2 * lv); } else gl.disable(gl.POLYGON_OFFSET_FILL); }
}
