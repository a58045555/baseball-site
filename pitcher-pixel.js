// Chapter 4 "body" mode as pixel art: the captured pitching motion (CMU 124-01) drives a little
// pixel pitcher drawn on a low-resolution 2D canvas and scaled up without smoothing. No WebGL,
// no model download, so it opens instantly on any phone. Same controls and events as the 3D version.
const captions=['右腳站穩，左膝抬起，準備向前。','左腳跨出去，髖和肩膀接著轉。','手肘帶著手往前，球正在加速。','球離開手指，手臂和後腳自然收尾。'];
const VIEWS=[['side','一壘側'],['quarter','斜前方'],['front','本壘後']];
const ANGLE={side:0,quarter:-0.7,front:-Math.PI/2};
const C={sky1:'#8ec5e8',sky2:'#cfe6f3',stands:'#4b5f7a',standsDark:'#3a4a60',crowd:['#d9dde3','#c74a44','#2f5b94','#e6cf8f','#f1efe8'],wall:'#2d6b4d',wallLine:'#f0d35c',grassA:'#5a9a45',grassB:'#4f8c3d',dirt:'#b9875c',dirtLight:'#cfa174',dirtDark:'#a3734b',chalk:'#f5f1e6',skin:'#e7b28f',skinDark:'#c98f6c',jersey:'#f4f1ea',stripe:'#8d93a8',navy:'#1d3552',navyLight:'#30507a',red:'#d8513a',glove:'#8d5130',gloveDark:'#5f3620',ball:'#fffaf0',seam:'#d8513a',shoe:'#23262c',sock:'#1d3552',outline:'#10203a',gold:'#f1c970'};
let active=null;
const capture=fetch(new URL('./models/pitching-motion.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('投球動作資料載入失敗');return r.json();});capture.catch(()=>{});

function cleanup(){if(!active)return;const a=active;active=null;cancelAnimationFrame(a.raf);a.ro?.disconnect();a.controls?.remove();a.canvas.style.imageRendering='';}

function mount(canvas,step,from=step){
 cleanup();const root={canvas,step,from,started:performance.now(),auto:false,raf:0,view:'side',time:0,rate:.5,hasPlayed:false};active=root;
 const ctx=canvas.getContext('2d');canvas.style.imageRendering='pixelated';
 const buf=document.createElement('canvas'),bctx=buf.getContext('2d');const fig=document.createElement('canvas'),fctx=fig.getContext('2d');const sil=document.createElement('canvas'),sctx=sil.getContext('2d');
 const controls=root.controls=document.createElement('div');controls.className='pitcher3d-controls pixel';
 controls.innerHTML=`<div class="pitcher-views" role="group" aria-label="像素投手視角">${VIEWS.map(([id,name])=>`<button type="button" data-pitcher-view="${id}" aria-pressed="${id===root.view}">${name}</button>`).join('')}</div>
 <div class="pitcher-motion-bar"><button type="button" data-pitcher-play disabled>載入中…</button><button type="button" data-pitcher-speed aria-pressed="true">慢看 ½×</button><label>拖曳看動作<input type="range" min="0" max="1000" value="0" data-pitcher-scrub aria-label="投球動作時間軸"></label></div>
 <p class="pitcher3d-caption" role="status">正在準備像素投手…</p>
 <details class="pitcher-motion-source"><summary>動作資料來源</summary><p>CMU 動作捕捉資料庫 124–01 真人投球紀錄，每一幀的關節位置直接畫成像素小人；用來觀察全身配合，並非標準姿勢評分。<a href="https://mocap.cs.cmu.edu/subjects/124/" target="_blank" rel="noopener">查看原始資料</a></p></details>`;
 canvas.closest('.stage').after(controls);
 const play=controls.querySelector('[data-pitcher-play]'),scrub=controls.querySelector('[data-pitcher-scrub]'),caption=controls.querySelector('.pitcher3d-caption');
 controls.querySelectorAll('[data-pitcher-view]').forEach(b=>b.onclick=()=>{root.view=b.dataset.pitcherView;controls.querySelectorAll('[data-pitcher-view]').forEach(a=>a.setAttribute('aria-pressed',String(a===b)));root.bg=null;});
 play.onclick=()=>{if(!root.motion)return;root.auto=!root.auto;root.transition=false;if(root.auto){if(!root.hasPlayed||root.time>=root.end-.04)root.time=0;root.hasPlayed=true;}play.textContent=root.auto?'Ⅱ 暫停':'▶ 看完整動作';};
 controls.querySelector('[data-pitcher-speed]').onclick=e=>{root.rate=root.rate===.5?1:root.rate===1?.25:.5;e.currentTarget.textContent=root.rate===.5?'慢看 ½×':root.rate===1?'原速 1×':'超慢 ¼×';e.currentTarget.setAttribute('aria-pressed',String(root.rate!==1));};
 scrub.oninput=()=>{if(!root.motion)return;root.auto=false;root.transition=false;root.hasPlayed=true;root.time=Number(scrub.value)/1000*root.end;play.textContent='▶ 繼續動作';};

 // ---- geometry: metres -> pixels. +z toward the plate, +x glove side, y up.
 let PX=26,W=160,H=110,ground=0;
 function resize(){const r=canvas.getBoundingClientRect();if(!r.width)return;W=Math.min(260,Math.round(r.width/3));H=Math.max(60,Math.round(W*r.height/r.width));PX=Math.max(14,Math.round(H*.30));canvas.width=W;canvas.height=H;buf.width=fig.width=sil.width=W;buf.height=fig.height=sil.height=H;ctx.imageSmoothingEnabled=false;ground=Math.round(H*.80);root.bg=null;}
 root.ro=new ResizeObserver(resize);root.ro.observe(canvas);resize();
 function project(p){const a=ANGLE[root.view],sx=p.z*Math.cos(a)+p.x*Math.sin(a),d=p.x*Math.cos(a)-p.z*Math.sin(a);const ox=root.view==='side'?W*.34:root.view==='front'?W*.5:W*.42;return {x:ox+sx*PX,y:ground-p.y*PX,d};}
 function sample(m,time){const f=Math.min(Math.max(time*m.fps,0),m.frames.length-1),i=Math.floor(f),a=m.frames[i],b=m.frames[Math.min(i+1,m.frames.length-1)],t=f-i,p={};for(const k of Object.keys(a))p[k]={x:a[k][0]+(b[k][0]-a[k][0])*t,y:a[k][1]+(b[k][1]-a[k][1])*t,z:a[k][2]+(b[k][2]-a[k][2])*t};return p;}

 // ---- pixel primitives on a context
 function disc(c,x,y,r,col){c.fillStyle=col;const R=Math.ceil(r);for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++)if(dx*dx+dy*dy<=r*r+.25)c.fillRect(Math.round(x+dx),Math.round(y+dy),1,1);}
 function limb(c,a,b,r,col){const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)));for(let i=0;i<=n;i++)disc(c,a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n,r,col);}
 function poly(c,pts,col){c.fillStyle=col;c.beginPath();pts.forEach((p,i)=>i?c.lineTo(Math.round(p.x),Math.round(p.y)):c.moveTo(Math.round(p.x),Math.round(p.y)));c.closePath();c.fill();}

 // ---- background: drawn once per size and view
 function background(){const c=bctx;c.clearRect(0,0,W,H);
  for(let y=0;y<ground;y++){c.fillStyle=y<ground*.35?C.sky1:y<ground*.5?'#a4d2ec':C.sky2;c.fillRect(0,y,W,1);}
  const standTop=Math.round(ground*.62);c.fillStyle=C.standsDark;c.fillRect(0,standTop,W,ground-standTop-6);
  for(let y=standTop+1;y<ground-7;y+=2)for(let x=(y%4)>>1;x<W;x+=2){c.fillStyle=C.crowd[(x*7+y*3)%C.crowd.length];if((x*13+y*7)%4)c.fillRect(x,y,1,1);}
  c.fillStyle=C.wall;c.fillRect(0,ground-7,W,7);c.fillStyle=C.wallLine;c.fillRect(0,ground-7,W,1);
  for(let y=ground;y<H;y++){c.fillStyle=((y-ground)>>2)%2?C.grassA:C.grassB;c.fillRect(0,y,W,1);}
  // mound: an ellipse of dirt under the rubber, the plate off to the right in the side view
  const mx=project({x:0,y:0,z:.45}).x,ry=Math.max(3,Math.round(PX*.16)),rx=Math.round(PX*2.6);
  c.fillStyle=C.dirtDark;c.beginPath();c.ellipse(mx,ground+1,rx,ry,0,0,Math.PI*2);c.fill();c.fillStyle=C.dirt;c.beginPath();c.ellipse(mx,ground-1,rx-1,ry-1,0,0,Math.PI*2);c.fill();c.fillStyle=C.dirtLight;c.fillRect(mx-rx+3,ground-ry+1,rx*2-6,1);
  c.fillStyle=C.chalk;const rb=project({x:0,y:0,z:0});c.fillRect(Math.round(rb.x-PX*.3),ground-3,Math.round(PX*.6),2);
  if(root.view!=='front'){const pl=project({x:0,y:0,z:18.44});if(pl.x<W+20){c.fillStyle=C.dirt;c.beginPath();c.ellipse(pl.x,ground,Math.round(PX*1.2),ry,0,0,Math.PI*2);c.fill();c.fillStyle=C.chalk;c.fillRect(Math.round(pl.x-3),ground-2,6,2);
   // catcher crouching behind the plate, mitt up
   const cx=Math.round(pl.x+PX*.9);c.fillStyle=C.navy;c.fillRect(cx-4,ground-16,9,8);c.fillStyle=C.jersey;c.fillRect(cx-5,ground-10,11,6);c.fillStyle=C.navy;c.fillRect(cx-6,ground-5,4,5);c.fillRect(cx+3,ground-5,4,5);c.fillStyle=C.shoe;c.fillRect(cx-7,ground-1,5,2);c.fillRect(cx+3,ground-1,5,2);c.fillStyle=C.skin;c.fillRect(cx-2,ground-20,5,5);c.fillStyle=C.navy;c.fillRect(cx-3,ground-22,7,3);disc(c,cx-8,ground-15,3,C.glove);disc(c,cx-8,ground-15,1.2,C.gloveDark);}}
  root.bg=true;}

 // ---- the pitcher from one captured frame
 function drawPitcher(p,released,flightT){
  fctx.clearRect(0,0,W,H);const P={};for(const k of Object.keys(p))P[k]=project(p[k]);
  const parts=[];
  for(const s of ['r','l']){const d=(P[s+'hip'].d+P[s+'k'].d+P[s+'f'].d)/3;parts.push({d,draw:c=>{limb(c,P[s+'hip'],P[s+'k'],3.2,C.jersey);limb(c,P[s+'k'],P[s+'f'],2.6,C.jersey);limb(c,{x:P[s+'f'].x,y:P[s+'f'].y-3},P[s+'f'],2.4,C.sock);limb(c,P[s+'f'],P[s+'t'],2,C.shoe);}});}
  parts.push({d:(P.rs.d+P.ls.d+P.rhip.d+P.lhip.d)/4,draw:c=>{const torso=[{x:P.rs.x,y:P.rs.y-1},{x:P.ls.x,y:P.ls.y-1},{x:P.lhip.x+(P.lhip.x>P.rhip.x?2:-2),y:P.lhip.y+2},{x:P.rhip.x+(P.rhip.x>P.lhip.x?2:-2),y:P.rhip.y+2}];poly(c,torso,C.jersey);
   // pinstripes clipped to the torso, then the belt
   c.save();c.beginPath();torso.forEach((q,i)=>i?c.lineTo(Math.round(q.x),Math.round(q.y)):c.moveTo(Math.round(q.x),Math.round(q.y)));c.closePath();c.clip();c.fillStyle=C.stripe;const x0=Math.min(P.rs.x,P.ls.x,P.rhip.x,P.lhip.x),x1=Math.max(P.rs.x,P.ls.x,P.rhip.x,P.lhip.x);for(let x=Math.round(x0);x<=x1;x+=3)c.fillRect(x,0,1,H);c.fillStyle=C.navy;const by=(P.rhip.y+P.lhip.y)/2+1;c.fillRect(0,Math.round(by),W,2);c.restore();
   limb(c,P.rs,P.ls,2.4,C.jersey);}});
  parts.push({d:P.head.d,draw:c=>{limb(c,P.neck,P.head,1.8,C.skin);const r=PX*.11;disc(c,P.headTop.x,P.headTop.y+r*1.1,r,C.skin);
   // cap: crown on top, bill toward the plate
   const facing=root.view==='front'?0:(P.lt.x>P.rt.x||P.ri.x>P.neck.x?1:-1);c.fillStyle=C.navy;disc(c,P.headTop.x,P.headTop.y+r*.9,r+.6,C.navy);c.fillStyle=C.skin;disc(c,P.headTop.x,P.headTop.y+r*1.4,r-.2,C.skin);c.fillStyle=C.navy;c.fillRect(Math.round(P.headTop.x-r),Math.round(P.headTop.y+r*.55),Math.round(r*2),2);if(facing)c.fillRect(Math.round(P.headTop.x+(facing>0?r:-r-3)),Math.round(P.headTop.y+r*.6),4,1);
   if(root.view==='front'){c.fillStyle=C.outline;c.fillRect(Math.round(P.headTop.x-2),Math.round(P.headTop.y+r*1.2),1,1);c.fillRect(Math.round(P.headTop.x+2),Math.round(P.headTop.y+r*1.2),1,1);}}});
  parts.push({d:(P.rs.d+P.re.d+P.rh.d)/3,draw:c=>{limb(c,P.rs,P.re,2.4,C.jersey);limb(c,P.re,P.rh,2,C.skin);limb(c,P.rh,P.ri,1.6,C.skin);}});
  parts.push({d:(P.ls.d+P.le.d+P.lh.d)/3,draw:c=>{limb(c,P.ls,P.le,2.4,C.jersey);limb(c,P.le,P.lh,2,C.skin);disc(c,P.lh.x,P.lh.y,3.4,C.gloveDark);disc(c,P.lh.x,P.lh.y-.5,2.6,C.glove);}});
  parts.sort((a,b)=>a.d-b.d);for(const part of parts)part.draw(fctx);
  // outline: a dark silhouette offset in four directions under the figure
  sctx.clearRect(0,0,W,H);sctx.drawImage(fig,0,0);sctx.globalCompositeOperation='source-in';sctx.fillStyle=C.outline;sctx.fillRect(0,0,W,H);sctx.globalCompositeOperation='source-over';
  ctx.drawImage(buf,0,0);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])ctx.drawImage(sil,dx,dy);ctx.drawImage(fig,0,0);
  // the ball: in the hand until release, then a simple arc to the catcher's mitt
  let bp;if(!released)bp={x:P.ri.x,y:P.ri.y};else{const start=root.releasePx,end=root.mittPx,t=Math.min(1,flightT/.5);bp={x:start.x+(end.x-start.x)*t,y:start.y+(end.y-start.y)*t-Math.sin(t*Math.PI)*PX*.25};if(root.view==='front')bp={x:start.x+(end.x-start.x)*t,y:start.y+(end.y-start.y)*t};}
  if(bp.x>-5&&bp.x<W+5){disc(ctx,bp.x,bp.y,1.6,C.outline);disc(ctx,bp.x,bp.y,1.1,C.ball);ctx.fillStyle=C.seam;ctx.fillRect(Math.round(bp.x),Math.round(bp.y-1),1,1);}
  return P;}

 Promise.all([capture]).then(([m])=>{if(active!==root)return;root.motion=m;root.end=m.duration+.6;root.stops=[.75,m.keyTimes.stride,m.keyTimes.release-.05,m.keyTimes.follow];root.time=root.stops[step];root.transition=from!==step;root.started=performance.now();root.last=performance.now();play.disabled=false;play.textContent='▶ 看完整動作';caption.textContent=captions[step];
  if(location.hash==='#pitcher'&&!root.didHandoff){root.didHandoff=true;requestAnimationFrame(()=>{if(active===root)canvas.closest('.stage').scrollIntoView({block:'start',behavior:'instant'});});}
 }).catch(e=>{if(active!==root)return;caption.textContent='動作資料載入失敗，請重新整理再試。';play.textContent='無法載入';console.error(e);});

 function draw(now){if(active!==root)return;root.raf=requestAnimationFrame(draw);const dt=Math.min(.05,(now-(root.last||now))/1000);root.last=now;if(document.hidden||!root.motion||!W)return;
  const m=root.motion;
  if(root.auto){root.time=Math.min(root.end,root.time+dt*root.rate);if(root.time>=root.end){root.auto=false;play.textContent='↻ 再看一次';}}
  else if(root.transition){const f=Math.min(1,(now-root.started)/500),s=f*f*(3-2*f);root.time=root.stops[from]+(root.stops[step]-root.stops[from])*s;if(f===1)root.transition=false;}
  if(!root.bg)background();
  const time=root.time,p=sample(m,Math.min(time,m.duration)),released=time>=m.keyTimes.release;
  if(released&&!root.releasePx){const r=sample(m,m.keyTimes.release);root.releasePx=project(r.ri);root.mittPx=project({x:0,y:.8,z:18.44-.4});}if(!released)root.releasePx=null;
  const P=drawPitcher(p,released,time-m.keyTimes.release);
  const selected=time<1.25?0:time<m.keyTimes.release-.12?1:time<m.keyTimes.release?2:3;caption.textContent=captions[selected];scrub.value=Math.round(time/root.end*1000);
  if(root.reported!==selected){root.reported=selected;document.dispatchEvent(new CustomEvent('baseball:pitcher-position',{detail:selected}));}
  if(root.auto&&root.lastSeen!==selected){root.lastSeen=selected;document.dispatchEvent(new CustomEvent('baseball:pitcher-seen',{detail:selected}));}
  if(!root.auto&&time<m.duration){const key=selected===0?P.rf:selected===1?P.hip:selected===2?P.re:P.lf;ctx.fillStyle=C.gold;const r=5;for(let a=0;a<24;a++)ctx.fillRect(Math.round(key.x+Math.cos(a/24*Math.PI*2)*r),Math.round(key.y+Math.sin(a/24*Math.PI*2)*r),1,1);}
 }
 root.raf=requestAnimationFrame(draw);
}
window.BaseballPitcher={mount,cleanup};
function connect(){const canvas=document.querySelector('#experiment-canvas');if(canvas?.dataset.lessonMode==='body'&&canvas.dataset.lessonChapter==='3')mount(canvas,Number(canvas.dataset.poseStep),Number(canvas.dataset.poseFrom));}
document.addEventListener('baseball:lesson-render',connect);connect();
