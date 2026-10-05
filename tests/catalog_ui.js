// Интерфейс выбора расцветки: пикер с миниатюрами в разделе «Панель» и в заполнении проёма.
// Запуск: NODE_PATH=$(npm root -g) node tests/catalog_ui.js
const {chromium}=require('playwright'); const path=require('path');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
let fails=0; const ok=(c,w)=>{ if(!c){ fails++; console.log('✗',w); } else console.log('✓',w); };
(async()=>{
  const b=await chromium.launch({executablePath:EXE}); const p=await b.newPage({viewport:{width:1500,height:1000}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  await p.goto(HTML); await p.waitForTimeout(600);
  ok(await p.isVisible('#row-colorway'),'у бамбука строка «Расцветка» показана');
  await p.locator('#i-cw-btn .mat-pick-btn').scrollIntoViewIfNeeded();
  await p.locator('#i-cw-btn .mat-pick-btn').click();
  ok((await p.locator('#mat-menu .mp-tile').count())===40,'в пикере бамбука 39 расцветок + плитка «базовый»');
  ok(await p.locator('#mat-menu .mp-tab').count()===1,'у основного материала одна вкладка (его тип)');
  await p.fill('#mat-menu .mp-search','p74');
  ok((await p.locator('#mat-menu .mp-tile .mp-a').allInnerTexts()).join()==='P74-2','поиск по артикулу находит P74-2');
  await p.fill('#mat-menu .mp-search','');
  await p.locator('#mat-menu .mp-tile',{hasText:'V6'}).first().click(); await p.waitForTimeout(500);
  ok(await p.inputValue('#i-colorway')==='bamboo29:v6','выбор V6 записан в поле расцветки');
  ok(/V6/.test(await p.locator('#i-cw-btn').innerText()),'кнопка показывает выбранный артикул');
  ok(/V6/.test(await p.locator('#cutmap').innerText()||'')||/V6/.test(await p.locator('#estimate').innerText()),'название расцветки попало в смету/карту раскроя');
  await p.selectOption('#i-preset','rockL'); await p.waitForTimeout(300);
  ok(!(await p.isVisible('#row-colorway')),'у скалы строка «Расцветка» скрыта');
  ok(await p.inputValue('#i-colorway')==='','смена типа сбросила расцветку');
  await p.selectOption('#i-preset','bamboo29'); await p.waitForTimeout(300);

  // проём: заполнение через пикер в форме
  await p.evaluate(()=>{ document.querySelector('#btn-add-op').click(); });
  await p.waitForTimeout(500);
  const fb=p.locator('[data-fillpick]').first(); await fb.scrollIntoViewIfNeeded(); await fb.click(); await p.waitForTimeout(300);
  ok((await p.locator('#mat-menu .mp-tab').count())===5,'в пикере проёма вкладки всех типов: '+(await p.locator('#mat-menu .mp-tab').allInnerTexts()).join('/'));
  await p.locator('#mat-menu .mp-tab',{hasText:'Мрамор'}).click();
  await p.locator('#mat-menu .mp-tile',{hasText:'044'}).first().click(); await p.waitForTimeout(800);
  const fill=await p.evaluate(()=>walls[active].ops[0].fillMat);
  ok(fill==='marble:044','заполнение проёма = marble:044: '+fill);
  ok(/044/.test(await p.locator('[data-fillpick]').first().innerText()),'кнопка проёма показывает артикул');
  const k=await p.evaluate(()=>CAT_BY_ID.get('marble:044').k);
  ok((await p.locator('#scheme').innerHTML()).toLowerCase().includes(k.toLowerCase()),'на схеме проём залит условным цветом расцветки '+k);
  // скала в пикере проёма: плитка с рельефным образцом
  await p.locator('[data-fillpick]').first().click(); await p.waitForTimeout(200);
  await p.locator('#mat-menu .mp-tab',{hasText:'Скала бол.'}).click();
  ok((await p.locator('#mat-menu .mp-tile').count())===1&&(await p.locator('#mat-menu .mp-tile img').count())===1,'у скалы одна плитка с образцом рельефа');
  await p.locator('#mat-menu .mp-tile').click(); await p.waitForTimeout(500);
  ok(await p.evaluate(()=>walls[active].ops[0].fillMat)==='rockL','выбор скалы: fillMat = rockL');
  await p.locator('[data-fillpick]').first().click(); await p.waitForTimeout(200);
  await p.locator('#mat-menu .mp-none').click(); await p.waitForTimeout(400);
  ok(await p.evaluate(()=>walls[active].ops[0].fillMat)===null,'«без заполнения» очищает материал');
  ok(!errs.length,'ошибок страницы нет '+errs.join('|'));
  await b.close();
  console.log(fails?`ПРОВАЛЕНО: ${fails}`:'все проверки пройдены'); process.exit(fails?1:0);
})();
