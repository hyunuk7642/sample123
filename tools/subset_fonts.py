#!/usr/bin/env python3
"""웹 글꼴을 저장소에 보관할 크기로 줄입니다 (구글 글꼴 서버 없이도 같은 글씨가 나오도록).

준비:   pip install fonttools brotli
        npm pack @fontsource/black-han-sans @fontsource/gowun-batang @fontsource/ibm-plex-sans-kr \
                 @fontsource/ibm-plex-mono @fontsource/nanum-pen-script   (받은 .tgz 를 한 폴더에 풉니다)
사용법: python3 tools/subset_fonts.py <패키지를 푼 폴더>

남기는 글자: 기본 영문·숫자·기호, 자주 쓰는 한글 2,350자(KS X 1001), 그리고 index.html 에 실제로 나오는 모든 글자.
카드 내용이나 문구를 고친 뒤 새 글자가 생기면 이 스크립트를 다시 돌리면 됩니다.
결과: assets/fonts/*.woff2 (index.html 의 @font-face 가 이 파일들을 가리킵니다)
"""
import pathlib, sys
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "fonts"
# (패키지 폴더, 원본 파일, 저장 이름[, True = 쇼릴·트레일러 전용이라 화면에 나오는 글자만 남김])
FACES = [
    ("black-han-sans", "black-han-sans-korean-400-normal.woff2", "black-han-sans-400.woff2", True),
    ("gowun-batang", "gowun-batang-korean-400-normal.woff2", "gowun-batang-400.woff2"),
    ("gowun-batang", "gowun-batang-korean-700-normal.woff2", "gowun-batang-700.woff2"),
    ("ibm-plex-sans-kr", "ibm-plex-sans-kr-korean-400-normal.woff2", "ibm-plex-sans-kr-400.woff2"),
    ("ibm-plex-sans-kr", "ibm-plex-sans-kr-korean-500-normal.woff2", "ibm-plex-sans-kr-500.woff2"),
    ("ibm-plex-sans-kr", "ibm-plex-sans-kr-korean-600-normal.woff2", "ibm-plex-sans-kr-600.woff2"),
    ("ibm-plex-sans-kr", "ibm-plex-sans-kr-korean-700-normal.woff2", "ibm-plex-sans-kr-700.woff2"),
    ("ibm-plex-mono", "ibm-plex-mono-latin-400-normal.woff2", "ibm-plex-mono-400.woff2"),
    ("ibm-plex-mono", "ibm-plex-mono-latin-500-normal.woff2", "ibm-plex-mono-500.woff2"),
    ("nanum-pen-script", "nanum-pen-script-korean-400-normal.woff2", "nanum-pen-script-400.woff2", True),
]

def wanted(page_only=False):
    chars = set(range(0x20, 0x7F)) | set(range(0xA0, 0x100)) | set(range(0x2010, 0x2028)) | {0x2026, 0x2190, 0x2192, 0x00D7, 0x00B7}
    for hi in ([] if page_only else range(0xB0, 0xC9)):   # KS X 1001 한글 2,350자
        for lo in range(0xA1, 0xFF):
            try: chars.add(ord(bytes([hi, lo]).decode("euc_kr")))
            except UnicodeDecodeError: pass
    chars |= {ord(c) for c in (ROOT / "index.html").read_text(encoding="utf-8")}
    return chars

def main(src):
    src = pathlib.Path(src); OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    page_hangul = {c for c in wanted(True) if 0xAC00 <= c <= 0xD7A3}
    for pkg, name, dst, *flag in FACES:
        keep = wanted(bool(flag and flag[0]))
        path = next(iter(sorted(src.glob(f"**/{name}"))), None)
        if not path: sys.exit(f"원본을 찾지 못함: {name}")
        opts = subset.Options(); opts.flavor = "woff2"; opts.layout_features = ["*"]; opts.name_IDs = ["*"]; opts.notdef_outline = True
        font = TTFont(str(path)); have = set(font.getBestCmap())
        sub = subset.Subsetter(opts); sub.populate(unicodes=sorted(keep & have)); sub.subset(font)
        font.flavor = "woff2"; font.save(str(OUT / dst))
        size = (OUT / dst).stat().st_size; total += size
        miss = sorted(page_hangul - have) if "mono" not in dst else []   # 고정폭 글꼴은 영문 전용
        print(f"{dst:30s} {size//1024:4d} KB  글자 {len(keep & have):5d}" + (f"  화면에 쓰이지만 이 글꼴에 없는 한글 {len(miss)}자: {''.join(map(chr, miss[:20]))}" if miss else ""))
    print(f"합계 {total/1024/1024:.2f} MB → {OUT.relative_to(ROOT)}")

if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(__doc__)
    main(sys.argv[1])
