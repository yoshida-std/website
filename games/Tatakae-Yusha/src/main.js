// 移行元: prototype-2d.html の該当部分をそのまま移したもの(import/export だけ足した)
import {setET,CFG,ET,ENEMY_TYPES} from './config.js';
import {stage,resize,CW} from './screen.js';
import {S,running,setRunning,inp,init,step,tapLock,enemyAt,checkFlick,skipIntro,stageId,setParty,getParty,partyKey,KINDS,KIND_LIST,formationId,setFormation} from './logic.js';
import {STAGES,stageById,stageWeight} from './stages.js';
import {FORMATIONS,formationById} from './formations.js';
import {getBest} from './records.js';
import {render as render2d} from './render2d.js';
import {render as render3d} from './render3d.js';
// ふだんは WebGL。?r=2d で 移行元と同じ Canvas 2D の描画(くらべる用)
const render=new URLSearchParams(location.search).get('r')==='2d'?render2d:render3d;

// ---- スマホのブラウザ動作の抑止(ダブルタップ拡大・ピンチ・長押し・スクロール) ----
(function(){
  const KEEP='button,.menu,.scrollable';
  document.addEventListener('touchstart',e=>{
    if(e.touches.length>1||!e.target.closest(KEEP))e.preventDefault();
  },{passive:false});
  let lastTouchEnd=0;
  document.addEventListener('touchend',e=>{
    const t=Date.now();
    if(t-lastTouchEnd<350&&!e.target.closest(KEEP))e.preventDefault();
    lastTouchEnd=t;
  },{passive:false});
  document.addEventListener('dblclick',e=>e.preventDefault(),{passive:false});
  ['gesturestart','gesturechange','gestureend'].forEach(t=>document.addEventListener(t,e=>e.preventDefault(),{passive:false}));
  document.addEventListener('contextmenu',e=>e.preventDefault());
  document.addEventListener('touchmove',e=>{if(!e.target.closest('.scrollable,.view,.carousel'))e.preventDefault();},{passive:false}); // よこに スライドする 列(.view/.carousel)は ゆるす
})();

// ================= ループ・UI =================
let last=performance.now(),acc=0;
function loop(now){
  requestAnimationFrame(loop);
  const dt=Math.min(0.1,(now-last)/1000);last=now;
  if(S&&running&&!document.hidden){acc+=dt;let n=0;while(acc>=1/60&&n<6){step(1/60);acc-=1/60;n++;}if(n>=6)acc=0;}
  if(S&&CW>0)render();
}
document.addEventListener('visibilitychange',()=>{last=performance.now();acc=0;inp.down=false;inp.fwd=0;inp.lat=0;});
resize();init();
requestAnimationFrame(loop);

// ---- ステージ選択(ユーザー指示 2026-11-22) ----
// 「はじめる」→ ステージ選択 → えらぶと そのステージで はじまる。上のウィンドウの「ステージえらび」で もどれる
const stagesEl=document.getElementById('stages'),listEl=document.getElementById('stageList');
let lastStage=stageId,played=false; // played: まえに あそんだ ステージが ほぞんされていたか
try{const k=localStorage.getItem('ty_stage');if(k&&STAGES.some(s=>s.id===k)){lastStage=k;played=true;}}catch(_){}
function buildStageList(){
  listEl.innerHTML='';
  STAGES.forEach(st=>{
    const b=document.createElement('button');b.className='stage'+(st.id===lastStage?' on':'');b.dataset.stage=st.id;
    const img=document.createElement('img');img.src=st.thumb;img.alt=st.name;img.draggable=false;
    const n=document.createElement('b');n.textContent=st.name;
    if(played&&st.id===lastStage){const i=document.createElement('i');i.textContent='まえに あそんだ';n.appendChild(i);}
    const wt=stageWeight(st)||ET.w,best=getBest(st.id,wt,partyKey()),c=document.createElement('span'); // おもさが こていの ステージは その おもさ
    c.textContent='とうばつタイム  '+(best===null?'きろくなし':'ベスト '+best.toFixed(1)+' びょう')+'  ('+ENEMY_TYPES[wt].name+')';
    b.append(img,n,c);
    b.addEventListener('click',()=>pickStage(st.id));
    listEl.appendChild(b);
  });
}
// ---- パーティせってい(ユーザー指示 2026-11-22) ----
// ゆうしゃは こてい。のこり3わくを えらぶ(1ばんめ・2ばんめ=ぜんえい、3・4ばんめ=こうえい)。おなじ しょくを かさねても よい。既定は ゆうしゃだけ。ブラウザに おぼえる
const partyEl=document.getElementById('party');
try{const q=JSON.parse(localStorage.getItem('ty_party')||'[]');if(Array.isArray(q))setParty(q);}catch(_){}
try{const f=localStorage.getItem('ty_formation');if(f)setFormation(f);}catch(_){}
function saveParty(){try{localStorage.setItem('ty_party',JSON.stringify(getParty()));}catch(_){}}
function partyText(){const k=getParty().filter(Boolean);return 'ゆうしゃ'+(k.length?' ＋ '+k.map(x=>KINDS[x].name).join(' ＋ '):'（ひとりで たたかう）');}
// わくごとに「かおの サムネイル」を よこに スライドして えらぶ(まんなかに とまった ものが えらばれる。タップでも えらべる)
// ---- わくの ならびが 陣の かたち(ユーザー指示 2026-11-22) ----
// ゆうしゃ(1)と パーティの 3わく(2〜4)を、えらんだ 陣の いちに そのまま ならべる(うえ=てきの ほう)。
// わくの おおきさは「かさならずに 板に はいる いちばん 大きい もの」を 自動で さがす(陣を ふやしても そのまま つかえる)。陣を かえると わくが うごく
const KINDS_ORDER=[null,...KIND_LIST];
let pframes=[]; // [ゆうしゃ, 2ばんめ, 3ばんめ, 4ばんめ] の わく
function layoutBoard(){
  const board=document.getElementById('pboard'),bw=board.clientWidth,bh=board.clientHeight;
  if(!bw||!bh||!pframes.length)return;
  const fm=formationById(formationId);
  const pts=[[0,0],...fm.slots]; // [dx,dz]。ゆうしゃが (0,0)
  const xs=pts.map(p=>p[0]),zs=pts.map(p=>p[1]);
  const xmin=Math.min(...xs),xmax=Math.max(...xs),zmin=Math.min(...zs),zmax=Math.max(...zs),xr=xmax-xmin,zr=zmax-zmin;
  const PAD=8,TOP=16,GAP=6; // TOP=うえの「てきの ほう」の 文字の ぶん
  // たてと よこを おなじ 縮尺(1ぶんが u ピクセル)にして、陣の ほんとうの かたちの まま 板の まんなかに おく
  let best=null;
  for(let w=Math.min(132,bw/2);w>=40;w-=2){
    const fw=w,fh=Math.round(w*1.25)+6;
    const ux=xr>0?(bw-2*PAD-fw)/xr:Infinity,uz=zr>0?(bh-TOP-PAD-fh)/zr:Infinity,u=Math.min(ux,uz);
    if(!(u>0)||u===Infinity)continue;
    let ok=true;
    for(let i=0;i<pts.length&&ok;i++)for(let j=i+1;j<pts.length;j++){
      if(Math.abs(pts[i][0]-pts[j][0])*u<fw+GAP&&Math.abs(pts[i][1]-pts[j][1])*u<fh+GAP){ok=false;break;}
    }
    if(ok){best={fw,fh,u};break;}
  }
  if(!best){const fw=40,fh=56,ux=xr>0?(bw-2*PAD-fw)/xr:Infinity,uz=zr>0?(bh-TOP-PAD-fh)/zr:Infinity;best={fw,fh,u:Math.max(1,Math.min(ux,uz))};}
  const {fw,fh,u}=best;
  board.style.setProperty('--fw',fw+'px');
  const gw=xr*u+fw,gh=zr*u+fh; // 陣ぜんたいの おおきさ
  const ox=(bw-gw)/2,oy=TOP+(bh-TOP-PAD-gh)/2;
  pframes.forEach((f,i)=>{
    const [dx,dz]=pts[i];
    f.style.width=fw+'px';f.style.height=fh+'px';
    f.style.left=Math.round(ox+(dx-xmin)*u)+'px';f.style.top=Math.round(oy+(zmax-dz)*u)+'px';
    if(f._init)f._init(); // おおきさが かわるので スクロールいちを あわせる
  });
}
function buildBoard(){
  const board=document.getElementById('pboard');board.innerHTML='';pframes=[];
  const cur=getParty();
  const page=(k)=>{
    const pg=document.createElement('div');pg.className='pg'+(k?'':' none');
    if(k==='hero'||k){const im=document.createElement('img');im.className='art';im.src='img/portrait-'+k+'.jpg';im.alt='';im.draggable=false;pg.appendChild(im);}
    else{const a=document.createElement('div');a.className='art';a.textContent='なし';pg.appendChild(a);}
    const nm=document.createElement('div');nm.className='nm';nm.textContent=k==='hero'?'ゆうしゃ':(k?KINDS[k].name:'なし');pg.appendChild(nm);
    return pg;
  };
  // ゆうしゃ(こてい)
  {const f=document.createElement('div');f.className='pf';const v=document.createElement('div');v.className='view';v.appendChild(page('hero'));f.appendChild(v);
   const pn=document.createElement('div');pn.className='pn';pn.textContent='1';f.appendChild(pn);board.appendChild(f);pframes.push(f);}
  // パーティの 3わく: わくの なかを よこに スライドして(またはタップで つぎへ)えらぶ
  for(let i=0;i<3;i++){
    const f=document.createElement('div');f.className='pf';
    const v=document.createElement('div');v.className='view';
    KINDS_ORDER.forEach(k=>v.appendChild(page(k)));
    f.appendChild(v);
    const pn=document.createElement('div');pn.className='pn';pn.textContent=String(i+2);f.appendChild(pn);
    const dots=document.createElement('div');dots.className='dots';KINDS_ORDER.forEach(()=>dots.appendChild(document.createElement('i')));f.appendChild(dots);
    let sel=Math.max(0,KINDS_ORDER.indexOf(cur[i]||null));
    const mark=idx=>[...dots.children].forEach((d,j)=>d.classList.toggle('on',j===idx));
    const idxOf=()=>Math.max(0,Math.min(KINDS_ORDER.length-1,Math.round(v.scrollLeft/(v.clientWidth||1))));
    mark(sel);
    let tm=0;
    v.onscroll=()=>{mark(idxOf());clearTimeout(tm);tm=setTimeout(()=>{const idx=idxOf();mark(idx);if(idx!==sel){sel=idx;const a=getParty();while(a.length<3)a.push(null);a[i]=KINDS_ORDER[idx];setParty(a);saveParty();refreshFormationArt();}},110);};
    f.addEventListener('click',()=>{const next=(idxOf()+1)%KINDS_ORDER.length;v.scrollTo({left:next*v.clientWidth,behavior:'smooth'});});
    f._init=()=>{v.scrollLeft=sel*v.clientWidth;};
    board.appendChild(f);pframes.push(f);
  }
}
window.addEventListener('resize',()=>{if(partyEl.style.display==='flex'){layoutBoard();partyEl.querySelectorAll('.row.fm').forEach(r=>r._init&&r._init());}});
// よこに スライドして えらぶ 列の 共通ぶひん。まんなかに とまった カードが えらばれる(止まって 0.11秒で けってい。タップでも えらべる)
//   car=列、cards=カードの 配列、sel=さいしょに えらばれている ばんごう、onPick(ばんごう)=えらばれた とき。{init} を かえす(ひらいた あとで いちを あわせる)
function slideSelect(car,cards,sel,onPick){
  const mark=idx=>cards.forEach((c,j)=>c.classList.toggle('on',j===idx));
  const centerOf=c=>c.offsetLeft-(car.clientWidth-c.offsetWidth)/2; // この カードを まんなかに する scrollLeft(.carousel が position:relative)
  const nearest=()=>{let b=0,bd=1e9;cards.forEach((c,j)=>{const d=Math.abs(centerOf(c)-car.scrollLeft);if(d<bd){bd=d;b=j;}});return b;};
  const choose=idx=>{mark(idx);if(idx!==sel){sel=idx;onPick(idx);}};
  mark(sel);
  let tm=0;
  // 列の 要素は 作りなおしても のこる。addEventListener だと ひらくたびに ふるい 監視が つみかさなって、ふるい じょうたいで えらびなおして しまう → onscroll で 上書きする
  car.onscroll=()=>{mark(nearest());clearTimeout(tm);tm=setTimeout(()=>choose(nearest()),110);};
  cards.forEach((c,j)=>c.addEventListener('click',()=>{car.scrollTo({left:centerOf(c),behavior:'smooth'});choose(j);}));
  return {init:()=>{car.scrollLeft=centerOf(cards[sel]);}};
}
// 陣の ずを SVG で かく(うえ=てきの ほう。金の まる=ゆうしゃ、番号の まる=2〜4ばんめ。いろは いまの パーティの しょく)
const KCOLOR={mage:'#8a5ae0',priest:'#5ab0ff',warrior:'#e08a3a'};
function formationSvg(fm){
  const cur=getParty();
  let g='<rect x="-7" y="-2.6" width="14" height="11.2" fill="none"/>';
  g+='<path d="M-1.4 -2 L0 -3.2 L1.4 -2" stroke="#ff8a8a" stroke-width=".35" fill="none"/>'; // てきの ほう
  g+='<circle cx="0" cy="0" r=".95" fill="#e8b923" stroke="#fff" stroke-width=".2"/><text x="0" y=".33" font-size="1" text-anchor="middle" fill="#222" font-weight="bold">1</text>';
  fm.slots.forEach((d,i)=>{
    const col=cur[i]?KCOLOR[cur[i]]:'#4a5190';
    g+='<circle cx="'+d[0]+'" cy="'+(-d[1])+'" r=".95" fill="'+col+'" stroke="#fff" stroke-width=".2"/><text x="'+d[0]+'" y="'+(-d[1]+0.33)+'" font-size="1" text-anchor="middle" fill="#fff" font-weight="bold">'+(i+2)+'</text>';
  });
  return '<svg class="art" viewBox="-7 -3.6 14 12.2" xmlns="http://www.w3.org/2000/svg">'+g+'</svg>';
}
function buildParty(){
  buildBoard();
  // じんの 列(よこに スライド。えらぶと 上の わくが うごく)
  const frow=partyEl.querySelector('.row.fm'),fcar=frow.querySelector('.carousel');
  fcar.innerHTML='';const fcards=FORMATIONS.map(f=>{
    const c=document.createElement('div');c.className='card fcard';c.dataset.fm=f.id;c.innerHTML=formationSvg(f)+'<div class="nm">'+f.name+'</div>';fcar.appendChild(c);return c;});
  const fsl=slideSelect(fcar,fcards,Math.max(0,FORMATIONS.findIndex(f=>f.id===formationId)),idx=>{setFormation(FORMATIONS[idx].id);saveFormation();layoutBoard();});
  frow._init=fsl.init;
}
// パーティの しょくを かえた とき、じんの ずの いろも かえる
function refreshFormationArt(){partyEl.querySelectorAll('.fcard').forEach(c=>{const f=FORMATIONS.find(x=>x.id===c.dataset.fm);c.querySelector('svg').outerHTML=formationSvg(f);});}
function saveFormation(){try{localStorage.setItem('ty_formation',formationId);}catch(_){}}
let partyFrom='title';
function showParty(from){partyFrom=from;titleEl.style.display='none';stagesEl.style.display='none';buildParty();partyEl.style.display='flex';layoutBoard();partyEl.querySelectorAll('.row.fm').forEach(r=>r._init&&r._init());}
function showStages(){setRunning(false);buildStageList();document.getElementById('stageParty').innerHTML='<b>パーティ</b>'+partyText()+'（'+formationById(formationId).name+'）（タップで へんこう）';stagesEl.style.display='block';}
function pickStage(id){
  lastStage=id;played=true;try{localStorage.setItem('ty_stage',id);}catch(_){}
  stagesEl.style.display='none';
  resize();init(id);setRunning(true);
}
// タイトル: 「はじめる」→ ステージ選択 / 「せつめい」→ 説明の画面(「もどる」でタイトルへ)
const titleEl=document.getElementById('title'),helpEl=document.getElementById('intro');
document.getElementById('start').addEventListener('click',()=>{
  titleEl.style.display='none';helpEl.style.display='none';
  showStages();
});
document.getElementById('partyBtn').addEventListener('click',()=>showParty('title'));
document.getElementById('stageParty').addEventListener('click',()=>showParty('stages'));
document.getElementById('party-back').addEventListener('click',()=>{partyEl.style.display='none';if(partyFrom==='stages')showStages();else titleEl.style.display='flex';});
document.getElementById('howto').addEventListener('click',()=>{titleEl.style.display='none';helpEl.style.display='block';helpEl.scrollTop=0;});
document.getElementById('help-back').addEventListener('click',()=>{helpEl.style.display='none';titleEl.style.display='flex';});
document.getElementById('stages-back').addEventListener('click',()=>{stagesEl.style.display='none';titleEl.style.display='flex';});
// ---- ポーズ(ユーザー指示 2026-11-22: 右上の メニュー(せってい ウィンドウ)を はいし して ポーズに かえた) ----
// 右上の ボタンで ゲームを とめ、「つづける／やりなおし／ステージえらび／タイトルへ」を 出す。(てきの おもさ・フリックの 感度の せっていは なくした)
const pauseEl=document.getElementById('pause');
function pauseGame(){if(!S||!running)return;setRunning(false);pauseEl.style.display='flex';}
function resumeGame(){pauseEl.style.display='none';last=performance.now();acc=0;inp.down=false;inp.fwd=0;inp.lat=0;setRunning(true);}
document.getElementById('pauseBtn').addEventListener('click',pauseGame);
document.getElementById('p-resume').addEventListener('click',resumeGame);
document.getElementById('p-retry').addEventListener('click',()=>{pauseEl.style.display='none';resize();init();last=performance.now();acc=0;setRunning(true);});
document.getElementById('p-stages').addEventListener('click',()=>{pauseEl.style.display='none';showStages();});
document.getElementById('p-title').addEventListener('click',()=>{pauseEl.style.display='none';setRunning(false);titleEl.style.display='flex';});
window.__sumo={setET,setParty,setFormation,pauseGame,resumeGame,init,step,render,skipIntro,tapLock,enemyAt,checkFlick,get S(){return S;},inp,CFG};