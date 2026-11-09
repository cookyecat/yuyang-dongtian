// 远树：近处的立体树只画到 TREE_R 以内，再远的每棵树换成一张竖着的画片，
// 画法照原画的远树——松是几笔横出的针叶团，杂树是一团墨点（点叶），竹是几道细竖线。
// 一棵树只有两个三角形，整卷几千棵也不费性能；在近树消失的那一圈用抖动淡入接上。
import * as THREE from 'three';

// 画片图集：一排 4 格，每格 128×256
// 0 松、1 杂树（点叶）、2 竹、3 矮丛
function farTreeAtlas() {
  const W = 128, H = 256, c = document.createElement('canvas'); c.width = W * 4; c.height = H;
  const g = c.getContext('2d');
  let s = 7; const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const INK = 'rgba(38,46,36,0.95)', DARK = 'rgba(58,74,56,0.95)', MID = 'rgba(86,108,80,0.95)', LIGHT = 'rgba(120,140,104,0.9)';
  const dot = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, r * (0.8 + R() * 0.5), r * (0.6 + R() * 0.4), R() * 3, 0, 7); g.fill(); };
  const trunk = (x0, w, top, lean) => {
    g.strokeStyle = INK; g.lineCap = 'round'; g.lineWidth = w;
    g.beginPath(); g.moveTo(x0, H - 2); g.quadraticCurveTo(x0 + lean * 0.4, (H + top) / 2, x0 + lean, top); g.stroke();
  };
  // 0 松：细干，三四层向两侧平伸的针叶团
  {
    const ox = 0, cx = ox + W / 2; trunk(cx, 4, 60, 6);
    for (let k = 0; k < 5; k++) {
      const y = 70 + k * 30 + R() * 10, side = k % 2 ? 1 : -1, len = 26 + R() * 18, x = cx + 4 + side * (8 + R() * 10);
      for (let j = 0; j < 22; j++) dot(x + (R() - 0.5) * len * 1.4, y + (R() - 0.5) * 12, 4 + R() * 3, j % 4 ? DARK : INK);
      for (let j = 0; j < 6; j++) dot(x + (R() - 0.5) * len, y - 3 + (R() - 0.5) * 6, 3, MID);
    }
    for (let j = 0; j < 16; j++) dot(cx + 6 + (R() - 0.5) * 30, 55 + R() * 22, 4 + R() * 2, j % 3 ? DARK : INK);
  }
  // 1 杂树：两三根枝干，上面一大团墨点，外沿深、里面带一点石绿
  {
    const ox = W, cx = ox + W / 2; trunk(cx - 6, 5, 120, -4); trunk(cx + 6, 3.5, 110, 10);
    for (let j = 0; j < 150; j++) {
      const a = R() * 6.283, rr = Math.sqrt(R()), x = cx + Math.cos(a) * rr * 50, y = 92 + Math.sin(a) * rr * 62;
      dot(x, y, 4 + R() * 3, rr > 0.65 ? INK : j % 3 ? DARK : MID);
    }
    for (let j = 0; j < 20; j++) dot(cx + (R() - 0.5) * 50, 80 + (R() - 0.5) * 60, 3, LIGHT);
  }
  // 2 竹：五六道细竿，顶上几撇竹叶
  {
    const ox = 2 * W;
    for (let k = 0; k < 6; k++) {
      const x = ox + 24 + k * 15 + R() * 8, top = 20 + R() * 50;
      g.strokeStyle = k % 2 ? DARK : INK; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x, H - 2); g.lineTo(x + (R() - 0.5) * 8, top); g.stroke();
      for (let j = 0; j < 7; j++) { const y = top + 6 + j * 14 + R() * 6, d = R() < 0.5 ? -1 : 1; g.strokeStyle = j % 2 ? DARK : MID; g.lineWidth = 3.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + d * (10 + R() * 8), y + 6 + R() * 6); g.stroke(); }
    }
  }
  // 3 矮丛：贴地一团墨点
  {
    const ox = 3 * W, cx = ox + W / 2;
    for (let j = 0; j < 110; j++) { const a = R() * 3.1416, rr = Math.sqrt(R()), x = cx + Math.cos(a) * rr * 56, y = H - 4 - Math.sin(a) * rr * 70; dot(x, y, 5 + R() * 3, rr > 0.7 ? INK : j % 3 ? DARK : MID); }
  }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
  return t;
}

const CELL = { pine: 0, tallpine: 0, fir: 0, dwarfpine: 3, broad: 1, old: 1, cypress: 1, bamboo: 2, shrub: 3 };

// items: [{ x, y, z, w, h, type }]；r0..r1 是淡入的那一圈（水平距离）
export function createFarTrees(items, r0, r1) {
  const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);
  const n = items.length;
  const off = new Float32Array(n * 4), cell = new Float32Array(n * 2);
  items.forEach((it, i) => { off.set([it.x, it.y, it.z, it.w], i * 4); cell.set([CELL[it.type] ?? 1, it.h], i * 2); });
  const ig = new THREE.InstancedBufferGeometry(); ig.index = geo.index; ig.attributes.position = geo.attributes.position; ig.attributes.uv = geo.attributes.uv;
  ig.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
  ig.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 2));
  ig.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: farTreeAtlas() }, r0: { value: r0 }, r1: { value: r1 } },
    side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      attribute vec4 aOff; attribute vec2 aCell; uniform float r0, r1;
      varying vec2 vUv; varying float vFade; varying float vSeed;
      void main(){
        vec3 o = aOff.xyz; vec3 toC = cameraPosition - o; toC.y = 0.; float d = length(toC);
        vec3 right = d > 1e-3 ? vec3(toC.z, 0., -toC.x) / d : vec3(1.,0.,0.);
        vec3 p = o + right * position.x * aOff.w + vec3(0., position.y * aCell.y, 0.);
        vUv = vec2((uv.x + aCell.x) / 4., uv.y);
        vFade = smoothstep(r0, r1, d);
        vSeed = fract(sin(dot(o.xz, vec2(12.9898, 78.233))) * 43758.5453);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D map; varying vec2 vUv; varying float vFade; varying float vSeed;
      void main(){
        if (vFade <= 0.) discard;
        vec4 c = texture2D(map, vUv);
        if (c.a < .3) discard;
        // 淡入：按屏幕格子抖动，和近处立体树交接处不闪
        float h = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233)) + vSeed * 7.) * 43758.5453);
        if (h > vFade) discard;
        gl_FragColor = vec4(c.rgb / max(c.a, .01), 1.);
      }`,
  });
  const mesh = new THREE.Mesh(ig, mat); mesh.frustumCulled = false;
  return mesh;
}
