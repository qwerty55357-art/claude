const L=require('./lib.js');
(async()=>{
 const {b,p}=await L.launch(2200);
 await L.setup(p); await require('./demo.js').second(p);
 await p.addStyleTag({content:'.rail{max-height:none!important;overflow:visible!important;position:static!important}'});
 await p.waitForTimeout(300);
 const S=n=>`#rail .sect:nth-of-type(${n})`;
 // 01 Объект
 await L.shot(p,'03_sect01',{el:S(1),pad:6,marks:[
   {sel:'#i-client',n:1,at:'tl'},{sel:'#wall-compass',n:2,at:'tl'},{sel:'#i-wname',n:3,at:'tl'},
   {sels:['#i-w','#i-ceil'],n:4,at:'tl'},
   {sels:['#i-hfree','#btn-add-seam'],n:5,at:'tl'},
   {sels:['#i-vfree','#btn-add-vseam'],n:6,at:'tl'},{sel:'#btn-del-wall',n:7,at:'tr'}]});
 // компас
 await L.shot(p,'04_compass',{el:'#wall-compass',pad:18,marks:[
   {sel:'[data-ctype="out"]',n:1,at:'tl'},{sel:'[data-ctype="in"]',n:2,at:'tr'},
   {sel:'[data-cpjump="1"]',n:3,at:'tl'},{sel:'[data-cpjump="2"]',n:4,at:'tr'},{sel:'[data-cpedit]',n:5,at:'tr'},{sel:'[data-cpadd="S"]',n:6,at:'bl'}]});
 // меню угла
 await p.evaluate(()=>{ const e=document.querySelector('[data-cpedit]'); const r=e.getBoundingClientRect(); window.__r=r; });
 await p.locator('[data-cpedit]').click(); await p.waitForTimeout(300);
 await L.shot(p,'05_corner_menu',{el:'#wall-compass',scroll:false,union:['#wall-compass','#mat-menu'],pad:10,marks:[]});
 await p.evaluate(()=>closeMatMenu()); await p.waitForTimeout(200);
 // 02 Панель
 await L.shot(p,'06_sect02',{el:S(2),pad:6,marks:[
   {sel:'#i-preset',n:1,at:'tl'},{sel:'#i-cw-btn',n:2,at:'tl'},{sel:'#i-profcolor',n:3,at:'tl'},
   {sels:['#i-pl','#i-pw'],n:4,at:'tl'},{sel:'#i-orient',n:5,at:'tl'},
   {sel:'#i-sym',n:6,at:'tl',dx:-4},{sel:'#i-brick',n:7,at:'tl',dx:-4},{sel:'#i-offcut',n:8,at:'tl',dx:-4},
   {sels:['#i-minoff','#i-kerf'],n:9,at:'tl'},{sel:'#i-rot',n:10,at:'tl',dx:-4},{sel:'#i-splice',n:11,at:'tl',dx:-4}]});
 // пикер
 await p.setViewportSize({width:1500,height:1050}); await p.locator('#i-cw-btn .mat-pick-btn').click(); await p.waitForTimeout(500);
 await L.shot(p,'07_picker',{el:'#mat-menu',scroll:false,pad:6,marks:[
   {sel:'#mat-menu .mp-tabs',n:1,at:'tl'},{sel:'#mat-menu .mp-search',n:2,at:'tl'},{sel:'#mat-menu .mp-tile.on',n:3,at:'tl'}]});
 await p.evaluate(()=>closeMatMenu()); await p.setViewportSize({width:1500,height:2200}); await p.waitForTimeout(200);
 // 03 Проёмы
 await L.shot(p,'08_sect03',{el:'[data-op="2"]',pad:6,marks:[
   {sel:'[data-op="2"] .opening-h',n:1,at:'tl'},{sel:'[data-op="2"] [data-mini]',n:2,at:'tl'},
   {sel:'[data-op="2"] [data-k="kind"]',n:3,at:'tl'},
   {sels:['[data-op="2"] [data-k="anchorH"]','[data-op="2"] [data-k="off"]'],n:4,at:'tl'},
   {sel:'[data-op="2"] [data-k="w"]',n:5,at:'tl'},
   {sels:['[data-op="2"] [data-k="ylow"]','[data-op="2"] [data-k="yhigh"]'],n:6,at:'tl'},
   {sel:'[data-op="2"] [data-fillpick]',n:7,at:'tl'},
   {sel:'[data-op="2"] [data-k="otkos"]',n:8,at:'tl',dx:-4},
   ]});
 await L.shot(p,'08b_addop',{el:'#btn-add-op',pad:6,marks:[{sel:'#btn-add-op',n:9,at:'tl'}]});
 await L.shot(p,'09_sect04',{el:S(4),pad:6,marks:[
   {sel:'#i-stock',n:1,at:'tl'},{sels:['#i-e-top','#i-e-right'],n:2,at:'tl'},
   {sels:['#i-joint-v','#i-joint-h'],n:3,at:'tl',dx:-4},{sel:'#jointsv-list',n:4,at:'tl'},{sel:'#i-edgeops',n:5,at:'tl',dx:-4}]});
 await L.shot(p,'10_sect05',{el:S(5),pad:6,marks:[{sel:'#i-glue',n:1,at:'tl'},{sel:'#i-gluer',n:2,at:'tl'}]});
 await p.evaluate(()=>document.querySelector('#rail .sect:nth-of-type(6)').classList.remove('closed'));
 await L.shot(p,'11_sect06',{el:S(6),pad:6,marks:[{sel:'#p-panel',n:1,at:'tl'},{sel:'#p-led',n:2,at:'tl'},{sel:'#p-markup',n:3,at:'tl'}]});
 console.log(p.errs);
 await b.close();
})();
