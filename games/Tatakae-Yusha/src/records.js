// とうばつタイム(ステージを クリアした ときの S.t)の きろく。ブラウザの localStorage に ほぞんする(この たんまつだけ)
// きろくは「ステージ × てきの おもさ(70/100/160) × パーティ」ごと。はやい ほうが ベスト。ゲームの ロジックには えいきょうしない
// pk=パーティの なまえ(logic.js の partyKey()。ゆうしゃだけ=solo、れいに mage_priest_warrior)
const key=(stage,w,pk)=>'ty_best_'+stage+'_'+w+'_'+(pk||'solo');
export function getBest(stage,w,pk){
  try{const v=parseFloat(localStorage.getItem(key(stage,w,pk)));return isFinite(v)&&v>0?v:null;}catch(_){return null;}
}
// クリアしたとき。{prev:まえの ベスト(なければ null), best:いまの ベスト, isNew:しんきろくか, time:こんかい}
export function saveClear(stage,w,t,pk){
  const time=Math.round(t*10)/10,prev=getBest(stage,w,pk),isNew=prev===null||time<prev;
  if(isNew){try{localStorage.setItem(key(stage,w,pk),String(time));}catch(_){}}
  return {prev,best:isNew?time:prev,isNew,time};
}
