// Реечная панель (2900×150) в проёмах: схема рисует ту же раскладку, что и карта раскроя (границы реек,
// поперечные стыки наращивания), карта раскроя узких листов читаема и влезает в печать, у реек нет
// кнопки поворота на 90° (рёбра идут вдоль листа), в спецификации нет строки «0 шт».
// Фикстура — проект с двумя проёмами 650×3020, заполненными рейкой, и средней полосой из бамбука.
// Запуск: NODE_PATH=$(npm root -g) node tests/slat_fill.js
const {chromium}=require('playwright'); const path=require('path');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
let fails=0; const ok=(c,w)=>{ if(!c){ fails++; console.log('✗',w); } else console.log('✓',w); };
(async()=>{
  const b=await chromium.launch({executablePath:EXE}); const p=await b.newPage({viewport:{width:1500,height:1300}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  await p.goto(HTML); await p.waitForTimeout(500);
  await p.locator('#file-load').setInputFiles(path.join(__dirname,'fixtures/slat_openings.json')); await p.waitForTimeout(1500);
  const info=await p.evaluate(()=>{
    const f=LAST.R.fills.find(x=>x.kind==='opening');
    const svg=document.querySelector('#cutmap svg[data-pool="slat:5139"]'); const vb=svg.getAttribute('viewBox').split(' ').map(Number);
    return {sheets:f.sheets.length,
      cross:document.querySelectorAll('#scheme [data-fillcross]').length,
      cols:+svg.dataset.cols, norot:svg.dataset.norot, rotBtns:svg.querySelectorAll('[data-cmrot]').length, ratio:vb[2]/vb[3],
      bambooRot:document.querySelector('#cutmap svg[data-pool="piece:bamboo29:5139"]').querySelectorAll('[data-cmrot]').length,
      spec:document.querySelector('#spec').innerText,
      stripsPerWindow:f.layouts.map(l=>l.L.strips.length), sheetsList:f.sheets.map(sh=>sh.list.map(o=>Math.round(o.w)+'×'+Math.round(o.len)).join('+'))};
  });
  ok(info.sheets===11,'рейки: 11 листов (10 реек + лист с добором по 120 мм): '+info.sheets);
  ok(info.cross===10,'на схеме 10 поперечных стыков реек (по одному на рейку, 5×2 проёма): '+info.cross);
  ok(info.cols===11&&info.ratio>0.5,'карта раскроя узких листов: 11 колонок в ряд, пропорции карты '+info.ratio.toFixed(2)+' (было ~0.11)');
  ok(info.norot==='1'&&info.rotBtns===0,'у реечных деталей нет кнопки поворота ↻');
  ok(info.bambooRot>0,'у бамбуковой детали кнопка поворота осталась');
  ok(!/Панель Бамбуковая панель 2900×1150\s+0 шт/.test(info.spec),'в спецификации нет строки «0 шт» для основного материала');
  // линии схемы = полосы раскроя: у каждого проёма strips-1 границ реек
  const bands=await p.evaluate(()=>[...document.querySelectorAll('#scheme .wall-scheme.on svg line[stroke-opacity=".8"]')].length);
  const expectBands=info.stripsPerWindow.reduce((a,n)=>a+n-1,0);
  ok(bands===expectBands,`границ реек на схеме ${bands}, в раскрое ${expectBands}`);
  // печать: карта раскроя реек не раздувается — весь проект печатается на ≤ 9 страницах A4 (было 14: подписи листов
  // растягивались на ширину страницы, карта резалась по страницам)
  await p.emulateMedia({media:'print'});
  const pdf=await p.pdf({format:'A4',printBackground:true});
  const pages=(pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length;
  ok(pages>0&&pages<=9,'печать: '+pages+' стр. (было 14)');
  ok(errs.length===0,'ошибок страницы нет '+errs.join('|'));
  await b.close();
  console.log(fails?`ПРОВАЛЕНО: ${fails}`:'все проверки пройдены'); process.exit(fails?1:0);
})();
