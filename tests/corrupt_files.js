// Открытие повреждённых и необычных файлов проекта: страница не падает, понятное сообщение, а главное — после неудачного
// открытия прежний проект остаётся целым и с ним можно работать (раньше полузагруженное состояние ломало дальнейшие действия).
// Запуск: NODE_PATH=$(npm root -g) node tests/corrupt_files.js
const {chromium}=require('playwright'); const path=require('path'); const fs=require('fs'); const os=require('os');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
const IN_PAGE=require('./lib/inpage.js');
let fails=0; const ok=(c,w)=>{ if(!c){ fails++; console.log('✗',w); } else console.log('✓',w); };
const W=(o)=>Object.assign({id:1,name:'С',W:3000,H:2500,ceil:2700,ops:[],seamsU:[],vseamsU:[],jointModes:{},pieceMats:{},edges:{top:'cap',bot:'none',left:'cap',right:'cap'},cout:0,cin:0},o||{});
const CASES=[
  ['не JSON','hello world'],
  ['пустой объект','{}'],
  ['массив','[1,2,3]'],
  ['null','null'],
  ['v3 без стен','{"v":3,"walls":[]}'],
  ['старый формат v2','{"v":2,"walls":[{"W":3000,"H":2500}]}'],
  ['стена: ops=null','{"v":3,"walls":[{"W":3000,"H":2500,"ops":null}]}'],
  ['стена: размеры строкой','{"v":3,"walls":[{"W":"abc","H":null,"ops":[]}]}'],
  ['стена без edges',JSON.stringify({v:3,walls:[W({edges:undefined})]})],
  ['проём без размеров',JSON.stringify({v:3,walls:[W({ops:[{kind:'window'}]})]})],
  ['проём не объект',JSON.stringify({v:3,walls:[W({ops:[5,"x",null]})]})],
  ['cornerLinks строкой',JSON.stringify({v:3,walls:[W()],cornerLinks:"x"})],
  ['ledCircuits объектом',JSON.stringify({v:3,walls:[W()],ledCircuits:{a:1}})],
  ['legs не массив',JSON.stringify({v:3,walls:[W()],ledCircuits:[{id:1,kind:'start',legs:5}]})],
  ['manual строкой',JSON.stringify({v:3,walls:[W()],manual:"x"})],
  ['fields: мусор в размерах листа',JSON.stringify({v:3,walls:[W()],fields:{'i-pl':'abc','i-pw':'-5','i-kerf':'1e999','i-nonexistent':1}})],
  ['пустое поле fields',JSON.stringify({v:3,walls:[W()],fields:null})],
  ['viz мусор',JSON.stringify({v:3,walls:[W()],viz:{photos:"x"}})],
  ['fillMat несуществующая расцветка',JSON.stringify({v:3,walls:[W({ops:[{kind:'window',w:800,h:1000,x:500,y:500,fillMat:'slat:0000'}]})]})],
  ['огромные размеры',JSON.stringify({v:3,walls:[W({W:1e9,H:1e9})]})],
];
(async()=>{
  const b=await chromium.launch({executablePath:EXE}); const p=await b.newPage({viewport:{width:1500,height:1000}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160))); p.on('dialog',async d=>{ errs.push('диалог '+d.message().slice(0,80)); await d.accept(); });
  await p.goto(HTML); await p.waitForTimeout(500); await p.evaluate(IN_PAGE);
  await p.evaluate(()=>window.__rich()); await p.waitForTimeout(500);
  const state=()=>p.evaluate(()=>({walls:walls.length,w0:walls[0].W,ops:walls[0].ops.length,sheets:LAST&&LAST.R?LAST.R.sheetsTotal:null,est:document.querySelector('#estimate').innerText.length}));
  const before=await state();
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cf-'));
  for(const [name,body] of CASES){
    const f=path.join(tmp,'p.json'); fs.writeFileSync(f,body);
    errs.splice(0);
    await p.locator('#file-load').setInputFiles(f); await p.waitForTimeout(900);
    const notes=await p.locator('#notes').textContent();
    const pe=errs.splice(0);
    const st=await state().catch(e=>({err:String(e)}));
    // работоспособность: правка поля и пересчёт не падают
    const work=await p.evaluate(()=>{ try{ const e=document.querySelector('#i-kerf'); e.value='5'; e.dispatchEvent(new Event('input',{bubbles:true})); run(); return {ok:true,n:walls.length}; }catch(err){ return {ok:false,err:String(err).slice(0,120)}; } });
    const pe2=errs.splice(0);
    const tag='«'+name+'»: ';
    ok(pe.length===0,tag+'при открытии нет ошибок страницы '+pe.join('|'));
    ok(work.ok&&pe2.length===0,tag+'после открытия приложение работает '+(work.err||'')+pe2.join('|'));
    const same=st.walls===before.walls&&st.w0===before.w0&&st.ops===before.ops;
    const loaded=!same;
    ok(same||/не удалось|повреждён|не проект/i.test(notes)===false,tag+(same?'прежний проект на месте':'файл принят как новый проект'));
    if(same) ok(/Не удалось прочитать/.test(notes),tag+'показано сообщение «Не удалось прочитать проект»');
    // вернуть исходный проект для следующего случая
    await p.evaluate(()=>window.__rich()); await p.waitForTimeout(300); errs.splice(0);
  }
  await b.close();
  console.log(fails?`ПРОВАЛЕНО: ${fails}`:'все проверки пройдены'); process.exit(fails?1:0);
})();
