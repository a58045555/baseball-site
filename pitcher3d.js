import * as T from './vendor/three.module.min.js';
import {createBallpark} from './ballpark.js';
import {createPlayer,sampleMotion,fitMotion} from './player.js';
import {createCatcher,createGlove,makeCatcherMitt} from './props.js';

// Chapter 4, "body" mode: the pitcher on the mound of the ballpark, driven by the captured motion,
// with broadcast camera presets, a scrubbable timeline and a real ball flight to the catcher.
const F=window.BaseballFlight3D;
const captions=['右腳站穩，左膝抬起，準備向前。','左腳跨出去，髖和肩膀接著轉。','手肘帶著手往前，球正在加速。','球離開手指，手臂和後腳自然收尾。'];
const VIEWS=[['close','近看'],['side','一壘側'],['front','本壘後'],['broadcast','轉播'],['follow','跟球']];
let active=null;
const capture=fetch(new URL('./models/pitching-motion.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('投球動作資料載入失敗');return r.json();});capture.catch(()=>{});

function cleanup(){if(!active)return;const a=active;active=null;cancelAnimationFrame(a.raf);a.player?.dispose();a.catcher&&a.scene?.remove(a.catcher);a.park?.dispose();a.ro?.disconnect();a.io?.disconnect();a.controls?.remove();a.scene?.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of [].concat(o.material)){m.map?.dispose();m.dispose();}});a.renderer?.dispose();a.renderer?.forceContextLoss();}

function mount(canvas,step,from=step){
 cleanup();const root={canvas,step,from,started:performance.now(),auto:false,visible:true,raf:0,view:'close',angle:-.75,radius:3.9,time:0,rate:.5};active=root;
 try{
 const small=Math.min(innerWidth,innerHeight)<700;
 const renderer=root.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,small?1.5:2));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 const scene=root.scene=new T.Scene();const camera=new T.PerspectiveCamera(30,1,.05,600);
 const park=root.park=createBallpark(scene,renderer,{rubberZ:0,quality:small?'low':'high'});
 const player=root.player=createPlayer(scene,{glove:createGlove()});player.group.position.y=park.moundTop;
 const mitt=makeCatcherMitt();mitt.position.set(.05,.72,park.plateZ+.07);scene.add(mitt);
 createCatcher().then(c=>{if(active!==root)return;root.catcher=c;c.position.set(.03,0,park.plateZ+.8);if(c.userData.reach)c.userData.reach(c.worldToLocal(mitt.position.clone().add(new T.Vector3(0,-.1,.11))));scene.add(c);});
 const highlight=new T.Mesh(new T.TorusGeometry(.15,.006,8,48),new T.MeshBasicMaterial({color:0xf1c970,transparent:true,opacity:.7,depthTest:false}));scene.add(highlight);
 const trail=new T.Line(new T.BufferGeometry(),new T.LineDashedMaterial({color:0xfff1c2,dashSize:.12,gapSize:.08,transparent:true,opacity:.75}));scene.add(trail);trail.visible=false;
 const ball=player.ball;

 const controls=root.controls=document.createElement('div');controls.className='pitcher3d-controls';
 controls.innerHTML=`<div class="pitcher-views" role="group" aria-label="立體投手鏡頭">${VIEWS.map(([id,name])=>`<button type="button" data-pitcher-view="${id}" aria-pressed="${id===root.view}">${name}</button>`).join('')}<span class="pitcher-zoom"><button type="button" data-pitcher-zoom="in" aria-label="拉近看投手">＋</button><button type="button" data-pitcher-zoom="out" aria-label="拉遠看投手">−</button></span></div>
 <div class="pitcher-motion-bar"><button type="button" data-pitcher-play disabled>載入中…</button><button type="button" data-pitcher-speed aria-pressed="true">慢看 ½×</button><label>拖曳看動作<input type="range" min="0" max="1000" value="0" data-pitcher-scrub aria-label="投球動作時間軸"></label></div>
 <p class="pitcher3d-caption" role="status">正在準備球場與投手…</p>
 <details class="pitcher-motion-source"><summary>動作與模型來源</summary><p>CMU 動作捕捉資料庫 124–01 真人投球紀錄，套到人物骨架上；用來觀察全身配合，並非標準姿勢評分。人物由站主以 Meshy AI 生成，由本站加骨架、隊徽與號碼；球場、手套與球為本站自製模型。球離手後的飛行用本站的三維物理計算。<a href="https://mocap.cs.cmu.edu/subjects/124/" target="_blank" rel="noopener">查看動作原始資料</a></p></details>`;
 canvas.closest('.stage').after(controls);
 const play=controls.querySelector('[data-pitcher-play]'),scrub=controls.querySelector('[data-pitcher-scrub]'),caption=controls.querySelector('.pitcher3d-caption');

 const lookClose=new T.Vector3(0,1.0+park.moundTop,.7);
 function placeCamera(){
  if(root.view==='close'){camera.position.set(lookClose.x+Math.sin(root.angle)*root.radius,lookClose.y+.3,lookClose.z+Math.cos(root.angle)*root.radius);camera.lookAt(lookClose);camera.fov=36;camera.updateProjectionMatrix();return;}
  if(root.view==='follow'){if(root.flightPos){const p=root.flightPos;camera.position.set(p.x+.35,p.y+.55,p.z-2.3);camera.lookAt(p.x,p.y-.05,p.z+3);camera.fov=42;}else park.aimCamera(camera,'broadcast');camera.updateProjectionMatrix();return;}
  park.aimCamera(camera,root.view);
 }
 controls.querySelectorAll('[data-pitcher-view]').forEach(b=>b.onclick=()=>{root.view=b.dataset.pitcherView;controls.querySelectorAll('[data-pitcher-view]').forEach(a=>a.setAttribute('aria-pressed',String(a===b)));placeCamera();});
 controls.querySelectorAll('[data-pitcher-zoom]').forEach(b=>b.onclick=()=>{if(root.view!=='close'){root.view='close';controls.querySelectorAll('[data-pitcher-view]').forEach(a=>a.setAttribute('aria-pressed',String(a.dataset.pitcherView==='close')));}root.radius=T.MathUtils.clamp(root.radius+(b.dataset.pitcherZoom==='in'?-.35:.35),2.2,6.5);placeCamera();});
 play.onclick=()=>{if(!root.motion)return;root.auto=!root.auto;root.transition=false;if(root.auto){if(!root.hasPlayed||root.time>=root.end-.04)root.time=0;root.hasPlayed=true;root.last=performance.now();}play.textContent=root.auto?'Ⅱ 暫停':'▶ 看完整動作';};
 controls.querySelector('[data-pitcher-speed]').onclick=e=>{root.rate=root.rate===.5?1:root.rate===1?.25:.5;e.currentTarget.textContent=root.rate===.5?'慢看 ½×':root.rate===1?'原速 1×':'超慢 ¼×';e.currentTarget.setAttribute('aria-pressed',String(root.rate!==1));};
 scrub.oninput=()=>{if(!root.motion)return;root.auto=false;root.transition=false;root.hasPlayed=true;root.time=Number(scrub.value)/1000*root.end;play.textContent='▶ 繼續動作';};
 let drag;canvas.addEventListener('pointerdown',e=>drag={x:e.clientX,y:e.clientY});canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x;if(Math.abs(e.clientY-drag.y)>Math.abs(dx)*1.3){drag=null;return;}if(root.view!=='close'){root.view='close';controls.querySelectorAll('[data-pitcher-view]').forEach(a=>a.setAttribute('aria-pressed',String(a.dataset.pitcherView==='close')));}root.angle-=dx*.009;drag={x:e.clientX,y:e.clientY};placeCamera();});canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);

 // the ball's flight from the release point to the mitt, solved with the site's physics
 function planFlight(release){const target=mitt.position.clone();let elevation=-2,yaw=0,flight=null;for(let i=0;i<5;i++){flight=F.simulate({speed:145,rpm:2200,axis:[-1,0,0],elevation,yaw,height:release.y});const end=flight.points?F.sample(flight,flight.end.t):flight.end;elevation+=Math.atan2(target.y-(release.y+end.y-flight.points[0].y),target.z-release.z)*180/Math.PI;yaw+=Math.atan2(target.x-(release.x+end.x),target.z-release.z)*180/Math.PI;}return flight;}

 Promise.all([player.ready,capture]).then(([,source])=>{if(active!==root)return;const motion=fitMotion(player,source);root.motion=motion;root.end=motion.duration+.7;
  root.stops=[.75,motion.keyTimes.stride,motion.keyTimes.release-.05,motion.keyTimes.follow];root.time=root.stops[step];root.transition=from!==step;root.started=performance.now();root.last=performance.now();
  play.disabled=false;play.textContent='▶ 看完整動作';caption.textContent=captions[step];
  if(location.hash==='#pitcher'&&!root.didHandoff){root.didHandoff=true;requestAnimationFrame(()=>{if(active===root)canvas.closest('.stage').scrollIntoView({block:'start',behavior:'instant'});});}
 }).catch(e=>{if(active!==root)return;caption.textContent='人物載入失敗，請重新整理再試。';play.textContent='無法載入';console.error(e);});

 function draw(now){if(active!==root)return;root.raf=requestAnimationFrame(draw);const dt=Math.min(.05,(now-(root.last||now))/1000);root.last=now;if(!root.visible||document.hidden||!root.motion)return;
  const m=root.motion;
  if(root.auto){root.time=Math.min(root.end,root.time+dt*root.rate);if(root.time>=root.end){root.auto=false;play.textContent='↻ 再看一次';}}
  else if(root.transition){const f=Math.min(1,(now-root.started)/500),s=f*f*(3-2*f);root.time=T.MathUtils.lerp(root.stops[from],root.stops[step],s);if(f===1)root.transition=false;}
  const time=root.time,p=sampleMotion(m,Math.min(time,m.duration));player.poseMotion(p);
  const selected=time<1.25?0:time<m.keyTimes.release-.12?1:time<m.keyTimes.release?2:3;caption.textContent=captions[selected];scrub.value=Math.round(time/root.end*1000);
  if(root.reported!==selected){root.reported=selected;document.dispatchEvent(new CustomEvent('baseball:pitcher-position',{detail:selected}));}
  if(root.auto&&root.lastSeen!==selected){root.lastSeen=selected;document.dispatchEvent(new CustomEvent('baseball:pitcher-seen',{detail:selected}));}
  if(time>=m.keyTimes.release){
   if(!root.release){player.poseMotion(sampleMotion(m,m.keyTimes.release));root.release=player.handPosition();root.flight=planFlight(root.release);player.poseMotion(p);}
   const t=time-m.keyTimes.release,fl=root.flight,s=F.sample(fl,Math.min(t,fl.end.t));
   ball.position.set(root.release.x+s.x,root.release.y+(s.y-fl.points[0].y),root.release.z+s.z);root.flightPos=ball.position.clone();
   ball.visible=t<fl.end.t+.5;trail.visible=true;trail.geometry.dispose();trail.geometry=new T.BufferGeometry().setFromPoints([root.release,ball.position]);trail.computeLineDistances();
  }else{root.release=null;root.flightPos=null;ball.visible=true;trail.visible=false;}
  const key=selected===0?p.rf:selected===1?p.hip:selected===2?p.re:p.lf;highlight.position.copy(key).y+=park.moundTop;highlight.rotation.set(selected===0||selected===3?Math.PI/2:0,0,0);highlight.visible=!root.auto&&time<m.duration;
  if(root.view==='follow')placeCamera();
  renderer.render(scene,camera);
 }
 root.ro=new ResizeObserver(()=>{const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();});root.ro.observe(canvas);
 root.io=new IntersectionObserver(e=>root.visible=e[0].isIntersecting,{rootMargin:'100px'});root.io.observe(canvas);placeCamera();root.raf=requestAnimationFrame(draw);
 }catch(e){console.error('立體投手載入失敗',e);canvas.setAttribute('aria-label','立體投手無法載入，請參考下方分步說明');}
}
window.BaseballPitcher={mount,cleanup};
function connect(){const canvas=document.querySelector('#experiment-canvas');if(canvas?.dataset.lessonMode==='body'&&canvas.dataset.lessonChapter==='3')mount(canvas,Number(canvas.dataset.poseStep),Number(canvas.dataset.poseFrom));}
document.addEventListener('baseball:lesson-render',connect);connect();
