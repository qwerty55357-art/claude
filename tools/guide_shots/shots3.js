const L=require('./lib.js');
(async()=>{
 const {b,p}=await L.launch(1300);
 await L.setup(p); await require('./demo.js').second(p);
 await p.addStyleTag({content:'.rail{max-height:none!important;overflow:visible!important;position:static!important}'});
 await p.waitForTimeout(300);
 // уведомления и карточки
 await L.shot(p,'12_notes_cards',{el:'#notes',union:['#notes','#cards'],pad:8,marks:[
   {sel:'#notes',n:1,at:'tl',dx:-6},{sel:'#cards',n:2,at:'tl',dx:-6}]});
 // схема
 await L.shot(p,'13_scheme',{el:'#scheme-meta',union:['#scheme-meta','#scheme','#scheme + .legend'],pad:10,top:140,marks:[
   {sel:'#scheme-meta',n:1,at:'tl'},
   {sel:'.wall-scheme.on [data-piececlick]',n:2,at:'tl',nth:1,box:false,dx:30,dy:30},
   {sel:'.wall-scheme.on [data-drag="1"]',n:3,at:'tl'},{sel:'.wall-scheme.on [data-drag="2"]',n:4,at:'tl'},
   {sel:'.wall-scheme.on [data-otkosop="2"]',n:5,at:'tl',nth:0},
   {sel:'#scheme + .legend',n:6,at:'tl'}]});
 const menuShot=async(name,loc,maxH,off)=>{
   await loc.scrollIntoViewIfNeeded(); await p.evaluate(()=>window.scrollBy(0,0));
   const bb=await loc.boundingBox();
   await p.mouse.click(bb.x+(off?off:bb.width/2),bb.y+(off?off:bb.height/2)); await p.waitForTimeout(300);
   const m=await p.evaluate(()=>{const r=document.querySelector('#mat-menu').getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height};});
   const x0=Math.max(0,Math.min(m.x,bb.x)-60), y0=Math.max(0,Math.min(m.y,bb.y)-60), x1=Math.max(m.x+m.w,bb.x+bb.width)+60, y1=Math.max(m.y+m.h,bb.y+bb.height)+40;
   await L.shot(p,name,{scroll:false,clip:{x:x0,y:y0,width:Math.min(1500-x0,x1-x0),height:Math.min(maxH||9999,y1-y0)},marks:[
     {rect:{x:bb.x,y:bb.y,w:bb.width,h:bb.height},n:1,at:'tl',pad:4},{sel:'#mat-menu',n:2,at:'tr',pad:0}]});
   await p.evaluate(()=>closeMatMenu());
 };
 await menuShot('14_menu_joint',p.locator('.wall-scheme.on [data-jvclick="2100"]').first());
 await menuShot('15_menu_edge',p.locator('.wall-scheme.on [data-edgeclick="top"]').first());
 await menuShot('16_menu_otkos',p.locator('.wall-scheme.on [data-otkosop="2"]').nth(1),420);
 await menuShot('17_menu_fill',p.locator('.wall-scheme.on [data-drag="1"]').first(),480,25);
 await menuShot('18_menu_piece',p.locator('.wall-scheme.on [data-piececlick]').nth(2),480);
 console.log(p.errs);
 await b.close();
})();
