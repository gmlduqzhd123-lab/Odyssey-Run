import {CONTACT_MASKS} from '../assets/contact-masks';
import {heroPose,itemPose,enemyPose,obstaclePose,type HeroPoseState,type SpritePose} from '../rendering/poses';
import type {Collectible,Rect,Obstacle} from '../levels/courses';
import type {EnemyState} from '../levels/enemies';

export const overlaps=(a:Rect,b:Rect)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
type Shape=Rect&{mask:string;flipX?:boolean;reveal?:number};
export function containsInk(s:Shape,x:number,y:number){
 const mask=CONTACT_MASKS[s.mask];
 if(x<s.x||x>=s.x+s.w||y<s.y||y>=s.y+s.h*(s.reveal??1))return false;
 let u=Math.floor((x-s.x)/s.w*mask.w);if(s.flipX)u=mask.w-1-u;
 const row=mask.rows[Math.floor((y-s.y)/s.h*mask.h)];
 for(let i=0;i<row.length;i+=2)if(u>=row[i]&&u<row[i+1])return true;
 return false;
}
// Broad rectangles first, then shared visible silhouettes. This never reads Canvas
// pixels or depends on DPR, CSS scaling, the GPU or render refresh rate.
export function inkOverlap(a:Shape,b:Shape,clipA:Rect=a,clipB:Rect=b){
 const left=Math.max(a.x,b.x,clipA.x,clipB.x),right=Math.min(a.x+a.w,b.x+b.w,clipA.x+clipA.w,clipB.x+clipB.w);
 const top=Math.max(a.y,b.y,clipA.y,clipB.y),bottom=Math.min(a.y+a.h,b.y+b.h,clipA.y+clipA.h,clipB.y+clipB.h);
 if(left>=right||top>=bottom)return false;
 for(let y=top+.5;y<bottom;y++)for(let x=left+.5;x<right;x++)if(containsInk(a,x,y)&&containsInk(b,x,y))return true;
 return false;
}
export function collectibleContact(hero:SpritePose,body:Rect,item:Collectible){return inkOverlap(hero,{...itemPose(item.kind,item.x,item.y),mask:item.kind},body);}
export function obstacleContact(hero:SpritePose,body:Rect,obstacle:Obstacle,playerX:number){
 if(obstacle.role!=='hazard')return false;
 const pose=obstaclePose(obstacle,playerX);
 return overlaps(body,pose)&&inkOverlap(hero,pose,body);
}
export function enemyContact(hero:SpritePose,body:Rect,enemy:EnemyState){return enemy.active&&overlaps(body,enemy)&&inkOverlap(hero,enemyPose(enemy),body,enemy);}
export function projectileContact(hero:SpritePose,body:Rect,shot:EnemyState['projectile']){return shot.active&&overlaps(body,shot)&&inkOverlap(hero,{...shot,mask:'projectile'},body);}
export {heroPose};
export type {HeroPoseState};
