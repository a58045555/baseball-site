import * as T from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {makeCatcherMitt,makePitcherGlove} from './scene-models.js';

// Props around the pitcher: the catcher behind the plate and the pitcher's glove. Each one loads a
// modelled GLB from models/props/ when the site owner has supplied one (metadata in props.json),
// and otherwise falls back to the procedural version built here.
const base=new URL('./models/props/',import.meta.url);
let manifest=null;
async function props(){if(!manifest)manifest=fetch(new URL('props.json',base)).then(r=>r.ok?r.json():{}).catch(()=>({}));return manifest;}
const std=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.85,metalness:0,...extra});
function shadowed(o){o.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});return o;}
// Load a GLB, drop its feet on y=0, centre it on x/z and scale it to `height` metres.
async function loadModel(name,height){const g=await new GLTFLoader().loadAsync(new URL(name+'.glb',base).href);const o=g.scene;o.updateMatrixWorld(true);const box=new T.Box3().setFromObject(o);const size=box.getSize(new T.Vector3()),centre=box.getCenter(new T.Vector3());const k=height/size.y;o.scale.setScalar(k);o.position.set(-centre.x*k,-box.min.y*k,-centre.z*k);const wrap=new T.Group();wrap.add(o);return shadowed(wrap);}

// ---- catcher ----
// Faces the pitcher (toward -z). The mitt is a separate object the game aims at the target; the
// glove arm is re-solved to reach it, and the body shifts a little sideways like a real catcher.
function capsuleBetween(a,b,r,mat){const d=b.clone().sub(a),m=new T.Mesh(new T.CapsuleGeometry(r,Math.max(.01,d.length()-r*.4),6,14),mat);m.position.copy(a).lerp(b,.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;}
function proceduralCatcher(){
 const g=new T.Group(),skin=std(0xcf9a7c,{roughness:.7}),uniform=std(0xd8dadc,{roughness:.9}),gear=std(0x1d3552,{roughness:.6}),dark=std(0x22262c,{roughness:.5}),cage=std(0x9ca3ab,{roughness:.4,metalness:.6});
 const add=o=>{g.add(o);return o;};
 // legs in a crouch: thighs out to the sides, shins with guards, cleats
 for(const s of [-1,1]){const hip=new T.Vector3(s*.13,.47,.02),knee=new T.Vector3(s*.30,.44,-.16),ankle=new T.Vector3(s*.26,.09,.06);
  add(capsuleBetween(hip,knee,.085,uniform));add(capsuleBetween(knee,ankle,.07,uniform));
  const guard=capsuleBetween(knee.clone().add(new T.Vector3(0,.02,-.03)),ankle.clone().add(new T.Vector3(0,0,-.06)),.075,gear);guard.scale.x=.9;add(guard);
  const kneeCap=new T.Mesh(new T.SphereGeometry(.085,16,12),gear);kneeCap.position.copy(knee).z-=.03;add(kneeCap);
  const shoe=new T.Mesh(new T.BoxGeometry(.11,.08,.28),dark);shoe.position.set(s*.26,.04,.03);add(shoe);}
 // torso leaning forward with a chest protector, shoulders
 const hips=new T.Vector3(0,.5,.03),neck=new T.Vector3(0,.98,-.08);
 add(capsuleBetween(hips,neck,.17,uniform));
 const chest=new T.Mesh(new T.BoxGeometry(.36,.42,.1),gear);chest.position.set(0,.76,-.17);chest.rotation.x=-.2;add(chest);
 for(const s of [-1,1]){const pad=new T.Mesh(new T.SphereGeometry(.085,14,10),gear);pad.position.set(s*.21,.94,-.08);add(pad);}
 // head: hockey-style mask with a cage
 const head=new T.Mesh(new T.SphereGeometry(.115,20,16),skin);head.position.set(0,1.12,-.1);add(head);
 const helmet=new T.Mesh(new T.SphereGeometry(.125,20,16,0,Math.PI*2,0,Math.PI*.62),gear);helmet.position.copy(head.position);helmet.rotation.x=.35;add(helmet);
 for(let i=-2;i<=2;i++){const bar=new T.Mesh(new T.CylinderGeometry(.005,.005,.19,6),cage);bar.position.set(i*.03,1.10,-.215);add(bar);}
 for(let j=0;j<4;j++){const bar=new T.Mesh(new T.TorusGeometry(.085,.005,6,24,Math.PI),cage);bar.position.set(0,1.03+j*.045,-.14);bar.rotation.set(Math.PI/2,0,Math.PI);add(bar);}
 // throwing arm tucked behind the right knee
 add(capsuleBetween(new T.Vector3(-.2,.92,-.08),new T.Vector3(-.32,.66,-.02),.055,uniform));add(capsuleBetween(new T.Vector3(-.32,.66,-.02),new T.Vector3(-.3,.46,-.18),.045,skin));
 // glove arm: two capsules re-solved toward the mitt
 const shoulder=new T.Vector3(.2,.92,-.08),upper=add(new T.Mesh(new T.CapsuleGeometry(.055,.24,6,14),uniform)),fore=add(new T.Mesh(new T.CapsuleGeometry(.045,.22,6,14),skin));
 const place=(m,a,b,r)=>{const d=b.clone().sub(a);m.geometry.dispose();m.geometry=new T.CapsuleGeometry(r,Math.max(.01,d.length()-r*.4),6,14);m.position.copy(a).lerp(b,.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());};
 g.userData.reach=function(wristLocal){const l1=.3,l2=.3,dir=wristLocal.clone().sub(shoulder),dist=T.MathUtils.clamp(dir.length(),.05,l1+l2-.001);dir.normalize();const along=(l1*l1-l2*l2+dist*dist)/(2*dist),h=Math.sqrt(Math.max(0,l1*l1-along*along));let bend=new T.Vector3(.35,-.6,.3);bend.addScaledVector(dir,-bend.dot(dir)).normalize();const elbow=shoulder.clone().addScaledVector(dir,along).addScaledVector(bend,h);place(upper,shoulder,elbow,.055);place(fore,elbow,wristLocal,.045);};
 g.userData.reach(new T.Vector3(.12,.8,-.5));
 return shadowed(g);
}
export async function createCatcher(){const meta=(await props()).catcher;if(meta){try{const o=await loadModel('catcher',meta.height||1.1);o.userData.mittOffset=new T.Vector3(...(meta.mitt||[0,.8,-.4]));o.userData.modelled=true;return o;}catch(e){console.warn('捕手模型載入失敗，改用內建捕手',e);}}return proceduralCatcher();}

// ---- the pitcher's glove ----
// Returned with the cuff at the origin, fingers along +y and the pocket facing +z, so player.js can
// hang it on the hand without caring where it came from.
export async function createGlove(){const meta=(await props()).glove;if(meta){try{const o=await loadModel('glove',meta.length||.33);const inner=o.children[0];if(meta.rotation)inner.rotation.set(...meta.rotation);if(meta.offset)o.position.set(...meta.offset);return o;}catch(e){console.warn('手套模型載入失敗，改用內建手套',e);}}const g=makePitcherGlove();g.scale.set(1.3,1.25,1.5);return g;}
export {makeCatcherMitt};
