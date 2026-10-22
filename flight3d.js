(function(root){
'use strict';
// SI units. x: catcher's right, y: up, z: toward home plate.
const constants=Object.freeze({mass:.145,radius:.0366,density:1.225,gravity:9.81,distance:16.5,dragCoefficient:.35});
const axes={back:[-1,0,0],top:[1,0,0],side:[0,1,0],none:[0,0,0]};
function acceleration(v,omega,opts={}){const speed=Math.hypot(...v),k=.5*constants.density*Math.PI*constants.radius**2/constants.mass,drag=opts.drag===false?0:k*constants.dragCoefficient*speed;
 const cross=[omega[1]*v[2]-omega[2]*v[1],omega[2]*v[0]-omega[0]*v[2],omega[0]*v[1]-omega[1]*v[0]],crossLength=Math.hypot(...cross),s=speed?constants.radius*crossLength/(speed*speed):0;
 // SHS piecewise empirical approximation. Transverse spin determines lift.
 const cl=s<.1?1.5*s:.09+.6*s,scale=crossLength&&opts.lift!==false?k*Math.min(.45,cl)*speed*speed/crossLength:0;
 return v.map((a,i)=>-drag*a+scale*cross[i]-(i===1?(opts.gravity===false?0:constants.gravity):0));
}
function simulate(opts={}){const speed=Math.max(40,Math.min(180,opts.speed??130))/3.6,e=(opts.elevation??-1.7)*Math.PI/180,a=(opts.yaw??0)*Math.PI/180,rpm=Math.max(0,Math.min(3600,opts.rpm??2200)),axis=opts.axis||axes[opts.spin||'back']||axes.back,len=Math.hypot(...axis)||1,omega=axis.map(x=>x/len*rpm*Math.PI/30),dt=opts.dt||1/720;
 let s=[0,opts.height??1.8,0,speed*Math.cos(e)*Math.sin(a),speed*Math.sin(e),speed*Math.cos(e)*Math.cos(a)],t=0;const sample=()=>({x:s[0],y:s[1],z:s[2],vx:s[3],vy:s[4],vz:s[5],t}),points=[sample()];
 const derivative=v=>[v[3],v[4],v[5],...acceleration(v.slice(3),omega,opts)],add=(v,d,h)=>v.map((x,i)=>x+d[i]*h);
 for(let i=0;i<3000;i++){const old=s.slice(),oldT=t,k1=derivative(s),k2=derivative(add(s,k1,dt/2)),k3=derivative(add(s,k2,dt/2)),k4=derivative(add(s,k3,dt));s=s.map((x,j)=>x+dt*(k1[j]+2*k2[j]+2*k3[j]+k4[j])/6);t+=dt;
 if(s[2]>=constants.distance||s[1]<=constants.radius){const f=Math.min(s[2]>=constants.distance?(constants.distance-old[2])/(s[2]-old[2]):1,s[1]<=constants.radius?(old[1]-constants.radius)/(old[1]-s[1]):1);s=s.map((x,j)=>old[j]+(x-old[j])*f);t=oldT+dt*f;points.push(sample());break;}points.push(sample());}
 return {points,omega,rpm,options:{...opts},end:points[points.length-1]};
}
function sample(flight,t){const p=flight.points;if(t<=0)return p[0];if(t>=flight.end.t)return flight.end;let a=0,b=p.length-1;while(b-a>1){const m=(a+b)>>1;p[m].t<t?a=m:b=m;}const f=(t-p[a].t)/(p[b].t-p[a].t);return Object.fromEntries(Object.keys(p[a]).map(k=>[k,p[a][k]+(p[b][k]-p[a][k])*f]));}
function hit(end,target){return end.z>=constants.distance-1e-6&&Math.hypot(end.x-target.x,end.y-target.y)<=target.radius;}
const api={constants,axes,acceleration,simulate,sample,hit};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BaseballFlight3D=api;
})(typeof window!=='undefined'?window:globalThis);
