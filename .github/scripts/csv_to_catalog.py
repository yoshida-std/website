"""generate_list の line_items_latest.csv から sticker-catalog.json を作り直す。

使い方: python csv_to_catalog.py <CSVファイル> <カタログJSON>

- キーは商品ID。スタンプと絵文字だけを載せ、着せ替えは対象外。
- items 以外の設定（title, button, pixelArt, autoShow など）は既存のカタログから引き継ぐ。
- 取得に失敗したと思われるとき（0件、前回より大きく減った）は書き換えずに異常終了する。
"""
import csv
import json
import os
import re
import sys

# 前回の件数に対して、これより減ったら取得失敗とみなす
MIN_RATIO = float(os.environ.get("MIN_RATIO", "0.8"))

URL_PATTERN = re.compile(r"/(stickershop|emojishop)/product/([^/?#]+)")


def line_url(item_type, item_id):
    if item_type == "sticker":
        return f"https://line.me/S/sticker/{item_id}"
    return f"https://store.line.me/emojishop/product/{item_id}/ja"


def read_items(csv_path):
    """CSV を読み、商品ID をキーにした items を返す（CSV の並び順のまま）"""
    # 画像の Base64 列は既定の上限（128KB）を超えることがある
    csv.field_size_limit(sys.maxsize)
    items = {}
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            item_type = (row.get("type(sticker or emoji or theme)") or "").strip()
            if item_type not in ("sticker", "emoji"):
                continue
            match = URL_PATTERN.search(row.get("URL") or "")
            if not match:
                continue
            item_id = match.group(2)
            if item_id in items:
                continue
            name = (row.get("日本語タイトル") or "").strip() or (row.get("英字タイトル") or "").strip()
            item = {"type": item_type, "name": name, "url": line_url(item_type, item_id)}
            image = (row.get("画像URL") or "").strip()
            if image.startswith("https://"):
                item["image"] = image
            items[item_id] = item
    return items


def main():
    if len(sys.argv) != 3:
        sys.exit("使い方: python csv_to_catalog.py <CSVファイル> <カタログJSON>")
    csv_path, catalog_path = sys.argv[1], sys.argv[2]

    catalog = {}
    if os.path.exists(catalog_path):
        with open(catalog_path, encoding="utf-8") as f:
            catalog = json.load(f)
    old_count = len(catalog.get("items") or {})

    items = read_items(csv_path)
    if not items:
        sys.exit("CSV にスタンプ・絵文字が1件もありません。カタログは更新しません。")
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
