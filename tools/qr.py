# コメント投稿ページの QR コードを assets/comments-qr.svg に書き出す。
# 使い方: python3 tools/qr.py https://comments.showcase.cloudnativedays.jp/
# （segno が要る: pip install segno）。URL を変えたら、作り直してから node build.mjs
import sys, os, segno
url = sys.argv[1]
q = segno.make(url, error='m', micro=False)
n = q.symbol_size(border=0)[0]
rects = []
for y, row in enumerate(q.matrix):
    x = 0
    while x < n:
        if row[x]:
            x0 = x
            while x < n and row[x]: x += 1
            rects.append(f'M{x0} {y}h{x - x0}v1h-{x - x0}z')
        else:
            x += 1
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 {n + 4} {n + 4}" shape-rendering="crispEdges" role="img" aria-label="コメント投稿ページのQRコード"><rect x="-2" y="-2" width="{n + 4}" height="{n + 4}" fill="#fff"/><path fill="#0E1A3A" d="{"".join(rects)}"/></svg>'
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'comments-qr.svg')
open(out, 'w', encoding='utf-8').write(svg + '\n')
print(f'{url} -> assets/comments-qr.svg ({n}x{n}, version {q.version})')
