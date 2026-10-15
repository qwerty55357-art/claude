// Драйвер перебора полей (tests/fuzz_fields.js): каждое поле — в отдельном процессе с ограничением по времени, чтобы
// зависание страницы на каком-то значении (например, стена шириной 1e9 мм) не останавливало перебор. При зависании поле
// перепроверяется по значению и выдаётся «ЗАВИСАНИЕ <поле> = <значение>».
// Запуск: NODE_PATH=$(npm root -g) [FUZZ_ONLY=бамбук] [FUZZ_TIMEOUT=40] node tests/fuzz_driver.js
const {spawnSync}=require('child_process'); const path=require('path');
const SCRIPT=path.join(__dirname,'fuzz_fields.js'); const T=+(process.env.FUZZ_TIMEOUT||40)*1000;
const run=(env)=>spawnSync('node',[SCRIPT],{env:Object.assign({},process.env,env),encoding:'utf8',timeout:T,killSignal:'SIGKILL'});
const clean=s=>(s||'').split('\n').filter(l=>!/WebGL|GroupMarker|ERR_CERT|Failed to load resource/.test(l));
const mats=['бамбук','рейка','свой 3000×100','свой 500×500'].filter(m=>!process.env.FUZZ_ONLY||m.includes(process.env.FUZZ_ONLY));
let fails=0, hangs=0;
for(const m of mats){
  const l=run({FUZZ_LIST:'1',FUZZ_ONLY:m}); const list=JSON.parse(clean(l.stdout).filter(x=>x.startsWith('['))[0]);
  let steps=0;
  for(const sel of list){
    const r=run({FUZZ_ONLY:m,FUZZ_SEL:sel});
    if(r.error||r.status===null){
      // зависание: перебираем значения по одному
      for(const v of ['','0','-5','1e9','0.5','99999','abc']){
        const q=run({FUZZ_ONLY:m,FUZZ_SEL:sel,FUZZ_VALS:JSON.stringify([v])});
        if(q.error||q.status===null){ hangs++; console.log('✗ ['+m+'] ЗАВИСАНИЕ '+sel+' = '+JSON.stringify(v)); }
        else clean(q.stdout).filter(x=>x.startsWith('✗')).forEach(x=>{ fails++; console.log(x); });
      }
    } else clean(r.stdout).filter(x=>x.startsWith('✗')).forEach(x=>{ fails++; console.log(x); });
    steps++;
  }
  console.log('['+m+'] полей проверено: '+steps);
}
console.log(fails||hangs?`ПРОВАЛЕНО: ошибок ${fails}, зависаний ${hangs}`:'все проверки пройдены'); process.exit(fails||hangs?1:0);
