#!/bin/bash
# Полный прогон автотестов. Запуск: NODE_PATH=$(npm root -g) RASKROY_OLD=/путь/к/эталону.html bash tests/run_all.sh
cd "$(dirname "$0")/.."
f=0
t(){ echo "== $*"; env -u RASKROY_OLD "$@" 2>&1 | grep -v "WebGL\|GroupMarker\|CERT\|Failed to load" | tail -${TAIL:-3}; [ ${PIPESTATUS[0]} -eq 0 ] || f=$((f+1)); }
# эталонная версия нужна только дифф-тесту ядра (остальные тесты, например catalog_compat, сверяются с эталоном без заполнений)
if [ -n "$RASKROY_OLD" ]; then echo "== core_diff"; NOFILL=1 node tests/core_diff.js 2>&1 | grep -v "WebGL\|GroupMarker\|CERT" | tail -2; fi
t node tests/core_audit.js
AUDIT_N=3000 t node tests/core_audit_mats.js
for x in free_enable_equiv hseams_free vseams_free prompt_rules viz_smoke viz_mockup catalog_prompt catalog_compat catalog_ui slat_fill shelf_sticky shelf_reuse shelf_back cutmap_cols print_clean price_mats corrupt_files photo_inputs; do t node tests/$x.js; done
CONS_N=15 t node tests/consistency.js
t node tests/ui_matrix.js
t node tests/catalog_all.js
echo; [ $f -eq 0 ] && echo "ВСЁ ЗЕЛЁНОЕ" || echo "ПРОВАЛЕНО НАБОРОВ: $f"; exit $f
