/*!
 * line-sticker-promo.js  v7
 * 複数ゲームで共有する「LINEスタンプ／絵文字」誘導部品。
 * このJSと sticker-catalog.json（全スタンプ・絵文字の定義）を同じ共通パスに置きます。
 * 各ゲームは「キー」を渡すだけです。
 * キーは LINE STORE の商品ID（スタンプは数字、絵文字は英数字24桁）。
 * sticker-catalog.json は GitHub Actions が LINE STORE を巡回して毎日作り直します。
 *
 * 【アイテムキーを指定】（カンマ区切り。並べた順に表示）
 *   <script src="../../common/line-promo/line-sticker-promo.js" data-keys="12345678,5ac1bfd5040ab15980c9b435"></script>
 *
 * 【JSから指定】
 *   StickerPromo.init({ keys: ["12345678", "5ac1bfd5040ab15980c9b435"], position: "top-right" });
 *
 * 任意の data 属性 / init オプション:
 *   catalog（カタログJSONのURL。省略時はこのJSと同じ場所の sticker-catalog.json）
 *   position（bottom-right など） / label（ボタン文言） / title（一覧の見出し）
 *   autoShow（false でボタンを最初は隠す。後から StickerPromo.show()）
 *
 * 表示の切り替え: StickerPromo.show() / hide() / open() / close()
 * （カタログの読み込み前に show()/hide() を呼んでもよい。読み込み後に最後の指示どおりになる）
 * レイアウトは縦画面=行、横画面=タイルで自動切り替え。
 * ※ カタログ内の image は絶対URL（LINEの画像サーバー）か、カタログJSONの場所が基準の相対パス。url は https のみ有効。
 * ※ ゲームと共有先のドメインが違う場合、共有先がJSONにCORS許可（Access-Control-Allow-Origin）を返すこと。
 */
(function (global) {
  "use strict";

  var SCRIPT = document.currentScript;
  var root, modal, config, baseUrl = location.href;
  // カタログの読み込み前に show()/hide() が呼ばれたときのため、最後の指示を覚えておく（null は指示なし）
  var wanted = null;
  var TYPES = { sticker: "スタンプ", emoji: "絵文字" };

  function injectCss() {
    if (document.getElementById("sp-style")) return;
    var s = document.createElement("style");
    s.id = "sp-style";
    s.textContent =
      ".sp-btn{position:fixed;z-index:2147483000;display:none;padding:10px 14px;border:0;border-radius:999px;" +
      "background:#06c755;color:#fff;font:bold 14px/1 sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.35);" +
      "touch-action:manipulation;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}" +
      ".sp-btn:active{transform:scale(.96)}" +
      ".sp-modal{position:fixed;inset:0;z-index:2147483001;display:none;align-items:center;justify-content:center;" +
      "background:rgba(0,0,0,.6);touch-action:manipulation;-webkit-user-select:none;user-select:none}" +
      ".sp-card{box-sizing:border-box;overscroll-behavior:contain;width:min(90vw,380px);max-height:88vh;overflow:auto;-webkit-overflow-scrolling:touch;" +
      "background:#eef0f6;color:#1b2540;border-radius:18px;padding:14px 14px 0;text-align:center;font:14px/1.4 sans-serif}" +
      ".sp-card h2{margin:0 0 6px;font-size:16px;line-height:1.4}" +
      ".sp-card h3{margin:10px 0 6px;font-size:13px;color:#2f8a57;text-align:left}" +
      ".sp-list{display:block}" +
      ".sp-item{display:flex;align-items:center;gap:12px;margin:0 0 8px;padding:8px;border-radius:14px;" +
      "background:linear-gradient(#fff6ee,#fbe4d2);color:#1b2540;text-decoration:none;border:1px solid #e3c9b3;" +
      "box-shadow:0 2px 4px rgba(0,0,0,.18);-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}" +
      ".sp-item:active{transform:scale(.98)}" +
      ".sp-thumb{flex:none;width:60px;height:60px;border-radius:10px;background:#e4f1e6;border:2px solid #4c9a6a;" +
      "object-fit:contain;pointer-events:none}" +
      ".sp-name{display:block;font-weight:bold;font-size:15px;text-align:left}" +
      ".sp-see{display:block;margin-top:2px;font-size:13px;font-weight:bold;color:#2f8a57;text-align:left}" +
      ".sp-pixel .sp-thumb{image-rendering:pixelated}" +
      ".sp-foot{position:sticky;bottom:0;padding:8px 0 12px;background:#eef0f6}" +
      ".sp-close{padding:10px 36px;border:0;border-radius:999px;background:linear-gradient(#8fa3bd,#5f7592);" +
      "color:#fff;font:bold 15px sans-serif;touch-action:manipulation;box-shadow:0 2px 4px rgba(0,0,0,.25)}" +
      "@media (orientation:landscape){" +
      ".sp-card{width:min(92vw,640px);max-height:92vh;padding:10px 14px 0}" +
      ".sp-card h2{font-size:15px;margin-bottom:2px}" +
      ".sp-card h3{margin:6px 0 4px;font-size:12px}" +
      ".sp-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px}" +
      ".sp-item{flex-direction:column;gap:2px;margin:0;padding:6px 4px;text-align:center}" +
      ".sp-thumb{width:64px;height:64px}" +
      ".sp-name{font-size:12px;text-align:center}" +
      ".sp-see{display:none}" +
      ".sp-foot{padding:6px 0 10px}" +
      ".sp-close{padding:8px 32px;font-size:14px}}";
    document.head.appendChild(s);
  }

  function place(el, pos) {
    var p = String(pos || "bottom-right").split("-");
    var v = p[0] === "top" ? "top" : "bottom", h = p[1] === "left" ? "left" : "right";
    el.style[v] = "calc(env(safe-area-inset-" + v + ",0px) + 12px)";
    el.style[h] = "calc(env(safe-area-inset-" + h + ",0px) + 12px)";
  }

  function resolve(u) { try { return new URL(u, baseUrl).href; } catch (e) { return ""; } }
  function safeHttps(u) {
    try { var x = new URL(u, baseUrl); return x.protocol === "https:" ? x.href : null; }
    catch (e) { return null; }
  }

  function makeItem(it) {
    var a = document.createElement("a");
    a.className = "sp-item";
    a.href = safeHttps(it.url);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.draggable = false;
    if (it.image) {
      var im = document.createElement("img");
      im.className = "sp-thumb";
      im.src = resolve(it.image);
      im.alt = "";
      im.draggable = false;
      im.referrerPolicy = "no-referrer";
      a.appendChild(im);
    }
    var box = document.createElement("span");
    var n = document.createElement("span");
    n.className = "sp-name";
    n.textContent = it.name || "";
    var see = document.createElement("span");
    see.className = "sp-see";
    see.textContent = "見る";
    box.appendChild(n);
    box.appendChild(see);
    a.appendChild(box);
    return a;
  }

  // ゲーム側は document でタッチを打ち消している（ダブルタップ拡大・スクロールの抑止）ことが多い。
  // そのままだとリンクのタップや一覧のスクロールまで止まるので、部品内のタッチはゲームに渡さない。
  // 部品内でも2本指のピンチ拡大だけは止める。
  function shield(el) {
    ["touchstart", "touchmove", "touchend"].forEach(function (type) {
      el.addEventListener(type, function (e) {
        if (e.touches && e.touches.length > 1) e.preventDefault();
        e.stopPropagation();
      }, { passive: false });
    });
  }

  function build() {
    injectCss();
    var items = (config.items || []).filter(function (it) { return it && safeHttps(it.url); });
    if (!items.length) return;

    var btn = config.button || {};
    root = document.createElement("button");
    root.className = "sp-btn";
    root.type = "button";
    root.textContent = config.label || btn.label || "LINEスタンプ";
    place(root, config.position || btn.position);
    root.addEventListener("click", open);
    shield(root);
    document.body.appendChild(root);

    modal = document.createElement("div");
    modal.className = "sp-modal" + (config.pixelArt ? " sp-pixel" : "");
    var card = document.createElement("div");
    card.className = "sp-card";
    var h = document.createElement("h2");
    h.textContent = config.title || "LINEで使える、スタンプ&絵文字の紹介！";
    card.appendChild(h);

    Object.keys(TYPES).forEach(function (type) {
      var list = items.filter(function (it) { return (it.type || "sticker") === type; });
      if (!list.length) return;
      var h3 = document.createElement("h3");
      h3.textContent = TYPES[type];
      card.appendChild(h3);
      var box = document.createElement("div");
      box.className = "sp-list";
      list.forEach(function (it) { box.appendChild(makeItem(it)); });
      card.appendChild(box);
    });

    var foot = document.createElement("div");
    foot.className = "sp-foot";
    var close = document.createElement("button");
    close.className = "sp-close";
    close.type = "button";
    close.textContent = "閉じる";
    close.addEventListener("click", closeModal);
    foot.appendChild(close);
    card.appendChild(foot);

    modal.appendChild(card);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
    shield(modal);
    document.body.appendChild(modal);

    if (wanted === true || (wanted === null && config.autoShow !== false)) show();
  }

  function show() { wanted = true; if (root) root.style.display = "block"; }
  function hide() { wanted = false; if (root) root.style.display = "none"; closeModal(); }
  function open() { if (modal) modal.style.display = "flex"; }
  function closeModal() { if (modal) modal.style.display = "none"; }

  function start(cfg) {
    config = cfg;
    if (document.body) build(); else document.addEventListener("DOMContentLoaded", build);
  }

  // カタログから、キーに合うアイテムと表示設定を取り出す
  function pick(catalog, opt) {
    var keys = opt.keys, over = {};
    var table = catalog.items || {};
    var items = [];
    (keys || []).forEach(function (k) {
      if (table[k]) items.push(table[k]); else console.warn("[StickerPromo] アイテムキーが見つかりません:", k);
    });
    return {
      items: items,
      title: opt.title || over.title || catalog.title,
      button: over.button || catalog.button,
      label: opt.label,
      position: opt.position,
      pixelArt: over.pixelArt != null ? over.pixelArt : catalog.pixelArt,
      autoShow: opt.autoShow != null ? opt.autoShow : (over.autoShow != null ? over.autoShow : catalog.autoShow)
    };
  }

  function defaultCatalogUrl() {
    if (SCRIPT && SCRIPT.src) return new URL("sticker-catalog.json", SCRIPT.src).href;
    return new URL("sticker-catalog.json", location.href).href;
  }

  function init(opt) {
    opt = opt || {};
    if (Array.isArray(opt)) opt = { keys: opt };
    var url = opt.catalog ? new URL(opt.catalog, location.href).href : defaultCatalogUrl();
    baseUrl = url;
    fetch(url, { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (catalog) {
        var cfg = pick(catalog, opt);
        if (cfg) start(cfg);
      })
      .catch(function (e) { console.warn("[StickerPromo] カタログを読み込めません:", e); });
  }

  global.StickerPromo = { init: init, show: show, hide: hide, open: open, close: closeModal };

  // data 属性があれば自動で開始
  if (SCRIPT && SCRIPT.dataset.keys) {
    init({
      keys: SCRIPT.dataset.keys.split(",").map(function (k) { return k.trim(); }).filter(Boolean),
      catalog: SCRIPT.dataset.catalog,
      position: SCRIPT.dataset.position,
      label: SCRIPT.dataset.label,
      title: SCRIPT.dataset.title,
      autoShow: SCRIPT.dataset.autoShow === "false" ? false : undefined
    });
  }
})(window);
