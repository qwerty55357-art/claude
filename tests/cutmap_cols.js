// Карта раскроя читаема при любой ширине экрана: число колонок листов подстраивается под ширину карты (лист 105–170 px, не «на весь экран»),
// ограничение высоты не ужимает карту из нескольких рядов, при изменении окна карта перерисовывается.
// Запуск: NODE_PATH=$(npm root -g) node tests/cutmap_cols.js
const {chromium}=require('playwright'); const path=require('path');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
const IN_PAGE=require('./lib/inpage.js');
let fails=0; const ok=(c,w)=>{ if(!c){ fails++; console.log('✗',w); } else console.log('✓',w); };
(async()=>{
  const b=await chromium.launch({executablePath:EXE}); const p=await b.newPage({viewport:{width:1920,height:1080}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto(HTML); await p.waitForTimeout(500); await p.evaluate(IN_PAGE);
  await p.evaluate(()=>window.__rich()); await p.waitForTimeout(700);
  const probe=()=>p.evaluate(()=>{ const sv=document.querySelector('#cutmap svg[data-pool="main"]'); const r=sv.getBoundingClientRect(); const cols=+sv.dataset.cols;
    return {cols,n:+sv.dataset.n,sheetPx:r.width/(cols*1.3),maxH:sv.style.maxHeight,box:document.querySelector('#cutmap').clientWidth}; });
  for(const w of [1920,1500,1280,1024]){
    await p.setViewportSize({width:w,height:900}); await p.waitForTimeout(700);
    const s=await probe();
    ok(s.sheetPx>=105&&s.sheetPx<=200,'окно '+w+': лист на экране ≈ '+Math.round(s.sheetPx)+' px — читаемо и не огромно (колонок '+s.cols+', карта '+s.box+' px)');
    ok(s.n<=s.cols?s.maxH!=='':s.maxH==='','окно '+w+': ограничение высоты '+(s.n<=s.cols?'у одного ряда есть':'у нескольких рядов снято'));
  }
  await p.setViewportSize({width:1920,height:1080}); await p.waitForTimeout(700);
  const wide=await probe(); await p.setViewportSize({width:1280,height:1080}); await p.waitForTimeout(800); const narrow=await probe();
  ok(wide.cols>narrow.cols,'при сужении окна карта перерисовалась: колонок '+wide.cols+' → '+narrow.cols);
  // на типичном экране (1280) бамбук — 3 листа в ряд; чем уже лист, тем больше их в ряду: мрамор ≈ бамбук, скала малая больше, рейка ещё больше
  await p.setViewportSize({width:1280,height:900}); await p.waitForTimeout(600);
  const colsOf=async preset=>{ await p.selectOption('#i-preset',preset); await p.waitForTimeout(700); return p.evaluate(()=>+document.querySelector('#cutmap svg[data-pool="main"]').dataset.cols); };
  const cb=await colsOf('bamboo29'), cm=await colsOf('marble'), cs=await colsOf('rockS'), cl=await colsOf('slat');
  ok(cb===3,'бамбук на экране 1280: 3 листа в ряд ('+cb+')');
  ok(cm===3,'мрамор (чуть шире бамбука): тоже 3 ('+cm+')');
  ok(cs>cb,'скала 600 мм — в ряду больше, чем бамбука: '+cs+' > '+cb);
  ok(cl>cs&&cl>=8,'рейка 150 мм — ещё больше: '+cl+' (≥ 8)');
  await p.selectOption('#i-preset','bamboo29'); await p.waitForTimeout(700);
  // верстак узкий, а одиночный лист (заполнение мрамором) не растягивается на всю карту
  const geo=await p.evaluate(()=>{ const z=document.querySelector('#shelf-zone').getBoundingClientRect(); const sv=document.querySelector('#cutmap svg[data-pool="marble"]'); const r=sv.getBoundingClientRect(); return {shelf:z.width,one:r.width/1.3}; });
  ok(geo.shelf<=130,'верстак узкий: '+Math.round(geo.shelf)+' px');
  ok(geo.one<=200,'один лист заполнения не огромный: ≈ '+Math.round(geo.one)+' px');
  // перетаскивание детали по-прежнему попадает на нужное место при любом числе колонок
  const uid=await p.evaluate(()=>LAST.R.sheets[0].list[0]._uid);
  const el=p.locator('#cutmap svg[data-pool="main"] [data-cmdrag="'+uid+'"]').first(); await el.scrollIntoViewIfNeeded();
  const bb=await el.boundingBox(); await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2); await p.mouse.down(); await p.mouse.move(bb.x+bb.width/2+20,bb.y+bb.height/2+5,{steps:4});
  const z=await p.locator('#shelf-zone').boundingBox(); await p.mouse.move(z.x+z.width/2,z.y+z.height/2,{steps:8}); await p.mouse.up(); await p.waitForTimeout(500);
  ok(await p.locator('#shelf-items .shelf-piece').count()===1,'деталь с карты уходит на верстак при '+narrow.cols+' колонках');
  ok(errs.length===0,'ошибок страницы нет '+errs.join('|'));
  await b.close();
  console.log(fails?`ПРОВАЛЕНО: ${fails}`:'все проверки пройдены'); process.exit(fails?1:0);
})();
