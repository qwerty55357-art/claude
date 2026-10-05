// Включение свободной расстановки стыков (вертикальных и горизонтальных) НЕ должно менять раскладку ни на
// одной стене: естественные границы/стыки превращаются в ручные с теми же позициями. Проверяем на случайных
// стенах (проёмы, откосы, изгиб, rowH, «кирпичик», симметрия, обе ориентации) и на связанных стенах с углами
// (прямой и радиусный — со срезом краёв, где ручные стыки сдвигаются). Сравнивается ПОЛНЫЙ результат
// computeProject (раскрой, листы, смета, LED), кроме признаков, которые по смыслу меняются.
// Запуск: NODE_PATH=$(npm root -g) [EQ_N=1500] node tests/free_enable_equiv.js
const {chromium}=require('playwright'); const path=require('path'); const fs=require('fs');
const HTML='file://'+path.resolve(process.env.RASKROY_HTML||path.join(__dirname,'../raskroy.html'));
const EXE=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
const N=+(process.env.EQ_N||1500);
const src=fs.readFileSync(path.join(__dirname,'../audit.js'),'utf8');
const gen=new Function('NOFREE',src.slice(src.indexOf('const base='),src.indexOf('const N='))+';return {rnd,mkWall,base};')(true);
const rand=gen.rnd(20261006), inputs=[];
for(let t=0;t<N;t++){
  const G=Object.assign({},gen.base,{pl:[2900,2500,2700][Math.floor(rand()*3)],pw:[1150,1150,600,150][Math.floor(rand()*4)],
    orient:rand()<0.3?'h':'v',sym:rand()<0.5,offcut:rand()<0.85,splice:rand()<0.4,rot:rand()<0.3,
    brick:rand()<0.6,jointV:rand()<0.85,jointH:rand()<0.9,ledMaxRun:5000});
  const nWalls=1+Math.floor(rand()*3);
  const ws=Array.from({length:nWalls},(_,i)=>Object.assign(gen.mkWall(rand),{id:i+1}));
  const links=[];
  for(let i=0;i+1<nWalls;i++) if(rand()<0.8) links.push({id:i+1,kind:['sharp','radius','radius','across'][Math.floor(rand()*4)],type:rand()<0.5?'out':'in',
    angle:rand()<0.6?90:[60,75,105,120][Math.floor(rand()*4)],radius:[0,150,300,450,600][Math.floor(rand()*5)],distance:0,flatA:0,flatB:0,aw:i+1,as:'right',bw:i+2,bs:'left'});
  inputs.push({G,ws,links,mode:['v','h','vh','vh'][Math.floor(rand()*4)]});
}
const mkW=(id,W,extra)=>Object.assign({id,W,H:2400,ceil:2700,rowH:0,ops:[],seamsU:[],seamSeq:0,vseamsU:[],vseamSeq:0,
  edges:{top:'none',bot:'none',left:'cap',right:'cap'},cout:0,cin:0,jointModes:{}},extra||{});
const corners=[
  {name:'прямой угол, две стены',walls:[mkW(1,3000),mkW(2,3700,{rowH:900})],links:[{id:1,kind:'sharp',type:'out',angle:90,aw:1,as:'right',bw:2,bs:'left'}]},
  {name:'радиусный угол (срез краёв)',walls:[mkW(1,3000,{vseamsU:[{id:1,pos:1500}],seamsU:[{id:1,pos:1000}],seamSeq:1,vseamSeq:1}),mkW(2,3700)],links:[{id:1,kind:'radius',type:'out',angle:90,radius:300,distance:0,aw:1,as:'right',bw:2,bs:'left'}]},
  {name:'радиусный угол со стенами выше листа',walls:[mkW(1,4200,{H:3200,ceil:3200}),mkW(2,4200,{H:3200,ceil:3200})],links:[{id:1,kind:'radius',type:'in',angle:90,radius:400,distance:0,aw:1,as:'right',bw:2,bs:'left'}]},
  {name:'три стены, стык-между-стенами «вдоль» и прямой угол',walls:[mkW(1,3500,{seamsU:[{id:1,pos:1200}],seamSeq:1}),mkW(2,3500,{seamsU:[{id:1,pos:1200}],seamSeq:1}),mkW(3,2800)],
   links:[{id:1,kind:'sharp',type:'out',angle:90,aw:1,as:'right',bw:2,bs:'left'},{id:2,kind:'sharp',type:'out',angle:90,aw:2,as:'right',bw:3,bs:'left'}]},
];
(async()=>{
  const b=await chromium.launch({executablePath:EXE}); const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  await p.goto(HTML); await p.waitForTimeout(500);
  const out=await p.evaluate(({inputs,corners})=>{
    const rep=(k,v)=>v instanceof Map?[...v]:(typeof v==='function'?undefined:v);
    // признаки, которые при включении свободных стыков меняются по смыслу, из сравнения убираем
    const norm=R=>JSON.stringify(R,rep);
    const diffs=[]; let checked=0, enabledV=0, enabledH=0;
    const one=(label,G,ws,links,modeV,modeH)=>{
      try{
        const wsA=JSON.parse(JSON.stringify(ws)), wsB=JSON.parse(JSON.stringify(ws));
        const R0=computeProject(G,wsA,{},JSON.parse(JSON.stringify(links)),[]);
        walls.length=0; wsB.forEach(w=>walls.push(w));
        const before=norm(R0);
        wsB.forEach((w,i)=>{ active=i; LAST={G,R:computeProject(G,JSON.parse(JSON.stringify(wsB)),{},JSON.parse(JSON.stringify(links)),[])};
          if(modeV){ const n0=(w.vseamsU||[]).length; enableVFree(w); enabledV+=(w.vseamsU.length-n0>0)?1:0; }
          if(modeH){ LAST={G,R:computeProject(G,JSON.parse(JSON.stringify(wsB)),{},JSON.parse(JSON.stringify(links)),[])}; const n0=(w.seamsU||[]).length; enableHFree(w); enabledH+=(w.seamsU.length-n0>0)?1:0; }
        });
        const R1=computeProject(G,wsB,{},JSON.parse(JSON.stringify(links)),[]);
        checked++;
        // после включения «трогаем» стыки: двигаем, добавляем новые — расчёт не должен падать, детали — не выходить за лист
        {
          let seed=checked*7919+13; const rr=()=>{ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; };
          wsB.forEach(w=>{
            (w.vseamsU||[]).forEach(sm=>{ if(rr()<0.5) sm.pos=Math.max(60,Math.min(w.W-60,sm.pos+Math.round((rr()-0.5)*600))); });
            (w.seamsU||[]).forEach(sm=>{ if(rr()<0.5){ sm.pos=Math.max(60,Math.min(w.H-60,sm.pos+Math.round((rr()-0.5)*600))); delete sm.nat; } });
            if(rr()<0.5){ w.vseamSeq=(w.vseamSeq||0)+1; (w.vseamsU=w.vseamsU||[]).push({id:w.vseamSeq+500,pos:Math.round(rr()*w.W/10)*10}); }
            if(rr()<0.5){ w.seamSeq=(w.seamSeq||0)+1; (w.seamsU=w.seamsU||[]).push({id:w.seamSeq+500,pos:Math.round(rr()*w.H/10)*10,scope:['even','odd',null][Math.floor(rr()*3)]}); }
          });
          const R2=computeProject(G,JSON.parse(JSON.stringify(wsB)),{},JSON.parse(JSON.stringify(links)),[]);
          R2.layouts.forEach((L,wi)=>{
            L.strips.forEach(st=>{ if(st.w>G.pw+0.5) diffs.push(label+' | после правки стыков полоса '+st.w+' шире листа '+G.pw+' (стена '+wi+')'); });
            L.pieces.forEach(pc=>{ if(pc.len>G.pl+0.5) diffs.push(label+' | после правки стыков деталь длиннее листа (стена '+wi+')'); });
          });
        }
        const after=norm(R1);
        if(before!==after){
          // найдём первое расхождение по ключам верхнего уровня
          const a=JSON.parse(before), c=JSON.parse(after), keys=Object.keys(a).filter(k=>JSON.stringify(a[k])!==JSON.stringify(c[k]));
          diffs.push(label+' | различаются: '+keys.join(','));
        }
      }catch(e){ diffs.push(label+' | ИСКЛЮЧЕНИЕ '+e.message); }
    };
    inputs.forEach((inp,i)=>one('#'+i+' '+inp.mode+' '+inp.G.orient+(inp.G.brick?' brick':'')+(inp.G.sym?' sym':'')+' стен:'+inp.ws.length+' углов:'+inp.links.length,inp.G,inp.ws,inp.links,inp.mode.includes('v'),inp.mode.includes('h')));
    const G0=Object.assign({},inputs[0].G,{orient:'v',sym:false,brick:false,pl:2900,pw:1150});
    corners.forEach(c=>[{v:1,h:0},{v:0,h:1},{v:1,h:1}].forEach(m=>[true,false].forEach(sym=>[true,false].forEach(brick=>{
      one(c.name+' V'+m.v+'H'+m.h+(sym?' sym':'')+(brick?' brick':''),Object.assign({},G0,{sym,brick}),c.walls,c.links,m.v,m.h);
    }))));
    return {diffs,checked,enabledV,enabledH};
  },{inputs,corners});
  await b.close();
  console.log(`проверено случаев: ${out.checked} | стен, где реально появились ручные вертикальные/горизонтальные стыки: ${out.enabledV}/${out.enabledH} | расхождений: ${out.diffs.length} | ошибок страницы: ${errs.length}`);
  out.diffs.slice(0,15).forEach(x=>console.log('  '+x)); errs.slice(0,3).forEach(x=>console.log('  ERR '+x));
  process.exit(out.diffs.length||errs.length?1:0);
})();
