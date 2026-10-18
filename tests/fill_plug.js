// Граница «бамбуковая панель ↔ реечная» (заполнение проёма во всю высоту): профиль по умолчанию — заглушка. Список стыков, меню стыка,
// схема, смета/спецификация, сохранение/открытие, прочие пары материалов. Запуск: NODE_PATH=$(npm root -g) node tests/fill_plug.js
const {chromium}=require('playwright'); const path=require('path');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
const IN_PAGE=require('./lib/inpage.js');
let fails=0; const ok=(c,w)=>{ if(!c){ fails++; console.log('✗',w); } else console.log('✓',w); };
(async()=>{
  const b=await chromium.launch({executablePath:EXE}); const p=await b.newPage({viewport:{width:1500,height:1300}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200))); p.on('dialog',async d=>{ errs.push('диалог '+d.message().slice(0,80)); await d.accept(); });
  await p.goto(HTML); await p.waitForTimeout(600); await p.evaluate(IN_PAGE);
  const settle=()=>p.waitForTimeout(800);
  const prof=()=>p.evaluate(()=>{ const o={}; LAST.R.prof.forEach(x=>{ o[x.key]=[Math.round(x.total),x.price,x.name]; }); return o; });
  const setup=(main,fill,opts)=>p.evaluate(([main,fill,opts])=>{
    walls=[newWall()]; cornerLinks=[]; active=0; const w=walls[0]; w.W=3000; w.H=2400; w.ops=[]; w.jointModes={}; wallToForm();
    const s=document.querySelector('#i-preset'); s.value=main; s.dispatchEvent(new Event('change',{bubbles:true}));
    w.ops.push({id:1,kind:'niche',w:800,h:opts&&opts.partial?1200:2400,x:1000,y:0,otkos:false,depth:0,otkosOverlap:0,otkosMode:{left:'corner',right:'corner',top:'corner',bottom:'corner'},fillMat:fill,anchorH:'left',mount:null,mountCut:true});
    wallToForm(); renderWallCompass(); renderOpenings(); run();
  },[main,fill,opts]);
  // --- бамбук + рейка: заглушка по умолчанию
  await setup('bamboo29','slat'); await settle();
  let pr=await prof();
  ok(pr.jointPlug&&pr.jointPlug[0]===4800&&/Заглушка · стык разных панелей/.test(pr.jointPlug[2])&&pr.jointPlug[1]===600,'бамбук + рейка: границы идут заглушкой 2×2400 по цене заглушки 600 ('+JSON.stringify(pr.jointPlug)+')');
  const fixedJV=pr.jointV?pr.jointV[0]:0;
  // стык-граница в списке стыков стены и его тип
  await p.locator('.sect-h',{hasText:'Объект'}).first().click().catch(()=>{});
  const sel=await p.evaluate(()=>[...document.querySelectorAll('#jointsv-list select')].map(s=>({v:s.value,opts:[...s.options].map(o=>o.value)})));
  ok(sel.filter(x=>x.opts.includes('plug')).length===2&&sel.filter(x=>x.opts.includes('plug')).every(x=>x.v==='plug'),'в списке стыков две границы: тип «Заглушка» выбран по умолчанию ('+JSON.stringify(sel.map(x=>x.v))+')');
  ok(sel.filter(x=>!x.opts.includes('plug')).every(x=>x.v==='cap'),'у обычных стыков полос варианта «Заглушка» нет');
  // в спецификации и в смете
  const spec=await p.evaluate(()=>document.querySelector('#spec').innerText+' || '+document.querySelector('#estimate').innerText);
  ok(/Заглушка · стык разных панелей/.test(spec),'заглушка границы есть в спецификации и в смете');
  // схема: линия границы цвета профиля
  ok(await p.evaluate(()=>{ const r=document.querySelector('#scheme .wall-scheme.on [data-jvfill]'); const ln=r&&r.previousElementSibling; return !!ln&&/alu/.test(ln.getAttribute('stroke')||''); }),'на схеме граница нарисована цветом профиля (не соломенным соединителем)');
  // меню границы: соединитель / заглушка / встык
  await p.locator('#scheme').scrollIntoViewIfNeeded();
  { const bb=await p.locator('#scheme .wall-scheme.on [data-jvfill]').first().boundingBox(); await p.mouse.click(bb.x+bb.width/2,bb.y+bb.height*0.2); await p.waitForTimeout(300); }
  const mt=await p.locator('#mat-menu').innerText();
  ok(/Соединитель/.test(mt)&&/Заглушка/.test(mt)&&/Встык/.test(mt),'меню границы: соединитель, заглушка, встык');
  await p.locator('#mat-menu button',{hasText:'Соединитель'}).click(); await settle();
  pr=await prof(); ok(pr.jointPlug[0]===2400&&pr.jointV[0]===fixedJV+2400,'«Соединитель» на одной границе: заглушка 2400 + соединитель +2400');
  // пользователь выбрал — это сохраняется и открытие проекта ничего не меняет
  const snap=await p.evaluate(()=>JSON.parse(JSON.stringify(snapshot())));
  await p.evaluate(()=>{ walls[0].jointModes={}; run(); }); await settle();
  await p.evaluate(s=>applySnapshot(s,true),snap); await settle();
  pr=await prof(); ok(pr.jointPlug[0]===2400&&pr.jointV[0]===fixedJV+2400,'после открытия проекта выбор пользователя сохранён');
  // цена заглушки — цена «Заглушка, хлыст»
  await p.locator('.sect-h',{hasText:'Цены'}).click(); await p.fill('#p-edge','777'); await settle();
  pr=await prof(); ok(pr.jointPlug[1]===777,'цена заглушки границы — поле «Заглушка, хлыст» ('+pr.jointPlug[1]+')');
  await p.fill('#p-edge','600');
  // выключен профиль на вертикальных стыках — граница встык
  await setup('bamboo29','slat'); await p.evaluate(()=>{ const c=document.querySelector('#i-joint-v'); c.checked=false; c.dispatchEvent(new Event('change',{bubbles:true})); run(); }); await settle();
  pr=await prof(); ok(!pr.jointPlug&&!pr.jointV,'профиль на вертикальных стыках выключен — граница встык, заглушки нет');
  await p.evaluate(()=>{ const c=document.querySelector('#i-joint-v'); c.checked=true; c.dispatchEvent(new Event('change',{bubbles:true})); });
  // рейка основная, бамбук в заполнении
  await setup('slat','bamboo29'); await settle();
  pr=await prof(); ok(pr.jointPlug&&pr.jointPlug[0]===4800,'рейка основная, бамбук в заполнении — тоже заглушка');
  // другие пары: бамбук + мрамор — соединитель
  await setup('bamboo29','marble'); await settle();
  pr=await prof(); ok(!pr.jointPlug&&pr.jointV&&pr.jointV[0]>=4800,'бамбук + мрамор: границы соединителем, заглушки нет');
  // заполнение не на всю высоту — не граница полос
  await setup('bamboo29','slat',{partial:true}); await settle();
  pr=await prof(); ok(!pr.jointPlug,'рейка не на всю высоту — стыка-границы нет, заглушки нет');
  // согласованность и ошибки
  await setup('bamboo29','slat'); await settle();
  const bad=await p.evaluate(()=>window.__scan().concat(window.__consistency()));
  ok(bad.length===0,'разделы согласованы, NaN нет: '+bad.join(' | '));
  ok(errs.length===0,'ошибок страницы нет '+errs.join(' | '));
  console.log(fails?('\nПРОВАЛЕНО: '+fails):'\nвсе проверки пройдены'); await b.close(); process.exit(fails?1:0);
})();
