const L=require('./lib.js'); const fs=require('fs');
(async()=>{
 const {b,p}=await L.launch(1300);
 await L.setup(p); await require('./demo.js').second(p);
 await p.addStyleTag({content:'.rail{max-height:none!important;overflow:visible!important;position:static!important}'});
 // --- карта раскроя (повтор, без шапки)
 await L.shot(p,'23_cutmap',{el:'#shelf-zone',union:['#shelf-zone','#cutmap'],pad:8,top:110,marks:[
   {sel:'#shelf-zone',n:1,at:'tl'},{sel:'#cutmap svg',n:2,at:'tl',dy:50},{sel:'#cut-meta',n:3,at:'tl'}]});
 // --- синтетическое фото комнаты
 const dataUrl=await p.evaluate(()=>{ const c=document.createElement('canvas'); c.width=1920;c.height=1280; const x=c.getContext('2d');
   const poly=(pts,f)=>{x.fillStyle=f;x.beginPath();pts.forEach((q,i)=>i?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1]));x.closePath();x.fill();};
   poly([[0,0],[1920,0],[1920,1280],[0,1280]],'#d9d3c8');
   poly([[0,0],[1920,0],[1500,230],[420,210]],'#eeebe4');            // потолок
   poly([[0,0],[420,210],[430,1010],[0,1280]],'#b9b2a6');            // левая стена
   poly([[1920,0],[1500,230],[1500,1000],[1920,1280]],'#c6bfb3');   // правая
   poly([[420,210],[1500,230],[1500,1000],[430,1010]],'#e4ddd0');    // дальняя стена
   poly([[0,1280],[430,1010],[1500,1000],[1920,1280]],'#8a6a4a');    // пол
   x.fillStyle='rgba(255,255,255,.55)'; x.fillRect(1120,330,260,330); x.strokeStyle='#999'; x.lineWidth=6; x.strokeRect(1120,330,260,330); // окно
   x.fillStyle='#5b6470'; x.fillRect(560,830,520,170); x.fillRect(540,780,40,220); x.fillRect(1060,780,40,220);          // диван
   x.fillStyle='#3b3b3b'; x.fillRect(700,700,150,100);                                                                   // тв/картина
   const g=x.createLinearGradient(0,0,0,1280); g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,.18)'); x.fillStyle=g; x.fillRect(0,0,1920,1280);
   return c.toDataURL('image/jpeg',.9); });
 fs.writeFileSync('room.jpg',Buffer.from(dataUrl.split(',')[1],'base64'));
 await p.locator('#rail .sect:nth-of-type(7) .sect-h').click(); await p.waitForTimeout(300);
 await p.locator('#viz-photo').setInputFiles('room.jpg');
 await p.waitForFunction(()=>document.querySelector('#viz-canvas').width>100); await p.waitForTimeout(1200);
 await p.fill('#viz-notes','Стены вокруг будут покрашены в белый, пол — тёмный ламинат'); await p.locator('#viz-notes').blur();
 await L.shot(p,'31_viz_rail',{el:'#rail .sect:nth-of-type(7)',pad:6,top:90,marks:[
   {sel:'#viz-wall',n:1,at:'tl'},{sel:'#viz-photo',n:2,at:'tl'},{sel:'#viz-photos',n:3,at:'tl'},{sel:'#viz-notes',n:4,at:'tl'},
   {sel:'#viz-target',n:5,at:'tl'},{sel:'#viz-loupe',n:6,at:'tl',dx:-4},{sel:'#viz-margin',n:7,at:'tl',dx:-4}]});
 // разметка 4 углов дальней стены
 await p.locator('#viz-canvas').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
 const box=await p.locator('#viz-canvas').boundingBox(); const k=box.width/1920;
 const pts=[[420,210],[1500,230],[1500,1000],[430,1010]];
 for(const [x,y] of pts){ await p.mouse.click(box.x+x*k,box.y+y*k); await p.waitForTimeout(80); }
 await p.mouse.move(5,5); await p.waitForTimeout(400);
 await L.shot(p,'32_viz_marking',{el:'#viz-block',pad:8,top:90,marks:[{sel:'#viz-step',n:1,at:'tl'},{sel:'#viz-canvas',n:2,at:'tl',dx:8,dy:8}]});
 await p.locator('#viz-apply').scrollIntoViewIfNeeded(); await p.locator('#viz-apply').click(); await p.waitForTimeout(2500);
 await p.locator('#viz-canvas').scrollIntoViewIfNeeded();
 await L.shot(p,'33_viz_result',{el:'#viz-block',pad:8,top:90,marks:[{sel:'#viz-canvas',n:1,at:'tl',dx:8,dy:8}]});
 await L.shot(p,'34_viz_ai',{el:'#viz-apply',clip:await (async()=>{ await p.evaluate(()=>{const e=document.querySelector('#viz-apply').getBoundingClientRect(); window.scrollTo(0,window.scrollY+e.top-110);}); return p.evaluate(()=>{const A=document.querySelector('#viz-apply').getBoundingClientRect(),Z=document.querySelector('#viz-guide-download-all').getBoundingClientRect(); return {x:0,y:A.top-20,width:410,height:Z.bottom-A.top+40};}); })(),pad:8,top:90,marks:[
   {sel:'#viz-apply',n:1,at:'tl'},{sel:'#viz-download',n:2,at:'tl'},{sel:'#viz-reset-all',n:3,at:'tr'},
   {sel:'#viz-guide-opacity',n:4,at:'tl'},{sel:'#viz-guide-download',n:5,at:'tl'},{sel:'#viz-json-copy',n:6,at:'tr'},
   {sel:'#viz-guide-include-iso',n:7,at:'tl',dx:-4},{sel:'#viz-guide-download-all',n:8,at:'tl'}]});
 console.log(p.errs);
 await b.close();
})();
