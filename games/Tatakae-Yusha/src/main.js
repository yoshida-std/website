// 移行元: prototype-2d.html の該当部分をそのまま移したもの(import/export だけ足した)
import {CAMKEY,FLICKKEY,setCamKey,setFlickKey,setET,CFG} from './config.js';
import {stage,barEl,BAR_HIDDEN,measureBar,resize,setBarHidden,CW} from './screen.js';
import {S,running,setRunning,inp,init,step,tapLock,enemyAt,checkFlick} from './logic.js';
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

document.getElementById('start').addEventListener('click',()=>{
  document.getElementById('intro').style.display='none';
  resize();init();setRunning(true);
});
document.getElementById('reset').addEventListener('click',()=>{init();});
function setCam(k){
  setCamKey(k);
  document.querySelectorAll('#bar button[data-cam]').forEach(x=>x.classList.toggle('on',x.dataset.cam===k));
  try{localStorage.setItem('sumo_cam',k);}catch(_){}
}
document.querySelectorAll('#bar button[data-cam]').forEach(b=>{
  b.addEventListener('click',()=>setCam(b.dataset.cam));
});
setCam(CAMKEY);
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
window.__sumo={init,step,render,tapLock,enemyAt,checkFlick,get S(){return S;},inp,CFG};