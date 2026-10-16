// Печать/PDF: поля страницы белые — на каждой странице нет сплошной тёмной заливки на весь лист (раньше color-scheme: dark давал
// чёрную окантовку). Проверяем содержимое PDF: ни один лист не начинается с заливки всей страницы не-белым цветом.
// Запуск: NODE_PATH=$(npm root -g) node tests/print_clean.js
const {chromium}=require('playwright'); const path=require('path'); const zlib=require('zlib');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
const IN_PAGE=require('./lib/inpage.js');
let fails=0; const ok=(c,w)=>{ if(!c){ fails++; console.log('✗',w); } else console.log('✓',w); };
(async()=>{
  const b=await chromium.launch({executablePath:EXE}); const p=await b.newPage({viewport:{width:1280,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto(HTML); await p.waitForTimeout(500); await p.evaluate(IN_PAGE);
  await p.evaluate(()=>window.__rich()); await p.waitForTimeout(1200);
  await p.emulateMedia({media:'print'});
  const pdf=await p.pdf({format:'A4',printBackground:true,preferCSSPageSize:true});
  const d=pdf.toString('latin1'); let bad=0, pages=0;
  const re=/stream\r?\n([\s\S]*?)\r?\nendstream/g; let m;
  while((m=re.exec(d))){ let t; try{ t=zlib.inflateSync(Buffer.from(m[1],'latin1')).toString('latin1'); }catch(e){ continue; }
    if(!/ re/.test(t)||t.length<50) continue;
    // заливка прямоугольника размером со страницу A4 (794×1123 css px) любым цветом, кроме белого
    const f=t.match(/([\d.]+) ([\d.]+) ([\d.]+) rg[^\n]*\n[^\n]*\n?[^\n]*0 0 79[34](?:\.\d+)? 11\d\d(?:\.\d+)? re/);
    if(f&&!(+f[1]>0.99&&+f[2]>0.99&&+f[3]>0.99)) bad++;
    if(/0 0 79[34](?:\.\d+)? 11\d\d(?:\.\d+)? re/.test(t)) pages++;
  }
  ok(bad===0,'в PDF нет заливки всей страницы тёмным цветом (найдено: '+bad+')');
  ok(errs.length===0,'ошибок страницы нет '+errs.join('|'));
  await b.close();
  console.log(fails?`ПРОВАЛЕНО: ${fails}`:'все проверки пройдены'); process.exit(fails?1:0);
})();
