// 移行元: prototype-2d.html の該当部分をそのまま移したもの(import/export だけ足した)
export const cv=document.getElementById('c'),ctx=cv.getContext('2d'),stage=document.getElementById('stage');
export let CW=0,CH=0,DPR=1,BAR_H=40;
export const barEl=document.getElementById('bar');
export let BAR_HIDDEN=false;
try{BAR_HIDDEN=localStorage.getItem('sumo_bar')==='0';}catch(_){}
export function measureBar(){BAR_H=BAR_HIDDEN?44:(barEl&&barEl.offsetHeight?barEl.offsetHeight:40)+6;}
export function resize(){
  measureBar();
  const r=stage.getBoundingClientRect();
  CW=Math.max(100,r.width);CH=Math.max(100,r.height);
  DPR=Math.min(2,window.devicePixelRatio||1);
  cv.width=Math.round(CW*DPR);cv.height=Math.round(CH*DPR);
  cv.style.width=CW+'px';cv.style.height=CH+'px';
  for(const f of resizeHooks)f(CW,CH,DPR);
}
window.addEventListener('resize',resize);
export const FONT='"Hiragino Kaku Gothic ProN","Hiragino Sans","Noto Sans JP","Yu Gothic",Meiryo,sans-serif';
// ほかの描画(WebGL など)も 同じ大きさに あわせるための フック
const resizeHooks=[];
export function onResize(f){resizeHooks.push(f);}
export function setBarHidden(v){BAR_HIDDEN=v;}
