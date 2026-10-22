(function(global){
'use strict';
function trajectory(kind='back',angle=-1,speed=140){const v0=speed/3.6,a=angle*Math.PI/180,k=.5*1.225*Math.PI*.0366**2/.145,dt=.001;let x=0,y=1.8,z=0,vx=v0*Math.cos(a),vy=v0*Math.sin(a),vz=0,t=0;const points=[{x,y,z,t}];for(let i=0;i<1600;i++){const old={x,y,z,t},v=Math.hypot(vx,vy,vz),drag=k*.35*v,lift=kind==='none'?0:k*.17*v*v;vx-=drag*vx*dt;vy+=(-9.81-drag*vy+(kind==='back'?lift:kind==='top'?-lift:0))*dt;vz+=(-drag*vz+(kind==='side'?lift:0))*dt;x+=vx*dt;y+=vy*dt;z+=vz*dt;t+=dt;if(x>=16.5||y<=0){const f=Math.min(x>=16.5?(16.5-old.x)/(x-old.x):1,y<=0?old.y/(old.y-y):1);x=old.x+(x-old.x)*f;y=old.y+(y-old.y)*f;z=old.z+(z-old.z)*f;t=old.t+(t-old.t)*f;}if(y<1e-10)y=0;points.push({x,y:Math.max(0,y),z,t});if(x>=16.5-1e-7||y<=0)break;}return points;}
function sample(points,t){if(t<=0)return points[0];if(t>=points[points.length-1].t)return points[points.length-1];let lo=0,hi=points.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(points[m].t<t)lo=m;else hi=m;}const a=points[lo],b=points[hi],f=(t-a.t)/(b.t-a.t);return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,z:a.z+(b.z-a.z)*f,t};}
function travelTime(kmh,distance=16.5){return distance/(kmh/3.6);}
const api={trajectory,sample,travelTime};if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.BaseballPhysics=api;
})(typeof window!=='undefined'?window:globalThis);
