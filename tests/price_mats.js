// Цены панелей других материалов (заполнения проёмов, откосы, детали со своим материалом): редактируются в «Цены», идут в
// смету, у основного материала цена одна («Панель, шт»), сохраняются в проект, у старых файлов — цена пресета.
// Запуск: NODE_PATH=$(npm root -g) node tests/price_mats.js
const {chromium}=require('playwright'); const path=require('path');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
const IN_PAGE=require('./lib/inpage.js');
let fails=0; const ok=(c,w)=>{ if(!c){ fails++; console.log('✗',w); } else console.log('✓',w); };
(async()=>{
  const b=await chromium.launch({executablePath:EXE}); const p=await b.newPage({viewport:{width:1500,height:1000}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto(HTML); await p.waitForTimeout(500); await p.evaluate(IN_PAGE);
  await p.evaluate(()=>window.__rich()); await p.waitForTimeout(600);
  await p.locator('.sect-h',{hasText:'Цены'}).click();
  const rows=()=>p.evaluate(()=>[...document.querySelectorAll('#estimate tbody tr')].map(tr=>[...tr.children].map(c=>c.innerText.trim())).filter(r=>/^Панель /.test(r[0])).map(r=>({n:r[0],q:parseFloat(r[1]),p:parseFloat(r[2].replace(/[^\d]/g,'')),s:parseFloat(r[3].replace(/[^\d]/g,''))})));
  const visible=await p.evaluate(()=>[...document.querySelectorAll('#price-mats [data-pricerow]')].filter(r=>r.style.display!=='none').map(r=>r.dataset.pricerow));
  ok(visible.join()==='marble,slat,rockL,rockS','у бамбука видны цены остальных четырёх типов, свой скрыт: '+visible);
  let r=await rows(); ok(r.every(x=>x.p===4500),'по умолчанию все панели по 4500: '+r.map(x=>x.p));
  await p.fill('#p-mat-marble','7000'); await p.fill('#p-mat-slat','800'); await p.fill('#p-panel','5200'); await p.waitForTimeout(500);
  r=await rows();
  const price=n=>r.find(x=>new RegExp(n).test(x.n)).p;
  ok(price('Бамбуковая')===5200,'основная панель по «Панель, шт» = 5200: '+price('Бамбуковая'));
  ok(price('мрамор')===7000,'заполнение мрамором по 7000: '+price('мрамор'));
  ok(price('Реечная')===800,'заполнение рейкой по 800: '+price('Реечная'));
  ok(price('Скала')===4500,'скала осталась по 4500');
  ok(r.every(x=>x.q*x.p===x.s),'сумма строки = количество × цена');
  const est=await p.evaluate(()=>document.querySelector('#estimate tbody tr.tot td.num').innerText);
  ok(parseFloat(est.replace(/[^\d]/g,''))===(await p.evaluate(()=>[...document.querySelectorAll('#estimate tbody tr')].filter(t=>!t.classList.contains('tot')).reduce((a,t)=>a+parseFloat(t.children[3].innerText.replace(/[^\d]/g,'')),0))),'итог = сумма строк');
  // материал отдельной детали и откосов тоже по цене своего типа
  await p.evaluate(()=>{ const pc=LAST.R.layouts[0].pieces.find(x=>x.pk); walls[0].pieceMats={[pc.pk]:'marble'}; run(); }); await p.waitForTimeout(400);
  r=await rows(); ok(r.filter(x=>/мрамор/.test(x.n)).every(x=>x.p===7000),'все строки мрамора (проём и деталь) по 7000: '+r.filter(x=>/мрамор/.test(x.n)).map(x=>x.p));
  // основным станет мрамор: его цена — «Панель, шт», а у бамбука появится своя строка цен
  await p.selectOption('#i-preset','marble'); await p.waitForTimeout(500);
  const vis2=await p.evaluate(()=>[...document.querySelectorAll('#price-mats [data-pricerow]')].filter(r=>r.style.display!=='none').map(r=>r.dataset.pricerow));
  ok(vis2.join()==='bamboo29,slat,rockL,rockS','основной тип — мрамор: его строка скрыта, бамбук появился: '+vis2);
  await p.selectOption('#i-preset','bamboo29'); await p.waitForTimeout(300);
  // сохранение в проект и открытие
  const snap=await p.evaluate(()=>JSON.parse(JSON.stringify(snapshot())));
  ok(snap.fields['p-mat-marble']==='7000'&&snap.fields['p-mat-slat']==='800','цены сохраняются в проект');
  await p.fill('#p-mat-marble','1'); await p.evaluate(s=>applySnapshot(s,true),snap); await p.waitForTimeout(500);
  ok(await p.inputValue('#p-mat-marble')==='7000','при открытии цена мрамора вернулась: '+await p.inputValue('#p-mat-marble'));
  // файл без этих полей — цена пресета, а не остаток от прошлого проекта
  delete snap.fields['p-mat-marble']; delete snap.fields['p-mat-slat'];
  await p.evaluate(s=>applySnapshot(s,true),snap); await p.waitForTimeout(500);
  ok(await p.inputValue('#p-mat-marble')==='4500'&&await p.inputValue('#p-mat-slat')==='4500','старый файл: цены других материалов — по умолчанию 4500');
  // отмена возвращает цену
  await p.fill('#p-mat-rockL','3000'); await p.locator('#p-mat-rockL').blur(); await p.waitForTimeout(700); await p.locator('#btn-undo').click(); await p.waitForTimeout(700);
  ok(await p.inputValue('#p-mat-rockL')==='4500','отмена вернула прежнюю цену');
  const bad=await p.evaluate(()=>window.__scan().concat(window.__consistency()));
  ok(bad.length===0,'разделы согласованы, NaN нет: '+bad.join(' | '));
  ok(errs.length===0,'ошибок страницы нет '+errs.join('|'));
  await b.close();
  console.log(fails?`ПРОВАЛЕНО: ${fails}`:'все проверки пройдены'); process.exit(fails?1:0);
})();
