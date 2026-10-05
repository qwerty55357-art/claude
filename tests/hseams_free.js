// Свободная расстановка ГОРИЗОНТАЛЬНЫХ (поперечных) стыков: включение не меняет раскладку (в т.ч. «кирпичную»),
// любой стык двигается цифрой / от соседнего стыка / мышью, «расставить» через равную длину куска,
// авто-стык длинного куска закрепляется, тип стыка едет вместе со стыком, сохранение в проект.
// Запуск: NODE_PATH=$(npm root -g) node tests/hseams_free.js
const {chromium}=require('playwright'); const path=require('path');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
let fails=0; const ok=(c,w)=>{ if(!c){ fails++; console.log('✗',w); } else console.log('✓',w); };
const near=(a,b,t=0.6)=>Math.abs(a-b)<=t;
(async()=>{
  const browser=await chromium.launch({executablePath:EXE}); const p=await browser.newPage({viewport:{width:1600,height:1100}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200))); p.on('dialog',async d=>{ errs.push('DIALOG '+d.message().slice(0,80)); await d.accept(); });
  await p.goto(HTML); await p.waitForTimeout(500);
  const wall=(extra)=>Object.assign({id:1,name:'Стена',autoName:false,W:3000,H:5200,ceil:5200,rowH:0,ops:[],opSeq:0,seamsU:[],seamSeq:0,vseamsU:[],vseamSeq:0,
    jointModes:{},pieceMats:{},edges:{top:'cap',bot:'none',left:'cap',right:'cap'},cout:0,cin:0,slot:null},extra||{});
  const setup=(w)=>p.evaluate(w0=>{ walls.length=0; walls.push(w0); active=0; wallToForm(); renderOpenings(); run(); },w);
  const sig=()=>p.evaluate(()=>JSON.stringify(LAST.R.layouts[0].pieces.map(x=>[x.strip,Math.round(x.from),Math.round(x.to)]).sort()));
  const cutsAt=()=>p.evaluate(()=>[...new Set(LAST.R.layouts[0].seams.map(s=>Math.round(s.pos)))].sort((a,b)=>a-b));
  await p.evaluate(()=>{ document.querySelector('#i-preset').value='bamboo29'; document.querySelector('#i-preset').dispatchEvent(new Event('change')); });
  await setup(wall());

  // ---- 1. включение не меняет раскладку; естественный стык (шаг листа 2900) становится ручным ----
  const base=await sig(); const cuts0=await cutsAt();
  ok(cuts0.join()==='2900','естественный горизонтальный стык одна: 2900 '+cuts0);
  await p.check('#i-hfree'); await p.waitForTimeout(400);
  ok(await sig()===base,'включение свободной расстановки не меняет раскладку');
  ok(await p.evaluate(()=>walls[0].hfree===true&&walls[0].seamsU.length===1&&Math.round(walls[0].seamsU[0].pos)===2900&&!walls[0].seamsU[0].scope),'естественный стык стал ручным (на все полосы)');

  // ---- 2. стык, заданный раньше, двигается цифрой; тип стыка едет вместе ----
  await p.evaluate(()=>{ walls[0].jointModes['h|2900|0']='butt'; run(); });
  await p.locator('[data-seampos]').nth(0).fill('2500'); await p.waitForTimeout(300);
  ok((await cutsAt()).join()==='2500','стык сдвинут с 2900 на 2500 (ровно на всех полосах)');
  ok(await p.evaluate(()=>walls[0].jointModes['h|2500|0']==='butt'&&!('h|2900|0' in walls[0].jointModes)),'тип стыка («встык») переехал вместе со стыком');

  // ---- 3. «от предыдущего стыка» ----
  await p.click('#btn-add-seam'); await p.waitForTimeout(300);          // новый стык посередине: 2600 → сдвигается, чтобы не совпасть
  const rowsN=await p.locator('[data-seamrow]').count();
  ok(rowsN===2,'добавлен второй стык');
  await p.locator('[data-seamgap]').nth(1).fill('1000'); await p.waitForTimeout(300);
  ok((await cutsAt()).some(c=>near(c,3500)),'второй стык = предыдущий (2500) + 1000 = 3500: '+(await cutsAt()));
  ok(await p.locator('[data-seampos]').nth(1).inputValue()==='3500','поле «от пола» обновилось само');

  // ---- 4. «расставить» ----
  await p.fill('#hseam-step','1000'); await p.selectOption('#hseam-from','l'); await p.click('#btn-hseam-fill'); await p.waitForTimeout(400);
  ok((await cutsAt()).join()==='1000,2000,3000,4000,5000','расставить снизу вверх через 1000: '+(await cutsAt()));
  await p.selectOption('#hseam-from','r'); await p.fill('#hseam-step','1200'); await p.click('#btn-hseam-fill'); await p.waitForTimeout(400);
  ok((await cutsAt()).join()==='400,1600,2800,4000','расставить сверху вниз через 1200: остаток 400 внизу: '+(await cutsAt()));
  await p.selectOption('#hseam-from','l'); await p.fill('#hseam-step','1000'); await p.click('#btn-hseam-fill'); await p.waitForTimeout(400);

  // ---- 5. удаляем два соседних стыка → кусок 3000 длиннее листа 2900: появляется авто-стык ----
  await p.locator('[data-seamdel]').nth(1).click(); await p.waitForTimeout(300);
  await p.locator('[data-seamdel]').nth(1).click(); await p.waitForTimeout(300);
  ok(await p.locator('[data-seamauto]').count()===1,'кусок длиннее листа делится автоматически — в списке строка «авто»');
  ok((await p.evaluate(()=>Math.max(...LAST.R.layouts[0].pieces.map(x=>x.len))))<=2900.5,'ни одна деталь не длиннее листа');
  await p.locator('[data-seamfix]').first().click(); await p.waitForTimeout(300);
  ok(await p.locator('[data-seamauto]').count()===0,'«закрепить» превращает авто-стык в ручной');

  // ---- 6. перетаскивание мышью ----
  await p.locator('#scheme').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  const sc=await p.evaluate(()=>document.querySelector('.wall-scheme.on svg').getScreenCTM().a);
  const beforeCuts=await cutsAt();
  const bb=await p.locator('[data-seamdrag]').nth(0).boundingBox();
  await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2); await p.mouse.down();
  await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2-Math.round(200*sc),{steps:8}); await p.mouse.up(); await p.waitForTimeout(500);
  const afterCuts=await cutsAt();
  ok(afterCuts.length===beforeCuts.length&&afterCuts.some((c,i)=>c>beforeCuts[i]+120),'перетаскивание стыка вверх на ~200 мм: '+beforeCuts+' → '+afterCuts);
  const bb2=await p.locator('[data-seamdrag]').nth(0).boundingBox();
  await p.mouse.move(bb2.x+bb2.width/2,bb2.y+bb2.height/2); await p.mouse.down();
  await p.mouse.move(bb2.x+bb2.width/2,bb2.y+bb2.height/2-Math.round(4000*sc),{steps:10}); await p.mouse.up(); await p.waitForTimeout(500);
  const afterCuts2=await cutsAt();
  ok(afterCuts2.every((v,i)=>i===0||v-afterCuts2[i-1]>=49.5),'стык не проходит через соседний (минимум 50 мм): '+afterCuts2);

  // ---- 7. естественный стык при перетаскивании сам включает свободную расстановку ----
  await p.evaluate(()=>{ walls[0].hfree=false; walls[0].seamsU=[]; wallToForm(); run(); });
  await p.waitForTimeout(300);
  const natB=await cutsAt();
  const bb3=await p.locator('[data-seamdrag]').nth(0).boundingBox();
  await p.mouse.move(bb3.x+bb3.width/2,bb3.y+bb3.height/2); await p.mouse.down();
  await p.mouse.move(bb3.x+bb3.width/2,bb3.y+bb3.height/2+Math.round(300*sc),{steps:8}); await p.mouse.up(); await p.waitForTimeout(500);
  const natA=await cutsAt();
  ok(await p.evaluate(()=>walls[0].hfree===true)&&await p.isChecked('#i-hfree')&&natA[0]<natB[0]-200,'естественный стык (шаг листа) перетащен вниз, свободная расстановка включилась сама: '+natB+' → '+natA);
  await p.evaluate(()=>{ walls[0].hfree=false; walls[0].seamsU=[]; wallToForm(); run(); });

  // ---- 8. «кирпичик»: включение не меняет раскладку, стыки получают область действия ----
  await p.evaluate(()=>{ const c=document.querySelector('#i-brick'); c.checked=true; c.dispatchEvent(new Event('change',{bubbles:true})); const w=walls[0]; w.W=4600; wallToForm(); run(); });
  await p.waitForTimeout(300);
  const brickCuts=await cutsAt(); const brickSig=await sig();
  ok(brickCuts.length>1,'«кирпичик» даёт разные отметки у соседних полос: '+brickCuts);
  await p.check('#i-hfree'); await p.waitForTimeout(400);
  ok(await sig()===brickSig,'включение на «кирпичной» раскладке не меняет ни одного шва');
  ok(await p.evaluate(()=>walls[0].seamsU.some(s=>s.scope==='even'||s.scope==='odd'||Array.isArray(s.scope))),'стыки получили область действия (чётные/нечётные полосы)');
  ok((await p.locator('#seams-list .hint').allInnerTexts()).some(t=>/полос/.test(t)),'в списке видно, на какие полосы действует стык');
  await p.evaluate(()=>{ const c=document.querySelector('#i-brick'); c.checked=false; c.dispatchEvent(new Event('change',{bubbles:true})); walls[0].W=3000; walls[0].hfree=false; walls[0].seamsU=[]; wallToForm(); run(); });

  // ---- 9. сохранение / открытие / отмена ----
  await p.check('#i-hfree'); await p.waitForTimeout(300);
  const snap=await p.evaluate(()=>JSON.parse(JSON.stringify(snapshot())));
  ok(snap.walls[0].hfree===true&&snap.walls[0].seamsU.length>=1&&!('i-hfree' in snap.fields),'свободные горизонтальные стыки сохраняются в стене, а не в общих полях');
  const re=await p.evaluate(sn=>{ walls[0].hfree=false; walls[0].seamsU=[]; applySnapshot(sn,true); return {v:walls[0].hfree,n:walls[0].seamsU.length,cb:document.querySelector('#i-hfree').checked}; },snap);
  ok(re.v&&re.n>=1&&re.cb,'при открытии проекта галочка и стыки на месте');

  // ---- 10. горизонтальная раскладка: стыки считаются от левого края ----
  await p.evaluate(()=>{ walls[0].hfree=false; walls[0].seamsU=[]; walls[0].W=5200; walls[0].H=3000; wallToForm(); });
  await p.selectOption('#i-orient','h'); await p.waitForTimeout(400);
  await p.check('#i-hfree'); await p.waitForTimeout(300);
  await p.fill('#hseam-step','1300'); await p.click('#btn-hseam-fill'); await p.waitForTimeout(400);
  ok((await cutsAt()).join()==='1300,2600,3900','горизонтальная раскладка: стыки через 1300 мм от левого края');
  ok((await p.locator('[data-seamrow] label').first().innerText()).toLowerCase().includes('от левого края'),'подпись поля — «от левого края»');
  ok(errs.length===0,'ошибок страницы нет '+errs.join('|'));
  await browser.close();
  console.log(fails?`ПРОВАЛЕНО: ${fails}`:'все проверки пройдены'); process.exit(fails?1:0);
})();
