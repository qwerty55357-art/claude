// Материал детали радиусного угла: выбор в меню угла (компас), отдельный пул листов этого материала (карта, верстак, смета),
// цвет/подпись на развёртке угла, 3D, откат на обычный профиль для узкой рейки, сохранение/открытие/отмена, потерянная расцветка,
// задание для нейросети (corners[].material, роль материала). Запуск: NODE_PATH=$(npm root -g) node tests/corner_mat.js
const {chromium}=require('playwright'); const path=require('path');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
const IN_PAGE=require('./lib/inpage.js');
let fails=0; const ok=(c,w)=>{ if(!c){ fails++; console.log('✗',w); } else console.log('✓',w); };
(async()=>{
  const b=await chromium.launch({executablePath:EXE}); const p=await b.newPage({viewport:{width:1500,height:1300}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160))); p.on('dialog',async d=>{ errs.push('диалог '+d.message().slice(0,80)); await d.accept(); });
  await p.goto(HTML); await p.waitForTimeout(500); await p.evaluate(IN_PAGE);
  await p.evaluate(()=>{ window.__rich(); walls[1].edges.right='cap'; run(); }); await p.waitForTimeout(900);   // у «Стены 2» справа не LED — иначе деталь угла не нужна
  const state=()=>p.evaluate(()=>({mat:(cornerLinks.find(c=>c.kind==='radius')||{}).mat||null,
    main:LAST.R.sheets.flatMap(s=>s.list).filter(x=>x.isCorner).length,
    pool:LAST.R.fills.filter(f=>f.kind==='piece').flatMap(f=>f.sheets.flatMap(s=>s.list)).filter(x=>x.isCorner).length,
    poolIds:LAST.R.fills.filter(f=>f.kind==='piece').map(f=>f.matId),
    est:document.querySelector('#estimate').innerText, issues:(LAST.R.cornerIssues||[]).length,
    notes:[...document.querySelectorAll('#notes .note')].map(n=>n.textContent)}));
  const openMenu=async()=>{ await p.locator('[data-cpedit]').filter({hasText:'Угол 2-3'}).click(); await p.waitForTimeout(250); };
  const s0=await state(); ok(s0.main===1&&s0.pool===0&&!s0.mat,'по умолчанию деталь угла в общем пуле (в общем '+s0.main+', в пулах '+s0.pool+')');
  // прямой угол — меню без выбора материала
  await p.locator('[data-cpedit]').filter({hasText:'Угол 1-2'}).click(); await p.waitForTimeout(250);
  ok(!/Материал детали угла/i.test(await p.locator('#mat-menu').innerText()),'у прямого угла нет выбора материала детали'); await p.keyboard.press('Escape'); await p.mouse.click(5,5);
  // радиусный: выбор мрамора 044 через пикер
  await openMenu();
  ok(/Материал детали угла/i.test(await p.locator('#mat-menu').innerText()),'в меню радиусного угла есть «Материал детали угла»');
  await p.locator('#mat-menu button',{hasText:'Как у проекта'}).click(); await p.waitForTimeout(250);
  await p.locator('#mat-menu .mp-tab',{hasText:'Мрамор'}).click(); await p.locator('#mat-menu .mp-tile',{hasText:'044'}).first().click(); await p.waitForTimeout(1200);
  const s1=await state();
  ok(s1.mat==='marble:044'&&s1.main===0&&s1.pool===1&&s1.poolIds.join()==='piece:marble:044','деталь угла ушла в пул мрамора 044: '+JSON.stringify({m:s1.mat,main:s1.main,pool:s1.pool,ids:s1.poolIds}));
  ok(/Гибкий мрамор 2800×1200 · 044 \(материал детали угла\)\s+1 шт/.test(s1.est),'в смете появилась строка листа мрамора 044');
  ok(await p.locator('#cutmap svg[data-pool="piece:marble:044"]').count()===1,'на карте раскроя — отдельная карта листа мрамора с деталью угла');
  const lbl=await p.locator('#cutmap svg[data-pool="piece:marble:044"]').evaluate(e=>e.textContent); ok(/Угол R200/.test(lbl),'на листе подписана деталь «Угол R200…»');
  const hdr=await p.locator('#corner-scheme .corner-scheme-item-h').first().innerText(); ok(/044/.test(hdr),'развёртка угла подписана материалом: '+hdr);
  const col=await p.evaluate(()=>{ const r=document.querySelector('#corner-scheme svg rect'); return r&&r.getAttribute('fill'); }); ok(col&&col.toLowerCase()===(await p.evaluate(()=>CAT_BY_ID.get('marble:044').k.toLowerCase())),'развёртка залита цветом материала '+col);
  ok(s1.issues===0,'issues нет');
  const bad1=await p.evaluate(()=>window.__scan().concat(window.__badNums(),window.__consistency(),window.__overlaps())); ok(bad1.length===0,'разделы согласованы: '+bad1.join(' | '));
  await p.waitForTimeout(500);
  // верстак: деталь угла из пула материала уходит и возвращается
  const uid=await p.evaluate(()=>LAST.R.fills.find(f=>f.kind==='piece').sheets.flatMap(s=>s.list).find(x=>x.isCorner)._uid);
  await p.evaluate(u=>{ manualMoves.shelf=[{pool:'piece:marble:044',uid:u,rot:false}]; run(); },uid); await p.waitForTimeout(500);
  ok(await p.locator('#shelf-items .shelf-piece').count()===1,'деталь угла лежит на верстаке');
  await p.locator('.shelf-back').click(); await p.waitForTimeout(500);
  ok((await state()).pool===1,'кнопка «↩» вернула деталь угла в пул материала');
  // сохранение → открытие, отмена
  const snap=await p.evaluate(()=>JSON.parse(JSON.stringify(snapshot())));
  ok(snap.cornerLinks.some(c=>c.mat==='marble:044'),'материал угла в файле проекта');
  await p.evaluate(()=>{ cornerLinks.forEach(c=>{ c.mat=null; }); run(); }); await p.waitForTimeout(400);
  await p.evaluate(s=>applySnapshot(s,true),snap); await p.waitForTimeout(900);
  const s2=await state(); ok(s2.mat==='marble:044'&&s2.pool===1,'после открытия проекта материал угла на месте');
  await p.locator('#btn-undo').click(); await p.waitForTimeout(500);
  // потерянная расцветка → тип материала, предупреждение
  const old=JSON.parse(JSON.stringify(snap)); old.cornerLinks.forEach(c=>{ if(c.kind==='radius') c.mat='marble:удалена'; });
  await p.evaluate(s=>applySnapshot(s,true),old); await p.waitForTimeout(900);
  const s3=await state(); ok(s3.mat==='marble'&&s3.pool===1&&s3.notes.some(t=>/расцветки, которых нет/.test(t)),'исчезнувшая расцветка угла заменена типом «marble», есть предупреждение: '+s3.mat);
  // старый файл без поля mat
  const old2=JSON.parse(JSON.stringify(snap)); old2.cornerLinks.forEach(c=>{ delete c.mat; });
  await p.evaluate(s=>applySnapshot(s,true),old2); await p.waitForTimeout(900);
  const s4=await state(); ok(!s4.mat&&s4.main===1&&s4.pool===0,'файл без материала угла — деталь в общем пуле');
  // рейка: гнутая деталь шире листа 150 мм — откат на обычный профиль и понятное замечание
  await openMenu(); await p.locator('#mat-menu button',{hasText:'Как у проекта'}).click(); await p.waitForTimeout(250);
  await p.locator('#mat-menu .mp-tab',{hasText:'Рейка'}).click(); await p.locator('#mat-menu .mp-tile').first().click(); await p.waitForTimeout(1000);
  const s5=await state(); ok(s5.issues===1&&s5.main===0&&s5.pool===0&&s5.notes.some(t=>/не помещается в лист шириной 150/.test(t)),'рейка как материал угла: issue «не помещается в лист шириной 150 мм»');
  // выбор материала, совпадающего с основным, сбрасывает материал угла
  await openMenu(); await p.locator('#mat-menu button',{hasText:/Реечная/}).first().click().catch(()=>{}); await p.keyboard.press('Escape'); await p.mouse.click(5,5);
  await p.evaluate(()=>{ cornerLinks.forEach(c=>{ c.mat=null; }); run(); }); await p.waitForTimeout(400);
  // задание для нейросети: стена 2 на макете
  await p.evaluate(()=>{ cornerLinks.find(c=>c.kind==='radius').mat='marble:044'; run(); }); await p.waitForTimeout(500);
  await p.locator('.sect-h',{hasText:'Визуализация на фото'}).click(); await p.selectOption('#viz-wall',{index:1});
  await p.click('#viz-mock-toggle'); await p.click('#viz-mock-make'); await p.waitForTimeout(1500); await p.click('#viz-json-copy'); await p.waitForTimeout(250);
  const j=JSON.parse(await p.inputValue('#viz-json-output'));
  const rc=(j.corners||[]).find(x=>/скруглённый/.test(x.shape));
  ok(rc&&rc.material&&/044/.test(rc.material.name),'в задании у радиусного угла указан материал детали: '+JSON.stringify(rc&&rc.material).slice(0,120));
  ok((j.materials||[]).some(m=>/044/.test(m.name||m.article||'')&&/радиусного угла/.test(JSON.stringify(m.used_for||''))),'материал угла есть в materials[] с ролью «деталь радиусного угла»');
  ok(!/NaN|undefined/.test(JSON.stringify(j)),'в задании нет NaN/undefined');
  ok(errs.length===0,'ошибок страницы нет '+errs.join('|'));
  await b.close();
  console.log(fails?`ПРОВАЛЕНО: ${fails}`:'все проверки пройдены'); process.exit(fails?1:0);
})();
