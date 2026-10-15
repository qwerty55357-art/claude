const L=require('./lib.js');
(async()=>{
 const {b,p}=await L.launch(1300);
 await L.setup(p); await require('./demo.js').second(p);
 await L.shot(p,'23_cutmap',{el:'#cut-meta',union:['#cut-meta','#cutmap-layout'],pad:8,top:110,h:900,marks:[
   {sel:'#shelf-zone',n:1,at:'tl'},{sel:'#cutmap svg',n:2,at:'tl',dx:10,dy:50},{sel:'#cut-meta',n:3,at:'tl'}]});
 console.log(p.errs); await b.close();
})();
