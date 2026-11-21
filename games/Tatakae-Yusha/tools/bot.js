// ボット(headless)で たたかわせて、結果を くらべる道具
//
// つかいかた(games/Tatakae-Yusha で):
//   node tools/bot.js                              … index.html を ボットで 遊ぶ(既定: 20戦 × 方針2つ × 敵3種)
//   node tools/bot.js --page prototype-2d.html     … 移行元(Canvas 2D)を 遊ぶ
//   node tools/bot.js --compare prototype-2d.html,index.html
//        … 同じ乱数の種で 両方を遊び、勝敗・時間を ならべる。毎フレームの状態(位置・HP)の
//          チェックサムも くらべるので、ロジックが 完全に同じかも わかる
//   オプション: --seeds 20  --policy smart,spam  --weight 70,100,160  --maxT 180
//   --cam narrow|normal|wide … 視野
//   --hidebar 1 … 上の設定ウィンドウを かくして 撮る(背景を見る用)
//   --shotFly 0.15 … 止めの演出が 0.15秒 すすんだところで止めて 画面を保存
//   --shot 600 --out dir … 各ページで 1戦目を 600フレームで止めて 画面を PNG に保存(見た目の比較用)
//
// しくみ:
//   - Math.random を 種つきの乱数に、performance.now を 1/60秒ずつ進む にせの時計にかえる
//   - requestAnimationFrame を止め、ボットが step(1/60) → render() を 自分で よぶ
//     (render は 敵の画面上の位置を きめ、フリックの ねらいに つかわれるので 必ず よぶ)
//   - 指の操作は、キャンバスに PointerEvent を 送って まねる(入力の処理も そのまま通る)
//   - Three.js は CDN(cdn.jsdelivr.net)から読む。ネットにつながらない環境では
//     環境変数 THREE_DIR に node_modules/three のパスを指定すると、そこから返す
//
// 方針:
//   smart … 「いま！」で いなし、よろけた敵(スキ)を たたく。1.2秒に1回くらい ふつうにも ふる
//   spam  … 何も考えず 0.2秒ごとに フリックしつづける(設計書 §5.2 の「ふりまくり」)
'use strict';
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('playwright');

const ROOT=path.resolve(__dirname,'..');
const args=process.argv.slice(2);
const opt=k=>{const i=args.indexOf('--'+k);return i>=0?args[i+1]:null;};
const PAGES=(opt('compare')||opt('page')||'index.html').split(',');
const SEEDS=+(opt('seeds')||20);
const POLICIES=(opt('policy')||'smart,spam').split(',');
const WEIGHTS=(opt('weight')||'70,100,160').split(',');
const MAXT=+(opt('maxT')||180);
const SHOT=+(opt('shot')||0),SHOTFLY=+(opt('shotFly')||0),OUT=opt('out')||'.';

const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.md':'text/markdown','.json':'application/json','.png':'image/png'};
function serve(){
  return new Promise(res=>{
    const s=http.createServer((q,r)=>{
      const p=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));
      if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){r.writeHead(404);r.end();return;}
      r.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(r);
    });
    s.listen(0,'127.0.0.1',()=>res(s));
  });
}

// ---- ページの中で うごかす部分 ----
function setup(){
  let a=1;
  Math.random=function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
  window.__seed=s=>{a=s>>>0;};
  let T=1000;
  performance.now=()=>T;
  window.__adv=ms=>{T+=ms;};
  window.requestAnimationFrame=()=>0;
}
function runBot({seed,policy,weight,maxT,stopAt,stopFly,trace}){
  const G=window.__sumo,cv=document.getElementById('c');
  document.getElementById('intro').style.display='none';
  window.__seed(seed);
  document.querySelector('#bar button[data-w="'+weight+'"]').click(); // init() が よばれる
  window.__seed(seed);
  document.getElementById('start').click();                            // resize(); init(); running=true
  const r=cv.getBoundingClientRect(),CW=r.width,CH=r.height;
  const ev=(type,x,y)=>cv.dispatchEvent(new PointerEvent(type,{pointerId:1,clientX:r.left+x,clientY:r.top+y,bubbles:true,cancelable:true,pointerType:'touch',isPrimary:true}));
  const q=[];let hold=null,lastSwing=-9,swings=0,parries=0,hash=2166136261>>>0;
  const W=G.CFG.parryWin;
  const freeSpot=()=>{for(const [x,y] of [[CW*0.5,CH*0.66],[CW*0.2,CH*0.66],[CW*0.8,CH*0.66],[CW*0.5,CH*0.9]])if(G.enemyAt(x,y)<0)return [x,y];return [CW*0.5,CH*0.9];};
  const release=()=>{if(hold){const h=hold;hold=null;q.push(()=>ev('pointerup',h[0],h[1]));}};
  const flick=(x,y,dx,dy)=>{q.push(()=>ev('pointerdown',x,y),()=>ev('pointermove',x+dx,y+dy),()=>ev('pointerup',x+dx,y+dy));};
  function plan(){
    const S=G.S,h=S.hero,E=S.enemies.filter(e=>!e.dead),L=S.enemies[S.lock];
    const gap=Math.hypot(L.x-h.x,L.z-h.z)-h.r-L.r;
    const rem=e=>e.tele>0?e.tele:(e.atkTele>0&&e.target==='hero'?e.atkTele:9);
    if(policy==='spam'){
      if(S.t-lastSwing>=0.2&&L.shw){release();lastSwing=S.t;swings++;flick(L.sx,L.sy,0,90);return;}
    }else{
      const th=E.find(e=>rem(e)<=W-0.04&&rem(e)>0.06);
      if(th&&h.noParry<=0){release();const [x,y]=freeSpot();parries++;flick(x,y,90,0);return;}
      const soon=E.some(e=>rem(e)<0.95);
      const st=E.find(e=>e.stagger>0.2&&e.shw&&Math.hypot(e.x-h.x,e.z-h.z)-h.r-e.r<4.2);
      if(!soon&&!h.tired&&h.swingCd<=0&&(st||(S.t-lastSwing>1.2&&gap<2.0&&h.sta>45&&L.shw))){
        const tg=st||L;release();lastSwing=S.t;swings++;flick(tg.sx,tg.sy,0,90);return;
      }
    }
    // いどう: はなれていれば まえへ(おす)、ちかければ はなして ふんばる
    if(gap>0.6&&!hold){const [x,y]=freeSpot();hold=[x,y-60];q.push(()=>ev('pointerdown',x,y),()=>ev('pointermove',x,y-60));}
    else if(gap<=0.3&&hold)release();
  }
  let frames=0;const tr=[];
  const mix=v=>{const s=v.toFixed(4);for(let i=0;i<s.length;i++){hash^=s.charCodeAt(i);hash=Math.imul(hash,16777619)>>>0;}};
  while(true){
    const S=G.S;
    if((S.over&&!stopFly)||S.t>=maxT||(stopAt&&frames>=stopAt)||(stopFly&&S.fly.some(f=>f.t>=stopFly)))break;
    if(!q.length)plan();
    if(q.length)q.shift()();
    window.__adv(1000/60);G.step(1/60);G.render();frames++;
    const h=S.hero,a=S.ally;
    mix(h.x);mix(h.z);mix(h.hp);mix(a.x);mix(a.z);mix(a.hp);
    for(const e of S.enemies){mix(e.x);mix(e.z);mix(e.hp);}
    if(trace)tr.push(hash.toString(16)+' t='+S.t.toFixed(3)+' h='+h.x.toFixed(4)+','+h.z.toFixed(4)+' hp='+h.hp+' sx='+S.enemies.map(e=>(e.sx||0).toFixed(2)+'/'+(e.sy||0).toFixed(2)).join(' ')+' fl='+G.inp.flickT+' pend='+G.inp.flickPending);
  }
  const S=G.S;
  return {over:S.over||'timeout',t:+S.t.toFixed(2),heroHp:S.hero.hp,allyHp:S.ally.hp,
    enemyHp:S.enemies.reduce((s,e)=>s+e.hp,0),swings,parries,frames,hash:hash.toString(16),trace:trace?tr:undefined};
}

(async()=>{
  const srv=await serve(),port=srv.address().port;
  const browser=await chromium.launch();
  const res={};
  for(const pg of PAGES){
    const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true});
    if(process.env.THREE_DIR){
      await ctx.route(/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)$/,(route)=>{
        // +esm は build/three.module.js、そこから読む ./three.core.js などは build/ の同じ名前
        let f=route.request().url().match(/three@[^/]+\/(.*)$/)[1];
        f=f==='+esm'?'build/three.module.js':(f.includes('/')?f:'build/'+f);
        route.fulfill({path:path.join(process.env.THREE_DIR,f),contentType:'text/javascript'});
      });
    }
    await ctx.addInitScript(setup);
    if(opt('hidebar'))await ctx.addInitScript(()=>{try{localStorage.setItem('sumo_bar','0');}catch(_){}});
    if(opt('cam'))await ctx.addInitScript(k=>{try{localStorage.setItem('sumo_cam',k);}catch(_){}},opt('cam'));
    const page=await ctx.newPage();
    const errs=[];page.on('pageerror',e=>errs.push(String(e)));
    await page.goto(`http://127.0.0.1:${port}/${pg}`);
    await page.waitForFunction(()=>window.__sumo,null,{timeout:15000});
    res[pg]=[];
    if(SHOT||SHOTFLY){
      await page.evaluate(runBot,{seed:1,policy:POLICIES[0],weight:WEIGHTS[0],maxT:MAXT,stopAt:SHOT,stopFly:SHOTFLY});
      await page.screenshot({path:path.join(OUT,pg.replace(/\W+/g,'_')+'.png')});
      await ctx.close();continue;
    }
    for(const policy of POLICIES)for(const weight of WEIGHTS)for(let s=1;s<=SEEDS;s++){
      const r=await page.evaluate(runBot,{seed:s,policy,weight,maxT:MAXT,trace:!!opt('trace')});
      res[pg].push({policy,weight,seed:s,...r});
    }
    if(errs.length)console.log(pg,'のエラー:',errs.slice(0,5));
    await ctx.close();
  }
  await browser.close();srv.close();
  if(SHOT||SHOTFLY){console.log('画面を保存しました:',OUT);return;}
  // まとめ
  for(const pg of PAGES){
    console.log('\n== '+pg+' ==');
    console.log('方針  おもさ  勝ち  ゆうしゃ負け  まほう負け  時間切れ  平均時間(勝ち)  平均時間(全部)  平均ふり  平均いなし');
    for(const policy of POLICIES)for(const weight of WEIGHTS){
      const rs=res[pg].filter(r=>r.policy===policy&&r.weight===weight);
      const c=k=>rs.filter(r=>r.over===k).length,avg=a=>a.length?(a.reduce((s,v)=>s+v,0)/a.length).toFixed(1):'-';
      console.log([policy.padEnd(5),weight.padStart(5),String(c('win')).padStart(5),String(c('hero')).padStart(12),String(c('ally')).padStart(10),String(c('timeout')).padStart(8),
        avg(rs.filter(r=>r.over==='win').map(r=>r.t)).padStart(14),avg(rs.map(r=>r.t)).padStart(14),avg(rs.map(r=>r.swings)).padStart(8),avg(rs.map(r=>r.parries)).padStart(9)].join(' '));
    }
  }
  if(PAGES.length===2){
    const [A,B]=PAGES.map(p=>res[p]);
    const same=A.filter((r,i)=>r.hash===B[i].hash&&r.over===B[i].over&&r.t===B[i].t).length;
    const sameOutcome=A.filter((r,i)=>r.over===B[i].over).length;
    console.log(`\n毎フレームの状態が完全に一致: ${same}/${A.length} 戦`);
    console.log(`勝敗が一致: ${sameOutcome}/${A.length} 戦`);
    if(opt('trace'))A.forEach((r,i)=>{const t2=B[i].trace,k=r.trace.findIndex((x,j)=>x!==t2[j]);
      if(k>=0)console.log(`seed ${r.seed} ${r.policy}: ${k} フレーム目で ずれた\n  A ${r.trace[k-1]}\n  B ${t2[k-1]}\n  A ${r.trace[k]}\n  B ${t2[k]}`);});
  }
  if(opt('json'))fs.writeFileSync(opt('json'),JSON.stringify(res,null,1));
})().catch(e=>{console.error(e);process.exit(1);});
