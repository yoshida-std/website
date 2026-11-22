// 移行元: prototype-2d.html の該当部分をそのまま移したもの(import/export だけ足した)
import {CFG,CAM,HERO_Y,LETTER,KIND_JP} from './config.js';
import {ctx as ctx0,CW,CH,DPR,BAR_H,FONT} from './screen.js';
let ctx=ctx0;
export function useCtx(c){ctx=c||ctx0;}
import {S,inp,introState,defeatCam,victoryCam,beatPhase,overShowT,overReadyT} from './logic.js';

// ================= 描画 =================
export let V=null;
// てきの 見た目の大きさ(当たり判定 e.r に かける。ロジックは かえない)。ユーザー指示「2まわり大きく」2026-11-21【仮】
export const ENEMY_LOOK=1.4;
export function toCam(x,z){const rx=x-V.camX,rz=z-V.camZ;return {l:rx*V.rx+rz*V.rz,d:rx*V.fx+rz*V.fz};}
export function proj(l,d,hgt){return {x:CW/2+l*V.F/d,y:V.HZ+(V.CAMH-hgt)*V.F/d};}
export const NEAR=0.35;
function clipPoly(p){
  const out=[];
  for(let i=0;i<p.length;i++){
    const a=p[i],b=p[(i+1)%p.length],ai=a.d>=NEAR,bi=b.d>=NEAR;
    if(ai)out.push(a);
    if(ai!==bi){const t=(NEAR-a.d)/(b.d-a.d);out.push({l:a.l+(b.l-a.l)*t,d:NEAR});}
  }
  return out;
}
function fillPoly(pts,fill){
  const c=clipPoly(pts);if(c.length<3)return;
  ctx.beginPath();
  c.forEach((q,i)=>{const s=proj(q.l,q.d,0);if(i)ctx.lineTo(s.x,s.y);else ctx.moveTo(s.x,s.y);});
  ctx.closePath();ctx.fillStyle=fill;ctx.fill();
}
function seg(a,b,col,lw){
  let A=a,B=b;
  if(A.d<NEAR&&B.d<NEAR)return;
  if(A.d<NEAR){const t=(NEAR-A.d)/(B.d-A.d);A={l:A.l+(B.l-A.l)*t,d:NEAR};}
  else if(B.d<NEAR){const t=(NEAR-B.d)/(A.d-B.d);B={l:B.l+(A.l-B.l)*t,d:NEAR};}
  const p=proj(A.l,A.d,0),q=proj(B.l,B.d,0);
  ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.strokeStyle=col;ctx.lineWidth=lw;ctx.stroke();
}
function circlePts(cx,cz,r,n){const p=[];for(let i=0;i<n;i++){const t=i/n*Math.PI*2;p.push(toCam(cx+Math.cos(t)*r,cz+Math.sin(t)*r));}return p;}
function strokeLoop(pts,col,lw){for(let i=0;i<pts.length;i++)seg(pts[i],pts[(i+1)%pts.length],col,lw);}
function groundCircle(cx,cz,r,fill,stroke,lw,n){
  const p=circlePts(cx,cz,r,n||36);
  if(fill)fillPoly(p,fill);
  if(stroke)strokeLoop(p,stroke,lw||2);
}
export function txt(s,x,y,size,color,align,stroke){
  ctx.font='bold '+size+'px '+FONT;ctx.textAlign=align||'left';ctx.textBaseline='middle';
  if(stroke){ctx.lineWidth=stroke;ctx.strokeStyle='rgba(0,0,0,.85)';ctx.lineJoin='round';ctx.strokeText(s,x,y);}
  ctx.fillStyle=color;ctx.fillText(s,x,y);
}
function rr(x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
}
const STARS=[];for(let i=0;i<40;i++)STARS.push([(i*97%100)/100,((i*53)%100)/100,1+(i%3)*0.4]);

// ================= ゆうしゃ(ローポリ3Dモデル。箱を組みあわせて 3D計算で描く) =================
// 原案: 「力士の戦士」。ちょんまげ・はちまき・たてじまの ベスト・まわしふうの帯・鉄のこて・広刃の剣
const H3C={};
function h3col(hex,f){
  let c=H3C[hex];if(!c){c=[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];H3C[hex]=c;}
  return 'rgb('+Math.min(255,Math.round(c[0]*f))+','+Math.min(255,Math.round(c[1]*f))+','+Math.min(255,Math.round(c[2]*f))+')';
}
export function h3apply(p,ops){
  let x=p[0],y=p[1],z=p[2];
  for(const o of ops){
    x-=o.p[0];y-=o.p[1];z-=o.p[2];
    const c=Math.cos(o.a),sn=Math.sin(o.a);
    if(o.t==='x'){const ny=y*c-z*sn,nz=y*sn+z*c;y=ny;z=nz;}
    else if(o.t==='y'){const nx=x*c+z*sn,nz=-x*sn+z*c;x=nx;z=nz;}
    else{const nx=x*c-y*sn,ny=x*sn+y*c;x=nx;y=ny;}
    x+=o.p[0];y+=o.p[1];z+=o.p[2];
  }
  return [x,y,z];
}
export const H3FACES=[[0,2,6,4],[1,5,7,3],[0,4,5,1],[2,3,7,6],[0,1,3,2],[4,6,7,5]];
export const H3L=(()=>{const l=[-0.45,0.85,0.55],n=Math.hypot(l[0],l[1],l[2]);return [l[0]/n,l[1]/n,l[2]/n];})();
// 白くひかる てんめつ(ゲームの じかんが とまる 演出の間も うごく)
export function blinkNow(){return Math.floor((S.t+(S.overT||0)+(S.intro?S.intro.t:0))*14)%2===0;}
// 部品のリストを つくる(Canvas 2D と WebGL の両方で つかう)
export function heroParts(h){
  const t=performance.now()/1000,mv=h?(h.mv||0):0,ph=h?(h.ph||0):0,yaw=h&&h.yaw3!==undefined?h.yaw3:Math.PI;
  // 剣ふりの 見た目の長さ(0.34秒。ためる→ふりぬく→のこし。logic の swingV)
  const SWDUR=0.34,swV=h&&h.swingV>0?h.swingV:0,pr=swV>0?1-swV/SWDUR:0,sa=h?(h.swingAng||0):0;
  const cy0=Math.cos(yaw),sy0=Math.sin(yaw);
  const PITCH=0.38,cp=Math.cos(PITCH),sp=Math.sin(PITCH);
  const parts=[];
  const B=(cx,cy,cz,sx,sy,sz,col,ops,bias)=>parts.push({c:[cx,cy,cz],s:[sx,sy,sz],col,ops:ops||[],bias:bias||0});
  // おす・ふんばるの ポーズ(ユーザー指示 2026-11-21)
  //  おす: りょうてを まえに のばして おす。からだを まえに かたむけ、足は 前後に ひらく
  //  ふんばる: りょうあしを ひらき、りょううでも ひらきぎみに。こきゅうの ように からだが ゆれる
  let pk=h?(h.pushK||0):0,fk=h?(h.firmK||0):0;const br=Math.sin(t*3.0);
  // かったときの ポーズ(ユーザー指示 2026-11-22): カメラが 正面へ まわる あいだに、ふんばりの 姿勢から うつりかわる
  //  よゆう(easy): ひだりてで 服の ほこりを はらう / ふつう(normal): ガッツポーズ(みぎてに 剣を たかく、ひだりこぶしを つきあげ、はねる)
  //  しんしょう(close): あぐらで すわりこみ、ひだりてで グッド(おやゆび)
  const VIC=(S.victory&&S.over==='win'&&h&&h===S.hero)?S.victory:null;
  let vk=0,vt=0,vg='';
  const ease=x=>x<=0?0:(x>=1?1:x*x*(3-2*x));
  if(VIC){vt=Math.max(0,VIC.t-1.0);vk=Math.min(1,vt/0.5);vk=vk*vk*(3-2*vk);vg=VIC.grade;fk=1-vk;pk=0;}
  // しんしょうは いきが あがって 肩で いき(体が 大きく うごく)。ふつうは ジャンプの 着地・ためで からだが しずむ
  const PANT=Math.sin(vt*3.3),JW=Math.sin(vt*6.5),crouch=Math.max(0,-JW);
  const bob=Math.sin(t*2)*0.012-Math.abs(Math.sin(ph))*0.04*mv+fk*(-0.05+0.022*br)-pk*0.02+(vg==='easy'?0.02*Math.sin(vt*5)*vk:0)+(vg==='close'?0.05*PANT*vk:0);
  // ---- 足(あるくと こうごに ふる) ----
  const legSw=Math.sin(ph)*0.75*mv;
  for(const sx of [-1,1]){
    const px=sx*0.14,LP=[px,0.68,0];
    const ops=[{t:'x',a:sx*legSw*(1-0.5*pk)+pk*(sx>0?-0.42:0.32)+(vg==='close'?-1.25*vk:0),p:LP},{t:'z',a:sx*(0.36*fk+(vg==='normal'?(0.2+0.2*crouch)*vk:0)),p:LP},{t:'y',a:vg==='close'?-sx*0.6*vk:0,p:LP}]; // しんしょうは あぐら(りょうあしを まえへ たおして ×に くむ)
    B(px,0.40,0,0.2,0.56,0.22,'#e3a97c',ops);           // あし
    B(px,0.19,0.01,0.215,0.2,0.235,'#f1ece0',ops);       // しろい たび
    B(px,0.07,0.07,0.24,0.1,0.36,'#7a5230',ops);         // わらじ
    B(px,0.33,0.0,0.225,0.07,0.25,'#6e3b2a',ops);        // あしの まき布
  }
  const legCount=parts.length; // ここまでが 足。これより うえが からだ・あたま・うで(かたむける)
  // ---- どうたい ----
  const bo=[{t:'y',a:0,p:[0,0,0]}];
  B(0,0.76+bob,0,0.64,0.16,0.42,'#5b2c83',bo);                         // まわしふうの おび
  B(0,0.76+bob,0.0,0.66,0.035,0.44,'#e0b84a',bo);                      // 金のふち
  B(0,0.55+bob,0.225,0.34,0.34,0.05,'#6a3a98',bo);                     // 前だれ
  B(0,0.40+bob,0.228,0.34,0.045,0.056,'#e0b84a',bo);                   // ふさ
  B(0,1.11+bob,0,0.58,0.54,0.36,'#1f9d8a',bo);                         // ベスト
  B(0,1.13+bob,0.185,0.26,0.42,0.02,'#e3a97c',bo,0.02);                // むな板(はだ)
  B(-0.2,1.11+bob,0.19,0.14,0.44,0.03,'#177a6c',bo,0.02);              // ベストの まえ(みぎ)
  B(0.2,1.11+bob,0.19,0.14,0.44,0.03,'#177a6c',bo,0.02);               // ベストの まえ(ひだり)
  B(-0.2,1.11+bob,0.205,0.03,0.44,0.01,'#e0b84a',bo,0.03);B(0.2,1.11+bob,0.205,0.03,0.44,0.01,'#e0b84a',bo,0.03);
  // せなかの さや(右かたから ひだりこしへ ななめ。剣を もどすと ここに おさまる)
  B(-0.115,1.225+bob,-0.33,0.14,1.3,0.12,'#3b2a22',[{t:'z',a:0.40,p:[-0.115,1.225+bob,-0.33]}]);
  B(-0.341,1.759+bob,-0.33,0.17,0.07,0.15,'#e0b84a',[{t:'z',a:0.40,p:[-0.341,1.759+bob,-0.33]}]);
  // うしろの おび結び(ゆれる)
  const flut=Math.sin(t*5)*0.15+0.5*mv*Math.sin(t*9);
  B(0,0.8+bob,-0.26,0.16,0.14,0.1,'#6a3a98',bo);
  for(const sx of [-1,1]){B(sx*0.06,0.62+bob,-0.31,0.07,0.36,0.03,'#e0b84a',[{t:'x',a:0.25+flut*0.3,p:[0,0.79+bob,-0.3]},{t:'z',a:sx*0.12,p:[0,0.79+bob,-0.3]}]);}
  // かたあて
  for(const sx of [-1,1]){
    B(sx*0.37,1.40+bob,0,0.27,0.12,0.32,'#707a8d',bo);
    B(sx*0.37,1.465+bob,0,0.27,0.025,0.32,'#e0b84a',bo);
  }
  // くび・あたま
  B(0,1.46+bob,0,0.15,0.1,0.15,'#d99f72',bo);
  B(0,1.72+bob,0,0.44,0.4,0.42,'#e8b184',bo);                          // かお
  B(0,1.94+bob,-0.01,0.48,0.12,0.46,'#2a1f2d',bo);                     // かみ(うえ)
  B(0,1.72+bob,-0.2,0.48,0.32,0.1,'#2a1f2d',bo);                       // かみ(うしろ)
  B(-0.235,1.76+bob,-0.02,0.05,0.26,0.36,'#2a1f2d',bo);B(0.235,1.76+bob,-0.02,0.05,0.26,0.36,'#2a1f2d',bo);
  B(0,1.855+bob,0,0.5,0.075,0.48,'#f4f1ea',bo,0.01);                   // はちまき
  B(0,1.855+bob,0.245,0.1,0.06,0.012,'#d83a3a',bo,0.03);               // 赤い まる
  const knot=[{t:'x',a:0.55,p:[0,2.0+bob,-0.06]}];
  B(0,2.12+bob,-0.06,0.13,0.2,0.13,'#2a1f2d',knot);                    // ちょんまげ
  B(0,2.02+bob,-0.05,0.17,0.045,0.17,'#d83a3a',bo,0.01);               // 赤い ひも
  // かお(目・まゆ・口・ほほ)
  for(const sx of [-1,1]){
    B(sx*0.1,1.72+bob,0.212,0.075,0.075,0.02,'#14122a',bo,0.03);
    B(sx*0.1+sx*0.012,1.735+bob,0.222,0.025,0.025,0.01,'#ffffff',bo,0.04);
    B(sx*0.1,1.81+bob,0.214,0.12,0.03,0.02,'#2a1f2d',[{t:'z',a:sx*-0.2,p:[sx*0.1,1.81+bob,0.214]}],0.03);
    B(sx*0.165,1.62+bob,0.212,0.07,0.045,0.02,'#f08a7a',bo,0.02);
    B(sx*0.235+sx*0.012,1.7+bob,0.0,0.02,0.1,0.07,'#d99f72',bo,0.01); // みみ
  }
  B(0,1.58+bob,0.212,0.1,0.028,0.02,'#8a3a3a',bo,0.03);
  // ---- ひだりうで(こて・あるくと ふる。おす: まえへ のばす。ふんばる: ひらく) ----
  const sp11=Math.sin(t*11);
  let aL=-Math.sin(ph)*0.7*mv*(1-pk)+pk*(-1.45+0.05*sp11)+fk*(-0.15),lY=-0.29*pk,lZ=(0.55+0.07*br)*fk;
  if(vk>0){
    let tA=aL,tY=lY,tZ=lZ;
    if(vg==='easy'){ // 数回(3回)だけ むねの まえで 上下に はらう。おわったら おろす
      const bk=ease((vt-0.4)/0.15)*(1-ease((vt-2.05)/0.15));
      tA=-0.2+(-0.8+0.55*Math.sin(vt*11.4))*bk;tY=-0.55*bk;tZ=0.2*(1-bk);
    }
    else if(vg==='normal'){tA=-1.75-0.35*Math.sin(vt*6.5+Math.PI)+0.3*crouch;tY=-0.25;tZ=0.12;} // こぶしを つきあげる(しゃがむとき すこし さげる)
    else{tA=-1.85+0.07*PANT;tY=-0.15;tZ=0;}                                      // グッド(いきに あわせて ゆれる)
    aL+=(tA-aL)*vk;lY+=(tY-lY)*vk;lZ+=(tZ-lZ)*vk;
  }
  const la=[{t:'x',a:aL,p:[0.38,1.34+bob,0]},{t:'y',a:lY,p:[0.38,1.34+bob,0]},{t:'z',a:lZ,p:[0.38,1.34+bob,0]}];
  B(0.38,1.19+bob,0,0.16,0.3,0.16,'#e8b184',la);
  B(0.38,0.89+bob,0,0.21,0.3,0.21,'#8d96a8',la);
  B(0.38,0.89+bob,0,0.225,0.05,0.225,'#e0b84a',la);
  B(0.38,0.68+bob,0,0.13,0.11,0.13,'#e8b184',la);
  if(vg==='close'&&vk>0.3)B(0.38,0.68+bob,0.1,0.06,0.07,0.17,'#e8b184',la,0.02); // おやゆび(グッド)
  // ---- みぎうで + 広刃の剣(フリックで ふる) ----
  const a0=-1.15+0.55*fk-0.3*pk+0.05*pk*sp11;let aA=a0,bA=0.29*pk,swK=0,swQ=0,swU=0,swVv=0,swingOps=[];
  const PB=[-0.38,1.34+bob,0];
  if(swV>0){
    // フリックの 画面での むき(右=+u 上=+v)に そって、肩を中心に 剣を 大きく ふる。
    // ふる面の 軸は「正面」と「ふりの むき」に 垂直: Rz(φ)·Rx(θ)·Rz(-φ)
    const u=Math.cos(sa),v=-Math.sin(sa);swU=u;swVv=v;
    swK=Math.min(1,pr/0.12,(1-pr)/0.15);                 // ふる間は ポーズの うでの ひらきを もどす
    aA=a0*(1-swK)-0.9*swK;bA*=(1-swK);
    const TH=1.25+0.35*Math.abs(u);                      // よこぶりは 大きく(約92°)、たてぶりは すこし 小さく
    const phi=Math.atan2(-Math.cos(sa),Math.sin(sa));
    // 進行: 0〜0.2 ためる(はんたいがわへ) / 0.2〜0.62 ふりぬく / 0.62〜 のこし → もとへ
    let q;
    if(pr<0.2)q=-0.85*Math.sin(pr/0.2*Math.PI/2);
    else if(pr<0.62){const x=(pr-0.2)/0.42;q=-0.85+1.85*(x*x*(3-2*x));}
    else q=1-0.12*((pr-0.62)/0.38);
    q*=Math.min(1,(1-pr)/0.2);
    // +か- か: 先が 画面で フリックの むきへ うごくように きめる
    const PT=[-0.38,1.34,0];
    const tip=th=>{const p=h3apply([-0.38,0.7,1.2],[{t:'x',a:-0.9,p:PT},{t:'z',a:-phi,p:PT},{t:'x',a:th,p:PT},{t:'z',a:phi,p:PT}]);return [p[0]*cy0+p[2]*sy0,p[1]];};
    const t1=tip(0.35),t2=tip(-0.35);
    const sgn=((t1[0]-t2[0])*u+(t1[1]-t2[1])*v>=0)?1:-1;
    swQ=q;
    swingOps=[{t:'z',a:-phi,p:PB},{t:'x',a:sgn*TH*q,p:PB},{t:'z',a:phi,p:PB}];
  }
  let wr=0,rZ=0,zt=0,frozen=false;
  const aF=-2.6;                                                     // 剣を 背中の さやへ もどす とき の 腕の かくど
  if(vk>0){ // かったときの みぎうで(剣)
    let tA=aA,tB=0;
    if(vg==='easy'){ // ほこりを はらったあと、剣を かかげ → 肩ごしに うしろへ まわし → 背中の さやに おさめる(チャキン)
      const s1=ease((vt-2.2)/0.45),s2=ease((vt-2.65)/0.55),r=ease((vt-3.45)/0.5);
      if(vt<3.45){tA=-0.45+(aF+0.45)*s1;tB=Math.PI*s2;zt=0.40*s2;wr=s2>0?(1-s2)*(-Math.PI/2-aF)+s2*(aF-Math.PI/2):s1*(-Math.PI/2-tA);}
      else{frozen=true;tA=aF+(-0.45-aF)*r;tB=Math.PI*(1-r);}  // おさめおわったら 手だけ もどる(剣は さやに のこる)
    }
    else if(vg==='normal'){tA=-2.45+0.25*Math.sin(vt*6.5);rZ=-0.2*vk;wr=vk*(-Math.PI/2-tA);} // 剣を たかく かかげる(手首で まっすぐ たてる)
    else{tA=0.2;tB=-1.2;wr=vk*(-tA);}                               // 剣を からだの よこに ねかせる(カメラのほうへ むけない)
    aA+=(tA-aA)*vk;bA=bA*(1-vk)+tB*vk;
    if(vg==='easy')wr*=vk;
  }
  const ra=[{t:'x',a:aA,p:PB},{t:'y',a:bA,p:PB},{t:'z',a:-(0.55+0.07*br)*fk*(1-swK)+rZ,p:PB}].concat(swingOps);
  // 剣だけ 手首で まげる。さやに おさめた あとは さやの ざひょうに ひょうじゅんで とめる(腕の うごきと はなれる)
  const handAbs=o=>h3apply([-0.38,0.70+bob,0],o);
  let rs=ra;
  if(frozen){const o=[{t:'x',a:aF,p:PB},{t:'y',a:Math.PI,p:PB},{t:'z',a:0,p:PB}],hp=handAbs(o);rs=o.concat([{t:'x',a:aF-Math.PI/2,p:hp},{t:'z',a:0.40,p:hp}]);}
  else if(wr||zt){const hp=handAbs(ra);rs=ra.concat(wr?[{t:'x',a:wr,p:hp}]:[],zt?[{t:'z',a:zt,p:hp}]:[]);}
  B(-0.38,1.19+bob,0,0.16,0.3,0.16,'#e8b184',ra);
  B(-0.38,0.89+bob,0,0.21,0.3,0.21,'#8d96a8',ra);
  B(-0.38,0.89+bob,0,0.225,0.05,0.225,'#e0b84a',ra);
  B(-0.38,0.70+bob,0,0.13,0.13,0.13,'#e8b184',ra);
  B(-0.38,0.70+bob,0.06,0.07,0.07,0.26,'#7a2a2a',rs);                  // つか
  B(-0.38,0.70+bob,-0.1,0.09,0.09,0.06,'#e0b84a',rs);                  // かしら
  B(-0.38,0.70+bob,0.2,0.28,0.06,0.06,'#e0b84a',rs);                   // つば
  B(-0.38,0.70+bob,0.74,0.2,0.04,1.0,'#e4eaf3',rs,0.01);               // 刃(ひろい)
  B(-0.47,0.70+bob,0.74,0.04,0.07,1.0,'#aab6c8',rs);                   // むね
  B(-0.38,0.70+bob,1.30,0.12,0.04,0.14,'#e4eaf3',rs);                  // きっさき
  B(-0.38,0.70+bob,1.38,0.05,0.04,0.06,'#e4eaf3',rs);
  // からだ(足より うえ)を こしを中心に かたむける: おす=まえへ、ふんばる=こきゅうで ゆらぐ
  // ふるときは からだも ひねり、うえへ ふれば のけぞり したへ ふれば まえへ かたむく
  const lean=0.24*pk+0.05*fk+0.035*br*fk-0.14*swVv*swQ+vk*(vg==='easy'?0.1:(vg==='normal'?-0.1+0.03*JW+0.14*crouch:(vg==='close'?0.14+0.09*PANT:0))),twist=0.3*swU*swQ*cy0;
  if(lean||twist){const lo=[{t:'y',a:twist,p:[0,0.7,0]},{t:'x',a:lean,p:[0,0.7,0]}];for(let i=legCount;i<parts.length;i++)parts[i].ops=parts[i].ops.concat(lo);}
  // かったときの うごき: ふつうは はねる / しんしょうは こしを ゆかへ おとす
  {const ys=vg==='normal'?(0.3*Math.max(0,JW)-0.16*crouch)*vk:(vg==='close'?-0.55*vk:0);
   if(ys)for(const pt of parts){pt.c=[pt.c[0],pt.c[1]+ys,pt.c[2]];pt.ops=pt.ops.map(o=>({t:o.t,a:o.a,p:[o.p[0],o.p[1]+ys,o.p[2]]}));}}
  // 痛恨の一撃で ふっとぶ / まけて たおれる(ユーザー指示 2026-11-21): うしろむきに 1回転して とび、あおむけに たおれ、(たおれたままでなければ)おきあがる
  let yawOut=yaw;
  const crit=h&&h.hitT>=0&&h.stunMax>0,fallen=h&&h.dead&&!crit;
  if(crit||fallen){
    const LY=[0,0.12,-0.22],FL=0.5,GU=0.5;
    let ang,air=0,piv=LY,yo=0;
    if(crit){
      const ST=h.stunMax,ht=h.hitT;
      if(ht<FL){const u=ht/FL,e=1-(1-u)*(1-u);ang=-(Math.PI*2+Math.PI/2)*e;air=2.6*4*u*(1-u);piv=[0,1.0-0.88*u,-0.22*u];yo=Math.PI/2*e;}
      else if(h.dead||ht<ST-GU){ang=-Math.PI/2;yo=Math.PI/2;}
      else{const v=Math.min(1,(ht-(ST-GU))/GU),e=v*v*(3-2*v);ang=-Math.PI/2*(1-e);yo=Math.PI/2*(1-e);}
    }else{ // まけた: うしろへ ばたりと たおれる
      const u=Math.min(1,(S.defeat?S.defeat.t:0)/0.45);ang=-Math.PI/2*u*u;yo=Math.PI/2*u*u*(3-2*u); // たおれながら よこむきに まわる
    }
    if(h.dead&&(h.hitK||0)>0)air+=0.14*h.hitK; // ボコられるたびに からだが はねる
    yawOut=yaw+yo;
    const to=[{t:'x',a:ang,p:piv}];
    for(const pt of parts){
      pt.ops=pt.ops.concat(to);
      if(air){pt.c=[pt.c[0],pt.c[1]+air,pt.c[2]];pt.ops=pt.ops.map(o=>({t:o.t,a:o.a,p:[o.p[0],o.p[1]+air,o.p[2]]}));}
    }
  }
  return {parts,yaw:yawOut};
}
export function drawHero(x,y,s,fl,h){const m=heroParts(h);h3render(m.parts,x,y,s,fl,m.yaw,0);}
export function h3render(parts,x,y,s,fl,yaw,lean){
  const cy0=Math.cos(yaw),sy0=Math.sin(yaw),PITCH=0.38,cp=Math.cos(PITCH),sp=Math.sin(PITCH);
  const faces=[];
  for(const pt of parts){
    const V=[];
    for(let i=0;i<8;i++){
      const p=[pt.c[0]+((i&1)?0.5:-0.5)*pt.s[0],pt.c[1]+((i&2)?0.5:-0.5)*pt.s[1],pt.c[2]+((i&4)?0.5:-0.5)*pt.s[2]];
      const q=h3apply(p,pt.ops);
      V.push([q[0]*cy0+q[2]*sy0,q[1],-q[0]*sy0+q[2]*cy0]); // むきを回す
    }
    const bc=[0,0,0];for(const v of V){bc[0]+=v[0]/8;bc[1]+=v[1]/8;bc[2]+=v[2]/8;}
    for(const f of H3FACES){
      const a=V[f[0]],b=V[f[1]],c=V[f[2]];
      let nx=(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),ny=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),nz=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
      const fc=[(a[0]+V[f[2]][0])/2,(a[1]+V[f[2]][1])/2,(a[2]+V[f[2]][2])/2];
      if(nx*(fc[0]-bc[0])+ny*(fc[1]-bc[1])+nz*(fc[2]-bc[2])<0){nx=-nx;ny=-ny;nz=-nz;}
      const nl=Math.hypot(nx,ny,nz)||1;nx/=nl;ny/=nl;nz/=nl;
      if(ny*sp+nz*cp<=0.001)continue; // うらがわは かかない
      const lam=Math.max(0,nx*H3L[0]+ny*H3L[1]+nz*H3L[2]);
      faces.push({v:[V[f[0]],V[f[1]],V[f[2]],V[f[3]]],col:pt.col,f:0.52+0.62*lam,d:fc[1]*sp+fc[2]*cp+pt.bias});
    }
  }
  faces.sort((m,n)=>m.d-n.d);
  ctx.save();ctx.translate(x,y);ctx.lineJoin='round';
  ctx.strokeStyle=fl?'#ffffff':'rgba(12,14,38,.85)';ctx.lineWidth=Math.max(1,s*0.032);
  for(const fa of faces){
    ctx.beginPath();
    for(let k=0;k<4;k++){const v=fa.v[k],X=v[0]*s,Y=-(v[1]*cp-v[2]*sp)*s;if(k)ctx.lineTo(X,Y);else ctx.moveTo(X,Y);}
    ctx.closePath();ctx.fillStyle=fl?'#ffffff':h3col(fa.col,fa.f);ctx.fill();ctx.stroke();
  }
  ctx.restore();
}
function h3mix(hex,f){const c=[1,3,5].map(i=>Math.max(0,Math.min(255,Math.round(parseInt(hex.slice(i,i+2),16)*f))));return '#'+c.map(v=>v.toString(16).padStart(2,'0')).join('');}
function h3leanAll(parts,ops){for(const pt of parts)pt.ops=pt.ops.concat(ops);}
// まほうつかい: 星のぼうしの ローブ。つえの たまが ひかる
export function faceTo(o,tx,tz,rate){
  const now=performance.now()/1000,dt=Math.min(0.05,Math.max(0,now-(o._tt||now)));o._tt=now;
  const dx=o.x-(o._px===undefined?o.x:o._px),dz=o.z-(o._pz===undefined?o.z:o._pz);o._px=o.x;o._pz=o.z;
  const sp=dt>0?Math.hypot(dx,dz)/dt:0;o.mv3=Math.min(1,sp/2.5);o.ph3=(o.ph3||0)+Math.min(sp,8)*dt*3.2;
  const c1=toCam(o.x,o.z),c2=toCam(tx,tz),dl=c2.l-c1.l,dd=c2.d-c1.d;
  if(Math.hypot(dl,dd)>0.05){const ta=Math.atan2(dl,-dd);let da=ta-(o.yaw3===undefined?Math.PI:o.yaw3);da=Math.atan2(Math.sin(da),Math.cos(da));o.yaw3=(o.yaw3===undefined?Math.PI:o.yaw3)+Math.max(-rate*dt,Math.min(rate*dt,da));}
  else if(o.yaw3===undefined)o.yaw3=Math.PI;
}
export function allyParts(yaw,mv,ph,cast){
  const t=performance.now()/1000,bob=Math.sin(t*2.3)*0.02-Math.abs(Math.sin(ph))*0.05*mv;
  const parts=[],B=(cx,cy,cz,sx,sy,sz,col,ops,bias)=>parts.push({c:[cx,cy,cz],s:[sx,sy,sz],col,ops:ops||[],bias:bias||0});
  const sw=Math.sin(ph)*0.5*mv;
  for(const sx of [-1,1])B(sx*0.13,0.09,0.05+sx*sw*0.1,0.2,0.14,0.34,'#4a3320',[{t:'x',a:sx*sw,p:[sx*0.13,0.4,0]}]);
  B(0,0.35+bob,0,0.74,0.34,0.5,'#5b3aa0');B(0,0.62+bob,0,0.62,0.3,0.44,'#6a46b8');B(0,0.88+bob,0,0.5,0.26,0.4,'#7352c8');
  B(0,0.6+bob,0.24,0.1,0.8,0.02,'#e0b84a',[],0.02);                // ローブの 金のすじ
  B(0,0.74+bob,0,0.56,0.08,0.44,'#e0b84a');                          // おび
  B(0,1.12+bob,0,0.46,0.34,0.36,'#5b3aa0');                           // むね
  B(0,1.34+bob,0,0.56,0.1,0.44,'#3f2a80');B(0,1.32+bob,0,0.4,0.05,0.4,'#e0b84a'); // えり
  B(0,1.6+bob,0,0.36,0.34,0.34,'#f1c9a0');                            // かお
  for(const sx of [-1,1]){B(sx*0.09,1.62+bob,0.175,0.07,0.08,0.02,'#14122a',[],0.03);B(sx*0.13,1.54+bob,0.175,0.06,0.04,0.02,'#f08a7a',[],0.02);}
  B(0,1.46+bob,0.14,0.34,0.22,0.12,'#e9e6f2');B(0,1.32+bob,0.14,0.2,0.22,0.1,'#e9e6f2'); // ひげ
  B(0,1.8+bob,0,0.74,0.07,0.74,'#3f2a80');                            // ぼうしの つば
  B(0,1.95+bob,0,0.5,0.24,0.5,'#4a32a0');B(0,2.17+bob,-0.02,0.34,0.22,0.34,'#4a32a0',[{t:'x',a:-0.12,p:[0,2.0,0]}]);
  B(0,2.36+bob,-0.08,0.2,0.2,0.2,'#4a32a0',[{t:'x',a:-0.3,p:[0,2.0,0]}]);B(0,2.52+bob,-0.2,0.1,0.14,0.1,'#e0b84a',[{t:'x',a:-0.5,p:[0,2.0,0]}]);
  B(0,1.9+bob,0.255,0.5,0.06,0.02,'#e0b84a',[],0.03);
  // うで(ひだり: ふる / みぎ: つえ)
  B(-0.34,1.05+bob,0.0,0.16,0.4,0.16,'#6a46b8',[{t:'x',a:-sw*0.8,p:[-0.34,1.28,0]}]);B(-0.34,0.82+bob,0.0,0.12,0.1,0.12,'#f1c9a0',[{t:'x',a:-sw*0.8,p:[-0.34,1.28,0]}]);
  const ca=-0.5-0.9*Math.min(1,cast||0),ra=[{t:'x',a:ca,p:[0.34,1.28+bob,0]}];
  B(0.34,1.05+bob,0,0.16,0.4,0.16,'#6a46b8',ra);B(0.34,0.82+bob,0,0.12,0.1,0.12,'#f1c9a0',ra);
  B(0.34,0.82+bob,0.02,0.07,0.07,1.9,'#a0702a',ra);                  // つえ
  const pul=0.14+0.04*Math.sin(t*6)+0.08*Math.min(1,cast||0);
  B(0.34,0.82+bob,1.05,pul*1.5,pul*1.5,pul*1.5,'#7cf5ff',ra,0.05);   // たま
  B(0.34,0.82+bob,0.9,0.16,0.16,0.06,'#e0b84a',ra);
  return {parts,yaw};
}
export function drawAlly(x,y,s,fl,yaw,mv,ph,cast){const m=allyParts(yaw,mv,ph,cast);h3render(m.parts,x,y,s,fl,m.yaw,0);}
// てき: どっしりした「どすこいオーガ」。あたまに つの、おなかが ふくらみ、まわしを しめる
export function enemyParts(eyeCol,tint,sc,yaw,mv,ph,atk,stag,dash){
  yaw=yaw===undefined?Math.PI:yaw;mv=mv||0;ph=ph||0;
  const t=performance.now()/1000,bob=Math.sin(t*1.7)*0.02-Math.abs(Math.sin(ph))*0.06*mv;
  const dk=h3mix(tint,0.68),lt=h3mix(tint,1.22),skin=tint;
  const parts=[],B=(cx,cy,cz,sx,sy,sz,col,ops,bias)=>parts.push({c:[cx,cy,cz],s:[sx,sy,sz],col,ops:ops||[],bias:bias||0});
  const sw=Math.sin(ph)*0.6*mv;
  for(const sx of [-1,1]){const lo=[{t:'x',a:sx*sw,p:[sx*0.4,0.8,0]}];
    B(sx*0.4,0.42,0,0.58,0.78,0.6,dk,lo);B(sx*0.4,0.08,0.08,0.66,0.16,0.8,h3mix(tint,0.5),lo);}
  B(0,1.0+bob,0,1.72,0.34,1.2,'#7a2030');B(0,0.82+bob,0.62,0.62,0.52,0.05,'#8f2a40',[],0.02);B(0,1.0+bob,0.0,1.74,0.05,1.22,'#e0b84a'); // まわし
  B(0,1.5+bob,0,1.6,0.9,1.1,skin);                                  // どうたい(はら)
  B(0,1.5+bob,0.56,1.1,0.7,0.04,lt,[],0.02);                         // はらの うす色
  B(0,1.3+bob,0.58,0.12,0.12,0.03,dk,[],0.04);                       // へそ
  B(0,2.0+bob,0,1.9,0.34,1.0,dk);                                   // かた
  for(const sx of [-1,1]){B(sx*0.9,2.28+bob,0,0.34,0.3,0.34,'#cfd6e4',[{t:'z',a:sx*0.5,p:[sx*0.9,2.2,0]}]);}   // かたの とげ
  // うで: 予告中は 両手を ふりあげる
  const up=atk?-2.5-0.15*Math.sin(t*14):0;
  for(const sx of [-1,1]){
    const aa=up?up:Math.sin(ph+sx)*0.5*mv,ao=[{t:'x',a:aa,p:[sx*1.12,2.0+bob,0]}];
    B(sx*1.12,1.55+bob,0,0.52,0.9,0.52,skin,ao);B(sx*1.12,1.0+bob,0,0.62,0.3,0.62,'#8d96a8',ao);B(sx*1.12,0.8+bob,0.0,0.66,0.3,0.66,lt,ao);
  }
  // あたま
  B(0,2.4+bob,0.05,0.96,0.7,0.86,skin);B(0,2.12+bob,0.38,0.7,0.2,0.2,lt,[],0.01);   // かお・あご
  B(0,2.74+bob,-0.04,1.0,0.12,0.9,dk);                               // かみ
  for(const sx of [-1,1]){
    B(sx*0.38,2.9+bob,0.0,0.16,0.4,0.16,'#f0e6c8',[{t:'z',a:sx*-0.35,p:[sx*0.38,2.74,0]}]);   // つの
    B(sx*0.43,3.14+bob,0.0,0.1,0.2,0.1,'#f0e6c8',[{t:'z',a:sx*-0.6,p:[sx*0.38,2.74,0]}]);
    B(sx*0.2,2.5+bob,0.44,0.22,0.16,0.04,eyeCol||'#ffe36a',[],0.04);   // め
    B(sx*0.2,2.62+bob,0.45,0.3,0.06,0.04,dk,[{t:'z',a:sx*0.35,p:[sx*0.2,2.62,0.45]}],0.05); // まゆ
    B(sx*0.17,2.16+bob,0.46,0.09,0.2,0.06,'#f6f2e6',[],0.05);            // きば
  }
  B(0,2.3+bob,0.46,0.14,0.1,0.03,dk,[],0.04);
  const ln=[];
  if(stag)ln.push({t:'z',a:Math.sin(t*18)*0.09,p:[0,0,0]});
  if(dash)ln.push({t:'x',a:0.35,p:[0,0.5,0]});
  if(ln.length)h3leanAll(parts,ln);
  return {parts,yaw,scale:sc*0.8*ENEMY_LOOK};
}
export function drawEnemy(x,y,s,fl,eyeCol,tint,sc,yaw,mv,ph,atk,stag,dash){const m=enemyParts(eyeCol,tint,sc,yaw,mv,ph,atk,stag,dash);h3render(m.parts,x,y,s*m.scale,fl,m.yaw,0);}
export function bar(x,y,w,hh,ratio,col){
  ctx.fillStyle='#000';ctx.fillRect(x,y,w,hh);
  ctx.fillStyle=col;ctx.fillRect(x+1,y+1,Math.max(0,(w-2)*Math.max(0,Math.min(1,ratio))),hh-2);
  ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.strokeRect(x+0.5,y+0.5,w-1,hh-1);
}
export function bubble(label,x,y,fs,edge){
  ctx.font='bold '+fs+'px '+FONT;const w=ctx.measureText(label).width+12;
  ctx.fillStyle='rgba(8,12,70,.82)';rr(x-w/2,y-fs/2-3,w,fs+6,8);ctx.fill();
  ctx.strokeStyle=edge;ctx.lineWidth=1.5;ctx.stroke();
  txt(label,x,y,fs,'#fff','center');
}
const ANGLE_JP={front:'まえ',side:'よこ',back:'うしろ'};


// ================= 背景(夜の遺跡の闘技場ふう。添付イメージにあわせた色づかい) =================
function hs(n){n=n|0;n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);n=n^(n>>>16);return ((n>>>0)%1000)/1000;}
function mod(a,b){return ((a%b)+b)%b;}
export const CONSTEL=[ // 星座(0〜1の座標。画面の横いっぱいを 1 まわりとして くりかえす)
  [[0.06,0.50],[0.14,0.26],[0.24,0.40],[0.31,0.18]],
  [[0.46,0.55],[0.55,0.30],[0.68,0.34],[0.74,0.58],[0.55,0.30]],
  [[0.84,0.22],[0.92,0.36],[0.98,0.20]]
];
export function drawBackdrop(){
  const HZ=V.HZ,t=performance.now()/1000,yaw=S.cam.yaw;
  // よぞら
  const sg=ctx.createLinearGradient(0,0,0,HZ);sg.addColorStop(0,'#070b25');sg.addColorStop(0.6,'#13204a');sg.addColorStop(1,'#2b4676');
  ctx.fillStyle=sg;ctx.fillRect(-20,-20,CW+40,HZ+22);
  const off=mod(yaw*CW*0.25,CW);
  ctx.fillStyle='#fff';
  for(const st of STARS){ctx.globalAlpha=0.55+0.3*Math.sin(t*2+st[0]*40);ctx.fillRect(mod(st[0]*CW-off,CW),st[1]*HZ*0.8,st[2],st[2]);}
  // 星座(せんで むすぶ)
  ctx.globalAlpha=1;ctx.lineWidth=1.2;ctx.lineJoin='round';
  for(let tile=-1;tile<=1;tile++){
    const ox=tile*CW-off+CW*0.0;
    for(const c of CONSTEL){
      ctx.strokeStyle='rgba(170,200,255,.34)';ctx.beginPath();
      c.forEach((q,i)=>{const X=ox+q[0]*CW,Y=q[1]*HZ*0.7;if(i)ctx.lineTo(X,Y);else ctx.moveTo(X,Y);});ctx.stroke();
      ctx.fillStyle='#dbe8ff';
      for(const q of c){ctx.beginPath();ctx.arc(ox+q[0]*CW,q[1]*HZ*0.7,2.1,0,Math.PI*2);ctx.fill();}
    }
  }
  // とおくの遺跡(アーチのならぶ へい・とう・たいまつ)
  const U=96,wh=Math.min(112,HZ*0.62),offW=yaw*CW*0.8,base=Math.floor(offW/U),frac=offW-base*U,n=Math.ceil(CW/U)+3;
  for(let i=-1;i<n;i++){
    const x=i*U-frac,idx=i+base,r=hs(idx*7+3);
    const top=HZ-wh*(r<0.18?0.55:(r<0.4?0.85:1));
    ctx.fillStyle='#232d47';ctx.fillRect(x,top,U+1,HZ-top);
    ctx.fillStyle='#41507a';ctx.fillRect(x,top,U+1,3);
    if(r>=0.18){
      const aw=U*0.5,ah=(HZ-top)*0.62,ax=x+(U-aw)/2;
      ctx.fillStyle='#0f152a';ctx.beginPath();ctx.moveTo(ax,HZ);ctx.lineTo(ax,HZ-ah+aw/2);ctx.arc(ax+aw/2,HZ-ah+aw/2,aw/2,Math.PI,0);ctx.lineTo(ax+aw,HZ);ctx.closePath();ctx.fill();
    }
    ctx.fillStyle='#34426a';ctx.fillRect(x-U*0.07,top+3,U*0.14,HZ-top-3);
  }
  for(let i=-1;i<n;i++){
    const x=i*U-frac,idx=i+base;
    if(mod(idx,9)===0){ // とう
      const w=U*0.58,hg=wh*1.75,cx=x+U*0.5;
      ctx.fillStyle='#2b3656';ctx.fillRect(cx-w/2,HZ-hg,w,hg);
      ctx.fillStyle='#41507a';ctx.fillRect(cx-w/2-3,HZ-hg,w+6,4);
      ctx.fillStyle='#2b3656';for(let k=0;k<3;k++)ctx.fillRect(cx-w/2-3+k*(w+6)/3,HZ-hg-7,(w+6)/5,7);
      ctx.fillStyle='rgba(255,205,110,.85)';ctx.fillRect(cx-3,HZ-hg*0.7,6,11);
    }
    if(mod(idx,4)===0){ // たいまつ
      const fy=HZ-wh*0.28,fl=0.85+0.15*Math.sin(t*9+idx*1.7);
      const g=ctx.createRadialGradient(x,fy,2,x,fy,30*fl);g.addColorStop(0,'rgba(255,176,80,.65)');g.addColorStop(1,'rgba(255,140,50,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,fy,30*fl,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#5a4632';ctx.fillRect(x-1.5,fy+4,3,9);
      ctx.fillStyle='#ffc15a';ctx.beginPath();ctx.ellipse(x,fy,3.2,5.5*fl,0,0,Math.PI*2);ctx.fill();
    }
  }
}
function drawFloor(h,A){
  const HZ=V.HZ;
  // いしだたみの ゆか
  const fg=ctx.createLinearGradient(0,HZ,0,CH);fg.addColorStop(0,'#27324f');fg.addColorStop(0.45,'#38446a');fg.addColorStop(1,'#4b577a');
  ctx.fillStyle=fg;ctx.fillRect(-20,HZ,CW+40,CH-HZ+20);
  // しきいし(つなぎめ)
  const GS=2.6,x0=Math.floor((h.x-46)/GS),x1=Math.ceil((h.x+46)/GS),z0=Math.floor((h.z-46)/GS),z1=Math.ceil((h.z+46)/GS);
  for(let xi=x0;xi<=x1;xi++)seg(toCam(xi*GS,z0*GS),toCam(xi*GS,z1*GS),'rgba(8,12,32,.55)',1.2);
  for(let zi=z0;zi<=z1;zi++){
    seg(toCam(x0*GS,zi*GS),toCam(x1*GS,zi*GS),'rgba(8,12,32,.55)',1.2);
    // ならびを ずらした 石のつなぎめ
    for(let xi=x0;xi<=x1;xi+=1){const xm=(xi+((zi&1)?0.5:0))*GS;seg(toCam(xm,zi*GS),toCam(xm,(zi+1)*GS),'rgba(8,12,32,.32)',1);}
  }
  // とおくは かすんで みえる
  const hz=ctx.createLinearGradient(0,HZ,0,HZ+90);hz.addColorStop(0,'rgba(80,115,185,.42)');hz.addColorStop(1,'rgba(80,115,185,0)');
  ctx.fillStyle=hz;ctx.fillRect(-20,HZ,CW+40,90);
}
// どひょう(まるい闘技場)。ふちの金色の線が 場外の目じるし
export function drawArena(A,P){
  P=P||P2D;
  const K=A.R/11; // 土俵の大きさに あわせて 線の こまかさを ふやす
  P.groundCircle(A.cx,A.cz,A.R,'#566384',null,0,Math.round(56*K));
  P.groundCircle(A.cx,A.cz,A.R*0.66,null,'rgba(225,195,115,.30)',1.5,48);
  P.groundCircle(A.cx,A.cz,A.R*0.33,null,'rgba(225,195,115,.30)',1.5,36);
  for(let n1=Math.round(16*K),i=0;i<n1;i++){const t=i/n1*Math.PI*2;P.seg(toCam(A.cx,A.cz),toCam(A.cx+Math.cos(t)*A.R,A.cz+Math.sin(t)*A.R),'rgba(225,195,115,.16)',1.2);}
  for(let n2=Math.round(48*K),i=0;i<n2;i++){const t=i/n2*Math.PI*2,c=Math.cos(t),s2=Math.sin(t);P.seg(toCam(A.cx+c*(A.R-1.3),A.cz+s2*(A.R-1.3)),toCam(A.cx+c*(A.R-0.7),A.cz+s2*(A.R-0.7)),'rgba(225,195,115,.55)',2);}
  P.groundCircle(A.cx,A.cz,A.R,null,'#e0bd6a',4,Math.round(56*K));
  P.groundCircle(A.cx,A.cz,A.R-0.6,null,'rgba(224,189,106,.5)',1.5,Math.round(56*K));
}

// ---- 1フレームの描画を、部品に分けたもの(WebGL 版も 同じ部品を つかう) ----
// setupView: カメラ(V)を きめる。ゆうしゃの足もとが 画面のたて半分あたりに くるよう、地平線の位置を決める
// ゆかに描く道具(Canvas 2D 版)。WebGL 版は render3d.js に 同じ形のものがある
export const P2D={
  dash:a=>ctx.setLineDash(a),
  seg:(a,b,col,lw)=>seg(a,b,col,lw),
  fillPoly:(pts,fill)=>fillPoly(pts,fill),
  groundCircle:(cx,cz,r,fill,stroke,lw,n)=>groundCircle(cx,cz,r,fill,stroke,lw,n),
  dot:(m,col)=>{if(m.d>NEAR){const p=proj(m.l,m.d,0.05);ctx.beginPath();ctx.arc(p.x,p.y,Math.max(4,V.F/m.d*0.18),0,Math.PI*2);ctx.fillStyle=col;ctx.globalAlpha=0.9;ctx.fill();ctx.globalAlpha=1;}}
};
export function setupView(){
  if(S.intro||S.defeat||(S.victory&&S.over==='win')){ // スタートの演出 / まけたときの カメラ / かったときの カメラ(ゆうしゃの 正面へ まわる)
    const I=S.intro?introState(S):(S.defeat?defeatCam(S):victoryCam(S)),fx=Math.sin(I.yaw),fz=Math.cos(I.yaw),F0=CW*I.fov;
    const Df=Math.max(0.6,(I.fpx-I.cx)*fx+(I.fpz-I.cz)*fz); // 注目している 点までの きょり
    V={camX:I.cx,camZ:I.cz,fx,fz,rx:fz,rz:-fx,F:F0,HZ:CH*I.yf-I.h*F0/Df,CAMH:I.h};
    return V;
  }
  const h=S.hero,yaw=S.cam.yaw,fx=Math.sin(yaw),fz=Math.cos(yaw);
  const F0=CW*CAM.fov;
  V={camX:h.x-fx*CAM.back,camZ:h.z-fz*CAM.back,fx,fz,rx:fz,rz:-fx,F:F0,HZ:CH*HERO_Y-CAM.h*F0/CAM.back,CAMH:CAM.h};
  return V;
}
// ゆかの しるし(ねらい線・てきのまえ・こうげきの よこく・当たり円・おしあいの色)
export function drawGroundMarks(P){
  P=P||P2D;
  const h=S.hero,a=S.ally,E=S.enemies.filter(e=>!e.dead),L=S.enemies[S.lock];
  // てきのねらい線と、てきのまえ
  for(const e of E){
    if((e.air||0)>0.05)continue; // 空中の てきの しるしは 着地してから
    const pts=[toCam(e.x,e.z)];const base=Math.atan2(e.fz,e.fx);
    for(let i=-4;i<=4;i++){const t=base+i/4*0.61;pts.push(toCam(e.x+Math.cos(t)*3.4,e.z+Math.sin(t)*3.4));}
    P.fillPoly(pts,'rgba(255,80,60,.11)');
    if(e.atkTele>0){ // こうげきの よこく(ゆかに赤い範囲)
      const pr=1-e.atkTele/(e.atkMax||1);
      if(e.atkKind==='sweep'){
        P.groundCircle(e.x,e.z,e.r+CFG.atkSweep.r,'rgba(255,60,40,'+(0.10+0.14*pr)+')','rgba(255,110,80,.85)',2.5,40);
      }else if(e.atkKind==='charge'){
        const lw=8+10*pr;
        P.seg(toCam(e.x,e.z),toCam(e.cx,e.cz),'rgba(255,70,50,'+(0.35+0.3*pr)+')',lw);
        P.groundCircle(e.cx,e.cz,e.r*0.7,null,'rgba(255,110,80,.9)',2.5,20);
      }
    }
  }
  // 当たり円
  const st=h.stance;
  P.groundCircle(h.x,h.z,h.r,st==='firm'?'rgba(90,200,255,.45)':(st==='push'?'rgba(255,220,90,.45)':'rgba(120,160,255,.3)'),'#8cf',2);
  if(st==='firm')P.groundCircle(h.x,h.z,h.r+0.22,null,'rgba(120,220,255,.6)',2);
  P.groundCircle(a.x,a.z,a.r,'rgba(170,120,255,.3)','#c9a0ff',2);
  for(const e of E){
    if((e.air||0)>0.05)continue;
    const teleOn=e.tele>0;
    P.groundCircle(e.x,e.z,e.r,(teleOn?'rgba(255,60,60,.5)':'rgba(255,110,90,.28)'),teleOn?'#ff5050':'#ff9a8a',2);
    if(e===L)P.groundCircle(e.x,e.z,e.r+0.3,null,'#ffffff',3);
    if(e.info.contact){
      const R=e.info.R;
      const col=R>=CFG.thr.win?'#7dff9a':(R>=CFG.thr.hold?'#ffe36a':(R>=CFG.thr.lose?'#ffa860':'#ff6060'));
      const m=toCam((h.x+e.x)/2,(h.z+e.z)/2);
      P.dot(m,col);
    }
  }
  // 着地の しょうげきは(ひろがる 輪)
  for(const r of S.rings||[]){
    const k=r.t/r.max,rad=r.r*(1.1+3.2*k),al=0.85*(1-k);
    P.groundCircle(r.x,r.z,rad,null,'rgba(255,240,200,'+al.toFixed(3)+')',5*(1-k)+1.5,40);
    P.groundCircle(r.x,r.z,rad*0.62,null,'rgba(255,200,120,'+(al*0.7).toFixed(3)+')',3*(1-k)+1,32);
  }
}
// キャラクターの ならび(奥から手前)
export function charList(){
  const h=S.hero,a=S.ally,E=S.enemies.filter(e=>!e.dead);
  const list=[];
  list.push({d:toCam(h.x,h.z).d,k:'h',c:toCam(h.x,h.z)});
  list.push({d:toCam(a.x,a.z).d,k:'a',c:toCam(a.x,a.z)});
  for(const e of E){const c=toCam(e.x,e.z);list.push({d:c.d,k:'e',c,e});}
  list.sort((p,q)=>q.d-p.d);
  return list;
}
// キャラの むき(まほうつかい・てき)。描くまえに よぶ
export function charPre(it){
  const h=S.hero,a=S.ally,E=S.enemies.filter(e=>!e.dead);
  if(it.k==='a'){const ta=E.filter(q=>q.hp>0).sort((m,n)=>Math.hypot(m.x-a.x,m.z-a.z)-Math.hypot(n.x-a.x,n.z-a.z))[0];faceTo(a,ta?ta.x:a.x,ta?ta.z:a.z+1,9);}
  else if(it.k==='e'){const e=it.e,tg=e.target==='hero'?h:(e.target==='ally'?a:h);faceTo(e,tg.x,tg.z,7);}
}
// キャラの からだ(Canvas 2D の ローポリ箱モデル)
function charModel(it,blink){
  const h=S.hero,a=S.ally;
  const air=it.k==='e'?(it.e.air||0):0; // 空中の てきは たかさぶん 上に ずらす
  const p=proj(it.c.l,it.c.d,air),s=V.F/it.c.d;
  if(it.k==='h')drawHero(p.x,p.y,s,h.flash>0&&blink,h);
  else if(it.k==='a')drawAlly(p.x,p.y,s,a.flash>0&&blink,a.yaw3,a.mv3||0,a.ph3||0,a.castT<0.5?1-a.castT/0.5:0);
  else{
    const e=it.e,teleOn=e.tele>0,atkOn=e.atkTele>0;
    const eye=teleOn?'#ff2020':(atkOn?'#ffd000':null);
    let tint=e.color;if(teleOn&&blink)tint='#c04a40';
    drawEnemy(p.x,p.y,s,e.flash>0&&blink,eye,tint,e.r,e.yaw3,e.mv3||0,e.ph3||0,teleOn||atkOn||air>0.05||e.beat===1,e.stagger>0,e.dash>0||e.beat===2); // 空中・ボコるとき は りょううでを ふりあげる / たたきつける とき まえかがみ
  }
}
// キャラの うえの 表示(剣の軌跡・かまえ・ゲージ・ねらい・「！」)。てきの 画面上の位置(タップ・フリック判定用)も ここで きめる
export function charOverlay(it,blink){
  const h=S.hero;
  const p=proj(it.c.l,it.c.d,0),s=V.F/it.c.d;
  if(it.k==='h'){
    if(h.swingV>0&&1-h.swingV/0.34>=0.2){ // けんの軌跡(フリックしたむきに 大きく ふる。ふりぬく間だけ)
      const ph0=1-h.swingV/0.34,ang=h.swingAng||0,ux=Math.cos(ang),uy=Math.sin(ang);
      const pr=Math.min(1,(ph0-0.2)/0.42);
      const cx0=p.x,cy0=p.y-s*1.3,L0=s*2.1;
      const t0=Math.max(0,pr-0.6),t1=pr,N=12;
      ctx.save();ctx.strokeStyle='#ffffff';ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=Math.max(5,s*0.2);ctx.globalAlpha=0.95*(1-Math.min(1,Math.max(0,(ph0-0.62)/0.3)));
      ctx.beginPath();
      for(let k=0;k<=N;k++){
        const t=t0+(t1-t0)*k/N,lx=(t*2-1)*L0,bow=-(1-(t*2-1)*(t*2-1))*s*0.6;
        const X=cx0+ux*lx-uy*bow,Y=cy0+uy*lx+ux*bow;
        if(k)ctx.lineTo(X,Y);else ctx.moveTo(X,Y);
      }
      ctx.stroke();ctx.restore();
    }
    const top=proj(it.c.l,it.c.d,2.35);
    if(!(h.stun>0)&&!h.dead)bar(top.x-22,top.y-1,44,5,h.sta/CFG.sta.max,h.tired?'#ff5a4a':'#7cdcff');
    if(h.tired&&!h.dead)txt('いきぎれ',top.x,top.y+16,12,'#ff9a90','center',3);
  }else if(it.k==='e'){
    const e=it.e;
    if((e.air||0)>0.05)return; // 空中の 間は ゲージや 文字を 出さない
    const teleOn=e.tele>0,atkOn=e.atkTele>0;
    const er=e.r*ENEMY_LOOK; // 見た目の大きさ
    e.sc=s;e.sx=p.x;e.sy=p.y-s*er*1.3;e.shw=Math.max(18,s*er*1.25);e.shh=Math.max(24,s*er*1.45); // タップ・フリック判定用の画面位置と大きさ
    if(inp.down&&inp.onEnemy===e.i){ctx.save();ctx.strokeStyle='#ffe01a';ctx.lineWidth=3;ctx.globalAlpha=0.85;ctx.beginPath();ctx.ellipse(e.sx,e.sy,e.shw+8,e.shh+8,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
    const top=proj(it.c.l,it.c.d,2.9*er+0.2);
    // ねばりゲージ(小)
    bar(top.x-22,top.y+11,44,5,e.gauge/100,e.gauge>=80?'#ff5a4a':'#ffb030');
    bar(top.x-22,top.y+18,44,5,e.hp/e.maxHp,'#5ad06a');
    const top2=proj(it.c.l,it.c.d,2.9*er+0.2+0.8);
    if(teleOn){const w=e.tele<=CFG.parryWin;txt(w?'いま！':'！',top2.x,top2.y-6,Math.max(22,s*0.9)*(w?1.15:1),w?'#7cf5ff':'#ff4040','center',4);}
    else if(atkOn){const w=e.target==='hero'&&e.atkTele<=CFG.parryWin;txt(w?'いま！':'！',top2.x,top2.y-6,Math.max(20,s*0.8)*(w?1.15:1),w?'#7cf5ff':(e.target==='hero'?'#ff9a30':'#ffd000'),'center',4);txt(KIND_JP[e.atkKind]||'',top2.x,top2.y-30,13,'#ffd0a0','center',3);}
    else if(e.stagger>0)txt('ふらふら…',top2.x,top2.y-4,15,'#9fe8ff','center',3);
  }
}
// こうげきのビーム・浮かぶ文字・ダメージ数字(flyCb: 止めの演出を 自分で描くとき)
export function drawEffects(flyCb){
  // こうげきのビーム
  for(const b of S.beams){
    const c1=toCam(b.x1,b.z1),c2=toCam(b.x2,b.z2);
    if(c1.d<NEAR||c2.d<NEAR)continue;
    const p1=proj(c1.l,c1.d,b.y1),p2=proj(c2.l,c2.d,b.y2);
    ctx.globalAlpha=Math.min(1,b.life*5);ctx.strokeStyle=b.col;ctx.lineWidth=4;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke();ctx.globalAlpha=1;
  }
  // 浮かぶ文字
  for(const t of S.texts){
    const c=toCam(t.x,t.z);if(c.d<NEAR)continue;
    const p=proj(c.l,c.d,t.h+(1.1-t.life)*0.9);
    ctx.globalAlpha=Math.min(1,t.life*2);txt(t.s,p.x,p.y,18,t.color,'center',4);ctx.globalAlpha=1;
  }
  // 止めをさされて 画面の外へ とんでいく てき
  if(flyCb)flyCb();
  else for(const f of S.fly){
    for(let k=3;k>=0;k--){
      const tt=Math.max(0,f.t-k*0.04),gx=f.x0+f.vx*tt,gy=f.y0+f.vy*tt,sc=1+0.9*tt;
      ctx.save();ctx.translate(gx,gy);ctx.rotate(f.spin*tt);
      ctx.globalAlpha=k===0?1:0.16*(4-k);
      drawEnemy(0,f.s*sc*f.r*ENEMY_LOOK*1.3,f.s*sc,k===0&&f.t<0.1,'#ffffff',f.color,f.r,0,0,0,false,true,false);
      ctx.restore();
    }
    ctx.globalAlpha=1;
  }
  for(const q of S.sparks){
    const pr=1-q.life/q.max,sz=18+pr*40,al=Math.min(1,q.life/0.3);
    ctx.save();ctx.globalAlpha=al;ctx.strokeStyle='#fff6b0';ctx.lineWidth=4;ctx.lineCap='round';
    for(let k=0;k<4;k++){const an=k*Math.PI/4+pr*0.6;ctx.beginPath();ctx.moveTo(q.x-Math.cos(an)*sz,q.y-Math.sin(an)*sz);ctx.lineTo(q.x+Math.cos(an)*sz,q.y+Math.sin(an)*sz);ctx.stroke();}
    const tx=Math.max(50,Math.min(CW-50,q.x)),ty=Math.max(40,Math.min(CH-40,q.y+(q.y<CH/2?46:-46)));
    txt('キラーン！',tx,ty,22,'#ffe36a','center',5);
    ctx.restore();
  }
  // ほこり(かったときの ほこりはらい)
  for(const d of S.dust||[]){
    const c=toCam(d.x,d.z);if(c.d<NEAR)continue;const p=proj(c.l,c.d,d.h);
    ctx.globalAlpha=Math.min(1,d.life*2)*0.85;ctx.fillStyle=d.col;ctx.beginPath();ctx.arc(p.x,p.y,d.r*V.F/c.d*0.06+1.2,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;
  // ダメージ数字
  for(const q of S.pops){
    const c=toCam(q.x,q.z);if(c.d<NEAR)continue;
    const t=q.max-q.life; // けいか時間
    const rise=Math.min(1,t/0.5);
    const p=proj(c.l,c.d,q.h+rise*0.9);
    const px=p.x+q.ox,py=p.y-Math.sin(Math.min(1,t/0.18)*Math.PI)*10; // ぽんとはねる
    const sc=t<0.12?1.8-0.8*(t/0.12):1;
    const al=q.life<0.25?q.life/0.25:1;
    ctx.globalAlpha=al;
    if(q.hit&&t<0.2){ // ヒットの火花
      const rr0=14+t*160;ctx.strokeStyle='#fff6b0';ctx.lineWidth=3;ctx.lineCap='round';
      for(let k=0;k<8;k++){const an=k/8*Math.PI*2+q.seed;ctx.beginPath();ctx.moveTo(px+Math.cos(an)*rr0*0.55,py+Math.sin(an)*rr0*0.55);ctx.lineTo(px+Math.cos(an)*rr0,py+Math.sin(an)*rr0);ctx.stroke();}
    }
    const fs2=Math.round(q.size*sc);
    txt(q.s,px,py,fs2,q.color,'center',Math.max(5,fs2*0.16));
    if(q.sub)txt(q.sub,px,py-fs2*0.72,Math.max(13,fs2*0.38),'#ffe36a','center',4);
    ctx.globalAlpha=1;
  }
}
// 画面に固定の表示(指のあと・スティック・上のHUD・下のウィンドウ・おわりの表示)
export function drawHud(){
  const h=S.hero,a=S.ally,L=S.enemies[S.lock];
  // 指のあと(はやく うごかしたときの軌跡。フリックがみとめられると輪が出る)
  {
    const nowT=performance.now();
    const tr=inp.trail.filter(q=>nowT-q.t<220);
    if(tr.length>1){
      ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
      for(let k=1;k<tr.length;k++){
        const dtk=Math.max(0.008,(tr[k].t-tr[k-1].t)/1000),sp=Math.hypot(tr[k].x-tr[k-1].x,tr[k].y-tr[k-1].y)/dtk;
        if(sp<250)continue;
        const age=(nowT-tr[k].t)/220;
        ctx.globalAlpha=Math.max(0,0.8*(1-age));ctx.strokeStyle='#bfe9ff';ctx.lineWidth=3+8*(1-age);
        ctx.beginPath();ctx.moveTo(tr[k-1].x,tr[k-1].y);ctx.lineTo(tr[k].x,tr[k].y);ctx.stroke();
      }
      ctx.restore();
      const age2=(nowT-inp.flickT)/200;
      if(age2>=0&&age2<1){
        const lp=tr[tr.length-1];ctx.save();ctx.globalAlpha=1-age2;ctx.strokeStyle='#ffffff';ctx.lineWidth=4;
        ctx.beginPath();ctx.arc(lp.x,lp.y,14+age2*34,0,Math.PI*2);ctx.stroke();ctx.restore();
      }
    }
  }
  // 指のスティック表示
  if(inp.down&&!inp.noMove){
    ctx.beginPath();ctx.arc(inp.ox,inp.oy,34,0,Math.PI*2);ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=2;ctx.stroke();
    ctx.beginPath();ctx.arc(inp.x,inp.y,16,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.35)';ctx.fill();
  }

  // 上のHUD
  const info=L.info;
  const HY=BAR_H+16,LY=BAR_H+46;
  txt('じかん  '+S.t.toFixed(1)+' びょう',12,HY,14,'#fff','left',3);
  let label='',lc='#fff';
  if(info.contact){
    const R=info.R;
    if(R>=CFG.thr.win){label='おしかち！';lc='#7dff9a';}
    else if(R>=CFG.thr.hold){label='きっこう（あしどめ）';lc='#ffe36a';}
    else if(R>=CFG.thr.lose){label='おされている…';lc='#ffa860';}
    else{label='とっぱされた！';lc='#ff6060';}
  }else{label='';}
  txt(label,CW/2,LY,22,lc,'center',5);
  if(info.contact)txt('おもさ '+Math.round(info.wh)+' vs '+Math.round(info.we)+'  ('+ANGLE_JP[info.angle]+'から)',CW/2,LY+24,12,'#fff','center',3);

  // 下のウィンドウ: パーティ(さいだい4人)。4つの まどを 横に ならべ、なまえ・HP・MP・ターンゲージを たてに ならべる(ユーザー指示 2026-11-22)
  //   MP は ひょうじだけ(まだ つかわない)。ターンゲージは コマンド式の ターンの 代わりの めやす:
  //   ゆうしゃ=きりょく(ふるほど へる) / まほうつかい=つぎの まほうまでの チャージ
  {
    const party=[
      {name:'ゆうしゃ',hp:h.hp,hpMax:CFG.hero.hp,mp:CFG.hero.mp,mpMax:CFG.hero.mp,turn:h.sta/CFG.sta.max,note:h.tired?'いきぎれ':'',tcol:h.tired?'#ff5a4a':'#ffb030'},
      {name:'まほうつかい',hp:a.hp,hpMax:CFG.ally.hp,mp:CFG.ally.mp,mpMax:CFG.ally.mp,turn:1-Math.max(0,Math.min(1,a.castT/CFG.ally.castInt)),note:'',tcol:'#ffb030'}
    ];
    const M=6,G=5,WN=4,WW=(CW-M*2-G*(WN-1))/WN,WH=108,WY=CH-M-WH;
    for(let i=0;i<WN;i++){
      const m=party[i],x=M+i*(WW+G),dead=m&&m.hp<=0;
      ctx.fillStyle=m?'rgba(8,12,70,.93)':'rgba(8,12,70,.35)';rr(x,WY,WW,WH,8);ctx.fill();
      ctx.strokeStyle=m?'#fff':'rgba(255,255,255,.3)';ctx.lineWidth=m?2.5:1.5;ctx.stroke();
      if(!m)continue; // あいている わく
      ctx.globalAlpha=dead?0.5:1;
      txt(m.name,x+WW/2,WY+15,12,dead?'#9a9ab0':'#fff','center',2);
      const rows=[
        ['HP',m.hp+'/'+m.hpMax,m.hp/m.hpMax,m.hp/m.hpMax>0.5?'#3ddc6a':(m.hp/m.hpMax>0.25?'#ffd23a':'#ff5a4a'),'#9fe8b0'],
        ['MP',m.mp+'/'+m.mpMax,m.mp/m.mpMax,'#4aa8ff','#9fc8ff'],
        ['ターン',m.note,m.turn,m.tcol,'#ffd9a0']
      ];
      rows.forEach((r,k)=>{
        const gy=WY+36+k*25;
        txt(r[0],x+8,gy,9,r[4],'left',2);
        if(r[1])txt(r[1],x+WW-8,gy,10,r[0]==='ターン'?'#ff9a90':'#fff','right',2);
        bar(x+8,gy+6,WW-16,7,r[2],r[3]);
      });
      ctx.globalAlpha=1;
    }
  }

  if(S.over&&S.overT>=overShowT(S.over)){
    const win=S.over==='win';
    // ゆうしゃが たおれた/かった ときは 演出と かさならないよう 文字を 上へ あげる(かったときは 暗幕を うすく)
    const TY=(win||S.over==='hero')?Math.max(BAR_H+58,CH*0.15):CH*0.38;
    if(win){ctx.fillStyle='rgba(0,0,0,.42)';rr(CW*0.04,TY-28,CW*0.92,win?130:100,12);ctx.fill();}
    else{ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(0,0,CW,CH);}
    txt(win?'てきを ぜんぶ たおした！':(S.over==='hero'?'ゆうしゃは たおれた…':'まほうつかいが たおれた…'),CW/2,TY,22,win?'#ffe36a':'#fff','center',5);
    let ly=TY+36;
    if(win&&S.victory){txt({easy:'よゆうの しょうり！',normal:'しょうり！',close:'ぎりぎりの しょうり…！'}[S.victory.grade],CW/2,ly,18,'#7dff9a','center',4);ly+=30;}
    txt((win?'クリアタイム  ':'もちこたえた時間  ')+S.t.toFixed(1)+' びょう',CW/2,ly,win?15:18,'#ffe36a','center',4);ly+=win?28:40;
    if(S.overT>overReadyT(S.over))txt('タップで もういちど',CW/2,ly,16,'#cfd4ff','center',3);
  }
}

// Canvas 2D の 1フレーム(移行元と 同じ順番で 描く)
export function render(){
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.clearRect(0,0,CW,CH);
  const h=S.hero,A=CFG.arena;
  setupView();
  ctx.save();
  if(S.shake>0)ctx.translate((Math.random()-.5)*S.shake*14,(Math.random()-.5)*S.shake*14);

  // 空・遠くの遺跡・石だたみの地面
  drawBackdrop();
  drawFloor(h,A);
  drawArena(A);
  drawGroundMarks();

  // キャラクター(奥から手前)
  const blink=blinkNow();
  for(const it of charList()){
    if(it.c.d<NEAR)continue;
    charPre(it);charModel(it,blink);charOverlay(it,blink);
  }
  drawEffects();
  ctx.restore();
  drawHud();
}
