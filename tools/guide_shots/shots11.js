// План комнаты: Г-образный коридор в процессе рисования, П-образная комната, меню выступающего угла, 3D. Запуск из tools/guide_shots.
const L=require('./lib.js');
(async()=>{
 const {b,p}=await L.launch(1500);
 const px=(x,z)=>p.evaluate(([x,z])=>{ const r=document.querySelector('#plan-canvas').getBoundingClientRect(); const [a,c]=planToPx(planMap,x,z); return [r.x+a,r.y+c]; },[x,z]);
 const clickW=async(x,z)=>{ const q=await px(x,z); await p.mouse.move(q[0],q[1],{steps:5}); await p.mouse.click(q[0],q[1]); };
 const startAt=async(x,z)=>{ const q=await px(x,z); await p.mouse.move(q[0],q[1]); await p.mouse.down(); await p.mouse.up(); };
 const zoomOut=async(cx,cz,n)=>{ const q=await px(cx,cz); await p.mouse.move(q[0],q[1]); await p.mouse.wheel(0,n); await p.waitForTimeout(100); };
 await p.fill('#i-client','Квартира, коридор и гостиная'); await p.fill('#i-wname','Стена 1'); await p.fill('#i-w','6000'); await p.fill('#i-h','2600'); await p.waitForTimeout(300);
 // 1) в процессе: вторая стена протянута, резиновая линия третьей
 await p.click('#plan-draw'); await p.waitForTimeout(150);
 await startAt(6000,0); await zoomOut(3000,2000,900);
 await clickW(6000,4000);
 { const q=await px(3000,4000); await p.mouse.move(q[0],q[1],{steps:6}); }
 await p.waitForTimeout(150);
 await L.shot(p,'53_plan_draw',{el:'#plan-block',pad:8,top:100,marks:[
   {sel:'#plan-draw',n:1,at:'tl'},{sel:'[data-planend]',n:2,at:'tl',nth:0},{sel:'#plan-rubber line',n:3,at:'tr'},{sel:'#plan-hint',n:4,at:'tl'}]});
 // 2) П-образная комната целиком
 await p.keyboard.press('Escape');
 await p.evaluate(()=>{ walls=[newWall()]; cornerLinks=[]; cornerSeq=0; active=0; planDrawMode=false; planDraw=null; planAuto=true; walls[0].W=6000; walls[0].H=2600; wallToForm(); renderOpenings(); renderWallCompass(); run(); });
 await p.click('#plan-draw'); await p.waitForTimeout(150); await startAt(6000,0); await zoomOut(3000,2000,900);
 for(const [x,z] of [[6000,4000],[4000,4000],[4000,2000],[2000,2000],[2000,4000],[0,4000],[0,0]]) await clickW(x,z);
 await p.waitForTimeout(900);
 await p.mouse.move(5,5);
 await L.shot(p,'54_plan_U',{el:'#plan-block',pad:8,top:100,marks:[
   {sel:'#plan-draw',n:1,at:'tl'},{sel:'#plan-canvas g[data-cpedit]',n:2,at:'tl',nth:0,pad:1},{sel:'#plan-canvas g[data-cpedit]',n:3,at:'tr',nth:3,pad:1},
   {sel:'#plan-canvas rect[data-planvtx]',n:4,at:'tr',nth:0,pad:2},{sel:'#plan-canvas line[data-cpjump]',n:5,at:'tl',nth:7,box:false,dx:6},{sel:'#plan-rot',n:6,at:'tl'}]});
 await L.shot(p,'55_corners_list',{el:'#wall-compass',pad:14,marks:[
   {sel:'[data-cpplus]',n:1,at:'tr'},{sel:'#wall-compass [data-cpedit]',n:2,at:'tl',nth:3}]});
 // 3) меню выступающего угла
 await p.locator('#wall-compass [data-cpedit]').filter({hasText:'270'}).first().click(); await p.waitForTimeout(300);
 await L.shot(p,'56_corner_menu_270',{el:'#wall-compass',scroll:false,union:['#wall-compass','#mat-menu'],pad:10,marks:[]});
 await p.evaluate(()=>closeMatMenu());
 // 4) 3D
 await p.waitForTimeout(1200);
 await L.shot(p,'57_3d_U',{el:'#scene3d',pad:0,top:90,marks:[]});
 console.log('ошибки страницы:',p.errs.length?p.errs:'нет');
 await b.close();
})();
