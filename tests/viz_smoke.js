// Дымовой тест «Визуализации на фото»: разметка → «Наложить» → сохранение проекта → открытие в чистой
// вкладке → то же фото → разметка и пояснение на месте; архив для нейросети (папка на фото),
// отмена после правки пояснения. Запуск: NODE_PATH=$(npm root -g) node tests/viz_smoke.js
const {chromium}=require('playwright'); const path=require('path'); const fs=require('fs'); const os=require('os');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
let fails=0; const ok=(c,w)=>{ if(!c){ fails++; console.log('✗',w); } else console.log('✓',w); };
const WALL=[[100,60],[420,100],[420,400],[100,450]];
(async()=>{
  const browser=await chromium.launch({executablePath:EXE}); const errors=[];
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'viz-'));
  async function open(tag){ const p=await browser.newPage({viewport:{width:1500,height:1300},acceptDownloads:true});
    p.on('pageerror',e=>errors.push(tag+' '+String(e).slice(0,200))); p.on('dialog',async d=>{ errors.push(tag+' DIALOG '+d.message().slice(0,80)); await d.accept(); });
    await p.goto(HTML); await p.waitForTimeout(300); return p; }
  const A=await open('A');
  const png=Buffer.from((await A.evaluate(()=>{ const c=document.createElement('canvas'); c.width=1920; c.height=1280;
    const x=c.getContext('2d'); x.fillStyle='#8a8278'; x.fillRect(0,0,1920,1280); return c.toDataURL('image/png'); })).split(',')[1],'base64');
  const photo={name:'room.png',mimeType:'image/png',buffer:png};
  async function load(p){ await p.locator('.sect-h',{hasText:'Визуализация на фото'}).click(); await p.locator('#viz-photo').setInputFiles(photo);
    await p.waitForFunction(()=>document.querySelector('#viz-canvas').width>100); await p.waitForTimeout(1200); await p.locator('#viz-canvas').scrollIntoViewIfNeeded(); }
  const dl=async(p,sel,file)=>{ const [d]=await Promise.all([p.waitForEvent('download'),p.locator(sel).click()]); await d.saveAs(file); return d.suggestedFilename(); };
  await load(A);
  const box=await A.locator('#viz-canvas').boundingBox();
  for(const [x,y] of WALL){ await A.mouse.click(box.x+x,box.y+y); await A.waitForTimeout(40); }
  await A.mouse.move(5,5); await A.locator('#viz-apply').click(); await A.waitForTimeout(2000);
  await A.fill('#viz-notes','пол — тёмный ламинат'); await A.locator('#viz-notes').blur(); await A.waitForTimeout(300);
  await A.locator('#viz-json-copy').click(); await A.waitForTimeout(200);
  const jsonA=await A.inputValue('#viz-json-output');
  ok(JSON.parse(jsonA).user_notes.includes('тёмный ламинат'),'пояснение попало в JSON');
  await A.fill('#viz-notes','другое'); await A.locator('#viz-notes').blur(); await A.waitForTimeout(300);
  await A.locator('#btn-undo').click(); await A.waitForTimeout(1500);
  ok((await A.inputValue('#viz-notes'))==='пол — тёмный ламинат','отмена вернула прежнее пояснение');
  const proj=path.join(tmp,'p.json'); await dl(A,'#btn-save',proj);
  const saved=JSON.parse(fs.readFileSync(proj,'utf8'));
  ok(saved.viz&&saved.viz.photos[0].notes==='пол — тёмный ламинат'&&saved.viz.photos[0].layers.length===1,'проект содержит разметку и пояснение');
  const zip=path.join(tmp,'a.zip'); const zn=await dl(A,'#viz-guide-download-all',zip);
  ok(/^\d{6}\.zip$/.test(zn),'имя архива — дата: '+zn);
  const z=fs.readFileSync(zip);
  ok(z.includes(Buffer.from('схема-для-нейросети.png','utf8'))&&z.includes(Buffer.from('описание-проекта.txt','utf8'))&&z.includes(Buffer.from('как-отправлять.txt','utf8')),'в архиве схема, описание и памятка');
  await A.close();
  const B=await open('B'); await B.locator('#file-load').setInputFiles(proj); await B.waitForTimeout(500); await load(B);
  ok((await B.inputValue('#viz-notes'))==='пол — тёмный ламинат','после открытия проекта пояснение на месте');
  await B.locator('#viz-json-copy').click(); await B.waitForTimeout(200);
  ok((await B.inputValue('#viz-json-output'))===jsonA,'JSON после открытия проекта совпадает с исходным');
  await B.close();
  console.log(errors.length?('ошибки: '+JSON.stringify(errors)):'ошибок страницы нет'); fs.rmSync(tmp,{recursive:true,force:true});
  await browser.close(); process.exit(fails||errors.length?1:0);
})();
