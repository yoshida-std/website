// すすめ！ゆうしゃ: キャラのグラフィックシートを作り直す
//   node games/Susume-Yusha/tools/export-sprites.js               … コードで描いた絵から作る（sprites.json の custom にあるコマは、いまのシートの絵をそのまま使う）
//   node games/Susume-Yusha/tools/export-sprites.js --from-sheet  … いまのシートの絵をすべてそのまま使って並べなおす（見本の作り直し）
// シートのセルは「描くときの大きさ」。ゲームは各コマの s（表示の倍率）に合わせて縮めて表示する
//   キャラ（勇者・仲間・町の人）: 表示の 1.5 倍（ふつうは 48x48 → 表示 32x32、s=2/3）。コードの絵は元のドットを Scale3x で3倍にしたもの
//   敵・ドラゴン: 表示の 2 倍（s=1/2）。コードの絵は Scale2x でさらに2倍にしたもの
// 出力（games/Susume-Yusha/ に上書き）:
//   sprites.png        … ゲームが読むシート（透明の背景）
//   sprites.json       … どの絵がシートのどこにあるか（frames: 名前 → x,y,w,h,s）。custom・weaponInSprite は引きつぐ
//   sprites-guide.png  … 名前と枠を書きこんだ見本（ゲームは読まない）
// 注意: custom に入っていないコマは、描きかえていてもコードの絵で上書きされる
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),http=require('http');
const dir=path.resolve(__dirname,'..');
const fromSheet=process.argv.includes('--from-sheet');
(async()=>{
  const old=(()=>{try{return JSON.parse(fs.readFileSync(path.join(dir,'sprites.json'),'utf8'))}catch(e){return {}}})();
  // ゲームのフォルダを配る小さなサーバー（シートを fetch で読むため）
  const srv=http.createServer((q,r)=>{const f=path.join(dir,decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'Content-Type':f.endsWith('.png')?'image/png':f.endsWith('.json')?'application/json':'text/html; charset=utf-8'});r.end(d)})});
  await new Promise(ok=>srv.listen(0,ok));
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:844,height:390}});
  await p.goto(`http://localhost:${srv.address().port}/index.html?nosheet`);
  await p.waitForTimeout(800);
  const out=await p.evaluate(async([fromSheet])=>{
    // いまのシート（custom のコマと --from-sheet で使う）
    let sheet=null,meta={frames:{}};
    try{meta=await (await fetch('sprites.json',{cache:'no-store'})).json();
      const im=new Image();im.src=URL.createObjectURL(await (await fetch('sprites.png',{cache:'no-store'})).blob());await im.decode();sheet=im}catch(e){}
    const keep=new Set(fromSheet?Object.keys(meta.frames):(meta.custom||[]));
    const crop=k=>{const f=meta.frames[k],c=canvasOf(f.w,f.h);c.getContext('2d').drawImage(sheet,f.x,f.y,f.w,f.h,0,0,f.w,f.h);return {c,s:f.s||1}};
    // Scale3x（ドットの段差をなめらかにしながら3倍）
    function scale3x(c){
      const w=c.width,h=c.height,s=c.getContext('2d').getImageData(0,0,w,h).data,o=canvasOf(w*3,h*3),ox=o.getContext('2d'),im=ox.createImageData(w*3,h*3),d=im.data;
      const P=(x,y)=>x<0||y<0||x>=w||y>=h?-1:(y*w+x)*4;
      const eq=(a,b)=>{if(a<0||b<0){const k=a<0?b:a;return a===b||s[k+3]===0}return s[a]===s[b]&&s[a+1]===s[b+1]&&s[a+2]===s[b+2]&&s[a+3]===s[b+3]};
      const put=(x,y,k)=>{if(k<0)return;const q=(y*w*3+x)*4;d[q]=s[k];d[q+1]=s[k+1];d[q+2]=s[k+2];d[q+3]=s[k+3]};
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const A=P(x-1,y-1),B=P(x,y-1),C=P(x+1,y-1),D=P(x-1,y),E=P(x,y),F=P(x+1,y),G=P(x-1,y+1),H=P(x,y+1),I=P(x+1,y+1);
        const e=new Array(9).fill(E);
        if(!eq(B,H)&&!eq(D,F)){
          e[0]=eq(D,B)?D:E;
          e[1]=(eq(D,B)&&!eq(E,C))||(eq(B,F)&&!eq(E,A))?B:E;
          e[2]=eq(B,F)?F:E;
          e[3]=(eq(D,B)&&!eq(E,G))||(eq(D,H)&&!eq(E,A))?D:E;
          e[5]=(eq(B,F)&&!eq(E,I))||(eq(H,F)&&!eq(E,C))?F:E;
          e[6]=eq(D,H)?D:E;
          e[7]=(eq(D,H)&&!eq(E,I))||(eq(H,F)&&!eq(E,G))?H:E;
          e[8]=eq(H,F)?F:E;
        }
        for(let i=0;i<9;i++)put(x*3+i%3,y*3+(i/3|0),e[i]<0?E:e[i]);
      }
      ox.putImageData(im,0,0);return o;
    }
    const ch=sp=>({c:scale3x(sp.src),s:2/3}),en=sp=>({c:scale2x(sp.r),s:1/2});
    const rows=[
      ...['hero','warrior','mage','priest'].map(k=>[CLS[k].name,[`char.${k}.0`,`char.${k}.1`,`char.${k}.pose`],[ch(CLS[k].spr[0]),ch(CLS[k].spr[1]),ch(CLS[k].pose)]]),
      ...Object.keys(MOB).map(k=>[MOB[k].name,[`mob.${k}.0`,`mob.${k}.1`],MOB[k].spr.map(ch)]),
      ['スライム',['enemy.slime.0','enemy.slime.1'],SP.slime.map(en)],
      ['コウモリ',['enemy.bat.0','enemy.bat.1'],SP.bat.map(en)],
      ['ガイコツ',['enemy.skel.0','enemy.skel.1'],SP.skel.map(en)],
      ['まどうし',['enemy.wiz.0'],SP.wiz.map(en)],
      ['ドラゴン',['boss.dragon.stance','boss.dragon.roar','boss.dragon.claw','boss.dragon.flap'],['stance','roar','claw','flap'].map(k=>en(SP.dragonPose[k]))],   // かまえ・ほえる・つめ・はばたき
    ].map(([label,names,src])=>[label,names,src.map((v,i)=>keep.has(names[i])&&sheet&&meta.frames[names[i]]?crop(names[i]):v)]);
    const PAD=6,frames={};let y=PAD,maxW=0;
    const layout=rows.map(([label,names,src])=>{
      let x=PAD,h=0;const cells=names.map((n,i)=>{const {c,s}=src[i],cell={n,c,s,x,y,w:c.width,h:c.height};x+=c.width+PAD;h=Math.max(h,c.height);return cell});
      const row={label,cells,y,h};y+=h+PAD;maxW=Math.max(maxW,x);return row;
    });
    const W=maxW,H=y,out=document.createElement('canvas');out.width=W;out.height=H;
    const sx=out.getContext('2d');
    for(const r of layout)for(const c of r.cells){const cy=r.y+r.h-c.h;sx.drawImage(c.c,c.x,cy);frames[c.n]={x:c.x,y:cy,w:c.w,h:c.h,s:+c.s.toFixed(4)}}
    // 見本: 名前の列、市松の背景、セルの枠、コマの名前と「描く大きさ → 表示の大きさ」
    const LW=120,TH=12,GAP=40,guide=document.createElement('canvas');guide.width=LW+Math.max(...layout.map(r=>r.cells.reduce((a,c)=>a+c.w+GAP,PAD)));
    const gy0=[];let gy=0;for(const r of layout){gy0.push(gy);gy+=(r.h+PAD+TH)}
    guide.height=gy+PAD;
    const g=guide.getContext('2d');g.imageSmoothingEnabled=false;g.fillStyle='#1b1f2a';g.fillRect(0,0,guide.width,guide.height);
    layout.forEach((r,ri)=>{
      const oy=gy0[ri],mid=oy+TH+r.h/2+PAD,id=r.cells[0].n.split('.').slice(0,2).join('.');
      g.textBaseline='middle';g.fillStyle='#fff';g.font='14px sans-serif';g.fillText(r.label,6,mid-7);g.fillStyle='#8a92b0';g.font='10px sans-serif';g.fillText(id,6,mid+9);
      let gx=LW+PAD;for(const c of r.cells){const f=frames[c.n],X=gx,Y=oy+TH+PAD+(r.h-f.h);gx+=f.w+GAP;
        for(let yy=0;yy<f.h;yy+=6)for(let xx=0;xx<f.w;xx+=6){g.fillStyle=((xx+yy)/6)%2?'#9aa0b0':'#c8ccd8';g.fillRect(X+xx,Y+yy,Math.min(6,f.w-xx),Math.min(6,f.h-yy))}
        g.drawImage(out,f.x,f.y,f.w,f.h,X,Y,f.w,f.h);
        g.strokeStyle='#ffd84a';g.lineWidth=1;g.strokeRect(X-.5,Y-.5,f.w+1,f.h+1);
        g.fillStyle='#a8ecff';g.font='9px sans-serif';g.textBaseline='alphabetic';
        g.fillText(`${c.n.split('.').pop()} ${f.w}x${f.h}→${Math.round(f.w*f.s)}x${Math.round(f.h*f.s)}`,X,Y-3)}
    });
    return {png:out.toDataURL('image/png'),guide:guide.toDataURL('image/png'),frames};
  },[fromSheet]);
  const json={note:'すすめ！ゆうしゃ のキャラの絵。sprites.png の各セル（x,y,w,h）は描くときの大きさで、ゲームは s 倍に縮めて表示する（キャラ 2/3、敵 1/2）。絵は右向き、足もとがセルの下の端。セルの大きさを変えたときは w,h も直す。custom のコマは書き出しスクリプトで上書きされない',
    version:2,frames:out.frames};
  if(old.custom)json.custom=old.custom;
  if(old.weaponInSprite)json.weaponInSprite=old.weaponInSprite;
  const save=(f,d)=>fs.writeFileSync(path.join(dir,f),Buffer.from(d.split(',')[1],'base64'));
  save('sprites.png',out.png);save('sprites-guide.png',out.guide);
  fs.writeFileSync(path.join(dir,'sprites.json'),JSON.stringify(json,null,1)+'\n');
  console.log('frames:',Object.keys(json.frames).length,fromSheet?'(from sheet)':'(custom kept: '+(old.custom||[]).join(', ')+')');
  await b.close();srv.close();
})().catch(e=>{console.error(e.message);process.exit(1)});
