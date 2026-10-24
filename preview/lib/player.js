import * as T from '../../vendor/three.module.min.js';
import {GLTFLoader} from '../../vendor/GLTFLoader.js';
import {makePitcherGlove,makeBall} from './scene-models.js';

// The pitcher: the site owner's Meshy-generated character (dist/models/pitcher-pro.glb, rigged by
// tools/meshy with Mixamo bone names). Captured motion arrives as world-space joint positions, so
// every pose step works in world space: the pelvis and chest are oriented from joint frames, the
// limbs are solved with two-joint IK, the feet are settled on the ground through the skinned mesh,
// and the throwing hand grips a four-seam ball.
const BONE={pelvis:'Hips',spine1:'Spine',spine2:'Spine1',chest:'Spine2',neck:'Neck',head:'Head'};
for(const [s,S] of [['l','Left'],['r','Right']]){
 Object.assign(BONE,{['upper_'+s]:S+'Arm',['lower_'+s]:S+'ForeArm',['hand_'+s]:S+'Hand',['thigh_'+s]:S+'UpLeg',['calf_'+s]:S+'Leg',['foot_'+s]:S+'Foot',['ball_'+s]:S+'ToeBase',['toe_'+s]:S+'Toe_End'});
 for(const d of ['thumb','index','middle','ring','pinky'])for(const n of [1,2,3])BONE[`${d}${n}_${s}`]=`${S}Hand${d[0].toUpperCase()+d.slice(1)}${n}`;
}
const UP=new T.Vector3(0,1,0);
const v3=()=>new T.Vector3();
const q4=()=>new T.Quaternion();
function basis(x,y){y=y.clone().normalize();const z=v3().crossVectors(x,y).normalize();const xx=v3().crossVectors(y,z).normalize();return q4().setFromRotationMatrix(new T.Matrix4().makeBasis(xx,y,z));}
function footBasis(dir){const d=dir.clone().normalize(),x=v3().crossVectors(UP,d).normalize(),y=v3().crossVectors(d,x).normalize();return basis(x,y);}
function canvasTexture(size,draw){const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;}

export function createPlayer(parent,{url=new URL('./models/pitcher-pro.glb',import.meta.url).href,number='17',badge='B',glove:gloveSource=null}={}){
 const group=new T.Group();group.name='player';parent.add(group);
 const bones={},rest=[];let rig=null,skin=null,fit=null,anatomy={},sole={},gripPoint=null,lastPose=null,disposed=false;
 const materials=[];
 const mat=(color,roughness,extra={})=>{const m=new T.MeshStandardMaterial({color,roughness,...extra});materials.push(m);return m;};
 // the same detailed ball as the playground, at real size
 const ball=makeBall();ball.scale.setScalar(.037);ball.traverse(o=>{if(o.isMesh)o.castShadow=true;});group.add(ball);
 // the glove may come from props.js (a modelled GLB) or the procedural one; either way it hangs on the left hand
 let glove=null;Promise.resolve(gloveSource).then(g=>{if(!g){g=makePitcherGlove();g.scale.set(1.3,1.25,1.5);}if(disposed)return;glove=g;glove.visible=false;group.add(glove);if(lastPose&&rig)poseMotion(lastPose);}).catch(()=>{});

 const world=o=>o.getWorldPosition(v3());
 const worldQ=o=>o.getWorldQuaternion(q4());
 const setWorldQ=(b,q)=>{b.quaternion.copy(worldQ(b.parent).invert().multiply(q));rig.updateMatrixWorld(true);};
 function aim(bone,child,target){rig.updateMatrixWorld(true);const a=world(bone),from=world(child).sub(a).normalize(),to=target.clone().sub(a).normalize();setWorldQ(bone,q4().setFromUnitVectors(from,to).multiply(worldQ(bone)));}
 function rotateWorld(b,axis,angle){setWorldQ(b,q4().setFromAxisAngle(axis,angle).multiply(worldQ(b)));}
 // place a bone so that its captured anatomy frame matches `target`
 function orient(bone,target,key){setWorldQ(bone,target.multiply(anatomy[key].frame.clone().invert()).multiply(anatomy[key].q));}
 function solveLimb(a,b,c,target,pole){rig.updateMatrixWorld(true);const root=world(a),l1=world(b).distanceTo(root),l2=world(c).distanceTo(world(b)),dir=target.clone().sub(root),distance=T.MathUtils.clamp(dir.length(),.025,l1+l2-.0001);dir.normalize();const along=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along*along)),bend=pole.clone().sub(root);bend.addScaledVector(dir,-bend.dot(dir));if(bend.lengthSq()<.00001)bend.set(0,0,1).addScaledVector(dir,-dir.z);bend.normalize();aim(a,b,root.clone().addScaledVector(dir,along).addScaledVector(bend,height));aim(b,c,root.clone().addScaledVector(dir,distance));}
 function handAxes(side){const h=world(bones['hand_'+side]),y=world(bones['middle1_'+side]).sub(h).normalize(),across=world(bones['index1_'+side]).sub(world(bones['pinky1_'+side])).normalize(),palm=v3().crossVectors(across,y).normalize();if(side==='l')palm.negate();return {y,across,palm};}
 function curl(bone,angle,side){const {across,y,palm}=handAxes(side);const axis=across.clone();if(y.clone().applyAxisAngle(axis,.2).sub(y).dot(palm)<0)axis.negate();rotateWorld(bone,axis,angle);}

 // ground contact is measured through the skinned mesh: the lowest shoe vertices of each foot
 const tmp=v3();
 function soleLow(s){rig.updateMatrixWorld(true);skin.skeleton.update();let y=Infinity;const pos=skin.geometry.attributes.position;for(const i of sole[s]){tmp.fromBufferAttribute(pos,i);skin.applyBoneTransform(i,tmp);tmp.applyMatrix4(skin.matrixWorld);y=Math.min(y,tmp.y);}return y;}
 function sampleSoles(body){const pos=body.geometry.attributes.position,si=body.geometry.attributes.skinIndex,sw=body.geometry.attributes.skinWeight,names=body.skeleton.bones.map(b=>b.name);const weight=(i,re)=>{let s=0;for(let j=0;j<4;j++)if(re.test(names[si.array[i*4+j]]||''))s+=sw.array[i*4+j];return s;};
  for(const s of ['l','r']){const re=s==='l'?/LeftFoot|LeftToe/:/RightFoot|RightToe/;const list=[];for(let i=0;i<pos.count;i++)if(pos.getY(i)<.012&&weight(i,re)>.5)list.push(i);sole[s]=list.filter((_,k)=>k%4===0);}}

 // uniform marks: cap badge, chest and back numbers, fitted where the rig data says the cloth is
 function decal(map,size){const m=new T.Mesh(new T.PlaneGeometry(size,size),mat(0xffffff,.85,{map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2,side:T.FrontSide}));return m;}
 function numberTexture(){return canvasTexture(512,(x,s)=>{x.textAlign='center';x.textBaseline='middle';x.font='900 300px "Arial Black",Impact,sans-serif';x.lineJoin='round';x.lineWidth=34;x.strokeStyle='#d8513a';x.strokeText(number,s/2,s/2+14);x.fillStyle='#1d3552';x.fillText(number,s/2,s/2+14);});}
 function badgeTexture(){return canvasTexture(512,(x,s)=>{x.textAlign='center';x.textBaseline='middle';x.font='900 420px Georgia,serif';x.lineJoin='round';x.lineWidth=46;x.strokeStyle='#d8513a';x.strokeText(badge,s/2,s/2+24);x.fillStyle='#f4ead2';x.fillText(badge,s/2,s/2+24);});}
 function attachWorld(bone,object){group.add(object);rig.updateMatrixWorld(true);bone.attach(object);}
 function dress(){if(!fit)return;
  const cap=decal(badgeTexture(),fit.capLogo.size*.8);cap.position.set(...fit.capLogo.center);cap.position.z+=.004;cap.rotation.x=-.25;attachWorld(bones.head,cap);
  const tex=numberTexture();const front=decal(tex,.09);front.position.set(...fit.chestFront);front.position.z+=.006;front.rotation.y=-.25;attachWorld(bones.chest,front);
  const back=decal(tex,.20);back.position.set(...fit.chestBack);back.position.z-=.006;back.rotation.y=Math.PI;attachWorld(bones.chest,back);}

 function captureAnatomy(){rig.updateMatrixWorld(true);const x=world(bones.thigh_l).sub(world(bones.thigh_r)),up=world(bones.neck).sub(world(bones.pelvis)),frame=basis(x,up);
  for(const key of ['pelvis','spine1','spine2','chest','neck','head'])anatomy[key]={frame:frame.clone(),q:worldQ(bones[key])};
  for(const s of ['r','l']){const h=bones['hand_'+s];anatomy['hand_'+s]={frame:basis(world(bones['index1_'+s]).sub(world(bones['pinky1_'+s])),world(bones['middle1_'+s]).sub(world(h))),q:worldQ(h)};
   const f=bones['foot_'+s];anatomy['foot_'+s]={frame:footBasis(world(bones['ball_'+s]).sub(world(f))),q:worldQ(f)};}}

 // ---- pose from one captured frame (joint positions in metres, already scaled to this body) ----
 function poseMotion(p){lastPose=p;if(!rig)return;
  for(const r of rest){r.b.quaternion.copy(r.q);r.b.position.copy(r.p);}rig.position.set(0,0,0);rig.updateMatrixWorld(true);
  // pelvis, then the spine bends from pelvis to chest in three steps
  orient(bones.pelvis,basis(p.lhip.clone().sub(p.rhip),p.spine.clone().sub(p.hip)),'pelvis');
  rig.position.add(p.hip.clone().sub(world(bones.pelvis)));rig.updateMatrixWorld(true);
  const chestQ=basis(p.ls.clone().sub(p.rs),p.neck.clone().sub(p.hip)).multiply(anatomy.chest.frame.clone().invert()).multiply(anatomy.chest.q),pelvisQ=worldQ(bones.pelvis);
  for(const [name,t] of [['spine1',.4],['spine2',.7],['chest',1]]){const a=pelvisQ.clone().multiply(anatomy.pelvis.q.clone().invert()).multiply(anatomy[name].q),b=chestQ.clone().multiply(anatomy.chest.q.clone().invert()).multiply(anatomy[name].q);setWorldQ(bones[name],a.slerp(b,t));}
  const headQ=basis(p.ls.clone().sub(p.rs),p.headTop.clone().sub(p.neck)).multiply(anatomy.head.frame.clone().invert()).multiply(anatomy.head.q);
  setWorldQ(bones.neck,worldQ(bones.chest).multiply(anatomy.chest.q.clone().invert()).multiply(anatomy.neck.q).slerp(headQ.clone().multiply(anatomy.head.q.clone().invert()).multiply(anatomy.neck.q),.5));
  setWorldQ(bones.head,headQ);
  // legs with ground contact: no sole goes through the floor, planted feet rest on it
  const legs=()=>{let short=0;for(const s of ['r','l']){
   const thigh=bones['thigh_'+s],calf=bones['calf_'+s],foot=bones['foot_'+s],hip=world(thigh),srcHip=p[s+'hip'];
   const ratio=(world(thigh).distanceTo(world(calf))+world(calf).distanceTo(world(foot)))/(srcHip.distanceTo(p[s+'k'])+p[s+'k'].distanceTo(p[s+'f']));
   const ankle=hip.clone().add(p[s+'f'].clone().sub(srcHip).multiplyScalar(ratio)),knee=hip.clone().add(p[s+'k'].clone().sub(srcHip).multiplyScalar(ratio));
   const plant=1-T.MathUtils.smoothstep(p[s+'t'].y,.035,.07);let lift=0,low=0;
   for(let pass=0;pass<3;pass++){
    solveLimb(thigh,calf,foot,ankle.clone().setY(ankle.y+lift),knee);
    const d=p[s+'t'].clone().sub(p[s+'f']);orient(foot,footBasis(new T.Vector3(d.x,0,d.z).normalize().multiplyScalar(.14).setY(Math.min(-.03,d.y))),'foot_'+s);
    low=soleLow(s);
    if(low<-.002){// rock the foot onto its toe until the sole just touches the ground
     const dir=world(bones['ball_'+s]).sub(world(foot)).setY(0).normalize(),lateral=v3().crossVectors(UP,dir).normalize();
     const toeY=()=>world(bones['toe_'+s]).y;const t0=toeY();rotateWorld(foot,lateral,.05);const sign=toeY()>t0?1:-1;rotateWorld(foot,lateral,-.05);
     const at=phi=>{rotateWorld(foot,lateral,sign*phi);const v=soleLow(s);rotateWorld(foot,lateral,-sign*phi);return v;};
     let a=0,b=1.2;for(let k=0;k<14;k++){const m1=a+(b-a)/3,m2=b-(b-a)/3;if(at(m1)<at(m2))a=m1;else b=m2;}let phi=(a+b)/2;
     if(at(phi)>0){let lo=0,hi=phi;for(let k=0;k<14;k++){const m=(lo+hi)/2;if(at(m)>=0)hi=m;else lo=m;}phi=hi;}
     rotateWorld(foot,lateral,sign*phi);low=soleLow(s);}
    if(Math.abs(low)<.002)break;lift+=low<0?-low:-low*plant;}
   if(plant>.5&&low>.003)short=Math.max(short,low*plant);}
   return short;};
  const short=legs();if(short>0){rig.position.y-=short;rig.updateMatrixWorld(true);legs();}
  // arms: IK to the captured wrist, hand oriented from the captured finger direction, twist shared with the forearm
  for(const s of ['r','l']){
   const upper=bones['upper_'+s],lower=bones['lower_'+s],hand=bones['hand_'+s],shoulder=world(upper),src=p[s+'s'];
   const ratio=(world(upper).distanceTo(world(lower))+world(lower).distanceTo(world(hand)))/(src.distanceTo(p[s+'e'])+p[s+'e'].distanceTo(p[s+'h']));
   solveLimb(upper,lower,hand,shoulder.clone().add(p[s+'h'].clone().sub(src).multiplyScalar(ratio)),shoulder.clone().add(p[s+'e'].clone().sub(src).multiplyScalar(ratio)));
   const finger=p[s+'i'].clone().sub(p[s+'h']).normalize(),fore=p[s+'h'].clone().sub(p[s+'e']).normalize();
   let palm=v3().crossVectors(fore,finger);if(palm.lengthSq()<.01)palm=new T.Vector3(0,0,1);palm.normalize();
   const x=v3().crossVectors(finger,palm).normalize();if(s==='l')x.negate();
   orient(hand,basis(x,finger),'hand_'+s);
   {const axisW=world(hand).sub(world(lower)).normalize(),qh=worldQ(hand),ql=worldQ(lower),rel=ql.clone().invert().multiply(qh),d=new T.Vector3(rel.x,rel.y,rel.z),axisL=axisW.applyQuaternion(ql.clone().invert()),dd=axisL.dot(d);const twist=new T.Quaternion(axisL.x*dd,axisL.y*dd,axisL.z*dd,rel.w).normalize();lower.quaternion.multiply(q4().slerp(twist,.5));rig.updateMatrixWorld(true);setWorldQ(hand,qh);}
   for(const digit of ['index','middle','ring','pinky'])for(const n of [1,2,3]){const grip=s==='l'?.55:p.released?.12:({index:.3,middle:.3,ring:1.05,pinky:1.15}[digit]);curl(bones[`${digit}${n}_${s}`],grip*(n===1?.75:n===2?1.15:.8),s);}
   curl(bones['thumb2_'+s],s==='r'&&!p.released?.5:.25,s);}
  // four-seam grip: index and middle fingers over the ball, thumb underneath
  const {y:hy,across:hx,palm:hz}=handAxes('r'),R=.037,knuckle=world(bones.index1_r).lerp(world(bones.middle1_r),.5);
  gripPoint=knuckle.clone().addScaledVector(hy,.032).addScaledVector(hz,.036);
  if(!p.released){for(const [digit,offset] of [['index',.012],['middle',-.010]]){const c=gripPoint.clone().addScaledVector(hx,offset),target=c.clone().addScaledVector(hy.clone().multiplyScalar(.62).addScaledVector(hz,-.78).normalize(),R+.007);solveLimb(bones[digit+'1_r'],bones[digit+'2_r'],bones[digit+'3_r'],target,c.clone().addScaledVector(hz,-.12));curl(bones[digit+'3_r'],.55,'r');}
   solveLimb(bones.thumb1_r,bones.thumb2_r,bones.thumb3_r,gripPoint.clone().addScaledVector(hz.clone().multiplyScalar(.85).addScaledVector(hy,-.3).addScaledVector(hx,.25).normalize(),R+.006),gripPoint.clone().addScaledVector(hx,.12).addScaledVector(hy,-.04));}
  rig.updateMatrixWorld(true);
  // glove and ball are children of the group, so world placements are converted into its space
  if(glove){const l=handAxes('l');glove.visible=true;group.updateMatrixWorld(true);const groupQ=worldQ(group).invert();
  glove.position.copy(group.worldToLocal(world(bones.hand_l).addScaledVector(l.palm,-.012).addScaledVector(l.y,-.035)));
  glove.quaternion.copy(groupQ.clone().multiply(q4().setFromRotationMatrix(new T.Matrix4().makeBasis(l.across.clone().negate(),l.y,v3().crossVectors(l.across.clone().negate(),l.y)))));}
  ball.position.copy(group.worldToLocal(gripPoint.clone()));
 }
 function motionScale(frame){const d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);const source=['l','r'].reduce((s,k)=>s+d(frame[k+'hip'],frame[k+'k'])+d(frame[k+'k'],frame[k+'f']),0)/2;const leg=rig?world(bones.thigh_l).distanceTo(world(bones.calf_l))+world(bones.calf_l).distanceTo(world(bones.foot_l)):.82;return leg/source;}

 // where the badge and numbers go: in the GLB's extras (tools/meshy builds) or a sidecar .fit.json (Meshy-rigged exports)
 const fitFile=fetch(url.replace(/\.glb$/,'.fit.json')).then(r=>r.ok?r.json():null).catch(()=>null);
 const ready=Promise.all([new GLTFLoader().loadAsync(url),fitFile]).then(([g,sidecar])=>{if(disposed){g.scene.traverse(o=>o.geometry?.dispose());return;}
  rig=g.scene;fit=g.scene.userData?.fit||sidecar||null;group.add(rig);
  rig.traverse(o=>{if(o.isBone){const plain=o.name.replace(/^mixamorig:?/,'');const key=Object.keys(BONE).find(k=>BONE[k]===plain);if(key)bones[key]=o;rest.push({b:o,q:o.quaternion.clone(),p:o.position.clone()});}
   if(o.isSkinnedMesh){skin=o;o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;Object.assign(o.material,{metalness:0,roughness:.86,envMapIntensity:.45,side:T.DoubleSide});}});
  for(const k of Object.keys(BONE))if(!bones[k])throw Error('模型缺少骨頭 '+BONE[k]);
  captureAnatomy();sampleSoles(skin);dress();if(lastPose)poseMotion(lastPose);});
 ready.catch(()=>{});
 return {group,ball,get glove(){return glove;},ready,poseMotion,pose:poseMotion,motionScale,bones,
  soleLow:s=>rig?soleLow(s):0,
  handPosition(){if(!rig)return lastPose?.rh?.clone()||v3();rig.updateMatrixWorld(true);return gripPoint?.clone()||world(bones.hand_r);},
  joint(name){return rig&&bones[name]?world(bones[name]):null;},
  dispose(){disposed=true;parent.remove(group);rig?.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of [].concat(o.material)){m.map?.dispose();m.normalMap?.dispose();m.metalnessMap?.dispose();m.dispose();}});for(const m of materials){m.map?.dispose();m.dispose();}}};
}
// Frame interpolation for the captured motion: joint positions as Vector3s plus the release flag.
export function sampleMotion(motion,time){const f=T.MathUtils.clamp(time*motion.fps,0,motion.frames.length-1),i=Math.floor(f),a=motion.frames[i],b=motion.frames[Math.min(i+1,motion.frames.length-1)],p={};for(const key of Object.keys(a))p[key]=new T.Vector3(...a[key]).lerp(new T.Vector3(...b[key]),f-i);p.released=time>=motion.keyTimes.release;return p;}
// Scale the capture to the model's leg length so the stride and lift match the body.
export function fitMotion(player,source){const k=player.motionScale(source.frames[0]);return {...source,frames:source.frames.map(f=>Object.fromEntries(Object.entries(f).map(([n,v])=>[n,v.map(c=>c*k)])))};}
