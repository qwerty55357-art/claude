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
    ops:[],seamsU:[],seamSeq:0,vseamsU:[],vseamSeq:0,jointsVLed:[],
    edges:{top:['cap','led','none'][Math.floor(r()*3)],bot:r()<0.3?'cap':'none',
           left:r()<0.8?'cap':'none',right:['cap','led','none'][Math.floor(r()*3)]},
    cout:Math.floor(r()*3),cin:Math.floor(r()*3),jointModes:{}};
  const nS=Math.floor(r()*3);
  for(let i=0;i<nS;i++) w.seamsU.push({id:i+1,pos:Math.round((100+r()*(H-200))/10)*10,led:r()<0.4});
  // ручные вертикальные стыки (в любом месте по ширине, не только на границе полос материала)
  const nVS=Math.floor(r()*3);
  for(let i=0;i<nVS;i++) w.vseamsU.push({id:i+1,pos:Math.round((100+r()*(W-200))/10)*10});
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
    const modes=()=>['corner','butt','bend','none','cap','led','protrude'][Math.floor(r()*7)];
    w.ops.push({kind:['window','door','niche'][Math.floor(r()*3)],w:ow,h:oh,x:ox,y:oy,otkos:r()<0.5,depth:[100,150,200,250][Math.floor(r()*4)],
      otkosOverlap:r()<0.5?[50,100,150,200,300][Math.floor(r()*5)]:0,
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
    brick:rand()<0.5,jointV:rand()<0.85,jointH:rand()<0.9});
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
  // L3: все куски размещены (детали с индивидуальным материалом — matOverride — не идут в
  // главный пул, у них свой пул в R.fills с kind:'piece', см. L140/L141 ниже)
  const nPieces=R.layouts.reduce((a,L)=>a+L.pieces.filter(p=>!p.matOverride).length,0);
  chk('L3',nPieces===R.sheets.reduce((a,sh)=>a+sh.list.length,0),`${id}: потеряны детали`);
  const nOverridePieces=R.layouts.reduce((a,L)=>a+L.pieces.filter(p=>p.matOverride).length,0);
  // L4: площадь кусков = площадь сегментов + добавка от изгиба-«соседа» (у изгиба-«недорезом»
  // сама деталь не растёт — растёт только запас внутри выреза, площадь детали не меняется).
  R.layouts.forEach((L,wi)=>{
    const pa=L.pieces.reduce((a,p)=>a+p.w*p.len,0);
    let ea=0; L.strips.forEach(st=>{ea+=st.w*st.segs.reduce((x,sg)=>x+(sg[1]-sg[0]),0);});
    let widenArea=0;
    L.pieces.forEach(p=>(p.bend||[]).forEach(b=>{ if(!b.inner) widenArea+=b.extra||0; }));
    ea+=widenArea*1e6;
    // LED физически шире обычного стыка (LED_GAP=10мм) — деталь по обе стороны такого стыка
    // теряет материал: вертикальный LED-стык съедает insetStart+insetEnd по всей длине полосы,
    // горизонтальный — 10мм на всю (уже уменьшенную вертикальными стыками) ширину полосы
    let ledLoss=0;
    L.strips.forEach(st=>{
      const segLen=st.segs.reduce((x,sg)=>x+(sg[1]-sg[0]),0);
      ledLoss+=((st.insetStart||0)+(st.insetEnd||0))*segLen;
    });
    // горизонтальные LED-швы: независимый пересчёт ПО ПОЛОСЕ через ОБЪЕДИНЕНИЕ отрезков
    // [pos-5,pos+5] по LED-меткам seamsU, реально попадающим ВНУТРЬ одного из сегментов этой
    // полосы (строго внутри — «шов» на самой границе сегмента ничего не режет) — а не через
    // L.seams: L.seams МОЛЧА теряет метку, если из-за неё и соседней LED-метки ближе LED_GAP=10мм
    // друг от друга кусок между ними схлопнулся до нулевой длины и был отброшен ДО seams.push
    // (см. buildLayout) — тогда пересчёт через L.seams недосчитал бы эту потерю площади. Ограничение
    // «строго внутри сегмента ЭТОЙ полосы» — чтобы не считать метку там, где для этой полосы шва
    // вообще нет (проём разбил сегмент иначе, чем у соседних полос).
    L.strips.forEach(st=>{
      const inSeg=p=>st.segs.some(sg=>p>sg[0]+0.5 && p<sg[1]-0.5);
      const pos=(wallsArr[wi].seamsU||[]).filter(u=>u.led&&inSeg(u.pos)).map(u=>u.pos).sort((a,b)=>a-b);
      const merged=[];
      pos.forEach(p=>{
        const iv=[p-5,p+5];
        if(merged.length && iv[0]<=merged[merged.length-1][1]+0.01) merged[merged.length-1][1]=Math.max(merged[merged.length-1][1],iv[1]);
        else merged.push(iv);
      });
      const uni=merged.reduce((a,iv)=>a+(iv[1]-iv[0]),0);
      ledLoss+=uni*(st.w-(st.insetStart||0)-(st.insetEnd||0));
    });
    ea-=ledLoss;
    chk('L4',Math.abs(pa-ea)<1,`${id} стена ${wi}: площадь деталей ${pa} != ${ea}`);
    L.pieces.forEach(p=>chk('L4b',p.len<=G.pl+0.5,`${id} стена ${wi}: кусок ${p.label} len=${p.len} > pl=${G.pl}`));
    // L120 (нов): ручные вертикальные стыки (userVSeams) режут полосу на части, но не теряют и
    // не прибавляют ширину — сумма ширин полос внутри каждого участка (region) равна его ширине.
    {
      const byRegion={};
      L.strips.forEach(st=>{ byRegion[st.region]=(byRegion[st.region]||0)+st.w; });
      L.regions.forEach((rg,ri)=>{
        const want=rg[1]-rg[0], got=byRegion[ri]||0;
        chk('L120',Math.abs(want-got)<1,`${id} стена ${wi}: участок ${ri} — сумма ширин полос ${got} != ${want}`);
      });
    }
  });
  // L121 (нов): ручной вертикальный стык, реально попавший внутрь полосы (не на её готовую
  // границу), обязан дать новый стык (L.joints) на этой отметке — иначе кнопка «+ добавить
  // вертикальный стык» молча ничего не делает.
  wallsArr.forEach((w,wi)=>{
    (w.vseamsU||[]).forEach(vs=>{
      const L=R.layouts[wi];
      const onBoundary=L.strips.some(st=>Math.abs(st.start-vs.pos)<1||Math.abs(st.end-vs.pos)<1);
      const outOfRange=!L.strips.some(st=>vs.pos>st.start+1&&vs.pos<st.end-1)&&!onBoundary;
      if(outOfRange) return;   // позиция вне полос вообще (мимо стены/по кромке проёма) — не баг
      if(onBoundary) return;   // уже совпало с готовой границей — резать нечего, стык и так есть
      chk('L121',L.joints.some(j=>Math.abs(j.pos-vs.pos)<2),
        `${id} стена ${wi}: вертикальный стык на ${vs.pos} не появился в L.joints`);
    });
  });
  // L130-132 (нов): физическая ширина LED (10мм, поровну 5+5 на стыке между полосами, все 10 —
  // с одной стороны на краю стены) на чистой стене (без проёмов) — сравниваем LED-прогон с
  // cap-прогоном той же стены и проверяем ТОЧНУЮ разницу, а не только совокупную площадь (L4
  // мог бы не заметить компенсирующую пару ошибок в противоположных знаках).
  if(rand()<0.4){
    const wT={W:3200,H:2300,ceil:3000,rowH:0,ops:[],seamsU:[],seamSeq:0,vseamsU:[],vseamSeq:0,
      jointsVLed:[],edges:{top:'none',bot:'none',left:'cap',right:'cap'},cout:0,cin:0,jointModes:{}};
    const Gt=Object.assign({},G,{orient:'v',sym:false});
    const base=C.computeProject(Gt,[wT]).layouts[0];
    if(base.strips.length>=2){
      const j0=base.joints[0];
      wT.jointModes={}; wT.jointModes[C.jointSegKey('v',j0.pos,j0.segs[0][0])]='led';
      const led=C.computeProject(Gt,[wT]).layouts[0];
      const a0=base.strips[0], a1=led.strips[0], b0=base.strips[1], b1=led.strips[1];
      chk('L130a',Math.abs((a1.insetEnd-a0.insetEnd)-5)<0.01,`${id}: верт. LED-стык — insetEnd левой полосы ${a1.insetEnd} вместо ${a0.insetEnd+5}`);
      chk('L130b',Math.abs((b1.insetStart-b0.insetStart)-5)<0.01,`${id}: верт. LED-стык — insetStart правой полосы ${b1.insetStart} вместо ${b0.insetStart+5}`);
      // L134 (нов): ledCircuits — чистый оверлей поверх уже отмеченной 'led'-позиции стыка.
      // Геометрия (insetStart/insetEnd выше) не зависит от контура вовсе — он влияет только
      // на то, В КАКОЙ профильный пул попадает длина (соединитель/старт/без профиля), не на то,
      // есть ли там LED вообще. Сравниваем ПОЛНЫЙ R (не только layouts[0]) до/после обёртки
      // одной и той же позиции в контур с kind:'start' (переключаем «соединительный» -> «стартовый»)
      // и с kind:'none' («без профиля» — длина не должна пропадать из суммарной ленты).
      const R0=C.computeProject(Gt,[wT]);
      const segLen=j0.segs[0][1]-j0.segs[0][0];
      const legJ={wall:wT.id,el:'jointV',pos:j0.pos,segStart:j0.segs[0][0]};
      const RStart=C.computeProject(Gt,[wT],{},[],[{id:1,kind:'start',legs:[legJ]}]);
      const lj0=(R0.prof.find(p=>p.key==='ledjoint')||{total:0}).total;
      const lj1=(RStart.prof.find(p=>p.key==='ledjoint')||{total:0}).total;
      const ls1=(RStart.prof.find(p=>p.key==='ledstart')||{total:0}).total;
      chk('L134a',Math.abs((lj0-lj1)-segLen)<0.5,
        `${id}: LED-контур kind=start на стыке — ledjoint не уменьшился на длину сегмента (${lj0}->${lj1}, сегмент ${segLen})`);
      chk('L134b',ls1>=segLen-0.5,
        `${id}: LED-контур kind=start на стыке — ledstart не получил длину сегмента (${ls1} < ${segLen})`);
      chk('L134c',!!R0.led&&!!RStart.led&&Math.abs(R0.led.auto-RStart.led.auto)<0.01,
        `${id}: LED-контур сменил суммарную длину ленты (было ${R0.led&&R0.led.auto}, стало ${RStart.led&&RStart.led.auto}) — контур не должен влиять на длину, только на профиль`);
      const RNone=C.computeProject(Gt,[wT],{},[],[{id:1,kind:'none',legs:[legJ]}]);
      const ljN=(RNone.prof.find(p=>p.key==='ledjoint')||{total:0}).total;
      const lsN=(RNone.prof.find(p=>p.key==='ledstart')||{total:0}).total;
      chk('L134d',Math.abs(ljN-lj1)<0.01&&Math.abs(lsN)<0.01,
        `${id}: LED-контур kind=none на стыке — сегмент не должен попасть ни в ledjoint (${ljN}), ни в ledstart (${lsN})`);
      chk('L134e',!!RNone.led&&Math.abs(R0.led.auto-RNone.led.auto)<0.01,
        `${id}: LED-контур kind=none изменил суммарную длину ленты (${R0.led&&R0.led.auto} -> ${RNone.led&&RNone.led.auto}) — «без профиля» всё равно считает метраж`);
    }
    if(base.seams.length){
      const sm0=base.seams[0];
      wT.jointModes={}; wT.jointModes[C.jointSegKey('h',sm0.pos,sm0.a0)]='led';
      const led=C.computeProject(Gt,[wT]).layouts[0];
      const before=base.pieces.filter(p=>p.strip===sm0.strip&&Math.abs(p.to-sm0.pos)<1)[0];
      const after=base.pieces.filter(p=>p.strip===sm0.strip&&Math.abs(p.from-sm0.pos)<1)[0];
      const beforeL=led.pieces.filter(p=>p.strip===sm0.strip&&Math.abs(p.to-(sm0.pos-5))<1)[0];
      const afterL=led.pieces.filter(p=>p.strip===sm0.strip&&Math.abs(p.from-(sm0.pos+5))<1)[0];
      chk('L131a',!!beforeL&&Math.abs((before.to-before.from)-(beforeL.to-beforeL.from)-5)<0.01,
        `${id}: гориз. LED-шов — кусок ДО шва не укоротился ровно на 5мм`);
      chk('L131b',!!afterL&&Math.abs((after.to-after.from)-(afterL.to-afterL.from)-5)<0.01,
        `${id}: гориз. LED-шов — кусок ПОСЛЕ шва не укоротился ровно на 5мм`);
    }
    wT.jointModes={}; wT.edges.left='led';
    const ledgeL=C.computeProject(Gt,[wT]).layouts[0];
    chk('L132',Math.abs(ledgeL.strips[0].insetStart-10)<0.01,
      `${id}: LED-край слева — insetStart первой полосы ${ledgeL.strips[0].insetStart} вместо 10`);
    // L133 (нов): «LED на краю панели» у откоса (без материала) — вырез под проём увеличивается
    // на LED_GAP именно с той стороны, где выбран этот режим, панель со стороны проёма отступает
    const wOp={W:3000,H:2300,ceil:3000,rowH:0,seamsU:[],seamSeq:0,vseamsU:[],vseamSeq:0,
      jointsVLed:[],edges:{top:'none',bot:'none',left:'none',right:'none'},cout:0,cin:0,jointModes:{},
      ops:[{kind:'window',w:800,h:1000,x:1000,y:500,otkos:true,depth:150,id:1,
            otkosMode:{left:'cap',right:'cap',top:'cap',bottom:'cap'}}]};
    const baseOp=C.computeProject(Gt,[wOp]).layouts[0];
    wOp.ops[0].otkosMode.left='led';
    const ledOp=C.computeProject(Gt,[wOp]).layouts[0];
    const cutOf=L=>{ for(const p of L.pieces){ const c=(p.cuts||[]).find(x=>x.op===0); if(c) return c; } return null; };
    const c0=cutOf(baseOp), c1=cutOf(ledOp);
    chk('L133a',!!c0&&!!c1&&Math.abs((c0.ax-c1.ax)-10)<0.5,
      `${id}: LED на краю откоса (left) — ax ${c1&&c1.ax} вместо ${c0&&(c0.ax-10)}`);
    chk('L133b',!!c0&&!!c1&&Math.abs((c1.aw-c0.aw)-10)<0.5,
      `${id}: LED на краю откоса (left) — aw ${c1&&c1.aw} вместо ${c0&&(c0.aw+10)}`);
  }
  // L7/L8: панелей в разумных пределах
  const needArea=(R.netArea+R.otkosArea)*1e6;
  chk('L7',R.sheetsTotal>=Math.ceil(needArea/(G.pl*G.pw)-1e-9),`${id}: панелей меньше минимума`);
  chk('L8',R.sheetsTotal<=nPieces+R.parts.length+3,`${id}: панелей абсурдно много`);
  chk('L9',R.waste>=-0.001&&R.waste<=1.001,`${id}: waste=${R.waste}`);
  chk('L10',Number.isFinite(R.tubes)&&R.tubes>=0,`${id}: tubes`);
  // L12 (нов): «реальная площадь приклейки» — netArea уже включает любую деталь стены независимо
  // от материала, поэтому фонд 'piece' добавлять в glueArea ещё раз нельзя (задвоение); 'opening'
  // и 'otkos' обязаны быть добавлены — opsArea вычитает ВСЕ проёмы целиком, otkosArea считает
  // только НЕпереопределённые стороны откоса. На БАЗОВОМ прогоне (без активного pieceMats/
  // otkosMat) это гоняет как минимум ветку 'opening' (mkWall сам иногда даёт fillMat); ветки
  // 'piece'/'otkos' дополнительно проверяются в момент их активации — см. L140-144/L160-162.
  {
    const addBack=R.fills.filter(f=>f.kind!=='piece').reduce((a,f)=>a+f.area,0);
    chk('L12',Math.abs(R.glueArea-(R.netArea+R.otkosArea+addBack))<0.01,
      `${id}: glueArea ${R.glueArea.toFixed(3)} != netArea+otkosArea+addBack ${(R.netArea+R.otkosArea+addBack).toFixed(3)}`);
  }
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
      const has=v=>v==='corner'||v==='butt'||v==='protrude';
      if(has(m('left'))) expOtk++;
      if(has(m('right'))) expOtk++;
      if(has(m('top'))) expOtk++;
      if(o.kind!=='door' && has(m('bottom'))) expOtk++;
    });
  });
  chk('L21',R.parts.length===expOtk,`${id}: откосов ${R.parts.length}!=${expOtk}`);
  // L70 (нов): площадь «откосов» честно учитывает изгиб — она равна сумме depth×len
  // по ВСЕМ сторонам с материалом откоса (corner/butt/bend/protrude) — «нет»/«заглушка»/«led»
  // на краю материала не расходуют вообще, только профиль. «Выступающий» (protrude) добавляет
  // вылет накладки (otkosOverlap) к глубине именно на СВОИХ сторонах (depOf), а у верх/низ ещё и
  // к ДЛИНЕ — Т-стык: они перекрывают торцы лев/прав, если та тоже «выступающая» (lenOf), та же
  // логика, что и в buildOtkosParts.
  {
    let expArea=0;
    wallsArr.forEach(w=>w.ops.forEach(o=>{
      if(!o.otkos||!(o.depth>0)) return;
      const m=k=>(o.otkosMode&&o.otkosMode[k])||'corner';
      const has=v=>v==='corner'||v==='butt'||v==='bend'||v==='protrude';
      const depOf=k=>o.depth+(m(k)==='protrude'?(o.otkosOverlap||0):0);
      const lenOf=k=>{
        if(k==='left'||k==='right') return o.h;
        const ov=o.otkosOverlap||0;
        const extL=m('left')==='protrude'?ov:0, extR=m('right')==='protrude'?ov:0;
        return o.w+(m(k)==='protrude'?extL+extR:0);
      };
      if(has(m('left')))  expArea+=(depOf('left')*lenOf('left'))/1e6;
      if(has(m('right'))) expArea+=(depOf('right')*lenOf('right'))/1e6;
      if(has(m('top')))   expArea+=(depOf('top')*lenOf('top'))/1e6;
      if(o.kind!=='door' && has(m('bottom'))) expArea+=(depOf('bottom')*lenOf('bottom'))/1e6;
    }));
    // неразмещённые (failed) детали НЕ входят в otkosArea — вычитаем их площадь из ожидания
    const failedArea=R.failed.reduce((a,f)=>a+(f.dep*f.len)/1e6,0);
    chk('L70',Math.abs(R.otkosArea-(expArea-failedArea))<0.01,
      `${id}: otkosArea ${R.otkosArea.toFixed(3)} != ожидаемой ${(expArea-failedArea).toFixed(3)}`);
  }
  // L73 (нов): «заглушка примыкания к раме» — на каждую сторону с материалом или изгибом
  // (corner/butt/bend/protrude), длиной lenOf — у «выступающих» верх/низ она длиннее на Т-стык
  // (см. buildOtkosParts и effOps-блок в computeProject).
  {
    let expFrame=0;
    wallsArr.forEach(w=>w.ops.forEach(o=>{
      if(!o.otkos||!(o.depth>0)) return;
      const m=k=>(o.otkosMode&&o.otkosMode[k])||'corner';
      const has=v=>v==='corner'||v==='butt'||v==='bend'||v==='protrude';
      const lenOf=k=>{
        if(k==='left'||k==='right') return o.h;
        const ov=o.otkosOverlap||0;
        const extL=m('left')==='protrude'?ov:0, extR=m('right')==='protrude'?ov:0;
        return o.w+(m(k)==='protrude'?extL+extR:0);
      };
      if(has(m('left')))  expFrame+=lenOf('left');
      if(has(m('right'))) expFrame+=lenOf('right');
      if(has(m('top')))   expFrame+=lenOf('top');
      if(o.kind!=='door' && has(m('bottom'))) expFrame+=lenOf('bottom');
    }));
    const frameProf=R.prof.find(p=>p.key==='frame');
    chk('L73',Math.abs((frameProf?frameProf.total:0)-expFrame)<1,
      `${id}: frame ${frameProf?frameProf.total:0} != ${expFrame}`);
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
  // L150-152 (нов): несколько БП вместо одного нереального номинала. Суммарная мощность
  // psuCount×psuW обязана покрывать реальную потребность need, psuW — стандартный номинал,
  // а psuCount — минимально возможное число единиц (меньшим числом не покрыть потребность
  // даже самым крупным доступным номиналом).
  if(R.led){
    const maxNom=C.PSU_NOMINALS[C.PSU_NOMINALS.length-1];
    chk('L150',R.led.psuCount*R.led.psuW>=R.led.need-0.01,
      `${id}: БП суммарно ${R.led.psuCount}×${R.led.psuW}=${R.led.psuCount*R.led.psuW} < потребности ${R.led.need}`);
    chk('L151',C.PSU_NOMINALS.includes(R.led.psuW),`${id}: номинал БП ${R.led.psuW} не из стандартного ряда`);
    chk('L152',R.led.psuCount===1||(R.led.psuCount-1)*maxNom<R.led.need-0.01,
      `${id}: БП ${R.led.psuCount} шт избыточно — хватило бы ${R.led.psuCount-1}`);
  }
  // L153 (нов): обычные случайные стены почти никогда не набирают на несколько БП сами —
  // принудительно большая лента (ручная добавка, 50-350м), чтобы реально прогнать ветку
  // psuCount>1, а не только пассивно проверять её на сценариях, где она не сработала.
  if(rand()<0.3){
    const bigLen=50+rand()*300;
    const Gx=Object.assign({},G,{ledLen:bigLen});
    const wSimple={W:3000,H:2300,ceil:3000,rowH:0,ops:[],seamsU:[],seamSeq:0,vseamsU:[],vseamSeq:0,
      jointsVLed:[],edges:{top:'none',bot:'none',left:'none',right:'none'},cout:0,cin:0,jointModes:{}};
    let Rx;
    try{ Rx=C.computeProject(Gx,[wSimple]); }
    catch(e){ FAIL++; if(bugs.length<30) bugs.push('CRASH-PSUBIG #'+t+' :: '+e.message); Rx=null; }
    if(Rx&&Rx.led){
      const maxNom=C.PSU_NOMINALS[C.PSU_NOMINALS.length-1];
      chk('L153a',Rx.led.psuCount>1,`${id}: большая лента ${bigLen.toFixed(1)}м не потребовала нескольких БП (psuCount=${Rx.led.psuCount})`);
      chk('L153b',Rx.led.psuCount*Rx.led.psuW>=Rx.led.need-0.01,`${id}: БП недостаточно для большой ленты`);
      chk('L153c',Rx.led.psuCount===1||(Rx.led.psuCount-1)*maxNom<Rx.led.need-0.01,`${id}: БП избыточно для большой ленты`);
    }
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
  // L80/L81 (нов): «автосвязка углов» — cornerLinks как 4-й параметр computeProject.
  // Строим случайный набор связей между стенами (плюс «половинные» — один конец вне проекта)
  // и проверяем, что суммарная длина профиля «cout»/«cin» равна независимо посчитанному
  // ожиданию: старые источники (per-wall счётчики + corner-режим на откосах, это то, что уже
  // дал R без links) плюс один прогон на связь длиной по более высокой из двух стен
  // (или по своей стене, если второй конец — «вне проекта»).
  {
    wallsArr.forEach((w,i)=>{ w.id=i+1; });
    const links=[];
    if(rand()<0.7){
      const nLinks=Math.floor(rand()*3);
      for(let k=0;k<nLinks;k++){
        const a=wallsArr[Math.floor(rand()*wallsArr.length)];
        const outside=rand()<0.3||wallsArr.length<2;
        const b=outside?null:wallsArr[Math.floor(rand()*wallsArr.length)];
        links.push({id:k+1,type:rand()<0.5?'out':'in',aw:a.id,as:'left',bw:b?b.id:'',bs:b?'right':''});
      }
    }
    let R2;
    try{ R2=C.computeProject(G,wallsArr,undefined,links); }
    catch(e){ FAIL++; if(bugs.length<30) bugs.push('CRASH-CORNERLINKS #'+t+' :: '+e.message); R2=null; }
    if(R2){
      const baseOut=R.prof.find(p=>p.key==='cout'), baseIn=R.prof.find(p=>p.key==='cin');
      const byId=new Map(wallsArr.map(w=>[w.id,w]));
      let addOut=0, addIn=0;
      links.forEach(c=>{
        const a=byId.get(c.aw); if(!a) return;
        const b=c.bw?byId.get(c.bw):null;
        const len=b?Math.max(a.H,b.H):a.H;
        if(c.type==='in') addIn+=len; else addOut+=len;
      });
      const outTot2=R2.prof.find(p=>p.key==='cout'), inTot2=R2.prof.find(p=>p.key==='cin');
      const expOut=(baseOut?baseOut.total:0)+addOut, expIn=(baseIn?baseIn.total:0)+addIn;
      chk('L80',Math.abs((outTot2?outTot2.total:0)-expOut)<1,`${id}: cout ${outTot2?outTot2.total:0} != ${expOut}`);
      chk('L81',Math.abs((inTot2?inTot2.total:0)-expIn)<1,`${id}: cin ${inTot2?inTot2.total:0} != ${expIn}`);
    }
  }
  // L90/L91 (нов): ручной шов откоса (otkosSeamPos) при гарантированно вынужденной стыковке
  // (сторона длиннее листа: len>G.pl, значит whole=false железно — auto-добор листов разрешён,
  // так что валидный план обязан лечь ровно как задан, отказа быть не может). Ищем первую
  // подходящую сторону в уже сгенерированной сцене, отдельно проверяем валидный план (все куски
  // <= pl, равные доли на ceil(len/pl) частей) и заведомо невалидный (кусок pl+1 > pl).
  {
    let cand=null;
    outer:
    for(let wi=0;wi<wallsArr.length;wi++){
      const w=wallsArr[wi];
      for(let oi=0;oi<w.ops.length;oi++){
        const o=w.ops[oi];
        if(!o.otkos||!(o.depth>0)) continue;
        for(const side of ['left','right','top','bottom']){
          if(side==='bottom'&&o.kind==='door') continue;
          const m=(o.otkosMode&&o.otkosMode[side])||'corner';
          if(m!=='corner'&&m!=='butt'&&m!=='protrude') continue;
          // Т-стык: верх/низ «выступающий» длиннее на вылет накладки с каждого конца, где
          // соседняя лев/прав тоже «выступающая» — та же lenOf-логика, что в buildOtkosParts
          const sideMode=k=>(o.otkosMode&&o.otkosMode[k])||'corner';
          let len=(side==='left'||side==='right')?o.h:o.w;
          if((side==='top'||side==='bottom')&&m==='protrude'){
            const ov=o.otkosOverlap||0;
            len+=(sideMode('left')==='protrude'?ov:0)+(sideMode('right')==='protrude'?ov:0);
          }
          if(len>G.pl){ cand={wi,oi,side,len}; break outer; }
        }
      }
    }
    if(cand){
      const {wi,oi,side,len}=cand;
      const o=wallsArr[wi].ops[oi];
      const doInvalid=rand()<0.5 && len>G.pl+2;
      let positions;
      if(doInvalid){
        positions=[G.pl+1];                            // один кусок гарантированно длиннее листа
      } else {
        const minParts=Math.ceil(len/G.pl), nSplits=Math.max(1,minParts-1);
        positions=Array.from({length:nSplits},(_,k)=>Math.round(len*(k+1)/(nSplits+1)));
      }
      o.otkosSeamPos=o.otkosSeamPos||{}; o.otkosSeamPos[side]=positions;
      let R2;
      try{ R2=C.computeProject(G,wallsArr); }
      catch(e){ FAIL++; if(bugs.length<30) bugs.push('CRASH-OTKOSSEAM #'+t+' :: '+e.message); R2=null; }
      if(R2){
        const poss=[...new Set(positions.map(v=>Math.round(v)))].filter(v=>v>0&&v<len-1).sort((a,b)=>a-b);
        const bounds=[0,...poss,len];
        const takes=bounds.slice(1).map((b,k)=>b-bounds[k]).sort((a,b)=>a-b);
        const allFit=takes.every(x=>x<=G.pl+0.001);
        const sideName={left:'лев',right:'прав',top:'верх',bottom:'низ'}[side];
        let base='О'+(oi+1)+'·'+sideName;
        if(wallsArr.length>1) base='С'+(wi+1)+'·'+base;
        const ignored=(R2.manualSeamIgnored||[]).includes(base);
        if(allFit){
          chk('L90',!ignored,`${id}: валидный ручной шов ${base} неожиданно отклонён (позиции ${positions})`);
          const got=[];
          R2.sheets.forEach(sh=>sh.otk.forEach(p=>{
            if(p.name===base||p.name.startsWith(base+' (')) got.push(Math.round(p.dh));
          }));
          got.sort((a,b)=>a-b);
          chk('L91',JSON.stringify(got)===JSON.stringify(takes),`${id}: куски ${base} = [${got}] != заданным [${takes}]`);
        } else {
          chk('L90',ignored,`${id}: невалидный ручной шов ${base} (позиции ${positions}, куски [${takes}]) не был отклонён`);
        }
      }
      o.otkosSeamPos={};
    }
  }
  // L100-102 (нов): «поворот деталей с вырезами» — алгебра rotateCuts как таковая, независимо от
  // размещения на листе (в отличие от применения через applyManual, тут не может быть ложного
  // отказа из-за коллизии на конкретных x,y — проверяем сам пересчёт координат выреза).
  // Для ЛЮБОЙ детали с вырезом на сцене: новые габариты — len x w (было w x len), каждый
  // повёрнутый вырез обязан остаться внутри новых габаритов и не потерять площадь (aw*bh
  // алгебраически не меняется при обмене местами — это защита от опечатки в формуле).
  {
    let any=false;
    for(const sh of R.sheets){
      for(const p of sh.list){
        if(!p.cuts||!p.cuts.length) continue;
        any=true;
        const w2=p.len, len2=p.w;
        const rc=C.rotateCuts(p.cuts,p.w,p.len);
        const areaBefore=p.cuts.reduce((a,c)=>a+c.aw*c.bh,0);
        const areaAfter=rc.reduce((a,c)=>a+c.aw*c.bh,0);
        chk('L100',Math.abs(areaBefore-areaAfter)<0.01,`${id}: ${p.label} площадь выреза после rotateCuts ${areaAfter}!=${areaBefore}`);
        const inside=rc.every(c=>c.ax>=-0.5&&c.ax+c.aw<=w2+0.5&&c.by>=-0.5&&c.by+c.bh<=len2+0.5);
        chk('L101',inside,`${id}: ${p.label} повёрнутый вырез вышел за новые габариты ${w2}x${len2}`);
        // четыре поворота на 90° = 360° = тождество — единственный признак «не плывёт», который
        // не зависит от домысливания геометрии 180°/270° в самом тесте (два поворота на 90° это
        // 180°, а не исходное положение — проверять здесь на равенство исходнику неверно)
        let rc4=p.cuts, ww=p.w, ll=p.len;
        for(let k=0;k<4;k++){ const nc=C.rotateCuts(rc4,ww,ll); const t2=ww; ww=ll; ll=t2; rc4=nc; }
        const roundtrip=ww===p.w&&ll===p.len&&rc4.every((c,i)=>Math.abs(c.ax-p.cuts[i].ax)<0.5&&Math.abs(c.aw-p.cuts[i].aw)<0.5&&
                                          Math.abs(c.by-p.cuts[i].by)<0.5&&Math.abs(c.bh-p.cuts[i].bh)<0.5);
        chk('L102',roundtrip,`${id}: ${p.label} четыре поворота выреза не вернули исходные координаты`);
      }
    }
  }
  // L103/L104 (нов): интеграция через applyManual/computeProject. Деталь, в вырезе которой сейчас
  // кто-то сидит (sh.otk внутри holeRects), обязана остаться НЕповёрнутой — canRotate=false молча
  // отбрасывает правку. Деталь с ПУСТЫМ вырезом, для которой поворот в тех же x,y геометрически
  // возможен (не выходит за лист и не пересекает соседей — честно проверяем сами, как это делает
  // doRotate перед применением), обязана повернуться ровно так, как описывает rotateCuts.
  {
    const insideTol=(kr,h)=>kr.x>=h.x-3&&kr.y>=h.y-3&&kr.x+kr.w<=h.x+h.w+3&&kr.y+kr.h<=h.y+h.h+3;
    const overlap=(a,b,kerf)=>{
      const gx=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x), gy=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);
      return gx>-kerf+1&&gy>-kerf+1;
    };
    let emptyFeasible=null, busyCand=null;
    outer2:
    for(const sh of R.sheets){
      const others=[...sh.list.map(o=>({x:o.x,y:o.y,w:o.w,h:o.len,o})),
                    ...sh.otk.map(o=>({x:o.x,y:o.y,w:o.dw||o.dep,h:o.dh||o.len,o}))];
      for(const p of sh.list){
        if(!p.cuts||!p.cuts.length) continue;
        const holes=C.holeRects(p);
        const busy=sh.otk.some(k=>holes.some(h=>insideTol({x:k.x,y:k.y,w:k.dw||k.dep,h:k.dh||k.len},h)));
        if(busy){ if(!busyCand) busyCand={sh,p}; continue; }
        if(emptyFeasible) continue;
        const w2=p.len,h2=p.w;
        if(p.x+w2>G.pw+0.5||p.y+h2>G.pl+0.5) continue;
        const rr={x:p.x,y:p.y,w:w2,h:h2};
        const blocked=others.some(o=>o.o!==p&&overlap(rr,o,G.kerf));
        if(!blocked) emptyFeasible={sh,p};
        if(emptyFeasible&&busyCand) break outer2;
      }
    }
    if(emptyFeasible){
      const {sh,p}=emptyFeasible;
      const manual={main:{[p._uid]:{sheet:sh.no-1,x:p.x,y:p.y,rot:true}},shelf:[]};
      let R2;
      try{ R2=C.computeProject(G,wallsArr,manual); }
      catch(e){ FAIL++; if(bugs.length<30) bugs.push('CRASH-ROTCUTS-EMPTY #'+t+' :: '+e.message); R2=null; }
      if(R2){
        const sh2=R2.sheets[sh.no-1];
        const p2=sh2&&sh2.list.find(x=>x.label===p.label);
        chk('L103',!!p2&&Math.abs(p2.w-p.len)<0.5&&Math.abs(p2.len-p.w)<0.5,
          `${id}: ${p.label} после поворота ${p2?p2.w+'x'+p2.len:'не найдена'}, ожидалось ${p.len}x${p.w}`);
      }
    }
    if(busyCand){
      const {sh,p}=busyCand;
      const manual={main:{[p._uid]:{sheet:sh.no-1,x:p.x,y:p.y,rot:true}},shelf:[]};
      let R2;
      try{ R2=C.computeProject(G,wallsArr,manual); }
      catch(e){ FAIL++; if(bugs.length<30) bugs.push('CRASH-ROTCUTS-BUSY #'+t+' :: '+e.message); R2=null; }
      if(R2){
        const sh2=R2.sheets[sh.no-1];
        const p2=sh2&&sh2.list.find(x=>x.label===p.label);
        chk('L104',!!p2 && Math.abs(p2.w-p.w)<0.5 && Math.abs(p2.len-p.len)<0.5,
          `${id}: ${p.label} с занятым вырезом повернулась вопреки запрету`);
      }
    }
  }
  // L110/L111 (нов): раскладка «кирпичиком». На чистой стене без проёмов и ручных швов (чтобы не
  // путать сдвиг с их собственным вкладом в точки реза) при brick:true чётные полосы держат фазу
  // anchor=rowH, нечётные — сдвинуты ровно на pl/2 по модулю pl; и (если полос ≥2 и швы вообще
  // есть) обе фазы обязаны реально встретиться — иначе сдвиг никуда не делся.
  {
    const rowHTest=rand()<0.5?0:Math.round((200+rand()*(G.pl-400))/10)*10;
    const wTest={W:Math.round((2000+rand()*4000)/10)*10, H:Math.round((3000+rand()*6000)/10)*10,
      ceil:9000, rowH:rowHTest, ops:[], seamsU:[], seamSeq:0, jointsVLed:[],
      edges:{top:'none',bot:'none',left:'none',right:'none'}, cout:0, cin:0, jointModes:{}};
    const Gb=Object.assign({},G,{brick:true});
    let Rb;
    try{ Rb=C.computeProject(Gb,[wTest]); }
    catch(e){ FAIL++; if(bugs.length<30) bugs.push('CRASH-BRICK #'+t+' :: '+e.message); Rb=null; }
    if(Rb){
      const L=Rb.layouts[0];
      const rowHEff=(wTest.rowH>0 && wTest.rowH<=Gb.pl+0.5)?wTest.rowH:0;
      let ok=true; const detail=[];
      L.seams.forEach(sm=>{
        const wantPhase=(rowHEff+(sm.strip%2===1?Gb.pl/2:0))%Gb.pl;
        const gotPhase=((sm.pos%Gb.pl)+Gb.pl)%Gb.pl;
        const d=Math.min(Math.abs(gotPhase-wantPhase),Gb.pl-Math.abs(gotPhase-wantPhase));
        if(d>1){ ok=false; detail.push(`полоса ${sm.strip}@${sm.pos} (ждали фазу ${wantPhase.toFixed(0)}, получили ${gotPhase.toFixed(0)})`); }
      });
      chk('L110',ok,`${id}: кирпичик — фаза шва не совпала: ${detail.join('; ')}`);
      // «сдвига нет вовсе» проверяем только когда у ОБЕИХ чётностей вообще есть хоть один шов —
      // короткая полоса, у которой сдвинутая метка вышла за её собственную длину, законно
      // остаётся вовсе без шва (это не баг: искусственно резать её только ради сдвига не надо,
      // см. forcesCut в splitSeg), и тогда сравнивать её не с чем
      const phaseOf=sm=>Math.round((((sm.pos%Gb.pl)+Gb.pl)%Gb.pl)/10)*10;
      const evenPhases=new Set(L.seams.filter(sm=>sm.strip%2===0).map(phaseOf));
      const oddPhases=new Set(L.seams.filter(sm=>sm.strip%2===1).map(phaseOf));
      if(evenPhases.size && oddPhases.size){
        const overlap=[...evenPhases].some(p=>oddPhases.has(p));
        chk('L111',!overlap,`${id}: кирпичик — чётные и нечётные полосы дали одну и ту же фазу (${[...evenPhases]} / ${[...oddPhases]})`);
      }
    }
  }
  // L140-144 (нов): индивидуальный материал отдельной детали стены (клик по детали на схеме,
  // w.pieceMats) — БЕРЁМ ЛЮБУЮ деталь, включая деталь с вырезом под проём (её вырез передаётся
  // во вложенный buildLayout синтетическим op, см. computeProject). Назначаем ей материал из
  // PRESETS через pieceMats и пересчитываем: деталь обязана уйти из главного пула, в R2.fills
  // обязана появиться запись kind:'piece' для этого материала с записью именно этой детали,
  // площадь её замощения обязана совпасть с площадью исходной детали, а для детали с вырезом —
  // ещё и площадь самого выреза обязана сохраниться (не пропасть и не задвоиться). Геометрия
  // замощения — непересечение и границы листа — уже проверяется общими L30/L30b/L31, они
  // гоняются по ВСЕМ R.fills независимо от kind.
  if(rand()<0.5){
    const cands=[];
    R.layouts.forEach((L,wi)=>L.pieces.forEach(p=>{ cands.push({wi,p}); }));
    if(cands.length){
      const {wi,p}=cands[Math.floor(rand()*cands.length)];
      const opts=C.PRESETS.filter(m=>m.id!=='custom');
      const mat=opts[Math.floor(rand()*opts.length)];
      wallsArr[wi].pieceMats={}; wallsArr[wi].pieceMats[p.pk]=mat.id;
      let R2;
      try{ R2=C.computeProject(G,wallsArr); }
      catch(e){ FAIL++; if(bugs.length<30) bugs.push('CRASH-PIECEMAT #'+t+' :: '+e.message); R2=null; }
      if(R2){
        const stillMain=R2.sheets.some(sh=>sh.list.some(x=>x.pk===p.pk&&x.wall===p.wall));
        chk('L140',!stillMain,`${id}: ${p.label} с индивидуальным материалом осталась в главном пуле`);
        const f=R2.fills.find(x=>x.kind==='piece'&&x.matColorId===mat.id);
        chk('L141',!!f,`${id}: не найден fill kind:'piece' для материала ${mat.id}`);
        if(f){
          const entry=f.layouts.find(x=>x.k===wi+':'+p.pk);
          chk('L142',!!entry,`${id}: в fill piece:${mat.id} нет записи для ${p.label}`);
          if(entry){
            // ЧИСТАЯ площадь (габарит минус вырез), а не отдельно габарит и отдельно вырез: когда
            // ширина полосы плитки материала (mat.pw) меньше вырезанной полосы детали, полоса,
            // целиком попавшая внутрь выреза, вообще не даёт куска (пропуск сегмента), а не «свою»
            // запись в cuts — вырез в этом случае распределяется между «пропавшей» полосой и
            // остаточной насечкой на пограничной полосе. Валовые площади поэтому законно не
            // совпадают с исходными по отдельности — совпадать обязана только их разность.
            const grossTiled=entry.L.pieces.reduce((a,pp)=>a+pp.w*pp.len,0);
            const holeTiled=entry.L.pieces.reduce((a,pp)=>a+(pp.cuts||[]).reduce((b,c)=>b+c.aw*c.bh,0),0);
            const netTiled=(grossTiled-holeTiled)/1e6;
            const holeWant=(p.cuts||[]).reduce((a,c)=>a+c.aw*c.bh,0);
            const netWant=(p.w*p.len-holeWant)/1e6;
            chk('L143',Math.abs(netTiled-netWant)<0.01,
              `${id}: замощение ${p.label} материалом ${mat.id} — чистая площадь ${netTiled.toFixed(3)} != ${netWant.toFixed(3)}`);
          }
        }
        // L144 (нов): именно в момент активного 'piece' fill'а — glueArea не задваивает его площадь
        // (см. L12); тут это гоняется по-настоящему, в отличие от базового прогона, где 'piece' fill
        // ещё не существует
        {
          const addBack=R2.fills.filter(x=>x.kind!=='piece').reduce((a,x)=>a+x.area,0);
          chk('L144',Math.abs(R2.glueArea-(R2.netArea+R2.otkosArea+addBack))<0.01,
            `${id}: glueArea при активном piece-fill ${R2.glueArea.toFixed(3)} != ${(R2.netArea+R2.otkosArea+addBack).toFixed(3)}`);
        }
      }
      wallsArr[wi].pieceMats={};
    }
  }
  // L160-162 (нов): индивидуальный материал стороны откоса (клик по линии откоса на схеме,
  // o.otkosMat[side]) — та же механика пула, что у материала детали стены, но через packOtkos.
  // Берём случайную сторону, у которой реально есть деталь откоса (режим corner/butt — иначе
  // резать нечего), назначаем ей материал из PRESETS и пересчитываем: деталь обязана уйти из
  // главного пула откосов, в R2.fills обязана появиться запись kind:'otkos' для этого материала,
  // а её деталь(и) в этом пуле — либо суммарно дать ровно номинальную площадь depth×len, либо
  // (если материал физически не подошёл, напр. глубина больше листа) попасть в R2.failed —
  // третьего не дано, площадь либо цела, либо явно потеряна и об этом сказано пользователю.
  if(rand()<0.4){
    const cands=[];
    wallsArr.forEach((w,wi)=>w.ops.forEach((o,oi)=>{
      if(!o.otkos||!(o.depth>0)) return;
      ['left','right','top','bottom'].forEach(side=>{
        if(side==='bottom'&&o.kind==='door') return;
        const m=(o.otkosMode&&o.otkosMode[side])||'corner';
        if(m==='corner'||m==='butt'||m==='protrude') cands.push({wi,oi,side,o,m});
      });
    }));
    if(cands.length){
      const c=cands[Math.floor(rand()*cands.length)];
      const opts=C.PRESETS.filter(m=>m.id!=='custom');
      const mat=opts[Math.floor(rand()*opts.length)];
      c.o.otkosMat={}; c.o.otkosMat[c.side]=mat.id;
      let R2;
      try{ R2=C.computeProject(G,wallsArr); }
      catch(e){ FAIL++; if(bugs.length<30) bugs.push('CRASH-OTKOSMAT #'+t+' :: '+e.message); R2=null; }
      if(R2){
        let base='О'+(c.oi+1)+'·'+{left:'лев',right:'прав',top:'верх',bottom:'низ'}[c.side];
        if(wallsArr.length>1) base='С'+(c.wi+1)+'·'+base;
        const nameMatch=nm=>nm===base||nm.startsWith(base+' (');
        const stillMain=R2.sheets.some(sh=>sh.otk.some(x=>nameMatch(x.name)));
        chk('L160',!stillMain,`${id}: ${base} с индивидуальным материалом осталась в главном пуле откосов`);
        const f=R2.fills.find(x=>x.kind==='otkos'&&x.matColorId===mat.id);
        chk('L161',!!f,`${id}: не найден fill kind:'otkos' для материала ${mat.id}`);
        if(f){
          // Т-стык: верх/низ «выступающий» длиннее на вылет накладки с каждого конца, где
          // соседняя лев/прав тоже «выступающая» (см. buildOtkosParts/L70)
          const sideMode=k=>(c.o.otkosMode&&c.o.otkosMode[k])||'corner';
          let nomLen=(c.side==='left'||c.side==='right')?c.o.h:c.o.w;
          if((c.side==='top'||c.side==='bottom')&&c.m==='protrude'){
            const ov=c.o.otkosOverlap||0;
            nomLen+=(sideMode('left')==='protrude'?ov:0)+(sideMode('right')==='protrude'?ov:0);
          }
          const nomDep=c.o.depth+(c.m==='protrude'?(c.o.otkosOverlap||0):0);
          const nomArea=nomDep*nomLen;
          const placedArea=f.sheets.reduce((a,sh)=>a+sh.otk.filter(x=>nameMatch(x.name))
            .reduce((b,x)=>b+(x.dw||x.dep)*(x.dh||x.len),0),0);
          const failed=R2.failed.some(x=>nameMatch(x.name));
          if(failed) chk('L162',placedArea===0,`${id}: ${base} — и failed, и частично размещена (${placedArea})`);
          else chk('L162',Math.abs(placedArea-nomArea)<1,`${id}: ${base} площадь в пуле ${placedArea} != номинальной ${nomArea}`);
        }
        // L163 (нов): при активном 'otkos' fill'е glueArea обязана его учесть (в отличие от
        // 'piece' — otkosArea в этот момент УЖЕ не включает переопределённую сторону, см. L12)
        {
          const addBack=R2.fills.filter(x=>x.kind!=='piece').reduce((a,x)=>a+x.area,0);
          chk('L163',Math.abs(R2.glueArea-(R2.netArea+R2.otkosArea+addBack))<0.01,
            `${id}: glueArea при активном otkos-fill ${R2.glueArea.toFixed(3)} != ${(R2.netArea+R2.otkosArea+addBack).toFixed(3)}`);
        }
      }
      delete c.o.otkosMat;
    }
  }
}
console.log(`\nСценариев: ${N} | проверок: ${PASS+FAIL} | провалено: ${FAIL} | падений: ${crashed}`);
bugs.slice(0,20).forEach(b=>console.log('  '+b));
