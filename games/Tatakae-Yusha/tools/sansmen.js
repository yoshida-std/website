// キャラクターの 三面図(正面・側面・背面)を、ゲームの 実際の モデル(src/render2d.js の部品)から えがいて PNG に する
//
// つかいかた(games/Tatakae-Yusha で):
//   node tools/sansmen.js                 … まほうつかい → docs/mage-3view.png
//   node tools/sansmen.js enemy           … てき(どすこいオーガ・ふつうの てき) → docs/enemy-3view.png
//   node tools/sansmen.js mage 出力.png   … 出力の パスを 指定
// モデルを かえたら もういちど 実行すれば 図も かわる。ゲームと おなじ 大きさで えがき、右はしに くらべる ゆうしゃを ならべる。
// Three.js は つかわない(Canvas 2D の 箱モデルを まよこから えがく)。
// この 作業環境のように CDN(cdn.jsdelivr.net)に つながらないときは、環境変数 THREE_DIR に node_modules/three を 指定する
const {chromium}=require('playwright');const path=require('path'),http=require('http'),fs=require('fs');
const ROOT=path.resolve(__dirname,'..'),T3=process.env.THREE_DIR||'';
const WHO=process.argv[2]==='enemy'?'enemy':'mage';
const OUT=process.argv[3]||path.join(ROOT,'docs',WHO==='enemy'?'enemy-3view.png':'mage-3view.png');
(async()=>{
 const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':p.endsWith('.js')?'text/javascript':'text/html; charset=utf-8'});fs.createReadStream(p).pipe(r);}).listen(0);
 await new Promise(r=>srv.on('listening',r));
 const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844}});
 if(T3)await ctx.route(/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)$/,route=>{let f=route.request().url().match(/three@[^/]+\/(.*)$/)[1];f=f==='+esm'?'build/three.module.js':(f.includes('/')?f:'build/'+f);route.fulfill({path:path.join(T3,f),contentType:'text/javascript'});});
 await ctx.addInitScript(()=>{window.__T=1000;performance.now=()=>window.__T;window.requestAnimationFrame=()=>0;});
 const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://127.0.0.1:'+srv.address().port+'/index.html');await pg.waitForFunction(()=>window.__sumo);
 const url=await pg.evaluate(async(WHO)=>{
   const m=await import('/src/render2d.js');
   const FONT='"Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",sans-serif';
   const heroParts=m.heroParts({mv:0,ph:0,yaw3:0,firmK:0,pushK:0}).parts;
   // ---- キャラごとの せってい ----
   let CF;
   if(WHO==='mage'){
     const sc=m.MAGE_SCALE;
     CF={title:'まほうつかいの 女の子  三面図',note:'「戦え！ゆうしゃ」 ローポリ(箱)モデル。ゲームの 実際の 部品を ゲームと おなじ 大きさ(×'+sc+')で えがいた もの。ゆうしゃと おなじ せたけ(≒ 2.17)',
       parts:m.allyParts(Math.PI,0,0,0,'',0).parts,scale:sc,S:290,W:2100,cxs:[330,900,1470,1850],
       guides:[[0,'ゆか(足もと)'],[0.865,'おび'],[1.32,'かた'],[1.41,'あご'],[2.02,'ぼうしの つば'],[2.85,'ぼうしの さき']],
       dims:[[0,0.43,'スカートの はば 0.65'],[1,0.33,'スカートの おくゆき 0.50'],[2,0.43,'スカートの はば 0.65']],
       sw:[['#6a46b8','うわぎ・スカート(した)'],['#5b3aa0','スカート(うえ)・えり'],['#5a32a8','ぼうし'],['#4a2a90','ぼうしの つば・フード'],['#e0b84a','金(おび・ふち・リボン)'],['#f6d9bd','はだ'],['#c9783a','かみ'],['#e0a060','みつあみの さき'],['#f1ece0','くつした・すその ふち'],['#4a3320','くつ'],['#8a5a2a','つえ'],['#7cf5ff','クリスタル(詠唱中は 橙)']]};
   }else{
     const tint='#8a8f9a',e0=m.enemyParts(null,tint,1.0,Math.PI,0,0,false,false,false);
     const sc=e0.scale; // ゲームでの みかけの 倍率(ふつうの てき: 0.8 × ENEMY_LOOK)
     const mix=(hex,f)=>'#'+[1,3,5].map(i=>Math.max(0,Math.min(255,Math.round(parseInt(hex.slice(i,i+2),16)*f))).toString(16).padStart(2,'0')).join('');
     CF={title:'てき「どすこいオーガ」  三面図(ふつうの てき)',note:'「戦え！ゆうしゃ」 ローポリ(箱)モデル。ゲームの 実際の 部品を ゲームと おなじ 大きさ(×'+sc.toFixed(2)+')で えがいた もの。てきの おもさで 体の 大きさ・色が かわる(下の 色見本)',
       parts:e0.parts,scale:sc,S:175,W:2750,cxs:[600,1250,1900,2480],
       guides:[[0,'ゆか(足もと)'],[1.0,'まわし'],[2.0,'かた'],[2.4,'かおの ちゅうしん'],[3.24,'つのの さき']],
       dims:[[0,0.95,'かたの はば(とげを のぞく) 1.9'],[1,0.55,'どうたいの おくゆき 1.1'],[2,0.95,'かたの はば 1.9']],
       sw:[[tint,'はだ(ふつう)'],[mix(tint,1.22),'はだ(あかるい)'],[mix(tint,0.68),'はだ(くらい)・かみ'],['#7a2030','まわし'],['#8f2a40','まわしの まえだれ'],['#e0b84a','金(まわしの ふち)'],['#f0e6c8','つの'],['#cfd6e4','かたの とげ'],['#8d96a8','てくび(こて)'],['#f6f2e6','きば'],['#ffe36a','め(よこく中は あか・きいろ)'],['#a39a86','ふつう(2ひきめの いろ)'],['#7fb36b','かるい てき(みどり)'],['#8a5a45','おもい てき(ちゃいろ)']]};
   }
   const W=CF.W,H=1300,cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d');
   c.fillStyle='#f3f1ea';c.fillRect(0,0,W,H);
   c.strokeStyle='rgba(60,60,80,.07)';c.lineWidth=1;for(let x=0;x<W;x+=40){c.beginPath();c.moveTo(x,0);c.lineTo(x,H);c.stroke();}for(let y=0;y<H;y+=40){c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();}
   c.fillStyle='#2b2540';c.font='bold 44px '+FONT;c.textBaseline='middle';c.textAlign='left';c.fillText(CF.title,60,62);
   c.font='20px '+FONT;c.fillStyle='#6a6580';c.fillText(CF.note,60,104);
   const S=CF.S,baseY=1010,MS=CF.scale,cxs=CF.cxs,views=[['正面図',0],['側面図',Math.PI/2],['背面図',Math.PI]];
   // たかさの ガイド
   c.font='18px '+FONT;
   for(const [hh,label] of CF.guides){const y=baseY-hh*MS*S;c.strokeStyle=hh===0?'rgba(40,36,60,.55)':'rgba(120,110,160,.35)';c.setLineDash(hh===0?[]:[10,8]);c.lineWidth=hh===0?2:1.5;c.beginPath();c.moveTo(40,y);c.lineTo(W-40,y);c.stroke();c.setLineDash([]);c.fillStyle='#5a5575';c.textAlign='left';c.fillText((hh*MS).toFixed(2)+'  '+label,48,y-12);}
   m.useCtx(c);
   views.forEach(([name,yaw],i)=>{
     const x=cxs[i];
     c.strokeStyle='rgba(120,110,160,.3)';c.setLineDash([14,10]);c.lineWidth=1.5;c.beginPath();c.moveTo(x,170);c.lineTo(x,baseY+20);c.stroke();c.setLineDash([]);
     c.fillStyle='rgba(40,36,60,.12)';c.beginPath();c.ellipse(x,baseY+6,150*S/290*1.4,14,0,0,Math.PI*2);c.fill();
     m.h3render(CF.parts,x,baseY,S*MS,false,yaw,0,0,3.2);
     c.fillStyle='#2b2540';c.font='bold 30px '+FONT;c.textAlign='center';c.fillText(name,x,150);
   });
   // くらべる ゆうしゃ(正面。おなじ ものさし)
   {const x=cxs[3];c.strokeStyle='rgba(120,110,160,.3)';c.setLineDash([14,10]);c.lineWidth=1.5;c.beginPath();c.moveTo(x,170);c.lineTo(x,baseY+20);c.stroke();c.setLineDash([]);
    c.fillStyle='rgba(40,36,60,.12)';c.beginPath();c.ellipse(x,baseY+6,150*S/290*1.4,14,0,0,Math.PI*2);c.fill();
    m.h3render(heroParts,x,baseY,S,false,0,0,0,3.2);
    c.fillStyle='#6a6580';c.font='bold 26px '+FONT;c.textAlign='center';c.fillText('くらべる ゆうしゃ',x,150);c.font='17px '+FONT;c.fillText('(おなじ ものさし)',x,176);}
   m.useCtx(null);
   // まえ むきの やじるし(側面図)
   {const x=cxs[1],y=250;c.strokeStyle='#8a5a2a';c.fillStyle='#8a5a2a';c.lineWidth=3;c.beginPath();c.moveTo(x+90,y);c.lineTo(x+210,y);c.stroke();c.beginPath();c.moveTo(x+210,y-10);c.lineTo(x+232,y);c.lineTo(x+210,y+10);c.fill();
    c.font='20px '+FONT;c.textAlign='left';c.fillText('まえ',x+240,y);}
   // 寸法
   const dim=(x1,x2,y,label)=>{c.strokeStyle='#3a3560';c.fillStyle='#3a3560';c.lineWidth=1.5;c.beginPath();c.moveTo(x1,y);c.lineTo(x2,y);c.stroke();for(const x of [x1,x2]){c.beginPath();c.moveTo(x,y-10);c.lineTo(x,y+10);c.stroke();}c.font='19px '+FONT;c.textAlign='center';c.fillText(label,(x1+x2)/2,y+26);};
   for(const [vi,half,label] of CF.dims)dim(cxs[vi]-half*S*MS,cxs[vi]+half*S*MS,baseY+52,label);
   c.textAlign='left';
   // いろ
   c.fillStyle='#2b2540';c.font='bold 26px '+FONT;c.fillText('いろ',60,1170);
   CF.sw.forEach((q,i)=>{const col=i%7,row=Math.floor(i/7),x=190+col*Math.min(265,(W-260)/7),y=1145+row*62;
     c.fillStyle=q[0];c.fillRect(x,y-20,38,38);c.strokeStyle='rgba(20,18,40,.6)';c.lineWidth=1.5;c.strokeRect(x,y-20,38,38);
     c.fillStyle='#4a4560';c.textAlign='left';c.font='15px '+FONT;c.fillText(q[1],x+48,y-6);c.font='13px '+FONT;c.fillStyle='#7a7590';c.fillText(q[0],x+48,y+12);});
   return cv.toDataURL('image/png');
 },WHO);
 fs.mkdirSync(path.dirname(OUT),{recursive:true});
 fs.writeFileSync(OUT,Buffer.from(url.split(',')[1],'base64'));
 console.log('ok',OUT,errs);
 await b.close();srv.close();
})();
