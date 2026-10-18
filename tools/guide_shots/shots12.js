// Выступающий откос: накладка из другого материала — меню стороны откоса, схема, карта раскроя. Запуск из tools/guide_shots.
const L=require('./lib.js');
(async()=>{
 const {b,p}=await L.launch(1500);
 await L.setup(p);
 await p.evaluate(()=>{ const o=walls[0].ops[0]; o.otkos=true; o.depth=200; o.otkosOverlap=120;
   o.otkosMode={left:'protrude',right:'protrude',top:'protrude',bottom:'corner'}; o.otkosOuterMat={left:'marble:044',right:'marble:044',top:'marble:044'}; renderOpenings(); run(); });
 await p.waitForTimeout(1500);
 // схема: окно с накладкой из другого материала
 await L.shot(p,'58_otkos_outer_scheme',{el:'#scheme',pad:4,top:80,marks:[
   {sel:'[data-otkosside="top"]',n:1,at:'tr',pad:2},{sel:'[data-otkosside="left"]',n:2,at:'tl',pad:2}]});
 // меню стороны откоса
 const bb=await p.evaluate(()=>{ const e=document.querySelector('[data-otkosside="left"]'); e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect(); return [r.x+r.width/2,r.y+r.height/2]; });
 await p.mouse.move(bb[0],bb[1]); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(400);
 await L.shot(p,'59_otkos_outer_menu',{el:'#mat-menu',scroll:false,pad:6,h:470,marks:[]});
 await p.evaluate(()=>closeMatMenu()); await p.waitForTimeout(200);
 // карта раскроя: лист мрамора с накладками
 const clip=await p.evaluate(()=>{ const s=document.querySelector('#cutmap svg[data-pool="otkos:marble:044"]'); s.scrollIntoView({block:'center'}); const r=s.getBoundingClientRect(); return {x:Math.max(0,r.x-14),y:Math.max(0,r.y-92),width:Math.max(r.width+28,900),height:r.height+104}; });
 await p.waitForTimeout(200);
 await p.screenshot({path:'img/60_otkos_outer_cutmap.png',clip}); console.log('ok 60_otkos_outer_cutmap');
 console.log('ошибки страницы:',p.errs.length?p.errs:'нет');
 await b.close();
})();
