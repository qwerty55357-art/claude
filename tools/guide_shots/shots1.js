const L=require('./lib.js');
(async()=>{
 const {b,p}=await L.launch(1000);
 await L.setup(p); await require('./demo.js').second(p);
 console.log(await p.evaluate(()=>({walls:walls.map(w=>w.name),cl:cornerLinks.length})));
 // 1. общий вид — разделы свёрнуты, видны все 7 заголовков
 await p.evaluate(()=>{ document.querySelectorAll('#rail .sect').forEach(s=>s.classList.add('closed')); window.scrollTo(0,0); });
 await p.waitForTimeout(300);
 await L.shot(p,'01_overview',{el:'body',scroll:false,clip:{x:0,y:0,width:1500,height:1000},marks:[
   {sel:'.topbar-actions',n:1,at:'bl'},
   {rect:{x:6,y:78,w:380,h:300},n:2,at:"tr",dx:-30,dy:6},
   {sel:'#notes',n:3,at:'tl',dx:-8},
   {sel:'#cards',n:4,at:'tl',dx:-8},
   {sel:'#scheme',n:5,at:'tl',dx:-8}]});
 console.log(p.errs);
 await b.close();
})();
