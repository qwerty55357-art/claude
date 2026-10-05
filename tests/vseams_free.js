// Свободная расстановка вертикальных стыков: любой стык двигается (цифрой от левого края, цифрой
// «от предыдущего стыка», мышью на схеме), «расставить» делает стыки через равную ширину полосы,
// авто-границы широких участков можно закрепить, тип стыка едет вместе со стыком, состояние
// сохраняется в проект и откатывается отменой. Запуск: NODE_PATH=$(npm root -g) node tests/vseams_free.js
const {chromium}=require('playwright'); const path=require('path');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
let fails=0; const ok=(c,w)=>{ if(!c){ fails++; console.log('✗',w); } else console.log('✓',w); };
const near=(a,b,t=0.6)=>Math.abs(a-b)<=t;
(async()=>{
  const browser=await chromium.launch({executablePath:EXE}); const p=await browser.newPage({viewport:{width:1600,height:1100}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200))); p.on('dialog',async d=>{ errs.push('DIALOG '+d.message().slice(0,80)); await d.accept(); });
  await p.goto(HTML); await p.waitForTimeout(500);
  await p.evaluate(()=>{
    document.querySelector('#i-preset').value='bamboo29'; document.querySelector('#i-preset').dispatchEvent(new Event('change'));
    walls.length=0; walls.push({id:1,name:'Стена',autoName:false,W:4200,H:2700,ceil:2700,rowH:0,ops:[],opSeq:0,seamsU:[],seamSeq:0,vseamsU:[],vseamSeq:0,
      jointModes:{},pieceMats:{},edges:{top:'cap',bot:'none',left:'cap',right:'cap'},cout:0,cin:0,slot:null});
    active=0; wallToForm(); renderOpenings(); run();
  });
  const strips=()=>p.evaluate(()=>LAST.R.layouts[0].strips.map(s=>[Math.round(s.start*10)/10,Math.round(s.w*10)/10]));
  const joints=async()=>(await strips()).slice(1).map(s=>s[0]);

  // ---- 1. включение не меняет раскладку, все границы становятся ручными стыками ----
  const base=await strips();
  ok(base.length===4&&base.map(s=>s[1]).join()==='950,1150,1150,950','симметричная раскладка 4200: 950/1150/1150/950 '+JSON.stringify(base.map(s=>s[1])));
  await p.check('#i-vfree'); await p.waitForTimeout(400);
  const afterOn=await strips();
  ok(JSON.stringify(afterOn)===JSON.stringify(base),'включение свободной расстановки не меняет раскладку');
  ok(await p.evaluate(()=>walls[0].vfree===true&&walls[0].vseamsU.length===3),'три естественные границы стали ручными стыками');
  ok(await p.locator('[data-vseamrow]').count()===3,'в списке три редактируемых стыка');

  // ---- 2. любой (бывший фиксированный) стык двигается цифрой от левого края ----
  await p.locator('[data-vseampos]').nth(0).fill('700'); await p.waitForTimeout(300);
  let st=await strips();
  ok(near(st[0][1],700)&&near(st[1][0],700),'первый (бывший фиксированный 950) стык сдвинут на 700: '+JSON.stringify(st.map(s=>s[1])));
  ok(st.map(s=>s[1]).join()==='700,700,700,1150,950','участок 700–2100 (1400) шире листа — поделён автоматически: '+JSON.stringify(st.map(s=>s[1])));
  ok(await p.locator('[data-vseamauto]').count()===1&&await p.locator('[data-vseamrow]').count()===3,'в списке 3 ручных стыка и 1 строка «авто»');
  // ---- 3. замер «от предыдущего стыка»: предыдущим считается и авто-граница ----
  const gapInp=p.locator('[data-vseamgap]');
  ok((await gapInp.nth(1).inputValue())==='700','«от предыдущего» у стыка 2100 считается от авто-границы 1400 → 700');
  await gapInp.nth(1).fill('1000'); await p.waitForTimeout(300);
  ok(near((await joints()).find(j=>j>2000&&j<2500),2400),'стык = предыдущая граница (1400) + 1000 = 2400');
  await p.locator('[data-vseamgap]').nth(2).fill('700'); await p.waitForTimeout(300);
  ok((await joints()).some(j=>near(j,3100)),'следующий стык = 2400 + 700 = 3100');
  ok(await p.locator('[data-vseampos]').nth(2).inputValue()==='3100','поле «от левого края» обновилось само');

  // ---- 4. «расставить» через 700 слева: ровно 6 полос ----
  await p.fill('#vseam-step','700'); await p.selectOption('#vseam-from','l'); await p.click('#btn-vseam-fill'); await p.waitForTimeout(400);
  st=await strips();
  ok(st.length===6&&st.every(s=>near(s[1],700)),'расставить через 700: шесть полос по 700 '+JSON.stringify(st.map(s=>s[1])));
  ok(await p.evaluate(()=>walls[0].vseamsU.length===5),'пять ручных стыков');
  // справа налево: остаток слева
  await p.fill('#vseam-step','1000'); await p.selectOption('#vseam-from','r'); await p.click('#btn-vseam-fill'); await p.waitForTimeout(400);
  st=await strips();
  ok(st.map(s=>s[1]).join()==='200,1000,1000,1000,1000'||st.map(s=>Math.round(s[1])).join()==='200,1000,1000,1000,1000','расставить справа налево по 1000: остаток 200 слева '+JSON.stringify(st.map(s=>s[1])));
  await p.fill('#vseam-step','700'); await p.selectOption('#vseam-from','l'); await p.click('#btn-vseam-fill'); await p.waitForTimeout(400);

  // ---- 5. удаление стыка: участок 1400 шире листа — делится автоматически, авто-стык можно закрепить ----
  await p.locator('[data-vseamdel]').nth(2).click(); await p.waitForTimeout(400);
  st=await strips();
  ok(st.length===6&&await p.locator('[data-vseamauto]').count()===1,'после удаления стыка на 1400-участке появилась авто-граница, полос по-прежнему 6');
  await p.locator('[data-vseamfix]').first().click(); await p.waitForTimeout(300);
  ok(await p.locator('[data-vseamauto]').count()===0&&await p.evaluate(()=>walls[0].vseamsU.length===5),'«закрепить» превращает авто-границу в ручной стык');

  // ---- 6. тип стыка и LED едут вместе со стыком ----
  const mv=await p.evaluate(()=>{
    const w=walls[0]; const sm=w.vseamsU.slice().sort((a,b)=>a.pos-b.pos)[0];
    const key='v|'+Math.round(sm.pos)+'|0'; w.jointModes[key]='led';
    ledCircuits.push({id:1,kind:'joint',legs:[{wall:1,el:'jointV',pos:Math.round(sm.pos),segStart:0}]});
    run();
    return {id:sm.id,old:sm.pos};
  });
  await p.locator(`[data-vseamrow="${mv.id}"] [data-vseampos]`).fill('500'); await p.waitForTimeout(300);
  const moved=await p.evaluate(()=>({jm:Object.keys(walls[0].jointModes),led:ledCircuits[0]&&ledCircuits[0].legs[0].pos,mode:walls[0].jointModes['v|500|0']}));
  ok(moved.mode==='led'&&!moved.jm.includes('v|'+Math.round(mv.old)+'|0'),'тип стыка (LED) переехал на новую позицию '+JSON.stringify(moved));
  ok(moved.led===500,'привязка LED-контура переехала вместе со стыком');
  await p.evaluate(()=>{ ledCircuits.length=0; });

  // ---- 7. перетаскивание мышью на схеме ----
  await p.locator('#scheme').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  const before=await joints();
  const rect=p.locator('[data-jvclick]').nth(1); const bb=await rect.boundingBox();
  const scale=await p.evaluate(()=>{ const r=document.querySelector('.wall-scheme.on svg').getScreenCTM(); return r.a; });   // px на мм
  await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2); await p.mouse.down();
  await p.mouse.move(bb.x+bb.width/2+60*scale/ (scale)*0+ 100*scale*0+ 0,bb.y+bb.height/2,{steps:2});
  await p.mouse.move(bb.x+bb.width/2+Math.round(120*scale),bb.y+bb.height/2,{steps:6}); await p.mouse.up(); await p.waitForTimeout(500);
  const after=await joints();
  ok(after.length===before.length&&after[1]>before[1]+80&&after[1]<before[1]+160,'перетаскивание второго стыка на схеме вправо ≈ на 120 мм: '+before[1]+' → '+after[1]);
  ok(near(after[1]%10,0,0.6)||near(after[1]%10,10,0.6),'стык ложится на шаг 10 мм');
  // не перескакивает через соседа
  const bb2=await p.locator('[data-jvclick]').nth(1).boundingBox();
  await p.mouse.move(bb2.x+bb2.width/2,bb2.y+bb2.height/2); await p.mouse.down();
  await p.mouse.move(bb2.x+bb2.width/2+Math.round(3000*scale),bb2.y+bb2.height/2,{steps:8}); await p.mouse.up(); await p.waitForTimeout(500);
  const after2=await joints();
  ok(after2.every((v,i)=>i===0||v-after2[i-1]>=49.5),'стык не проходит через соседний — минимум 50 мм полосы: '+JSON.stringify(after2));
  ok(after2.some((v,i)=>i&&near(after2[i]-after2[i-1],50,1)),'упёрся в соседа ровно на 50 мм');

  // ---- 8. естественный стык в обычной стене: перетаскивание само включает свободную расстановку ----
  await p.evaluate(()=>{ walls[0].vfree=false; walls[0].vseamsU=[]; wallToForm(); run(); });
  await p.waitForTimeout(300);
  const nat=await joints();
  const bb3=await p.locator('[data-jvclick]').nth(0).boundingBox();
  await p.mouse.move(bb3.x+bb3.width/2,bb3.y+bb3.height/2); await p.mouse.down();
  await p.mouse.move(bb3.x+bb3.width/2+Math.round(100*scale),bb3.y+bb3.height/2,{steps:6}); await p.mouse.up(); await p.waitForTimeout(500);
  const nat2=await joints();
  ok(await p.evaluate(()=>walls[0].vfree===true&&walls[0].vseamsU.length===3),'перетаскивание естественного стыка включило свободную расстановку (3 ручных стыка)');
  ok(nat2.length===nat.length&&nat2[0]>nat[0]+60&&await p.isChecked('#i-vfree'),'и сдвинуло именно этот стык: '+nat[0]+' → '+nat2[0]);
  // клик без движения по стыку — меню, а не перенос
  const bb4=await p.locator('[data-jvclick]').nth(1).boundingBox(); const keep=await joints();
  await p.mouse.click(bb4.x+bb4.width/2,bb4.y+bb4.height/2); await p.waitForTimeout(300);
  ok(await p.locator('#mat-menu').count()===1&&JSON.stringify(await joints())===JSON.stringify(keep),'клик по стыку открывает меню и ничего не двигает');
  await p.keyboard.press('Escape'); await p.evaluate(()=>closeMatMenu());

  // ---- 8б. сценарий «чередующиеся материалы по 70 см»: полосы по 700, нечётные — другой материал ----
  const alt=await p.evaluate(()=>{
    const w=walls[0]; w.vfree=true; w.vseamsU=[]; w.vseamSeq=0; [700,1400,2100,2800,3500].forEach(pos=>addUserVSeam(w,pos)); wallToForm(); run();
    const L=LAST.R.layouts[0]; L.pieces.forEach((pc,i)=>{ if(i%2) w.pieceMats[pc.pk]='marble:044'; else w.pieceMats[pc.pk]='bamboo29:8190'; });
    run();
    const R=LAST.R; return {strips:LAST.R.layouts[0].strips.map(s=>Math.round(s.w)),pools:R.fills.map(f=>f.matId+':'+f.sheets.length),failed:R.failed.length,pieces:LAST.R.layouts[0].pieces.length};
  });
  ok(alt.strips.join()==='700,700,700,700,700,700','стена 4200 = шесть полос по 700 мм');
  ok(alt.pools.some(x=>x.startsWith('piece:marble:044'))&&alt.pools.some(x=>x.startsWith('piece:bamboo29:8190')),'чередующиеся материалы по полосам дают свои пулы листов: '+alt.pools.join(' '));
  ok(alt.failed===0,'раскрой без нераскроенных деталей');
  // горизонтальная раскладка тоже работает
  const hz=await p.evaluate(()=>{
    document.querySelector('#i-orient').value='h'; document.querySelector('#i-orient').dispatchEvent(new Event('change',{bubbles:true}));
    const w=walls[0]; w.pieceMats={}; w.vfree=true; w.vseamsU=[]; w.vseamSeq=0; [900,1800].forEach(pos=>addUserVSeam(w,pos)); wallToForm(); run();
    const r=LAST.R.layouts[0]; return {vert:r.vert,strips:r.strips.map(s=>Math.round(s.w))};
  });
  ok(hz.vert===false&&hz.strips.join()==='900,900,900','горизонтальная раскладка: стыки от пола, полосы 900/900/900 при H=2700 '+JSON.stringify(hz));
  await p.evaluate(()=>{ document.querySelector('#i-orient').value='v'; document.querySelector('#i-orient').dispatchEvent(new Event('change',{bubbles:true})); const w=walls[0]; w.vfree=true; w.vseamsU=[]; w.vseamSeq=0; [950,2100,3250].forEach(pos=>addUserVSeam(w,pos)); wallToForm(); run(); });

  // ---- 9. сохранение, отмена ----
  const snap=await p.evaluate(()=>JSON.parse(JSON.stringify(snapshot())));
  ok(snap.walls[0].vfree===true&&snap.walls[0].vseamsU.length===3&&!('i-vfree' in snap.fields),'свободная расстановка сохраняется в стене, а не в общих полях проекта');
  const reopened=await p.evaluate(sn=>{ walls[0].vfree=false; walls[0].vseamsU=[]; applySnapshot(sn,true); return {v:walls[0].vfree,n:walls[0].vseamsU.length,cb:document.querySelector('#i-vfree').checked}; },snap);
  ok(reopened.v&&reopened.n===3&&reopened.cb,'при открытии проекта галочка и стыки на месте');
  await p.uncheck('#i-vfree'); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>walls[0].vfree===false),'выключение возвращает автоматические границы (стыки остаются дополнительными разрезами)');
  ok(errs.length===0,'ошибок страницы нет '+errs.join('|'));
  await browser.close();
  console.log(fails?`ПРОВАЛЕНО: ${fails}`:'все проверки пройдены'); process.exit(fails?1:0);
})();
