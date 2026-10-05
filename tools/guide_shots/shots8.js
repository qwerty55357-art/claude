const L=require('./lib.js');
(async()=>{
 const {b,p}=await L.launch(1050);
 await L.setup(p); await require('./demo.js').second(p);
 await p.addStyleTag({content:'.rail{max-height:none!important;overflow:visible!important;position:static!important}'});
 for(const [tab,name] of [['Рейка','07b_picker_slat'],['Мрамор','07c_picker_marble']]){
   await p.locator('[data-op="2"] [data-fillpick]').scrollIntoViewIfNeeded(); await p.locator('[data-op="2"] [data-fillpick]').click(); await p.waitForTimeout(300);
   await p.locator('#mat-menu .mp-tab',{hasText:tab}).click(); await p.waitForTimeout(400);
   const r=await p.evaluate(()=>{const e=document.querySelector('#mat-menu').getBoundingClientRect(); return {x:e.x,y:e.y,width:e.width,height:Math.min(e.height,520)};});
   await L.shot(p,name,{scroll:false,clip:r,marks:[]});
   await p.evaluate(()=>closeMatMenu());
 }
 await b.close();
})();
