// Верстак — липкая колонка справа от карты раскроя: остаётся на экране при прокрутке листов, деталь с нижнего
// материала переносится на верстак мышью без возврата вверх; на узком экране верстак уходит наверх и прилипает под шапкой;
// в печати раскладка — в одну колонку (верстак скрыт).
// Запуск: NODE_PATH=$(npm root -g) node tests/shelf_sticky.js
const {chromium}=require('playwright'); const path=require('path');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
let fails=0; const ok=(c,w)=>{ if(!c){ fails++; console.log('✗',w); } else console.log('✓',w); };
(async()=>{
  const b=await chromium.launch({executablePath:EXE}); const p=await b.newPage({viewport:{width:1500,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  await p.goto(HTML); await p.waitForTimeout(500);
  await p.locator('#file-load').setInputFiles(path.join(__dirname,'fixtures/slat_openings.json')); await p.waitForTimeout(1500);
  const rects=()=>p.evaluate(()=>{ const r=e=>{ const b=document.querySelector(e).getBoundingClientRect(); return {l:b.left,t:b.top,r:b.right,b:b.bottom}; };
    return {shelf:r('#shelf-zone'),cut:r('#cutmap'),top:document.querySelector('.topbar').getBoundingClientRect().bottom,vh:innerHeight,tbh:getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')}; });
  // --- широкий экран
  let r0=await rects();
  ok(r0.shelf.l>=r0.cut.r-1,'верстак справа от карты раскроя (левый край верстака ≥ правого края карты)');
  ok(/px/.test(r0.tbh)&&parseFloat(r0.tbh)>40,'высота шапки для липкого верстака задана: '+r0.tbh);
  // листаем к бамбуковой карте (низ блока), верстак должен остаться на экране
  await p.evaluate(()=>{ const s=document.querySelector('#cutmap svg[data-pool="piece:bamboo29:5139"]'); const r=s.getBoundingClientRect(); window.scrollTo(0,window.scrollY+r.bottom-innerHeight+40); });
  await p.waitForTimeout(300);
  const r1=await rects();
  ok(r1.shelf.t>=r1.top-1&&r1.shelf.b<=r1.vh+1&&r1.shelf.b>r1.shelf.t,'после прокрутки к бамбуку верстак виден на экране (под шапкой): '+Math.round(r1.shelf.t)+'…'+Math.round(r1.shelf.b)+' из '+r1.vh);
  // --- перенос детали бамбука на верстак мышью
  const pc=p.locator('#cutmap svg[data-pool="piece:bamboo29:5139"] [data-cmdrag]').first();
  await pc.scrollIntoViewIfNeeded();
  const bb=await pc.boundingBox(), sh=(await rects()).shelf;
  await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2); await p.mouse.down();
  await p.mouse.move(bb.x+bb.width/2+30,bb.y+bb.height/2,{steps:5});
  await p.mouse.move(sh.l+(sh.r-sh.l)/2,sh.t+(sh.b-sh.t)/2,{steps:12}); await p.waitForTimeout(150);
  ok(await p.evaluate(()=>document.querySelector('#shelf-zone').classList.contains('shelf-zone-over')),'над верстаком он подсвечивается');
  await p.mouse.up(); await p.waitForTimeout(600);
  ok(await p.locator('#shelf-items .shelf-piece').count()===1,'деталь бамбука легла на верстак без прокрутки вверх');
  // --- узкий экран
  await p.setViewportSize({width:1000,height:800}); await p.waitForTimeout(400);
  ok(await p.evaluate(()=>{ const l=getComputedStyle(document.querySelector('#cutmap-layout')); return l.gridTemplateColumns.trim().split(/\s+/).length===1&&getComputedStyle(document.querySelector('#shelf-zone')).order==='-1'; }),'узкий экран: одна колонка, верстак первым (над картой)');
  await p.evaluate(()=>{ const s=document.querySelector('#cutmap svg[data-pool="piece:bamboo29:5139"]'); const r=s.getBoundingClientRect(); window.scrollTo(0,window.scrollY+r.bottom-innerHeight+40); });
  await p.waitForTimeout(300);
  const n1=await rects();
  ok(n1.shelf.t>=n1.top-1&&n1.shelf.b<=n1.vh+1,'узкий экран: верстак прилипает под шапкой при прокрутке: '+Math.round(n1.shelf.t)+'…'+Math.round(n1.shelf.b));
  ok(n1.shelf.b-n1.shelf.t<=0.36*n1.vh+2,'узкий экран: верстак не больше трети экрана');
  // --- печать
  await p.setViewportSize({width:1500,height:900});
  await p.emulateMedia({media:'print'});
  ok(await p.evaluate(()=>getComputedStyle(document.querySelector('#cutmap-layout')).display==='block'&&getComputedStyle(document.querySelector('#shelf-zone')).display==='none'),'печать: карта в одну колонку, верстак скрыт');
  ok(errs.length===0,'ошибок страницы нет '+errs.join('|'));
  await b.close();
  console.log(fails?`ПРОВАЛЕНО: ${fails}`:'все проверки пройдены'); process.exit(fails?1:0);
})();
