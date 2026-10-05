// Промпт и архив для нейросети при материалах-расцветках каталога: условный цвет заливки схемы,
// настоящий цвет/описание/образец отдельно, доска материалов с рамками цвета заливки, образцы в папке.
// Запуск: NODE_PATH=$(npm root -g) node tests/catalog_prompt.js
const {chromium}=require('playwright'); const path=require('path'); const fs=require('fs'); const os=require('os');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
let fails=0; const ok=(c,w)=>{ if(!c){ fails++; console.log('✗',w); } else console.log('✓',w); };
const WALL=[[100,60],[420,100],[420,400],[100,450]];
const baseWall=(ops,extra)=>Object.assign({id:1,name:'Стена',autoName:false,W:3800,H:2700,ceil:2700,rowH:0,ops,opSeq:ops.length,seamsU:[],seamSeq:0,
  vseamsU:[],vseamSeq:0,jointModes:{},pieceMats:{},edges:{top:'cap',bot:'none',left:'cap',right:'cap'},cout:0,cin:0,slot:null},extra||{});
const win=(id,fillMat,otkosMat)=>({kind:'window',w:1340,h:1655,x:170+(id-1)*2100,y:690,id,otkos:true,depth:200,otkosOverlap:0,fillMat:fillMat||null,otkosMat:otkosMat||{},otkosMode:{}});
// минимальный разбор STORE-zip: имя → байты
function readZip(buf){
  const out={}; let eo=buf.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06])); const n=buf.readUInt16LE(eo+10); let c=buf.readUInt32LE(eo+16);
  for(let i=0;i<n;i++){ const nl=buf.readUInt16LE(c+28),el=buf.readUInt16LE(c+30),cl=buf.readUInt16LE(c+32),sz=buf.readUInt32LE(c+24),off=buf.readUInt32LE(c+42);
    const name=buf.slice(c+46,c+46+nl).toString('utf8'); const lnl=buf.readUInt16LE(off+26),lel=buf.readUInt16LE(off+28);
    out[name]=buf.slice(off+30+lnl+lel,off+30+lnl+lel+sz); c+=46+nl+el+cl; }
  return out;
}
(async()=>{
  const browser=await chromium.launch({executablePath:EXE}); const errors=[]; const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cp-'));
  async function scenario(name,{preset,colorway,walls,otkosMark}){
    const p=await browser.newPage({viewport:{width:1500,height:1300},acceptDownloads:true});
    p.on('pageerror',e=>errors.push(name+': '+String(e).slice(0,200))); p.on('dialog',async d=>{ errors.push(name+' DIALOG '+d.message().slice(0,80)); await d.accept(); });
    await p.goto(HTML); await p.waitForTimeout(500);
    await p.evaluate(({preset,colorway,wl})=>{
      const sel=document.querySelector('#i-preset'); sel.value=preset; sel.dispatchEvent(new Event('change'));
      document.querySelector('#i-colorway').value=colorway||'';
      walls.length=0; wl.forEach(w=>walls.push(w)); active=0; wallToForm(); renderOpenings(); syncColorwayUI(); run();
    },{preset,colorway,wl:walls});
    const png=Buffer.from((await p.evaluate(()=>{ const c=document.createElement('canvas'); c.width=1920; c.height=1280; const x=c.getContext('2d'); x.fillStyle='#8a8278'; x.fillRect(0,0,1920,1280); return c.toDataURL('image/png'); })).split(',')[1],'base64');
    await p.locator('.sect-h',{hasText:'Визуализация на фото'}).click();
    await p.locator('#viz-photo').setInputFiles({name:'room.png',mimeType:'image/png',buffer:png});
    await p.waitForFunction(()=>document.querySelector('#viz-canvas').width>100); await p.waitForTimeout(700);
    await p.locator('#viz-canvas').scrollIntoViewIfNeeded(); const box=await p.locator('#viz-canvas').boundingBox();
    for(const [x,y] of WALL){ await p.mouse.click(box.x+x,box.y+y); await p.waitForTimeout(40); }
    await p.mouse.move(5,5); await p.locator('#viz-apply').click(); await p.waitForTimeout(2000);
    await p.locator('#viz-json-copy').click(); await p.waitForTimeout(250);
    const json=JSON.parse(await p.inputValue('#viz-json-output'));
    const [d]=await Promise.all([p.waitForEvent('download'),p.locator('#viz-guide-download-all').click()]);
    const zp=path.join(tmp,name.replace(/\W+/g,'_')+'.zip'); await d.saveAs(zp);
    const zip=readZip(fs.readFileSync(zp));
    return {p,json,zip};
  }

  // ---- 1. расцветка бамбука + заполнение проёма мрамором ----
  {
    const {p,json,zip}=await scenario('colorways',{preset:'bamboo29',colorway:'bamboo29:8190',walls:[baseWall([win(1,'marble:044'),win(2)])]});
    const m=json.materials; const names=Object.keys(zip);
    ok(m.length===2&&m.every(x=>x.schema_fill&&x.real_color_hex&&x.article&&x.texture_hint),'materials[]: у обоих материалов схема-заливка, реальный цвет, артикул, описание');
    ok(m.map(x=>x.article).join()==='8190,044','артикулы материалов: '+m.map(x=>x.article));
    ok(m[0].schema_fill.hex!==m[1].schema_fill.hex,'условные цвета заливки разных материалов различаются');
    ok(!('color_hex' in json.walls[0].material)&&json.walls[0].material.schema_fill_hex===m[0].schema_fill.hex,'в walls[].material — цвет заливки схемы и реальный цвет, без старого color_hex');
    ok(json.walls[0].filled_openings[0].schema_fill_hex===m[1].schema_fill.hex&&json.walls[0].filled_openings[0].real_color_hex===m[1].real_color_hex,'filled_openings: заливка и реальный цвет мрамора');
    ok(/УСЛОВНЫЙ МАРКЕР/.test(json.reference_image_legend),'легенда: цвет заливки — условный маркер');
    ok(/real_color_hex/.test(json.hard_constraints.join(' '))&&!/по указанному color_hex/.test(json.hard_constraints.join(' ')),'жёсткое требование про цвет — по real_color_hex, а не по заливке');
    ok(/образцам/.test(json.short_prompt)&&!/базовый цвет как на схеме/.test(json.short_prompt),'короткая версия: вид по образцам');
    ok(/ОБРАЗЦЫ/.test(json.material_reference_note)&&/рамка/.test(json.material_reference_note),'примечание про образцы и рамки на доске');
    ok(json.material_rules&&json.material_rules.some(r=>/МАТОВЫЙ/.test(r)&&/НЕПРЕРЫВНЫЙ/.test(r)),'правило мрамора: матовый, рисунок непрерывный');
    ok(json.material_rules.some(r=>/Бамбуковая панель/.test(r)),'правило бамбука: по образцу расцветки');
    ok(!json.material_rules.some(r=>/Скала|Реечная/.test(r)),'правил скалы/рейки нет (их нет в проекте)');
    ok(/приложены|attached|образцы/i.test(json.final_reminder)||/schema_fill/.test(json.final_reminder),'итоговое напоминание про материал по цвету заливки');
    const pre=Object.keys(zip)[0].split('/')[0];
    ok(names.includes(pre+'/материалы.jpg'),'в папке фото есть доска материалов');
    ok(names.includes(pre+'/образцы/8190.jpg')&&names.includes(pre+'/образцы/044.jpg'),'в папке образцы только использованных материалов (8190, 044)');
    ok(!names.some(n=>/образцы\/(?!8190|044)/.test(n)&&!n.endsWith('/')),'других образцов в папке нет');
    const arch=JSON.parse(zip[pre+'/описание-проекта.txt'].toString('utf8'));       // в архиве JSON знает имена файлов; у кнопки «копировать» файлов нет
    const af=Object.keys(arch.attached_files||{});
    ok(af.includes('материалы.jpg')&&af.includes('образцы/8190.jpg')&&af.includes('образцы/044.jpg'),'attached_files (в архиве) перечисляет доску и образцы');
    ok(arch.materials[0].sample_file==='образцы/8190.jpg'&&!json.materials[0].sample_file,'materials[].sample_file указывает файл образца (только в архиве)');
    ok(/материалы\.jpg/.test(zip['как-отправлять.txt'].toString('utf8')),'памятка упоминает доску материалов');
    // рамка плитки на доске = цвет заливки материала
    const boardB64=zip[pre+'/материалы.jpg'].toString('base64');
    const frame=await p.evaluate(async ({b64,hex})=>{
      const im=new Image(); await new Promise(r=>{ im.onload=r; im.src='data:image/jpeg;base64,'+b64; });
      const c=document.createElement('canvas'); c.width=im.width; c.height=im.height; const x=c.getContext('2d'); x.drawImage(im,0,0);
      const px=x.getImageData(26+6,90+200,1,1).data; return {w:im.width,h:im.height,px:[px[0],px[1],px[2]],want:[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)]};
    },{b64:boardB64,hex:m[0].schema_fill.hex});
    ok(frame.w>=780&&frame.px.every((v,i)=>Math.abs(v-frame.want[i])<14),'рамка первого образца на доске ≈ цвет его заливки '+JSON.stringify(frame));
    await p.close();
  }

  // ---- 2. два материала с одним условным цветом: проект разводит их ----
  {
    const same=await (async()=>{ const p=await browser.newPage(); await p.goto(HTML); await p.waitForTimeout(300);
      const r=await p.evaluate(()=>{ const items=CATALOG.types.bamboo29.items; const a=items.find(i=>items.some(j=>j!==i&&j.k===i.k)); const b=items.find(j=>j!==a&&j.k===a.k); return [a.id,b.id,a.k]; }); await p.close(); return r; })();
    const {p,json}=await scenario('collide',{preset:'bamboo29',colorway:same[0],walls:[baseWall([win(1,same[1]),win(2)])]});
    const hx=json.materials.map(x=>x.schema_fill.hex);
    ok(hx.length===2&&hx[0]!==hx[1],'расцветки с одинаковым условным цветом в одном проекте получили разные цвета заливки '+hx.join('/')+' (исходно оба '+same[2]+')');
    await p.close();
  }

  // ---- 3. скала: рельефный образец, цвет — белый гипс ----
  {
    const {p,json,zip}=await scenario('rock',{preset:'rockL',walls:[baseWall([win(1,'rockS'),win(2)])]});
    const m=json.materials; const rock=m.find(x=>/маленькая/i.test(x.name+x.article))||m.find(x=>x.article&&/Маленькая/.test(x.article));
    ok(m.some(x=>x.article==='Большая скала')&&m.some(x=>x.article==='Маленькая скала'),'обе скалы в materials[] с названием-артикулом: '+m.map(x=>x.article));
    ok(m.every(x=>x.real_color_hex==='#E6E2D9'),'цвет скал — белый гипс #E6E2D9 (не цвет фото)');
    ok(json.material_rules&&json.material_rules.some(r=>/БЕЛЫЙ ГИПСОВЫЙ/.test(r)&&/до 80 мм/.test(r)&&/до 35 мм/.test(r)),'правило скал: белый гипс, глубина рельефа обеих скал');
    const pre=Object.keys(zip)[0].split('/')[0];
    ok(Object.keys(zip).some(n=>n===pre+'/образцы/Большая скала — рельеф.jpg')&&Object.keys(zip).some(n=>n===pre+'/образцы/Маленькая скала — рельеф.jpg'),'в архиве рельефные образцы скал');
    ok(!m.some(x=>x.sample_scale),'у рельефных образцов нет sample_scale (масштаб неизвестен)');
    await p.close();
  }

  // ---- 4. старые id типов без расцветки: ничего нового в промпте и архиве ----
  {
    const {p,json,zip}=await scenario('legacy',{preset:'bamboo29',walls:[baseWall([win(1,'marble'),win(2)])]});
    const m=json.materials;
    ok(m.every(x=>x.color_hex&&!x.schema_fill&&!x.sample_file),'materials[] как раньше: color_hex, без schema_fill и образцов');
    ok(!/УСЛОВНЫЙ МАРКЕР/.test(json.reference_image_legend)&&/её цвет = цвет материала/.test(json.reference_image_legend),'легенда прежняя');
    ok(!Object.keys(zip).some(n=>/материалы\.jpg|образцы/.test(n)),'доски материалов и образцов в архиве нет');
    ok(json.walls[0].material.color_hex&&!json.walls[0].material.schema_fill_hex,'walls[].material с прежним color_hex');
    ok(/матовый природный камень/.test(m.find(x=>/мрамор/i.test(x.name)).texture_hint),'мрамор без расцветки описан как матовый камень');
    await p.close();
  }

  // ---- 5. смесь: расцветка + материал без образца ----
  {
    const {p,json}=await scenario('mixed',{preset:'bamboo29',colorway:'bamboo29:8190',walls:[baseWall([win(1,'slat'),win(2)])]});
    ok(json.materials.some(x=>x.schema_fill)&&json.materials.some(x=>x.color_hex&&!x.schema_fill),'в одном проекте и материал с образцом, и без');
    ok(/только color_hex/.test(json.reference_image_legend)&&/без real_color_hex/.test(json.hard_constraints.join(' ')),'легенда и требования оговаривают материал без образца');
    await p.close();
  }
  ok(!errors.length,'ошибок страницы нет '+errors.join(' | '));
  await browser.close();
  console.log(fails?`ПРОВАЛЕНО: ${fails}`:'все проверки пройдены'); process.exit(fails?1:0);
})();
