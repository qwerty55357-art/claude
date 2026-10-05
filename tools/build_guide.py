#!/usr/bin/env python3
"""Собирает самодостаточный docs/guide.html: подставляет картинки docs/guide/img/*.jpg в guide.src.html как data-URI.
Запуск: python3 tools/build_guide.py   (PDF: см. tools/guide_shots/README.md)"""
import base64, re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / 'docs/guide/guide.src.html').read_text(encoding='utf-8')
def inline(m):
    f = root / 'docs/guide' / m.group(1)
    return 'src="data:image/jpeg;base64,' + base64.b64encode(f.read_bytes()).decode() + '"'
out = re.sub(r'src="(img/[^"]+\.jpg)"', inline, src)
(root / 'docs/guide.html').write_text(out, encoding='utf-8')
print('docs/guide.html', len(out) // 1024, 'KB')
