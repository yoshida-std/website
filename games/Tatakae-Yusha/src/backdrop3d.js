// 背景の 3D 版(夜空・星・星座・遠くの遺跡の壁と塔・たいまつ)
//
// - 空: カメラに ついてくる 大きな半球(シェーダーで グラデーション)。星・星座も 空に はりつける
//   カメラの向きが かわると 星が ながれる(移行元は 横にずらす 見せかけだった)
// - 遺跡: 闘技場の まわりに 輪になって たつ壁。アーチ・とびら・柱・塔・たいまつ。
//   ほんとうの 3D なので、あるくと 奥行きの ずれ(視差)が 出る
// - ゆうしゃの足もと50%・視野3段階の 見え方は 床と同じ カメラで きまる
// 色は 移行元(render2d.js の drawBackdrop)と おなじ
import * as THREE from 'three';
import {LineSegments2} from 'three/addons/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/addons/lines/LineSegmentsGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {CFG} from './config.js';
import {CONSTEL} from './render2d.js';
import {trackLineMat} from './three-chars.js';

// ---- 数のしるし(かならず おなじ ならびに なる。Math.random は つかわない) ----
function hs(n){n=n|0;n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);n=n^(n>>>16);return ((n>>>0)%1000)/1000;}
const hexRGB=h=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255];

// ---- 壁の かたち(輪の まわりに 箱を ならべて、1つの ジオメトリに まとめる) ----
const WALL_R=38;      // 輪の はんけい(闘技場の 中心から。外わく R=11 の 外)
const WALL_H=16;      // 壁の たかさ
const BAYS=40;        // 壁の ひろがり(1つぶんは およそ 6)
function makeWall(){
  const A=CFG.arena,pos=[],col=[];
  // ローカル(lx=接線 / ly=上 / lz=外むき)→ 世界(Three.js の 座標。ロジックの z は 逆むき)
  const W=(th,r,y,lx,ly,lz)=>{
    const rr=r+lz,c=Math.cos(th),s=Math.sin(th);
    return [A.cx+rr*c-lx*s,y+ly,-(A.cz+rr*s+lx*c)];
  };
  const tri=(a,b,c,rgb)=>{pos.push(...a,...b,...c);col.push(...rgb,...rgb,...rgb);};
  // 箱: 中心(th 角度, r 半径, cy 高さ)・大きさ(sx 接線 × sy 上 × sz 外むき)
  function box(th,r,cy,sx,sy,sz,hex,k){
    const base=hexRGB(hex),k0=k===undefined?1:k;
    const P=(i,j,l)=>W(th,r,cy,(i-0.5)*sx,(j-0.5)*sy,(l-0.5)*sz);
    const F=[ // [4つの角, 面のあかるさ]  うち 内がわ(闘技場のほう)の面を 1.0 に
      [[P(0,0,0),P(1,0,0),P(1,1,0),P(0,1,0)],1.0],   // 内がわ
      [[P(0,0,1),P(1,0,1),P(1,1,1),P(0,1,1)],0.7],   // 外がわ
      [[P(0,0,0),P(0,0,1),P(0,1,1),P(0,1,0)],0.85],  // 横
      [[P(1,0,0),P(1,0,1),P(1,1,1),P(1,1,0)],0.85],  // 横
      [[P(0,1,0),P(1,1,0),P(1,1,1),P(0,1,1)],1.12],  // うえ
      [[P(0,0,0),P(1,0,0),P(1,0,1),P(0,0,1)],0.6]    // した
    ];
    for(const [q,f] of F){const m=f*k0,rgb=[Math.min(1,base[0]*m),Math.min(1,base[1]*m),Math.min(1,base[2]*m)];tri(q[0],q[1],q[2],rgb);tri(q[0],q[2],q[3],rgb);}
  }
  // アーチ(うちがわの 面に はりつく 暗い かたち)
  function arch(th,r,aw,ah,hex){
    const rgb=hexRGB(hex),rad=aw/2,sp=ah-rad,pts=[[-rad,0],[-rad,sp]];
    for(let i=1;i<10;i++){const a=Math.PI-i/10*Math.PI;pts.push([Math.cos(a)*rad,sp+Math.sin(a)*rad]);}
    pts.push([rad,sp],[rad,0]);
    const P=q=>W(th,r,0,q[0],q[1],0),o=P([0,0]);
    for(let i=0;i<pts.length-1;i++)tri(o,P(pts[i]),P(pts[i+1]),rgb);
  }
  const dth=Math.PI*2/BAYS,U=WALL_R*dth,torches=[];
  for(let i=0;i<BAYS;i++){
    const th=i*dth,r=hs(i*7+3);
    const hh=WALL_H*(r<0.18?0.55:(r<0.4?0.85:1));
    box(th,WALL_R+1,hh/2,U*1.02,hh,2,'#232d47');                 // 壁
    box(th,WALL_R+0.15,hh+0.15,U*1.02,0.35,2.6,'#41507a');        // うえの へり
    if(r>=0.18)arch(th,WALL_R-0.03,U*0.5,hh*0.62,'#0f152a');     // アーチ
    const bth=th-dth/2;                                           // 柱は つぎめに
    box(bth,WALL_R-0.2,(hh-0.35)/2,U*0.14,hh-0.35,0.9,'#34426a');
    if(i%9===0){ // とう
      const tw=U*0.58,th2=WALL_H*1.75;
      box(th,WALL_R-0.5,th2/2,tw,th2,3,'#2b3656');
      box(th,WALL_R-0.5,th2+0.2,tw+0.5,0.45,3.5,'#41507a');
      for(let k=0;k<3;k++){box(th-dth*0.0+(k-1)*(tw+0.5)*0.36/WALL_R*1.0,WALL_R-0.5,th2+0.65,(tw+0.5)/5,0.8,3.5,'#2b3656');}
      box(th,WALL_R-2.05,th2*0.7,0.5,0.9,0.1,'#ffcd6e',1);       // あかりの まど
    }
    if(i%4===0)torches.push({th:bth,y:WALL_H*0.28,idx:i});
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  return {geo:g,torches};
}

// ---- 光のたま(たいまつ) ----
function glowTex(inner,outer,oval){
  const c=document.createElement('canvas');c.width=64;c.height=64;const x=c.getContext('2d');
  const g=x.createRadialGradient(32,32,2,32,32,30);g.addColorStop(0,inner);g.addColorStop(1,outer);
  x.fillStyle=g;x.beginPath();if(oval)x.ellipse(32,32,13,28,0,0,Math.PI*2);else x.arc(32,32,30,0,Math.PI*2);x.fill();
  const t=new THREE.CanvasTexture(c);return t;
}

// ---- 空・星・星座 ----
const SKY_VS=`varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const SKY_FS=`
precision highp float;varying vec3 vDir;uniform float uTop;
void main(){
  float s=clamp(asin(clamp(vDir.y,0.0,1.0))/uTop,0.0,1.0); // 0=地平線 1=画面のうえ
  vec3 h=vec3(43.,70.,118.)/255.,m=vec3(19.,32.,74.)/255.,t=vec3(7.,11.,37.)/255.;
  vec3 c=s<0.4?mix(h,m,s/0.4):mix(m,t,(s-0.4)/0.6);
  gl_FragColor=vec4(c,1.0);
}`;
const STAR_VS=`attribute float aSize;attribute float aPhase;varying float vPh;uniform float uDPR;
void main(){vPh=aPhase;gl_PointSize=aSize*uDPR;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const STAR_FS=`precision highp float;varying float vPh;uniform float uT;uniform vec3 uCol;
void main(){float a=0.55+0.3*sin(uT*2.0+vPh);gl_FragColor=vec4(uCol,a);}`;

export function makeBackdrop(scene){
  const DOME=1400;
  const root=new THREE.Group();scene.add(root);
  // 空
  const skyMat=new THREE.ShaderMaterial({vertexShader:SKY_VS,fragmentShader:SKY_FS,side:THREE.BackSide,depthTest:false,depthWrite:false,uniforms:{uTop:{value:0.4}}});
  const sky=new THREE.Mesh(new THREE.SphereGeometry(DOME,24,16),skyMat);sky.renderOrder=-10;sky.frustumCulled=false;root.add(sky);
  // 星(すこしずつ ちかちか)
  const sp=[],ss=[],sph=[];
  const dir=(az,el)=>[Math.cos(el)*Math.sin(az)*DOME,Math.sin(el)*DOME,Math.cos(el)*Math.cos(az)*DOME];
  for(let i=0;i<360;i++){
    const az=hs(i*5+1)*Math.PI*2,el=0.03+hs(i*5+2)*0.75;
    sp.push(...dir(az,el));ss.push(1+(i%3)*0.4);sph.push(hs(i*5+3)*40);
  }
  // 星座: 星の ならびを 空の あちこちに おく(線と、とがった星)
  const lp=[];
  const CAZ=[0,0.7,1.4,2.1,2.8,3.5,4.2,4.9,5.6];
  CAZ.forEach((a0,k)=>{
    const c=CONSTEL[k%CONSTEL.length];
    const P=c.map(q=>dir(a0+(q[0]-0.5)*0.5,0.42-q[1]*0.6));
    for(let i=0;i+1<P.length;i++)lp.push(...P[i],...P[i+1]);
    for(const q of P){sp.push(...q);ss.push(4.2);sph.push(0);}
  });
  const starGeo=new THREE.BufferGeometry();
  starGeo.setAttribute('position',new THREE.Float32BufferAttribute(sp,3));
  starGeo.setAttribute('aSize',new THREE.Float32BufferAttribute(ss,1));
  starGeo.setAttribute('aPhase',new THREE.Float32BufferAttribute(sph,1));
  const starMat=new THREE.ShaderMaterial({vertexShader:STAR_VS,fragmentShader:STAR_FS,transparent:true,depthTest:false,depthWrite:false,
    uniforms:{uDPR:{value:1},uT:{value:0},uCol:{value:new THREE.Vector3(0.86,0.91,1.0)}}});
  const stars=new THREE.Points(starGeo,starMat);stars.renderOrder=-9;stars.frustumCulled=false;root.add(stars);
  const lg=new LineSegmentsGeometry();lg.setPositions(new Float32Array(lp));
  const lm=new LineMaterial({color:0xaac8ff,linewidth:1.2,transparent:true,opacity:0.34,depthTest:false,depthWrite:false});
  trackLineMat(lm);
  const lines=new LineSegments2(lg,lm);lines.renderOrder=-9.5;lines.frustumCulled=false;root.add(lines);
  // 遺跡の壁(世界に 固定。空のように カメラには ついてこない)
  const wall=makeWall();
  scene.fog=new THREE.Fog(0x5073b9,30,170);
  const wallMesh=new THREE.Mesh(wall.geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));
  wallMesh.frustumCulled=false;scene.add(wallMesh);
  // たいまつ
  const A=CFG.arena,tg=glowTex('rgba(255,176,80,.65)','rgba(255,140,50,0)'),tf=glowTex('rgba(255,235,150,1)','rgba(255,170,60,0)',true);
  const glowMat=new THREE.SpriteMaterial({map:tg,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,fog:false});
  const flameMat=new THREE.SpriteMaterial({map:tf,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,fog:false});
  const stickGeo=new THREE.BoxGeometry(0.3,1.4,0.3),stickMat=new THREE.MeshBasicMaterial({color:0x5a4632});
  const torches=wall.torches.map(t=>{
    const r=WALL_R-0.9,x=A.cx+r*Math.cos(t.th),z=-(A.cz+r*Math.sin(t.th));
    const g=new THREE.Sprite(glowMat),f=new THREE.Sprite(flameMat),st=new THREE.Mesh(stickGeo,stickMat);
    g.position.set(x,t.y,z);f.position.set(x,t.y+0.1,z);st.position.set(x,t.y-1.1,z);
    scene.add(g,f,st);return {g,f,idx:t.idx};
  });
  return {
    // camPos: カメラの 位置。top: 画面の うえはしの 地平線からの角度(rad)
    update(camPos,top,tSec,dpr){
      root.position.copy(camPos);
      skyMat.uniforms.uTop.value=Math.max(0.15,top);
      starMat.uniforms.uT.value=tSec;starMat.uniforms.uDPR.value=dpr;
      for(const t of torches){
        const fl=0.85+0.15*Math.sin(tSec*9+t.idx*1.7);
        t.g.scale.set(4.4*fl,4.4*fl,1);t.f.scale.set(1.0,2.2*fl,1);
      }
    }
  };
}
