// Совместимость старых проектов с каталогом расцветок: проект, где материалы заданы только типами
// ('bamboo29', 'marble', 'slat'), должен давать ТОТ ЖЕ раскрой, схему, смету и замечания, что в версии
// без каталога. Запуск:
//   git show <коммит-без-каталога>:raskroy.html > /tmp/old.html
//   RASKROY_OLD=/tmp/old.html NODE_PATH=$(npm root -g) node tests/catalog_compat.js
// Вторая часть (без RASKROY_OLD) проверяет саму модель: расцветка как материал, пул листов, сохранение
// и загрузка проекта, подмена исчезнувшей расцветки типом.
const {chromium}=require('playwright'); const path=require('path');
const NEW='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const OLD=process.env.RASKROY_OLD?'file://'+path.resolve(process.env.RASKROY_OLD):null;
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
let fails=0; const ok=(c,w)=>{ if(!c){ fails++; console.log('✗',w); } else console.log('✓',w); };

// проекты, описанные одними типами материалов
const PROJECTS={
  'одна стена, бамбук, проём с заполнением мрамором и откосами из рейки':{preset:'bamboo29',walls:[
    {id:1,name:'Стена',autoName:false,W:3800,H:2700,ceil:2700,rowH:0,
     ops:[{kind:'window',w:1340,h:1655,x:170,y:690,id:1,otkos:true,depth:200,otkosOverlap:0,fillMat:'marble',otkosMat:{right:'slat'},otkosMode:{}},
          {kind:'window',w:1250,h:1595,x:2290,y:765,id:2,otkos:true,depth:200,otkosOverlap:0,fillMat:null,otkosMat:{},otkosMode:{}}],
     opSeq:2,seamsU:[],seamSeq:0,vseamsU:[],vseamSeq:0,jointModes:{},pieceMats:{},
     edges:{top:'cap',bot:'none',left:'cap',right:'cap'},cout:0,cin:0,slot:null}]},
  'скала большая без проёмов':{preset:'rockL',walls:[
    {id:1,name:'Стена',autoName:false,W:5200,H:2600,ceil:2600,rowH:0,ops:[],opSeq:0,seamsU:[],seamSeq:0,vseamsU:[],vseamSeq:0,
     jointModes:{},pieceMats:{},edges:{top:'cap',bot:'none',left:'cap',right:'cap'},cout:0,cin:0,slot:null}]},
};
async function fingerprint(browser,url,name,proj){
  const p=await browser.newPage({viewport:{width:1500,height:1300}}); const errs=[];
  p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto(url); await p.waitForTimeout(500);
  const fp=await p.evaluate(({proj})=>{
    document.querySelector('#i-preset').value=proj.preset;
    document.querySelector('#i-preset').dispatchEvent(new Event('change'));
    walls.length=0; proj.walls.forEach(w=>walls.push(JSON.parse(JSON.stringify(w)))); active=0; wallToForm(); renderOpenings(); run();
    const t=s=>{ const e=document.querySelector(s); return e?e.innerHTML:''; };
    return {cut:t('#cutmap'),scheme:t('#scheme'),est:t('#estimate'),spec:t('#spec'),notes:t('#notes')};
  },{proj});
  await p.close(); return {fp,errs};
}
(async()=>{
  const browser=await chromium.launch({executablePath:EXE});
  if(OLD){
    for(const [name,proj] of Object.entries(PROJECTS)){
      const a=await fingerprint(browser,OLD,name,proj), b=await fingerprint(browser,NEW,name,proj);
      for(const k of ['cut','scheme','est','spec','notes']) ok(a.fp[k]===b.fp[k]&&a.fp[k].length>0||(k==='notes'&&a.fp[k]===b.fp[k]),`${name}: ${k} совпадает с версией без каталога (${a.fp[k].length} / ${b.fp[k].length})`);
      ok(!b.errs.length,`${name}: нет ошибок страницы ${b.errs.join('|')}`);
    }
  } else console.log('(RASKROY_OLD не задан — сверка со старой версией пропущена)');

  // ---- модель расцветок ----
  const p=await browser.newPage({viewport:{width:1500,height:1300}}); const errs=[];
  p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto(NEW); await p.waitForTimeout(500);
  const r=await p.evaluate(()=>{
    const out={};
    out.counts=Object.fromEntries(Object.entries(CATALOG.types).map(([t,x])=>[t,x.items.length]));
    out.imgs=Object.keys(CATALOG_IMG).length;
    out.allImg=Object.values(CATALOG.types).every(t=>t.items.every(i=>CATALOG_IMG[i.id]));
    out.uniqIds=new Set([...CAT_BY_ID.keys()]).size===Object.values(CATALOG.types).reduce((a,t)=>a+t.items.length,0);
    out.fm=findMat('bamboo29:8190'); out.fmType=findMat('bamboo29'); out.fmBad=findMat('bamboo29:нет');
    out.norm=[normMatId('bamboo29:8190'),normMatId('bamboo29:xxx'),normMatId('zzz:1'),normMatId(null),normMatId('slat')];
    out.col=[matColor('bamboo29'),matColor('bamboo29:8190'),condHex('bamboo29:8190'),condHex('bamboo29')];
    // выбор расцветки основного материала
    const sel=document.querySelector('#i-preset'); sel.value='bamboo29'; sel.dispatchEvent(new Event('change'));
    document.querySelector('#i-colorway').value='bamboo29:8190';
    out.cur1=curMatId();
    sel.value='slat'; sel.dispatchEvent(new Event('change'));       // смена типа сбрасывает расцветку
    out.cur2=curMatId(); out.cw2=document.querySelector('#i-colorway').value;
    return out;
  });
  ok(r.counts.bamboo29===39&&r.counts.slat===21&&r.counts.marble===8,'в каталоге 39 бамбук / 21 рейка / 8 мрамор '+JSON.stringify(r.counts));
  ok(r.imgs===70&&r.allImg,'миниатюра есть у каждой расцветки и у скал (70)');
  ok(r.uniqIds,'id расцветок уникальны');
  ok(r.fm&&r.fm.id==='bamboo29:8190'&&r.fm.pl===2900&&r.fm.pw===1150&&r.fm.name==='Бамбуковая панель 2900×1150 · 8190','findMat(расцветка) наследует размеры типа и называется артикулом: '+(r.fm&&r.fm.name));
  ok(r.fmType&&r.fmType.id==='bamboo29'&&!r.fmBad,'findMat: тип находится, неизвестная расцветка — undefined');
  ok(JSON.stringify(r.norm)==='["bamboo29:8190","bamboo29","null",null,"slat"]'.replace('"null"','null'),'normMatId: '+JSON.stringify(r.norm));
  ok(/^var\(--mat-bamboo29\)$/.test(r.col[0])&&/^#[0-9A-Fa-f]{6}$/.test(r.col[1])&&r.col[1]===r.col[2]&&/^#/.test(r.col[3]),'условные цвета: у типа — CSS-переменная, у расцветки — hex '+JSON.stringify(r.col));
  ok(r.cur1==='bamboo29:8190'&&r.cur2==='slat'&&r.cw2==='','curMatId: расцветка выбирается, смена типа её сбрасывает');

  // расчёт: расцветка в проёме и на детали — свой пул листов, отдельно от типа
  const calc=await p.evaluate(()=>{
    document.querySelector('#i-preset').value='bamboo29'; document.querySelector('#i-preset').dispatchEvent(new Event('change'));
    document.querySelector('#i-colorway').value='bamboo29:8190';
    walls.length=0; walls.push({id:1,name:'Стена',autoName:false,W:3800,H:2700,ceil:2700,rowH:0,
      ops:[{kind:'window',w:1340,h:1655,x:170,y:690,id:1,otkos:true,depth:200,otkosOverlap:0,fillMat:'slat:8190',otkosMat:{right:'marble:044'},otkosMode:{}}],
      opSeq:1,seamsU:[],seamSeq:0,vseamsU:[],vseamSeq:0,jointModes:{},pieceMats:{},edges:{top:'cap',bot:'none',left:'cap',right:'cap'},cout:0,cin:0,slot:null});
    active=0; wallToForm(); renderOpenings(); run();
    const R=LAST.R;
    return {pools:R.fills.map(f=>f.matId+'|'+f.matName),main:G_name(),cut:document.querySelector('#cutmap').innerText.slice(0,600)};
    function G_name(){ return (LAST.G||{}).presetName; }
  });
  ok(calc.pools.some(x=>x.startsWith('slat:8190')),'заполнение проёма расцветкой рейки — отдельный пул: '+JSON.stringify(calc.pools));
  ok(calc.pools.some(x=>x.includes('marble:044')),'откос из мрамора 044 — отдельный пул');
  ok(/8190/.test(calc.cut),'в карте раскроя название материала содержит артикул');

  // сохранение → загрузка проекта
  const saved=await p.evaluate(()=>JSON.parse(JSON.stringify(snapshot())));
  ok(saved.fields['i-colorway']==='bamboo29:8190','расцветка попала в файл проекта');
  const after=await p.evaluate(snap=>{
    document.querySelector('#i-colorway').value=''; document.querySelector('#i-preset').value='marble';
    applySnapshot(snap,true);
    return {cw:document.querySelector('#i-colorway').value,preset:document.querySelector('#i-preset').value,cur:curMatId(),notice:matLoadNotice,fill:walls[0].ops[0].fillMat};
  },saved);
  ok(after.cw==='bamboo29:8190'&&after.preset==='bamboo29'&&after.cur==='bamboo29:8190'&&after.notice==='','проект открылся с той же расцветкой '+JSON.stringify(after));
  // старый файл (без поля расцветки) после проекта с расцветкой — расцветка не «прилипает»
  const old=JSON.parse(JSON.stringify(saved)); delete old.fields['i-colorway'];
  const after2=await p.evaluate(snap=>{ applySnapshot(snap,true); return document.querySelector('#i-colorway').value; },old);
  ok(after2==='','файл без поля расцветки сбрасывает расцветку, а не наследует прежнюю');
  // исчезнувшая расцветка → тип + замечание
  const bad=JSON.parse(JSON.stringify(saved)); bad.fields['i-colorway']='bamboo29:удалена'; bad.walls[0].ops[0].fillMat='slat:удалена'; bad.walls[0].ops[0].otkosMat={right:'чужой'};
  const after3=await p.evaluate(snap=>{ applySnapshot(snap,true); return {cw:document.querySelector('#i-colorway').value,fill:walls[0].ops[0].fillMat,otk:walls[0].ops[0].otkosMat,notice:matLoadNotice,notes:document.querySelector('#notes').innerText}; },bad);
  ok(after3.cw===''&&after3.fill==='slat'&&Object.keys(after3.otk).length===0&&/удалена/.test(after3.notice)&&/расцветки/i.test(after3.notes),'исчезнувшая расцветка заменена типом, предупреждение показано '+JSON.stringify(after3).slice(0,200));
  ok(!errs.length,'ошибок страницы нет '+errs.join('|'));
  await browser.close();
  console.log(fails?`ПРОВАЛЕНО: ${fails}`:'все проверки пройдены'); process.exit(fails?1:0);
})();
