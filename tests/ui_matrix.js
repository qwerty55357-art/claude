// Матрица интерфейса: каждый материал (6 типов + расцветки + свои размеры, включая узкие и мелкие) прогоняется через
// насыщенный проект (3 стены, проёмы с откосами всех режимов, заполнения, стыки, углы прямой/радиусный, LED, деталь с
// индивидуальным материалом) и через все разделы: схема, карта раскроя, верстак, 3D, печать (PDF), смета, спецификация,
// сохранение/открытие, отмена, макет комнаты + задание для нейросети + архив.
// На каждом шаге ищем: ошибки страницы/диалоги, NaN/undefined/Infinity в тексте и в атрибутах SVG, нечисловые значения
// в результате расчёта, расхождения между разделами.
// Запуск: NODE_PATH=$(npm root -g) [UI_ONLY=slat] [UI_FUZZ=1] node tests/ui_matrix.js
const {chromium}=require('playwright'); const path=require('path'); const fs=require('fs'); const os=require('os');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
let fails=0; const log=[]; const bad=(m)=>{ fails++; console.log('✗',m); };
const MATS=[
  {n:'бамбук',preset:'bamboo29'},
  {n:'бамбук V6',preset:'bamboo29',cw:'V6'},
  {n:'мрамор',preset:'marble'},
  {n:'мрамор 044',preset:'marble',cw:'044'},
  {n:'рейка',preset:'slat'},
  {n:'рейка 5139',preset:'slat',cw:'5139'},
  {n:'скала бол.',preset:'rockL'},
  {n:'скала мал.',preset:'rockS'},
  {n:'свой 1200×600',preset:'custom',pl:1200,pw:600},
  {n:'свой 3000×100',preset:'custom',pl:3000,pw:100},
  {n:'свой 500×500',preset:'custom',pl:500,pw:500},
].filter(m=>!process.env.UI_ONLY||m.n.includes(process.env.UI_ONLY)||m.preset===process.env.UI_ONLY);

const IN_PAGE=require('./lib/inpage.js');

(async()=>{
  const b=await chromium.launch({executablePath:EXE});
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'uim-'));
  const only=m=>!process.env.UI_ONLY||m.n.includes(process.env.UI_ONLY)||m.preset===process.env.UI_ONLY;
  for(const M of MATS){
    const t0=Date.now(); const errs=[]; const tag='['+M.n+'] ';
    const p=await b.newPage({viewport:{width:1500,height:1100},acceptDownloads:true});
    p.on('pageerror',e=>errs.push('pageerror '+String(e).slice(0,200)));
    p.on('dialog',async d=>{ errs.push('диалог '+d.message().slice(0,100)); await d.accept(); });
    p.on('console',m=>{ if(m.type()==='error'&&!/ERR_CERT|Failed to load resource/.test(m.text())) errs.push('console.error '+m.text().slice(0,200)); });
    await p.goto(HTML); await p.waitForTimeout(500);
    await p.evaluate(IN_PAGE);
    const check=async(what)=>{
      const s=await p.evaluate(()=>window.__scan()); s.forEach(x=>bad(tag+what+': '+x));
      const n=await p.evaluate(()=>window.__badNums()); n.forEach(x=>bad(tag+what+': нечисловое значение '+x));
      if(errs.length){ errs.splice(0).forEach(e=>bad(tag+what+': '+e)); }
    };
    // 1. материал через настоящий интерфейс
    await p.selectOption('#i-preset',M.preset); await p.waitForTimeout(200);
    if(M.preset==='custom'){ await p.fill('#i-pl',String(M.pl)); await p.fill('#i-pw',String(M.pw)); await p.waitForTimeout(200); }
    if(M.cw){
      await p.locator('#i-cw-btn .mat-pick-btn').scrollIntoViewIfNeeded(); await p.locator('#i-cw-btn .mat-pick-btn').click();
      await p.locator('#mat-menu .mp-tile',{hasText:M.cw}).first().click(); await p.waitForTimeout(300);
    }
    await check('после выбора материала');
    // 2. насыщенный проект
    const nw=await p.evaluate(()=>window.__rich()); await p.waitForTimeout(1500);
    if(nw!==3) bad(tag+'проект не собрался (стен '+nw+')');
    await check('насыщенный проект');
    // индивидуальный материал одной детали
    await p.evaluate(()=>{ const L=LAST.R.layouts[0]; const pc=L.pieces.find(x=>x.pk); if(pc){ walls[0].pieceMats={[pc.pk]:'marble'}; run(); } });
    await p.waitForTimeout(600); await check('деталь с индивидуальным материалом');
    // 3. разделы и вкладки стен
    for(const h of await p.locator('.sect-h').all()){ if(!(await h.evaluate(e=>e.parentElement.classList.contains('closed')))) continue; await h.click(); }
    await p.waitForTimeout(300); await check('все разделы раскрыты');
    for(let i=0;i<3;i++){ await p.locator('[data-cpjump]').nth(i).click(); await p.waitForTimeout(500); await check('стена '+(i+1)); }
    await p.locator('[data-cpjump]').first().click(); await p.waitForTimeout(300);
    // 4. выходные разделы
    const info=await p.evaluate(()=>({sheets:LAST.R.sheetsTotal, svgSheets:document.querySelectorAll('#cutmap svg').length,
      scheme:!!document.querySelector('#scheme svg'), est:document.querySelector('#estimate').innerText.length, spec:document.querySelector('#spec').innerText.length,
      cards:document.querySelectorAll('#cards > *').length, failed:LAST.R.failed.length, mats:LAST.R.fills.length}));
    if(!info.scheme) bad(tag+'на схеме нет SVG');
    if(!info.est||!info.spec) bad(tag+'смета/спецификация пусты');
    if(info.svgSheets<1) bad(tag+'на карте раскроя нет листов');
    // 5. 3D
    await p.waitForTimeout(800);
    const c3=await p.evaluate(()=>{ const c=document.querySelector('#scene3d canvas'); return c?{w:c.width,h:c.height}:null; });
    if(!c3||c3.w<50) bad(tag+'3D-сцена не нарисована');
    await check('3D');
    // 6. печать
    await p.emulateMedia({media:'print'}); await p.setViewportSize({width:794,height:1123}); await p.waitForTimeout(500);
    await check('печать (DOM)');
    const wide=await p.evaluate(()=>{ const lim=document.documentElement.clientWidth; let mx=0, who='';
      document.querySelectorAll('#cutmap svg,#scheme svg,#spec,#estimate,#cuts').forEach(e=>{ const r=e.getBoundingClientRect(); if(r.right>mx){ mx=r.right; who=e.id||e.tagName; } });
      return {mx:Math.round(mx), lim, who}; });
    if(wide.mx>wide.lim+2) bad(tag+'печать: «'+wide.who+'» выходит за правое поле страницы ('+wide.mx+' > '+wide.lim+')');
    const pdf=await p.pdf({format:'A4',printBackground:true}); const pages=(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
    fs.writeFileSync(path.join(tmp,M.n.replace(/\W+/g,'_')+'.pdf'),pdf);
    if(pages<1||pages>40+info.sheets*2) bad(tag+'печать: странное число страниц '+pages+' при '+info.sheets+' листах');
    await p.emulateMedia({media:'screen'}); await p.setViewportSize({width:1500,height:1100}); await p.waitForTimeout(300);
    // 7. сохранение → открытие даёт то же самое; 8. отмена
    const dig=()=>p.evaluate(()=>({scheme:document.querySelector('#scheme').innerHTML.length, cut:document.querySelector('#cutmap').innerText, spec:document.querySelector('#spec').innerText,
      est:document.querySelector('#estimate').innerText, notes:document.querySelector('#notes').innerText, sheets:LAST.R.sheetsTotal}));
    const d0=await dig();
    const snapJson=await p.evaluate(()=>JSON.stringify(snapshot()));
    await p.evaluate(s=>applySnapshot(JSON.parse(s),true),snapJson); await p.waitForTimeout(1200);
    const d1=await dig();
    for(const k of Object.keys(d0)) if(JSON.stringify(d0[k])!==JSON.stringify(d1[k])) bad(tag+'после «сохранить → открыть» изменился раздел «'+k+'»');
    await check('после повторного открытия');
    await p.fill('#i-kerf','9'); await p.locator('#i-kerf').blur(); await p.waitForTimeout(700);
    const d2=await dig();
    await p.locator('#btn-undo').click(); await p.waitForTimeout(900);
    const d3=await dig(); const kerf=await p.inputValue('#i-kerf');
    if(kerf!=='5') bad(tag+'отмена не вернула пропил (стало '+kerf+')');
    for(const k of ['cut','spec','est','sheets']) if(JSON.stringify(d3[k])!==JSON.stringify(d0[k])) bad(tag+'после отмены не совпал раздел «'+k+'»');
    await check('после отмены');
    // 9. макет комнаты → задание → архив
    await p.locator('.sect-h',{hasText:'Визуализация на фото'}).scrollIntoViewIfNeeded();
    if(await p.isHidden('#viz-mock-box')) await p.click('#viz-mock-toggle');
    await p.click('#viz-mock-make'); await p.waitForTimeout(1800);
    await p.click('#viz-json-copy'); await p.waitForTimeout(300);
    let j=null; try{ j=JSON.parse(await p.inputValue('#viz-json-output')); }catch(e){ bad(tag+'JSON задания не разобрался'); }
    if(j){
      const txt=JSON.stringify(j);
      if(/NaN|undefined|Infinity|\[object/.test(txt)) bad(tag+'в JSON задания есть NaN/undefined: '+txt.match(/.{40}(NaN|undefined|Infinity|\[object).{20}/)?.[0]);
      if(!j.walls||!j.walls.length) bad(tag+'в задании нет стен');
      const mats=JSON.stringify(j.materials||j.panel||'');
      if(M.cw && !new RegExp(M.cw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i').test(txt)) bad(tag+'расцветка '+M.cw+' не попала в задание');
    }
    const zip=path.join(tmp,M.n.replace(/\W+/g,'_')+'.zip');
    try{ const [d]=await Promise.all([p.waitForEvent('download',{timeout:20000}),p.locator('#viz-guide-download-all').click()]); await d.saveAs(zip);
      const z=fs.readFileSync(zip);
      for(const f of ['схема-для-нейросети.png','описание-проекта.txt','как-отправлять.txt']) if(!z.includes(Buffer.from(f,'utf8'))) bad(tag+'в архиве нет '+f);
      if(M.cw && !z.includes(Buffer.from('образц','utf8')) && !z.includes(Buffer.from('доска','utf8')) && !z.includes(Buffer.from('legend','utf8'))) log.push(tag+'в архиве не видно образца/доски расцветки (проверьте вручную)');
    }catch(e){ bad(tag+'архив не скачался: '+String(e).slice(0,100)); }
    await check('макет/задание/архив');
    // 10. необязательный перебор всех полей панели
    if(process.env.UI_FUZZ && ['бамбук','рейка','свой 3000×100','свой 500×500'].includes(M.n)){
      const ids=await p.evaluate(()=>[...document.querySelectorAll('#rail input,#rail select')].filter(e=>e.id&&!e.id.startsWith('viz-')&&e.type!=='file'&&e.id!=='i-preset'&&e.id!=='i-colorway').map(e=>e.id));
      let n=0;
      for(const id of ids){
        const orig=await p.evaluate(id=>{ const e=document.getElementById(id); return e.type==='checkbox'?e.checked:e.value; },id);
        const kind=await p.evaluate(id=>{ const e=document.getElementById(id); return e.tagName==='SELECT'?'select':e.type; },id);
        let vals;
        if(kind==='checkbox') vals=[!orig,orig];
        else if(kind==='select') vals=await p.evaluate(id=>[...document.getElementById(id).options].map(o=>o.value),id);
        else vals=['0','-5','1e9','','0.5','1'];
        for(const v of vals){
          await p.evaluate(({id,v})=>{ const e=document.getElementById(id); if(e.type==='checkbox') e.checked=v; else e.value=v; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); },{id,v});
          await p.waitForTimeout(60);
          const s=await p.evaluate(()=>window.__scan()); s.forEach(x=>bad(tag+'поле #'+id+'='+JSON.stringify(v)+': '+x));
          const nn=await p.evaluate(()=>window.__badNums()); nn.forEach(x=>bad(tag+'поле #'+id+'='+JSON.stringify(v)+': нечисловое '+x));
          if(errs.length) errs.splice(0).forEach(e=>bad(tag+'поле #'+id+'='+JSON.stringify(v)+': '+e));
          n++;
        }
        await p.evaluate(({id,orig})=>{ const e=document.getElementById(id); if(e.type==='checkbox') e.checked=orig; else e.value=orig; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); },{id,orig});
      }
      console.log(tag+'перебор полей: '+n+' значений');
    }
    console.log(tag+'готово за '+Math.round((Date.now()-t0)/1000)+' с; листов '+info.sheets+(info.failed?', не выкроено откосов '+info.failed:'')+', страниц печати '+pages+', правее печатного поля: '+JSON.stringify(wide));
    await p.close();
  }
  await b.close();
  log.forEach(l=>console.log('ℹ',l));
  console.log(fails?`ПРОВАЛЕНО: ${fails}`:'все проверки пройдены'); process.exit(fails?1:0);
})();
