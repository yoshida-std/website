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
import {heroParts} from './render2d.js';

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
const lineMats=[];      // 画面の大きさが かわったら resolution を あわせる
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
  // parts: 移行元の 部品のリスト。scale: 大きさ。flash: 白く光る
  set(parts,scale,flash){
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
    this.lmat.linewidth=this.lmatFlash.linewidth=0.032;
    this.obj.scale.setScalar(scale);
  }
}

export function makeChars(scene){
  // 段階2: ゆうしゃは 箱モデル。まほうつかい・てきは まだ 仮の円柱
  function pillar(r,hgt,col){
    const g=new THREE.Group();
    const mat=new THREE.MeshLambertMaterial({color:col});
    const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,hgt,16),mat);m.position.y=hgt/2;g.add(m);
    const nose=new THREE.Mesh(new THREE.BoxGeometry(r*0.5,r*0.5,r*0.6),mat);nose.position.set(0,hgt*0.8,r);g.add(nose); // むきが わかるように
    scene.add(g);
    return {obj:g,mat,base:new THREE.Color(col)};
  }
  const hero=new BoxModel(80);scene.add(hero.obj);
  const ally=pillar(0.33,2.2,0x6a46b8);
  const enemies=[];
  const WHITE=new THREE.Color(0xffffff);
  function flash(c,on){c.mat.color.copy(on?WHITE:c.base);}
  // 画面から見た むき(yaw3。0=カメラのほうを向く)→ 世界の むき
  const worldYaw=(S,yaw3)=>-S.cam.yaw+(yaw3===undefined?Math.PI:yaw3);
  return {
    update(S,blink){
      const h=S.hero,a=S.ally;
      const hp=heroParts(h);
      hero.set(hp.parts,1,h.flash>0&&blink);
      hero.obj.position.set(h.x,0,-h.z);hero.obj.rotation.y=worldYaw(S,hp.yaw);
      ally.obj.position.set(a.x,0,-a.z);ally.obj.rotation.y=worldYaw(S,a.yaw3);flash(ally,a.flash>0&&blink);
      S.enemies.forEach((e,i)=>{
        let c=enemies[i];
        if(!c||c.color!==e.color){if(c)scene.remove(c.obj);c=enemies[i]=pillar(0.75,2.4,e.color);c.color=e.color;}
        c.obj.visible=!e.dead;
        if(e.dead)return;
        const sc=e.r*0.8;c.obj.scale.set(sc,sc,sc);
        c.obj.position.set(e.x,0,-e.z);c.obj.rotation.y=worldYaw(S,e.yaw3);
        const teleOn=e.tele>0;
        c.mat.color.set(e.flash>0&&blink?0xffffff:(teleOn&&blink?0xc04a40:e.color));
      });
    }
  };
}
