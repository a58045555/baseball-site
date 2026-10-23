// Chapter 4 "body" mode as a motion-analysis diagram: the captured pitching motion (CMU 124-01)
// drawn as a skeleton on a 2D canvas. Joint colour shows speed (blue slow, red fast), the hand
// leaves a trail, and the speed curves below show the relay from hips to trunk to elbow to hand.
// No WebGL and no model download. Same controls and events as the 3D version it replaces.
const captions=['右腳站穩，左膝抬起，準備向前。','左腳跨出去，髖和肩膀接著轉。','手肘帶著手往前，球正在加速。','球離開手指，手臂和後腳自然收尾。'];
const VIEWS=[['side','側面'],['front','正面']];
const CURVES=[['hip','髖','#5aa9ff'],['chest','軀幹','#7bd389'],['re','手肘','#f1c970'],['ri','手','#ff6a4c']];
const BONES=[['hip','spine'],['spine','chest'],['chest','neck'],['neck','head'],['head','headTop'],['ls','rs'],['ls','le'],['le','lh'],['lh','li'],['rs','re'],['re','rh'],['rh','ri'],['lhip','rhip'],['lhip','lk'],['lk','lf'],['lf','lt'],['rhip','rk'],['rk','rf'],['rf','rt']];
const JOINTS=['hip','chest','neck','headTop','ls','rs','le','re','lh','rh','ri','lhip','rhip','lk','rk','lf','rf','lt','rt'];
let active=null;
const capture=fetch(new URL('./models/pitching-motion.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('投球動作資料載入失敗');return r.json();});capture.catch(()=>{});

function cleanup(){if(!active)return;const a=active;active=null;cancelAnimationFrame(a.raf);a.ro?.disconnect();a.controls?.remove();}

function mount(canvas,step,from=step){
 cleanup();const root={canvas,step,from,started:performance.now(),auto:false,raf:0,view:'side',time:0,rate:.5,hasPlayed:false};active=root;
 const ctx=canvas.getContext('2d');
 const controls=root.controls=document.createElement('div');controls.className='pitcher3d-controls';
 controls.innerHTML=`<div role="group" aria-label="投手視角">${VIEWS.map(([id,name])=>`<button type="button" data-pitcher-view="${id}" aria-pressed="${id===root.view}">${name}</button>`).join('')}</div><div class="pitcher-motion-bar"><button type="button" data-pitcher-play disabled>載入中…</button><button type="button" data-pitcher-speed aria-pressed="true">慢看 ½×</button><label>拖曳看動作<input type="range" min="0" max="1000" value="0" data-pitcher-scrub aria-label="投球動作時間軸"></label></div><p class="pitcher3d-caption" role="status">正在準備投球動作…</p><details class="pitcher-motion-source"><summary>怎麼看這張圖</summary><p>線條是投手的骨架，圓點是關節：藍色代表動得慢，紅色代表動得快。橘色的線是手走過的路。下方四條曲線是髖、軀幹、手肘、手的速度，它們一個接一個衝到最高，就像接力賽把力量傳到球上。動作來自 CMU 動作捕捉資料庫 124–01 的真人投球紀錄，用來觀察全身配合，並非標準姿勢評分。<a href="https://mocap.cs.cmu.edu/subjects/124/" target="_blank" rel="noopener">查看原始資料</a></p></details>`;
 canvas.closest('.stage').after(controls);
 const play=controls.querySelector('[data-pitcher-play]'),scrub=controls.querySelector('[data-pitcher-scrub]'),caption=controls.querySelector('.pitcher3d-caption');
 controls.querySelectorAll('[data-pitcher-view]').forEach(b=>b.onclick=()=>{root.view=b.dataset.pitcherView;controls.querySelectorAll('[data-pitcher-view]').forEach(a=>a.setAttribute('aria-pressed',String(a===b)));});
 play.onclick=()=>{if(!root.motion)return;root.auto=!root.auto;root.transition=false;if(root.auto){if(!root.hasPlayed||root.time>=root.end-.04)root.time=0;root.hasPlayed=true;}play.textContent=root.auto?'Ⅱ 暫停':'▶ 看完整動作';};
 controls.querySelector('[data-pitcher-speed]').onclick=e=>{root.rate=root.rate===.5?1:root.rate===1?.25:.5;e.currentTarget.textContent=root.rate===.5?'慢看 ½×':root.rate===1?'原速 1×':'超慢 ¼×';e.currentTarget.setAttribute('aria-pressed',String(root.rate!==1));};
 scrub.oninput=()=>{if(!root.motion)return;root.auto=false;root.transition=false;root.hasPlayed=true;root.time=Number(scrub.value)/1000*root.end;play.textContent='▶ 繼續動作';};
 function resize(){const r=canvas.getBoundingClientRect();if(!r.width)return;const d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);}
 root.ro=new ResizeObserver(resize);root.ro.observe(canvas);resize();

 let m,sample,speed,curveData,vmax,bounds;
 // screen axes per view: side = from the throwing-arm side (plate to the left), front = from home plate
 const axis={side:q=>[-q[2],q[0]],front:q=>[q[0],-q[2]]};
 function setup(motion){m=motion;
  sample=t=>{const f=Math.min(Math.max(t*m.fps,0),m.frames.length-1),i=Math.floor(f),a=m.frames[i],b=m.frames[Math.min(i+1,m.frames.length-1)],u=f-i,p={};for(const k in a)p[k]=[a[k][0]+(b[k][0]-a[k][0])*u,a[k][1]+(b[k][1]-a[k][1])*u,a[k][2]+(b[k][2]-a[k][2])*u];return p;};
  speed=(k,t)=>{const a=sample(t-.02)[k],b=sample(t+.02)[k];return Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])/.04;};
  curveData=CURVES.map(([k])=>{const arr=[];for(let t=0;t<=m.duration;t+=1/60)arr.push(speed(k,t));return arr;});
  vmax=Math.max(...curveData.map(a=>Math.max(...a)));
  bounds={};for(const v in axis){let lo=1e9,hi=-1e9,top=0;for(const f of m.frames)for(const k in f){const x=axis[v](f[k])[0];lo=Math.min(lo,x);hi=Math.max(hi,x);top=Math.max(top,f[k][1]);}bounds[v]={lo,hi,top};}}
 function heat(v){const u=Math.min(1,v/vmax*1.15),stops=[[90,169,255],[123,211,137],[241,201,112],[255,90,60]],x=u*3,i=Math.min(2,Math.floor(x)),f=x-i,a=stops[i],b=stops[i+1];return `rgb(${a.map((q,j)=>Math.round(q+(b[j]-q)*f)).join(',')})`;}

 Promise.all([capture]).then(([motion])=>{if(active!==root)return;setup(motion);root.motion=motion;root.end=motion.duration+.4;root.stops=[.75,motion.keyTimes.stride,motion.keyTimes.release-.05,motion.keyTimes.follow];root.time=root.stops[step];root.transition=from!==step;root.started=performance.now();root.last=performance.now();play.disabled=false;play.textContent='▶ 看完整動作';caption.textContent=captions[step];
  if(location.hash==='#pitcher'&&!root.didHandoff){root.didHandoff=true;requestAnimationFrame(()=>{if(active===root)canvas.closest('.stage').scrollIntoView({block:'start',behavior:'instant'});});}
 }).catch(e=>{if(active!==root)return;caption.textContent='動作資料載入失敗，請重新整理再試。';play.textContent='無法載入';console.error(e);});

 function draw(now){if(active!==root)return;root.raf=requestAnimationFrame(draw);const dt=Math.min(.05,(now-(root.last||now))/1000);root.last=now;if(document.hidden||!root.motion||!canvas.width)return;
  if(root.auto){root.time=Math.min(root.end,root.time+dt*root.rate);if(root.time>=root.end){root.auto=false;play.textContent='↻ 再看一次';}}
  else if(root.transition){const f=Math.min(1,(now-root.started)/500),s=f*f*(3-2*f);root.time=root.stops[from]+(root.stops[step]-root.stops[from])*s;if(f===1)root.transition=false;}
  const c=ctx,w=canvas.width,h=canvas.height,t=Math.min(root.time,m.duration),K=m.keyTimes;
  // layout: figure on top, speed chart in the bottom band, clear of the stage labels
  const chartH=h*.24,chartTop=h-chartH-h*.07,figTop=h*.13,ground=chartTop-h*.05,B=bounds[root.view];
  const s=Math.min((w*.8)/(B.hi-B.lo+.4),(ground-figTop)/(B.top+.1)),ox=(w-(B.hi-B.lo)*s)/2-B.lo*s;
  const P=q=>{const [x,d]=axis[root.view](q);return {x:ox+x*s,y:ground-q[1]*s,d};};
  c.fillStyle='#193d35';c.fillRect(0,0,w,h);
  c.strokeStyle='rgba(225,235,180,.07)';c.lineWidth=1;const step=s*.25;for(let x=ox%step;x<w;x+=step){c.beginPath();c.moveTo(x,0);c.lineTo(x,ground);c.stroke();}for(let y=ground;y>0;y-=step){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
  c.strokeStyle='rgba(225,235,180,.45)';c.lineWidth=Math.max(1,w*.002);c.beginPath();c.moveTo(0,ground);c.lineTo(w,ground);c.stroke();
  const p=sample(t),J={};for(const k in p)J[k]=P(p[k]);
  // hand path over the last 0.6 s
  c.lineCap='round';c.lineWidth=Math.max(2,s*.022);for(let k=0;k<36;k++){const a=t-.6+k/60;if(a<0)continue;const qa=P(sample(a).ri),qb=P(sample(a+1/60).ri);c.strokeStyle=`rgba(255,106,76,${k/36*.85})`;c.beginPath();c.moveTo(qa.x,qa.y);c.lineTo(qb.x,qb.y);c.stroke();}
  // bones: the far side dimmer
  const mid=(J.lhip.d+J.rhip.d)/2;for(const [a,b] of BONES){const far=(J[a].d+J[b].d)/2>mid+.02;c.strokeStyle=far?'rgba(231,239,215,.42)':'rgba(231,239,215,.92)';c.lineWidth=Math.max(2,s*.035);c.beginPath();c.moveTo(J[a].x,J[a].y);c.lineTo(J[b].x,J[b].y);c.stroke();}
  for(const k of JOINTS){c.beginPath();c.arc(J[k].x,J[k].y,Math.max(3,s*(k==='ri'||k==='rh'?.05:.038)),0,7);c.fillStyle=heat(speed(k,t));c.fill();}
  // the ball: in the fingers, then away toward the plate after release
  if(t<K.release){c.beginPath();c.arc(J.ri.x,J.ri.y,Math.max(3,s*.04),0,7);c.fillStyle='#fffaf0';c.fill();}
  else{const r=P(sample(K.release).ri),k=(root.time-K.release)/.35;if(k<1){const dir=root.view==='side'?-1:0;const bx=r.x+dir*k*w*.6,by=r.y+k*s*(root.view==='side'?.1:.4),rad=Math.max(3,s*.04*(root.view==='front'?1-k*.6:1));c.beginPath();c.arc(bx,by,rad,0,7);c.fillStyle='#fffaf0';c.fill();}}
  // the joint this step is about, ringed in gold while paused
  const selected=t<1.25?0:t<K.release-.12?1:t<K.release?2:3;
  if(!root.auto&&root.time<m.duration){const key=J[['rf','hip','re','lf'][selected]];c.strokeStyle='#f1c970';c.lineWidth=Math.max(2,s*.015);c.beginPath();c.arc(key.x,key.y,s*.13,0,7);c.stroke();}
  const fs=Math.max(11,w*.026);c.font=`700 ${fs}px -apple-system,"Noto Sans TC",sans-serif`;c.fillStyle='#e7efd7';c.textAlign='right';c.fillText(`手的速度 ${(speed('ri',t)*3.6).toFixed(0)} km/h`,w*.96,figTop-fs*.2);
  // speed curves with a cursor
  const pad=w*.05,cw=w-2*pad,y0=chartTop+chartH*.92,ch=chartH*.62;c.fillStyle='rgba(0,0,0,.2)';c.fillRect(0,chartTop,w,chartH);
  CURVES.forEach(([,label,col],i)=>{const arr=curveData[i];c.strokeStyle=col;c.lineWidth=Math.max(1.5,w*.004);c.beginPath();arr.forEach((v,j)=>{const x=pad+j/(arr.length-1)*cw,y=y0-v/vmax*ch;j?c.lineTo(x,y):c.moveTo(x,y);});c.stroke();c.fillStyle=col;c.textAlign='left';c.font=`700 ${fs*.9}px -apple-system,"Noto Sans TC",sans-serif`;c.fillText(label,pad+i*fs*3.2,chartTop+fs*1.1);});
  const cx=pad+t/m.duration*cw;c.strokeStyle='#fff';c.lineWidth=Math.max(1.5,w*.003);c.beginPath();c.moveTo(cx,chartTop+fs*1.5);c.lineTo(cx,chartTop+chartH);c.stroke();
  caption.textContent=captions[selected];scrub.value=Math.round(root.time/root.end*1000);
  if(root.reported!==selected){root.reported=selected;document.dispatchEvent(new CustomEvent('baseball:pitcher-position',{detail:selected}));}
  if(root.auto&&root.lastSeen!==selected){root.lastSeen=selected;document.dispatchEvent(new CustomEvent('baseball:pitcher-seen',{detail:selected}));}
 }
 root.raf=requestAnimationFrame(draw);
}
window.BaseballPitcher={mount,cleanup};
function connect(){const canvas=document.querySelector('#experiment-canvas');if(canvas?.dataset.lessonMode==='body'&&canvas.dataset.lessonChapter==='3')mount(canvas,Number(canvas.dataset.poseStep),Number(canvas.dataset.poseFrom));}
document.addEventListener('baseball:lesson-render',connect);connect();
