// Реечная панель (2900×150) в проёмах: заполнение проёма — часть общего поля стены.
//  • схема рисует ту же раскладку, что и карта раскроя (границы реек, поперечные стыки);
//  • стыки стены (отметка 320) продолжаются в рейке; флажок проёма отключает это;
//  • границы рейка/бамбук — настоящие стыки (тип, профиль в спецификации, меню по клику, не двигаются);
//  • поперечные стыки в заполнении — отрезками поперёк всего проёма, тип выбирается кликом;
//  • заглушка по краю стены идёт вдоль заполнения;
//  • карта раскроя узких листов читаема и укладывается в печать; у реек нет поворота ↻ ни в автораскрое, ни вручную.
// Фикстура — проект с двумя проёмами 650×3020, заполненными рейкой, средней полосой из бамбука и стыком стены на 320 мм.
// Запуск: NODE_PATH=$(npm root -g) node tests/slat_fill.js
const {chromium}=require('playwright'); const path=require('path');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
let fails=0; const ok=(c,w)=>{ if(!c){ fails++; console.log('✗',w); } else console.log('✓',w); };
(async()=>{
  const b=await chromium.launch({executablePath:EXE}); const p=await b.newPage({viewport:{width:1500,height:1300}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200))); p.on('dialog',async d=>{ errs.push('DIALOG '+d.message().slice(0,80)); await d.accept(); });
  await p.goto(HTML); await p.waitForTimeout(500);
  const load=async()=>{ await p.locator('#file-load').setInputFiles(path.join(__dirname,'fixtures/slat_openings.json')); await p.waitForTimeout(1500); };
  await load();
  const state=()=>p.evaluate(()=>{
    const f=LAST.R.fills.find(x=>x.kind==='opening');
    const svg=document.querySelector('#cutmap svg[data-pool="slat:5139"]'); const vb=svg.getAttribute('viewBox').split(' ').map(Number);
    const prof={}; LAST.R.prof.forEach(x=>{ prof[x.key]=Math.round(x.total); });
    return {sheets:f.sheets.length, lens:[...new Set(f.sheets.flatMap(sh=>sh.list.map(o=>Math.round(o.len))))].sort((a,b)=>a-b),
      cross:document.querySelectorAll('#scheme .wall-scheme.on [data-fillcross]').length,
      cols:+svg.dataset.cols, norot:svg.dataset.norot, rotBtns:svg.querySelectorAll('[data-cmrot]').length, ratio:vb[2]/vb[3],
      bambooRot:document.querySelector('#cutmap svg[data-pool="piece:bamboo29:5139"]').querySelectorAll('[data-cmrot]').length,
      spec:document.querySelector('#spec').innerText, prof,
      fillJoints:LAST.R.layouts[0].joints.filter(j=>j.fill).map(j=>j.pos),
      bands:document.querySelectorAll('#scheme .wall-scheme.on svg line[stroke-opacity=".8"]').length,
      strips:f.layouts.map(l=>l.L.strips.length)};
  });
  let st=await state();
  // --- раскрой и схема
  ok(st.sheets===12&&st.lens.join()==='320,2700','рейка: 2700 + 320 по отметке стыка стены (12 листов), без добора 120 мм: '+st.sheets+' / '+st.lens);
  ok(st.cross===2,'на схеме 2 поперечных стыка заполнения (по одному на проём, пять реек склеены в один отрезок): '+st.cross);
  ok(st.bands===st.strips.reduce((a,n)=>a+n-1,0),`границ реек на схеме ${st.bands}, в раскрое ${st.strips.reduce((a,n)=>a+n-1,0)}`);
  ok(st.cols===12&&st.ratio>0.5,'карта раскроя узких листов: 12 колонок в ряд, пропорции '+st.ratio.toFixed(2)+' (было ~0.11)');
  ok(st.norot==='1'&&st.rotBtns===0,'у реечных деталей нет кнопки поворота ↻');
  ok(st.bambooRot>0,'у бамбуковой детали кнопка поворота осталась');
  ok(!/Панель Бамбуковая панель 2900×1150\s+0 шт/.test(st.spec),'в спецификации нет строки «0 шт» для основного материала');
  // --- профили
  ok(st.fillJoints.join()==='650,1790','два стыка-границы заполнения: на 650 и 1790 мм: '+st.fillJoints);
  ok(st.prof.jointV===6040,'вертикальные соединители = обе границы (2×3020): '+st.prof.jointV);
  ok(st.prof.edge===6040,'заглушка по краю стены идёт вдоль рейки (левый и правый край, 2×3020): '+st.prof.edge);
  ok(st.prof.jointH===2440,'горизонтальный соединитель на 320 мм идёт через все материалы: 1140+650+650 = '+st.prof.jointH);
  // --- тип стыка по клику на схеме
  await p.locator('#scheme').scrollIntoViewIfNeeded();
  const clickEl=async sel=>{ const bb=await p.locator(sel).first().boundingBox(); await p.mouse.click(bb.x+bb.width/2,bb.y+bb.height/2); await p.waitForTimeout(300); };
  await clickEl('#scheme .wall-scheme.on [data-fillseam]');
  ok(/стык в заполнении/i.test(await p.locator('#mat-menu').innerText()),'клик по стыку в рейке открывает меню «Стык в заполнении»');
  await p.locator('#mat-menu button',{hasText:'Встык'}).click(); await p.waitForTimeout(500);
  st=await state(); ok(st.prof.jointH===2440-650,'«встык» для стыка в рейке убирает его профиль (−650): '+st.prof.jointH);
  await p.locator('#scheme').scrollIntoViewIfNeeded();
  { const bb=await p.locator('#scheme .wall-scheme.on [data-jvfill]').first().boundingBox();   // у границы лежит номер LED-отрезка из фикстуры — кликаем выше него
    await p.mouse.click(bb.x+bb.width/2,bb.y+bb.height*0.2); await p.waitForTimeout(300); }
  const mt=await p.locator('#mat-menu').innerText();
  ok(/Соединитель/.test(mt)&&/Встык/.test(mt)&&!/Закрепить|перемещаемыми/.test(mt),'у границы рейка/бамбук меню — только тип стыка, без «Закрепить/перемещаемыми»');
  await p.locator('#mat-menu button',{hasText:'Встык'}).click(); await p.waitForTimeout(500);
  st=await state(); ok(st.prof.jointV===3020,'«встык» для границы убирает профиль границы (−3020): '+st.prof.jointV);
  // граница не двигается мышью и не включает свободную расстановку
  await p.locator('#scheme').scrollIntoViewIfNeeded();
  { const bb=await p.locator('#scheme .wall-scheme.on [data-jvfill]').first().boundingBox();
    await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height*0.2); await p.mouse.down(); await p.mouse.move(bb.x+bb.width/2+40,bb.y+bb.height*0.2,{steps:6}); await p.mouse.up(); await p.waitForTimeout(400);
    ok(await p.evaluate(()=>walls[0].vfree===true)&&await p.evaluate(()=>walls[0].vseamsU.length===0),'граница заполнения не двигается (свободная расстановка уже была включена в фикстуре, стыков не добавилось)'); }
  await p.keyboard.press('Escape'); await p.evaluate(()=>closeMatMenu());
  // --- флажок «Стыки стены продолжаются в заполнении»
  await load();
  await p.locator('#openings [data-fillseams], #openings [data-k="fillSeams"]').first().scrollIntoViewIfNeeded();
  ok(await p.locator('#openings [data-k="fillSeams"]').first().isChecked(),'в карточке проёма-заполнения флажок «Стыки стены продолжаются…» включён (заполнение во всю высоту)');
  await p.locator('#openings [data-k="fillSeams"]').first().uncheck(); await p.locator('#openings [data-k="fillSeams"]').nth(1).uncheck(); await p.waitForTimeout(800);
  st=await state(); ok(st.sheets===11&&st.lens.join()==='120,2900','с выключенным флажком — как раньше: 2900 + 120 (11 листов): '+st.sheets+' / '+st.lens);
  // --- поворот: галочка «Однотонная панель» для рейки недоступна и не вращает детали откосов
  await load();
  await p.evaluate(()=>{ const s=document.querySelector('#i-preset'); s.value='slat'; s.dispatchEvent(new Event('change',{bubbles:true})); const r=document.querySelector('#i-rot'); r.disabled=false; r.checked=true; r.dispatchEvent(new Event('change',{bubbles:true})); });
  await p.waitForTimeout(600);
  ok(await p.evaluate(()=>collect().rot===false),'основной материал — рейка: collect().rot = false даже при включённой галочке');
  await p.selectOption('#i-preset','bamboo29'); await p.waitForTimeout(400);
  ok(await p.evaluate(()=>!document.querySelector('#i-rot').disabled),'у бамбука галочка «Однотонная панель» доступна');
  // --- печать
  await load();
  await p.emulateMedia({media:'print'});
  const pdf=await p.pdf({format:'A4',printBackground:true});
  const pages=(pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length;
  ok(pages>0&&pages<=9,'печать: '+pages+' стр. (было 14)');
  ok(errs.length===0,'ошибок страницы нет '+errs.join('|'));
  await b.close();
  console.log(fails?`ПРОВАЛЕНО: ${fails}`:'все проверки пройдены'); process.exit(fails?1:0);
})();
