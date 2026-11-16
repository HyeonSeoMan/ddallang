#!/bin/sh
# FD-18 (6) 파비콘 래스터화(2026-11-16, Google Chrome 157.0.8103.51 헤드리스, macOS). 새 의존성 없음(자르기·합성만 Pillow).
# 입력: docs/design/favicon-v2/{a-green-16,a-green-32,a-green}.svg  출력: 작업 폴더의 PNG 4개 → 마지막에 apps/web/public/으로 복사.
# 실행: 저장소 루트에서 `sh docs/design/v2-evidence/fe-v3/rasterize-favicon.sh <작업 폴더>`.
# 필요: Google Chrome, Pillow가 있는 python3(없으면 아래 `python3`을 `uv run --with pillow python`으로 바꾼다).
set -e
F="$1"            # 작업 폴더(저장소 밖, 미리 만들어 둔다)
D=docs/design/favicon-v2
cp $D/a-green-16.svg $F/16.svg; cp $D/a-green-32.svg $F/32.svg; cp $D/a-green.svg $F/64.svg
# 180: 64 그림에서 둥근 사각(rx=16)을 모서리 0 정사각형으로 바꾼다(iOS가 투명 모서리를 검정으로 채우지 않게).
sed 's/<rect width="64" height="64" rx="16" fill="#00875A"\/>/<rect width="64" height="64" fill="#00875A"\/>/' $D/a-green.svg > $F/180.svg
for n in 16 32 64 180; do
  printf '<!doctype html><html><head><style>html,body{margin:0;background:transparent}img{display:block;width:%spx;height:%spx}</style></head><body><img src="%s.svg"></body></html>' $n $n $n > $F/r$n.html
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-first-run \
    --allow-file-access-from-files --hide-scrollbars --force-device-scale-factor=1 \
    --default-background-color=00000000 --window-size=500,500 --screenshot=$F/shot$n.png file://$F/r$n.html
done
# 왼쪽 위 n×n을 잘라 저장. 180은 초록 바탕에 합성해 RGB(알파 없음)로 저장한다.
python3 - "$F" <<'PY'
import sys
from PIL import Image
F = sys.argv[1]
for n, name in ((16, "favicon-16.png"), (32, "favicon-32.png"), (64, "favicon-64.png"), (180, "apple-touch-icon.png")):
    im = Image.open(f"{F}/shot{n}.png").convert("RGBA").crop((0, 0, n, n))
    if n == 180:
        bg = Image.new("RGBA", (n, n), (0, 0x87, 0x5A, 255)); bg.alpha_composite(im); im = bg.convert("RGB")
    im.save(f"{F}/{name}", optimize=True)
PY
cp "$F/favicon-16.png" "$F/favicon-32.png" "$F/favicon-64.png" "$F/apple-touch-icon.png" apps/web/public/
