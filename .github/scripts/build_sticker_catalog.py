"""LINE STORE の作者ページを巡回して sticker-catalog.json を作り直す。

使い方: python build_sticker_catalog.py <authors.json> <カタログJSON>

- authors.json の作者ごとに、スタンプと絵文字の一覧ページ（日本語）を全ページ巡回する。着せ替えは対象外。
- キーは商品ID。items 以外の設定（title, button, pixelArt, autoShow など）は既存のカタログから引き継ぐ。
- 各商品に英語名 nameEn も付ける（英語版の作者ページ /en を同じ要領で巡回して、商品IDで突き合わせる）。
- 各商品に日本語の説明文 description も付ける（商品ページ /product/ID/ja を読む）。すでに持っている商品は読み直さず、新商品と未取得の商品だけ読む。全件巡回（FULL_RUN=1）のときは全商品を読み直す。
- 差分の判定: 日本語版の一覧の1ページ目（新しい順）だけを読み、カタログの先頭と同じなら「更新なし」で終わる。
  新しい商品・名前の変更があるとき、nameEn・description がまだ無いとき、環境変数 FULL_RUN=1 のときは全ページ巡回する（週1回の全件巡回で、古い商品の変更・販売終了も拾う）。
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
    return f"https://line.me/S/emoji/?id={item_id}"


def fetch_author_items(author_id, item_type, lang="ja", first_page_only=False):
    """作者の一覧を全ページ巡回する（first_page_only なら1ページ目だけ）"""
    base = f"{STORE}/{SHOPS[item_type]}/author/{author_id}/{lang}"
    items = {}
    for page in range(1, (1 if first_page_only else MAX_PAGES) + 1):
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
    print(f"  {SHOPS[item_type]} {lang} の作者ページ (ID: {author_id}): {len(items)} 件")
    return items


def fetch_description(item_id, item_type):
    """商品ページ（日本語）から説明文を取り出す。ページが無ければ空文字"""
    soup = get_soup(f"{STORE}/{SHOPS[item_type]}/product/{item_id}/ja?country=JP")
    if soup is None:
        return ""
    # ページ内の説明欄（data-test が description で終わるもの）を優先し、無ければ og:description
    for tag in soup.find_all(attrs={"data-test": re.compile("description$")}):
        text = clean_multiline(tag.get_text("\n"))
        if text:
            return text
    meta = soup.find("meta", attrs={"property": "og:description"})
    return clean_multiline(meta.get("content")) if meta else ""


def clean_multiline(text):
    lines = [line.strip() for line in (text or "").replace("\r", "").split("\n")]
    return "\n".join(line for line in lines if line).strip()


def is_unchanged(authors, old_items):
    """日本語版の1ページ目が、カタログの内容・並びと同じか調べる（同じなら更新不要）"""
    if not old_items or any("nameEn" not in v or "description" not in v for v in old_items.values()):
        return False
    old_ids = list(old_items)
    for author in authors:
        for item_type, key in (("sticker", "sticker_id"), ("emoji", "emoji_id")):
            author_id = valid_id(author.get(key))
            if not author_id:
                continue
            page = fetch_author_items(author_id, item_type, "ja", first_page_only=True)
            last = -1
            for item_id, item in page.items():
                old = old_items.get(item_id)
                if not old or old.get("name") != item["name"] or old.get("type") != item["type"]:
                    return False
                pos = old_ids.index(item_id)
                if pos <= last:
                    return False
                last = pos
    return True


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
        if os.environ.get("FULL_RUN") != "1" and is_unchanged(authors, catalog.get("items") or {}):
            print("1ページ目に変更はありません。カタログは更新しません。")
            return
        for author in authors:
            print(f"作者: {author.get('author_name', '')}")
            for item_type, key in (("sticker", "sticker_id"), ("emoji", "emoji_id")):
                author_id = valid_id(author.get(key))
                if author_id:
                    for item_id, item in fetch_author_items(author_id, item_type).items():
                        items.setdefault(item_id, item)
                    # 英語名（日本語版にある商品だけ付ける）
                    for item_id, en in fetch_author_items(author_id, item_type, "en").items():
                        if item_id in items and en["name"]:
                            items[item_id]["nameEn"] = en["name"]
        full = os.environ.get("FULL_RUN") == "1"
        old_items = catalog.get("items") or {}
        for item_id, item in items.items():
            old = old_items.get(item_id) or {}
            if "description" in old and not full:
                item["description"] = old["description"]
                continue
            try:
                item["description"] = fetch_description(item_id, item["type"])
            except FetchError as e:
                # 1商品の失敗では止めない。説明文は付けず、次回また読む
                print(f"  説明文を読めませんでした（ID: {item_id}）: {e}")
                if "description" in old:
                    item["description"] = old["description"]
        for item in items.values():
            item.setdefault("nameEn", "")  # 英語名が無い商品も印を付ける（差分判定のため）
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
