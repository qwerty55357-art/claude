# Скриншоты и сборка руководства

Руководство: исходник `docs/guide/guide.src.html`, картинки `docs/guide/img/*.jpg`; готовые файлы `docs/guide.html`
(самодостаточный, картинки внутри) и `docs/guide.pdf`.

Если интерфейс программы изменился, скриншоты можно переснять:

```
cd tools/guide_shots && mkdir -p img
export NODE_PATH=$(npm root -g)        # нужен playwright и chromium
for f in shots1 shots2 shots3 shots4 shots5 shots6 shots8; do node $f.js; done   # пишут PNG в img/
```

`demo.js` собирает демонстрационный проект через настоящий интерфейс, `lib.js` — выноски и съёмка по селектору.
Скрипты рассчитаны на запуск из папки `tools/guide_shots` и на `file:///home/user/claude/raskroy.html`
(при другом пути поправьте `lib.js`). Затем PNG нужно перевести в JPEG (качество ~86, ширина до 1700 px)
в `docs/guide/img/`, выполнить `python3 tools/build_guide.py` и `node tools/guide_shots/make_pdf.js`.
Карточки печати (`37_print_pages`) и фото-заглушка комнаты (`room.jpg`) строятся отдельно — см. историю коммита.
