// Representative teaching axes, not a unique axis or league average for each pitch.
// World flight direction is +Z; handedness mirrors angular velocity as an axial vector.
export const pitchSpins=[
 {id:'four',name:'四縫線直球',short:'直球',rotation:'後旋',axis:[-1,0,0],rpm:2400,copy:'縫線往後翻，旋轉力讓球掉得少一些；球仍然受到重力。'},
 {id:'sinker',name:'二縫線／伸卡球',short:'伸卡球',rotation:'傾斜的後旋',axis:[-.72,-.68,.14],rpm:2100,copy:'後旋加上側向分量，常往投手持球手那側跑。縫線造成的尾流也可能改變球路。'},
 {id:'cutter',name:'卡特球',short:'卡特球',rotation:'後旋混合陀螺旋',axis:[-.56,.22,.80],rpm:2400,copy:'旋轉軸朝飛行方向傾斜，常帶一些往手套那側的切動。'},
 {id:'curve',name:'曲球',short:'曲球',rotation:'前旋',axis:[1,0,0],rpm:2600,copy:'縫線往前翻。這裡示範上下彎的曲球；也有人投出軸向傾斜的曲球。'},
 {id:'slider',name:'滑球',short:'滑球',rotation:'陀螺旋較多的混合旋轉',axis:[.22,.22,.95],rpm:2500,copy:'像子彈沿飛行方向旋轉，再混一些前旋或側旋。不同滑球的比例差很多。'},
 {id:'sweeper',name:'橫掃球',short:'橫掃球',rotation:'側旋較多的混合旋轉',axis:[.20,.92,.34],rpm:2700,copy:'側向的旋轉分量較多，常往手套那側橫掃；也可能混有陀螺旋。'},
 {id:'change',name:'變速球',short:'變速球',rotation:'傾斜後旋，常較慢',axis:[-.63,-.70,.33],rpm:1500,copy:'通常比直球慢，也常轉得較慢。常見方向是往持球手那側偏，握法與旋轉有很多變化。'},
 {id:'split',name:'指叉／快速指叉球',short:'指叉球',rotation:'常見較低轉速的後旋',axis:[-.95,-.22,.20],rpm:1100,copy:'這裡示範較少的後旋。掉得多不代表一定是前旋；有些投手的指叉也帶較多陀螺旋。'},
 {id:'knuckle',name:'蝴蝶球',short:'蝴蝶球',rotation:'極少旋轉',axis:[.25,.1,.96],rpm:30,copy:'一秒鐘也轉不到一圈。真實球路可能因縫線與不穩定氣流飄動，這個風洞示意不計算那種亂流。'}
];
export function spinAxis(pitchId,hand='right'){
 const p=pitchSpins.find(x=>x.id===pitchId)||pitchSpins[0],a=[...p.axis];
 if(hand==='left'){a[1]*=-1;a[2]*=-1;}
 const length=Math.hypot(...a);return a.map(x=>x/length);
}

// Demonstration launch settings, chosen to keep the pitch in view at 16.5 m.
// These are not measured averages or a claim that a pitch has one fixed speed.
export const pitchDefaults={
 four:{speed:145,elevation:-1.8},sinker:{speed:135,elevation:-.8},
 cutter:{speed:135,elevation:-.8},curve:{speed:115,elevation:4.3},
 slider:{speed:125,elevation:1.9},sweeper:{speed:120,elevation:2},
 change:{speed:110,elevation:1.3},split:{speed:120,elevation:.1},
 knuckle:{speed:85,elevation:6}
};
export function pitchFlightOptions(pitchId,hand='right',overrides={}){
 const p=pitchSpins.find(x=>x.id===pitchId)||pitchSpins[0];
 return {axis:spinAxis(p.id,hand),rpm:p.rpm,...pitchDefaults[p.id],yaw:0,...overrides};
}
