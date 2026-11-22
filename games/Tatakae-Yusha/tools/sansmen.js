// まほうつかいの 三面図(正面・側面・背面)を、ゲームの 実際の モデル(src/render2d.js の allyParts)から えがいて PNG に する
//
// つかいかた(games/Tatakae-Yusha で):
//   node tools/sansmen.js                     … docs/mage-3view.png に 書きだす
//   node tools/sansmen.js 出力の パス.png
// モデルを かえたら もういちど 実行すれば 図も かわる。Three.js は つかわない(Canvas 2D の 箱モデルを まよこから えがく)。
// この 作業環境のように CDN(cdn.jsdelivr.net)に つながらないときは、環境変数 THREE_DIR に node_modules/three を 指定する
const {chromium}=require('playwright');const path=require('path'),http=require('http'),fs=require('fs');
const ROOT=path.resolve(__dirname,'..'),T3=process.env.THREE_DIR||'',OUT=process.argv[2]||path.join(ROOT,'docs','mage-3view.png');
(async()=>{
 const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));if(!fs.existsSync(p)||fs.statSync(p).isDirectory()){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':p.endsWith('.js')?'text/javascript':'text/html; charset=utf-8'});fs.createReadStream(p).pipe(r);}).listen(0);
 await new Promise(r=>srv.on('listening',r));
 const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844}});
 if(T3)await ctx.route(/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)$/,route=>{let f=route.request().url().match(/three@[^/]+\/(.*)$/)[1];f=f==='+esm'?'build/three.module.js':(f.includes('/')?f:'build/'+f);route.fulfill({path:path.join(T3,f),contentType:'text/javascript'});});
 await ctx.addInitScript(()=>{window.__T=1000;performance.now=()=>window.__T;window.requestAnimationFrame=()=>0;});
 const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://127.0.0.1:'+srv.address().port+'/index.html');await pg.waitForFunction(()=>window.__sumo);
 const url=await pg.evaluate(async()=>{
   const m=await import('/src/render2d.js');
   const W=1800,H=1300,cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d');
   const FONT='"Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",sans-serif';
   // はいけい
   c.fillStyle='#f3f1ea';c.fillRect(0,0,W,H);
   c.strokeStyle='rgba(60,60,80,.07)';c.lineWidth=1;for(let x=0;x<W;x+=40){c.beginPath();c.moveTo(x,0);c.lineTo(x,H);c.stroke();}for(let y=0;y<H;y+=40){c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();}
   c.fillStyle='#2b2540';c.font='bold 44px '+FONT;c.textBaseline='middle';c.fillText('まほうつかいの 女の子  三面図',60,62);
   c.font='20px '+FONT;c.fillStyle='#6a6580';c.fillText('「戦え！ゆうしゃ」 ローポリ(箱)モデル。ゲームの 実際の 部品から えがいた もの。単位は ゲーム内の 長さ(ゆうしゃの 背たけ ≒ 2.1)',60,104);
   // 部品(アニメの ない ふだんの ポーズ)
   const model=m.allyParts(Math.PI,0,0,0,'',0).parts;
   let top=0;for(const p of model){const hh=p.c[1]+p.s[1]/2+0.3;if(hh>top)top=hh;}
   const S=290,baseY=1010,cxs=[330,900,1470],views=[['正面図',0],['側面図',Math.PI/2],['背面図',Math.PI]];
   // たかさの ガイド
   const guides=[[0,'ゆか(足もと)'],[0.865,'おび'],[1.32,'かた'],[1.41,'あご'],[2.02,'ぼうしの つば'],[2.85,'ぼうしの さき']];
   c.font='18px '+FONT;
   for(const [hh,label] of guides){const y=baseY-hh*S;c.strokeStyle=hh===0?'rgba(40,36,60,.55)':'rgba(120,110,160,.35)';c.setLineDash(hh===0?[]:[10,8]);c.lineWidth=hh===0?2:1.5;c.beginPath();c.moveTo(40,y);c.lineTo(W-40,y);c.stroke();c.setLineDash([]);c.fillStyle='#5a5575';c.textAlign='left';c.fillText(hh.toFixed(2)+'  '+label,48,y-12);}
   // 中心線と モデル
   m.useCtx(c);
   for(const [name,yaw] of views){
     const i=views.findIndex(v=>v[0]===name),x=cxs[i];
     c.strokeStyle='rgba(120,110,160,.3)';c.setLineDash([14,10]);c.lineWidth=1.5;c.beginPath();c.moveTo(x,170);c.lineTo(x,baseY+20);c.stroke();c.setLineDash([]);
     // ゆかの かげ
     c.fillStyle='rgba(40,36,60,.12)';c.beginPath();c.ellipse(x,baseY+6,150,14,0,0,Math.PI*2);c.fill();
     m.h3render(model,x,baseY,S,false,yaw,0,0,3.2);
     c.fillStyle='#2b2540';c.font='bold 30px '+FONT;c.textAlign='center';c.fillText(name,x,150);
   }
   m.useCtx(null);
   // まえ むきの やじるし(側面図)
   {const x=cxs[1],y=250;c.strokeStyle='#8a5a2a';c.fillStyle='#8a5a2a';c.lineWidth=3;c.beginPath();c.moveTo(x+90,y);c.lineTo(x+210,y);c.stroke();c.beginPath();c.moveTo(x+210,y-10);c.lineTo(x+232,y);c.lineTo(x+210,y+10);c.fill();
    c.font='20px '+FONT;c.textAlign='left';c.fillStyle='#8a5a2a';c.fillText('まえ',x+240,y);}
   // 寸法(はば・おくゆき)
   const dim=(x1,x2,y,label)=>{c.strokeStyle='#3a3560';c.fillStyle='#3a3560';c.lineWidth=1.5;c.beginPath();c.moveTo(x1,y);c.lineTo(x2,y);c.stroke();for(const x of [x1,x2]){c.beginPath();c.moveTo(x,y-10);c.lineTo(x,y+10);c.stroke();}c.font='19px '+FONT;c.textAlign='center';c.fillText(label,(x1+x2)/2,y+26);};
   dim(cxs[0]-0.43*S,cxs[0]+0.43*S,baseY+52,'スカートの はば 0.86');
   dim(cxs[1]-0.33*S,cxs[1]+0.33*S,baseY+52,'スカートの おくゆき 0.66');
   dim(cxs[2]-0.43*S,cxs[2]+0.43*S,baseY+52,'スカートの はば 0.86');
   c.textAlign='left';
   // いろ
   const sw=[['#6a46b8','うわぎ・スカート(した)'],['#5b3aa0','スカート(うえ)・えり'],['#5a32a8','ぼうし'],['#4a2a90','ぼうしの つば・フード'],['#e0b84a','金(おび・ふち・リボン)'],['#f6d9bd','はだ'],['#c9783a','かみ'],['#e0a060','みつあみの さき'],['#f1ece0','くつした・すその ふち'],['#4a3320','くつ'],['#8a5a2a','つえ'],['#7cf5ff','クリスタル(詠唱中は 橙)']];
   c.fillStyle='#2b2540';c.font='bold 26px '+FONT;c.textAlign='left';c.fillText('いろ',60,1170);
   sw.forEach((q,i)=>{const col=i%6,row=Math.floor(i/6),x=190+col*265,y=1145+row*62;
     c.fillStyle=q[0];c.fillRect(x,y-20,38,38);c.strokeStyle='rgba(20,18,40,.6)';c.lineWidth=1.5;c.strokeRect(x,y-20,38,38);
     c.fillStyle='#4a4560';c.textAlign='left';c.font='15px '+FONT;c.fillText(q[1],x+48,y-6);c.font='13px '+FONT;c.fillStyle='#7a7590';c.fillText(q[0],x+48,y+12);});
   return cv.toDataURL('image/png');
 });
 fs.writeFileSync(OUT,Buffer.from(url.split(',')[1],'base64'));
 console.log('ok',errs);
 await b.close();srv.close();
})();
