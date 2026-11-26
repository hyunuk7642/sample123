#!/usr/bin/env python3
"""시작 화면 배경 그림에서 '불빛'만 뽑아 불빛 층 세 장을 만듭니다.

배경 그림(assets/christmas-atrium.webp)은 그대로 두고, 그 위에 이 층들을 겹쳐
은은하게 밝혔다 줄이면 건물 안의 불이 살아 있는 것처럼 보입니다(index.html 의 .intro-glow).

    a  창문·큰 조명          천천히 숨 쉬듯
    b  작은 전구(절반)        조금 빠르게 반짝
    c  작은 전구(나머지 절반)  b 와 엇갈려 반짝

준비:   pip install pillow numpy
사용법: python3 tools/atrium_glow.py
배경 그림을 바꿨을 때 다시 돌립니다. 가장자리의 금색 장식 테두리는 불빛에서 뺍니다.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "christmas-atrium.webp"
EDGE, CORNER = 64, 150          # 장식 테두리의 두께와 모서리 장식의 크기(픽셀)
CELL = 44                       # 이 크기의 칸마다 b / c 로 나눠, 이웃한 전구들이 엇갈려 반짝이게 함


def main():
    im = Image.open(SRC).convert("RGB")
    w, h = im.size
    a = np.asarray(im).astype(np.float32) / 255
    r, b = a[..., 0], a[..., 2]
    lum = a.max(axis=2)
    # 밝고 따뜻한 색만: 창밖의 푸른 눈 풍경이나 회색 벽은 빠짐
    e = np.clip((lum - .60) / .32, 0, 1) ** 1.4 * np.clip((r - b - .06) / .26, 0, 1)

    yy, xx = np.mgrid[0:h, 0:w]
    inside = (xx > EDGE) & (xx < w - EDGE) & (yy > EDGE) & (yy < h - EDGE)
    corner = ((xx < CORNER) | (xx > w - CORNER)) & ((yy < CORNER) | (yy > h - CORNER))
    e *= (inside & ~corner)

    ei = Image.fromarray((e * 255).astype(np.uint8))
    opened = ei.filter(ImageFilter.MinFilter(9)).filter(ImageFilter.MaxFilter(13)).filter(ImageFilter.GaussianBlur(2))
    big = np.minimum(e, np.asarray(opened).astype(np.float32) / 255 * 1.3).clip(0, 1)   # 넓은 빛
    small = (e - big).clip(0, 1)                                                        # 작은 전구

    rng = np.random.default_rng(7)                                                      # 같은 그림이면 늘 같은 결과
    grid = rng.random((h // CELL + 2, w // CELL + 2)) < .5
    half = np.kron(grid, np.ones((CELL, CELL)))[:h, :w].astype(np.float32)

    def layer(mask, core, halo, gain):
        """빛의 색은 원본 그대로, 또렷한 중심과 번진 테두리를 더해 만듦"""
        img = Image.fromarray((a * mask[..., None] * 255).clip(0, 255).astype(np.uint8))
        g = (np.asarray(img.filter(ImageFilter.GaussianBlur(core))).astype(np.float32) * .55
             + np.asarray(img.filter(ImageFilter.GaussianBlur(halo))).astype(np.float32) * .75)
        return Image.fromarray((g * gain).clip(0, 255).astype(np.uint8))

    layers = {"a": layer(big, 3, 18, 1.5), "b": layer(small * half, 1.5, 8, 2.6), "c": layer(small * (1 - half), 1.5, 8, 2.6)}
    for k, img in layers.items():
        out = ROOT / "assets" / f"atrium-glow-{k}.webp"
        img.resize((w // 2, h // 2), Image.LANCZOS).save(out, quality=70, method=6)     # 번진 빛이라 절반 크기로 충분
        print(f"{out.relative_to(ROOT)}  {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
