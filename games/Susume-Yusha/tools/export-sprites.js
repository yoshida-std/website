// すすめ！ゆうしゃ: コードで描いたキャラの絵から、グラフィックシートを作り直す
//   node games/Susume-Yusha/tools/export-sprites.js
// 出力（games/Susume-Yusha/ に上書き）:
//   sprites.png        … ゲームが読むシート（透明の背景）
//   sprites.json       … どの絵がシートのどこにあるか
//   sprites-guide.png  … 名前と枠を書きこんだ見本（ゲームは読まない）
// 注意: 描きかえた sprites.png も上書きされる。描きかえを残したいときは実行しない
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path');
const dir=path.resolve(__dirname,'..');
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:844,height:390}});
  await p.goto('file://'+path.join(dir,'index.html')+'?nosheet');
  await p.waitForTimeout(500);
  const out=await p.evaluate(()=>{
    const rows=[
      ['ゆうしゃ',['char.hero.0','char.hero.1','char.hero.pose'],[CLS.hero.spr[0],CLS.hero.spr[1],CLS.hero.pose]],
      ['せんし',['char.warrior.0','char.warrior.1','char.warrior.pose'],[CLS.warrior.spr[0],CLS.warrior.spr[1],CLS.warrior.pose]],
      ['まほうつかい',['char.mage.0','char.mage.1','char.mage.pose'],[CLS.mage.spr[0],CLS.mage.spr[1],CLS.mage.pose]],
      ['そうりょ',['char.priest.0','char.priest.1','char.priest.pose'],[CLS.priest.spr[0],CLS.priest.spr[1],CLS.priest.pose]],
      ...Object.keys(MOB).map(k=>[MOB[k].name,[`mob.${k}.0`,`mob.${k}.1`],MOB[k].spr]),
      ['スライム',['enemy.slime.0','enemy.slime.1'],SP.slime],
      ['コウモリ',['enemy.bat.0','enemy.bat.1'],SP.bat],
      ['ガイコツ',['enemy.skel.0','enemy.skel.1'],SP.skel],
      ['まどうし',['enemy.wiz.0'],SP.wiz],
      ['ドラゴン',['boss.dragon.0','boss.dragon.1'],SP.dragon],
    ];
    const PAD=6,frames={};let y=PAD,maxW=0;
    const layout=rows.map(([label,names,sprs])=>{
      let x=PAD,h=0;const cells=names.map((n,i)=>{const c=sprs[i].r,cell={n,c,x,y,w:c.width,h:c.height};x+=c.width+PAD;h=Math.max(h,c.height);return cell});
      const row={label,cells,y,h};y+=h+PAD;maxW=Math.max(maxW,x);return row;
    });
    const W=maxW,H=y,sheet=document.createElement('canvas');sheet.width=W;sheet.height=H;
    const sx=sheet.getContext('2d');
    for(const r of layout)for(const c of r.cells){const cy=r.y+r.h-c.h;sx.drawImage(c.c,c.x,cy);frames[c.n]={x:c.x,y:cy,w:c.w,h:c.h}}
    // 見本: 名前の列、市松の背景、セルの枠、絵の名前（2倍で表示）
    const LW=120,K=2,TH=12,guide=document.createElement('canvas');guide.width=(LW+W)*K;
    const gy0=[];let gy=0;for(const r of layout){gy0.push(gy);gy+=(r.h+PAD+TH)}
    guide.height=(gy+PAD)*K;
    const g=guide.getContext('2d');g.imageSmoothingEnabled=false;g.fillStyle='#1b1f2a';g.fillRect(0,0,guide.width,guide.height);
    layout.forEach((r,ri)=>{
      const oy=gy0[ri];const mid=(oy+TH+r.h/2+PAD)*K,id=r.cells[0].n.split('.').slice(0,2).join('.');g.textBaseline='middle';g.fillStyle='#fff';g.font=`${12*K}px sans-serif`;g.fillText(r.label,6*K,mid-6*K);g.fillStyle='#8a92b0';g.font=`${8*K}px sans-serif`;g.fillText(id,6*K,mid+8*K);
      for(const c of r.cells){const f=frames[c.n],X=(LW+f.x)*K,Y=(oy+TH+PAD+(r.h-f.h))*K;
        for(let yy=0;yy<f.h;yy+=4)for(let xx=0;xx<f.w;xx+=4){g.fillStyle=((xx+yy)/4)%2?'#9aa0b0':'#c8ccd8';g.fillRect(X+xx*K,Y+yy*K,4*K,4*K)}
        g.drawImage(sheet,f.x,f.y,f.w,f.h,X,Y,f.w*K,f.h*K);
        g.strokeStyle='#ffd84a';g.lineWidth=1;g.strokeRect(X-.5,Y-.5,f.w*K+1,f.h*K+1);
        g.fillStyle='#a8ecff';g.font=`${7*K}px sans-serif`;g.textBaseline='alphabetic';g.fillText(`${c.n.split('.').pop()} ${f.w}x${f.h}`,X,Y-3*K)}
    });
    return {png:sheet.toDataURL('image/png'),guide:guide.toDataURL('image/png'),
      json:{note:'すすめ！ゆうしゃ のキャラの絵。sprites.png の各セル（x,y,w,h）を描きかえるとゲームに反映される。絵は右向き、足もとがセルの下の端。セルの大きさを変えたときは w,h も直す',version:1,frames}};
  });
  const save=(f,d)=>fs.writeFileSync(path.join(dir,f),Buffer.from(d.split(',')[1],'base64'));
  save('sprites.png',out.png);save('sprites-guide.png',out.guide);
  fs.writeFileSync(path.join(dir,'sprites.json'),JSON.stringify(out.json,null,1)+'\n');
  console.log('frames:',Object.keys(out.json.frames).length);
  await b.close();
})();
