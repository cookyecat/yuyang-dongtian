// 觀音岩白衣观音石像（IMG_1262）：崖前一尊披风帽的立像，四根细长红柱撑一顶尖顶龛罩着，旁立红幡杆挂黄幡。
// 石像全部程序化：风帽披巾、长袍衣纹、宽袖垂袋、双手捧净瓶插柳、璎珞、仰覆莲台、六角须弥座、背光。
// 衣纹的凹凸同时写进顶点色当作凹处的暗，着色器再加石面颗粒、雨痕和脚下的苔。
import * as THREE from 'three';
import { Kit, COL } from './props.js';
import { vnoise } from './world.js';

const C = (h) => new THREE.Color(h);
const M = () => new THREE.Matrix4();
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const STONE = C('#e0d5bd'), STONE_D = C('#c9bc9f'), STONE_B = C('#b3a588');
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const gs = (x, s) => Math.exp(-(x * x) / (s * s));
// 按密度函数把 [lo, hi] 分成 n 段：脸所在的地方网格密，后脑勺稀
function warp(n, dens, lo, hi) {
  const N = 2000, c = [0];
  for (let i = 1; i <= N; i++) c.push(c[i - 1] + dens(lo + (hi - lo) * (i - 0.5) / N));
  const out = []; let j = 0;
  for (let i = 0; i <= n; i++) { const t = (i / n) * c[N]; while (j < N && c[j + 1] < t) j++; const f = (t - c[j]) / Math.max(1e-9, c[j + 1] - c[j]); out.push(lo + (hi - lo) * (j + Math.min(1, f)) / N); }
  return out;
}
// 观音面相，照国博藏宋代木雕菩萨。X 横、Y 竖，都以头半径 R 为单位（Y=0 颧骨，发际 0.55，下颏 -0.9）。返回 [起伏, 凹槽深]
// 眉高而长、一道利落的弧连着鼻梁，眉下一大片上眼睑，细长垂目在 0.12，直鼻宽翼，鼻底 -0.3，小口厚唇含笑，下颏圆而饱满
function faceRelief(X, Y) {
  const ax = Math.abs(X);
  let d = 0, g = 0;
  d += 0.02 * gs(X, 0.45) * gs(Y - 0.45, 0.18);                                       // 额头平而饱满
  d += 0.032 * gs(X, 0.03) * gs(Y - 0.47, 0.03);                                      // 白毫
  // 眉：一道利落的弧；眉下到眼之间整片收进去，上眼睑再鼓出来
  const yb = 0.42 - 0.75 * (ax - 0.3) * (ax - 0.3), inB = sm(0.0, 0.06, ax) * sm(0.62, 0.5, ax);
  const t = (ax - 0.3) / 0.19, inEye = Math.max(0, 1 - t * t);
  const ys = 0.15 - 0.04 * inEye + 0.012 * t;
  d += 0.04 * gs(Y - yb, 0.022) * inB;
  d -= 0.04 * gs(ax - 0.3, 0.19) * gs(Y - (yb + ys) / 2, 0.085);
  d += 0.03 * gs(X, 0.07) * gs(Y - 0.3, 0.07);                                        // 鼻根接眉
  d += 0.045 * Math.pow(inEye, 0.6) * sm(ys - 0.005, ys + 0.02, Y) * gs(Y - ys - 0.045, 0.055);
  g += 0.04 * Math.pow(inEye, 0.4) * gs(Y - ys, 0.015);
  d += 0.012 * inEye * gs(Y - ys + 0.045, 0.028);                                     // 下眼睑
  // 鼻：直鼻梁往下渐高渐宽，鼻头圆，鼻翼宽
  const tn = Math.min(1, Math.max(0, (0.3 - Y) / 0.55));
  d += (0.03 + 0.15 * Math.pow(tn, 1.3)) * gs(X, 0.06 + 0.055 * tn) * sm(-0.36, -0.28, Y) * sm(0.38, 0.25, Y);
  d += 0.04 * gs(X, 0.085) * gs(Y + 0.22, 0.055);
  d += 0.04 * (gs(X - 0.125, 0.045) + gs(X + 0.125, 0.045)) * gs(Y + 0.26, 0.045);
  g += 0.018 * gs(ax - 0.17, 0.02) * gs(Y + 0.24, 0.05);                              // 鼻翼沟
  g += 0.03 * gs(ax - 0.06, 0.028) * gs(Y + 0.31, 0.015);                             // 鼻孔
  g += 0.012 * gs(X, 0.025) * sm(-0.31, -0.33, Y) * sm(-0.41, -0.39, Y);              // 人中
  // 口：小而唇厚，唇缝两头上翘，上唇两个唇峰，下唇更厚，嘴角深
  const tm = X / 0.17, inM = Math.max(0, 1 - tm * tm), ym = -0.45 + 0.022 * tm * tm;
  d += 0.05 * Math.pow(inM, 0.6) * gs(Y - ym - 0.032, 0.028) + 0.01 * (gs(X - 0.04, 0.025) + gs(X + 0.04, 0.025)) * gs(Y - ym - 0.048, 0.014);
  d += 0.06 * Math.pow(Math.max(0, 1 - (X / 0.13) * (X / 0.13)), 0.7) * gs(Y - ym + 0.05, 0.036);
  g += 0.03 * Math.pow(inM, 0.5) * gs(Y - ym, 0.011);
  g += 0.025 * gs(ax - 0.17, 0.02) * gs(Y + 0.425, 0.022);                            // 嘴角
  g += 0.02 * gs(X, 0.15) * gs(Y + 0.6, 0.03);                                        // 颏唇沟
  d += 0.06 * gs(X, 0.22) * gs(Y + 0.74, 0.1);                                        // 下颏：圆而饱满
  g += 0.014 * gs(X, 0.32) * gs(Y + 0.87, 0.018);                                     // 颏下一道肉褶
  d += 0.03 * gs(X, 0.35) * gs(Y + 0.93, 0.05);
  d += 0.055 * gs(ax - 0.42, 0.28) * gs(Y + 0.22, 0.32);                              // 丰颊
  return [d, g];
}

// 参数曲面：F(u, v) 返回 [x, y, z, 暗度]；暗度乘进顶点色
function grid(k, nu, nv, F, color, kind = 0) {
  const pos = [], uv = [], dk = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const p = F(i / nu, j / nv); pos.push(p[0], p[1], p[2]); uv.push(i / nu, j / nv); dk.push(p[3] ?? 1); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const n = k.parts.length; k.add(g, color, kind);
  // Kit.add 把颜色铺平了，这里把暗度乘回去（toNonIndexed 之后按索引展开）
  const part = k.parts[n], col = part.attributes.color;
  for (let t = 0; t < idx.length; t++) { const s = dk[idx[t]]; col.setXYZ(t, col.getX(t) * s, col.getY(t) * s, col.getZ(t) * s); }
}
// 沿方向 dir 立起的车削体（袖筒、净瓶）
function latheAlong(k, prof, from, dir, color, seg = 16, kind = 0) {
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
  k.add(g, color, kind, M().compose(from, q, V(1, 1, 1)));
}
// 顺滑插值（Catmull-Rom）：头部放样用，profR 的 smoothstep 在每个节点处斜率为零，会在脸上压出一道道横棱
function spl(prof, y) {
  const n = prof.length;
  if (y <= prof[0][1]) return prof[0][0];
  if (y >= prof[n - 1][1]) return prof[n - 1][0];
  let i = 0; while (i < n - 2 && y > prof[i + 1][1]) i++;
  const p0 = prof[Math.max(0, i - 1)], p1 = prof[i], p2 = prof[i + 1], p3 = prof[Math.min(n - 1, i + 2)];
  const t = (y - p1[1]) / (p2[1] - p1[1]);
  const m1 = (p2[0] - p0[0]) / (p2[1] - p0[1]) * (p2[1] - p1[1]), m2 = (p3[0] - p1[0]) / (p3[1] - p1[1]) * (p2[1] - p1[1]);
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p1[0] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[0] + (t3 - t2) * m2;
}
function profR(prof, y) {
  if (y <= prof[0][1]) return prof[0][0];
  for (let i = 0; i < prof.length - 1; i++) { const [r0, y0] = prof[i], [r1, y1] = prof[i + 1]; if (y >= y0 && y <= y1) { const t = (y - y0) / (y1 - y0); return r0 + (r1 - r0) * (t * t * (3 - 2 * t)); } }
  return prof[prof.length - 1][0];
}

export function statueMaterial({ tint = [1, 1, 1], weather = 0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { tint: { value: new THREE.Vector3(...tint) }, weather: { value: weather } },
    side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      attribute float aKind; varying vec3 vC; varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying float vK; varying vec3 vL;
      void main(){ vC=color; vK=aKind; vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); vL=position; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`
      uniform vec3 tint; uniform float weather; varying vec3 vC; varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying float vK; varying vec3 vL;
      float h12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h12(i),h12(i+vec2(1,0)),f.x), mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec3 n=normalize(vN); if(dot(n, cameraPosition-vW)<0.) n=-n;
        vec3 c=vC*tint;
        // 摩崖大像：大块风化斑、顺着衣褶往下的黑色水痕、灰绿地衣
        if(weather>0.){
          float b1=vn(vW.xz*.12+vW.y*.09), b2=vn(vec2(vW.x*.7+vW.z*.6, vW.y*.5));
          c*=.84+.22*b1+.08*b2;
          float drip=vn(vec2((vW.x-vW.z)*.9, vW.y*.06))*smoothstep(.0,.7,n.y*-1.+.6);
          c*=1.-.22*weather*smoothstep(.55,.85,drip);
          float li=smoothstep(.6,.8,vn(vW.xz*.35-vW.y*.3))*smoothstep(.2,.7,n.y+.3);
          c=mix(c, vec3(.5,.52,.44), li*.35*weather);
        }
        // 石面颗粒与风化：细颗粒、竖向雨痕、凹处和脚下的青苔
        float gr=vn(vW.xz*9.+vW.y*7.)*.5+vn(vec2(vW.x*23.+vW.z*19., vW.y*21.))*.5;
        c*=.94+.1*gr;
        float streak=vn(vec2((vW.x+vW.z)*6., vW.y*.7));
        c*=1.-.1*smoothstep(.55,.85,streak)*smoothstep(3.6,1.5,vL.y);
        float moss=smoothstep(.25,.05,vC.r-.62)*.0 + smoothstep(1.1,.3,vL.y)*smoothstep(.45,.8,vn(vW.xz*3.1+vW.y*2.));
        c=mix(c, vec3(.47,.52,.42), moss*.45);
        // 柔和的受光：不分阴阳两截，凹处靠顶点色压暗
        vec3 Ld=normalize(vec3(-.45,.8,.4));
        float d=dot(n, Ld);
        float l=.7+.4*clamp(d*.6+.4,0.,1.);
        c*=l;
        // 宝冠鎏金：一道暖色高光，掠射处再亮一点，凹处顶点色已经发黑
        if(vK>.5){
          vec3 vd=normalize(cameraPosition-vW), hv=normalize(Ld+vd);
          float sp=pow(max(dot(n,hv),0.),28.), fr=pow(1.-max(dot(n,vd),0.),3.);
          c=c*(.92+.25*fr)+vec3(1.,.82,.5)*(.55*sp)*smoothstep(.15,.45,vC.r);
        }
        gl_FragColor=vec4(c,1.); }`,
    vertexColors: true,
  });
}

// ---------- 石像 ----------
// 原点在须弥座底面中心，面朝 +z；像高（莲台面到风帽尖）约 2.6 米
// sculpted：头换成 Blender 雕的水月观音头像（另行异步载入，见 loadGuanyinHead），这里不再生成程序头、颈，风帽加高罩住高髻、开口上移露出宝冠
export function buildGuanyinStatue({ sculpted = false } = {}) {
  const k = new Kit();
  // 须弥座：六角，上下枭、束腰
  k.add(new THREE.CylinderGeometry(0.84, 0.9, 0.16, 6), STONE_B, 0, M().setPosition(0, 0.08, 0));
  k.add(new THREE.CylinderGeometry(0.76, 0.84, 0.08, 6), STONE_D, 0, M().setPosition(0, 0.2, 0));
  k.add(new THREE.CylinderGeometry(0.64, 0.64, 0.2, 6), STONE_B, 0, M().setPosition(0, 0.34, 0));
  for (let i = 0; i < 6; i++) { // 束腰上的壸门
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6, r = 0.54;
    k.add(new THREE.BoxGeometry(0.42, 0.13, 0.04), STONE_B.clone().multiplyScalar(0.82), 0, M().makeRotationY(a + Math.PI / 2).setPosition(Math.cos(a) * r, 0.34, Math.sin(a) * r));
  }
  k.add(new THREE.CylinderGeometry(0.8, 0.72, 0.1, 6), STONE_D, 0, M().setPosition(0, 0.49, 0));
  // 莲台：覆莲一圈、仰莲两圈
  const petal = (len, wid, cup, base, R, th, tilt, color) => {
    const F = (u, v) => {
      const s = (u - 0.5) * 2, w = wid * Math.pow(Math.sin(Math.PI * Math.min(1, v * 0.92 + 0.08)), 0.65) * (1 - 0.3 * v);
      const x = s * w, y = v * len, z = cup * v * v * len * 0.35 + 0.22 * wid * s * s - 0.018 * (1 - Math.abs(s)) * Math.sin(Math.PI * v);
      return [x, y, z, 0.86 + 0.14 * (1 - s * s) * (0.5 + 0.5 * v)];
    };
    const g = new Kit(); grid(g, 8, 10, F, color);
    const geo = g.geometry(M().makeRotationX(tilt).premultiply(M().makeRotationY(th)).premultiply(M().setPosition(Math.sin(th) * R, base, Math.cos(th) * R)));
    k.parts.push(geo);
  };
  k.add(new THREE.CylinderGeometry(0.5, 0.56, 0.3, 32), STONE_D, 0, M().setPosition(0, 0.68, 0));
  for (let i = 0; i < 16; i++) petal(0.22, 0.13, -0.5, 0.74, 0.55, (i / 16) * Math.PI * 2, Math.PI * 0.8, STONE_D);   // 覆莲：瓣尖朝下
  for (let i = 0; i < 18; i++) petal(0.3, 0.12, 0.8, 0.64, 0.5, ((i + 0.5) / 18) * Math.PI * 2, 0.5, STONE);           // 仰莲外圈
  for (let i = 0; i < 12; i++) petal(0.24, 0.1, 0.8, 0.72, 0.38, (i / 12) * Math.PI * 2, 0.22, STONE);                // 仰莲内圈

  // 褶的截面：圆背尖沟（0..1，沟底为 0），沟线在后处理里会勾出墨线
  const pleat = (x) => Math.sqrt(Math.abs(Math.sin(x)));
  // 身：里面的长裙，前襟露出；胸腹前一组 U 形垂褶，下身竖褶，下摆铺在莲台上起波
  const Y0 = 0.86;
  const body = [[0.37, 0.86], [0.34, 0.96], [0.3, 1.2], [0.28, 1.5], [0.27, 1.8], [0.265, 2.05], [0.28, 2.3], [0.29, 2.5], [0.285, 2.64], [0.25, 2.76], [0.17, 2.85], [0.085, 2.905], [0.062, 2.93], [0.06, 2.98]];
  grid(k, 72, 52, (u, v) => {
    const a = (u - 0.5) * Math.PI * 2, y = Y0 + v * (2.98 - Y0);
    let r = profR(body, y);
    const m1 = sm(2.05, 1.35, y), f1 = pleat(a * 3.5 + 0.6 * Math.sin(a * 2) + 0.3 * y);
    const fm = sm(1.3, 0.45, Math.abs(a)) * sm(1.3, 1.5, y) * sm(2.25, 2.05, y), f2 = pleat(Math.PI * (y + 0.8 * a * a) / 0.17);
    const hem = Math.sin(a * 9 + 0.6) * sm(1.05, 0.86, y);
    const m1x = m1 * (1 - fm);
    r += 0.034 * (f1 - 0.7) * m1x + 0.03 * (f2 - 0.7) * fm + 0.03 * hem;
    const dark = 1 - 0.3 * Math.pow(1 - f1, 2) * m1x - 0.34 * Math.pow(1 - f2, 2) * fm;
    return [r * Math.sin(a), y, r * Math.cos(a) * 0.62, dark];
  }, STONE);
  // 两只脚尖从裙下露出
  for (const s of [-1, 1]) k.add(new THREE.SphereGeometry(0.06, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), STONE, 0, M().makeScale(0.9, 0.6, 1.4).setPosition(s * 0.09, 0.86, 0.24));
  const surf = (x, y, lift = 0.012) => { const r = profR(body, y), sx = Math.min(0.98, x / r); return r * 0.62 * Math.sqrt(1 - sx * sx) + lift; };
  // 交领：右衽压左衽
  for (const [x0, x1, y1] of [[-0.07, 0.007, 2.722], [0.07, -0.11, 2.42]]) {
    const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10, x = x0 + (x1 - x0) * t, y = 2.885 + (y1 - 2.885) * t; pts.push(V(x, y, surf(x, y, 0.006))); }
    k.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.011, 5, false), STONE);
  }

  // 风帽披巾：从帽顶罩下来，溜肩，披到膝下，前面开襟露脸、露胸前；背后比前面长
  const HT = sculpted ? 3.58 : 3.45;
  const mantle = [[0.35, 1.05], [0.34, 1.25], [0.33, 1.5], [0.33, 1.8], [0.34, 2.1], [0.35, 2.35], [0.345, 2.5], [0.31, 2.64], [0.25, 2.75], [0.19, 2.84], [0.165, 2.92], [0.175, 3.02],
    ...(sculpted ? [[0.182, 3.14], [0.18, 3.24], [0.172, 3.33], [0.155, 3.41], [0.122, 3.48], [0.078, 3.535], [0.035, 3.567], [0.01, HT]]   // 高髻宝冠顶到 3.33，风帽顶起成尖
      : [[0.178, 3.14], [0.17, 3.24], [0.15, 3.32], [0.11, 3.39], [0.055, 3.435], [0.015, HT]])];
  const yTop = sculpted ? 3.3 : 3.2, yShut = sculpted ? 3.5 : 3.37;   // 开口从 yTop 往上收拢，到 yShut 合上
  const aOpen = (y) => y > yTop ? 0.85 * sm(yShut, yTop, y) : y > 2.95 ? 0.85 : y > 2.86 ? 0.5 + 0.35 * sm(2.86, 2.95, y) : 0.5 + 0.35 * sm(2.86, 2.2, y) + 0.06 * sm(2.0, 1.2, y);
  const yHem = (a) => 1.05 + 0.27 * sm(2.3, 0.9, Math.abs(a));
  const mSq = (y) => 0.7 + 0.24 * sm(2.85, 3.05, y);
  const MP = (u, v, off = 0) => {
    const a0 = 0.8 + u * (Math.PI * 2 - 1.6), aa = a0 > Math.PI ? a0 - Math.PI * 2 : a0;
    const yb = yHem(aa), y = HT - v * (HT - yb);
    const ao = aOpen(y), a = ao + u * (Math.PI * 2 - 2 * ao);
    let r = profR(mantle, y) + off;
    const back = sm(1.0, 2.6, Math.abs(a > Math.PI ? a - Math.PI * 2 : a));
    const fm = sm(2.7, 1.6, y) * (0.45 + 0.55 * back), fold = pleat(a * 3 + 0.5 * Math.sin(y * 2.4));
    const edge = sm(0.14, 0, Math.min(u, 1 - u) * (Math.PI * 2 - 2 * ao)); // 襟边微微翻起
    r += 0.04 * (fold - 0.7) * fm + 0.012 * edge + 0.02 * sm(1.25, 1.05, y) * Math.sin(a * 7);
    return [r * Math.sin(a), y, r * Math.cos(a) * mSq(y), 1 - 0.3 * Math.pow(1 - fold, 2) * fm - 0.1 * edge];
  };
  grid(k, 80, 60, (u, v) => MP(u, v), STONE);
  // 襟边：沿开口滚一道圆棱
  for (const u of [0, 1]) {
    const pts = []; for (let i = 0; i <= 30; i++) { const p = MP(u, i / 30, 0.004); pts.push(V(p[0], p[1], p[2])); }
    k.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.011, 6, false), STONE);
  }
  // 头：照国博菩萨，不再是球。逐层横截面放样：每一高度给出半宽、前深、后深，前脸是方一些的超椭圆（正面平、两侧转折分明），
  // 后脑是圆的。额宽、颧宽、下颌丰满，到下颏才收圆；头顶交给发髻和宝冠，风帽罩在外面
  const R = 0.125, HY = 1.07, NF = 2.35, H0 = V(0, 3.08, 0.035), P = new THREE.Vector3();
  if (!sculpted) {
    const HW = [[0, -1.0], [0.24, -0.97], [0.39, -0.9], [0.53, -0.8], [0.66, -0.65], [0.74, -0.48], [0.79, -0.3], [0.82, 0], [0.82, 0.3], [0.8, 0.6], [0.68, 0.85], [0.45, 1.0], [0, 1.12]];
    const HF = [[0, -1], [0.55, -0.96], [0.8, -0.88], [0.88, -0.75], [0.92, -0.5], [0.95, -0.2], [0.95, 0.2], [0.93, 0.5], [0.85, 0.8], [0.55, 1.0], [0, 1.12]];
    const HB = [[0, -1], [0.3, -0.95], [0.5, -0.8], [0.72, -0.5], [0.9, -0.1], [0.98, 0.3], [0.95, 0.6], [0.8, 0.85], [0.5, 1.02], [0, 1.12]];
    const headS = (th, y, off, lift = 0) => {
      const sn = Math.sin(th), cs = Math.cos(th), n = cs > 0 ? NF : 2.2, e = 2 / n;
      const x = spl(HW, y) * Math.sign(sn) * Math.pow(Math.abs(sn), e), z = (cs > 0 ? spl(HF, y) : spl(HB, y)) * Math.sign(cs) * Math.pow(Math.abs(cs), e);
      return P.set(x * (1 + off) * R + H0.x, (y + lift) * R * HY + H0.y, z * (1 + off) * R + H0.z);
    };
    const TH = warp(120, (t) => 0.35 + 3 * gs(t, 0.75), -Math.PI, Math.PI), YS = warp(110, (y) => 0.4 + 3 * gs(y + 0.2, 0.55), -1, 1.12);
    const hk = new Kit();
    grid(hk, 120, 110, (u, v) => {
      const th = TH[Math.round(u * 120)], y = YS[110 - Math.round(v * 110)];
      const wf = sm(0.25, 0.65, Math.cos(th)) * sm(-1.0, -0.9, y);
      const X = spl(HW, y) * Math.sign(Math.sin(th)) * Math.pow(Math.abs(Math.sin(th)), 2 / NF);
      const [d, g] = faceRelief(X, y);
      headS(th, y, wf * (d - g));
      return [P.x, P.y, P.z, Math.max(0.5, 1 - wf * (5 * g + 1.2 * Math.max(0, -d)))];
    }, STONE);
    k.parts.push(...hk.parts);
    // 发：正中分缝，成绺往两边、往下梳，压低额头；鬓发盖住太阳穴和耳朵上半，脑后垂下
    const hairline = (at) => 0.58 - 0.08 * sm(0.0, 0.5, at) - 0.4 * sm(0.45, 1.25, at) + 0.05 * sm(1.3, 1.6, at) - 0.6 * sm(1.75, 2.3, at);
    grid(k, 120, 18, (u, v) => {
      const th = (u - 0.5) * Math.PI * 2, at = Math.abs(th), y = 1.12 - v * (1.12 - hairline(at));
      const str = Math.sqrt(Math.abs(Math.sin(at * 9 + (1.12 - y) * 7)));
      const part = 1 - 0.6 * gs(th, 0.05);
      const off = (0.06 + 0.03 * str * part) * (1 - 0.85 * sm(0.55, 1, v));
      headS(th, y, off, off * sm(0.6, 1.1, y));
      return [P.x, P.y, P.z, 0.8 + 0.2 * str * part];
    }, STONE_D);
    // 耳：贴在头侧的浮雕，耳轮一圈凸起、耳甲凹进，耳垂又长又厚，垂到下颌
    const EAR = [[0.08, 0], [0.17, 0.1], [0.2, 0.28], [0.15, 0.48], [0.09, 0.64], [0.12, 0.8], [0.09, 0.93], [0, 1]];
    for (const side of [-1, 1]) grid(k, 16, 30, (u, v) => {
      const sU = (u - 0.5) * 2, hw = profR(EAR, v) * 0.8, y = 0.25 - 0.87 * v;
      const th = side * (Math.PI / 2 + 0.1 + 0.05 * v + sU * hw / 0.8);
      const env = Math.pow(Math.max(0, 1 - sU * sU), 0.35) * Math.pow(Math.sin(Math.PI * Math.min(1, v * 0.98 + 0.02)), 0.3);
      const upper = sm(0.62, 0.45, v), rim = gs(Math.abs(sU) - 0.75, 0.2), bowl = gs(sU + 0.1, 0.4) * gs(v - 0.3, 0.17);
      headS(th, y, 0.004 + env * (0.12 + 0.08 * (1 - v) + upper * (0.07 * rim - 0.08 * bowl) + (1 - upper) * 0.05));
      return [P.x, P.y, P.z, 1 - 0.25 * upper * bowl];
    }, STONE);
    // 冠：发上一道冠带，正中一片莲瓣形冠饰托一颗宝珠，两侧各一朵小花
    grid(k, 60, 4, (u, v) => {
      const th = (u - 0.5) * 2.6, y = 0.76 + 0.1 * v;
      headS(th, y, 0.14 + 0.025 * Math.sin(Math.PI * v), 0.14 * sm(0.6, 1.1, y));
      return [P.x, P.y, P.z, 0.9 + 0.1 * Math.sin(Math.PI * v)];
    }, STONE_D);
    const c0 = headS(0, 0.8, 0.17, 0.1).clone(), up = headS(0, 1.0, 0.17, 0.15).clone().sub(c0).normalize();
    grid(k, 14, 18, (u, v) => {
      const sU = (u - 0.5) * 2, w = 0.042 * Math.pow(Math.sin(Math.PI * Math.min(1, v * 0.9 + 0.1)), 0.7) * (1 - 0.55 * v * v);
      const lift = 0.006 + 0.01 * (1 - sU * sU) + 0.006 * gs(Math.abs(sU) - 0.8, 0.12);
      const p = c0.clone().addScaledVector(up, v * 0.07).add(V(sU * w, 0, lift));
      return [p.x, p.y, p.z, 0.88 + 0.12 * (1 - sU * sU)];
    }, STONE_D);
    k.add(new THREE.SphereGeometry(0.01, 10, 8), STONE, 0, M().makeScale(1, 1.15, 0.8).setPosition(c0.x + up.x * 0.026, c0.y + up.y * 0.026, c0.z + up.z * 0.026 + 0.016));
    for (const s of [-1, 1]) {
      const th = s * 0.68, q = headS(th, 0.8, 0.17, 0.1).clone(), tx = Math.cos(th), tz = -Math.sin(th);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; k.add(new THREE.SphereGeometry(0.007, 6, 5), STONE_D, 0, M().setPosition(q.x + Math.cos(a) * 0.009 * tx, q.y + Math.sin(a) * 0.009, q.z + Math.cos(a) * 0.009 * tz)); }
      k.add(new THREE.SphereGeometry(0.006, 6, 5), STONE, 0, M().setPosition(q.x + Math.sin(th) * 0.004, q.y, q.z + Math.cos(th) * 0.004));
    }
    // 颈：粗而短，三道纹
    grid(k, 24, 16, (u, v) => {
      const a = u * Math.PI * 2 + Math.PI, y = 2.82 + v * 0.15, gr = gs(y - 2.86, 0.005) + gs(y - 2.9, 0.005);
      const r = 0.072 - 0.008 * (y - 2.82) / 0.15 - 0.002 * gr;
      return [Math.sin(a) * r, y, 0.012 + Math.cos(a) * r, 1 - 0.25 * gr];
    }, STONE);
  }
  // 璎珞：胸前一串细珠，下坠一枚宝珠
  for (let i = 0; i <= 28; i++) {
    const t = i / 28, x = (t - 0.5) * 0.28, y = 2.78 - 0.3 * Math.pow(Math.sin(Math.PI * t), 1.2);
    k.add(new THREE.SphereGeometry(0.0105, 6, 5), STONE_D, 0, M().setPosition(x, y, surf(x, y, 0.02)));
  }
  k.add(new THREE.SphereGeometry(0.026, 10, 8), STONE_D, 0, M().makeScale(1, 1.4, 0.7).setPosition(0, 2.44, surf(0, 2.44, 0.03)));
  // 双臂：宽袖自肘挑出，袖底垂成袋，袖口敞开露手；左手掌心朝上托瓶底，右手扶瓶颈
  const vaseAt = V(0, 2.24, 0.37);
  for (const s of [-1, 1]) {
    const elbow = V(s * 0.31, 2.17, 0.0), wrist = s < 0 ? V(-0.075, 2.14, 0.31) : V(0.09, 2.25, 0.31);
    const dir = wrist.clone().sub(elbow), L = dir.length(); dir.normalize();
    const side = new THREE.Vector3().crossVectors(V(0, 1, 0), dir).normalize(), up = new THREE.Vector3().crossVectors(dir, side).normalize();
    const SP = (th, t, off = 0) => {
      const c = Math.cos(th), sn = Math.sin(th), lo = Math.max(0, -sn), r = 0.072 + 0.03 * t + off;
      const drop = 0.06 + 0.46 * Math.pow(t, 0.85), f = 0.008 * Math.sin(th * 6 + s * 2) * t;
      const x = c * (r + f) * (1 + 0.3 * lo), y = sn * (r + f) - drop * lo * lo;
      return elbow.clone().addScaledVector(dir, t * L * 1.04).addScaledVector(side, x).addScaledVector(up, y);
    };
    grid(k, 24, 14, (u, v) => { const p = SP(u * Math.PI * 2, v), fo = 0.5 + 0.5 * Math.sin(u * Math.PI * 12 + s * 2); return [p.x, p.y, p.z, 1 - 0.2 * (1 - fo) * v]; }, STONE);
    const hem = []; for (let i = 0; i <= 24; i++) hem.push(SP((i / 24) * Math.PI * 2, 1, 0.004));
    k.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hem, true), 40, 0.01, 5, true), STONE);
  }
  // 手
  k.add(new THREE.SphereGeometry(0.05, 14, 10), STONE, 0, M().makeRotationY(0.5).multiply(M().makeScale(1.15, 0.42, 1.3)).premultiply(M().setPosition(-0.02, 2.13, 0.355)));           // 左掌托底
  k.add(new THREE.SphereGeometry(0.018, 8, 6), STONE, 0, M().makeScale(1, 1, 1.8).setPosition(0.035, 2.15, 0.39));                                                                         // 左手拇指
  k.add(new THREE.SphereGeometry(0.05, 14, 10), STONE, 0, M().makeRotationZ(0.35).multiply(M().makeScale(0.5, 1.15, 0.95)).premultiply(M().setPosition(0.055, 2.29, 0.36)));            // 右手扶颈
  // 净瓶与杨柳枝
  latheAlong(k, [[0.001, 0], [0.033, 0], [0.048, 0.03], [0.054, 0.07], [0.04, 0.11], [0.015, 0.14], [0.011, 0.2], [0.021, 0.212], [0.001, 0.216]], vaseAt.clone().add(V(0, -0.1, 0)), V(0, 1, 0), STONE_D, 18);
  {
    const pts = [V(0, 2.34, 0.37), V(0.02, 2.46, 0.39), V(0.07, 2.58, 0.37), V(0.12, 2.66, 0.34)];
    k.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.005, 4, false), STONE_D);
    const cv = new THREE.CatmullRomCurve3(pts);
    for (let i = 0; i < 11; i++) { const t = 0.25 + i * 0.07, p = cv.getPoint(Math.min(1, t)), sd = i % 2 ? 1 : -1;
      k.add(new THREE.SphereGeometry(0.028, 6, 4), STONE_D, 0, M().makeRotationZ(sd * 0.9 - 0.3).multiply(M().makeScale(0.2, 1, 0.08)).premultiply(M().setPosition(p.x + sd * 0.016, p.y - 0.02, p.z))); }
  }
  return k.geometry();
}

// ---------- 水月观音头像：Blender 里照国博木雕雕的头（发、高髻、宝冠），减到约 6 万面 ----------
// guanyin_head.txt：二进制的 base64（画卷托管只认文本类型）。二进制为 'GYH1' | 顶点数 | 三角数 | 包围盒 lo、hi | 位置 u16×3 |
// 顶点色 u8×3（石像配色、凹处已压暗）| 种类 u8（1=鎏金）| 索引。雕像坐标是厘米，x 右、y 朝后、z 朝上；
// 换到石像坐标：1 厘米 = 0.0109，下颏落在 y≈2.946，和原来的程序头同一位置
export async function loadGuanyinHead(url) {
  const res = await fetch(url); if (!res.ok) throw new Error('head ' + res.status);
  const b64 = (await res.text()).trim(), bin = atob(b64), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const buf = u8.buffer;
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x31485947) throw new Error('bad head file');
  const nv = dv.getUint32(4, true), nt = dv.getUint32(8, true), lo = [], hi = [];
  for (let i = 0; i < 3; i++) { lo.push(dv.getFloat32(12 + i * 4, true)); hi.push(dv.getFloat32(24 + i * 4, true)); }
  let o = 36;
  const q = new Uint16Array(buf.slice(o, o + nv * 6)); o += nv * 6;
  const col = new Uint8Array(buf, o, nv * 3); o += nv * 3;
  const kind = new Uint8Array(buf, o, nv); o += nv; o += (4 - (o % 4)) % 4;
  const idx = nv < 65536 ? new Uint16Array(buf, o, nt * 3) : new Uint32Array(buf, o, nt * 3);
  const S = 0.0109, G = [0, 3.066, 0.039], pos = new Float32Array(nv * 3), c = new Float32Array(nv * 3), kd = new Float32Array(nv);
  for (let i = 0; i < nv; i++) {
    const x = lo[0] + (hi[0] - lo[0]) * q[i * 3] / 65535, y = lo[1] + (hi[1] - lo[1]) * q[i * 3 + 1] / 65535, z = lo[2] + (hi[2] - lo[2]) * q[i * 3 + 2] / 65535;
    pos[i * 3] = G[0] + S * x; pos[i * 3 + 1] = G[1] + S * z; pos[i * 3 + 2] = G[2] - S * y;
    c[i * 3] = col[i * 3] / 255; c[i * 3 + 1] = col[i * 3 + 1] / 255; c[i * 3 + 2] = col[i * 3 + 2] / 255; kd[i] = kind[i];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.setAttribute('aKind', new THREE.BufferAttribute(kd, 1));
  g.setIndex(new THREE.BufferAttribute(idx.slice(), 1));
  g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}

// ---------- 黄幡：挂在幡杆龙头上，随风飘 ----------
function bannerTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 512; const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 512);
  g.fillStyle = '#dcc07a';
  g.beginPath(); g.moveTo(32, 0); g.lineTo(62, 26); g.lineTo(62, 430); g.lineTo(44, 430); g.lineTo(40, 512); g.lineTo(34, 430); g.lineTo(30, 430); g.lineTo(24, 512); g.lineTo(20, 430); g.lineTo(2, 430); g.lineTo(2, 26); g.closePath(); g.fill();
  g.fillStyle = '#b98f52'; for (const y of [30, 140, 250, 360]) g.fillRect(2, y, 60, 8);
  g.strokeStyle = 'rgba(80,60,40,.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(32, 1); g.lineTo(62, 26); g.lineTo(62, 430); g.lineTo(2, 430); g.lineTo(2, 26); g.closePath(); g.stroke();
  const t = new THREE.CanvasTexture(c); return t;
}
export function buildBanner(len = 4.4, wid = 0.46) {
  const geo = new THREE.PlaneGeometry(wid, len, 1, 30); geo.translate(0, -len / 2, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: bannerTexture() }, time: { value: 0 }, len: { value: len } },
    side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      uniform float time, len; varying vec2 vUv; varying float vS;
      void main(){ vUv=uv; vec3 p=position; float t=-p.y/len;
        float w=sin(time*1.9 - t*5.)*.32 + sin(time*3.1 - t*9. + 1.)*.1;
        p.z += w*t*t*1.1; p.x += sin(time*1.3 - t*4.)*.12*t*t;
        vS=.86+.14*cos(time*1.9 - t*5.);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D map; varying vec2 vUv; varying float vS;
      void main(){ vec4 c=texture2D(map,vUv); if(c.a<.5) discard; gl_FragColor=vec4(c.rgb*vS*(gl_FrontFacing?1.:.82),1.); }`,
  });
  return new THREE.Mesh(geo, mat);
}

// ---------- 红柱尖顶龛：四根细长红柱斜撑一顶四角攒尖，柱脚一直伸到崖下 ----------
// 两根之间的一根圆杆
function rod(k, a, b, r0, r1, color, seg = 8) {
  const d = b.clone().sub(a), L = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize());
  k.add(new THREE.CylinderGeometry(r1, r0, L, seg, 1), color, 0, M().compose(a.clone().lerp(b, 0.5), q, V(1, 1, 1)));
}
// ground(x, z)：龛的局部坐标里的地面高度（原点＝石像座底）
export function buildGuanyinCanopy(ground, { TOP = 4.45, S = 1 } = {}) {
  const k = new Kit();
  const ZHU = COL.zhu, ZHU_D = COL.zhu.clone().multiplyScalar(0.78), ROPE = C('#e6dcc4'), INK = C('#3d3a34');
  const CZ = 0.12 * S, SPL = 0.075;
  const tops = [[-1.14, -0.95], [1.14, -0.95], [1.14, 1.08], [-1.14, 1.08]].map(([x, z]) => [x * S, z * S]);
  // 柱身某高度处的位置：越往下越往外撇
  const at = (i, y) => { const [x, z] = tops[i], f = 1 + SPL * (TOP - y) / 1.1; return V(x * f, y, CZ + (z - CZ) * f); };
  const foot = [];
  for (let i = 0; i < 4; i++) {
    let y = TOP;
    while (y > -14) { const p = at(i, y); if (y <= ground(p.x, p.z)) break; y -= 0.05; }
    foot.push(y);
    rod(k, at(i, y - 0.35), at(i, TOP + 0.1), 0.085, 0.07, ZHU, 10);
    const fp = at(i, y); k.add(new THREE.CylinderGeometry(0.16, 0.2, 0.22, 8), C('#9f927a'), 0, M().setPosition(fp.x, y + 0.05, fp.z)); // 柱脚石
  }
  // 顶上一圈额枋，下面一道由额，四面挂落
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    for (const [y, r, c] of [[TOP - 0.02, 0.075, ZHU], [TOP - 0.42, 0.045, ZHU]]) rod(k, at(i, y), at(j, y), r, r, c, 6);
    for (let n = 1; n < 6; n++) { const t = n / 6, a = at(i, TOP - 0.42).lerp(at(j, TOP - 0.42), t); rod(k, a, a.clone().add(V(0, 0.4, 0)), 0.018, 0.018, ZHU_D, 4); }
    // 绑扎处的白麻绳
    for (const y of [TOP - 0.02, TOP - 0.42]) { const p = at(i, y); k.add(new THREE.CylinderGeometry(0.095, 0.095, 0.07, 8), ROPE, 0, M().setPosition(p.x, y, p.z)); }
  }
  // 两侧和背后的横撑，前面敞开好看像；崖下的长腿再加几道
  const tie = (i, j, y) => { rod(k, at(i, y), at(j, y), 0.04, 0.04, ZHU, 6); for (const q of [i, j]) { const p = at(q, y); k.add(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 8), ROPE, 0, M().setPosition(p.x, y, p.z)); } };
  for (const y of [1.6]) { tie(0, 1, y); tie(1, 2, y); tie(3, 0, y); }
  for (let y = -1.2; y > Math.max(foot[2], foot[3]) + 0.6; y -= 2.4) tie(2, 3, y);
  for (const [i, j] of [[1, 2], [3, 0]]) for (let y = -1.2; y > Math.max(foot[i], foot[j]) + 0.6; y -= 2.4) tie(i, j, y);
  // 四角攒尖顶：檐口起翘，筒瓦，四条角脊，宝顶
  const ry0 = TOP + 0.16, rh = 2.0 * S, curl = 0.42 * S;
  const E = [[-1.9, -1.7], [1.9, -1.7], [1.9, 1.95], [-1.9, 1.95]].map(([x, z]) => [x * S, z * S]);
  const ec = [0, CZ];
  for (let i = 0; i < 4; i++) {
    const E0 = E[i], E1 = E[(i + 1) % 4], len = Math.hypot(E1[0] - E0[0], E1[1] - E0[1]);
    const P = (u, t, off = 0) => {
      const ex = E0[0] + (E1[0] - E0[0]) * u, ez = E0[1] + (E1[1] - E0[1]) * u;
      const cr = Math.pow(Math.abs(2 * u - 1), 5) * (1 - t) * (1 - t);
      const x = ec[0] + (ex - ec[0]) * (1 - t), z = ec[1] + (ez - ec[1]) * (1 - t);
      const wave = Math.pow(Math.abs(Math.sin(Math.PI * (u - 0.5) * len / 0.26)), 0.55);
      return [x, ry0 + rh * Math.pow(t, 1.7) + curl * cr + off + 0.05 * wave * (1 - t) * (off === 0 ? 1 : 0), z];
    };
    const tiles = new Kit();
    grid(tiles, Math.round(len / 0.06), 12, (u, t) => { const p = P(1 - u, t); return [p[0], p[1], p[2], 1]; }, COL.tile, 1);
    // grid 的 uv.x 是 0..1，换成按瓦垄数走
    const g = tiles.parts[0], uv = g.attributes.uv; for (let n = 0; n < uv.count; n++) uv.setX(n, uv.getX(n) * len / 0.26 / 2.6);
    k.parts.push(g);
    grid(k, 16, 8, (u, t) => { const p = P(u, t, -0.07); return [p[0], p[1], p[2], 1]; }, C('#6e5a44'));                    // 望板（底面）
    const ridge = []; for (const t of [0, 0.2, 0.45, 0.7, 0.95]) { const p = P(0, t); ridge.push(V(p[0], p[1] + 0.07, p[2])); }
    k.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ridge), 14, 0.065, 5, false), INK);
    const eave = []; for (let n = 0; n <= 16; n++) { const p = P(n / 16, 0); eave.push(V(p[0], p[1] - 0.02, p[2])); }
    k.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(eave), 24, 0.045, 5, false), C('#56514a'));                   // 檐口一道
    for (let n = 1; n < 12; n++) { const u = n / 12, a = P(u, 0, -0.08), b = P(u, 0.32, -0.08); rod(k, V(...a), V(...b), 0.026, 0.026, C('#5e4a38'), 4); } // 椽子
    // 角梁头挂风铎
    const cp = P(0, 0); k.add(new THREE.ConeGeometry(0.05, 0.14, 6), INK, 0, M().setPosition(cp[0], cp[1] - 0.16, cp[2]));
  }
  const pk = ry0 + rh;
  k.add(new THREE.CylinderGeometry(0.16, 0.22, 0.18, 8), INK, 0, M().setPosition(ec[0], pk + 0.02, ec[1]));
  k.add(new THREE.SphereGeometry(0.15, 10, 8), INK, 0, M().setPosition(ec[0], pk + 0.24, ec[1]));
  k.add(new THREE.ConeGeometry(0.05, 0.5, 6), INK, 0, M().setPosition(ec[0], pk + 0.6, ec[1]));
  return { geometry: k.geometry(), feet: [0, 1, 2, 3].map((i) => at(i, foot[i])) };
}

// ---------- 幡杆：红漆长杆，夹杆石，顶上龙头挑出一钩，挂黄幡 ----------
export function buildBannerPole(H = 12) {
  const k = new Kit(), ZHU = COL.zhu, STONE_P = C('#a99c82'), INK = C('#3d3a34'), GOLD = C('#c9a457'), ROPE = C('#e6dcc4');
  k.add(new THREE.CylinderGeometry(0.06, 0.1, H, 10), ZHU, 0, M().setPosition(0, H / 2 - 0.4, 0));
  for (const s of [-1, 1]) { // 夹杆石：两块立石夹着杆脚，顶上抹圆
    k.add(new THREE.BoxGeometry(0.16, 1.15, 0.46), STONE_P, 0, M().setPosition(s * 0.2, 0.5, 0));
    k.add(new THREE.CylinderGeometry(0.23, 0.23, 0.16, 12, 1, false, 0, Math.PI), STONE_P, 0, M().makeRotationZ(Math.PI / 2).premultiply(M().makeRotationY(Math.PI / 2)).setPosition(s * 0.2, 1.07, 0));
  }
  k.add(new THREE.BoxGeometry(0.8, 0.12, 0.66), STONE_P, 0, M().setPosition(0, 0.0, 0));
  for (const y of [0.35, 0.85]) k.add(new THREE.CylinderGeometry(0.05, 0.05, 0.62, 6), INK, 0, M().makeRotationZ(Math.PI / 2).setPosition(0, y, 0)); // 穿杆铁销
  for (const y of [3.4, 6.6, 9.4]) k.add(new THREE.CylinderGeometry(0.095, 0.095, 0.1, 10), ROPE, 0, M().setPosition(0, y, 0));
  // 杆顶：宝珠 + 往 -x 挑出的弯钩（龙头）
  const top = H - 0.4;
  k.add(new THREE.SphereGeometry(0.1, 10, 8), GOLD, 0, M().setPosition(0, top + 0.06, 0));
  k.add(new THREE.ConeGeometry(0.045, 0.3, 6), GOLD, 0, M().setPosition(0, top + 0.28, 0));
  const hook = [V(0, top - 0.5, 0), V(-0.28, top - 0.22, 0), V(-0.62, top - 0.18, 0), V(-0.85, top - 0.3, 0), V(-0.9, top - 0.5, 0)];
  k.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hook), 20, 0.035, 6, false), INK);
  k.add(new THREE.SphereGeometry(0.07, 8, 6), INK, 0, M().makeScale(1.6, 0.9, 0.9).setPosition(-0.78, top - 0.2, 0)); // 龙头
  k.add(new THREE.TorusGeometry(0.05, 0.012, 4, 10), INK, 0, M().setPosition(-0.9, top - 0.58, 0));
  return { geometry: k.geometry(), hang: V(-0.9, top - 0.62, 0) };
}

// ---------- 摩崖：一整块岩体，正面凿出圆拱大龛，龛壁上浮雕头光；摩崖大像立在龛里 ----------
// 原点在龛口地面中心，龛口朝 +z；岩体宽 2A、进深 2B、高 C
export function buildMoyaCliff({ A = 23, B = 14, C = 50, Wn = 22, Hs = 28, Hn = 40.5, Dn = 11, headY = 32 } = {}) {
  const rc = 7, sides = [];
  // 圆角矩形平面：从正面中心起逆时针一圈
  const segs = [[A - rc, 0, 'L', 1, 0], [A - rc, -rc, 'A', Math.PI / 2, 0], [A, -rc, 'L', 0, -1], [A - rc, -2 * B + rc, 'A', 0, -Math.PI / 2], [A - rc, -2 * B, 'L', -1, 0], [-A + rc, -2 * B + rc, 'A', -Math.PI / 2, -Math.PI], [-A, -2 * B + rc, 'L', 0, 1], [-A + rc, -rc, 'A', Math.PI, Math.PI / 2], [-A + rc, 0, 'L', 1, 0]];
  const lens = [A - rc, rc * Math.PI / 2, 2 * B - 2 * rc, rc * Math.PI / 2, 2 * A - 2 * rc, rc * Math.PI / 2, 2 * B - 2 * rc, rc * Math.PI / 2, A - rc];
  const L = lens.reduce((a, b) => a + b, 0);
  const plan = (sd) => { // 返回 [x, z, 外法线 nx, nz]
    let s0 = ((sd % L) + L) % L;
    for (let i = 0; i < segs.length; i++) {
      if (s0 <= lens[i] || i === segs.length - 1) {
        const g = segs[i], t = Math.min(1, s0 / lens[i]);
        if (g[2] === 'A') { const a = g[3] + (g[4] - g[3]) * t; return [g[0] + Math.cos(a) * rc, g[1] + Math.sin(a) * rc, Math.cos(a), Math.sin(a)]; }
        if (i === 0) return [t * (A - rc), 0, 0, 1];
        if (i === 8) return [-A + rc + t * (A - rc), 0, 0, 1];
        if (i === 2) return [A, -rc - t * (2 * B - 2 * rc), 1, 0];
        if (i === 4) return [A - rc - t * (2 * A - 2 * rc), -2 * B, 0, -1];
        return [-A, -2 * B + rc + t * (2 * B - 2 * rc), -1, 0];
      }
      s0 -= lens[i];
    }
  };
  const NU = 150, NV = 100;
  const S = warp(NU, (t) => { const d = Math.min(t, L - t); return 1 + 4 * gs(d, 16); }, 0, L);
  const pos = [], aH = [], aM = [];
  const hw = Wn / 2;
  for (let j = 0; j <= NV; j++) {
    const v = j / NV, y = -8 + (C + 8) * v, yc = Math.max(0, y) / C, hf = j === NV ? 0 : Math.pow(1 - Math.pow(Math.min(1, yc), 4), 0.25);
    for (let i = 0; i <= NU; i++) {
      const sd = S[i], [px, pz, nx, nz] = plan(sd);
      // 收顶：朝岩体中轴 (0, -B) 收
      let x = px * hf, z = -B + (pz + B) * hf;
      // 龛：正面圆拱范围内往里凿
      const front = nz > 0.5 ? 1 : 0;
      const ytop = Math.abs(x) < hw ? Hs + (Hn - Hs) * Math.sqrt(Math.max(0, 1 - (x / hw) * (x / hw))) : -99;
      const inside = Math.min(hw - Math.abs(x), ytop - y, y + 6);
      const m = front * sm(-0.6, 1.6, inside);
      // 粗岩面起伏 + 横向层理；龛内凿得平整
      const rough = 1.3 * (vnoise(sd * 0.13, y * 0.11) - 0.5) + 0.6 * (vnoise(sd * 0.45, y * 0.38) - 0.5) + 0.35 * Math.sin(y * 0.9 + 3 * vnoise(sd * 0.04, y * 0.04));
      let off = rough * (1 - 0.85 * m);
      // 龛壁：中间略深的弧面；头光两圈浮雕
      let dep = Dn * m * (1 + 0.12 * (1 - (x / hw) * (x / hw)));
      const rr = Math.hypot(x, y - headY);
      dep -= m * (0.45 * gs(rr - 6.2, 0.45) + 0.4 * gs(rr - 8.4, 0.4) + 0.25 * gs(rr - 4.6, 0.35));
      x += nx * off * hf; z += nz * off * hf - dep;
      pos.push(x, y, z);
      aH.push(Math.min(1, yc)); aM.push(m); // aM：龛内，岩石材质据此压暗、不上石青、不画层理
    }
  }
  const idx = [];
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(aH, 1));
  g.setAttribute('aM', new THREE.Float32BufferAttribute(aM, 1));
  g.setIndex(idx); g.computeVertexNormals();
  // 保证法线朝外（岩石材质是单面的）：看正面中心一个点
  const k0 = 20 * (NU + 1);
  if (g.attributes.normal.getZ(k0) < 0) { for (let t = 0; t < idx.length; t += 3) { const q = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = q; } g.setIndex(idx); g.computeVertexNormals(); }
  return g.toNonIndexed();
}
