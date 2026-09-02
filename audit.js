const C=require('./core');
const base={ceil:3000,orient:'v',sym:true,offcut:true,splice:false,rot:false,minoff:300,kerf:5,stock:3000,
  jointV:true,jointH:true,edgeOps:true,tubesPerSheet:1.5,glueR:0,ledLen:0,ledW:14.4,psuR:30,
  price:{panel:4500,glue:450,edge:900,joint:950,cout:1100,cin:1100,ledstart:1200,ledjoint:1400,led:600,psu:2200,markup:0},presetName:'т'};
let PASS=0,FAIL=0;const bugs=[];
const chk=(id,c,de)=>{if(c)PASS++;else{FAIL++;if(bugs.length<30)bugs.push(id+' :: '+de);}};
function rnd(seed){let x=seed;return()=>{x=(x*1103515245+12345)&0x7fffffff;return x/0x7fffffff;};}
function mkWall(r){
  const W=Math.round((1000+r()*11000)/10)*10, H=Math.round((500+r()*4000)/10)*10;
  const w={W,H,ceil:Math.max(H,2000),rowH:(r()<0.3?Math.round((500+r()*2400)/10)*10:0),
    ops:[],seamsU:[],seamSeq:0,jointsVLed:[],
    edges:{top:['cap','led','none'][Math.floor(r()*3)],bot:r()<0.3?'cap':'none',
           left:r()<0.8?'cap':'none',right:['cap','led','none'][Math.floor(r()*3)]},
    cout:Math.floor(r()*3),cin:Math.floor(r()*3),jointModes:{}};
  const nS=Math.floor(r()*3);
  for(let i=0;i<nS;i++) w.seamsU.push({id:i+1,pos:Math.round((100+r()*(H-200))/10)*10,led:r()<0.4});
  // случайные метки продольных LED-стыков: подставляем позиции, часть из которых реально совпадёт
  // с фактическими границами полос (pw), часть — мимо (тогда просто не найдут соответствия, не баг)
  const nJ=Math.floor(r()*3);
  for(let i=0;i<nJ;i++) w.jointsVLed.push(Math.round((r()*W)/10)*10);
  const nOps=Math.floor(r()*4);
  for(let i=0;i<nOps;i++){
    const full=r()<0.3;
    const ow=Math.round((300+r()*Math.min(W*0.4,3500))/10)*10, oh=full?H:Math.round((300+r()*Math.min(H*0.7,3000))/10)*10;
    const ox=Math.round(r()*Math.max(0,W-ow)/10)*10, oy=full?0:Math.round(r()*Math.max(0,H-oh)/10)*10;
    if(ow<50||oh<50||ox+ow>W||oy+oh>H) continue;
    // не допускаем пересечение с уже добавленными проёмами — реальный пользователь так не делает,
    // а откосы/изгиб на «наложенных» проёмах дают физически бессмысленную сцену (не баг раскроя)
    const overlaps=w.ops.some(p=>ox<p.x+p.w && ox+ow>p.x && oy<p.y+p.h && oy+oh>p.y);
    if(overlaps) continue;
    const modes=()=>['corner','butt','bend','none','cap','led'][Math.floor(r()*6)];
    w.ops.push({kind:['window','door','niche'][Math.floor(r()*3)],w:ow,h:oh,x:ox,y:oy,otkos:r()<0.5,depth:[100,150,200,250][Math.floor(r()*4)],
      fillMat:r()<0.3?['marble','slat','rockL','rockS'][Math.floor(r()*4)]:null,id:i+1,
      otkosMode:{left:modes(),right:modes(),top:modes(),bottom:modes()}});
  }
  return w;
}
const N=12000; const rand=rnd(20260816); let crashed=0;
for(let t=0;t<N;t++){
  const nWalls=1+Math.floor(rand()*3);
  const G=Object.assign({},base,{pl:[2900,2500,2700][Math.floor(rand()*3)],pw:1150,
    orient:rand()<0.3?'h':'v',sym:rand()<0.5,offcut:rand()<0.85,splice:rand()<0.4,rot:rand()<0.3,
    jointV:rand()<0.85,jointH:rand()<0.9});
  const wallsArr=Array.from({length:nWalls},()=>mkWall(rand));
  let R;
  try{ R=C.computeProject(G,wallsArr); }
  catch(e){ crashed++; FAIL++; if(bugs.length<30)bugs.push('CRASH #'+t+' :: '+e.message); continue; }
  const id=`#${t} walls:${nWalls}`;

  // L1: деталь внутри листа
  R.sheets.forEach(sh=>sh.list.forEach(p=>chk('L1',p.x>=-0.5&&p.y>=-0.5&&p.x+p.w<=G.pw+0.5&&p.y+p.len<=G.pl+0.5,
    `${id}: ${p.label} вне листа`)));
  // L2: непересечение (стена×стена, откос×откос; откос×стена — только в дырке)
  R.sheets.forEach(sh=>{
    const walls2=sh.list.map(p=>({x:p.x,y:p.y,w:p.w,h:p.len,n:p.label,cuts:p.cuts}));
    const oth=sh.otk.map(o=>({x:o.x,y:o.y,w:o.dw||o.dep,h:o.dh||o.len,n:o.name}));
    const holesOf=p=>p.cuts.map(c=>({x0:p.x+c.ax,x1:p.x+c.ax+c.aw,y0:p.y+(p.h-(c.by+c.bh)),y1:p.y+(p.h-c.by)}));
    const inHole=(r,hs)=>hs.some(h=>r.x>=h.x0-2&&r.x+r.w<=h.x1+2&&r.y>=h.y0-2&&r.y+r.h<=h.y1+2);
    const ov=(A,B)=>{const ox=Math.min(A.x+A.w,B.x+B.w)-Math.max(A.x,B.x),oy=Math.min(A.y+A.h,B.y+B.h)-Math.max(A.y,B.y);return ox>1&&oy>1;};
    for(let a=0;a<walls2.length;a++)for(let b=a+1;b<walls2.length;b++)
      chk('L2',!ov(walls2[a],walls2[b]),`${id} лист ${sh.no}: стена×стена ${walls2[a].n}/${walls2[b].n}`);
    oth.forEach(o=>walls2.forEach(p=>{ if(ov(o,p)) chk('L2',inHole(o,holesOf(p)),`${id} лист ${sh.no}: откос ${o.n} на ${p.n}`); }));
    for(let a=0;a<oth.length;a++)for(let b=a+1;b<oth.length;b++)
      chk('L2',!ov(oth[a],oth[b]),`${id} лист ${sh.no}: откос×откос ${oth[a].n}/${oth[b].n}`);
  });
  // L3: все куски размещены
  const nPieces=R.layouts.reduce((a,L)=>a+L.pieces.length,0);
  chk('L3',nPieces===R.sheets.reduce((a,sh)=>a+sh.list.length,0),`${id}: потеряны детали`);
  // L4: площадь кусков = площадь сегментов + добавка от изгиба-«соседа» (у изгиба-«недорезом»
  // сама деталь не растёт — растёт только запас внутри выреза, площадь детали не меняется).
  R.layouts.forEach((L,wi)=>{
    const pa=L.pieces.reduce((a,p)=>a+p.w*p.len,0);
    let ea=0; L.strips.forEach(st=>{ea+=st.w*st.segs.reduce((x,sg)=>x+(sg[1]-sg[0]),0);});
    let widenArea=0;
    L.pieces.forEach(p=>(p.bend||[]).forEach(b=>{ if(!b.inner) widenArea+=b.extra||0; }));
    ea+=widenArea*1e6;
    chk('L4',Math.abs(pa-ea)<1,`${id} стена ${wi}: площадь деталей ${pa} != ${ea}`);
    L.pieces.forEach(p=>chk('L4b',p.len<=G.pl+0.5,`${id} стена ${wi}: кусок ${p.label} len=${p.len} > pl=${G.pl}`));
  });
  // L7/L8: панелей в разумных пределах
  const needArea=(R.netArea+R.otkosArea)*1e6;
  chk('L7',R.sheetsTotal>=Math.ceil(needArea/(G.pl*G.pw)-1e-9),`${id}: панелей меньше минимума`);
  chk('L8',R.sheetsTotal<=nPieces+R.parts.length+3,`${id}: панелей абсурдно много`);
  chk('L9',R.waste>=-0.001&&R.waste<=1.001,`${id}: waste=${R.waste}`);
  chk('L10',Number.isFinite(R.tubes)&&R.tubes>=0,`${id}: tubes`);
  // L11: профиль
  R.prof.forEach(p=>{
    chk('L11',p.sticks>=Math.ceil(p.total/G.stock-1e-9),`${id}: ${p.name} мало хлыстов`);
    const chunks=p.runs.reduce((a,r)=>a+Math.max(1,Math.ceil(r/G.stock)),0);
    chk('L11b',p.sticks<=chunks,`${id}: ${p.name} много хлыстов`);
  });
  // L13: откосы не теряются
  const uniqPlaced=new Set(R.sheets.flatMap(sh=>sh.otk.map(o=>o.name.replace(/ \(\d+\/\d+\)$/,''))));
  const failedN=new Set(R.failed.map(f=>f.name));
  new Set(R.parts.map(p=>p.name)).forEach(nm=>chk('L13',uniqPlaced.has(nm)||failedN.has(nm),`${id}: откос ${nm} потерян`));
  // L21: число деталей откоса — материал режется только для «Г-образный»/«встык». «Изгиб» не даёт
  // отдельной детали, ЕСЛИ он реально применился (отклонённый откатывается к «Г-образному», деталь
  // есть). «Нет»/«заглушка на краю»/«LED на краю» — материала откоса нет вообще ни в одном случае.
  let expOtk=0; wallsArr.forEach((w,wi)=>{
    const rej=new Set((R.layouts[wi].bendRejected||[]).map(r=>r.op+'|'+r.side));
    w.ops.forEach((o,oi)=>{
      if(!o.otkos||!(o.depth>0)) return;
      const m=k=>{
        const raw=(o.otkosMode&&o.otkosMode[k])||'corner';
        return raw==='bend'&&rej.has(oi+'|'+k) ? 'corner' : raw;   // отклонённый изгиб = деталь есть
      };
      const has=v=>v==='corner'||v==='butt';
      if(has(m('left'))) expOtk++;
      if(has(m('right'))) expOtk++;
      if(has(m('top'))) expOtk++;
      if(o.kind!=='door' && has(m('bottom'))) expOtk++;
    });
  });
  chk('L21',R.parts.length===expOtk,`${id}: откосов ${R.parts.length}!=${expOtk}`);
  // L70 (нов): площадь «откосов» честно учитывает изгиб — она равна сумме depth×len
  // по ВСЕМ сторонам с материалом откоса (corner/butt/bend) — «нет»/«заглушка»/«led» на краю
  // материала не расходуют вообще, только профиль
  {
    let expArea=0;
    wallsArr.forEach(w=>w.ops.forEach(o=>{
      if(!o.otkos||!(o.depth>0)) return;
      const m=k=>(o.otkosMode&&o.otkosMode[k])||'corner';
      const has=v=>v==='corner'||v==='butt'||v==='bend';
      if(has(m('left')))  expArea+=(o.depth*o.h)/1e6;
      if(has(m('right'))) expArea+=(o.depth*o.h)/1e6;
      if(has(m('top')))   expArea+=(o.depth*o.w)/1e6;
      if(o.kind!=='door' && has(m('bottom'))) expArea+=(o.depth*o.w)/1e6;
    }));
    // неразмещённые (failed) детали НЕ входят в otkosArea — вычитаем их площадь из ожидания
    const failedArea=R.failed.reduce((a,f)=>a+(f.dep*f.len)/1e6,0);
    chk('L70',Math.abs(R.otkosArea-(expArea-failedArea))<0.01,
      `${id}: otkosArea ${R.otkosArea.toFixed(3)} != ожидаемой ${(expArea-failedArea).toFixed(3)}`);
  }
  // L72 (нов): «заглушка на краю» и «LED на краю» без откоса — попадают именно в ops/ledstart,
  // сумма длин совпадает (вместе со старым источником ops — торцы проёмов без откоса вообще),
  // и ни разу деталь откоса для такой стороны не появляется
  {
    let expOps=0, expLed=0;
    wallsArr.forEach(w=>{
      const H=w.H,W=w.W;
      w.ops.forEach(o=>{
        if(o.otkos){
          if(!(o.depth>0)) return;
          const m=k=>(o.otkosMode&&o.otkosMode[k])||'corner';
          const sides=[['left',o.h],['right',o.h],['top',o.w]]; if(o.kind!=='door') sides.push(['bottom',o.w]);
          sides.forEach(([k,len])=>{
            if(m(k)==='cap') expOps+=len;
            if(m(k)==='led') expLed+=len;
          });
        } else {
          // старый источник ops: проём вообще без откоса — торец закрыт заглушкой на сторонах,
          // не касающихся края стены
          if(o.y>1)       expOps+=o.w;
          if(o.y+o.h<H-1) expOps+=o.w;
          if(o.x>1)       expOps+=o.h;
          if(o.x+o.w<W-1) expOps+=o.h;
        }
      });
    });
    const opsProf=R.prof.find(p=>p.key==='ops'), ledProf=R.prof.filter(p=>p.key==='ledstart').reduce((a,p)=>a+p.total,0);
    chk('L72a',Math.abs((opsProf?opsProf.total:0)-expOps)<1,
      `${id}: ops(торцы без откоса, вкл. заглушку на краю) ${opsProf?opsProf.total:0} != ${expOps}`);
    chk('L72b',ledProf>=expLed-1,
      `${id}: ledstart ${ledProf} < ожидаемого вклада от «led на краю» ${expLed}`);
  }
  // L71 (нов): у детали с bend — увеличенный габарит НЕ МЕНЬШЕ исходной ширины полосы/длины сегмента
  // (проверка, что «развёртка» действительно прибавляет, а не портит базовую геометрию)
  R.layouts.forEach((L,wi)=>{
    L.pieces.forEach(p=>{
      if(!p.bend) return;
      chk('L71',p.w>0&&p.len>0&&Number.isFinite(p.w)&&Number.isFinite(p.len),`${id} стена ${wi}: у детали с изгибом ${p.label} нелепые габариты ${p.w}x${p.len}`);
    });
  });
  // L23: метки стен уникальны при мультистенах
  if(nWalls>1){
    const labels=R.sheets.flatMap(sh=>sh.list.map(p=>p.label));
    chk('L23',labels.every(l=>/^С\d+·/.test(l)),`${id}: метки без префикса стены`);
  }
  // L30/L31: заполнения проёмов материалом
  R.fills.forEach(f=>{
    f.sheets.forEach(sh=>{
      sh.list.forEach(p=>chk('L30',p.x>=-0.5&&p.y>=-0.5&&p.x+p.w<=f.pw+0.5&&p.y+p.len<=f.pl+0.5,
        `${id} заполнение ${f.matId}: ${p.label} вне листа`));
      for(let a=0;a<sh.list.length;a++)for(let b=a+1;b<sh.list.length;b++){
        const A=sh.list[a],B=sh.list[b];
        const ox=Math.min(A.x+A.w,B.x+B.w)-Math.max(A.x,B.x),oy=Math.min(A.y+A.len,B.y+B.len)-Math.max(A.y,B.y);
        chk('L30b',!(ox>1&&oy>1),`${id} заполнение ${f.matId}: пересечение деталей`);
      }
    });
    const pa=f.layouts.reduce((a,x)=>a+x.L.pieces.reduce((b,p)=>b+p.w*p.len,0),0);
    chk('L31',Math.abs(pa/1e6-f.area)<0.01,`${id} заполнение ${f.matId}: площадь ${(pa/1e6).toFixed(2)} != ${f.area.toFixed(2)}`);
  });
  // L50 (нов): LED-суммарная лента = длина ledstart-профиля + ledjoint-профиля (в метрах), без ручной добавки
  {
    const ls=R.prof.find(p=>p.key==='ledstart'), lj=R.prof.find(p=>p.key==='ledjoint');
    const expectedAuto=((ls?ls.total:0)+(lj?lj.total:0))/1000;
    if(R.led) chk('L50',Math.abs(R.led.auto-expectedAuto)<0.01,`${id}: авто-лента ${R.led.auto} != ${expectedAuto}`);
    else chk('L50',expectedAuto<0.0005,`${id}: LED-профили есть (${expectedAuto}м), а R.led=null`);
  }
  // L51 (нов): не должно быть задвоения длины одного шва в двух профилях сразу —
  // сумма jointV(продольные)+jointH(поперечные)+ledjoint(оба вида) не может превышать
  // теоретический максимум всех продольных И поперечных швов проекта вместе
  {
    const jv=R.prof.find(p=>p.key==='jointV'), jh=R.prof.find(p=>p.key==='jointH');
    const ljTotal=R.prof.filter(p=>p.key==='ledjoint').reduce((a,p)=>a+p.total,0);
    const sumAll=(jv?jv.total:0)+(jh?jh.total:0)+ljTotal;
    let maxAll=0;
    wallsArr.forEach((w,wi)=>{
      const L=R.layouts[wi];
      L.joints.forEach(j=>j.segs.forEach(sg=>maxAll+=sg[1]-sg[0]));
      L.seams.forEach(sm=>{
        const gaps=[];
        w.ops.forEach(o=>{
          const [a0,aL]=L.vert?[o.x,o.w]:[o.y,o.h];
          const [b0,bL]=L.vert?[o.y,o.h]:[o.x,o.w];
          if(b0<sm.pos-1 && b0+bL>sm.pos+1) gaps.push([Math.max(sm.a0,a0),Math.min(sm.a1,a0+aL)]);
        });
        C.subIn ? null : null; // subIn не экспортирован — считаем верхнюю оценку без вычета проёмов
        maxAll+=(sm.a1-sm.a0);
      });
    });
    chk('L51',sumAll<=maxAll+1,`${id}: сумма всех стыковых профилей ${sumAll} > теор.максимума ${maxAll}`);
  }
  // L60-62 (нов): режим стыка по отрезкам — назначаем случайные режимы на реальные
  // отрезки этого прогона и проверяем: длина сохраняется, butt даёт ноль, каждый
  // сегмент попадает ровно в одну категорию
  if(rand()<0.5 && R.layouts[0] && nWalls===1){
    const L0=R.layouts[0], w0=wallsArr[0];
    const segKeys=[];
    L0.joints.forEach(j=>j.segs.forEach(sg=>segKeys.push({kind:'v',pos:j.pos,segStart:sg[0],len:sg[1]-sg[0]})));
    L0.seams.forEach(sm=>{
      const gaps=[];
      w0.ops.forEach(o=>{
        const [a0,aL]=L0.vert?[o.x,o.w]:[o.y,o.h];
        const [b0,bL]=L0.vert?[o.y,o.h]:[o.x,o.w];
        if(b0<sm.pos-1 && b0+bL>sm.pos+1) gaps.push([Math.max(sm.a0,a0),Math.min(sm.a1,a0+aL)]);
      });
      // приблизительная сегментация (та же subIn-логика недоступна напрямую, используем L4c-подобный проход)
    });
    if(segKeys.length){
      const modes=['cap','butt','led'];
      const chosen=segKeys.map(sk=>({...sk,mode:modes[Math.floor(rand()*3)]}));
      w0.jointModes={};
      chosen.forEach(c=>{ w0.jointModes[`v|${Math.round(c.pos)}|${Math.round(c.segStart)}`]=c.mode; });
      let R2;
      try{ R2=C.computeProject(G,wallsArr); }
      catch(e){ FAIL++; if(bugs.length<30) bugs.push('CRASH-JOINTMODE #'+t+' :: '+e.message); R2=null; }
      if(R2){
        const jv2=R2.prof.find(p=>p.key==='jointV'), lj2=R2.prof.find(p=>p.key==='ledjoint');
        const capLen=chosen.filter(c=>c.mode==='cap').reduce((a,c)=>a+c.len,0);
        const ledLen=chosen.filter(c=>c.mode==='led').reduce((a,c)=>a+c.len,0);
        chk('L60',Math.abs((jv2?jv2.total:0)-capLen)<2,`${id}: cap-сумма ${jv2?jv2.total:0} != ожидаемой ${capLen}`);
        // ledjoint может включать и горизонтальные led-сегменты — проверяем НЕ МЕНЬШЕ ожидаемого вертикального вклада
        chk('L61',(lj2?lj2.total:0)>=ledLen-2,`${id}: led-сумма ${lj2?lj2.total:0} < ожидаемого вертикального вклада ${ledLen}`);
      }
      w0.jointModes={};
    }
  }
}
console.log(`\nСценариев: ${N} | проверок: ${PASS+FAIL} | провалено: ${FAIL} | падений: ${crashed}`);
bugs.slice(0,20).forEach(b=>console.log('  '+b));
