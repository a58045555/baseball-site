import * as T from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {makePitcherGlove} from './scene-models.js';

// Quaternius CC0 anatomy and skin weights; the baseball uniform and poses are local.
export function createPitcherModel(scene){
 const group=new T.Group();scene.add(group);let rig,bones={},rest=[],lastPose,disposed=false,anatomy={},gripPoint;
 const mat=(color,roughness=.82)=>new T.MeshStandardMaterial({color,roughness});
 const white=mat(0xf1eee2),teal=mat(0x173e46),red=mat(0xb74835),skin=mat(0xc68d66),gold=mat(0xd9b66b),dark=mat(0x252b2a);
 const ball=new T.Mesh(new T.SphereGeometry(.037,24,16),white);group.add(ball);ball.castShadow=true;
 for(let side=0;side<2;side++){const pts=[];for(let i=0;i<=96;i++){const a=i/96*Math.PI*2,theta=.95+.27*Math.cos(2*a),phi=a+side*Math.PI;pts.push(new T.Vector3(.0372*Math.sin(theta)*Math.cos(phi),.0372*Math.cos(theta)*(side?1:-1),.0372*Math.sin(theta)*Math.sin(phi)));}ball.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts,true),96,.0011,4,true),red));}
 const mitt=makePitcherGlove();group.add(mitt);mitt.visible=false;
 const world=o=>o.getWorldPosition(new T.Vector3());
 function surface(geo,material,parent=group){const o=new T.Mesh(geo,material);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
 function attachAt(bone,object,position){bone.add(object);object.position.copy(bone.worldToLocal(new T.Vector3(...position)));const q=bone.getWorldQuaternion(new T.Quaternion()).invert();object.quaternion.copy(q);return object;}
 function label(text,w,h,color='#173e46'){
  const c=document.createElement('canvas');c.width=256;c.height=256;const x=c.getContext('2d');x.fillStyle=color;x.textAlign='center';x.textBaseline='middle';x.font='900 180px sans-serif';x.fillText(text,128,140);
  const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;return new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map,transparent:true,roughness:.9,depthWrite:false}));
 }
 function accessories(){
  rig.updateMatrixWorld(true);
  const cap=new T.Group(),shell=surface(new T.SphereGeometry(.113,40,24,0,Math.PI*2,0,Math.PI/2),teal,cap);shell.scale.set(1.05,.82,1.03);
  const band=surface(new T.CylinderGeometry(.118,.117,.022,40,1,true),teal,cap);band.position.y=.003;
  const shape=new T.Shape();shape.moveTo(-.11,0);shape.bezierCurveTo(-.16,.08,-.13,.17,0,.18);shape.bezierCurveTo(.13,.17,.16,.08,.11,0);shape.lineTo(-.11,0);
  const brim=surface(new T.ExtrudeGeometry(shape,{depth:.009,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.005,bevelThickness:.003}),teal,cap);brim.rotation.x=-Math.PI/2;brim.position.set(0,-.002,.048);
  const button=surface(new T.SphereGeometry(.009,12,8),red,cap);button.position.y=.095;
  const badge=label('B',.044,.048,'#f5e8ca');badge.position.set(0,.044,.107);cap.add(badge);
  attachAt(bones.Head,cap,[0,1.758,.001]);
  // Pupils sit on the actual eye surfaces; no oversized bead eyes or separate jaw.
  for(const side of [-1,1]){const iris=surface(new T.SphereGeometry(.0085,18,12),dark);iris.scale.set(1,1,.28);attachAt(bones.Head,iris,[side*.032,1.699,.082]);}
  const number=label('17',.11,.12);attachAt(bones.spine_03,number,[.08,1.335,.162]);
  const back=label('17',.18,.22);back.rotation.y=Math.PI;attachAt(bones.spine_03,back,[0,1.34,-.190]);back.rotateY(Math.PI);
  const belt=surface(new T.TorusGeometry(.155,.012,8,64),teal);belt.rotation.x=Math.PI/2;belt.scale.set(1.08,.78,1);attachAt(bones.pelvis,belt,[0,1.012,-.027]);belt.rotateX(Math.PI/2);
  for(let i=0;i<4;i++){const button=surface(new T.SphereGeometry(.004,8,6),gold);attachAt(bones.spine_02,button,[0,1.15+i*.066,.150]);}
  for(const side of ['r','l'])for(let i=0;i<3;i++){
   const lace=surface(new T.CapsuleGeometry(.0025,.052,3,6),white);const x=side==='r'?-.114:.114;
   attachAt(bones['foot_'+side],lace,[x,.076,.012+i*.025]);lace.rotateZ(Math.PI/2);
  }
 }
 function uniform(o){
  if(o.name==='Eyes'){o.material=mat(0xe8e3d8,.48);return;}
  if(o.name==='Eyebrows'){o.material=mat(0x302923);return;}
  const geometry=o.geometry.clone(),p=geometry.attributes.position,n=geometry.attributes.normal,colors=new Float32Array(p.count*3);
  const palette={skin:new T.Color(0xc58c66),shirt:new T.Color(0xf1ecde),pants:new T.Color(0xe7e2d5),shoe:new T.Color(0x17343a),belt:new T.Color(0x17343a),stripe:new T.Color(0xa7b3aa),sock:new T.Color(0x843e32)};
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i),abs=Math.abs(x);
   const shirt=y>1.015&&y<1.558&&abs<.43&&!(abs<.065&&y>1.51),pants=y>.11&&y<=1.015,shoe=y<=.11;
   let color=palette.skin;if(shirt)color=palette.shirt;else if(pants)color=palette.pants;else if(shoe)color=palette.shoe;
   
   if(y>.99&&y<1.02&&abs<.2||shirt&&abs>.405)color=palette.belt;
   if(y>.11&&y<.20)color=palette.sock;
   if(shirt||pants){const expand=shirt?.009:(y>.22?.024:.012);p.setXYZ(i,x+n.getX(i)*expand,y,z+n.getZ(i)*expand);}
   colors.set([color.r,color.g,color.b],i*3);
  }
  // The real glove encloses the left hand; remove covered skin rather than let fingers poke through leather.
  if(o.isSkinnedMesh&&geometry.index){const indices=geometry.index.array,si=geometry.attributes.skinIndex,sw=geometry.attributes.skinWeight,hidden=new Uint8Array(p.count);for(let i=0;i<p.count;i++){let weight=0;for(let j=0;j<4;j++){const name=o.skeleton.bones[si.array[i*4+j]]?.name||'';if(/^(hand|index|middle|ring|pinky|thumb).*_l$/.test(name))weight+=sw.array[i*4+j];}hidden[i]=weight>.55;}const keep=[];for(let i=0;i<indices.length;i+=3)if(!hidden[indices[i]]&&!hidden[indices[i+1]]&&!hidden[indices[i+2]])keep.push(indices[i],indices[i+1],indices[i+2]);geometry.setIndex(keep);}
  geometry.setAttribute('color',new T.BufferAttribute(colors,3));geometry.computeVertexNormals();o.geometry=geometry;o.material=new T.MeshStandardMaterial({vertexColors:true,roughness:.88});
  o.material.onBeforeCompile=shader=>{shader.vertexShader='varying vec3 vTailor;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vTailor=position;');shader.fragmentShader='varying vec3 vTailor;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n if(vTailor.y>.23&&vTailor.y<1.54&&abs(vTailor.x)<.41){float d=abs(fract(vTailor.x/.032+.5)-.5);float line=1.-smoothstep(.018,.055,d);diffuseColor.rgb*=1.-.28*line;}');};
 }
 // Aim a bone in world space, preserving its length and the artist's skin weights.
 function aim(bone,child,target){
  rig.updateMatrixWorld(true);const a=world(bone),from=world(child).sub(a).normalize(),to=target.clone().sub(a).normalize();
  const delta=new T.Quaternion().setFromUnitVectors(from,to),q=bone.getWorldQuaternion(new T.Quaternion()).premultiply(delta),parent=bone.parent.getWorldQuaternion(new T.Quaternion()).invert();bone.quaternion.copy(parent.multiply(q));
 }
 function pose(p){lastPose=p;if(!rig)return;
  for(const r of rest){r.b.quaternion.copy(r.q);r.b.position.copy(r.p);}
  rig.position.set(p.hip.x,p.hip.y-.979,p.hip.z+.043);rig.updateMatrixWorld(true);
  const lean=p.shoulder.clone().sub(p.hip).normalize(),top=world(bones.spine_01).addScaledVector(lean,.5);aim(bones.spine_01,bones.spine_03,top);
  for(const [side,knee,foot,elbow,hand] of [['r',p.rk,p.rf,p.re,p.rh],['l',p.lk,p.lf,p.le,p.lh]]){
   const thigh=bones['thigh_'+side],calf=bones['calf_'+side],ankleBone=bones['foot_'+side],hip=world(thigh),restKnee=world(calf),restAnkle=world(ankleBone),l1=hip.distanceTo(restKnee),l2=restKnee.distanceTo(restAnkle),dir=foot.clone().sub(hip),distance=Math.min(dir.length(),l1+l2-.001);dir.normalize();
   const along=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along*along));
   const pole=knee.clone().sub(hip).addScaledVector(dir,-knee.clone().sub(hip).dot(dir));if(pole.lengthSq()<.001)pole.set(0,0,1).addScaledVector(dir,-dir.z);pole.normalize();
   const solvedKnee=hip.clone().addScaledVector(dir,along).addScaledVector(pole,height);aim(thigh,calf,solvedKnee);aim(calf,ankleBone,foot);
   const ankle=world(bones['foot_'+side]);aim(bones['foot_'+side],bones['ball_'+side],ankle.clone().add(new T.Vector3(0,-.07,.15)));
   aim(bones['upperarm_'+side],bones['lowerarm_'+side],elbow);aim(bones['lowerarm_'+side],bones['hand_'+side],hand);
   const handBone=bones['hand_'+side],wrist=world(handBone),fore=world(bones['lowerarm_'+side]),y=wrist.clone().sub(fore).normalize();
   let palm=new T.Vector3(0,0,1).addScaledVector(y,-y.z);if(palm.lengthSq()<.01)palm=new T.Vector3(1,0,0).addScaledVector(y,-y.x);palm.normalize();
   const x=palm.multiplyScalar(side==='r'?-1:1),z=new T.Vector3().crossVectors(x,y).normalize(),q=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));
   handBone.quaternion.copy(handBone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));
   for(const digit of ['index','middle','ring','pinky'])for(const id of ['01','02','03']){const bone=bones[digit+'_'+id+'_'+side];bone.rotateX((side==='r'?1:-1)*(id==='02'?1.05:.75));}
  }
  rig.updateMatrixWorld(true);mitt.visible=true;mitt.position.copy(world(bones.hand_l));mitt.quaternion.copy(bones.hand_l.getWorldQuaternion(new T.Quaternion()));
 }

 function frame(x,y){y=y.clone().normalize();let z=new T.Vector3().crossVectors(x,y).normalize();x=new T.Vector3().crossVectors(y,z).normalize();return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));}
 function orient(bone,target,key){const q=target.multiply(anatomy[key].frame.clone().invert()).multiply(anatomy[key].q);bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));rig.updateMatrixWorld(true);}
 function solveLimb(a,b,c,target,pole){
  rig.updateMatrixWorld(true);const root=world(a),l1=world(b).distanceTo(root),l2=world(c).distanceTo(world(b)),dir=target.clone().sub(root),distance=T.MathUtils.clamp(dir.length(),.025,l1+l2-.0001);dir.normalize();
  const along=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along*along)),bend=pole.clone().sub(root);bend.addScaledVector(dir,-bend.dot(dir));if(bend.lengthSq()<.00001)bend.set(0,0,1).addScaledVector(dir,-dir.z);bend.normalize();
  aim(a,b,root.clone().addScaledVector(dir,along).addScaledVector(bend,height));aim(b,c,root.clone().addScaledVector(dir,distance));
 }
 function poseMotion(p){lastPose=p;if(!rig)return;
  for(const r of rest){r.b.quaternion.copy(r.q);r.b.position.copy(r.p);}rig.position.set(0,0,0);rig.updateMatrixWorld(true);
  orient(bones.pelvis,frame(p.lhip.clone().sub(p.rhip),p.spine.clone().sub(p.hip)),'pelvis');
  rig.position.add(p.hip.clone().sub(world(bones.pelvis)));rig.updateMatrixWorld(true);
  orient(bones.spine_01,frame(p.ls.clone().sub(p.rs),p.neck.clone().sub(p.hip)),'torso');
  orient(bones.Head,frame(p.ls.clone().sub(p.rs),p.headTop.clone().sub(p.neck)),'head');
  for(const side of ['r','l']){
   const thigh=bones['thigh_'+side],calf=bones['calf_'+side],foot=bones['foot_'+side],ankle=p[side+'f'].clone();
   solveLimb(thigh,calf,foot,ankle,p[side+'k']);
   aim(foot,bones['ball_'+side],world(foot).add(p[side+'t'].clone().sub(p[side+'f'])));
   const upper=bones['upperarm_'+side],lower=bones['lowerarm_'+side],hand=bones['hand_'+side],shoulder=world(upper),sourceShoulder=p[side+'s'];
   const sourceLength=sourceShoulder.distanceTo(p[side+'e'])+p[side+'e'].distanceTo(p[side+'h']),length=world(upper).distanceTo(world(lower))+world(lower).distanceTo(world(hand)),ratio=length/sourceLength;
   const wrist=shoulder.clone().add(p[side+'h'].clone().sub(sourceShoulder).multiplyScalar(ratio)),elbow=shoulder.clone().add(p[side+'e'].clone().sub(sourceShoulder).multiplyScalar(ratio));
   solveLimb(upper,lower,hand,wrist,elbow);
   const finger=p[side+'i'].clone().sub(p[side+'h']).normalize(),fore=p[side+'h'].clone().sub(p[side+'e']).normalize();
   let palm=new T.Vector3().crossVectors(fore,finger);if(palm.lengthSq()<.01)palm=new T.Vector3(0,0,1);palm.normalize();
   let x=new T.Vector3().crossVectors(finger,palm).normalize();if(side==='l')x.negate();
   orient(hand,frame(x,finger),'hand_'+side);
   for(const digit of ['index','middle','ring','pinky'])for(const id of ['01','02','03']){const b=bones[digit+'_'+id+'_'+side];const grip=side==='l'?.65:p.released?.08:({index:.48,middle:.52,ring:.95,pinky:1.05}[digit]);b.rotateX((side==='r'?1:-1)*grip*(id==='02'?1.12:.72));}
   bones['thumb_01_'+side].rotateZ(side==='r'?-.35:.25);
  }
  rig.updateMatrixWorld(true);
  const hand=bones.hand_r,hy=new T.Vector3(0,1,0).transformDirection(hand.matrixWorld),hz=new T.Vector3(0,0,1).transformDirection(hand.matrixWorld),hx=new T.Vector3(1,0,0).transformDirection(hand.matrixWorld);
  gripPoint=world(bones.index_01_r).lerp(world(bones.middle_01_r),.5).addScaledVector(hy,.025).addScaledVector(hz,.029);
  if(!p.released){
   for(const [digit,offset] of [['index',-.012],['middle',.012]]){const target=gripPoint.clone().addScaledVector(hy,.014).addScaledVector(hx,offset).addScaledVector(hz,.025);solveLimb(bones[digit+'_01_r'],bones[digit+'_02_r'],bones[digit+'_03_r'],target,gripPoint.clone().addScaledVector(hz,.10));}
   solveLimb(bones.thumb_01_r,bones.thumb_02_r,bones.thumb_03_r,gripPoint.clone().addScaledVector(hz,-.028),gripPoint.clone().addScaledVector(hx,.09));
  }
  rig.updateMatrixWorld(true);mitt.visible=true;mitt.position.copy(world(bones.hand_l));mitt.quaternion.copy(bones.hand_l.getWorldQuaternion(new T.Quaternion()));
 }
 function captureAnatomy(){
  rig.updateMatrixWorld(true);const x=world(bones.thigh_l).sub(world(bones.thigh_r)),up=world(bones.neck_01||bones.Head).sub(world(bones.pelvis)),basis=frame(x,up);
  for(const [key,bone] of [['pelvis',bones.pelvis],['torso',bones.spine_01],['head',bones.Head]])anatomy[key]={frame:basis.clone(),q:bone.getWorldQuaternion(new T.Quaternion())};
  for(const side of ['r','l']){const h=bones['hand_'+side],y=world(bones['middle_01_'+side]).sub(world(h)),x=world(bones['index_01_'+side]).sub(world(bones['pinky_01_'+side]));anatomy['hand_'+side]={frame:frame(x,y),q:h.getWorldQuaternion(new T.Quaternion())};}
 }
 const ready=new GLTFLoader().loadAsync(new URL('./models/pitcher-base.glb',import.meta.url).href).then(g=>{
  if(disposed){g.scene.traverse(o=>o.geometry?.dispose());return;}
  rig=g.scene;group.add(rig);rig.traverse(o=>{if(o.isBone){bones[o.name]=o;rest.push({b:o,q:o.quaternion.clone(),p:o.position.clone()});}if(o.isMesh){uniform(o);o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
  captureAnatomy();accessories();if(lastPose)(lastPose.lhip?poseMotion:pose)(lastPose);
 });
 return {ball,ready,pose,poseMotion,handPosition(){if(!rig)return lastPose?.rh.clone()||new T.Vector3();rig.updateMatrixWorld(true);return gripPoint?.clone()||bones.hand_r.localToWorld(new T.Vector3(0,.082,.028));},dispose(){disposed=true;}};
}
