"""ポートフォリオのアイコン一式を、ヘッダー画像のロボットから作る。

使い方（リポジトリのルートで）: python .github/scripts/make_portfolio_icons.py

- 元の絵: portfolio/img/header.jpg（青い地に白い線のロボット）。白い線だけを抜き出して、無地の青の上に置き直す。
- 出力: portfolio/img/icons/
    favicon.ico            タブ用（16・32・48px）
    icon-192.png           Android のホーム画面（manifest の icons）
    icon-512.png           同上（大きいほう）
    icon-maskable-512.png  Android が丸や角丸に切り抜いても欠けない版（絵を小さめにして余白を多く取る）
    apple-touch-icon.png   iPhone / iPad のホーム画面（180px。透明がないこと）
    robot.png              白い線だけのロボット（頭・肩つき、透明の背景）。OGP 画像の左側に使う
- Pillow が必要（pip install pillow）。
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "portfolio/img/header.jpg"
OUT = ROOT / "portfolio/img/icons"
BLUE = (19, 79, 125)  # ヘッダー画像の地の青（#134f7d）

# ヘッダー画像（1424x748）の中の、ロボットの範囲
ROBOT_BOX = (470, 120, 880, 600)   # 頭・肩つき
HEAD_BOTTOM = 445                  # これより下は首・肩（アイコンは頭だけ使う）
TEXT_X, TEXT_Y = 725, 445          # 「ヨシダスタジオ」の文字がある範囲（x≥725 かつ y≥445）は消す


def robot_cutout():
    """白い線だけのロボット（RGBA）。線の明るさ（赤の値）を、そのまま不透明度にする"""
    src = Image.open(SRC).convert("RGB")
    box = src.crop(ROBOT_BOX)
    red = box.getchannel("R")
    # 地の青（R≈20）はほぼ透明、線の白（R=255）は不透明。JPEG のざらつきは下側で切る
    alpha = red.point(lambda v: 0 if v < 38 else min(255, int((v - 38) * 255 / (225 - 38))))
    ax, ay = TEXT_X - ROBOT_BOX[0], TEXT_Y - ROBOT_BOX[1]
    alpha.paste(0, (ax, ay, box.width, box.height))
    out = Image.new("RGBA", box.size, (255, 255, 255, 0))
    out.putalpha(alpha)
    return out


def head_only(robot):
    """頭だけ（首の途中まで）の範囲に切り詰める"""
    cut = robot.crop((0, 0, robot.width, HEAD_BOTTOM - ROBOT_BOX[1]))
    return cut.crop(cut.getchannel("A").getbbox())


def thicken(img, grow, strength):
    """線を太くする。grow は広げる幅（px。奇数のフィルタに丸める）、strength は広げた分の濃さ（0〜1）"""
    alpha = img.getchannel("A")
    wide = alpha.filter(ImageFilter.MaxFilter(grow * 2 + 1)).point(lambda v: int(v * strength))
    out = img.copy()
    out.putalpha(ImageChops.lighter(alpha, wide))
    return out


def icon(head, size, head_width, bg=BLUE, grow=0, strength=0.0):
    """size 四方の、無地の青にロボットの頭を中央に置いた画像（透明なし）。grow・strength は線の太さ"""
    canvas = Image.new("RGBA", (size, size), bg + (255,))
    w = round(size * head_width)
    h = round(head.height * w / head.width)
    scaled = head.resize((w, h), Image.LANCZOS)
    if grow:
        scaled = thicken(scaled, grow, strength)
    canvas.alpha_composite(scaled, ((size - w) // 2, (size - h) // 2))
    return canvas.convert("RGB")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    robot = robot_cutout()
    robot.save(OUT / "robot.png", optimize=True)
    head = head_only(robot)

    # 小さい表示では線が細く見えるので、192px 以下は線を少し太くする
    icon(head, 512, 0.84, grow=1, strength=0.55).save(OUT / "icon-512.png", optimize=True)
    icon(head, 192, 0.84, grow=1, strength=0.7).save(OUT / "icon-192.png", optimize=True)
    # 丸や角丸に切り抜かれても頭が欠けないよう、中央の 80% の円の内側に収める
    icon(head, 512, 0.56, grow=1, strength=0.55).save(OUT / "icon-maskable-512.png", optimize=True)
    icon(head, 180, 0.84, grow=1, strength=0.7).save(OUT / "apple-touch-icon.png", optimize=True)
    # タブの 16px は、頭を枠いっぱいにして、線をかなり太くする
    master = icon(head, 256, 0.94, grow=4, strength=0.9)
    master.save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    for f in sorted(OUT.iterdir()):
        print(f"{f.name:24} {Image.open(f).size}  {f.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
