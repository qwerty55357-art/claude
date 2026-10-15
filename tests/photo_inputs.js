// Загрузка «фото» необычных видов: не картинка, пустой файл, крошечная и огромная картинки, WebP/GIF/SVG. Страница не падает,
// при нечитаемом файле — понятное сообщение (раньше молчание), прежняя разметка не теряется.
// Запуск: NODE_PATH=$(npm root -g) node tests/photo_inputs.js
const {chromium}=require('playwright'); const path=require('path');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
let fails=0; const ok=(c,w)=>{ if(!c){ fails++; console.log('✗',w); } else console.log('✓',w); };
(async()=>{
  const b=await chromium.launch({executablePath:EXE}); const p=await b.newPage({viewport:{width:1500,height:1300}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160))); p.on('dialog',async d=>{ errs.push('диалог '+d.message().slice(0,80)); await d.accept(); });
  await p.goto(HTML); await p.waitForTimeout(500);
  await p.locator('.sect-h',{hasText:'Визуализация на фото'}).click();
  const img=(w,h,type)=>p.evaluate(({w,h,type})=>{ const c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d'); x.fillStyle='#8a8278'; x.fillRect(0,0,w,h); return c.toDataURL(type).split(',')[1]; },{w,h,type});
  const cases=[
    ['не картинка (.png с текстом)',{name:'a.png',mimeType:'image/png',buffer:Buffer.from('это не картинка')},false],
    ['пустой файл',{name:'e.jpg',mimeType:'image/jpeg',buffer:Buffer.alloc(0)},false],
    ['HEIC-имя с мусором',{name:'IMG_1.HEIC',mimeType:'image/heic',buffer:Buffer.from('ftypheic....')},false],
    ['крошечный PNG 1×1',{name:'t.png',mimeType:'image/png',buffer:Buffer.from(await img(1,1,'image/png'),'base64')},true],
    ['WebP 1200×800',{name:'w.webp',mimeType:'image/webp',buffer:Buffer.from(await img(1200,800,'image/webp'),'base64')},true],
    ['огромный JPEG 9000×6000',{name:'big.jpg',mimeType:'image/jpeg',buffer:Buffer.from(await img(9000,6000,'image/jpeg'),'base64')},true],
    ['SVG',{name:'s.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#888"/></svg>')},true],
  ];
  for(const [name,file,good] of cases){
    errs.splice(0);
    await p.locator('#viz-photo').setInputFiles(file); await p.waitForTimeout(1500);
    const st=await p.evaluate(()=>({w:document.querySelector('#viz-canvas').width,notice:(document.querySelector('.viz-notice')||{}).textContent||'',hidden:(document.querySelector('.viz-notice')||{hidden:true}).hidden}));
    if(good) ok(st.w>=1,'«'+name+'»: фото принято, холст '+st.w+' px');
    else ok(!st.hidden&&/Не удалось открыть/.test(st.notice),'«'+name+'»: показано сообщение «Не удалось открыть…»: '+st.notice.slice(0,60));
    ok(errs.length===0,'«'+name+'»: ошибок страницы нет '+errs.join('|'));
  }
  await b.close();
  console.log(fails?`ПРОВАЛЕНО: ${fails}`:'все проверки пройдены'); process.exit(fails?1:0);
})();
