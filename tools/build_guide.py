#!/usr/bin/env python3
"""Собирает самодостаточные docs/guide.html и docs/generation.html: подставляет картинки <папка>/img/*.jpg
в <имя>.src.html как data-URI. Запуск: python3 tools/build_guide.py   (PDF: tools/guide_shots/make_pdf.js)"""
import base64, re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
for srcf in sorted((root / 'docs').glob('*/*.src.html')):
    d = srcf.parent
    def inline(m, d=d):
        return 'src="data:image/jpeg;base64,' + base64.b64encode((d / m.group(1)).read_bytes()).decode() + '"'
    out = re.sub(r'src="(img/[^"]+\.jpg)"', inline, srcf.read_text(encoding='utf-8'))
    dst = root / 'docs' / (srcf.name[:-len('.src.html')] + '.html')
    dst.write_text(out, encoding='utf-8')
    print(dst.relative_to(root), len(out) // 1024, 'KB')
