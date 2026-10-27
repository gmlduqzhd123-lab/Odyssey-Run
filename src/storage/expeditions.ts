import {STAGES,type StageId} from '../levels/courses';
import {BOSS_LENGTH} from '../levels/bosses';
export interface TrialRecord {complete:boolean;bestScore:number;bestStars:number;bestRating:number;}
export interface DailyRecord extends TrialRecord {date:string;}
export interface Expeditions {bosses:Partial<Record<StageId,TrialRecord>>;daily:DailyRecord[];}
export const emptyExpeditions=():Expeditions=>({bosses:{},daily:[]});
const object=(v:unknown)=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('특별 항해 기록 형식을 확인해 주세요.');return v as Record<string,unknown>;};
export const validDay=(s:unknown):s is string=>typeof s==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
function record(raw:unknown,boss:boolean):TrialRecord {const v=object(raw);if(typeof v.complete!=='boolean')throw Error('특별 항해 완료 여부를 확인해 주세요.');const number=(k:string,max:number)=>{const n=v[k];if(typeof n!=='number'||!Number.isSafeInteger(n)||n<0||n>max)throw Error('특별 항해 점수 범위를 확인해 주세요.');return n;};const out={complete:v.complete,bestScore:number('bestScore',boss?BOSS_LENGTH/10+500:4200),bestStars:number('bestStars',boss?0:100),bestRating:number('bestRating',boss?2:3)};if(out.complete&&(out.bestRating<1||out.bestScore<(boss?BOSS_LENGTH/10+500:2900)))throw Error('특별 항해 완료 기록과 점수가 맞지 않아요.');if(boss&&!out.complete&&(out.bestRating!==0||out.bestScore>BOSS_LENGTH/10))throw Error('보스 도전의 실패 기록을 확인해 주세요.');return out;}
export function readExpeditions(raw:unknown):Expeditions {
 const out=emptyExpeditions();if(raw===undefined)return out;const v=object(raw),b=object(v.bosses);
 for(const [id,r] of Object.entries(b)){if(!STAGES.includes(id as StageId))throw Error('보스 도전의 섬을 확인해 주세요.');out.bosses[id as StageId]=record(r,true);}
 if(!Array.isArray(v.daily)||v.daily.length>14)throw Error('오늘의 항해는 최근 14일만 보관해요.');const dates=new Set<string>();
 out.daily=v.daily.map(raw=>{const r=object(raw);if(!validDay(r.date)||dates.has(r.date))throw Error('오늘의 항해 날짜 또는 중복을 확인해 주세요.');dates.add(r.date);return {...record(r,false),date:r.date};});return out;
}
export const blankTrial=():TrialRecord=>({complete:false,bestScore:0,bestStars:0,bestRating:0});
export const mergeTrial=(old:TrialRecord|undefined,r:{score:number;stars:number;rating:number},passed:boolean):TrialRecord=>({complete:!!old?.complete||passed,bestScore:Math.max(old?.bestScore??0,r.score),bestStars:Math.max(old?.bestStars??0,r.stars),bestRating:Math.max(old?.bestRating??0,r.rating)});
