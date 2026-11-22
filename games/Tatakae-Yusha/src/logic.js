// 移行元: prototype-2d.html の該当部分をそのまま移したもの(import/export だけ足した)
import {CFG,CAM,FLICK,HERO_Y,ET,LETTER,pickPlan} from './config.js';
import {cv,CW,CH} from './screen.js';

// ================= 状態 =================
export let S=null,running=false;
export function setRunning(v){running=v;}
export const inp={down:false,id:null,ox:0,oy:0,x:0,y:0,sx:0,sy:0,t0:0,travel:0,fwd:0,lat:0,hist:[],flickT:-1000,lastEvt:-1000,flickPending:false,flickDx:1,flickDy:0,trail:[],flickBlocked:false,parryOK:true,onEnemy:-1,noMove:false,flickEnemy:-1,flickPeak:0};
function makeEnemy(i,x,z){
  return {i,x,z,r:ET.r,w:ET.w,speed:ET.speed,color:i===0?ET.color:ET.color2,
    fx:0,fz:-1,gauge:0,tele:0,atkTele:0,atkCd:1.2+i*0.6,stagger:0,flash:0,kx:0,kz:0,
    flankDir:Math.random()<0.5?1:-1,flankT:1.5,target:null,hp:ET.hp,maxHp:ET.hp,dead:false,hate:{hero:0,ally:0},
    air:0,tflash:0,sx:0,sy:0,shw:0,shh:0,sc:30,atkKind:'hit',atkMax:0.7,plan:pickPlan(),dash:0,dashLeft:0,dx:0,dz:1,cx:0,cz:0,hitH:false,hitA:false,info:{contact:false,R:0,wh:0,we:0,angle:'front'}};
}
export function init(){
  S={
    t:0,over:null,overT:0,shake:0,texts:[],pops:[],lock:0,
    hero:{x:0,z:7.8,r:CFG.hero.r,hp:CFG.hero.hp,stun:0,flash:0,stance:'firm',pushK:0,firmK:1,hitT:-1,dead:false,hitK:0,swingCd:0,swingT:0,swingV:0,pushT:0,sta:100,tired:false,noParry:0,ph:0,mv:0,fr:0,ff:1,yaw3:Math.PI,faceHold:0,idleT:0},
    ally:{x:0,z:5.4,r:CFG.ally.r,hp:CFG.ally.hp,mp:CFG.ally.mp,flash:0,castT:1.0,cd:1.0,cast:null,warnedMp:0},
    enemies:[makeEnemy(0,-3.5,17.5),makeEnemy(1,3.5,18.5)],beams:[],spells:[],fly:[],sparks:[],rings:[],dust:[],
    cam:{yaw:0}
  };
  // ゲームスタートの演出(ユーザー指示 2026-11-21): カメラが てきを 大きく うつし、てきが 地面に おりたつ。そのあと カメラが ひいて ゲームの いちへ
  S.intro={t:0,skip:false};
  S.enemies.forEach(e=>{e.air=INTRO.air;});
  S.cam.yaw=introState(S).yaw;
}

// ---- スタート演出 ----
export const INTRO={
  dur:4.3,            // ぜんたいの 長さ(秒)
  start:[0.25,1.75],  // てきA・てきB が おちはじめる 時間
  fall:0.6,           // おちる 時間
  air:9,              // おちはじめる たかさ(クローズアップの 画面の うえはし あたりから おちてくる)
  D:3.6,hh:1.9,fov:0.8,yf:0.66, // クローズアップの カメラ: てきとの きょり・たかさ・画角・てきの足もとの 画面たて位置
  panA:1.4,panB:2.2,holdB:2.8   // A を うつす→B へ うつる(panA〜panB)→B を うつす→ひく(holdB〜dur)
};
const ease3=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
function introKf(i){ // てきi の 足もとを 大きく うつす カメラ
  const h=S.hero,e=S.enemies[i],dx=e.x-h.x,dz=e.z-h.z,d=Math.hypot(dx,dz)||1,ux=dx/d,uz=dz/d;
  return {cx:e.x-ux*INTRO.D,cz:e.z-uz*INTRO.D,yaw:Math.atan2(ux,uz),h:INTRO.hh,fov:INTRO.fov,fpx:e.x,fpz:e.z,yf:INTRO.yf};
}
function introEnd(){ // ゲームの ふだんの カメラ(ゆうしゃの 足もとが 画面のたて半分)
  const h=S.hero,L=S.enemies[0],yaw=Math.atan2(L.x-h.x,L.z-h.z);
  return {cx:h.x-Math.sin(yaw)*CAM.back,cz:h.z-Math.cos(yaw)*CAM.back,yaw,h:CAM.h,fov:CAM.fov,fpx:h.x,fpz:h.z,yf:HERO_Y};
}
export function introState(S0){
  const t=S0.intro.t;
  const K0=introKf(0),K1=introKf(1),K2=introEnd();
  let a=K0,b=K0,k=0;
  if(t>=INTRO.holdB){a=K1;b=K2;k=ease3((t-INTRO.holdB)/(INTRO.dur-INTRO.holdB));k=k*k*(3-2*k);}
  else if(t>=INTRO.panB){a=K1;b=K1;}
  else if(t>=INTRO.panA){a=K0;b=K1;k=ease3((t-INTRO.panA)/(INTRO.panB-INTRO.panA));}
  const m=(p,q)=>p+(q-p)*k;
  return {cx:m(a.cx,b.cx),cz:m(a.cz,b.cz),yaw:a.yaw+Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw))*k,
    h:m(a.h,b.h),fov:m(a.fov,b.fov),fpx:m(a.fpx,b.fpx),fpz:m(a.fpz,b.fpz),yf:m(a.yf,b.yf)};
}
function stepIntro(dt){
  const I=S.intro;I.t+=dt;
  S.shake=Math.max(0,S.shake-dt*1.6);
  S.enemies.forEach((e,i)=>{
    const tau=I.t-INTRO.start[i],was=e.air;
    if(tau<0)e.air=INTRO.air;
    else if(tau<INTRO.fall){const r=tau/INTRO.fall;e.air=INTRO.air*(1-r*r);}
    else e.air=0;
    if(was>0&&e.air<=0&&!I.skip){ // おりたった！
      S.shake=Math.max(S.shake,0.7);
      addText('ドシン！',e.x,e.z,3.6,'#ffe9b0');
      S.rings.push({x:e.x,z:e.z,t:0,max:0.8,r:e.r});
      try{if(navigator.vibrate)navigator.vibrate(30);}catch(_){}
    }
  });
  S.cam.yaw=introState(S).yaw;
  for(const t of S.texts)t.life-=dt;S.texts=S.texts.filter(t=>t.life>0);
  for(const q of S.pops)q.life-=dt;S.pops=S.pops.filter(q=>q.life>0);
  if(I.t>=INTRO.dur){S.intro=null;S.enemies.forEach(e=>{e.air=0;});S.cam.yaw=introEnd().yaw;}
}
// ---- ゆうしゃが まけたとき(ユーザー指示 2026-11-21): たおれて、てきに かこまれて ボコボコに される ----
export function beatPhase(e){return ((e.beatT||0)*2.2+e.i*0.5)%1;} // 0〜0.6: ふりあげる / 0.6〜0.85: たたきつける / のこり: もどす
export function defeatCam(S0){ // カメラを たかく あげて、ゆうしゃを 見おろす。ゆっくり よりながら、すこし まわりこむ
  const D=S0.defeat,h=S0.hero,k=ease3(D.t/2.0),yaw=D.yaw+0.45*k,back=CAM.back+(6.2-CAM.back)*k;
  return {cx:h.x-Math.sin(yaw)*back,cz:h.z-Math.cos(yaw)*back,yaw,h:CAM.h+(11-CAM.h)*k,fov:CAM.fov,fpx:h.x,fpz:h.z,yf:HERO_Y+0.04*k};
}
function stepDefeat(dt){
  const D=S.defeat,h=S.hero;D.t+=dt;
  h.hitK=Math.max(0,h.hitK-dt*5);h.flash=Math.max(0,h.flash-dt);
  if(h.hitT>=0)h.hitT+=dt; // ふっとんで しんだ ときは そのまま ふっとびを つづける
  if(h.kx||h.kz){h.x+=h.kx*dt;h.z+=h.kz*dt;const dc=Math.exp(-CFG.counter.crit.k*dt);h.kx*=dc;h.kz*=dc;if(Math.hypot(h.kx,h.kz)<0.3){h.kx=0;h.kz=0;}}
  clampArena(h,h.r);
  const fx=Math.sin(D.yaw),fz=Math.cos(D.yaw),rx=fz,rz=-fx; // たおれた ときの カメラの まえ・みぎ
  let side=0;
  for(const e of S.enemies){
    if(e.dead)continue;
    // かこむ いち: ゆうしゃの まえの ひだり・みぎ
    const sd=side++%2?1:-1,tx=h.x+fx*1.2+rx*1.85*sd,tz=h.z+fz*1.2+rz*1.85*sd;
    const dx=tx-e.x,dz=tz-e.z,dd=Math.hypot(dx,dz);
    if(dd>0.15){const sp=Math.min(dd/Math.max(dt,0.001),9),m=Math.min(dd,sp*dt);e.x+=dx/dd*m;e.z+=dz/dd*m;}
    const hx=h.x-e.x,hz=h.z-e.z,hl=Math.hypot(hx,hz)||1;e.fx+=(hx/hl-e.fx)*Math.min(1,dt*10);e.fz+=(hz/hl-e.fz)*Math.min(1,dt*10);
    e.kx=0;e.kz=0;
    if(dd<0.6&&D.t>0.5){ // ついたら ボコボコ
      const was=beatPhase(e);e.beatT+=dt;const ph=beatPhase(e);
      e.beat=ph<0.6?1:(ph<0.85?2:0);
      if(was<0.6&&ph>=0.6){ // たたきつけた！
        h.hitK=1;h.flash=0.12;S.shake=Math.max(S.shake,0.45);
        addText(['ドガッ！','ボコッ！','ドスッ！','バキッ！'][(e.beatN=(e.beatN||0)+1)%4],h.x+(Math.random()-0.5)*1.2,h.z,2.0+Math.random()*0.8,'#ffd0a0');
        try{if(navigator.vibrate)navigator.vibrate(18);}catch(_){}
      }
    }else e.beat=0;
  }
  S.cam.yaw=defeatCam(S).yaw;
  for(const t of S.texts)t.life-=dt;S.texts=S.texts.filter(t=>t.life>0);
  for(const q of S.pops)q.life-=dt;S.pops=S.pops.filter(q=>q.life>0);
}
// ---- かったとき(ユーザー指示 2026-11-22): カメラが ゆうしゃの 正面へ まわり、かちかたに あわせた ポーズ ----
//   よゆう: 服の ほこりを はらう / ふつう: ガッツポーズ / しんしょう: あぐらで すわりこんで グッドポーズ
export function victoryCam(S0){
  const V=S0.victory,h=S0.hero,k=ease3((V.t-0.8)/1.3),yaw=V.yaw+Math.PI*k,back=CAM.back+(4.4-CAM.back)*k;
  return {cx:h.x-Math.sin(yaw)*back,cz:h.z-Math.cos(yaw)*back,yaw,h:CAM.h+(2.2-CAM.h)*k,fov:CAM.fov,fpx:h.x,fpz:h.z,yf:HERO_Y+0.08*k};
}
function stepVictory(dt){
  const V=S.victory,h=S.hero;V.t+=dt;
  const C=victoryCam(S);S.cam.yaw=C.yaw;
  h.yaw3=Math.PI+(C.yaw-V.yaw); // せかいで みた むきを かえずに、カメラが まわった ぶん だけ ゆうしゃも まわる(さいごは カメラのほうを むく)
  const pt=V.t-1.0;
  if(pt>0.3&&!V.said){V.said=true;addText({easy:'パッパッ',normal:'やったー！',close:'ぜぇ…ぜぇ…'}[V.grade],h.x,h.z,2.7,'#ffffff');}
  if(V.grade==='close'&&pt>0.3&&V.t>=(V.pantT||0)){V.pantT=V.t+1.9;addText('ぜぇ…ぜぇ…',h.x+(Math.random()-0.5)*0.8,h.z,2.5,'#ffffff');} // いきを あげて ときどき
  if(V.grade==='easy'&&pt>=3.45&&!V.sheathed){V.sheathed=true;addText('チャキン！',h.x,h.z,2.7,'#cfe8ff');S.shake=Math.max(S.shake,0.15);}
  if(V.grade==='easy'&&pt>0.4&&pt<2.05){ // ほこりを はらう 3回の あいだだけ ぱらぱら おちる
    V.dustT-=dt;
    while(V.dustT<=0){V.dustT+=0.07;
      S.dust.push({x:h.x+(Math.random()-0.5)*0.9,z:h.z+(Math.random()-0.5)*0.3,h:1.0+Math.random()*0.7,vx:(Math.random()-0.5)*0.8,vz:0,vh:-0.5-Math.random()*0.6,life:0.9,r:1+Math.random()*1.6,col:Math.random()<0.5?'#ffffff':'#d8cfb8'});}
  }
  for(const d of S.dust){d.x+=d.vx*dt;d.h+=d.vh*dt;d.life-=dt;}
  S.dust=S.dust.filter(d=>d.life>0&&d.h>0);
  for(const t of S.texts)t.life-=dt;S.texts=S.texts.filter(t=>t.life>0);
  for(const q of S.pops)q.life-=dt;S.pops=S.pops.filter(q=>q.life>0);
}
// タップで とばす(はじまった ばかりは さけて、ゆびの まちがいを ふせぐ)
export function skipIntro(){
  if(!S||!S.intro)return;
  S.intro.skip=true;S.intro.t=INTRO.dur;stepIntro(0);
}
function addText(s,x,z,hgt,color){S.texts.push({s,x,z,h:hgt,color,life:1.1});}
// ダメージ数字(おおきく、はねるように表示)
function addPop(x,z,hgt,str,color,size,sub,hit){
  S.pops.push({x,z,h:hgt,s:str,color,size,sub:sub||'',hit:!!hit,life:1.0,max:1.0,ox:(Math.random()-0.5)*26,seed:Math.random()*6.28});
}

// ================= 入力 =================
function pos(e){const r=cv.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
function dz(v){const a=Math.abs(v);if(a<0.15)return 0;return Math.sign(v)*Math.min(1,(a-0.15)/0.85);}
export function enemyAt(x,y){ // 画面上の位置に かさなっている てき(なければ -1)
  if(!S)return -1;
  let best=-1,bv=1e9;
  S.enemies.forEach((e,i)=>{
    if(e.dead||!e.shw)return;
    const nx=(x-e.sx)/(e.shw+14),ny=(y-e.sy)/(e.shh+14),v=nx*nx+ny*ny;
    if(v<=1&&v<bv){bv=v;best=i;}
  });
  return best;
}
function trackPeak(now){ // フリックを みとめたあと、いちばん はやかった速さを きろく
  if(!inp.flickPending||now-inp.flickT>160)return;
  const hs=inp.hist;if(hs.length<2)return;
  const last=hs[hs.length-1];let f=null;
  for(const q of hs){if(now-q.t<=55){f=q;break;}}
  if(!f||f===last)return;
  const sp=Math.hypot(last.x-f.x,last.y-f.y)/Math.max(0.012,(last.t-f.t)/1000);
  if(sp>inp.flickPeak)inp.flickPeak=sp;
}
export function checkFlick(now){
  // どの むきでも、すばやく 動かせば フリック(たてむきは すこし きびしめ)
  trackPeak(now);
  const hs=inp.hist;if(hs.length<2)return;
  const last=hs[hs.length-1];let first=null;
  for(const p of hs){if(now-p.t<=120){first=p;break;}}
  if(!first||first===last)return;
  const dtm=Math.max(0.016,(last.t-first.t)/1000);
  const dx=last.x-first.x,dy=last.y-first.y,dist=Math.hypot(dx,dy);
  if(dist<FLICK.d)return;
  const vertical=Math.abs(dy)>Math.abs(dx)*1.6;
  const spd=dist/dtm;
  if(spd>(vertical?FLICK.v:FLICK.h)&&now-inp.lastEvt>200){
    inp.lastEvt=now;inp.flickT=now;inp.flickPending=true;inp.flickDx=dx;inp.flickDy=dy;inp.flickPeak=spd;
    inp.parryOK=S.hero.noParry<=0&&S.hero.stun<=0; // けんを ふった直後は いなせない
    inp.flickBlocked=S.hero.pushT>=CFG.pushLock; // おして いる間は 剣を ふれない
    // かさねた てきを ねらう(はじめの位置 → なぞった線の上 の じゅん)
    let te=inp.onEnemy;
    if(te<0||S.enemies[te].dead){
      te=-1;
      for(let k=0;k<=4&&te<0;k++)te=enemyAt(first.x+(last.x-first.x)*k/4,first.y+(last.y-first.y)*k/4);
    }
    inp.flickEnemy=te;
  }
}
export function tapLock(x,y){ // タップした位置に一番近いてきをロック
  if(!S)return;
  let best=-1,bd=1e9;
  S.enemies.forEach((e,i)=>{if(e.dead)return;const d=Math.hypot(e.sx-x,e.sy-y);if(d<bd){bd=d;best=i;}});
  if(best>=0&&best!==S.lock){S.lock=best;addText('ロック '+LETTER[best],S.enemies[best].x,S.enemies[best].z,3.2,'#ffffff');}
}
cv.addEventListener('pointerdown',e=>{
  e.preventDefault();
  if(S&&S.over){if(S.overT>overReadyT(S.over))init();return;}
  if(!running||inp.down)return;
  if(S&&S.intro){if(S.intro.t>0.4)skipIntro();return;} // スタートの演出中は タップで とばす
  const p=pos(e);inp.down=true;inp.id=e.pointerId;inp.ox=p.x;inp.oy=p.y;inp.x=p.x;inp.y=p.y;inp.sx=p.x;inp.sy=p.y;
  inp.t0=performance.now();inp.travel=0;inp.fwd=0;inp.lat=0;
  inp.onEnemy=enemyAt(p.x,p.y);inp.noMove=inp.onEnemy>=0; // てきに重なった操作は いどうに しない
  inp.hist=[{t:inp.t0,x:p.x,y:p.y}];inp.trail=[{t:inp.t0,x:p.x,y:p.y}];
  try{cv.setPointerCapture(e.pointerId);}catch(_){}
});
cv.addEventListener('pointermove',e=>{
  if(!inp.down||e.pointerId!==inp.id)return;
  e.preventDefault();
  const p=pos(e),now=performance.now();
  inp.x=p.x;inp.y=p.y;
  inp.travel=Math.max(inp.travel,Math.hypot(p.x-inp.sx,p.y-inp.sy));
  inp.hist.push({t:now,x:p.x,y:p.y});
  inp.trail.push({t:now,x:p.x,y:p.y});while(inp.trail.length>2&&now-inp.trail[0].t>260)inp.trail.shift();
  while(inp.hist.length>2&&now-inp.hist[0].t>220)inp.hist.shift();
  checkFlick(now);
  if(inp.noMove){inp.fwd=0;inp.lat=0;return;}
  let dx=p.x-inp.ox,dy=p.y-inp.oy;const LIM=70,d=Math.hypot(dx,dy);
  if(d>LIM){inp.ox=p.x-dx/d*LIM;inp.oy=p.y-dy/d*LIM;dx=p.x-inp.ox;dy=p.y-inp.oy;}
  inp.fwd=dz(-dy/40);inp.lat=dz(dx/40);
});
function release(e){
  if(!inp.down||e.pointerId!==inp.id)return;
  const now=performance.now();
  checkFlick(now);
  if(e.type==='pointerup'&&now-inp.t0<220&&inp.travel<8)tapLock(inp.sx,inp.sy);
  inp.down=false;inp.id=null;inp.fwd=0;inp.lat=0;inp.hist=[];
}
cv.addEventListener('pointerup',release);
cv.addEventListener('pointercancel',release);

// ================= ロジック =================
export function wrapAng(a){while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;}
function clampArena(o,r){
  const A=CFG.arena;let dx=o.x-A.cx,dz=o.z-A.cz;const d=Math.hypot(dx,dz)||0.001,lim=A.R-r;
  if(d>lim){o.x=A.cx+dx/d*lim;o.z=A.cz+dz/d*lim;}
}
function separate(a,b,wa,wb){ // 重さの比で重なりを解消
  const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz)||0.001,rs=a.r+b.r;
  if(d<rs){const nx=dx/d,nz=dz/d,dep=rs-d,sa=wb/(wa+wb),sb=wa/(wa+wb);
    a.x-=nx*dep*sa;a.z-=nz*dep*sa;b.x+=nx*dep*sb;b.z+=nz*dep*sb;}
}
// けっかの 表示と タップで もういちど が できる までの 時間(ゆうしゃが たおれたときは 演出の あと)
// かったときは ポーズが おわる ころ(よゆうは 剣を さやに おさめる まで ながい)に 結果を 出す
const winShowT=()=>S&&S.victory&&S.victory.grade==='easy'?5.2:3.0;
export function overReadyT(kind){return kind==='win'?winShowT()+0.4:(kind==='hero'?3.0:0.7);}
export function overShowT(kind){return kind==='win'?winShowT():(kind==='hero'?2.6:0);}
function endGame(kind){
  S.over=kind;S.overT=0;inp.down=false;inp.fwd=0;inp.lat=0;inp.flickPending=false;
  S.beams=[];S.spells=[];S.hero.swingV=0;S.hero.swingT=0; // ゲームの じかんが とまるので、のこっていると 黄色い線(こうげきの ビーム)や 剣の軌跡が きえなくなる
  if(kind==='win'){ // かった: かちかたで 3つの ポーズ(ゆうしゃの HP の わりあいで きめる)
    const h=S.hero,r=h.hp/CFG.hero.hp,V=CFG.victory;
    S.victory={grade:r>=V.easy?'easy':(r<V.close?'close':'normal'),t:0,yaw:S.cam.yaw,said:false,dustT:0};
    h.stun=0;h.hitT=-1;h.kx=0;h.kz=0;h.swingV=0;h.swingT=0;h.mv=0;h.pushK=0;h.firmK=1;h.stance='firm';
  }
  if(kind==='hero'){ // ゆうしゃが たおれた: てきに かこまれて ボコボコに される演出
    S.defeat={t:0,yaw:S.cam.yaw};S.hero.dead=true;S.hero.stance='normal';
    for(const e of S.enemies){e.tele=0;e.atkTele=0;e.dash=0;e.beat=0;e.beatT=0;e.beatN=0;}
  }
}
function parryWindow(rem){ // 「！」のさいごの すこしの間に ふったフリックだけが いなしになる
  const d=performance.now()-inp.flickT,W=CFG.parryWin;
  return inp.parryOK&&rem<=W&&d<200&&d<=(W-rem)*1000+40;
}
function parryEnemy(e,h){ // いなす成功
  const nx=e.x-h.x,nz=e.z-h.z,nd=Math.hypot(nx,nz)||0.001;
  e.tele=0;e.atkTele=0;e.dash=0;e.plan=pickPlan();e.stagger=CFG.counter.stagger;e.gauge=0;e.atkCd=CFG.enemyAtk.cd;
  e.kx=nx/nd*CFG.counter.knock;e.kz=nz/nd*CFG.counter.knock;e.flash=0.2;
  S.shake=Math.max(S.shake,0.3);inp.flickT=-1000;inp.flickPending=false;
  addText('いなす！',h.x,h.z,2.4,'#7cf5ff');
}

function addHate(e,who,v){e.hate[who]=Math.min(CFG.hate.max,e.hate[who]+v);}
// ふみこんだ ときに てきが おりたつ ばしょ(ねらった あいての ほうへ len だけ。あいてに めりこまない)
export function lungeLanding(e,tgt){
  const dx=tgt.x-e.x,dz=tgt.z-e.z,d=Math.hypot(dx,dz)||0.001,ux=dx/d,uz=dz/d;
  const want=(e.atkKind==='sweep'?CFG.lunge.sweep:CFG.lunge.hit)*(tgt===S.ally?CFG.lunge.ally:1),len=Math.max(0,Math.min(want,d-(e.r+tgt.r+0.2)));
  return {x:e.x+ux*len,z:e.z+uz*len,ux,uz,len};
}
function hurtEnemy(e,dmg,who,note,hate){
  e.hp=Math.max(0,e.hp-dmg);e.flash=0.12;addHate(e,who,dmg*(hate!==undefined?hate:(who==='ally'?CFG.hate.perDmgAlly:CFG.hate.perDmg))); // こうげきは ヘイトが たまりやすい
  addPop(e.x,e.z,2.6*e.r+0.3,String(Math.round(dmg)),who==='hero'?'#ffe01a':'#ffa24a',Math.min(62,26+dmg*1.3+(note?6:0)),note,who==='hero');
  if(e.hp<=0&&!e.dead){e.dead=true;e.tele=0;e.atkTele=0;e.dash=0;S.shake=Math.max(S.shake,0.5);addText('たおした！',e.x,e.z,3.6,'#ffe36a');launchEnemy(e,who);}
}
// 止めをさした敵を、画面の外へ ふっとばす
function launchEnemy(e,who){
  let vx,vy;
  if(who==='hero'&&(inp.flickDx||inp.flickDy)){const l=Math.hypot(inp.flickDx,inp.flickDy)||1;vx=inp.flickDx/l;vy=inp.flickDy/l;}
  else{vx=(Math.random()<0.5?-1:1)*0.6;vy=-1;}
  vy=Math.min(vy,-0.4);const l2=Math.hypot(vx,vy);vx/=l2;vy/=l2; // かならず すこし 上むきに
  const sp=1500;
  S.fly.push({x0:e.sx,y0:e.sy,x:e.sx,y:e.sy,vx:vx*sp,vy:vy*sp,t:0,spin:(vx>=0?1:-1)*14,s:e.sc||30,r:e.r,color:e.color,out:false});
}
function stepFx(dt){
  for(const f of S.fly){
    f.t+=dt;f.x=f.x0+f.vx*f.t;f.y=f.y0+f.vy*f.t;
    if(!f.out&&(f.x<-30||f.x>CW+30||f.y<-30||f.y>CH+30)){
      f.out=true;
      S.sparks.push({x:Math.max(20,Math.min(CW-20,f.x)),y:Math.max(20,Math.min(CH-20,f.y)),life:0.9,max:0.9});
      S.shake=Math.max(S.shake,0.35);
    }
  }
  S.fly=S.fly.filter(f=>f.t<1.6);
  for(const q of S.sparks)q.life-=dt;
  S.sparks=S.sparks.filter(q=>q.life>0);
  for(const r of S.rings)r.t+=dt;S.rings=S.rings.filter(r=>r.t<r.max); // 地面の 輪(着地・魔法の あたった ところ)。ふだんの間も 消す(きえないと あしもとに のこる)
}
function hitHero(dmg,nx,nz,kn,note){
  const h=S.hero;h.hp=Math.max(0,h.hp-dmg);h.flash=0.25;S.shake=Math.max(S.shake,0.4);h.x+=nx*kn;h.z+=nz*kn;
  addPop(h.x,h.z,2.6,'-'+dmg,'#ff7070',34,note||'',false);
}
function hitAlly(dmg,nx,nz,kn,note){
  const a=S.ally;a.hp=Math.max(0,a.hp-dmg);a.flash=0.25;S.shake=Math.max(S.shake,0.35);a.x+=nx*kn;a.z+=nz*kn;
  addPop(a.x,a.z,2.4,'-'+dmg,'#ff7070',32,note||'',false);
}
function fixLock(){
  if(S.enemies[S.lock].dead){
    let best=-1,bd=1e9;
    S.enemies.forEach((e,i)=>{if(!e.dead){const d=Math.hypot(e.x-S.hero.x,e.z-S.hero.z);if(d<bd){bd=d;best=i;}}});
    if(best>=0)S.lock=best;
  }
}

export function step(dt){
  stepFx(dt);
  if(S.over){S.overT+=dt;S.shake=Math.max(0,S.shake-dt);if(S.defeat)stepDefeat(dt);else if(S.victory)stepVictory(dt);return;}
  if(S.intro){stepIntro(dt);return;} // スタートの演出の間は ゲームを とめる
  S.t+=dt;
  const h=S.hero,a=S.ally,A=CFG.arena;
  fixLock();
  const E=S.enemies.filter(e=>!e.dead);
  let L=S.enemies[S.lock];
  h.stun=Math.max(0,h.stun-dt);if(h.hitT>=0){h.hitT+=dt;if(h.hitT>=(h.stunMax||0))h.hitT=-1;}h.flash=Math.max(0,h.flash-dt);a.flash=Math.max(0,a.flash-dt);
  S.shake=Math.max(0,S.shake-dt*1.6);
  for(const b of S.beams)b.life-=dt;
  S.beams=S.beams.filter(b=>b.life>0);

  // --- ゆうしゃのかまえ ---
  let fwdIn=inp.fwd,latIn=inp.lat,stance='firm';
  if(performance.now()-inp.flickT<250){fwdIn=0;latIn=0;} // けんを ふっている間は その場に ふみとどまる
  if(h.stun>0){fwdIn=0;latIn=0;stance='normal';}
  else if(inp.down){
    if(fwdIn>0.25)stance='push';
    else if(Math.hypot(fwdIn,latIn)<0.2)stance='firm';
    else stance='normal';
  }
  h.stance=stance;
  // 「おす」「ふんばる」の ポーズの つよさ(0〜1。なめらかに かわる。見た目だけに つかう)
  h.pushK=(h.pushK||0)+((stance==='push'?1:0)-(h.pushK||0))*Math.min(1,dt*9);
  h.firmK=(h.firmK||0)+((stance==='firm'?1:0)-(h.firmK||0))*Math.min(1,dt*9);
  h.pushT=stance==='push'?h.pushT+dt:0;

  // --- ゆうしゃの移動(ロックしたてきを中心にした相対操作) ---
  {
    const dx=L.x-h.x,dz=L.z-h.z;const d=Math.hypot(dx,dz)||0.001;
    const ux=-dx/d,uz=-dz/d;
    let tx=-uz,tz=ux;
    const cfz=Math.cos(S.cam.yaw),cfx=Math.sin(S.cam.yaw),crx=cfz,crz=-cfx;
    if(tx*crx+tz*crz<0){tx=-tx;tz=-tz;}
    let ff=fwdIn;
    if(ff>0&&L.info.contact&&L.info.R<CFG.thr.win)ff=0;
    const sp=CFG.hero.speed;
    const nd=Math.max(0.3,d-ff*sp*dt);
    const rx=ux*d+tx*latIn*sp*dt,rz=uz*d+tz*latIn*sp*dt;
    const rl=Math.hypot(rx,rz)||0.001;
    h.x=L.x+rx/rl*nd;h.z=L.z+rz/rl*nd;
  }
  if(h.kx||h.kz){ // 痛恨で ふっとんでいる(だんだん おそくなる)
    h.x+=h.kx*dt;h.z+=h.kz*dt;const dc=Math.exp(-CFG.counter.crit.k*dt);h.kx*=dc;h.kz*=dc;
    if(Math.hypot(h.kx,h.kz)<0.3){h.kx=0;h.kz=0;}
  }
  { // あるきの アニメ用 + ゆうしゃの むき(うしろ・みぎ・ひだり・まえ)
    const lx0=h.lx===undefined?h.x:h.lx,lz0=h.lz===undefined?h.z:h.lz;
    const dxw=h.x-lx0,dzw=h.z-lz0,mvd=Math.hypot(dxw,dzw),spd=mvd/Math.max(dt,0.001);
    const tgt=Math.min(1,spd/(CFG.hero.speed*0.6));
    h.mv+=((h.stun>0?0:tgt)-h.mv)*Math.min(1,dt*12);h.ph+=mvd*2.6;h.lx=h.x;h.lz=h.z;
    const yfx=Math.sin(S.cam.yaw),yfz=Math.cos(S.cam.yaw),yrx=yfz,yrz=-yfx; // カメラの前・右
    if(h.stun>0){h.fr=0;h.ff=1;h.idleT=0;} // ふっとび中・うごけない間は まっすぐ(ふっとんでも むきを かえない)
    else if(h.swingV>0){h.fr=0;h.ff=1;h.faceHold=0.35;h.idleT=0;} // 剣をふる間は てきのほうを むく(画面で ふりの むきが そのまま 見える)
    else if(h.faceHold>0){h.faceHold-=dt;}
    else if(spd>0.9){
      const dr=dxw*yrx+dzw*yrz,df=dxw*yfx+dzw*yfz,l=Math.hypot(dr,df)||1;h.fr=dr/l;h.ff=df/l;h.idleT=0;
    }else{h.idleT+=dt;if(h.idleT>0.3){h.fr=0;h.ff=1;}} // 止まったら てきのほう(うしろ向き)にもどる
    // 3Dモデルの むき: 画面での むき(右・奥)から 角度を出し、なめらかに まわす
    const tgtA=Math.atan2(h.fr,-h.ff);let da=tgtA-h.yaw3;da=Math.atan2(Math.sin(da),Math.cos(da));
    h.yaw3+=Math.max(-16*dt,Math.min(16*dt,da));
  }

  // --- まほうつかいの移動(できるだけ てきから はなれる) ---
  if(E.length>0){
    a.rt=(a.rt||0)-dt;
    if(a.rt<=0||a.tx===undefined){
      a.rt=0.25;
      let bestS=-1e9,bx=a.x,bz=a.z;
      const cands=[[0,0]];
      for(let k=0;k<16;k++){const t=k/16*Math.PI*2;cands.push([Math.cos(t)*3.2,Math.sin(t)*3.2]);if(k%2===0)cands.push([Math.cos(t)*1.6,Math.sin(t)*1.6]);}
      for(const c of cands){
        const px=a.x+c[0],pz=a.z+c[1];
        const cdx=px-A.cx,cdz=pz-A.cz,cd=Math.hypot(cdx,cdz);
        if(cd>A.R-1.2)continue;
        const ds=E.map(e=>Math.hypot(px-e.x,pz-e.z)).sort((m,n)=>m-n);
        let sc=Math.min(ds[0],14)+0.35*Math.min(ds[ds.length-1],14);
        if(cd>A.R-3)sc-=(cd-(A.R-3))*2.5;
        const dh=Math.hypot(px-h.x,pz-h.z);
        if(dh>7)sc-=(dh-7)*0.15;
        if(dh<h.r+a.r+0.2)sc-=2;
        sc-=Math.hypot(c[0],c[1])*0.05;
        if(sc>bestS){bestS=sc;bx=px;bz=pz;}
      }
      a.tx=bx;a.tz=bz;
    }
    let panic=false;
    for(const e of E){if(e.atkTele>0&&e.target==='ally'&&e.atkMax-e.atkTele>=CFG.ally.react)panic=true;} // こうげきの よこくを 見てから すこし おくれて にげはじめる
    const sp=CFG.ally.speed*(panic?1.25:1)*(a.cast?0:1); // えいしょう中は うごけない(さがりながら うてない)
    let vx=a.tx-a.x,vz=a.tz-a.z;const vl=Math.hypot(vx,vz);
    if(vl>0.05){const m=Math.min(sp,vl*4);vx=vx/vl*m;vz=vz/vl*m;a.x+=vx*dt;a.z+=vz*dt;}
  }

  // --- てきの行動(ヘイト・ねらい・移動・こうげき) ---
  for(const e of E){
    e.atkCd=Math.max(0,e.atkCd-dt);e.stagger=Math.max(0,e.stagger-dt);e.flash=Math.max(0,e.flash-dt);e.tflash=Math.max(0,e.tflash-dt);
    if(e.dash>0){ // とっしん中: 一直線に走り、あたった相手にダメージ
      const CH2=CFG.atkCharge,stp=Math.min(e.dashLeft,CH2.speed*dt);
      e.x+=e.dx*stp;e.z+=e.dz*stp;e.dashLeft-=stp;e.fx=e.dx;e.fz=e.dz;
      if(!e.hitH&&Math.hypot(h.x-e.x,h.z-e.z)<=e.r*0.7+h.r+0.1){e.hitH=true;hitHero(h.stance==='firm'?CH2.dmgHeroFirm:CH2.dmgHero,e.dx,e.dz,CH2.knock,'とっしん');}
      if(!e.hitA&&Math.hypot(a.x-e.x,a.z-e.z)<=e.r*0.7+a.r+0.1){e.hitA=true;hitAlly(CH2.dmgAlly,e.dx,e.dz,CH2.knock,'とっしん');}
      if(e.dashLeft<=0.001){e.dash=0;e.stagger=CH2.rest;e.atkCd=CFG.enemyAtk.cd;e.plan=pickPlan();e.kx=0;e.kz=0;addText('つかれた…',e.x,e.z,3.2,'#9fe8ff');}
      continue;
    }
    // ヘイト: 時間でへる / おしあいでたまる(こうげきは hurtEnemy でたくさんたまる)
    const HT=e.hate,HC=CFG.hate;
    // ヘイトは 多いほど はやく へる(大きくためた人も、こうげきを やめると すぐ さがる)
    HT.hero=Math.max(0,HT.hero-(HC.decay+HC.decayK*HT.hero)*dt);HT.ally=Math.max(0,HT.ally-(HC.decay+HC.decayK*HT.ally)*dt);
    // 範囲に入った味方に気づく(近いほど すこし ヘイトが高い。範囲にいる間は ねらいを うしなわない)
    for(const [who,u] of [['hero',h],['ally',a]]){
      const d=Math.hypot(u.x-e.x,u.z-e.z);
      if(d<=CFG.aggro)HT[who]=Math.max(HT[who],HC.acquire+0.5+(CFG.aggro-d)*0.15);
    }
    if(e.info.contact)addHate(e,'hero',(h.stance==='push'?HC.pushPush:HC.pushHold)*dt);
    if(e.tele<=0&&e.atkTele<=0){
      const best=HT.hero>=HT.ally?'hero':'ally';
      if(!e.target){
        if(HT[best]>=HC.acquire){e.target=best;e.tflash=1.0;}
      }else{
        const other=e.target==='hero'?'ally':'hero';
        if(HT[other]>HT[e.target]*HC.switchRatio&&HT[other]>=HC.acquire){e.target=other;e.tflash=1.0;}
        else if(HT.hero<HC.lose&&HT.ally<HC.lose){e.target=null;}
      }
    }
    // ターゲットなし: 土俵をうろうろ歩く(ときどき立ちどまる)
    if(!e.target){
      const WA=CFG.arena;
      if(e.wx===undefined){e.wx=e.x;e.wz=e.z;e.wT=0.5+Math.random()*1.5;}
      let mvx=0,mvz=0;
      if(e.wT>0){e.wT-=dt;}
      else{
        const dx=e.wx-e.x,dz=e.wz-e.z,dd=Math.hypot(dx,dz);
        if(dd<0.6){ // 目的地についたら、すこし立ちどまり、つぎの場所をえらぶ
          e.wT=1.0+Math.random()*2.0;
          const ang=Math.random()*Math.PI*2,rad=Math.sqrt(Math.random())*(WA.R-3);
          e.wx=WA.cx+Math.cos(ang)*rad;e.wz=WA.cz+Math.sin(ang)*rad;
        }else{mvx=dx/dd;mvz=dz/dd;}
      }
      const ws=e.speed*0.4*(e.stagger>0?0.3:1);
      e.x+=mvx*ws*dt;e.z+=mvz*ws*dt;
      if(mvx||mvz){const k=Math.min(1,4*dt);e.fx+=(mvx-e.fx)*k;e.fz+=(mvz-e.fz)*k;const fl=Math.hypot(e.fx,e.fz)||1;e.fx/=fl;e.fz/=fl;}
      e.x+=e.kx*dt;e.z+=e.kz*dt;const dc=Math.exp(-8*dt);e.kx*=dc;e.kz*=dc;
      continue;
    }
    const tgt=e.target==='hero'?h:a;
    const tx=tgt.x-e.x,tz=tgt.z-e.z,td=Math.hypot(tx,tz)||0.001;
    const reach=e.r+tgt.r+(e.target==='hero'?CFG.enemyAtk.reachHero:CFG.enemyAtk.reachAlly);
    {const k=Math.min(1,6*dt);e.fx+=(tx/td-e.fx)*k;e.fz+=(tz/td-e.fz)*k;const fl=Math.hypot(e.fx,e.fz)||1;e.fx/=fl;e.fz/=fl;}
    if(e.tele<=0&&e.atkTele<=0&&td>reach){
      const sp=e.speed*(e.stagger>0?0.3:1);
      let mx=tx/td,mz=tz/td;
      if(e.target==='ally'&&e.info.contact){
        e.flankT-=dt;
        if(e.flankT<=0){e.flankDir=-e.flankDir;e.flankT=2.2;}
        mx+=-tz/td*e.flankDir*0.7;mz+=tx/td*e.flankDir*0.7;
        const ml=Math.hypot(mx,mz)||1;mx/=ml;mz/=ml;
      }
      e.x+=mx*sp*dt;e.z+=mz*sp*dt;
    }
    e.x+=e.kx*dt;e.z+=e.kz*dt;
    const dec=Math.exp(-8*dt);e.kx*=dec;e.kz*=dec;

    if(e.tele<=0&&e.atkTele<=0&&e.stagger<=0&&e.atkCd<=0){
      if(td<=reach+0.15){ // ちかい: たたきつけ / なぎはらい
        e.atkKind=e.plan==='sweep'?'sweep':'hit';
        e.atkTele=e.atkMax=(e.atkKind==='sweep'?CFG.atkSweep.tele:CFG.enemyAtk.tele);
        e.lunge=e.hp/e.maxHp>=CFG.lunge.hpRatio; // HP に よゆうが ある ときだけ、あたる しゅんかんに ふみこむ
        if(e.atkKind==='sweep')addText('なぎはらい！',e.x,e.z,3.4,'#ffb090');
      }else if(e.plan==='charge'&&td>=CFG.atkCharge.minD&&td<=CFG.atkCharge.maxD){ // とおい: とっしん
        e.atkKind='charge';e.lunge=false;e.atkTele=e.atkMax=CFG.atkCharge.tele;e.cx=tgt.x;e.cz=tgt.z;
        addText('とっしん！',e.x,e.z,3.4,'#ffb090');
      }
    }
    if(e.atkTele>0){
      e.atkTele-=dt;
      const kind=e.atkKind;
      if(kind==='charge'&&e.atkTele>CFG.atkCharge.track){e.cx=tgt.x;e.cz=tgt.z;} // とつぜんの直前までは ねらいを追う
      const parryR=(kind==='hit'?reach+0.8:(kind==='sweep'?e.r+CFG.atkSweep.r+0.6:CFG.atkCharge.maxD+2))+(e.lunge?(kind==='sweep'?CFG.lunge.sweep:CFG.lunge.hit):0);
      if(e.target==='hero'&&td<parryR&&parryWindow(e.atkTele)){parryEnemy(e,h);}
      else if(e.atkTele<=0){
        // ふみこみ: あたる しゅんかんに ねらった あいての ほうへ すこし すすむ(ふみこんだ さきで あたりを とる)。あいての からだには めりこまない
        let lx=e.x,lz=e.z,tdL=td;
        if(e.lunge&&(kind==='hit'||kind==='sweep')){
          const L=lungeLanding(e,tgt);lx=L.x;lz=L.z;tdL=Math.hypot(tgt.x-lx,tgt.z-lz);
          if(L.len>0.05){e.kx+=(L.ux)*L.len*8;e.kz+=(L.uz)*L.len*8;} // かるく すべるように とぶ(ひく 8 で およそ len だけ すすむ)
        }
        if(kind==='hit'){
          if(tdL<=reach*1.35+0.2){
            if(e.target==='ally'){
              a.hp=Math.max(0,a.hp-CFG.enemyAtk.dmgAlly);a.flash=0.25;S.shake=Math.max(S.shake,0.35);
              addPop(a.x,a.z,2.4,'-'+CFG.enemyAtk.dmgAlly,'#ff7070',32,'',false);
            }else{
              const dmg=h.stance==='firm'?CFG.enemyAtk.dmgHeroFirm:CFG.enemyAtk.dmgHero;
              h.hp=Math.max(0,h.hp-dmg);h.flash=0.25;S.shake=Math.max(S.shake,0.35);
              addPop(h.x,h.z,2.6,'-'+dmg,'#ff7070',34,'',false);
            }
          }else addText('かわした',tgt.x,tgt.z,2.0,'#cfd4ff');
        }else if(kind==='sweep'){
          const SW=CFG.atkSweep,R=e.r+SW.r;let any=false;
          {const dx=h.x-lx,dz=h.z-lz,d=Math.hypot(dx,dz)||0.001;
           if(d<=R+h.r){any=true;hitHero(h.stance==='firm'?SW.dmgHeroFirm:SW.dmgHero,dx/d,dz/d,SW.knock,'なぎはらい');}}
          {const dx=a.x-lx,dz=a.z-lz,d=Math.hypot(dx,dz)||0.001;
           if(d<=R+a.r){any=true;hitAlly(SW.dmgAlly,dx/d,dz/d,SW.knock,'なぎはらい');}}
          S.shake=Math.max(S.shake,0.25);
          if(!any)addText('かわした',tgt.x,tgt.z,2.0,'#cfd4ff');
        }else{ // とっしん: ねらった場所へ 一気にかけぬける
          const CH2=CFG.atkCharge,ddx=e.cx-e.x,ddz=e.cz-e.z,dd=Math.hypot(ddx,ddz)||0.001;
          e.dx=ddx/dd;e.dz=ddz/dd;e.dashLeft=Math.min(dd+CH2.over,CH2.maxD+CH2.over);e.dash=1;e.hitH=false;e.hitA=false;
        }
        if(kind!=='charge'){e.atkCd=CFG.enemyAtk.cd;e.plan=pickPlan();}
      }
    }
  }

  // --- 押し合い(ゆうしゃ×各てき) ---
  for(const e of E){
    let dx=e.x-h.x,dz=e.z-h.z;let d=Math.hypot(dx,dz)||0.001;const rs=h.r+e.r;
    const nx=dx/d,nz=dz/d;
    const aDot=e.fx*(-nx)+e.fz*(-nz);
    const angle=aDot>0.55?'front':(aDot>-0.2?'side':'back');
    const Wh=CFG.hero.w*CFG.stanceMult[stance]*CFG.angleMult[angle];
    const We=e.w*(e.stagger>0?0.25:1);
    const R=Wh/We;
    if(d<rs){
      const dep=rs-d;
      let hs=0;
      if(R>=CFG.thr.hold)hs=0;
      else if(R>=CFG.thr.lose)hs=(1-R)/(1-CFG.thr.lose)*0.7;
      else hs=1.0;
      h.x-=nx*dep*hs;h.z-=nz*dep*hs;
      e.x+=nx*dep*(1-hs);e.z+=nz*dep*(1-hs);
      d=Math.hypot(e.x-h.x,e.z-h.z)||0.001;
    }
    e.info={contact:d<rs+0.1,R,wh:Wh,we:We,angle};
  }
  if(E.length>1)separate(E[0],E[1],E[0].w,E[1].w);
  separate(h,a,CFG.hero.w,CFG.ally.w);
  for(const e of E)separate(a,e,CFG.ally.w,e.w);

  // --- ゆうしゃのこうげき(フリックで けんを ふる) ---
  h.swingCd=Math.max(0,h.swingCd-dt);h.swingT=Math.max(0,h.swingT-dt);h.swingV=Math.max(0,h.swingV-dt);
  h.noParry=Math.max(0,h.noParry-dt);
  h.sta=Math.min(CFG.sta.max,h.sta+CFG.sta.regen*dt);
  if(h.tired&&h.sta>=CFG.sta.recover)h.tired=false;
  if(inp.flickPending&&inp.flickBlocked){ // おしている間は 剣を ふれない(いなす は できる)
    inp.flickPending=false;inp.flickBlocked=false;inp.flickEnemy=-1;
    addText('おしている間は ふれない！',h.x,h.z,2.6,'#ff9a90');
  }
  if(inp.flickPending){
    // ふる間隔の最中に入れたフリックは、少しのあいだ ためておく(とりこぼしぼうし)
    if(h.stun>0||performance.now()-inp.flickT>320){inp.flickPending=false;}
    else if(h.swingCd<=0&&(performance.now()-inp.flickT>=60||!inp.down)){
      inp.flickPending=false;
      h.noParry=CFG.noParry;
      if(h.tired){inp.flickEnemy=-1;addText('いきぎれ！ ふれない',h.x,h.z,2.6,'#ff9a90');}
      else{
      const peak=inp.flickPeak||900;
      const spM=Math.max(0.8,Math.min(2.0,0.6+peak/1500));
      h.sta-=CFG.sta.base+CFG.sta.perPower*(spM-0.8); // はやく つよく ふるほど きりょくを つかう
      if(h.sta<=0){h.sta=0;h.tired=true;}
      h.swingCd=CFG.hero.swingCd;h.swingT=0.2;h.swingV=0.34;h.swingAng=Math.atan2(inp.flickDy||0,inp.flickDx||1);
      const fxw=Math.sin(S.cam.yaw),fzw=Math.cos(S.cam.yaw);
      let tg=null,bd=1e9,lunge=false,far=false;
      const fe=inp.flickEnemy>=0?S.enemies[inp.flickEnemy]:null;
      inp.flickEnemy=-1;
      if(fe&&!fe.dead){ // かさねた てきを ねらう(とおくても ふみこむ)
        const dxl=fe.x-h.x,dzl=fe.z-h.z,dl=Math.hypot(dxl,dzl)||0.001,gap=dl-(h.r+fe.r);
        if(gap<=CFG.hero.swingReach+2.4){
          if(gap>CFG.hero.swingReach){const mv=Math.min(Math.max(0,gap-0.3),2.4);h.x+=dxl/dl*mv;h.z+=dzl/dl*mv;lunge=true;}
          tg=fe;
        }else far=true;
      }else{
        for(const e of E){
          if(e.dead)continue;
          const dx=e.x-h.x,dz=e.z-h.z,dc=Math.hypot(dx,dz)||0.001;
          const gap=dc-(h.r+e.r);
          if(gap>CFG.hero.swingReach)continue;
          if((dx*fxw+dz*fzw)/dc<0)continue; // まえがわ(はんえん)
          const sc=gap-(e===L?0.5:0);
          if(sc<bd){bd=sc;tg=e;}
        }
        if(!tg&&!L.dead){ // すこし遠くても、ロックしたてきには ふみこんで あてる
          const dxl=L.x-h.x,dzl=L.z-h.z,dl=Math.hypot(dxl,dzl)||0.001,gap=dl-(h.r+L.r);
          if(gap<=CFG.hero.swingReach+1.4&&(dxl*fxw+dzl*fzw)/dl>0){
            const mv=Math.min(Math.max(0,gap-0.3),1.4);h.x+=dxl/dl*mv;h.z+=dzl/dl*mv;tg=L;lunge=true;
          }
        }
      }
      if(tg){
        // フリックの しかたで ダメージが かわる: はやさ(0.8〜2.0倍) × むき(よこ1.0 / ななめ1.15 / たて1.3)
        const ax=Math.abs(inp.flickDx||1),ay=Math.abs(inp.flickDy||0);
        let kind='',dm=1.0;
        if(ay>ax*1.6){kind='たてぎり';dm=1.3;}else if(ay>ax*0.6){kind='ななめぎり';dm=1.15;}
        const back=tg.info.angle==='back';
        const open=tg.stagger>0; // てきが よろけている(いなした あと・とっしんの あと)
        const dmg=Math.round(CFG.hero.dmg*spM*dm*(back?CFG.hero.backBonus:1)*(open?CFG.openMul:1));
        const tag=spM>=1.8?'かいしん！':(spM>=1.45?'つよい！':(spM<1.0?'かるい':''));
        const note=[open?'スキあり！':'',back?'うしろから！':'',kind,tag].filter(Boolean).join(' ');
        S.beams.push({x1:h.x,z1:h.z,x2:tg.x,z2:tg.z,y1:1.0,y2:1.2,life:0.12,col:'#ffe01a'});
        hurtEnemy(tg,dmg,'hero',note);
        if(spM>=1.8)S.shake=Math.max(S.shake,0.25);
        try{if(navigator.vibrate)navigator.vibrate(spM>=1.45?22:12);}catch(_){}
      }else addText(far?'とおい！':'から振り',h.x,h.z,2.2,'#aab0d8');
      inp.flickPeak=0;
      }
    }
  }

  // --- まほうつかいのこうげき(はなれたところから。ほのおの魔法で MP を つかう) ---
  //   弱い炎: すぐ でる・MP すくない・よわい / 強い炎: えいしょうが ながい・MP おおい・つよい(てきが ちかい/ねらわれている ときは つかわない)
  {
    const AL=CFG.ally,nearest=()=>{let tg=null,bd=AL.range;for(const e of E){if(e.dead)continue;const d=Math.hypot(e.x-a.x,e.z-a.z);if(d<bd){bd=d;tg=e;}}return tg;};
    a.mp=Math.min(AL.mp,a.mp+AL.mpRegen*dt);
    if(a.cast){ // えいしょう中
      a.cast.t+=dt;
      if(a.cast.t>=a.cast.dur){
        const K=AL[a.cast.kind],tg=nearest();
        if(tg)S.spells.push({kind:a.cast.kind,sx:a.x,sz:a.z,e:tg,t:0,dur:K.fly,dmg:K.dmg,hate:K.hate});
        a.castT=a.cd=K.cd;a.cast=null;
      }
    }else{
      a.castT-=dt;
      if(a.castT<=0){
        const tg=nearest();
        if(!tg)a.castT=0.3;
        else if(E.some(e=>!e.dead&&e.atkTele>0&&e.target==='ally'))a.castT=0.15; // ねらわれて こうげきが くる ときは にげるのを ゆうせん
        else{
          const danger=E.some(e=>!e.dead&&(Math.hypot(e.x-a.x,e.z-a.z)<6||e.target==='ally'));
          let kind=null;
          if(a.mp>=AL.strong.cost&&!danger)kind='strong';
          else if(a.mp>=AL.weak.cost)kind='weak';
          if(kind){
            const K=AL[kind];a.mp-=K.cost;a.cast={kind,t:0,dur:K.cast};
            addText(kind==='strong'?K.name+'…':K.name,a.x,a.z,3.0,kind==='strong'?'#ff9a4a':'#ffd08a');
          }else{a.castT=0.6;if(S.t-a.warnedMp>3){a.warnedMp=S.t;addText('MPが たりない！',a.x,a.z,3.0,'#9fc8ff');}}
        }
      }
    }
    // とんでいく ほのお → あたったら ダメージ
    for(const sp of S.spells){
      sp.t+=dt;
      if(sp.t>=sp.dur){
        sp.done=true;const e=sp.e;
        if(!e.dead){
          hurtEnemy(e,sp.dmg,'ally',sp.kind==='strong'?AL.strong.name+'！':'',sp.dmg*sp.hate);
          S.rings.push({x:e.x,z:e.z,t:0,max:sp.kind==='strong'?0.8:0.45,r:e.r*(sp.kind==='strong'?1.0:0.6),rgb:'255,140,50'});
          if(sp.kind==='strong')S.shake=Math.max(S.shake,0.4);
        }
      }
    }
    S.spells=S.spells.filter(sp=>!sp.done);
  }

  // --- ねばりゲージとはんげき ---
  for(const e of E){
    if(e.dead)continue;
    const info=e.info,G=CFG.gauge;
    if(info.contact&&e.tele<=0&&e.stagger<=0){
      if(stance==='push')e.gauge+=G.pushUp*dt;
      else if(stance==='firm')e.gauge=Math.max(0,e.gauge-G.firmDown*dt);
      else e.gauge+=G.normalUp*dt;
    }else if(!info.contact){e.gauge=Math.max(0,e.gauge-G.idleDown*dt);}
    e.gauge=Math.min(100,e.gauge);
    if(e.gauge>=100&&e.tele<=0&&e.atkTele<=0&&e.dash<=0&&info.contact&&e.stagger<=0)e.tele=CFG.counter.tele;
    if(e.tele>0){
      e.tele-=dt;
      const nx=e.x-h.x,nz=e.z-h.z,nd=Math.hypot(nx,nz)||0.001;
      if(parryWindow(e.tele)){parryEnemy(e,h);}
      else if(e.tele<=0){
        if(nd<h.r+e.r+CFG.counter.reach){
          const firm=h.stance==='firm',C=CFG.counter,dmg=firm?C.dmgFirm:C.dmg;
          h.hp=Math.max(0,h.hp-dmg);h.flash=0.3;S.shake=Math.max(S.shake,0.5);
          if(firm){ // ふんばって たえた: ダメージ小・ふっとばない
            h.x-=nx/nd*1.0;h.z-=nz/nd*1.0;
            addPop(h.x,h.z,2.6,'-'+dmg,'#ff8a3a',40,'はんげき！',false);
          }else{ // 痛恨の一撃: ふっとび、しばらく うごけない
            const K=C.crit,v=K.dist*K.k;
            h.kx=-nx/nd*v;h.kz=-nz/nd*v;h.stun=h.stunMax=K.stun;h.hitT=0;h.pushT=0;
            S.shake=Math.max(S.shake,1.0);
            addPop(h.x,h.z,2.6,'-'+dmg,'#ff4a2a',56,'つうこんの いちげき！',false);
            try{if(navigator.vibrate)navigator.vibrate([40,30,60]);}catch(_){}
          }
          e.gauge=CFG.gauge.reset;
        }else{addText('からぶり',e.x,e.z,2.4,'#cccccc');e.gauge=0;}
      }
    }
  }

  // --- どひょうの外(ダメージなし。ふちで とまる。ユーザー指示 2026-11-21) ---
  clampArena(h,h.r);
  for(const e of E)clampArena(e,e.r);
  clampArena(a,a.r);

  // --- カメラ(ロックしたてきを向く) ---
  fixLock();L=S.enemies[S.lock];
  {
    const ty=Math.atan2(L.x-h.x,L.z-h.z);
    S.cam.yaw+=wrapAng(ty-S.cam.yaw)*Math.min(1,8*dt);
  }
  for(const t of S.texts)t.life-=dt;
  S.texts=S.texts.filter(t=>t.life>0);
  for(const q of S.pops)q.life-=dt;
  S.pops=S.pops.filter(q=>q.life>0);

  if(h.hp<=0)endGame('hero');else if(a.hp<=0)endGame('ally');
  else if(S.enemies.every(e=>e.dead))endGame('win');
}