// Каталог расцветок целиком: целостность данных (уникальные id/артикулы, цвета, образцы-картинки декодируются) и работа каждой
// из 68 расцветок как основного материала и как заполнения проёма: задание для нейросети (артикул, реальный цвет, описание),
// архив (доска материалов и образец), смета/спецификация без NaN. Запуск: NODE_PATH=$(npm root -g) [CAT_ONLY=slat] node tests/catalog_all.js
const {chromium}=require('playwright'); const path=require('path'); const fs=require('fs'); const os=require('os');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
const IN_PAGE=require('./lib/inpage.js');
let fails=0; const bad=m=>{ fails++; console.log('✗',m); };
(async()=>{
  const b=await chromium.launch({executablePath:EXE}); const p=await b.newPage({viewport:{width:1500,height:1300},acceptDownloads:true});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160))); p.on('dialog',async d=>{ errs.push('диалог '+d.message().slice(0,80)); await d.accept(); });
  await p.goto(HTML); await p.waitForTimeout(500); await p.evaluate(IN_PAGE);
  // 1. данные
  const st=await p.evaluate(async()=>{
    const out=[]; const items=[...CAT_BY_ID.values()]; const seenId=new Set(), seenA={};
    const hex=/^#[0-9a-fA-F]{6}$/;
    for(const it of items){
      const t='«'+it.id+'»: ';
      if(seenId.has(it.id)) out.push(t+'повторяется id'); seenId.add(it.id);
      const key=it.type+'|'+it.a; if(seenA[key]) out.push(t+'повторяется артикул в типе'); seenA[key]=1;
      if(!new RegExp('^'+it.type+':[a-zа-яё0-9_.-]+$').test(it.id)) out.push(t+'id не вида «тип:слаг-артикула»');
      if(!hex.test(it.c||'')) out.push(t+'плохой реальный цвет c='+it.c);
      if(!hex.test(it.k||'')) out.push(t+'плохой цвет заливки k='+it.k);
      if(!(it.d&&it.d.length>10)) out.push(t+'нет описания d');
      const img=CATALOG_IMG[it.id];
      if(!img||!/^data:image\/(jpeg|png|webp);base64,/.test(img)) out.push(t+'нет образца-картинки');
      else{
        const ok=await new Promise(res=>{ const im=new Image(); im.onload=()=>res(im.naturalWidth>=40&&im.naturalHeight>=40); im.onerror=()=>res(false); im.src=img; });
        if(!ok) out.push(t+'образец не декодируется или слишком мал');
      }
      if(!PRESETS.some(x=>x.id===it.type)) out.push(t+'неизвестный тип '+it.type);
    }
    // условные цвета заливки одинаковых расцветок в одном типе не должны слипаться в пикере — допускаем дубли, но считаем
    return {out,n:items.length};
  });
  st.out.forEach(bad); console.log('расцветок в каталоге: '+st.n+', замечаний по данным: '+st.out.length);
  // 2. каждая расцветка как основная и как заполнение
  const ids=(await p.evaluate(()=>[...CAT_BY_ID.keys()])).filter(id=>!process.env.CAT_ONLY||id.startsWith(process.env.CAT_ONLY));
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ca-'));
  await p.locator('.sect-h',{hasText:'Визуализация на фото'}).click(); await p.click('#viz-mock-toggle');
  let n=0;
  for(const id of ids){
    const it=await p.evaluate(id=>CAT_BY_ID.get(id),id); const tag='['+id+'] ';
    // A: основной материал
    await p.evaluate(({id,type})=>{ $('#i-preset').value=type; $('#i-preset').dispatchEvent(new Event('change',{bubbles:true})); $('#i-colorway').value=id; $('#i-colorway').dispatchEvent(new Event('change',{bubbles:true})); syncColorwayUI&&syncColorwayUI(); },{id,type:it.type});
    await p.evaluate(()=>window.__rich()); await p.waitForTimeout(250);
    const info=await p.evaluate(()=>({cw:document.querySelector('#i-colorway').value, est:document.querySelector('#estimate').innerText, mat:curMatId()}));
    if(info.mat!==id) bad(tag+'расцветка не стала основным материалом (curMatId='+info.mat+')');
    if(!info.est.includes(it.a)) bad(tag+'артикул не попал в смету');
    const scan=await p.evaluate(()=>window.__scan().concat(window.__badNums(),window.__overlaps())); scan.forEach(x=>bad(tag+'основной: '+x));
    await p.click('#viz-mock-make'); await p.waitForTimeout(900); await p.click('#viz-json-copy'); await p.waitForTimeout(120);
    let j=null; try{ j=JSON.parse(await p.inputValue('#viz-json-output')); }catch(e){ bad(tag+'JSON не разобрался'); }
    if(j){
      const m=(j.materials||[]).find(x=>String(x.article)===it.a||String(x.name||'').includes(it.a));
      if(!m) bad(tag+'в materials[] нет артикула '+it.a);
      else{ if(!(m.texture_hint&&m.texture_hint.length>20)) bad(tag+'нет описания фактуры'); if(m.real_color_hex&&m.real_color_hex.toLowerCase()!==it.c.toLowerCase()) bad(tag+'real_color_hex '+m.real_color_hex+' != '+it.c); if(!m.real_color_hex&&!m.color_hex) bad(tag+'нет цвета'); }
      const wm=j.walls[0].material; if(!(wm&&(wm.schema_fill_hex||wm.color_hex))) bad(tag+'у стены нет цвета заливки');
    }
    if(n%4===0){   // архив — на каждой четвёртой (скачивание дорогое), чтобы покрыть все типы и разные образцы
      try{ const zip=path.join(tmp,'a.zip'); const [d]=await Promise.all([p.waitForEvent('download',{timeout:20000}),p.locator('#viz-guide-download-all').click()]); await d.saveAs(zip);
        const z=fs.readFileSync(zip); if(!z.includes(Buffer.from('образцы/'+it.a,'utf8'))&&!z.includes(Buffer.from(it.a+'.jpg','utf8'))) bad(tag+'в архиве нет образца '+it.a);
        if(!z.includes(Buffer.from('материалы.jpg','utf8'))) bad(tag+'в архиве нет доски материалов');
      }catch(e){ bad(tag+'архив не скачался: '+String(e).slice(0,100)); }
    }
    // B: как заполнение проёма на фоне обычного бамбука
    await p.evaluate(({id})=>{ $('#i-preset').value='bamboo29'; $('#i-preset').dispatchEvent(new Event('change',{bubbles:true})); $('#i-colorway').value=''; window.__rich(); walls[0].ops[2].fillMat=id; walls[0].ops[0].fillMat=id; wallToForm(); run(); },{id});
    await p.waitForTimeout(250);
    const f=await p.evaluate(id=>({fills:LAST.R.fills.map(f=>f.matId), est:document.querySelector('#estimate').innerText, scheme:document.querySelector('#scheme').innerHTML.toLowerCase().includes(CAT_BY_ID.get(id).k.toLowerCase())}),id);
    if(!f.fills.includes(id)) bad(tag+'заполнение не создало свой пул листов: '+f.fills.join(','));
    if(!f.est.includes(it.a)) bad(tag+'артикул заполнения не попал в смету');
    if(!f.scheme) bad(tag+'на схеме нет условного цвета заливки '+it.k);
    const s2=await p.evaluate(()=>window.__scan().concat(window.__badNums(),window.__overlaps(),window.__consistency())); s2.forEach(x=>bad(tag+'заполнение: '+x));
    await p.click('#viz-mock-make'); await p.waitForTimeout(700); await p.click('#viz-json-copy'); await p.waitForTimeout(100);
    try{ const j2=JSON.parse(await p.inputValue('#viz-json-output')); const fo=(j2.walls[0].filled_openings||[]);
      if(fo.length<1) bad(tag+'в задании нет filled_openings');
      else if(!fo.some(x=>(x.material_name||'').includes(it.a)||(x.article||'')===it.a||JSON.stringify(x).includes(it.c)||JSON.stringify(x).toLowerCase().includes(it.k.toLowerCase()))) bad(tag+'заполнение в задании не опознаётся: '+JSON.stringify(fo[0]).slice(0,160));
    }catch(e){ bad(tag+'JSON заполнения не разобрался'); }
    errs.splice(0).forEach(e=>bad(tag+e));
    n++;
  }
  console.log('расцветок проверено: '+n);
  await b.close();
  console.log(fails?`ПРОВАЛЕНО: ${fails}`:'все проверки пройдены'); process.exit(fails?1:0);
})();
