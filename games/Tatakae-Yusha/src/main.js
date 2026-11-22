// 移行元: prototype-2d.html の該当部分をそのまま移したもの(import/export だけ足した)
import {FLICKKEY,setFlickKey,setET,CFG,ET,ENEMY_TYPES} from './config.js';
import {stage,barEl,BAR_HIDDEN,measureBar,resize,setBarHidden,CW} from './screen.js';
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
  document.addEventListener('touchmove',e=>{if(!e.target.closest('.scrollable'))e.preventDefault();},{passive:false});
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
// カード1まいの おおきさ(--cw)を 画面の たかさに あわせて きめ、4つの わく+じんの 列が 1画面に おさまる ようにする
function fitParty(){
  const H=partyEl.clientHeight; // ないがわの たかさ
  const FM=102+32; // じんの 列(ずの カード たかさ+まわり)
  const fixed=16+30+36+4*32+4+FM; // パネルの うえした+見出し+もどる+わく4つの まわり(ふち・すきま・カードの ふち)+じんの 列+よゆう
  const cw=Math.max(44,Math.min(128,((H-fixed)/4)/1.25));
  partyEl.style.setProperty('--cw',Math.floor(cw)+'px');
}
window.addEventListener('resize',()=>{if(partyEl.style.display==='block'){fitParty();partyEl.querySelectorAll('.row[data-slot],.row.fm').forEach(r=>r._init&&r._init());}});
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
  const cur=getParty();
  partyEl.querySelectorAll('.row[data-slot]').forEach(row=>{
    const i=+row.dataset.slot,car=row.querySelector('.carousel'),kinds=[null,...KIND_LIST];
    car.innerHTML='';const cards=[];
    for(const k of kinds){
      const c=document.createElement('div');c.className='card'+(k?'':' none');
      if(k){const im=document.createElement('img');im.className='art';im.src='img/portrait-'+k+'.jpg';im.alt=KINDS[k].name;im.draggable=false;c.appendChild(im);}
      else{const a=document.createElement('div');a.className='art';a.textContent='なし';c.appendChild(a);}
      const nm=document.createElement('div');nm.className='nm';nm.textContent=k?KINDS[k].name:'なし';c.appendChild(nm);
      car.appendChild(c);cards.push(c);
    }
    const sl=slideSelect(car,cards,Math.max(0,kinds.indexOf(cur[i]||null)),idx=>{
      const a=getParty();while(a.length<3)a.push(null);a[i]=kinds[idx];setParty(a);saveParty();refreshFormationArt();
    });
    row._init=sl.init;
  });
  // じんの 列
  const frow=partyEl.querySelector('.row.fm'),fcar=frow.querySelector('.carousel');
  fcar.innerHTML='';const fcards=FORMATIONS.map(f=>{
    const c=document.createElement('div');c.className='card fcard';c.dataset.fm=f.id;c.innerHTML=formationSvg(f)+'<div class="nm">'+f.name+'</div>';fcar.appendChild(c);return c;});
  const fsl=slideSelect(fcar,fcards,Math.max(0,FORMATIONS.findIndex(f=>f.id===formationId)),idx=>{setFormation(FORMATIONS[idx].id);saveFormation();});
  frow._init=fsl.init;
}
// パーティの しょくを かえた とき、じんの ずの いろも かえる
function refreshFormationArt(){partyEl.querySelectorAll('.fcard').forEach(c=>{const f=FORMATIONS.find(x=>x.id===c.dataset.fm);c.querySelector('svg').outerHTML=formationSvg(f);});}
function saveFormation(){try{localStorage.setItem('ty_formation',formationId);}catch(_){}}
let partyFrom='title';
function showParty(from){partyFrom=from;titleEl.style.display='none';stagesEl.style.display='none';buildParty();partyEl.style.display='block';fitParty();partyEl.querySelectorAll('.row[data-slot],.row.fm').forEach(r=>r._init&&r._init());}
function showStages(){setRunning(false);buildStageList();document.getElementById('stageParty').innerHTML='<b>パーティ</b>'+partyText()+'（'+formationById(formationId).name+'）（タップで へんこう）';stagesEl.style.display='block';}
function pickStage(id){
  lastStage=id;played=true;try{localStorage.setItem('ty_stage',id);}catch(_){}
  stagesEl.style.display='none';
  resize();init(id);setRunning(true);syncWeightButtons();
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
document.getElementById('pick').addEventListener('click',showStages);
document.getElementById('reset').addEventListener('click',()=>{init();});
// うえのウィンドウ(せってい)を かくす／ひらく
const btEl=document.getElementById('bt');
function applyBar(){
  barEl.style.display=BAR_HIDDEN?'none':'flex';btEl.textContent=BAR_HIDDEN?'▼':'▲';measureBar();
  try{localStorage.setItem('sumo_bar',BAR_HIDDEN?'0':'1');}catch(_){}
}
btEl.addEventListener('click',()=>{setBarHidden(!BAR_HIDDEN);applyBar();});
applyBar();
function setFlick(k){
  setFlickKey(k);
  document.querySelectorAll('#bar button[data-flick]').forEach(x=>x.classList.toggle('on',x.dataset.flick===k));
  try{localStorage.setItem('sumo_flick',k);}catch(_){}
}
document.querySelectorAll('#bar button[data-flick]').forEach(b=>{
  b.addEventListener('click',()=>setFlick(b.dataset.flick));
});
setFlick(FLICKKEY);
document.querySelectorAll('#bar button[data-w]').forEach(b=>{
  b.addEventListener('click',()=>{
    setET(b.dataset.w);
    document.querySelectorAll('#bar button[data-w]').forEach(x=>x.classList.toggle('on',x===b));
    init();
  });
});
// おもさが こていの ステージでは、上の「てきのおもさ」ボタンは きかない(うすく して おす ことも できない)
function syncWeightButtons(){
  const fixed=stageWeight(stageById(stageId))!==null;
  document.querySelectorAll('#bar button[data-w]').forEach(x=>{x.disabled=fixed;x.style.opacity=fixed?'0.4':'';});
}
window.__sumo={setParty,setFormation,init,step,render,skipIntro,tapLock,enemyAt,checkFlick,get S(){return S;},inp,CFG};