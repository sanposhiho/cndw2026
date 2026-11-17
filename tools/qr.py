# QRコードをSVGに書き出す。生成には segno が必要（pip install segno）。
# 出力先を省略した場合は従来どおり assets/comments-qr.svg を更新する。
import argparse
from html import escape
from pathlib import Path
import segno

parser = argparse.ArgumentParser(description='QRコードをSVGで生成する')
parser.add_argument('url')
parser.add_argument('output', nargs='?', type=Path,
                    default=Path(__file__).resolve().parent.parent / 'assets/comments-qr.svg')
parser.add_argument('--label', default='コメント投稿ページのQRコード')
args = parser.parse_args()
url = args.url
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
# 四辺に4モジュールの余白を確保する。
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 {n + 8} {n + 8}" shape-rendering="crispEdges" role="img" aria-label="{escape(args.label, quote=True)}"><rect x="-4" y="-4" width="{n + 8}" height="{n + 8}" fill="#fff"/><path fill="#0E1A3A" d="{"".join(rects)}"/></svg>'
args.output.write_text(svg + '\n', encoding='utf-8')
print(f'{url} -> {args.output} ({n}x{n}, version {q.version})')
