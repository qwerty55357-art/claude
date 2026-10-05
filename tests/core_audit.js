// Аудит расчётного ядра (audit.js) в браузере: функции ядра берутся прямо из загруженной страницы
// raskroy.html (раньше audit.js читал вырезанный из файла core.js — теперь отдельный файл не нужен).
// Запуск: NODE_PATH=$(npm root -g) [AUDIT_N=2000] node tests/core_audit.js
const {chromium}=require('playwright'); const path=require('path'); const fs=require('fs');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
(async()=>{
  let src=fs.readFileSync(path.join(__dirname,'../audit.js'),'utf8').replace(/^const C=require\('\.\/core'\);\s*/,'');
  if(process.env.AUDIT_N) src=src.replace(/const N=\d+;/,'const N='+(+process.env.AUDIT_N)+';');
  const b=await chromium.launch({executablePath:EXE}); const p=await b.newPage();
  const lines=[]; p.on('console',m=>lines.push(m.text())); p.on('pageerror',e=>lines.push('PAGEERROR '+e.message));
  await p.goto(HTML); await p.waitForTimeout(500);
  await p.evaluate(code=>{
    const C={computeProject,PSU_NOMINALS,jointSegKey,subIn,rotateCuts,PRESETS,wallS,wallLedGraph,subRanges,holeRects,buildLayout};
    new Function('C',code)(C);
  },src);
  console.log(lines.join('\n')); await b.close();
  const m=lines.join('\n').match(/провалено: (\d+) \| падений: (\d+)/);
  process.exit(m&&m[1]==='0'&&m[2]==='0'?0:1);
})();
