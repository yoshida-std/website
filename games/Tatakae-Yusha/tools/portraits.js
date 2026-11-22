// パーティ設定の 選択に つかう「上半身の アップの 絵(ポートレート)」を、ゲームの 箱モデルから 描いて img/portrait-<しょく>.jpg に する
//
// つかいかた(games/Tatakae-Yusha で):
//   node tools/portraits.js            … ゆうしゃ・まほうつかい・そうりょ・せんし の ぜんぶ
//   node tools/portraits.js warrior    … 1つだけ
// ゲームの 実際の モデル(src/render2d.js の *Parts)を、ポーズを きめて 正面よりに すこし ななめから、かおが 大きく 見える ところまで アップで 描く(Canvas 2D)。
// モデルを かえたら もういちど 実行する。ポーズ・アップの ぐあいは 下の CF(pose=ポーズの 引数、yTop/yBot=絵に 入れる たかさ(モデルの たかさ)、yaw=ななめの かくど)
// この 作業環境のように CDN に つながらないときは、環境変数 THREE_DIR に node_modules/three を 指定する
const {chromium}=require('playwright');const path=require('path'),http=require('http'),fs=require('fs');
const ROOT=path.resolve(__dirname,'..'),T3=process.env.THREE_DIR||'';
const ONLY=process.argv[2];
(async()=>{
 const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':p.endsWith('.js')?'text/javascript':'text/html; charset=utf-8'});fs.createReadStream(p).pipe(r);}).listen(0);
 await new Promise(r=>srv.on('listening',r));
 const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844}});
 if(T3)await ctx.route(/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)$/,route=>{let f=route.request().url().match(/three@[^/]+\/(.*)$/)[1];f=f==='+esm'?'build/three.module.js':(f.includes('/')?f:'build/'+f);route.fulfill({path:path.join(T3,f),contentType:'text/javascript'});});
 await ctx.addInitScript(()=>{window.__T=1000;performance.now=()=>window.__T;window.requestAnimationFrame=()=>0;});
 const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://127.0.0.1:'+srv.address().port+'/index.html');await pg.waitForFunction(()=>window.__sumo);
 const kinds=['hero','mage','priest','warrior'].filter(k=>!ONLY||ONLY===k);
 for(const kind of kinds){
   const url=await pg.evaluate(async(kind)=>{
     const m=await import('/src/render2d.js');
     const W=480,H=600,cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d');
     // ---- しょくごとの せってい ----
     const CF={
       hero:{bg:['#1c5f58','#0d2a33'],glow:'rgba(120,255,220,.35)',yTop:2.34,yBot:1.02,yaw:-0.22,lw:5,
         parts:()=>m.heroParts({mv:0,ph:0,yaw3:0,firmK:0.8,pushK:0,swingV:0}).parts},
       mage:{bg:['#5a3aa0','#1c1440'],glow:'rgba(255,170,90,.40)',yTop:2.92,yBot:0.98,yaw:0.2,lw:5,
         parts:()=>m.allyParts(Math.PI,0,0,0.35,'weak',0).parts},
       priest:{bg:['#4a78b8','#14284a'],glow:'rgba(150,255,190,.40)',yTop:2.92,yBot:0.98,yaw:0.2,lw:5,
         parts:()=>m.priestParts(Math.PI,0,0,0.3,'heal',0).parts},
       warrior:{bg:['#7a4a2a','#2a160c'],glow:'rgba(255,200,120,.35)',yTop:2.42,yBot:0.92,yaw:-0.22,lw:5,
         parts:()=>m.warriorParts(Math.PI,0,0,0,0,0).parts}
     }[kind];
     // はいけい(しょくの いろの グラデーション+ ひかり)
     const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,CF.bg[0]);g.addColorStop(1,CF.bg[1]);c.fillStyle=g;c.fillRect(0,0,W,H);
     const rg=c.createRadialGradient(W/2,H*0.42,10,W/2,H*0.42,W*0.7);rg.addColorStop(0,CF.glow);rg.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=rg;c.fillRect(0,0,W,H);
     c.strokeStyle='rgba(255,255,255,.06)';c.lineWidth=2;for(let x=-H;x<W;x+=46){c.beginPath();c.moveTo(x,H);c.lineTo(x+H,0);c.stroke();}
     // キャラ: yTop〜yBot の たかさが 絵に ちょうど はいる ように
     const s=H/(CF.yTop-CF.yBot),baseY=CF.yTop*s; // モデルの y=yTop が 絵の うえはし
     m.useCtx(c);
     m.h3render(CF.parts(),W/2,baseY,s,false,CF.yaw,0,0,CF.lw);
     m.useCtx(null);
     // ふちの かげ(下を すこし くらく)
     const vg=c.createLinearGradient(0,H*0.72,0,H);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.45)');c.fillStyle=vg;c.fillRect(0,H*0.72,W,H*0.28);
     return cv.toDataURL('image/jpeg',0.9);
   },kind);
   const out=path.join(ROOT,'img','portrait-'+kind+'.jpg');
   fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,Buffer.from(url.split(',')[1],'base64'));
   console.log('ok',out);
 }
 console.log(errs.length?errs:'エラーなし');
 await b.close();srv.close();
})();
