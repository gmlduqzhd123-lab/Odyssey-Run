import {emptyJournal,validateJournal,type Journal,type AdventureResult} from './journal';
import {MAX_SCORE} from '../config';
import {STAGES,type StageId} from '../levels/courses';
export interface Settings {music:boolean;sfx:boolean;reducedMotion:boolean;}
export interface RecordData {complete:boolean;bestScore:number;bestRating:number;bestStars:number;maps:string[];}
export interface Save {schemaVersion:1;contentVersion:1;settings:Settings;tutorialSeen:boolean;lastStage:StageId;stages:Record<StageId,RecordData>;savedAt:string;journal:Journal;}
export const SAVE_KEY=`odyssey-run:${new URL(import.meta.env?.BASE_URL||'./',typeof location==='undefined'?'http://local/':location.href).pathname}:save`;
export const BACKUP_KEY=SAVE_KEY+':backup';
const emptyRecord=():RecordData=>({complete:false,bestScore:0,bestRating:0,bestStars:0,maps:[]});
export const emptySave=():Save=>({schemaVersion:1,contentVersion:1,settings:{music:true,sfx:true,reducedMotion:false},tutorialSeen:false,lastStage:'beach',stages:{beach:emptyRecord(),cave:emptyRecord(),wind:emptyRecord()},savedAt:new Date().toISOString(),journal:emptyJournal()});
const obj=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('기록 형식을 확인해 주세요.');return v as Record<string,unknown>;};
const bool=(v:unknown)=>{if(typeof v!=='boolean')throw Error('설정과 완료 여부가 올바르지 않아요.');return v;};
const integer=(v:unknown,max:number)=>{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0||v>max)throw Error('점수·별빛·평점 범위를 확인해 주세요.');return v;};
export function validateSave(raw:unknown):Save {
 const v=obj(raw); if(v.schemaVersion!==1||v.contentVersion!==1)throw Error('지원하지 않는 기록 버전이에요. 원본 파일을 보관해 주세요.');
 const s=obj(v.settings); const stages=obj(v.stages); const out=emptySave();
 if(Object.keys(stages).some(id=>!STAGES.includes(id as StageId)))throw Error('알 수 없는 섬이 포함돼 있어요.');
 out.settings={music:bool(s.music),sfx:bool(s.sfx),reducedMotion:bool(s.reducedMotion)};
 out.tutorialSeen=bool(v.tutorialSeen);
 if(!STAGES.includes(v.lastStage as StageId))throw Error('최근 섬 정보가 올바르지 않아요.'); out.lastStage=v.lastStage as StageId;
 if(typeof v.savedAt!=='string'||v.savedAt.length>40||!Number.isFinite(Date.parse(v.savedAt)))throw Error('저장 시각이 올바르지 않아요.');out.savedAt=v.savedAt;
 STAGES.forEach((id,i)=>{
  const r=obj(stages[id]); const complete=bool(r.complete);
  if(!Array.isArray(r.maps)||r.maps.length>3||new Set(r.maps).size!==r.maps.length||r.maps.some(m=>typeof m!=='string'||![1,2,3].map(n=>`${id}-map-${n}`).includes(m)))throw Error('지도 조각 ID 또는 중복을 확인해 주세요.');
  const record={complete,bestScore:integer(r.bestScore,MAX_SCORE),bestRating:integer(r.bestRating,3),bestStars:integer(r.bestStars,100),maps:[...r.maps] as string[]};
  if((complete&&record.bestRating<1)||(!complete&&record.bestRating!==0)||(complete&&record.bestScore<2900)||(!complete&&record.bestScore>MAX_SCORE-500))throw Error('완주 기록과 점수가 맞지 않아요.');
  if(record.bestRating===3&&record.bestStars<70)throw Error('최고 평점과 별빛 기록이 맞지 않아요.');
  if(i>0&&(complete||record.bestScore>0||record.bestStars>0||record.maps.length>0)&&!out.stages[STAGES[i-1]].complete)throw Error('앞선 섬을 먼저 완주한 기록이 필요해요.');
  out.stages[id]=record;
 });
 const index=STAGES.indexOf(out.lastStage); if(index>0&&!out.stages[STAGES[index-1]].complete)throw Error('최근 섬이 아직 잠겨 있어요.');
 out.journal=validateJournal(v.journal,Object.fromEntries(STAGES.map(id=>[id,out.stages[id].bestScore])));
 for(const id of [...out.journal.stamps,...out.journal.stories,...out.journal.constellations,...out.journal.routes,...Object.keys(out.journal.ghosts)]){const stage=id.split('-')[0] as StageId;if(!unlocked(out,stage))throw Error('모험 수첩에 아직 잠긴 섬의 발견이 있어요.');}
 return out;
}
export interface RunResult {stage:StageId;complete:boolean;score:number;rating:number;stars:number;maps:string[];hpLoss:number;distance:number;adventure?:AdventureResult;}
export function mergeResult(save:Save,r:RunResult):Save {
 const out=structuredClone(save); const s=out.stages[r.stage];
 s.complete ||=r.complete;s.bestScore=Math.max(s.bestScore,r.score);s.bestRating=Math.max(s.bestRating,r.rating);s.bestStars=Math.max(s.bestStars,r.stars);s.maps=[...new Set([...s.maps,...r.maps])];out.savedAt=new Date().toISOString();
 if(r.adventure){const a=r.adventure,j=out.journal;for(const key of ['stamps','stories','constellations','combos','routes'] as const)(j[key] as string[])=[...new Set([...j[key],...a[key]])];const prior=j.ghosts[r.stage];if(!prior||a.ghost.score>prior.score||(a.ghost.score===prior.score&&a.ghost.duration<prior.duration))j.ghosts[r.stage]=structuredClone(a.ghost);}
 return out;
}
export const unlocked=(save:Save,id:StageId)=>STAGES.indexOf(id)===0||save.stages[STAGES[STAGES.indexOf(id)-1]].complete;
export class SaveStore {
 data=emptySave(); blocked=false; warning='';
 constructor(private storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>|null){
  try {const raw=storage?.getItem(SAVE_KEY);if(raw!==null&&raw!==undefined)this.data=validateSave(JSON.parse(raw));}
  catch {this.blocked=true;this.warning='기존 기록을 읽지 못했어요. 원본을 보존했어요. 설정에서 복원하거나 초기화해 주세요.';}
 }
 persist(){
  if(this.blocked){this.warning='기존 원본은 보존돼 있어요. 이번 기록을 저장하지 못했어요. 기록 파일로 내보낼 수 있어요.';return false;}
  try {if(!this.storage)throw Error();this.data.savedAt=new Date().toISOString();this.storage.setItem(SAVE_KEY,JSON.stringify(this.data));this.warning='';return true;}
  catch{this.warning='이번 기록을 저장하지 못했어요. 기록 파일로 내보낼 수 있어요.';return false;}
 }
 replace(candidate:Save){
  const clean=validateSave(candidate);
  try {
   if(!this.storage)throw Error();
   const old=this.storage.getItem(SAVE_KEY);
   // Preserve the exact original, including damaged or unsupported data.
   this.storage.setItem(BACKUP_KEY,old??JSON.stringify(this.data));
   this.storage.setItem(SAVE_KEY,JSON.stringify(clean));
   this.data=clean;this.blocked=false;this.warning='';return true;
  }catch{this.warning='기록을 교체하지 못했어요. 기존 기록을 유지했어요.';return false;}
 }
 reset(){try{if(!this.storage)throw Error();this.storage.removeItem(SAVE_KEY);this.storage.removeItem(BACKUP_KEY);this.data=emptySave();this.blocked=false;this.warning='';return true;}catch{this.warning='기록을 초기화하지 못했어요. 브라우저 저장 권한을 확인해 주세요.';return false;}}
}
