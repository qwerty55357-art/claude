#!/usr/bin/env python3
"""Сборка каталога расцветок «Панда Декор» в raskroy.html.

Берёт папку (или .zip) с фото образцов, где ИМЯ ФАЙЛА = АРТИКУЛ (рейки — с префиксом «Рейка »),
и вписывает блок данных между маркерами <!--[КАТАЛОГ:НАЧАЛО]--> … <!--[КАТАЛОГ:КОНЕЦ]--> в raskroy.html.

    python3 tools/build_catalog.py <папка-или-zip> [raskroy.html]

Нужны Pillow и numpy. Блок генерируется целиком — руками его не править: описания, признаки и
условные цвета схемы живут в таблицах ниже, а правка каталога = правка таблиц + повторный запуск.
Новинка без записи в таблице попадёт в каталог с пометкой «без описания» (см. предупреждения в выводе).
"""
import base64, io, json, os, re, sys, zipfile, tempfile
import numpy as np
from PIL import Image

VERSION = '2026-10-05.1'
IMG_SIDE = 512          # сторона миниатюры, px (решение пользователя)
JPEG_Q = 72
SCALE_MM_PX = 0.25      # ≈ 0,25 мм/px: съёмка с 30 см, кадр ≈ 25–35 см (см. catalogs/INDEX.md)

TYPE_LABEL = {
    'bamboo29': 'Бамбуковая панель 2900×1150',
    'slat': 'Реечная панель 2900×150',
    'marble': 'Гибкий мрамор 2800×1200',
}
TYPE_ORDER = ['bamboo29', 'slat', 'marble']

# имя файла → артикул, если написание в каталоге другое (решение пользователя: «как в каталоге»)
ALIASES = {'J0035': 'J035', 'YK105': 'YK-105', '741-A235': '741-A295', '88205-4': '80205-4', 'P 74-2': 'P74-2'}

# условные цвета СХЕМЫ (по типу; расцветка берёт цвет по порядку в каталоге) — реальный цвет образца
# в схему не идёт, он только в промпте и миниатюрах (решение пользователя)
PALETTE = {
    'bamboo29': ['#D98C3F', '#C9704A', '#B7A83A', '#E0B84D', '#A8864A', '#D4795F', '#BFAE6C', '#CC8F6B', '#B59B3C', '#DE9E58', '#C2825A', '#E3A857'],
    'slat':     ['#7DB36B', '#B4C97A', '#6FAE8A', '#8FCF9F', '#A5B86A', '#5FA37A', '#88BE5F', '#B0CC8E', '#74A862', '#99C7A8', '#C4D17A', '#6C9F59'],
    'marble':   ['#7FA7C9', '#8FB3D9', '#7D9DD4', '#95AFC6', '#6F8FB8', '#9DB8D6', '#5E86B5', '#86A3C8'],
}
# бирюзовые/голубо-зелёные тона (оттенок 165–205°) в палитры не входят: бирюзовый на схеме = LED-лента

# описания и признаки: ключ — артикул (по каталогу). g: 'long' — рисунок вдоль длинной стороны,
# 'chev' — «ёлочка», None — нет направления; s — блёстки; fin — блеск (только если он известен)
B = 'bamboo29'
META = {
    (B, '8189'): dict(d='дерево светло-коричневое, мелкое прямое продольное волокно', g='long'),
    (B, '8190'): dict(d='дерево серо-коричневое (тауп), прямое продольное волокно', g='long'),
    (B, 'J035'): dict(d='дерево медово-золотистое, тонкое прямое волокно', g='long'),
    (B, 'P3'): dict(d='дерево серо-бежевое, прямое продольное волокно', g='long'),
    (B, 'V3'): dict(d='дерево серо-бежевое, рисунок «ёлочка» (шеврон, V-образный набор)', g='chev'),
    (B, 'P5'): dict(d='дерево янтарно-коричневое, прямое продольное волокно', g='long'),
    (B, 'V5'): dict(d='дерево янтарно-коричневое, рисунок «ёлочка» (шеврон)', g='chev'),
    (B, 'P6'): dict(d='тёмный орех, прямое продольное волокно', g='long'),
    (B, 'V6'): dict(d='тёмный орех, рисунок «ёлочка» (шеврон)', g='chev'),
    (B, 'P8'): dict(d='орех среднего тона, прямое продольное волокно', g='long'),
    (B, 'V8'): dict(d='орех среднего тона, рисунок «ёлочка» (шеврон)', g='chev'),
    (B, '4033-6'): dict(d='светлый дуб, выраженное волокно и сучки', g='long'),
    (B, '5139'): dict(d='тёмный орех, тёмно-коричневое дерево', g='long'),
    (B, 'YK-105'): dict(d='золотисто-бежевый дуб, живой рисунок волокон', g='long'),
    (B, 'J0077'): dict(d='гладкая матовая штукатурка/камень, светло-серый с сиреневым оттенком, едва заметные разводы', g=None),
    (B, '8069'): dict(d='светлая серо-бежевая ткань, мелкое тканое плетение', g=None),
    (B, '8070'): dict(d='светлая серо-белая ткань, тканое плетение', g=None),
    (B, 'J0018'): dict(d='серо-бежевая ткань, тканое плетение', g=None),
    (B, 'J0021'): dict(d='бежевая ткань, крупное тканое плетение', g=None),
    (B, '8087'): dict(d='серая поверхность с мелким диагональным штрихом (шёлк/браш «ёлочкой»)', g=None),
    (B, '5001'): dict(d='светлая перламутровая, белая с лёгким сиренево-серым оттенком, мелкие блёстки', g=None, s=True, fin='блестит при освещении'),
    (B, 'DFN-021'): dict(d='серая матовая с мелкими блёстками-искрами', g=None, s=True),
    (B, '5003'): dict(d='серо-бежевая с мелкими блёстками', g=None, s=True),
    (B, '87031'): dict(d='мятно-зелёная мелкозернистая матовая', g=None),
    (B, '741-A295'): dict(d='светлая серо-сиреневая матовая, структура «под шёлкопряд»', g=None),
    (B, '5160'): dict(d='светлая серо-бежевая, фактура камня с тонкими светлыми прожилками', g=None),
    (B, '8048'): dict(d='однотонный мокко, матовая', g=None),
    (B, '8046'): dict(d='молочно-бежевая однотонная матовая', g=None),
    (B, '8055'): dict(d='серый графит, однотонная матовая', g=None),
    (B, '8053'): dict(d='бежево-серая (тауп), однотонная матовая', g=None),
    (B, '8033'): dict(d='металл мокко-серый, тонкий браш (шлифовка)', g=None, fin='сатиновый блеск'),
    (B, 'Водная гладь'): dict(d='зеркальная хромированная поверхность с тиснением «водная рябь», сильные отражения', g=None, fin='зеркальный блеск'),
    (B, 'S006'): dict(d='чёрная матовая с мелкой искрой', g=None, s=True),
    (B, '8270'): dict(d='белый мрамор с тёмными прожилками', g=None),
    (B, '0713-4'): dict(d='тёмный сланец: тёмно-серая рельефная каменная поверхность со светлыми прожилками', g=None),
    (B, '512701'): dict(d='белый каррарский мрамор с серыми прожилками', g=None),
    (B, '8865-2'): dict(d='серая поверхность с диагональными белыми прожилками', g=None),
    (B, '100028-2'): dict(d='светло-серая, вертикальное рифление (узкие продольные рёбра)', g='long'),
    (B, 'P74-2'): dict(d='светлый травертин: бело-бежево-серые вертикальные полосы', g='long'),
    ('slat', '4033-6'): dict(d='светлый дуб, выраженное волокно', g='long'),
    ('slat', '5139'): dict(d='тёмный орех, тёмно-коричневое дерево', g='long'),
    ('slat', '5160'): dict(d='светлая серо-белая, фактура камня с тонкими светлыми прожилками', g=None),
    ('slat', '8046'): dict(d='молочно-бежевая однотонная матовая', g=None),
    ('slat', '8048'): dict(d='мокко, однотонная матовая', g=None),
    ('slat', '8055'): dict(d='серый графит, однотонная матовая', g=None),
    ('slat', '8069'): dict(d='серо-бежевая ткань, тканое плетение', g=None),
    ('slat', '8070'): dict(d='серая ткань, тканое плетение; рельеф — прямоугольные зубья', g=None, relief='tooth'),
    ('slat', '8070 волна'): dict(d='светло-серая ткань, тканое плетение; рельеф — волна (острые выступы и плавные переходы)', g=None, relief='wave'),
    ('slat', '8189'): dict(d='дерево светло-коричневое, прямое волокно', g='long'),
    ('slat', '8190'): dict(d='дерево серо-коричневое (тауп), прямое волокно', g='long'),
    ('slat', '87031'): dict(d='мятно-зелёная мелкозернистая матовая', g=None),
    ('slat', 'DFN-021'): dict(d='светлая серо-белая с мелкими искрами', g=None, s=True),
    ('slat', 'J0018'): dict(d='серо-бежевая ткань, тканое плетение', g=None),
    ('slat', 'J035'): dict(d='дерево медово-оранжевое, тонкое прямое волокно', g='long'),
    ('slat', 'J0078'): dict(d='светло-бежевый шпон-подобный рисунок с мелкими сучками', g='long'),
    ('slat', 'P3 и V3'): dict(d='дерево серо-бежевое, прямое волокно', g='long'),
    ('slat', 'P5 и V5'): dict(d='дерево янтарно-коричневое, прямое волокно', g='long'),
    ('slat', 'P6 и V6'): dict(d='тёмный орех, прямое волокно', g='long'),
    ('slat', 'P8 и V8'): dict(d='орех среднего тона, прямое волокно', g='long'),
    ('slat', 'YK-105'): dict(d='золотисто-бежевый дуб, живой рисунок волокон', g='long'),
    ('marble', '044'): dict(d='светлый оникс, молочно-серые полупрозрачные разводы с золотыми прожилками', g=None),
    ('marble', '206-01-15'): dict(d='светло-серый камень, мелкие неровности, малоконтрастный', g=None),
    ('marble', '419-20'): dict(d='серый камень с вертикальной слоистостью (травертин), мелкие поры', g='long'),
    ('marble', '8226-1'): dict(d='серо-голубой мрамор с тонкими тёмными прожилками', g=None),
    ('marble', '8281'): dict(d='тёмный контрастный камень: серо-чёрные и бежевые пятна, крупный хаотичный рисунок', g=None),
    ('marble', '88-57-3'): dict(d='серый камень с тонкой сеткой светлых прожилок', g=None),
    ('marble', '80205-4'): dict(d='серо-бетонный камень с мелкими порами', g=None),
    ('marble', '8850-2'): dict(d='серо-коричневый камень с облачным рисунком', g=None),
}

# скалы — не расцветки, а рельефные образцы типа (полиуретан, белый гипсовый)
ROCK_REFS = {
    'Большая скала': ('rockL', 'белый гипсовый грубый скальный рельеф, глубина до 80 мм (образец — рельеф при боковом свете)'),
    'Маленькая скала': ('rockS', 'белый гипсовый скальный рельеф, глубина до 35 мм (образец — рельеф при боковом свете)'),
}


def slug(article):
    s = article.lower().replace(' и ', '_').replace(' волна', '_wave').replace(' ', '_')
    return re.sub(r'[^0-9a-zа-я_\-]', '', s)


def js_str(s):
    return json.dumps(s, ensure_ascii=False)


def swatch(path):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    side = int(min(w, h) * 0.94)        # срезаем рамки/подложку по краям
    x0, y0 = (w - side) // 2, (h - side) // 2
    im = im.crop((x0, y0, x0 + side, y0 + side)).resize((IMG_SIDE, IMG_SIDE), Image.LANCZOS)
    a = np.asarray(im).astype(float)
    c = a[int(IMG_SIDE * .2):int(IMG_SIDE * .8), int(IMG_SIDE * .2):int(IMG_SIDE * .8)].reshape(-1, 3)
    lum = c.mean(1)
    keep = c[lum >= np.percentile(lum, 35)]            # без теней между рёбрами реек
    hexc = '#%02x%02x%02x' % tuple(int(round(v)) for v in keep.mean(0))
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=JPEG_Q, optimize=True, progressive=True, subsampling=2)
    return hexc, base64.b64encode(buf.getvalue()).decode(), len(buf.getvalue())


def main():
    src = sys.argv[1]
    html_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', 'raskroy.html')
    tmp = None
    if src.lower().endswith('.zip'):
        tmp = tempfile.mkdtemp()
        zipfile.ZipFile(src).extractall(tmp)
        src = tmp
    files = []
    for root, _, names in os.walk(src):
        for n in names:
            if n.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
                files.append(os.path.join(root, n))
    entries = {t: [] for t in TYPE_ORDER}
    refs, warn, total = {}, [], 0
    for path in sorted(files, key=lambda p: os.path.basename(p)):
        stem = os.path.splitext(os.path.basename(path))[0].strip()
        if stem in ROCK_REFS:
            tid, desc = ROCK_REFS[stem]
            hexc, b64, n = swatch(path); total += n
            refs[tid] = dict(name=stem, d=desc, img=b64, c=hexc)
            continue
        typ = 'slat' if stem.startswith('Рейка ') else 'bamboo29'
        art = stem[len('Рейка '):].strip() if typ == 'slat' else stem
        art = ALIASES.get(art, art)
        # мрамор определяем по таблице (по имени файла его не отличить от бамбука)
        if (typ, art) not in META and ('marble', art) in META:
            typ = 'marble'
        meta = META.get((typ, art))
        if meta is None:
            warn.append(f'нет описания для {typ}:{art} ({os.path.basename(path)}) — добавьте в META')
            meta = dict(d='без описания (новинка)', g=None)
        hexc, b64, n = swatch(path); total += n
        entries[typ].append(dict(art=art, meta=meta, c=hexc, img=b64, n=n))
    # порядок: как в таблице META (стабильно), новинки в конце по имени
    order = {k: i for i, k in enumerate(META)}
    out = []
    for typ in TYPE_ORDER:
        items = sorted(entries[typ], key=lambda e: (order.get((typ, e['art']), 10**6), e['art']))
        pal = PALETTE[typ]
        js_items = []
        for i, e in enumerate(items):
            m = e['meta']
            rec = {'id': f'{typ}:{slug(e["art"])}', 'a': e['art'], 'c': e['c'], 'k': pal[i % len(pal)], 'd': m['d']}
            if m.get('g'): rec['g'] = m['g']
            if m.get('s'): rec['s'] = 1
            if m.get('fin'): rec['fin'] = m['fin']
            if m.get('relief'): rec['rel'] = m['relief']
            js_items.append(rec)
        out.append((typ, js_items, items))
    # ---- сборка текста блока ----
    lines = ['<!--[КАТАЛОГ:НАЧАЛО] блок сгенерирован tools/build_catalog.py — руками не править -->', '<script id="catalog-data">',
             f'const CATALOG={{version:{js_str(VERSION)},scale:{SCALE_MM_PX},types:{{']
    for typ, js_items, items in out:
        lines.append(f' {typ}:{{label:{js_str(TYPE_LABEL[typ])},items:[')
        lines += ['  ' + json.dumps(r, ensure_ascii=False) + ',' for r in js_items]
        lines.append(' ]},')
    lines.append('},refs:{')
    for tid, r in refs.items():
        lines.append(f' {tid}:{json.dumps({"name": r["name"], "d": r["d"], "c": r["c"]}, ensure_ascii=False)},')
    lines.append('}};')
    lines.append('const CATALOG_IMG={')
    for typ, js_items, items in out:
        for rec, e in zip(js_items, items):
            lines.append(f'{js_str(rec["id"])}:"data:image/jpeg;base64,{e["img"]}",')
    for tid, r in refs.items():
        lines.append(f'{js_str(tid)}:"data:image/jpeg;base64,{r["img"]}",')
    lines.append('};')
    lines.append('</script>')
    lines.append('<!--[КАТАЛОГ:КОНЕЦ]-->')
    block = '\n'.join(lines) + '\n'
    html = open(html_path, encoding='utf-8').read()
    pat = re.compile(r'<!--\[КАТАЛОГ:НАЧАЛО\].*?<!--\[КАТАЛОГ:КОНЕЦ\]-->\n?', re.S)
    if pat.search(html):
        html = pat.sub(lambda m: block, html, count=1)
    else:
        # первый «большой» <script> проекта — тот, что начинается комментарием «АРХИТЕКТУРА ФАЙЛА»
        i = html.index('<script>\n/* ====')
        html = html[:i] + block + html[i:]
    open(html_path, 'w', encoding='utf-8').write(html)
    cnt = {t: len(i) for t, i, _ in out}
    print('расцветок:', cnt, '| скалы:', list(refs), '| миниатюры: %.1f КБ (base64 ≈ %.1f КБ)' % (total / 1024, total * 4 / 3 / 1024))
    for w in warn: print('ПРЕДУПРЕЖДЕНИЕ:', w)


if __name__ == '__main__':
    main()
