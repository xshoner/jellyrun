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
   const page=await context.newPage(),errors=[],failed=[];
   page.on('pageerror',error=>errors.push(error.message));
   page.on('response',response=>{if(response.url().startsWith('http://127.0.0.1:')&&response.status()>=400)failed.push(response.url())});
   await page.addInitScript(()=>{
    window.__cropErrors=[];window.__croppedAssets=new Set();window.__loadedImages=[];window.__scoreGlyphPaints=0;
    const fill=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(...args){if(args[0]==='+777')window.__scoreGlyphPaints++;return fill.apply(this,args)};
    const NativeImage=window.Image;
    window.Image=function(...args){const im=new NativeImage(...args);window.__loadedImages.push(im);return im};
    const draw=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage=function(...args){
     const [im,x,y,w,h]=args;
     if(args.length===9&&im.sourceScaleX){
      window.__croppedAssets.add(im.src);
      if(x<0||y<0||x+w>im.naturalWidth+1||y+h>im.naturalHeight+1)window.__cropErrors.push([im.src,x,y,w,h,im.naturalWidth,im.naturalHeight]);
     }
     return draw.apply(this,args);
    };
   });
   await page.goto(`http://127.0.0.1:${server.address().port}/?test`);
   await page.waitForFunction(()=>!document.getElementById('start').disabled);
   const textures=await page.evaluate(()=>window.__loadedImages.map(im=>({url:im.src,w:im.naturalWidth,h:im.naturalHeight})));
   assert.equal(textures.length,37);
   assert.ok(textures.every(im=>im.w>0&&im.h>0&&im.url.includes('.webp?v=24')));
   assert.ok(textures.filter(im=>im.url.includes('bonus_jelly')).every(im=>im.w<=96&&im.h<=96));
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
    // Verify every optimized sheet, including individual attack animation phases.
    for(const spawn of ['spawnPirate','spawnIce','spawnBaseball','spawnBomb','spawnGoblin','spawnPortal']){
     g.start();g.soundPlayer?.setEnabled(false);g.state.nextPattern=Infinity;g.state.nextAmbient=Infinity;
     g[spawn]();g.state.buff[6]=100;
     for(let i=0;i<360;i++){g.update(1/120);if(i%12===0)g.draw()}
    }
    for(const kind of ['low','tall','tunnel','gapShort','gapLong']){g.start();g.pattern(kind,400);g.draw()}
    g.start();g.soundPlayer?.setEnabled(false);g.state.nextPattern=Infinity;g.state.nextAmbient=Infinity;
    const y=g.state.p.y;g.jump();g.update(.05);const jumped=g.state.p.y>y;
    g.state.fx=Array.from({length:20},(_,i)=>({text:'+777',color:'#fff1a3',x:300+i*10,y:300,life:1,max:1,vx:0,vy:0}));
    g.hud();for(let i=0;i<10;i++)g.draw();return {jumped,scale:g.renderer.scale,width:document.getElementById('game').width,energy:getComputedStyle(document.getElementById('energy')).width,scoreGlyphPaints:window.__scoreGlyphPaints};
   });
   assert.ok(result.jumped);assert.equal(result.scale,.5);assert.equal(result.width,640);
   assert.equal(result.scoreGlyphPaints,1,'repeated score text rasterizes once');
   await page.waitForTimeout(1500);
   await page.locator('#gamePause').click();
   const time=await page.evaluate(()=>window.__game.state.t);
   await page.waitForTimeout(250);
   assert.equal(await page.evaluate(()=>window.__game.state.t),time);
   await page.screenshot({path:path.join(process.env.TEMP||root,`jellyrun-${engine.name()}-${portrait?'portrait':'landscape'}.png`)});
   assert.deepEqual(errors,[]);
   assert.deepEqual(failed,[]);
   assert.deepEqual(await page.evaluate(()=>window.__cropErrors),[]);
   assert.ok(await page.evaluate(()=>window.__croppedAssets.size)>=9);
   console.log('PASS',engine.name(),portrait?'portrait':'landscape',JSON.stringify(result));
   await context.close();
  }}finally{await browser.close()}
 }}finally{server.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
