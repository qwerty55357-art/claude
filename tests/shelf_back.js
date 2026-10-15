// Верстак: если все детали материала ушли на верстак, листов у него не остаётся — карта не рисует битый SVG, а деталь
// возвращается кнопкой «↩». После ручных правок число листов «на плоскость + на откосы» сходится с общим итогом.
// Запуск: NODE_PATH=$(npm root -g) node tests/shelf_back.js
const {chromium}=require('playwright'); const path=require('path');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
const IN_PAGE=require('./lib/inpage.js');
let fails=0; const ok=(c,w)=>{ if(!c){ fails++; console.log('✗',w); } else console.log('✓',w); };
(async()=>{
  const b=await chromium.launch({executablePath:EXE}); const p=await b.newPage({viewport:{width:1500,height:1000}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  await p.goto(HTML); await p.waitForTimeout(500); await p.evaluate(IN_PAGE);
  await p.evaluate(()=>window.__rich()); await p.waitForTimeout(800);
  const sel='#cutmap svg[data-pool="marble"]';
  ok(await p.locator(sel).count()===1,'у заполнения мрамором есть своя карта (один лист)');
  const uid=await p.evaluate(()=>LAST.R.fills.find(f=>f.matId==='marble').sheets[0].list[0]._uid);
  const el=p.locator(sel+` [data-cmdrag="${uid}"]`).first(); await el.scrollIntoViewIfNeeded();
  const bb=await el.boundingBox(); await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2); await p.mouse.down();
  await p.mouse.move(bb.x+bb.width/2+10,bb.y+bb.height/2+10,{steps:3});
  const z=await p.locator('#shelf-zone').boundingBox(); await p.mouse.move(z.x+z.width/2,z.y+z.height/2,{steps:12}); await p.waitForTimeout(150); await p.mouse.up(); await p.waitForTimeout(600);
  ok(await p.locator('#shelf-items .shelf-piece').count()===1,'деталь лежит на верстаке');
  ok(await p.locator(sel).count()===0,'листа мрамора на карте больше нет');
  ok(!/NaN/.test(await p.locator('#cutmap').innerHTML()),'в карте нет NaN (раньше SVG с viewBox «0 NaN»)');
  ok(/лежат на верстаке/.test(await p.locator('#cutmap').innerText()),'вместо листа — пояснение «все детали на верстаке»');
  ok(await p.locator('.shelf-back').count()===1,'на детали верстака есть кнопка «↩»');
  // после ручных правок «на плоскость + на откосы» = общему числу листов
  const s=await p.evaluate(()=>({t:LAST.R.sheetsTotal,m:LAST.R.mainSheets,e:LAST.R.extraSheets}));
  ok(s.t===s.m+s.e,'листов '+s.t+' = на плоскость '+s.m+' + на откосы '+s.e);
  await p.locator('.shelf-back').click(); await p.waitForTimeout(600);
  ok(await p.locator('#shelf-items .shelf-piece').count()===0,'после «↩» верстак пуст');
  ok(await p.locator(sel).count()===1,'лист мрамора вернулся на карту');
  ok(await p.evaluate(()=>LAST.R.fills.find(f=>f.matId==='marble').sheets[0].list.length)===1,'деталь снова на своём листе');
  // сброс «из выреза»: деталь стены с вырезом уходит на верстак и возвращается
  const u2=await p.evaluate(()=>{ for(const sh of LAST.R.sheets) for(const o of sh.list) if(o.cuts&&o.cuts.length) return o._uid; });
  await p.evaluate(u=>{ manualMoves.shelf=[{pool:'main',uid:u,rot:false}]; run(); },u2); await p.waitForTimeout(500);
  const onShelf=await p.locator('#shelf-items .shelf-piece').count();
  ok(onShelf>=1,'деталь с вырезом ушла на верстак (вместе с «детьми» из выреза): '+onShelf);
  while(await p.locator('.shelf-back').count()){ await p.locator('.shelf-back').first().click(); await p.waitForTimeout(300); }
  ok(await p.locator('#shelf-items .shelf-piece').count()===0&&await p.evaluate(()=>(LAST.R.shelf||[]).length)===0,'все детали вернулись кнопкой «↩»');
  const bad=await p.evaluate(()=>window.__consistency().concat(window.__overlaps()));
  ok(bad.length===0,'после возврата проект согласован: '+bad.join(' | '));
  ok(errs.length===0,'ошибок страницы нет '+errs.join('|'));
  await b.close();
  console.log(fails?`ПРОВАЛЕНО: ${fails}`:'все проверки пройдены'); process.exit(fails?1:0);
})();
