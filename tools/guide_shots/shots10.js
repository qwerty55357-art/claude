const L=require('./lib.js');
(async()=>{
 const {b,p}=await L.launch(1400);
 await p.locator('#file-load').setInputFiles('/home/user/claude/tests/fixtures/slat_openings.json'); await p.waitForTimeout(1500);
 await p.evaluate(()=>{ ledCircuits=[]; run(); }); await p.waitForTimeout(500);
 await p.addStyleTag({content:'.rail{max-height:none!important;overflow:visible!important;position:static!important}'});
 await L.shot(p,'50_slat_scheme',{el:'#scheme-meta',union:['#scheme-meta','#scheme','#scheme + .legend'],pad:10,top:110,marks:[
   {sel:'.wall-scheme.on [data-jvfill]',n:1,at:'tr',box:false,dx:6,dy:120},
   {sel:'.wall-scheme.on [data-fillseam]',n:2,at:'l',box:false,dx:-6},
   {sel:'.wall-scheme.on [data-edgeclick="left"]',n:3,at:'l',box:false,dy:-120},
   {sel:'.wall-scheme.on [data-drag="3"]',n:4,at:'c',box:false,dy:-90}]});
 await L.shot(p,'51_slat_cutmap',{el:'#cutmap',pad:8,top:130,h:860,marks:[{sel:'#cutmap svg[data-pool="slat:5139"]',n:1,at:'tl',box:false,dx:12,dy:10}]});
 await p.locator('#openings').scrollIntoViewIfNeeded();
 await L.shot(p,'52_slat_opening',{el:'[data-op="3"]',pad:6,top:110,marks:[
   {sel:'[data-op="3"] [data-fillpick]',n:1,at:'tl'},{sel:'[data-op="3"] [data-k="fillSeams"]',n:2,at:'tl',dx:-4}]});
 console.log(p.errs); await b.close();
})();
