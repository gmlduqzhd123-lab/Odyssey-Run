import {C} from '../config';
import {COURSES,type StageId,type Rect,type Platform,type Collectible} from '../levels/courses';
import {score,rating} from '../systems/score';
import type {RunResult} from '../storage/save';
import {createEnemyState,updateEnemyState,type EnemyState} from '../levels/enemies';
export type RunState='ready'|'playing'|'paused'|'success'|'failure';
export interface RunnerEvent {kind:'jump'|'star'|'map'|'shield'|'wings'|'magnet'|'apple'|'trident'|'lantern'|'compass'|'strike'|'hurt'|'fall'|'block'|'finish';x:number;y:number;}
const overlap=(a:Rect,b:Rect)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
export class Runner {
 readonly course; state:RunState='ready';x=0;y:number=C.ground;vy=0;hp=3;hpLoss=0;maxDistance=0;time=0;
 grounded=true;sliding=false;jumps=0;coyote:number=C.coyote;buffer=0;slideHeld=false;invincible=0;shield=false;wings=0;magnet=0;
 trident=false;lantern=0;defeated=new Set<string>();readonly enemyStates:EnemyState[];
 safeX=0;recovering=0;stars=0;maps=new Set<string>();collected=new Set<string>();events:RunnerEvent[]=[];private finalized:RunResult|null=null;private hitbox:Rect={x:-21,y:376,w:42,h:64};
 constructor(readonly stage:StageId){this.course=COURSES[stage];this.enemyStates=this.course.enemies.map(createEnemyState);this.updateEnemies();}
 private updateEnemies(){this.enemyStates.forEach((s,i)=>updateEnemyState(s,this.course.enemies[i],this.x,this.time,this.lantern>0,this.defeated.has(s.id)));}
 get body():Rect {const b=this.hitbox;b.x=this.x-C.bodyWidth/2;b.h=this.sliding?C.slide:C.stand;b.y=this.y-b.h;return b;}
 clearInput(){this.slideHeld=false;this.buffer=0;}
 jump(){if(this.state==='playing')this.buffer=C.buffer;}
 slide(held:boolean){this.slideHeld=held;}
 platformY(p:Platform){return p.y+(p.moving?Math.sin(this.time*1.6)*22:0);}
 private canStand(x=this.x,y=this.y){return !this.course.obstacles.some(o=>o.kind==='gate'&&overlap({x:x-21,y:y-C.stand,w:42,h:C.stand},o));}
 private emit(kind:RunnerEvent['kind']){this.events.push({kind,x:this.x,y:this.y-45});}
 private tryJump(){
  if(this.buffer<=0||!this.canStand())return;
  const groundJump=this.grounded||this.coyote>0;
  if(!groundJump&&this.jumps>=2)return;
  this.jumps=groundJump?1:2;this.grounded=false;this.coyote=0;this.vy=C.jump;this.sliding=false;this.buffer=0;this.emit('jump');
 }
 collect(item:Collectible){
  if(this.collected.has(item.id))return;
  this.collected.add(item.id);
  if(item.kind==='star')this.stars++;
  if(item.kind==='map')this.maps.add(item.id);
  if(item.kind==='shield')this.shield=true;
  if(item.kind==='wings')this.wings=C.effect;
  if(item.kind==='magnet')this.magnet=C.effect;
  if(item.kind==='apple')this.hp=Math.min(3,this.hp+1);
  if(item.kind==='trident')this.trident=true;
  if(item.kind==='lantern')this.lantern=C.effect;
  if(item.kind==='compass'&&item.checkpoint!==undefined&&this.x>=item.checkpoint)this.safeX=Math.max(this.safeX,item.checkpoint);
  this.emit(item.kind);
 }
 hurt(fall=false){
  if(this.state!=='playing'||(!fall&&this.invincible>0))return;
  if(!fall&&this.shield){this.shield=false;this.emit('block');}
  else{this.hp--;this.hpLoss++;this.emit(fall?'fall':'hurt');}
  this.invincible=C.invincible;
 }
 tick(dt:number=C.step){
  if(this.state!=='playing')return;
  this.events.length=0;
  this.time+=dt;this.invincible=Math.max(0,this.invincible-dt);this.wings=Math.max(0,this.wings-dt);this.magnet=Math.max(0,this.magnet-dt);this.lantern=Math.max(0,this.lantern-dt);
  this.recovering=Math.max(0,this.recovering-dt);
  if(this.grounded)this.coyote=C.coyote;else this.coyote=Math.max(0,this.coyote-dt);
  this.tryJump();this.buffer=Math.max(0,this.buffer-dt);
  const oldY=this.y;
  this.x+=C.speed*dt;
  this.sliding=this.grounded&&(this.slideHeld||(this.sliding&&!this.canStand()));
  this.vy+=C.gravity*dt;
  const inWind=this.course.winds.some(w=>overlap(this.body,w));
  if(inWind){this.vy=Math.max(-C.windCap,Math.min(C.windCap,this.vy-C.windForce*dt));}
  if(this.wings>0&&this.vy>C.glide)this.vy=C.glide;
  this.y+=this.vy*dt;
  // Solid ceiling undersides do not spend jumps or allow clipping through the gate.
  for(const o of this.course.obstacles){if(o.kind==='gate'&&this.vy<0&&overlap(this.body,o)){this.y=o.y+o.h+(this.sliding?C.slide:C.stand);this.vy=0;}}
  let floor=Infinity;
  if(!this.course.gaps.some(g=>this.x>g.x&&this.x<g.x+g.w)&&oldY<=C.ground+1)floor=C.ground;
  for(const p of this.course.platforms){const py=this.platformY(p);if(this.x+18>p.x&&this.x-18<p.x+p.w&&oldY<=py+3&&this.y>=py&&this.vy>=0)floor=Math.min(floor,py);}
  this.grounded=false;
  if(this.vy>=0&&this.y>=floor){this.y=floor;this.vy=0;this.grounded=true;this.jumps=0;this.coyote=C.coyote;this.sliding=this.slideHeld||!this.canStand();this.tryJump();}
  if(!this.grounded&&this.coyote===0&&this.jumps===0)this.jumps=1;
  this.maxDistance=Math.min(C.length,Math.max(this.maxDistance,this.x));
  if(this.grounded&&!this.sliding&&this.y===C.ground){for(const x of this.course.safe)if(this.x>=x&&x>this.safeX)this.safeX=x;}
  for(const item of this.course.items){
   if(this.collected.has(item.id)||Math.abs(item.x-this.x)>C.magnet+40)continue;
   if((item.kind==='star'&&this.magnet>0&&Math.hypot(item.x-this.x,item.y-(this.y-32))<=C.magnet)||overlap(this.body,{x:item.x-15,y:item.y-15,w:30,h:30}))this.collect(item);
  }
  this.updateEnemies();
  if(this.trident){const target=this.enemyStates.find(s=>!s.defeated&&(s.active||s.projectile.active)&&Math.hypot(s.x+s.w/2-this.x,s.y+s.h/2-(this.y-32))<200);if(target){this.defeated.add(target.id);target.defeated=true;target.active=false;target.projectile.active=false;this.trident=false;this.emit('strike');}}
  for(const o of this.course.obstacles){if(overlap(this.body,o))this.hurt();}
  for(const enemy of this.enemyStates){if(enemy.active&&overlap(this.body,enemy)||enemy.projectile.active&&overlap(this.body,enemy.projectile))this.hurt();}
  if(this.y>C.fallBoundary&&this.recovering<=0){
   this.hurt(true);
   if(this.hp>0){this.x=this.safeX;this.y=C.ground;this.vy=0;this.grounded=true;this.jumps=0;this.sliding=false;this.recovering=.35;this.clearInput();this.updateEnemies();}
  }
  if(this.hp<=0){this.state='failure';this.clearInput();}
  else if(this.x>=C.length&&this.y<=C.fallBoundary&&this.recovering<=0){this.state='success';this.clearInput();this.emit('finish');}
 }
 get points(){return score(this.maxDistance,this.stars,this.maps.size,this.state==='success');}
 result():RunResult {
  if(this.finalized)return this.finalized;
  if(this.state!=='success'&&this.state!=='failure')throw Error('Run is not finished');
  this.finalized={stage:this.stage,complete:this.state==='success',score:this.points,rating:rating(this.state==='success',this.stars,this.hpLoss),stars:this.stars,maps:[...this.maps],hpLoss:this.hpLoss,distance:this.maxDistance};return this.finalized;
 }
}
