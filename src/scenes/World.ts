import Phaser from 'phaser';
import {C} from '../config';
import {COURSES,type StageId} from '../levels/courses';
import type {Runner} from '../player/runner';
import {assetUrl} from '../assets/catalog';
import {REGIONS,sheetUrl} from '../assets/terrain';
import {RUN_ART} from '../assets/runner-art';
import {DISPLAY} from '../rendering/display';
export interface SceneHost {frame(delta:number):void;loaded():void;loadError():void;reduced():boolean;density():number;}
export class World extends Phaser.Scene {
 private bg:Phaser.GameObjects.Image[][]=[];private ground!:Phaser.GameObjects.Graphics;private fx!:Phaser.GameObjects.Graphics;
 private hero!:Phaser.GameObjects.Image;private boat!:Phaser.GameObjects.Image;private giant!:Phaser.GameObjects.Image;
 private obstacles:Phaser.GameObjects.Image[]=[];private items:Phaser.GameObjects.Image[]=[];private platforms:Phaser.GameObjects.Image[]=[];
 private label!:Phaser.GameObjects.Text;private bursts:{text:Phaser.GameObjects.Text;life:number}[]=[];
 private groundArt:Phaser.GameObjects.TileSprite[]=[];
 private stage:StageId='beach';private run:Runner|null=null;private mode:'home'|'run'='home';private failed=false;
 constructor(private host:SceneHost){super('World');}
 preload(){
  this.syncDisplay();
  const g=this.add.graphics();g.fillStyle(0x102f46).fillRect(0,0,960,540);
  const t=this.add.text(480,250,'항해를 준비하고 있어요…',{fontFamily:'sans-serif',fontSize:'22px',color:'#f6e8c5',resolution:this.host.density()}).setOrigin(.5);
  const bar=this.add.graphics();this.load.on('progress',(n:number)=>{bar.clear().fillStyle(0xe9b957).fillRoundedRect(300,296,360*n,5,3);t.setText(`항해를 준비하고 있어요… ${Math.round(n*100)}%`);});
  this.load.on('loaderror',()=>{this.failed=true;});
  const names=['star','crate','pillar','gate','rock','boat','giant',...['beach','cave','wind'].flatMap(id=>['sky','far','mid'].map(layer=>`${id}-${layer}`))];
  names.forEach(n=>this.load.svg(n,`${import.meta.env.BASE_URL}assets/${n}.svg`,{scale:DISPLAY.svgDensity}));
  ['odysseus','map','shield','wings','magnet','apple'].forEach(n=>this.load.image(n,assetUrl(n)));
  this.load.image('terrain-sheet',sheetUrl('terrain-sheet'));
  this.load.image('odysseus-run',`${import.meta.env.BASE_URL}${RUN_ART.file}`);
  this.load.once('complete',()=>{g.destroy();t.destroy();bar.destroy();});
 }
 create(){
  if(this.failed){this.host.loadError();return;}
  Object.entries(REGIONS).filter(([,r])=>r.sheet==='terrain-sheet').forEach(([id,r])=>this.textures.get(r.sheet).add(id,0,r.x,r.y,r.w,r.h));
  RUN_ART.frames.forEach((f,i)=>this.textures.get('odysseus-run').add(`run-${i}`,0,f.x,f.y,f.w,f.h));
  // Draw source images directly; a logical-size TileSprite would downsample
  // the high-resolution SVG before the final display scaling.
  this.bg=['sky','far','mid'].map(layer=>[0,1].map(i=>this.add.image(i*1600,0,`beach-${layer}`).setOrigin(0).setDisplaySize(1600,540)));
  this.giant=this.add.image(-100,440,'giant').setOrigin(.5,1).setAlpha(.8).setVisible(false);
  this.ground=this.add.graphics();this.fx=this.add.graphics();
  for(let i=0;i<5;i++)this.groundArt.push(this.add.tileSprite(0,440,1,33,'terrain-sheet','ground-beach').setOrigin(0).setVisible(false));
  this.boat=this.add.image(744,444,'boat').setDisplaySize(350,230);
  this.hero=this.add.image(744,442,'odysseus').setOrigin(.5,1).setDisplaySize(180,240);
  this.label=this.add.text(480,275,'',{fontFamily:'sans-serif',fontSize:'22px',color:'#fff2d2',stroke:'#223e4b',strokeThickness:5,align:'center',resolution:this.host.density()}).setOrigin(.5);
  this.syncDisplay();
  this.host.loaded();
 }
 showHome(){this.mode='home';this.run=null;this.clearObjects();this.setStage('beach');this.boat.setVisible(true).setPosition(744,410).setDisplaySize(350,230);this.hero.setTexture('odysseus').setOrigin(.5,1).setDisplaySize(180,240).setPosition(744,442).setRotation(0).setAlpha(1);this.giant.setVisible(false);this.label.setText('');}
 setStage(id:StageId){this.stage=id;this.bg.forEach((pair,i)=>pair.forEach(b=>b.setTexture(`${id}-${['sky','far','mid'][i]}`).setDisplaySize(1600,540)));this.groundArt.forEach(s=>s.setTexture('terrain-sheet',`ground-${id}`).setVisible(false));}
 syncDisplay(){
  const d=this.host.density();if(!this.cameras?.main)return;
  // Counter the physical viewport's center offset. The visible world remains
  // x=0..960, y=0..540 at every density; there is no animated pan or zoom.
  this.cameras.main.setSize(C.width*d,C.height*d).setZoom(d).setScroll(C.width*(1-d)/2,C.height*(1-d)/2);
  if(this.label)this.label.setResolution(d);
  this.bursts.forEach(b=>b.text.setResolution(d));
  const context=this.game.canvas.getContext('2d');if(context)context.imageSmoothingQuality='high';
 }
 private backgroundScroll(layer:number,position:number){
  const offset=((position%1600)+1600)%1600;
  this.bg[layer].forEach((image,i)=>{const x=i*1600-offset;image.setX(x).setVisible(x<960&&x+1600>0);});
 }
 showRun(run:Runner){
  this.mode='run';this.run=run;this.clearObjects();this.setStage(run.stage);this.boat.setVisible(false);this.hero.setDisplaySize(66,88).setRotation(0);
  run.course.obstacles.forEach(o=>{this.obstacles.push(this.add.image(o.x,o.y,o.kind==='falling'?'rock':o.kind).setOrigin(0).setDisplaySize(o.w,o.h));});
  run.course.items.forEach(i=>this.items.push(this.add.image(i.x,i.y,i.kind).setDisplaySize(i.kind==='star'?24:36,i.kind==='star'?24:36)));
  run.course.platforms.forEach(p=>this.platforms.push(this.add.image(p.x,p.y,'terrain-sheet','wood-platform').setOrigin(0).setDisplaySize(p.w,20)));
  this.hero.setDepth(10);this.label.setDepth(20);this.fx.setDepth(15);this.drawRun();
 }
 private clearObjects(){this.obstacles.forEach(o=>o.destroy());this.items.forEach(o=>o.destroy());this.platforms.forEach(o=>o.destroy());this.obstacles=[];this.items=[];this.platforms=[];this.bursts.forEach(b=>b.text.destroy());this.bursts=[];}
 feedback(kind:string,x:number,y:number){
  if(kind==='jump'||kind==='star'&&this.host.reduced())return;
  const words:Record<string,string>={star:'+10 ✦',map:'지도 발견! +100',shield:'아테나의 방패',wings:'6초간 활공',magnet:'별빛 자석 · 6초',apple:'황금 사과 · 회복',hurt:'체력 −1',fall:'안전지점으로!',block:'방패가 지켰어요!',finish:'이타카를 향해!'};
  const text=this.add.text(x-(this.run?.x||0)+192,y-35,words[kind]||'',{fontFamily:'sans-serif',fontStyle:'bold',fontSize:kind==='star'?'15px':'20px',color:kind==='hurt'?'#ffb8a3':'#ffebae',stroke:'#20394b',strokeThickness:4,resolution:this.host.density()}).setOrigin(.5).setDepth(30);
  this.bursts.push({text,life:.9});
 }
 update(_time:number,delta:number){
  if(!this.hero)return;
  this.host.frame(delta/1000);
  if(this.mode==='home'){
   const t=this.host.reduced()?0:this.time.now/1000;this.backgroundScroll(0,310);this.backgroundScroll(1,100);this.backgroundScroll(2,0);
   this.boat.y=410+Math.sin(t*.8)*1.5;this.hero.y=442+Math.sin(t*.8)*1.5;this.ground.clear();this.fx.clear();
  }else this.drawRun();
  const playing=this.run?.state==='playing';
  if(playing){for(let i=this.bursts.length-1;i>=0;i--){const b=this.bursts[i];b.life-=Math.min(delta/1000,.05);if(!this.host.reduced())b.text.y-=delta*.025;b.text.setAlpha(Math.min(1,b.life*2));if(b.life<=0){b.text.destroy();this.bursts.splice(i,1);}}}
 }
 private drawRun(){
  const r=this.run;if(!r)return;const cam=r.x-192;const dark=this.stage==='cave';
  const reduced=this.host.reduced();this.backgroundScroll(0,310);this.backgroundScroll(1,reduced?0:r.x*DISPLAY.farParallax);this.backgroundScroll(2,reduced?0:r.x*DISPLAY.nearParallax);
  const g=this.ground;g.clear();
  // Ground spans retain the complete logical view, including on small screens.
  let start=cam-20,spanIndex=0;this.groundArt.forEach(s=>s.setVisible(false));
  const groundSpan=(a:number,b:number)=>{if(b<=a)return;g.fillStyle(dark?0x5d6571:this.stage==='wind'?0x9bafa3:0xd0ac77).fillRect(a-cam,440,b-a,100);g.lineStyle(2,dark?0x747b7d:0xbc9764,.6);for(let x=Math.floor(a/100)*100;x<b;x+=100){g.strokeRect(x-cam,477,82,40);g.lineBetween(x-cam,497,x+28-cam,497);}const band=this.groundArt[spanIndex++];if(band&&b-a>=1){band.setPosition(a-cam,440).setSize(b-a,REGIONS[`ground-${this.stage}`].h).setVisible(true);band.tilePositionX=a;}g.lineStyle(2,0xf5de9b,.9).lineBetween(a-cam,440,b-cam,440);};
  for(const gap of r.course.gaps){if(gap.x+gap.w<start||gap.x>cam+1000)continue;groundSpan(start,gap.x);start=gap.x+gap.w;}
  groundSpan(start,cam+1000);
  this.obstacles.forEach((s,i)=>{const o=r.course.obstacles[i],x=o.x-cam;s.setVisible(x>-200&&x<1020).setX(x);if(o.kind==='falling'){const d=o.x-r.x;s.y=o.y-Math.max(0,Math.min(290,(d-100)*1.5));}});
  this.items.forEach((s,i)=>{const item=r.course.items[i],x=item.x-cam;s.setVisible(!r.collected.has(item.id)&&x>-40&&x<1000).setPosition(x,item.y);});
  this.platforms.forEach((s,i)=>{const p=r.course.platforms[i];s.setPosition(p.x-cam,r.platformY(p)).setVisible(Math.abs(p.x-r.x)<1100);});
  const fx=this.fx;fx.clear();
  r.course.winds.forEach(w=>{
   const x=w.x-cam;if(x+w.w<0||x>960)return;
   fx.fillStyle(0xc8f0da,.2).fillRect(x,w.y,w.w,w.h);fx.lineStyle(3,0xe1f6ce,.8);
   for(let k=0;k<8;k++){const xx=x+40+k*80,yy=400-(((this.host.reduced()?0:r.time*65)+k*41)%290);fx.lineBetween(xx,yy+12,xx,yy-16);fx.lineBetween(xx,yy-16,xx-8,yy-5);fx.lineBetween(xx,yy-16,xx+8,yy-5);}
  });
  r.course.obstacles.filter(o=>o.kind==='falling'&&o.x-r.x<650&&o.x>r.x-70).forEach(o=>{const x=o.x-cam+30;fx.fillStyle(0xe8b04d,.22).fillRect(x-42,340,84,100);fx.fillStyle(0xeab758).fillTriangle(x,310,x-12,332,x+12,332);});
  this.drawHero(r);
  if(r.shield){fx.lineStyle(3,0xffdf85,.85).strokeEllipse(192,r.y-35,86,96);}
  if(r.wings>0){fx.lineStyle(4,0xf4f3d4,.8);fx.lineBetween(160,r.y-40,132,r.y-63);fx.lineBetween(222,r.y-40,246,r.y-63);}
  this.giant.setVisible(this.stage==='cave').setPosition(r.hp<=0?140:r.hp===3?-45:r.hp===2?15:63,440).setDisplaySize(170,230);
  if(r.x<3200){this.label.setPosition(590,160).setText(r.x<1000?'이타카로 가는 여정, 출발!':this.stage==='wind'?'↑ 바람길에서 가볍게 뛰어 보세요':r.x<2100?'Space / ↑ · 점프, 한 번 더 누르면 2단 점프':'↓ 꾹 누르기 · 슬라이드');}
  else if(r.x>22400){this.label.setPosition(650,180).setText(this.stage==='wind'?'이타카 항구가 보여요!':'도착 항구가 보여요!');this.boat.setVisible(true).setPosition(760-(r.x-22400)*.08,370).setDisplaySize(216,142);}
  else{this.label.setText('');this.boat.setVisible(false);}
 }
 private drawHero(r:Runner){
  // Use the simulation clock so pause/countdown/tab suspension freeze the pose.
  // Individual hip/ground anchors keep each distinct pose in the same place.
  const reduced=this.host.reduced(),alpha=r.invincible>0?(reduced?.72:.65+.25*Math.abs(Math.sin(r.time*7))):1;
  if(r.grounded&&!r.sliding&&r.state!=='success'&&r.state!=='failure'){
   const index=Math.floor(r.time*RUN_ART.fps)%RUN_ART.frames.length,f=RUN_ART.frames[index];
   this.hero.setTexture('odysseus-run',`run-${index}`).setOrigin(f.originX,f.originY).setScale(RUN_ART.scale).setPosition(192,r.y).setRotation(0).setAlpha(alpha);
   return;
  }
  this.hero.setTexture('odysseus').setOrigin(.5,1);
  let width=66,height=88,x=192,y=r.y+2,rotation=0;
  if(r.state==='success'){width=69;height=92;rotation=-.045;}
  else if(r.sliding){width=32;height=88;rotation=Math.PI/2;x-=44;y-=17;}
  else rotation=reduced?0:r.vy<0?-.04:.03;
  this.hero.setDisplaySize(width,height).setRotation(rotation).setPosition(x,y).setAlpha(alpha);
 }
}
