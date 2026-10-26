import type {Settings} from '../storage/save';
import type {StageId} from '../levels/courses';
import {MUSIC} from '../assets/music';
// Only the selected island's decoded buffer is retained; effects stay synthesized.
export class Sound {
 private ctx:AudioContext|null=null;private playing=false;private stage:StageId|null=null;private dead=false;
 private voices=new Set<OscillatorNode>();private buffer:AudioBuffer|null=null;private loading=false;private failed=false;private request=0;private loadAbort:AbortController|null=null;private decoding:Promise<void>=Promise.resolve();
 private source:AudioBufferSourceNode|null=null;private gain:GainNode|null=null;private offset=0;private startedAt=0;
 constructor(private settings:()=>Settings){}
 unlock(){if(this.dead)return;try{this.ctx??=new AudioContext();void this.ctx.resume().then(()=>{if(!this.dead){this.loadMusic();this.startMusic();}}).catch(()=>{});this.loadMusic();}catch{/* Silence is supported. */}}
 setStage(stage:StageId,reset=false){
  if(this.stage!==stage){this.stopMusic();this.loadAbort?.abort();this.request++;this.loading=false;this.failed=false;this.buffer=null;this.offset=0;}
  if(reset){this.stopMusic();this.offset=0;this.failed=false;}
  this.stage=stage;this.loadMusic();
 }
 setPlaying(value:boolean){this.playing=value;if(!value){this.stopMusic();for(const v of this.voices){try{v.stop();}catch{}}this.voices.clear();}else this.startMusic();}
 private loadMusic(){
  const c=this.ctx,stage=this.stage;if(this.dead||!c||!stage||!this.settings().music||this.buffer||this.loading||this.failed)return;
  const id=++this.request,abort=new AbortController();this.loadAbort=abort;this.loading=true;
  const current=()=>!this.dead&&id===this.request&&this.stage===stage;
  void (async()=>{try{const response=await fetch(`${import.meta.env?.BASE_URL||'./'}${MUSIC[stage].file}`,{signal:abort.signal});if(!response.ok)throw Error('Music unavailable');const bytes=await response.arrayBuffer();if(!current())return;
   // decodeAudioData cannot be aborted. Serialize it and discard stale selections.
   const decode=this.decoding.then(async()=>{if(!current())return;const buffer=await c.decodeAudioData(bytes);if(!current())return;this.buffer=buffer;this.startMusic();});this.decoding=decode.catch(()=>{});await decode;
  }catch{if(current())this.failed=true;}finally{if(current())this.loading=false;}})();
 }
 private startMusic(){
  const c=this.ctx,buffer=this.buffer,stage=this.stage;if(this.dead||this.failed||!this.playing||!stage||!this.settings().music||!c||c.state!=='running'||!buffer||this.source)return;
  let source:AudioBufferSourceNode|null=null;
  try{if(!this.gain){this.gain=c.createGain();this.gain.connect(c.destination);}this.gain.gain.value=MUSIC[stage].gain;source=c.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(this.gain);const node=source;node.onended=()=>{node.disconnect();if(this.source===node)this.source=null;};this.source=node;this.startedAt=c.currentTime;node.start(0,this.offset%buffer.duration);}catch{try{source?.disconnect();}catch{}this.source=null;this.failed=true;}
 }
 private stopMusic(){const source=this.source;if(!source)return;this.source=null;if(this.ctx&&this.buffer)this.offset=(this.offset+Math.max(0,this.ctx.currentTime-this.startedAt))%this.buffer.duration;try{source.stop();source.disconnect();}catch{}}
 update(){if(!this.playing||!this.settings().music||!this.ctx||this.ctx.state!=='running')return;this.loadMusic();this.startMusic();}
 effect(kind:string){if(!this.settings().sfx||this.dead)return;const hz=kind==='star'?950:kind==='jump'?420:kind==='hurt'||kind==='fall'?110:kind==='map'?1200:640;this.tone(hz,.14,.045,kind==='hurt'?'sawtooth':'sine');}
 destroy(){this.setPlaying(false);this.dead=true;this.request++;this.loadAbort?.abort();this.buffer=null;this.gain?.disconnect();if(this.ctx)void this.ctx.close().catch(()=>{});}
 changed(){if(!this.settings().music)this.stopMusic();else{this.failed=false;this.loadMusic();this.startMusic();}}
 private tone(hz:number,duration:number,volume:number,type:OscillatorType){try{const c=this.ctx;if(this.dead||!c||c.state!=='running')return;const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(hz,c.currentTime);o.frequency.exponentialRampToValueAtTime(hz*.65,c.currentTime+duration);g.gain.setValueAtTime(volume,c.currentTime);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+duration);o.connect(g);g.connect(c.destination);this.voices.add(o);o.onended=()=>{this.voices.delete(o);o.disconnect();g.disconnect();};o.start();o.stop(c.currentTime+duration);}catch{}}
}
