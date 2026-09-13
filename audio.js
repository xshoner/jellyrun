'use strict';
(() => {
  const FILES = {
    giant:'big item.mp3', heart:'item_heart.mp3', magnet:'item_magnet.mp3', shield:'item_shield.mp3', speed:'item_speed.mp3',
    jelly1:'jelly.mp3', jelly2:'jelly2.mp3', jelly3:'special jelly.mp3', jump:'jump.mp3', death:'death.mp3', gameOver:'gameover.mp3',
    pirateAttack:'monster01 bomb.mp3', pirateFire:'monster01 bomb01.mp3',
    iceAim:'monster02 bomb00.mp3', iceCharge:'monster02 bomb01.mp3', iceFire:'moster02 bomb02.mp3', frozen:'ice status.mp3',
    baseballHit:'monster03 bomb.mp3', baseballFlight:'monster03 bomb01.mp3', stage:'next level.mp3',
    shock1:'shock01.mp3', shock2:'shock02.mp3', shock3:'shock03.mp3'
  };
  const MUSIC = ['bgm001.mp3','bgm002.mp3','bmg003.mp3','bmg004.mp3'];
  class GameAudio {
    constructor({AudioClass=globalThis.Audio}={}) {
      this.AudioClass=AudioClass;this.enabled=true;this.master=1;this.running=false;this.paused=false;
      this.musicIndex=0;this.musicFailures=0;this.voices=new Set();this.channels=new Map();this.sequences=new Map();this.pools=new Map();
      this.tracks=MUSIC.map(file=>this.make(file));
      this.tracks.forEach((track,index)=>{if(!track)return;track.volume=.7;
        track.addEventListener('ended',()=>{if(index!==this.musicIndex)return;this.musicFailures=0;this.nextMusic()});
        track.addEventListener('error',()=>{if(index!==this.musicIndex)return;if(++this.musicFailures<MUSIC.length)this.nextMusic()});
      });
    }
    make(file){if(!this.AudioClass)return null;const a=new this.AudioClass('bgm/'+encodeURIComponent(file));a.preload='auto';return a}
    play(a){if(!a)return;try{const p=a.play();if(p?.catch)p.catch(()=>{})}catch{}}
    syncVolume(){for(const a of this.tracks)if(a)a.volume=this.master*.7;for(const v of this.voices)v.audio.volume=this.master*v.gain}
    setVolume(value){this.master=Math.max(0,Math.min(1,Number(value)||0));this.syncVolume()}
    playMusic(){if(this.running&&!this.paused&&this.enabled)this.play(this.tracks[this.musicIndex])}
    nextMusic(){this.tracks[this.musicIndex]?.pause();this.musicIndex=(this.musicIndex+1)%MUSIC.length;const a=this.tracks[this.musicIndex];if(a)a.currentTime=0;this.playMusic()}
    stopMusic(){for(const a of this.tracks)a?.pause()}
    stopVoice(v){if(!v||!this.voices.has(v))return;v.audio.pause();v.audio.removeEventListener('ended',v.finish);v.audio.removeEventListener('error',v.finish);v.audio.removeEventListener('timeupdate',v.tick);this.voices.delete(v);if(this.channels.get(v.channel)===v)this.channels.delete(v.channel)}
    stopChannel(channel){const token=this.sequences.get(channel);if(token)token.cancelled=true;this.sequences.delete(channel);this.stopVoice(this.channels.get(channel))}
    stopEffects(){for(const token of this.sequences.values())token.cancelled=true;this.sequences.clear();for(const v of [...this.voices])this.stopVoice(v)}
    effect(key,{channel='',limit=Infinity,gain=1,onEnd=null}={}){
      if(!this.enabled||this.paused||!FILES[key])return null;
      if(channel)this.stopVoice(this.channels.get(channel));
      let pool=this.pools.get(key);if(!pool){pool=[];this.pools.set(key,pool)}
      let a=pool.find(a=>![...this.voices].some(v=>v.audio===a));
      if(!a&&pool.length<4){a=this.make(FILES[key]);if(a)pool.push(a)}
      if(!a){a=pool[0];this.stopVoice([...this.voices].find(v=>v.audio===a))}if(!a)return null;
      if(this.voices.size>=20)this.stopVoice(this.voices.values().next().value);
      a.currentTime=0;a.volume=this.master*gain;
      const v={audio:a,key,channel,gain,finish:null,tick:null};
      v.finish=()=>{if(!this.voices.has(v))return;this.stopVoice(v);onEnd?.()};v.tick=()=>{if(a.currentTime>=limit)v.finish()};
      a.addEventListener('ended',v.finish);a.addEventListener('error',v.finish);a.addEventListener('timeupdate',v.tick);this.voices.add(v);if(channel)this.channels.set(channel,v);this.play(a);return a;
    }
    sequence(keys,{channel='sequence',limits=[]}={}){
      this.stopChannel(channel);if(!this.enabled||this.paused)return;
      const token={cancelled:false};this.sequences.set(channel,token);
      const next=i=>{if(token.cancelled)return;if(i>=keys.length){if(this.sequences.get(channel)===token)this.sequences.delete(channel);return}this.effect(keys[i],{channel,limit:limits[i]??Infinity,onEnd:()=>next(i+1)})};next(0);
    }
    setEnabled(value){this.enabled=!!value;if(!this.enabled){this.stopMusic();this.stopEffects()}else this.playMusic()}
    startRun(){this.stopEffects();this.stopMusic();this.running=true;this.paused=false;this.musicIndex=0;this.musicFailures=0;for(const a of this.tracks)if(a)a.currentTime=0;this.playMusic()}
    pause(){this.paused=true;this.stopMusic();for(const v of this.voices)v.audio.pause()}
    resume(){this.paused=false;if(this.enabled){this.playMusic();for(const v of this.voices)this.play(v.audio)}}
    endRun(effect){this.running=false;this.paused=false;this.stopMusic();this.stopEffects();if(effect)this.effect(effect,{channel:'ending'})}
  }
  GameAudio.files=FILES;GameAudio.music=MUSIC;window.GameAudio=GameAudio;
})();
