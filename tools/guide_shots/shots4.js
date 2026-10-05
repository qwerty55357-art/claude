const L=require('./lib.js');
(async()=>{
 const {b,p}=await L.launch(1300);
 await L.setup(p); await require('./demo.js').second(p);
 await p.addStyleTag({content:'.rail{max-height:none!important;overflow:visible!important;position:static!important}'});
 await p.locator('#led-draw').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
 const node=async k=>p.evaluate(k=>{const e=document.querySelector('#led-draw [data-lednode="'+k+'"]');const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}},k);
 const draw=async(a,bk)=>{ const A=await node(a),B=await node(bk); await p.mouse.move(A.x,A.y); await p.mouse.down(); await p.mouse.move((A.x+B.x)/2,(A.y+B.y)/2,{steps:6}); await p.mouse.move(B.x,B.y,{steps:6}); await p.mouse.up(); await p.waitForTimeout(300); };
 await draw('0_2600','4200_2600');
 await L.shot(p,'20_led_menu',{el:'#led-draw',scroll:false,union:['#led-draw','#mat-menu'],pad:10,marks:[{sel:'#mat-menu',n:1,at:'tr',pad:0}]});
 await p.locator('#mat-menu button',{hasText:'Стартовый'}).click(); await p.waitForTimeout(400);
 await draw('2500_2250','3800_2250');
 await p.locator('#mat-menu button',{hasText:'Соединительный'}).click(); await p.waitForTimeout(400);
 await L.shot(p,'21_led_block',{el:'#led-draw-block',pad:8,top:90,marks:[
   {sel:'#btn-led-mode-snap',n:1,at:'tl'},{sel:'#btn-led-mode-free',n:2,at:'tr'},{sel:'#led-draw',n:3,at:'tl'},
   {sel:'#led-circuits-list',n:4,at:'tl'},{sels:['#i-ledlen','#i-ledtemp'],n:5,at:'tl'},{sel:'#led-summary',n:6,at:'tl'}]});
 // 3D
 await p.locator('#scene3d').scrollIntoViewIfNeeded(); await p.waitForTimeout(1200);
 await L.shot(p,'22_3d',{el:'#scene3d-block',pad:8,top:90,marks:[{sel:'#scene3d',n:1,at:'tl'}]});
 // карта раскроя
 await L.shot(p,'23_cutmap',{el:'#cutmap',union:['#shelf-zone','#cutmap'],pad:8,top:110,marks:[
   {sel:'#shelf-zone',n:1,at:'tl'},{sel:'#cutmap svg',n:2,at:'tl',dy:50},{sel:'#cut-meta',n:3,at:'tl'}]});
 await L.shot(p,'24_cuts',{el:'#cuts-block',pad:8,top:90,marks:[{sel:'#cuts',n:1,at:'tl'}]});
 await L.shot(p,'25_spec',{el:'#spec',pad:10,top:100,marks:[]});
 await L.shot(p,'26_estimate',{el:'#estimate',pad:10,top:100,marks:[]});
 console.log(p.errs);
 await b.close();
})();
