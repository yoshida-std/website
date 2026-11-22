// 移行元: prototype-2d.html の該当部分をそのまま移したもの(import/export だけ足した)
export const CFG={
  arena:{cx:0,cz:11,R:22},
  hero:{r:0.6,w:100,speed:5.2,hp:100,mp:30,dmg:8,swingCd:0.35,swingReach:2.2,backBonus:1.3},
  // まほうつかい: HP は ゆうしゃより すくなく、MP は おおめ。魔法(ほのお)で MP を つかう【仮】
  //   weak=弱い炎(すぐ でる・MP すくない・よわい) / strong=強い炎(えいしょうが ながい・MP おおい・つよい)。cast=えいしょう(秒)、cd=つぎの えいしょうまでの 休み(秒)、fly=とぶ 時間、hate=ヘイトの 倍率
  ally:{r:0.5,w:60,hp:70,mp:80,mpRegen:1.0,react:0.15,speed:1.9,keep:2.6,fear:3.6,range:16,stay:7,stayW:0.15,
    weak:{name:'ほのお',cost:3,cast:0.5,cd:1.7,dmg:8,fly:0.28,hate:4.5},
    strong:{name:'ごうえん',cost:15,cast:2.2,cd:1.0,dmg:44,fly:0.45,hate:2.2}},
  // そうりょ(ユーザー指示 2026-11-22): ヒーラー。こうげきは しない。ちかくの 味方の HP を かいふくし、かいふくの「じん」を ゆかに つくる【仮・きびしめ】
  //   heal=ヒール(ちかくの 味方ぜんいんを かいふく)/ zone=いやしの じん(のっている あいだ すこしずつ かいふく。dur 秒で きえる。同時に 1つ)
  //   need=かけている HP が この 以上の 味方が いるときに つかう / stay・stayW=ゆうしゃから はなれすぎないように する(きょりと つよさ)
  priest:{r:0.5,w:60,hp:80,mp:70,mpRegen:1.0,react:0.15,speed:2.0,stay:4.5,stayW:0.5,
    heal:{name:'ヒール',cost:10,cast:0.9,cd:5.0,amt:20,radius:4.5,need:12},
    zone:{name:'いやしの じん',cost:20,cast:1.2,cd:8.0,r:3.0,dur:8.0,rate:4.0,tick:0.5,need:24}},
  // せんし(ユーザー指示 2026-11-22): 近距離で 斧で きりかかる。ちかづく 敵を おして とめる。HP が 多く、よろいで ダメージを へらす【仮】
  //   reach=きりかかる とどく きょり(おたがいの 半径に たす)/ dmg・cd・wind=ダメージ・つぎまでの 休み・ふりはじめて あたるまでの 時間
  //   shove=おす わざ: ちかくの 敵を うしろへ おしやり、こうげきの よこくを とめる(休み cd 秒)。armor=うける ダメージの わりあい
  warrior:{r:0.62,w:120,hp:130,mp:20,speed:3.6,armor:0.7,reach:1.6,dmg:14,cd:1.3,wind:0.32,
    shove:{cd:5.0,range:1.7,k:46,stagger:0.6,hate:12,dur:0.45}},
  stanceMult:{push:1.3,firm:1.6,normal:1.0},
  angleMult:{front:1.0,side:0.7,back:0.5},
  thr:{win:1.25,hold:1.0,lose:0.75},
  gauge:{pushUp:12,normalUp:2,firmDown:5,idleDown:8,reset:60},
  counter:{tele:0.75,dmg:36,dmgFirm:14,stagger:1.2,reach:0.9,knock:7,
    // 痛恨の一撃(ふんばらずに うけた はんげき): ふっとび、しばらく うごけない【仮】
    crit:{dist:7,stun:2.0,k:6}},
  // 勝ち方(かった ときの ゆうしゃの HP の わりあい): よゆう / ふつう / しんしょう【仮】
  victory:{easy:0.7,close:0.35},
  enemyAtk:{tele:0.7,dmgAlly:15,dmgHero:18,dmgHeroFirm:8,cd:1.0,reachAlly:0.7,reachHero:0.2},
  // 踏みこみ(ユーザー提案 2026-11-22): てきの HP に よゆうが ある(hpRatio いじょう)とき、ちかい こうげき(たたきつけ・なぎはらい)の あたる しゅんかんに、まえへ ふみこむ。
  //   うしろへ さがるだけでは とどく(さがるのが おそいと あたる)。ふみこむ きょりは hit / sweep【仮】
  //   ally=まほうつかいが ねらわれた ときの ふみこみの 倍率(まほうつかいは てきより おそいので みじかく)
  lunge:{hpRatio:0.5,hit:1.5,sweep:1.5,ally:0},
  atkSweep:{tele:0.95,r:2.6,dmgHero:16,dmgHeroFirm:7,dmgAlly:13,knock:1.4},   // なぎはらい(まわり全部)【仮】
  atkCharge:{tele:0.9,track:0.45,speed:20,minD:3.0,maxD:9.5,over:2.0,dmgHero:20,dmgHeroFirm:9,dmgAlly:18,knock:1.2,rest:0.7}, // とっしん【仮】
  sta:{max:100,base:14,perPower:10,regen:18,recover:40}, // 剣のきりょく(ふるほど へる)【仮】
  parryWin:0.4,  // 「！」の さいごの この秒数のあいだに フリックすると いなせる【仮】
  noParry:0.5,   // けんを ふった あと、この秒数は いなせない(ふりまくり ぼうし)【仮】
  openMul:2.2, // てきの すき(よろけ中)に あてたときの ダメージ倍率【仮】
  pushLock:0.3, // 「おす」を この秒数 つづけている間は 剣を ふれない【仮】
  aggro:7.5, // ターゲットなしの敵が、この近さに入った味方に気づく距離【仮】
  planW:{hit:0.4,sweep:0.35,charge:0.25},
  hate:{perHeal:0.6,decay:1.5,decayK:0.18,pushPush:2,pushHold:0.8,acquire:8,lose:3,switchRatio:1.15,perDmg:2,perDmgAlly:4.5,max:200}
};
// 視野は「ひろい」に決定(ユーザー指示 2026-11-21)。カメラの引き・高さ・画角【仮】
export const CAM={back:8.2,h:5.2,fov:0.85};
export const FLICKS={hi:{h:380,v:800,d:30},mid:{h:450,v:900,d:36},lo:{h:600,v:1100,d:48}}; // 速さ(px/秒)・距離(px)【仮】
export let FLICKKEY='mid';
try{const k=localStorage.getItem('sumo_flick');if(k&&FLICKS[k])FLICKKEY=k;}catch(_){}
export let FLICK=FLICKS[FLICKKEY];
export const HERO_Y=0.5; // ゆうしゃの足もとの画面たて位置(0=上 1=下)【仮】
export const ENEMY_TYPES={
  70:{w:70,hp:190,speed:4.3,r:0.85,color:'#7fb36b',color2:'#6fa8c7',name:'かるい てき'},
  100:{w:100,hp:260,speed:3.4,r:1.0,color:'#8a8f9a',color2:'#a39a86',name:'ふつうの てき'},
  160:{w:160,hp:370,speed:2.6,r:1.3,color:'#8a5a45',color2:'#7a4a6a',name:'おもい てき'}
};
export let ET=ENEMY_TYPES[100];
export const LETTER=['A','B','C','D'];
export const KIND_JP={hit:'たたきつけ',sweep:'なぎはらい',charge:'とっしん'};
export function pickPlan(){const w=CFG.planW;let r=Math.random()*(w.hit+w.sweep+w.charge);if((r-=w.hit)<0)return 'hit';if((r-=w.sweep)<0)return 'sweep';return 'charge';}
// 設定の切りかえ(UI から呼ぶ。import した変数は外から代入できないため)
export function setFlickKey(k){FLICKKEY=k;FLICK=FLICKS[k];}
export function setET(w){ET=ENEMY_TYPES[w];}
