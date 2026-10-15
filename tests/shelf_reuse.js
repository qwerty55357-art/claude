// Место, освободившееся после переноса деталей на верстак, должно быть доступно для другой детали:
// деталь, брошенная туда, остаётся там (раньше ушедшие на верстак детали продолжали «занимать» своё
// прежнее место, и перенос на освободившийся участок молча отклонялся — деталь «улетала» обратно).
// Запуск: NODE_PATH=$(npm root -g) node tests/shelf_reuse.js
const {chromium}=require('playwright'); const path=require('path');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
let fails=0; const ok=(c,w)=>{ if(!c){ fails++; console.log('✗',w); } else console.log('✓',w); };
(async()=>{
  const b=await chromium.launch({executablePath:EXE}); const p=await b.newPage({viewport:{width:1500,height:1000}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  await p.goto(HTML); await p.waitForTimeout(500);
  await p.locator('#file-load').setInputFiles(path.join(__dirname,'fixtures/slat_openings.json')); await p.waitForTimeout(1500);
  const sel='#cutmap svg[data-pool="slat:5139"]';
  const drag=async(el,toFn)=>{
    const bb=await el.boundingBox(); await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2); await p.mouse.down();
    await p.mouse.move(bb.x+bb.width/2+10,bb.y+bb.height/2+10,{steps:3});
    const t=await toFn(); await p.mouse.move(t.x,t.y,{steps:12}); await p.waitForTimeout(150); await p.mouse.up(); await p.waitForTimeout(500);
  };
  const uidOf=l=>p.evaluate(l=>{ const f=LAST.R.fills.find(x=>x.kind==='opening'); for(const sh of f.sheets) for(const o of sh.list) if(o.label===l) return o._uid; },l);
  const where=l=>p.evaluate(l=>{ const f=LAST.R.fills.find(x=>x.kind==='opening'); for(const sh of f.sheets) for(const o of sh.list) if(o.label===l) return {sheet:sh.no,y:Math.round(o.y),n:f.sheets.length}; return null; },l);
  for(const lbl of ['О1·П1.1','О1·П5.1','О2·П1.1','О2·П5.1']){
    const el=p.locator(sel+` [data-cmdrag="${await uidOf(lbl)}"]`).first(); await el.scrollIntoViewIfNeeded();
    await drag(el,async()=>{ const z=await p.locator('#shelf-zone').boundingBox(); return {x:z.x+z.width/2,y:z.y+z.height/2}; });
  }
  ok(await p.locator('#shelf-items .shelf-piece').count()===4,'четыре детали по 100×320 лежат на верстаке');
  const before=await where('О2·П4.1');
  ok(before&&before.sheet===12,'деталь О2·П4.1 лежит на последнем (12-м) листе: '+JSON.stringify(before));
  // переносим её на место сверху листа 11, освободившееся после верстака
  const el=p.locator(sel+` [data-cmdrag="${await uidOf('О2·П4.1')}"]`).first(); await el.scrollIntoViewIfNeeded();
  await drag(el,async()=>p.evaluate(s=>{ const svg=document.querySelector(s), d=svg.dataset; const q=svg.createSVGPoint(); q.x=10*+d.cw+(+d.pw)/2; q.y=160; const r=q.matrixTransform(svg.getScreenCTM()); return {x:r.x,y:r.y}; },sel));
  const after=await where('О2·П4.1');
  ok(after&&after.sheet===11&&after.y===0&&after.n===11,'деталь встала на освободившееся место листа 11 (и лишний лист исчез): '+JSON.stringify(after));
  ok(await p.locator('#shelf-items .shelf-piece').count()===4,'на верстаке по-прежнему четыре детали');
  // и обратно: деталь с верстака можно положить на любое свободное место
  ok(errs.length===0,'ошибок страницы нет '+errs.join('|'));
  await b.close();
  console.log(fails?`ПРОВАЛЕНО: ${fails}`:'все проверки пройдены'); process.exit(fails?1:0);
})();
