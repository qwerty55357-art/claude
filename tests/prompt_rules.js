// Автотест правил JSON-промпта для нейросети («Визуализация на фото»).
// Запуск (нужен Playwright и Chromium):  NODE_PATH=$(npm root -g) node tests/prompt_rules.js
// Что проверяется: промпт собирается из фактов проекта — для набора типовых проектов
// (с LED и без, откосы отделаны/нет/в проекте их нет, углы, материалы, раскладки…) проверяем,
// какие правила попали в текст, а какие НЕТ. Это единственная часть промпта, которую можно
// проверить без самой генерации картинки: качество результата оценивается только вживую.
// Фото подставляется заглушкой — на текст промпта содержимое снимка не влияет.
const {chromium}=require('playwright');
const path=require('path');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';

// ---- сценарии: проект (стены, проёмы, LED, углы…) + что размечено на фото ----
const WALL1=[[100,60],[420,100],[420,400],[100,450]], WALL2=[[440,100],[800,60],[800,450],[440,400]];
const REV=[[300,150],[312,148],[312,300],[300,302]];
const win=(o={})=>Object.assign({kind:'window',w:1000,h:1400,x:300,y:800},o);
const wall=(id,name,ops,extra)=>Object.assign({id,name,W:3800,H:2700,ops},extra);
const SCEN=[
  {name:'S1 без LED, у проёмов откосов нет в проекте', walls:[wall(1,'Стена 1',[win(),win({x:2200})])], photo:[{w:0,quad:WALL1}],
   check:(j,t,e)=>{ e(!/LED|бирюз/.test(t),'нет слов LED/бирюз');
     e(j.led===undefined,'нет поля led'); e(j.avoid.some(x=>x.includes('Подсветки в проекте нет')),'avoid: подсветки нет');
     e(j.walls[0].openings_without_reveal_in_project?.length===2,'оба проёма без откоса');
     e(j.hard_constraints.some(x=>x.includes('openings_without_reveal_in_project')),'правило «откосов в проекте нет»');
     e(!j.hard_constraints.some(x=>x.includes('openings_without_marked_reveal')),'нет правила про неразмеченные откосы');
     e(!t.includes('wall.otkos'),'нет упоминаний wall.otkos');
     e(!j.reference_image_legend.includes('зона исключения'),'нет зон исключения в легенде'); }},
  {name:'S2 откосы есть в проекте, ни один не размечен', walls:[wall(1,'Стена 1',[win({otkos:true,depth:200}),win({x:2200,otkos:true,depth:200})])], photo:[{w:0,quad:WALL1}],
   check:(j,t,e)=>{ e(j.walls[0].openings_without_marked_reveal?.length===2,'оба проёма — без отмеченного откоса');
     e(j.hard_constraints.some(x=>x.includes('openings_without_marked_reveal')),'правило про неразмеченные откосы');
     e(!j.hard_constraints.some(x=>x.includes('wall.otkos')),'нет правила про отделку откосов'); }},
  {name:'S3 один откос размечен, второй проём — нет', walls:[wall(1,'Стена 1',[win({otkos:true,depth:200}),win({x:2200,otkos:true,depth:200})])],
   photo:[{w:0,quad:WALL1,reveals:[{key:'otkos:0:right',quad:REV}]}],
   check:(j,t,e)=>{ e(j.walls[0].otkos.length===1,'один откос в walls[].otkos');
     e(JSON.stringify(j.walls[0].openings_without_marked_reveal)==='["Окно 2"]','неразмеченным остаётся только Окно 2');
     e(j.hard_constraints.some(x=>x.includes('wall.otkos')),'правило про отделку откосов');
     e(j.hard_constraints.some(x=>x.includes('openings_without_marked_reveal')),'правило про неразмеченные');
     e(j.reference_image_legend.includes('Тонкий тёмный контур'),'в легенде контур откоса');
     e(j.short_prompt.includes('Откосы, закрашенные на схеме'),'короткий промпт про откосы'); }},
  {name:'S4 LED на стене фото + откос', walls:[wall(1,'Стена 1',[win({otkos:true,depth:200})])],
   led:[{wall:1,ax:0,ay:2450,bx:3800,by:2450}], photo:[{w:0,quad:WALL1,reveals:[{key:'otkos:0:right',quad:REV}]}],
   check:(j,t,e)=>{ e(/бирюз/.test(j.reference_image_legend),'легенда про бирюзовую линию'); e(!!j.led&&j.led.color_temperature_k>0,'поле led');
     e(j.hard_constraints.some(x=>x.includes('Бирюзовые линии')&&x.includes('цвет свечения')),'жёсткое правило LED с цветом свечения');
     e(j.avoid.some(x=>x.includes('там, где на схеме нет бирюзовой линии')),'avoid: подсветка только по бирюзе');
     e(!j.avoid.some(x=>x.includes('Подсветки в проекте нет')),'нет «подсветки нет»');
     e(Object.keys(j.seam_types_glossary||{}).some(k=>k.startsWith('LED')),'глоссарий LED'); }},
  {name:'S5 LED только на стене, которой нет на фото', walls:[wall(1,'Стена 1',[win()]),wall(2,'Стена 2',[win()])],
   led:[{wall:2,ax:0,ay:2450,bx:3800,by:2450}], photo:[{w:0,quad:WALL1}],
   check:(j,t,e)=>{ e(!/LED|бирюз/.test(t),'нет слов LED/бирюз'); e(j.led===undefined,'нет поля led');
     e(j.avoid.some(x=>x.includes('Подсветки в проекте нет')),'avoid: подсветки нет'); }},
  {name:'S6 две стены на фото, обычный угол', walls:[wall(1,'Стена 1',[win()]),wall(2,'Стена 2',[win()])],
   corners:[{kind:'sharp',type:'in',aw:1,as:'right',bw:2,bs:'left',angle:90}], photo:[{w:0,quad:WALL1},{w:1,quad:WALL2}],
   check:(j,t,e)=>{ e(j.walls.length===2,'две стены'); e(j.corners?.length===1,'один угол'); e(j.corners[0].shape.includes('без скругления'),'обычный стык');
     e(j.hard_constraints.some(x=>x.includes('Углы между стенами')),'правило про углы'); }},
  {name:'S7 радиусный угол', walls:[wall(1,'Стена 1',[win()]),wall(2,'Стена 2',[win()])],
   corners:[{kind:'radius',type:'in',aw:1,as:'right',bw:2,bs:'left',angle:90,radius:300}], photo:[{w:0,quad:WALL1},{w:1,quad:WALL2}],
   check:(j,t,e)=>{ e(j.corners?.[0].shape.includes('радиусный')&&j.corners[0].shape.includes('300'),'радиус 300 мм в описании'); }},
  {name:'S8a горизонтальная раскладка, бамбук', orient:'h', preset:'bamboo29', walls:[wall(1,'Стена 1',[win()])], photo:[{w:0,quad:WALL1}],
   check:(j,t,e)=>{ e(j.walls[0].material.pattern_direction?.includes('горизонтально'),'рисунок горизонтально'); }},
  {name:'S8b вертикальная раскладка, бамбук', orient:'v', preset:'bamboo29', walls:[wall(1,'Стена 1',[win()])], photo:[{w:0,quad:WALL1}],
   check:(j,t,e)=>{ e(j.walls[0].material.pattern_direction?.includes('вертикально'),'рисунок вертикально'); }},
  {name:'S8c мрамор — направления рисунка нет', preset:'marble', walls:[wall(1,'Стена 1',[win()])], photo:[{w:0,quad:WALL1}],
   check:(j,t,e)=>{ e(j.walls[0].material.pattern_direction===undefined,'нет pattern_direction'); e(j.materials[0].name.includes('мрамор'),'материал — мрамор'); }},
  {name:'S9 три материала: основной, зашитый проём, откос', preset:'bamboo29',
   walls:[wall(1,'Стена 1',[win({otkos:true,depth:200,otkosMat:{right:'slat'}}),win({x:2200,fillMat:'marble'})])],
   photo:[{w:0,quad:WALL1,reveals:[{key:'otkos:0:right',quad:REV}]}],
   check:(j,t,e)=>{ e(j.materials.length===3,'в materials три материала'); const by=n=>j.materials.find(m=>m.name.includes(n))||{used_for:[]};
     e(by('Бамбук').used_for.some(x=>x.includes('основная')),'бамбук — основная');
     e(by('мрамор').used_for.some(x=>x.includes('заполнение')),'мрамор — заполнение проёма');
     e(by('Реечная').used_for.some(x=>x.includes('откосы')),'рейка — откосы');
     e(j.materials.every(m=>m.texture_hint&&m.color_hex),'у каждого — фактура и цвет'); }},
  {name:'S10 зона исключения', walls:[wall(1,'Стена 1',[win()])], photo:[{w:0,quad:WALL1}], exclusion:[[150,300],[250,420]],
   check:(j,t,e)=>{ e(j.reference_image_legend.includes('зона исключения'),'зона исключения в легенде');
     e(j.hard_constraints.some(x=>x.includes('мебель, розетки, провода')),'правило про мебель/розетки'); }},
  {name:'S11 пояснение автора', walls:[wall(1,'Стена 1',[win()])], photo:[{w:0,quad:WALL1}], notes:'стены вокруг будут белыми',
   check:(j,t,e)=>{ e(j.user_notes?.includes('стены вокруг будут белыми'),'user_notes с текстом'); }},
  {name:'S12 только стыки встык (без профилей)', walls:[wall(1,'Стена 1',[win()])], photo:[{w:0,quad:WALL1}], jointsOff:true, edges:{top:'none',left:'none',right:'none'},
   check:(j,t,e)=>{ const g=Object.keys(j.seam_types_glossary||{}); e(g.length===1&&g[0].startsWith('встык'),'в глоссарии только «встык»');
     e(!j.reference_image_legend.includes('профилем-заглушкой'),'в легенде нет заглушки'); e(!j.hard_constraints.some(x=>x.includes('Тип каждого стыка')),'нет правила про разные типы'); }},
];

// свойства, которые должны выполняться в КАЖДОМ проекте
function commonChecks(j,t,e){
  e(!t.includes('undefined'),'нет «undefined» в тексте'); e(typeof j.prompt_version==='string','есть prompt_version');
  const types=new Set(); j.walls.forEach(w=>w.seams.forEach(s=>types.add(s.type)));
  const gl=Object.keys(j.seam_types_glossary||{}).filter(k=>!k.startsWith('LED'));
  e(gl.length===types.size&&gl.every(k=>types.has(k)),'глоссарий стыков = типы стыков на схеме');
  e(!!j.led===/бирюз/.test(j.reference_image_legend),'легенда про бирюзу ⇔ есть поле led');
  e(!!j.led===j.hard_constraints.some(x=>x.includes('Бирюзовые линии')),'жёсткое правило LED ⇔ есть поле led');
  e(j.walls.some(w=>w.openings_without_marked_reveal)===j.hard_constraints.some(x=>x.includes('openings_without_marked_reveal')),'правило про неразмеченные откосы ⇔ поле');
  e(j.walls.some(w=>w.openings_without_reveal_in_project)===j.hard_constraints.some(x=>x.includes('openings_without_reveal_in_project')),'правило «откосов нет» ⇔ поле');
  e(j.walls.some(w=>w.otkos.length)===j.hard_constraints.some(x=>x.includes('wall.otkos')),'правило отделки откосов ⇔ есть откосы');
  e(!!j.corners===j.hard_constraints.some(x=>x.includes('Углы между стенами')),'правило про углы ⇔ есть corners');
  e(j.hard_constraints.length>=4&&j.avoid.length>=6,'ядро правил на месте'); e(j.materials.length>=1,'есть materials');
}

(async()=>{
  const browser=await chromium.launch({executablePath:EXE});
  const errors=[]; let fails=0, total=0;
  const page=await browser.newPage({viewport:{width:1500,height:1300}});
  page.on('pageerror',e=>errors.push(String(e).slice(0,200)));
  page.on('dialog',async d=>{ errors.push('DIALOG: '+d.message()); await d.dismiss(); });
  await page.goto(HTML); await page.waitForTimeout(400);
  const png=Buffer.from((await page.evaluate(()=>{ const c=document.createElement('canvas'); c.width=1920; c.height=1280;
    const x=c.getContext('2d'); x.fillStyle='#8a8278'; x.fillRect(0,0,1920,1280); return c.toDataURL('image/png'); })).split(',')[1],'base64');
  for(const sc of SCEN){
    await page.goto(HTML); await page.waitForTimeout(300);
    await page.evaluate(sp=>{
      walls.length=0; cornerLinks.length=0; ledCircuits.length=0;
      sp.walls.forEach(w=>walls.push(Object.assign(newWall(),{id:w.id,name:w.name,autoName:false,W:w.W,H:w.H,ceil:w.H,
        ops:w.ops.map((o,k)=>Object.assign({id:k+1,otkos:false,depth:200,otkosOverlap:0,fillMat:null,otkosMat:{},otkosMode:{},anchorH:'left'},o)),
        opSeq:w.ops.length,seamsU:[],seamSeq:0,vseamsU:[],vseamSeq:0,jointModes:{},pieceMats:{},
        edges:Object.assign({top:'cap',bot:'none',left:'cap',right:'cap'},sp.edges||{}),slot:null})));
      wallSeq=walls.length;
      (sp.led||[]).forEach((l,i)=>ledCircuits.push({id:i+1,kind:'start',legs:[{wall:l.wall,el:'free',id:i+1,ax:l.ax,ay:l.ay,bx:l.bx,by:l.by}]}));
      (sp.corners||[]).forEach((c,i)=>cornerLinks.push(Object.assign({id:i+1,radius:300,distance:0,flatA:0,flatB:0},c))); cornerSeq=cornerLinks.length;
      if(sp.corners&&sp.corners.length) cornerType=sp.corners[0].type;
      const set=(id,v)=>{ const el=document.querySelector(id); el.value=v; };
      if(sp.orient) set('#i-orient',sp.orient);
      if(sp.preset){ set('#i-preset',sp.preset); document.querySelector('#i-preset').dispatchEvent(new Event('change',{bubbles:true})); }
      if(sp.jointsOff){ document.querySelector('#i-joint-v').checked=false; document.querySelector('#i-joint-h').checked=false; }
      active=0; wallToForm(); renderOpenings(); run();
    },(({check,...data})=>data)(sc));
    await page.locator('.sect-h',{hasText:'Визуализация на фото'}).click();
    await page.locator('#viz-photo').setInputFiles({name:'test.png',mimeType:'image/png',buffer:png});
    await page.waitForFunction(()=>document.querySelector('#viz-canvas').width>100); await page.waitForTimeout(300);
    await page.locator('#viz-canvas').scrollIntoViewIfNeeded();
    const box=await page.locator('#viz-canvas').boundingBox();
    const click=async pts=>{ for(const [x,y] of pts){ await page.mouse.click(box.x+x,box.y+y); await page.waitForTimeout(40); } };
    if(sc.notes){ await page.fill('#viz-notes',sc.notes); }
    if(sc.exclusion){ await page.selectOption('#viz-target','exclude'); const [[x0,y0],[x1,y1]]=sc.exclusion;
      await page.mouse.move(box.x+x0,box.y+y0); await page.mouse.down(); await page.mouse.move(box.x+x1,box.y+y1,{steps:4}); await page.mouse.up(); }
    for(const ph of sc.photo){
      await page.selectOption('#viz-wall',String(ph.w)); await page.selectOption('#viz-target','wall');
      await click(ph.quad);
      for(const r of ph.reveals||[]){ await page.selectOption('#viz-target',r.key); await click(r.quad); }
      await page.mouse.move(5,5);
      await page.locator('#viz-apply').click(); await page.waitForTimeout(1800);
    }
    await page.locator('#viz-json-copy').click(); await page.waitForTimeout(200);
    const t=await page.inputValue('#viz-json-output'); let j=null;
    try{ j=JSON.parse(t); }catch(err){ console.log('✗',sc.name,'— JSON не разбирается'); fails++; total++; continue; }
    const lines=[]; const e=(ok,what)=>{ total++; if(!ok){ fails++; lines.push('   ✗ '+what); } };
    for(const f of [commonChecks,sc.check]){ try{ f(j,t,e); }catch(err){ total++; fails++; lines.push('   ✗ проверка упала: '+String(err).slice(0,100)); } }
    console.log((lines.length?'✗ ':'✓ ')+sc.name+`  [${t.length} симв.]`); lines.forEach(l=>console.log(l));
  }
  console.log(`\nпроверок: ${total}, провалено: ${fails}, ошибок страницы: ${errors.length}`); if(errors.length) console.log(errors);
  await browser.close(); process.exit(fails||errors.length?1:0);
})();
