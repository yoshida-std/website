// WebGL(Three.js)の描画。ロジックは そのまま、描画だけを 差しかえる
//
// かさね順(下から):
//   #gl … Three.js。①夜空・星・遺跡の壁・たいまつ(backdrop3d.js) ②石だたみの床(シェーダー) ③闘技場とゆかの しるし(画面の座標で描く) ④キャラ
//   #c  … HUD(名前・HPバー・ダメージ数字・下のウィンドウ)。移行元の Canvas 2D のコードを そのまま使う。指の操作も ここで受ける
//
// カメラ: 移行元の proj() と同じ「視線は水平・画像の中心を 地平線(HZ)へ ずらした」透視投影を、
//         投影行列を じぶんで作って 再現する。これで 足もと50%・視野3段階が ピクセル単位で 同じになる
// 座標: ロジックの (x, z) → Three.js の (x, 高さ, -z)
import * as THREE from 'three';
import {CFG} from './config.js';
import {ctx as hudCtx,CW,CH,DPR,onResize} from './screen.js';
import {S} from './logic.js';
import {V,NEAR,setupView,toCam,proj,drawArena,drawGroundMarks,charList,charPre,charOverlay,drawEffects,drawHud} from './render2d.js';
import {makeChars,setLineResolution} from './three-chars.js';
import {makeBackdrop} from './backdrop3d.js';

THREE.ColorManagement.enabled=false; // 色は Canvas 2D と同じ値のまま あつかう(sRGB→リニア変換をしない)

let R=null; // WebGL の 道具一式(はじめて描くときに つくる)

// Three.js は 部品を つくるとき Math.random(UUID)を つかう。ゲームの乱数の ならびを かえないよう、
// 部品を つくる間だけ べつの乱数に きりかえる(ボットで 移行元と 毎フレーム くらべるため)
let seed3=12345;
function own(r){seed3=(seed3*1103515245+12345)>>>0;return seed3/4294967296;}
export function withOwnRandom(fn){const m=Math.random;Math.random=own;try{return fn();}finally{Math.random=m;}}

// ---- 色の文字列('#8cf' 'rgba(…)')→ [r,g,b,a] ----
const CC=new Map();
function rgba(s){
  let c=CC.get(s);if(c)return c;
  if(s[0]==='#'){let h=s.slice(1);if(h.length===3)h=h.split('').map(x=>x+x).join('');c=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);c.push(1);}
  else{const m=s.match(/[\d.]+/g).map(Number);c=[m[0]/255,m[1]/255,m[2]/255,m.length>3?m[3]:1];}
  CC.set(s,c);return c;
}

// ---- 画面の座標(px)で 三角形を ためて、1回で 描く ----
class Batch{
  constructor(cap){
    this.cap=cap;this.n=0;
    this.pos=new Float32Array(cap*3);this.col=new Float32Array(cap*4);
    const g=new THREE.BufferGeometry();
    this.pa=new THREE.BufferAttribute(this.pos,3).setUsage(THREE.DynamicDrawUsage);
    this.ca=new THREE.BufferAttribute(this.col,4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position',this.pa);g.setAttribute('color',this.ca);
    this.geo=g;
    this.mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthTest:false,depthWrite:false,side:THREE.DoubleSide}));
    this.mesh.frustumCulled=false;
    this.ox=0;this.oy=0;
  }
  begin(ox,oy){this.n=0;this.ox=ox;this.oy=oy;}
  v(x,y,c){
    if(this.n>=this.cap)return;
    const i=this.n++;
    this.pos[i*3]=x+this.ox;this.pos[i*3+1]=-(y+this.oy);this.pos[i*3+2]=0;
    this.col[i*4]=c[0];this.col[i*4+1]=c[1];this.col[i*4+2]=c[2];this.col[i*4+3]=c[3];
  }
  tri(x1,y1,x2,y2,x3,y3,c){this.v(x1,y1,c);this.v(x2,y2,c);this.v(x3,y3,c);}
  end(){
    this.geo.setDrawRange(0,this.n);
    this.pa.clearUpdateRanges();this.pa.addUpdateRange(0,this.n*3);this.pa.needsUpdate=true;
    this.ca.clearUpdateRanges();this.ca.addUpdateRange(0,this.n*4);this.ca.needsUpdate=true;
  }
}

// ---- ゆかに描く道具(移行元の fillPoly / seg / groundCircle と同じ形。線の太さは px) ----
function clipPoly(p){
  const out=[];
  for(let i=0;i<p.length;i++){
    const a=p[i],b=p[(i+1)%p.length],ai=a.d>=NEAR,bi=b.d>=NEAR;
    if(ai)out.push(a);
    if(ai!==bi){const t=(NEAR-a.d)/(b.d-a.d);out.push({l:a.l+(b.l-a.l)*t,d:NEAR});}
  }
  return out;
}
function circlePts(cx,cz,r,n){const p=[];for(let i=0;i<n;i++){const t=i/n*Math.PI*2;p.push(toCam(cx+Math.cos(t)*r,cz+Math.sin(t)*r));}return p;}
function makePainter(B){
  let dash=null;
  function line(x1,y1,x2,y2,c,lw){ // 太さ lw(px)の 線(はしは 四角)
    const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy);if(L<1e-6)return;
    const nx=-dy/L*lw/2,ny=dx/L*lw/2;
    B.tri(x1+nx,y1+ny,x2+nx,y2+ny,x2-nx,y2-ny,c);B.tri(x1+nx,y1+ny,x2-nx,y2-ny,x1-nx,y1-ny,c);
  }
  function seg(a,b,col,lw){
    let A=a,Bp=b;
    if(A.d<NEAR&&Bp.d<NEAR)return;
    if(A.d<NEAR){const t=(NEAR-A.d)/(Bp.d-A.d);A={l:A.l+(Bp.l-A.l)*t,d:NEAR};}
    else if(Bp.d<NEAR){const t=(NEAR-Bp.d)/(A.d-Bp.d);Bp={l:Bp.l+(A.l-Bp.l)*t,d:NEAR};}
    const p=proj(A.l,A.d,0),q=proj(Bp.l,Bp.d,0),c=rgba(col);
    if(!dash){line(p.x,p.y,q.x,q.y,c,lw);return;}
    const L=Math.hypot(q.x-p.x,q.y-p.y),ux=(q.x-p.x)/L,uy=(q.y-p.y)/L,per=dash[0]+dash[1];
    for(let s=0;s<L;s+=per){const e=Math.min(L,s+dash[0]);line(p.x+ux*s,p.y+uy*s,p.x+ux*e,p.y+uy*e,c,lw);}
  }
  function fillPoly(pts,fill){
    const cl=clipPoly(pts);if(cl.length<3)return;
    const c=rgba(fill),s=cl.map(q=>proj(q.l,q.d,0));
    for(let i=1;i<s.length-1;i++)B.tri(s[0].x,s[0].y,s[i].x,s[i].y,s[i+1].x,s[i+1].y,c);
  }
  function groundCircle(cx,cz,r,fill,stroke,lw,n){
    const p=circlePts(cx,cz,r,n||36);
    if(fill)fillPoly(p,fill);
    if(stroke)for(let i=0;i<p.length;i++)seg(p[i],p[(i+1)%p.length],stroke,lw||2);
  }
  function dot(m,col){ // 画面で まるい点(おしあいの色)
    if(m.d<=NEAR)return;
    const p=proj(m.l,m.d,0.05),r=Math.max(4,V.F/m.d*0.18),c=rgba(col).slice(0,3).concat([0.9]);
    const N=20;for(let i=0;i<N;i++){const t0=i/N*Math.PI*2,t1=(i+1)/N*Math.PI*2;B.tri(p.x,p.y,p.x+Math.cos(t0)*r,p.y+Math.sin(t0)*r,p.x+Math.cos(t1)*r,p.y+Math.sin(t1)*r,c);}
  }
  return {dash:a=>{dash=a&&a.length?a:null;},seg,fillPoly,groundCircle,dot};
}

// ---- 石だたみの床(シェーダー。移行元の drawFloor の グラデーション・しきいし・かすみ) ----
const FLOOR_VS=`
varying vec3 vW;
void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
const FLOOR_FS=`
precision highp float;
varying vec3 vW;
uniform vec2 uHero;   // ゆうしゃの位置(ロジックの x,z)
uniform float uHZ,uCH,uDPR,uResH,uOy;
float lineA(float d,float lw,float fw){ // d: 線までの きょり(px)。とおくで 線が こむときは 平均の こさに する
  float a=clamp(lw*0.5+0.5-d,0.0,1.0);
  return mix(a,clamp(lw*fw,0.0,1.0),smoothstep(0.25,0.7,fw));
}
void main(){
  float sy=(uResH-gl_FragCoord.y)/uDPR-uOy; // 画面の上からの px
  float t=clamp((sy-uHZ)/(uCH-uHZ),0.0,1.0);
  vec3 c0=vec3(39.,50.,79.)/255.,c1=vec3(56.,68.,106.)/255.,c2=vec3(75.,87.,122.)/255.;
  vec3 col=t<0.45?mix(c0,c1,t/0.45):mix(c1,c2,(t-0.45)/0.55);
  vec2 p=vec2(vW.x,-vW.z);
  vec3 lc=vec3(8.,12.,32.)/255.;
  if(abs(p.x-uHero.x)<=72.0&&abs(p.y-uHero.y)<=72.0){
    const float GS=2.6;
    vec2 g=p/GS,fw=max(fwidth(g),vec2(1e-4));
    vec2 dp=abs(fract(g+0.5)-0.5)/fw;
    col=mix(col,lc,0.55*lineA(dp.x,1.2,fw.x));   // たての つなぎめ
    col=mix(col,lc,0.55*lineA(dp.y,1.2,fw.y));   // よこの つなぎめ
    float off=mod(floor(g.y),2.0)>0.5?0.5:0.0;    // ならびを ずらした 石のつなぎめ
    float dj=abs(fract(g.x-off+0.5)-0.5)/fw.x;
    col=mix(col,lc,0.32*lineA(dj,1.0,fw.x));
  }
  // とおくは かすんで みえる
  float hz=clamp(1.0-(sy-uHZ)/90.0,0.0,1.0)*step(uHZ,sy);
  col=mix(col,vec3(80.,115.,185.)/255.,0.42*hz);
  gl_FragColor=vec4(col,1.0);
}`;

function setup(){
  const glCv=document.getElementById('gl');
  // アンチエイリアスは 画素の こまかい画面(DPR 2以上)では 切る(スマホで おもくなるため)
  const renderer=new THREE.WebGLRenderer({canvas:glCv,antialias:(window.devicePixelRatio||1)<2,alpha:true,powerPreference:'high-performance'});
  renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
  renderer.autoClear=false;renderer.setClearColor(0x000000,0);
  // 3D のカメラ(投影行列は 毎フレーム じぶんで つくる)
  const cam=new THREE.PerspectiveCamera();cam.rotation.order='YXZ';
  // 画面の座標(px)の カメラ: (0,0)=左上、y は 下むきが +(頂点は -y で 置く)
  const ortho=new THREE.OrthographicCamera(0,100,0,-100,-10000,10000);
  // 床
  const floorMat=new THREE.ShaderMaterial({vertexShader:FLOOR_VS,fragmentShader:FLOOR_FS,depthWrite:true,
    uniforms:{uHero:{value:new THREE.Vector2()},uHZ:{value:0},uCH:{value:1},uDPR:{value:1},uResH:{value:1},uOy:{value:0}}});
  floorMat.extensions={derivatives:true};
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(6000,6000).rotateX(-Math.PI/2),floorMat);
  floor.frustumCulled=false;
  const floorScene=new THREE.Scene();floorScene.add(floor);
  const bd=makeBackdrop(floorScene); // 夜空・遺跡の壁・たいまつ
  // 闘技場・ゆかの しるし
  const batch=new Batch(60000);
  const markScene=new THREE.Scene();markScene.add(batch.mesh);
  // キャラ
  const charScene=new THREE.Scene();
  // ひかり: 移行元の箱モデルの あかるさ(0.52 + 0.62×光の向き)に あわせる。光の向きは カメラから見て 左上手前
  charScene.add(new THREE.AmbientLight(0xffffff,0.52*Math.PI));
  const dl=new THREE.DirectionalLight(0xffffff,0.62*Math.PI);
  dl.position.set(-0.45,0.85,0.55);cam.add(dl);cam.add(dl.target);dl.target.position.set(0,0,0);
  charScene.add(cam);
  // 止めの演出(画面の座標 px で描く。ひかりは キャラと同じ)
  const flyScene=new THREE.Scene();
  flyScene.add(new THREE.AmbientLight(0xffffff,0.52*Math.PI));
  const fdl=new THREE.DirectionalLight(0xffffff,0.62*Math.PI);fdl.position.set(-0.45,0.85,0.55);flyScene.add(fdl);
  const chars=makeChars(charScene,flyScene);
  R={renderer,glCv,bd,cam,ortho,floor,floorMat,floorScene,batch,markScene,charScene,flyScene,P:makePainter(batch),chars,w:0,h:0,dpr:0};
  onResize(fit);fit();
}
function fit(){
  if(!R)return;
  if(R.w===CW&&R.h===CH&&R.dpr===DPR)return;
  R.w=CW;R.h=CH;R.dpr=DPR;
  R.renderer.setPixelRatio(DPR);R.renderer.setSize(CW,CH);
  setLineResolution(CW,CH);
  R.ortho.left=0;R.ortho.right=CW;R.ortho.top=0;R.ortho.bottom=-CH;R.ortho.updateProjectionMatrix();
}
// カメラを ロジックの V(移行元と同じ)に あわせる。ox,oy は 画面のゆれ(px)
function placeCamera(ox,oy){
  const c=R.cam,F=V.F,n=NEAR,f=4000;
  c.position.set(V.camX,V.CAMH,-V.camZ);
  c.rotation.set(0,-S.cam.yaw,0);
  c.updateMatrixWorld(true);
  const px=CW/2+ox,py=V.HZ+oy; // 画面の上での 視線の中心(px)
  c.projectionMatrix.makePerspective(-px/F*n,(CW-px)/F*n,py/F*n,-(CH-py)/F*n,n,f);
  c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
}

function drawGL(h,A,ox,oy,list){
  placeCamera(ox,oy);
  R.bd.update(R.cam.position,Math.atan(V.HZ/V.F),performance.now()/1000,DPR);
  const u=R.floorMat.uniforms;
  R.floor.position.set(Math.round(h.x),0,-Math.round(h.z));
  u.uHero.value.set(h.x,h.z);u.uHZ.value=V.HZ;u.uCH.value=CH;u.uDPR.value=DPR;u.uResH.value=R.glCv.height;u.uOy.value=oy;
  R.batch.begin(ox,oy);drawArena(A,R.P);drawGroundMarks(R.P);R.batch.end();
  const blink=Math.floor(S.t*14)%2===0;
  for(const it of list){if(it.c.d<NEAR)continue;charPre(it);}
  const flying=R.chars.update(S,blink);
  const r=R.renderer;
  r.clear();
  r.render(R.floorScene,R.cam);
  r.render(R.markScene,R.ortho);
  r.render(R.charScene,R.cam);
  if(flying){r.clearDepth();r.render(R.flyScene,R.ortho);}
}

export function render(){
  if(!R)withOwnRandom(setup);
  fit();
  const h=S.hero,A=CFG.arena;
  setupView();
  let ox=0,oy=0;
  if(S.shake>0){ox=(Math.random()-.5)*S.shake*14;oy=(Math.random()-.5)*S.shake*14;} // 移行元と おなじ じゅんばんで 乱数を つかう
  // WebGL: 夜空・遺跡 → 床 → 闘技場・しるし → キャラ
  const list=charList();
  withOwnRandom(()=>drawGL(h,A,ox,oy,list));
  // HUD(Canvas 2D。移行元のコード)
  const blink=Math.floor(S.t*14)%2===0;
  const c=hudCtx;
  c.setTransform(DPR,0,0,DPR,0,0);c.clearRect(0,0,CW,CH);
  c.save();c.translate(ox,oy);
  for(const it of list){if(it.c.d<NEAR)continue;charOverlay(it,blink);}
  drawEffects(()=>{}); // 止めの演出は WebGL で描いた
  c.restore();
  drawHud();
  if(SHOW_FPS){
    const now=performance.now();fpsN++;
    if(now-fpsT>=500){fpsV=fpsN*1000/(now-fpsT);fpsN=0;fpsT=now;}
    c.save();c.font='bold 12px sans-serif';c.fillStyle='rgba(0,0,0,.6)';c.fillRect(CW-74,CH-22,70,18);
    c.fillStyle='#7dff9a';c.textAlign='right';c.textBaseline='middle';c.fillText(fpsV.toFixed(0)+' fps',CW-8,CH-13);c.restore();
  }
}
// ?fps=1 で 右下に フレームレートを 出す(スマホ実機での 確認用)
const SHOW_FPS=new URLSearchParams(location.search).get('fps')==='1';
let fpsN=0,fpsT=0,fpsV=0;
