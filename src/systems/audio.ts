import type {Settings} from '../storage/save';
// Original synthesized pentatonic melody. No network or audio assets are needed.
export class Sound {
 private ctx:AudioContext|null=null;private playing=false;private next=0;private note=0;private voices=new Set<OscillatorNode>();
 constructor(private settings:()=>Settings){}
 unlock(){try{this.ctx??=new AudioContext();void this.ctx.resume().catch(()=>{});}catch{/* Silence is supported. */}}
 setPlaying(value:boolean){this.playing=value;if(!value)this.silence();}
 private silence(){for(const v of this.voices){try{v.stop();}catch{}}this.voices.clear();this.next=0;}
 update(){if(!this.playing||!this.settings().music||!this.ctx||this.ctx.state!=='running')return;
  if(this.ctx.currentTime>=this.next){const melody=[62,69,74,76,74,69,67,69,62,67,69,74,69,67,64,62];this.tone(440*2**((melody[this.note++%melody.length]-69)/12),.32,.018,'triangle');this.next=this.ctx.currentTime+.37;}}
 effect(kind:string){if(!this.settings().sfx)return;const hz=kind==='star'?950:kind==='jump'?420:kind==='hurt'||kind==='fall'?110:kind==='map'?1200:640;this.tone(hz,.14,.045,kind==='hurt'?'sawtooth':'sine');}
 destroy(){this.setPlaying(false);if(this.ctx)void this.ctx.close().catch(()=>{});}
 changed(){if(!this.settings().music)this.silence();}
 private tone(hz:number,duration:number,volume:number,type:OscillatorType){try{const c=this.ctx;if(!c||c.state!=='running')return;const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(hz,c.currentTime);o.frequency.exponentialRampToValueAtTime(hz*.65,c.currentTime+duration);g.gain.setValueAtTime(volume,c.currentTime);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+duration);o.connect(g);g.connect(c.destination);this.voices.add(o);o.onended=()=>this.voices.delete(o);o.start();o.stop(c.currentTime+duration);}catch{}}
}
