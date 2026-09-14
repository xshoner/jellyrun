'use strict';
(() => {
const $=id=>document.getElementById(id), canvas=$('game'),ctx=canvas.getContext('2d');
const W=1280,H=720,GROUND=610,CELL=120,GRAVITY=2100,FALL_MULTIPLIER=1.15,JUMP_HEIGHT=CELL*2.2*.7,JUMP=Math.sqrt(2*GRAVITY*JUMP_HEIGHT),BASE_SPEED=340;
const ICE_PREPARE=2.5,ICE_LASER=1.5,ICE_RECOVER=.35,FREEZE_SECONDS=3;
const BACKGROUND_ROUTE=['bg1','bg2','bg3','bg4','bg5','bg6','bg7','bg8','bg9','bg1','bg2','bg3alt','bg4','bg5','bg6','bg7','bg8','bg9'];
const BOMB_BASE=150,BOMB_SCALE=1.8,BOMB_TRIGGER_TIME=.62,TRAP_HEIGHT=100,TRAP_DROP=.3;
const names=['','보호막','에너지 충전','부활 준비','자석','스피드','거대화'];
const effectDescriptions=['','15초간 보호막 · 피해 1회 방어!','에너지 30% 즉시 회복!','쓰러지면 에너지 10%로 부활!','10초간 주변 젤리 자동 수집!','8초간 무적! 이동 속도 3배','10초간 무적! 몸집이 3배로'];
const speechLines=['늦었다! 에고..','오늘도 지각인가','바쁘다, 바빠','이 정도 쯤이야!'];
const colors=['','#83e8ff','#86ff96','#ffc8ff','#ff98d6','#fff1a0','#c7a1ff'];
const schedule=[null,{interval:20,chance:.6},{interval:25,chance:.4,guarantee:60},{interval:120,chance:.8,guarantee:240},{interval:17,chance:.7},{interval:30,chance:.6},{interval:40,chance:.65}];
const assets={};let s,ready=false,slideHeld=false,last=0,accumulator=0,audio=null,sound=true,decor=0;
const soundPlayer=typeof window.GameAudio==='function'?new window.GameAudio():null;
function playSfx(key,options){soundPlayer?.effect(key,options)}
function deathAudio(){soundPlayer?.endRun('death')}
let best=0;try{best=Number(localStorage.getItem('jelly-dash-best'))||0}catch{} $('best').textContent=best.toLocaleString();
const rand=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function load(key,path){return new Promise((resolve,reject)=>{let im=new Image();im.onload=()=>{assets[key]=im;resolve()};im.onerror=()=>reject(new Error(path));im.src=path})}
function fresh(){return {mode:'ready',t:0,score:0,jellyScore:0,meters:0,jellies:0,stage:1,speed:BASE_SPEED,distance:0,bg:0,energy:100,p:{x:220,y:0,vy:0,jumps:0,scale:1,anim:0,hit:0,blink:0,inv:0,land:0,coyote:0,falling:false,frozen:0,frozenPose:null,panic:0,burn:0,burnTick:0},buff:{1:0,4:0,5:0,6:0},revive:false,fx:[],gaps:[],patternBag:[],lastPattern:null,obstacles:[],pickups:[],nextPattern:1.5,nextItems:schedule.map(v=>v?.interval||0),nextGuarantees:schedule.map(v=>v?.guarantee||Infinity),toast:0,death:0,shake:0,heal:0,resurrection:0,particleTimer:0,nextSpeech:25,speech:null,itemNotice:null,pirates:[],projectiles:[],nextPirate:30,nextPirateGuarantee:120,iceMonsters:[],batters:[],baseballs:[],bombs:[],nextBomb:13,pendingBomb:false,nextBaseball:20,nextBaseballGuarantee:150,pendingBaseball:false,encounterQueue:[],nextAmbient:68,nextIce:40,pendingIce:false,pendingPirate:false,encounterUntil:0,lastShout:-10,goblins:[],nextGoblin:17,pendingGoblin:false,nextPortal:90,portal:null,pendingPortal:false,nextBonusJelly:30,bonus:null,bonusSeconds:0,destroyScore:0,giantEffectPending:false}}
s=fresh();
function tone(freq=600,duration=.08){if(!sound||soundPlayer?.master===0)return;try{audio ||=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.setValueAtTime(freq,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(freq*.65,audio.currentTime+duration);gain.gain.setValueAtTime(.055*(soundPlayer?.master??1),audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);osc.connect(gain).connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration)}catch{}}
function toast(text){$('toast').textContent=text;s.toast=2.5;$('toast').style.opacity=1}
function burst(x,y,color,n=20){for(let i=0;i<n;i++)s.fx.push({x,y,vx:rand(-160,160),vy:rand(-230,60),life:rand(.35,.8),max:.8,color,r:rand(2,6)})}
function floating(text,x,y,color){s.fx.push({text,x,y,vx:0,vy:-65,life:1,max:1,color})}
function blink(){s.p.blink=.9}
let fullscreenSession=false,fullscreenNative=false;
const embeddedGame=!!window.parent&&window.parent!==window;
function notifyEmbeddedDisplay(mode){
 if(embeddedGame)window.parent.postMessage({type:'jellyrun:display',mode},'*');
}
async function lockLandscape(){
 if(embeddedGame){
  fullscreenSession=false;document.body.classList.add('embedded-game');document.body.classList.add('game-active');
  notifyEmbeddedDisplay('playing');return;
 }
 if(globalThis.matchMedia?.('(hover: hover) and (pointer: fine)').matches){
  fullscreenSession=false;document.body?.classList?.add('game-active');document.body?.classList?.add('desktop-game');return;
 }
 fullscreenSession=true;document.body?.classList?.add('game-active');
 try{if(globalThis.history&&!history.state?.jellyrunFullscreen)history.pushState({...history.state,jellyrunFullscreen:true},'')}catch{}
 try{if(!document.fullscreenElement)await document.documentElement?.requestFullscreen?.({navigationUI:'hide'});if(fullscreenSession&&globalThis.matchMedia?.('(max-width: 1000px)').matches)await globalThis.screen?.orientation?.lock?.('landscape')}catch{}
}
function unlockLandscape(fromPop=false){
 fullscreenSession=false;fullscreenNative=false;document.body?.classList?.remove('game-active');document.body?.classList?.remove('desktop-game');
 if(embeddedGame){notifyEmbeddedDisplay('lobby');return;}
 try{globalThis.screen?.orientation?.unlock?.()}catch{}
 if(document.fullscreenElement)document.exitFullscreen?.().catch?.(()=>{});
 try{if(!fromPop&&globalThis.history?.state?.jellyrunFullscreen)history.back()}catch{}
}
function returnToApp(fromPop=false){if(s.mode==='running')pause();unlockLandscape(fromPop)}
document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement){fullscreenNative=true}else if(fullscreenNative&&fullscreenSession)returnToApp()});
window.addEventListener('popstate',()=>{if(fullscreenSession)returnToApp(true)});
function start(){if(!ready)return;s=fresh();s.mode='running';slideHeld=false;accumulator=0;$('overlay').classList.add('hidden');$('overlay').classList.remove('game-over');$('toast').style.opacity=0;document.querySelector('.arena').classList.add('playing');$('pause').disabled=false;$('pause').textContent='Ⅱ 일시정지';document.querySelector('.live').textContent='● NOW RUNNING';soundPlayer?.startRun();lockLandscape();hud()}
function pause(){if(!['running','paused'].includes(s.mode))return;slideHeld=false;if(s.mode==='running'){s.mode='paused';soundPlayer?.pause();audio?.suspend?.();panel('잠깐,<br><em>쉬어가기.</em>','모험은 여기서 기다릴게요.','계속 달리기 →','TAKE A BREATHER');$('pause').textContent='▶ 계속하기'}else{s.mode='running';soundPlayer?.resume();audio?.resume?.();$('overlay').classList.add('hidden');$('pause').textContent='Ⅱ 일시정지'}}
function panel(title,desc,button,eyebrow){$('title').innerHTML=title;$('description').textContent=desc;$('start').textContent=button;$('eyebrow').textContent=eyebrow;$('overlay').classList.remove('hidden');document.querySelector('.hero').style.display='none'}
function finish(){s.mode='over';soundPlayer?.endRun('gameOver');unlockLandscape();s.shake=0;s.itemNotice=null;s.speech=null;$('toast').style.opacity=0;$('overlay').classList.add('game-over');best=Math.max(best,s.score);try{localStorage.setItem('jelly-dash-best',String(best))}catch{}$('best').textContent=best.toLocaleString();$('pause').disabled=true;document.querySelector('.arena').classList.remove('playing');panel(`<span class="result-label">FINAL SCORE</span><em class="result-score">${s.score.toLocaleString()}</em><span class="result-unit">POINTS</span>`,`${s.meters.toLocaleString()}m · 젤리 ${s.jellyScore.toLocaleString()}점 · 파괴 ${s.destroyScore.toLocaleString()}점 · ${formatTime(s.t+s.bonusSeconds)}`,'한 번 더 달리기 →','EVERY RUN IS A NEW ADVENTURE');document.querySelector('.live').textContent='● RUN COMPLETE';if(typeof CustomEvent==='function')window.dispatchEvent?.(new CustomEvent('jellyrun:finished',{detail:{score:s.score,distance:s.meters,seconds:s.t+s.bonusSeconds,time:formatTime(s.t+s.bonusSeconds)}}))}
function jump(){if(s.mode!=='running'||(s.bonus&&s.bonus.phase!=='active'))return;const p=s.p;if(p.frozen>0||p.panic>0||p.jumps>=2||p.y< -85)return;if(p.coyote>0)p.jumps=0;p.coyote=0;p.falling=false;p.vy=JUMP;p.jumps++;p.anim=0;p.land=0;playSfx('jump',{channel:'jump',limit:.4});burst(p.x,GROUND-p.y-8,'#e6ffb0',12)}
function sliding(){return s.p.frozen<=0 && s.p.panic<=0 && slideHeld && s.p.y>=0 && s.p.y<1 && s.p.jumps===0 && s.p.hit<=0}
function beginSlide(){if(!slideHeld&&s.mode==='running'&&s.p.frozen<=0&&s.p.panic<=0){slideHeld=true;playSfx('slide',{channel:'slide',limit:.8})}}
function endSlide(){slideHeld=false}
function box(){const p=s.p,k=p.scale,sl=sliding();return {x:p.x-33*k,y:GROUND-p.y-(sl?48:96)*k,w:66*k,h:(sl?44:90)*k}}
function overlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
function jellyType(){const r=Math.random()*1.3;return r<1?1:r<1.25?2:3}
function pickup(type,id,x,y){const size=type==='bonus'?54:type==='item'?48:id===3?60:30;s.pickups.push({type,id,x,y,w:size,h:size,phase:rand(0,6)})}
// Predict world travel including known stage changes and the current speed buff ending.
function travelDistance(from,to){let distance=0;for(let t=from;t<to;){const boostEnd=s.t+s.buff[5],edge=Math.min(to,(Math.floor(t/45)+1)*45,boostEnd>t+1e-7?boostEnd:Infinity);const speed=BASE_SPEED*Math.pow(1.13,Math.floor(t/45))*(t<boostEnd-1e-7?3:1);distance+=(edge-t)*speed;t=edge}return distance}
function nextPatternType(){
 if(s.t<5)return 'low';
 if(!s.patternBag.length){s.patternBag=['low','row','stack','tall','zigzag','air','slide2','slide3','combo','gapShort','gapLong','tunnel'];for(let i=s.patternBag.length-1;i>0;i--){const j=Math.floor(rand(0,i+1));[s.patternBag[i],s.patternBag[j]]=[s.patternBag[j],s.patternBag[i]]}}
 const slides=['air','slide2','slide3','tunnel'];let i=s.patternBag.findIndex(type=>type!==s.lastPattern&&!(slides.includes(type)&&slides.includes(s.lastPattern)));if(i<0)i=0;const selected=s.patternBag.splice(i,1)[0];if(['slide2','slide3','tunnel'].includes(selected)&&Math.random()<.3)return ['low','row','stack'][Math.floor(rand(0,3))];return selected;
}
function pattern(forced,origin=W+130){
 const x=origin,type=forced||nextPatternType();s.lastPattern=type;
 const skin=Math.floor(rand(0,8));let width=86,height=76;
 const add=(type,x,y,w,h,skin)=>s.obstacles.push({x,y,w,h,type,skin,hit:false});
 if(type==='row'){const count=2+Math.floor(rand(0,2));width=count*78-10;for(let i=0;i<count;i++)add('low',x+i*78,GROUND-76,68,76,(skin+i)%8)}
 else if(type==='stack'){const count=2+Math.floor(rand(0,3));height=count*68;width=78;for(let i=0;i<count;i++){add('low',x,GROUND-(i+1)*68,78,68,(skin+i)%8);s.obstacles.at(-1).stack=count}}
 else if(['tunnel','slide2','slide3'].includes(type)){
  const duration=type==='slide2'?2:type==='slide3'?3:5;let arrival=s.t+(x-(s.p.x+33))/s.speed;for(let i=0;i<4;i++)arrival+=(x-(s.p.x+33)-travelDistance(s.t,arrival))/s.speed;
  width=Math.max(160,travelDistance(arrival,arrival+duration)-66);height=GROUND-68;s.obstacles.push({x,y:0,w:width,h:height,type:'tunnel',skin,hit:false,until:null,duration});
  const recovery=Math.max(300,travelDistance(arrival+duration,arrival+duration+1.45)),count=Math.random()<.5?1:2;for(let i=0;i<count;i++)add('low',x+width+recovery+i*78,GROUND-76,68,76,(skin+i+1)%8);width+=recovery+(count-1)*78+68;
  toast(`↓ ${duration}초 슬라이딩 · 끝나면 점프 준비!`);
 }
 else if(type==='combo'){
  const spacing=Math.max(340,s.speed*1.35),slideFirst=Math.random()<.5;
  for(let i=0;i<3;i++){const air=(i%2===0)===slideFirst;add(air?'air':'low',x+i*spacing,GROUND-(air?178:76),86,air?110:76,(skin+i)%8);for(let j=0;j<3;j++)pickup('jelly',jellyType(),x+i*spacing+j*42,GROUND-(air?29:155))}width=spacing*2+86;
 }
 else if(type==='zigzag'){
  const spacing=Math.max(260,s.speed*1.05);width=spacing*2+82;for(let i=0;i<3;i++){const air=i===1;add(air?'air':'low',x+i*spacing,GROUND-(air?178:76),82,air?110:76,(skin+i*3)%8)}
 }
 else if(type==='gapShort'||type==='gapLong'){
  // Use ordinary stage speed, excluding boosts: a boost expiring must not leave an impossible gap.
  const arrival=s.t+(x-s.p.x)/s.speed,normalSpeed=BASE_SPEED*Math.pow(1.13,Math.floor(arrival/45)),flight=type==='gapLong'?1.02:.52;
  width=normalSpeed*flight;s.gaps.push({x,w:width,kind:type==='gapLong'?'double':'single',trapActive:false,trapSoundPlayed:false,avoided:false});
  for(let i=0;i<9;i++)pickup('jelly',jellyType(),x-65+i*(width+130)/8,GROUND-65-Math.sin(i/8*Math.PI)*(type==='gapLong'?230:120));
 }
 else {height=type==='air'?110:type==='tall'?132:76;width=type==='tall'?82:86;add(type,x,type==='air'?GROUND-178:GROUND-height,width,height,skin)}
 if(!['tunnel','slide2','slide3','combo','gapShort','gapLong'].includes(type)){const count=type==='row'?10:8;for(let i=0;i<count;i++){const px=x-180+i*(width+330)/(count-1),arc=Math.sin(i/(count-1)*Math.PI);pickup('jelly',jellyType(),px,GROUND-(type==='air'?29:58+arc*Math.min(height+70,JUMP_HEIGHT*2-35)))}}
 const recovery=Math.max(1.35,1.9-(s.stage-1)*.055);s.nextPattern=s.t+(x-(W+130)+width)/s.speed+recovery;
}
function gapBelow(){return s.gaps.find(g=>s.p.x>g.x+10&&s.p.x<g.x+g.w-10)}
function maybeShout(){if(s.mode!=='running'||s.t-s.lastShout<.8||Math.random()>=.5)return false;s.lastShout=s.t;playSfx('shout'+(1+Math.floor(Math.random()*5)),{channel:'shout',limit:2});return true}
function fallIntoGap(){
 const p=s.p;if(s.revive){s.revive=false;s.p.panic=0;s.p.burn=0;s.p.burnTick=0;thawPlayer();s.energy=10;s.resurrection=1.6;p.inv=2;p.y=0;p.vy=0;p.jumps=0;p.falling=false;p.coyote=0;blink();s.gaps=s.gaps.filter(g=>g.x>s.p.x+250||g.x+g.w<s.p.x-80);s.obstacles=s.obstacles.filter(o=>o.x>s.p.x+250||o.x+o.w<s.p.x-80);s.nextPattern=Math.max(s.nextPattern,s.t+1.5);toast('부활! 안전한 길로 돌아왔어요');burst(p.x,GROUND-60,'#ffc8ff',45)}
 else{s.energy=0;s.p.frozen=0;s.p.frozenPose=null;s.p.panic=0;s.mode='dying';deathAudio();s.death=.75;s.shake=0;p.blink=0;p.hit=0;p.falling=true;slideHeld=false;$('pause').disabled=true;toast('낭떠러지! 다음에는 끝까지 점프해 보세요')}
}
function updateGround(dt){
 for(const gap of s.gaps){if(gap.trapActive)gap.trapAge=(gap.trapAge||0)+dt;gap.x-=s.speed*dt;const seconds=(gap.x-s.p.x)/Math.max(1,s.speed);if(!gap.trapActive&&seconds<=1&&gap.x+gap.w>s.p.x){gap.trapActive=true;gap.trapAge=0;if(!gap.trapSoundPlayed){gap.trapSoundPlayed=true;playSfx(gap.kind==='double'?'trapDouble':'trapSingle',{channel:'trap',limit:1.5})}}if(!gap.avoided&&gap.x+gap.w<s.p.x){gap.avoided=true;maybeShout()}}s.gaps=s.gaps.filter(g=>g.x+g.w>-100);
 const p=s.p;if(p.frozen>0||p.panic>0)return;const gap=gapBelow(),bridge=s.buff[5]>0||s.buff[6]>0;
 if(bridge&&p.y<=0&&p.vy<=0){p.y=0;p.vy=0;p.jumps=0;p.falling=false;p.coyote=0;return}
 if(gap&&!bridge&&p.jumps===0){p.jumps=1;p.vy=0;p.coyote=.09;p.falling=true}
 p.coyote=Math.max(0,p.coyote-dt);
 if(p.jumps>0){advanceJump(p,dt);if(p.y<=0){if(gap&&!bridge){p.falling=true;if(p.y< -135)fallIntoGap()}else if(p.y> -28){p.y=0;p.vy=0;p.jumps=0;p.falling=false;p.coyote=0;p.land=.13;burst(p.x,GROUND-4,'#d9e8c5',10)}else{p.falling=true;fallIntoGap()}}}
}
function spawnItem(id){let x=W+80;for(const o of [...s.obstacles,...s.gaps]){if(x>o.x-160&&x<o.x+o.w+160)x=o.x+o.w+190}for(const q of s.pickups){if(q.type==='item'&&Math.abs(q.x-x)<100)x=q.x+110}pickup('item',id,x,GROUND-75)}
function advanceJump(p,dt){let rest=dt;if(p.vy>0){const rise=Math.min(rest,p.vy/GRAVITY);p.y+=p.vy*rise-GRAVITY*rise*rise/2;p.vy=Math.max(0,p.vy-GRAVITY*rise);rest-=rise}if(rest>0){const gravity=GRAVITY*FALL_MULTIPLIER**2;p.y+=p.vy*rest-gravity*rest*rest/2;p.vy-=gravity*rest}}
function fire(pirate){const pb=box();s.projectiles.push({x:pirate.x-85,y:pb.y+pb.h/2,w:42,h:28,hit:false,age:0});pirate.lastShot=s.t;pirate.shots++;pirate.nextShot=s.t+.34;burst(pirate.x-70,GROUND-85,'#ffae4a',12);playSfx('pirateFire',{channel:'pirateFire',limit:.33})}
function spawnPirate(){if(!canStartEncounter()){requestEncounter('pirate');return false}
 // Wait for the existing lane to clear; never remove visible world objects.
 s.encounterUntil=s.t+4;s.nextPattern=Math.max(s.nextPattern,s.encounterUntil+.8);
 const pirate={x:W-125,y:GROUND-145,w:100,h:145,phase:'attack',hit:false,spawn:s.t,maxShots:Math.random()<.3?4:3,shots:0,nextShot:s.t,lastShot:s.t};s.pirates.push(pirate);playSfx('pirateIntro',{channel:'pirateIntro',limit:2.5});playSfx('pirateAttack',{channel:'pirateAttack',limit:.3});fire(pirate);toast(`해적왕 등장! 불꽃 ${pirate.maxShots}연발 · 피해 40%`);
}
function updatePirates(dt){let spawn=false;if(s.t>=s.nextPirate){s.nextPirate+=30;spawn=Math.random()<.75}if(s.t>=s.nextPirateGuarantee){s.nextPirateGuarantee+=120;spawn=true}if(spawn)requestEncounter('pirate');
 for(const m of s.pirates){
  if(m.shots<m.maxShots&&s.t>=m.nextShot)fire(m);
  if(m.phase==='attack'&&m.shots===m.maxShots&&s.t-m.lastShot>=.42){m.phase='obstacle';toast('해적왕을 뛰어넘으세요! SPACE · 점프')}
  if(m.phase==='obstacle'){const previous=m.x;m.x-=s.speed*dt;const body={x:m.x-40,y:GROUND-138,w:previous-m.x+80,h:135};if(overlap(box(),body))damage(m,25)}
 }

 const pb=box();for(const f of s.projectiles){const previous=f.x;f.x-=s.speed*2*dt;f.age+=dt;const swept={x:f.x-f.w/2,y:f.y-f.h/2,w:previous-f.x+f.w,h:f.h};if(overlap(pb,swept)){hitPirateFire(f);f.destroyed=true;if(s.mode!=='running')break}else if(!f.avoided&&f.x+f.w/2<pb.x){f.avoided=true;maybeShout()}}
 s.projectiles=s.projectiles.filter(f=>f.x>-100&&!f.destroyed);s.pirates=s.pirates.filter(m=>m.x+130>-100&&!m.destroyed);
}
function thawPlayer(){const p=s.p;if(p.frozen>0||p.frozenPose){p.frozen=0;p.frozenPose=null;burst(p.x,GROUND-p.y-55*p.scale,'#a7f5ff',32);toast('얼음이 깨졌어요! 다시 달려요');tone(980,.14)}}
function freezePlayer(m){
 const p=s.p;if(m.freezeApplied||p.frozen>0||p.inv>0||s.buff[5]>0||s.buff[6]>0)return;
 m.freezeApplied=true;
 if(s.buff[1]>0){s.buff[1]=0;blink();burst(p.x,GROUND-p.y-60,'#9ff2ff',30);toast('보호막이 아이스 레이저를 막았어요!');return}
 p.frozenPose=p.jumps?{row:1,col:p.vy>180?0:p.vy> -260?1:2}:sliding()?{row:2,col:0}:{row:0,col:Math.floor(p.anim*11)%4};
 p.frozen=FREEZE_SECONDS;playSfx('frozen',{channel:'frozen',limit:3});slideHeld=false;burst(p.x,GROUND-p.y-60,'#8ceaff',35);toast('빙결! 3초간 움직일 수 없어요');tone(190,.25);
}
function spawnIce(){if(!canStartEncounter()){requestEncounter('ice');return false}
 // Existing obstacles and pickups keep scrolling while the encounter waits.
 s.encounterUntil=s.t+ICE_PREPARE+ICE_LASER;
 s.nextPattern=Math.max(s.nextPattern,s.encounterUntil+1);
 const m={x:W-125,y:GROUND-145,w:100,h:145,spawn:s.t,phase:'prepare',laserStart:s.t+ICE_PREPARE,laserEnd:s.t+ICE_PREPARE+ICE_LASER,freezeApplied:false,hit:false,followup:false};
 s.iceMonsters.push(m);playSfx('iceIntro',{channel:'iceIntro'});playSfx('iceAim',{channel:'ice',limit:ICE_PREPARE/2});toast('점프로 피한다');
}
// The visible beam lasts 1.5s; its harmless charge/fade shoulders leave a jumpable 1.23s core.
function iceBeamActive(m){const age=s.t-m.laserStart;return m.phase==='laser'&&age>=.12-1e-8&&age<ICE_LASER-.15-1e-8}
function updateIce(dt){
 if(s.t>=s.nextIce){s.nextIce+=40;if(Math.random()<.8)requestEncounter('ice')}
 for(const m of s.iceMonsters){
  if(!m.chargeSound&&s.t>=m.spawn+ICE_PREPARE/2&&s.t<m.laserStart){m.chargeSound=true;playSfx('iceCharge',{channel:'ice',limit:ICE_PREPARE/2})}
  if(s.t>=m.laserStart&&s.t<m.laserEnd){if(m.phase!=='laser')playSfx('iceFire',{channel:'ice',limit:ICE_LASER});m.phase='laser'}
  if(s.t>=m.laserEnd&&s.t<m.laserEnd+ICE_RECOVER){if(!m.avoidChecked){m.avoidChecked=true;if(!m.freezeApplied)maybeShout()}m.phase='recover'}
  const count=iceCountdown(m);if(count&&count!==m.lastCount){m.lastCount=count;tone(count==='Bang!!'?1100:500,.1)}
  if(iceBeamActive(m)&&overlap(box(),{x:0,y:GROUND-88,w:m.x-65,h:36}))freezePlayer(m);
  if(s.t>=m.laserEnd+ICE_RECOVER){
   m.phase='obstacle';
   if(!m.followup){m.followup=true;s.nextPattern=Math.max(s.nextPattern,s.t+1)}
   const previous=m.x;m.x-=s.speed*dt;if(overlap(box(),{x:m.x-38,y:GROUND-137,w:previous-m.x+76,h:134}))damage(m,25);
  }
 }
 s.iceMonsters=s.iceMonsters.filter(m=>m.x+140> -100&&!m.destroyed);if(!s.iceMonsters.length)soundPlayer?.stopChannel('iceIntro');
}
function hasSpecialMonster(){return s.pirates.length>0||s.iceMonsters.length>0||s.batters.length>0||s.projectiles.length>0||s.baseballs.length>0||s.goblins.length>0}
function canStartEncounter(){return !s.bonus&&!s.portal&&!hasSpecialMonster()&&s.bombs.length===0&&!s.obstacles.some(o=>!o.destroyed&&o.x+o.w>s.p.x-100)&&!s.gaps.some(o=>o.x+o.w>s.p.x-100)}
function requestEncounter(kind){const flag={pirate:'pendingPirate',ice:'pendingIce',baseball:'pendingBaseball',goblin:'pendingGoblin'}[kind];s[flag]=true;if(!s.encounterQueue.includes(kind))s.encounterQueue.push(kind)}
function processEncounters(){if(s.pendingPortal||!canStartEncounter()||s.p.frozen>0||s.p.panic>0||!s.encounterQueue.length)return;const kind=s.encounterQueue.shift();s[{pirate:'pendingPirate',ice:'pendingIce',baseball:'pendingBaseball',goblin:'pendingGoblin'}[kind]]=false;if(kind==='pirate')spawnPirate();else if(kind==='ice')spawnIce();else if(kind==='goblin')spawnGoblin();else spawnBaseball()}
function iceCountdown(m){if(m.phase==='prepare')return String(clamp(Math.ceil((m.laserStart-s.t)/(ICE_PREPARE/3)),1,3));return m.phase==='laser'&&s.t-m.laserStart<.45?'Bang!!':''}
function spawnBaseball(){
 if(!canStartEncounter()){requestEncounter('baseball');return false}
 s.encounterUntil=s.t+2;s.nextPattern=Math.max(s.nextPattern,s.encounterUntil+1);
 s.batters.push({x:W-125,y:GROUND-155,w:90,h:155,spawn:s.t,phase:'prepare',fired:false,shots:0,maxShots:Math.random()<.3?2:1,nextShot:s.t+.65,hit:false});playSfx('baseballIntro',{channel:'baseballIntro',limit:2.5});toast('야구선수 등장! 공을 피하세요 · 피해 40% / 경직 1.5초');tone(620,.16);
}
function fireBaseball(m){const pb=box(),x=m.x-100,y=GROUND-83,dx=s.p.x-x,dy=pb.y+pb.h/2-y,d=Math.hypot(dx,dy);m.fired=true;m.shots++;m.nextShot=s.t+.38;m.phase='swing';m.swingStart=s.t;s.baseballs.push({x,y,w:64,h:64,dx:dx/d,dy:dy/d,age:0,hit:false});burst(x,y,'#ffe5a0',26);soundPlayer?.sequence(['baseballHit','baseballFlight'],{channel:'baseball-'+m.shots,limits:[.16,.65]})}
function hitPirateFire(f){const p=s.p,unprotected=!f.hit&&!f.destroyed&&p.inv<=0&&s.buff[1]<=0&&s.buff[5]<=0&&s.buff[6]<=0,hadRevive=s.revive;damage(f,30);if(unprotected&&s.mode==='running'&&!(hadRevive&&!s.revive)){p.burn=5;p.burnTick=1;toast('화상! 5초간 매초 에너지 −2%')}}
function updateBurn(dt){const p=s.p;if(p.burn<=0)return;const active=Math.min(dt,p.burn);p.burn=Math.max(0,p.burn-active);p.burnTick-=active;while(p.burnTick<=1e-8){p.burnTick+=1;damage({},2,true);if(s.mode!=='running'||p.burnTick===0)break}if(p.burn<1e-8){p.burn=0;p.burnTick=0}}
function drawBurn(front=false){
 const p=s.p;if(p.burn<=0||s.mode==='dying'||s.mode==='over')return;
 const k=p.scale,t=s.t,x=p.x,y=GROUND-p.y,bodyHeight=(sliding()?78:120)*k;
 ctx.save();ctx.globalAlpha=1;
 const flame=(fx,fy,w,h,sway,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(fx-w,fy);ctx.bezierCurveTo(fx-w*1.5,fy-h*.35,fx-w*.5+sway,fy-h*.65,fx+sway,fy-h);ctx.bezierCurveTo(fx+w*.15+sway,fy-h*.5,fx+w*1.5,fy-h*.3,fx+w,fy);ctx.closePath();ctx.fill()};
 if(!front){
  const glow=ctx.createRadialGradient(x,y-bodyHeight*.55,8*k,x,y-bodyHeight*.55,105*k);glow.addColorStop(0,'#ffb129a0');glow.addColorStop(.55,'#ff491b70');glow.addColorStop(1,'#ff290000');ctx.fillStyle=glow;ctx.fillRect(x-110*k,y-bodyHeight-65*k,220*k,bodyHeight+100*k);
  ctx.shadowColor='#ff4b16';ctx.shadowBlur=22*k;
  for(let i=0;i<9;i++){const fx=x+(i-4)*13*k,h=bodyHeight*(.85+.28*Math.sin(t*10+i*1.7))+30*k,sway=Math.sin(t*8+i)*15*k;flame(fx,y+5*k,16*k,h,sway,'#f04416');flame(fx,y+3*k,10*k,h*.8,sway*.7,'#ffb52b')}
 }else{
  ctx.shadowColor='#ff961f';ctx.shadowBlur=10*k;
  for(let i=0;i<5;i++){const fx=x+(i-2)*22*k,edge=Math.abs(i-2)/2,h=(30+edge*52+12*Math.sin(t*14+i*2))*k,sway=Math.sin(t*11+i)*10*k;flame(fx,y,12*k,h,sway,'#ff721c');flame(fx,y,6*k,h*.66,sway*.6,'#fff1a2')}
  for(let i=0;i<14;i++){const phase=(t*(.65+(i%3)*.12)+i/14)%1,fx=x+Math.sin(i*7.3)*55*k-Math.sin(phase*4+i)*18*k,fy=y-20*k-phase*(bodyHeight+70*k);ctx.globalAlpha=1-phase;ctx.fillStyle=i%2?'#fff2ae':'#ff9b28';ctx.beginPath();ctx.arc(fx,fy,(2+(i%3))*k,0,Math.PI*2);ctx.fill()}
  ctx.globalAlpha=1;ctx.shadowBlur=0;const labelY=Math.max(100,y-bodyHeight-64*k);ctx.fillStyle='#38100aee';ctx.fillRect(x-105,labelY-22,210,34);ctx.strokeStyle='#ffad53';ctx.lineWidth=2;ctx.strokeRect(x-105,labelY-22,210,34);ctx.fillStyle='#ffe1a6';ctx.font='bold 20px "Malgun Gothic", sans-serif';ctx.textAlign='center';ctx.fillText('화상 '+p.burn.toFixed(1)+'초 · −2%/초',x,labelY+2);
 }
 ctx.restore();
}
function hitBaseball(ball){const p=s.p,unprotected=p.inv<=0&&s.buff[1]<=0&&s.buff[5]<=0&&s.buff[6]<=0,hadRevive=s.revive;damage(ball,40);ball.destroyed=true;if(unprotected&&s.mode==='running'&&!(hadRevive&&!s.revive)){p.panic=1.5;slideHeld=false;burst(p.x,GROUND-p.y-65,'#ffc1e3',22);toast('경직! 1.5초간 움직일 수 없어요')}}
function updateBaseball(dt){
 let spawn=false;if(s.t>=s.nextBaseball){s.nextBaseball+=20;spawn=Math.random()<.5}if(s.t>=s.nextBaseballGuarantee){s.nextBaseballGuarantee+=150;spawn=true}if(spawn)requestEncounter('baseball');
 for(const m of s.batters){if(m.shots<m.maxShots&&s.t>=m.nextShot)fireBaseball(m);if(m.shots===m.maxShots&&s.t-m.swingStart>=.55){m.phase='obstacle';const prev=m.x;m.x-=s.speed*dt;if(overlap(box(),{x:m.x-35,y:GROUND-145,w:prev-m.x+70,h:140}))damage(m,25)}}
 for(const ball of s.baseballs){const px=ball.x,py=ball.y;ball.x+=ball.dx*s.speed*3*dt;ball.y+=ball.dy*s.speed*3*dt;ball.age+=dt;const swept={x:Math.min(px,ball.x)-26,y:Math.min(py,ball.y)-26,w:Math.abs(px-ball.x)+52,h:Math.abs(py-ball.y)+52};if(overlap(box(),swept))hitBaseball(ball);else if(!ball.avoided&&ball.x+26<s.p.x){ball.avoided=true;maybeShout()}if(s.mode!=='running')break}
 s.baseballs=s.baseballs.filter(b=>!b.destroyed&&b.x> -100&&b.y> -150&&b.y<H+150);s.batters=s.batters.filter(m=>!m.destroyed&&m.x+130> -100);
}
function spawnBomb(){
 if(s.portal||s.pendingPortal||hasSpecialMonster()||s.encounterQueue.length||s.obstacles.some(o=>o.type==='tunnel'&&!o.cleared)){s.pendingBomb=true;return false}
 let x=W+120;for(const o of [...s.obstacles,...s.gaps,...s.bombs])x=Math.max(x,o.x+(o.w||BOMB_BASE)+Math.max(500,s.speed*1.5));
 s.bombs.push({x,y:GROUND-100,w:100,h:100,phase:'armed',age:0,flash:0,hit:false});s.pendingBomb=false;toast('폭탄! 근접하면 크게 폭발 · 2단 점프!');return true;
}
function bombFlashRate(b){return 2+14*clamp(1-Math.max(0,b.x-s.p.x)/(W-s.p.x),0,1)}
function bombBounds(b){return {x:b.x-75,y:GROUND-220,w:150,h:220}}
function updateBombs(dt){
 if(s.t>=s.nextBomb){s.nextBomb+=13;if(Math.random()<.68)s.pendingBomb=true}if(s.pendingBomb&&!s.bombs.length)spawnBomb();
 for(const b of s.bombs){b.x-=s.speed*dt;b.flash+=dt*bombFlashRate(b);b.age+=dt;
  if(b.phase==='armed'&&b.x-s.p.x<=Math.max(190,s.speed*BOMB_TRIGGER_TIME)){b.phase='igniting';b.age=0;tone(180,.12)}
  else if(b.phase==='igniting'&&b.age>=.16){b.phase='exploding';b.age=0;burst(b.x,GROUND-75,'#ff9c53',32);tone(95,.25)}
  else if(b.phase==='exploding'&&b.age>=.95){b.phase='spent';b.age=0;if(!b.hit&&!b.avoidChecked){b.avoidChecked=true;maybeShout()}}
  if(b.phase==='exploding'&&overlap(box(),bombBounds(b)))damage(b,25);
 }
 s.bombs=s.bombs.filter(b=>!b.destroyed&&b.x+BOMB_BASE*BOMB_SCALE> -100&&!(b.phase==='spent'&&b.age>.3));
}
function spawnAmbientJellies(){
 while(s.distance>=s.nextAmbient){s.nextAmbient+=68;const x=W+48,tunnel=s.obstacles.find(o=>o.type==='tunnel'&&!o.cleared&&x>=o.x&&x<=o.x+o.w),air=tunnel||s.obstacles.find(o=>o.type==='air'&&Math.abs(o.x-x)<130);
  if(s.gaps.some(g=>x>g.x-60&&x<g.x+g.w+60)||s.bombs.some(b=>Math.abs(b.x-x)<250)||s.obstacles.some(o=>!['air','tunnel'].includes(o.type)&&x>o.x-45&&x<o.x+o.w+45))continue;
  const y=GROUND-(air?26:55);if(!s.pickups.some(q=>Math.abs(q.x-x)<38&&Math.abs(q.y-y)<40))pickup('jelly',jellyType(),x,y);
 }
}
function drawTrap(g,left,right){
 const double=g.kind==='double',rise=double&&g.trapActive?Math.min(1,(g.trapAge||0)/.18):0;
 const height=TRAP_HEIGHT*(1+.8*rise),y=GROUND+TRAP_HEIGHT*TRAP_DROP+TRAP_HEIGHT-height;
 const im=double?assets.trapDouble:assets.trapSingle,sw=im.width/2,sx=(g.trapActive?1:0)*sw;
 ctx.save();ctx.beginPath();ctx.rect(left,Math.min(GROUND,y),right-left,H-Math.min(GROUND,y));ctx.clip();ctx.imageSmoothingEnabled=false;
 if(!double){for(let x=g.x+Math.max(0,Math.floor(-g.x/TRAP_HEIGHT))*TRAP_HEIGHT;x<Math.min(W,g.x+g.w);x+=TRAP_HEIGHT)sprite(im,sx,0,sw,im.height,x,y,TRAP_HEIGHT,height)}
 else sprite(im,sx,0,sw,im.height,g.x,y,g.w,height);
 ctx.restore();
}
function acquire(id){const p=s.p;burst(p.x,GROUND-p.y-65,colors[id],30);if(id!==5)playSfx(['','shield','heart','heart','magnet','speed','giant'][id],{channel:'item',limit:2});if(id===1)s.buff[1]=15;if(id===2){s.energy=Math.min(100,s.energy+30);s.heal=1;blink()}if(id===3)s.revive=true;if(id===4)s.buff[4]=10;if(id===5){s.buff[5]=8;soundPlayer?.stopChannel('speedBuff');soundPlayer?.syncSpeed?.(8)}if(id===6){s.buff[6]=10;s.giantEffectPending=true;}if(id===5||id===6){thawPlayer();p.panic=0;p.burn=0;p.burnTick=0}s.itemNotice={id,text:effectDescriptions[id],until:s.t+3};toast(names[id]+' · '+effectDescriptions[id])}
function damage(o,amount=25,periodic=false){const p=s.p;if(s.mode!=='running'||o.destroyed||(o.hit&&s.buff[5]<=0&&s.buff[6]<=0))return;o.hit=true;if(s.buff[5]>0||s.buff[6]>0){if(o.type==='tunnel'){const pb=box();for(const tile of tunnelTiles(o)){if(overlap(pb,{x:tile.x,y:o.y,w:tile.w,h:o.h})){o.crushedTiles ||= new Set();if(!o.crushedTiles.has(tile.index)){o.crushedTiles.add(tile.index);awardDestruction(tile.x+tile.w/2,o.h-40)}}}}else{burst(o.x+(o.w||0)/2,o.y+(o.h||0)/2,'#fff2a1',22);o.destroyed=true;awardDestruction(p.x,GROUND-p.y-100)}return}if(!periodic&&p.inv>0)return;if(!periodic&&s.buff[1]>0){s.buff[1]=0;blink();p.inv=.95;burst(p.x,GROUND-p.y-60,colors[1],35);toast('보호막이 피해를 막았어요!');return}s.energy=Math.max(0,s.energy-amount);if(!periodic){p.hit=.48;p.inv=1.2;blink();s.shake=.28;playSfx('shock'+(1+Math.floor(Math.random()*3)),{channel:'shock',limit:.6});}floating('−'+amount+'%',p.x,GROUND-p.y-115,'#ff9f9f');if(s.energy===0){if(s.revive){playSfx('death',{channel:'reviveDeath',limit:.5});s.revive=false;s.p.panic=0;s.p.burn=0;s.p.burnTick=0;thawPlayer();s.energy=10;s.resurrection=1.6;p.inv=2;p.hit=0;blink();burst(p.x,GROUND-p.y-50,'#ffc8ff',65);toast('부활! 에너지 10%로 다시 달려요');tone(1200,.4)}else{s.p.frozen=0;s.p.frozenPose=null;s.p.panic=0;s.mode='dying';deathAudio();s.shake=0;s.death=1.4;p.hit=0;p.blink=0;slideHeld=false;$('pause').disabled=true}}}
function update(dt){if(s.mode==='running'&&s.bonus){updateBonus(dt);return}if(s.mode==='dying'){s.death-=dt;s.shake=0;advanceJump(s.p,dt);if(!s.p.falling)s.p.y=Math.max(0,s.p.y);s.p.anim+=dt;updateFx(dt);if(s.death<=0)finish();return}if(s.mode!=='running')return;s.t+=dt;const meters=Math.floor((s.t+1e-8)*10);s.score+=meters-s.meters;s.meters=meters;const stage=1+Math.floor(s.t/45);if(stage!==s.stage){s.stage=stage;toast(`STAGE ${String(stage).padStart(2,'0')} · 속도가 빨라집니다!`);playSfx('stage',{channel:'stage',limit:1.5})}const p=s.p;p.panic=Math.max(0,p.panic-dt);if(p.panic<1e-8)p.panic=0;
 for(const id of [1,4,5,6])if(s.buff[id]>0){s.buff[id]=Math.max(0,s.buff[id]-dt);if(!s.buff[id]){blink();toast(names[id]+' 효과 종료')}}
 updateBurn(dt);if(s.mode!=='running')return;
 soundPlayer?.syncSpeed?.(s.buff[5]);
 s.speed=BASE_SPEED*Math.pow(1.13,s.stage-1)*(s.buff[5]>0?3:1);s.distance+=s.speed*dt;s.bg+=s.speed*dt*.42;
 p.scale+=( (s.buff[6]>0?3:1)-p.scale)*Math.min(1,dt*9);if(s.giantEffectPending&&p.scale>=2.9){s.giantEffectPending=false;playSfx('giantEffect',{channel:'giantEffect'})}if(p.frozen<=0&&p.panic<=0)p.anim+=dt*(s.buff[5]>0?1.8:1);for(const k of ['hit','inv','blink','land'])p[k]=Math.max(0,p[k]-dt);s.shake=Math.max(0,s.shake-dt);s.heal=Math.max(0,s.heal-dt);s.resurrection=Math.max(0,s.resurrection-dt);
 if(p.frozen>0){p.frozen=Math.max(0,p.frozen-dt);if(p.frozen<=1e-8)thawPlayer()}
 updateGround(dt);if(s.mode!=='running')return;
 if(s.t>=s.nextSpeech){s.nextSpeech+=25;s.speech={text:speechLines[Math.floor(rand(0,speechLines.length))],until:s.t+3}}
 if(s.speech&&s.t>=s.speech.until)s.speech=null;if(s.itemNotice&&s.t>=s.itemNotice.until)s.itemNotice=null;
 updatePirates(dt);if(s.mode!=='running')return;updateIce(dt);if(s.mode!=='running')return;updateBaseball(dt);if(s.mode!=='running')return;updateGoblins(dt);if(s.mode!=='running')return;processEncounters();updateBombs(dt);if(s.mode!=='running')return;
 if(!s.encounterQueue.length&&!s.portal&&!s.pendingPortal&&s.t>=s.nextPattern&&!s.obstacles.some(o=>o.type==='tunnel'&&!o.cleared)&&s.t>=s.encounterUntil&&!hasSpecialMonster()&&s.bombs.length===0&&!s.pendingBomb)pattern();
 for(let id=1;id<=6;id++){let spawn=false;if(s.t>=s.nextItems[id]){s.nextItems[id]+=schedule[id].interval;spawn=Math.random()<schedule[id].chance}if(s.t>=s.nextGuarantees[id]){s.nextGuarantees[id]+=schedule[id].guarantee;spawn=true}if(spawn)spawnItem(id)}
 const pb=box();for(const o of s.obstacles){o.x-=s.speed*dt;
 if(o.type==='tunnel'){
  if(o.cleared)continue;
  if(o.until===null&&o.x<=pb.x+pb.w)o.until=s.t+o.duration;
  if(o.until!==null){o.w=Math.max(0,pb.x-o.x+travelDistance(s.t,Math.max(s.t,o.until)));if(s.t>=o.until){o.cleared=true;continue}}
  if(s.p.inv<=0)o.hit=false;
  if(tunnelTiles(o).some(tile=>!o.crushedTiles?.has(tile.index)&&overlap(pb,{x:tile.x,y:o.y,w:tile.w,h:o.h})))damage(o);
 }else{const ob={x:o.x+o.w*.15,y:o.y+o.h*.1,w:o.w*.7,h:o.h*.88};if(overlap(pb,ob))damage(o)}if(s.mode!=='running')break}
 if(s.mode==='running')updatePickups(dt);
 s.obstacles=s.obstacles.filter(o=>o.x+o.w>-100&&!o.destroyed);s.pickups=s.pickups.filter(q=>q.x>-100&&!q.taken);
 s.particleTimer-=dt;if(s.particleTimer<=0){s.particleTimer=.045;if(sliding()||s.buff[5]||s.buff[6])burst(p.x-35*p.scale,GROUND-p.y-8,s.buff[5]?'#fff1a0':'#d5e8cc',2)}
 updatePortal(dt);if(s.bonus)return;
 if(s.t>=s.nextBonusJelly){s.nextBonusJelly+=30;if(Math.random()<.3)spawnRareJelly()}
 spawnAmbientJellies();updateFx(dt);s.toast-=dt;if(s.toast<=0)$('toast').style.opacity=0;
}

function awardDestruction(x,y){s.score+=20;s.destroyScore+=20;burst(x,y,'#fff2a1',12);floating('+20',x,y,'#fff2a1')}
function tunnelTiles(o){
 // Distribute whole sprites along the row, including the final tile.
 o.tileCount ||= Math.max(1,Math.ceil(o.w/76));
 const width=o.w/o.tileCount;
 return Array.from({length:o.tileCount},(_,index)=>({index,x:o.x+index*width,w:width}));
}
function updatePickups(dt){
 const p=s.p,pb=box();
 for(const q of s.pickups){
  q.x-=s.speed*dt;
  const tx=p.x,ty=GROUND-p.y-55*p.scale,dx=tx-q.x,dy=ty-q.y,d=Math.hypot(dx,dy);
  if((q.type==='jelly'||q.type==='bonus')&&s.buff[4]>0&&d<CELL*p.scale*3){const f=1-Math.exp(-dt*12);q.x+=dx*f+s.speed*dt*.8;q.y+=dy*f}
  if(q.taken||!overlap(pb,{x:q.x-q.w/2,y:q.y-q.h/2,w:q.w,h:q.h}))continue;
  q.taken=true;
  if(q.type==='item'){acquire(q.id);continue}
  const points=q.type==='bonus'?q.points:[0,10,25,100][q.id];
  s.score+=points;s.jellyScore+=points;s.jellies++;
  burst(q.x,q.y,q.type==='bonus'?'#f7c1ff':['','#ffe99b','#ffb7db','#d9b9ff'][q.id],7);
  floating('+'+points,q.x,q.y-18,'#fff1a3');
  playSfx(q.type==='bonus'?'jelly3':'jelly'+q.id,{gain:.7,limit:.5});
 }
 s.pickups=s.pickups.filter(q=>q.x>-100&&!q.taken);
}
function spawnRareJelly(){
 let x=W+80;
 for(const o of [...s.obstacles,...s.gaps,...s.bombs])if(x>o.x-150&&x<o.x+(o.w||100)+150)x=o.x+(o.w||100)+180;
 bonusJelly(x,GROUND-65,300);
}
function bonusJelly(x,y,points){pickup('bonus',1+Math.floor(Math.random()*5),x,y);s.pickups.at(-1).points=points}
function spawnGoblin(){
 if(!canStartEncounter()){requestEncounter('goblin');return false}
 const stop=Math.random()<.5;
 s.goblins.push({x:W+80,y:GROUND-100,w:85,h:100,phase:'run',age:0,hit:false,willStop:stop,stopX:s.p.x+(W-s.p.x)*rand(.4,.7),remaining:2});
 playSfx('goblin',{channel:'goblinIntro'});return true;
}
function updateGoblins(dt){
 if(s.t>=s.nextGoblin){s.nextGoblin+=17;if(Math.random()<.5)requestEncounter('goblin')}
 for(const m of s.goblins){
  const previous=m.x;m.age+=dt;
  if(m.phase==='stop'){
   m.remaining=Math.max(0,m.remaining-dt);
   if(m.remaining<=1e-8){m.phase='rush';playSfx('goblinRun',{channel:'goblinRun'})}
  }else{
   m.x-=s.speed*(m.phase==='rush'?4:2)*dt;
   if(m.phase==='run'&&m.willStop&&m.x<=m.stopX){m.x=m.stopX;m.phase='stop';m.willStop=false;m.remaining=2}
  }
  const body={x:m.x-34,y:GROUND-90,w:previous-m.x+68,h:88};
  if(overlap(box(),body))damage(m,40);
  else if(!m.avoided&&m.x+45<box().x){m.avoided=true;maybeShout()}
  if(s.mode!=='running')break;
 }
 s.goblins=s.goblins.filter(m=>m.x+100>0&&!m.destroyed);
}
function drawGoblins(){
 const im=assets.goblin,sw=im.width/4;
 for(const m of s.goblins){const frame=m.phase==='stop'?1:Math.floor(m.age*(m.phase==='rush'?20:12))%4;ctx.save();ctx.imageSmoothingEnabled=false;sprite(im,frame*sw,0,sw,im.height,m.x-62,GROUND-122,124,124);ctx.restore()}
}
function spawnPortal(){
 if(!canStartEncounter()){s.pendingPortal=true;return false}
 s.pendingPortal=false;s.portal={x:W+100,y:GROUND-230,w:160,h:230,age:0,open:false};
 playSfx('portal',{channel:'portal'});return true;
}
function updatePortal(dt){
 if(s.t>=s.nextPortal){s.nextPortal+=90;if(Math.random()<.35)s.pendingPortal=true}
 if(s.pendingPortal&&!s.portal)spawnPortal();
 const portal=s.portal;if(!portal)return;
 const previous=portal.x;portal.x-=s.speed*dt;portal.age+=dt;
 // Open inside the nearest 30% of the visible approach distance.
 if(portal.x-s.p.x<=(W-s.p.x)*.3)portal.open=true;
 if(overlap(box(),{x:portal.x-portal.w/2,y:portal.y,w:previous-portal.x+portal.w,h:portal.h})){enterBonus();return}
 if(portal.x+portal.w<0)s.portal=null;
}
function drawPortal(){
 const portal=s.portal;if(!portal)return;const im=assets.portal,sw=im.width/2;
 ctx.save();ctx.shadowColor='#d394ff';ctx.shadowBlur=18+Math.sin(portal.age*6)*8;
 const pulse=1+Math.sin(portal.age*5)*.025,w=260*pulse,h=260*pulse;
 sprite(im,portal.open?sw:0,0,sw,im.height,portal.x-w/2,GROUND-h,w,h);ctx.restore();
}
function enterBonus(){
 if(s.bonus||s.mode!=='running')return;
 endSlide();s.bonus={phase:'enter',elapsed:0};s.portal=null;
 soundPlayer?.suspendWorldEffects?.();playSfx('bonus',{channel:'bonusTransition'});
}
function activateBonus(){
 s.bonus=null;const saved=s;
 s=fresh();s.mode='running';s.score=saved.score;s.jellyScore=saved.jellyScore;s.destroyScore=saved.destroyScore;s.jellies=saved.jellies;
 s.energy=saved.energy;s.meters=saved.meters;s.t=saved.t;s.stage=saved.stage;s.p.x=saved.p.x;s.speed=BASE_SPEED*1.4;
 s.bonus={phase:'active',elapsed:0,nextWave:.4,wave:0,saved};
 for(let x=s.p.x+100,i=0;x<W+160;x+=75,i++)bonusJelly(x,GROUND-(i%8<4?60:180),100);
}
function restoreNormalWorld(){
 const bonus=s,normal=bonus.bonus.saved;
 normal.score=bonus.score;normal.jellyScore=bonus.jellyScore;normal.jellies=bonus.jellies;normal.bonusSeconds+=15;
 s=normal;s.bonus=null;s.mode='running';s.p.inv=Math.max(s.p.inv,1.5);s.p.blink=1.5;endSlide();
 soundPlayer?.resumeWorldEffects?.();soundPlayer?.syncSpeed?.(s.buff[5]);
 toast('돌아왔어요! 1.5초 동안 무적');
}
function updateBonus(dt){
 const b=s.bonus;
 if(b.phase==='enter'||b.phase==='exit'){
  b.elapsed+=dt;if(b.elapsed>=1-1e-8){if(b.phase==='enter')activateBonus();else restoreNormalWorld()}
  return;
 }
 const activeDt=Math.min(dt,15-b.elapsed);b.elapsed+=activeDt;
 s.distance+=s.speed*activeDt;s.bg+=s.speed*activeDt*.42;s.p.anim+=activeDt;
 for(const k of ['hit','inv','blink','land'])s.p[k]=Math.max(0,s.p[k]-activeDt);
 updateGround(activeDt);
 if(b.elapsed>=b.nextWave){b.nextWave+=.4;const height=[60,60,180,280,180,60][b.wave++%6];for(let i=0;i<3;i++)bonusJelly(W+40+i*65,GROUND-height,100)}
 updatePickups(activeDt);updateFx(activeDt);
 if(b.elapsed>=15-1e-8){b.phase='exit';b.elapsed=0;endSlide();playSfx('bonus',{channel:'bonusTransition'})}
}
function drawBonusBackground(){
 const width=W,offset=s.bg%(width*2),base=Math.floor(offset/width),shift=offset%width;
 for(let i=-1;i<=1;i++){const im=assets[(base+i+2)%2?'bonusBg2':'bonusBg1'];const scale=Math.max(width/im.width,H/im.height),sw=width/scale,sh=H/scale;ctx.drawImage(im,(im.width-sw)/2,(im.height-sh)/2,sw,sh,i*width-shift,0,width+1,H)}
 ctx.fillStyle='#25134022';ctx.fillRect(0,0,W,H);
}
function drawBonusTransition(){
 const b=s.bonus;if(!b||b.phase==='active')return;
 const progress=clamp(b.elapsed,0,1);
 ctx.save();ctx.globalAlpha=progress;ctx.fillStyle='#f9edff';ctx.fillRect(0,0,W,H);
 ctx.translate(W/2,H/2);ctx.rotate(progress*Math.PI*.8);
 for(let i=0;i<14;i++){ctx.rotate(Math.PI/7);ctx.fillStyle=i%2?'#e5b4ff':'#a9eaff';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(W,-30-progress*50);ctx.lineTo(W,30+progress*50);ctx.closePath();ctx.fill()}
 ctx.restore();
}

function updateFx(dt){for(const f of s.fx){f.x+=f.vx*dt;f.y+=f.vy*dt;if(!f.text)f.vy+=380*dt;f.life-=dt}s.fx=s.fx.filter(f=>f.life>0)}
function formatTime(t){return String(Math.floor(t/60)).padStart(2,'0')+':'+String(Math.floor(t%60)).padStart(2,'0')}
function hud(){const gamePause=$('gamePause');gamePause.hidden=!['running','paused'].includes(s.mode);gamePause.textContent=s.mode==='paused'?'▶ 플레이':'Ⅱ 일시정지';gamePause.setAttribute?.('aria-label',s.mode==='paused'?'게임 계속하기':'게임 일시정지');gamePause.setAttribute?.('aria-pressed',String(s.mode==='paused'));$('exitGameFullscreen').hidden=!fullscreenSession||!['running','paused'].includes(s.mode);$('bonusTimer').hidden=!s.bonus;$('bonusTimer').textContent=s.bonus?'BONUS · '+Math.ceil(Math.max(0,15-s.bonus.elapsed))+'s':'';$('distance').textContent=s.meters.toLocaleString()+' m';$('score').textContent=String(s.score).padStart(6,'0');$('energyText').textContent=s.energy+'%';$('energy').style.width=s.energy+'%';$('energy').style.background=s.energy<=25?'#ff776e':'#d6ff63';$('stage').textContent='STAGE '+String(s.stage).padStart(2,'0');$('time').textContent=formatTime(s.t);$('speed').textContent='SPEED ×'+(s.speed/BASE_SPEED).toFixed(2);$('stageProgress').style.width=(s.t%45/45*100)+'%';$('buffs').textContent=[...Object.entries(s.buff).filter(([,v])=>v>0).map(([id,v])=>names[id]+' '+Math.ceil(v)+'s'),...(s.revive?['부활 준비 ✓']:[]),...(s.p.frozen>0?['빙결 '+s.p.frozen.toFixed(1)+'s']:[]),...(s.p.burn>0?['화상 '+Math.ceil(s.p.burn)+'s']:[]),...(s.p.panic>0?['경직 '+s.p.panic.toFixed(1)+'s']:[])].join(' · ')||'젤리 '+s.jellies+'개 · 몬스터 피해 −25%'}
function sprite(im,sx,sy,sw,sh,x,y,w,h){ctx.drawImage(im,sx,sy,sw,sh,x,y,w,h)}
function backgroundKey(index){return BACKGROUND_ROUTE[((index%BACKGROUND_ROUTE.length)+BACKGROUND_ROUTE.length)%BACKGROUND_ROUTE.length]}
function bg(){if(s.bonus?.phase!=='enter'&&s.bonus){drawBonusBackground();return}const width=H*1983/793,overlapWidth=140,step=width-overlapWidth,offset=(s.bg||decor*.42)%(step*BACKGROUND_ROUTE.length),base=Math.floor(offset/step),shift=offset%step;
 function region(im,x,start,length){const scale=Math.max(width/im.width,H/im.height),sw=width/scale,sh=H/scale,sx=(im.width-sw)/2,sy=(im.height-sh)/2;ctx.drawImage(im,sx+start/scale,sy,length/scale,sh,x+start,0,length,H)}
 for(let j=-1;j<=2;j++){const im=assets[backgroundKey(base+j)],x=j*step-shift;if(j===-1){region(im,x,0,width);continue}region(im,x,overlapWidth,width-overlapWidth);for(let k=0;k<28;k++){ctx.globalAlpha=k/28;region(im,x,k*5,5.5)}ctx.globalAlpha=1}
 const shade=ctx.createLinearGradient(0,0,0,H);shade.addColorStop(0,'#061a2970');shade.addColorStop(.5,'#061a2900');shade.addColorStop(1,'#081b2350');ctx.fillStyle=shade;ctx.fillRect(0,0,W,H);drawRoad()}
function drawRoad(){
 function road(x,w){if(w<=0)return;ctx.save();ctx.beginPath();ctx.rect(x,GROUND,w,H-GROUND);ctx.clip();ctx.fillStyle='#102c31';ctx.fillRect(x,GROUND,w,H-GROUND);ctx.fillStyle='#bad888';ctx.fillRect(x,GROUND,w,5);ctx.fillStyle='#48715a';ctx.fillRect(x,GROUND+5,w,12);ctx.fillStyle='#ffffff08';for(let t=-(s.distance%100);t<W;t+=100){ctx.fillRect(t,GROUND+35,48,3);ctx.fillRect(t+25,GROUND+75,24,3)}ctx.restore()}
 let edge=0;for(const g of [...s.gaps].sort((a,b)=>a.x-b.x)){if(g.x>=W||g.x+g.w<=0)continue;const left=Math.max(0,g.x),right=Math.min(W,g.x+g.w);road(edge,left-edge);edge=right;
  const abyss=ctx.createLinearGradient(0,GROUND,0,H);abyss.addColorStop(0,'#050c18');abyss.addColorStop(1,'#211335');ctx.fillStyle=abyss;ctx.fillRect(left,GROUND,right-left,H-GROUND);drawTrap(g,left,right);ctx.fillStyle='#ffbf70';ctx.fillRect(g.x-5,GROUND,5,24);ctx.fillRect(g.x+g.w,GROUND,5,24);
  if(s.buff[5]>0||s.buff[6]>0){ctx.fillStyle='#ffefaab0';ctx.fillRect(left,GROUND,right-left,7)}
 }road(edge,W-edge)
}

function monster(o){if(o.type==='tunnel'){ctx.save();for(const tile of tunnelTiles(o)){if(o.crushedTiles?.has(tile.index)||tile.x+tile.w<0||tile.x>W)continue;sprite(assets.barrier,(o.skin%4)*280.5,Math.floor(o.skin/4)*278,280.5,278,tile.x,o.h-90,tile.w,90)}ctx.restore();if(o.cleared)return;ctx.save();ctx.fillStyle='#d6ff63';ctx.font='bold 20px "Malgun Gothic", sans-serif';ctx.textAlign='center';ctx.fillText('↓ 계속 누르세요 · '+(o.until===null?o.duration.toFixed(1):Math.max(0,o.until-s.t).toFixed(1))+'s',clamp(o.x+160,400,W-180),o.h-112);ctx.restore();return}let sx,sy,sw,sh;if(o.type==='tall'){sx=(o.skin%4)*280.5;sy=554;sw=280.5;sh=486}else{sx=(o.skin%4)*280.5;sy=Math.floor(o.skin/4)*278;sw=280.5;sh=278}ctx.save();if(o.hit)ctx.globalAlpha=.6;const bob=o.type==='air'?Math.sin(s.t*4+o.skin)*3:0;sprite(assets.barrier,sx,sy,sw,sh,o.x,o.y+bob,o.w,o.h);if(o.type==='air'){ctx.fillStyle='#d6ff63';ctx.font='bold 12px "Malgun Gothic", sans-serif';ctx.textAlign='center';ctx.fillText('↓ SLIDE',o.x+o.w/2,o.y-12)}ctx.restore()}
function ring(x,y,r,color,width=3){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke()}
function invincibilityWarning(){return [5,6].some(id=>s.buff[id]>0&&s.buff[id]<=3)}
function character(){const p=s.p,k=p.scale,sl=sliding(),dead=s.mode==='dying'||s.mode==='over';let row=0,col=Math.floor(p.anim*11)%4;if(dead){row=4;col=0}else if(p.panic>0){row=3;col=0}else if(p.hit>0){row=3;col=0}else if(p.jumps){row=1;col=p.vy>180?0:p.vy>-260?1:2}else if(sl){row=2;col=0}if(!dead&&p.frozen>0&&p.frozenPose){row=p.frozenPose.row;col=p.frozenPose.col}
 const run=row===0,im=run?assets.run:assets.player,sw=run?assets.run.width/4:280,sh=run?assets.run.height:280.8;
 const x=p.x,y=GROUND-p.y;ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle='#06141450';ctx.beginPath();ctx.ellipse(x,GROUND+3,40*k/(1+p.y/350),8*k,0,0,Math.PI*2);ctx.fill();
 if(s.buff[5]>0){for(let i=4;i>0;i--){ctx.globalAlpha=.09*(5-i);sprite(im,col*sw,run?0:row*sh,sw,sh,x-CELL*k/2-i*22,y-CELL*k,CELL*k,CELL*k)}ctx.globalAlpha=1;ctx.shadowColor='#fff5ac';ctx.shadowBlur=32;ctx.fillStyle='#ffefaa40';ctx.beginPath();ctx.ellipse(x-20,y-55*k,85*k,54*k,0,0,7);ctx.fill();ctx.shadowBlur=0}
 if(s.buff[4]>0){ctx.save();ctx.setLineDash([14,18]);ctx.translate(x,y-55*k);ctx.rotate(s.t*2);ring(0,0,80*k,'#ff92d5aa',3);ctx.restore();for(let i=0;i<3;i++){let a=s.t*3+i*2.094;ctx.fillStyle='#ff9fdc';ctx.beginPath();ctx.arc(x+Math.cos(a)*80*k,y-55*k+Math.sin(a)*80*k,5,0,7);ctx.fill()}}
 if(s.heal>0||s.resurrection>0){const c=s.resurrection?'#ffc8ff':'#9dffbb',life=s.resurrection||s.heal;ctx.globalAlpha=Math.min(1,life);ring(x,y-50*k,(1.7-life)*95+40,c,5);ctx.fillStyle=c;for(let i=0;i<5;i++){const xx=x+(i-2)*25,yy=y-((s.t*95+i*33)%160);ctx.fillRect(xx-3,yy-9,6,18);ctx.fillRect(xx-9,yy-3,18,6)}ctx.globalAlpha=1}
 if((invincibilityWarning()&&Math.floor(s.t*8)%2===0)||(p.blink>0&&Math.floor((.9-p.blink)/.15)%2===0)||(p.panic>0&&Math.floor(s.t*12)%2===0))ctx.globalAlpha=.18;
 ctx.save();ctx.translate(x,y);let tilt=p.frozen>0?0:p.panic>0?Math.sin(s.t*24)*.06:p.hit>0?-.16:sl?Math.sin(s.t*35)*.015:p.jumps?clamp(p.vy/8000,-.09,.09):0;ctx.rotate(tilt);const squash=p.land>0?1-p.land*.65:1;ctx.scale(1/squash,squash);const dh=CELL*k*(sl?.65:1);sprite(im,col*sw,run?0:row*sh,sw,sh,-CELL*k/2,-dh+5*k,CELL*k,dh);ctx.restore();ctx.globalAlpha=1;
 if(s.buff[1]>0){const cy=y-53*k,r=68*k+Math.sin(s.t*5)*3;ctx.shadowColor='#8be9ff';ctx.shadowBlur=16;ring(x,cy,r,'#b4f4ff',3);ctx.shadowBlur=0;const g=ctx.createRadialGradient(x-20,cy-25,1,x,cy,r);g.addColorStop(0,'#e4ffff25');g.addColorStop(.8,'#83e8ff08');g.addColorStop(1,'#83e8ff55');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,cy,r,0,7);ctx.fill()}
 if(s.revive){ctx.fillStyle='#ffc8ff';ctx.font='22px "Malgun Gothic", sans-serif';ctx.textAlign='center';ctx.fillText('✦',x,y-CELL*k-10+Math.sin(s.t*3)*5)}ctx.restore()}
function drawPirates(){
 for(const m of s.pirates){const age=s.t-m.lastShot,frame=age<.12?1:age<.42?2:0;const frames=[{sx:0,w:650,anchor:315},{sx:650,w:700,anchor:420},{sx:1350,w:822,anchor:595}],f=frames[frame],scale=.30;ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalAlpha=m.hit?.6:1;sprite(assets.pirate,f.sx,0,f.w,650,m.x-f.anchor*scale,GROUND-610*scale,f.w*scale,650*scale);ctx.fillStyle='#ffe3af';ctx.font='bold 16px "Malgun Gothic", sans-serif';ctx.textAlign='center';ctx.fillText(m.phase==='obstacle'?'↑ 해적왕을 뛰어넘기':'해적왕 · '+m.shots+'/'+m.maxShots,m.x,GROUND-210);ctx.restore()}
 for(const f of s.projectiles){ctx.save();ctx.translate(f.x,f.y);ctx.shadowColor='#ff651f';ctx.shadowBlur=22;const g=ctx.createLinearGradient(-22,0,65,0);g.addColorStop(0,'#fff9bf');g.addColorStop(.4,'#ff9d20');g.addColorStop(1,'#ff391000');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-26,0);ctx.quadraticCurveTo(-5,-28,62+Math.sin(f.age*35)*10,-12);ctx.lineTo(37,0);ctx.lineTo(68,13);ctx.quadraticCurveTo(-4,28,-26,0);ctx.fill();ctx.fillStyle='#ffffd9';ctx.beginPath();ctx.ellipse(-5,0,15,8,0,0,7);ctx.fill();ctx.restore()}
}
function drawIce(){
 const frames=[{sx:0,w:650,anchor:400},{sx:650,w:810,anchor:600},{sx:1460,w:712,anchor:440}];
 for(const m of s.iceMonsters){
  const frame=m.phase==='prepare'?0:m.phase==='laser'?1:2,f=frames[frame],scale=.25,muzzle=m.x-65,beamY=GROUND-70;
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalAlpha=m.hit?.6:1;
  const recoil=m.phase==='laser'?Math.sin((s.t-m.laserStart)*50)*1.8:0;
  sprite(assets.ice,f.sx,0,f.w,724,m.x-f.anchor*scale+recoil,GROUND-645*scale,f.w*scale,724*scale);
  ctx.fillStyle='#b2f5ff';ctx.font='bold 16px "Malgun Gothic", sans-serif';ctx.textAlign='center';ctx.fillText(m.phase==='obstacle'?'↑ 얼음 괴물을 뛰어넘기':m.phase==='prepare'?'점프로 피한다':'ICE LASER',m.x,GROUND-205);
  if(m.phase==='prepare'){
   const power=clamp((s.t-m.spawn)/ICE_PREPARE,0,1);ctx.globalAlpha=.3+power*.5;ctx.setLineDash([14,12]);ctx.strokeStyle='#77eaff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,beamY);ctx.lineTo(muzzle,beamY);ctx.stroke();ctx.setLineDash([]);ring(muzzle,beamY,26-power*13,'#abfaff',3);
  }
  if(m.phase==='laser'){
   const age=s.t-m.laserStart,progress=clamp(age/ICE_LASER,0,1),power=Math.pow(Math.sin(progress*Math.PI),.45),thickness=60*power;
   ctx.globalAlpha=power;ctx.shadowColor='#00aaff';ctx.shadowBlur=35;ctx.fillStyle='#1688ff55';ctx.fillRect(0,beamY-thickness*.9,muzzle,thickness*1.8);
   const beam=ctx.createLinearGradient(0,beamY-thickness/2,0,beamY+thickness/2);beam.addColorStop(0,'#0088ff');beam.addColorStop(.3,'#42cfff');beam.addColorStop(.5,'#efffff');beam.addColorStop(.7,'#42cfff');beam.addColorStop(1,'#0088ff');ctx.fillStyle=beam;ctx.fillRect(0,beamY-thickness/2,muzzle,thickness);
   ctx.fillStyle='#ffffff';ctx.fillRect(0,beamY-3*power,muzzle,6*power);ctx.shadowBlur=0;
   for(let i=0;i<18;i++){const x=((i*83-age*700)%Math.max(1,muzzle)+muzzle)%muzzle;ctx.fillStyle='#d6ffff';ctx.fillRect(x,beamY+Math.sin(i*7+age*30)*thickness*.43,randVisual(i)*12+5,2)}
   ring(muzzle,beamY,18+power*17,'#dcffff',5);ctx.fillStyle='#efffff';ctx.beginPath();ctx.arc(muzzle,beamY,12+power*7,0,Math.PI*2);ctx.fill();
  }ctx.restore();
  const count=iceCountdown(m);if(count){ctx.save();ctx.textAlign='center';ctx.shadowColor='#20bfff';ctx.shadowBlur=18;ctx.fillStyle='#e6ffff';ctx.font='900 64px "Malgun Gothic", sans-serif';ctx.fillText(count,W/2,245);ctx.shadowBlur=0;ctx.font='bold 18px "Malgun Gothic", sans-serif';ctx.fillText('점프로 피한다',W/2,280);ctx.restore()}
 }
}
function randVisual(i){return (Math.sin(i*127.1)+1)/2}
function drawFrozen(){const p=s.p;if(p.frozen<=0)return;const x=p.x,y=GROUND-p.y,k=p.scale,w=100*k,h=119*k;
 ctx.save();ctx.translate(x,y);const ice=ctx.createLinearGradient(-w/2,-h,w/2,0);ice.addColorStop(0,'#d7ffffbb');ice.addColorStop(.4,'#1ab6ff50');ice.addColorStop(1,'#87eaff99');ctx.fillStyle=ice;ctx.strokeStyle='#c5ffff';ctx.lineWidth=3;ctx.shadowColor='#42cfff';ctx.shadowBlur=18;
 ctx.beginPath();ctx.moveTo(-w*.53,-h*.75);ctx.lineTo(-w*.3,-h);ctx.lineTo(w*.28,-h*1.04);ctx.lineTo(w*.52,-h*.73);ctx.lineTo(w*.48,3);ctx.lineTo(-w*.44,3);ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;
 ctx.strokeStyle='#e1ffffaa';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-w*.3,-h);ctx.lineTo(-w*.14,-h*.38);ctx.lineTo(w*.48,3);ctx.moveTo(w*.28,-h*1.04);ctx.lineTo(-w*.14,-h*.38);ctx.lineTo(-w*.44,3);ctx.stroke();
 for(let i=0;i<7;i++){const angle=s.t*.8+i*.897,xx=Math.cos(angle)*w*.65,yy=-h*.5+Math.sin(angle)*h*.6;ctx.strokeStyle='#e5ffff';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(xx-5,yy);ctx.lineTo(xx+5,yy);ctx.moveTo(xx,yy-7);ctx.lineTo(xx,yy+7);ctx.moveTo(xx-3,yy-3);ctx.lineTo(xx+3,yy+3);ctx.stroke()}
 ctx.fillStyle='#e7ffff';ctx.font='bold 18px "Malgun Gothic", sans-serif';ctx.textAlign='center';ctx.fillText('빙결 '+p.frozen.toFixed(1)+'s',0,-h-18);ctx.restore();
}
function drawBombs(){const frames=[{sx:0,w:650},{sx:650,w:680},{sx:1330,w:842}];for(const b of s.bombs){const index=b.phase==='armed'?0:b.phase==='igniting'?1:2,f=frames[index],exploding=index===2,size=exploding?BOMB_BASE*BOMB_SCALE:100;ctx.save();ctx.imageSmoothingEnabled=false;
 if(b.phase==='spent')ctx.globalAlpha=Math.max(0,1-b.age/.3);else if(!exploding&&Math.floor(b.flash*2)%2===0){ctx.filter='sepia(1) saturate(9) hue-rotate(315deg) brightness(1.3)';ctx.shadowColor='#ff3030';ctx.shadowBlur=20}
 sprite(assets.bomb,f.sx,0,f.w,724,b.x-size/2,GROUND-size+size*(exploding?.075:.1),size,size);ctx.filter='none';ctx.shadowBlur=0;
 if(b.phase==='armed'){ctx.fillStyle='#ffb4a8';ctx.font='bold 15px "Malgun Gothic", sans-serif';ctx.textAlign='center';ctx.fillText('↑↑ 폭탄',b.x,GROUND-115)}ctx.restore()}}
function drawBaseball(){const frames=[{sx:0,w:575,anchor:315},{sx:575,w:875,anchor:600},{sx:1450,w:722,anchor:380}];
 for(const m of s.batters){const index=m.phase==='prepare'?0:m.phase==='swing'?1:2,f=frames[index],k=.25;ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalAlpha=m.hit?.6:1;sprite(assets.batter,f.sx,0,f.w,724,m.x-f.anchor*k,GROUND-680*k,f.w*k,724*k);ctx.fillStyle='#ffe5ca';ctx.font='bold 16px "Malgun Gothic", sans-serif';ctx.textAlign='center';ctx.fillText(m.phase==='obstacle'?'↑ 야구선수를 뛰어넘기':'강타 '+m.shots+'/'+m.maxShots+' · 공을 피하세요',m.x,GROUND-205);ctx.restore()}
 for(const b of s.baseballs){ctx.save();ctx.translate(b.x,b.y);ctx.strokeStyle='#ffd68190';ctx.lineWidth=13;ctx.beginPath();ctx.moveTo(20,0);ctx.lineTo(100,0);ctx.stroke();ctx.rotate(b.age*12);ctx.shadowColor='#ffd16e';ctx.shadowBlur=22;ctx.fillStyle='#fffaf0';ctx.beginPath();ctx.arc(0,0,30,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#d74343';ctx.lineWidth=3;for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*14,-25);ctx.quadraticCurveTo(side*2,0,side*14,25);ctx.stroke();for(let j=-16;j<=16;j+=8){ctx.beginPath();ctx.moveTo(side*9-4,j-2);ctx.lineTo(side*9+4,j+2);ctx.stroke()}}ctx.restore()}
}
function drawPanic(){const p=s.p;if(p.panic<=0)return;ctx.save();const x=p.x,y=GROUND-p.y-CELL*p.scale;for(let i=0;i<3;i++){const a=s.t*7+i*Math.PI*2/3;ctx.fillStyle=['#ffd68e','#ffa5cf','#d1b1ff'][i];ctx.beginPath();ctx.arc(x+Math.cos(a)*43,y+Math.sin(a)*13-10,5,0,Math.PI*2);ctx.fill()}ctx.fillStyle='#ffd5ea';ctx.font='bold 17px "Malgun Gothic", sans-serif';ctx.textAlign='center';ctx.fillText('STUN! '+p.panic.toFixed(1)+'s',x,y-35);ctx.restore()}
function bubble(text,x,y,color){ctx.font='bold 18px "Malgun Gothic", sans-serif';const w=Math.min(530,(ctx.measureText(text).width||text.length*18)+32);x=clamp(x,w/2+10,W-w/2-10);ctx.fillStyle='#10252eef';ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(x-w/2,y-32,w,44,12);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(x-8,y+12);ctx.lineTo(x,y+22);ctx.lineTo(x+8,y+12);ctx.fill();ctx.fillStyle=color;ctx.textAlign='center';ctx.fillText(text,x,y-3)}
function drawNotices(){if(s.mode==='over'||s.mode==='dying')return;const p=s.p;ctx.save();if(s.speech)bubble(s.speech.text,p.x,Math.max(150,GROUND-p.y-CELL*p.scale-28),'#faffed');if(s.itemNotice){const n=s.itemNotice,age=3-(n.until-s.t);ctx.globalAlpha=Math.min(1,(n.until-s.t)*3,age*6);bubble(n.text,clamp(p.x+200,270,W-280),Math.max(215,GROUND-p.y-CELL*p.scale-100-(s.speech?45:0)),colors[n.id])}ctx.restore()}
function draw(){ctx.clearRect(0,0,W,H);if(!ready)return;ctx.save();if(s.mode==='running'&&s.shake>0)ctx.translate(rand(-5,5),rand(-4,4));bg();for(const q of s.pickups){const bob=Math.sin(s.t*4+q.phase)*3;ctx.save();if(q.type==='item'){ctx.shadowColor=colors[q.id];ctx.shadowBlur=18;ring(q.x,q.y+bob,31+Math.sin(s.t*4)*2,colors[q.id]+'99',2)}let im=assets[q.type+q.id];ctx.drawImage(im,q.x-q.w/2,q.y-q.h/2+bob,q.w,q.h);ctx.restore()}for(const o of s.obstacles)monster(o);drawBombs();drawPirates();drawIce();drawBaseball();drawGoblins();drawPortal();drawBurn(false);if(s.mode!=='ready')character();drawBurn(true);drawFrozen();drawPanic();drawNotices();for(const f of s.fx){ctx.globalAlpha=clamp(f.life/f.max,0,1);ctx.fillStyle=f.color;if(f.text){ctx.font='bold 20px "Malgun Gothic", sans-serif';ctx.textAlign='center';ctx.fillText(f.text,f.x,f.y)}else{ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,7);ctx.fill()}}ctx.globalAlpha=1;drawBonusTransition();ctx.restore()}
function frame(now){const dt=Math.min((now-last)/1000||0,.1);last=now;if(s.mode==='ready')decor+=dt*30;if(s.mode==='running'||s.mode==='dying'){accumulator+=dt;while(accumulator>=1/120){update(1/120);accumulator-=1/120}}else accumulator=0;draw();hud();requestAnimationFrame(frame)}
$('start').onclick=()=>s.mode==='paused'?pause():start();$('pause').onclick=pause;$('gamePause').onclick=pause;$('exitGameFullscreen').onclick=()=>returnToApp();$('sound').onclick=()=>{sound=!sound;soundPlayer?.setEnabled(sound);$('sound').textContent='소리 '+(sound?'ON':'OFF');$('sound').setAttribute?.('aria-pressed',String(sound));if(!sound)audio?.suspend?.()};
$('volume').addEventListener('input',event=>soundPlayer?.setVolume(Number(event.target.value)/100));
window.addEventListener('keydown',e=>{if(e.target?.matches?.('input,textarea,[contenteditable]'))return;if(['Space','ArrowDown','ArrowUp'].includes(e.code))e.preventDefault();if(e.code==='ArrowDown')beginSlide();if(e.repeat)return;if(e.code==='Space'||e.code==='ArrowUp'){if(s.mode==='ready')start();else jump()}if(e.code==='Escape'){if(fullscreenSession)returnToApp();else if(s.mode==='running')pause()}if(e.code==='KeyP')pause()});window.addEventListener('keyup',e=>{if(e.code==='ArrowDown')endSlide()});
$('jump').addEventListener('pointerdown',e=>{e.preventDefault();jump()});$('slide').addEventListener('pointerdown',e=>{e.preventDefault();beginSlide();e.currentTarget.setPointerCapture(e.pointerId)});for(const event of ['pointerup','pointercancel','lostpointercapture'])$('slide').addEventListener(event,endSlide);
window.addEventListener('jellyrun:restart',start);window.addEventListener('blur',()=>{endSlide();if(s.mode==='running')pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden&&s.mode==='running')pause()});
Promise.all([load('player','main character.png'),load('run','main character_1.png?v=3'),load('pirate','monster01.png'),load('ice','monster02.png?v=7'),load('bg3alt','bg_image/bg03-1.png?v=6'),load('barrier','barrier1.png'),load('bomb','barrier2.png?v=8'),load('trapSingle','barrier4.png?v=10'),load('trapDouble','barrier5.png?v=10'),load('batter','monster03.png?v=8'),load('goblin','monster04.png?v=13'),load('portal','portal.png?v=13'),load('bonusBg1','bg_image/bonus_bg1.png?v=13'),load('bonusBg2','bg_image/bonus_bg2.png?v=13'),...[1,2,3,4,5].map(i=>load('bonus'+i,'jelly/bonus_jelly'+i+'.png?v=13')),...[1,2,3,4,5,6,7,8,9].map(i=>load('bg'+i,'bg_image/bg0'+i+'.png?v=13')),...[1,2,3].map(i=>load('jelly'+i,'jelly/jelly'+i+'.png')),...[1,2,3,4,5,6].map(i=>load('item'+i,'item/item'+i+'.png'))]).then(()=>{ready=true;$('start').disabled=false;$('start').textContent='지금 달리기 →';requestAnimationFrame(frame)}).catch(e=>{$('start').textContent='에셋 로딩 실패';$('description').textContent='파일을 확인하고 새로고침해 주세요: '+e.message});
// Explicit opt-in hook for deterministic local gameplay verification.
if(new URLSearchParams(location.search).has('test'))window.__game={get state(){return s},start,update,jump,acquire,hitPirateFire,updateBurn,invincibilityWarning,spawnGoblin,updateGoblins,spawnPortal,updatePortal,enterBonus,updateBonus,updatePickups,spawnRareJelly,tunnelTiles,returnToApp,finish,damage,box,draw,jellyType,schedule,setSlide:v=>v?beginSlide():endSlide(),constants:{CELL,JUMP,GRAVITY,GROUND,JUMP_HEIGHT,FALL_MULTIPLIER},pause,pattern,spawnPirate,travelDistance,advanceJump,gapBelow,updateGround,nextPatternType,hud,spawnIce,freezePlayer,thawPlayer,iceBeamActive,backgroundKey,spawnBaseball,fireBaseball,hitBaseball,spawnBomb,bombFlashRate,bombBounds,spawnAmbientJellies,requestEncounter,processEncounters,hasSpecialMonster,iceCountdown,soundPlayer,featureConstants:{BOMB_BASE,BOMB_SCALE,TRAP_HEIGHT,TRAP_DROP},iceConstants:{ICE_PREPARE,ICE_LASER,ICE_RECOVER,FREEZE_SECONDS}};
})();
