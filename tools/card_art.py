#!/usr/bin/env python3
"""연구회 카드 그림 등록.

사용법:  python3 -I tools/card_art.py 08=그림.webp 01=다른그림.png ...
         (번호는 index.html 의 G 배열 순번 = 폼 드롭다운 순번, 1~20)

- 그림을 720x1080(2:3) WebP로 줄여 assets/cards/NN.webp 로 저장합니다.
- assets/cards 에 있는 번호를 모아 index.html 의 /* ART:BEGIN */ … /* ART:END */ 를 다시 씁니다.
- 인자 없이 실행하면 폴더에 있는 그림 기준으로 목록만 다시 씁니다.
"""
import pathlib, re, sys
from PIL import Image, ImageOps

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "cards"
HTML = ROOT / "index.html"

def main(args):
    OUT.mkdir(parents=True, exist_ok=True)
    for a in args:
        num, _, src = a.partition("=")
        n = int(num)
        if not 1 <= n <= 20 or not src: sys.exit(f"형식 오류: {a} (예: 08=그림.webp)")
        im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
        im = ImageOps.fit(im, (720, 1080), Image.LANCZOS, centering=(0.5, 0.5))   # 2:3 에 맞춰 가운데 기준으로 자름
        dst = OUT / f"{n:02d}.webp"
        im.save(dst, "WEBP", quality=82, method=6)
        print(f"{n:02d} ← {pathlib.Path(src).name}  ({dst.stat().st_size // 1024} KB)")
    ids = sorted(int(p.stem) for p in OUT.glob("[0-9][0-9].webp"))
    html = HTML.read_text(encoding="utf-8")
    a, b = "/* ART:BEGIN */", "/* ART:END */"
    i, j = html.index(a), html.index(b)
    HTML.write_text(html[:i] + a + f"const CARD_ART=new Set({ids});" + html[j:], encoding="utf-8")
    print("그림이 있는 연구회 번호:", ids)

if __name__ == "__main__":
    main(sys.argv[1:])
