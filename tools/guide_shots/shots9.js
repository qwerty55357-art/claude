const L=require('./lib.js'); const fs=require('fs');
(async()=>{
 const {b,p}=await L.launch(1300);
 await L.setup(p); await require('./demo.js').second(p);
 await p.addStyleTag({content:'.rail{max-height:none!important;overflow:visible!important;position:static!important}'});
 await p.locator('#rail .sect:nth-of-type(7) .sect-h').click(); await p.waitForTimeout(200);
 await p.locator('#viz-photo').setInputFiles('room.jpg');
 await p.waitForFunction(()=>document.querySelector('#viz-canvas').width>100); await p.waitForTimeout(1000);
 // список целей: раскрываем select, чтобы были видны все пункты
 await p.evaluate(()=>{ const s=document.querySelector('#viz-target'); s.size=Math.min(12,s.options.length); });
 await L.shot(p,'g5_targets',{el:'#viz-target',clip:await (async()=>{ await p.evaluate(()=>{const e=document.querySelector('#viz-wall').getBoundingClientRect(); window.scrollTo(0,window.scrollY+e.top-110);}); return p.evaluate(()=>{const A=document.querySelector('#viz-wall').getBoundingClientRect(),Z=document.querySelector('#viz-target').getBoundingClientRect(); return {x:0,y:A.top-30,width:410,height:Z.bottom-A.top+44};}); })(),marks:[
   {sel:'#viz-wall',n:1,at:'tl'},{sel:'#viz-target',n:2,at:'tl'}]});
 await p.evaluate(()=>{ const s=document.querySelector('#viz-target'); s.size=1; });
 await p.locator('#viz-canvas').scrollIntoViewIfNeeded(); await p.evaluate(()=>window.scrollBy(0,-90)); await p.waitForTimeout(200);
 const box=()=>p.locator('#viz-canvas').boundingBox();
 const PT=[[420,210],[1500,230],[1500,1000],[430,1010]];
 const labels=['левый верхний угол стены','правый верхний угол','правый нижний угол','левый нижний угол'];
 // лупа: после двух точек наводим на третий угол
 for(let i=0;i<2;i++){ const bx=await box(); await p.mouse.click(bx.x+PT[i][0]*bx.width/1920,bx.y+PT[i][1]*bx.width/1920); await p.waitForTimeout(80); }
 { const bx=await box(); await p.mouse.move(bx.x+PT[2][0]*bx.width/1920,bx.y+PT[2][1]*bx.width/1920,{steps:5}); await p.waitForTimeout(400);
   const k=bx.width/1920;
   await L.shot(p,'g3_loupe',{scroll:false,clip:{x:bx.x,y:bx.y,width:bx.width,height:bx.height},marks:[
     {rect:{x:bx.x+PT[2][0]*k-14,y:bx.y+PT[2][1]*k-14,w:28,h:28},n:3,at:'br',text:'ставим перекрестие ровно в угол — лупа показывает место крупно',tx:-430,ty:-34}]}); }
 for(let i=2;i<4;i++){ const bx=await box(); await p.mouse.click(bx.x+PT[i][0]*bx.width/1920,bx.y+PT[i][1]*bx.width/1920); await p.waitForTimeout(80); }
 await p.mouse.move(5,5); await p.waitForTimeout(300);
 { const bx=await box(); const k=bx.width/1920;
   await L.shot(p,'g2_points',{scroll:false,clip:{x:bx.x,y:bx.y,width:bx.width,height:bx.height},marks:PT.map((q,i)=>({rect:{x:bx.x+q[0]*k-12,y:bx.y+q[1]*k-12,w:24,h:24},n:i+1,at:['tl','tr','br','bl'][i],box:false,
     text:labels[i],tx:[0,-250,-250,0][i]}))}); }
 // применить
 await p.locator('#viz-apply').click(); await p.waitForTimeout(2000);
 await p.locator('#viz-canvas').scrollIntoViewIfNeeded();
 // зоны исключения: цель «exclude», тянем прямоугольник поверх дивана
 await p.selectOption('#viz-target','exclude'); await p.waitForTimeout(200);
 await p.locator('#viz-canvas').scrollIntoViewIfNeeded(); await p.evaluate(()=>window.scrollBy(0,-90));
 { const bx=await box(); const k=bx.width/1920;
   await p.mouse.move(bx.x+520*k,bx.y+770*k); await p.mouse.down(); await p.mouse.move(bx.x+800*k,bx.y+900*k,{steps:6}); await p.mouse.move(bx.x+1110*k,bx.y+1010*k,{steps:6}); await p.mouse.up(); await p.waitForTimeout(500);
   await p.mouse.move(5,5);
   await L.shot(p,'g6_exclude',{el:'#viz-block',pad:8,top:90,marks:[{sel:'#viz-step',n:1,at:'tl'}]}); }
 await p.selectOption('#viz-target','wall');
 // поле за кадром
 await p.check('#viz-margin'); await p.waitForTimeout(500);
 await L.shot(p,'g7_margin',{el:'#viz-block',pad:8,top:90,marks:[{sel:'#viz-canvas',n:1,at:'tl',dx:8,dy:8}]});
 await p.uncheck('#viz-margin'); await p.waitForTimeout(300);
 // архив
 await p.click('#viz-guide-include-iso'); // без изометрии
 const [d]=await Promise.all([p.waitForEvent('download'),p.locator('#viz-guide-download-all').click()]); await d.saveAs('photo.zip');
 console.log(d.suggestedFilename(), p.errs);
 await b.close();
})();
