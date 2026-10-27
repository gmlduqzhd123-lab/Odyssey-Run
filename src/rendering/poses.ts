import {C} from '../config';
import {RUN_ART} from '../assets/runner-art';
import {CROUCH_ART,MONSTER_ART} from '../assets/expansion-art';
import type {EnemyState} from '../levels/enemies';
import type {ItemKind,Rect,Obstacle} from '../levels/courses';

export interface HeroPoseState {x:number;y:number;time:number;sliding:boolean;grounded:boolean;state:string;}
export interface SpritePose extends Rect {mask:string;texture:string;frame?:string;originX:number;originY:number;scale?:number;anchorX:number;anchorY:number;flipX?:boolean;reveal?:number;}
// The renderer and contact tests use the same pose, origin, scale and animation clock.
export function heroPose(r:HeroPoseState):SpritePose {
 if(r.sliding){const a=CROUCH_ART,w=a.frame.w*a.scale,h=a.frame.h*a.scale;return {mask:'crouch',texture:'hero-crouch',frame:'crouch',originX:a.originX,originY:a.originY,scale:a.scale,anchorX:r.x,anchorY:r.y,x:r.x-w*a.originX,y:r.y-h*a.originY,w,h};}
 if(r.grounded&&r.state!=='success'&&r.state!=='failure'){
  const i=Math.floor(r.time*RUN_ART.fps)%RUN_ART.frames.length,f=RUN_ART.frames[i],w=f.w*RUN_ART.scale,h=f.h*RUN_ART.scale;
  return {mask:`run-${i}`,texture:'odysseus-run',frame:`run-${i}`,originX:f.originX,originY:f.originY,scale:RUN_ART.scale,anchorX:r.x,anchorY:r.y,x:r.x-w*f.originX,y:r.y-h*f.originY,w,h};
 }
 const w=r.state==='success'?69:66,h=r.state==='success'?92:88;
 return {mask:'air',texture:'odysseus',originX:.5,originY:1,anchorX:r.x,anchorY:r.y+2,x:r.x-w/2,y:r.y+2-h,w,h};
}
export function itemPose(kind:ItemKind,x:number,y:number):Rect {const size=kind==='star'?24:36;return {x:x-size/2,y:y-size/2,w:size,h:size};}
// Rendering and damage share the exact descent, not a future resting rectangle.
export function obstaclePose(o:Obstacle,playerX:number){
 const distance=o.x-playerX,texture=o.kind==='falling'?'rock':o.kind;
 const lift=o.kind==='hand'?Math.max(0,Math.min(260,(distance-150)*.8)):o.kind==='falling'?Math.max(0,Math.min(290,(distance-100)*1.5)):0;
 return {x:o.x,y:o.y-lift,w:o.w,h:o.h,texture,mask:'obstacle-'+texture};
}
export function enemyPose(e:EnemyState):SpritePose {
 const f=MONSTER_ART.frames[e.kind],scale=Math.min(96/f.w,(e.kind==='cyclops'?108:76)/f.h),w=f.w*scale,h=f.h*scale;
 const anchorX=e.x+e.w/2,anchorY=e.kind==='harpy'||e.kind==='shade'?e.y+e.h+4:C.ground+h*(1-e.reveal);
 return {mask:e.kind,texture:'monster-atlas',frame:e.kind,originX:.5,originY:1,scale,anchorX,anchorY,x:anchorX-w/2,y:anchorY-h,w,h,flipX:e.kind==='harpy',reveal:e.kind==='scylla'?e.reveal:1};
}
