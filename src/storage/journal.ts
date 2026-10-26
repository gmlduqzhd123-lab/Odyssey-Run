import {C} from '../config';
import {constellationIds,storyIds,routeIds,stampIds,type ComboId} from '../levels/adventure';
export const GHOST_SECONDS=511;
export interface Ghost {score:number;duration:number;samples:number[];}
export interface Journal {stamps:string[];stories:string[];constellations:string[];combos:ComboId[];routes:string[];ghosts:Partial<Record<'beach'|'cave'|'wind',Ghost>>;}
export interface AdventureResult {stamps:string[];stories:string[];constellations:string[];combos:ComboId[];routes:string[];nearMisses:number;evaded:number;tricked:number;ghost:Ghost;}
export const emptyJournal=():Journal=>({stamps:[],stories:[],constellations:[],combos:[],routes:[],ghosts:{}});
const object=(v:unknown)=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('모험 수첩 형식이 올바르지 않아요.');return v as Record<string,unknown>;};
const list=(v:unknown,allowed:readonly string[])=>{if(!Array.isArray(v)||v.length>allowed.length||new Set(v).size!==v.length||v.some(id=>typeof id!=='string'||!allowed.includes(id)))throw Error('모험 수첩의 발견 ID 또는 중복을 확인해 주세요.');return [...v] as string[];};
export function validateJournal(raw:unknown,bestScores:Record<string,number>):Journal {
 if(raw===undefined)return emptyJournal();const v=object(raw),g=object(v.ghosts),out=emptyJournal();
 out.stamps=list(v.stamps,stampIds);out.stories=list(v.stories,storyIds);out.constellations=list(v.constellations,constellationIds);out.routes=list(v.routes,routeIds);out.combos=list(v.combos,['glide','guardian']) as ComboId[];
 for(const [id,value] of Object.entries(g)){
  if(!['beach','cave','wind'].includes(id))throw Error('비교 항해의 섬이 올바르지 않아요.');const r=object(value);if(!Array.isArray(r.samples))throw Error('비교 항해의 거리 기록이 올바르지 않아요.');const samples=r.samples;
  if(!Number.isSafeInteger(r.score)||Number(r.score)<0||Number(r.score)>bestScores[id]||typeof r.duration!=='number'||!Number.isFinite(r.duration)||r.duration<0||r.duration>GHOST_SECONDS||!Array.isArray(r.samples)||samples.length<1||samples.length>GHOST_SECONDS+1||samples.length!==Math.floor(r.duration)+1||samples[0]!==0||samples.some((x,i)=>!Number.isSafeInteger(x)||x<0||x>24000||(i>0&&(x<samples[i-1]||x-samples[i-1]>C.speed+C.speed*C.step+1))))throw Error('비교 항해의 시간·거리 기록을 확인해 주세요.');
  if(Number(r.score)>Math.floor(Math.min(C.length,samples.at(-1)!+C.speed)/10)+1800)throw Error('비교 항해의 점수와 거리가 맞지 않아요.');
  out.ghosts[id as keyof typeof out.ghosts]={score:Number(r.score),duration:r.duration,samples:[...samples]};
 }
 return out;
}
export function ghostDistance(ghost:Ghost|undefined,time:number){if(!ghost)return null;const index=Math.min(ghost.samples.length-1,Math.max(0,Math.floor(time))),next=Math.min(ghost.samples.length-1,index+1);return ghost.samples[index]+(ghost.samples[next]-ghost.samples[index])*Math.min(1,Math.max(0,time-index));}
