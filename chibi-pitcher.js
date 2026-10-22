import * as T from './vendor/three.module.min.js';
import {makePitcherGlove} from './scene-models.js';

// Cartoon pitcher in the spirit of chibi baseball games: big round head, compact body, short
// limbs. Unlike a stack of primitives, the body, arms and legs are lofted tubes skinned to the
// bones, so elbows, knees and the waist bend as one smooth surface; the hands have fingers,
// the face has eyes with iris and highlight, brows, a nose and a mouth; the cap has six panels
// and a curved bill; the uniform has a collar, placket, buttons, numbers, belt and cleats.
// Cel shading with ink outlines. Everything is built in code; nothing is downloaded.
// Bones rest with identity rotation (a bone's local axes equal the world axes at rest).
const C={skin:0xf4cba6,jersey:0xfbf8f0,navy:0x1d3552,red:0xd8513a,pants:0xf6f2e8,shoe:0x202428,sock:0x1d3552,ink:0x171a22,hair:0x2a1b15,iris:0x3a2418,lips:0x9b3f34,buckle:0xe4c267,sole:0xeeeadc};
const H=0.56,R_HEAD=0.255;// hip height and head radius, metres
const INK=.0055;

export function createPitcherModel(scene){
 const group=new T.Group();scene.add(group);
 let lastPose,disposed=false,gripPoint,ready,skeleton;
 const bones={},rest=[],anatomy={},parts=[];
 const world=o=>o.getWorldPosition(new T.Vector3());
 const V=(x,y,z)=>new T.Vector3(x,y,z);

 // ---------- cel materials ----------
 const steps=document.createElement('canvas');steps.width=5;steps.height=1;const sx=steps.getContext('2d');[['#7e8092',0],['#bcbec9',1],['#e8e9ef',2],['#fafafc',3],['#ffffff',4]].forEach(([c,i])=>{sx.fillStyle=c;sx.fillRect(i,0,1,1);});
 const gradient=new T.CanvasTexture(steps);gradient.minFilter=gradient.magFilter=T.NearestFilter;gradient.colorSpace=T.NoColorSpace;
 const toon=(color,extra={})=>new T.MeshToonMaterial({color,gradientMap:gradient,...extra});
 const inkMaterial=new T.MeshBasicMaterial({color:C.ink,side:T.BackSide});
 const M={skin:toon(C.skin),jersey:toon(C.jersey),navy:toon(C.navy),red:toon(C.red),pants:toon(C.pants),shoe:toon(C.shoe),sock:toon(C.sock),hair:toon(C.hair),sole:toon(C.sole),buckle:toon(C.buckle),white:toon(0xffffff),iris:toon(C.iris),lips:toon(C.lips),capUnder:toon(0x2c3f4e)};

 // ---------- the ball ----------
 const ball=new T.Mesh(new T.SphereGeometry(.05,28,20),toon(0xfffaf0));group.add(ball);ball.castShadow=true;
 for(let side=0;side<2;side++){const pts=[];for(let i=0;i<=96;i++){const a=i/96*Math.PI*2,theta=.95+.27*Math.cos(2*a),phi=a+side*Math.PI;pts.push(V(.0505*Math.sin(theta)*Math.cos(phi),.0505*Math.cos(theta)*(side?1:-1),.0505*Math.sin(theta)*Math.sin(phi)));}ball.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts,true),96,.0024,5,true),M.red));}
 hull(ball);

 // ---------- helpers ----------
 function hull(mesh,k=INK){const g=mesh.geometry.clone();const p=g.attributes.position,n=g.attributes.normal;for(let i=0;i<p.count;i++)p.setXYZ(i,p.getX(i)+n.getX(i)*k,p.getY(i)+n.getY(i)*k,p.getZ(i)+n.getZ(i)*k);const ink=mesh.isSkinnedMesh?new T.SkinnedMesh(g,inkMaterial):new T.Mesh(g,inkMaterial);if(mesh.isSkinnedMesh){ink.bind(skeleton,mesh.bindMatrix);ink.frustumCulled=false;mesh.parent.add(ink);}else mesh.add(ink);ink.renderOrder=-1;parts.push(ink);return ink;}
 function part(geo,material,parent,{pos=[0,0,0],rot=[0,0,0],scale=[1,1,1],ink=true}={}){const m=new T.Mesh(geo,material);m.position.set(...pos);m.rotation.set(...rot);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);if(ink)hull(m,INK/Math.min(...scale));parts.push(m);return m;}
 const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
 const lerp=(a,b,t)=>a+(b-a)*t;
 // Loft a closed tube along a chain of rest-pose points. Each segment is driven by the bone at
 // its start; vertices near a joint blend between the two bones so the surface bends smoothly.
 // radius(t, angle) gives the half-width at 0..1 along the chain; angle 0 points along `u0`.
 function loft({chain,radius,u0=V(1,0,0),around=24,per=10,blend=.05,caps=[true,true],capScale=[1,1]}){
  const pts=chain.map(c=>c.p),n=pts.length,segLen=[],cum=[0];for(let i=0;i<n-1;i++){segLen.push(pts[i].distanceTo(pts[i+1]));cum.push(cum[i]+segLen[i]);}const L=cum[n-1];
  const rings=[];// {c,d,l,boneA,boneB,wB}
  for(let i=0;i<n-1;i++){const d=pts[i+1].clone().sub(pts[i]).normalize();for(let k=(i?1:0);k<=per;k++){const s=k/per,l=cum[i]+segLen[i]*s;let dir=d.clone();if(k===per&&i<n-2)dir=d.clone().add(pts[i+2].clone().sub(pts[i+1]).normalize()).normalize();if(k===0&&i>0)dir=d.clone().add(pts[i].clone().sub(pts[i-1]).normalize()).normalize();rings.push({c:pts[i].clone().lerp(pts[i+1],s),d:dir,l,i});}}
  // caps: extra rings shrinking into hemispheres
  const capRings=4,out=[];
  if(caps[0]){const r0=rings[0];for(let k=capRings;k>=1;k--){const a=k/(capRings+1)*Math.PI/2;out.push({c:r0.c.clone().addScaledVector(r0.d,-Math.sin(a)*capScale[0]*radius(0,0)),d:r0.d,l:0,i:0,scale:Math.cos(a)});}}
  for(const r of rings)out.push({...r,scale:1});
  if(caps[1]){const r1=rings[rings.length-1];for(let k=1;k<=capRings;k++){const a=k/(capRings+1)*Math.PI/2;out.push({c:r1.c.clone().addScaledVector(r1.d,Math.sin(a)*capScale[1]*radius(1,0)),d:r1.d,l:L,i:n-2,scale:Math.cos(a)});}}
  // parallel-transported frame
  let u=u0.clone();const pos=[],idx=[],si=[],sw=[];
  for(const r of out){u.addScaledVector(r.d,-u.dot(r.d));if(u.lengthSq()<1e-6)u=V(0,0,1).addScaledVector(r.d,-r.d.z);u.normalize();const v=new T.Vector3().crossVectors(u,r.d).normalize();
   const t=r.l/L;const joint=r.i+1,lj=cum[joint];let wB=0,boneA=chain[r.i].bone,boneB=chain[Math.min(n-2,r.i+1)].bone;
   if(r.i<n-2&&r.l>lj-blend)wB=.5*smooth(0,1,(r.l-(lj-blend))/blend);
   if(r.i>0&&r.l<cum[r.i]+blend){boneB=chain[r.i-1].bone;wB=.5*(1-smooth(0,1,(r.l-cum[r.i])/blend));}
   for(let j=0;j<around;j++){const a=j/around*Math.PI*2,rr=radius(t,a)*r.scale;pos.push(r.c.x+(u.x*Math.cos(a)+v.x*Math.sin(a))*rr,r.c.y+(u.y*Math.cos(a)+v.y*Math.sin(a))*rr,r.c.z+(u.z*Math.cos(a)+v.z*Math.sin(a))*rr);si.push(boneA.userData.index,boneB.userData.index,0,0);sw.push(1-wB,wB,0,0);}}
  for(let r=0;r<out.length-1;r++)for(let j=0;j<around;j++){const a=r*around+j,b=r*around+(j+1)%around,c=a+around,d=b+around;idx.push(a,c,b,b,c,d);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(si,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(sw,4));g.setIndex(idx);g.computeVertexNormals();return g;
 }
 function skinned(geo,material,{ink=true}={}){const m=new T.SkinnedMesh(geo,material);m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;group.add(m);m.bind(skeleton,new T.Matrix4());if(ink)hull(m);parts.push(m);return m;}

 // ---------- skeleton ----------
 function bone(name,parent,pos){const b=new T.Bone();b.name=name;b.position.set(...pos);(parent?bones[parent]:group).add(b);bones[name]=b;return b;}
 const build=()=>{
  bone('pelvis',null,[0,H,0]);bone('spine','pelvis',[0,.05,0]);bone('chest','spine',[0,.17,0]);bone('neck','chest',[0,.18,0]);bone('head','neck',[0,.06,0]);
  for(const [s,sign] of [['l',1],['r',-1]]){
   bone('thigh_'+s,'pelvis',[sign*.10,-.03,0]);bone('calf_'+s,'thigh_'+s,[0,-.24,0]);bone('foot_'+s,'calf_'+s,[0,-.19,0]);bone('toe_'+s,'foot_'+s,[0,-.06,.13]);
   bone('upperarm_'+s,'chest',[sign*.20,.10,0]);bone('lowerarm_'+s,'upperarm_'+s,[sign*.21,0,0]);bone('hand_'+s,'lowerarm_'+s,[sign*.19,0,0]);bone('tip_'+s,'hand_'+s,[sign*.09,0,0]);
  }
  group.updateMatrixWorld(true);const list=Object.values(bones);list.forEach((b,i)=>b.userData.index=i);skeleton=new T.Skeleton(list);
  const P=n=>world(bones[n]);
  // ---------- torso: one lofted body from crotch to neck ----------
  const crotch=P('pelvis').add(V(0,-.12,0)),belt=P('pelvis').add(V(0,.06,0)),chestP=P('chest'),neckP=P('neck').add(V(0,.02,0));
  const torsoR=(t,a)=>{const w=lerp(.135,.175,smooth(0,.35,t))*(1-.55*smooth(.80,1,t))+.02*smooth(.55,.85,t)*(1-smooth(.85,1,t));const front=Math.max(0,Math.sin(a)),zs=.80+.06*front*smooth(.1,.5,t)*(1-smooth(.6,.9,t));const sideW=1+.12*Math.abs(Math.cos(a))*smooth(.5,.85,t)*(1-smooth(.85,1,t));return w*Math.hypot(Math.cos(a)*sideW,Math.sin(a)*zs);};
  const torso=loft({chain:[{p:crotch,bone:bones.pelvis},{p:belt,bone:bones.spine},{p:chestP,bone:bones.chest},{p:neckP,bone:bones.chest}],radius:torsoR,u0:V(1,0,0),around:36,per:8,blend:.07,caps:[true,true],capScale:[.55,.5]});
  const jerseyMesh=skinned(torso,M.jersey);jerseyMesh.name='Jersey';
  // pants over the hips: a second shell from the belt down, slightly wider
  const hips=loft({chain:[{p:crotch.clone().add(V(0,.015,0)),bone:bones.pelvis},{p:belt.clone().add(V(0,.015,0)),bone:bones.spine}],radius:(t,a)=>torsoR(t*.33,a)*1.03+.006,u0:V(1,0,0),around:36,per:6,caps:[true,false],capScale:[.5,1]});
  skinned(hips,M.pants);
  // neck
  part(new T.CylinderGeometry(.07,.085,.12,20),M.skin,bones.neck,{pos:[0,.03,0]});
  // ---------- limbs ----------
  for(const [s,sign] of [['l',1],['r',-1]]){
   const sh=P('upperarm_'+s),el=P('lowerarm_'+s),wr=P('hand_'+s),hip=P('thigh_'+s),kn=P('calf_'+s),an=P('foot_'+s);
   // sleeve + upper arm (jersey) then forearm (skin), lofted as one tube in two colours
   const armR=(t,a)=>lerp(.072,.058,smooth(0,.5,t))*(1-.12*smooth(.85,1,t))+.006*Math.exp(-(((t-.5)/.06)**2));
   const sleeve=loft({chain:[{p:sh.clone().add(V(-sign*.03,.02,0)),bone:bones['upperarm_'+s]},{p:sh.clone().lerp(el,.62),bone:bones['upperarm_'+s]}],radius:(t,a)=>lerp(.085,.070,t),u0:V(0,0,1),around:22,per:5,caps:[true,false],capScale:[.9,1]});
   skinned(sleeve,M.jersey);
   const arm=loft({chain:[{p:sh.clone().lerp(el,.55),bone:bones['upperarm_'+s]},{p:el,bone:bones['lowerarm_'+s]},{p:wr.clone().add(V(sign*.01,0,0)),bone:bones['lowerarm_'+s]}],radius:armR,u0:V(0,0,1),around:22,per:7,blend:.045,caps:[true,true],capScale:[.6,.8]});
   skinned(arm,M.skin);
   // sleeve cuff
   part(new T.TorusGeometry(.071,.009,8,30),M.navy,bones['upperarm_'+s],{pos:[sign*.128,.0,0],rot:[0,Math.PI/2,0],ink:false});
   // knickers: hips to just under the knee; sock: knee to ankle
   const legR=(t,a)=>lerp(.092,.075,smooth(0,.6,t))*(1-.06*smooth(.7,1,t))+.008*Math.exp(-(((t-.52)/.07)**2));
   const knick=loft({chain:[{p:hip.clone().add(V(0,.06,0)),bone:bones['thigh_'+s]},{p:kn,bone:bones['thigh_'+s]},{p:kn.clone().lerp(an,.30),bone:bones['calf_'+s]}],radius:legR,u0:V(1,0,0),around:24,per:7,blend:.05,caps:[true,true],capScale:[.5,.35]});
   skinned(knick,M.pants);
   part(new T.TorusGeometry(.072,.009,8,30),M.navy,bones['calf_'+s],{pos:[0,-.062,0],rot:[Math.PI/2,0,0],ink:false});
   const sock=loft({chain:[{p:kn.clone().lerp(an,.22),bone:bones['calf_'+s]},{p:an.clone().add(V(0,.02,0)),bone:bones['foot_'+s]}],radius:(t,a)=>lerp(.064,.052,t),u0:V(1,0,0),around:22,per:6,blend:.04,caps:[true,true],capScale:[.4,.6]});
   skinned(sock,M.sock);
   for(const k of [0,1])part(new T.TorusGeometry(.058-k*.003,.008,6,26),M.red,bones['calf_'+s],{pos:[0,-.105-k*.035,0],rot:[Math.PI/2,0,0],ink:false});
   // cleat: a shaped shell with a pale sole, toe cap, laces and a heel tab
   const shoeGeo=new T.SphereGeometry(1,28,18);const sp=shoeGeo.attributes.position;for(let i=0;i<sp.count;i++){const x=sp.getX(i),y=sp.getY(i),z=sp.getZ(i);const toe=Math.max(0,z);sp.setXYZ(i,x*.082*(1-.18*toe)*(1+.08*Math.max(0,-z)),y<0?y*.045:y*.075*(1-.42*toe)+.01*(1-Math.abs(x)),z>0?z*.175:z*.095);}shoeGeo.computeVertexNormals();
   part(shoeGeo,M.shoe,bones['foot_'+s],{pos:[0,-.058,.04]});
   const soleGeo=new T.SphereGeometry(1,24,8);const so=soleGeo.attributes.position;for(let i=0;i<so.count;i++){const x=so.getX(i),y=so.getY(i),z=so.getZ(i);so.setXYZ(i,x*.088*(1-.15*Math.max(0,z)),y*.012,z>0?z*.185:z*.105);}soleGeo.computeVertexNormals();
   part(soleGeo,M.sole,bones['foot_'+s],{pos:[0,-.104,.04],ink:false});
   for(let k=0;k<3;k++)part(new T.CapsuleGeometry(.004,.05,4,8),M.sole,bones['foot_'+s],{pos:[0,-.028+k*.004,.07+k*.028],rot:[0,0,Math.PI/2],ink:false});
   part(new T.SphereGeometry(.02,10,8),M.navy,bones['foot_'+s],{pos:[0,-.04,-.045],scale:[1.2,1.3,.6],ink:false});
   // hand: palm plus four stubby fingers and a thumb; the throwing hand curls around the ball
   hand(s,sign,s==='r');
  }
  // ---------- jersey details ----------
  part(new T.TorusGeometry(.092,.015,8,36),M.navy,bones.neck,{pos:[0,.04,0],rot:[Math.PI/2,0,0],scale:[1,1,.9],ink:false});
  part(new T.BoxGeometry(.014,.29,.006),M.navy,bones.spine,{pos:[0,.12,.168],ink:false});
  for(let i=0;i<4;i++)part(new T.SphereGeometry(.006,8,6),M.buckle,bones.spine,{pos:[0,.02+i*.07,.172],ink:false});
  const number=numberTexture();const front=part(new T.PlaneGeometry(.10,.10),new T.MeshBasicMaterial({map:number,transparent:true,polygonOffset:true,polygonOffsetFactor:-2}),bones.spine,{pos:[-.055,.16,.168],rot:[0,-.3,0],ink:false});front.castShadow=false;
  const back=part(new T.PlaneGeometry(.21,.21),new T.MeshBasicMaterial({map:number,transparent:true,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2}),bones.spine,{pos:[0,.13,-.148],rot:[0,Math.PI,0],ink:false});back.castShadow=false;
  // belt, buckle, loops
  part(new T.TorusGeometry(.162,.016,8,44),M.navy,bones.pelvis,{pos:[0,.06,0],rot:[Math.PI/2,0,0],scale:[1.02,.84,1],ink:false});
  part(new T.BoxGeometry(.04,.034,.012),M.buckle,bones.pelvis,{pos:[0,.06,.156],ink:false});
  for(const x of [-.09,.09])part(new T.BoxGeometry(.016,.04,.01),M.navy,bones.pelvis,{pos:[x,.06,.145],rot:[0,x*2.4,0],ink:false});
  // ---------- head ----------
  face();captureAnatomy();
 };
 function hand(s,sign,grip){
  const h=bones['hand_'+s];const g=new T.Group();h.add(g);g.position.set(sign*.02,0,0);
  const palm=part(new T.SphereGeometry(.052,20,14),M.skin,g,{pos:[sign*.02,0,0],scale:[1.15,.78,1]});void palm;
  // fingers fan from the palm edge; curl toward the palm (-y) when gripping
  for(let i=0;i<4;i++){const spread=(i-1.5)*.03,len=[.052,.058,.054,.044][i],curl=grip?.9+i*.08:.25;const f=new T.Group();g.add(f);f.position.set(sign*.056,-.004,spread);f.rotation.set(0,0,sign*-curl*.95);
   part(new T.CapsuleGeometry(.0125,len*.55,4,10),M.skin,f,{pos:[sign*len*.3,0,0],rot:[0,0,Math.PI/2]});
   const f2=new T.Group();f.add(f2);f2.position.set(sign*len*.58,0,0);f2.rotation.set(0,0,sign*-curl*.8);part(new T.CapsuleGeometry(.0115,len*.45,4,10),M.skin,f2,{pos:[sign*len*.25,0,0],rot:[0,0,Math.PI/2]});}
  const th=new T.Group();g.add(th);th.position.set(sign*.02,-.005,.045);th.rotation.set(grip?.95:.4,0,sign*.5);part(new T.CapsuleGeometry(.013,.03,4,10),M.skin,th,{pos:[0,0,.018],rot:[Math.PI/2,0,0]});
 }
 function face(){
  const head=bones.head,cy=.19,fy=cy-R_HEAD*.14,fz=R_HEAD*.97,capY=cy+R_HEAD*.22;
  // skull: a sphere with a slightly narrower jaw
  const skull=new T.SphereGeometry(R_HEAD,48,32);const kp=skull.attributes.position;for(let i=0;i<kp.count;i++){const y=kp.getY(i),x=kp.getX(i),z=kp.getZ(i);const low=Math.max(0,-y/R_HEAD);const s=1-.10*low*low;kp.setXYZ(i,x*s*1.02,y*(y<0?.98:1),z*s*.99+(.012*Math.max(0,-y/R_HEAD)*Math.max(0,z/R_HEAD)));}skull.computeVertexNormals();
  part(skull,M.skin,head,{pos:[0,cy,0]});
  for(const sign of [-1,1]){
   // eye: white, iris, pupil, two highlights, upper lid line
   const ex=sign*.088;
   part(new T.SphereGeometry(.034,20,14),new T.MeshBasicMaterial({color:0xffffff}),head,{pos:[ex,fy,fz-.018],scale:[.78,1.15,.45],ink:false}).castShadow=false;
   part(new T.SphereGeometry(.0215,18,12),new T.MeshBasicMaterial({color:C.iris}),head,{pos:[ex-sign*.003,fy-.002,fz-.004],scale:[1,1.3,.35],ink:false}).castShadow=false;
   part(new T.SphereGeometry(.012,14,10),new T.MeshBasicMaterial({color:0x0d0a0c}),head,{pos:[ex-sign*.003,fy-.004,fz+.001],scale:[1,1.3,.35],ink:false}).castShadow=false;
   part(new T.SphereGeometry(.0075,10,8),new T.MeshBasicMaterial({color:0xffffff}),head,{pos:[ex-sign*.011,fy+.012,fz+.006],ink:false}).castShadow=false;
   part(new T.SphereGeometry(.004,8,6),new T.MeshBasicMaterial({color:0xffffff}),head,{pos:[ex+sign*.006,fy-.013,fz+.006],ink:false}).castShadow=false;
   const lid=new T.TorusGeometry(.03,.0024,6,24,Math.PI*.8);part(lid,new T.MeshBasicMaterial({color:C.ink}),head,{pos:[ex,fy+.004,fz-.006],rot:[0,sign*.25,Math.PI*.05*-sign+Math.PI*.05],scale:[.9,1.1,1],ink:false}).castShadow=false;
   // brow: a short tapered arc
   part(new T.TorusGeometry(.03,.0045,6,20,Math.PI*.6),M.hair,head,{pos:[ex+sign*.004,fy+.052,fz-.02],rot:[0,sign*.3,Math.PI*.2],ink:false}).castShadow=false;
   // ears
   part(new T.SphereGeometry(.036,14,10),M.skin,head,{pos:[sign*R_HEAD*1.0,cy-.005,-.015],scale:[.45,1,.85]});
   part(new T.SphereGeometry(.02,10,8),toon(0xe4ab8c),head,{pos:[sign*R_HEAD*1.005,cy-.005,-.012],scale:[.3,.9,.7],ink:false}).castShadow=false;
   // cheeks
   part(new T.CircleGeometry(.03,16),new T.MeshBasicMaterial({color:0xf2a08a,transparent:true,opacity:.55}),head,{pos:[sign*.15,fy-.055,fz-.06],rot:[0,sign*.7,0],ink:false}).castShadow=false;
  }
  // nose and mouth
  part(new T.SphereGeometry(.012,12,8),toon(0xeab394),head,{pos:[0,fy-.03,fz+.004],scale:[1,.8,.7],ink:false}).castShadow=false;
  part(new T.TorusGeometry(.026,.0055,6,20,Math.PI*.95),M.lips,head,{pos:[0,fy-.062,fz-.015],rot:[-.2,0,Math.PI+Math.PI*.025],ink:false}).castShadow=false;
  // hair: a fringe under the bill and a cropped back/sides below the cap
  part(new T.SphereGeometry(R_HEAD*1.012,36,24,Math.PI*1.18,Math.PI*.64,Math.PI*.36,Math.PI*.12),M.hair,head,{pos:[0,cy,0],ink:false});
  for(const [x,rz] of [[-.07,.35],[-.02,.15],[.035,-.1],[.085,-.35]])part(new T.SphereGeometry(.03,12,8),M.hair,head,{pos:[x,capY-.012,fz-.07],rot:[0,0,rz],scale:[1.1,.55,1],ink:false});
  // cap: crown, six panel seams, rim band, button, curved bill with a darker underside, badge
  const cr=R_HEAD*1.045,crown=new T.SphereGeometry(cr,48,26,0,Math.PI*2,0,Math.PI*.5);part(crown,M.navy,head,{pos:[0,capY,-.012],rot:[.09,0,0]});
  const capG=new T.Group();head.add(capG);capG.position.set(0,capY,-.012);capG.rotation.x=.09;
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2+Math.PI/6;const pts=[];for(let k=0;k<=8;k++){const th=k/8*Math.PI*.5;pts.push(V(Math.sin(th)*Math.cos(a)*cr*1.002,Math.cos(th)*cr*1.002,Math.sin(th)*Math.sin(a)*cr*1.002));}part(new T.TubeGeometry(new T.CatmullRomCurve3(pts),16,.003,5,false),toon(0x14263c),capG,{ink:false}).castShadow=false;}
  part(new T.TorusGeometry(cr,.011,8,52),M.navy,capG,{rot:[Math.PI/2,0,0],ink:false});
  part(new T.SphereGeometry(.016,12,8),M.navy,capG,{pos:[0,cr,0],scale:[1,.7,1],ink:false});
  const bill=billGeometry(cr);part(bill,M.navy,capG,{pos:[0,-.004,0],rot:[.06,0,0]});
  const under=billGeometry(cr,-.004);part(under,M.capUnder,capG,{pos:[0,-.006,0],rot:[.06,0,0],ink:false}).castShadow=false;
  part(new T.PlaneGeometry(.08,.08),new T.MeshBasicMaterial({map:logoTexture(),transparent:true}),capG,{pos:[0,cr*.56,cr*.84],rot:[-.56,0,0],ink:false}).castShadow=false;
 }
 function billGeometry(cr,lift=0){const g=new T.BufferGeometry(),pos=[],idx=[],U=28,W=7,depth=.085;for(let j=0;j<=W;j++)for(let i=0;i<=U;i++){const u=i/U*2-1,v=j/W,ang=u*1.15;const edgeX=Math.sin(ang)*cr*.97,edgeZ=Math.cos(ang)*cr*.97;const reach=depth*Math.cos(u*1.2)**.7;const x=edgeX*(1+.14*v),z=edgeZ+v*reach,y=lift-v*v*.03-u*u*v*.05;pos.push(x,y,z);}for(let j=0;j<W;j++)for(let i=0;i<U;i++){const a=j*(U+1)+i,b=a+U+1;idx.push(a,b,a+1,a+1,b,b+1);}g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
  // give the bill thickness by extruding a bottom copy
  const top=g.clone(),p=top.attributes.position;const n=p.count;const both=new Float32Array(n*6);both.set(p.array,0);for(let i=0;i<n;i++){both[n*3+i*3]=p.array[i*3];both[n*3+i*3+1]=p.array[i*3+1]-.007;both[n*3+i*3+2]=p.array[i*3+2];}const ind=[...g.index.array];const bottom=ind.map(k=>k+n);for(let i=0;i<bottom.length;i+=3)ind.push(bottom[i],bottom[i+2],bottom[i+1]);for(let j=0;j<W;j++){for(const i of [0,U]){const a=j*(U+1)+i,b=a+U+1;if(i===0)ind.push(a,a+n,b,b,a+n,b+n);else ind.push(a,b,a+n,b,b+n,a+n);}}for(let i=0;i<U;i++){const a=W*(U+1)+i;ind.push(a,a+1,a+n,a+1,a+1+n,a+n);}
  const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(both,3));out.setIndex(ind);out.computeVertexNormals();return out;}
 const mitt=makePitcherGlove();mitt.scale.setScalar(1.25);group.add(mitt);mitt.visible=false;
 mitt.traverse(o=>{if(o.isMesh&&o.material){const m=o.material;o.material=toon(m.color.getHex(),m.map?{map:m.map}:{});}});

 // ---------- posing ----------
 function aim(b,child,target){group.updateMatrixWorld(true);const a=world(b),from=world(child).sub(a).normalize(),to=target.clone().sub(a).normalize();const delta=new T.Quaternion().setFromUnitVectors(from,to),q=b.getWorldQuaternion(new T.Quaternion()).premultiply(delta),parent=b.parent.getWorldQuaternion(new T.Quaternion()).invert();b.quaternion.copy(parent.multiply(q));}
 function rotateWorld(b,axis,angle){const q=new T.Quaternion().setFromAxisAngle(axis,angle).multiply(b.getWorldQuaternion(new T.Quaternion()));b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));group.updateMatrixWorld(true);}
 function frame(x,y){y=y.clone().normalize();let z=new T.Vector3().crossVectors(x,y).normalize();x=new T.Vector3().crossVectors(y,z).normalize();return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));}
 function orient(b,target,key){const q=target.multiply(anatomy[key].frame.clone().invert()).multiply(anatomy[key].q);b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));group.updateMatrixWorld(true);}
 function solveLimb(a,b,c,target,pole){group.updateMatrixWorld(true);const root=world(a),l1=world(b).distanceTo(root),l2=world(c).distanceTo(world(b)),dir=target.clone().sub(root),distance=T.MathUtils.clamp(dir.length(),.02,l1+l2-.0001);dir.normalize();const along=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along*along)),bend=pole.clone().sub(root);bend.addScaledVector(dir,-bend.dot(dir));if(bend.lengthSq()<.00001)bend.set(0,0,1).addScaledVector(dir,-dir.z);bend.normalize();aim(a,b,root.clone().addScaledVector(dir,along).addScaledVector(bend,height));aim(b,c,root.clone().addScaledVector(dir,distance));}
 function captureAnatomy(){
  group.updateMatrixWorld(true);for(const o of Object.values(bones))rest.push({b:o,q:o.quaternion.clone(),p:o.position.clone()});
  const x=world(bones.thigh_l).sub(world(bones.thigh_r)),up=world(bones.neck).sub(world(bones.pelvis)),basis=frame(x,up);
  for(const key of ['pelvis','spine','chest','neck','head'])anatomy[key]={frame:basis.clone(),q:bones[key].getWorldQuaternion(new T.Quaternion())};
  for(const s of ['r','l']){const h=bones['hand_'+s],y=world(bones['tip_'+s]).sub(world(h)),xx=new T.Vector3(0,0,1);anatomy['hand_'+s]={frame:frame(xx,y),q:h.getWorldQuaternion(new T.Quaternion())};}
 }
 const soleOffsets=[[0,-.115,-.07],[0,-.115,.22],[.085,-.115,.06],[-.085,-.115,.06]];
 function soleLow(s){const f=bones['foot_'+s];group.updateMatrixWorld(true);let y=Infinity;for(const o of soleOffsets)y=Math.min(y,f.localToWorld(new T.Vector3(...o)).y);return y;}
 function poseMotion(p){lastPose=p;if(!rest.length)return;
  for(const r of rest){r.b.quaternion.copy(r.q);r.b.position.copy(r.p);}group.updateMatrixWorld(true);
  orient(bones.pelvis,frame(p.lhip.clone().sub(p.rhip),p.spine.clone().sub(p.hip)),'pelvis');
  const pelvisWorld=world(bones.pelvis);bones.pelvis.position.add(p.hip.clone().sub(pelvisWorld));group.updateMatrixWorld(true);
  const chestFrame=frame(p.ls.clone().sub(p.rs),p.neck.clone().sub(p.hip)),chestQ=chestFrame.clone().multiply(anatomy.chest.frame.clone().invert()).multiply(anatomy.chest.q),pelvisQ=bones.pelvis.getWorldQuaternion(new T.Quaternion());
  for(const [name,t] of [['spine',.45],['chest',1]]){const b=bones[name],q=pelvisQ.clone().multiply(anatomy.pelvis.q.clone().invert()).multiply(anatomy[name].q).slerp(chestQ.clone().multiply(anatomy.chest.q.clone().invert()).multiply(anatomy[name].q),t);b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));group.updateMatrixWorld(true);}
  const headQ=frame(p.ls.clone().sub(p.rs),p.headTop.clone().sub(p.neck)).multiply(anatomy.head.frame.clone().invert()).multiply(anatomy.head.q);
  // the big head turns a little less than the capture so it never looks wrenched
  const chestNow=bones.chest.getWorldQuaternion(new T.Quaternion()).multiply(anatomy.chest.q.clone().invert()).multiply(anatomy.head.q),softHead=chestNow.clone().slerp(headQ,.7);
  bones.neck.quaternion.copy(bones.neck.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(chestNow.clone().slerp(softHead,.5).multiply(anatomy.head.q.clone().invert()).multiply(anatomy.neck.q)));group.updateMatrixWorld(true);
  bones.head.quaternion.copy(bones.head.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(softHead));group.updateMatrixWorld(true);
  const legs=()=>{let short=0;for(const s of ['r','l']){
   const thigh=bones['thigh_'+s],calf=bones['calf_'+s],foot=bones['foot_'+s],hip=world(thigh),srcHip=p[s+'hip'];
   const srcLen=srcHip.distanceTo(p[s+'k'])+p[s+'k'].distanceTo(p[s+'f']),len=world(thigh).distanceTo(world(calf))+world(calf).distanceTo(world(foot)),ratio=len/srcLen;
   // ankle target: same direction from the hip as the capture, scaled to the short legs,
   // but never above the floor contact the capture shows
   const ankle=hip.clone().add(p[s+'f'].clone().sub(srcHip).multiplyScalar(ratio)),knee=hip.clone().add(p[s+'k'].clone().sub(srcHip).multiplyScalar(ratio));
   const plant=1-T.MathUtils.smoothstep(p[s+'t'].y,.035,.07);let lift=0,low=0;
   for(let pass=0;pass<3;pass++){solveLimb(thigh,calf,foot,ankle.clone().setY(ankle.y+lift),knee);
    {const d=p[s+'t'].clone().sub(p[s+'f']);const dir=new T.Vector3(d.x,0,d.z).normalize().multiplyScalar(.14).setY(Math.min(-.02,d.y)).normalize();const x=new T.Vector3().crossVectors(new T.Vector3(0,1,0),dir).normalize(),y=new T.Vector3().crossVectors(dir,x).normalize();const q=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,dir));foot.quaternion.copy(foot.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));group.updateMatrixWorld(true);}
    low=soleLow(s);
    // the cartoon shoe is much longer than the captured foot: when the toe digs in, rock the foot up on its toe before lifting the ankle
    if(low<-.002){const lateral=new T.Vector3(1,0,0).transformDirection(foot.matrixWorld).normalize();
     // which way lifts the toe
     const toeY=()=>foot.localToWorld(new T.Vector3(...soleOffsets[1])).y;const t0=toeY();rotateWorld(foot,lateral,.05);const sign=toeY()>t0?1:-1;rotateWorld(foot,lateral,-.05);
     const at=phi=>{rotateWorld(foot,lateral,sign*phi);const v=soleLow(s);rotateWorld(foot,lateral,-sign*phi);return v;};
     // the flattest foot is where the lowest sole point is highest; use the smallest angle that reaches the floor
     let a=0,b=1.3;for(let k=0;k<14;k++){const m1=a+(b-a)/3,m2=b-(b-a)/3;if(at(m1)<at(m2))a=m1;else b=m2;}let phi=(a+b)/2;
     if(at(phi)>0){let lo=0,hi=phi;for(let k=0;k<14;k++){const m=(lo+hi)/2;if(at(m)>=0)hi=m;else lo=m;}phi=hi;}
     rotateWorld(foot,lateral,sign*phi);low=soleLow(s);}
    if(Math.abs(low)<.002)break;lift+=low<0?-low:-low*plant;}
   if(plant>.5&&low>.003)short=Math.max(short,low*plant);
  }return short;};
  const short=legs();if(short>0){bones.pelvis.position.y-=short;group.updateMatrixWorld(true);legs();}
  for(const s of ['r','l']){
   const upper=bones['upperarm_'+s],lower=bones['lowerarm_'+s],hand=bones['hand_'+s],shoulder=world(upper),srcShoulder=p[s+'s'];
   const srcLen=srcShoulder.distanceTo(p[s+'e'])+p[s+'e'].distanceTo(p[s+'h']),len=world(upper).distanceTo(world(lower))+world(lower).distanceTo(world(hand)),ratio=len/srcLen;
   const wrist=shoulder.clone().add(p[s+'h'].clone().sub(srcShoulder).multiplyScalar(ratio)),elbow=shoulder.clone().add(p[s+'e'].clone().sub(srcShoulder).multiplyScalar(ratio));
   solveLimb(upper,lower,hand,wrist,elbow);
   const finger=p[s+'i'].clone().sub(p[s+'h']).normalize(),fore=p[s+'h'].clone().sub(p[s+'e']).normalize();
   let palm=new T.Vector3().crossVectors(fore,finger);if(palm.lengthSq()<.01)palm=new T.Vector3(0,0,1);palm.normalize();
   let x=new T.Vector3().crossVectors(finger,palm).normalize();if(s==='l')x.negate();
   orient(hand,frame(x,finger),'hand_'+s);
   // share the wrist twist with the forearm
   const axis=hand.position.clone().normalize(),q=hand.quaternion,d=axis.dot(new T.Vector3(q.x,q.y,q.z)),twist=new T.Quaternion(axis.x*d,axis.y*d,axis.z*d,q.w).normalize(),partQ=new T.Quaternion().slerp(twist,.6);
   lower.quaternion.multiply(partQ);hand.quaternion.premultiply(partQ.clone().invert());group.updateMatrixWorld(true);
  }
  group.updateMatrixWorld(true);
  const hr=bones.hand_r,hy=new T.Vector3(1,0,0).negate().transformDirection(hr.matrixWorld);// fingertip direction of the right hand
  const hz=new T.Vector3(0,0,1).transformDirection(hr.matrixWorld);
  gripPoint=hr.localToWorld(new T.Vector3(-.052,-.088,0));
  const hl=bones.hand_l,ly=new T.Vector3(1,0,0).transformDirection(hl.matrixWorld),lz=new T.Vector3(0,0,1).transformDirection(hl.matrixWorld);
  mitt.visible=true;mitt.position.copy(world(hl)).addScaledVector(ly,-.02).addScaledVector(lz,.012);
  mitt.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3().crossVectors(ly,lz).negate(),ly,lz));
 }
 function motionScale(f){const d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);const source=['l','r'].reduce((s,k)=>s+d(f[k+'hip'],f[k+'k'])+d(f[k+'k'],f[k+'f']),0)/2;return .43/source;}
 build();
 ready=Promise.resolve().then(()=>{if(lastPose)poseMotion(lastPose);});
 return {group,ball,ready,pose:poseMotion,poseMotion,motionScale,handPosition(){return gripPoint?.clone()||(lastPose?.rh.clone())||new T.Vector3();},dispose(){disposed=true;void disposed;for(const m of parts){m.geometry.dispose();}}};
}

function canvasTexture(draw,size=256){const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}
function numberTexture(){return canvasTexture((x,s)=>{x.clearRect(0,0,s,s);x.textAlign='center';x.textBaseline='middle';x.font='900 150px "Arial Black",Impact,sans-serif';x.lineJoin='round';x.lineWidth=22;x.strokeStyle='#d9553c';x.strokeText('17',s/2,s/2+8);x.fillStyle='#1c3650';x.fillText('17',s/2,s/2+8);});}
function logoTexture(){return canvasTexture((x,s)=>{x.clearRect(0,0,s,s);x.textAlign='center';x.textBaseline='middle';x.font='900 190px Georgia,serif';x.lineJoin='round';x.lineWidth=26;x.strokeStyle='#d9553c';x.strokeText('B',s/2,s/2+12);x.fillStyle='#fff6e2';x.fillText('B',s/2,s/2+12);});}
