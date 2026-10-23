import * as T from './vendor/three.module.min.js';
import {createPitcherModel} from './skinned-pitcher.js';

const captions=['右腳站穩，左膝抬起，準備向前。','左腳跨出去，髖和肩膀接著轉。','手肘帶著手往前，球正在加速。','球離開手指，手臂和後腳自然收尾。'];
let active=null;
const capture=fetch(new URL('./models/pitching-motion.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('投球動作資料載入失敗');return r.json();});
capture.catch(()=>{});
function cleanup(){if(!active)return;cancelAnimationFrame(active.raf);active.model?.dispose();active.ro?.disconnect();active.io?.disconnect();active.controls?.remove();active.scene?.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of [].concat(o.material)){m.map?.dispose();m.dispose();}});active.renderer?.dispose();active.renderer?.forceContextLoss();active=null;}
function mount(canvas,step,from=step){
 cleanup();const root={canvas,step,from,started:performance.now(),auto:false,visible:true,raf:0,angle:-.72,radius:3.25,time:0,rate:.5};active=root;
 try{
 const renderer=root.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 const scene=root.scene=new T.Scene();scene.background=new T.Color(0x173d35);scene.fog=new T.Fog(0x173d35,7,14);const camera=new T.PerspectiveCamera(37,1,.05,30);
 scene.add(new T.HemisphereLight(0xeaf4ff,0x596348,2));const sun=new T.DirectionalLight(0xffefd7,3.2);sun.position.set(-3,6,4);scene.add(sun);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-3,right:3,top:4,bottom:-2});sun.shadow.bias=-.0004;sun.shadow.normalBias=.009;
 const rim=new T.DirectionalLight(0x91d2dc,2);rim.position.set(3,3,-3);scene.add(rim);const fill=new T.DirectionalLight(0xfff8e5,.8);fill.position.set(1,1,5);scene.add(fill);
 const model=root.model=createPitcherModel(scene),ball=model.ball;
 function ground(geo,color,y){const o=new T.Mesh(geo,new T.MeshStandardMaterial({color,roughness:1}));o.position.y=y;o.receiveShadow=true;scene.add(o);return o;}
 const floor=ground(new T.CircleGeometry(8,80),0x375846,-.025);floor.rotation.x=-Math.PI/2;
 const mound=ground(new T.CylinderGeometry(1.58,1.65,.04,96),0xaf9471,-.027);mound.position.z=.48;
 const rubber=ground(new T.BoxGeometry(.61,.025,.15),0xeee7d1,.008);rubber.position.z=-.04;
 const guide=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(0,.004,.1),new T.Vector3(0,.004,2.5)]),new T.LineDashedMaterial({color:0xf4d998,dashSize:.10,gapSize:.12,transparent:true,opacity:.45}));guide.computeLineDistances();scene.add(guide);
 const highlight=new T.Mesh(new T.TorusGeometry(.15,.006,8,48),new T.MeshBasicMaterial({color:0xf1c970,transparent:true,opacity:.65,depthTest:false}));scene.add(highlight);
 const trail=new T.Line(new T.BufferGeometry(),new T.LineDashedMaterial({color:0xf2dba0,dashSize:.07,gapSize:.055,transparent:true,opacity:.7}));scene.add(trail);trail.visible=false;
 const controls=root.controls=document.createElement('div');controls.className='pitcher3d-controls';controls.innerHTML=`<div role="group" aria-label="立體投手視角"><button type="button" data-pitcher-view="side" aria-pressed="true">側前方</button><button type="button" data-pitcher-view="front" aria-pressed="false">正面</button><button type="button" data-pitcher-view="back" aria-pressed="false">背面</button><button type="button" data-pitcher-zoom="in" aria-label="拉近看投手">＋</button><button type="button" data-pitcher-zoom="out" aria-label="拉遠看投手">−</button></div><div class="pitcher-motion-bar"><button type="button" data-pitcher-play disabled>載入中…</button><button type="button" data-pitcher-speed aria-pressed="true">慢看 ½×</button><label>拖曳看動作<input type="range" min="0" max="1000" value="0" data-pitcher-scrub aria-label="投球動作時間軸"></label></div><p class="pitcher3d-caption" role="status">正在準備立體投手…</p><details class="pitcher-motion-source"><summary>動作資料來源</summary><p>CMU 動作捕捉資料庫 124–01 真人投球紀錄，對應到教學人物骨架。用來觀察全身配合，並非標準姿勢評分。<a href="https://mocap.cs.cmu.edu/subjects/124/" target="_blank" rel="noopener">查看原始資料</a></p></details>`;canvas.closest('.stage').after(controls);
 const play=controls.querySelector('[data-pitcher-play]'),scrub=controls.querySelector('[data-pitcher-scrub]'),caption=controls.querySelector('.pitcher3d-caption');
 function cameraAt(){camera.position.set(Math.sin(root.angle)*root.radius,1.60,.72+Math.cos(root.angle)*root.radius);camera.lookAt(.03,.94,.72);}
 controls.querySelectorAll('[data-pitcher-view]').forEach(b=>b.onclick=()=>{root.angle={side:-.72,front:0,back:Math.PI}[b.dataset.pitcherView];controls.querySelectorAll('[data-pitcher-view]').forEach(a=>a.setAttribute('aria-pressed',String(a===b)));cameraAt();});
 controls.querySelectorAll('[data-pitcher-zoom]').forEach(b=>b.onclick=()=>{root.radius=T.MathUtils.clamp(root.radius+(b.dataset.pitcherZoom==='in'?-.3:.3),2.7,5.5);cameraAt();});
 play.onclick=()=>{if(!root.motion)return;root.auto=!root.auto;root.transition=false;if(root.auto){if(!root.hasPlayed||root.time>=root.motion.duration-.04)root.time=0;root.hasPlayed=true;root.last=performance.now();}play.textContent=root.auto?'Ⅱ 暫停':'▶ 看完整動作';};
 controls.querySelector('[data-pitcher-speed]').onclick=e=>{root.rate=root.rate===.5?1:.5;e.currentTarget.textContent=root.rate===.5?'慢看 ½×':'原速 1×';e.currentTarget.setAttribute('aria-pressed',String(root.rate===.5));};
 scrub.oninput=()=>{if(!root.motion)return;root.auto=false;root.transition=false;root.hasPlayed=true;root.time=Number(scrub.value)/1000*root.motion.duration;play.textContent='▶ 繼續動作';};
 let drag;canvas.addEventListener('pointerdown',e=>drag={x:e.clientX,y:e.clientY});canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x;if(Math.abs(e.clientY-drag.y)>Math.abs(dx)*1.3){drag=null;return;}root.angle-=dx*.009;drag={x:e.clientX,y:e.clientY};cameraAt();});canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
 function poseAt(time){const m=root.motion,f=T.MathUtils.clamp(time*m.fps,0,m.frames.length-1),i=Math.floor(f),a=m.frames[i],b=m.frames[Math.min(i+1,m.frames.length-1)],p={};for(const key of Object.keys(a))p[key]=new T.Vector3(...a[key]).lerp(new T.Vector3(...b[key]),f-i);p.released=time>=m.keyTimes.release;return p;}
 Promise.all([model.ready,capture]).then(([,motion])=>{if(active!==root)return;root.motion=motion;root.stops=[.75,motion.keyTimes.stride,motion.keyTimes.release-.05,motion.keyTimes.follow];root.time=root.stops[step];root.transition=from!==step;root.started=performance.now();root.last=performance.now();play.disabled=false;play.textContent='▶ 看完整動作';caption.textContent=captions[step];if(location.hash==='#pitcher'&&!root.didHandoff){root.didHandoff=true;requestAnimationFrame(()=>{if(active===root)canvas.closest('.stage').scrollIntoView({block:'start',behavior:'instant'});});}}).catch(e=>{if(active!==root)return;caption.textContent='人物載入失敗，請重新整理再試。';play.textContent='無法載入';console.error(e);});
 function draw(now){if(active!==root)return;root.raf=requestAnimationFrame(draw);const dt=Math.min(.05,(now-(root.last||now))/1000);root.last=now;if(!root.visible||document.hidden||!root.motion)return;
  if(root.auto){root.time=Math.min(root.motion.duration,root.time+dt*root.rate);if(root.time>=root.motion.duration){root.auto=false;play.textContent='↻ 再看一次';}}
  else if(root.transition){const f=Math.min(1,(now-root.started)/500),smooth=f*f*(3-2*f);root.time=T.MathUtils.lerp(root.stops[from],root.stops[step],smooth);if(f===1)root.transition=false;}
  const time=root.time,p=poseAt(time),m=root.motion;model.poseMotion(p);
  const selected=time<1.25?0:time<m.keyTimes.release-.12?1:time<m.keyTimes.release?2:3;caption.textContent=captions[selected];if(root.reported!==selected){root.reported=selected;document.dispatchEvent(new CustomEvent('baseball:pitcher-position',{detail:selected}));}scrub.value=Math.round(time/m.duration*1000);
  if(root.auto&&root.lastSeen!==selected){root.lastSeen=selected;document.dispatchEvent(new CustomEvent('baseball:pitcher-seen',{detail:selected}));}
  if(time>=m.keyTimes.release){if(!root.release){model.poseMotion(poseAt(m.keyTimes.release));root.release=model.handPosition();model.poseMotion(p);}const t=time-m.keyTimes.release;ball.position.copy(root.release).add(new T.Vector3(.12*t,-.12*t-.8*t*t,5*t));trail.visible=true;trail.geometry.dispose();trail.geometry=new T.BufferGeometry().setFromPoints([root.release,ball.position]);trail.computeLineDistances();ball.visible=t<.38;}else{root.release=null;ball.position.copy(model.handPosition());ball.visible=true;trail.visible=false;}
  highlight.position.copy(selected===0?p.rf:selected===1?p.hip:selected===2?p.re:p.lf);highlight.rotation.set(selected===0||selected===3?Math.PI/2:0,0,0);highlight.visible=!root.auto;
  renderer.render(scene,camera);
 }
 root.ro=new ResizeObserver(()=>{const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();});root.ro.observe(canvas);root.io=new IntersectionObserver(e=>root.visible=e[0].isIntersecting,{rootMargin:'100px'});root.io.observe(canvas);cameraAt();root.raf=requestAnimationFrame(draw);
 }catch(e){console.error('立體投手載入失敗',e);canvas.setAttribute('aria-label','立體投手無法載入，請參考下方分步說明');}
}
window.BaseballPitcher={mount,cleanup};
function connect(){const canvas=document.querySelector('#experiment-canvas');if(canvas?.dataset.lessonMode==='body'&&canvas.dataset.lessonChapter==='3')mount(canvas,Number(canvas.dataset.poseStep),Number(canvas.dataset.poseFrom));}
document.addEventListener('baseball:lesson-render',connect);connect();
