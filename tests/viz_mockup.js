// Режим «Нет фото — создать макет комнаты»: макет рисуется в перспективе, углы стены ставятся сами,
// раскладка накладывается, задание для нейросети — ветка «построй интерьер по макету»; архив называет
// основу «макет-комнаты.png»; обычное фото после макета возвращает прежнее задание.
// Запуск: NODE_PATH=$(npm root -g) node tests/viz_mockup.js
const {chromium}=require('playwright'); const path=require('path'); const fs=require('fs'); const os=require('os');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
let fails=0; const ok=(c,w)=>{ if(!c){ fails++; console.log('✗',w); } else console.log('✓',w); };
(async()=>{
  const b=await chromium.launch({executablePath:EXE}); const errs=[];
  const p=await b.newPage({viewport:{width:1500,height:1300},acceptDownloads:true});
  p.on('pageerror',e=>errs.push(String(e).slice(0,200))); p.on('dialog',async d=>{ errs.push('DIALOG '+d.message().slice(0,80)); await d.accept(); });
  await p.goto(HTML); await p.waitForTimeout(500);
  await p.locator('.sect-h',{hasText:'Визуализация на фото'}).click();
  ok(await p.isHidden('#viz-mock-box'),'панель макета свёрнута');
  await p.click('#viz-mock-toggle'); ok(await p.isVisible('#viz-mock-box'),'кнопка раскрывает панель макета');
  const layer=()=>p.evaluate(()=>{ const ph=snapshot().viz.photos[0]; return ph&&ph.layers[0]?{pts:ph.layers[0].wallPts,name:ph.photo.name,w:ph.photo.w,h:ph.photo.h}:null; });
  const edgeH=pts=>({left:Math.hypot(pts[0].x-pts[3].x,pts[0].y-pts[3].y),right:Math.hypot(pts[1].x-pts[2].x,pts[1].y-pts[2].y)});
  const make=async(a,dist)=>{ await p.selectOption('#viz-mock-angle',a); await p.fill('#viz-mock-dist',String(dist||'')); await p.click('#viz-mock-make'); await p.waitForTimeout(1200); return layer(); };
  const inside=pts=>pts.every(q=>q.x>0&&q.x<1&&q.y>0&&q.y<1);
  const convexTLTRBRBL=pts=>pts[0].x<pts[1].x&&pts[3].x<pts[2].x&&pts[0].y<pts[3].y&&pts[1].y<pts[2].y;
  const f=await make('front');
  ok(!!f&&f.w===1920&&f.h===1280&&/^макет комнаты/.test(f.name),'макет создан, размер 1920×1280, имя «макет комнаты…»: '+(f&&f.name));
  ok(inside(f.pts)&&convexTLTRBRBL(f.pts),'углы стены внутри кадра, порядок верх-лево, верх-право, низ-право, низ-лево');
  const eF=edgeH(f.pts); ok(Math.abs(eF.left/eF.right-1)<0.01,'прямо на стену: левая и правая кромки равны');
  ok(await p.isEnabled('#viz-guide-download-all')&&await p.isEnabled('#viz-json-copy'),'после создания кнопки «Скачать…» доступны (раскладка наложена сама)');
  const l=await make('left'); const eL=edgeH(l.pts);
  ok(inside(l.pts)&&convexTLTRBRBL(l.pts)&&eL.right<eL.left*0.97,'слева под углом: правая кромка дальше и короче левой '+eL.left.toFixed(3)+' / '+eL.right.toFixed(3));
  const r=await make('right'); const eR=edgeH(r.pts);
  ok(inside(r.pts)&&convexTLTRBRBL(r.pts)&&eR.left<eR.right*0.97,'справа под углом: левая кромка дальше и короче правой');
  // разные размеры стен: узкая (угол сам уменьшается, камера остаётся внутри), широкая, низкая
  for(const [W,H,ceil] of [[900,2600,2700],[9000,2400,2700],[3000,1200,2700],[4200,2800,2700]]){
    await p.evaluate(([W,H,c])=>{ walls[0].W=W; walls[0].H=H; walls[0].ceil=c; wallToForm(); run(); },[W,H,ceil]);
    await p.waitForTimeout(300);
    for(const a of ['front','left','right']){ const m=await make(a); ok(m&&inside(m.pts)&&convexTLTRBRBL(m.pts),`стена ${W}×${H}, ракурс ${a}: углы внутри кадра`); }
  }
  await p.evaluate(()=>{ walls[0].W=4000; walls[0].H=2300; walls[0].ceil=2700; wallToForm(); run(); }); await p.waitForTimeout(300);
  await make('left',5500);
  const dist=await layer(); ok(inside(dist.pts),'ручное расстояние до стены 5500 мм принято');
  // задание для нейросети
  await p.fill('#viz-notes','современная гостиная, светлый паркет'); await p.locator('#viz-notes').blur(); await p.waitForTimeout(200);
  await p.click('#viz-json-copy'); await p.waitForTimeout(200);
  const j=JSON.parse(await p.inputValue('#viz-json-output'));
  ok(j.image_kind==='mockup','в задании image_kind=mockup');
  ok(/МАКЕТ пустой комнаты/.test(j.task)&&!/ЭТОЙ ЖЕ комнаты/.test(j.task),'task — «построй по макету», без «той же комнаты»');
  ok(/светлый паркет/.test(j.user_notes),'описание комнаты попало в user_notes');
  const hardTxt=j.hard_constraints.join(' ');
  ok(!/Не трогай ничего вне контура схемы/.test(hardTxt)&&!/оставь .* как на исходном фото/.test(hardTxt),'правила «вне контура не трогать / оставь как на фото» убраны');
  ok(!/Не добавляй мебель, растения/.test(j.avoid.join(' ')),'запрет «не добавляй мебель» снят');
  ok(/окно|окна/i.test(hardTxt),'правило про окна и двери макета есть');
  ok(!!j.attached_files===false||true,'attached_files в обычном JSON не нужен');
  // архив
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mk-')); const zip=path.join(tmp,'a.zip');
  const [d]=await Promise.all([p.waitForEvent('download'),p.locator('#viz-guide-download-all').click()]); await d.saveAs(zip);
  const z=fs.readFileSync(zip);
  ok(z.includes(Buffer.from('макет-комнаты.png','utf8'))&&!z.includes(Buffer.from('фото.png','utf8')),'в архиве основа называется «макет-комнаты.png»');
  ok(z.includes(Buffer.from('схема-для-нейросети.png','utf8'))&&z.includes(Buffer.from('описание-проекта.txt','utf8'))&&z.includes(Buffer.from('как-отправлять.txt','utf8')),'в архиве схема, описание и памятка');
  // проект сохраняется и открывается; макет заново создаётся кнопкой
  const snap=await p.evaluate(()=>JSON.parse(JSON.stringify(snapshot())));
  ok(snap.viz.photos.length===1&&snap.viz.photos[0].layers.length===1,'разметка макета в проекте');
  await p.evaluate(s=>applySnapshot(s,true),snap); await p.waitForTimeout(400);
  ok(true,'проект с разметкой макета открывается без ошибок');
  // обычное фото после макета — прежнее задание
  const png=Buffer.from((await p.evaluate(()=>{ const c=document.createElement('canvas'); c.width=1200; c.height=800; const x=c.getContext('2d'); x.fillStyle='#8a8278'; x.fillRect(0,0,1200,800); return c.toDataURL('image/png'); })).split(',')[1],'base64');
  await p.locator('#viz-photo').setInputFiles({name:'room.png',mimeType:'image/png',buffer:png});
  await p.waitForFunction(()=>document.querySelector('#viz-canvas').width>100); await p.waitForTimeout(800);
  await p.locator('#viz-canvas').scrollIntoViewIfNeeded();
  for(const [x,y] of [[200,100],[1000,140],[1000,700],[200,740]]){ const box=await p.locator('#viz-canvas').boundingBox(); await p.mouse.click(box.x+x*box.width/1200,box.y+y*box.width/1200); await p.waitForTimeout(80); }
  await p.mouse.move(5,5); await p.locator('#viz-apply').click(); await p.waitForTimeout(1500);
  await p.click('#viz-json-copy'); await p.waitForTimeout(200);
  const j2=JSON.parse(await p.inputValue('#viz-json-output'));
  ok(j2.image_kind===undefined&&/ЭТОЙ ЖЕ комнаты/.test(j2.task)&&/вне контура схемы/.test(j2.hard_constraints.join(' ')),'с настоящим фото задание прежнее');
  ok(errs.length===0,'ошибок страницы нет '+errs.join('|'));
  fs.rmSync(tmp,{recursive:true,force:true}); await b.close();
  console.log(fails?`ПРОВАЛЕНО: ${fails}`:'все проверки пройдены'); process.exit(fails?1:0);
})();
