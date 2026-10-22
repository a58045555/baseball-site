import * as T from './vendor/three.module.min.js';

// A small ballpark built around the pitcher's rubber: regulation distances, a real mound profile,
// infield skin, foul lines, outfield wall, stands, light towers, a gradient sky that also serves
// as the environment map, and broadcast-style camera presets. Shared by the pitcher showcase and
// the 3D playground. +z runs from the rubber to home plate, +x is the pitcher's glove side.
export const MOUND_HEIGHT=.254,PLATE_DISTANCE=18.44,BASE=27.43;

function canvasTexture(size,draw,{repeat=1,srgb=true}={}){const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const t=new T.CanvasTexture(c);if(srgb)t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=8;return t;}
function noise(ctx,size,count,alpha,dark=true){for(let i=0;i<count;i++){const v=Math.random();ctx.fillStyle=dark?`rgba(0,0,0,${alpha*v})`:`rgba(255,255,255,${alpha*v})`;ctx.fillRect(Math.random()*size,Math.random()*size,2+Math.random()*5,2+Math.random()*5);}}
function grassTexture(){return canvasTexture(1024,(x,s)=>{x.fillStyle='#3d6d33';x.fillRect(0,0,s,s);
 // mowing pattern: light and dark bands both ways, as groundskeepers cut it
 for(let i=0;i<8;i++){x.fillStyle=i%2?'rgba(255,255,255,.055)':'rgba(0,0,0,.055)';x.fillRect(i*s/8,0,s/8,s);}
 for(let i=0;i<8;i++){x.fillStyle=i%2?'rgba(255,255,255,.03)':'rgba(0,0,0,.03)';x.fillRect(0,i*s/8,s,s/8);}
 noise(x,s,9000,.10);noise(x,s,5000,.06,false);},{repeat:1});}
function dirtTexture(){return canvasTexture(512,(x,s)=>{x.fillStyle='#a3754f';x.fillRect(0,0,s,s);noise(x,s,6000,.14);noise(x,s,3000,.07,false);},{repeat:1});}
function crowdTexture(){return canvasTexture(512,(x,s)=>{x.fillStyle='#35506e';x.fillRect(0,0,s,s);
 // one tile is 8 m of stand: five rows of 16 seats, most of them taken, in jersey and jacket colours
 const palette=['#e8e4d8','#c9463f','#20355a','#e9d08c','#3f6b4e','#f3f1ea','#2a2a33','#d3873a','#8d9db2','#b9c7d6','#6b4a3a'];
 for(let row=0;row<8;row++)for(let col=0;col<24;col++){const px=col*21.3+(row%2)*10+2,py=row*64;if(Math.random()<.16)continue;const c=palette[(Math.random()*palette.length)|0];x.fillStyle=c;x.globalAlpha=.62;x.fillRect(px+2,py+22,15,32);x.fillStyle='#d2a38a';x.beginPath();x.arc(px+9.5,py+17,6,0,Math.PI*2);x.fill();x.globalAlpha=1;}
 for(let row=0;row<8;row++){x.fillStyle='rgba(0,0,0,.3)';x.fillRect(0,row*64+54,s,10);}
 },{repeat:1});}
function glowTexture(){return canvasTexture(128,(x,s)=>{const g=x.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);g.addColorStop(0,'rgba(255,244,214,1)');g.addColorStop(.25,'rgba(255,236,190,.55)');g.addColorStop(1,'rgba(255,230,180,0)');x.fillStyle=g;x.fillRect(0,0,s,s);});}

const SKY={top:new T.Color(0x1e4f86),mid:new T.Color(0x7fb2dc),horizon:new T.Color(0xf1dcb6)};
function skyMaterial(){return new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:SKY.top},mid:{value:SKY.mid},horizon:{value:SKY.horizon},sun:{value:new T.Vector3(-.45,.32,.83).normalize()}},
 vertexShader:'varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:'uniform vec3 top,mid,horizon,sun;varying vec3 vDir;void main(){float h=clamp(vDir.y,0.,1.);vec3 c=mix(horizon,mid,smoothstep(0.,.18,h));c=mix(c,top,smoothstep(.18,.8,h));float s=max(dot(normalize(vDir),sun),0.);c+=vec3(1.,.9,.7)*pow(s,350.)*2.5+vec3(1.,.85,.6)*pow(s,8.)*.25;if(vDir.y<0.)c=mix(horizon,vec3(.33,.45,.3),clamp(-vDir.y*6.,0.,1.));gl_FragColor=vec4(c,1.);}'});}

export function createBallpark(scene,renderer,{rubberZ=0,quality='high'}={}){
 const park=new T.Group();park.name='ballpark';scene.add(park);
 const plateZ=rubberZ+PLATE_DISTANCE,moundZ=rubberZ+.46;const plate=new T.Vector3(0,0,plateZ);
 const disposables=[];const keep=o=>{disposables.push(o);return o;};
 const std=(opts)=>keep(new T.MeshStandardMaterial({roughness:1,metalness:0,...opts}));
 const mesh=(geo,mat,parent=park)=>{const m=new T.Mesh(keep(geo),mat);parent.add(m);return m;};

 // sky and environment
 const skyMat=keep(skyMaterial());const sky=mesh(new T.SphereGeometry(420,40,20),skyMat);sky.position.set(0,-20,plateZ-10);
 scene.background=null;scene.fog=keep(new T.Fog(SKY.horizon.clone().lerp(SKY.mid,.35),90,380));
 if(renderer){const pm=new T.PMREMGenerator(renderer);const envScene=new T.Scene();envScene.add(new T.Mesh(new T.SphereGeometry(50,24,12),skyMat.clone()));const env=pm.fromScene(envScene,.05);scene.environment=env.texture;disposables.push(env,pm);}

 // ground: grass everywhere, then the infield skin on top
 const grassTex=keep(grassTexture());grassTex.repeat.set(16,16);
 const grass=mesh(new T.PlaneGeometry(300,300),std({map:grassTex,color:0xb9c9a8}));grass.rotation.x=-Math.PI/2;grass.position.set(0,0,plateZ-60);grass.receiveShadow=true;
 const dirtTex=keep(dirtTexture());dirtTex.repeat.set(10,10);const dirt=std({map:dirtTex,color:0xc9ab8a});
 const flat=(shape,mat,y)=>{const m=mesh(new T.ShapeGeometry(shape,24),mat);m.rotation.x=-Math.PI/2;m.position.y=y;m.receiveShadow=true;return m;};
 // shape coordinates are (x, -z): the plane is rotated -90° about x
 {// infield skin: the 29 m arc around the rubber, cut by the foul lines, with the grass diamond as a hole
  const s=new T.Shape(),R=29,n=56;
  // where the arc meets the foul lines (t metres from the plate along a line at 45°): t² − √2·D·t + D² − R² = 0
  const D=PLATE_DISTANCE,t=(Math.SQRT2*D+Math.sqrt(2*D*D-4*(D*D-R*R)))/2,ex=t/Math.SQRT2,ez=plateZ-t/Math.SQRT2,A=Math.atan2(ex,rubberZ-ez);
  s.moveTo(-ex,-ez);for(let i=0;i<=n;i++){const a=-A+i/n*2*A;s.lineTo(Math.sin(a)*R,-(rubberZ-Math.cos(a)*R));}
  s.lineTo(ex,-ez);s.lineTo(0,-(plateZ+2.2));s.closePath();
  const hole=new T.Path(),cz=plateZ-BASE/Math.SQRT2,h=BASE/Math.SQRT2-1.4;hole.moveTo(0,-(cz+h));hole.lineTo(h,-cz);hole.lineTo(0,-(cz-h));hole.lineTo(-h,-cz);hole.closePath();s.holes.push(hole);
  flat(s,dirt,.004);
 }
 {const circle=new T.Shape().absarc(0,-plateZ,4.0,0,Math.PI*2);flat(circle,dirt,.006);}
 // mound: table top with a gentle slope, the rubber 46 cm behind its centre
 {const pts=[];for(let i=28;i>=0;i--){const r=i/28*2.9,h=r<1.6?MOUND_HEIGHT:MOUND_HEIGHT*Math.max(0,1-((r-1.6)/1.3)**2);pts.push(new T.Vector2(r,h));}const m=mesh(new T.LatheGeometry(pts,72),std({map:dirtTex,color:0xb89b7c}));m.position.set(0,0,moundZ);m.receiveShadow=true;m.castShadow=false;}
 const rubber=mesh(new T.BoxGeometry(.61,.03,.152),std({color:0xf2ede0,roughness:.9}));rubber.position.set(0,MOUND_HEIGHT+.012,rubberZ+.076);
 // chalk: foul lines, batter's boxes, catcher's box, home plate, bases
 const chalk=std({color:0xf6f3ea,roughness:1});
 for(const sign of [-1,1]){const L=108;const line=mesh(new T.PlaneGeometry(.1,L),chalk);line.rotation.x=-Math.PI/2;line.rotation.z=sign*Math.PI/4;line.position.set(sign*L/2/Math.SQRT2,.012,plateZ-L/2/Math.SQRT2);
  const edge=(w,h,x,z)=>{const o=mesh(new T.PlaneGeometry(w,h),chalk);o.rotation.x=-Math.PI/2;o.position.set(x,.011,z);};
  const cx=sign*(.74+.61);edge(.08,1.83,cx-sign*.61,plateZ);edge(.08,1.83,cx+sign*.61,plateZ);edge(1.22,.08,cx,plateZ-.915);edge(1.22,.08,cx,plateZ+.915);}
 {const edge=(w,h,x,z)=>{const o=mesh(new T.PlaneGeometry(w,h),chalk);o.rotation.x=-Math.PI/2;o.position.set(x,.011,z);};edge(.08,2.9,-1.1,plateZ+2.4);edge(.08,2.9,1.1,plateZ+2.4);edge(2.28,.08,0,plateZ+3.85);}
 {const s=new T.Shape();s.moveTo(-.216,.216);s.lineTo(.216,.216);s.lineTo(.216,0);s.lineTo(0,-.216);s.lineTo(-.216,0);s.closePath();const m=mesh(new T.ShapeGeometry(s),chalk);m.rotation.x=-Math.PI/2;m.position.set(0,.014,plateZ);}
 for(const [x,z] of [[BASE/Math.SQRT2,plateZ-BASE/Math.SQRT2],[-BASE/Math.SQRT2,plateZ-BASE/Math.SQRT2],[0,plateZ-2*BASE/Math.SQRT2]]){const b=mesh(new T.BoxGeometry(.38,.08,.38),chalk);b.position.set(x,.04,z);b.rotation.y=Math.PI/4;b.castShadow=true;}

 // outfield wall and stands, centred on home plate
 const wallR=102,span=Math.PI/2+.5;
 const wallMat=std({color:0x1e5a46,roughness:.9});
 const wall=mesh(new T.CylinderGeometry(wallR,wallR,2.6,96,1,true,Math.PI-span/2,span),wallMat);wall.position.set(0,1.3,plateZ);wall.material.side=T.DoubleSide;
 const yellow=mesh(new T.CylinderGeometry(wallR+.02,wallR+.02,.12,96,1,true,Math.PI-span/2,span),std({color:0xf4d457,roughness:.7}));yellow.position.set(0,2.6,plateZ);yellow.material.side=T.DoubleSide;
 const crowdBase=keep(crowdTexture());const crowd=(r,arc)=>{const t=crowdBase.clone();t.repeat.set(Math.round(r*arc/8),1);t.needsUpdate=true;return keep(t);};
 for(let tier=0;tier<2;tier++){const r0=wallR+4+tier*11,h=4.2;const seats=mesh(new T.CylinderGeometry(r0+10,r0,h,96,1,true,Math.PI-span/2,span),std({map:crowd(r0+5,span),color:0x9aa1a8,roughness:1}));seats.position.set(0,3.2+tier*5.2+h/2,plateZ);seats.material.side=T.DoubleSide;const band=mesh(new T.CylinderGeometry(r0+10.2,r0+10.2,1.1,96,1,true,Math.PI-span/2,span),std({color:0x24413a}));band.position.set(0,3.2+tier*5.2+h+.5,plateZ);band.material.side=T.DoubleSide;}
 // behind the plate: lower bowl wrapping around home
 const homeSpan=Math.PI*.9;
 const screen=mesh(new T.CylinderGeometry(18,18,.03,64,1,true,-homeSpan/2,homeSpan),std({color:0xfff6e0,transparent:true,opacity:.06}));screen.visible=false;
 for(let tier=0;tier<4;tier++){const r0=23+tier*6,h=3.0;const seats=mesh(new T.CylinderGeometry(r0+6,r0,h,64,1,true,-homeSpan/2,homeSpan),std({map:crowd(r0+3,homeSpan),color:0x9aa1a8,roughness:1}));seats.position.set(0,1.2+tier*3.0+h/2,plateZ);seats.material.side=T.DoubleSide;}
 const facade=mesh(new T.CylinderGeometry(23,23,1.3,64,1,true,-homeSpan/2,homeSpan),std({color:0x2b4a3f}));facade.position.set(0,.65,plateZ);facade.material.side=T.DoubleSide;
 // backstop netting posts
 for(let i=-4;i<=4;i++){const a=i/4*homeSpan/2;const post=mesh(new T.CylinderGeometry(.04,.04,8,6),std({color:0x5c6b63}));post.position.set(Math.sin(a)*21.5,4,plateZ+Math.cos(a)*21.5);}

 // light towers with lamp banks and a soft glow
 const glow=keep(glowTexture());const glowMat=keep(new T.SpriteMaterial({map:glow,transparent:true,depthWrite:false,blending:T.AdditiveBlending,opacity:.9}));
 const towers=[[-62,plateZ-78],[62,plateZ-78],[-34,plateZ+22],[34,plateZ+22]];
 for(const [x,z] of towers){const pole=mesh(new T.CylinderGeometry(.5,.9,42,8),std({color:0x6c7b77}));pole.position.set(x,21,z);const bank=mesh(new T.BoxGeometry(7,3.2,.6),std({color:0xfff2d2,emissive:0xffe9bf,emissiveIntensity:1.6}));bank.position.set(x,42,z);bank.lookAt(0,20,plateZ-9);const s=new T.Sprite(glowMat);s.scale.set(16,16,1);s.position.set(x,42,z);park.add(s);}

 // lighting: late-afternoon sun from the first-base side, cool sky fill, a rim from behind
 const hemi=new T.HemisphereLight(0xd6e8ff,0x5f6e3b,1.5);park.add(hemi);
 const sun=new T.DirectionalLight(0xffe4bf,3.0);sun.position.set(-26,34,plateZ-4);sun.target.position.set(0,0,rubberZ+6);park.add(sun,sun.target);
 sun.castShadow=true;const sm=quality==='high'?2048:1024;sun.shadow.mapSize.set(sm,sm);Object.assign(sun.shadow.camera,{left:-7,right:7,top:24,bottom:-6,near:1,far:120});sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.00025;sun.shadow.normalBias=.012;sun.shadow.radius=2;
 const rim=new T.DirectionalLight(0xbcd8ff,1.1);rim.position.set(14,12,rubberZ-30);rim.target.position.set(0,1,rubberZ);park.add(rim,rim.target);
 const fill=new T.DirectionalLight(0xfff4e2,.55);fill.position.set(20,6,plateZ+10);fill.target.position.set(0,1,rubberZ);park.add(fill,fill.target);

 // broadcast-style camera presets
 const cameras={
  broadcast:{position:new T.Vector3(2.2,4.3,rubberZ-14),look:new T.Vector3(.05,1.2,rubberZ+6.5),fov:20,name:'轉播'},
  front:{position:new T.Vector3(.6,2.0,plateZ+3.5),look:new T.Vector3(0,1.15,rubberZ+1.2),fov:16,name:'本壘後'},
  side:{position:new T.Vector3(9.5,1.9,rubberZ+4.2),look:new T.Vector3(0,1.05,rubberZ+1.2),fov:26,name:'一壘側'},
  high:{position:new T.Vector3(0,16,plateZ+26),look:new T.Vector3(0,0,rubberZ+8),fov:30,name:'高空'},
  close:{position:new T.Vector3(2.6,1.7,rubberZ+3.6),look:new T.Vector3(0,1.1,rubberZ+.9),fov:30,name:'近看'}
 };
 function aimCamera(camera,preset){const c=typeof preset==='string'?cameras[preset]:preset;camera.position.copy(c.position);camera.lookAt(c.look);camera.fov=c.fov;camera.near=.05;camera.far=600;camera.updateProjectionMatrix();}

 return {group:park,plate,plateZ,rubberZ,moundZ,moundTop:MOUND_HEIGHT,cameras,aimCamera,sun,
  dispose(){scene.remove(park);scene.environment=null;scene.fog=null;for(const d of disposables)d.dispose?.();}};
}
