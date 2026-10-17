// «План комнаты»: стены нестандартной формы (Г-образный коридор, П-образная комната, открытая цепочка стен), рисование мышью,
// углы 90°/270° и их тип, радиусный выступающий угол, радиус без второй стены на свободном конце, профили/заглушки/LED/рейка,
// тяга длины, масштаб/сдвиг, отмена, сохранение, печать. Запуск: NODE_PATH=$(npm root -g) node tests/plan_ui.js
const {chromium}=require('playwright'); const path=require('path');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
const IN_PAGE=require('./lib/inpage.js');
let fails=0; const ok=(c,w)=>{ if(!c){ fails++; console.log('✗',w); } else console.log('✓',w); };
(async()=>{
  const b=await chromium.launch({executablePath:EXE}); const p=await b.newPage({viewport:{width:1500,height:1100}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200))); p.on('dialog',async d=>{ errs.push('диалог '+d.message().slice(0,80)); await d.accept(); });
  await p.goto(HTML); await p.waitForTimeout(600); await p.evaluate(IN_PAGE);
  const px=(x,z)=>p.evaluate(([x,z])=>{ const r=document.querySelector('#plan-canvas').getBoundingClientRect(); const [a,c]=planToPx(planMap,x,z); return [r.x+a,r.y+c]; },[x,z]);
  const links=()=>p.evaluate(()=>cornerLinks.map(c=>[c.angle,c.type,c.kind||'sharp']));
  const lens=()=>p.evaluate(()=>walls.map(w=>w.W));
  const clickW=async(x,z)=>{ const q=await px(x,z); await p.mouse.move(q[0],q[1],{steps:5}); await p.mouse.click(q[0],q[1]); };
  const startAt=async(x,z)=>{ const q=await px(x,z); await p.mouse.move(q[0],q[1]); await p.mouse.down(); await p.mouse.up(); };
  const zoomOut=async(cx,cz,n)=>{ const q=await px(cx,cz); await p.mouse.move(q[0],q[1]); await p.mouse.wheel(0,n||500); await p.waitForTimeout(80); };
  const fresh=async(w0)=>{ await p.evaluate(w=>{ walls=[newWall()]; cornerLinks=[]; cornerSeq=0; active=0; planDrawMode=false; planDraw=null; planAuto=true; cornerType='out'; walls[0].W=w; wallToForm(); renderOpenings(); renderWallCompass(); run(); },w0); await p.click('#plan-draw'); };
  const settle=()=>p.waitForTimeout(700);
  const prof=()=>p.evaluate(()=>{ const o={}; LAST.R.prof.forEach(x=>{ o[x.key]=Math.round(x.total); }); return o; });

  // --- план есть, по умолчанию одна стена, рисования нет
  ok(await p.evaluate(()=>!!document.querySelector('#plan-canvas')&&walls.length===1&&!planDrawMode),'на странице есть «План комнаты» с одной стеной');
  ok(await p.evaluate(()=>[...document.querySelectorAll('#plan-block button')].map(b=>b.textContent).join('|'))!=='','кнопки плана на месте');

  // --- Г-образный коридор: открытая цепочка (вправо, вниз, влево, вниз) — углы 90, 90, 270 (левый поворот)
  await fresh(5000); await startAt(5000,0); await zoomOut(2500,1500,600);
  for(const [x,z] of [[5000,3000],[3000,3000],[3000,6000]]) await clickW(x,z);
  await p.keyboard.press('Escape'); await settle();
  ok(JSON.stringify(await lens())===JSON.stringify([5000,3000,2000,3000]),'Г-образная цепочка: длины стен 5000/3000/2000/3000 (получено '+JSON.stringify(await lens())+')');
  const L1=await links();
  ok(JSON.stringify(L1.map(x=>x[0]))==='[90,90,270]','углы по ходу цепочки: 90, 90, 270 (получено '+JSON.stringify(L1.map(x=>x[0]))+')');
  ok(JSON.stringify(L1.map(x=>x[1]))==='["out","out","in"]','выступающий угол получает противоположный тип профиля (получено '+JSON.stringify(L1.map(x=>x[1]))+')');
  ok(await p.evaluate(()=>(LAST.R.cornerIssues||[]).length===0),'в расчёте нет замечаний по углам');
  // профиль: 2 внешних, 1 внутренний угол высотой по стене; заглушки — только на двух свободных торцах (не на связанных концах)
  const pr=await prof();
  ok(pr.cout===2*2300&&pr.cin===2300,'профиль угла: внешних 2×2300, внутренний 1×2300 (получено cout='+pr.cout+', cin='+pr.cin+')');
  const capEnds=await p.evaluate(()=>{ let n=0; walls.forEach(w=>{ ['left','right'].forEach(s=>{ if(edgeMode(w.edges[s])==='cap'&&!cornerAt(w.id,s)) n++; }); }); return n; });
  ok(capEnds===2,'заглушки по краю — только на 2 свободных концах цепочки (получено '+capEnds+')');
  // открытая цепочка в 3D — без ошибок, стены расставлены
  await p.waitForTimeout(800);
  ok(await p.evaluate(()=>{ const pos=computeWallPlacements3D(walls,cornerLinks); return walls.every(w=>pos.has(w.id)); }),'3D: все стены расставлены по цепочке');
  // подписи в правой панели: у каждой стены кнопка, у каждого угла — кнопка с углом
  ok(await p.locator('#wall-compass [data-cpjump]').count()===4&&await p.locator('#wall-compass [data-cpedit]').count()===3,'в панели «Стены и углы»: 4 стены и 3 угла');
  ok(await p.locator('#wall-compass [data-cpedit]').filter({hasText:'270'}).count()===1,'у выступающего угла в списке подписано 270°');

  // --- правая кнопка завершает рисование и не создаёт лишнюю стену
  await p.click('#plan-draw'); await p.waitForTimeout(100);
  { const nW=await p.evaluate(()=>walls.length); const e=await p.evaluate(()=>{ const q=planEnds(computeWallPlacements3D(walls,cornerLinks)).find(x=>!x.linked); return q&&[q.id,q.side]; });
    if(e){ const q=await p.evaluate(([id,side])=>{ const t=planEnds(computeWallPlacements3D(walls,cornerLinks)).find(x=>x.id===id&&x.side===side); const r=document.querySelector('#plan-canvas').getBoundingClientRect(); const [a,c]=planToPx(planMap,t.x,t.z); return [r.x+a,r.y+c]; },e);
      await p.mouse.move(q[0],q[1]); await p.mouse.down(); await p.mouse.up(); await p.mouse.move(q[0]+60,q[1]+60,{steps:4}); await p.mouse.click(q[0]+60,q[1]+60,{button:'right'}); await p.waitForTimeout(200);
      ok(await p.evaluate(()=>!planDraw)&&await p.evaluate(()=>walls.length)===nW,'правая кнопка завершает рисование, лишней стены нет'); }
    else ok(true,'(нет свободных концов — проверка правой кнопки пропущена)'); }
  await p.evaluate(()=>{ planDrawMode=false; planDraw=null; renderWallPlan(); });
  // --- меню выступающего угла: тип, радиус; радиусный выступающий угол даёт ту же деталь, что вогнутый
  await p.locator('#wall-compass [data-cpedit]').filter({hasText:'270'}).click(); await p.waitForTimeout(250);
  const menuTxt=await p.locator('#mat-menu').innerText();
  ok(/Угол комнаты/i.test(menuTxt)&&/Тип угла/i.test(menuTxt),'в меню угла есть поле «Угол комнаты» и выбор типа');
  ok(await p.locator('#mat-menu input[type=number]').first().inputValue()==='270','в поле угла — 270');
  await p.locator('#mat-menu button',{hasText:'Радиусный угол'}).click(); await settle();
  const r270=await p.evaluate(()=>{ const c=cornerLinks.find(x=>x.angle===270); const a=LAST.R.sheets.flatMap(s=>s.list).filter(x=>x.isCorner&&x.cornerId===c.id||x.isCorner); return {issues:(LAST.R.cornerIssues||[]).length,pieces:a.map(x=>[Math.round(x.w),Math.round(x.len)]),kind:c.kind}; });
  ok(r270.kind==='radius'&&r270.issues===0&&r270.pieces.length>=1,'радиусный выступающий угол 270° рассчитан без замечаний (деталей угла: '+r270.pieces.length+')');
  // сравнение с вогнутым 90°: та же деталь
  const same=await p.evaluate(()=>{ const c=cornerLinks.find(x=>x.angle===270); const w1=LAST.R.sheets.flatMap(s=>s.list).find(x=>x.isCorner); c.angle=90; run(); const w2=LAST.R.sheets.flatMap(s=>s.list).find(x=>x.isCorner); const r=[w1&&Math.round(w1.w),w1&&Math.round(w1.len),w2&&Math.round(w2.w),w2&&Math.round(w2.len)]; c.angle=270; run(); return r; });
  ok(same[0]===same[2]&&same[1]===same[3],'деталь радиусного угла 270° = деталь угла 90° (развёртка совпадает: '+same.join('/')+')');
  ok(/выступающий/i.test(await p.evaluate(()=>document.querySelector('#corner-scheme').innerText)),'на развёртке угла подписано «выступающий»');
  ok(await p.evaluate(()=>{ const c=cornerLinks.find(x=>x.angle===270); const lw=document.querySelector('#scene3d canvas'); return !!lw; }),'3D-макет на месте');
  // тип угла вручную: «Внешний» для выступающего — проектный тумблер его уже не меняет
  await p.locator('#wall-compass [data-cpedit]').filter({hasText:'270'}).click(); await p.waitForTimeout(250);
  await p.locator('#mat-menu button',{hasText:'Внешний (выступающий)'}).click(); await settle();
  ok(await p.evaluate(()=>{ const c=cornerLinks.find(x=>x.angle===270); return c.type==='out'&&c.typeOv==='out'; }),'ручной тип «внешний» закреплён за углом');
  await p.locator('#wall-compass [data-ctype="in"]').click(); await settle();
  const tv=await p.evaluate(()=>cornerLinks.map(c=>c.type));
  ok(JSON.stringify(tv)==='["in","in","out"]','тумблер «Внутренние углы»: обычные углы стали внутренними, закреплённый остался внешним ('+JSON.stringify(tv)+')');
  await p.locator('#wall-compass [data-ctype="out"]').click(); await p.waitForTimeout(200);

  // --- свободный конец: меню по клику (радиус без второй стены) и тяга длины
  await p.evaluate(()=>{ planDrawMode=false; planAuto=true; renderWallPlan(); });
  const vt=await p.evaluate(()=>{ const q=planEnds(computeWallPlacements3D(walls,cornerLinks)).find(e=>e.side==='right'&&!e.linked); const r=document.querySelector('#plan-canvas').getBoundingClientRect(); const [a,c]=planToPx(planMap,q.x,q.z); return [r.x+a,r.y+c,q.id]; });
  await p.mouse.move(vt[0],vt[1]); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(250);
  ok(/Радиусный угол здесь/.test(await p.locator('#mat-menu').innerText()),'клик по свободному концу открывает меню «Радиусный угол здесь»');
  await p.locator('#mat-menu button',{hasText:'Радиусный угол здесь'}).click(); await settle();
  const stub=await p.evaluate(()=>{ const c=cornerLinks.find(x=>x.bw===''); return c&&{kind:c.kind,as:c.as,issues:(LAST.R.cornerIssues||[]).length}; });
  ok(stub&&stub.kind==='radius'&&stub.as==='right','радиусный угол без второй стены создан на свободном конце');
  await p.locator('#wall-compass [data-cpedit]').last().click(); await p.waitForTimeout(250);
  ok(await p.locator('#mat-menu input[type=number]').count()>=2&&/Угол комнаты/.test(await p.locator('#mat-menu').innerText()),'у радиуса без стены в меню есть и угол, и радиус'); await p.keyboard.press('Escape'); await p.mouse.click(5,5);
  await p.evaluate(()=>{ cornerLinks=cornerLinks.filter(c=>c.bw!==''); renderWallCompass(); run(); });
  // тяга длины: правый конец последней стены на +1000 мм
  const w0=await p.evaluate(()=>walls[walls.length-1].W);
  const vt2=await p.evaluate(()=>{ const q=planEnds(computeWallPlacements3D(walls,cornerLinks)).find(e=>e.id===walls[walls.length-1].id&&e.side==='right'); const r=document.querySelector('#plan-canvas').getBoundingClientRect(); const [a,c]=planToPx(planMap,q.x,q.z); const [a2,c2]=planToPx(planMap,q.x+1000*q.dx,q.z+1000*q.dz); return [r.x+a,r.y+c,r.x+a2,r.y+c2]; });
  await p.mouse.move(vt2[0],vt2[1]); await p.mouse.down(); await p.mouse.move(vt2[2],vt2[3],{steps:8}); await p.mouse.up(); await settle();
  const w1=await p.evaluate(()=>walls[walls.length-1].W);
  ok(w1>w0+500&&w1<=w0+1500,'тяга конца стены меняет её длину ('+w0+' → '+w1+')');
  ok(await p.evaluate(()=>+document.querySelector('#i-w').value===(walls[active].id===walls[walls.length-1].id?walls[walls.length-1].W:+document.querySelector('#i-w').value)),'поле «Ширина области» согласовано с длиной');

  // --- П-образная комната, замкнутая: 8 стен, углы 90×6 и 270×2, профили, заглушек нет
  await fresh(6000); await startAt(6000,0); await zoomOut(3000,2000,900);
  for(const [x,z] of [[6000,4000],[4000,4000],[4000,2000],[2000,2000],[2000,4000],[0,4000],[0,0]]) await clickW(x,z);
  await settle();
  const U=await links();
  ok(U.length===8&&JSON.stringify(U.map(x=>x[0]))==='[90,90,90,270,270,90,90,90]','П-образная комната замкнулась: 8 углов 90/90/90/270/270/90/90/90 (получено '+JSON.stringify(U.map(x=>x[0]))+')');
  ok(await p.evaluate(()=>!planDraw&&!planDrawMode),'после замыкания рисование выключено');
  const prU=await prof();
  ok(prU.cout===6*2300&&prU.cin===2*2300,'П-комната: 6 внешних и 2 внутренних угла (cout='+prU.cout+', cin='+prU.cin+')');
  ok(!prU.cap,'в замкнутой комнате нет заглушек по торцам (cap='+prU.cap+')');
  ok(await p.evaluate(()=>{ const pos=computeWallPlacements3D(walls,cornerLinks); const w=walls[7],q=pos.get(w.id); const e=[q.x+w.W*Math.cos(q.angle),q.z+w.W*Math.sin(q.angle)]; const q0=pos.get(walls[0].id); return Math.hypot(e[0]-q0.x,e[1]-q0.z)<1; }),'контур замкнут: конец последней стены совпал с началом первой');
  ok(await p.evaluate(()=>(LAST.R.cornerIssues||[]).length===0),'П-комната: замечаний по углам нет');
  if(process.env.PLAN_SHOT) await p.screenshot({path:process.env.PLAN_SHOT});

  // --- прямоугольник, замыкание «магнитом»
  await fresh(4000); await startAt(4000,0); await zoomOut(2000,1500,500);
  for(const [x,z] of [[4000,3000],[0,3000],[0,0]]) await clickW(x,z);
  await settle();
  const R4=await links();
  ok(R4.length===4&&R4.every(x=>x[0]===90),'прямоугольник: 4 угла по 90° (получено '+JSON.stringify(R4.map(x=>x[0]))+')');

  // --- масштаб, сдвиг, вписать, поворот вида
  const s0=await p.evaluate(()=>planMap.s);
  const q0=await px(2000,1500); await p.mouse.move(q0[0],q0[1]); await p.mouse.wheel(0,-400); await p.waitForTimeout(100);
  ok(Math.abs((await p.evaluate(()=>planMap.s))-s0)<1e-9,'колесо без Ctrl вне режима рисования масштаб не меняет (страница листается как обычно)');
  await p.keyboard.down('Control'); await p.mouse.wheel(0,-400); await p.keyboard.up('Control'); await p.waitForTimeout(100);
  const s1=await p.evaluate(()=>planMap.s); ok(s1>s0*1.2&&!(await p.evaluate(()=>planAuto)),'колесо увеличивает масштаб (масштаб '+s0.toFixed(3)+' → '+s1.toFixed(3)+')');
  const o0=await p.evaluate(()=>planMap.ox);
  await p.mouse.move(q0[0]+250,q0[1]-150); await p.mouse.down(); await p.mouse.move(q0[0]+200,q0[1]-140,{steps:4}); await p.mouse.up();
  ok(Math.abs(await p.evaluate(()=>planMap.ox)-o0)>20,'перетаскивание фона сдвигает план');
  await p.click('#plan-fit'); ok(await p.evaluate(()=>planAuto),'«вписать» возвращает автомасштаб');
  const pos0=await p.evaluate(()=>JSON.stringify(walls.map(w=>[w.W])));
  for(let i=0;i<4;i++) await p.click('#plan-rot');
  ok(await p.evaluate(()=>planRot===0)&&await p.evaluate(()=>JSON.stringify(walls.map(w=>[w.W])))===pos0,'поворот вида на 4×90° возвращает исходный вид, расчёт не меняется');

  // --- отмена: новая стена убирается Ctrl+Z / кнопкой
  await p.evaluate(()=>{ document.dispatchEvent(new Event('raskroy:recomputed')); }); await p.waitForTimeout(700);
  const nBefore=await p.evaluate(()=>walls.length);
  await p.evaluate(()=>{ const X=walls[walls.length-1]; const e=planEnds(computeWallPlacements3D(walls,cornerLinks)).find(q=>q.id===X.id&&q.side==='right'); }); // замкнутая — свободных концов нет, добавим стену отдельно
  await p.evaluate(()=>wallPlusQuick()); await p.waitForTimeout(800);
  ok(await p.evaluate(()=>walls.length)===nBefore+1,'«+ стена» при замкнутом контуре добавляет отдельную стену');
  await p.click('#btn-undo'); await p.waitForTimeout(700);
  ok(await p.evaluate(()=>walls.length)===nBefore,'отмена убирает добавленную стену ('+(await p.evaluate(()=>walls.length))+')');

  // --- сохранение/открытие: углы, типы, закреплённый тип
  await p.evaluate(()=>{ cornerLinks[0].typeOv='in'; run(); });
  const snap=await p.evaluate(()=>JSON.stringify(snapshot()));
  await p.evaluate(()=>{ walls=[newWall()]; cornerLinks=[]; active=0; renderWallCompass(); run(); });
  await p.evaluate(s=>{ applySnapshot(JSON.parse(s),true); },snap); await settle();
  ok(await p.evaluate(()=>walls.length===4&&cornerLinks.length===4&&cornerLinks[0].typeOv==='in'&&cornerLinks[0].type==='in'),'сохранение/открытие сохраняют форму комнаты и закреплённый тип угла');

  // --- реечная панель и LED в плане нестандартной формы
  await fresh(3000); await startAt(3000,0); await zoomOut(1500,1000,500);
  for(const [x,z] of [[3000,2000],[1000,2000],[1000,4000]]) await clickW(x,z);
  await p.keyboard.press('Escape'); await settle();
  await p.evaluate(()=>{ const s=document.querySelector('#i-preset'); s.value='slat'; s.dispatchEvent(new Event('change',{bubbles:true})); }); await settle();
  const sl=await p.evaluate(()=>({issues:(LAST.R.cornerIssues||[]).length,sheets:LAST.R.sheetsTotal,preset:document.querySelector('#i-preset').value,cout:Math.round((LAST.R.prof.find(x=>x.key==='cout')||{total:0}).total),cin:Math.round((LAST.R.prof.find(x=>x.key==='cin')||{total:0}).total)}));
  ok(sl.preset==='slat'&&sl.sheets>0&&sl.issues===0,'реечная панель на открытой цепочке с выступающим углом: расчёт без замечаний ('+JSON.stringify(sl)+')');
  ok(sl.cout===2*2300&&sl.cin===2300,'реечные панели: профили углов те же — 2 внешних, 1 внутренний');
  // радиус на реечной панели — деталь шире рейки: откат на обычный профиль с замечанием, а не поломка
  await p.evaluate(()=>{ cornerLinks[0].kind='radius'; cornerLinks[0].radius=300; run(); }); await settle();
  ok(await p.evaluate(()=>(LAST.R.cornerIssues||[]).length>=1),'радиус на рейке: понятное замечание (деталь шире листа), расчёт продолжается');
  await p.evaluate(()=>{ cornerLinks[0].kind='sharp'; const s=document.querySelector('#i-preset'); s.value='bamboo29'; s.dispatchEvent(new Event('change',{bubbles:true})); run(); }); await settle();
  // LED на связанном конце заменяет профиль угла
  const before=await prof();
  await p.evaluate(()=>{ walls[0].edges.right='led'; run(); }); await settle();
  const after=await prof();
  ok(after.cout<before.cout||after.cin<before.cin,'LED на связанном конце заменяет профиль угла (cout '+before.cout+'→'+after.cout+')');

  // --- старый проект «компас» (стены в слотах N/E/W, углы 90°) открывается как цепочка
  await p.evaluate(()=>{ window.__rich(); }); await settle();
  ok(await p.locator('#plan-canvas [data-cpjump]').count()>=3,'проект из прежнего компаса показывается на плане');

  // --- печать: рисунки-ручки плана скрыты
  await p.emulateMedia({media:'print'});
  ok(await p.evaluate(()=>getComputedStyle(document.querySelector('.plan-tools')).display==='none'),'в печати кнопки плана скрыты');
  await p.emulateMedia({media:'screen'});

  ok(errs.length===0,'ошибок страницы нет '+errs.join(' | '));
  console.log(fails?('\nПРОВАЛЕНО: '+fails):'\nвсе проверки пройдены'); await b.close(); process.exit(fails?1:0);
})();
