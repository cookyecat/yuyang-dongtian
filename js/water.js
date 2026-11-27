// 水：玉女潭、龍湫深潭用实时倒影（Reflector）+ 清透的青绿水色 + 工笔水纹；曲溪用不反射的流水。
// v48：水色不动。加工笔水纹线（疏密两组、断续起伏）、沿岸水线和留白、日月波光、河灯水影、溪水顺流纹和跌水翻白、瀑布水丝。
// 龍湫瀑布：三层水帘、跌水白沫、潭面水雾与不断外扩的落水涟漪。
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { pondShape } from './world.js';

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

// v48 日月在水面上的波光：main.js 每帧按时辰调 setWaterLight
const LIGHT = { lightDir: { value: new THREE.Vector3(0.3, 0.6, -0.7).normalize() }, lightCol: { value: new THREE.Vector3(0.5, 0.49, 0.45) } };
export function setWaterLight(sky) {
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const day = sm(-0.12, 0.06, sky.e), w = sky.warm, mk = sm(0.6, 0.95, sky.night) * sm(0, 0.1, sky.moon.y);
  if (day > 0.001) { LIGHT.lightDir.value.copy(sky.sun); LIGHT.lightCol.value.set(0.5 + 0.5 * w, 0.49 + 0.26 * w, 0.45 + 0.02 * w).multiplyScalar(day); }
  else { LIGHT.lightDir.value.copy(sky.moon); LIGHT.lightCol.value.set(1.5, 1.75, 2.1).multiplyScalar(mk); } // 夜里整幅画压暗，月光先提亮
}

// 工笔水纹：一组顺着 dir 方向的细墨线，疏密随机、断断续续、微微起伏；fw 太大（太远）时淡出，不起摩尔纹
const STROKES = /* glsl */`
  float aaLine(float f, float hw){ float fw=fwidth(f); float d=abs(fract(f)-.5); return clamp((hw+fw*.5-d)/max(fw,1e-4),0.,1.)*min(1.,2.*hw/max(fw,2.*hw))*(1.-smoothstep(.3,.7,fw)); }
  float strokes(vec2 q, float sp, float t, float seed, float hw){
    vec2 s=q/sp;
    float f=s.y + .34*sin(s.x*.42 + 2.6*vnoise(s*.16+seed) + t*.28) + .22*sin(s.x*.17+s.y*.21+seed*3.);
    float id=floor(f);
    float m=vnoise(vec2(s.x*.13 + hash12(vec2(id,seed))*37. + t*.02, id*.71+seed));
    float keep=smoothstep(.47,.6,m);
    return aaLine(f, hw*(.6+.4*keep))*keep;
  }
`;

const pondShader = {
  name: 'PondShader',
  uniforms: {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
    time: { value: 0 }, ripples: { value: Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, -99, 0)) },
    reflK: { value: 0.5 }, radius: { value: new THREE.Vector2(10, 8) }, center: { value: new THREE.Vector2() },
    lobeC: { value: [new THREE.Vector4(), new THREE.Vector4()] }, lobeA: { value: [new THREE.Vector4(), new THREE.Vector4()] }, lobeW: { value: [new THREE.Vector4(1, 1, 1, 1), new THREE.Vector4(1, 1, 1, 1)] }, // v62 岸线凸凹（见 world.js pondLobeR）
    lightDir: { value: new THREE.Vector3(0, 1, 0) }, lightCol: { value: new THREE.Vector3() },
    lamps: { value: Array.from({ length: 8 }, () => new THREE.Vector3(0, 0, 0)) }, lampK: { value: 0 }, churn: { value: new THREE.Vector4(0, 0, 1, 0) },
  },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix; attribute float aDep, aShore; varying vec4 vRefl; varying vec3 vW; varying float vDep, vShore;
    void main(){ vDep=aDep; vShore=aShore; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vRefl=textureMatrix*vec4(position,1.); gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float time, reflK, lampK; uniform vec4 ripples[6]; uniform vec2 radius, center; uniform vec4 lobeC[2], lobeA[2], lobeW[2];
    uniform vec3 lightDir, lightCol; uniform vec3 lamps[8]; uniform vec4 churn;
    varying vec4 vRefl; varying vec3 vW; varying float vDep, vShore;
    ${NOISE}${WATER}${STROKES}
    void main(){
      vec2 p=vW.xz;
      // 离岸距离：0 岸边 → 1 潭心
      vec2 e=(p-center)/radius; float r=length(e);
      if(dot(lobeA[0],lobeA[0])+dot(lobeA[1],lobeA[1])>0.){ vec4 d0=atan(e.y,e.x)-lobeC[0], d1=atan(e.y,e.x)-lobeC[1]; d0-=6.2831853*floor((d0+3.1415927)/6.2831853); d1-=6.2831853*floor((d1+3.1415927)/6.2831853); r/=1.+dot(lobeA[0],exp(-(d0/lobeW[0])*(d0/lobeW[0])))+dot(lobeA[1],exp(-(d1/lobeW[1])*(d1/lobeW[1]))); } // v62 岸线凸凹
      float depth=smoothstep(1.05,.35,r);
      float a=smoothstep(.0,.09,vDep)*(1.-smoothstep(1.03,1.06,r)); if(a<.004) discard;
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
      float sky=1.-smoothstep(.0,.22,max(refl.r,max(refl.g,refl.b))); // v48 倒影里没画到东西的地方（天在后处理里才画，这里是黑的）不映，免得潭面出黑斑
      vec3 col=mix(base, refl*vec3(.92,.97,.96)+base*.12, clamp(fres*reflK*1.6,0.,.85)*(1.-sky));
      // 工笔水纹：细墨线勾的水波，一疏一密两组，近岸密、潭心疏
      float sd=vShore;
      float ln=strokes(p+g*.8, .5, t, 1., .09)*(.45+.55*(1.-depth)) + strokes(p+g*.8, 1.3, t*.7, 5., .045);
      ln*=smoothstep(.5,1.3,sd);
      // 沿岸水线：两三道顺着岸形的细线，一道一道慢慢涌向岸边
      float n35=vnoise(p*.35); float cf=sd*1.15 + t*.07 + .25*n35;
      float cl=aaLine(cf,.045)*smoothstep(.42,.56,vnoise(p*.55+floor(cf)*3.7))*(1.-smoothstep(1.,2.6,sd))*smoothstep(.25,.5,sd);
      col=mix(col, LINE, min(1.,ln+cl)*.6);
      col=mix(col, vec3(.95,.96,.9), smoothstep(.25,.6,rip)*.35);
      // 瀑布落水处翻涌的白沫，一圈一圈往外推
      if(churn.w>0.){ vec2 cd=p-churn.xy; float cr=length(cd); float ck=churn.w*smoothstep(churn.z,0.,cr);
        float fn=vnoise(vec2(cr*2.6-t*1.5, atan(cd.y,cd.x)*2.5))*.65+vnoise(cd*3.+t*.4)*.35;
        float arcs=aaLine(cr*1.1-t*.35+.3*vnoise(cd*.8),.07)*smoothstep(churn.z*1.6,churn.z*.3,cr)*smoothstep(.4,.6,vnoise(cd*1.2+floor(cr*1.1-t*.35)));
        col=mix(col, vec3(.96,.97,.93), clamp(smoothstep(.8-ck*.55,.95-ck*.4,fn)*ck*1.4 + arcs*.55*churn.w, 0.,.92)); }
      // 波光：日月在水面上拖出的一道碎光，横向的细笔触，不是散点
      vec3 N=normalize(vec3(-g.x*1.3,1.,-g.y*1.3)); float sl=max(dot(reflect(-V,N),lightDir),0.);
      if(lightCol.g>.01){ float dn=vnoise(vec2(p.x*1.9+t*.25, p.y*9.-t*.7))*vnoise(vec2(p.x*1.2-t*.18, p.y*6.+t*.45));
        float glint=smoothstep(.36,.52,dn);
        col+=lightCol*(pow(sl,70.)*(.25+1.5*glint) + pow(sl,9.)*.1*glint + glint*.05*fres); }
      // 河灯映在水里：朝镜头拖一道碎的暖光
      if(lampK>.01){ for(int i=0;i<8;i++){ vec3 L=lamps[i]; if(L.z<=0.) continue;
        vec2 d=p-L.xy, cd=normalize(cameraPosition.xz-L.xy); float al=dot(d,cd), pe=dot(d,vec2(-cd.y,cd.x));
        float s=exp(-pe*pe*(9.+4.*max(al,0.)))*smoothstep(-.15,.3,al)*exp(-max(al,0.)*.75)*(.5+.5*sin(al*13.-t*2.6+g.x*30.));
        col+=vec3(1.,.62,.3)*(s*1.6+exp(-dot(d,d)*2.2)*.5)*lampK*L.z; } }
      // 岸边留白：一圈浅色浪痕，随水一进一退，边缘碎成小弧
      float lap=.2+.07*sin(t*.7+n35*6.28)+.1*abs(sin(n35*31.+p.x*1.3+t*.2));
      col=mix(col, vec3(.86,.85,.78), max(smoothstep(.9,1.02,r)*.5, (1.-smoothstep(lap*.55,lap,sd))*.62));
      gl_FragColor=vec4(col,a);
    }`,
};

// 潭面网格：按潭底地形算每个点的水深和离岸距离（岸边留白、沿岸水线、水面淡出都靠它），岸上的三角形不要
function pondGeometry(P, height) {
  const RM = 1 + Math.max(0, ...(P.lobes || []).map((L) => L[1])), W = P.rx * 1.07 * RM, H = P.rz * 1.07 * RM, st = Math.min(0.45, Math.max(0.3, W / 40)), nx = Math.ceil(2 * W / st), nz = Math.ceil(2 * H / st);
  const pos = [], dep = [], shore = [], idx = [];
  const hAt = height || (() => P.wl - 2);
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const lx = -W + 2 * W * i / nx, ly = -H + 2 * H * j / nz, x = P.x + lx, z = P.z - ly;
    const h = hAt(x, z), d = P.wl - h, gx = (hAt(x + 0.3, z) - hAt(x - 0.3, z)) / 0.6, gz = (hAt(x, z + 0.3) - hAt(x, z - 0.3)) / 0.6;
    pos.push(lx, ly, 0); dep.push(d); shore.push(Math.max(-1, Math.min(8, d / Math.max(0.06, Math.hypot(gx, gz)))));
  }
  const n1 = nx + 1, wet = (k) => dep[k] > -0.25 && pondShape(P.x + pos[k * 3], P.z - pos[k * 3 + 1], P) < 1.09;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * n1 + i, b = a + 1, c = a + n1, d = c + 1;
    if (wet(a) || wet(b) || wet(c) || wet(d)) idx.push(a, b, d, a, d, c);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aDep', new THREE.Float32BufferAttribute(dep, 1)); g.setAttribute('aShore', new THREE.Float32BufferAttribute(shore, 1)); g.setIndex(idx);
  return g;
}

export function createPond(P, { mobile = false, reflK = 0.55, height = null } = {}) {
  const g = pondGeometry(P, height);
  let mesh;
  if (mobile) { // 手机不做实时倒影，只留水色、水纹与涟漪
    const u = THREE.UniformsUtils.clone(pondShader.uniforms);
    u.tDiffuse.value = new THREE.DataTexture(new Uint8Array([200, 205, 195, 255]), 1, 1); u.tDiffuse.value.needsUpdate = true;
    u.textureMatrix.value = new THREE.Matrix4(); u.reflK.value = 0;
    mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: u, vertexShader: pondShader.vertexShader, fragmentShader: pondShader.fragmentShader }));
  } else {
    const s = 0.36 * Math.min(devicePixelRatio, 1.5); // 倒影本来就有水纹扰动，低分辨率看不出差别
    mesh = new Reflector(g, { shader: pondShader, textureWidth: Math.round(innerWidth * s), textureHeight: Math.round(innerHeight * s), clipBias: 0.02, multisample: 0 });
    mesh.material.uniforms.reflK.value = reflK;
  }
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(P.x, P.wl, P.z);
  const u = mesh.material.uniforms;
  u.radius.value.set(P.rx, P.rz); u.center.value.set(P.x, P.z);
  if (P.lobes) P.lobes.forEach(([c, a, w], i) => { const j = i >> 2, k = i & 3; u.lobeC.value[j].setComponent(k, c * Math.PI / 180); u.lobeA.value[j].setComponent(k, a); u.lobeW.value[j].setComponent(k, w); }); u.lightDir = LIGHT.lightDir; u.lightCol = LIGHT.lightCol;
  // v48 水边半透明淡出、不写深度：岸线顺着潭底地形走，不再是水平面和地形网格硬切出来的折线
  mesh.material.transparent = true; mesh.material.depthWrite = false; mesh.renderOrder = 1;
  mesh.userData.ripples = u.ripples.value;
  return mesh;
}

// 曲溪：清水，水纹顺流而下。hw 半宽（米）；顶点属性 aSlope 是溪床的坡度，陡处翻白（跌水）
export function streamMaterial(hw = 1.8) {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, hw: { value: hw }, ripples: { value: Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, -99, 0)) }, lightDir: LIGHT.lightDir, lightCol: LIGHT.lightCol },
    side: THREE.DoubleSide,
    vertexShader: /* glsl */`attribute float aSlope; varying vec3 vW; varying vec2 vUv; varying float vSlope; void main(){ vUv=uv; vSlope=aSlope; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`uniform float time, hw; uniform vec3 lightDir, lightCol; varying vec3 vW; varying vec2 vUv; varying float vSlope; ${NOISE}${WATER}${STROKES}
      void main(){ vec2 p=vW.xz; float across=abs(vUv.y-.5)*2.; float t=time;
        float s=vUv.x*160., a=vUv.y*hw*2.;   // 顺流、横向都换成米
        vec3 col=mix(DEEP*1.1, SHALLOW, across*.8);
        // 顺流的细水纹：一缕一缕随水摆动，断断续续往下游走
        float sp=.3;
        float f=a/sp + 1.6*(vnoise(vec2(s*.2-t*.1, a*.22))-.5) + .25*sin(s*1.1-t*1.2+a*.6);
        float id=floor(f);
        float keep=smoothstep(.44,.58,vnoise(vec2((s-t*1.1)*.3+hash12(vec2(id,3.))*23., id*.37)));
        float ln=aaLine(f,.05+.03*keep)*keep*(1.-smoothstep(.75,.95,across));
        col=mix(col, LINE, ln*.4);
        // 水面的白色流纹，比墨线走得快
        float f2=a/.62 + 1.2*(vnoise(vec2(s*.27-t*.22, a*.2+7.))-.5);
        float keep2=smoothstep(.56,.68,vnoise(vec2((s-t*1.9)*.45+hash12(vec2(floor(f2),9.))*31., floor(f2)*.53)));
        col=mix(col, vec3(.92,.93,.88), aaLine(f2,.035)*keep2*.55*(1.-smoothstep(.7,.9,across)));
        // 跌水：溪床陡的地方水翻白，拉成一丝一丝
        float fk=smoothstep(.06,.2,vSlope);
        float st=vnoise(vec2(a*11., s*.6-t*2.6))*.6+vnoise(vec2(a*23., s*1.3-t*3.8))*.4;
        col=mix(col, vec3(.95,.96,.92), fk*smoothstep(.36,.62,st)*.85);
        // 两岸留白：浅色浪痕，边缘随水流碎成小弧
        float bank=.8-.1*abs(sin(s*2.1-t*.9+vnoise(vec2(s*.7,vUv.y*3.))*5.))-.08*fk;
        col=mix(col, vec3(.9,.91,.86), smoothstep(bank,1.,across)*.5);
        // 波光
        vec3 V=normalize(cameraPosition-vW); float sl=max(dot(reflect(-V,vec3(0.,1.,0.)),lightDir),0.);
        float glint=smoothstep(.4,.55,vnoise(vec2(s*1.6-t*1.6, a*8.))*vnoise(vec2(s*1.1-t*.9, a*5.+t*.3)));
        col+=lightCol*glint*(pow(sl,40.)*1.2+pow(sl,6.)*.1+.03);
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
  const fallShader = (seed, alpha, ink) => new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, seed: { value: seed }, alpha: { value: alpha }, ink: { value: ink } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: /* glsl */`attribute float aFoam, aFall, aD; varying vec2 vUv; varying float vFoam, vFall, vD;
      void main(){ vUv=uv; vFoam=aFoam; vFall=aFall; vD=aD; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: /* glsl */`uniform float time, seed, alpha, ink; varying vec2 vUv; varying float vFoam, vFall, vD; ${NOISE}
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
        float a=clamp(body*alpha*1.35,0.,.95)*smoothstep(0.,.9,d); // v48 崖口出水处淡入
        if(a<.03) discard;
        vec3 c=mix(vec3(.66,.74,.76), vec3(.98,.98,.94), clamp(smoothstep(.3,.8,s1*s2*1.7)+foam+vFall*.2,0.,1.));
        // v48 工笔水丝：白练上几缕随水摆动的淡墨细线（只画在最前一层）
        float th=x*11.+seed+.9*(vnoise(vec2(x*2.5+seed, d*.22-sp*.07))-.5); float fw=fwidth(th);
        float tl=clamp((.07+fw*.5-abs(fract(th)-.5))/max(fw,1e-4),0.,1.)*(1.-smoothstep(.3,.7,fw));
        tl*=smoothstep(.4,.6,vnoise(vec2(floor(th)*3.1+seed, d*.3-sp*.12)))*(1.-clamp(foam,0.,1.))*edge;
        c=mix(c, vec3(.42,.52,.53), tl*ink*.5); a=max(a, tl*ink*.5*edge);
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
    const m = fallShader(li * 7.3, alpha, li === 0 ? 1 : 0); mats.push(m);
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
