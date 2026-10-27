import {C} from '../config';
import {COURSES,STAGES,type StageId,type Course,type Obstacle} from './courses';
import {ADVENTURE_PLANS} from './adventure';
import {ENEMY_TYPES,type EnemyKind} from './enemies';
export const BOSS_LENGTH=9600;
export const BOSSES={beach:{name:'스킬라의 해협',description:'집게의 순찰 → 스킬라의 출현 → 하르피아의 비행을 읽어요.',phases:['집게의 순찰 · 점프','세 머리의 경고 · 점프','공중 협공 · 숙이기']},cave:{name:'키클롭스의 결투',description:'돌진과 투척을 읽고 마지막 거인의 손 아래로 빠져나와요.',phases:['석상병의 돌진 · 점프','거인의 투척 · 2단 점프','거인의 손 · 숙이기']},wind:{name:'폭풍의 수호자',description:'공중의 경고를 숙여 피하고 바람길과 절벽을 건너요.',phases:['바람의 하르피아 · 숙이기','안개 속 수호자 · 숙이기','폭풍의 틈 · 바람과 점프']}} as const;
function build(stage:StageId):Course {
 const base=COURSES[stage],plan=structuredClone(ADVENTURE_PLANS[stage]);
 plan.branch={...plan.branch,start:30000,end:31000};plan.stories=[];plan.constellations=[];plan.highlight={id:stage+'-boss-final',start:6300,end:8900,name:BOSSES[stage].name,hint:BOSSES[stage].phases[2]};
 const kinds:Record<StageId,EnemyKind[]>={beach:['crab','crab','scylla','scylla','harpy','harpy'],cave:['stone','stone','cyclops','cyclops','shade','shade'],wind:['harpy','harpy','shade','shade','scylla','scylla']};
 const obstacles:Obstacle[]=stage==='cave'?[{id:'cave-boss-hand',kind:'hand',x:8400,y:365,w:180,h:39}]:[];
 return {...base,name:BOSSES[stage].name,length:BOSS_LENGTH,adventure:plan,routeName:BOSSES[stage].name,items:[],platforms:[],obstacles,gaps:stage==='wind'?[{x:8500,w:180}]:[],winds:stage==='wind'?[{x:8200,y:70,w:650,h:370}]:[],safe:[0,2800,6000,9000],enemies:kinds[stage].map((kind,i)=>({id:`${stage}-boss-${i+1}`,kind,x:1500+i*1200}))};
}
export const BOSS_COURSES=Object.fromEntries(STAGES.map(id=>[id,build(id)])) as Record<StageId,Course>;
// Phase hints switch when the first attack in that phase becomes visible.
export function bossPhase(stage:StageId,x:number){const enemies=BOSS_COURSES[stage].enemies;return x>=enemies[4].x-700?2:x>=enemies[2].x-700?1:0;}
// Authored input plan, also used by the course verifier. No player-state overrides.
export function bossInputs(stage:StageId){
 const jumps:number[]=[],slides:{start:number;end:number}[]=[];
 BOSS_COURSES[stage].enemies.forEach(e=>{if(e.kind==='harpy'||e.kind==='shade')slides.push({start:e.x-300,end:e.x+180});else if(e.kind==='cyclops')jumps.push(e.x-210,e.x-80);else jumps.push(e.x-ENEMY_TYPES[e.kind].lead);});
 if(stage==='cave')slides.push({start:8120,end:8650});if(stage==='wind')jumps.push(8310,8440);
 return {jumps:jumps.sort((a,b)=>a-b),slides};
}
