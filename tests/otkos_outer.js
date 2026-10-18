// Выступающий откос: накладка («внешняя часть») из другого материала — отдельная деталь. Меню стороны откоса, раскрой в отдельный
// пул материала, схема (цвет накладки), 3D, смета, сохранение/открытие, отмена; совпадение материалов не делит деталь.
// Запуск: NODE_PATH=$(npm root -g) node tests/otkos_outer.js
const {chromium}=require('playwright'); const path=require('path');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
const IN_PAGE=require('./lib/inpage.js');
let fails=0; const ok=(c,w)=>{ if(!c){ fails++; console.log('✗',w); } else console.log('✓',w); };
(async()=>{
  const b=await chromium.launch({executablePath:EXE}); const p=await b.newPage({viewport:{width:1500,height:1300}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200))); p.on('dialog',async d=>{ errs.push('диалог '+d.message().slice(0,80)); await d.accept(); });
  await p.goto(HTML); await p.waitForTimeout(600); await p.evaluate(IN_PAGE);
  const settle=()=>p.waitForTimeout(900);
  const info=()=>p.evaluate(()=>{ const R=LAST.R; const pr=R.parts.filter(x=>x.op===0&&x.wall===0);
    return {parts:pr.map(x=>({n:x.name,dep:Math.round(x.dep),len:Math.round(x.len),mat:x.matOverride||null,outer:!!x.outer})),
      pools:R.fills.filter(f=>f.kind==='otkos').map(f=>({id:f.matId,sheets:f.sheets.length,area:Math.round(f.area*1e6)})),otkosArea:Math.round(R.otkosArea*1e6),
      est:document.querySelector('#estimate').innerText}; });
  const sideClick=async side=>{ const bb=await p.evaluate(s=>{ const e=document.querySelector(`#scheme .wall-scheme.on [data-otkosside="${s}"]`)||document.querySelector(`[data-otkosside="${s}"]`); e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect(); return [r.x+r.width/2,r.y+r.height/2]; },side);
    await p.mouse.move(bb[0],bb[1]); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(300); };

  // окно с откосом: глубина 200, вылет накладки 60, левая и верхняя стороны — «выступающий»
  await p.evaluate(()=>{ const o=walls[0].ops[0]; o.otkos=true; o.depth=200; o.otkosOverlap=60; o.otkosMode={left:'protrude',right:'corner',top:'protrude',bottom:'corner'}; renderOpenings(); run(); }); await settle();
  const a0=await info();
  ok(a0.parts.find(x=>x.n==='О1·лев').dep===260&&!a0.parts.some(x=>x.outer),'без отдельного материала накладка — прежняя одна деталь (глубина 200+60)');

  // меню стороны: пункт «Материал накладки» только у выступающей стороны с вылетом
  await sideClick('left');
  ok(/Материал накладки/.test(await p.locator('#mat-menu').innerText()),'у выступающей стороны в меню есть «Материал накладки»');
  await p.keyboard.press('Escape'); await p.mouse.click(5,5); await p.waitForTimeout(150);
  await sideClick('right');
  ok(!/Материал накладки/.test(await p.locator('#mat-menu').innerText().catch(()=>'' )),'у стороны с «Г-образным углом» пункта нет');
  await p.mouse.click(5,5); await p.waitForTimeout(150);
  await p.evaluate(()=>{ walls[0].ops[0].otkosOverlap=0; renderOpenings(); run(); }); await settle();
  await sideClick('left');
  ok(/Вылет накладки = 0/.test(await p.locator('#mat-menu').innerText()),'при вылете 0 пункт предупреждает, что накладки нет'); await p.mouse.click(5,5); await p.waitForTimeout(150);
  await p.evaluate(()=>{ walls[0].ops[0].otkosOverlap=60; renderOpenings(); run(); }); await settle();

  // выбор материала накладки через меню
  await sideClick('left');
  await p.locator('#mat-menu button',{hasText:'Материал накладки'}).click(); await p.waitForTimeout(250);
  await p.locator('#mat-menu .mp-tab',{hasText:'Мрамор'}).click(); await p.locator('#mat-menu .mp-tile',{hasText:'044'}).first().click(); await settle();
  const a1=await info();
  const inn=a1.parts.find(x=>x.n==='О1·лев'), out=a1.parts.find(x=>x.n==='О1·лев·накл');
  ok(inn&&out&&inn.dep===200&&out.dep===60&&inn.len===out.len&&out.outer,'деталь разделилась: откос 200 мм и накладка 60 мм одной длины');
  ok(out.mat==='marble:044'&&!inn.mat,'накладка — в пуле мрамора, откос остался в общем пуле');
  ok(a1.pools.length===1&&a1.pools[0].id==='otkos:marble:044'&&a1.pools[0].area===60*inn.len,'отдельный пул листов мрамора под накладку (площадь = вылет × длина)');
  ok(a1.parts.find(x=>x.n==='О1·верх').dep===260,'сторона без отдельного материала накладки осталась одной деталью');
  ok(/044|Гибкий мрамор/i.test(a1.est),'мрамор попал в смету отдельной строкой');
  ok(await p.evaluate(()=>{ const r=[...document.querySelectorAll('#scheme rect[stroke-dasharray]')].filter(e=>e.getAttribute('pointer-events')==='none'); return r.some(e=>!/straw/.test(e.getAttribute('fill')||'straw')); }),'на схеме накладка залита цветом своего материала');
  // пул на карте раскроя
  ok(await p.evaluate(()=>!!document.querySelector('#cutmap svg[data-pool="otkos:marble:044"]')),'на карте раскроя есть лист мрамора с накладкой');
  await p.waitForTimeout(500);

  // 3D, сохранение/открытие, отмена
  const snap=await p.evaluate(()=>JSON.stringify(snapshot()));
  ok(/otkosOuterMat/.test(snap),'материал накладки попал в сохранение проекта');
  await p.evaluate(()=>{ walls=[newWall()]; cornerLinks=[]; active=0; renderWallCompass(); renderOpenings(); run(); });
  await p.evaluate(s=>applySnapshot(JSON.parse(s),true),snap); await settle();
  const a2=await info(); ok(JSON.stringify(a2.parts)===JSON.stringify(a1.parts),'после открытия проекта деталь так же разделена');
  await p.evaluate(()=>historyCommit());
  // материал накладки = материал самого откоса: деление не нужно
  await p.evaluate(()=>{ walls[0].ops[0].otkosMat={left:'marble:044'}; run(); }); await settle();
  const a3=await info(); ok(!a3.parts.some(x=>x.outer)&&a3.parts.find(x=>x.n==='О1·лев').dep===260,'материал накладки = материалу откоса — деталь не делится');
  // откос из мрамора, накладка — материал проекта: накладка уходит в общий пул
  await p.evaluate(()=>{ walls[0].ops[0].otkosOuterMat={left:curMatId()}; run(); }); await settle();
  const a4=await info(); const o4=a4.parts.find(x=>x.n==='О1·лев·накл');
  ok(o4&&!o4.mat&&a4.parts.find(x=>x.n==='О1·лев').mat==='marble:044','откос из мрамора, накладка из материала проекта — накладка в общем пуле');
  // сторона сменила режим — накладки нет, настройка не ломает расчёт
  await p.evaluate(()=>{ walls[0].ops[0].otkosMode.left='corner'; run(); }); await settle();
  ok(!(await info()).parts.some(x=>x.outer),'сторона перестала быть выступающей — накладки нет');
  // «согласованность разделов» из общего набора проверок
  const cons=await p.evaluate(()=>window.__consistency?window.__consistency():[]);
  ok(!cons||!cons.length,'согласованность схема/раскрой/спецификация/смета: '+JSON.stringify(cons).slice(0,200));
  ok(await p.evaluate(()=>!/NaN|undefined/.test(document.querySelector('#estimate').innerText+document.querySelector('#spec').innerText)),'в смете и спецификации нет NaN');
  ok(errs.length===0,'ошибок страницы нет '+errs.join(' | '));
  console.log(fails?('\nПРОВАЛЕНО: '+fails):'\nвсе проверки пройдены'); await b.close(); process.exit(fails?1:0);
})();
