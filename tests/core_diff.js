// Дифференциальный тест ядра: на одних и тех же случайных входах (стены с проёмами, откосами, стыками, ручными
// вертикальными/горизонтальными стыками, все режимы раскладки) полный результат computeProject() новой версии
// обязан ПОБАЙТНО совпасть с эталонной версией (до каталога и свободных стыков). Свободные режимы выключены.
// Запуск: RASKROY_OLD=/путь/к/эталону.html NODE_PATH=$(npm root -g) [DIFF_N=3000] node tests/core_diff.js
const {chromium}=require('playwright'); const path=require('path'); const fs=require('fs');
const NEW='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const OLD='file://'+path.resolve(process.env.RASKROY_OLD||'/tmp/old.html');
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
const N=+(process.env.DIFF_N||3000);
// генератор — тот же, что в audit.js (без свободных режимов)
const src=fs.readFileSync(path.join(__dirname,'../audit.js'),'utf8');
const gen=new Function('NOFREE',src.slice(src.indexOf('const base='),src.indexOf('const N='))+';return {rnd,mkWall,base};')(true);
const rand=gen.rnd(20261005), inputs=[];
for(let t=0;t<N;t++){
  const nWalls=1+Math.floor(rand()*3);
  const G=Object.assign({},gen.base,{pl:[2900,2500,2700][Math.floor(rand()*3)],pw:1150,
    orient:rand()<0.3?'h':'v',sym:rand()<0.5,offcut:rand()<0.85,splice:rand()<0.4,rot:rand()<0.3,
    brick:rand()<0.5,jointV:rand()<0.85,jointH:rand()<0.9,ledMaxRun:rand()<0.5?[2000,3500,5000,8000][Math.floor(rand()*4)]:5000});
  const ws=Array.from({length:nWalls},(_,i)=>Object.assign(gen.mkWall(rand),{id:i+1}));
  // связанные стены: углы прямые/радиусные/«напротив», внешние и внутренние, разные радиусы
  const links=[];
  for(let i=0;i+1<nWalls;i++) if(rand()<0.8) links.push({id:i+1,kind:['sharp','radius','radius','across'][Math.floor(rand()*4)],type:rand()<0.5?'out':'in',
    angle:rand()<0.6?90:[60,75,105,120][Math.floor(rand()*4)],radius:[0,150,300,450,600][Math.floor(rand()*5)],distance:rand()<0.2?[100,300][Math.floor(rand()*2)]:0,
    flatA:rand()<0.2?100:0,flatB:rand()<0.2?100:0,aw:i+1,as:'right',bw:i+2,bs:'left'});
  if(nWalls===1&&rand()<0.3) links.push({id:1,kind:'radius',type:'out',angle:90,radius:300,distance:0,aw:1,as:rand()<0.5?'left':'right',bw:'',bs:''});
  inputs.push({G,walls:ws,links});
}
const runIn=async(browser,url)=>{
  const p=await browser.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto(url); await p.waitForTimeout(500);
  const res=await p.evaluate(inputs=>{
    const rep=(k,v)=>v instanceof Map?[...v]:(typeof v==='function'?undefined:v);
    const hash=s=>{ let h1=0x811c9dc5,h2=0x1b873593; for(let i=0;i<s.length;i++){ const c=s.charCodeAt(i); h1=Math.imul(h1^c,16777619)>>>0; h2=Math.imul(h2+c,2246822519)>>>0; } return h1.toString(16)+h2.toString(16); };
    return inputs.map(({G,walls:w,links})=>{ try{ const s=JSON.stringify(computeProject(G,JSON.parse(JSON.stringify(w)),{},JSON.parse(JSON.stringify(links)),[]),rep); return hash(s)+':'+s.length; }catch(e){ return 'CRASH '+e.message; } });
  },inputs);
  await p.close(); return {res,errs};
};
(async()=>{
  const b=await chromium.launch({executablePath:EXE});
  const a=await runIn(b,OLD), n=await runIn(b,NEW); await b.close();
  let diff=0; const bad=[]; a.res.forEach((x,i)=>{ if(x!==n.res[i]){ diff++; if(bad.length<5) bad.push(i+': '+x+' != '+n.res[i]); } });
  const crashes=n.res.filter(x=>x.startsWith('CRASH')).length;
  console.log(`входов: ${N} | расхождений с эталоном: ${diff} | падений: ${crashes} | ошибок страницы: ${n.errs.length+a.errs.length}`);
  bad.forEach(x=>console.log('  '+x));
  process.exit(diff||crashes||n.errs.length?1:0);
})();
