/*
 * 「NEW」の目印の共通部品。公開日から NEW_DAYS 日以内のものに付ける（見る人が前に来たかどうかは関係なし）。
 *
 *   YS.isNew("2026-11-05")                 日付（YYYY-MM-DD、または ISO の日時）が最近なら true
 *   YS.newBadge()                          <span class="new-badge">NEW</span> を返す（サムネイルの左上に重ねる。.thumb は position: relative に）
 *   YS.newBadge().classList.add("inline")  見出しの横に並べるとき
 *
 * 日付だけのものは日本時間の 0 時として扱う。見た目は style.css の .new-badge。
 */
(function () {
  "use strict";
  var NEW_DAYS = 14;
  var YS = (window.YS = window.YS || {});

  YS.isNew = function (value) {
    if (!value) return false;
    var t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + "T00:00:00+09:00" : value);
    if (isNaN(t)) return false;
    var age = Date.now() - t;
    // 少し先の日付（時差・予約）も新しい扱い。それより先の予定は付けない
    return age > -864e5 && age <= NEW_DAYS * 864e5;
  };

  YS.newBadge = function () {
    var b = document.createElement("span");
    b.className = "new-badge";
    b.textContent = "NEW";
    return b;
  };
})();
