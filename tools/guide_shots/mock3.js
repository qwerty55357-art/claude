const L=require('./lib.js');
(async()=>{
 const {b,p}=await L.launch(1400);
 await L.setup(p); await require('./demo.js').second(p);
 await p.addStyleTag({content:'.rail{max-height:none!important;overflow:visible!important;position:static!important}'});
 await p.locator('#rail .sect:nth-of-type(7) .sect-h').click(); await p.waitForTimeout(200);
 await p.click('#viz-mock-toggle'); await p.waitForTimeout(200);
 await p.fill('#viz-notes','Современная гостиная, светлый паркет, серый диван у стены, тёплый вечерний свет');
 await p.locator('#viz-notes').blur();
 await L.shot(p,'38_mock_panel',{el:'#viz-photo',clip:await (async()=>{ await p.evaluate(()=>{const e=document.querySelector('#viz-photo').getBoundingClientRect(); window.scrollTo(0,window.scrollY+e.top-120);}); return p.evaluate(()=>{const A=document.querySelector('#viz-photo').getBoundingClientRect(),Z=document.querySelector('#viz-mock-make').getBoundingClientRect(); return {x:0,y:A.top-30,width:410,height:Z.bottom-A.top+44};}); })(),marks:[
   {sel:'#viz-photo',n:1,at:'tl'},{sel:'#viz-mock-toggle',n:2,at:'tl'},{sel:'#viz-mock-angle',n:3,at:'tl'},{sel:'#viz-mock-dist',n:4,at:'tl'},{sel:'#viz-mock-make',n:5,at:'tl'}]});
 for(const a of ['front','left','right']){
   await p.selectOption('#viz-mock-angle',a); await p.click('#viz-mock-make'); await p.waitForTimeout(1500);
   await p.locator('#viz-canvas').scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
   await p.locator('#viz-canvas').screenshot({path:'img/39_mock_'+a+'.png'});
 }
 await p.selectOption('#viz-mock-angle','left'); await p.click('#viz-mock-make'); await p.waitForTimeout(1500);
 await p.fill('#viz-notes','Современная гостиная, светлый паркет, серый диван у стены, тёплый вечерний свет'); await p.locator('#viz-notes').blur();
 await L.shot(p,'40_mock_step',{el:'#viz-block',pad:8,top:90,marks:[{sel:'#viz-step',n:1,at:'tl'},{sel:'#viz-canvas',n:2,at:'tl',dx:8,dy:8}]});
 const [d]=await Promise.all([p.waitForEvent('download'),p.locator('#viz-guide-download-all').click()]); await d.saveAs('mock.zip');
 console.log(p.errs); await b.close();
})();
