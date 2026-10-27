import type {EnemyKind} from '../levels/enemies';
import type {Obstacle} from '../levels/courses';
export type DamageKind=EnemyKind|Obstacle['kind']|'fall'|'projectile'|'contact';
export interface DamageEvent {kind:DamageKind;x:number;time:number;}
const guidance:Record<DamageKind,{name:string;hint:string}>={
 crate:{name:'나무 상자',hint:'상자 앞에서 점프해 넘어가 보세요.'},pillar:{name:'높은 기둥',hint:'첫 점프 후 공중에서 한 번 더 눌러 높이 넘어가 보세요.'},gate:{name:'낮은 문',hint:'문에 들어가기 전에 숙이기를 누르고 통과할 때까지 유지해 보세요.'},hand:{name:'거인의 손',hint:'손 아래에서는 숙이기를 유지하고, 통과한 뒤 점프해 보세요.'},rock:{name:'바위',hint:'바위 앞에서 점프해 넘어가 보세요.'},falling:{name:'낙석',hint:'금빛 경고 위치를 보고 바위에 닿기 전에 점프해 보세요.'},fall:{name:'낭떠러지',hint:'틈의 앞에서 점프하고 공중 점프를 조금 늦게 눌러 보세요.'},projectile:{name:'거인이 던진 바위',hint:'거인과 바위를 함께 넘도록 2단 점프해 보세요.'},crab:{name:'거대 집게게',hint:'집게게의 순찰 범위 앞에서 점프해 보세요.'},harpy:{name:'하르피아',hint:'땅에 착지한 뒤 숙이기를 유지해 낮게 통과해 보세요.'},stone:{name:'석상병',hint:'돌진 예고를 보고 석상병 앞에서 점프해 보세요.'},scylla:{name:'스킬라',hint:'바닥의 경고 위치가 다가오면 점프해 보세요.'},cyclops:{name:'키클롭스',hint:'거인 앞에서 점프하고 공중에서 한 번 더 눌러 보세요.'},shade:{name:'안개 망령',hint:'망령의 예고가 보이면 지상에서 숙여 통과해 보세요.'},contact:{name:'장애물 접촉',hint:'별빛이 이어지는 길과 앞쪽 위험 표시를 함께 살펴보세요.'}
};
export const damageGuidance=(e:DamageEvent)=>({...guidance[e.kind],meters:Math.floor(e.x/10)});
