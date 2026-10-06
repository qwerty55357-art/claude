// PDF из docs/guide.html и docs/generation.html: NODE_PATH=$(npm root -g) node tools/guide_shots/make_pdf.js
const {chromium}=require('playwright'); const path=require('path');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium'});
 for(const [name,title] of [['guide','Раскрой — руководство пользователя'],['generation','Раскрой — инструкция по генерации визуализаций']]){
  const p=await b.newPage({viewport:{width:1300,height:900}});
  await p.goto('file://'+path.resolve(__dirname,'../../docs/'+name+'.html')); await p.waitForTimeout(800);
  const bad=await p.evaluate(()=>[...document.images].filter(i=>!i.complete||!i.naturalWidth).length);
  await p.emulateMedia({media:'print'});
  await p.pdf({path:path.resolve(__dirname,'../../docs/'+name+'.pdf'),format:'A4',printBackground:true,margin:{top:'14mm',bottom:'14mm',left:'12mm',right:'12mm'},displayHeaderFooter:true,
   headerTemplate:'<span></span>',footerTemplate:'<div style="font-size:8px;width:100%;text-align:center;color:#777">'+title+' · стр. <span class="pageNumber"></span> из <span class="totalPages"></span></div>'});
  console.log(name,'битых картинок',bad); await p.close();
 }
 await b.close();
})();
