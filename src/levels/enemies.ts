export const ENEMY_TYPES={
 crab:{name:'거대 집게게',behavior:'땅 위를 좌우로 순찰해요.',hint:'점프',w:68,h:46,lead:110},
 harpy:{name:'바람의 하르피아',behavior:'낮은 공중을 천천히 날아요.',hint:'숙이기',w:64,h:64,lead:140},
 stone:{name:'유적의 석상병',behavior:'다가오면 몇 걸음 앞으로 돌진해요.',hint:'점프',w:58,h:64,lead:170},
 scylla:{name:'세 머리 스킬라',behavior:'바닥의 경고 뒤에 모습을 드러내요.',hint:'점프',w:72,h:48,lead:120},
 cyclops:{name:'바위 던지는 키클롭스',behavior:'바위를 던져요. 거인과 바위를 함께 넘어요.',hint:'2단 점프',w:64,h:92,lead:210},
 shade:{name:'안개 망령',behavior:'예고 뒤에 모습을 드러내며 다가와요.',hint:'숙이기',w:64,h:60,lead:160},
} as const;
export type EnemyKind=keyof typeof ENEMY_TYPES;
export interface EnemyPlacement {id:string;kind:EnemyKind;x:number;bait?:boolean;}
export interface EnemyState {id:string;kind:EnemyKind;x:number;y:number;w:number;h:number;active:boolean;reveal:number;repelled:boolean;warning:boolean;defeated:boolean;projectile:{x:number;y:number;w:number;h:number;active:boolean};}
export function createEnemyState(e:EnemyPlacement):EnemyState {const s=ENEMY_TYPES[e.kind];return {id:e.id,kind:e.kind,x:e.x,y:440-s.h,w:s.w,h:s.h,active:true,reveal:1,repelled:false,warning:false,defeated:false,projectile:{x:e.x,y:372,w:36,h:28,active:false}};}
export function updateEnemyState(s:EnemyState,e:EnemyPlacement,playerX:number,time:number,lantern:boolean,defeated:boolean){
 const spec=ENEMY_TYPES[e.kind],d=e.x-playerX;
 s.x=e.x;s.y=440-spec.h;s.w=spec.w;s.h=spec.h;s.reveal=1;s.active=true;s.defeated=defeated;s.warning=d>=-100&&d<=700&&!defeated;s.projectile.active=false;
 s.repelled=lantern&&(e.kind==='harpy'||e.kind==='shade');
 if(e.kind==='crab')s.x+=Math.sin(time*1.4+e.x)*18;
 if(e.kind==='harpy'){s.x+=Math.sin(time*1.1+e.x)*14;s.y=336+Math.sin(time*1.2)*3;}
 if(e.kind==='stone'&&!e.bait)s.x-=Math.max(0,Math.min(60,(400-d)*.15));
 if(e.kind==='shade'){s.x-=Math.max(0,Math.min(45,(400-d)*.12));s.y=338;s.active=d<=260;}
 if(e.kind==='scylla'){s.reveal=Math.max(0,Math.min(1,(360-d)/180));s.h=spec.h*s.reveal;s.y=440-s.h;s.active=s.reveal>0;}
 if(e.kind==='cyclops'){const t=Math.max(0,Math.min(1,(480-d)/480));s.projectile.x=e.x+20-t*180;s.projectile.y=372;s.projectile.active=d<480&&d>-80&&!lantern&&!defeated;}
 if(s.repelled||defeated)s.active=false;
}
