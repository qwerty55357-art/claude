// Перебор ВСЕХ полей боковой панели (размеры, расчёт, профили, клей, цены, проёмы и их настройки, откосы…) крайними и
// странными значениями: 0, минус, огромное, пусто, дробное, текст, каждый вариант списков, оба состояния флажков.
// После каждого значения: нет ошибок страницы и диалогов, нет NaN/undefined/Infinity в выводе и в результате расчёта.
// Запуск: NODE_PATH=$(npm root -g) [FUZZ_ONLY=рейка] node tests/fuzz_fields.js
const {chromium}=require('playwright'); const path=require('path');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
const IN_PAGE=require('./lib/inpage.js');
const MATS=[{n:'бамбук',preset:'bamboo29'},{n:'рейка',preset:'slat'},{n:'свой 3000×100',preset:'custom',pl:3000,pw:100},{n:'свой 500×500',preset:'custom',pl:500,pw:500}]
  .filter(m=>!process.env.FUZZ_ONLY||m.n.includes(process.env.FUZZ_ONLY));
let fails=0; const seen=new Set();
(async()=>{
  const b=await chromium.launch({executablePath:EXE});
  for(const M of MATS){
    const p=await b.newPage({viewport:{width:1500,height:1100}}); const errs=[];
    p.on('pageerror',e=>errs.push('pageerror '+String(e).slice(0,160))); p.on('dialog',async d=>{ errs.push('диалог '+d.message().slice(0,80)); await d.accept(); });
    await p.goto(HTML); await p.waitForTimeout(400); await p.evaluate(IN_PAGE);
    await p.selectOption('#i-preset',M.preset);
    if(M.preset==='custom'){ await p.fill('#i-pl',String(M.pl)); await p.fill('#i-pw',String(M.pw)); }
    await p.evaluate(()=>{ clearTimeout(scene3dTimer); window.scheduleScene3D=function(){}; window.flushScene3D=function(){}; });      // 3D не нужен — ускоряем перебор
    await p.evaluate(()=>window.__rich()); await p.waitForTimeout(300);
    // описатели полей: по id или по data-op/data-k (проёмы), остальные data-* — если выбирают элемент однозначно
    const descr=await p.evaluate(()=>{
      const out=[]; document.querySelectorAll('#rail input,#rail select,#rail textarea').forEach(el=>{
        if(el.type==='file'||el.id==='i-preset'||el.id==='i-colorway'||(el.id||'').startsWith('viz-')) return;
        let sel=null;
        if(el.id) sel='#'+el.id;
        else if(el.dataset.k&&el.closest('[data-op]')) sel='[data-op="'+el.closest('[data-op]').dataset.op+'"] [data-k="'+el.dataset.k+'"]';
        else{ const k=Object.keys(el.dataset)[0]; if(k){ const q='[data-'+k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())+'="'+el.dataset[k]+'"]'; if(document.querySelectorAll(q).length===1) sel=q; } }
        if(sel) out.push(sel);
      }); return [...new Set(out)];
    });
    if(process.env.FUZZ_LIST){ console.log(JSON.stringify(descr)); await p.close(); await b.close(); return; }
    const only=process.env.FUZZ_SEL?[process.env.FUZZ_SEL]:descr;
    let steps=0;
    const setVal=(sel,v)=>p.evaluate(({sel,v})=>{ const e=document.querySelector(sel); if(!e) return false;
      if(e.type==='checkbox') e.checked=v; else e.value=v; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true; },{sel,v});
    for(const sel of only){
      const t0=Date.now(); const st0=steps;
      const info=await p.evaluate(sel=>{ const e=document.querySelector(sel); if(!e) return null; return {orig:e.type==='checkbox'?e.checked:e.value,kind:e.tagName==='SELECT'?'select':e.type,opts:e.tagName==='SELECT'?[...e.options].map(o=>o.value):null}; },sel);
      if(!info) continue;
      const vals=process.env.FUZZ_VALS?JSON.parse(process.env.FUZZ_VALS):info.kind==='checkbox'?[!info.orig,info.orig]:info.kind==='select'?info.opts:['','0','-5','1e9','0.5','99999','abc'];
      for(const v of vals){
        if(!(await setVal(sel,v))) break;
        steps++;
        const bad=await p.evaluate(()=>window.__scan().map(x=>'SCAN: '+x).concat(window.__badNums().map(x=>'NUM: '+x)));
        const all=bad.concat(errs.splice(0));
        all.forEach(x=>{ const key=sel+'|'+x.slice(0,60); if(seen.has(key)) return; seen.add(key); fails++; console.log('✗','['+M.n+'] '+sel+' = '+JSON.stringify(v)+': '+x.slice(0,240)); });
      }
      await setVal(sel,info.orig);
      const el=await p.evaluate(sel=>!!document.querySelector(sel),sel); if(!el) continue;
      await p.evaluate(()=>{ errs=null; }).catch(()=>{});
      errs.splice(0);
      if(process.env.FUZZ_VERBOSE) console.log('  '+sel+': '+(steps-st0)+' знач., '+(Date.now()-t0)+' мс');
    }
    console.log('['+M.n+'] полей: '+only.length+', значений: '+steps);
    await p.close();
  }
  await b.close();
  console.log(fails?`ПРОВАЛЕНО: ${fails}`:'все проверки пройдены'); process.exit(fails?1:0);
})();
