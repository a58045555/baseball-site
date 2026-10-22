import * as T from './vendor/three.module.min.js';
import {makePitcherGlove} from './scene-models.js';

// Cartoon pitcher in the style of chibi baseball games: a big round head, a compact body,
// stubby limbs with round joints, mitten hands, and flat cel shading with ink outlines.
// Every part is built in code, so nothing is downloaded. Bones rest with identity
// rotation (a bone's local axes equal the world axes in the rest pose), the same
// convention the motion retargeting uses.
const C={skin:0xf3c9a4,skinDark:0xd9a47c,jersey:0xfbf7ee,navy:0x1c3650,red:0xd9553c,pants:0xf6f2e6,shoe:0x24282e,sock:0x1c3650,ink:0x1a1a22,eye:0x1d1a1f,mouth:0x8e3a30};
const H=0.56,R_HEAD=0.255;// hip height and head radius, metres

export function createPitcherModel(scene){
 const group=new T.Group();scene.add(group);
 let lastPose,disposed=false,gripPoint,ready;
 const bones={},rest=[],anatomy={},parts=[];
 const world=o=>o.getWorldPosition(new T.Vector3());

 // ---------- cel materials ----------
 const steps=document.createElement('canvas');steps.width=4;steps.height=1;const sx=steps.getContext('2d');[['#6a6a78',0],['#b9b9c4',1],['#f2f2f6',2],['#ffffff',3]].forEach(([c,i])=>{sx.fillStyle=c;sx.fillRect(i,0,1,1);});
 const gradient=new T.CanvasTexture(steps);gradient.minFilter=gradient.magFilter=T.NearestFilter;gradient.colorSpace=T.NoColorSpace;
 const toon=(color,extra={})=>new T.MeshToonMaterial({color,gradientMap:gradient,...extra});
 const inkMaterial=new T.MeshBasicMaterial({color:C.ink,side:T.BackSide});
 const ball=new T.Mesh(new T.SphereGeometry(.05,24,16),toon(0xfffaf0));group.add(ball);ball.castShadow=true;
 for(let side=0;side<2;side++){const pts=[];for(let i=0;i<=96;i++){const a=i/96*Math.PI*2,theta=.95+.27*Math.cos(2*a),phi=a+side*Math.PI;pts.push(new T.Vector3(.0505*Math.sin(theta)*Math.cos(phi),.0505*Math.cos(theta)*(side?1:-1),.0505*Math.sin(theta)*Math.sin(phi)));}ball.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts,true),96,.0024,5,true),toon(C.red)));}
 addInk(ball,.05);

 function addInk(mesh,size){const ink=new T.Mesh(mesh.geometry,inkMaterial);ink.scale.setScalar(1+.012/Math.max(.05,size));mesh.add(ink);ink.renderOrder=-1;return ink;}
 function part(geo,material,parent,{pos=[0,0,0],rot=[0,0,0],scale=[1,1,1],ink=true,size=.1}={}){
  const m=new T.Mesh(geo,material);m.position.set(...pos);m.rotation.set(...rot);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);if(ink)addInk(m,size);parts.push(m);return m;
 }
 // ---------- skeleton ----------
 function bone(name,parent,pos){const b=new T.Object3D();b.name=name;b.position.set(...pos);(parent?bones[parent]:group).add(b);bones[name]=b;return b;}
 const build=()=>{
  bone('pelvis',null,[0,H,0]);bone('spine','pelvis',[0,.05,0]);bone('chest','spine',[0,.17,0]);bone('neck','chest',[0,.18,0]);bone('head','neck',[0,.06,0]);
  for(const [s,sign] of [['l',1],['r',-1]]){
   bone('thigh_'+s,'pelvis',[sign*.10,-.03,0]);bone('calf_'+s,'thigh_'+s,[0,-.24,0]);bone('foot_'+s,'calf_'+s,[0,-.19,0]);bone('toe_'+s,'foot_'+s,[0,-.06,.13]);
   bone('upperarm_'+s,'chest',[sign*.20,.10,0]);bone('lowerarm_'+s,'upperarm_'+s,[sign*.21,0,0]);bone('hand_'+s,'lowerarm_'+s,[sign*.19,0,0]);bone('tip_'+s,'hand_'+s,[sign*.09,0,0]);
  }
  group.updateMatrixWorld(true);
  // ---------- body ----------
  const jersey=toon(C.jersey),pants=toon(C.pants),skin=toon(C.skin),navy=toon(C.navy),shoe=toon(C.shoe),sock=toon(C.sock);
  // torso: rounded barrel, wider at the chest, with the belly a touch forward
  const torso=new T.CapsuleGeometry(.17,.14,8,24);torso.translate(0,.09,0);const tp=torso.attributes.position;for(let i=0;i<tp.count;i++){const y=tp.getY(i),z=tp.getZ(i);tp.setZ(i,z*(.82+.08*Math.max(0,y)));tp.setX(i,tp.getX(i)*(1+.1*Math.max(0,y)));}torso.computeVertexNormals();
  part(torso,jersey,bones.spine,{size:.17});
  // front placket, collar and sleeve bands
  part(new T.BoxGeometry(.012,.30,.006),navy,bones.spine,{pos:[0,.10,.165],ink:false});
  part(new T.TorusGeometry(.095,.016,8,32),navy,bones.neck,{pos:[0,.02,0],rot:[Math.PI/2,0,0],ink:false});
  const number=numberTexture();part(new T.PlaneGeometry(.11,.11),new T.MeshBasicMaterial({map:number,transparent:true}),bones.spine,{pos:[-.05,.14,.172],ink:false});
  const back=part(new T.PlaneGeometry(.20,.20),new T.MeshBasicMaterial({map:number,transparent:true,side:T.DoubleSide}),bones.spine,{pos:[0,.12,-.158],rot:[0,Math.PI,0],ink:false});void back;
  // belt and hips
  part(new T.SphereGeometry(.165,24,16),pants,bones.pelvis,{pos:[0,-.02,0],scale:[1,.72,.85],size:.16});
  part(new T.TorusGeometry(.155,.018,8,40),navy,bones.pelvis,{pos:[0,.055,0],rot:[Math.PI/2,0,0],scale:[1.02,.86,1],ink:false});
  part(new T.BoxGeometry(.035,.03,.012),toon(0xe7c56a),bones.pelvis,{pos:[0,.055,.154],ink:false});
  for(const [s,sign] of [['l',1],['r',-1]]){
   // legs: knickers to the knee, sock to the shoe
   part(new T.CapsuleGeometry(.085,.17,6,18),pants,bones['thigh_'+s],{pos:[0,-.11,0],size:.085});
   part(new T.SphereGeometry(.072,18,12),sock,bones['calf_'+s],{size:.07});
   part(new T.CapsuleGeometry(.058,.12,6,18),sock,bones['calf_'+s],{pos:[0,-.10,0],size:.058});
   for(const k of [0,1])part(new T.TorusGeometry(.061,.009,6,24),toon(C.red),bones['calf_'+s],{pos:[0,-.075-k*.04,0],rot:[Math.PI/2,0,0],ink:false});
   // shoe: rounded wedge pointing forward with a pale sole
   const shoeGeo=new T.SphereGeometry(1,24,16);const sp=shoeGeo.attributes.position;for(let i=0;i<sp.count;i++){const x=sp.getX(i),y=sp.getY(i),z=sp.getZ(i);sp.setXYZ(i,x*.085*(1-.15*Math.max(0,z)),y<0?y*.05:y*.07*(1-.35*Math.max(0,z)),z>0?z*.16:z*.09);}shoeGeo.computeVertexNormals();
   part(shoeGeo,shoe,bones['foot_'+s],{pos:[0,-.055,.035],size:.09});
   part(new T.BoxGeometry(.17,.016,.25),toon(0xf1ebdc),bones['foot_'+s],{pos:[0,-.103,.04],ink:false});
   // arms: short sleeve, skin, round elbow, mitten hand
   part(new T.CapsuleGeometry(.07,.09,6,18),jersey,bones['upperarm_'+s],{pos:[sign*.07,0,0],rot:[0,0,Math.PI/2],size:.07});
   part(new T.TorusGeometry(.066,.012,6,24),navy,bones['upperarm_'+s],{pos:[sign*.125,0,0],rot:[0,Math.PI/2,0],ink:false});
   part(new T.CapsuleGeometry(.05,.11,6,18),skin,bones['upperarm_'+s],{pos:[sign*.155,0,0],rot:[0,0,Math.PI/2],size:.05});
   part(new T.SphereGeometry(.052,18,12),skin,bones['lowerarm_'+s],{size:.05});
   part(new T.CapsuleGeometry(.046,.12,6,18),skin,bones['lowerarm_'+s],{pos:[sign*.095,0,0],rot:[0,0,Math.PI/2],size:.046});
   const hand=part(new T.SphereGeometry(.068,20,14),skin,bones['hand_'+s],{pos:[sign*.03,0,0],scale:[1.05,.9,.8],size:.068});hand.name='hand_'+s+'_mesh';
   part(new T.SphereGeometry(.028,12,8),skin,bones['hand_'+s],{pos:[sign*.035,-.01,.055],ink:false});// thumb
  }
  // ---------- head ----------
  const head=part(new T.SphereGeometry(R_HEAD,40,28),skin,bones.head,{pos:[0,.19,0],scale:[1.02,1,.98],size:R_HEAD});
  const face=bones.head;const fy=.19-R_HEAD*.16,fz=R_HEAD*.98,capY=.19+R_HEAD*.20;
  for(const sign of [-1,1]){
   const eye=part(new T.SphereGeometry(.028,16,12),toon(C.eye),face,{pos:[sign*.085,fy,fz-.012],scale:[1,1.45,.5],ink:false});eye.castShadow=false;
   part(new T.SphereGeometry(.009,8,6),new T.MeshBasicMaterial({color:0xffffff}),face,{pos:[sign*.085-sign*.006,fy+.016,fz+.005],ink:false}).castShadow=false;
   part(new T.BoxGeometry(.05,.011,.008),toon(0x3a2a24),face,{pos:[sign*.085,fy+.065,fz-.028],rot:[0,0,sign*.12],ink:false}).castShadow=false;
   // ears
   part(new T.SphereGeometry(.035,12,8),skin,face,{pos:[sign*R_HEAD*1.0,.19,-.01],scale:[.5,1,1],size:.035});
   // cheek blush
   part(new T.CircleGeometry(.03,16),new T.MeshBasicMaterial({color:0xf2a08a,transparent:true,opacity:.6}),face,{pos:[sign*.15,fy-.05,fz-.055],rot:[0,sign*.65,0],ink:false}).castShadow=false;
  }
  part(new T.TorusGeometry(.028,.007,6,20,Math.PI),toon(C.mouth),face,{pos:[0,fy-.085,fz-.02],rot:[0,0,Math.PI],ink:false}).castShadow=false;
  // hair showing under the cap
  part(new T.SphereGeometry(R_HEAD*1.015,32,20,Math.PI*.92,Math.PI*1.16,Math.PI*.30,Math.PI*.30),toon(0x2b1d17),face,{pos:[0,.19,0],ink:false});
  // cap: a crown that sits on the skull, a curved bill, a button and a badge
  const crown=part(new T.SphereGeometry(R_HEAD*1.0,40,24,0,Math.PI*2,0,Math.PI*.5),navy,face,{pos:[0,capY,-.015],rot:[.08,0,0],size:R_HEAD});
  part(new T.TorusGeometry(R_HEAD*1.0,.012,8,48),navy,face,{pos:[0,capY,-.015],rot:[Math.PI/2+.08,0,0],ink:false});
  const bill=new T.CylinderGeometry(1,1,.018,32,1,false,-Math.PI*.42,Math.PI*.84);const bp=bill.attributes.position;for(let i=0;i<bp.count;i++){const x=bp.getX(i),z=bp.getZ(i),r=Math.hypot(x,z);bp.setXYZ(i,x*.21,bp.getY(i)-.035*Math.max(0,r)*Math.abs(x),z*.25);}bill.computeVertexNormals();
  part(bill,navy,face,{pos:[0,capY-.004,R_HEAD*.62],rot:[.14,0,0],size:.2});
  part(new T.SphereGeometry(.014,10,8),navy,face,{pos:[0,capY+R_HEAD*1.0,-.03],ink:false});
  part(new T.PlaneGeometry(.075,.075),new T.MeshBasicMaterial({map:logoTexture(),transparent:true}),face,{pos:[0,capY+R_HEAD*.55,-.015+R_HEAD*.85],rot:[-.55,0,0],ink:false}).castShadow=false;
  void crown;void head;
  captureAnatomy();
 };
 const mitt=makePitcherGlove();mitt.scale.setScalar(1.25);group.add(mitt);mitt.visible=false;
 mitt.traverse(o=>{if(o.isMesh&&o.material){const m=o.material;o.material=toon(m.color.getHex(),m.map?{map:m.map}:{});}});

 // ---------- posing ----------
 function aim(b,child,target){group.updateMatrixWorld(true);const a=world(b),from=world(child).sub(a).normalize(),to=target.clone().sub(a).normalize();const delta=new T.Quaternion().setFromUnitVectors(from,to),q=b.getWorldQuaternion(new T.Quaternion()).premultiply(delta),parent=b.parent.getWorldQuaternion(new T.Quaternion()).invert();b.quaternion.copy(parent.multiply(q));}
 function frame(x,y){y=y.clone().normalize();let z=new T.Vector3().crossVectors(x,y).normalize();x=new T.Vector3().crossVectors(y,z).normalize();return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));}
 function orient(b,target,key){const q=target.multiply(anatomy[key].frame.clone().invert()).multiply(anatomy[key].q);b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));group.updateMatrixWorld(true);}
 function solveLimb(a,b,c,target,pole){group.updateMatrixWorld(true);const root=world(a),l1=world(b).distanceTo(root),l2=world(c).distanceTo(world(b)),dir=target.clone().sub(root),distance=T.MathUtils.clamp(dir.length(),.02,l1+l2-.0001);dir.normalize();const along=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along*along)),bend=pole.clone().sub(root);bend.addScaledVector(dir,-bend.dot(dir));if(bend.lengthSq()<.00001)bend.set(0,0,1).addScaledVector(dir,-dir.z);bend.normalize();aim(a,b,root.clone().addScaledVector(dir,along).addScaledVector(bend,height));aim(b,c,root.clone().addScaledVector(dir,distance));}
 function captureAnatomy(){
  group.updateMatrixWorld(true);for(const o of Object.values(bones))rest.push({b:o,q:o.quaternion.clone(),p:o.position.clone()});
  const x=world(bones.thigh_l).sub(world(bones.thigh_r)),up=world(bones.neck).sub(world(bones.pelvis)),basis=frame(x,up);
  for(const key of ['pelvis','spine','chest','neck','head'])anatomy[key]={frame:basis.clone(),q:bones[key].getWorldQuaternion(new T.Quaternion())};
  for(const s of ['r','l']){const h=bones['hand_'+s],y=world(bones['tip_'+s]).sub(world(h)),xx=new T.Vector3(0,0,1);anatomy['hand_'+s]={frame:frame(xx,y),q:h.getWorldQuaternion(new T.Quaternion())};}
 }
 const soleOffsets=[[0,-.11,-.06],[0,-.11,.17],[.08,-.11,.05],[-.08,-.11,.05]];
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
   for(let pass=0;pass<3;pass++){solveLimb(thigh,calf,foot,ankle.clone().setY(ankle.y+lift),knee);aim(foot,bones['toe_'+s],world(foot).add(p[s+'t'].clone().sub(p[s+'f']).normalize().multiplyScalar(.14).setY(Math.min(-.02,p[s+'t'].y-p[s+'f'].y))));low=soleLow(s);if(Math.abs(low)<.002)break;lift+=low<0?-low:-low*plant;}
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
  gripPoint=world(hr).addScaledVector(hy,.055).addScaledVector(hz,.062);
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
