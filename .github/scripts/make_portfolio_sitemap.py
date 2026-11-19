"""ポートフォリオのサイトマップ（portfolio/sitemap.xml）を作る。

使い方（リポジトリのルートで）: python .github/scripts/make_portfolio_sitemap.py

- portfolio/ の中の index.html を全部拾って、公開URLの一覧にする（トップが先、あとは URL の順）。
- まだトップ・ナビからリンクしていない（公開前の）ページは NOT_YET に書いて、サイトマップに入れない。
  リンクして公開するとき、ここから外して作り直す。
- lastmod は付けない（ページの中身は JSON で変わるので、ファイルの日付は当てにならない）。
- ページを足したら、これを実行して sitemap.xml を作り直す。Search Console に1回登録すれば、あとは自動で読まれる。
- robots.txt は、ドメインの一番上（https://yoshida-std.github.io/robots.txt）に置かないと効かない。
  このリポジトリは /website/ の下なので、サイトマップの場所は Search Console で指定する。
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PORTFOLIO = ROOT / "portfolio"
SITE = "https://yoshida-std.github.io/website/portfolio/"
# サイトマップに入れないページ（portfolio/ からの相対パスの先頭。その下のページも入れない）
NOT_YET = ["famicom/"]


def main():
    urls = []
    for f in sorted(PORTFOLIO.rglob("index.html")):
        rel = f.parent.relative_to(PORTFOLIO).as_posix()
        if any(f"{rel}/".startswith(p) for p in NOT_YET):
            continue
        urls.append(SITE if rel == "." else f"{SITE}{rel}/")
    urls.sort(key=lambda u: (u != SITE, u))
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    lines += [f"  <url><loc>{u}</loc></url>" for u in urls]
    lines.append("</urlset>")
    (PORTFOLIO / "sitemap.xml").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"{len(urls)} ページ → portfolio/sitemap.xml")
    for u in urls:
        print(" ", u)


if __name__ == "__main__":
    main()
