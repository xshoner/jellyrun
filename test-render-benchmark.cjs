// Synthetic draw submission benchmark, not a physical-device FPS measurement.
// NODE_PATH may point to an external Playwright installation.
// node test-render-benchmark.cjs [baseline-repository-directory]
const {webkit,devices}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
async function bench(root){
 const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);return res.end()}
   res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.webp':'image/webp','.png':'image/png','.mp3':'audio/mpeg'})[path.extname(file)]||'application/octet-stream');res.end(data)});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await webkit.launch();
 try{
  const context=await browser.newContext({...devices['iPhone 13'],viewport:{width:844,height:390},serviceWorkers:'block'});
  const page=await context.newPage();
  await page.addInitScript(()=>{
   const NativeImage=Image;window.__textures=[];
   window.Image=function(...args){const im=new NativeImage(...args);window.__textures.push(im);return im};
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/?test`);
  await page.waitForFunction(()=>!document.getElementById('start').disabled);
  const metrics=await page.evaluate(async()=>{
   const g=window.__game;g.start();g.soundPlayer.setEnabled(false);
   g.state.mode='paused';g.state.speech=null;g.state.pickups=[];g.state.bg=1600;
   for(let i=0;i<80;i++)g.state.pickups.push({type:'bonus',id:1+i%5,x:100+(i%20)*55,y:160+Math.floor(i/20)*90,w:54,h:54,phase:0});
   g.state.p.scale=3;g.state.buff[1]=10;g.state.buff[5]=10;g.state.buff[6]=10;
   g.state.p.burn=3;
   g.state.fx=Array.from({length:80},(_,i)=>({text:'+150',color:'#fff1a3',x:100+(i%20)*55,y:140+Math.floor(i/20)*90,life:1,max:1}));
   for(let i=0;i<30;i++)g.draw();
   const batches=[];
   for(let batch=0;batch<9;batch++){
    await new Promise(requestAnimationFrame);
    const start=performance.now();for(let i=0;i<60;i++){g.state.t+=1/60;g.draw()}
    batches.push((performance.now()-start)/60);
   }
   batches.sort((a,b)=>a-b);
   const imageEntries=performance.getEntriesByType('resource').filter(e=>/\.(png|webp)(\?|$)/.test(e.name));
   return {drawMedianMs:batches[4],drawWorstBatchMs:batches[8],imageResponseBytes:imageEntries.reduce((n,e)=>n+e.decodedBodySize,0),texturePixelBytes:window.__textures.reduce((n,im)=>n+im.naturalWidth*im.naturalHeight*4,0),images:window.__textures.length,scale:g.renderer.scale};
  });
  console.log(JSON.stringify({root,...metrics}));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
}
(async()=>{if(process.argv[2])await bench(path.resolve(process.argv[2]));await bench(__dirname)})().catch(e=>{console.error(e);process.exitCode=1});
