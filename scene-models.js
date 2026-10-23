import * as T from './vendor/three.module.min.js';

const v=(x,y,z)=>new T.Vector3(x,y,z);
const material=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.88,...extra});
function tube(points,radius,mat,closed=false){return new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points,closed),Math.max(12,points.length*2),radius,5,closed),mat);}

// A catcher's mitt has a padded round edge and a recessed pocket, not four fingers.
export function makeCatcherMitt(){
 const group=new T.Group(),leather=material(0x9f6236),edge=material(0xbb854d),inside=material(0x613920,{side:T.DoubleSide}),lace=material(0xe0b779),dark=material(0x3c2419);
 const shape=(a,r=1)=>{const radius=.205*(1+.08*Math.cos(2*a)+.075*Math.cos(a+.4));return v(Math.cos(a)*radius*r,Math.sin(a)*radius*1.04*r,.095*(1-r*r));};
 const positions=[],uv=[],index=[],rings=18,slices=80;
 for(let j=0;j<=rings;j++)for(let i=0;i<=slices;i++){const p=shape(i/slices*Math.PI*2,j/rings);positions.push(p.x,p.y,p.z);uv.push(i/slices,j/rings);}
 for(let j=0;j<rings;j++)for(let i=0;i<slices;i++){const a=j*(slices+1)+i,b=a+slices+1;index.push(a,b,a+1,a+1,b,b+1);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(index);geo.computeVertexNormals();group.add(new T.Mesh(geo,inside));
 const backGeometry=geo.clone(),backPositions=backGeometry.getAttribute('position');for(let i=0;i<backPositions.count;i++)backPositions.setZ(i,backPositions.getZ(i)+.018);backGeometry.computeVertexNormals();const backing=new T.Mesh(backGeometry,new T.MeshStandardMaterial({color:0x9f6236,roughness:.88,side:T.DoubleSide}));group.add(backing);
 const rimPoints=Array.from({length:80},(_,i)=>shape(i/80*Math.PI*2));group.add(tube(rimPoints,.027,edge,true));
 const welt=Array.from({length:80},(_,i)=>shape(i/80*Math.PI*2,.82));group.add(tube(welt,.008,leather,true));
 for(let i=0;i<56;i++){const a=i/56*Math.PI*2,p=shape(a,.96),q=shape(a+.045,.85);p.z-=.017;q.z-=.013;group.add(tube([p,p.clone().lerp(q,.5).add(v(0,0,-.008)),q],.0027,lace));}
 // A separate thumb roll and a closed woven web join the rounded catching surface.
 const thumb=new T.Mesh(new T.CapsuleGeometry(.036,.16,5,12),edge);thumb.position.set(-.158,-.005,.012);thumb.rotation.z=-.37;group.add(thumb);
 const web=new T.Group();web.position.set(-.025,.126,.011);web.rotation.z=-.22;
 for(let i=0;i<5;i++){const strip=new T.Mesh(new T.BoxGeometry(.015,.096,.008),i%2?edge:leather);strip.position.set((i-2)*.023,0,-.007);web.add(strip);}
 for(let i=0;i<4;i++){const strip=new T.Mesh(new T.BoxGeometry(.112,.009,.009),lace);strip.position.set(0,(i-1.5)*.023,-.014);web.add(strip);}group.add(web);
 for(let i=0;i<3;i++){const a=-2.6+i*.65;const points=Array.from({length:12},(_,j)=>{const p=shape(a+j*.07,.56);p.z-=.001;return p;});group.add(tube(points,.0018,dark));}
 const cuff=new T.Mesh(new T.TorusGeometry(.066,.014,8,32),leather);cuff.scale.set(1.12,.67,1);cuff.position.set(.015,-.235,.07);group.add(cuff);
 group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});return group;
}

export function createAirflow(){
 const group=new T.Group(),lines=new T.Group();group.add(lines);const paths=[],smokeMaterials=[],count=18,dots=new T.InstancedMesh(new T.SphereGeometry(.022,6,5),new T.MeshBasicMaterial({color:0xe3ffff,transparent:true,opacity:.55,depthWrite:false}),count*3),dummy=new T.Object3D();group.add(dots);let phase=0,time=0,current='';
 function rebuild(kind){const key=Array.isArray(kind)?kind.join(','):kind;if(key===current)return;current=key;while(lines.children.length){const o=lines.children[0];o.traverse(child=>{child.geometry?.dispose();child.material?.dispose();});lines.remove(o);}paths.length=0;smokeMaterials.length=0;const axis=Array.isArray(kind)?v(...kind):{back:v(-1,0,0),top:v(1,0,0),side:v(0,1,0),none:v(0,0,0)}[kind]||v(0,0,0),wake=axis.clone().cross(v(0,0,-1));
  function velocity(p){const r=Math.max(1.04,p.length()),r3=1/(r*r*r),u=v(0,0,-1),dot=u.dot(p);u.multiplyScalar(1+.5*r3).addScaledVector(p,-1.5*dot/(r*r*r*r*r));u.add(axis.clone().cross(p).multiplyScalar(.18*r3));if(p.z<-.8)u.addScaledVector(wake,Math.min(.32,(-p.z-.8)*.12));return u;}
  for(let i=0;i<count;i++){let p=v((i%3-1)*.20,-1.8+i/(count-1)*3.6,3.3);const points=[p.clone()];for(let j=0;j<460&&p.z>-3.3;j++){const a=velocity(p),b=velocity(p.clone().addScaledVector(a,.025));p=p.clone().addScaledVector(b,.05);if(p.length()<1.055)p.normalize().multiplyScalar(1.055);points.push(p.clone());}const curve=new T.CatmullRomCurve3(points);paths.push(curve);
   const smoke=new T.ShaderMaterial({uniforms:{uTime:{value:time},uOffset:{value:i*.19},uColor:{value:new T.Color(i%4===0?0x92edff:0xefffff)}},transparent:true,depthWrite:false,vertexShader:'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform float uTime; uniform float uOffset; uniform vec3 uColor; varying vec2 vUv; void main(){float pulse=0.5+0.5*sin(vUv.x*43.0-uTime*4.4+uOffset);float wisp=0.7+0.3*sin(vUv.x*91.0-uTime*2.1+uOffset);float alpha=(0.20+0.52*pow(pulse,2.0))*wisp;gl_FragColor=vec4(uColor,alpha);}'});smokeMaterials.push(smoke);
   const ribbon=new T.Mesh(new T.TubeGeometry(curve,180,.012,5,false),smoke);ribbon.userData.airStream=true;lines.add(ribbon);
   const halo=new T.Mesh(new T.TubeGeometry(curve,140,.028,5,false),new T.MeshBasicMaterial({color:0xc0f6ff,transparent:true,opacity:.065,depthWrite:false}));halo.userData.airStream=true;lines.add(halo);
  }
 }
 rebuild('none');return {group,setSpin:rebuild,tick(dt){time+=dt;phase=(phase+dt*.12)%1;smokeMaterials.forEach(m=>m.uniforms.uTime.value=time);for(let i=0;i<count;i++)for(let j=0;j<3;j++){const t=(phase+j/3+i*.071)%1;dummy.position.copy(paths[i].getPointAt(t));dummy.quaternion.setFromUnitVectors(v(0,0,1),paths[i].getTangentAt(t));dummy.scale.set(1.1,1.1,4.5);dummy.updateMatrix();dots.setMatrixAt(i*3+j,dummy.matrix);}dots.instanceMatrix.needsUpdate=true;}};
}

function textSprite(text,color='#e3e9cf'){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const c=canvas.getContext('2d');c.fillStyle='rgba(15,45,41,.85)';c.beginPath();c.roundRect(8,12,496,104,20);c.fill();c.fillStyle=color;c.font='600 44px "Microsoft JhengHei",sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,256,65);const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;const sprite=new T.Sprite(new T.SpriteMaterial({map:tex,depthTest:true,depthWrite:false,transparent:true}));sprite.scale.set(1.3,.325,1);return sprite;}
export function addDistanceMarks(field){for(const z of [0,5,10,16.5]){const line=new T.Line(new T.BufferGeometry().setFromPoints([v(-1.3,.025,z),v(1.3,.025,z)]),new T.LineBasicMaterial({color:0xdbe3bd,transparent:true,opacity:.6}));field.add(line);const sprite=textSprite(z===0?'放球點':z===16.5?'手套 16.5 m':z+' m');sprite.position.set(1.95,.19,z);field.add(sprite);}}

export function createAimGuide(field,world){
 const root=new T.Group(),path=new T.Line(new T.BufferGeometry(),new T.LineDashedMaterial({color:0x66e0ed,dashSize:.14,gapSize:.10,transparent:true,opacity:.48}));root.add(path);field.add(root);
 const mark=document.createElement('div');mark.className='aim-reticle';mark.innerHTML='<i></i><span>預測落點</span>';mark.setAttribute('aria-hidden','true');world.append(mark);
 const goalMark=document.createElement('div');goalMark.className='glove-reticle';goalMark.innerHTML='<i></i><span>手套</span>';goalMark.setAttribute('aria-hidden','true');world.append(goalMark);
 let point=v(0,.9,16.5),target=v(0,.95,16.5),enabled=false;
 return {setVisible(show){enabled=show;root.visible=show;mark.hidden=goalMark.hidden=!show;},update(flight,goal){point.set(flight.end.x,flight.end.y,flight.end.z);target.set(goal.x,goal.y,16.48);mark.querySelector('span').textContent=flight.end.z<16.49?'先碰地':'預測落點';path.geometry.dispose();path.geometry=new T.BufferGeometry().setFromPoints(flight.points.filter((_,i)=>i%4===0).map(p=>v(p.x,p.y,p.z)));path.computeLineDistances();},frame(camera,width,height,showPath=true){root.visible=enabled&&showPath;for(const [element,p] of [[mark,point],[goalMark,target]]){const q=p.clone().project(camera);element.hidden=!enabled||q.z< -1||q.z>1||Math.abs(q.x)>1.2||Math.abs(q.y)>1.2;element.style.left=(q.x*.5+.5)*width+'px';element.style.top=(-q.y*.5+.5)*height+'px';}}};
}

// A fielder's glove: four padded fingers, separate thumb, woven web and open pocket.
export function makePitcherGlove(){
 const g=new T.Group(),leather=material(0x6d3d25),edge=material(0xb17b49),palm=material(0x8f5834,{side:T.DoubleSide}),lace=material(0xd6b17a),dark=material(0x432619);
 function mesh(geo,mat,parent=g){const o=new T.Mesh(geo,mat);parent.add(o);return o;}
 const positions=[],ids=[],rings=12,slices=48;
 for(let j=0;j<=rings;j++)for(let i=0;i<=slices;i++){const r=j/rings,a=i/slices*Math.PI*2;positions.push(Math.cos(a)*.109*r,.115+Math.sin(a)*.126*r,-.034*(1-r*r));}
 for(let j=0;j<rings;j++)for(let i=0;i<slices;i++){const a=j*(slices+1)+i,b=a+slices+1;ids.push(a,a+1,b,a+1,b+1,b);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(ids);geo.computeVertexNormals();mesh(geo,palm);
 const rim=Array.from({length:48},(_,i)=>v(Math.cos(i/48*Math.PI*2)*.11,.115+Math.sin(i/48*Math.PI*2)*.126,0));g.add(tube(rim,.011,edge,true));
 for(let i=0;i<4;i++){
  const x=(i-1.5)*.047,top=[.301,.323,.308,.271][i],path=[v(x,.16,-.006),v(x*1.13,.23,.016),v(x*1.2,top-.015,.05),v(x*1.2,top,.068)];
  g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(path),20,.025,10,false),leather));
  g.add(tube(path.map(p=>p.clone().add(v(0,0,.023))),.003,edge));
  for(let j=0;j<4;j++){const y=.21+j*.022;g.add(tube([v(x-.018,y,.031),v(x+.018,y+.006,.034)],.0025,lace));}
 }
 const thumb=[v(-.075,.04,.006),v(-.138,.096,.028),v(-.17,.161,.069),v(-.161,.207,.09)];g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(thumb),22,.033,12,false),leather));g.add(tube(thumb.map(p=>p.clone().add(v(0,0,.028))),.004,edge));
 for(let i=0;i<5;i++){const t=i/4;g.add(tube([v(-.158,.15+t*.052,.073),v(-.108,.18+t*.064,.025),v(-.066,.215+t*.06,.042)],.005,i%2?edge:leather));}
 for(let i=0;i<4;i++){const x=-.146+i*.023;g.add(tube([v(x,.166,.055),v(x+.015,.247,.048)],.004,lace));}
 const cuff=mesh(new T.TorusGeometry(.045,.009,8,32),edge);cuff.scale.set(1,.7,1);cuff.position.set(0,.015,-.014);
 const patch=mesh(new T.BoxGeometry(.05,.028,.006),dark);patch.position.set(.04,.085,-.054);
 for(let i=0;i<25;i++){const a=i/25*Math.PI*2;g.add(tube([v(Math.cos(a)*.107,.115+Math.sin(a)*.12,.007),v(Math.cos(a)*.093,.115+Math.sin(a)*.108,.012)],.002,lace));}
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});return g;
}
