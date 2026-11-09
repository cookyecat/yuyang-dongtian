// 水：玉女潭、龍湫深潭用实时倒影（Reflector）+ 清透的青绿水色 + 工笔水纹；曲溪用不反射的流水。
// 龍湫瀑布：三层水帘、跌水白沫、潭面水雾与不断外扩的落水涟漪。
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

const NOISE = /* glsl */`
  float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
  float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(hash12(i),hash12(i+vec2(1,0)),f.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),f.x), f.y); }
`;

// 水色（取自原画潭面：清浅处石绿，深处石青）
const WATER = /* glsl */`
  const vec3 SHALLOW = vec3(.60,.69,.62);
  const vec3 DEEP = vec3(.33,.47,.50);
  const vec3 LINE = vec3(.26,.33,.32);
`;

const pondShader = {
  name: 'PondShader',
  uniforms: {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
    time: { value: 0 }, ripples: { value: Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, -99, 0)) },
    reflK: { value: 0.5 }, radius: { value: new THREE.Vector2(10, 8) }, center: { value: new THREE.Vector2() },
  },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix; varying vec4 vRefl; varying vec3 vW;
    void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vRefl=textureMatrix*vec4(position,1.); gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float time, reflK; uniform vec4 ripples[6]; uniform vec2 radius, center;
    varying vec4 vRefl; varying vec3 vW;
    ${NOISE}${WATER}
    void main(){
      vec2 p=vW.xz;
      // 离岸距离：0 岸边 → 1 潭心
      vec2 e=(p-center)/radius; float r=length(e); float depth=smoothstep(1.05,.35,r);
      // 微波法线：两组慢慢错动的波
      float t=time;
      vec2 g = vec2(vnoise(p*.5+vec2(t*.2,0.))-vnoise(p*.5+vec2(t*.2,0.)+vec2(.2,0.)),
                    vnoise(p*.5+vec2(0.,t*.16))-vnoise(p*.5+vec2(0.,t*.16)+vec2(0.,.2)));
      g += .5*vec2(sin(p.y*2.3+t*1.1), cos(p.x*2.1-t*.9))*.06;
      // 涟漪
      float rip=0.;
      for(int i=0;i<6;i++){ vec4 R=ripples[i]; float age=t-R.z; if(age<0.||age>7.) continue;
        float d=length(p-R.xy); float sp=R.w>0.?R.w:2.;
        float ring=sin((d-age*sp)*6.)*exp(-pow((d-age*sp)*1.4,2.))*(1.-age/7.);
        rip+=ring; g+=normalize(p-R.xy+1e-4)*ring*.12; }
      // 倒影
      vec4 uv=vRefl; uv.xy += g*uv.w*.3;
      vec3 refl=texture2DProj(tDiffuse, uv).rgb;
      vec3 base=mix(SHALLOW, DEEP, depth);
      base*= .96+.08*vnoise(p*.12);
      // 越远越接近掠射角，倒影越强
      vec3 V=normalize(cameraPosition-vW); float fres=.25+.6*pow(1.-max(V.y,0.),3.);
      vec3 col=mix(base, refl*vec3(.92,.97,.96)+base*.12, clamp(fres*reflK*1.6,0.,.85));
      // 工笔水纹：细而规则的鱼鳞纹，近岸更密
      float w=sin(p.y*3.6 + sin(p.x*.7+t*.35)*1.4 + vnoise(p*.5)*2.4 + t*.4);
      float ln=smoothstep(.95,.995,w)*(.35+.65*(1.-depth));
      col=mix(col, LINE, ln*.45);
      col=mix(col, vec3(.95,.96,.9), smoothstep(.25,.6,rip)*.35);
      // 波光
      float sp=smoothstep(.985,1.,vnoise(p*6.+t*.8)*vnoise(p*5.-t*.6)*1.9);
      col+=sp*.25*fres;
      // 岸边一圈浅色浪痕
      col=mix(col, vec3(.86,.85,.78), smoothstep(.9,1.02,r)*.5);
      gl_FragColor=vec4(col,1.);
    }`,
};

export function createPond(P, { mobile = false, reflK = 0.55 } = {}) {
  const g = new THREE.CircleGeometry(1, 64); g.scale(P.rx * 1.06, P.rz * 1.06, 1);
  if (mobile) { // 手机不做实时倒影，只留水色、水纹与涟漪
    const u = THREE.UniformsUtils.clone(pondShader.uniforms);
    u.tDiffuse.value = new THREE.DataTexture(new Uint8Array([200, 205, 195, 255]), 1, 1); u.tDiffuse.value.needsUpdate = true;
    u.textureMatrix.value = new THREE.Matrix4(); u.reflK.value = 0; u.radius.value.set(P.rx, P.rz); u.center.value.set(P.x, P.z);
    const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: u, vertexShader: pondShader.vertexShader, fragmentShader: pondShader.fragmentShader }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(P.x, P.wl, P.z); mesh.userData.ripples = u.ripples.value; return mesh;
  }
  const s = 0.36 * Math.min(devicePixelRatio, 1.5); // 倒影本来就有水纹扰动，低分辨率看不出差别
  const mesh = new Reflector(g, { shader: pondShader, textureWidth: Math.round(innerWidth * s), textureHeight: Math.round(innerHeight * s), clipBias: 0.02, multisample: 0 });
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(P.x, P.wl, P.z);
  const u = mesh.material.uniforms;
  u.radius.value.set(P.rx, P.rz); u.center.value.set(P.x, P.z); u.reflK.value = reflK;
  mesh.userData.ripples = u.ripples.value;
  return mesh;
}

// 曲溪：清水，水纹顺流而下
export function streamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, ripples: { value: Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, -99, 0)) } },
    side: THREE.DoubleSide,
    vertexShader: /* glsl */`varying vec3 vW; varying vec2 vUv; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`uniform float time; varying vec3 vW; varying vec2 vUv; ${NOISE}${WATER}
      void main(){ vec2 p=vW.xz; float across=abs(vUv.y-.5)*2.;
        vec3 col=mix(DEEP*1.1, SHALLOW, across*.8);
        float w=sin(vUv.x*90. - time*3. + vnoise(p*.8)*3. + across*2.);
        col=mix(col, LINE, smoothstep(.93,.99,w)*.4);
        col=mix(col, vec3(.9,.91,.86), smoothstep(.8,1.,across)*.35 + smoothstep(.9,1.,vnoise(vec2(vUv.x*60.-time*4.,vUv.y*6.)))*.3);
        gl_FragColor=vec4(col,1.); }`,
  });
}

// ---------- 龍湫瀑布 ----------
// top/bottom: 顶部出水口与落水点（世界坐标），width: 水帘宽
// 瀑布：沿给定的落水路径（贴崖滑落 / 离崖悬垂交替）生成一条水帘，跌落处起白沫与水雾，崖前有缓缓上升的仙气
// path: [{ p: Vector3, w: 宽, foam: 0..1 撞击白沫, fall: 0..1 悬空程度 }], impacts: [Vector3]
export function createWaterfall(path, impacts, { mobile = false } = {}) {
  const group = new THREE.Group();
  const mats = [];
  const fallShader = (seed, alpha) => new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, seed: { value: seed }, alpha: { value: alpha } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: /* glsl */`attribute float aFoam, aFall, aD; varying vec2 vUv; varying float vFoam, vFall, vD;
      void main(){ vUv=uv; vFoam=aFoam; vFall=aFall; vD=aD; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: /* glsl */`uniform float time, seed, alpha; varying vec2 vUv; varying float vFoam, vFall, vD; ${NOISE}
      void main(){
        float x=vUv.x, d=vD;
        float sp=time*(3.2+vFall*2.);
        // 竖向水丝随水流下落；悬空越久，水丝越散
        float s1=vnoise(vec2(x*18.+seed, d*.55-sp*.5));
        float s2=vnoise(vec2(x*46.+seed*3., d*1.3-sp*1.1));
        float s3=vnoise(vec2(x*7.+seed*5., d*.18-sp*.2));
        float rag=.1+.1*vnoise(vec2(d*1.2-sp*.6,seed))+vFall*.12;
        float edge=smoothstep(0.,rag,x)*smoothstep(1.,1.-rag,x);
        float strands=smoothstep(.25+vFall*.25, .75, s1*.6+s2*.4+s3*.25);
        float body=mix(.55+.45*s1, strands, .35+vFall*.45)*edge;
        // 撞击处：翻白的水沫
        float foam=vFoam*smoothstep(.3,.7,vnoise(vec2(x*12.+seed, d*2.-time*2.)));
        body=max(body, foam*edge*1.1);
        float a=clamp(body*alpha*1.35,0.,.95);
        if(a<.03) discard;
        vec3 c=mix(vec3(.66,.74,.76), vec3(.98,.98,.94), clamp(smoothstep(.3,.8,s1*s2*1.7)+foam+vFall*.2,0.,1.));
        gl_FragColor=vec4(c,a);
      }`,
  });
  // 三层水帘叠出厚度：中层最亮，后层宽而淡
  const layers = [[1.0, 0.95, 0.0], [0.7, 0.7, 0.18], [1.3, 0.35, -0.22]];
  layers.forEach(([wk, alpha, off], li) => {
    const pos = [], uv = [], idx = [], foam = [], fl = [], dd = [];
    let D = 0;
    path.forEach((q, j) => {
      if (j) D += q.p.distanceTo(path[j - 1].p);
      const w = q.w * wk, z = q.p.z + off;
      pos.push(q.p.x - w / 2, q.p.y, z, q.p.x + w / 2, q.p.y, z); uv.push(0, 0, 1, 0);
      foam.push(q.foam, q.foam); fl.push(q.fall, q.fall); dd.push(D, D);
      if (j < path.length - 1) { const a = j * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aFoam', new THREE.Float32BufferAttribute(foam, 1)); g.setAttribute('aFall', new THREE.Float32BufferAttribute(fl, 1)); g.setAttribute('aD', new THREE.Float32BufferAttribute(dd, 1));
    g.setIndex(idx);
    const m = fallShader(li * 7.3, alpha); mats.push(m);
    const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 2 + li; group.add(mesh);
  });
  // 雾点：撞击处翻涌的水雾 + 沿崖面缓缓升起、飘散的仙气
  const puffs = (N, spec) => {
    const pg = new THREE.BufferGeometry(), pp = new Float32Array(N * 3), ps = new Float32Array(N), pb = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { ps[i] = (i * 0.618034) % 1; const b = spec.bases[i % spec.bases.length]; pb.set([b.x, b.y, b.z], i * 3); }
    pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('aSeed', new THREE.BufferAttribute(ps, 1)); pg.setAttribute('aBase', new THREE.BufferAttribute(pb, 3));
    const pm = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, scale: { value: innerHeight * 0.5 } },
      transparent: true, depthWrite: false,
      vertexShader: /* glsl */`uniform float time, scale; attribute float aSeed; attribute vec3 aBase; varying float vA;
        void main(){ float life=fract(time*${spec.speed.toFixed(3)}+aSeed); float ang=aSeed*40.;
          vec3 p=aBase+vec3(cos(ang)*(${spec.spread.toFixed(2)})*(.3+life), pow(life,${spec.pow.toFixed(2)})*${spec.rise.toFixed(2)}, sin(ang)*(.3+life)*${(spec.spread * 0.7).toFixed(2)}+life*${spec.out.toFixed(2)});
          p.x+=sin(time*.3+aSeed*9.)*life*1.5;
          vA=sin(life*3.1416)*${spec.alpha.toFixed(2)}; vec4 mv=modelViewMatrix*vec4(p,1.);
          gl_PointSize=scale*(${spec.size0.toFixed(2)}+life*${spec.size1.toFixed(2)})/-mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: /* glsl */`varying float vA; void main(){ vec2 d=gl_PointCoord-.5; float a=pow(smoothstep(.5,.0,length(d)),1.8)*vA; if(a<.008) discard; gl_FragColor=vec4(vec3(.96,.96,.93),a); }`,
    });
    const pts = new THREE.Points(pg, pm); pts.frustumCulled = false; pts.renderOrder = 6; group.add(pts); mats.push(pm);
  };
  puffs(mobile ? 30 : 80, { bases: impacts, speed: 0.22, spread: 2.6, rise: 4.5, pow: 2, out: 1.2, alpha: 0.3, size0: 1.2, size1: 3.2 });
  const base = impacts[impacts.length - 1];
  puffs(mobile ? 10 : 26, { bases: [base], speed: 0.045, spread: 5, rise: (path[0].p.y - base.y) * 1.1, pow: 1, out: 2.5, alpha: 0.16, size0: 4, size1: 9 });
  group.userData.update = (t) => { for (const m of mats) m.uniforms.time.value = t; };
  return group;
}
