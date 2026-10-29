// キャラクターIP 紹介ページの共通部分。ページ側は <body data-ip="IPのid"> と、次の目印を置く。
//   [data-ip-name]    IP名  [data-ip-aliases] 別名（なければ隠す）  [data-ip-by]      「ヨシダスタジオ」などの提供元者名
//   [data-ip-source]  オープンソースのとき、元ページへのリンク（なければ隠す）
//   [data-ip-links]   スタンプ・ゲームへのボタン  [data-ip-stickers] 最新スタンプ数点（任意）
// 内容は charip.json から読む。載っていない（公開していない）IP は何も出さない。
(function () {
  "use strict";
  var id = document.body.dataset.ip;
  function safeUrl(u) {
    u = String(u || "");
    return /^[a-z][a-z0-9+.-]*:/i.test(u) ? (/^https:\/\//i.test(u) ? u : "") : u;
  }
  function norm(s) {
    return String(s).normalize("NFKC").toLowerCase()
      .replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); })
      .replace(/\s+/g, "");
  }
  // Object.keys は数字のキー（スタンプ）を小さい順に並べ替えるので、文字列に書かれた順（新しい順）で拾う
  function catalogOrder(text, map) {
    var keys = [], seen = {}, m, re = /"([0-9A-Za-z]+)"\s*:\s*\{/g;
    while ((m = re.exec(text))) { if (map[m[1]] && !seen[m[1]]) { seen[m[1]] = true; keys.push(m[1]); } }
    Object.keys(map).forEach(function (k) { if (!seen[k]) keys.push(k); });
    return keys;
  }
  function get(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function btn(text, href, sub, blank) {
    var a = document.createElement("a");
    a.className = "ip-btn" + (sub ? " sub" : "");
    a.href = href;
    a.textContent = text;
    if (blank) { a.target = "_blank"; a.rel = "noopener"; }
    return a;
  }
  var cur = document.querySelector(".nav [aria-current]");
  if (cur && cur.scrollIntoView) cur.scrollIntoView({ inline: "center", block: "nearest" });

  get("../charip.json").then(function (data) {
    var ip = (data.items || []).filter(function (x) { return x.id === id; })[0];
    if (!ip) return;
    document.querySelectorAll("[data-ip-name]").forEach(function (el) { el.textContent = ip.name; });
    var al = (ip.aliases || []).join("、");
    document.querySelectorAll("[data-ip-aliases]").forEach(function (el) {
      el.hidden = !al;
      var t = el.querySelector("span");
      if (t) t.textContent = al;
    });
    var by = ip.creator || {};
    document.querySelectorAll("[data-ip-by]").forEach(function (el) { el.textContent = by.name || ""; });
    var src = document.querySelector("[data-ip-source]");
    if (src) {
      var u = ip.kind === "opensource" && ip.source ? safeUrl(ip.source.url) : "";
      if (u) {
        var a = src.querySelector("a") || src.appendChild(document.createElement("a"));
        a.href = u; a.target = "_blank"; a.rel = "noopener";
        a.textContent = (ip.source.name || by.name || u) + " のページ";
        src.hidden = false;
      } else src.hidden = true;
    }

    var links = document.querySelector("[data-ip-links]");
    var q = ip.stickers && ip.stickers.q;
    if (links && q) {
      var p = new URLSearchParams({ q: q });
      if (ip.stickers.type === "emoji") p.set("type", "emoji");
      links.appendChild(btn("LINEスタンプを見る", "../../line/?" + p.toString(), false));
    }
    // ゲームは games.json に載っている（公開している）ものだけ
    if (links && (ip.games || []).length) {
      get("../../games/games.json").then(function (g) {
        (g.items || []).forEach(function (it) {
          if (ip.games.indexOf(it.id) !== -1 && safeUrl(it.path)) {
            links.appendChild(btn(it.title + " を遊ぶ", "../" + safeUrl(it.path), true));
          }
        });
      }).catch(function () {});
    }

    var box = document.querySelector("[data-ip-stickers]");
    if (box && q) {
      fetch("../../../common/line-promo/sticker-catalog.json", { cache: "no-cache" }).then(function (r) {
        if (!r.ok) throw new Error(r.status); return r.text();
      }).then(function (text) {
        var map = JSON.parse(text).items || {};
        var words = String(q).split(/[\s　]+/).map(norm).filter(Boolean);
        var type = ip.stickers.type === "emoji" ? "emoji" : "sticker";
        var hits = catalogOrder(text, map).map(function (k) { return map[k]; }).filter(function (it) {
          var n = norm(it.name);
          return it.type === type && /^https:\/\//.test(it.url) && /^https:\/\//.test(it.image) &&
            words.every(function (w) { return n.indexOf(w) !== -1; });
        }).slice(0, 6);
        hits.forEach(function (it) {
          var a = document.createElement("a");
          a.href = it.url; a.target = "_blank"; a.rel = "noopener"; a.title = it.name;
          var img = document.createElement("img");
          img.src = it.image; img.alt = it.name; img.loading = "lazy"; img.decoding = "async";
          a.appendChild(img);
          box.appendChild(a);
        });
        (box.closest("section") || box).hidden = !hits.length;
      }).catch(function () {});
    }
  }).catch(function () {});
})();
