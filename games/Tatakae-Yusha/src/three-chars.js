// キャラの 3D モデル(Three.js)
//
// ローポリの箱モデルは、移行元(render2d.js)の heroParts / allyParts / enemyParts が つくる
// 「部品のリスト」({c:中心, s:大きさ, col:色, ops:関節の回転})を そのまま つかう。
// 毎フレーム その リストから、箱の面(1つのメッシュ)と ふちの線(1つの太い線)を つくりなおす。
// → キャラ1人あたり 描画は 2回。形・アニメは 移行元と同じ
//
// どのキャラも { obj: THREE.Object3D, update(...) } の形。glTF に差しかえるときは、
// この形を まもった べつの実装を つくれば よい
import * as THREE from 'three';
import {LineSegments2} from 'three/addons/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/addons/lines/LineSegmentsGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {heroParts,allyParts,allyCast,enemyParts,ENEMY_LOOK} from './render2d.js';

// ---- 箱の ひな形(1×1×1) ----
const FACES=[]; // {n:[法線], q:[4つの角]}(外から見て 反時計まわり)
for(let a=0;a<3;a++)for(const sg of [1,-1]){
  const u=(a+1)%3,v=(a+2)%3,q=[];
  for(const [pu,pv] of [[-1,-1],[1,-1],[1,1],[-1,1]]){const p=[0,0,0];p[a]=sg*0.5;p[u]=pu*0.5;p[v]=pv*0.5;q.push(p);}
  if(sg<0)q.reverse();
  const n=[0,0,0];n[a]=sg;FACES.push({n,q});
}
const EDGES=[]; // 12本の ふち
for(let i=0;i<8;i++)for(let b=0;b<3;b++)if(!(i&(1<<b))){
  const c=k=>[(k&1)?0.5:-0.5,(k&2)?0.5:-0.5,(k&4)?0.5:-0.5];EDGES.push([c(i),c(i|(1<<b))]);
}
const HEX=new Map();
function hexRGB(h){let c=HEX.get(h);if(!c){c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);HEX.set(h,c);}return c;}

// 関節の回転(移行元の h3apply と同じ じゅんばん・向き)を、回転 R と 平行移動 t に まとめる
function partXform(ops){
  let R=[1,0,0,0,1,0,0,0,1],t=[0,0,0];
  for(const o of ops){
    const c=Math.cos(o.a),s=Math.sin(o.a);
    const Ro=o.t==='x'?[1,0,0,0,c,-s,0,s,c]:(o.t==='y'?[c,0,s,0,1,0,-s,0,c]:[c,-s,0,s,c,0,0,0,1]);
    const m=(A,B)=>{const r=new Array(9);for(let i=0;i<3;i++)for(let j=0;j<3;j++)r[i*3+j]=A[i*3]*B[j]+A[i*3+1]*B[3+j]+A[i*3+2]*B[6+j];return r;};
    const p=o.p,d=[t[0]-p[0],t[1]-p[1],t[2]-p[2]];
    t=[Ro[0]*d[0]+Ro[1]*d[1]+Ro[2]*d[2]+p[0],Ro[3]*d[0]+Ro[4]*d[1]+Ro[5]*d[2]+p[1],Ro[6]*d[0]+Ro[7]*d[1]+Ro[8]*d[2]+p[2]];
    R=m(Ro,R);
  }
  return {R,t};
}

const OUTLINE=0x0c0e26; // 移行元の ふちの色 rgba(12,14,38,.85)
const lineMats=[];
export function trackLineMat(m){lineMats.push(m);}      // 画面の大きさが かわったら resolution を あわせる
export function setLineResolution(w,h){for(const m of lineMats)m.resolution.set(w,h);}

// ---- 箱モデル(部品の数の 上限 maxParts)----
class BoxModel{
  constructor(maxParts){
    this.max=maxParts;
    const nv=maxParts*24;
    this.pos=new Float32Array(nv*3);this.nor=new Float32Array(nv*3);this.col=new Float32Array(nv*3);
    const idx=new Uint16Array(maxParts*36);
    for(let p=0;p<maxParts;p++)for(let f=0;f<6;f++){const b=p*24+f*4,k=(p*6+f)*6;idx.set([b,b+1,b+2,b,b+2,b+3],k);}
    const g=new THREE.BufferGeometry();
    this.pa=new THREE.BufferAttribute(this.pos,3).setUsage(THREE.DynamicDrawUsage);
    this.na=new THREE.BufferAttribute(this.nor,3).setUsage(THREE.DynamicDrawUsage);
    this.ca=new THREE.BufferAttribute(this.col,3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position',this.pa);g.setAttribute('normal',this.na);g.setAttribute('color',this.ca);g.setIndex(new THREE.BufferAttribute(idx,1));
    this.geo=g;
    // 面は すこし奥へ ずらして(polygonOffset)、ふちの線が 面に うもれないようにする
    const po={polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1};
    this.mat=new THREE.MeshLambertMaterial({vertexColors:true,...po});
    this.matFlash=new THREE.MeshBasicMaterial({color:0xffffff,...po});
    this.mesh=new THREE.Mesh(g,this.mat);this.mesh.frustumCulled=false;
    // ふちの線(太さは 移行元と同じ 0.032。画面の px ではなく 世界の長さ)
    this.lg=new LineSegmentsGeometry();this.lg.setPositions(new Float32Array(maxParts*12*6));
    this.lbuf=this.lg.attributes.instanceStart.data;
    this.lmat=new LineMaterial({color:OUTLINE,linewidth:0.032,worldUnits:true,transparent:true,opacity:0.85});
    this.lmatFlash=new LineMaterial({color:0xffffff,linewidth:0.032,worldUnits:true});
    lineMats.push(this.lmat,this.lmatFlash);
    this.lines=new LineSegments2(this.lg,this.lmat);this.lines.frustumCulled=false;
    this.obj=new THREE.Group();this.obj.add(this.mesh,this.lines);
  }
  // parts: 移行元の 部品のリスト。scale: 大きさ。flash: 白く光る。lineScale: ふちの線の太さの倍率(省略は scale)
  set(parts,scale,flash,lineScale){
    const n=Math.min(parts.length,this.max),P=this.pos,N=this.nor,C=this.col,L=this.lbuf.array;
    let v=0,e=0;
    for(let i=0;i<n;i++){
      const pt=parts[i],{R,t}=partXform(pt.ops),col=hexRGB(pt.col);
      const W=q=>{const x=pt.c[0]+q[0]*pt.s[0],y=pt.c[1]+q[1]*pt.s[1],z=pt.c[2]+q[2]*pt.s[2];
        return [R[0]*x+R[1]*y+R[2]*z+t[0],R[3]*x+R[4]*y+R[5]*z+t[1],R[6]*x+R[7]*y+R[8]*z+t[2]];};
      for(const f of FACES){
        const nx=R[0]*f.n[0]+R[1]*f.n[1]+R[2]*f.n[2],ny=R[3]*f.n[0]+R[4]*f.n[1]+R[5]*f.n[2],nz=R[6]*f.n[0]+R[7]*f.n[1]+R[8]*f.n[2];
        for(const q of f.q){const w=W(q);P[v*3]=w[0];P[v*3+1]=w[1];P[v*3+2]=w[2];N[v*3]=nx;N[v*3+1]=ny;N[v*3+2]=nz;C[v*3]=col[0];C[v*3+1]=col[1];C[v*3+2]=col[2];v++;}
      }
      for(const ed of EDGES){const a=W(ed[0]),b=W(ed[1]);L.set(a,e*6);L.set(b,e*6+3);e++;}
    }
    this.geo.setDrawRange(0,n*36);
    for(const a of [this.pa,this.na,this.ca]){a.clearUpdateRanges();a.addUpdateRange(0,v*3);a.needsUpdate=true;}
    this.lbuf.needsUpdate=true;this.lg.instanceCount=e;
    this.mesh.material=flash?this.matFlash:this.mat;
    this.lines.material=flash?this.lmatFlash:this.lmat;
    this.lmat.linewidth=this.lmatFlash.linewidth=0.032*(lineScale===undefined?scale:lineScale); // 移行元も 大きさに あわせて 太くなる
    this.obj.scale.setScalar(scale);
  }
}

export function makeChars(scene,flyScene){
  const hero=new BoxModel(80),ally=new BoxModel(60);scene.add(hero.obj,ally.obj);
  const enemies=[];   // てき1体に 1つ
  const flyPool=[];   // 止めの演出(ざんぞう4つ × とんでいる数)
  // 画面から見た むき(yaw3。0=カメラのほうを向く)→ 世界の むき
  const worldYaw=(S,yaw3)=>-S.cam.yaw+(yaw3===undefined?Math.PI:yaw3);
  function opacity(m,al){
    const tr=al<1;
    for(const mt of [m.mat,m.matFlash]){mt.transparent=tr;mt.opacity=al;}
    m.lmat.opacity=0.85*al;m.lmatFlash.opacity=al;m.lmatFlash.transparent=tr;
  }
  return {
    update(S,blink){
      const h=S.hero,a=S.ally;
      // ゆうしゃ
      const hp=heroParts(h);
      hero.set(hp.parts,1,h.flash>0&&blink);
      hero.obj.position.set(h.x,0,-h.z);hero.obj.rotation.y=worldYaw(S,hp.yaw);
      // まほうつかい(むき・あるきは 描画の faceTo が きめる。移行元と同じ)
      const ac=allyCast(a),ap=allyParts(a.yaw3,a.mv3||0,a.ph3||0,ac.c,ac.kind);
      ally.set(ap.parts,1,a.flash>0&&blink);
      ally.obj.position.set(a.x,0,-a.z);ally.obj.rotation.y=worldYaw(S,ap.yaw);
      // てき
      S.enemies.forEach((e,i)=>{
        let m=enemies[i];
        if(!m){m=enemies[i]=new BoxModel(80);scene.add(m.obj);}
        m.obj.visible=!e.dead;
        if(e.dead)return;
        const teleOn=e.tele>0,atkOn=e.atkTele>0;
        const eye=teleOn?'#ff2020':(atkOn?'#ffd000':null);
        let tint=e.color;if(teleOn&&blink)tint='#c04a40';
        const air=e.air||0;
        const ep=enemyParts(eye,tint,e.r,e.yaw3,e.mv3||0,e.ph3||0,teleOn||atkOn||air>0.05||e.beat===1,e.stagger>0,e.dash>0||e.beat===2); // 空中・ボコるときは りょううでを ふりあげる / たたきつけるとき まえかがみ
        m.set(ep.parts,ep.scale,e.flash>0&&blink);
        m.obj.position.set(e.x,air,-e.z);m.obj.rotation.y=worldYaw(S,ep.yaw);
      });
      // 止めをさされて 画面の外へ とんでいく てき(画面の座標 px で うごく。移行元と同じ計算)
      // 移行元の 箱モデルは 0.38 だけ 上から見た形で 描いていたので、同じ かたむきを つける
      let k0=0;
      for(const f of S.fly){
        for(let k=3;k>=0;k--){
          let m=flyPool[k0];
          if(!m){
            m=flyPool[k0]=new BoxModel(80);
            m.outer=new THREE.Group();m.inner=new THREE.Group();
            m.outer.add(m.inner);m.inner.add(m.obj);m.inner.rotation.x=0.38;flyScene.add(m.outer);
          }
          k0++;
          const tt=Math.max(0,f.t-k*0.04),gx=f.x0+f.vx*tt,gy=f.y0+f.vy*tt,sc=1+0.9*tt,s=f.s*sc;
          const ep=enemyParts('#ffffff',f.color,f.r,0,0,0,false,true,false);
          m.set(ep.parts,1,k===0&&f.t<0.1,s*ep.scale);
          m.obj.scale.setScalar(s*ep.scale);
          m.outer.position.set(gx,-gy,0);m.outer.rotation.z=-f.spin*tt;
          m.inner.position.set(0,-s*f.r*ENEMY_LOOK*1.3,0);
          m.obj.rotation.y=ep.yaw;
          m.outer.visible=true;m.outer.renderOrder=4-k;
          opacity(m,k===0?1:0.16*(4-k));
        }
      }
      for(let i=k0;i<flyPool.length;i++)flyPool[i].outer.visible=false;
      return k0>0;
    }
  };
}
