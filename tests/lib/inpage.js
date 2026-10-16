// Функции, исполняемые ВНУТРИ страницы raskroy.html (подставляются через page.evaluate): поиск NaN/undefined в выводе,
// проверка чисел расчёта, сборка насыщенного и случайного проектов. Используется tests/ui_matrix.js и tests/consistency.js.
module.exports=String.raw`
window.__scan=function(){
  const out=[]; const re=/NaN|undefined|Infinity|\[object /;
  const zones=['#notes','#cards','#scheme','#scheme-meta','#cutmap','#shelf-zone','#cuts','#spec','#estimate','#jointsv-list','#led-summary','#led-circuits-list','#led-draw','#scene3d-meta','#corner-scheme-block','#cutmap-layout','#openings'];
  zones.forEach(z=>{
    document.querySelectorAll(z).forEach(el=>{
      let h=el.innerHTML; if(h.indexOf('NaN')<0&&h.indexOf('undefined')<0&&h.indexOf('Infinity')<0&&h.indexOf('[object')<0) return;   // быстрый выход: большой SVG не гоняем через regex
      h=h.replace(/data:[^"')\s]+/g,'data:…'); const m=h.match(re);
      if(m){ const i=m.index; out.push(z+' …'+h.slice(Math.max(0,i-60),i+40).replace(/\s+/g,' ')+'…'); }
    });
  });
  document.querySelectorAll('#rail input,#rail select').forEach(el=>{ if(re.test(el.value||'')) out.push('поле '+(el.id||el.name)+'="'+el.value+'"'); });
  return out;
};
window.__badNums=function(){
  const R=LAST&&LAST.R; if(!R) return ['нет LAST.R']; const out=[]; const seen=new Set();
  (function walk(o,p,d){
    if(d>6||o==null) return;
    if(typeof o==='number'){ if(!Number.isFinite(o)) out.push(p+'='+o); return; }
    if(typeof o!=='object'||seen.has(o)) return; seen.add(o);
    if(Array.isArray(o)){ o.slice(0,400).forEach((v,i)=>walk(v,p+'['+i+']',d+1)); return; }
    Object.keys(o).forEach(k=>{ if(k==='img'||k==='tex'||k==='canvas') return; walk(o[k],p+'.'+k,d+1); });
  })(R,'R',0);
  return out.slice(0,10);
};
window.__rich=function(){
  const op=(id,kind,w,h,x,y,extra)=>Object.assign({id,kind,w,h,x,y,otkos:true,depth:150,otkosOverlap:0,fillMat:null,mount:null,mountCut:true,
    anchorH:'left',otkosMode:{left:'corner',right:'corner',top:'corner',bottom:'corner'}},extra||{});
  const w1=Object.assign(newWall(),{slot:'W',name:'Стена 1',autoName:false,W:4200,H:2600,ceil:2700,
    edges:{top:'led',bot:'cap',left:'cap',right:'cap'},cout:1,cin:1,
    ops:[op(1,'window',1200,1400,600,800,{otkosOverlap:50,otkosMode:{left:'corner',right:'bend',top:'led',bottom:'butt'}}),
         op(2,'door',900,2100,2400,0,{depth:100,otkosMode:{left:'protrude',right:'protrude',top:'protrude',bottom:'none'}}),
         op(3,'niche',600,900,3500,900,{fillMat:'marble',otkosMode:{left:'cap',right:'cap',top:'cap',bottom:'cap'}})],
    opSeq:3,seamsU:[{id:1,pos:1300}],seamSeq:1,vseamsU:[{id:1,pos:2000}],vseamSeq:1});
  const w2=Object.assign(newWall(),{slot:'N',name:'Стена 2',autoName:false,W:3000,H:2600,ceil:2700,
    edges:{top:'cap',bot:'none',left:'cap',right:'led'},cout:0,cin:2,vfree:true,hfree:true,
    ops:[op(1,'window',900,1200,500,900,{fillMat:'slat',otkosMode:{left:'corner',right:'corner',top:'none',bottom:'corner'}}),
         op(2,'window',700,1200,1800,900,{fillMat:'rockL',otkos:false})],
    opSeq:2,seamsU:[{id:1,pos:900},{id:2,pos:1700,scope:'even'}],seamSeq:2,
    vseamsU:[{id:1,pos:1200},{id:2,pos:2200}],vseamSeq:2});
  const w3=Object.assign(newWall(),{slot:'E',name:'Стена 3',autoName:false,W:2000,H:2600,ceil:2700,ops:[],edges:{top:'cap',bot:'none',left:'cap',right:'cap'}});
  const o=snapshot();
  o.walls=[w1,w2,w3]; o.active=0;
  o.cornerLinks=[
    {id:1,kind:'sharp',type:'out',angle:90,aw:w1.id,as:'right',bw:w2.id,bs:'left'},
    {id:2,kind:'radius',type:'out',angle:90,radius:200,aw:w2.id,as:'right',bw:w3.id,bs:'left',flatA:0,flatB:0}];
  o.cornerType='out';
  o.ledCircuits=[{id:1,kind:'start',legs:[{wall:w1.id,el:'free',id:1,ax:0,ay:2500,bx:4200,by:2500}]}];
  o.manual={};
  applySnapshot(JSON.parse(JSON.stringify(o)),false);
  return walls.length;
};

// случайный, но воспроизводимый проект (seed): 1–3 стены по кругу W→N→E, проёмы всех видов и режимов откосов,
// заполнения (в т.ч. расцветки каталога), стыки, свободная расстановка, углы прямые/радиусные, LED-отрезок
window.__rnd=function(seed){
  let x=(seed*7919+13)&0x7fffffff; const r=()=>{ x=(x*1103515245+12345)&0x7fffffff; return x/0x7fffffff; };
  const pick=a=>a[Math.floor(r()*a.length)];
  const r10=(a,b)=>Math.round((a+r()*(b-a))/10)*10;
  const fillIds=['marble','slat','rockL','rockS','slat:5139','marble:044'].filter(id=>id.indexOf(':')<0||CAT_BY_ID.has(id));
  const n=1+Math.floor(r()*4), slots=n===1?['N']:['W','N','E','S'].slice(0,n);
  const H=r10(1800,3200), list=[];
  for(let k=0;k<n;k++){
    const W=r10(900,7000);
    const w=Object.assign(newWall(),{slot:slots[k],name:'Стена '+(k+1),autoName:false,W,H,ceil:Math.max(H,2700),rowH:r()<0.25?r10(500,H):0,
      edges:{top:pick(['cap','led','none']),bot:r()<0.3?'cap':'none',left:r()<0.8?'cap':'none',right:pick(['cap','led','none'])},
      cout:Math.floor(r()*3),cin:Math.floor(r()*3),ops:[],opSeq:0,seamsU:[],seamSeq:0,vseamsU:[],vseamSeq:0});
    const ns=Math.floor(r()*3); for(let i=0;i<ns;i++) w.seamsU.push({id:++w.seamSeq,pos:r10(200,H-200)});
    const nv=Math.floor(r()*3); for(let i=0;i<nv;i++) w.vseamsU.push({id:++w.vseamSeq,pos:r10(200,W-200)});
    if(r()<0.3) w.vfree=true; if(r()<0.3) w.hfree=true;
    const no=Math.floor(r()*4);
    for(let i=0;i<no;i++){
      const full=r()<0.2, ow=r10(300,Math.min(W*0.4,3000)), oh=full?H:r10(300,Math.min(H*0.7,2400));
      const ox=r10(0,Math.max(0,W-ow)), oy=full?0:r10(0,Math.max(0,H-oh));
      if(ow<100||oh<100||ox+ow>W||oy+oh>H) continue;
      if(w.ops.some(q=>ox<q.x+q.w&&ox+ow>q.x&&oy<q.y+q.h&&oy+oh>q.y)) continue;
      const md=()=>pick(['corner','butt','bend','none','cap','led','protrude']);
      w.ops.push({id:++w.opSeq,kind:pick(['window','door','niche']),w:ow,h:oh,x:ox,y:oy,otkos:r()<0.6,depth:pick([100,150,200]),
        otkosOverlap:r()<0.4?pick([50,100,150]):0,fillMat:r()<0.3?pick(fillIds):null,mount:r()<0.1?'surface':null,mountCut:r()<0.5,anchorH:'left',
        otkosMode:{left:md(),right:md(),top:md(),bottom:md()}});
    }
    list.push(w);
  }
  const o=snapshot();
  o.walls=list; o.active=0; o.manual={}; o.cornerType=pick(['out','in']);
  // настройки раскроя тоже случайные (раскладка, остатки, стыковка, поворот деталей, пропил…)
  Object.assign(o.fields,{'i-orient':pick(['v','h']),'i-sym':r()<0.5,'i-brick':r()<0.4,'i-offcut':r()<0.8,'i-splice':r()<0.4,'i-rot':r()<0.4,
    'i-kerf':pick([0,3,5,10]),'i-minoff':pick([100,300,500]),'i-joint-v':r()<0.85,'i-joint-h':r()<0.85,'i-edgeops':r()<0.8});
  o.cornerLinks=[];
  for(let k=0;k<n-1;k++) o.cornerLinks.push({id:k+1,kind:pick(['sharp','radius','radius','across']),type:o.cornerType,angle:r()<0.7?90:pick([60,75,105,120]),
    radius:pick([0,100,200,300,450]),distance:r()<0.2?pick([100,300]):0,flatA:r()<0.2?100:0,flatB:r()<0.2?100:0,
    aw:list[k].id,as:'right',bw:list[k+1].id,bs:'left',mat:r()<0.3?pick(fillIds):null});   // у радиусных углов — иногда свой материал детали
  if(n===4) o.cornerLinks.push({id:4,kind:pick(['sharp','radius']),type:o.cornerType,angle:90,radius:pick([100,200,300]),distance:0,flatA:0,flatB:0,
    aw:list[3].id,as:'right',bw:list[0].id,bs:'left'});   // замыкаем комнату: Юг → Запад
  o.ledCircuits=r()<0.5?[{id:1,kind:pick(['start','joint']),legs:[{wall:list[0].id,el:'free',id:1,ax:0,ay:Math.round(H*0.9),bx:list[0].W,by:Math.round(H*0.9)}]}]:[];
  list.forEach(w=>w.ops.forEach(op=>{ if(op.otkos&&r()<0.25){ op.otkosMat={}; ['left','right','top','bottom'].forEach(sd=>{ if(r()<0.5) op.otkosMat[sd]=pick(fillIds); }); } }));
  applySnapshot(JSON.parse(JSON.stringify(o)),false);
  // материал отдельных деталей стен (ключ — устойчивый pk детали)
  if(r()<0.5){ walls.forEach(w=>{ const L=LAST.R.layouts[walls.indexOf(w)]; if(!L||!L.pieces.length) return;
    for(let i=0;i<2;i++){ const pc=L.pieces[Math.floor(r()*L.pieces.length)]; if(pc&&pc.pk) w.pieceMats[pc.pk]=pick(fillIds); } }); run(); }
  return n;
};

// согласованность разделов: цифры в карточках, смете, спецификации, карте раскроя, таблице вырезов и на схеме — из одной модели
window.__consistency=function(){
  const out=[]; const R=LAST.R, G=LAST.G; const bad=(id,m)=>out.push(id+': '+m);
  const num=s=>{ const m=String(s).replace(/[\s  ]/g,'').replace(',','.').match(/-?\d+(\.\d+)?/); return m?parseFloat(m[0]):NaN; };
  const near=(a,b,t)=>Math.abs(a-b)<=(t==null?0.011:t);
  const fillSheets=R.fills.reduce((a,f)=>a+f.sheets.length,0);
  // C0: главная сумма листов
  if(R.sheetsTotal!==R.sheets.length) bad('C0a','sheetsTotal '+R.sheetsTotal+' != sheets.length '+R.sheets.length);
  if(R.sheetsTotal!==R.mainSheets+R.extraSheets) bad('C0b','sheetsTotal '+R.sheetsTotal+' != mainSheets+extraSheets '+(R.mainSheets+R.extraSheets));
  // C1: карточки
  const card=k=>[...document.querySelectorAll('#cards .card')].find(e=>e.querySelector('.card-k').textContent.trim().toLowerCase()===k);
  const cv=k=>{ const c=card(k); return c?num(c.querySelector('.card-v').innerText):NaN; };
  if(cv('панелей купить')!==R.sheetsTotal+fillSheets) bad('C1a','«Панелей купить» '+cv('панелей купить')+' != '+(R.sheetsTotal+fillSheets));
  if(!near(cv('площадь отделки'),R.netArea+R.otkosArea)) bad('C1b','«Площадь отделки» '+cv('площадь отделки')+' != '+(R.netArea+R.otkosArea).toFixed(2));
  const sticks=R.prof.reduce((a,p)=>a+p.sticks,0), plen=R.prof.reduce((a,p)=>a+p.total,0)/1000;
  if(cv('профиль')!==sticks) bad('C1c','«Профиль» '+cv('профиль')+' хл != '+sticks);
  if(!near(num(card('профиль').querySelector('.card-sub').innerText),plen,0.06)) bad('C1d','«Профиль» пог. м '+card('профиль').querySelector('.card-sub').innerText+' != '+plen.toFixed(1));
  if(cv('клей')!==R.tubes) bad('C1e','«Клей» '+cv('клей')+' != '+R.tubes);
  if(R.led){ if(!near(cv('led'),R.led.len,0.06)) bad('C1f','«LED» '+cv('led')+' != '+R.led.len.toFixed(1)); } else if(card('led')) bad('C1g','карточка LED есть, а R.led нет');
  // C2: смета
  const estRows=[...document.querySelectorAll('#estimate tbody tr')].map(tr=>[...tr.children].map(c=>c.innerText.trim()));
  let sum=0, tot=null; const est=[];
  estRows.forEach(r=>{ if(/^Итого/.test(r[0])){ tot=num(r[3]); return; } const q=num(r[1]), pr=num(r[2]), sm=num(r[3]);
    if(r[2]!==''&&!near(q*pr,sm,1.01)) bad('C2a','«'+r[0]+'»: '+q+'×'+pr+' != '+sm); sum+=sm; est.push({n:r[0],q,pr,sm,u:r[1].replace(/^[\d\s  ,.]+/,'')}); });
  if(tot==null) bad('C2b','нет строки «Итого»'); else if(!near(sum,tot,1.01)) bad('C2c','сумма строк '+sum+' != Итого '+tot);
  const pan=est.filter(e=>/^Панель /.test(e.n));
  const wantPan=(R.sheetsTotal>0?1:0)+R.fills.filter(f=>f.sheets.length>0).length;
  if(pan.length!==wantPan) bad('C2d','строк «Панель» '+pan.length+' != '+wantPan);
  if(R.sheetsTotal>0&&pan[0]&&pan[0].q!==R.sheetsTotal) bad('C2e','панелей в смете '+pan[0].q+' != '+R.sheetsTotal);
  R.fills.filter(f=>f.sheets.length>0).forEach((f,i)=>{ const row=pan.find(e=>e.n.indexOf(f.matName)>=0&&/заполнение|деталь|откос|материал/.test(e.n)&&e.q===f.sheets.length); if(!row) bad('C2f','нет строки сметы для заполнения '+f.matName+' ×'+f.sheets.length); });
  // C3: спецификация ↔ смета ↔ профиль
  const spec=[...document.querySelectorAll('#spec tr')].map(tr=>[...tr.children].map(c=>c.innerText.trim())).filter(r=>r.length>=2);
  const specBy={}; spec.forEach(r=>{ (specBy[r[0]]=specBy[r[0]]||[]).push(r); });
  est.forEach(e=>{
    if(/^(Итого|Наценка)/.test(e.n)||/^Блок питания/.test(e.n)||/^LED-лента/.test(e.n)) return;
    const base=e.n.replace(/ \((заполнение|деталь стены|откос|[^)]*)\)$/,'');
    const rows=specBy[e.n]||specBy[base]; if(!rows){ bad('C3a','в спецификации нет строки «'+e.n+'»'); return; }
    if(rows.length===1&&num(rows[0][1])!==e.q) bad('C3b','«'+e.n+'»: в спецификации '+rows[0][1]+', в смете '+e.q);
  });
  R.prof.forEach(p=>{ const rows=specBy[p.name]; if(!rows||rows.length!==1) return;
    if(num(rows[0][1])!==p.sticks) bad('C3c','«'+p.name+'»: хлыстов в спец. '+rows[0][1]+' != '+p.sticks);
    const m=rows[0][2].match(/([\d\s  ]+,?\d*)\s*пог\. м/); if(m&&!near(num(m[1]),p.total/1000,0.011)) bad('C3d','«'+p.name+'»: пог. м '+m[1]+' != '+(p.total/1000).toFixed(2));
    const cuts=rows[0][2].match(/отрезки ([\d\s  ,]+)/);
    if(cuts&&p.runs&&p.runs.length<=40){ const arr=cuts[1].split(',').map(x=>num(x.replace(/\s+/g,''))).filter(x=>!isNaN(x)); }
  });
  if(R.led){ const row=(specBy['LED-лента']||[])[0]; if(row&&!near(num(row[1]),R.led.len,0.06)) bad('C3e','LED-лента в спец. '+row[1]+' != '+R.led.len.toFixed(1)); }
  // C4: карта раскроя — число листов в каждом пуле
  const svgs=[...document.querySelectorAll('#cutmap svg[data-pool]')];
  const poolN=svgs.reduce((a,s)=>a+(+s.dataset.n||0),0);
  if(poolN!==R.sheets.length+fillSheets) bad('C4a','листов на карте '+poolN+' != '+(R.sheets.length+fillSheets));
  const mainSvg=svgs.find(s=>s.dataset.pool==='main');
  if(R.sheets.length&&(!mainSvg||+mainSvg.dataset.n!==R.sheets.length)) bad('C4b','главная карта: '+(mainSvg&&mainSvg.dataset.n)+' листов != '+R.sheets.length);
  svgs.forEach(sv=>{ const lbl=[...sv.querySelectorAll('text')].filter(t=>/^ЛИСТ \d+( ·.*)?$/.test(t.textContent.trim())&&t.getAttribute('fill')!=='none').length;
    if(lbl!==+sv.dataset.n) bad('C4c','карта '+sv.dataset.pool+': подписей «ЛИСТ» '+lbl+' != '+sv.dataset.n); });
  // C5: детали и площади не теряются между расчётом стен и листами
  const pcs=R.layouts.flatMap(L=>L.pieces).filter(p=>!p.matOverride), onSheets=R.sheets.flatMap(s=>s.list).filter(p=>!p.isCorner);   // деталь радиусного угла лежит на листе, но не принадлежит стене
  const shelfMain=(R.shelf||[]).filter(e=>e.kind==='w'&&!e.isCorner).length;
  if(pcs.length!==onSheets.length+shelfMain) bad('C5a','деталей по стенам '+pcs.length+' != на листах '+onSheets.length+' + верстак '+shelfMain);
  const ar=a=>a.reduce((s,p)=>s+p.w*p.len,0)/1e6;
  if(!shelfMain&&!near(ar(pcs),ar(onSheets),0.001)) bad('C5b','площадь деталей по стенам '+ar(pcs).toFixed(3)+' != на листах '+ar(onSheets).toFixed(3));
  onSheets.forEach(p=>{ if(!(p.sheetW==null)){} });
  R.sheets.forEach((sh,i)=>sh.list.forEach(p=>{
    const dw=p.w, dl=p.len;   // как rectOf в движке: после поворота w/len уже поменяны местами
    if(p.x<-0.01||p.y<-0.01||p.x+dw>G.pw+0.01||p.y+dl>G.pl+0.01) bad('C5c','лист '+(i+1)+': деталь '+p.label+' ('+p.x+','+p.y+' '+dw+'×'+dl+') вне листа '+G.pw+'×'+G.pl);
  }));
  R.fills.filter(f=>f.kind==='opening').forEach(f=>{ const fp=f.layouts.flatMap(x=>x.L.pieces), fo=f.sheets.flatMap(s=>s.list);
    if(fp.length!==fo.length+(f.shelf||[]).length) bad('C5d','заполнение '+f.matName+': деталей '+fp.length+' != на листах '+fo.length+' + верстак '+(f.shelf||[]).length); });
  // C6: таблица вырезов
  const cutRows=document.querySelectorAll('#cuts tbody tr, #cuts tr').length-(document.querySelector('#cuts thead')||document.querySelector('#cuts tr th')?1:0);
  const nCuts=R.layouts.reduce((a,L)=>a+L.pieces.reduce((b,p)=>b+(p.cuts||[]).length,0),0);
  if(nCuts>0&&cutRows<1) bad('C6a','таблица вырезов пуста при '+nCuts+' вырезах');
  // C7: схема — подпись каждой детали есть
  const labels=new Set([...document.querySelectorAll('#scheme text')].map(t=>t.textContent.trim()));
  let miss=0, missEx=''; R.layouts.forEach((L,wi)=>L.pieces.forEach(p=>{ const short=String(p.label).replace(/^С\d+·/,''), strip=short.replace(/\.\d+$/,''); if(!labels.has(p.label)&&!labels.has(short)&&!labels.has(strip)){ miss++; if(!missEx) missEx=p.label+' (стена '+(wi+1)+', '+Math.round(p.w)+'×'+Math.round(p.len)+')'; } }));
  if(miss) bad('C7a','на схеме нет подписи у '+miss+' деталей, напр. '+missEx);
  // C8: замечания не противоречат расчёту
  const notes=document.querySelector('#notes').textContent;
  if((R.failed.length>0)!==/Откосы не размещены/i.test(notes)) bad('C8a','failed='+R.failed.length+', а замечание «Откосы не размещены» '+(/Откосы не размещены/i.test(notes)?'есть':'нет'));
  if(((R.cornerIssues||[]).length>0)&&!/угол/i.test(notes)) bad('C8b','есть cornerIssues, а в замечаниях про угол ничего нет');
  return out;
};

// геометрия листов: детали и откосы не перекрываются и не выходят за лист (в т.ч. после ручных перестановок)
window.__overlaps=function(){
  const out=[]; const G=LAST.G, R=LAST.R, K=G.kerf;
  const chkPool=(name,sheets,pl,pw)=>sheets.forEach((sh,si)=>{
    const rs=[...sh.list.map(o=>({n:o.label,x:o.x,y:o.y,w:o.w,h:o.len})),...sh.otk.map(o=>({n:o.name,x:o.x,y:o.y,w:o.dw||o.dep,h:o.dh||o.len}))];
    rs.forEach(r=>{ if(r.x<-0.5||r.y<-0.5||r.x+r.w>pw+0.5||r.y+r.h>pl+0.5) out.push(name+' лист '+(si+1)+': «'+r.n+'» вне листа ('+Math.round(r.x)+','+Math.round(r.y)+' '+Math.round(r.w)+'×'+Math.round(r.h)+' на '+pw+'×'+pl+')'); });
    for(let i=0;i<rs.length;i++) for(let j=i+1;j<rs.length;j++){ const a=rs[i], b=rs[j];
      const gx=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x), gy=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);
      // деталь с вырезом легально содержит «детей»-откосы в своём вырезе — их пропускаем
      const hole=(p,q)=>{ const o=(sh.list.find(x=>x.label===p.n)); return o&&o.cuts&&o.cuts.some(c=>{ const hx=o.x+c.ax, hy=o.y+(o.len-(c.by+c.bh)); return q.x>=hx-3&&q.y>=hy-3&&q.x+q.w<=hx+c.aw+3&&q.y+q.h<=hy+c.bh+3; }); };
      if(gx>0.5&&gy>0.5&&!hole(a,b)&&!hole(b,a)) out.push(name+' лист '+(si+1)+': «'+a.n+'» и «'+b.n+'» перекрываются ('+Math.round(gx)+'×'+Math.round(gy)+')'); }
  });
  chkPool('main',R.sheets,G.pl,G.pw);
  R.fills.forEach(f=>chkPool(f.matName,f.sheets,f.pl,f.pw));
  return out.slice(0,10);
};

// случайные ручные правки на карте раскроя (перенос на другой лист/место, поворот, верстак) — движок обязан либо принять
// правку, либо молча отклонить, но результат всегда валиден: детали не теряются, не перекрываются, лежат в пределах листа
window.__rndManual=function(seed,count){
  let x=(seed*104729+7)&0x7fffffff; const r=()=>{ x=(x*1103515245+12345)&0x7fffffff; return x/0x7fffffff; };
  const pools=[{pool:'main',sheets:LAST.R.sheets,pl:LAST.G.pl,pw:LAST.G.pw},...LAST.R.fills.map(f=>({pool:f.matId,sheets:f.sheets,pl:f.pl,pw:f.pw}))].filter(q=>q.sheets.length);
  if(!pools.length) return 0;
  const mm={shelf:[]}; let n=0;
  for(let k=0;k<(count||4);k++){
    const q=pools[Math.floor(r()*pools.length)];
    const items=q.sheets.flatMap((sh,si)=>[...sh.list.map(o=>({o,si})),...sh.otk.map(o=>({o,si}))]).filter(it=>it.o._uid);
    if(!items.length) continue;
    const it=items[Math.floor(r()*items.length)], uid=it.o._uid; n++;
    if(r()<0.35){ mm.shelf.push({pool:q.pool,uid,rot:r()<0.3}); continue; }
    mm[q.pool]=mm[q.pool]||{};
    mm[q.pool][uid]={sheet:Math.floor(r()*(q.sheets.length+(r()<0.2?1:0))),x:Math.round(r()*q.pw/10)*10,y:Math.round(r()*q.pl/10)*10,rot:r()<0.3};
  }
  manualMoves=mm; run(); return n;
};
`;
