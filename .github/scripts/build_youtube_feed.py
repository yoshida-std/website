"""YouTube のショート動画の RSS を読んで、ポートフォリオ用の動画一覧 JSON を作り直す。

使い方: python build_youtube_feed.py <出力JSON>

読み方は2段構え。

1. チャンネルの「ショートだけの再生リスト」の RSS を読む。チャンネル ID（UC…）の UC を UUSH に
   変えると、そのチャンネルのショートだけの再生リスト ID になる（YouTube の非公式な仕組み。
   ときどき 404 を返すことがある）。
2. 1 が読めなかったら、チャンネル全体の RSS（公式。最新15本）を読み、1本ずつ
   https://www.youtube.com/shorts/動画ID を開いてショートだけに絞る
   （ショートなら 200、ショートでなければ /watch へのリダイレクト）。
   判定できなかった動画（通信エラーなど）はショートとして残す。

環境変数:
- YOUTUBE_CHANNEL_ID  チャンネル ID（省略時は ヨシダスタジオ のチャンネル）
- YOUTUBE_FEED        読む RSS を1つに決める（ショートだけの RSS として扱い、絞り込みはしない）
- YOUTUBE_BASE        https://www.youtube.com の代わり（動作確認用）
- MAX_ITEMS           書き出す最大件数（省略時 12）
- REQUEST_INTERVAL    ショートの判定で、1本ごとに待つ秒数（省略時 0.5）
- RETRY_WAIT          読み直しの待ち秒数の基準（省略時 5）

2 つとも読めなかったとき、動画が0件のときは、書き換えずに異常終了する。
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

BASE = os.environ.get("YOUTUBE_BASE", "https://www.youtube.com").rstrip("/")
CHANNEL_ID = os.environ.get("YOUTUBE_CHANNEL_ID", "UCnCCTBOk6s1M7PFz2q1VZCQ")
SHORTS_PLAYLIST = "UUSH" + CHANNEL_ID[2:]
FEED_OVERRIDE = os.environ.get("YOUTUBE_FEED", "")
SHORTS_FEED = f"{BASE}/feeds/videos.xml?playlist_id={SHORTS_PLAYLIST}"
CHANNEL_FEED = f"{BASE}/feeds/videos.xml?channel_id={CHANNEL_ID}"
MAX_ITEMS = int(os.environ.get("MAX_ITEMS", "12"))
REQUEST_INTERVAL = float(os.environ.get("REQUEST_INTERVAL", "0.5"))
RETRY_WAIT = float(os.environ.get("RETRY_WAIT", "5"))
TIMEOUT = 30
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}
ATOM = "{http://www.w3.org/2005/Atom}"
YT = "{http://www.youtube.com/xml/schemas/2015}"
MEDIA = "{http://search.yahoo.com/mrss/}"


class FetchError(Exception):
    pass


def fetch(url):
    error = None
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
                return response.read()
        except Exception as e:  # noqa: BLE001 ネットワーク・HTTP エラーはまとめてやり直す
            error = e
        time.sleep(RETRY_WAIT * (attempt + 1))
    raise FetchError(f"{url} を読めません: {error}")


def text(el, tag):
    found = el.find(tag)
    return (found.text or "").strip() if found is not None else ""


def https_only(url):
    return url if url.startswith("https://") else ""


def read_feed(url):
    """RSS（Atom）を読んで、動画の一覧（新しい順）を返す"""
    try:
        root = ET.fromstring(fetch(url))
    except ET.ParseError as e:
        raise FetchError(f"{url} を XML として読めません: {e}") from e
    videos = []
    for entry in root.findall(ATOM + "entry"):
        video_id = text(entry, YT + "videoId")
        title = text(entry, ATOM + "title")
        if not video_id or not title:
            continue
        thumb = entry.find(f"{MEDIA}group/{MEDIA}thumbnail")
        image = https_only(thumb.get("url", "")) if thumb is not None else ""
        videos.append({
            "id": video_id,
            "title": title,
            # ショートの URL で開く（スマホでは YouTube アプリが開く）
            "url": f"https://www.youtube.com/shorts/{video_id}",
            "image": image or f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
            "date": text(entry, ATOM + "published"),
        })
    videos.sort(key=lambda v: v["date"], reverse=True)
    return videos


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def is_short(video_id):
    """ショートなら True、ショートでないと分かれば False、判定できなければ None"""
    request = urllib.request.Request(f"{BASE}/shorts/{video_id}", headers=HEADERS)
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=TIMEOUT) as response:
            return True if response.status == 200 else None
    except urllib.error.HTTPError as e:
        if e.code in (301, 302, 303, 307, 308):
            # ショートでない動画は /watch へ飛ばされる。同意画面などへの転送は判定に使わない
            return False if "/watch" in (e.headers.get("Location") or "") else None
        return None
    except Exception:  # noqa: BLE001
        return None


def only_shorts(videos):
    kept = []
    counts = {True: 0, False: 0, None: 0}
    for i, video in enumerate(videos):
        if i:
            time.sleep(REQUEST_INTERVAL)
        result = is_short(video["id"])
        counts[result] += 1
        label = {True: "ショート", False: "ショートではない（除く）", None: "判定できず（残す）"}[result]
        print(f"  {video['id']} {label}: {video['title']}")
        if result is not False:
            kept.append(video)
    print(f"ショート {counts[True]} 本、ショートではない {counts[False]} 本、判定できず {counts[None]} 本")
    return kept


def main():
    if len(sys.argv) != 2:
        sys.exit("使い方: python build_youtube_feed.py <出力JSON>")
    out = sys.argv[1]

    try:
        if FEED_OVERRIDE:
            videos = read_feed(FEED_OVERRIDE)
        else:
            try:
                videos = read_feed(SHORTS_FEED)
                print(f"ショートだけの RSS から {len(videos)} 本を読みました")
            except FetchError as e:
                print(f"ショートだけの RSS を読めませんでした（{e}）。チャンネル全体の RSS から探します")
                videos = only_shorts(read_feed(CHANNEL_FEED))
    except FetchError as e:
        sys.exit(f"取得失敗のため更新しません: {e}")

    videos = videos[:MAX_ITEMS]
    if not videos:
        sys.exit("取得失敗のため更新しません: 動画が0件です")

    data = {
        "channel": f"https://www.youtube.com/channel/{CHANNEL_ID}",
        "items": videos,
    }
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"{len(videos)} 件を書き出しました: {out}")


if __name__ == "__main__":
    main()
