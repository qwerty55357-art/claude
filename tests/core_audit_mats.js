// Аудит ядра по ВСЕМ материалам: тот же набор свойств, что и в audit.js (136 проверок), но размеры основного листа берутся из
// каждого типа материала (бамбук 2900×1150, мрамор 2800×1200, рейка 2900×150, скалы 2900×1200/2900×600, свой размер —
// включая необычные), а заполнения проёмов — из всех типов И всех расцветок каталога (id вида «slat:5139»).
// Запуск: NODE_PATH=$(npm root -g) [AUDIT_N=3000] node tests/core_audit_mats.js
const {chromium}=require('playwright'); const path=require('path'); const fs=require('fs');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
(async()=>{
  let src=fs.readFileSync(process.env.AUDIT_SRC||path.join(__dirname,'../audit.js'),'utf8').replace(/^const C=require\('\.\/core'\);\s*/,'');
  src=src.replace(/const N=\d+;/,'const N='+(+(process.env.AUDIT_N||3000))+';');
  const a="pl:[2900,2500,2700][Math.floor(rand()*3)],pw:1150,";
  if(!src.includes(a)) throw new Error('генератор G изменился — обновите замену');
  src=src.replace(a,"...(()=>{ const m=MATS[Math.floor(rand()*MATS.length)]; return {pl:m[0],pw:m[1]}; })(),");
  const f="fillMat:r()<0.3?['marble','slat','rockL','rockS'][Math.floor(r()*4)]:null,";
  if(!src.includes(f)) throw new Error('генератор fillMat изменился — обновите замену');
  src=src.replace(f,"fillMat:r()<0.3?FILLS[Math.floor(r()*FILLS.length)]:null,");
  src=src.split('bugs.length<30').join('bugs.length<5000');
  src=src.split('bugs.slice(0,20)').join('bugs.slice(0,5000)');
  const idl="const id=`#${t} walls:${nWalls}`;";
  if(!src.includes(idl)) throw new Error('id сценария изменился — обновите замену');
  src=src.replace(idl,"const id=`#${t} ${G.pl}x${G.pw} fill:${G.fillMat||'-'} walls:${nWalls}`; if(typeof DUMP!=='undefined'&&DUMP.has(t)) console.log('DUMP '+JSON.stringify({t,G,wallsArr}));");
  const pre="const DUMP=new Set('"+(process.env.AUDIT_DUMP||'')+"'.split(',').filter(Boolean).map(Number));\n"+
            "const MATS=[[2900,1150],[2800,1200],[2900,150],[2900,1200],[2900,600],[2440,1220],[1200,600],[3000,100],[2000,2000]];\n"+
            "const FILLS=C.PRESETS.map(p=>p.id).filter(id=>id!=='custom');\n";
  const b=await chromium.launch({executablePath:EXE}); const p=await b.newPage();
  const lines=[]; p.on('console',m=>lines.push(m.text())); p.on('pageerror',e=>lines.push('PAGEERROR '+e.message));
  await p.goto(HTML); await p.waitForTimeout(500);
  await p.evaluate(code=>{
    const C={computeProject,PSU_NOMINALS,jointSegKey,subIn,rotateCuts,PRESETS,wallS,wallLedGraph,subRanges,holeRects,buildLayout};
    new Function('C',code)(C);
  },pre+src);
  const out=lines.join('\n'); await b.close();
  const cnt={}; (out.match(/^  [A-Za-z0-9]+ ::/gm)||[]).forEach(l=>{ const k=l.trim().split(' ')[0]; cnt[k]=(cnt[k]||0)+1; });
  console.log(process.env.AUDIT_FULL?out:out.split('\n').slice(0,40).join('\n')); console.log('по проверкам:',JSON.stringify(cnt));
  const m=lines.join('\n').match(/провалено: (\d+) \| падений: (\d+)/);
  process.exit(m&&m[1]==='0'&&m[2]==='0'?0:1);
})();
