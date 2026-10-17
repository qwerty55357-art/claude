// PNG → JPEG (качество 0.86, ширина до 1700 px) средствами Chromium. Запуск из tools/guide_shots:
//   node png2jpg.js img/53_plan_draw.png img/54_plan_U.png ...   → пишет ../../docs/guide/img/<имя>.jpg
const {chromium}=require('playwright'); const fs=require('fs'); const path=require('path');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}); const p=await b.newPage();
  for(const f of process.argv.slice(2)){
    const b64=fs.readFileSync(f).toString('base64');
    const out=await p.evaluate(async d=>{
      const im=new Image(); await new Promise((r,j)=>{ im.onload=r; im.onerror=j; im.src='data:image/png;base64,'+d; });
      const k=Math.min(1,1700/im.width), c=document.createElement('canvas'); c.width=Math.round(im.width*k); c.height=Math.round(im.height*k);
      const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,c.width,c.height); x.drawImage(im,0,0,c.width,c.height);
      return c.toDataURL('image/jpeg',0.86).split(',')[1];
    },b64);
    const dst=path.join(__dirname,'../../docs/guide/img',path.basename(f,'.png')+'.jpg');
    fs.writeFileSync(dst,Buffer.from(out,'base64')); console.log('ok',dst,Math.round(fs.statSync(dst).size/1024)+' КБ');
  }
  await b.close();
})();
