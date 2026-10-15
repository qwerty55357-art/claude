// Согласованность разделов: для каждого материала — насыщенный проект и N случайных проектов; после расчёта сверяем
// карточки, смету, спецификацию, карту раскроя, таблицу вырезов, схему и замечания между собой и с моделью расчёта.
// Запуск: NODE_PATH=$(npm root -g) [CONS_N=12] [CONS_ONLY=рейка] node tests/consistency.js
const {chromium}=require('playwright'); const path=require('path');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
const IN_PAGE=require('./lib/inpage.js');
const N=+(process.env.CONS_N||12);
const MATS=[
  {n:'бамбук',preset:'bamboo29'},{n:'бамбук V6',preset:'bamboo29',cw:'V6'},{n:'мрамор',preset:'marble'},{n:'мрамор 044',preset:'marble',cw:'044'},
  {n:'рейка',preset:'slat'},{n:'рейка 5139',preset:'slat',cw:'5139'},{n:'скала бол.',preset:'rockL'},{n:'скала мал.',preset:'rockS'},
  {n:'свой 1200×600',preset:'custom',pl:1200,pw:600},{n:'свой 3000×100',preset:'custom',pl:3000,pw:100},{n:'свой 500×500',preset:'custom',pl:500,pw:500},
].filter(m=>!process.env.CONS_ONLY||m.n.includes(process.env.CONS_ONLY)||m.preset===process.env.CONS_ONLY);
let fails=0; const byId={};
(async()=>{
  const b=await chromium.launch({executablePath:EXE});
  const p=await b.newPage({viewport:{width:1500,height:1100}}); const errs=[];
  p.on('pageerror',e=>errs.push('pageerror '+String(e).slice(0,200))); p.on('dialog',async d=>{ errs.push('диалог '+d.message().slice(0,100)); await d.accept(); });
  await p.goto(HTML); await p.waitForTimeout(500); await p.evaluate(IN_PAGE);
  for(const M of MATS){
    await p.selectOption('#i-preset',M.preset); await p.waitForTimeout(100);
    if(M.preset==='custom'){ await p.fill('#i-pl',String(M.pl)); await p.fill('#i-pw',String(M.pw)); }
    if(M.cw){ await p.locator('#i-cw-btn .mat-pick-btn').scrollIntoViewIfNeeded(); await p.locator('#i-cw-btn .mat-pick-btn').click(); await p.locator('#mat-menu .mp-tile',{hasText:M.cw}).first().click(); await p.waitForTimeout(200); }
    let n=0, bad=0;
    for(let s=-1;s<N;s++){
      const tag='['+M.n+(s<0?' насыщенный':' #'+s)+'] ';
      try{ await p.evaluate(s=>{ s<0?window.__rich():window.__rnd(s); },s); }catch(e){ console.log('✗',tag+'сборка проекта: '+String(e).slice(0,160)); fails++; continue; }
      const vio=await p.evaluate(()=>window.__consistency().concat(window.__scan().map(x=>'SCAN: '+x),window.__overlaps().map(x=>'OVERLAP: '+x),window.__badNums().map(x=>'NUM: '+x)));
      vio.forEach(v=>{ fails++; bad++; const id=v.split(':')[0]; byId[id]=(byId[id]||0)+1; if(bad<=6) console.log('✗',tag+v.slice(0,260)); });
      errs.splice(0).forEach(e=>{ fails++; console.log('✗',tag+e); });
      n++;
    }
    // задание для нейросети (макет комнаты, стена 1 насыщенного проекта) совпадает с моделью проекта
    try{
      await p.evaluate(()=>window.__rich()); await p.waitForTimeout(500);
      if(await p.isHidden('#viz-mock-box')){ await p.locator('.sect-h',{hasText:'Визуализация на фото'}).click(); await p.click('#viz-mock-toggle'); }
      await p.click('#viz-mock-make'); await p.waitForTimeout(1500); await p.click('#viz-json-copy'); await p.waitForTimeout(250);
      const j=JSON.parse(await p.inputValue('#viz-json-output'));
      const m=await p.evaluate(()=>{ const w=walls[0], L=LAST.R.layouts[0]; return {W:w.W,H:w.H,strips:L.strips.map(s=>[Math.round(s.start),Math.round(s.w)]),
        fills:w.ops.filter(o=>o.fillMat).length, led:LAST.R.led?LAST.R.led.len:0, mat:LAST.G.presetName, cw:document.querySelector('#i-colorway').value, ops:w.ops.length}; });
      const jw=j.walls[0]; const issue=[];
      if(jw.size_mm.width!==m.W||jw.size_mm.height!==m.H) issue.push('размер стены в задании '+JSON.stringify(jw.size_mm)+' != '+m.W+'×'+m.H);
      if(JSON.stringify(jw.panel_strips_mm.map(x=>[x.from_mm,x.size_mm]))!==JSON.stringify(m.strips)) issue.push('полосы в задании != полосам раскладки');
      if((jw.filled_openings||[]).length!==m.fills) issue.push('заполненных проёмов в задании '+(jw.filled_openings||[]).length+' != '+m.fills);
      if(!(jw.material&&jw.material.name&&jw.material.name.indexOf(m.mat.split(' ')[0])>=0)) issue.push('материал стены в задании «'+(jw.material&&jw.material.name)+'» не совпал с «'+m.mat+'»');
      const mats=(j.materials||[]).map(x=>x.name).join('|');
      if(M.preset!=='custom'&&mats.indexOf(m.mat.split(' ')[0])<0) issue.push('в списке materials нет основного материала: '+mats);
      issue.forEach(x=>{ fails++; console.log('✗','['+M.n+'] задание↔проект: '+x); });
    }catch(e){ fails++; console.log('✗','['+M.n+'] задание: '+String(e).slice(0,200)); }
    console.log(`[${M.n}] проектов: ${n}, нарушений: ${bad}`);
  }
  await b.close();
  console.log('по проверкам:',JSON.stringify(byId));
  console.log(fails?`ПРОВАЛЕНО: ${fails}`:'все проверки пройдены'); process.exit(fails?1:0);
})();
