// ステージ選択の カードの 絵(サムネイル)を、ゲームの 画面から 撮って img/stage-<id>.jpg に する
//
// つかいかた(games/Tatakae-Yusha で):
//   node tools/stage-thumb.js            … すべての ステージ
//   node tools/stage-thumb.js ogre4      … 1つだけ
// ステージを はじめて スタート演出を とばし、HUD・ボタンを かくして、てきが ぜんぶ はいる ように 切りだす(960:504 の 横長)。
// この 作業環境のように CDN に つながらないときは、環境変数 THREE_DIR に node_modules/three を 指定する
const {chromium}=require('playwright');const path=require('path'),http=require('http'),fs=require('fs');
const ROOT=path.resolve(__dirname,'..'),T3=process.env.THREE_DIR||'';
const ONLY=process.argv[2];
(async()=>{
 const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':p.endsWith('.js')?'text/javascript':'text/html; charset=utf-8'});fs.createReadStream(p).pipe(r);}).listen(0);
 await new Promise(r=>srv.on('listening',r));
 const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:4});
 if(T3)await ctx.route(/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)$/,route=>{let f=route.request().url().match(/three@[^/]+\/(.*)$/)[1];f=f==='+esm'?'build/three.module.js':(f.includes('/')?f:'build/'+f);route.fulfill({path:path.join(T3,f),contentType:'text/javascript'});});
 await ctx.addInitScript(()=>{window.__T=1000;performance.now=()=>window.__T;window.requestAnimationFrame=()=>0;});
 const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://127.0.0.1:'+srv.address().port+'/index.html');await pg.waitForFunction(()=>window.__sumo);
 const ids=await pg.evaluate(async()=>(await import('/src/stages.js')).STAGES.map(s=>s.id));
 for(const id of ids){
   if(ONLY&&ONLY!==id)continue;
   const box=await pg.evaluate(id=>{
     document.querySelectorAll('#title,#intro,#stages,#bar,#bt,#c').forEach(e=>{e.style.display='none';});
     const G=window.__sumo;G.init(id);G.skipIntro();
     // てきを ステージの いちに とめて、ゆうしゃ(カメラのほう)を むかせる(むきは 描画が すこしずつ かえる)
     const ST=G.S.stage;
     for(let i=0;i<90;i++){
       window.__T+=1000/60;G.step(1/60);
       G.S.enemies.forEach((e,k)=>{e.x=ST.enemies[k].x;e.z=ST.enemies[k].z;e.target='hero';e.hate.hero=50;e.atkCd=99;e.tele=0;e.atkTele=0;e.kx=0;e.kz=0;});
       G.S.hero.x=0;G.S.hero.z=7.8;G.S.ally.x=0;G.S.ally.z=5.4;
       G.render();
     }
     const E=G.S.enemies;let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
     for(const e of E){x0=Math.min(x0,e.sx-e.shw*1.25);x1=Math.max(x1,e.sx+e.shw*1.25);y0=Math.min(y0,e.sy-e.shh*1.1);y1=Math.max(y1,e.sy+e.shh*0.15);}
     return {x0,x1,y0,y1};
   },id);
   // 960:504 に そろえる(はばを きめ、たかさは そこから。てきの まんなかに あわせる)
   const R=960/504,cx=(box.x0+box.x1)/2,cy=(box.y0+box.y1)/2;
   let w=Math.max(box.x1-box.x0,(box.y1-box.y0)*R),h=w/R;
   const W=390,H=844;w=Math.min(w,W);h=w/R;
   const x=Math.max(0,Math.min(W-w,cx-w/2)),y=Math.max(0,Math.min(H-h,cy-h/2-10)); // 少し上へ(下はしに ゆうしゃの ぼうしが 入らないように)
   fs.mkdirSync(path.join(ROOT,'img'),{recursive:true});
   const out=path.join(ROOT,'img','stage-'+id+'.jpg');
   await pg.screenshot({path:out,type:'jpeg',quality:86,clip:{x,y,width:w,height:h}});
   console.log('ok',out,JSON.stringify({x,y,w,h}));
 }
 console.log(errs.length?errs:'エラーなし');
 await b.close();srv.close();
})();
