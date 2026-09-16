'use strict';
(() => {
  const FILES = {
    bomb:'bomb.mp3', bombAlarm:'bomb_alram.mp3',
    giant:'big item.mp3', giantEffect:'big effect.mp3', heart:'item_heart.mp3', magnet:'item_magnet.mp3', shield:'item_shield.mp3', speed:'item_speed.mp3',
    goblin:'goblin.mp3', goblinRun:'goblin2.mp3', portal:'portal.mp3', bonus:'bonus_effect.mp3',
    jelly1:'jelly.mp3', jelly2:'jelly2.mp3', jelly3:'special jelly.mp3', jump:'jump.mp3', death:'death.mp3', gameOver:'gameover.mp3',
    pirateAttack:'monster01 bomb.mp3', pirateFire:'monster01 bomb01.mp3',
    iceAim:'monster02 bomb00.mp3', iceCharge:'monster02 bomb01.mp3', iceFire:'moster02 bomb02.mp3', frozen:'ice status.mp3',
    baseballHit:'monster03 bomb.mp3', baseballFlight:'monster03 bomb01.mp3', stage:'next level.mp3',
    pirateIntro:'monster01_intro.mp3', iceIntro:'monster02_intro.mp3', baseballIntro:'monster03_intro.mp3',
    trapSingle:'crash.mp3', trapDouble:'croco.mp3', slide:'slide.mp3',
    shout1:'shout01.mp3', shout2:'shout02.mp3', shout3:'shout03.mp3', shout4:'shout04.mp3', shout5:'shout05.mp3',
    shock1:'shock01.mp3', shock2:'shock02.mp3', shock3:'shock03.mp3'
  };
  const MUSIC = ['bgm001.mp3','bgm002.mp3','bmg003.mp3','bmg004.mp3','bgm005.mp3'];
  class GameAudio {
    constructor({AudioClass=globalThis.Audio,now=()=>globalThis.performance?.now?.()??Date.now()}={}) {
      this.AudioClass=AudioClass;this.enabled=true;this.master=1;this.running=false;this.paused=false;
      this.musicIndex=0;this.musicFailures=0;this.voices=new Set();this.channels=new Map();this.sequences=new Map();this.pools=new Map();
      this.now=now;this.lastJelly=-Infinity;this.activeAudio=new Map();
      this.maxVoices=globalThis.matchMedia?.('(pointer: coarse)').matches?8:16;
      this.tracks=MUSIC.map(file=>this.make(file,'none'));
      this.tracks.forEach((track,index)=>{if(!track)return;track.volume=.7;track.preload='none';
        track.addEventListener('ended',()=>{if(index!==this.musicIndex)return;this.musicFailures=0;this.nextMusic()});
        track.addEventListener('error',()=>{if(index!==this.musicIndex)return;if(++this.musicFailures<MUSIC.length)this.nextMusic()});
      });
    }
    make(file,preload='auto'){if(!this.AudioClass)return null;const a=new this.AudioClass('bgm/'+encodeURIComponent(file)+'?v=19');a.preload=preload;return a}
    play(a){if(!a)return;try{const p=a.play();if(p?.catch)p.catch(()=>{})}catch{}}
    syncVolume(){for(const a of this.tracks)if(a)a.volume=this.master*.7;for(const v of this.voices)v.audio.volume=this.master*v.gain}
    setVolume(value){const wasSilent=this.master===0;this.master=Math.max(0,Math.min(1,Number(value)||0));this.syncVolume();if(this.master===0){this.stopMusic();this.stopEffects()}else if(wasSilent)this.playMusic()}
    playMusic(){if(this.running&&!this.paused&&this.enabled&&this.master>0)this.play(this.tracks[this.musicIndex])}
    nextMusic(){this.tracks[this.musicIndex]?.pause();this.musicIndex=(this.musicIndex+1)%MUSIC.length;const a=this.tracks[this.musicIndex];if(a)a.currentTime=0;this.playMusic()}
    stopMusic(){for(const a of this.tracks)a?.pause()}
    stopVoice(v){if(!v||!this.voices.has(v))return;v.audio.pause();v.audio.removeEventListener('ended',v.finish);v.audio.removeEventListener('error',v.finish);v.audio.removeEventListener('timeupdate',v.tick);this.voices.delete(v);this.activeAudio.delete(v.audio);if(this.channels.get(v.channel)===v)this.channels.delete(v.channel)}
    stopChannel(channel){const token=this.sequences.get(channel);if(token)token.cancelled=true;this.sequences.delete(channel);this.stopVoice(this.channels.get(channel))}
    stopEffects(){for(const token of this.sequences.values())token.cancelled=true;this.sequences.clear();for(const v of [...this.voices])this.stopVoice(v)}
    effect(key,{channel='',limit=Infinity,gain=1,onEnd=null,loop=false}={}){
      if(!this.enabled||this.paused||this.master===0||!FILES[key])return null;
      // A magnet/bonus pickup cluster can otherwise start many media decoders in one tick.
      const jelly=key.startsWith('jelly');
      if(jelly){const now=this.now();if(now-this.lastJelly<60)return null;this.lastJelly=now}
      if(channel)this.stopVoice(this.channels.get(channel));
      let pool=this.pools.get(key);if(!pool){pool=[];this.pools.set(key,pool)}
      let a=pool.find(a=>!this.activeAudio.has(a));
      if(!a&&pool.length<(jelly?2:4)){a=this.make(FILES[key]);if(a)pool.push(a)}
      if(!a){a=pool[0];this.stopVoice(this.activeAudio.get(a))}if(!a)return null;
      if(this.voices.size>=this.maxVoices){let oldest;for(const v of this.voices){if(!v.suspended&&!v.audio.loop){oldest=v;break}}if(oldest)this.stopVoice(oldest);else return null}
      a.currentTime=0;a.volume=this.master*gain;a.loop=loop;
      const v={audio:a,key,channel,gain,finish:null,tick:null};
      v.finish=()=>{if(!this.voices.has(v))return;this.stopVoice(v);onEnd?.()};v.tick=()=>{if(a.currentTime>=limit)v.finish()};
      a.addEventListener('ended',v.finish);a.addEventListener('error',v.finish);a.addEventListener('timeupdate',v.tick);this.voices.add(v);this.activeAudio.set(a,v);if(channel)this.channels.set(channel,v);this.play(a);return a;
    }
    sequence(keys,{channel='sequence',limits=[]}={}){
      this.stopChannel(channel);if(!this.enabled||this.paused)return;
      const token={cancelled:false};this.sequences.set(channel,token);
      const next=i=>{if(token.cancelled)return;if(i>=keys.length){if(this.sequences.get(channel)===token)this.sequences.delete(channel);return}this.effect(keys[i],{channel,limit:limits[i]??Infinity,onEnd:()=>next(i+1)})};next(0);
    }
    syncSpeed(remaining){
      if(remaining<=0){this.stopChannel('speedBuff');return}
      if(!this.enabled||this.paused)return;
      if(!this.channels.has('speedBuff'))this.effect('speed',{channel:'speedBuff',loop:true});
      const voice=this.channels.get('speedBuff');
      if(voice){voice.gain=Math.min(1,remaining/2);voice.audio.volume=this.master*voice.gain}
    }
    suspendWorldEffects(){for(const v of this.voices){v.suspended=true;v.audio.pause()}}
    resumeWorldEffects(){for(const v of this.voices){if(v.suspended){v.suspended=false;if(this.enabled&&!this.paused)this.play(v.audio)}}}
    setEnabled(value){this.enabled=!!value;if(!this.enabled){this.stopMusic();this.stopEffects()}else this.playMusic()}
    startRun(){this.stopEffects();this.stopMusic();this.running=true;this.paused=false;this.musicIndex=0;this.musicFailures=0;this.lastJelly=-Infinity;const a=this.tracks[0];if(a)a.currentTime=0;this.playMusic()}
    pause(){this.paused=true;this.stopMusic();for(const v of this.voices)v.audio.pause()}
    resume(){this.paused=false;if(this.enabled){this.playMusic();for(const v of this.voices)if(!v.suspended)this.play(v.audio)}}
    endRun(effect){this.running=false;this.paused=false;this.stopMusic();this.stopEffects();if(effect)this.effect(effect,{channel:'ending'})}
  }
  GameAudio.files=FILES;GameAudio.music=MUSIC;window.GameAudio=GameAudio;
})();
