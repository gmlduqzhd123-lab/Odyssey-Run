import {ADVENTURE_PLANS,GOALS,type GoalId} from '../levels/adventure';
import {ghostDistance} from '../storage/journal';
import {harborArt,harborUnlocks,harborRequirements,journalCards} from './adventure-view';
import Phaser from 'phaser';
import {C} from '../config';
import {COURSES,STAGES,MAP_STORIES,type StageId} from '../levels/courses';
import {Runner} from '../player/runner';
import {SaveStore,SAVE_KEY,mergeResult,unlocked,validateSave,courseRecord,courseGhost,type Save,type RunResult,type Settings} from '../storage/save';
import {VARIANTS,VARIANT_LABELS} from '../levels/variants';
import {isVariant,type VariantId} from '../levels/course-ids';
import {Controls} from '../input/controls';
import {Sound} from '../systems/audio';
import {World} from '../scenes/World';
import {assetUrl,PEOPLE,RELICS,STAGE_RELIC} from '../assets/catalog';
import {ART_SHEETS,STAGE_VIEW,regionArt,sheetUrl} from '../assets/terrain';
import {ENEMY_TYPES,type EnemyKind} from '../levels/enemies';
import {MONSTER_ART} from '../assets/expansion-art';
import {displayDensity} from '../rendering/display';
const asset=assetUrl;
const icon=(name:string,cls='')=>`<img class="icon ${cls}" src="${asset(name)}" alt="">`;
const button=(action:string,text:string,cls='',extra='')=>`<button class="${cls}" data-action="${action}" ${extra}>${text}</button>`;
export class App {
 private ui=document.querySelector<HTMLDivElement>('#ui')!;private store:SaveStore;private world:World;private game:Phaser.Game;
 private controls:Controls;private sound:Sound;private run:Runner|null=null;private result:RunResult|null=null;private screen='loading';private returnScreen='home';private selected:StageId='beach';
 private accumulator=0;private countdown=0;private imported:Save|null=null;private lastHud='';private destroyed=false;private abort=new AbortController();
 private renderDensity=displayDensity(document.querySelector('#shell')!.getBoundingClientRect().width,window.devicePixelRatio);private displayObserver:ResizeObserver;
 private importRequest=0;private selectedGoal:GoalId='maps';private selectedVariant:VariantId='classic';
 constructor(){
  let storage:Storage|null=null;try{storage=localStorage;}catch{}
  this.store=new SaveStore(storage);this.selected=this.store.data.lastStage;this.sound=new Sound(()=>this.store.data.settings);
  this.controls=new Controls({jump:()=>{this.sound.unlock();this.run?.jump();},slide:held=>this.run?.slide(held),pause:()=>this.pause(),active:()=>this.screen==='play'&&this.run?.state==='playing',pauseActive:()=>['play','countdown'].includes(this.screen)});
  this.world=new World({frame:d=>this.frame(d),loaded:()=>this.home(),loadError:()=>this.error(),reduced:()=>this.store.data.settings.reducedMotion,density:()=>this.renderDensity});
  this.game=new Phaser.Game({type:Phaser.CANVAS,parent:'game',width:C.width*this.renderDensity,height:C.height*this.renderDensity,backgroundColor:'#102f46',scene:this.world,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},render:{antialias:true,roundPixels:false,clearBeforeRender:false},audio:{noAudio:true},fps:{smoothStep:false,target:60},banner:false});
  this.displayObserver=new ResizeObserver(()=>this.resizeDisplay());this.displayObserver.observe(document.querySelector('#shell')!);
  this.ui.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-action]');if(b&&!b.hasAttribute('disabled')){this.sound.unlock();this.action(b.dataset.action!);}},{signal:this.abort.signal});
  this.ui.addEventListener('change',e=>this.change(e),{signal:this.abort.signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.suspend();},{signal:this.abort.signal});
  window.addEventListener('blur',()=>this.suspend(),{signal:this.abort.signal});window.addEventListener('resize',()=>{this.orientation();this.resizeDisplay();},{signal:this.abort.signal});
  document.querySelector('#rotate-menu')!.addEventListener('click',()=>{this.abandon();this.islands();},{signal:this.abort.signal});
  window.addEventListener('pagehide',()=>this.suspend(),{signal:this.abort.signal});
 }
 private notice(message=this.store.warning){const n=document.querySelector<HTMLElement>('#notice')!;n.textContent=message;n.hidden=!message;}
 private set(html:string,screen:string){this.importRequest++;this.screen=screen;this.controls.clear();this.run?.clearInput();this.ui.innerHTML=html;const play=this.ui.querySelector<HTMLElement>('.play-ui');if(play)play.inert=['pause','countdown'].includes(screen);this.lastHud='';this.orientation();this.notice();queueMicrotask(()=>this.ui.querySelector<HTMLElement>('[autofocus], h1[tabindex], h2[tabindex]')?.focus({preventScroll:true}));}
 private header(label:string,back='home'){return `<header class="topbar">${button(back,'← <span>돌아가기</span>','text-button')}<span class="brand">${icon('compass')} ${label}</span><span class="edition">ODYSSEY RUN / VOL. 01</span><span class="ys-key"><button type="button" class="ys-chip" data-ys-install>📲 <span class="ys-wide">앱 </span>설치</button><button type="button" class="ys-chip" data-qr aria-label="QR 코드로 접속">📱 QR</button></span></header>`;}
 home(){
  this.abandon();this.world.showHome();const done=STAGES.every(id=>this.store.data.stages[id].complete);
  this.set(`<div class="home">${this.header('ODYSSEY RUN','home')}<div class="home-copy"><span class="eyebrow"><i></i> 작은 영웅의 긴 귀환</span><h1 tabindex="-1">오디세이 런<span>이타카로!</span></h1><p>별자리를 잇고, 숨은 이야기를 찾고,<br>우리만의 항구를 완성하러 떠나요.</p><div class="home-actions">${button('islands','항해 시작 <span>↗</span>','primary large')}${button('codex',icon('map')+' 지도 도감','secondary')}</div><div class="home-status">${done?'⚑ 귀환 완료 · ':''}도장 ${this.store.data.journal.stamps.length}/12 · 별자리 ${this.store.data.journal.constellations.length}/9 · 이야기 ${this.store.data.journal.stories.length}/6</div></div><div class="hero-caption"><span>ODYSSEUS</span><b>지혜로운 작은 영웅</b><i>“이번에는 꼭, 이타카로!”</i></div><div class="home-bottom">${button('harbor','⚓ 나의 항구','text-button')}${button('journal','✧ 모험 수첩','text-button')}${button('settings','⚙ 설정','text-button')}${button('quit','게임 종료','text-button')}</div></div>`,'home');this.game.loop.wake();
 }
 private islands(){
  this.abandon();this.world.showHome();const save=this.store.data;const count=STAGES.reduce((n,id)=>n+save.stages[id].maps.length,0);
  this.set(`<div class="page islands">${this.header('항해 지도')}<div class="page-heading"><span class="eyebrow">YOUR JOURNEY HOME</span><h1 tabindex="-1">어느 섬으로 떠날까요?</h1><p>앞선 섬을 완주하면 다음 항로가 열려요.</p><span class="map-total">${icon('map')} ${count} / 9 발견 ${count===9?'· 지도 완성!':''}</span></div><div class="island-grid">${STAGES.map((id,i)=>{const c=COURSES[id],r=save.stages[id],open=unlocked(save,id);return `<button class="island-card ${open?'':'locked'}" data-action="stage:${id}" ${open?'':`disabled aria-label="${c.name}, ${COURSES[STAGES[i-1]].name} 완주 후 해금"`}><div class="island-art ${id}" style="background-image:url('${asset(id+'-mid')}'),url('${asset(id+'-far')}'),url('${asset(id+'-sky')}')">${regionArt(STAGE_VIEW[id],'stage-illustration')}<span class="card-number">0${i+1}</span><span class="island-badge">${r.complete?'⚑ 완주':open?'탐험 가능':'🔒 잠긴 항로'}</span></div><div class="card-copy"><span class="eyebrow">${c.subtitle}</span><h2>${c.name}</h2>${open?`<div class="record-line"><span class="rating">${'★'.repeat(r.bestRating)}<em>${'☆'.repeat(3-r.bestRating)}</em></span><span>지도 ${r.maps.length}/3</span></div><div class="card-bottom"><span>전체 최고 <b>${r.bestScore.toLocaleString()}</b> · 코스 3개</span><span class="round-arrow">↗</span></div>`:`<p class="unlock-hint">${COURSES[STAGES[i-1]].name}<br>완주 후 열려요</p>`}</div></button>`;}).join('')}</div><div class="page-foot"><span>${STAGES.every(id=>save.stages[id].complete)?'⚑ 전체 귀환 완료! 이타카가 영웅을 반겨요.':'서두르지 않아도 괜찮아요. 다시 도전할 수 있으니까요.'}</span>${button('codex','지도 도감 →','text-button')}</div></div>`,'islands');
 }
 private prepare(id:StageId){
  if(!unlocked(this.store.data,id)){this.islands();return;}
  this.selected=id;this.selectedVariant='classic';this.store.data.lastStage=id;this.store.persist();this.world.setStage(id);this.sound.setStage(id);
  const c=COURSES[id];this.set(`<div class="veil"><section class="panel prepare">${button('islands','← 항해 지도','text-button back')}<span class="eyebrow">${icon(STAGE_RELIC[id])} ISLAND 0${STAGES.indexOf(id)+1} / ${c.subtitle}</span><h1 tabindex="-1">${c.name}</h1><p>${c.description}</p>${regionArt(STAGE_VIEW[id],'prepare-art',c.name+' 풍경')}<div class="control-guide"><div><kbd>Space / ↑</kbd><b>점프</b><span>공중에서 한 번 더!</span></div><div><kbd>↓ 꾹</kbd><b>슬라이드</b><span>낮은 문을 통과해요</span></div><div><kbd>P / Esc</kbd><b>일시정지</b><span>잠깐 쉬어 가도 돼요</span></div></div><p class="touch-hint">스마트폰에서는 화면의 점프·슬라이드 버튼을 사용해요.</p><div class="goal-line">♡ 체력 3 &nbsp; ✦ 별빛 100 &nbsp; ${icon('map')} 지도 3</div>${this.coursePicker(id)}<fieldset class="challenge-picker"><legend>이번 항해의 도전 · 하나를 골라요</legend>${Object.entries(GOALS).map(([id,g])=>`<label><input type="radio" name="goal" value="${id}" ${id===this.selectedGoal?'checked':''}><span><b>${g.name}</b><small>${g.description}</small></span></label>`).join('')}</fieldset><p class="route-hint">↑ 높은 유적길: 별자리·이야기 / 아래: 익숙한 항로</p>${button('start','이 섬 달리기 <span>→</span>','primary large')}<small>약 75초 · 몬스터 ${c.enemies.length}마리 · 아이템 8종 · 아이템 없이도 완주 가능</small></section></div>`,'prepare');
 }
 private coursePicker(id:StageId){
  return `<fieldset class="course-picker"><legend>이번에 달릴 코스 · 섬마다 3개</legend>${VARIANTS.map(variant=>{const meta=VARIANT_LABELS[id][variant],record=courseRecord(this.store.data,id,variant);return `<label><input type="radio" name="course" value="${variant}" ${variant===this.selectedVariant?'checked':''}><span><b>${meta.name}</b><small>${meta.description}</small><em>${record.complete?'⚑ 완주':'아직 완주 전'} · 최고 ${record.bestScore.toLocaleString()} · ${'★'.repeat(record.bestRating)}${'☆'.repeat(3-record.bestRating)}</em></span></label>`;}).join('')}<p>모든 코스는 약 75초 · 별빛 100 · 지도 3<br>어느 코스든 완주하면 다음 섬이 열려요. 지도와 발견은 함께 모아요.</p></fieldset>`;
 }
 private start(){
  if(!unlocked(this.store.data,this.selected)){this.islands();return;}
  this.abandon();this.sound.setStage(this.selected,true);this.result=null;this.run=new Runner(this.selected,this.selectedGoal,this.selectedVariant);this.world.showRun(this.run);this.store.data.tutorialSeen=true;this.store.persist();this.beginCountdown();
 }
 private hud(){return `<div class="play-ui"><div class="hud"><div class="hp-block"><span class="hud-caption">오디세우스</span><strong id="hp" aria-label="체력 3"></strong></div><div class="route-progress"><span>${COURSES[this.selected].name} · ${VARIANT_LABELS[this.selected][this.selectedVariant].name}</span><progress id="progress" data-course="${this.selected}/${this.selectedVariant}" max="24000" value="0" aria-label="섬 진행률"></progress><i id="ghost-marker" hidden aria-label="비교 항해 위치"></i><small id="progress-label">0%</small></div><div class="score-block"><span class="hud-caption">SCORE</span><strong id="score">0</strong></div>${button('pause','Ⅱ','pause-button','aria-label="일시정지"')}</div><div class="run-details"><span id="stars">✦ 0 / 100</span><span id="maps">지도 0 / 3</span><span id="effects"></span></div><div class="adventure-hud"><span id="goal-progress"></span><span id="ghost-delta"></span><span id="discovery-progress"></span></div><div class="touch-controls"><button data-control="slide" class="control slide" aria-label="슬라이드, 누르고 유지"><span>⇣</span><b>슬라이드</b><small>↓ 누르기</small></button><button data-control="jump" class="control jump" aria-label="점프, 공중에서 다시 누르면 2단 점프"><span>↟</span><b>점프</b><small>Space / ↑</small></button></div></div>`;}
 private beginCountdown(){
  this.countdown=3;this.accumulator=0;this.sound.setPlaying(false);this.run!.state='ready';
  this.set(this.hud()+`<div class="countdown"><span>준비됐나요?</span><strong id="count">3</strong><small>점프 · 2단 점프 · 슬라이드</small>${button('pause','잠시 멈추기','secondary')}</div>`,'countdown');this.controls.bind(this.ui);this.updateHud();
 }
 private play(){this.countdown=0;this.run!.state='playing';this.set(this.hud(),'play');this.controls.bind(this.ui);this.sound.setPlaying(true);this.updateHud();}
 private pause(){
  if(!this.run||!['play','countdown'].includes(this.screen))return;
  this.run.state='paused';this.accumulator=0;this.sound.setPlaying(false);this.controls.clear();this.run.clearInput();
  this.set(this.hud()+`<div class="veil"><section class="panel pause-panel"><span class="eyebrow">TAKE A BREATH</span><h1 tabindex="-1">잠깐, 쉬어 가요</h1><p>이타카는 기다려 줄 거예요.</p>${button('resume','계속 달리기 →','primary large')}<div class="button-row">${button('restart','다시 시작','secondary')}${button('islands','섬 선택','secondary')}</div>${button('quit','게임 종료','text-button')}<div class="pause-sound">${this.settingToggle('music','배경음')}${this.settingToggle('sfx','효과음')}</div></section></div>`,'pause');this.updateHud();
 }
 private suspend(){if(['play','countdown'].includes(this.screen))this.pause();this.controls.clear();this.sound.setPlaying(false);}
 private abandon(){if(this.run){this.run.clearInput();this.run.state='paused';}this.run=null;this.accumulator=0;this.controls.clear();this.sound.setPlaying(false);}
 private finish(){
  if(!this.run||this.result)return;
  this.result=this.run.result();this.store.data=mergeResult(this.store.data,this.result);this.store.persist();this.sound.setPlaying(false);this.controls.clear();
  const r=this.result,record=this.store.data.stages[r.stage],routeRecord=courseRecord(this.store.data,r.stage,r.variant??'classic'),last=r.stage==='wind',next=STAGES[STAGES.indexOf(r.stage)+1];
  this.set(`<div class="veil result-veil"><section class="panel result"><span class="eyebrow">${r.complete?icon('laurel'):''} ${r.complete?'ISLAND COMPLETE':'THE JOURNEY CONTINUES'}</span><h1 tabindex="-1">${r.complete?(last?'마침내, 이타카!':'멋진 항해였어요!'):(r.stage==='cave'?'거인에게 잡혔어요!':'다시, 한 걸음 더!')}</h1><p>${r.complete?(last?'오디세우스가 고향 항구에 도착했어요. 긴 모험을 함께해 줘서 고마워요.':COURSES[r.stage].name+' 완주! 다음 섬의 항로가 열렸어요.'):'괜찮아요. 익숙해질수록 더 멀리 갈 수 있어요.'}</p>${last&&r.complete?regionArt('view-ithaca','ending-art','이타카 도착 항구'):''}<p class="course-result-label">${VARIANT_LABELS[r.stage][r.variant??'classic'].name}</p><div class="mission-badge">${r.adventure?.stamps.length?'✓ 도전 도장 · '+GOALS[this.selectedGoal].name:'◇ 다음 항해에서 도전에 다시 도전해요'}</div><div class="result-stars" aria-label="이번 평점 ${r.rating}점">${'★'.repeat(r.rating)}<em>${'☆'.repeat(3-r.rating)}</em></div><div class="result-score"><span>이번 항해 점수</span><strong>${r.score.toLocaleString()}</strong><small>코스 최고 ${routeRecord.bestScore.toLocaleString()} ${r.score===routeRecord.bestScore?'· NEW BEST':''}<br>섬 전체 최고 ${record.bestScore.toLocaleString()}</small></div><div class="score-breakdown"><div><span>최고 전진거리</span><b>${Math.floor(r.distance/10)}</b></div><div><span>별빛 ${r.stars} × 10</span><b>${r.stars*10}</b></div><div><span>지도 ${r.maps.length} × 100</span><b>${r.maps.length*100}</b></div><div><span>완주 보너스</span><b>${r.complete?500:0}</b></div></div><div class="result-summary"><span>♡ HP 손실 ${r.hpLoss}회</span><span>${icon('map')} 영구 지도 ${record.maps.length}/3</span></div><small class="rating-help">완주 ★ · 별빛 70개 이상 ★ · HP 손실 0회 ★</small><div class="result-actions">${button('restart','재도전','secondary')}${button('stage:'+r.stage,'다른 코스 고르기','secondary')}${r.complete&&next?button('stage:'+next,'다음 섬으로 →','primary'):button('islands','섬 선택 →','primary')}</div>${r.complete&&next?button('islands','섬 선택','text-button'):''}${last&&r.complete?button('codex','귀환의 지도 보기','text-button'):''}<div class="adventure-result"><b>${r.adventure?.stamps.length?'✓ 도전 성공! '+GOALS[this.selectedGoal].name:'이번 도전: '+GOALS[this.selectedGoal].name}</b><p>아슬아슬 회피 ${r.adventure?.nearMisses||0} · 몬스터 회피 ${r.adventure?.evaded||0} · 유도 격파 ${r.adventure?.tricked||0}<br>별자리 ${r.adventure?.constellations.length||0} · 이야기 ${r.adventure?.stories.length||0} · 조합 ${r.adventure?.combos.length||0}</p>${button('journal','모험 수첩','text-button')}${button('harbor','달라진 항구 보기','text-button')}${button('quit','게임 종료','text-button')}</div></section></div>`,'result');
 }
 private codex(){
  const found=new Set(STAGES.flatMap(id=>this.store.data.stages[id].maps));
  this.set(`<div class="page codex">${this.header('귀환의 지도')}<div class="page-heading"><span class="eyebrow">FRAGMENTS OF THE ODYSSEY</span><h1 tabindex="-1">이야기를 모아, 이타카로</h1><p>${found.size?`아홉 조각 중 ${found.size}개를 찾았어요. 조각을 눌러 이야기를 읽어 보세요.`:'아직 지도가 비어 있어요. 첫 섬으로 탐험을 떠나 보세요!'}</p></div>${this.bookNav('codex')}<div class="fragment-grid">${STAGES.flatMap((id,i)=>[1,2,3].map((n,j)=>{const idx=i*3+j,yes=found.has(`${id}-map-${n}`);return `<button class="fragment ${yes?'found':''}" data-action="story:${idx}" ${yes?'':'disabled'}>${yes?icon('map'):'<span class="unknown">?</span>'}<span class="fragment-number">0${idx+1}</span><b>${yes?MAP_STORIES[idx][0]:'아직 발견하지 못했어요'}</b><small>${COURSES[id].name} · ${n}번 조각</small></button>`;})).join('')}</div><div class="page-foot"><span>${found.size===9?'모든 지도가 모였어요. 당신만의 오디세이가 완성됐네요.':'지도는 기본 경로, 2단 점프 경로, 슬라이드 경로에서 찾을 수 있어요.'}</span>${button('islands','탐험하기 →','text-button')}</div></div>`,'codex');
 }
 private bookNav(active:string){return `<nav class="book-nav" aria-label="도감 종류">${[['codex','지도 조각'],['journal','모험 수첩'],['harbor','이타카 항구'],['people','여정의 인물'],['relics','아이템과 상징'],['bestiary','몬스터'],['landscapes','풍경과 원화']].map(([id,label])=>button(id,label,'book-tab',active===id?'aria-current="page"':'')).join('')}</nav>`;}
 private landscapes(){
  this.set(`<div class="page landscapes">${this.header('항해 도감')}<div class="page-heading"><span class="eyebrow">ISLANDS & LEGENDS</span><h1 tabindex="-1">바다 너머의 풍경과 전설</h1><p>원화를 누르면 크게 볼 수 있어요. 그림 속 다른 섬과 몬스터는 이야기로 만나요.</p></div>${this.bookNav('landscapes')}<div class="sheet-grid">${ART_SHEETS.map(s=>`<button class="sheet-card" data-action="sheet:${s.id}"><img src="${sheetUrl(s.id)}" alt="${s.name} 원화 미리보기" loading="lazy" decoding="async"><span><strong>${s.name}</strong><small>${s.description}</small><b>원화 펼치기 ↗</b></span></button>`).join('')}</div><p class="gallery-note">달리는 항로는 해변·동굴·바람 섬이에요. 원화에 적힌 추가 공격과 효과는 이번 항해에 등장하지 않아요.</p></div>`,'landscapes');
 }
 private sheet(id:string){
  const s=ART_SHEETS.find(s=>s.id===id);if(!s)return;
  this.set(`<div class="page art-detail">${this.header('풍경과 원화','landscapes')}<div class="page-heading"><span class="eyebrow">ODYSSEY ARTBOOK</span><h1 tabindex="-1">${s.name}</h1><p>${s.description}</p><div class="sheet-tools">${button('sheet-zoom','원본 크기로 확대','secondary','aria-pressed="false"')}<small>확대 후 그림을 좌우·위아래로 움직여 볼 수 있어요.</small></div></div><div class="sheet-viewer" tabindex="0" role="region" aria-label="${s.name} 확대 그림, 방향키로 이동"><img src="${sheetUrl(s.id)}" alt="${s.name}. 확대해서 원화의 그림과 설명을 살펴보세요."></div><p class="gallery-note">그림 속 추가 공격과 효과는 이번 항해에 등장하지 않아요.</p></div>`,'sheet');
 }
 private people(){
  this.set(`<div class="page people">${this.header('항해 도감')}<div class="page-heading"><span class="eyebrow">FACES OF THE ODYSSEY</span><h1 tabindex="-1">귀환의 길에서 만난 사람들</h1><p>인물을 누르면 짧은 이야기를 읽을 수 있어요.</p></div>${this.bookNav('people')}<div class="cast-grid">${PEOPLE.map(p=>`<button class="person-card" data-action="person:${p.id}"><img src="${asset(p.id)}" alt="" loading="lazy" decoding="async"><strong>${p.name}</strong><small>${p.role}</small></button>`).join('')}</div><div class="page-foot"><span>이 모험은 오디세우스의 귀환을 따라가요.</span>${button('islands','항해 시작 →','text-button')}</div></div>`,'people');
 }
 private person(id:string){
  const p=PEOPLE.find(person=>person.id===id);if(!p)return;
  this.set(`<div class="veil"><section class="panel character-story"><img class="character-portrait" src="${asset(p.id)}" alt="${p.name}"><span class="eyebrow">${p.role}</span><h1 tabindex="-1">${p.name}</h1><p>${p.story}</p>${button('people','인물 도감으로 돌아가기','primary')}</section></div>`,'person');
 }
 private relics(){
  this.set(`<div class="page relics">${this.header('항해 도감')}<div class="page-heading"><span class="eyebrow">TREASURES OF THE JOURNEY</span><h1 tabindex="-1">모험을 비추는 보물들</h1><p>달리기 아이템 여덟 가지와 항해를 안내하는 상징을 만나 보세요.</p></div>${this.bookNav('relics')}<div class="relic-grid">${RELICS.map(r=>`<article class="relic-card"><img src="${asset(r.id)}" alt="" loading="lazy" decoding="async"><div><span class="relic-kind">${r.kind}</span><h2>${r.name}</h2><p>${r.description}</p></div></article>`).join('')}</div></div>`,'relics');
 }
 private bestiary(){
  const cards=(Object.keys(ENEMY_TYPES) as EnemyKind[]).map(id=>{const e=ENEMY_TYPES[id],f=MONSTER_ART.frames[id];const places=STAGES.map(stage=>{const count=COURSES[stage].enemies.filter(m=>m.kind===id).length;return count?`${COURSES[stage].name} ${count}마리`:'';}).filter(Boolean).join(' · ');return `<article class="relic-card monster-card"><svg viewBox="${f.x} ${f.y} ${f.w} ${f.h}" role="img" aria-label="${e.name}"><image href="${import.meta.env.BASE_URL}${MONSTER_ART.file}" width="1536" height="1024"/></svg><div><span class="relic-kind">${e.hint}로 피하기</span><h2>${e.name}</h2><p>${e.behavior}</p><small>${places}</small></div></article>`;}).join('');
  this.set(`<div class="page bestiary">${this.header('항해 도감')}<div class="page-heading"><span class="eyebrow">CREATURES ON THE ROAD</span><h1 tabindex="-1">항로에서 만나는 여섯 몬스터</h1><p>머리 위 삼각형과 안내를 살펴보세요. 공격을 미리 알면 안전하게 피할 수 있어요.</p></div>${this.bookNav('bestiary')}<div class="relic-grid">${cards}</div></div>`,'bestiary');
 }
 private journal(){this.abandon();this.world.showHome();const j=this.store.data.journal;this.set(`<div class="page journal">${this.header('모험 수첩')}<div class="page-heading"><span class="eyebrow">YOUR OWN ODYSSEY</span><h1 tabindex="-1">나만의 모험을 채워요</h1><p>도전 도장과 발견은 결과 화면에서 기록돼요. 점수와 별빛을 소비하지 않아요.</p></div>${this.bookNav('journal')}${journalCards(j)}<section class="journal-section"><h2>다시 달릴 항로</h2><p>${STAGES.map(id=>`${COURSES[id].name}: ${j.routes.includes(id+'-upper')?'✓ 높은 길':'○ 높은 길'} · ${j.routes.includes(id+'-lower')?'✓ 아래 길':'○ 아래 길'}`).join('<br>')}</p></section><div class="page-foot">${button('islands','다음 모험으로 →','primary')}</div></div>`,'journal');}
 private harbor(){this.abandon();this.world.showHome();const save=this.store.data,done=STAGES.filter(id=>save.stages[id].complete).length,maps=STAGES.reduce((n,id)=>n+save.stages[id].maps.length,0),unlocks=harborUnlocks(save.journal,done,maps);this.set(`<div class="page harbor">${this.header('이타카 항구')}<div class="page-heading"><span class="eyebrow">A HOME WORTH RETURNING TO</span><h1 tabindex="-1">모험이 쌓이는 우리 항구</h1><p>배·등대·동료의 집·별빛 깃발·축제를 하나씩 완성해요. ${unlocks.filter(Boolean).length}/5 완성</p></div><div class="harbor-picture">${harborArt(unlocks)}</div><div class="harbor-checklist">${harborRequirements.map((text,i)=>`<span class="${unlocks[i]?'complete':''}">${unlocks[i]?'✓':'○'} ${text}</span>`).join('')}</div><div class="page-foot">${button('islands','항구를 위한 모험 →','primary')}${button('journal','모험 수첩','secondary')}</div></div>`,'harbor');}
 private discovery(id:string){const story=Object.values(ADVENTURE_PLANS).flatMap(p=>p.stories).find(s=>s.id===id);if(!story||!this.store.data.journal.stories.includes(id))return;this.set(`<div class="veil"><section class="panel story"><span class="eyebrow">HIDDEN WORDS</span><h1 tabindex="-1">${story.title}</h1><p>${story.story}</p>${button('journal','모험 수첩으로','primary')}</section></div>`,'discovery');}
 private quit(){const unfinished=!!this.run&&!this.result;this.abandon();this.world.showHome();this.set(`<div class="veil"><section class="panel quit-panel"><span class="eyebrow">UNTIL OUR NEXT VOYAGE</span><h1 tabindex="-1">오늘의 항해를 마쳤어요</h1><p>게임과 소리는 멈췄어요.<br>확정된 기록과 설정은 그대로 보관해요.${unfinished?'<br>진행 중이던 판의 임시 점수와 발견은 반영하지 않아요.':''}</p><div class="button-row">${button('home','시작 화면으로','primary')}${button('close-tab','탭 닫기','secondary')}</div><small>탭 닫기가 지원되지 않으면 브라우저의 닫기 버튼을 사용해 주세요.</small></section></div>`,'quit');}
 private story(index:number){const id=`${STAGES[Math.floor(index/3)]}-map-${index%3+1}`;if(!STAGES.some(s=>this.store.data.stages[s].maps.includes(id)))return;const [title,text]=MAP_STORIES[index];this.set(`<div class="veil"><section class="panel story">${icon('map')}<span class="eyebrow">FRAGMENT 0${index+1}</span><h1 tabindex="-1">${title}</h1><p>${text}</p>${button('codex','도감으로 돌아가기','primary')}</section></div>`,'story');}
 private settingToggle(key:keyof Settings,label:string){return `<label class="toggle"><span>${label}</span><input type="checkbox" data-setting="${key}" ${this.store.data.settings[key]?'checked':''}><i aria-hidden="true"></i></label>`;}
 private settings(){
  this.returnScreen=this.screen==='islands'?'islands':'home';
  this.set(`<div class="page settings">${this.header('설정',this.returnScreen)}<div class="settings-layout"><div class="page-heading"><span class="eyebrow">MAKE IT YOUR JOURNEY</span><h1 tabindex="-1">나의 항해 설정</h1><p>기록은 이 기기와 브라우저에 저장돼요.<br>기록 파일로 옮길 수 있어요.</p><div class="save-note">계정 없이, 이 브라우저에만 저장해요.<br>다른 기기와 자동으로 동기화되지는 않아요.</div></div><div class="settings-body"><section><h2>소리와 움직임</h2>${this.settingToggle('music','배경음')}${this.settingToggle('sfx','효과음')}${this.settingToggle('reducedMotion','움직임 줄이기')}<small>기본 배경은 고정돼 있어요. 켜면 장식 무늬와 바람 표시를 더 줄여요. 달리기·점프와 위험 신호는 유지돼요.</small></section><section><h2>기록 보관함</h2><div class="backup-row">${button('export',icon('map')+' 기록 내보내기','secondary')}<label class="button secondary file-button">기록 가져오기<input id="import-file" type="file" accept="application/json,.json" aria-label="JSON 기록 파일 가져오기"></label></div><p class="muted">UTF-8 JSON · 최대 64KiB · 복원 전 내용을 확인해요.</p>${this.store.blocked?button('original','보존된 원본 내려받기','text-button'):''}${button('reset-confirm','이 게임의 기록 초기화','danger text-button')}</section><div id="import-error" role="alert"></div></div></div></div>`,'settings');
 }
 private download(data:string,filename:string){const url=URL.createObjectURL(new Blob([data],{type:'application/json;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 private export(){this.download(JSON.stringify(this.store.data,null,2),`odyssey-run-save-${new Date().toISOString().slice(0,10).replaceAll('-','')}.json`);}
 private async change(e:Event){
  const input=e.target as HTMLInputElement;
  if(input.name==='course'&&isVariant(input.value)&&this.screen==='prepare'){this.selectedVariant=input.value;return;}
  if(input.name==='goal'&&Object.hasOwn(GOALS,input.value)){this.selectedGoal=input.value as GoalId;return;}
  if(input.dataset.setting){this.store.data.settings[input.dataset.setting as keyof Settings]=input.checked;this.store.persist();this.sound.unlock();this.sound.changed();this.notice();return;}
  if(input.id==='import-file'&&input.files?.[0]){
   const request=++this.importRequest;
   const active=()=>!this.destroyed&&request===this.importRequest&&this.screen==='settings'&&input.isConnected;
   try{const file=input.files[0];if(file.size>65536)throw Error('기록 파일은 64KiB 이하여야 해요.');const text=await file.text();if(!active())return;let raw:unknown;try{raw=JSON.parse(text);}catch{throw Error('JSON 파일을 읽을 수 없어요. 올바른 기록 파일을 선택해 주세요.');}this.imported=validateSave(raw);this.importPreview();}
   catch(error){if(active()){const box=this.ui.querySelector('#import-error');if(box)box.textContent=(error as Error).message;}}finally{if(active())input.value='';}
  }
 }
 private importPreview(){const s=this.imported!;this.set(`<div class="veil"><section class="panel"><span class="eyebrow">RESTORE YOUR JOURNEY</span><h1 tabindex="-1">이 기록으로 바꿀까요?</h1><p>완주한 섬 ${STAGES.filter(id=>s.stages[id].complete).length}/3 · 지도 ${STAGES.reduce((a,id)=>a+s.stages[id].maps.length,0)}/9</p><p class="muted">모험 도장 ${s.journal.stamps.length}/12 · 별자리 ${s.journal.constellations.length}/9 · 이야기 ${s.journal.stories.length}/6<br>완주한 코스 ${Object.values(s.courses).filter(r=>r?.complete).length}/9</p><div class="import-list">${STAGES.map(id=>`<p><b>${COURSES[id].name}</b><span>${s.stages[id].bestScore}점 / ${s.stages[id].bestRating}★ / 별빛 ${s.stages[id].bestStars}</span></p>`).join('')}</div><p class="muted">현재 진행과 설정을 교체해요.<br>교체 전 원본은 이 게임 전용 백업에 보관해요.</p><div class="button-row">${button('settings','취소','secondary')}${button('import-confirm','이 기록으로 복원','primary')}</div></section></div>`,'import');}
 private error(){this.sound.setPlaying(false);this.set(`<div class="veil"><section class="panel"><h1 tabindex="-1">항해 준비가 멈췄어요</h1><p>필요한 그림을 불러오지 못했어요.<br>연결을 확인하고 다시 준비해 주세요.</p>${button('reload','다시 준비하기','primary')}</section></div>`,'error');}
 private action(action:string){
  if(action.startsWith('discovery:')){this.discovery(action.slice(10));return;}
  if(action.startsWith('stage:')){const id=action.slice(6) as StageId;if(STAGES.includes(id))this.prepare(id);return;}
  if(action.startsWith('sheet:')){this.sheet(action.slice(6));return;}
  if(action.startsWith('person:')){this.person(action.slice(7));return;}
  if(action.startsWith('story:')){this.story(Number(action.slice(6)));return;}
  switch(action){
   case 'journal':this.journal();break;case 'harbor':this.harbor();break;case 'quit':this.quit();break;case 'close-tab':try{window.close();}catch{}this.notice('이 브라우저에서는 탭을 직접 닫아 주세요. 게임과 소리는 멈춰 있어요.');break;
   case 'home':this.home();break;case 'islands':this.islands();break;case 'codex':this.codex();break;case 'settings':this.settings();break;
   case 'bestiary':this.bestiary();break;case 'people':this.people();break;case 'relics':this.relics();break;case 'landscapes':this.landscapes();break;
   case 'sheet-zoom':if(this.screen==='sheet'){const viewer=this.ui.querySelector('.sheet-viewer')!;const expanded=viewer.classList.toggle('expanded');const b=this.ui.querySelector('[data-action="sheet-zoom"]')!;b.setAttribute('aria-pressed',String(expanded));b.textContent=expanded?'화면에 맞추기':'원본 크기로 확대';}break;
   case 'start':if(this.screen==='prepare')this.start();break;case 'restart':if(['pause','result'].includes(this.screen))this.start();break;
   case 'pause':this.pause();break;case 'resume':if(this.screen==='pause')this.beginCountdown();break;
   case 'export':this.export();break;
   case 'original':try{this.download(localStorage.getItem(SAVE_KEY)||'',`odyssey-run-original.json`);}catch{this.notice('원본을 읽지 못했어요.');}break;
   case 'import-confirm':if(this.screen==='import'&&this.imported){const ok=this.store.replace(this.imported);this.imported=null;this.settings();if(ok)this.notice('기록 파일을 복원했어요.');}break;
   case 'reset-confirm':this.set(`<div class="veil"><section class="panel"><span class="eyebrow">START A NEW JOURNEY</span><h1 tabindex="-1">기록을 초기화할까요?</h1><p>이 게임의 섬 완료, 최고 기록, 지도 조각,<br>설정과 백업을 모두 지워요.</p><p class="muted">다른 앱의 데이터는 유지돼요.<br>필요하면 먼저 기록을 내보내세요.</p><div class="button-row">${button('settings','취소','secondary')}${button('reset','초기화하기','danger-button')}</div></section></div>`,'reset');break;
   case 'reset':if(this.screen==='reset'){this.store.reset();this.selected='beach';this.settings();}break;
   case 'reload':location.reload();break;
  }
 }
 private frame(delta:number){
  if(this.destroyed)return;
  if(this.screen==='quit'){this.game.loop.sleep();return;}
  this.sound.update();
  if(this.screen==='countdown'&&!document.hidden){this.countdown-=Math.min(delta,.1);const n=document.querySelector('#count');if(n)n.textContent=String(Math.max(1,Math.ceil(this.countdown)));if(this.countdown<=0)this.play();}
  else if(this.screen==='play'&&this.run?.state==='playing'){
   this.accumulator+=Math.min(delta,.1);
   while(this.accumulator>=C.step){this.run.tick();this.accumulator-=C.step;for(const e of this.run.events){this.sound.effect(e.kind);this.world.feedback(e.kind,e.x,e.y,e.text);}if(this.run.state!=='playing'){this.accumulator=0;this.finish();break;}}
   if(this.screen==='play')this.updateHud();
  }
 }
 private updateHud(){const r=this.run;if(!r)return;const text=[r.hp,r.points,r.maps.size,r.stars,Math.floor(r.x),Math.ceil(r.wings),Math.ceil(r.magnet),r.shield,r.trident,Math.ceil(r.lantern),r.goalProgress,r.constellations.size,r.stories.size,Math.floor(r.time)].join();if(text===this.lastHud)return;this.lastHud=text;
  const hp=document.querySelector('#hp');if(!hp)return;hp.innerHTML=`<span>${'♥'.repeat(Math.max(0,r.hp))}</span><em>${'♡'.repeat(3-Math.max(0,r.hp))}</em>`;hp.setAttribute('aria-label',`체력 ${Math.max(0,r.hp)}`);
  document.querySelector('#score')!.textContent=r.points.toLocaleString();document.querySelector('#stars')!.textContent=`✦ ${r.stars} / 100`;document.querySelector('#maps')!.textContent=`지도 ${r.maps.size} / 3`;
  const progress=document.querySelector<HTMLProgressElement>('#progress')!;progress.value=Math.min(24000,r.x);progress.dataset.distance=String(r.x);document.querySelector('#progress-label')!.textContent=Math.min(100,Math.floor(r.x/240)).toString()+'%';
  const g=GOALS[r.goal];document.querySelector('#goal-progress')!.textContent=`${r.goalComplete?'✓':'◇'} ${g.name} ${Math.min(g.target,r.goalProgress)}/${g.target}`;
  document.querySelector('#discovery-progress')!.textContent=`✧ 별자리 ${r.constellations.size}/3 · 회피 ${r.nearMisses.size}`;
  const ghost=ghostDistance(courseGhost(this.store.data,this.selected,r.variant),r.time),marker=this.ui.querySelector<HTMLElement>('#ghost-marker')!;
  marker.hidden=ghost===null;if(ghost!==null)marker.style.left=`${ghost/240}%`;
  document.querySelector('#ghost-delta')!.textContent=ghost===null?'이 코스의 첫 기록을 남겨 보세요':Math.abs(r.x-ghost)<=C.speed*C.step*2?'나의 비교 항해 · 나란히':`나의 비교 항해 ${Math.floor(Math.abs(r.x-ghost)/10)}m ${r.x>=ghost?'앞':'뒤'}`;
  document.querySelector('#effects')!.textContent=[r.shield?'⬡ 방패':'',r.trident?'⚒ 삼지창 1회':'',r.lantern>0?`등불 ${Math.ceil(r.lantern)}초`:'',r.wings>0?`날개 ${Math.ceil(r.wings)}초`:'',r.magnet>0?`자석 ${Math.ceil(r.magnet)}초`:''].filter(Boolean).join(' · ');
 }
 private orientation(){
  const portrait=innerHeight>innerWidth&&(navigator.maxTouchPoints>0||innerWidth<700);const active=!!this.run&&['play','pause','countdown'].includes(this.screen);
  const rotate=document.querySelector<HTMLElement>('#rotate')!,wasVisible=!rotate.hidden,visible=portrait&&active;rotate.hidden=!visible;this.ui.inert=visible;if(visible&&this.screen!=='pause')this.pause();
  if(visible&&!wasVisible)document.querySelector<HTMLButtonElement>('#rotate-menu')!.focus({preventScroll:true});
  else if(!visible&&wasVisible)this.ui.querySelector<HTMLButtonElement>('[data-action="resume"]')?.focus({preventScroll:true});
 }
 private resizeDisplay(){
  if(!this.game?.isBooted||this.destroyed)return;
  const density=displayDensity(document.querySelector('#shell')!.getBoundingClientRect().width,window.devicePixelRatio);
  if(density===this.renderDensity)return;
  this.renderDensity=density;this.game.scale.setGameSize(C.width*density,C.height*density);this.world.syncDisplay();
 }
 destroy(){this.destroyed=true;this.displayObserver.disconnect();this.abort.abort();this.controls.destroy();this.sound.destroy();this.game.destroy(true);}
}
