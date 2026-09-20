'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class FakeAudio {
 constructor(){this.events=new Map();this.currentTime=0;this.paused=true}
 addEventListener(k,f){if(!this.events.has(k))this.events.set(k,new Set());this.events.get(k).add(f)}
 removeEventListener(k,f){this.events.get(k)?.delete(f)}
 play(){this.paused=false;return Promise.resolve()}
 pause(){this.paused=true}
 removeAttribute(){this.released=true}
 load(){}
}
class FakeContext {
 constructor(){this.currentTime=0;this.sources=[];this.destination={};this.decoded=0}
 resume(){this.resumed=true;return Promise.resolve()}
 async decodeAudioData(){this.decoded++;return {duration:1,length:44100,numberOfChannels:1}}
 createGain(){return {gain:{value:1},connect(){},disconnect(){this.disconnected=true}}}
 createBufferSource(){const source={connect(){},disconnect(){this.disconnected=true},start(...args){this.args=args},stop(){this.stopped=true}};this.sources.push(source);return source}
}
const sandbox={window:{}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('audio.js','utf8'),sandbox);
const GameAudio=sandbox.window.GameAudio;
const options={AudioClass:FakeAudio,AudioContextClass:FakeContext,fetchAudio:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)})};
(async()=>{
 let now=0;const a=new GameAudio({...options,now:()=>now});await a.prepared;
 assert.equal(a.buffers.size,5);assert.equal(a.context.decoded,5);assert.equal(a.bufferBytes,5*44100*4);
 a.startRun();assert.ok(a.context.resumed);
 for(let i=0;i<100;i++){now+=60;a.effect('jelly1')}
 assert.equal(a.context.decoded,5,'100 pickups reuse the existing PCM buffer');
 assert.equal(a.pools.get('jelly1').length,2);assert.equal(a.voices.size,2);
 assert.ok(a.pools.get('jelly1').every(v=>!(v instanceof FakeAudio)));
 a.stopEffects();assert.ok(a.context.sources.every(s=>s.disconnected));
 console.log('PASS frequent effects reuse decoded PCM and release stopped source nodes');

 const v=a.effect('jump',{channel:'jump',limit:.4}),first=a.context.sources.at(-1);
 assert.deepEqual(first.args,[0,0,.4]);a.context.currentTime=.1;
 a.pause();assert.ok(first.stopped&&first.disconnected);assert.equal(v.currentTime,.1);
 a.context.currentTime=1;assert.equal(v.currentTime,.1);a.resume();
 const resumed=a.context.sources.at(-1);assert.equal(resumed.args[1],.1);assert.ok(Math.abs(resumed.args[2]-.3)<1e-8);
 a.setVolume(.3);assert.equal(v.gain.gain.value,.3);
 resumed.onended();assert.equal(a.voices.size,0);assert.ok(resumed.disconnected);
 console.log('PASS buffer pause/resume preserves position, duration limits, volume and natural cleanup');

 let finished=0;a.effect('jump',{channel:'cancel',onEnd:()=>finished++});
 const stale=a.context.sources.at(-1).onended;a.stopChannel('cancel');stale();assert.equal(finished,0);
 a.effect('slide');a.setEnabled(false);assert.equal(a.voices.size,0);assert.equal(a.activeAudio.size,0);
 assert.equal(a.effect('jump'),null);
 console.log('PASS cancellation and mute cannot replay a completed/stale sound');

 a.setEnabled(true);a.sequence(['jump','slide'],{channel:'sequence',limits:[.2,.3]});
 a.context.sources.at(-1).onended();assert.equal(a.channels.get('sequence').key,'slide');
 a.context.sources.at(-1).onended();assert.equal(a.sequences.size,0);
 a.effect('slide',{channel:'world'});a.context.currentTime+=.1;a.suspendWorldEffects();
 const world=a.channels.get('world').audio,position=world.currentTime;
 a.context.currentTime+=10;a.resumeWorldEffects();assert.equal(world.currentTime,position);
 a.endRun('death');assert.equal(a.voices.size,1);assert.equal(a.channels.get('ending').key,'death');
 console.log('PASS sequences and bonus-world suspension retain lifecycle behavior');

 const failed=new GameAudio({...options,fetchAudio:async()=>{throw Error('offline')}});await failed.prepared;
 assert.equal(failed.buffers.size,0);assert.equal(failed.bufferFailures.length,5);assert.ok(failed.effect('jump') instanceof FakeAudio);
 class BrokenContext extends FakeContext {async decodeAudioData(){throw Error('unsupported codec')}}
 const broken=new GameAudio({...options,AudioContextClass:BrokenContext});await broken.prepared;
 assert.equal(broken.buffers.size,0);assert.equal(broken.bufferFailures.length,5);assert.ok(broken.effect('jump') instanceof FakeAudio);
 const unsupported=new GameAudio({...options,AudioContextClass:null});await unsupported.prepared;
 assert.ok(unsupported.effect('jump') instanceof FakeAudio);
 class HugeContext extends FakeContext {async decodeAudioData(){return {duration:300,length:44100*300,numberOfChannels:2}}}
 const huge=new GameAudio({...options,AudioContextClass:HugeContext});await huge.prepared;
 assert.equal(huge.bufferBytes,0);assert.equal(huge.buffers.size,0);assert.ok(huge.effect('jump') instanceof FakeAudio);
 console.log('PASS unsupported audio, failed fetch/decode and over-budget PCM use media fallback');

 const late=new GameAudio({...options,fetchAudio:()=>new Promise(()=>{})});
 const fallback=late.effect('jelly1');late.stopEffects();
 late.buffers.set('jelly1',{duration:1,length:44100,numberOfChannels:1});late.lastJelly=-Infinity;
 const upgraded=late.effect('jelly1');assert.ok(upgraded.buffer);assert.ok(fallback.released);
 assert.equal(late.pools.get('jelly1').length,1);late.stopEffects();
 console.log('PASS idle media fallback is released when the decoded buffer becomes ready');
})().catch(error=>{console.error(error);process.exitCode=1});
