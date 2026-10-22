import * as T from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {makePitcherGlove} from './scene-models.js';

// Pitcher built on a professionally modelled character: Mixamo "Michelle" (Adobe), stripped of her
// accessories and repainted into a baseball uniform by tools/pro. The Mixamo rig has 65 bones
// with non-identity rest rotations, so every pose operation here works in world space.
const B={pelvis:'Hips',spine_01:'Spine',spine_02:'Spine1',spine_03:'Spine2',neck_01:'Neck',head:'Head',headTop:'HeadTop_End'};
for(const [s,S] of [['l','Left'],['r','Right']]){Object.assign(B,{['upperarm_'+s]:S+'Arm',['lowerarm_'+s]:S+'ForeArm',['hand_'+s]:S+'Hand',['thigh_'+s]:S+'UpLeg',['calf_'+s]:S+'Leg',['foot_'+s]:S+'Foot',['ball_'+s]:S+'ToeBase',['toe_'+s]:S+'Toe_End'});
 for(const [d,D] of [['thumb','Thumb'],['index','Index'],['middle','Middle'],['ring','Ring'],['pinky','Pinky']])for(const n of [1,2,3,4])B[`${d}_0${n}_${s}`]=`${S}Hand${D}${n}`;}
const NAVY=0x1d3552,RED=0xd8513a;

export function createPitcherModel(scene){
 const group=new T.Group();scene.add(group);let rig,bones={},rest=[],lastPose,disposed=false,anatomy={},gripPoint,curl={},sole={},fit=null;
 const std=(color,roughness=.8,extra={})=>new T.MeshStandardMaterial({color,roughness,...extra});
 const white=std(0xf4efe3,.6),red=std(RED,.65),navy=std(NAVY,.85);
 const ball=new T.Mesh(new T.SphereGeometry(.037,24,16),white);group.add(ball);ball.castShadow=true;
 for(let side=0;side<2;side++){const pts=[];for(let i=0;i<=96;i++){const a=i/96*Math.PI*2,theta=.95+.27*Math.cos(2*a),phi=a+side*Math.PI;pts.push(new T.Vector3(.0372*Math.sin(theta)*Math.cos(phi),.0372*Math.cos(theta)*(side?1:-1),.0372*Math.sin(theta)*Math.sin(phi)));}ball.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts,true),96,.0011,4,true),red));}
 const mitt=makePitcherGlove();group.add(mitt);mitt.visible=false;
 const world=o=>o.getWorldPosition(new T.Vector3());
 const v3=a=>new T.Vector3(...a);
 function surface(geo,material,parent){const o=new T.Mesh(geo,material);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
 // Parent `object` to `bone` keeping its current world placement.
 function attachWorld(bone,object){rig.updateMatrixWorld(true);bone.attach(object);return object;}

 function canvasTexture(draw,size=512){const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;}
 function numberTexture(){return canvasTexture((x,s)=>{x.clearRect(0,0,s,s);x.textAlign='center';x.textBaseline='middle';x.font='900 300px "Arial Black",Impact,sans-serif';x.lineJoin='round';x.lineWidth=34;x.strokeStyle='#d8513a';x.strokeText('17',s/2,s/2+14);x.fillStyle='#1d3552';x.fillText('17',s/2,s/2+14);});}
 function logoTexture(){return canvasTexture((x,s)=>{x.clearRect(0,0,s,s);x.textAlign='center';x.textBaseline='middle';x.font='900 420px Georgia,serif';x.lineJoin='round';x.lineWidth=46;x.strokeStyle='#d8513a';x.strokeText('B',s/2,s/2+24);x.fillStyle='#f4ead2';x.fillText('B',s/2,s/2+24);},512);}
 function decal(map,w,h){return new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map,transparent:true,roughness:.85,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,side:T.DoubleSide}));}

 // Cap and jersey numbers are fitted to the mesh in its rest pose, then parented to bones.
 function dress(body){
  const pos=body.geometry.attributes.position,si=body.geometry.attributes.skinIndex,sw=body.geometry.attributes.skinWeight,names=body.skeleton.bones.map(b=>b.name);
  const weight=(i,re)=>{let s=0;for(let j=0;j<4;j++)if(re.test(names[si.array[i*4+j]]||''))s+=sw.array[i*4+j];return s;};
  // only vertices still referenced by a triangle: the stripped accessories left their vertices behind
  const used=new Uint8Array(pos.count);for(const i of body.geometry.index.array)used[i]=1;
  let top=-Infinity,front=-Infinity,back=Infinity,hx=0,chestF=-Infinity,chestB=Infinity;
  for(let i=0;i<pos.count;i++){if(!used[i])continue;const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
   if(weight(i,/Head$/)>.6&&y>1.40){top=Math.max(top,y);front=Math.max(front,z);back=Math.min(back,z);hx=Math.max(hx,Math.abs(x));}
   if(Math.abs(x)<.06&&y>1.17&&y<1.25){chestF=Math.max(chestF,z);chestB=Math.min(chestB,z);}
  }
  if(fit?.hasCap){
   const badge=decal(logoTexture(),fit.capLogo.size*.8,fit.capLogo.size*.8);badge.position.set(...fit.capLogo.center);badge.position.z+=.004;badge.rotation.x=-.25;group.add(badge);attachWorld(bones.head,badge);
   const number=numberTexture();const frontNo=decal(number,.09,.09);frontNo.position.set(...fit.chestFront);frontNo.position.z+=.006;frontNo.rotation.y=-.25;group.add(frontNo);attachWorld(bones.spine_03,frontNo);
   const backNo=decal(number,.20,.20);backNo.position.set(...fit.chestBack);backNo.position.z-=.006;backNo.rotation.y=Math.PI;group.add(backNo);attachWorld(bones.spine_03,backNo);
   soleSamples(body,used,weight);return;
  }
  const headC=new T.Vector3(0,top-.062,(front+back)/2+.004),rx=hx+.010,ry=top-headC.y+.034,rz=(front-back)/2+.012;
  const cap=new T.Group();
  const crown=new T.SphereGeometry(1,48,26,0,Math.PI*2,0,Math.PI*.52),cp=crown.attributes.position;for(let i=0;i<cp.count;i++){cp.setXYZ(i,cp.getX(i)*rx,cp.getY(i)*ry,cp.getZ(i)*rz);}crown.computeVertexNormals();
  const capCloth=std(NAVY,.88);
  capCloth.onBeforeCompile=sh=>{sh.vertexShader='varying vec3 vCap;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vCap=position;');sh.fragmentShader='varying vec3 vCap;\n'+sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n float a=atan(vCap.x,vCap.z);float s=abs(fract(a/1.0472+.5)-.5)*1.0472*length(vCap.xz);diffuseColor.rgb*=1.-.4*(1.-smoothstep(.0006,.002,s))*step(.01,vCap.y);');};
  surface(crown,capCloth,cap);
  const rimY=Math.cos(Math.PI*.52);surface(new T.TorusGeometry(1,.012,8,56),navy,cap).scale.set(rx*Math.sin(Math.PI*.52),rz*Math.sin(Math.PI*.52),1);cap.children[1].rotation.x=Math.PI/2;cap.children[1].position.y=rimY*ry;
  const button=surface(new T.SphereGeometry(.011,12,8),navy,cap);button.position.y=ry;button.scale.y=.6;
  // bill: a curved plate grown from the front of the rim, thickened underneath
  const pts=[],idx=[],U=28,W=7,depth=.078;for(let j=0;j<=W;j++)for(let i=0;i<=U;i++){const u=i/U*2-1,v=j/W,ang=u*1.15;const ex=Math.sin(ang)*rx*.98*Math.sin(Math.PI*.52),ez=Math.cos(ang)*rz*.98*Math.sin(Math.PI*.52);const reach=depth*Math.cos(u*1.2)**.7;pts.push(ex*(1+.12*v),rimY*ry-.002-v*v*.028-u*u*v*.045,ez+v*reach);}
  for(let j=0;j<W;j++)for(let i=0;i<U;i++){const a=j*(U+1)+i,b=a+U+1;idx.push(a,b,a+1,a+1,b,b+1);}
  const bill=new T.BufferGeometry();bill.setAttribute('position',new T.Float32BufferAttribute(pts,3));bill.setIndex(idx);bill.computeVertexNormals();
  surface(bill,std(NAVY,.7,{side:T.DoubleSide}),cap);const under=surface(bill.clone(),std(0x2a3d4c,.8,{side:T.DoubleSide}),cap);under.position.y=-.006;
  const logo=decal(logoTexture(),.075,.075);const lp=new T.Vector3(0,.52,.86).normalize();logo.position.set(lp.x*rx,lp.y*ry,lp.z*rz+.002);logo.lookAt(logo.position.clone().multiply(new T.Vector3(1,ry/rz*.7,1)).multiplyScalar(2));cap.add(logo);
  cap.position.copy(headC);cap.rotation.x=-.14;group.add(cap);attachWorld(bones.head,cap);
  // numbers on the chest and back
  const number=numberTexture();const frontNo=decal(number,.085,.085);frontNo.position.set(-.055,1.215,chestF+.012);frontNo.rotation.y=-.35;group.add(frontNo);attachWorld(bones.spine_03,frontNo);
  const backNo=decal(number,.19,.19);backNo.position.set(0,1.19,chestB-.012);backNo.rotation.y=Math.PI;group.add(backNo);attachWorld(bones.spine_03,backNo);
  soleSamples(body,used,weight);
 }
 // sole: the lowest vertices of each shoe, measured through the skin each time
 function soleSamples(body,used,weight){const pos=body.geometry.attributes.position;skin=body;for(const s of ['l','r']){const re=s==='l'?/LeftFoot|LeftToe/:/RightFoot|RightToe/;const list=[];for(let i=0;i<pos.count;i++)if(used[i]&&pos.getY(i)<.012&&weight(i,re)>.5)list.push(i);sole[s]=list.filter((_,k)=>k%4===0);}}
 let skin=null;const tmpV=new T.Vector3();
 function soleLow(s){rig.updateMatrixWorld(true);skin.skeleton.update();let y=Infinity;const pos=skin.geometry.attributes.position;for(const i of sole[s]){tmpV.fromBufferAttribute(pos,i);skin.applyBoneTransform(i,tmpV);tmpV.applyMatrix4(skin.matrixWorld);y=Math.min(y,tmpV.y);}return y;}
 function aim(bone,child,target){rig.updateMatrixWorld(true);const a=world(bone),from=world(child).sub(a).normalize(),to=target.clone().sub(a).normalize();const delta=new T.Quaternion().setFromUnitVectors(from,to),q=bone.getWorldQuaternion(new T.Quaternion()).premultiply(delta),parent=bone.parent.getWorldQuaternion(new T.Quaternion()).invert();bone.quaternion.copy(parent.multiply(q));}
 function rotateWorld(b,axis,angle){const q=new T.Quaternion().setFromAxisAngle(axis,angle).multiply(b.getWorldQuaternion(new T.Quaternion()));b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));rig.updateMatrixWorld(true);}
 function frame(x,y){y=y.clone().normalize();let z=new T.Vector3().crossVectors(x,y).normalize();x=new T.Vector3().crossVectors(y,z).normalize();return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));}
 function orient(bone,target,key){const q=target.multiply(anatomy[key].frame.clone().invert()).multiply(anatomy[key].q);bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));rig.updateMatrixWorld(true);}
 function solveLimb(a,b,c,target,pole){rig.updateMatrixWorld(true);const root=world(a),l1=world(b).distanceTo(root),l2=world(c).distanceTo(world(b)),dir=target.clone().sub(root),distance=T.MathUtils.clamp(dir.length(),.025,l1+l2-.0001);dir.normalize();const along=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along*along)),bend=pole.clone().sub(root);bend.addScaledVector(dir,-bend.dot(dir));if(bend.lengthSq()<.00001)bend.set(0,0,1).addScaledVector(dir,-dir.z);bend.normalize();aim(a,b,root.clone().addScaledVector(dir,along).addScaledVector(bend,height));aim(b,c,root.clone().addScaledVector(dir,distance));}
 function handAxes(side){const h=world(bones['hand_'+side]),y=world(bones['middle_01_'+side]).sub(h).normalize(),across=world(bones['index_01_'+side]).sub(world(bones['pinky_01_'+side])).normalize(),palm=new T.Vector3().crossVectors(across,y).normalize();if(side==='l')palm.negate();return {y,across,palm};}
 // Curl a finger joint toward the palm about the hand's current knuckle axis.
 function bend(bone,angle,side){const {across,y,palm}=handAxes(side);const axis=across.clone();if(y.clone().applyAxisAngle(axis,.2).sub(y).dot(palm)<0)axis.negate();rotateWorld(bone,axis,angle);}
 function footFrame(dir){const d=dir.clone().normalize(),x=new T.Vector3().crossVectors(new T.Vector3(0,1,0),d).normalize(),y=new T.Vector3().crossVectors(d,x).normalize();return frame(x,y);}
 function poseMotion(p){lastPose=p;if(!rig)return;
  for(const r of rest){r.b.quaternion.copy(r.q);r.b.position.copy(r.p);}rig.position.set(0,0,0);rig.updateMatrixWorld(true);
  orient(bones.pelvis,frame(p.lhip.clone().sub(p.rhip),p.spine.clone().sub(p.hip)),'pelvis');
  rig.position.add(p.hip.clone().sub(world(bones.pelvis)));rig.updateMatrixWorld(true);
  const chestFrame=frame(p.ls.clone().sub(p.rs),p.neck.clone().sub(p.hip)),pelvisQ=bones.pelvis.getWorldQuaternion(new T.Quaternion());
  const chestQ=chestFrame.clone().multiply(anatomy.torso.frame.clone().invert()).multiply(anatomy.torso.q);
  for(const [name,t] of [['spine_01',.4],['spine_02',.7],['spine_03',1]]){const b=bones[name],q=pelvisQ.clone().multiply(anatomy.pelvis.q.clone().invert()).multiply(anatomy[name].q).slerp(chestQ.clone().multiply(anatomy.torso.q.clone().invert()).multiply(anatomy[name].q),t);b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));rig.updateMatrixWorld(true);}
  const headFrame=frame(p.ls.clone().sub(p.rs),p.headTop.clone().sub(p.neck)),headQ=headFrame.multiply(anatomy.head.frame.clone().invert()).multiply(anatomy.head.q),neckQ=bones.spine_03.getWorldQuaternion(new T.Quaternion()).multiply(anatomy.spine_03.q.clone().invert()).multiply(anatomy.neck_01.q).slerp(headQ.clone().multiply(anatomy.head.q.clone().invert()).multiply(anatomy.neck_01.q),.5);
  bones.neck_01.quaternion.copy(bones.neck_01.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(neckQ));rig.updateMatrixWorld(true);
  bones.head.quaternion.copy(bones.head.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(headQ));rig.updateMatrixWorld(true);
  // Legs with ground contact: planted soles rest on the floor and no sole goes through it.
  const legs=()=>{let short=0;for(const side of ['r','l']){
   const thigh=bones['thigh_'+side],calf=bones['calf_'+side],foot=bones['foot_'+side],hip=world(thigh),srcHip=p[side+'hip'];
   const srcLen=srcHip.distanceTo(p[side+'k'])+p[side+'k'].distanceTo(p[side+'f']),len=world(thigh).distanceTo(world(calf))+world(calf).distanceTo(world(foot)),ratio=len/srcLen;
   const ankle=hip.clone().add(p[side+'f'].clone().sub(srcHip).multiplyScalar(ratio)),knee=hip.clone().add(p[side+'k'].clone().sub(srcHip).multiplyScalar(ratio));
   const plant=1-T.MathUtils.smoothstep(p[side+'t'].y,.035,.07);let lift=0,low=0;
   for(let pass=0;pass<3;pass++){
    solveLimb(thigh,calf,foot,ankle.clone().setY(ankle.y+lift),knee);
    const d=p[side+'t'].clone().sub(p[side+'f']);orient(foot,footFrame(new T.Vector3(d.x,0,d.z).normalize().multiplyScalar(.14).setY(Math.min(-.03,d.y))),'foot_'+side);
    low=soleLow(side);
    if(low<-.002){const dir=world(bones['ball_'+side]).sub(world(foot)).setY(0).normalize(),lateral=new T.Vector3().crossVectors(new T.Vector3(0,1,0),dir).normalize();
     const toeY=()=>world(bones['toe_'+side]).y;const t0=toeY();rotateWorld(foot,lateral,.05);const sign=toeY()>t0?1:-1;rotateWorld(foot,lateral,-.05);
     const at=phi=>{rotateWorld(foot,lateral,sign*phi);const v=soleLow(side);rotateWorld(foot,lateral,-sign*phi);return v;};
     let a=0,b=1.2;for(let k=0;k<14;k++){const m1=a+(b-a)/3,m2=b-(b-a)/3;if(at(m1)<at(m2))a=m1;else b=m2;}let phi=(a+b)/2;
     if(at(phi)>0){let lo=0,hi=phi;for(let k=0;k<14;k++){const m=(lo+hi)/2;if(at(m)>=0)hi=m;else lo=m;}phi=hi;}
     rotateWorld(foot,lateral,sign*phi);low=soleLow(side);}
    if(Math.abs(low)<.002)break;lift+=low<0?-low:-low*plant;}
   if(plant>.5&&low>.003)short=Math.max(short,low*plant);
  }return short;};
  const short=legs();if(short>0){rig.position.y-=short;rig.updateMatrixWorld(true);legs();}
  for(const side of ['r','l']){
   const upper=bones['upperarm_'+side],lower=bones['lowerarm_'+side],hand=bones['hand_'+side],shoulder=world(upper),sourceShoulder=p[side+'s'];
   const sourceLength=sourceShoulder.distanceTo(p[side+'e'])+p[side+'e'].distanceTo(p[side+'h']),length=world(upper).distanceTo(world(lower))+world(lower).distanceTo(world(hand)),ratio=length/sourceLength;
   const wrist=shoulder.clone().add(p[side+'h'].clone().sub(sourceShoulder).multiplyScalar(ratio)),elbow=shoulder.clone().add(p[side+'e'].clone().sub(sourceShoulder).multiplyScalar(ratio));
   solveLimb(upper,lower,hand,wrist,elbow);
   const finger=p[side+'i'].clone().sub(p[side+'h']).normalize(),fore=p[side+'h'].clone().sub(p[side+'e']).normalize();
   let palm=new T.Vector3().crossVectors(fore,finger);if(palm.lengthSq()<.01)palm=new T.Vector3(0,0,1);palm.normalize();
   let x=new T.Vector3().crossVectors(finger,palm).normalize();if(side==='l')x.negate();
   orient(hand,frame(x,finger),'hand_'+side);
   // share the wrist twist with the forearm
   {const axisW=world(hand).sub(world(lower)).normalize();const qh=hand.getWorldQuaternion(new T.Quaternion()),ql=lower.getWorldQuaternion(new T.Quaternion()),rel=ql.clone().invert().multiply(qh);const d=new T.Vector3(rel.x,rel.y,rel.z);const axisL=axisW.clone().applyQuaternion(ql.clone().invert());const dd=axisL.dot(d);const twist=new T.Quaternion(axisL.x*dd,axisL.y*dd,axisL.z*dd,rel.w).normalize();const part=new T.Quaternion().slerp(twist,.5);lower.quaternion.multiply(part);rig.updateMatrixWorld(true);hand.quaternion.copy(hand.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(qh));rig.updateMatrixWorld(true);}
   for(const digit of ['index','middle','ring','pinky'])for(const id of ['01','02','03']){const grip=side==='l'?.55:p.released?.12:({index:.3,middle:.3,ring:1.05,pinky:1.15}[digit]);bend(bones[digit+'_'+id+'_'+side],grip*(id==='01'?.75:id==='02'?1.15:.8),side);}
   bend(bones['thumb_02_'+side],side==='r'&&!p.released?.5:.25,side);
  }
  rig.updateMatrixWorld(true);
  const {y:hy,across:hx,palm:hz}=handAxes('r');
  const R=.037,knuckle=world(bones.index_01_r).lerp(world(bones.middle_01_r),.5);
  gripPoint=knuckle.clone().addScaledVector(hy,.040).addScaledVector(hz,.040);
  if(!p.released){
   for(const [digit,offset] of [['index',.012],['middle',-.010]]){const c=gripPoint.clone().addScaledVector(hx,offset),target=c.clone().addScaledVector(hy.clone().multiplyScalar(.62).addScaledVector(hz,-.78).normalize(),R+.007);solveLimb(bones[digit+'_01_r'],bones[digit+'_02_r'],bones[digit+'_03_r'],target,c.clone().addScaledVector(hz,-.12));bend(bones[digit+'_03_r'],.55,'r');}
   solveLimb(bones.thumb_01_r,bones.thumb_02_r,bones.thumb_03_r,gripPoint.clone().addScaledVector(hz.clone().multiplyScalar(.85).addScaledVector(hy,-.3).addScaledVector(hx,.25).normalize(),R+.006),gripPoint.clone().addScaledVector(hx,.12).addScaledVector(hy,-.04));
  }
  rig.updateMatrixWorld(true);
  const l=handAxes('l');mitt.visible=true;mitt.position.copy(world(bones.hand_l)).addScaledVector(l.palm,.012).addScaledVector(l.y,.02);
  mitt.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(l.across.clone().negate(),l.y,new T.Vector3().crossVectors(l.across.clone().negate(),l.y)));
 }
 function captureAnatomy(){
  rig.updateMatrixWorld(true);const x=world(bones.thigh_l).sub(world(bones.thigh_r)),up=world(bones.neck_01).sub(world(bones.pelvis)),basis=frame(x,up);
  for(const [key,bone] of [['pelvis',bones.pelvis],['torso',bones.spine_03],['head',bones.head],['spine_01',bones.spine_01],['spine_02',bones.spine_02],['spine_03',bones.spine_03],['neck_01',bones.neck_01]])anatomy[key]={frame:basis.clone(),q:bone.getWorldQuaternion(new T.Quaternion())};
  for(const side of ['r','l']){
   const h=bones['hand_'+side],y=world(bones['middle_01_'+side]).sub(world(h)),xx=world(bones['index_01_'+side]).sub(world(bones['pinky_01_'+side]));anatomy['hand_'+side]={frame:frame(xx,y),q:h.getWorldQuaternion(new T.Quaternion())};
   const f=bones['foot_'+side],d=world(bones['ball_'+side]).sub(world(f));anatomy['foot_'+side]={frame:footFrame(d),q:f.getWorldQuaternion(new T.Quaternion())};
  }
 }
 function motionScale(f){const d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);const source=['l','r'].reduce((s,k)=>s+d(f[k+'hip'],f[k+'k'])+d(f[k+'k'],f[k+'f']),0)/2;const leg=rig?world(bones.thigh_l).distanceTo(world(bones.calf_l))+world(bones.calf_l).distanceTo(world(bones.foot_l)):.82;return leg/source;}
 const ready=new GLTFLoader().loadAsync(new URL('./models/pitcher-pro.glb',import.meta.url).href).then(g=>{
  if(disposed){g.scene.traverse(o=>o.geometry?.dispose());return;}
  rig=g.scene;fit=g.scene.userData?.fit||null;group.add(rig);let body;
  rig.traverse(o=>{if(o.isBone){const plain=o.name.replace(/^mixamorig:?/,'');const key=Object.keys(B).find(k=>B[k]===plain);if(key)bones[key]=o;rest.push({b:o,q:o.quaternion.clone(),p:o.position.clone()});}if(o.isSkinnedMesh){body=o;o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;o.material.metalness=0;o.material.roughness=fit?.hasCap?.85:1;o.material.envMapIntensity=.6;o.material.side=fit?.hasCap?T.DoubleSide:T.FrontSide;}});
  captureAnatomy();dress(body);if(lastPose)poseMotion(lastPose);
 });
 return {group,ball,ready,pose:poseMotion,poseMotion,motionScale,soleLow:s=>rig?soleLow(s):0,handPosition(){if(!rig)return lastPose?.rh.clone()||new T.Vector3();rig.updateMatrixWorld(true);return gripPoint?.clone()||world(bones.hand_r);},dispose(){disposed=true;}};
}
