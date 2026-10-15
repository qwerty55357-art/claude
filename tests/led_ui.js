// LED мышью (рисование отрезков) на разных материалах: протяжка по стыкам (snap) и свободная линия, смена способа,
// удаление, отмена; длина идёт в смету, ошибок страницы и NaN нет, разделы согласованы.
// Запуск: NODE_PATH=$(npm root -g) [LED_ONLY=рейка] node tests/led_ui.js
const {chromium}=require('playwright'); const path=require('path');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
const IN_PAGE=require('./lib/inpage.js');
let fails=0; const ok=(c,w)=>{ if(!c){ fails++; console.log('✗',w); } else console.log('✓',w); };
const MATS=[{n:'бамбук',preset:'bamboo29'},{n:'рейка',preset:'slat'},{n:'свой 3000×100',preset:'custom',pl:3000,pw:100},{n:'свой 500×500',preset:'custom',pl:500,pw:500}].filter(m=>!process.env.LED_ONLY||m.n.includes(process.env.LED_ONLY));
(async()=>{
  const b=await chromium.launch({executablePath:EXE});
  for(const M of MATS){
    const p=await b.newPage({viewport:{width:1500,height:1300}}); const errs=[]; const tag='['+M.n+'] ';
    p.on('pageerror',e=>errs.push(String(e).slice(0,160))); p.on('dialog',async d=>{ errs.push('диалог '+d.message().slice(0,80)); await d.accept(); });
    await p.goto(HTML); await p.waitForTimeout(400); await p.evaluate(IN_PAGE);
    await p.selectOption('#i-preset',M.preset); if(M.preset==='custom'){ await p.fill('#i-pl',String(M.pl)); await p.fill('#i-pw',String(M.pw)); }
    await p.evaluate(()=>window.__rich()); await p.waitForTimeout(800);
    // фокус остаётся в поле панели (пользователь только что правил число): клик по пункту меню снимает его и запускает change → run() —
    // раньше выбор способа тогда молча терялся (меню держало «старый» объект контура)
    await p.fill('#i-kerf','6');   // значение отличается от прежнего — change сработает при потере фокуса
    // убираем готовый контур — рисуем с нуля
    await p.evaluate(()=>{ ledCircuits=[]; run(); }); await p.waitForTimeout(300);
    const led0=await p.evaluate(()=>LAST.R.led?LAST.R.led.len:0);
    // узлы нижней кромки активной стены
    const nodes=await p.evaluate(()=>[...document.querySelectorAll('#led-draw [data-lednode]')].map(e=>{ const r=e.getBoundingClientRect(); const [x,y]=e.dataset.lednode.split('_').map(Number); return {k:e.dataset.lednode,x,y,cx:r.x+r.width/2,cy:r.y+r.height/2,w:r.width}; }).filter(n=>n.w>0));
    ok(nodes.length>=4,tag+'на схеме LED есть узлы: '+nodes.length);
    const bottom=nodes.filter(n=>n.y===0).sort((a,c)=>a.x-c.x);
    if(bottom.length>=2){
      const A=bottom[0], B=bottom[bottom.length-1];
      await p.locator('#led-draw').scrollIntoViewIfNeeded();
      const A2=await p.evaluate(k=>{ const e=document.querySelector('#led-draw [data-lednode="'+k+'"]'); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; },A.k);
      const B2=await p.evaluate(k=>{ const e=document.querySelector('#led-draw [data-lednode="'+k+'"]'); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; },B.k);
      await p.mouse.move(A2.x,A2.y); await p.mouse.down(); await p.mouse.move((A2.x+B2.x)/2,A2.y,{steps:6}); await p.mouse.move(B2.x,B2.y,{steps:6}); await p.mouse.up(); await p.waitForTimeout(500);
      const n1=await p.evaluate(()=>ledCircuits.length);
      ok(n1===1,tag+'протяжка вдоль нижней кромки создала отрезок: '+n1);
      const menuOpen=await p.locator('text=Удалить отрезок').count();
      ok(menuOpen>=1,tag+'после протяжки открылось меню способа реализации');
      await p.locator('text=Соединительный профиль').first().click(); await p.waitForTimeout(400);
      const kind=await p.evaluate(()=>ledCircuits[0].kind); ok(kind==='joint',tag+'способ сменился на соединительный: '+kind);
      const led1=await p.evaluate(()=>LAST.R.led?LAST.R.led.len:0);
      ok(led1>led0+0.5,tag+'длина ленты выросла: '+led0.toFixed(1)+' → '+led1.toFixed(1));
      const est=await p.evaluate(()=>document.querySelector('#estimate').innerText); ok(/LED-профиль соединительный/.test(est),tag+'в смете есть соединительный LED-профиль');
      // удаление через меню
      await p.evaluate(()=>{ const e=document.querySelector('#led-draw [data-ledcircuit]'); const r=e.getBoundingClientRect(); window.__pt={x:r.x+r.width/2,y:r.y+r.height/2}; });
      const pt=await p.evaluate(()=>window.__pt); await p.mouse.click(pt.x,pt.y); await p.waitForTimeout(300);
      if(await p.locator('text=Удалить отрезок').count()){ await p.locator('text=Удалить отрезок').first().click(); await p.waitForTimeout(400); }
      ok(await p.evaluate(()=>ledCircuits.length)===0,tag+'отрезок удалён через меню');
      await p.locator('#btn-undo').click(); await p.waitForTimeout(700);
      ok(await p.evaluate(()=>ledCircuits.length)===1,tag+'отмена вернула отрезок');
    } else ok(false,tag+'нет узлов на нижней кромке');
    // свободная линия: между двумя произвольными узлами
    await p.click('#btn-led-mode-free');
    const free=await p.evaluate(()=>{ const ns=[...document.querySelectorAll('#led-draw [data-lednode]')].map(e=>{ const r=e.getBoundingClientRect(); const [x,y]=e.dataset.lednode.split('_').map(Number); return {x,y,cx:r.x+r.width/2,cy:r.y+r.height/2}; }); ns.sort((a,b)=>a.x+a.y-(b.x+b.y)); return [ns[0],ns[ns.length-1]]; });
    const before=await p.evaluate(()=>ledCircuits.length);
    await p.mouse.move(free[0].cx,free[0].cy); await p.mouse.down(); await p.mouse.move((free[0].cx+free[1].cx)/2,(free[0].cy+free[1].cy)/2,{steps:6}); await p.mouse.move(free[1].cx,free[1].cy,{steps:6}); await p.mouse.up(); await p.waitForTimeout(500);
    const after=await p.evaluate(()=>({n:ledCircuits.length,free:ledCircuits.flatMap(c=>c.legs).filter(l=>l.el==='free').length}));
    ok(after.n===before+1&&after.free>=1,tag+'свободная линия создана: '+JSON.stringify(after));
    await p.keyboard.press('Escape'); await p.mouse.click(5,5); await p.waitForTimeout(300);
    const bad=await p.evaluate(()=>window.__scan().concat(window.__badNums(),window.__consistency(),window.__overlaps()));
    ok(bad.length===0,tag+'разделы согласованы, NaN нет: '+bad.join(' | '));
    ok(errs.length===0,tag+'ошибок страницы нет '+errs.join('|'));
    await p.close();
  }
  await b.close();
  console.log(fails?`ПРОВАЛЕНО: ${fails}`:'все проверки пройдены'); process.exit(fails?1:0);
})();
