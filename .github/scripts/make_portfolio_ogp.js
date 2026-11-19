/*
 * ポートフォリオの「リンクを共有したときの画像」（OGP。1200x630）を作る。
 *
 * 使い方（リポジトリのルートで）:
 *   python .github/scripts/make_portfolio_icons.py     # 先に。img/icons/robot.png（白い線のロボット）を作る
 *   node .github/scripts/make_portfolio_ogp.js
 *
 * 必要なもの: Playwright（chromium）と、見出しのフォント @fontsource/noto-sans-jp
 *   npm install playwright @fontsource/noto-sans-jp   （別の場所に入れたなら NODE_PATH でその node_modules を指す）
 *
 * 出力: portfolio/img/ogp.jpg（トップ。ヘッダー画像）と ogp-line.jpg / ogp-games.jpg / ogp-charip.jpg / ogp-famicom.jpg。
 * 青い地・左にロボット・右に見出し（とサムネイル）という共通のデザイン。
 * 一覧ページを足したときは、下の PAGES に1つ足して作り直し、そのページの og:image に指定する。
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "../..");
const IMG = path.join(ROOT, "portfolio/img");
const FONT_CSS = (w) => require.resolve(`@fontsource/noto-sans-jp/${w}.css`);

// title は行ごとの配列（titleSize は見出しの大きさ px、省略は 78）。tiles は img/ からの相対パス（サムネイルの並び）。
// sub の pill が true なら緑の札にする
const PAGES = [
  { file: "ogp-line.jpg", title: ["LINEスタンプ", "絵文字"], sub: "LINE STORE で販売中", pill: true },
  {
    file: "ogp-games.jpg",
    title: ["ブラウザゲーム"],
    sub: "インストールなしで、すぐ遊べる",
    tiles: ["games/judge2.jpg", "games/susume-yusha.jpg", "games/knife-master.jpg"],
  },
  {
    file: "ogp-charip.jpg",
    title: ["キャラクターIP"],
    sub: "ヨシダスタジオのキャラクターたち",
    tiles: ["charip/taijiro.jpg", "charip/aitsu.jpg", "charip/chibiupa.jpg"],
  },
  {
    file: "ogp-famicom.jpg",
    title: ["自作", "ファミコンゲーム"],
    titleSize: 68,
    sub: "実機で動く ROM を配布中",
    tiles: ["famicom/horihori.jpg"],
  },
];

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const url = (p) => "file://" + p;

function pageHtml(page) {
  const tiles = (page.tiles || [])
    .map((t) => `<img src="${url(path.join(IMG, t))}" alt="">`)
    .join("");
  // サムネイルが1枚だけのときは、大きくなりすぎないよう 330px まで
  const tileW = page.tiles
    ? Math.min(330, Math.floor((590 - 16 * (page.tiles.length - 1)) / page.tiles.length))
    : 0;
  return `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="${url(FONT_CSS(500))}"><link rel="stylesheet" href="${url(FONT_CSS(700))}">
<style>
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  body {
    position: relative; color: #fff; font-family: "Noto Sans JP", sans-serif;
    background: radial-gradient(ellipse at 26% 48%, #1b6199 0%, #134f7d 52%, #0e3d66 100%);
  }
  .robot { position: absolute; left: 36px; bottom: 0; height: 560px; }
  .main { position: absolute; left: 540px; top: 0; bottom: 0; width: 610px; display: flex; flex-direction: column; justify-content: center; }
  .brand { font-weight: 700; font-size: 25px; letter-spacing: .22em; color: rgb(255 255 255 / .72); padding-bottom: 14px; border-bottom: 3px solid rgb(255 255 255 / .6); width: 100%; }
  h1 { font-weight: 700; font-size: ${page.titleSize || 78}px; line-height: 1.22; margin-top: 26px; letter-spacing: .01em; text-shadow: 0 3px 12px rgb(0 0 0 / .25); }
  .sub { font-weight: 500; font-size: 32px; margin-top: 18px; color: rgb(255 255 255 / .9); }
  .sub.pill { display: inline-block; align-self: flex-start; background: #06c755; color: #fff; font-weight: 700; padding: 6px 26px 8px; border-radius: 999px; font-size: 30px; }
  .tiles { display: flex; gap: 16px; margin-top: 30px; }
  .tiles img { width: ${tileW}px; aspect-ratio: 1200 / 630; object-fit: cover; border: 4px solid #fff; border-radius: 14px; box-shadow: 0 6px 18px rgb(0 0 0 / .35); }
</style>
<img class="robot" src="${url(path.join(IMG, "icons/robot.png"))}" alt="">
<div class="main">
  <div class="brand">YOSHIDA STUDIO</div>
  <h1>${page.title.map(esc).join("<br>")}</h1>
  <div class="sub${page.pill ? " pill" : ""}">${esc(page.sub)}</div>
  ${tiles ? `<div class="tiles">${tiles}</div>` : ""}
</div>`;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ogp-"));
  const shot = async (html, file) => {
    const f = path.join(tmp, "page.html");
    fs.writeFileSync(f, html);
    await page.goto(url(f));
    await page.evaluate(() => document.fonts.ready);
    await Promise.all([...await page.$$("img")].map((h) => h.evaluate((i) => i.complete || new Promise((r) => (i.onload = i.onerror = r)))));
    const out = path.join(IMG, file);
    await page.screenshot({ path: out, type: "jpeg", quality: 88 });
    console.log(`${file.padEnd(18)} ${Math.round(fs.statSync(out).size / 1024)} KB`);
  };

  // トップは、ヘッダー画像（比率が同じ 1424x748）をそのまま 1200x630 に
  await shot(
    `<!doctype html><style>*{margin:0}html,body{width:1200px;height:630px;overflow:hidden}img{width:1200px;height:630px;display:block}</style><img src="${url(path.join(IMG, "header.jpg"))}">`,
    "ogp.jpg",
  );
  for (const p of PAGES) await shot(pageHtml(p), p.file);
  await browser.close();
})();
