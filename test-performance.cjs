const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const drawCalls=[];const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{style:{},classList:{add(){},remove(){}},addEventListener(){},getContext(){return new Proxy({drawImage(...args){drawCalls.push(args)},measureText(t){return {width:t.length*16}},createLinearGradient(){return {addColorStop(){}}},createRadialGradient(){return {addColorStop(){}}}},{get(t,p){return t[p]||(()=>{})}})}});return elements.get(id)};
const math=Object.create(Math);const sandbox={document:{getElementById:element,querySelector:element,addEventListener(){}},window:{addEventListener(){}},location:{search:'?test'},URLSearchParams,Image:class{set src(v){v=v.replace(/^optimized\//,'').replace('bg_image/optimized/','bg_image/').replace('.webp','.png');this.path=v;this.width=v.startsWith('barrier4')||v.startsWith('barrier5')?1774:v.startsWith('main character_1')?1397:1983;this.height=v.startsWith('barrier4')||v.startsWith('barrier5')?887:v.startsWith('main character_1')?341:793;this.onload()}},localStorage:{getItem(){return null},setItem(){}},requestAnimationFrame(){},Math:math,console};

let paints=0,hudWrites=0;
sandbox.document.createElement=()=>({getContext:()=>({drawImage(){},globalAlpha:1})});
const originalContext=element('game').getContext();
originalContext.clearRect=()=>paints++;
element('game').getContext=()=>originalContext;
Object.defineProperty(element('score'),'textContent',{set(){hudWrites++}});
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('game.js','utf8').replace('get state(){return s},','frame,bg,get state(){return s},'),sandbox);
(async()=>{
 await new Promise(setImmediate);const g=sandbox.window.__game;
 let max=0;
 for(let offset=0;offset<18*(720*1983/793-140);offset+=47){g.state.bg=offset;drawCalls.length=0;g.bg();max=Math.max(max,drawCalls.length);assert.ok(drawCalls.length<=4)}
 console.log('PASS background draws per frame: at most '+max+' (previously 88)');
 let now=1000;
 for(const hz of [60,90,120,144]){
  g.start();g.state.nextPattern=Infinity;g.state.nextAmbient=Infinity;g.frame(now);paints=0;hudWrites=0;const before=g.state.t;
  for(let i=0;i<hz*2;i++){now+=1000/hz;g.frame(now)}
  assert.ok(paints>=117&&paints<=122,`${hz}Hz: ${paints} paints`);
  assert.ok(hudWrites<=21);assert.ok(Math.abs(g.state.t-before-2)<.01);
  console.log(`PASS ${hz}Hz: ${paints} paints / 2s; physics elapsed 2s; HUD writes ${hudWrites}`);
 }
 g.pause();g.frame(now+=20);paints=0;for(let i=0;i<120;i++)g.frame(now+=1000/120);assert.equal(paints,0);
 sandbox.document.hidden=true;hudWrites=0;for(let i=0;i<120;i++)g.frame(now+=1000/120);assert.equal(paints,0);assert.equal(hudWrites,0);
 sandbox.document.hidden=false;g.start();g.state.pickups=[{type:'jelly',id:1,x:2000,y:500,w:30,h:30}];drawCalls.length=0;g.draw();assert.ok(!drawCalls.some(a=>a[0].path?.startsWith('jelly/')));
 console.log('PASS paused/hidden rendering and offscreen pickup culling');
 g.start();const before=g.state.t;
 for(let i=0;i<120;i++)g.sampleRender(1000/60,2);
 assert.equal(g.renderer.scale,1,'healthy rendering retains full resolution');
 for(let i=0;i<70;i++)g.sampleRender(1000/30,20);
 assert.equal(g.renderer.scale,.875);
 assert.equal(g.renderer.cheapEffects,true);
 for(let i=0;i<600;i++)g.sampleRender(1000/30,20);
 assert.equal(g.renderer.scale,.5,'resolution has a readable lower bound');
 g.draw();assert.equal(element('game').width,640);assert.equal(element('game').height,360);
 assert.equal(g.state.t,before,'quality changes cannot change simulation time');
 for(let i=0;i<100;i++)g.acquire(1);
 assert.ok(g.state.fx.filter(f=>!f.text).length<=120,'burst particles remain bounded');
 g.draw();
 console.log('PASS sustained load adaptation, fixed physics and bounded particles');
 g.start();g.pattern('slide2');const tunnel=g.state.obstacles[0],tiles=g.tunnelTiles(tunnel),first=tiles[0];
 tunnel.x-=100;tunnel.w+=20;
 assert.equal(g.tunnelTiles(tunnel),tiles);assert.equal(tiles[0],first);assert.equal(first.x,tunnel.x);
 assert.ok(Math.abs(tiles.at(-1).x+tiles.at(-1).w-(tunnel.x+tunnel.w))<1e-8);
 const effects=g.state.fx;g.acquire(1);g.update(1/120);assert.equal(g.state.fx,effects);
 console.log('PASS tunnel geometry and particle storage are reused without stale positions');
})().catch(e=>{console.error(e);process.exitCode=1});
