const L=require('./lib.js');
(async()=>{
 const {b,p}=await L.launch(1300);
 await L.setup(p); await require('./demo.js').second(p);
 await p.addStyleTag({content:'.rail{max-height:none!important;overflow:visible!important;position:static!important}'});
 const rc=async(a,z)=>{ await p.evaluate(a=>{const e=document.querySelector(a); const r=e.getBoundingClientRect(); window.scrollTo(0,window.scrollY+r.top-110);},a); return p.evaluate(([a,z])=>{const A=document.querySelector(a).getBoundingClientRect(),Z=document.querySelector(z).getBoundingClientRect(); return {x:0,y:A.top-34,width:410,height:Z.bottom-A.top+44};},[a,z]); };
 // --- вертикальные стыки
 await p.check('#i-vfree'); await p.waitForTimeout(300);
 await p.fill('#vseam-step','700'); await p.click('#btn-vseam-fill'); await p.waitForTimeout(500);
 await p.locator('#vseams-list [data-vseampos]').first().fill('150'); await p.waitForTimeout(500);
 await L.shot(p,'27_vfree_list',{el:'#i-vfree',clip:await rc('#i-vfree','#btn-add-vseam'),pad:10,top:110,marks:[
   {sel:'label.chk:has(#i-vfree)',n:1,at:'tl',dx:-6},{sel:'#vseams-list [data-vseampos]',n:2,at:'tl'},
   {sel:'#vseams-list [data-vseamgap]',n:3,at:'tl',nth:1},{sel:'#vseam-fill',n:4,at:'tl'},{sel:'#btn-add-vseam',n:5,at:'tl'}]});
 await L.shot(p,'28_vfree_scheme',{el:'#scheme',pad:8,top:110,marks:[
   {sel:'.wall-scheme.on [data-jvclick="150"]',n:1,at:'tl',dy:-6,dx:-8},{sel:'.wall-scheme.on [data-jvclick="850"]',n:2,at:'tr',dy:-6}]});
 // меню стыка в свободном режиме
 await p.evaluate(()=>{ document.querySelector('#i-vfree').checked=true; });
 // --- горизонтальные стыки
 await p.check('#i-hfree'); await p.waitForTimeout(300);
 await p.fill('#hseam-step','1000'); await p.selectOption('#hseam-from','l'); await p.click('#btn-hseam-fill'); await p.waitForTimeout(500);
 await L.shot(p,'29_hfree_list',{el:'#i-hfree',clip:await rc('#i-hfree','#btn-add-seam'),pad:10,top:110,marks:[
   {sel:'label.chk:has(#i-hfree)',n:1,at:'tl',dx:-6},{sel:'#seams-list [data-seampos]',n:2,at:'tl'},{sel:'#seams-list [data-seamgap]',n:3,at:'tl',nth:1},
   {sel:'#hseam-fill',n:4,at:'tl'},{sel:'#btn-add-seam',n:5,at:'tl'}]});
 await L.shot(p,'30_hfree_scheme',{el:'#scheme',pad:8,top:110,marks:[]});
 // --- радиусный угол
 await p.locator('[data-cpedit]').click(); await p.waitForTimeout(300);
 await p.locator('#mat-menu button',{hasText:'Радиусный'}).click(); await p.waitForTimeout(600);
 await L.shot(p,'36_corner_radius',{el:'#corner-scheme-block',pad:8,top:100,marks:[{sel:'#corner-scheme',n:1,at:'tl'}]});
 console.log(p.errs);
 await b.close();
})();
