"""note の RSS を読んで、ポートフォリオ用の記事一覧 JSON を作り直す。

使い方: python build_note_feed.py <出力JSON>

- RSS の URL は環境変数 NOTE_RSS（省略時は https://note.com/yoshida_std/rss）。
- 新しい順に最大 MAX_ITEMS 件（環境変数、省略時 10）を書き出す。
- 取得に失敗したとき（読めない、XML として読めない、0件）は書き換えずに異常終了する。
"""
import email.utils
import html
import json
import os
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET

RSS = os.environ.get("NOTE_RSS", "https://note.com/yoshida_std/rss")
MAX_ITEMS = int(os.environ.get("MAX_ITEMS", "10"))
TIMEOUT = 30
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}
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


def thumbnail(item):
    # note は <media:thumbnail>URL</media:thumbnail>。url 属性の形にも対応しておく
    for tag in (MEDIA + "thumbnail", MEDIA + "content"):
        found = item.find(tag)
        if found is not None:
            url = (found.get("url") or found.text or "").strip()
            if url:
                return url
    enclosure = item.find("enclosure")
    if enclosure is not None and (enclosure.get("type") or "").startswith("image/"):
        return enclosure.get("url", "")
    return ""


def summary(description, limit=100):
    plain = html.unescape(re.sub(r"<[^>]+>", " ", description))
    plain = re.sub(r"\s+", " ", plain).strip()
    plain = re.sub(r"\s*続きをみる$", "", plain)
    return plain if len(plain) <= limit else plain[:limit].rstrip() + "…"


def iso_date(value):
    try:
        return email.utils.parsedate_to_datetime(value).isoformat()
    except (TypeError, ValueError):
        return ""


def https_only(url):
    return url if url.startswith("https://") else ""


def main():
    if len(sys.argv) != 2:
        sys.exit("使い方: python build_note_feed.py <出力JSON>")
    out = sys.argv[1]

    try:
        root = ET.fromstring(fetch(RSS))
    except (FetchError, ET.ParseError) as e:
        sys.exit(f"取得失敗のため更新しません: {e}")

    channel = root.find("channel")
    if channel is None:
        sys.exit("取得失敗のため更新しません: RSS に channel がありません")

    articles = []
    for item in channel.findall("item"):
        link = https_only(text(item, "link"))
        title = text(item, "title")
        if not link or not title:
            continue
        articles.append({
            "title": title,
            "url": link,
            "image": https_only(thumbnail(item)),
            "date": iso_date(text(item, "pubDate")),
            "summary": summary(text(item, "description")),
        })
    articles.sort(key=lambda a: a["date"], reverse=True)
    articles = articles[:MAX_ITEMS]

    if not articles:
        sys.exit("取得失敗のため更新しません: 記事が0件です")

    data = {
        "profile": https_only(text(channel, "link")) or "https://note.com/yoshida_std",
        "items": articles,
    }
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"{len(articles)} 件を書き出しました: {out}")


if __name__ == "__main__":
    main()
