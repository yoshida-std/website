"""LINE STORE の作者ページを巡回して sticker-catalog.json を作り直す。

使い方: python build_sticker_catalog.py <authors.json> <カタログJSON>

- authors.json の作者ごとに、スタンプと絵文字の一覧ページ（日本語）を全ページ巡回する。着せ替えは対象外。
- キーは商品ID。items 以外の設定（title, button, pixelArt, autoShow など）は既存のカタログから引き継ぐ。
- 取得に失敗したと思われるとき（ページを読めない、0件、前回より大きく減った）は書き換えずに異常終了する。
"""
import json
import os
import re
import sys
import time

import requests
from bs4 import BeautifulSoup

STORE = os.environ.get("LINE_STORE_BASE", "https://store.line.me")
# 負荷軽減のため、ページを読むたびに待つ秒数
INTERVAL = float(os.environ.get("REQUEST_INTERVAL", "1.2"))
# 前回の件数に対して、これより減ったら取得失敗とみなす
MIN_RATIO = float(os.environ.get("MIN_RATIO", "0.8"))
TIMEOUT = 30
MAX_PAGES = 100
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}
SHOPS = {"sticker": "stickershop", "emoji": "emojishop"}
PRODUCT_PATTERN = re.compile(r"/(stickershop|emojishop)/product/([^/?#]+)")
# 絵文字の一覧ページ内の /stickershop/emoji/ja/ID のようなリンク
EMOJI_PATTERN = re.compile(r"/emoji/[a-z]+/([^/?#]+)")


class FetchError(Exception):
    pass


def get_soup(url):
    """ページを取得する。最後のページより先は None を返し、それ以外の失敗は FetchError"""
    time.sleep(INTERVAL)
    for attempt in range(3):
        try:
            response = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        except requests.RequestException as e:
            error = e
        else:
            if response.status_code == 404:
                return None
            if response.status_code == 200:
                # charset の指定がないと requests は ISO-8859-1 で読むため
                if "charset" not in response.headers.get("Content-Type", ""):
                    response.encoding = "utf-8"
                return BeautifulSoup(response.text, "html.parser")
            error = f"ステータスコード {response.status_code}"
        time.sleep(5 * (attempt + 1))
    raise FetchError(f"{url} を読めません: {error}")


def clean(text):
    return (text or "").replace("\r", "").replace("\n", "").strip()


def parse_author_page(soup):
    """作者の一覧ページから (商品ID, アイテム) を取り出す。

    スタンプの作者ページにも絵文字が並ぶので、種類は巡回中のページではなく商品ごとに決める。
    """
    found = []
    for li in soup.select('li[data-test="author-item"]'):
        a_tag = li.select_one("a[href]")
        if not a_tag:
            continue
        href = a_tag["href"]
        match = PRODUCT_PATTERN.search(href)
        if match:
            item_id = match.group(2)
            is_emoji = match.group(1) == "emojishop"
        else:
            match = EMOJI_PATTERN.search(href)
            if not match:
                continue
            item_id = match.group(1)
            is_emoji = True
        # スタンプの商品IDは数字だけ、絵文字は英数字24桁
        item_type = "emoji" if is_emoji or not item_id.isdigit() else "sticker"

        # Premium バッジなどのアイコンを除いた本画像
        img_tag = None
        for img in li.select("img"):
            src = img.get("src", "").lower()
            cls = " ".join(img.get("class", [])).lower()
            if "premium" in src or "premium" in cls or "ico" in cls or "badge" in src:
                continue
            img_tag = img
            break

        title = ""
        name_tag = li.find(attrs={"data-test": "item-name"})
        if name_tag:
            title = clean(name_tag.text)
        if not title:
            for tag in li.find_all(attrs={"data-test": "author-item-title"}):
                if tag.find(class_=re.compile("Premium")) or "MdIcoPremium" in "".join(tag.get("class", [])):
                    continue
                text = clean(tag.text)
                if text and text != "Premium":
                    title = text
                    break
        if not title and img_tag is not None:
            alt = clean(img_tag.get("alt"))
            if alt != "Premium":
                title = alt

        item = {"type": item_type, "name": title, "url": product_url(item_type, item_id)}
        image = clean(img_tag.get("src")) if img_tag is not None else ""
        if image.startswith("https://"):
            item["image"] = image
        found.append((item_id, item))
    return found


def product_url(item_type, item_id):
    if item_type == "sticker":
        return f"https://line.me/S/sticker/{item_id}"
    return f"https://store.line.me/emojishop/product/{item_id}/ja"


def fetch_author_items(author_id, item_type):
    """作者の一覧を全ページ巡回する"""
    base = f"{STORE}/{SHOPS[item_type]}/author/{author_id}/ja"
    items = {}
    for page in range(1, MAX_PAGES + 1):
        url = f"{base}?page={page}&country=JP"
        soup = get_soup(url)
        if soup is None:
            if page == 1:
                raise FetchError(f"{url} が見つかりません（作者IDを確認してください）")
            break
        new = [(k, v) for k, v in parse_author_page(soup) if k not in items]
        if not new:
            break
        items.update(new)
    print(f"  {SHOPS[item_type]} の作者ページ (ID: {author_id}): {len(items)} 件")
    return items


def valid_id(value):
    s = str(value or "").strip()
    return s if s.lower() not in ("", "none", "null") else None


def main():
    if len(sys.argv) != 3:
        sys.exit("使い方: python build_sticker_catalog.py <authors.json> <カタログJSON>")
    authors_path, catalog_path = sys.argv[1], sys.argv[2]

    with open(authors_path, encoding="utf-8") as f:
        authors = json.load(f)
    catalog = {}
    if os.path.exists(catalog_path):
        with open(catalog_path, encoding="utf-8") as f:
            catalog = json.load(f)
    old_count = len(catalog.get("items") or {})

    items = {}
    try:
        for author in authors:
            print(f"作者: {author.get('author_name', '')}")
            for item_type, key in (("sticker", "sticker_id"), ("emoji", "emoji_id")):
                author_id = valid_id(author.get(key))
                if author_id:
                    for item_id, item in fetch_author_items(author_id, item_type).items():
                        items.setdefault(item_id, item)
    except FetchError as e:
        sys.exit(f"取得に失敗しました。カタログは更新しません: {e}")

    if not items:
        sys.exit("スタンプ・絵文字が1件も取得できませんでした。カタログは更新しません。")
    if len(items) < old_count * MIN_RATIO:
        sys.exit(f"件数が {old_count} 件から {len(items)} 件に減りました。取得失敗の可能性があるため更新しません。")

    catalog.setdefault("version", 1)
    catalog["items"] = items
    with open(catalog_path, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"カタログを更新しました: {old_count} 件 → {len(items)} 件")


if __name__ == "__main__":
    main()
