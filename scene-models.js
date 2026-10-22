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

export function createAirflow({ribbon=.012,halo=.028,dot=.022}={}){
 const group=new T.Group(),lines=new T.Group();group.add(lines);const paths=[],smokeMaterials=[],count=18,dots=new T.InstancedMesh(new T.SphereGeometry(dot,6,5),new T.MeshBasicMaterial({color:0xe3ffff,transparent:true,opacity:.55,depthWrite:false}),count*3),dummy=new T.Object3D();group.add(dots);let phase=0,time=0,current='';
 function rebuild(kind){const key=Array.isArray(kind)?kind.join(','):kind;if(key===current)return;current=key;while(lines.children.length){const o=lines.children[0];o.traverse(child=>{child.geometry?.dispose();child.material?.dispose();});lines.remove(o);}paths.length=0;smokeMaterials.length=0;const axis=Array.isArray(kind)?v(...kind):{back:v(-1,0,0),top:v(1,0,0),side:v(0,1,0),none:v(0,0,0)}[kind]||v(0,0,0),wake=axis.clone().cross(v(0,0,-1));
  function velocity(p){const r=Math.max(1.04,p.length()),r3=1/(r*r*r),u=v(0,0,-1),dot=u.dot(p);u.multiplyScalar(1+.5*r3).addScaledVector(p,-1.5*dot/(r*r*r*r*r));u.add(axis.clone().cross(p).multiplyScalar(.18*r3));if(p.z<-.8)u.addScaledVector(wake,Math.min(.32,(-p.z-.8)*.12));return u;}
  for(let i=0;i<count;i++){let p=v((i%3-1)*.20,-1.8+i/(count-1)*3.6,3.3);const points=[p.clone()];for(let j=0;j<460&&p.z>-3.3;j++){const a=velocity(p),b=velocity(p.clone().addScaledVector(a,.025));p=p.clone().addScaledVector(b,.05);if(p.length()<1.055)p.normalize().multiplyScalar(1.055);points.push(p.clone());}const curve=new T.CatmullRomCurve3(points);paths.push(curve);
   const smoke=new T.ShaderMaterial({uniforms:{uTime:{value:time},uOffset:{value:i*.19},uColor:{value:new T.Color(i%4===0?0x92edff:0xefffff)}},transparent:true,depthWrite:false,vertexShader:'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform float uTime; uniform float uOffset; uniform vec3 uColor; varying vec2 vUv; void main(){float pulse=0.5+0.5*sin(vUv.x*43.0-uTime*4.4+uOffset);float wisp=0.7+0.3*sin(vUv.x*91.0-uTime*2.1+uOffset);float alpha=(0.20+0.52*pow(pulse,2.0))*wisp;gl_FragColor=vec4(uColor,alpha);}'});smokeMaterials.push(smoke);
   const ribbonMesh=new T.Mesh(new T.TubeGeometry(curve,180,ribbon,5,false),smoke);ribbonMesh.userData.airStream=true;lines.add(ribbonMesh);
   const haloMesh=new T.Mesh(new T.TubeGeometry(curve,140,halo,5,false),new T.MeshBasicMaterial({color:0xc0f6ff,transparent:true,opacity:.065,depthWrite:false}));haloMesh.userData.airStream=true;lines.add(haloMesh);
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
// Pitcher's glove in hand space: +y toward the fingertips, +z the pocket (palm) side,
// thumb on -x. Padded finger stalls fused into a cupped palm, closed basket web,
// rawhide lacing and a wrist strap.
export function makePitcherGlove(){
 const g=new T.Group(),leather=new T.MeshPhysicalMaterial({color:0x8d5130,roughness:.55,clearcoat:.25,clearcoatRoughness:.5}),back=new T.MeshPhysicalMaterial({color:0x6e3b1f,roughness:.6,clearcoat:.2,clearcoatRoughness:.5}),lace=material(0xc99a62,{roughness:.7}),dark=material(0x3a2216),pocket=material(0x5b311a,{roughness:.8});
 const mesh=(geo,mat)=>{const o=new T.Mesh(geo,mat);g.add(o);return o;};
 // palm and back: an ellipsoid with a pressed-in pocket on the palm side
 const body=new T.SphereGeometry(1,48,32),p=body.attributes.position;
 for(let i=0;i<p.count;i++){let x=p.getX(i)*.066,y=p.getY(i)*.105+.105,z=p.getZ(i)*.034;if(z>0){z-=.026*Math.exp(-(((x+.005)/.05)**2)-(((y-.14)/.075)**2))*(p.getZ(i));}p.setXYZ(i,x,y,z);}
 body.computeVertexNormals();mesh(body,leather);
 // finger stalls: fat, slightly flattened tubes that touch each other and curl into the pocket
 const stalls=[[-.039,.275],[-.012,.292],[.015,.282],[.041,.252]];
 const paths=stalls.map(([x,top])=>new T.CatmullRomCurve3([v(x*.9,.10,-.004),v(x*1.03,.17,.0),v(x*1.1,top-.05,.016),v(x*1.12,top-.012,.04),v(x*1.1,top+.002,.062)]));
 const stallGeo=(curve,r)=>{const geo=new T.TubeGeometry(curve,32,r,18,false),q=geo.attributes.position;
  // flatten each stall front-to-back
  const pts=curve.getSpacedPoints(32);for(let i=0;i<q.count;i++){const c=pts[Math.floor(i/19)],d=new T.Vector3(q.getX(i),q.getY(i),q.getZ(i)).sub(c);q.setXYZ(i,c.x+d.x*1.08,c.y+d.y,c.z+d.z*.78);}
  geo.computeVertexNormals();return geo;};
 for(const curve of paths){mesh(stallGeo(curve,.0175),back);const cap=mesh(new T.SphereGeometry(.0175,18,12),back);cap.position.copy(curve.getPoint(1));cap.scale.set(1.08,1,.78);
  // welting seam down the back of each stall
  g.add(tube(curve.getSpacedPoints(12).slice(1).map(q=>q.clone().add(v(0,0,-.0145))),.0022,dark));}
 // thumb stall
 const thumb=new T.CatmullRomCurve3([v(-.045,.03,.004),v(-.078,.09,.016),v(-.092,.155,.04),v(-.086,.205,.066),v(-.075,.222,.08)]);
 mesh(stallGeo(thumb,.019),back);const tcap=mesh(new T.SphereGeometry(.019,18,12),back);tcap.position.copy(thumb.getPoint(1));tcap.scale.set(1.08,1,.78);
 // closed basket web between thumb and index stall
 const weave=document.createElement('canvas');weave.width=weave.height=128;const wx=weave.getContext('2d');wx.fillStyle='#6a3a1e';wx.fillRect(0,0,128,128);
 for(let i=0;i<4;i++)for(let j=0;j<4;j++){wx.fillStyle=(i+j)%2?'#8f5532':'#a8683d';wx.fillRect(i*32+2,j*32+2,28,28);wx.fillStyle='rgba(0,0,0,.25)';wx.fillRect(i*32+2,j*32+(i+j)%2*24+2,28,4);}
 const weaveMap=new T.CanvasTexture(weave);weaveMap.colorSpace=T.SRGBColorSpace;weaveMap.wrapS=weaveMap.wrapT=T.RepeatWrapping;weaveMap.repeat.set(2,3);
 const webPos=[],webUv=[],webIdx=[],U=10,W=8;
 for(let j=0;j<=W;j++)for(let i=0;i<=U;i++){const t=.42+.58*i/U,a=thumb.getPoint(t),b=paths[0].getPoint(.25+.75*i/U),q=a.clone().lerp(b,j/W);q.z+=.012*Math.sin(Math.PI*j/W);webPos.push(q.x,q.y,q.z);webUv.push(j/W,i/U);}
 for(let j=0;j<W;j++)for(let i=0;i<U;i++){const a=j*(U+1)+i,b=a+U+1;webIdx.push(a,b,a+1,a+1,b,b+1);}
 const web=new T.BufferGeometry();web.setAttribute('position',new T.Float32BufferAttribute(webPos,3));web.setAttribute('uv',new T.Float32BufferAttribute(webUv,2));web.setIndex(webIdx);web.computeVertexNormals();
 mesh(web,new T.MeshStandardMaterial({map:weaveMap,roughness:.7,side:T.DoubleSide}));
 // rawhide lacing tying the stall tips together and running across the top of the web
 for(let i=0;i<3;i++){const a=paths[i].getPoint(.86),b=paths[i+1].getPoint(.86);for(let k=0;k<2;k++){const y=k*.016;g.add(tube([a.clone().add(v(0,-y,.006)),a.clone().lerp(b,.5).add(v(0,-y+.004,.024)),b.clone().add(v(0,-y,.006))],.0024,lace));}}
 for(let i=0;i<=8;i++){const a=thumb.getPoint(.45+.55*i/8),b=paths[0].getPoint(.3+.7*i/8);g.add(tube([a,a.clone().lerp(b,.5).add(v(0,.004,.016)),b],.0021,lace));}
 // heel roll along the bottom of the pocket, darker pocket leather, strap with patch on the back
 const pad=mesh(new T.SphereGeometry(1,24,16),pocket);pad.scale.set(.042,.055,.006);pad.position.set(-.004,.135,.012);
 const strap=mesh(new T.CapsuleGeometry(.011,.05,6,12),back);strap.rotation.z=Math.PI/2;strap.scale.set(1,1,.5);strap.position.set(.004,.04,-.028);
 const patch=mesh(new T.BoxGeometry(.034,.018,.004),dark);patch.position.set(.012,.04,-.034);
 g.scale.setScalar(.88);g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});return g;
}
// Detailed baseball (unit radius): leather texture, cover groove, raised red stitches with punctures.
export function leatherTexture(){const cvs=document.createElement('canvas');cvs.width=cvs.height=512;const c=cvs.getContext('2d');c.fillStyle='#e3dac3';c.fillRect(0,0,512,512);let seed=91;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)|0)>>>0)/4294967296;for(let i=0;i<42000;i++){const x=random()*512,y=random()*512,r=.2+random()*.75;c.fillStyle=`rgba(${random()>.5?'255,253,237':'86,72,50'},${.05+random()*.12})`;c.beginPath();c.ellipse(x,y,r,r*.65,random()*6,0,Math.PI*2);c.fill();}const tex=new T.CanvasTexture(cvs);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(3,2);tex.colorSpace=T.SRGBColorSpace;return tex;}
export function makeBall(){const group=new T.Group(),tex=leatherTexture(),skin=new T.MeshStandardMaterial({color:0xfff5dc,map:tex,bumpMap:tex,bumpScale:.014,roughness:.79,metalness:0}),sphere=new T.Mesh(new T.SphereGeometry(1,64,48),skin);sphere.castShadow=true;sphere.receiveShadow=true;group.add(sphere);
 // This closed unit-sphere curve forms the two interlocking cover panels.
 const pts=Array.from({length:385},(_,i)=>{const t=i/384*Math.PI*2;return new T.Vector3(Math.cos(t)**3,Math.sin(t)**3,Math.sqrt(3)*Math.sin(t)*Math.cos(t));}),curve=new T.CatmullRomCurve3(pts.slice(0,-1),true,'centripetal');
 const groove=new T.Mesh(new T.TubeGeometry(curve,512,.007,4,true),new T.MeshStandardMaterial({color:0x8b7156,roughness:1}));group.add(groove);
 const threadMaterial=new T.MeshStandardMaterial({color:0xb32b27,roughness:.67}),segments=[],holes=[];
 for(let i=0;i<108;i++){const t=(i+.5)/108,p=curve.getPointAt(t).normalize(),tan=curve.getTangentAt(t).normalize(),side=new T.Vector3().crossVectors(p,tan).normalize();for(const sign of [-1,1]){const ends=[];for(let j=0;j<=5;j++){const f=j/5,offset=(f-.5)*.064,along=sign*(f-.5)*.027;const point=p.clone().addScaledVector(side,offset).addScaledVector(tan,along).normalize().multiplyScalar(1.003+Math.sin(f*Math.PI)*.012);ends.push(point);}for(let j=0;j<5;j++)segments.push([ends[j],ends[j+1]]);holes.push(ends[0].clone().multiplyScalar(.997),ends[5].clone().multiplyScalar(.997));}}
 const threads=new T.InstancedMesh(new T.CylinderGeometry(.0035,.0035,1,5),threadMaterial,segments.length),dummy=new T.Object3D(),up=new T.Vector3(0,1,0);segments.forEach(([a,b],i)=>{dummy.position.copy(a).add(b).multiplyScalar(.5);const d=b.clone().sub(a);dummy.quaternion.setFromUnitVectors(up,d.clone().normalize());dummy.scale.set(1,d.length(),1);dummy.updateMatrix();threads.setMatrixAt(i,dummy.matrix);});threads.userData.seam=true;threads.castShadow=true;group.add(threads);
 const punctures=new T.InstancedMesh(new T.SphereGeometry(.006,5,4),new T.MeshStandardMaterial({color:0x8a6650,roughness:1}),holes.length);holes.forEach((p,i)=>{dummy.position.copy(p);dummy.quaternion.identity();dummy.scale.setScalar(1);dummy.updateMatrix();punctures.setMatrixAt(i,dummy.matrix);});group.add(punctures);group.rotation.z=Math.PI/4;group.userData.thread=threadMaterial;return group;}
