import * as T from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {makePitcherGlove} from './scene-models.js';

// Athlete built from CC0 MakeHuman/MPFB2 data by tools/build-pitcher.mjs: realistic body,
// game-engine rig, and separately modelled jersey, pants, shoes and hair. Bones rest with
// identity rotation, so a bone's local axes equal the world axes of the rest pose.
const NAVY=0x16303f,RED=0xa8402f;
function canvasTexture(draw,size=512){const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;}
function numberTexture(){return canvasTexture((x,s)=>{x.clearRect(0,0,s,s);x.textAlign='center';x.textBaseline='middle';x.font='900 300px "Arial Black",Impact,sans-serif';x.lineJoin='round';x.lineWidth=34;x.strokeStyle='#a8402f';x.strokeText('17',s/2,s/2+14);x.fillStyle='#16303f';x.fillText('17',s/2,s/2+14);});}
function logoTexture(){return canvasTexture((x,s)=>{x.clearRect(0,0,s,s);x.textAlign='center';x.textBaseline='middle';x.font='900 420px Georgia,serif';x.lineJoin='round';x.lineWidth=46;x.strokeStyle='#a8402f';x.strokeText('B',s/2,s/2+24);x.fillStyle='#f4ead2';x.fillText('B',s/2,s/2+24);},512);}
function irisTexture(){return canvasTexture((x,s)=>{x.fillStyle='#f3efe8';x.fillRect(0,0,s,s);const c=s/2,g=x.createRadialGradient(c,c,0,c,c,s*.2);g.addColorStop(0,'#120c08');g.addColorStop(.38,'#120c08');g.addColorStop(.42,'#4a2e1b');g.addColorStop(.8,'#6b4528');g.addColorStop(1,'#2a1a10');x.fillStyle=g;x.beginPath();x.arc(c,c,s*.2,0,Math.PI*2);x.fill();x.fillStyle='rgba(255,255,255,.85)';x.beginPath();x.arc(c-s*.05,c-s*.06,s*.03,0,Math.PI*2);x.fill();},256);}

// Shader patch: per-vertex trim coordinates (baked by the build script) give crisp
// piping, belt, socks and undershirt lines that move with the cloth.
function patch(m,key,uniforms,vertexVars,fragment){
 m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,uniforms);
  sh.vertexShader=vertexVars.map(([type,name])=>`attribute ${type} _${name};\nvarying ${type} v_${name};\n`).join('')+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n'+vertexVars.map(([,n])=>` v_${n}=_${n};`).join('\n'));
  sh.fragmentShader=vertexVars.map(([type,name])=>`varying ${type} v_${name};\n`).join('')+Object.keys(uniforms).map(u=>`uniform ${uniforms[u].type||'sampler2D'} ${u};\n`).join('')+'float band(float x,float a,float b){float w=fwidth(x)*.75+1e-5;return smoothstep(a-w,a+w,x)*(1.-smoothstep(b-w,b+w,x));}\n'+sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+fragment);
 };
 m.customProgramCacheKey=()=>key;return m;
}
const GLSL_NAVY='vec3(.035,.085,.13)',GLSL_RED='vec3(.48,.07,.045)';
export function createPitcherModel(scene){
 const group=new T.Group();scene.add(group);let rig,bones={},rest=[],lastPose,disposed=false,anatomy={},gripPoint,fit,curl={};
 const std=(color,roughness=.8,extra={})=>new T.MeshStandardMaterial({color,roughness,...extra});
 const white=std(0xf1eee2),red=std(0xb74835),navy=std(NAVY,.75);
 const ball=new T.Mesh(new T.SphereGeometry(.037,24,16),white);group.add(ball);ball.castShadow=true;
 for(let side=0;side<2;side++){const pts=[];for(let i=0;i<=96;i++){const a=i/96*Math.PI*2,theta=.95+.27*Math.cos(2*a),phi=a+side*Math.PI;pts.push(new T.Vector3(.0372*Math.sin(theta)*Math.cos(phi),.0372*Math.cos(theta)*(side?1:-1),.0372*Math.sin(theta)*Math.sin(phi)));}ball.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts,true),96,.0011,4,true),red));}
 const mitt=makePitcherGlove();group.add(mitt);mitt.visible=false;
 const world=o=>o.getWorldPosition(new T.Vector3());
 const v3=a=>new T.Vector3(...a);
 function surface(geo,material,parent){const o=new T.Mesh(geo,material);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
 // Rest-pose world placement under a bone (bones have identity rest rotation).
 function attachRest(bone,object,position){bone.add(object);object.position.copy(v3(position).sub(world(bone)));return object;}

 function capButton(){const b=surface(new T.SphereGeometry(.008,16,10),std(NAVY,.8),bones.head);b.scale.y=.6;b.position.copy(v3(fit.capTop).sub(world(bones.head)));}
 function eyes(){
  const m=new T.MeshPhysicalMaterial({map:irisTexture(),roughness:.15,clearcoat:1,clearcoatRoughness:.04});
  for(const s of ['l','r']){
   const r=fit.eyes.radius*.97,geo=new T.SphereGeometry(r,32,24),p=geo.attributes.position,uv=geo.attributes.uv;
   // planar map seen from the front: the iris sits on the forward pole
   for(let i=0;i<p.count;i++)uv.setXY(i,p.getZ(i)>0?p.getX(i)/r*.5+.5:0,p.getZ(i)>0?p.getY(i)/r*.5+.5:0);
   const e=surface(geo,m,bones.head);e.castShadow=false;e.position.copy(v3(fit.eyes[s]).sub(world(bones.head)));e.rotation.y=(s==='l'?-1:1)*.06;
  }
 }
 function materials(o){
  o.geometry.computeVertexNormals();const t=fit.trim,f=(x)=>x.toFixed(4);
  if(o.name==='Body'){
   const e=fit.eyes.l,mo=fit.mouth;
   o.material=patch(new T.MeshPhysicalMaterial({color:0xd99a78,roughness:.6,sheen:.4,sheenColor:new T.Color(0xff8f70),sheenRoughness:.55}),'skin',{},[['vec3','trim']],
    `if(v_trim.x>50.){vec3 r=vec3(v_trim.x-100.,v_trim.y,v_trim.z);float ax=abs(r.x),front=smoothstep(${f(fit.head.front-.075)},${f(fit.head.front-.05)},r.z);vec3 c=diffuseColor.rgb;
      float ex=ax-${f(Math.abs(e[0]))},by=${f(e[1]+.019)}+.0048*exp(-pow((ex+.004)/.017,2.))-.0045*smoothstep(.004,.03,ex),th=.0034*(1.-.45*smoothstep(-.006,.028,ex));
      float brow=(1.-smoothstep(th*.55,th,abs(r.y-by)))*smoothstep(.0075,.012,ax)*(1.-smoothstep(.021,.027,ex))*front;
      c=mix(c,vec3(.07,.045,.03),brow*.9);
      float dy=r.y-${f(mo.y-.004)},w=.0225;
      float up=1.-smoothstep(.8,1.,pow(ax/w,2.)+pow((dy-.0042)/.0046,2.)),lo=1.-smoothstep(.8,1.,pow(ax/(w*.86),2.)+pow((dy+.0050)/.0058,2.));
      float lip=max(up,lo)*smoothstep(${f(mo.z-.02)},${f(mo.z-.012)},r.z);c=mix(c,vec3(.62,.30,.26),lip*.55);
      c=mix(c,vec3(.25,.10,.08),(1.-smoothstep(.0004,.0011,abs(dy)))*(1.-smoothstep(w*.75,w*.95,ax))*lip*.8);
      float cheek=exp(-pow(length(vec2(ax-.045,r.y-${f(e[1]-.034)}))/.02,2.));c=mix(c,vec3(.78,.42,.33),cheek*.18*front);
      diffuseColor.rgb=c;}
     else{float a=v_trim.x,l=v_trim.y;
     float under=band(a,${f(t.sleeve-.1)},${f(t.cuff)});diffuseColor.rgb=mix(diffuseColor.rgb,${GLSL_NAVY},under);
     float sock=band(l,${f(t.pants-.1)},3.);vec3 s=${GLSL_NAVY};s=mix(s,${GLSL_RED},band(l,1.565,1.60)+band(l,1.63,1.665));diffuseColor.rgb=mix(diffuseColor.rgb,s,sock);}`);
  }else if(o.name==='Jersey'){
   o.material=patch(new T.MeshStandardMaterial({color:0xf3f0e7,roughness:.92,side:T.DoubleSide}),'jersey',{numberMap:{value:numberTexture()}},[['vec3','trim'],['vec3','rest']],
    `{float sl=v_trim.x,co=v_trim.y,x=v_trim.z;vec3 c=diffuseColor.rgb;
     c=mix(c,${GLSL_NAVY},band(sl,-.02,.010));c=mix(c,${GLSL_RED},band(sl,.010,.016));
     c=mix(c,${GLSL_NAVY},band(co,-.012,.02));c=mix(c,${GLSL_RED},band(co,-.018,-.012));
     bool front=v_rest.z>${f(fit.spineZ)};
     if(front){c=mix(c,${GLSL_NAVY},band(abs(x),.016,.020)*step(co,-.012));
      float yb=mod(v_rest.y-${f(fit.neckY)}+.04,.078);float d=length(vec2(x,yb-.039));c=mix(c,vec3(.86,.84,.78)*.85,1.-smoothstep(.0045,.0058,d));
      vec2 uv=vec2((x-.095)/.10+.5,(v_rest.y-${f(fit.neckY-.13)})/.10+.5);if(all(greaterThan(uv,vec2(0)))&&all(lessThan(uv,vec2(1)))){vec4 n=texture2D(numberMap,uv);c=mix(c,n.rgb,n.a);}}
     else{vec2 uv=vec2(-x/.30+.5,(v_rest.y-${f(fit.neckY-.20)})/.30+.5);if(v_rest.z<${f(fit.spineZ-.02)}&&all(greaterThan(uv,vec2(0)))&&all(lessThan(uv,vec2(1)))){vec4 n=texture2D(numberMap,uv);c=mix(c,n.rgb,n.a);}}
     diffuseColor.rgb=c;}`);
  }else if(o.name==='Pants'){
   o.material=patch(new T.MeshStandardMaterial({color:0xecE8dd,roughness:.93,side:T.DoubleSide}),'pants',{},[['vec3','trim']],
    `{float hem=v_trim.x,belt=v_trim.y,x=v_trim.z;vec3 c=diffuseColor.rgb;
     float b=band(belt,-.01,.034);c=mix(c,${GLSL_NAVY}*.8,b);
     float buckle=band(abs(x),-.1,.024)*band(belt,.003,.031);c=mix(c,vec3(.72,.70,.64),buckle);
     c*=1.-.12*band(hem,-.02,.012);diffuseColor.rgb=c;}`);
  }else if(o.name==='Shoes'){
   o.material=patch(new T.MeshStandardMaterial({color:0x14181d,roughness:.5}),'shoes',{},[['vec3','trim']],
    `{float y=v_trim.x;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.92,.91,.87),1.-smoothstep(.019,.023,y));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.66,.12,.08),band(y,.028,.034));}`);
  }else if(o.name==='Cap'||o.name==='Brim'){
   const c=fit.head.center;
   o.material=patch(new T.MeshStandardMaterial({color:NAVY,roughness:.86,side:T.DoubleSide}),'cap'+o.name,{logoMap:{value:logoTexture()}},[['vec3','rest']],
    o.name==='Brim'?'':`{vec3 r=v_rest-vec3(${f(c[0])},${f(c[1])},${f(c[2])});float a=atan(r.x,r.z);float s=abs(fract(a/1.0472+.5)-.5)*1.0472*length(r.xz);vec3 col=diffuseColor.rgb*(1.-.45*(1.-smoothstep(.0008,.0022,s))*step(-.02,r.y));
     vec2 uv=vec2(r.x/.052+.5,(r.y-.018)/.052+.5);if(r.z>0.&&all(greaterThan(uv,vec2(0)))&&all(lessThan(uv,vec2(1)))){vec4 l=texture2D(logoMap,uv);col=mix(col,l.rgb,l.a);}diffuseColor.rgb=col;}`);
  }else if(o.name==='Hair'){o.material=std(0x221912,.95);}
 }
 // Aim a bone in world space, preserving its length and skin weights.
 function aim(bone,child,target){
  rig.updateMatrixWorld(true);const a=world(bone),from=world(child).sub(a).normalize(),to=target.clone().sub(a).normalize();
  const delta=new T.Quaternion().setFromUnitVectors(from,to),q=bone.getWorldQuaternion(new T.Quaternion()).premultiply(delta),parent=bone.parent.getWorldQuaternion(new T.Quaternion()).invert();bone.quaternion.copy(parent.multiply(q));
 }
 function frame(x,y){y=y.clone().normalize();let z=new T.Vector3().crossVectors(x,y).normalize();x=new T.Vector3().crossVectors(y,z).normalize();return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));}
 function orient(bone,target,key){const q=target.multiply(anatomy[key].frame.clone().invert()).multiply(anatomy[key].q);bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));rig.updateMatrixWorld(true);}
 function solveLimb(a,b,c,target,pole){
  rig.updateMatrixWorld(true);const root=world(a),l1=world(b).distanceTo(root),l2=world(c).distanceTo(world(b)),dir=target.clone().sub(root),distance=T.MathUtils.clamp(dir.length(),.025,l1+l2-.0001);dir.normalize();
  const along=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along*along)),bend=pole.clone().sub(root);bend.addScaledVector(dir,-bend.dot(dir));if(bend.lengthSq()<.00001)bend.set(0,0,1).addScaledVector(dir,-dir.z);bend.normalize();
  aim(a,b,root.clone().addScaledVector(dir,along).addScaledVector(bend,height));aim(b,c,root.clone().addScaledVector(dir,distance));
 }
 // Curl a finger joint toward the palm about its rest knuckle axis.
 function bend(bone,angle,side){bone.quaternion.multiply(new T.Quaternion().setFromAxisAngle(curl[side],angle));}
 function handAxes(side){const h=world(bones['hand_'+side]),y=world(bones['middle_01_'+side]).sub(h).normalize(),across=world(bones['index_01_'+side]).sub(world(bones['pinky_01_'+side])).normalize(),palm=new T.Vector3().crossVectors(across,y).normalize();if(side==='l')palm.negate();return {y,across,palm};}
 function poseMotion(p){lastPose=p;if(!rig)return;
  for(const r of rest){r.b.quaternion.copy(r.q);r.b.position.copy(r.p);}rig.position.set(0,0,0);rig.updateMatrixWorld(true);
  orient(bones.pelvis,frame(p.lhip.clone().sub(p.rhip),p.spine.clone().sub(p.hip)),'pelvis');
  rig.position.add(p.hip.clone().sub(world(bones.pelvis)));rig.updateMatrixWorld(true);
  // share the trunk twist across three spine bones instead of folding at one joint
  const chestFrame=frame(p.ls.clone().sub(p.rs),p.neck.clone().sub(p.hip)),pelvisQ=bones.pelvis.getWorldQuaternion(new T.Quaternion());
  const chestQ=chestFrame.clone().multiply(anatomy.torso.frame.clone().invert()).multiply(anatomy.torso.q);
  for(const [name,t] of [['spine_01',.4],['spine_02',.7],['spine_03',1]]){const b=bones[name],q=pelvisQ.clone().multiply(anatomy.pelvis.q.clone().invert()).multiply(anatomy[name].q).slerp(chestQ.clone().multiply(anatomy.torso.q.clone().invert()).multiply(anatomy[name].q),t);b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));rig.updateMatrixWorld(true);}
  const headFrame=frame(p.ls.clone().sub(p.rs),p.headTop.clone().sub(p.neck)),headQ=headFrame.multiply(anatomy.head.frame.clone().invert()).multiply(anatomy.head.q),neckQ=bones.spine_03.getWorldQuaternion(new T.Quaternion()).multiply(anatomy.spine_03.q.clone().invert()).multiply(anatomy.neck_01.q).slerp(headQ.clone().multiply(anatomy.head.q.clone().invert()).multiply(anatomy.neck_01.q),.5);
  bones.neck_01.quaternion.copy(bones.neck_01.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(neckQ));rig.updateMatrixWorld(true);
  bones.head.quaternion.copy(bones.head.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(headQ));rig.updateMatrixWorld(true);
  // Legs with ground contact: planted soles rest on the floor and no sole goes through it.
  // When a planted leg cannot reach the floor, the hips settle a little lower instead.
  const legs=()=>{let short=0;for(const side of ['r','l']){
   const thigh=bones['thigh_'+side],calf=bones['calf_'+side],foot=bones['foot_'+side],ankle=p[side+'f'].clone();
   const plant=1-T.MathUtils.smoothstep(p[side+'t'].y,.035,.07);let lift=0,low=0;
   for(let pass=0;pass<3;pass++){
    solveLimb(thigh,calf,foot,ankle.clone().setY(ankle.y+lift),p[side+'k']);
    aim(foot,bones['ball_'+side],world(foot).add(p[side+'t'].clone().sub(p[side+'f'])));
    low=soleLow(side);if(Math.abs(low)<.002)break;lift+=low<0?-low:-low*plant;
   }
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
   // share the wrist's twist with the forearm so the skin does not pinch like a candy wrapper
   const axis=hand.position.clone().normalize(),q=hand.quaternion,d=axis.dot(new T.Vector3(q.x,q.y,q.z)),twist=new T.Quaternion(axis.x*d,axis.y*d,axis.z*d,q.w).normalize(),part=new T.Quaternion().slerp(twist,.6);
   lower.quaternion.multiply(part);hand.quaternion.premultiply(part.clone().invert());rig.updateMatrixWorld(true);
   for(const digit of ['index','middle','ring','pinky'])for(const id of ['01','02','03']){const grip=side==='l'?.55:p.released?.12:({index:.3,middle:.3,ring:1.05,pinky:1.15}[digit]);bend(bones[digit+'_'+id+'_'+side],grip*(id==='01'?.75:id==='02'?1.15:.8),side);}
   bend(bones['thumb_02_'+side],side==='r'&&!p.released?.5:.25,side);
  }
  rig.updateMatrixWorld(true);
  const {y:hy,across:hx,palm:hz}=handAxes('r');
  // Four-seam grip: ball on the pads of index and middle finger, thumb underneath, ring and pinky tucked.
  const R=.037,knuckle=world(bones.index_01_r).lerp(world(bones.middle_01_r),.5);
  gripPoint=knuckle.clone().addScaledVector(hy,.046).addScaledVector(hz,.042);
  if(!p.released){
   for(const [digit,offset] of [['index',.012],['middle',-.010]]){const c=gripPoint.clone().addScaledVector(hx,offset),target=c.clone().addScaledVector(hy.clone().multiplyScalar(.62).addScaledVector(hz,-.78).normalize(),R+.007);solveLimb(bones[digit+'_01_r'],bones[digit+'_02_r'],bones[digit+'_03_r'],target,c.clone().addScaledVector(hz,-.12));bend(bones[digit+'_03_r'],.55,'r');}
   solveLimb(bones.thumb_01_r,bones.thumb_02_r,bones.thumb_03_r,gripPoint.clone().addScaledVector(hz.clone().multiplyScalar(.85).addScaledVector(hy,-.3).addScaledVector(hx,.25).normalize(),R+.006),gripPoint.clone().addScaledVector(hx,.12).addScaledVector(hy,-.04));
  }
  rig.updateMatrixWorld(true);
  const l=handAxes('l');mitt.visible=true;mitt.position.copy(world(bones.hand_l)).addScaledVector(l.palm,.01);
  mitt.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(l.across.clone().negate(),l.y,new T.Vector3().crossVectors(l.across.clone().negate(),l.y)));
 }
 let shoes,soles={l:[],r:[]};const tmp=new T.Vector3();
 function soleLow(side){if(!shoes)return 0;rig.updateMatrixWorld(true);shoes.skeleton.update();let y=Infinity;for(const i of soles[side]){tmp.fromBufferAttribute(shoes.geometry.attributes.position,i);shoes.applyBoneTransform(i,tmp);tmp.applyMatrix4(shoes.matrixWorld);y=Math.min(y,tmp.y);}return y;}
 function captureAnatomy(){
  rig.updateMatrixWorld(true);const x=world(bones.thigh_l).sub(world(bones.thigh_r)),up=world(bones.neck_01).sub(world(bones.pelvis)),basis=frame(x,up);
  for(const [key,bone] of [['pelvis',bones.pelvis],['torso',bones.spine_03],['head',bones.head],['spine_01',bones.spine_01],['spine_02',bones.spine_02],['spine_03',bones.spine_03],['neck_01',bones.neck_01]])anatomy[key]={frame:basis.clone(),q:bone.getWorldQuaternion(new T.Quaternion())};
  for(const side of ['r','l']){
   const h=bones['hand_'+side],y=world(bones['middle_01_'+side]).sub(world(h)),x=world(bones['index_01_'+side]).sub(world(bones['pinky_01_'+side]));anatomy['hand_'+side]={frame:frame(x,y),q:h.getWorldQuaternion(new T.Quaternion())};
   // knuckle axis chosen so positive angles bend fingers toward the palm
   const {y:fy,across,palm}=handAxes(side);const axis=across.clone();const test=fy.clone().applyAxisAngle(axis,.2);if(test.sub(fy).dot(palm)<0)axis.negate();curl[side]=axis;
  }
 }
 const ready=new GLTFLoader().loadAsync(new URL('./models/pitcher-athlete.glb',import.meta.url).href).then(g=>{
  if(disposed){g.scene.traverse(o=>o.geometry?.dispose());return;}
  rig=g.scene;fit=g.userData?.fit||g.scene.userData.fit;group.add(rig);
  rig.traverse(o=>{if(o.isBone){bones[o.name]=o;rest.push({b:o,q:o.quaternion.clone(),p:o.position.clone()});}if(o.isMesh){materials(o);o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
  rig.traverse(o=>{if(o.name==='Shoes'&&o.isSkinnedMesh)shoes=o;});
  if(shoes){const p=shoes.geometry.attributes.position;for(let i=0;i<p.count;i++)if(p.getY(i)<.0)soles[p.getX(i)>0?'l':'r'].push(i);for(const k of ['l','r'])soles[k]=soles[k].filter((_,j)=>j%3===0);}
  captureAnatomy();capButton();eyes();if(lastPose)poseMotion(lastPose);
 });
 // Mocap legs are longer than this athlete's: scale the capture about the floor so planted feet reach the ground.
 function motionScale(frame){if(!rig)return 1;const d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]),source=['l','r'].reduce((s,k)=>s+d(frame[k+'hip'],frame[k+'k'])+d(frame[k+'k'],frame[k+'f']),0)/2,leg=world(bones.thigh_l).distanceTo(world(bones.calf_l))+world(bones.calf_l).distanceTo(world(bones.foot_l));return leg/source;}
 return {ball,ready,pose:poseMotion,poseMotion,motionScale,handPosition(){if(!rig)return lastPose?.rh.clone()||new T.Vector3();rig.updateMatrixWorld(true);return gripPoint?.clone()||world(bones.hand_r);},dispose(){disposed=true;}};
}
