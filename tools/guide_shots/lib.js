const {chromium}=require('playwright'); const setup=require('./demo.js');
exports.launch=async function(h=1500){
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await b.newPage({viewport:{width:1500,height:h},deviceScaleFactor:1.5});
  p.errs=[]; p.on('pageerror',e=>p.errs.push(String(e).slice(0,200)));
  await p.goto('file:///home/user/claude/raskroy.html'); await p.waitForTimeout(800);
  return {b,p};
};
exports.setup=setup;
// выноски: marks=[{sel|rect, n, box=true, at:'tl'|'tr'|'bl'|'br'|'l'|'r', nth}]
async function marks(p,list){
  await p.evaluate(list=>{
    document.querySelectorAll('.__mk').forEach(e=>e.remove());
    for(const m of list){
      let r;
      if(m.sels){ let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; for(const q of m.sels){ const e=document.querySelector(q); if(!e) continue; const b=e.getBoundingClientRect(); x0=Math.min(x0,b.x);y0=Math.min(y0,b.y);x1=Math.max(x1,b.right);y1=Math.max(y1,b.bottom);} r={x:x0,y:y0,w:x1-x0,h:y1-y0}; }
      else if(m.rect) r=m.rect; else {
        const els=document.querySelectorAll(m.sel); const el=els[m.nth||0]; if(!el){ console.warn('нет '+m.sel); continue; }
        const b=el.getBoundingClientRect(); r={x:b.x,y:b.y,w:b.width,h:b.height};
      }
      const pad=m.pad==null?3:m.pad;
      if(m.box!==false){
        const d=document.createElement('div'); d.className='__mk';
        d.style.cssText=`position:fixed;z-index:99998;pointer-events:none;border:2px solid #ff3b6b;border-radius:5px;box-shadow:0 0 0 1px rgba(0,0,0,.5);left:${r.x-pad}px;top:${r.y-pad}px;width:${r.w+pad*2}px;height:${r.h+pad*2}px`;
        document.body.appendChild(d);
      }
      const at=m.at||'tl', S=22; let x,y;
      if(at==='tl'){x=r.x-pad-S*0.6;y=r.y-pad-S*0.6}
      else if(at==='tr'){x=r.x+r.w+pad-S*0.4;y=r.y-pad-S*0.6}
      else if(at==='bl'){x=r.x-pad-S*0.6;y=r.y+r.h+pad-S*0.4}
      else if(at==='br'){x=r.x+r.w+pad-S*0.4;y=r.y+r.h+pad-S*0.4}
      else if(at==='l'){x=r.x-pad-S-4;y=r.y+r.h/2-S/2}
      else if(at==='r'){x=r.x+r.w+pad+4;y=r.y+r.h/2-S/2}
      else if(at==='c'){x=r.x+r.w/2-S/2;y=r.y+r.h/2-S/2}
      x+= (m.dx||0); y+=(m.dy||0);
      const c=document.createElement('div'); c.className='__mk';
      c.textContent=m.n;
      c.style.cssText=`position:fixed;z-index:99999;pointer-events:none;width:${S}px;height:${S}px;border-radius:50%;background:#ff3b6b;color:#fff;font:700 13px/${S}px Arial,sans-serif;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.6);border:1.5px solid #fff;left:${x}px;top:${y}px`;
      document.body.appendChild(c);
    }
  },list);
}
exports.marks=marks;
// снимок области: sel — элемент (или rect), прокручиваем к нему, рисуем выноски, режем по рамке
exports.shot=async function(p,name,o){
  const sel=o.el;
  if(o.scroll!==false && sel && !o.clip){
    await p.evaluate(({sel,top})=>{ const el=document.querySelector(sel); if(!el) return;
      const r=el.getBoundingClientRect(); window.scrollTo(0,window.scrollY+r.top-(top==null?90:top)); },{sel,top:o.top});
    await p.waitForTimeout(150);
  }
  if(o.marks) await marks(p,o.marks);
  let clip;
  if(o.union){ clip=await p.evaluate(({u,pad})=>{ let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; for(const q of u){ const e=document.querySelector(q); if(!e) continue; const b=e.getBoundingClientRect(); x0=Math.min(x0,b.x);y0=Math.min(y0,b.y);x1=Math.max(x1,b.right);y1=Math.max(y1,b.bottom);} x0=Math.max(0,x0-pad);y0=Math.max(0,y0-pad); return {x:x0,y:y0,width:Math.min(innerWidth-x0,x1-x0+pad*2),height:Math.min(innerHeight-y0,y1-y0+pad*2)}; },{u:o.union,pad:o.pad==null?10:o.pad}); }
  else if(o.clip) clip=o.clip; else {
    clip=await p.evaluate(({sel,pad,w,h})=>{ const b=document.querySelector(sel).getBoundingClientRect();
      const x=Math.max(0,b.x-pad), y=Math.max(0,b.y-pad);
      return {x,y,width:Math.min(innerWidth-x,(w||b.width+pad*2)),height:Math.min(innerHeight-y,(h||b.height+pad*2))}; },{sel,pad:o.pad==null?10:o.pad,w:o.w,h:o.h});
  }
  await p.screenshot({path:'img/'+name+'.png',clip});
  await p.evaluate(()=>document.querySelectorAll('.__mk').forEach(e=>e.remove()));
  console.log('ok',name,Math.round(clip.width)+'x'+Math.round(clip.height));
};
