// Optional real-engine smoke test: npm install --no-save playwright
// npx playwright install chromium webkit; node test-browser.cjs
const {chromium,webkit,devices}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname;
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end()}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.mp3':'audio/mpeg'})[path.extname(file)]||'application/octet-stream');res.end(data)});
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{for(const engine of [chromium,webkit]){
  const browser=await engine.launch({headless:true});
  try{for(const portrait of [true,false]){
   const context=await browser.newContext({...devices['iPhone 13'],viewport:portrait?{width:390,height:844}:{width:844,height:390},serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(`http://127.0.0.1:${server.address().port}/?test`);
   await page.waitForFunction(()=>!document.getElementById('start').disabled);
   await page.locator('#start').click();
   assert.equal(await page.evaluate(()=>window.__game.renderer.scale),.75);
   const result=await page.evaluate(()=>{
    const g=window.__game;g.soundPlayer?.setEnabled(false);
    g.state.nextPattern=Infinity;g.state.nextAmbient=Infinity;
    // Exercise expensive branches at all quality levels in the real canvas engine.
    for(const scale of [0,1,2]){
     g.acquire(1);g.acquire(4);g.acquire(5);g.acquire(6);
     g.state.p.burn=3;g.spawnPirate();g.spawnIce();g.spawnBaseball();g.spawnBomb();g.spawnGoblin();g.spawnPortal();
     for(let i=0;i<90;i++){g.update(1/120);g.draw()}
     for(let i=0;i<70;i++)g.sampleRender(1000/30,20);
    }
    g.start();g.soundPlayer?.setEnabled(false);g.state.nextPattern=Infinity;g.state.nextAmbient=Infinity;
    const y=g.state.p.y;g.jump();g.update(.05);const jumped=g.state.p.y>y;
    g.hud();g.draw();return {jumped,scale:g.renderer.scale,width:document.getElementById('game').width,energy:getComputedStyle(document.getElementById('energy')).width};
   });
   assert.ok(result.jumped);assert.equal(result.scale,.5);assert.equal(result.width,640);
   await page.waitForTimeout(1500);
   await page.locator('#gamePause').click();
   const time=await page.evaluate(()=>window.__game.state.t);
   await page.waitForTimeout(250);
   assert.equal(await page.evaluate(()=>window.__game.state.t),time);
   await page.screenshot({path:path.join(process.env.TEMP||root,`jellyrun-${engine.name()}-${portrait?'portrait':'landscape'}.png`)});
   assert.deepEqual(errors,[]);
   console.log('PASS',engine.name(),portrait?'portrait':'landscape',JSON.stringify(result));
   await context.close();
  }}finally{await browser.close()}
 }}finally{server.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
