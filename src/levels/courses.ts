import { C } from '../config';
import {ADVENTURE_PLANS,type AdventurePlan} from './adventure';
import type {VariantId} from './course-ids';
import type {EnemyKind,EnemyPlacement} from './enemies';
export const STAGES = ['beach','cave','wind'] as const;
export type StageId = typeof STAGES[number];
export type ItemKind = 'star'|'map'|'shield'|'wings'|'magnet'|'apple'|'trident'|'lantern'|'compass';
export interface Collectible {id:string;kind:ItemKind;x:number;y:number;checkpoint?:number;}
export interface Rect {x:number;y:number;w:number;h:number;}
export interface Obstacle extends Rect {id:string;kind:'crate'|'pillar'|'gate'|'rock'|'falling'|'hand';role:'structure'|'hazard';}
export interface Platform {id:string;x:number;y:number;w:number; moving?:boolean;}
export interface Course {id:StageId;length?:number;variant?:VariantId;routeName?:string;adventure?:AdventurePlan;name:string;subtitle:string;description:string;color:string;gaps:{x:number;w:number}[];obstacles:Obstacle[];platforms:Platform[];winds:Rect[];safe:number[];items:Collectible[];enemies:EnemyPlacement[];}
const meta = {
 beach:{name:'출항의 해변',subtitle:'THE DEPARTURE',description:'푸른 파도를 따라, 귀환의 첫걸음을 내디뎌요.',color:'#79c4c6'},
 cave:{name:'키클롭스의 동굴',subtitle:'THE CYCLOPS',description:'거인의 발소리를 뒤로하고 동굴의 빛을 찾아요.',color:'#aca4cd'},
 wind:{name:'아이올로스의 바람 섬',subtitle:'THE WINDS',description:'바람을 타고 구름 너머 이타카로 향해요.',color:'#afc9a2'}
};
// All courses are deterministic. Coordinates are world-space logical pixels.
const plans:Record<StageId,{crates:number[];pillars:number[];gates:number[];gaps:number[];rocks:number[]}> = {
 beach:{crates:[3600,7400,11800,16200,20400],pillars:[5200,9700,14600,18700],gates:[6400,10800,17400,21600],gaps:[8500,13200,19700],rocks:[]},
 cave:{crates:[3300,7200,12200,18000,21800],pillars:[5000,10000,15500,20200],gates:[6200,11100,16600,22800],gaps:[8400,13900,19000],rocks:[4000,9200,14800,21000]},
 wind:{crates:[3700,7600,12600,17600,21000],pillars:[5400,10600,15800,22300],gates:[6500,11500,18400],gaps:[8500,14000,19800],rocks:[]}
};
function build(id:StageId):Course {
 const p=plans[id];
 const obstacles:Obstacle[]=[];
 const add=(x:number,kind:Obstacle['kind'],role:Obstacle['role'],w:number,h:number,y=C.ground-h)=>obstacles.push({id:`${id}-${kind}-${x}`,x,y,w,h,kind,role});
 p.crates.forEach(x=>add(x,'crate','structure',70,48)); p.pillars.forEach(x=>add(x,'pillar','structure',65,120));
 p.gates.forEach(x=>add(x,'gate','structure',160,125,279)); p.rocks.forEach(x=>add(x,'falling','hazard',60,64));
 const gaps=p.gaps.map(x=>({x,w:id==='wind'?210:150}));
 const winds:Rect[]=id==='wind'?[{x:1200,y:80,w:420,h:360},{x:8200,y:60,w:740,h:400},{x:13600,y:40,w:800,h:410},{x:19500,y:40,w:850,h:410}]:[];
 const platforms:Platform[]=id==='wind'?[{id:'wind-floating-1',x:2300,y:330,w:230,moving:true},{id:'wind-floating-2',x:14100,y:340,w:150,moving:true},{id:'wind-floating-3',x:19850,y:350,w:180,moving:true}]:[];
 const items:Collectible[]=[];
 // Twenty readable trails of five stars. Trails precede the hazards they teach.
 for(let group=0;group<20;group++) {
  const start=850+group*1150;
  for(let j=0;j<5;j++) {
   const x=start+j*65;
   let y=405;
   const obs=obstacles.find(o=>x>o.x-180&&x<o.x+o.w+100);
   if(obs?.kind==='gate') y=421;
   else if(obs) y=obs.kind==='pillar'?225:320-Math.sin(j/4*Math.PI)*24;
   if(gaps.some(g=>x>g.x-100&&x<g.x+g.w+100))y=300;
   items.push({id:`${id}-star-${group*5+j+1}`,kind:'star',x,y});
  }
 }
 const highMapX=id==='beach'?15400:id==='wind'?9500:5750;
 const guides=[...items].sort((a,b)=>Math.abs(a.x-highMapX)-Math.abs(b.x-highMapX)).slice(0,5);
 guides.forEach((item,j)=>{item.x=highMapX-180+j*60;item.y=[355,290,225,205,260][j];});
 items.push({id:`${id}-map-1`,kind:'map',x:2700,y:395},{id:`${id}-map-2`,kind:'map',x:highMapX,y:205},{id:`${id}-map-3`,kind:'map',x: p.gates[1]+80,y:421});
 const powers:ItemKind[]=['shield','wings','magnet','apple','shield','wings','magnet','apple'];
 powers.forEach((kind,i)=>items.push({id:`${id}-${kind}-${i}`,kind,x:1900+i*2700,y:395}));
 const groundKinds:Record<StageId,EnemyKind[]>={beach:['crab','scylla','crab','scylla'],cave:['stone','cyclops','stone','cyclops'],wind:['scylla','crab','stone','scylla']};
 const enemies:EnemyPlacement[]=p.crates.slice(1).map((x,i)=>({id:`${id}-enemy-ground-${i+1}`,kind:groundKinds[id][i],x}));
 const air=id==='beach'?[5700,13900,18100]:id==='cave'?[4500,12900,19500]:[4300,12000,21600];
 air.forEach((x,i)=>enemies.push({id:`${id}-enemy-air-${i+1}`,kind:id==='cave'?'shade':'harpy',x}));
 // Replace four crate encounters, leaving tutorial crate, pillars, gates and gaps.
 for(let i=obstacles.length-1;i>=0;i--)if(obstacles[i].kind==='crate'&&p.crates.slice(1).includes(obstacles[i].x))obstacles.splice(i,1);
 const extra:Record<StageId,{trident:number[];lantern:number[];compass:number[]}>={beach:{trident:[4200,15100],lantern:[12900,17800],compass:[7800,16800]},cave:{trident:[3500,16000],lantern:[11800,19280],compass:[7900,18400]},wind:{trident:[4600,16500],lantern:[11900,21300],compass:[8000,17900]}};
 for(const kind of ['trident','lantern','compass'] as const)extra[id][kind].forEach((x,i)=>items.push({id:`${id}-${kind}-extra-${i+1}`,kind,x,y:id==='wind'&&kind==='lantern'&&i===0?421:395,...(kind==='compass'?{checkpoint:x-80}:{})}));
 const adventure=ADVENTURE_PLANS[id];
 platforms.push({id:adventure.branch.id,x:adventure.branch.start,y:330,w:adventure.branch.end-adventure.branch.start});
 if(id==='cave'){
  add(13400,'hand','hazard',140,39,365);
  [12200,21800].forEach((x,i)=>enemies.push({id:`cave-bait-${i}`,kind:'stone',x:x-105,bait:true}));
 }
 if(id==='wind')platforms.push({id:'wind-cloud-1',x:20200,y:300,w:180},{id:'wind-cloud-2',x:20500,y:365,w:180});
 // Keep the original 100 star IDs and score cap; redistribute only three trails.
 const shapes=[[[-120,-10],[-60,10],[0,-30],[60,10],[120,-10]],[[-120,0],[-60,-35],[0,-10],[60,-35],[120,0]],[[-120,0],[-60,-35],[0,0],[60,-35],[120,0]]];
 adventure.constellations.forEach((group,index)=>group.stars.forEach((starId,j)=>{const star=items.find(i=>i.id===starId)!;const centers=id==='beach'?[4430,7800,22200]:id==='cave'?[7770,9600,23300]:[4430,7800,23100];star.x=centers[index]+shapes[index][j][0];star.y=(index===0?295:405)+shapes[index][j][1];}));
 items.find(i=>i.id===`${id}-magnet-2`)!.x=4800;
 items.find(i=>i.id===`${id}-lantern-extra-1`)!.x=id==='cave'?4150:id==='beach'?4300:6900;
 const safe=safePoints({gaps,obstacles,enemies},[0,3000,6900,9000,12000,14400,17000,20100,23000]);
 return {id,...meta[id],gaps,obstacles,platforms,winds,safe,items,enemies};
}
// A fall returns to the nearest clear ground at most this far before the gap.
export const SAFE_LEAD={min:600,max:2400} as const;
export function safePoints(c:Pick<Course,'gaps'|'obstacles'|'enemies'>,candidates:number[]):number[] {
 const clear=(x:number)=>!c.gaps.some(g=>x>=g.x-200&&x<=g.x+g.w+350)&&!c.obstacles.some(o=>x>=o.x-450&&x<o.x+o.w+80)&&!c.enemies.some(e=>e.x>=x-120&&e.x<x+450);
 const out=candidates.filter(clear);
 for(const g of c.gaps)for(let x=g.x-SAFE_LEAD.min;x>=g.x-SAFE_LEAD.max;x-=50)if(clear(x)){out.push(x);break;}
 return [...new Set(out)].sort((a,b)=>a-b);
}
export const COURSES=Object.fromEntries(STAGES.map(id=>[id,build(id)])) as Record<StageId,Course>;
export const MAP_STORIES = [
 ['귀환의 약속','트로이를 떠난 오디세우스는 고향 이타카로 향했어요. 길고 긴 항해의 시작이에요.'],
 ['밤하늘의 길잡이','고대의 뱃사람들은 별을 보며 바다 위에서 길을 찾았어요.'],
 ['지혜로운 영웅','오디세우스의 가장 큰 힘은 용기와 지혜, 그리고 포기하지 않는 마음이에요.'],
 ['외눈박이 거인','키클롭스는 커다란 눈 하나를 가진 거인이에요. 오디세우스는 동굴에서 탈출할 꾀를 냈어요.'],
 ['아무도 아닌 사람','오디세우스는 거인에게 자신을 ‘아무도 아닌 사람’이라고 소개했어요.'],
 ['함께 찾은 출구','영웅의 모험에는 늘 동료가 있었어요. 서로를 도와 어려움을 넘었지요.'],
 ['바람의 주인','아이올로스는 바람을 다스렸어요. 그는 오디세우스에게 바람이 담긴 자루를 주었어요.'],
 ['고향을 향한 바람','순풍이 불면 배는 고향으로 나아가요. 하지만 항해에는 예상하지 못한 일이 생기기도 해요.'],
 ['마침내 이타카','긴 여정 끝에 돌아온 고향. 오디세우스의 귀환 이야기는 《오디세이아》에 전해져요.']
];
