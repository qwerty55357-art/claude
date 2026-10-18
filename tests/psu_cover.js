// Цены по умолчанию (прайс), блок питания по формуле «длина ленты (м) × 10 Вт + 50%» из ряда 100/150/200/300/400 Вт с ценой по номиналу,
// накладной Г-образный угол (тип угла, размер 15/20/30 мм, цена, смета/спецификация), открытие старых проектов.
// Запуск: NODE_PATH=$(npm root -g) node tests/psu_cover.js
const {chromium}=require('playwright'); const path=require('path');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
const IN_PAGE=require('./lib/inpage.js');
let fails=0; const ok=(c,w)=>{ if(!c){ fails++; console.log('✗',w); } else console.log('✓',w); };
(async()=>{
  const b=await chromium.launch({executablePath:EXE}); const p=await b.newPage({viewport:{width:1500,height:1300}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200))); p.on('dialog',async d=>{ errs.push('диалог '+d.message().slice(0,80)); await d.accept(); });
  await p.goto(HTML); await p.waitForTimeout(600); await p.evaluate(IN_PAGE);
  const val=id=>p.inputValue(id);
  // --- цены по умолчанию
  const D={'#p-panel':'5500','#p-glue':'700','#p-edge':'600','#p-joint':'600','#p-cout':'600','#p-cin':'600','#p-cover15':'700','#p-cover20':'800','#p-cover30':'900','#p-ledprof':'1700','#p-ledjoint':'1700','#p-led':'220',
    '#p-psu100':'1300','#p-psu150':'1800','#p-psu200':'2100','#p-psu300':'4800','#p-psu400':'5500','#i-ledw':'10','#i-psur':'50','#i-coverw':'15'};
  const bad=[]; for(const [k,v] of Object.entries(D)) if(await val(k)!==v) bad.push(k+'='+await val(k)+' (нужно '+v+')');
  ok(bad.length===0,'цены и параметры LED по умолчанию совпадают с прайсом '+bad.join(', '));
  ok(await p.evaluate(()=>PRESETS.slice(0,6).map(x=>x.id+':'+x.price).join()==='bamboo29:5500,marble:5500,slat:1600,rockL:25000,rockS:9500,custom:4500'),'цены материалов по умолчанию: бамбук/мрамор 5500, рейка 1600, скалы 25000 и 9500');
  ok(await p.evaluate(()=>PSU_NOMINALS.join()==='100,150,200,300,400'),'ряд блоков питания: 100, 150, 200, 300, 400 Вт');
  // --- блок питания по формуле L×10×1.5, цена по номиналу
  const cases=[[0.5,1,100,1300],[4,1,100,1300],[6.6,1,100,1300],[6.7,1,150,1800],[10,1,150,1800],[13.4,1,300,4800],[20,1,300,4800],[26.6,1,400,5500],[26.7,2,300,9600],[60,3,300,14400]];
  let allOk=true, msg=[];
  for(const [L,cnt,w,sum] of cases){
    const r=await p.evaluate(L=>{ document.querySelector('#i-ledlen').value=L; run(); const l=LAST.R.led; const row=[...document.querySelectorAll('#estimate tbody tr')].find(tr=>/Блок питания/.test(tr.innerText)); return {need:l.need,cnt:l.psuCount,w:l.psuW,sum:row?+row.children[3].innerText.replace(/[^\d]/g,''):null,name:row&&row.children[0].innerText}; },L);
    const good=Math.abs(r.need-L*15)<1e-6&&r.cnt===cnt&&r.w===w&&r.sum===sum&&new RegExp('Блок питания '+w+' Вт').test(r.name);
    if(!good){ allOk=false; msg.push(L+' м → '+JSON.stringify(r)); }
  }
  ok(allOk,'блок питания: нужно = длина (м) × 10 + 50%, номинал, число блоков и сумма в смете '+msg.join(' | '));
  const spec=await p.evaluate(()=>document.querySelector('#spec').innerText);
  ok(/Блок питания/.test(spec)&&/Вт/.test(spec),'в спецификации указан блок питания');
  await p.evaluate(()=>{ document.querySelector('#i-ledlen').value=0; run(); });
  // цена конкретного номинала редактируется
  await p.evaluate(()=>{ document.querySelector('#i-ledlen').value=10; document.querySelector('#p-psu150').value=2000; run(); });
  ok(await p.evaluate(()=>[...document.querySelectorAll('#estimate tbody tr')].some(tr=>/Блок питания 150 Вт/.test(tr.innerText)&&/2 000/.test(tr.children[3].innerText.replace(/ /g,' ')))),'цена блока 150 Вт правится в «Ценах» и попадает в смету');
  await p.evaluate(()=>{ document.querySelector('#i-ledlen').value=0; document.querySelector('#p-psu150').value=1800; run(); });
  // --- накладной угол
  await p.evaluate(()=>window.__rich()); await p.waitForTimeout(700);
  const prof=()=>p.evaluate(()=>{ const o={}; LAST.R.prof.forEach(x=>{ o[x.key]=[Math.round(x.total),x.price,x.name]; }); return o; });
  const base=await prof();
  ok(await p.locator('#wall-compass [data-ctype]').count()===3&&/накладные/i.test(await p.locator('#wall-compass').innerText()),'в блоке «Стены и углы» три переключателя типа: внешние, внутренние, накладные');
  await p.locator('#wall-compass [data-ctype="over"]').click(); await p.waitForTimeout(600);
  const o1=await prof();
  const sumLen=o=>(o.cout?o.cout[0]:0)+(o.cin?o.cin[0]:0)+(o.cover?o.cover[0]:0);
  ok(o1.cover&&o1.cover[1]===700&&/Г 15 мм/.test(o1.cover[2])&&sumLen(o1)===sumLen(base),'все углы накладные: «Угол накладной Г 15 мм» по 700, общая длина угловых профилей та же ('+JSON.stringify(o1.cover)+')');
  ok(await p.evaluate(()=>cornerLinks.every(c=>c.type==='over')),'у всех углов тип «накладной»');
  await p.selectOption('#i-coverw','30'); await p.waitForTimeout(500);
  const o2=await prof(); ok(o2.cover&&o2.cover[1]===900&&/Г 30 мм/.test(o2.cover[2])&&o2.cover[0]===o1.cover[0],'размер 30 мм: цена 900, длина профиля та же ('+JSON.stringify(o2.cover)+')');
  await p.locator('.sect-h',{hasText:'Цены'}).click(); await p.fill('#p-cover30','950'); await p.waitForTimeout(500);
  ok((await prof()).cover[1]===950,'цена накладного угла правится в «Ценах»');
  ok(/Угол накладной Г 30 мм/.test(await p.evaluate(()=>document.querySelector('#estimate').innerText)),'в смете — «Угол накладной Г 30 мм»');
  // тип одного угла вручную через меню
  await p.locator('#wall-compass [data-ctype="out"]').click(); await p.waitForTimeout(500);
  await p.locator('#wall-compass [data-cpedit]').first().click(); await p.waitForTimeout(250);
  ok(/Накладной Г-образный профиль/.test(await p.locator('#mat-menu').innerText()),'в меню угла есть тип «Накладной Г-образный профиль»');
  await p.locator('#mat-menu button',{hasText:'Накладной Г-образный профиль'}).click(); await p.waitForTimeout(600);
  const o3=await prof();
  ok(o3.cover&&o3.cout&&o3.cover[0]>0&&o3.cout[0]>0,'один угол накладной, остальные внешние: есть и «накладной», и «внешний» ('+JSON.stringify([o3.cover,o3.cout])+')');
  ok(await p.evaluate(()=>{ const c=cornerLinks[0]; return c.type==='over'&&c.typeOv==='over'; }),'ручной тип закреплён за углом');
  // сохранение/открытие
  const snap=await p.evaluate(()=>JSON.parse(JSON.stringify(snapshot())));
  ok(snap.fields['i-coverw']==='30'&&snap.fields['p-cover30']==='950'&&snap.cornerLinks[0].typeOv==='over','размер, цена и тип накладного угла сохраняются в проект');
  await p.selectOption('#i-coverw','15'); await p.evaluate(s=>applySnapshot(s,true),snap); await p.waitForTimeout(600);
  ok(await val('#i-coverw')==='30'&&(await prof()).cover[1]===950,'после открытия проекта накладной угол прежний');
  // цвет на плане
  ok(await p.evaluate(()=>!!document.querySelector('#plan-canvas g[data-cpedit] circle')),'угол на плане нарисован');
  // --- старый проект: единая цена блока питания переносится на все номиналы, старые параметры LED и цены сохраняются
  const old=JSON.parse(JSON.stringify(snap));
  ['p-psu100','p-psu150','p-psu200','p-psu300','p-psu400','p-cover15','p-cover20','p-cover30','i-coverw'].forEach(k=>delete old.fields[k]);
  old.fields['p-psu']='2500'; old.fields['i-ledw']='14.4'; old.fields['i-psur']='30'; old.fields['p-edge']='900'; old.fields['p-led']='600';
  old.cornerLinks.forEach(c=>{ delete c.typeOv; c.type='out'; }); old.cornerType='out';
  await p.evaluate(s=>applySnapshot(s,true),old); await p.waitForTimeout(700);
  const vs=[]; for(const n of [100,150,200,300,400]) vs.push(await val('#p-psu'+n));
  ok(vs.every(v=>v==='2500'),'старый проект: единая цена блока питания 2500 перенесена на все номиналы ('+vs+')');
  ok(await val('#i-ledw')==='14.4'&&await val('#i-psur')==='30'&&await val('#p-edge')==='900'&&await val('#p-led')==='600','старый проект сохранил свои параметры LED и цены');
  ok(await val('#i-coverw')==='15'&&await val('#p-cover20')==='800','у старого проекта размер накладного угла и цены — по умолчанию');
  await p.evaluate(()=>{ document.querySelector('#i-ledlen').value=0; });
  // --- задание для нейросети: накладной угол описан
  await p.evaluate(()=>{ window.__rich(); }); await p.waitForTimeout(500);
  await p.locator('#wall-compass [data-ctype="over"]').click(); await p.waitForTimeout(500);
  ok(await p.evaluate(()=>cornerLinks.every(c=>c.type==='over')),'(снова все накладные)');
  const bad2=await p.evaluate(()=>window.__scan().concat(window.__consistency()));
  ok(bad2.length===0,'разделы согласованы, NaN нет: '+bad2.join(' | '));
  ok(errs.length===0,'ошибок страницы нет '+errs.join(' | '));
  console.log(fails?('\nПРОВАЛЕНО: '+fails):'\nвсе проверки пройдены'); await b.close(); process.exit(fails?1:0);
})();
