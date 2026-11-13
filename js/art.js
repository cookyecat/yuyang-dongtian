// 青绿风格：材质、笔触贴图与后处理（勾线、绢色雾、远山、绢纹）。
// 原则：不做写实光照，只留轻微的朝光面明暗；颜色都取自原画；没有投影。
import * as THREE from 'three';
// 所有颜色按“显示值”直接计算，不做线性/sRGB 转换，调色板与原画取色一一对应。
THREE.ColorManagement.enabled = false;

export const PAL = {
  silk: new THREE.Color('#e2c096'),
  silkSky: new THREE.Color('#e7cba4'),
  ink: new THREE.Color('#2c2a22'),
};
const SUN = new THREE.Vector3(-0.45, 0.8, 0.4).normalize();
const BLANK = new THREE.DataTexture(new Uint8Array([239, 223, 195, 255]), 1, 1); BLANK.needsUpdate = true;

const COMMON = /* glsl */`
  float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
  float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(hash12(i),hash12(i+vec2(1,0)),f.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),f.x), f.y); }
  float lum(vec3 c){ return dot(c, vec3(.299,.587,.114)); }
  vec3 tri(sampler2D t, vec3 p, vec3 n, float s){
    vec3 b=pow(abs(n), vec3(4.)); b/= (b.x+b.y+b.z);
    return texture2D(t,p.zy*s).rgb*b.x + texture2D(t,p.xz*s).rgb*b.y + texture2D(t,p.xy*s).rgb*b.z;
  }
  float shade(vec3 n){ float d=dot(normalize(n), normalize(vec3(${SUN.x.toFixed(3)},${SUN.y.toFixed(3)},${SUN.z.toFixed(3)}))); return 0.84 + 0.2*clamp(d,-0.3,1.0); }
`;

// 石青、石绿、赭石：从 IMG_1266 原图高清局部逐块取色（绢本旧色，不提纯）
const COLORS = /* glsl */`
  const vec3 OCHRE = vec3(.69,.62,.49);
  const vec3 OCHRE_D = vec3(.50,.43,.33);
  const vec3 GREEN = vec3(.46,.52,.42);
  const vec3 GREEN_L = vec3(.58,.62,.52);
  const vec3 GREEN_D = vec3(.33,.36,.27);
  const vec3 BLUE = vec3(.31,.47,.68);
  const vec3 BLUE_D = vec3(.24,.36,.55);
  const vec3 BLUE_L = vec3(.49,.61,.74);
  const vec3 MOSS = vec3(.22,.22,.17);
  const vec3 INK = vec3(.24,.22,.18);
`;
// 披麻皴：沿坡面下坡方向的长墨线；苔点：成簇的墨点。地形和山石共用
const CUN = /* glsl */`
  float hemp(vec3 w, vec3 n, float dens){
    vec2 dn = n.xz; float sl = length(dn); if(sl<.08) return 0.;
    dn/=sl; vec2 pp=vec2(-dn.y, dn.x);
    float u = dot(w.xz, pp)*dens + vnoise(w.xz*.18)*2.2 + w.y*.15;
    float v = dot(w.xz, dn) - w.y*.6;
    float f = fract(u); float id=floor(u);
    float line = smoothstep(.08,.0,abs(f-.5)-.02) * smoothstep(.45,.12,fwidth(u));
    float seg = smoothstep(.5,.72, vnoise(vec2(v*.16+id*7.1, id*3.3)));
    float keep = step(.45, hash12(vec2(id, 9.)));
    return line*seg*keep*smoothstep(.08,.3,sl);
  }
  // v33（Yang：地面、山体上一批像麻子的黑圆点，看着不舒服）：圆苔点全部停用，各处调用保留，返回 0
  float mossDots(vec2 p, float scale){ return 0.; }
  // 苔点按主法线方向取投影面，陡坡上不会被拉成竖道
  float mossDots3(vec3 w, vec3 n, float scale){
    vec3 a=abs(n);
    if(a.y>.75) return mossDots(w.xz, scale);
    vec2 hz=normalize(n.xz+vec2(1e-4)); return mossDots(vec2(dot(w.xz, vec2(-hz.y,hz.x)), w.y + dot(w.xz,hz)*a.y), scale);
  }
`;

export function loadTex(url, repeat = true) {
  const t = new THREE.TextureLoader().load(url);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// ---------- 地形 ----------
export function terrainMaterial(tSlope, tRock, lobes = []) {
  const L4 = [0, 1, 2].map((i) => lobes[i] ? new THREE.Vector4(lobes[i].x, lobes[i].z, lobes[i].r, i) : new THREE.Vector4(1e5, 1e5, 1, i));
  return new THREE.ShaderMaterial({
    uniforms: { tSlope: { value: tSlope }, tRock: { value: tRock }, lobes: { value: L4 } },
    vertexShader: /* glsl */`
      attribute float aRel; attribute float aPath; attribute float aCrest; attribute float aCrestL; attribute float aMound; attribute float aLawn; attribute float aRiser; attribute float aGorge;
      varying vec3 vW; varying vec3 vN; varying float vRel; varying float vPath; varying float vCr; varying float vCrL; varying float vMd; varying float vLawn; varying float vRiser; varying float vGorge;
      void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normal; vRel=aRel; vPath=aPath; vCr=aCrest; vCrL=aCrestL; vMd=aMound; vLawn=aLawn; vRiser=aRiser; vGorge=aGorge; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tSlope, tRock; uniform vec4 lobes[3];
      varying vec3 vW; varying vec3 vN; varying float vRel; varying float vPath; varying float vCr; varying float vCrL; varying float vMd; varying float vLawn; varying float vRiser; varying float vGorge;
      ${COMMON}${COLORS}${CUN}
      void main(){
        vec3 n=normalize(vN); float up=n.y;
        float n1=vnoise(vW.xz*.045), n2=vnoise(vW.xz*.21+3.), n3=vnoise(vW.xz*.9), n4=vnoise(vW.xz*.012+7.);
        float lit = clamp(dot(n, normalize(vec3(-.45,.8,.4))), 0., 1.);
        float cr = clamp(vCr/2.2, -1., 1.), crL = clamp(vCrL/6., -1., 1.);
        float hill = smoothstep(3., 16., vRel);   // 离游线越高越是山体
        // 地面：赭黄打底，向阳面浅、背阴面深；低处、水边成片的青灰绿
        vec3 col = mix(OCHRE_D, OCHRE, clamp(.35 + lit*.55 + (n2-.5)*.5, 0., 1.));
        float g = smoothstep(.25,.65, n1*.7 + n4*.5 - vRel/40. + (1.-up)*.2);
        col = mix(col, mix(GREEN, GREEN_L, n2), g*.85*(1.-hill*.6));
        // 山体（对照原画玉女潭后山）：山脚赭石，往上转成淡石绿灰，只在最高的几个山头罩石青
        float lift = clamp(lit*1.1 + (n2-.5)*.3, 0., 1.);
        vec3 teal = mix(vec3(.41,.49,.48), vec3(.57,.64,.61), lift);
        teal = mix(teal, mix(vec3(.38,.49,.55), vec3(.5,.6,.65), lift), smoothstep(.15,.6,crL)*.55);   // 近山头处偏青
        float body = smoothstep(2., 11., vRel + crL*2.5 + (n1-.5)*5.) * hill;
        col = mix(col, teal, body*.92);
        // 沟：凹处压暗、带赭，像原画顺坡的一道道沟
        float gully = smoothstep(.05, -.75, cr + (n3-.5)*.2) * smoothstep(1., 6., vRel);
        col = mix(col, col*vec3(.8,.78,.74), gully*.55);
        col = mix(col, mix(OCHRE_D, OCHRE, lit*.8), gully*(1.-body*.5)*.45);
        vec3 blue = mix(BLUE_D, mix(BLUE, BLUE_L, smoothstep(.55,.9,n2)*.6), clamp(lit*1.1 + (n3-.5)*.3, 0., 1.));
        float rim = smoothstep(.5, .85, crL + cr*.25 + (n2-.5)*.35) * smoothstep(7., 14., vRel);
        float c2 = smoothstep(-34.,-42.,vW.x)*smoothstep(-206.,-196.,vW.x); // 第二章（IMG_1265–1263）的山是石绿坡，山头少罩石青
        // v36 磐玉隈右边的松坡（x −46..0 已归第二章的地形 grove7）：镜头在第二章时也按石绿坡上色，不罩石青；在第一章看过去照旧
        float g7 = smoothstep(-50.,-42.,vW.x)*smoothstep(4.,-6.,vW.x)*smoothstep(-20.,-27.,vW.z)*smoothstep(-70.,-60.,vW.z)*smoothstep(-30.,-42.,cameraPosition.x);
        rim *= 1. - .72*max(c2, g7);
        rim *= 1. - .85*smoothstep(203., 210., vW.x)*smoothstep(244., 238., vW.x); // 大觀廊左坡（原画 IMG_1270）是石绿坡，不罩石青
        // v44 玉女潭后面的远山（原画 IMG_1266 画顶那几道山）：淡赭绿、向阳面泛黄，几处偏石绿，只有零星山头一块石青
        float far8 = smoothstep(-72.,-100.,vW.z)*smoothstep(-6.,10.,vW.x)*smoothstep(200.,180.,vW.x);
        vec3 khaki = mix(vec3(.6,.57,.42), vec3(.81,.76,.57), clamp(lit*1.05 + (n2-.5)*.35, 0., 1.));
        khaki = mix(khaki, mix(vec3(.5,.57,.45), vec3(.67,.72,.56), clamp(lit*1.05, 0., 1.)), smoothstep(.45,.8,n1)*.6);
        khaki = mix(khaki, mix(OCHRE_D, OCHRE, lit*.8), gully*.5);
        col = mix(col, khaki, far8*.88*smoothstep(1.,8.,vRel));
        rim *= 1. - .75*far8*(1. - smoothstep(.6,.78,n4));
        // v46 卷尾（IMG_1260、1258）：近处石绿坡，往后是一层层淡赭的远坡（原画上缘），山头不罩石青
        float c4 = smoothstep(-284.,-292.,vW.x), far4 = c4*max(smoothstep(-24.,-44.,vW.z), smoothstep(9.,14.,vRel)*smoothstep(-14.,-22.,vW.z));
        col = mix(col, khaki, far4*.85*smoothstep(1.,6.,vRel));
        rim *= 1. - .85*c4;
        // 中景的山（水犀洞左边山梁、四陽洞后面的圆山）：原画是淡石绿，偏青，向阳面发白
        vec3 cel = mix(vec3(.46,.56,.55), vec3(.68,.75,.68), clamp(lit*1.05 + (n2-.5)*.3, 0., 1.));
        col = mix(col, cel, c4*(1. - far4)*smoothstep(1.5,5.,vRel)*smoothstep(-6.,-13.,vW.z)*.8);
        col = mix(col, blue, rim*.88);
        // 第一章前景（原画 IMG_1271–1267 下缘）：地面是石绿草坡，零星露赭土；坡包身子灰绿，包头罩淡石青，坡脚一圈赭边
        {
          float apr = clamp(-vLawn, 0., 1.);   // 金晶巖洞前土坪（aLawn 取负）
          float lawn = clamp(vLawn, 0., 1.) * (1. - body*.75*(1. - c2*.65)) * (1. - rim);
          vec3 lawnC = mix(vec3(.41,.49,.39), vec3(.55,.62,.49), clamp(lit*.95 + (n2-.5)*.6, 0., 1.));
          lawnC = mix(lawnC, vec3(.45,.55,.52), smoothstep(.45,.8,n1)*.4);                 // 偏青的一片片
          float bare = smoothstep(.7,.86, n4*.55 + n1*.55 + (n3-.5)*.2 - .05);             // 零星裸露的赭土
          col = mix(col, lawnC, lawn*.9*(1. - bare*.6));
          float md = vMd;
          vec3 mBody = mix(vec3(.38,.47,.37), vec3(.53,.61,.47), lift);
          vec3 mTop = mix(vec3(.31,.45,.49), vec3(.46,.59,.6), lift);
          col = mix(col, mBody, smoothstep(.06,.3,md)*.92);
          col = mix(col, mTop, smoothstep(.5,.95, md + cr*.35 + (n2-.5)*.3)*.75);
          float foot = smoothstep(.0,.06,md)*smoothstep(.28,.08,md) + gully*smoothstep(.1,.3,md)*.5;
          col = mix(col, mix(OCHRE_D, OCHRE, lit*.8 + n3*.2), foot*.5);
          // 土坪：赭黄，顺着往下的方向一道道浅褐的流纹（原画洞前的土坪和土路）
          vec3 earth = mix(vec3(.56,.48,.34), vec3(.7,.62,.45), clamp(lit*.8 + (n2-.5)*.5, 0., 1.));
          float fl = vW.x*.45 + vnoise(vW.xz*vec2(.1,.06))*3.5 + vnoise(vW.xz*.4)*.6; float flw = fwidth(fl);
          float streak = (1. - smoothstep(.04 + flw*.6, .1 + flw, abs(fract(fl) - .5))) * smoothstep(.35,.6, vnoise(vec2(floor(fl)*1.3, vW.z*.12)));
          earth = mix(earth, earth*.8, streak*.4);
          earth = mix(earth, earth*.84 + INK*.05, smoothstep(.45, .3, apr)*smoothstep(.15, .3, apr)); // 土坪边一圈深一点的轮廓
          col = mix(col, earth, apr*.92);
        }
        // 超然亭一带（v32，Yang：地面要有风化、错落和层次）：台坎的陡面露出风化的赭土，顺坡一道道细流纹；台面仍是石绿
        float s5 = smoothstep(-204.,-198.,vW.x)*smoothstep(-129.,-135.,vW.x)*smoothstep(18.,12.,vW.z)*smoothstep(-50.,-44.,vW.z)*(1.-vPath);
        float stp = 1. - up;
        float steep5 = smoothstep(.35, .8, vRiser + (n3-.5)*.2) * smoothstep(.12, .35, stp) * s5;   // 只在台坎的陡面（细网格算好的 aRiser），台面仍是石绿
        {
          vec3 earthW = mix(vec3(.47,.4,.29), vec3(.64,.55,.4), clamp(lit*.9 + (n2-.5)*.5, 0., 1.));
          float fl5 = vW.x*1.7 + vW.z*.3 + vnoise(vW.xz*vec2(.3,.07))*3.; float fw5 = fwidth(fl5);
          float str5 = (1. - smoothstep(.05 + fw5*.6, .14 + fw5, abs(fract(fl5) - .5))) * smoothstep(.3,.6, vnoise(vec2(floor(fl5)*1.7, vW.y*.45)));
          earthW = mix(earthW, earthW*.82, str5*.25);
          col = mix(col, earthW, steep5*.6);
        }
        // v35 琪樹峡峡里（IMG_1264）：石缝间是赭褐的土，不露草绿；背光深、向阳浅，夹几片橄榄绿
        {
          float gz = max(vGorge, 0.);
          vec3 gE = mix(vec3(.34,.26,.17), vec3(.53,.42,.28), clamp(.2 + lit*.65 + (n2 - .5)*.45, 0., 1.));
          gE = mix(gE, mix(vec3(.37,.4,.28), vec3(.5,.52,.37), lit), smoothstep(.55, .85, n3*.6 + n1*.5)*.4);
          // v36 磐玉隈圆包脚的土崖：竖着几道淡墨皴（原画土崖是一道道竖纹）
          float vc = vW.x*1.3 + vnoise(vW.xz*vec2(.25,.6) + vW.y*.2)*2.2; float vcw = fwidth(vc);
          float vstr = (1. - smoothstep(.05 + vcw*.6, .16 + vcw, abs(fract(vc) - .5))) * smoothstep(.35, .65, vnoise(vec2(floor(vc)*1.9, vW.y*.3)));
          float d7 = smoothstep(-97., -94., vW.x)*smoothstep(-58., -62., vW.x);
          gE = mix(gE, gE*vec3(.72,.66,.6), d7*.8); // 圆包脚的土崖、凹岩里的地：比峡里的土更深更褐（原画）
          gE = mix(gE, gE*.66, vstr*.6*smoothstep(-96., -92., vW.x)*smoothstep(-66., -70., vW.x));
          col = mix(col, gE, gz*.92*(1. - rim*.5));
          // v36 圆包上半一片深绿草：细密的短草笔，顺坡往下
          float dgv = max(-vGorge, 0.), dg = smoothstep(.32, .95, dgv);
          // 圆包身子：原画是匀净的石绿，向阳浅、背阴深
          vec3 dB = mix(vec3(.33,.47,.36), vec3(.46,.59,.43), clamp(lit*1.05 + (n2 - .5)*.35, 0., 1.));
          col = mix(col, dB, smoothstep(.03, .28, dgv)*.8*(1. - rim*.5));
          vec3 dG = mix(vec3(.08,.17,.12), vec3(.17,.3,.21), clamp(lit*.9 + (n2 - .5)*.5, 0., 1.));
          float gl = vW.x*2.6 + vnoise(vW.xz*vec2(.5,.2))*2.5; float glw = fwidth(gl);
          float gstr = (1. - smoothstep(.06 + glw*.6, .2 + glw, abs(fract(gl) - .5))) * smoothstep(.3, .6, vnoise(vec2(floor(gl)*1.3, vW.y*1.4 + vW.z*.5)));
          dG = mix(dG, dG*1.28, gstr*.5*smoothstep(.6, .2, glw));
          col = mix(col, dG, dg*.85*(1. - rim*.5));
        }
        // 原画笔触作明暗
        float dS = lum(tri(tSlope, vW, n, .045)) - .45;
        float dR = lum(tri(tRock, vW, n, .07)) - .5;
        col *= 1. + mix(dS*.45, dR*.55, max(rim, body*.4));
        // 披麻皴：顺坡的长条淡墨线，远处渐隐
        float hp = hemp(vW, n, .26) * smoothstep(.45,.75,vnoise(vW.xz*.05+vW.y*.04)) * (1.-vPath) * min(1., .3 + body*.7 + s5*.5) * (1.-rim*.7); // v32 超然亭一带皴线加重
        col = mix(col, col*.62 + INK*.12, hp*.55);
        // 玉女潭三座团山：披麻皴从山头放射、顺坡而下，长而微曲（原画后山）
        float hpL = 0.;
        for (int i = 0; i < 3; i++) {
          vec4 L = lobes[i]; vec2 d = vW.xz - L.xy; float rho = length(d) / L.z;
          if (rho < 1.5) {
            float th = atan(d.y, d.x) + (vnoise(vW.xz*.07 + L.w*5.) - .5)*.55 + (vnoise(vW.xz*.22 + 9.) - .5)*.07 + rho*.4;
            float u = th / 6.2832 * 72.; float id = floor(u), f = abs(fract(u) - .5), fw = fwidth(u);
            float w = .035 + .055*hash12(vec2(id, 4.1 + L.w)) + fw*.7;
            float ln = (1. - smoothstep(w*.45, w, f)) * smoothstep(.55, .2, fw);
            ln *= smoothstep(.3, .55, vnoise(vec2(rho*4.5 + id*1.7, id*.37 + L.w)));
            ln *= step(.3, hash12(vec2(id, L.w*13.))) * smoothstep(.12, .3, rho) * smoothstep(1.4, 1., rho);
            hpL = max(hpL, ln);
          }
        }
        col = mix(col, col*.64 + INK*.1, hpL * (.26 + gully*.45 + (1.-lit)*.15) * (1. - rim*.6) * (1.-vPath));
        // 苔点：沿山脊、山头轮廓成串；平地上只零星几簇
        float ndv = abs(dot(n, normalize(cameraPosition - vW)));
        float contour = smoothstep(.32, .08, ndv) * hill;
        float ridge = smoothstep(.45, .85, cr) * smoothstep(1., 8., vRel);
        float zone = max(max(contour, ridge), smoothstep(.72,.9,n2)*.35*(1.-hill));
        zone = max(zone, (smoothstep(.55,.95,vMd + cr*.3) + smoothstep(.32,.1,ndv)*step(.05,vMd))*.8); // 坡包顶和轮廓上成串的苔点
        zone = max(zone, s5*smoothstep(.2,.45,vRiser)*smoothstep(.85,.55,vRiser)*.95); // v32 超然亭一带：台坎边上成串的苔点
        float cl = smoothstep(.45, .7, zone + (vnoise(vW.xz*.35+11.)-.5)*.5);
        float dt = mossDots3(vW, n, 3.4) * cl * (1.-vPath);
        col = mix(col, MOSS, dt*.85);
        // 游线：浅赭小径
        col = mix(col, mix(vec3(.78,.69,.53), vec3(.63,.53,.38), max(vGorge, 0.)*.75)*(0.92+n3*.12), vPath*.85); // v35 琪樹峡里游线就是石阶，路面跟着土色深下去
        gl_FragColor = vec4(col*shade(n), 1.);
      }`,
  });
}

// ---------- 山石（巨岩、主峰、石块）：顶石青，脚赭石 ----------
export function rockMaterial(tRock, tCliff, { crest = false, niche = false, jade = false, cave = false, grey = false, paint = false } = {}) {
  return new THREE.ShaderMaterial({
    defines: Object.assign(crest ? { CREST: 1 } : {}, niche || cave ? { NICHE: 1 } : {}, jade ? { JADE: 1 } : {}, cave ? { CAVE: 1 } : {}, grey ? { GREY: 1 } : {}, paint ? { PAINT: 1 } : {}),
    uniforms: { tRock: { value: tRock }, tCliff: { value: tCliff } },
    vertexShader: /* glsl */`
      attribute float aH; varying vec3 vW; varying vec3 vN; varying float vH;
      #if defined(NICHE) || defined(JADE) || defined(PAINT)
        attribute float aM; varying float vM;
      #endif
      #ifdef PAINT
        attribute float aO; varying float vO;
      #endif
      void main(){ mat4 m=modelMatrix;
        #if defined(NICHE) || defined(JADE) || defined(PAINT)
          vM=aM;
        #endif
        #ifdef PAINT
          vO=aO;
        #endif
        #ifdef USE_INSTANCING
          m = m*instanceMatrix;
        #endif
        vec4 w=m*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(m)*normal); vH=aH; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tRock, tCliff; varying vec3 vW; varying vec3 vN; varying float vH;
      #ifdef PAINT
        varying float vO;
      #endif
      #if defined(NICHE) || defined(JADE) || defined(PAINT)
        varying float vM;
      #endif
      ${COMMON}${COLORS}${CUN}
      void main(){
        vec3 n=normalize(vN); float up=n.y; float nn=vnoise(vW.xz*.3+vW.y*.2), n2=vnoise(vW.xz*1.3+vW.y*.9);
        float lit = clamp(dot(n, normalize(vec3(-.45,.8,.4))), 0., 1.);
        #ifdef CREST
          // 山头石青团块：通体石青，下沿收成山体的灰绿，不带赭石脚
          float top = smoothstep(-.1,.75, vH + up*.35 + (nn-.5)*.4);
          vec3 foot = mix(vec3(.38,.47,.5), vec3(.5,.58,.6), lit*.7 + n2*.3);
        #else
          float top = smoothstep(.2,.7, vH + up*.4 + (nn-.5)*.45);
          vec3 foot = mix(OCHRE_D, OCHRE, lit*.7 + n2*.3);
        #endif
        #ifdef NICHE
          top *= 1. - min(vM, 1.);
        #endif
        vec3 blue = mix(BLUE_D, mix(BLUE, BLUE_L, nn*.5+lit*.3), clamp(lit*1.2 + up*.3, 0., 1.));
        #ifdef JADE
          // 隐春巖一类的大石壁（原画 IMG_1271 右半）：通体淡灰绿，背光处偏青，脚下土黄而不是赭红
          blue = mix(mix(vec3(.41,.5,.5), vec3(.59,.66,.6), clamp(lit*1.1 + nn*.25, 0., 1.)), vec3(.43,.55,.58), smoothstep(.5,.15,lit)*.4);
          foot = mix(vec3(.5,.48,.39), vec3(.63,.6,.49), lit*.7 + n2*.3);
        #endif
        #ifdef GREY
          // v34 琪樹峡峡心几块大方石（原画 IMG_1264）：灰白偏暖，不上石青
          blue = mix(vec3(.38,.41,.39), vec3(.6,.62,.57), clamp(lit*1.1 + nn*.25, 0., 1.));
          foot = mix(vec3(.44,.42,.35), vec3(.56,.54,.45), lit*.7 + n2*.3);
        #endif
        #ifdef PAINT
          // v35 琪樹峡的石（IMG_1264）：顶上浅石青、往下渐深，脚下一圈赭土；石面是一片晕染
          top = smoothstep(.06, .46, vH + up*.2 + (nn - .5)*.25);
          blue = mix(vec3(.19,.26,.42), vec3(.27,.39,.6), clamp(lit*1.15 + nn*.2 - .1, 0., 1.));
          blue = mix(blue, vec3(.4,.52,.7), smoothstep(.5, .95, up)*smoothstep(.45, .9, vH)*.6);
          blue = mix(blue, vec3(.3,.45,.7), smoothstep(.55, 1., vH)*(1. - smoothstep(.5, .95, up))*.35); // v37 原画每块石头上半一抹亮石青，往下渐深
          blue = mix(blue, mix(vec3(.22,.28,.38), vec3(.34,.41,.53), lit), smoothstep(.5, .12, vH)*.4); // v37 下半渐成青灰，再往下才透赭
          foot = mix(vec3(.4,.34,.25), vec3(.55,.47,.34), lit*.6 + n2*.4);
          // 一块块石头的色调不一：多半是石青，几块青灰，几块灰赭（vM 是每块石头的随机数）
          float bl = clamp(lit*1.1 + nn*.25, 0., 1.);
          vec3 bG = mix(vec3(.26,.31,.36), vec3(.45,.5,.53), bl), bO = mix(vec3(.34,.34,.3), vec3(.55,.54,.46), bl);
          blue = mix(blue, bG, smoothstep(.6, .68, vM)*.85);
          blue = mix(blue, bO, smoothstep(.86, .92, vM)*.8);
          // v36 磐玉隈大石板（vM≈.72，只在 x > -75）：原画是偏暖的浅灰，板脚透赭
          vec3 bS = mix(vec3(.38,.39,.36), vec3(.6,.6,.54), bl);
          blue = mix(blue, bS, smoothstep(.69, .71, vM)*smoothstep(.81, .79, vM)*smoothstep(-77., -74., vW.x)*.9);
          // v46 卷尾（IMG_1260 水犀洞、1258 四陽洞）：山石是淡石绿灰（vM≈.78），向阳面泛浅，背面、脚下透赭
          vec3 bC = mix(mix(vec3(.42,.47,.41), vec3(.66,.69,.58), bl), vec3(.56,.5,.38), smoothstep(.35, .05, vH)*.55 + smoothstep(.1, .7, n.x)*.5);
          blue = mix(blue, bC, smoothstep(.76, .77, vM)*smoothstep(.8, .79, vM)*smoothstep(-284., -290., vW.x));
          blue = mix(blue, mix(vec3(.47,.36,.25), vec3(.75,.62,.45), bl), smoothstep(.815, .825, vM)*smoothstep(.845, .835, vM)*smoothstep(-284., -290., vW.x)); // 四陽洞的暖赭岩脚（vM≈.83）
        #endif
        #if !defined(JADE) && !defined(CREST)
          // 金晶巖一带（IMG_1271）的石头是灰青色，不是亮石青
          float qk = smoothstep(266., 276., vW.x) * smoothstep(352., 340., vW.x);
          blue = mix(blue, mix(vec3(.31,.4,.42), vec3(.5,.58,.57), clamp(lit*1.1 + nn*.25, 0., 1.)), qk*.8);
        #endif
        vec3 col = mix(foot, blue, top);
        col = mix(col, GREEN, smoothstep(.8,.97,up)*.25);
        float d = lum(tri(tRock, vW, n, .09)) - .5;
        #if defined(PAINT) || defined(GREY)
          d *= .35; // 琪樹峡的石面近乎平涂，不要斑驳的深点
        #endif
        col *= 1. + d*.45;
        // 斧劈/披麻皴：石面上短而密的墨线
        // 石面晕染：大块的深浅变化代替线条，凹处略深
        float wash = vnoise(vW.xz*.18+vW.y*.21) * .6 + vnoise(vW.xz*.55-vW.y*.4) * .4;
        col *= .86 + .26*wash;
        col = mix(col, col*.78, smoothstep(.2,-.4,dot(n, normalize(vec3(-.45,.8,.4))))*.5);
        // 石面皴线：顺着石形一圈圈的断续墨线（原画石青石上的卷云皴）
        float su = vH*9. + (vnoise(vW.xz*.5 + vW.y*.3) - .5)*1.6;
        float sf = abs(fract(su) - .5), sfw = fwidth(su);
        float sl = (1. - smoothstep(.05 + sfw*.5, .09 + sfw, sf)) * smoothstep(.5, .15, sfw);
        sl *= smoothstep(.35, .6, vnoise(vec2(vW.x*.4 + vW.z*.3, floor(su)*3.7)));
        #ifdef NICHE
          sl *= 1. - smoothstep(.05, .3, min(vM, 1.)); // 摩崖龛内凿平了，不画层理
        #endif
        #ifdef JADE
          // 隐春巖：不画一圈圈的卷云皴，改成顺坡往下的披麻皴短线，坎沿（vM≈1）勾一道墨线，坎面上长苔
          sl = 0.;
          float steep = 1. - smoothstep(.45, .8, up);
          vec2 hz = normalize(vec2(n.z, -n.x) + 1e-4);
          float hp = dot(vW.xz, hz);
          float hemp = smoothstep(.62, .9, vnoise(vec2(hp*2.2, vW.y*.22 + vnoise(vec2(hp*.3, vW.y*.05))*2.)));
          col = mix(col, col*.68, hemp*steep*.55);
          #ifndef NICHE
          float lip = smoothstep(.86, .97, vM) * smoothstep(.25, .6, vnoise(vec2(hp*.7, vW.y*.3)) + .3);
          col = mix(col, INK*.9 + col*.25, lip*.6);
          col = mix(col, col*.8, smoothstep(.2, -.6, vM)*steep*.5); // 坎下的立面背光
          #else
          // 金晶巖洞檐：每道石棱的上下沿勾墨线，棱下沿背光
          if (abs(vM - .02) < .01) {
            float rb = fract(vH * 6. + .001), rw = fwidth(vH * 6.);
            float rl = 1. - smoothstep(rw * .8, rw * 1.8 + .05, min(rb, 1. - rb));
            col = mix(col, INK*.9 + col*.2, rl * .75);
            col *= .82 + .3 * smoothstep(.1, .7, rb);
          }
          #endif
          float shelf = smoothstep(.55, .8, up);
          col = mix(col, mix(col, GREEN, .45), shelf*.6);
          col = mix(col, MOSS, mossDots3(vW, n, 3.0) * shelf * smoothstep(.4, .6, vnoise(vW.xz*.5+vW.y)) * .8);
          #ifndef NICHE
          {
            // v35 圆山（縹緲亭）前脚 x < -70：原画 1264 右下、1265 左边都是一道土崖——顶上接绿坡，崖面赭褐、竖着几道深褐的皴，斑驳青苔
            float ea = smoothstep(-69., -74., vW.x + (vnoise(vW.xz*.2) - .5)*3.);
            if (ea > 0.) {
              vec3 earth = mix(vec3(.36,.28,.19), vec3(.52,.42,.3), clamp(.3 + lit*.45 + n2*.3, 0., 1.));
              earth = mix(earth*.72, earth, smoothstep(.02, .45, vH)); // 崖脚深、崖头浅
              float vs = smoothstep(.55, .9, vnoise(vec2(hp*.9, vW.y*.1 + vnoise(vec2(hp*.3, vW.y*.04))*1.5)));
              earth *= 1. - .2*vs;
              earth = mix(earth, earth*.75 + GREEN*.25, smoothstep(.35, .85, vnoise(vW.xz*.35 + vW.y*.28))*.55);
              vec3 grass = mix(GREEN_D*1.05, GREEN_L, clamp(lit*.8 + nn*.3, 0., 1.));
              vec3 ec = mix(earth, grass, smoothstep(.4, .85, up + (nn - .5)*.25));
              ec = mix(ec, GREEN_D*.8, smoothstep(.38, .55, up)*smoothstep(.75, .58, up)*.55); // 崖顶一道深绿的草沿
              col = mix(col, ec, ea);
            }
          }
          #endif
        #endif
        #if defined(PAINT) || defined(GREY)
        {
          // 不画一圈圈的层理，壁上只有几道淡淡的竖皴（原画琪樹峡的石头面上几乎是平涂的）
          sl = 0.;
          float steep = 1. - smoothstep(.45, .8, up);
          vec2 hz = normalize(vec2(n.z, -n.x) + 1e-4); float hp = dot(vW.xz, hz);
          float hemp = smoothstep(.66, .93, vnoise(vec2(hp*3.,  vW.y*.32 + vnoise(vec2(hp*.5, vW.y*.1))*2.)));
          float hk = .35;
          #ifdef PAINT
            hk += .35*smoothstep(.765, .77, vM)*smoothstep(.85, .84, vM)*smoothstep(-286., -292., vW.x); // v47 卷尾的山石皴线重一些（原画水犀洞峰上满是竖皴）
          #endif
          col = mix(col, col*.76, hemp*steep*hk);
        }
        #endif
        #ifdef PAINT
          // v37 嶙峋石：块与块相挤的石缝、着地一圈压深透赭（原画石缝里是赭褐，勾线就落在这里）
          {
            float ov = smoothstep(.04, .55, vO), lo = smoothstep(.45, .12, vH);
            vec3 cc = mix(col*.5 + INK*.12, foot*.62, lo); // 高处的石缝是深石青，低处透赭
            col = mix(col, cc, ov*.62);
            // 缝沿一道断续的淡墨线（沿遮蔽的等值线走，所以是顺着石缝的线，不是点）
            float fw = fwidth(vO) + 1e-4, ln = 1. - smoothstep(fw*.6, fw*1.8, abs(vO - .3));
            ln *= smoothstep(.3, .6, vnoise(vW.xz*1.3 + vW.y*.9)) * (1. - lo*.6);
            col = mix(col, INK*.9 + col*.2, ln*.45);
          }
        #endif
        #ifdef PAINT
        {
          // v36 磐玉隈（IMG_1265）：巨石（vM≈.95）一层层往右下斜的石缝，缝边一圈赭褐；大石板（≈.72）几道顺坡的长裂纹；青灰石壁（≈.66）几道弯弯的竖缝
          float s7 = smoothstep(-75.,-72.,vW.x)*smoothstep(-12.,-16.,vW.x)*smoothstep(-11.,-14.,vW.z);
          if (s7 > 0. && vM > .6) {
            float bo = step(.85, vM), sb = step(.69, vM)*(1. - bo), wl = 1. - bo - sb;
            float dip = bo*.5 + sb*1.05 - wl*2.6, fq = bo*.62 + sb*.38 + wl*.28;
            float cu = (vW.y + vW.x*dip)*fq/sqrt(1. + dip*dip*.5) + (vnoise(vW.xz*.3 + vW.y*.17) - .5)*(.9 + wl*.8);
            float cw = fwidth(cu), cd = min(fract(cu), 1. - fract(cu));
            float ln = (1. - smoothstep(.025 + cw*.6, .06 + cw*1.2, cd)) * smoothstep(.6, .25, cw);
            ln *= smoothstep(.3, .58, vnoise(vec2(floor(cu)*2.3 + 1.7, (vW.x - vW.y*dip)*.22 + vW.z*.15)));
            float halo = (1. - smoothstep(.04, .2, cd)) * smoothstep(.3, .58, vnoise(vec2(floor(cu)*2.3 + 1.7, (vW.x - vW.y*dip)*.22 + vW.z*.15)));
            col = mix(col, col*vec3(.78,.7,.58), halo*(.45*bo + .25*sb + .2*wl)*s7);
            col = mix(col, INK*.8 + col*.3, ln*(.75*bo + .55*sb + .5*wl)*s7);
            // 巨石：再几道短的竖裂，把一层层石坎切成一块块
            float cv = vW.x*.55 + vW.z*.2 + (vnoise(vec2(vW.y*.4, vW.x*.2)) - .5)*1.4, cvw = fwidth(cv), cvd = min(fract(cv), 1. - fract(cv));
            float lv = (1. - smoothstep(.02 + cvw*.6, .05 + cvw*1.2, cvd)) * smoothstep(.55, .75, vnoise(vec2(floor(cv)*3.1, vW.y*.5))) * smoothstep(.6, .25, cvw);
            col = mix(col, INK*.8 + col*.3, lv*.6*bo*s7*(1. - smoothstep(.6, .9, up)));
            col *= 1. - .12*bo*s7; // 巨石整体压暗一点（原画是灰赭，不是浅灰）
          }
        }
        #endif
        col = mix(col, col*.55, sl*.55);
        // 石缘苔点
        float band = smoothstep(.5,.7,vH+up*.2)*smoothstep(.25,.55,up);
        float dt = mossDots3(vW, n, 3.4) * band * smoothstep(.45,.65,vnoise(vW.xz*.6+vW.y));
        col = mix(col, MOSS, dt*.85);
        #if defined(NICHE) && !defined(CAVE)
          col *= 1. - .28*min(vM, 1.) - .4*clamp(vM - 1., 0., 1.); // 摩崖龛内背光，比崖面暗一层；岩洞（vM>1）越往里越暗
        #endif
        #ifdef CAVE
        {
          // 金晶巖（原画 IMG_1271）：洞檐一道道橄榄土黄的石檐，檐下沿浅土黄、挂一排乳石，檐顶转石绿；
          // 洞里是褐色，比檐面只暗一点，洞壁上几道横的层理；洞底浅橄榄黄的平地。aM：0 岩壳/檐顶，.02 檐面，.35 乳石，1–2 洞内（越大越深）
          float tone = clamp(lit*1.1 + (nn - .5)*.4, 0., 1.);
          vec3 olive = mix(vec3(.43,.43,.32), vec3(.6,.6,.46), tone);
          vec3 khaki = mix(vec3(.58,.52,.38), vec3(.74,.67,.5), tone);
          vec3 green = mix(vec3(.38,.46,.36), vec3(.54,.61,.48), tone);
          vec2 hz = normalize(vec2(n.z, -n.x) + 1e-4); float hp = dot(vW.xz, hz);
          float hemp = smoothstep(.6, .9, vnoise(vec2(hp*2.4, vW.y*.25 + vnoise(vec2(hp*.3, vW.y*.06))*2.)));
          if (vM < .01) {
            // 岩壳：台阶的立面土黄，檐顶和山包往上转石绿，坡上披麻短线和苔点
            col = mix(olive, green, smoothstep(.35, .8, up + (vH - .6)*.6 + (n2 - .5)*.3));
            col = mix(col, col*.7, hemp*(1. - smoothstep(.5, .85, up))*.5);
            col = mix(col, MOSS, mossDots3(vW, n, 3.2) * smoothstep(.55, .8, up) * smoothstep(.4, .62, vnoise(vW.xz*.5 + vW.y)) * .85);
          } else if (vM > .025 && vM < .1) {
            col = mix(khaki, olive, .4) * .8;  // 檐底：往里收的一窄条，背光
          } else if (vM < .1) {
            // 檐面：rb 从檐下沿（0）到檐顶（1）。下沿浅土黄、勾一道墨线，往上转橄榄绿，檐顶下压暗
            float rb = fract(vH*5. + .001), rw = fwidth(vH*5.);
            col = mix(khaki, olive, smoothstep(.12, .55, rb));
            col = mix(col, mix(olive, green, .55), smoothstep(.55, .95, rb)*.7);
            col = mix(col, col*.66, hemp*.45);
            col = mix(col, INK*.9 + col*.2, (1. - smoothstep(rw*.8, rw*1.8 + .04, rb))*.8);
            col *= .9 + .12*smoothstep(.1, .5, rb) - .14*smoothstep(.8, 1., rb);
            col = mix(col, green, floor(vH*5. + .001)/4.*.45); // 外圈的檐往山包的石绿过渡
          } else if (vM < .5) {
            col = khaki * (1.04 - .2*smoothstep(.0, .25, -n.y));  // 乳石
          } else {
            float deep = clamp(vM - 1., 0., 1.);
            vec3 brown = mix(vec3(.36,.28,.21), vec3(.5,.4,.3), tone);
            if (up > .8) brown = mix(vec3(.5,.45,.32), vec3(.6,.55,.4), tone); // 洞底
            // 洞壁横的层理：一层层向里收的石坎，坎沿深褐
            float sy = (vW.y - 6.4) * .75 + (vnoise(vW.xz*.35 + vW.y*.2) - .5)*.9;
            float sf = fract(sy), sw = fwidth(sy);
            float strata = (1. - smoothstep(sw*.8, sw*1.6 + .06, sf)) * (1. - step(.8, up)) * smoothstep(.3, .55, vnoise(vec2(vW.x*.3, floor(sy)*2.3)));
            brown = mix(brown, brown*.7, smoothstep(.0, .5, sf)*.25*(1. - step(.8, up)));
            brown = mix(brown, INK*.8 + brown*.3, strata*.6);
            col = brown * (1. - .32*deep);
          }
        }
        #endif
        gl_FragColor = vec4(col*shade(n), 1.);
      }`,
  });
}

// ---------- 玉女潭崖壁：直接用原画崖壁的皴法 ----------
export function cliffMaterial(tCliff) {
  return new THREE.ShaderMaterial({
    uniforms: { tCliff: { value: tCliff } },
    side: THREE.DoubleSide,
    vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`uniform sampler2D tCliff; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      ${COMMON}${COLORS}
      void main(){ vec3 c=texture2D(tCliff, vec2(vUv.x, .08+vUv.y*.78)).rgb;
        // 原画照片偏暗偏灰，提一点亮度、往赭石靠；顶上一圈收成石绿苔
        c = mix(c*1.12, OCHRE_D, .18);
        float top = smoothstep(.9,.99, vUv.y + (vnoise(vW.xz*.6)-.5)*.06);
        c = mix(c, mix(BLUE, GREEN, .5), top);
        gl_FragColor=vec4(c*shade(vN*vec3(1.,.4,1.)), 1.); }`,
  });
}

// ---------- 树叶卡片：alpha 测试 + 写深度，不靠排序，所以转镜头不会撕裂 ----------
export function foliageMaterial(map, { a2c = false, tint = 1, cl = false } = {}) {
  const m = new THREE.ShaderMaterial({
    defines: cl ? { LEAF_CL: 1 } : {},
    uniforms: { map: { value: map }, time: { value: 0 }, tint: { value: tint } },
    side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      attribute vec4 aCl; attribute vec3 aPN;
      uniform float time; varying vec2 vUv; varying float vShade; varying vec3 vTint; varying float vFace;
      ${COMMON}
      void main(){ vUv=uv; mat4 m=modelMatrix*instanceMatrix;
        vec4 w=m*vec4(position,1.);
        #ifdef LEAF_CL
          // 风：一片慢慢扫过林子的阵风 × 每个叶团自己的相位；离干越远、越高，动得越多；叶尖再有细碎的颤
          vec3 cw=(m*vec4(aCl.xyz,1.)).xyz; float ph=aCl.w*6.2832;
          float gust=vnoise(cw.xz*.03 - vec2(time*.32, time*.11));
          float g=.25 + .75*gust*gust;
          float reach=clamp(length(aCl.xz)*.22 + max(0.,aCl.y)*.05, 0., 1.);
          vec2 sw=vec2(sin(time*1.3+ph) + .5*sin(time*2.3+ph*1.7), cos(time*1.1+ph*1.3) + .4*sin(time*2.7+ph*.7));
          w.xz += (sw*.05 + vec2(.08,.03)*gust)*g*reach*max(1.,aCl.y*.18);
          w.y += sin(time*1.7+ph*2.1)*.025*g*reach;
          float fl=sin(time*5.3 + dot(position, vec3(3.1,2.3,1.7)) + ph);
          w.xyz += normalize(mat3(m)*aPN)*fl*.05*g;
          vFace=abs(dot(normalize(mat3(m)*aPN), normalize(cameraPosition - w.xyz)));
        #else
          float sway=sin(time*1.1 + w.x*.15 + w.z*.11)*.12*max(0.,position.y);
          w.x+=sway; w.z+=sway*.6; vFace=1.;
        #endif
        vec3 n=normalize(mat3(m)*normal);
        float sun=dot(n, normalize(vec3(-.45,.8,.4)));
        vShade=.8+.22*clamp(sun*.5+.5, 0., 1.);
        #ifdef USE_INSTANCING_COLOR
          vTint=instanceColor;
        #else
          vTint=vec3(1.);
        #endif
        gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`
      uniform sampler2D map; uniform float tint; varying vec2 vUv; varying float vShade; varying vec3 vTint; varying float vFace;
      void main(){ vec4 t=texture2D(map,vUv);
        // 卡片越侧对镜头，留下的叶子越少（只剩最实的几簇），不再露出纸边
        if(t.a < mix(.5, .97, smoothstep(.42, .1, vFace))) discard;
        float l=dot(t.rgb,vec3(.3,.59,.11)); vec3 g=mix(t.rgb, l*vec3(.92,1.,.84), .3); vec3 c=g*vTint*tint*1.08*vShade; gl_FragColor=vec4(c,.5); } // alpha .5 标记为树叶，后处理不在叶隙上勾线`,
  });
  m.alphaToCoverage = a2c;
  return m;
}

// ---------- 平涂材质（建筑、树干、人物）：顶点色 + 两级明暗 ----------
// aKind: 0 平涂, 1 瓦垄, 2 格扇窗, 3 草顶
export function flatMaterial({ instanced = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { highlight: { value: 0 }, time: { value: 0 }, faceMap: { value: BLANK } },
    vertexColors: true,
    vertexShader: /* glsl */`
      attribute float aKind; varying vec3 vC; varying vec3 vN; varying vec2 vUv; varying float vK; varying vec3 vW;
      void main(){ mat4 m=modelMatrix;
        #ifdef USE_INSTANCING
          m=m*instanceMatrix;
        #endif
        vec4 w=m*vec4(position,1.); vW=w.xyz; vC=color; vN=normalize(mat3(m)*normal); vUv=uv; vK=aKind; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`
      uniform float highlight; uniform float time; uniform sampler2D faceMap;
      varying vec3 vC; varying vec3 vN; varying vec2 vUv; varying float vK; varying vec3 vW;
      ${COMMON}
      void main(){ vec3 c=vC; vec3 n=normalize(vN);
        if(vK>7.5){ // 竹竿：一节一节，节上一道墨线，节下一圈粉白
          float y = vW.y*2.1 + vnoise(vW.xz*3.)*3.;
          float f = fract(y);
          c *= .93 + .1*smoothstep(.0,.35,f);
          c = mix(c, vec3(.2,.22,.16), smoothstep(.07,.0,min(f,1.-f))*.75);
        }
        else if(vK>6.5){ c=texture2D(faceMap, vUv).rgb; } // 人物脸：画布上画的墨线五官
        else if(vK>4.5){ // 衣纹：自底摆（或袖口、腰间）而起的长墨线，长短不一，随身形微微摆动
          float N = vK>5.5 ? 6. : 12.;
          float x = vUv.x*N, id = floor(x);
          float off = (hash12(vec2(id, 3.))-.5)*.5 + .2*sin(vUv.y*4.5 + id*1.7);
          float d = abs(fract(x - off) - .5);
          float fw = fwidth(x);
          float w = .035 + .03*(1.-vUv.y) + fw*.8;
          float ln = 1. - smoothstep(w*.55, w, d);
          float top = .3 + .6*hash12(vec2(id, 5.));
          ln *= smoothstep(top, top - .18, vUv.y) * step(.22, hash12(vec2(id, 7.))) * smoothstep(.6, .25, fw);
          c = mix(c, c*.42 + vec3(.04,.035,.03), ln*.8);
        }
        else if(vK>.5 && vK<1.5){ float s=fract(vUv.x*2.6); c*= .82+.18*smoothstep(.0,.25,s)*smoothstep(1.,.6,s); }
        else if(vK>1.5 && vK<2.5){ vec2 g=fract(vUv*vec2(7.,9.)); float l=max(step(.82,g.x),step(.82,g.y)); c=mix(c, vec3(.61,.24,.17), l); }
        else if(vK>2.5 && vK<3.5){ c*= .85+.25*vnoise(vec2(vUv.x*40., vUv.y*6.)); }
        else if(vK>3.5){ // 树皮：竖向皴纹、鳞斑与墨色节疤
          vec2 q=vec2((vW.x-vW.z)*3.2+vnoise(vW.xz*2.)*2., vW.y*.7);
          float st=vnoise(q+vnoise(vec2(vW.y*1.3, vW.x))*1.5);
          // 原画树干：浅赭平涂，几道断续的墨皴和节疤，不是一圈圈木纹
          c*= .92+.16*st;
          float ln=smoothstep(.05,.0,abs(fract(q.x*.9+vnoise(q*vec2(.5,1.5))*1.4)-.5)-.42) * smoothstep(.35,.6,vnoise(q*vec2(.7,.25)+3.));
          c=mix(c, vec3(.24,.2,.15), ln*.5);
          c=mix(c, vec3(.22,.18,.14), smoothstep(.8,.9,vnoise(q*vec2(1.6,2.4)+7.))*.55);
          c=mix(c, c*vec3(1.12,1.05,.9), smoothstep(.6,.9,n.y)*.3);
        }
        float d=dot(n, normalize(vec3(-.45,.8,.4)));
        float s = (vK>6.5 && vK<7.5) ? .95+.05*clamp(d,0.,1.) : (d>.15 ? 1. : .84); // 脸不分阴阳面，和原画一样平涂
        c*=s*(.95+.05*n.y);
        c = mix(c, vec3(.95,.8,.4), highlight*(.16+.06*sin(time*5.)));
        gl_FragColor=vec4(c,1.); }`,
  });
}

// ---------- 水面：浑青的潭水 + 流动的水纹线 + 投石涟漪 ----------
export function waterMaterial({ color = '#7a705a', lines = 1, flow = 0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, base: { value: new THREE.Color(color) }, ripples: { value: Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, -99, 0)) }, flow: { value: flow }, lines: { value: lines } },
    vertexShader: /* glsl */`varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`
      uniform float time, flow, lines; uniform vec3 base; uniform vec4 ripples[4]; varying vec3 vW;
      ${COMMON}
      void main(){
        vec2 p=vW.xz; p.x += time*flow;
        float w = sin(p.y*3.2 + sin(p.x*.55 + time*.5)*1.6 + vnoise(p*.4)*3. + time*.35);
        float l = smoothstep(.93,.99, w) * lines;
        float r=0.;
        for(int i=0;i<4;i++){ vec4 R=ripples[i]; float age=time-R.z; if(age<0.||age>6.) continue;
          float d=length(vW.xz-R.xy); float ring=exp(-pow((d-age*2.2)*2.4,2.)) * (1.-age/6.);
          float ring2=exp(-pow((d-age*1.5)*3.,2.)) * (1.-age/6.);
          r+= max(ring, ring2*.7); }
        vec3 c = base*(.92+.12*vnoise(vW.xz*.15));
        c = mix(c, vec3(.30,.27,.21), clamp(l*.55 + r*.8, 0., 1.));
        gl_FragColor=vec4(c,1.);
      }`,
  });
}

// ---------- 瀑布 ----------
export function fallMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } }, side: THREE.DoubleSide,
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: /* glsl */`uniform float time; varying vec2 vUv; ${COMMON}
      void main(){ float edge=smoothstep(0.,.18,vUv.x)*smoothstep(1.,.82,vUv.x);
        float n=vnoise(vec2(vUv.x*14., vUv.y*3.+time*2.2));
        if(edge*(.6+.6*n)<.45) discard;
        float l=smoothstep(.62,.7,vnoise(vec2(vUv.x*22., vUv.y*1.5+time*2.6)));
        gl_FragColor=vec4(mix(vec3(.9,.88,.8), vec3(.35,.38,.34), l*.7),1.); }`,
  });
}

// ---------- 勾云：Y 轴朝向相机的云片，alpha 测试，边缘会被后处理勾出墨线 ----------
export function cloudMaterial(map) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, time: { value: 0 } }, side: THREE.DoubleSide,
    vertexShader: /* glsl */`uniform float time; varying vec2 vUv;
      void main(){ vUv=uv; vec4 c=modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
        float sx=length(instanceMatrix[0].xyz), sy=length(instanceMatrix[1].xyz);
        c.x += sin(time*.04 + c.z*.1)*3.;
        vec3 right=normalize(vec3(viewMatrix[0][0], 0., viewMatrix[2][0]));
        vec3 w=c.xyz + right*position.x*sx + vec3(0.,1.,0.)*position.y*sy;
        gl_Position=projectionMatrix*viewMatrix*vec4(w,1.); }`,
    fragmentShader: /* glsl */`uniform sampler2D map; varying vec2 vUv;
      void main(){ vec4 t=texture2D(map,vUv); if(t.a<.5) discard; gl_FragColor=vec4(t.rgb,1.); }`,
  });
}

// ---------- 画布笔触贴图 ----------
function canvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; }

// 松针：一簇簇放射状墨线（仿原画松针的“车轮”画法）
export function pineTexture() {
  return canvas(512, 256, (g, w, h) => {
    const R = mulberry(7);
    g.clearRect(0, 0, w, h);
    const blobs = [];
    for (let i = 0; i < 26; i++) blobs.push([60 + R() * 392, 40 + R() * 176 * (0.5 + 0.5 * Math.sin((i / 26) * Math.PI))]);
    for (const [x, y] of blobs) {
      const r = 26 + R() * 16;
      g.fillStyle = `rgba(${52 + R() * 14},${68 + R() * 12},${52 + R() * 10},1)`;
      g.beginPath(); g.ellipse(x, y, r * 1.15, r * 0.62, 0, 0, Math.PI * 2); g.fill();
    }
    g.lineCap = 'round';
    for (const [x, y] of blobs) {
      const r = 30 + R() * 14, n = 34;
      for (let k = 0; k < n; k++) {
        const a = Math.PI * (1.05 + (k / n) * 0.9) + (R() - 0.5) * 0.08;
        g.strokeStyle = `rgba(28,36,28,${0.85})`; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(x, y + r * 0.15); g.lineTo(x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 0.75 + r * 0.15); g.stroke();
        g.strokeStyle = 'rgba(120,150,120,.7)'; g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(x, y + r * 0.2); g.lineTo(x + Math.cos(a) * r * 1.0, y + Math.sin(a) * r * 0.62 + r * 0.2); g.stroke();
      }
    }
  });
}
// 夹叶树冠：照原画一片片勾墨线的叶子，叠成上浅下深、底边平的几层叶团，叶团之间留空
// kind: round 圆叶（夹叶） / point 尖叶（成扇） / dot 点叶（墨点成簇）
export function leafClumpTexture(kind = 'round', seed = 1) {
  // 仿原画夹叶/点叶：叶子成簇（一簇数片自一点散开），簇与簇之间留出绢地，叶团分层成片
  return canvas(512, 512, (g, w, h) => {
    const R = mulberry(seed * 13 + 7);
    const pads = [];
    const np = 3 + Math.floor(R() * 3);
    for (let i = 0; i < np; i++) pads.push({ x: 120 + R() * 272, y: 130 + R() * 230, rx: 80 + R() * 70, ry: 46 + R() * 30 });
    const inPad = (x, y) => { for (const p of pads) { const dx = (x - p.x) / p.rx, dy = (y - p.y) / p.ry; if (dy < 0.7 && dx * dx + dy * dy < 1) return p; } return null; };
    g.lineJoin = 'round'; g.lineCap = 'round';
    const minD = kind === 'dot' ? 32 : kind === 'point' ? 46 : kind === 'feather' ? 50 : 52;
    const cl = [];
    for (let i = 0; i < 3000 && cl.length < 60; i++) {
      const x = 40 + R() * 432, y = 40 + R() * 432, p = inPad(x, y);
      if (p && cl.every((c) => Math.hypot(c.x - x, c.y - y) > minD)) cl.push({ x, y, p, r: R() });
    }
    cl.sort((a, b) => a.y - b.y);
    // 叶色取自原画：墨绿、青绿，上浅下深；整体比山色深，树是画面里最重的墨
    const COLS = [[112, 128, 110], [94, 114, 106], [118, 120, 94], [78, 98, 90], [62, 78, 68]];
    const col = (t, k, d = 0) => { const c = COLS[Math.min(4, Math.floor(t * 2.6 + k * 2.2))]; return `rgb(${c[0] + d},${c[1] + d},${c[2] + d})`; };
    for (const C of cl) {
      const t = Math.min(1, Math.max(0, (C.y - (C.p.y - C.p.ry)) / (C.p.ry * 1.7)));
      const k = C.r;
      g.save(); g.translate(C.x, C.y);
      if (kind === 'round') { // 夹叶：五到七片圆叶自簇心散开，墨线双勾
        const n = 5 + Math.floor(k * 3), len = 42 + k * 14, wd = len * 0.58, tilt = (C.x - C.p.x) / C.p.rx * 0.5;
        const angs = []; for (let j = 0; j < n; j++) angs.push(-Math.PI / 2 + tilt + (j / (n - 1) - 0.5) * 3.6 + (R() - 0.5) * 0.25);
        angs.sort((a, b) => Math.abs(b + Math.PI / 2 - tilt) - Math.abs(a + Math.PI / 2 - tilt)); // 两侧先画，中间压上
        angs.forEach((a, j) => {
          g.save(); g.rotate(a + Math.PI / 2); const L = len * (0.85 + R() * 0.3);
          g.beginPath(); g.moveTo(0, -3); g.bezierCurveTo(wd * 0.8, -L * 0.25, wd * 0.6, -L * 0.9, 0, -L); g.bezierCurveTo(-wd * 0.6, -L * 0.9, -wd * 0.8, -L * 0.25, 0, -3);
          g.fillStyle = col(t, k, (j % 3) * 6 - 6); g.fill(); g.strokeStyle = 'rgba(34,38,30,.9)'; g.lineWidth = 2; g.stroke();
          g.beginPath(); g.moveTo(0, -4); g.lineTo(0, -L * 0.78); g.lineWidth = 0.9; g.strokeStyle = 'rgba(34,38,30,.55)'; g.stroke();
          g.restore();
        });
      } else if (kind === 'feather') { // 羽状复叶：一簇三五条细茎，茎两侧对生小圆叶（原画玉光閣前的大树）
        const n = 3 + Math.floor(k * 3), a0 = -Math.PI / 2 + (C.x - C.p.x) / C.p.rx * 0.5;
        for (let j = 0; j < n; j++) {
          const a = a0 + (j / Math.max(1, n - 1) - 0.5) * 3.2 + (R() - 0.5) * 0.3, L = 46 + R() * 22, bend = (R() - 0.5) * 0.5;
          g.save(); g.rotate(a + Math.PI / 2);
          const np = 5 + Math.floor(R() * 3);
          for (let q = np; q >= 1; q--) {
            const tq = q / (np + 1), y = -L * tq, x = Math.sin(tq * 3) * bend * 14, lw = 8.5 * (1.15 - tq * 0.5), lh = 4.6 * (1.15 - tq * 0.45);
            for (const sd of [-1, 1]) {
              g.save(); g.translate(x + sd * lw * 0.75, y + 2); g.rotate(sd * 0.75);
              g.beginPath(); g.ellipse(0, 0, lw, lh, 0, 0, Math.PI * 2);
              g.fillStyle = col(t, k, ((q + j) % 3) * 6 - 6); g.fill(); g.strokeStyle = 'rgba(28,32,26,.92)'; g.lineWidth = 1.6; g.stroke(); g.restore();
            }
          }
          g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(bend * 10, -L * 0.5, Math.sin(3) * bend * 14, -L); g.strokeStyle = 'rgba(28,32,26,.8)'; g.lineWidth = 1.2; g.stroke();
          g.restore();
        }
      } else if (kind === 'point') { // 掌叶：七到十片长叶自一点放射成星（原画潭前大树）
        const n = 7 + Math.floor(k * 4), a0 = -Math.PI / 2 + (C.x - C.p.x) / C.p.rx * 0.4;
        for (let j = 0; j < n; j++) {
          const a = a0 + (j / (n - 1) - 0.5) * 4.4 + (R() - 0.5) * 0.15, L = 34 + R() * 18;
          g.save(); g.rotate(a + Math.PI / 2);
          g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(8, -L * 0.5, 0, -L); g.quadraticCurveTo(-8, -L * 0.5, 0, 0);
          g.fillStyle = col(t, k, (j % 2) * 8 - 4); g.fill(); g.strokeStyle = 'rgba(30,34,28,.9)'; g.lineWidth = 1.4; g.stroke(); g.restore();
        }
      } else { // 点叶：一簇胡椒点，簇间留白
        const n = 18 + Math.floor(k * 10);
        for (let j = 0; j < n; j++) {
          const rr = Math.sqrt(R()) * 20, a = R() * Math.PI * 2, r = 3.8 + R() * 2.8;
          g.beginPath(); g.ellipse(Math.cos(a) * rr * 1.25, Math.sin(a) * rr * 0.8, r * 1.3, r, R() - 0.5, 0, Math.PI * 2);
          const c = COLS[Math.min(4, Math.floor(t * 2.4 + k * 1.6) + 1)];
          g.fillStyle = `rgb(${c[0] - 28},${c[1] - 26},${c[2] - 26})`; g.fill();
        }
      }
      g.restore();
    }
  });
}
// 竹叶：“个”字形墨叶
// 竹叶：照原画“个”字、“介”字的画法，三五片窄叶从一个枝节散开、往下垂，深石绿，中间一道浅筋
export function bambooTexture() {
  return canvas(256, 256, (g, w, h) => {
    const R = mulberry(11);
    const leaf = (x, y, a, L, W, dark) => {
      const ca = Math.cos(a), sa = Math.sin(a), px = -sa, py = ca;
      g.fillStyle = dark ? `rgb(${34 + R() * 12},${56 + R() * 14},${46 + R() * 10})` : `rgb(${62 + R() * 14},${90 + R() * 14},${70 + R() * 10})`;
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + ca * L * 0.35 + px * W, y + sa * L * 0.35 + py * W, x + ca * L, y + sa * L);
      g.quadraticCurveTo(x + ca * L * 0.35 - px * W, y + sa * L * 0.35 - py * W, x, y); g.fill();
      g.strokeStyle = 'rgba(150,175,140,.45)'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(x + ca * L * 0.08, y + sa * L * 0.08); g.lineTo(x + ca * L * 0.8, y + sa * L * 0.8); g.stroke();
    };
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < 26; i++) {
      const x = 46 + R() * 164, y = 20 + R() * 150, n = 3 + Math.floor(R() * 3), base = Math.PI / 2 + (R() - 0.5) * 1.6;
      g.strokeStyle = 'rgba(40,52,40,.8)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(x - Math.cos(base) * 14, y - Math.sin(base) * 14); g.lineTo(x, y); g.stroke();
      for (let k = 0; k < n; k++) {
        const a = base + ((k + 0.5) / n - 0.5) * (1.3 + R() * 0.5), L = 34 + R() * 30;
        leaf(x, y, a, L, 5 + R() * 2.5, pass === 0);
      }
    }
  });
}
// 草丛：几笔撇出的墨绿草叶，配点苔
export function tuftTexture() {
  return canvas(128, 128, (g, w, h) => {
    const R = mulberry(3);
    for (let i = 0; i < 16; i++) {
      const x0 = 64 + (R() - 0.5) * 30, a = -Math.PI / 2 + (R() - 0.5) * 1.6, L = 50 + R() * 60;
      g.strokeStyle = `rgba(${40 + R() * 30},${70 + R() * 30},${45 + R() * 20},1)`; g.lineWidth = 2.2 + R() * 1.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x0, 126); g.quadraticCurveTo(x0 + Math.cos(a) * L * 0.4, 126 + Math.sin(a) * L * 0.6, x0 + Math.cos(a) * L, 126 + Math.sin(a) * L); g.stroke();
    }
  });
}
// 勾云：绢白云团，上缘一圈圈卷曲墨线
export function cloudTexture() {
  return canvas(512, 256, (g, w, h) => {
    const R = mulberry(5);
    const puffs = [];
    for (let i = 0; i < 9; i++) puffs.push([70 + i * 46 + (R() - 0.5) * 20, 150 - Math.sin((i / 8) * Math.PI) * 50 + (R() - 0.5) * 16, 34 + R() * 26]);
    g.fillStyle = '#efe4c9';
    for (const [x, y, r] of puffs) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    g.fillRect(50, 150, 410, 50);
    g.beginPath(); g.ellipse(256, 196, 214, 34, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(120,110,90,.55)'; g.lineWidth = 2;
    for (const [x, y, r] of puffs) {
      g.beginPath(); g.arc(x, y, r * 0.62, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      g.beginPath(); g.arc(x + r * 0.15, y + r * 0.05, r * 0.32, Math.PI * 1.1, Math.PI * 2.2); g.stroke();
    }
  });
}
function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- 后处理 ----------
// 一次全屏：深度二阶差分勾线（线宽随噪声抖动）、按距离与高度淡入绢色、天空处画远山、叠绢纹与暗角。
export function createPost(renderer, { samples = 0, mistSteps = 14, clouds = 16, cloudSteps = 10, lights = 16 } = {}) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const depth = new THREE.DepthTexture(size.x, size.y); depth.type = THREE.UnsignedIntType;
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { depthTexture: depth, samples, type: THREE.UnsignedByteType });
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: rt.texture }, tDepth: { value: depth },
      near: { value: 0.3 }, far: { value: 1500 }, res: { value: new THREE.Vector2(size.x, size.y) },
      projInv: { value: new THREE.Matrix4() }, camWorld: { value: new THREE.Matrix4() },
      time: { value: 0 }, silk: { value: PAL.silk }, silkSky: { value: PAL.silkSky },
      lineW: { value: 1 }, fogK: { value: 1 }, grain: { value: 1 },
      cl: { value: Array.from({ length: clouds }, () => new THREE.Vector4()) }, clr: { value: Array.from({ length: clouds }, () => new THREE.Vector4(1, 1, 1, 0)) }, nCl: { value: 0 },
      tHeight: { value: null }, hInfo: { value: new THREE.Vector4(0, 0, 1, 1) }, hRange: { value: new THREE.Vector2(0, 1) }, mistK: { value: 1 },
      // v38 昼夜（daynight.js 每帧填）：调色、日月方向、夜灯
      gMul: { value: new THREE.Vector3(1, 1, 1) }, gAdd: { value: new THREE.Vector3() }, gSat: { value: 1 },
      nightK: { value: 0 }, warmK: { value: 0 }, dawnK: { value: 0 }, lampK: { value: 0 },
      sunD2: { value: new THREE.Vector3(0, 1, 0) }, moonD: { value: new THREE.Vector3(0, -1, 0) },
      lp: { value: Array.from({ length: lights }, () => new THREE.Vector4()) }, lc: { value: Array.from({ length: lights }, () => new THREE.Vector4()) }, nL: { value: 0 },
    },
    defines: { MIST_STEPS: mistSteps, CLOUDS: clouds, CLOUD_STEPS: cloudSteps, LIGHTS: lights },
    depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tColor, tDepth; uniform float near, far, time, lineW, fogK, grain; uniform vec2 res;
      uniform mat4 projInv, camWorld; uniform vec3 silk, silkSky; varying vec2 vUv;
      uniform sampler2D tHeight; uniform vec4 hInfo; uniform vec2 hRange; uniform float mistK;
      uniform vec3 gMul, gAdd, sunD2, moonD; uniform float gSat, nightK, warmK, dawnK, lampK;
      uniform vec4 lp[LIGHTS]; uniform vec4 lc[LIGHTS]; uniform int nL;
      ${COMMON}
      float hash13(vec3 p){ p=fract(p*.1031); p+=dot(p,p.zyx+31.32); return fract((p.x+p.y)*p.z); }
      float n3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(mix(hash13(i),hash13(i+vec3(1,0,0)),f.x), mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x), mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x),f.y), f.z); }
      float groundAt(vec2 xz){ vec2 uv=(xz-hInfo.xy)/hInfo.zw; return hRange.x + texture2D(tHeight, clamp(uv,0.,1.)).r*hRange.y; }
      // 雾气：云山仙境一区浓，高低三层错落；其余各区只留很淡的山腰云带和零星地气
      vec2 mistD(vec3 p){
        vec3 q=p*vec3(.018,.08,.04)+vec3(time*.035,0.,time*.012);
        float n=n3(q)*.62+n3(q*2.4+vec3(4.,1.,7.))*.38;
        float zk=smoothstep(-22.,-48.,p.x)*smoothstep(-218.,-192.,p.x);
        float h=p.y-groundAt(p.xz);
        // 路上、谷底只留极淡的地气（山腰云带另在画面上按落点高度罩，见 main 里的 waist）
        // v27：第二章精修后，路上和景点前不再罩浓雾（Yang：路上少、山上多），云海改由体积云按原画摆
        float low=smoothstep(-.5,1.5,h)*smoothstep(8.,2.,h)*mix(.04,.1,zk);
        float mid=smoothstep(9.,14.,p.y)*smoothstep(24.,17.,p.y)*zk*.15;
        float high=smoothstep(26.,32.,p.y)*smoothstep(52.,38.,p.y)*mix(.12,.35,zk)*smoothstep(6.,14.,h);
        float d=max(0.,n-.58)*2.4*low + max(0.,n-.55)*2.4*mid + max(0.,n-.54)*2.6*high;
        return vec2(d, clamp((h-1.)/12.,0.,1.));
      }
      // 体积云：一团团椭球，噪声侵蚀出絮状边缘，底平顶鼓
      uniform vec4 cl[CLOUDS]; uniform vec4 clr[CLOUDS]; uniform int nCl;
      float cloudD(vec3 p, vec4 c, vec4 r, float oct){
        vec3 q=(p-c.xyz)/r.xyz; float l=length(q);
        if(l>1.) return 0.;
        vec3 w=p*.075+vec3(time*.025+r.w, r.w*1.7, time*.01);
        float n=n3(w)*.55+n3(w*2.3+3.)*.3;
        if(oct>.5) n+=n3(w*5.3+9.)*.15; else n+=.075;
        float shape=(1.-l)*smoothstep(-.75,-.15,q.y);
        return clamp(shape*2.4+(n-.55)*1.8-.18, 0., 1.);
      }
      float lin(float d){ float z=d*2.-1.; return 2.*near*far/(far+near-z*(far-near)); }
      float D(vec2 uv){ return lin(texture2D(tDepth, uv).x); }
      vec3 viewPos(vec2 uv, float d){ vec4 p=projInv*vec4(uv*2.-1., d*2.-1., 1.); return p.xyz/p.w; }
      float ridge(float a, float f, float s){ return vnoise(vec2(a*f, s))*.6 + vnoise(vec2(a*f*2.3, s+5.))*.3 + vnoise(vec2(a*f*5.1, s+9.))*.1; }
      void main(){
        vec2 px=1./res;
        vec3 col=texture2D(tColor,vUv).rgb, base=col;
        float raw=texture2D(tDepth,vUv).x;
        vec3 vp=viewPos(vUv, raw);
        vec3 wp=(camWorld*vec4(vp,1.)).xyz;
        vec3 nW=normalize(cross(dFdx(wp), dFdy(wp)) + 1e-6); // 屏幕导数求面朝向（夜灯照面用）
        float skyO=0.;
        vec3 camP=(camWorld*vec4(0.,0.,0.,1.)).xyz;
        vec3 rd=normalize(wp-camP);
        float dist=length(vp);
        bool sky = raw>.99999;
        // —— 勾线 ——
        float jit = vnoise(vUv*res*.035 + 3.)*.9 + .55;
        vec2 o = px*lineW*jit;
        float dc=lin(raw), dl=D(vUv-vec2(o.x,0.)), dr=D(vUv+vec2(o.x,0.)), dd=D(vUv-vec2(0.,o.y)), du=D(vUv+vec2(0.,o.y));
        float lap = abs(dl+dr+du+dd-4.*dc)/dc;
        float sil = max(max(abs(dl-dc),abs(dr-dc)),max(abs(du-dc),abs(dd-dc)))/dc;
        float edge = max(smoothstep(.035,.1,lap), smoothstep(.07,.18,sil));
        float fol = min(min(texture2D(tColor,vUv-vec2(o.x,0.)).a, texture2D(tColor,vUv+vec2(o.x,0.)).a), min(texture2D(tColor,vUv-vec2(0.,o.y)).a, texture2D(tColor,vUv+vec2(0.,o.y)).a));
        fol = min(fol, texture2D(tColor,vUv).a);
        edge *= mix(.12, 1., smoothstep(.5,.9,fol));
        edge *= 1.-smoothstep(150.,420.,dist); // 远山也留墨线
        edge *= .55 + .45*vnoise(vUv*res*.012+time*.0); // 飞白
        // —— 绢色雾与山间云气 ——
        float fog = 1.-exp(-pow(dist*.003*fogK, 1.35));
        fog *= 1. - .3*smoothstep(25., 90., wp.y);                                   // 高处的山头透出来，远眺看得清
        float mist = smoothstep(9., -4., wp.y - 4.) * smoothstep(120., 320., dist) * .07; // 远处谷底一层薄霭，近处的路上不压雾
        fog = clamp(fog + mist, 0., .9);
        // —— 天空：绢色，地平线附近有三层淡远山 ——
        if(sky){
          float el=rd.y; float az=atan(rd.x, -rd.z);
          vec3 c = mix(silk, silkSky, smoothstep(-.05,.35,el));
          skyO=1.;
          for(int k=2;k>=0;k--){
            float fk=float(k);
            float h = .015 + .045*(3.-fk)*.5 + .07*ridge(az, 3.+fk*2., fk*7.) ;
            vec3 mc = mix(vec3(.45,.55,.63), vec3(.62,.63,.55), fk*.4);
            mc = mix(mc, silk, .35 + fk*.18);
            float m = smoothstep(h, h-.004, el);
            float wash = smoothstep(h-.07, h, el);  // 山脚淡入云气
            c = mix(c, mix(silk, mc, .35+.65*wash), m);
            skyO *= 1.-m;
          }
          col=c; edge=0.; fog=0.;
        }
        col = mix(col, silk, fog);
        // 山腰云带：视线落在山坡的 20~46 米那一段时罩一层缓缓流动的白云，山头露在上面，谷底和路上不罩
        if(!sky){
          float wg = groundAt(wp.xz);
          float band = smoothstep(18.,26.,wp.y)*smoothstep(48.,37.,wp.y)*smoothstep(13.,25.,wg)*smoothstep(25.,60.,dist);
          band *= (1. - smoothstep(-22.,-48.,wp.x)*smoothstep(-218.,-192.,wp.x)) * (1. - .5*smoothstep(-15.,0.,wp.x)*smoothstep(95.,80.,wp.x)); // 云山仙境另有云海；玉女潭减半，保持现在的样子
          band *= 1. - smoothstep(-50.,-42.,wp.x)*smoothstep(4.,-6.,wp.x)*smoothstep(-20.,-27.,wp.z)*smoothstep(-70.,-60.,wp.z)*smoothstep(-30.,-42.,camP.x); // v36 从第二章看磐玉隈右边的松坡：原画满坡松林直到画顶，不罩山腰云带
          vec3 wq = wp*vec3(.022,.085,.045)+vec3(time*.03,0.,time*.012);
          float wn = n3(wq)*.62 + n3(wq*2.3+vec3(5.,2.,8.))*.38;
          float wa = smoothstep(.46,.72,wn)*band*.8;
          col = mix(col, mix(vec3(.9,.88,.82), vec3(.99,.97,.92), smoothstep(.5,.8,wn)), wa);
          edge *= 1.-wa;
          // 芙蓉城：几根高山柱（顶 105~146 米）的腰上缠两道云，云带高低随噪声起伏
          float fz = smoothstep(-220.,-210.,wp.x)*smoothstep(-136.,-146.,wp.x)*smoothstep(-38.,-48.,wp.z)*smoothstep(6.,14.,wp.y-wg);
          if(fz>0.){
            vec3 fq = wp*vec3(.03,.06,.05)+vec3(time*.04,0.,time*.015);
            float fn = n3(fq)*.6 + n3(fq*2.4+vec3(3.,8.,1.))*.4, wob = (n3(vec3(wp.xz*.04, time*.02))-.5)*10.;
            float fb = max(smoothstep(15.,4.,abs(wp.y-100.+wob)), .9*smoothstep(11.,3.,abs(wp.y-122.-wob*.6)));
            float fa = smoothstep(.3,.6,fn)*fb*fz*.92;
            col = mix(col, mix(vec3(.9,.88,.83), vec3(1.,.98,.93), smoothstep(.45,.8,fn)), fa);
            edge *= 1.-fa;
          }
        }
        col = mix(col, vec3(.17,.15,.12), edge*(1.-fog)*.85);
        // —— 体积云：只在每团云的包围椭球里步进，前后排序后叠加，被山体遮挡 ——
        {
          float T=1.; vec3 acc=vec3(0.);
          float jit = hash12(gl_FragCoord.yx + fract(time*5.)*37.);
          vec3 sunD=normalize(vec3(-.45,.8,.4));
          for(int i=0;i<CLOUDS;i++){
            if(i>=nCl || T<.04) break;
            vec4 c=cl[i], r=clr[i];
            vec3 o=(camP-c.xyz)/r.xyz, d=rd/r.xyz;
            float A=dot(d,d), B=dot(o,d), Cc=dot(o,o)-1., disc=B*B-A*Cc;
            if(disc<=0.) continue;
            float sq=sqrt(disc), t0=max((-B-sq)/A, .5), t1=(-B+sq)/A;
            if(!sky) t1=min(t1, dist);
            if(t1<=t0) continue;
            float stp=(t1-t0)/float(CLOUD_STEPS);
            for(int k=0;k<CLOUD_STEPS;k++){
              vec3 p=camP+rd*(t0+(float(k)+jit)*stp);
              float dd=cloudD(p,c,r,1.);
              if(dd>.01){
                float a=1.-exp(-dd*stp*.32);
                float sh=cloudD(p+sunD*r.y*.45,c,r,0.);
                float lit=exp(-sh*2.2)*.75 + clamp(((p.y-c.y)/r.y)*.5+.5,0.,1.)*.25;
                vec3 cc=mix(vec3(.72,.70,.66), vec3(1.,.98,.93), lit);
                cc=mix(cc, silk*1.08, .15);
                acc+=T*a*cc; T*=1.-a;
                if(T<.04) break;
              }
            }
          }
          col=col*T+acc;
        }
        // —— 雾气：沿视线步进，被山体与树木遮挡，近处留出空隙 ——
        if(mistK>0.){
          float tEnd = sky ? 480. : min(dist, 480.);
          float stp = tEnd/float(MIST_STEPS);
          float jit = hash12(gl_FragCoord.xy + fract(time*7.)*91.);
          float T=1.; vec3 acc=vec3(0.);
          for(int i=0;i<MIST_STEPS;i++){
            float tt=(float(i)+jit)*stp;
            vec3 p=camP+rd*tt;
            vec2 m=mistD(p);
            float d=m.x*smoothstep(8.,40.,tt)*mistK;
            if(d>.001){
              float a=1.-exp(-d*stp*.08);
              float lit=m.y;
              vec3 mc=mix(vec3(.83,.81,.75), vec3(.98,.96,.9), lit);
              acc+=T*a*mc; T*=1.-a;
              if(T<.03) break;
            }
          }
          col=col*T+acc;
        }
        // —— 绢纹、旧色、暗角 ——
        vec2 fc=gl_FragCoord.xy;
        float weave = (sin(fc.x*2.2)*.5+.5)*(sin(fc.y*2.05)*.5+.5);
        float fib = vnoise(vec2(fc.x*.6, fc.y*.025)) + vnoise(vec2(fc.x*.025, fc.y*.6));
        float stain = vnoise(vUv*vec2(3.,2.)+.5);
        col *= 1. - grain*(.035*weave + .035*(fib-1.) + .06*(stain-.5));
        col = mix(col, col*vec3(1.02,1.,.94), .4);
        col = mix(col, silk*lum(col)/lum(silk), .1);
        // —— v38 昼夜：整体调色（黄昏暖、入夜青），天上画霞光、落日、月亮、星；夜里灯照亮周围 ——
        {
          float L0=lum(col);
          col = mix(vec3(L0), col, gSat)*gMul + gAdd;
          if(sky){
            float el=rd.y;
            col *= mix(1., mix(1.05, .5, smoothstep(-.02,.65,el)), nightK); // 夜里天顶更深，地平线留一抹亮
            float sd=max(dot(rd,sunD2),0.);
            vec3 gc=mix(vec3(1.,.5,.24), vec3(1.,.6,.56), dawnK);
            col += gc*warmK*(pow(sd,5.)*.32 + pow(sd,48.)*.45)*(1.-smoothstep(.0,.45,el)*.7);
            col += gc*warmK*.13*smoothstep(.32,.0,el);
            col = mix(col, vec3(1.,.66,.4), smoothstep(.99935,.9997,sd)*warmK*skyO); // 落日（被远山挡住）
            float md=max(dot(rd,moonD),0.);
            col += vec3(.55,.6,.72)*nightK*(pow(md,220.)*.22 + pow(md,2500.)*.35)*skyO;
            float mn=smoothstep(.99962,.9998,md);
            col = mix(col, vec3(.93,.92,.85)*(.88+.12*vnoise(rd.xy*900.)), mn*nightK*skyO);
            // 星：天球上分格，少数格里一颗，微微闪
            vec2 spc=vec2(atan(rd.x,-rd.z), asin(clamp(rd.y,-1.,1.)))*95.;
            vec2 ci=floor(spc), cf=fract(spc)-.5; float hs=hash12(ci);
            if(hs>.982){ float b=(hs-.982)/.018; vec2 off=vec2(hash12(ci+3.1),hash12(ci+7.7))-.5;
              float tw=.55+.45*sin(time*(.8+b*2.5)+hs*60.);
              col += vec3(.88,.9,1.)*smoothstep(.14,.0,length(cf-off*.6))*(.35+.65*b)*tw*nightK*skyO*smoothstep(.04,.25,el); }
          } else {
            vec3 nn = dot(nW,rd)>0. ? -nW : nW;
            // 黄昏、清晨：朝日的面镀一层暖金，背日的面偏冷偏暗（不是整片泛黄）
            if(warmK>0.){
              float sl=clamp(dot(nn, normalize(vec3(sunD2.x, max(sunD2.y,.12), sunD2.z)))*.5+.5, 0., 1.);
              vec3 wc=mix(vec3(1.2,1.,.76), vec3(1.12,.99,.95), dawnK), cc=mix(vec3(.8,.84,1.), vec3(.86,.86,.98), dawnK);
              col *= mix(vec3(1.), mix(cc, wc, smoothstep(.42,.88,sl)), warmK*(1.-fog*.6));
            }
            // 夜灯：挑出来的几盏灯照亮附近的地面、墙、树（离灯越近越亮，背灯的面暗些）
            vec3 Ls=vec3(0.);
            for(int i=0;i<LIGHTS;i++){
              if(i>=nL) break;
              vec3 d=lp[i].xyz-wp; float r=length(d), R=lp[i].w;
              if(r<R){ float a=1.-r/R; a*=a; a/=1.+r*r*.1; Ls+=lc[i].rgb*a*(.3+.7*max(dot(nn,d/max(r,1e-3)),0.)); }
            }
            col += base*Ls*lampK*(1.-fog)*(1.-edge*.7);
          }
        }
        float vig = smoothstep(1.25,.35, length((vUv-.5)*vec2(1.25,1.)));
        col *= mix(.78, 1., vig);
        gl_FragColor=vec4(col,1.);
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const pscene = new THREE.Scene(); pscene.add(quad);
  const pcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    rt, mat,
    setSize(w, h) { rt.setSize(w, h); mat.uniforms.res.value.set(w, h); },
    // 每帧挑出离镜头最近的几团云，按远近排好交给着色器
    setClouds(list, cam) {
      const u = mat.uniforms, n = u.cl.value.length, cp = cam.position;
      const near = list.map((c) => ({ c, d: Math.hypot(c[0] - cp.x, c[1] - cp.y, c[2] - cp.z) - c[3] * 0.5 })).filter((o) => o.d < 520).sort((a, b) => a.d - b.d).slice(0, n);
      near.forEach((o, i) => { const [x, y, z, w, sd] = o.c; u.cl.value[i].set(x, y, z, 0); u.clr.value[i].set(w * 0.5, w * 0.2, w * 0.32, sd); });
      u.nCl.value = near.length;
    },
    // 地形高度图（给云雾判断离地高度）
    setHeightmap(fn, x0, z0, w, d, step = 2) {
      const nx = Math.ceil(w / step) + 1, nz = Math.ceil(d / step) + 1, hs = new Float32Array(nx * nz);
      let lo = 1e9, hi = -1e9;
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const h = fn(x0 + i * step, z0 + j * step); hs[j * nx + i] = h; lo = Math.min(lo, h); hi = Math.max(hi, h); }
      const data = new Uint8Array(nx * nz * 4);
      for (let k = 0; k < hs.length; k++) data[k * 4] = Math.round((hs[k] - lo) / (hi - lo) * 255);
      const tex = new THREE.DataTexture(data, nx, nz, THREE.RGBAFormat); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
      mat.uniforms.tHeight.value = tex; mat.uniforms.hInfo.value.set(x0, z0, (nx - 1) * step, (nz - 1) * step); mat.uniforms.hRange.value.set(lo, hi - lo);
    },
    render(scene, camera, t) {
      const u = mat.uniforms;
      u.near.value = camera.near; u.far.value = camera.far; u.time.value = t;
      u.projInv.value.copy(camera.projectionMatrixInverse); u.camWorld.value.copy(camera.matrixWorld);
      renderer.setRenderTarget(rt); renderer.render(scene, camera);
      renderer.setRenderTarget(null); renderer.render(pscene, pcam);
    },
  };
}
