// とうばつタイム(ステージを クリアした ときの S.t)の きろく。ブラウザの localStorage に ほぞんする(この たんまつだけ)
// きろくは「ステージ × てきの おもさ(70/100/160)」ごと。はやい ほうが ベスト。ゲームの ロジックには えいきょうしない
const key=(stage,w)=>'ty_best_'+stage+'_'+w;
export function getBest(stage,w){
  try{const v=parseFloat(localStorage.getItem(key(stage,w)));return isFinite(v)&&v>0?v:null;}catch(_){return null;}
}
// クリアしたとき。{prev:まえの ベスト(なければ null), best:いまの ベスト, isNew:しんきろくか, time:こんかい}
export function saveClear(stage,w,t){
  const time=Math.round(t*10)/10,prev=getBest(stage,w),isNew=prev===null||time<prev;
  if(isNew){try{localStorage.setItem(key(stage,w),String(time));}catch(_){}}
  return {prev,best:isNew?time:prev,isNew,time};
}
