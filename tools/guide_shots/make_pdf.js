const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const p=await b.newPage({viewport:{width:1300,height:900}});
 await p.goto('file:///home/user/claude/docs/guide.html'); await p.waitForTimeout(800);
 await p.screenshot({path:'guide_top.png'});
 const bad=await p.evaluate(()=>[...document.images].filter(i=>!i.complete||!i.naturalWidth).length);
 console.log('битых картинок',bad);
 await p.emulateMedia({media:'print'});
 await p.pdf({path:'/home/user/claude/docs/guide.pdf',format:'A4',printBackground:true,margin:{top:'14mm',bottom:'14mm',left:'12mm',right:'12mm'},displayHeaderFooter:true,
  headerTemplate:'<span></span>',footerTemplate:'<div style="font-size:8px;width:100%;text-align:center;color:#777">Раскрой — руководство пользователя · стр. <span class="pageNumber"></span> из <span class="totalPages"></span></div>'});
 await b.close();
})();
