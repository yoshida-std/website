"""YouTube のショート動画の RSS を読んで、ポートフォリオ用の動画一覧 JSON を作り直す。

使い方: python build_youtube_feed.py <出力JSON>

- 読むのは、チャンネルの「ショートだけの再生リスト」の RSS。チャンネル ID（UC…）の UC を UUSH に
  変えると、そのチャンネルのショートだけの再生リスト ID になる（YouTube の非公式な仕組み）。
  別の RSS を読みたいときは環境変数 YOUTUBE_FEED に URL を入れる。
- チャンネル ID は環境変数 YOUTUBE_CHANNEL_ID（省略時は ヨシダスタジオ のチャンネル）。
- 新しい順に最大 MAX_ITEMS 件（環境変数、省略時 12）を書き出す。
- 取得に失敗したとき（読めない、XML として読めない、0件）は書き換えずに異常終了する。
"""
import json
import os
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET

CHANNEL_ID = os.environ.get("YOUTUBE_CHANNEL_ID", "UCnCCTBOk6s1M7PFz2q1VZCQ")
SHORTS_PLAYLIST = "UUSH" + CHANNEL_ID[2:]
FEED = os.environ.get(
    "YOUTUBE_FEED",
    f"https://www.youtube.com/feeds/videos.xml?playlist_id={SHORTS_PLAYLIST}",
)
MAX_ITEMS = int(os.environ.get("MAX_ITEMS", "12"))
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
        time.sleep(5 * (attempt + 1))
    raise FetchError(f"{url} を読めません: {error}")


def text(el, tag):
    found = el.find(tag)
    return (found.text or "").strip() if found is not None else ""


def https_only(url):
    return url if url.startswith("https://") else ""


def main():
    if len(sys.argv) != 2:
        sys.exit("使い方: python build_youtube_feed.py <出力JSON>")
    out = sys.argv[1]

    try:
        root = ET.fromstring(fetch(FEED))
    except (FetchError, ET.ParseError) as e:
        sys.exit(f"取得失敗のため更新しません: {e}")

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
            # ショートだけの一覧なので、ショートの URL で開く（スマホでは YouTube アプリが開く）
            "url": f"https://www.youtube.com/shorts/{video_id}",
            "image": image or f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
            "date": text(entry, ATOM + "published"),
        })
    videos.sort(key=lambda v: v["date"], reverse=True)
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
