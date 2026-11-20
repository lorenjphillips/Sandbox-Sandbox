import { paintHourglassToy, paintScarabToy, paintGrassToy } from './toy-art.js';
import { drawBucketModel, drawTruckModel } from './board-models.js';
import { eggModels } from './egg-models.js';
import { createLawnPlane } from './lawn-plane.js';
import { drawNestedSandboxModel, nestedSandboxHitPoints } from './nested-sandbox-model.js';
import { drawRakeModel } from './rake-model.js';
import { drawShovelModel } from './shovel-model.js';
import { WIDTH, HEIGHT, TRAY, RIM, BED, HOME_YAW, HOME_PITCH, MIN_PITCH, MAX_PITCH, orthographic } from './geometry.js';

export { WIDTH, HEIGHT };
export const TERRITORY_WEIGHT = 216;

const SIZE = 15;
const RISE = Math.sqrt(3) * SIZE;
const SEA = [
  [.22,.42,.30,.39], [.45,.33,.37,.43], [.70,.43,.34,.40],
  [.84,.49,.25,.29], [.23,.67,.24,.29], [.51,.74,.36,.28],
  [.76,.70,.25,.27], [.42,.81,.20,.18], [.88,.56,.18,.24]
];
const TOYS = {
  bucket:{x:246,y:30,rx:90,ry:104},
  shovel:{x:858,y:10,rx:131,ry:82},
  rake:{x:411,y:587,rx:110,ry:58},
  truck:{x:907,y:563,rx:107,ry:97}
};
const COLORS = {
  'Sandboxes': [[215,153,84],[200,154,92],[211,134,96],[151,163,103],[218,167,89],[196,130,87],[162,173,117]],
  'Cloud platforms': [[112,166,158],[123,158,181],[99,158,149],[138,173,156],[115,157,168],[155,179,168]],
  'Developer tools': [[195,130,121],[175,137,157],[178,150,173],[203,149,121],[178,130,141]]
};
const PINS = {
  e2b:[.29,.28], daytona:[.414,.394], modal:[.50,.285], sprites:[.31,.525],
  boat:[.21,.415], northflank:[.291,.66], blaxel:[.33,.384], morph:[.257,.475],
  freestyle:[.157,.553], runloop:[.407,.22], tensorlake:[.537,.459], prized:[.383,.534],
  instabox:[.505,.525], beam:[.237,.335], riza:[.185,.485], novita:[.533,.369],
  tangle:[.465,.535], spheron:[.37,.275], superserve:[.204,.61], microsandbox:[.366,.677],
  upstash:[.46,.185], vercel:[.644,.375], cloudflare:[.744,.296], aws:[.784,.414],
  azure:[.842,.53], google:[.763,.644], openai:[.686,.545], baseten:[.614,.504],
  render:[.658,.665], digitalocean:[.84,.317], together:[.852,.676], deno:[.861,.205],
  docker:[.486,.69], codesandbox:[.421,.704], blacksmith:[.57,.759], buddy:[.585,.681],
  depot:[.645,.754], namespace:[.526,.759], mosaic:[.476,.791], agentcomputer:[.378,.765]
};
const KEY_IDS = ['daytona','e2b','modal','boat','sprites','northflank','vercel','cloudflare','aws','azure','google','openai','digitalocean','baseten','docker','blacksmith','depot','blaxel','instabox','prized','buddy','render'];
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (a, b, weight) => a + (b - a) * weight;
const rgb = (channels, alpha = 1) => 'rgba(' + channels.join(',') + ',' + alpha + ')';
const range = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const motionReduced = matchMedia('(prefers-reduced-motion: reduce)');
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4.25;
const AMBIENT_INTERVAL = 7600;
const AMBIENT_DURATION = 940;
const TOY_DURATION = 4200;
const HISTORY_ORBIT_MS = 84000;
const HISTORY_FRAME_MS = 1000/24;

function hash(x, y) {
  let value = (Math.imul(x, 196613) ^ Math.imul(y, 263167)) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 73244475);
  return ((value ^ (value >>> 15)) >>> 0) / 4294967295;
}

function noise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const a = fx * fx * (3 - 2 * fx);
  const b = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hash(ix, iy), hash(ix + 1, iy), a), lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), a), b);
}

function terrainField(x, y) {
  const u = x / WIDTH;
  const v = y / HEIGHT;
  let island = -2;
  for (const [cx, cy, rx, ry] of SEA) {
    island = Math.max(island, 1 - Math.hypot((u-cx)/rx, (v-cy)/ry));
  }
  const noiseA = noise(16*u+6, 13*v+9);
  const noiseB = noise(34*u+13, 29*v+17);
  const noiseC = noise(78*u+19, 57*v+12);
  const inlet = Math.exp(-(((u-.46)/.125)**2 + ((v-.785)/.058)**2)) * .19;
  return island + (noiseA-.5)*.46 + (noiseB-.5)*.21 + (noiseC-.5)*.077 - inlet - .026;
}

const heightAt = (x,y) => terrainField(x,y);

function tilesOnLand() {
  const tiles = [];
  for (let column=-4; column<WIDTH/(SIZE*1.5)+4; column++) {
    for (let row=-4; row<HEIGHT/RISE+4; row++) {
      const x=SIZE+column*SIZE*1.5;
      const y=RISE/2+row*RISE+(column&1)*RISE/2;
      const clear=Object.values(TOYS).every(toy=>Math.hypot((x-toy.x)/toy.rx,(y-toy.y)/toy.ry)>1);
      if(clear && heightAt(x,y)>.015 && fitsTray(x,y)) tiles.push({x,y,index:tiles.length,column,row});
    }
  }
  return tiles;
}

function makeSites(companies,tiles) {
  const coords = new Map();
  const used = new Set();
  const districts = {'Sandboxes':[.355,.38,.16,.23], 'Cloud platforms':[.72,.48,.155,.23], 'Developer tools':[.49,.70,.155,.125]};
  const fixedFirst = [...companies].sort((a,b) => Number(Boolean(PINS[b.id]))-Number(Boolean(PINS[a.id])));
  for (const [index, company] of fixedFirst.entries()) {
    const [cx,cy,rx,ry] = districts[company.category];
    const [u,v] = PINS[company.id] || [cx+(hash(index+83,48)-.5)*2*rx,cy+(hash(index+166,61)-.5)*2*ry];
    const target = {x:u*WIDTH,y:v*HEIGHT};
    let selected;
    let best = Infinity;
    for (const tile of tiles) {
      if (used.has(tile.index)) continue;
      const crowded = [...coords.values()].some(site => range(site,tile)<SIZE*2.6);
      const cost = range(target,tile) + (crowded ? 44 : 0) + (heightAt(tile.x,tile.y)<.045 ? 12 : 0);
      if (cost<best) { best=cost; selected=tile; }
    }
    if (!selected) throw new Error('Territory layout exceeds available hexes.');
    const palette = COLORS[company.category];
    const brand=brandColors[company.id];
    const fallback=palette[Math.floor(hash(index+96,13)*palette.length)];
    const color=brand ? temperBrand(brand,index) : fallback;
    coords.set(company.id,{...selected,color,company});
    used.add(selected.index);
  }
  return coords;
}


const BED_POINTS=BED.map(([x,y])=>({x,y}));
let viewAxes=orthographic(HOME_YAW,HOME_PITCH);
const project=(x,y,z)=>viewAxes.project(x,y,z);

function bounds(points) {
  return {
    left:Math.min(...points.map(p=>p.x)), right:Math.max(...points.map(p=>p.x)),
    top:Math.min(...points.map(p=>p.y)), bottom:Math.max(...points.map(p=>p.y))
  };
}

function sceneBounds() {
  return bounds([TRAY.lip,TRAY.base].flatMap(z=>RIM.map(([x,y])=>project(x,y,z))));
}

function sceneArea(box) {
  return {left:box.left-88,top:box.top-48,right:box.right+92,bottom:box.bottom+70};
}

let SCENE=sceneArea(sceneBounds());
const FRAME_WIDTH=2*(TRAY.radius+76);
const FRAME_HEIGHT=2*(TRAY.radius*Math.sin(MAX_PITCH)+(TRAY.lip-TRAY.floor)*Math.cos(MAX_PITCH)+23);
const trayCenter=()=>project(WIDTH/2,HEIGHT/2,TRAY.floor);

function fitsTray(x,y) {
  for(let i=0;i<6;i++) {
    const angle=i*Math.PI/3;
    if(!contains(BED_POINTS,x+SIZE*Math.cos(angle),y+SIZE*Math.sin(angle))) return false;
  }
  return true;
}

function temperBrand(brand,index) {
  const saturation=Math.max(...brand)-Math.min(...brand);
  const quiet=[184,173,148];
  const neutral=[215,208,192];
  if(saturation<24) {
    const bias=(hash(index+31,14)-.5)*18;
    return brand.map((value,channel)=>lerp(value,neutral[channel],.54)+bias);
  }
  return brand.map((value,channel)=>lerp(value,quiet[channel],.42));
}

function point([x,y,z]) {
  return project(x,y,z);
}

function polygon(ctx,points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x,points[0].y);
  for (const entry of points.slice(1)) ctx.lineTo(entry.x,entry.y);
  ctx.closePath();
}

function contains(points,x,y) {
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i];
    const b=points[j];
    if((a.y>y)!==(b.y>y) && x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x) inside=!inside;
  }
  return inside;
}

function worldShape(ctx,coordinates) {
  polygon(ctx,coordinates.map(point));
}

function color(channels,shade=0,alpha=1) {
  return rgb(channels.map(channel=>Math.round(clamp(channel+shade,0,255))),alpha);
}

function ramp(ctx,from,to,stops) {
  const gradient=ctx.createLinearGradient(from.x,from.y,to.x,to.y);
  for (const [position,shade] of stops) gradient.addColorStop(position,shade);
  return gradient;
}

function strokeLine(ctx,positions,style,size=1) {
  const points=positions.map(point);
  ctx.beginPath();
  ctx.moveTo(points[0].x,points[0].y);
  for(const p of points.slice(1)) ctx.lineTo(p.x,p.y);
  ctx.strokeStyle=style;
  ctx.lineWidth=size;
  ctx.stroke();
}

function woodBoard(ctx,corners,styles,strip) {
  const [a,b,c,d]=corners.map(point);
  const middle=(p,q)=>({x:(p.x+q.x)/2,y:(p.y+q.y)/2});
  polygon(ctx,[a,b,c,d]);
  ctx.fillStyle=ramp(ctx,middle(a,b),middle(c,d),styles);
  ctx.fill();
  if(!woodTexture) return;
  const across=middle(a,b),inset=middle(c,d);
  const ux=b.x-a.x,uy=b.y-a.y,vx=inset.x-across.x,vy=inset.y-across.y;
  if(Math.abs(ux*vy-uy*vx)<.01) return;
  const stripHeight=woodTexture.height/8;
  ctx.save();
  ctx.clip();
  ctx.transform(ux,uy,vx,vy,a.x,a.y);
  ctx.globalCompositeOperation='soft-light';
  ctx.globalAlpha=.60;
  ctx.drawImage(woodTexture,0,strip*stripHeight,woodTexture.width,stripHeight,0,0,1,1);
  ctx.restore();
}

function screw(ctx,x,y) {
  const at=project(x,y,TRAY.lip);
  ctx.save();
  ctx.translate(at.x,at.y);
  ctx.transform(viewAxes.cosine,viewAxes.ground*viewAxes.sine,-viewAxes.sine,viewAxes.ground*viewAxes.cosine,0,0);
  ellipse(ctx,.2,.5,2.7,2.7,'#edcfaa9e');
  ellipse(ctx,0,0,2.35,2.35,'#684d3c');
  ellipse(ctx,-.1,.2,1.8,1.8,'#a38a70');
  ctx.beginPath();
  ctx.moveTo(-.9,.75);
  ctx.lineTo(.9,-.75);
  ctx.strokeStyle='#534a3e';
  ctx.lineWidth=.8;
  ctx.stroke();
  ctx.restore();
}

function sandRakeLines(ctx,x,y,angle,length,count) {
  const at={x,y};
  ctx.save();
  ctx.translate(at.x,at.y);
  ctx.rotate(angle);
  for(let i=0;i<count;i++) {
    const cy=i*4.7;
    const start=hash(i,length)*7;
    const end=length-hash(length,i)*12;
    const taper=ctx.createLinearGradient(0,0,length,2);
    taper.addColorStop(0,'#7b594300');
    taper.addColorStop(.19,'#7b59432d');
    taper.addColorStop(.75,'#7b594326');
    taper.addColorStop(1,'#7b594300');
    ctx.beginPath();
    ctx.moveTo(start,cy);
    ctx.bezierCurveTo(length*.4,cy-12,length*.78,cy+18,end,cy+3);
    ctx.strokeStyle=taper;
    ctx.lineWidth=1.8;
    ctx.stroke();
    ctx.translate(0,1.3);
    ctx.strokeStyle='#ffedca36';
    ctx.lineWidth=.9;
    ctx.stroke();
    ctx.translate(0,-1.3);
  }
  ctx.restore();
}

function ellipse(ctx,x,y,rx,ry,fill) {
  ctx.beginPath();
  ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);
  ctx.fillStyle=fill;
  ctx.fill();
}

const EGGS=[
  {id:'worm',label:'Inspect the little sandworm',x:796,y:-10,extent:45},
  {id:'anakin',label:'Inspect the Anakin Skywalker figure',x:293,y:10,extent:65},
  {id:'radio',label:'Play the buried cassette radio',x:837,y:560,extent:42}
].map(egg=>{
  const {model,paintWorld}=eggModels[egg.id];
  return {...egg,paintWorld,hitPoints:model.vertices};
});

const PLAY_TOYS=[
  {id:'sandbox',label:'Open the miniature sandbox',x:325,y:672,extent:62,paintWorld:drawNestedSandboxModel,hitPoints:nestedSandboxHitPoints()},
  {id:'hourglass',label:'Flip the hourglass and go back one day',x:167,y:16,width:25,height:35,offsetY:-14,paint:paintHourglassToy},
  {id:'scarab',label:'Disturb the buried scarab',x:478,y:619,width:25,height:20,offsetY:-3,paint:paintScarabToy},
  {id:'grass',label:'Touch grass',x:548,y:RIM[3][1]+27,z:TRAY.base,width:31,height:25,offsetY:-6,paint:paintGrassToy}
];

const MOUNDS=[
  [154,120,77,93,31],[327,38,124,53,28],[906,104,78,128,40],
  [107,413,71,142,25],[303,618,115,70,31],[590,632,154,53,36],
  [862,592,74,83,41],[555,4,150,66,19],[1023,332,68,104,24]
];

function sandLight(x,y) {
  let slopeX=0;
  let slopeY=0;
  for(const [cx,cy,rx,ry,peak] of MOUNDS) {
    const sx=(x-cx)/rx,sy=(y-cy)/ry;
    const part=peak*Math.exp(-(sx*sx+sy*sy));
    slopeX-=2*sx/rx*part;
    slopeY-=2*sy/ry*part;
  }
  return (.56*slopeX+.48*slopeY+.67)/Math.hypot(slopeX,slopeY,1)-.67;
}

const SAND_AREA=bounds(RIM.map(([x,y])=>({x,y})));

function createSandMaterial(texture) {
  const {canvas,ctx}=sceneLayer(1.5,SAND_AREA);
  const {left,top,right,bottom}=SAND_AREA;
  const width=right-left,height=bottom-top;
  ctx.fillStyle=ramp(ctx,{x:0,y:0},{x:WIDTH,y:HEIGHT},[[0,'#dac4a3'],[.38,'#f4e2c6'],[.72,'#ede0c6'],[1,'#dcc7a7']]);
  ctx.fillRect(left,top,width,height);
  if(texture) {
    const pattern=ctx.createPattern(texture,'repeat');
    pattern.setTransform(new DOMMatrix().scale(.35,.36));
    ctx.fillStyle=pattern;
    for(const [blend,alpha] of [['soft-light',.78],['multiply',.20]]) {
      ctx.globalCompositeOperation=blend;
      ctx.globalAlpha=alpha;
      ctx.fillRect(left,top,width,height);
    }
    ctx.globalCompositeOperation='source-over';
    ctx.globalAlpha=1;
  }
  const spacing=texture?6.55:3.85;
  for(let x=left;x<right;x+=spacing) {
    for(let y=top;y<bottom;y+=spacing) {
      const u=Math.floor(x),v=Math.floor(y),random=hash(u+29,v+41);
      if(random<.29) continue;
      ctx.fillStyle=random>.64?'#fff6dc4f':'#785c3c24';
      const size=hash(u-12,v-5)*.95+.32;
      ctx.fillRect(x+hash(u,v)*spacing,y+hash(v,u)*spacing,size,size);
    }
  }
  const relief=document.createElement('canvas');
  relief.width=Math.ceil(width/4);
  relief.height=Math.ceil(height/4);
  const reliefCtx=relief.getContext('2d');
  const pixels=reliefCtx.createImageData(relief.width,relief.height);
  for(let row=0;row<relief.height;row++) {
    for(let col=0;col<relief.width;col++) {
      const light=sandLight(left+(col+.5)*4,top+(row+.5)*4);
      const i=4*(row*relief.width+col);
      pixels.data[i]=light>0?255:111;
      pixels.data[i+1]=light>0?244:85;
      pixels.data[i+2]=light>0?217:65;
      pixels.data[i+3]=Math.min(145,Math.abs(light)*390);
    }
  }
  reliefCtx.putImageData(pixels,0,0);
  ctx.drawImage(relief,left,top,width,height);
  const sunlight=ctx.createRadialGradient(440,130,24,535,345,550);
  sunlight.addColorStop(0,'#fff7df33');
  sunlight.addColorStop(1,'#fff7df00');
  ctx.fillStyle=sunlight;
  ctx.fillRect(left,top,width,height);
  sandRakeLines(ctx,354,644,.09,124,5);
  sandRakeLines(ctx,547,664,-.04,104,6);
  sandRakeLines(ctx,817,630,-.19,94,4);
  sandRakeLines(ctx,154,129,.11,94,4);
  return canvas;
}

function drawSand(ctx) {
  const {left,top,right,bottom}=SAND_AREA;
  const center=project(WIDTH/2,HEIGHT/2,TRAY.floor);
  const {cosine,sine,ground}=viewAxes;
  ctx.save();
  ctx.transform(cosine,sine*ground,-sine,cosine*ground,center.x,center.y);
  ctx.drawImage(sandMaterial,left-WIDTH/2,top-HEIGHT/2,right-left,bottom-top);
  ctx.restore();
}

function sceneLayer(ratio=1.45,area=SCENE) {
  const canvas=document.createElement('canvas');
  const width=area.right-area.left;
  const height=area.bottom-area.top;
  canvas.width=Math.ceil(width*ratio);
  canvas.height=Math.ceil(height*ratio);
  const ctx=canvas.getContext('2d');
  ctx.setTransform(canvas.width/width,0,0,canvas.height/height,-area.left*canvas.width/width,-area.top*canvas.height/height);
  return {canvas,ctx};
}

function grassAtFoot(ctx,a,b,index) {
  const [ax,ay,az]=a,[bx,by]=b;
  const length=Math.hypot(bx-ax,by-ay);
  const colors=['#687645','#788451','#586c41','#92945d','#586641','#928966'];
  for(let k=0;k<length/4;k++) {
    if(noise(k/6,index+2)+hash(k,index+48)*.46<.77) continue;
    const t=(k+hash(k,index+12))*4/length;
    const x=lerp(ax,bx,t)+(by-ay)*1.5/length;
    const y=lerp(ay,by,t)-(bx-ax)*1.5/length;
    for(let j=0;j<4;j++) {
      const seed=k*4+j;
      const dx=(hash(seed,27)-.5)*6,dy=(hash(seed,81)-.5)*4;
      const lean=(hash(seed,94)-.53)*7;
      const height=1.6+hash(seed,index+33)*5.8;
      const root=project(x+dx,y+dy,az);
      const tip=project(x+dx+lean,y+dy+lean*.3,az+height);
      ctx.beginPath();
      ctx.moveTo(root.x-.45,root.y);
      ctx.quadraticCurveTo(lerp(root.x,tip.x,.23),lerp(root.y,tip.y,.6),tip.x,tip.y);
      ctx.lineTo(root.x+.65,root.y);
      ctx.fillStyle=colors[Math.floor(hash(seed,index+41)*colors.length)];
      ctx.fill();
    }
  }
}

const sandBanks=BED.map(([x,y],i)=>{
  const [bx,by]=BED[(i+1)%BED.length];
  const steps=Math.ceil(Math.hypot(bx-x,by-y)/9);
  const ridge=[],toe=[];
  for(let step=0;step<=steps;step++) {
    const px=lerp(x,bx,step/steps),py=lerp(y,by,step/steps);
    const bank=noise(px/65+9,py/65+4)*9+noise(px/18,py/18)*2;
    ridge.push([px,py,TRAY.floor+bank]);
    toe.push([lerp(px,WIDTH/2,.054),lerp(py,HEIGHT/2,.054),TRAY.floor]);
  }
  return {ridge,toe};
});

function createTrayLayer(area=SCENE,ratio=1.45,interactive=false) {
  const {canvas,ctx}=sceneLayer(ratio,area);
  const {canvas:foreground,ctx:near}=sceneLayer(ratio,area);
  const occlusions=[];
  const {lip,floor,base}=TRAY;
  const outer=RIM.map(([x,y])=>[x,y,lip]);
  const inner=BED.map(([x,y])=>[x,y,lip]);
  const sand=BED.map(([x,y])=>[x,y,floor]);
  const foot=RIM.map(([x,y])=>[x,y,base]);
  const banks=sandBanks.map(({ridge,toe})=>({ridge:ridge.map(point),toe:toe.map(point)}));
  const outerRim=outer.map(point);
  const shownFromFront=outerRim.map((a,i)=>a.x>outerRim[(i+1)%outerRim.length].x);

  ctx.save();
  const shadowScale=ctx.getTransform().a;
  for(const [dx,dy,blur,shade] of [[12,15,19,'#28251991'],[2.4,3.6,3,'#1e241cb3']]) {
    ctx.shadowColor=shade;
    ctx.shadowOffsetX=(dx*viewAxes.cosine-dy*viewAxes.sine)*shadowScale;
    ctx.shadowOffsetY=(dx*viewAxes.sine+dy*viewAxes.cosine)*viewAxes.ground*shadowScale;
    ctx.shadowBlur=blur*shadowScale;
    worldShape(ctx,foot);
    ctx.fillStyle='#433f2b';
    ctx.fill();
  }
  ctx.restore();

  for(const [i,a] of inner.entries()) {
    if(shownFromFront[i]) continue;
    const j=(i+1)%inner.length;
    const face=[a,inner[j],sand[j],sand[i]];
    woodBoard(ctx,face,[[0,'#ad8063'],[.18,'#966d53'],[.85,'#89664e'],[1,'#735642']],(i+4)%8);
  }

  polygon(ctx,banks.flatMap(bank=>bank.ridge));
  ctx.save();
  ctx.clip();
  drawSand(ctx);
  for(const {ridge,toe} of banks) {
    const middle=Math.floor(ridge.length/2);
    polygon(ctx,[...ridge,...toe.slice().reverse()]);
    ctx.fillStyle=ramp(ctx,ridge[middle],toe[middle],[[0,'#5d493964'],[.22,'#6655423b'],[1,'#76604800']]);
    ctx.fill();
  }
  ctx.restore();

  const faceColors=[
    ['#9d7358','#775440'],['#ae7d60','#896249'],['#a4775a','#7d5841']
  ];
  for(const [i,a] of outer.entries()) {
    if(!shownFromFront[i]) continue;
    const j=(i+1)%outer.length;
    const [top,bottom]=faceColors[(i+1)%3];
    const face=[a,outer[j],foot[j],foot[i]];
    woodBoard(near,face,[[0,top],[.89,bottom],[1,'#624a38']],(i+2)%8);
    occlusions.push(face.map(point));
    const atHeight=z=>[a,outer[j]].map(([x,y])=>[x,y,z]);
    strokeLine(near,atHeight(lip-2),'#dfb48b73',.8);
    strokeLine(near,atHeight(base),'#46372bd9',1.25);
    strokeLine(near,[a,foot[i]],'#594332ad',1.2);
  }

  const woodStyles=[
    ['#c49c7f','#b08669'],['#be9476','#a77d61'],['#caa286','#b48c6d'],
    ['#cda586','#b89070'],['#c5a083','#af8769'],['#c8a184','#b58d70']
  ];
  for(const [i,a] of outer.entries()) {
    const j=(i+1)%outer.length;
    const surface=shownFromFront[i]?near:ctx;
    const rail=[a,outer[j],inner[j],inner[i]];
    const [light,dark]=woodStyles[i];
    woodBoard(surface,rail,[[0,light],[.1,light],[.93,dark],[1,'#a47e63']],i);
    strokeLine(surface,[a,outer[j]],'#f4d4adad',1.65);
    strokeLine(surface,[inner[i],inner[j]],'#72533d8c',1.1);
    strokeLine(surface,[a,inner[i]],'#694e3c9c',1.2);
    for(const t of [.036,.964]) {
      const x=lerp((a[0]+inner[i][0])/2,(outer[j][0]+inner[j][0])/2,t);
      const y=lerp((a[1]+inner[i][1])/2,(outer[j][1]+inner[j][1])/2,t);
      screw(surface,x,y);
    }
    if(shownFromFront[i]) occlusions.push(rail.map(point));
  }
  for(const [i,a] of foot.entries()) {
    if(!interactive && shownFromFront[i]) grassAtFoot(near,a,foot[(i+1)%foot.length],i);
  }
  return {backdrop:canvas,foreground,occlusions,outerRim};
}

function loadTexture(file) {
  const image=new Image();
  image.src=new URL(file,import.meta.url);
  return image.decode().then(()=>image).catch(()=>null);
}

let sandTexture=null;
let woodTexture=null;
let sandMaterial=createSandMaterial(null);
let artRevision=0;
let sceneArt={tray:createTrayLayer(),area:SCENE};
const assetsReady=Promise.all([loadTexture('./sand.jpg'),loadTexture('./wood-grain.jpg')]).then(([sand,wood])=>{
  sandTexture=sand;
  woodTexture=wood;
  if(sand) sandMaterial=createSandMaterial(sand);
  artRevision++;
  sceneArt={tray:createTrayLayer(),area:SCENE};
});
const [logos,brandColors]=await Promise.all(['./logos/manifest.json','./brand-colors.json'].map(path=>
  fetch(new URL(path,import.meta.url))
    .then(response=>response.ok ? response.json() : {})
    .catch(()=>({}))
));

const hexCorners=Array.from({length:6},(_,index)=>({
  x:SIZE*Math.cos(index*Math.PI/3),y:SIZE*Math.sin(index*Math.PI/3)
}));

function tilePlane(tile,z,scale) {
  return hexCorners.map(corner=>project(tile.x+scale*corner.x,tile.y+scale*corner.y,z));
}

function sideLight(side) {
  const direction=side*Math.PI/3+Math.PI/6;
  return -17-8*Math.sin(direction)+6*Math.cos(direction);
}

export class Board {
  constructor(elements,companies,callbacks) {
    this.elements=elements;
    this.callbacks=callbacks;
    this.ctx=elements.canvas.getContext('2d');
    this.lawn=createLawnPlane(elements.lawn,()=>this.draw(false));
    this.tiles=tilesOnLand();
    for(const tile of this.tiles) {
      const grain=noise(tile.x/174+5,tile.y/141+3);
      const hill=clamp(heightAt(tile.x,tile.y)*.9 + (grain-.5)*.15,0,.86);
      const tiers=Math.floor(hill*7);
      tile.elevation=TRAY.floor+6+tiers*5.3;
    }
    this.projectTerrain();
    this.requestedYaw=viewAxes.yaw;
    this.requestedPitch=viewAxes.pitch;
    this.sites=makeSites(companies,this.tiles);
    this.siteList=[...this.sites.values()];
    this.home=new Map(this.siteList.map(site=>[site.index,site.company.id]));
    this.layoutCache=new Map();
    this.logoAnchorCache=new WeakMap();
    this.logoAnchors=new Map();
    this.pulses=new Set();
    this.camera={...trayCenter(),z:MIN_ZOOM};
    this.activityTiles=[];
    this.activityCursor=0;
    this.category='all';
    this.terrainFrame=document.createElement('canvas');
    this.terrainContext=this.terrainFrame.getContext('2d');
    this.terrainRevision=0;
    this.lastActiveToys=[];
    this.neighbors=new Map();
    const byPosition=new Map(this.tiles.map(tile=>[tile.column+','+tile.row,tile]));
    for(const tile of this.tiles) {
      this.neighbors.set(tile.index,Array.from({length:6},(_,side)=>{
        const middle=side*Math.PI/3+Math.PI/6;
        const nx=tile.x+RISE*Math.cos(middle);
        const ny=tile.y+RISE*Math.sin(middle);
        const col=Math.round((nx-SIZE)/(SIZE*1.5));
        const row=Math.round((ny-RISE/2-(col&1)*RISE/2)/RISE);
        return byPosition.get(col+','+row)?.index;
      }));
    }
    this.props=[
      {x:805,y:44,extent:180,paintWorld:drawShovelModel},
      {x:TOYS.bucket.x,y:TOYS.bucket.y+31,extent:110,paintWorld:drawBucketModel},
      {x:TOYS.rake.x,y:TOYS.rake.y,extent:95,paintWorld:drawRakeModel},
      {x:TOYS.truck.x,y:TOYS.truck.y+5,extent:90,paintWorld:drawTruckModel},
      ...EGGS.map(egg=>({...egg})),
      ...PLAY_TOYS.map(toy=>({...toy,playable:true}))
    ];
    this.toys=this.props.filter(prop=>prop.playable);
    this.hotspots=this.props.filter(prop=>prop.id && elements.eggLayer);
    for(const spot of this.hotspots) {
      const node=document.createElement('button');
      node.type='button';
      node.className='egg-hotspot';
      node.setAttribute('aria-label',spot.label);
      if(spot.playable) {
        node.dataset.toy=spot.id;
        node.addEventListener('click',()=>this.playToy(spot));
      } else {
        node.dataset.egg=spot.id;
        node.setAttribute('aria-controls','egg-player');
        node.setAttribute('aria-expanded','false');
      }
      spot.node=node;
      elements.eggLayer.append(node);
    }
    this.projectProps();
    this.labelNodes=new Map();
    this.markerNodes=new Map();
    this.bind();
    new ResizeObserver(()=>{
      this.draw();
      this.scheduleActivity();
      this.animateToys();
    }).observe(elements.stage);
    assetsReady.then(()=>{
      this.tileGrain=new Map();
      this.terrainRevision++;
      this.draw();
    });
  }

  projectTerrain() {
    this.tileGrain=new Map();
    for(const tile of this.tiles) {
      tile.top=tilePlane(tile,tile.elevation,.965);
      tile.shoulder=tilePlane(tile,tile.elevation-1.25,.987);
      tile.base=tilePlane(tile,TRAY.floor+.1,.987);
      tile.shadow=tilePlane({x:tile.x+3.4,y:tile.y+5.9},TRAY.floor,.987);
      tile.sides=[];
      tile.shading=[];
      for(let side=0;side<6;side++) {
        const next=(side+1)%6;
        if(tile.shoulder[side].x<=tile.shoulder[next].x) continue;
        tile.sides.push([tile.shoulder[side],tile.shoulder[next],tile.base[next],tile.base[side]]);
        tile.shading.push(sideLight(side));
      }
      tile.bounds=bounds([...tile.top,...tile.base,...tile.shoulder]);
      tile.coverMask=null;
      tile.depth=viewAxes.depth(tile.x,tile.y);
      tile.screen=project(tile.x,tile.y,tile.elevation);
    }
    this.depthOrder=[...this.tiles].sort((a,b)=>a.depth-b.depth || a.x-b.x);
    this.hitCells=new Map();
    for(const [order,tile] of this.depthOrder.entries()) {
      tile.drawOrder=order;
      const box=tile.bounds;
      for(let x=Math.floor(box.left/40);x<=Math.floor(box.right/40);x++) {
        for(let y=Math.floor(box.top/40);y<=Math.floor(box.bottom/40);y++) {
          const key=x*256+y;
          if(!this.hitCells.has(key)) this.hitCells.set(key,[]);
          this.hitCells.get(key).push(tile);
        }
      }
    }
    for(const site of this.siteList||[]) site.screen=this.tiles[site.index].screen;
    if(this.props) this.projectProps();
  }

  projectProps() {
    for(const prop of this.props) {
      const center=project(prop.x,prop.y,prop.z??TRAY.floor);
      const extent=prop.extent??Math.max(prop.width,prop.height)*1.7;
      prop.center=center;
      prop.depth=viewAxes.depth(prop.x,prop.y);
      prop.bounds={left:center.x-extent,top:center.y-extent,right:center.x+extent,bottom:center.y+extent};
      if(prop.hitPoints) {
        const floor=prop.z??TRAY.floor;
        prop.hitBounds=bounds(prop.hitPoints.map(([x,y,z])=>project(prop.x+x,prop.y+y,floor+z)));
      }
      prop.covered=prop.id==='grass' && contains(sceneArt.tray.outerRim,center.x,center.y);
    }
    this.paintOrder=[...this.depthOrder,...this.props].sort((a,b)=>a.depth-b.depth);
  }

  paintProp(ctx,prop,now) {
    if(prop.covered) return;
    ctx.save();
    const state={elapsed:prop.started==null?0:(now-prop.started)/1000,active:prop.started!=null,reduced:motionReduced.matches};
    if(prop.paintWorld) prop.paintWorld(ctx,prop.x,prop.y,prop.z??TRAY.floor,viewAxes,state);
    else {
      ctx.translate(prop.center.x,prop.center.y);
      prop.paint(ctx,state);
    }
    ctx.restore();
  }

  orbitBy(radians,tilt=0) {
    if(!Number.isFinite(radians)||!Number.isFinite(tilt)) return;
    const nextPitch=clamp(this.requestedPitch+tilt,MIN_PITCH,MAX_PITCH);
    if(!radians && nextPitch===this.requestedPitch) return;
    this.interruptHistoryOrbit();
    this.requestedYaw+=radians;
    this.requestedPitch=nextPitch;
    if(this.orbitFrame) return;
    this.orbitFrame=requestAnimationFrame(()=>{
      this.orbitFrame=null;
      this.turnTo(this.requestedYaw,this.requestedPitch,true);
      this.deferLabelLayout();
      this.draw();
      clearTimeout(this.orbitTimer);
      this.orbitTimer=setTimeout(()=>this.settleOrbit(),150);
    });
  }

  settleOrbit() {
    this.orbiting=false;
    sceneArt={tray:createTrayLayer(),area:SCENE};
    this.terrainRevision++;
    this.draw();
  }

  startHistoryOrbit({reset=true}={}) {
    if(this.historyOrbiting) return;
    if(reset) this.resetView();
    this.historyOrbiting=true;
    this.stopActivity();
    this.animateHistoryOrbit();
  }

  stopHistoryOrbit() {
    if(!this.historyOrbiting) return;
    this.historyOrbiting=false;
    this.suspendHistoryOrbit();
    this.scheduleActivity();
  }

  interruptHistoryOrbit() {
    if(!this.historyOrbiting) return;
    this.stopHistoryOrbit();
    this.callbacks.navigate?.();
  }

  animateHistoryOrbit() {
    if(!this.historyOrbiting || this.historyOrbitFrame!=null || document.hidden || motionReduced.matches) return;
    cancelAnimationFrame(this.orbitFrame);
    this.orbitFrame=null;
    cancelAnimationFrame(this.flashFrame);
    this.flashFrame=null;
    clearTimeout(this.orbitTimer);
    clearTimeout(this.labelSettleTimer);
    this.labelSettleTimer=null;
    this.elements.stage.classList.add('camera-moving');
    this.requestedYaw=viewAxes.yaw;
    this.requestedPitch=viewAxes.pitch;
    let previous=null;
    let nextFrame=0;
    const tick=time=>{
      this.historyOrbitFrame=requestAnimationFrame(tick);
      if(previous===null) {
        previous=time;
        nextFrame=time+HISTORY_FRAME_MS;
        return;
      }
      if(time+1<nextFrame) return;
      const elapsed=time-previous;
      previous=time;
      nextFrame=Math.max(nextFrame+HISTORY_FRAME_MS,time+HISTORY_FRAME_MS/2);
      const turn=2*Math.PI;
      this.requestedYaw=(this.requestedYaw+turn*Math.min(elapsed,160)/HISTORY_ORBIT_MS)%turn;
      this.turnTo(this.requestedYaw,this.requestedPitch,true);
      this.draw();
    };
    this.historyOrbitFrame=requestAnimationFrame(tick);
  }

  suspendHistoryOrbit() {
    if(this.historyOrbitFrame==null) return;
    cancelAnimationFrame(this.historyOrbitFrame);
    this.historyOrbitFrame=null;
    this.elements.stage.classList.remove('camera-moving');
    if(this.orbiting) this.settleOrbit();
    if(this.pulses.size && !document.hidden && performance.now()-this.flashStart<770) this.animateFlash();
  }

  turnTo(angle,pitch,interactive) {
    clearTimeout(this.detailTimer);
    this.detailArt=null;
    this.detailKey=null;
    const previousCenter=trayCenter();
    viewAxes=orthographic(angle,pitch);
    const center=trayCenter();
    SCENE=sceneArea(sceneBounds());
    this.camera={
      x:center.x+(this.camera.x-previousCenter.x),
      y:center.y+(this.camera.y-previousCenter.y),
      z:this.camera.z
    };
    this.orbiting=interactive;
    const ratio=interactive ? clamp(this.viewport().zoom,.36,.82) : 1.45;
    sceneArt={tray:createTrayLayer(SCENE,ratio,interactive),area:SCENE};
    artRevision++;
    this.projectTerrain();
    this.terrainRevision++;
  }

  layout(scores) {
    const cacheKey=this.siteList.map(site=>scores[site.company.id]||0).join(',');
    if(this.layoutCache.has(cacheKey)) return this.layoutCache.get(cacheKey);
    const layout=this.tiles.map(tile=>{
      if(this.home.has(tile.index)) return this.home.get(tile.index);
      let best=Infinity;
      let owner=null;
      for(const site of this.siteList) {
        const squaredDistance=(tile.x-site.x)**2+(tile.y-site.y)**2;
        const strength=scores[site.company.id]||0;
        const cost=squaredDistance-TERRITORY_WEIGHT*clamp(strength,-5,18);
        if(cost<best) {best=cost;owner=site.company.id;}
      }
      return owner;
    });
    this.layoutCache.set(cacheKey,layout);
    if(this.layoutCache.size>250) this.layoutCache.delete(this.layoutCache.keys().next().value);
    return layout;
  }

  setLayout(layout,category,flash=new Set(),{replay=false}={}) {
    this.replayTiles=null;
    if(replay && flash.size && this.owners && !motionReduced.matches) {
      this.replayTiles=[...flash].filter(index=>this.owners[index]!==layout[index]).map(index=>{
        const tile=this.tiles[index],next=this.sites.get(layout[index]);
        return {tile,next,distance:range(tile,next),before:color(this.sites.get(this.owners[index]).color,(hash(index,47)-.5)*9+4)};
      }).sort((a,b)=>a.distance-b.distance);
    }
    const dirty=this.owners!==layout || this.category!==category || this.drawnSelection!==this.selected;
    if(this.owners!==layout) this.logoAnchors=this.anchorsFor(layout);
    this.owners=layout;
    this.category=category;
    this.pulses=flash;
    if(dirty) {
      this.drawnSelection=this.selected;
      this.terrainRevision++;
    }
    if(flash.size) {
      this.flashStart=performance.now();
      this.animateFlash();
    }
    this.draw();
  }

  anchorsFor(layout) {
    const cached=this.logoAnchorCache.get(layout);
    if(cached) return cached;
    const anchors=new Map();
    const visited=new Uint8Array(this.tiles.length);
    for(const tile of this.tiles) {
      const owner=layout[tile.index];
      if(!owner||visited[tile.index]) continue;
      const component=[tile.index];
      visited[tile.index]=1;
      const centroid={x:0,y:0};
      for(let cursor=0;cursor<component.length;cursor++) {
        const index=component[cursor];
        const {x,y}=this.tiles[index];
        centroid.x+=x;
        centroid.y+=y;
        for(const neighbor of this.neighbors.get(index)) {
          if(neighbor===undefined||visited[neighbor]||layout[neighbor]!==owner) continue;
          visited[neighbor]=1;
          component.push(neighbor);
        }
      }
      if((anchors.get(owner)?.size||0)>=component.length) continue;
      centroid.x/=component.length;
      centroid.y/=component.length;
      let seat;
      let nearest=Infinity;
      for(const index of component) {
        const candidate=this.tiles[index];
        const distance=range(candidate,centroid);
        if(distance<nearest) {
          seat=candidate;
          nearest=distance;
        }
      }
      anchors.set(owner,{tile:seat,size:component.length});
    }
    this.logoAnchorCache.set(layout,anchors);
    return anchors;
  }

  grainAt(z) {
    if(!this.tileGrain.has(z)) {
      const pattern=this.terrainContext.createPattern(sandTexture,'repeat');
      const origin=project(0,0,z);
      const {cosine,sine,ground}=viewAxes;
      pattern.setTransform(new DOMMatrix([.24*cosine,.24*sine*ground,-.24*sine,.24*cosine*ground,origin.x,origin.y]));
      this.tileGrain.set(z,pattern);
    }
    return this.tileGrain.get(z);
  }

  paintTiles(ctx,area) {
    if(!this.owners) return;
    const included=this.paintOrder.filter(({bounds})=>bounds.left<area.right+5&&bounds.right>area.left-5&&bounds.top<area.bottom+6&&bounds.bottom>area.top-6);
    ctx.lineJoin='round';
    ctx.fillStyle='#75441f26';
    for(const tile of included) {
      if(!tile.shadow) continue;
      polygon(ctx,tile.shadow);
      ctx.fill();
    }
    const now=performance.now();
    for(const tile of included) {
      if(tile.paint||tile.paintWorld) {
        this.paintProp(ctx,tile,now);
        continue;
      }
      const owner=this.owners[tile.index];
      const site=this.sites.get(owner);
      const active=this.selected===owner;
      const dim=this.category!=='all' && this.category!==site.company.category;
      const shade=(hash(tile.index,47)-.5)*9;
      const base=dim ? site.color.map((value,index)=>lerp(value,[218,185,134][index],.74)) : site.color;
      const top=tile.top;
      for(const [index,side] of tile.sides.entries()) {
        polygon(ctx,side);
        ctx.fillStyle=this.orbiting ? color(base,shade+tile.shading[index]-6) :
          ramp(ctx,side[0],side[3],[[0,color(base,shade+tile.shading[index])],[1,color(base,shade+tile.shading[index]-15)]]);
        ctx.fill();
        if(!this.orbiting) {
          ctx.strokeStyle='#614c3b35';
          ctx.lineWidth=.6;
          ctx.stroke();
        }
      }
      polygon(ctx,tile.shoulder);
      ctx.fillStyle=color(base,shade-16);
      ctx.fill();
      polygon(ctx,top);
      ctx.fillStyle=this.orbiting ? color(base,shade+4) : ramp(ctx,top[4],top[1],[[0,color(base,shade+12)],[1,color(base,shade-3)]]);
      ctx.fill();
      ctx.strokeStyle=color(base,22,.55);
      ctx.lineWidth=.65;
      ctx.stroke();
      if(sandTexture && !this.orbiting) {
        ctx.fillStyle=this.grainAt(tile.elevation);
        ctx.globalCompositeOperation='soft-light';
        ctx.globalAlpha=.36;
        ctx.fill();
        ctx.globalCompositeOperation='source-over';
        ctx.globalAlpha=1;
      }

      for(const [side,adjacent] of this.neighbors.get(tile.index).entries()) {
        if(adjacent===undefined || this.owners[adjacent]===owner) continue;
        const end=(side+1)%6;
        ctx.beginPath();
        ctx.moveTo(top[side].x,top[side].y);
        ctx.lineTo(top[end].x,top[end].y);
        ctx.strokeStyle=active?'#5e452f':color(base,-42,.74);
        ctx.lineWidth=active?2.65:1.7;
        ctx.stroke();
        if(active) {
          ctx.strokeStyle='#fff3c8';
          ctx.lineWidth=1.15;
          ctx.stroke();
        }
      }
    }
  }

  drawTerrain(view,scale) {
    const {width,height,zoom,dx,dy}=view;
    const frame=this.terrainFrame;
    const pixelWidth=Math.round(width*scale),pixelHeight=Math.round(height*scale);
    const key=[pixelWidth,pixelHeight,zoom,dx,dy,this.terrainRevision].join('/');
    const ctx=this.terrainContext;
    const active=this.toys.filter(toy=>toy.started!=null);
    const viewportArea={left:-dx/zoom,top:-dy/zoom,right:(width-dx)/zoom,bottom:(height-dy)/zoom};
    const reset=this.terrainKey!==key;
    if(reset) {
      this.terrainKey=key;
      if(frame.width!==pixelWidth||frame.height!==pixelHeight) {
        frame.width=pixelWidth;
        frame.height=pixelHeight;
      }
    }
    const areas=reset?[viewportArea]:[...new Set([...active,...this.lastActiveToys])].map(toy=>toy.bounds);
    this.lastActiveToys=active;
    for(const area of areas) {
      const left=Math.floor((dx+area.left*zoom)*scale),top=Math.floor((dy+area.top*zoom)*scale);
      const right=Math.ceil((dx+area.right*zoom)*scale),bottom=Math.ceil((dy+area.bottom*zoom)*scale);
      ctx.save();
      ctx.setTransform(1,0,0,1,0,0);
      ctx.beginPath();
      ctx.rect(left,top,right-left,bottom-top);
      ctx.clip();
      ctx.clearRect(left,top,right-left,bottom-top);
      ctx.setTransform(zoom*scale,0,0,zoom*scale,dx*scale,dy*scale);
      this.paintTiles(ctx,area);
      ctx.restore();
    }
    this.ctx.save();
    this.ctx.setTransform(1,0,0,1,0,0);
    this.ctx.drawImage(frame,0,0);
    this.ctx.restore();
  }

  drawReplay(ctx,progress) {
    for(const [order,entry] of this.replayTiles.entries()) {
      const {tile,next,before}=entry;
      const phase=clamp((progress-.2*order/Math.max(1,this.replayTiles.length-1))/.8);
      if(phase===1) continue;
      const box=tile.bounds;
      ctx.save();
      polygon(ctx,tile.top);
      ctx.clip();
      const occluders=new Set();
      for(let x=Math.floor(box.left/40);x<=Math.floor(box.right/40);x++) {
        for(let y=Math.floor(box.top/40);y<=Math.floor(box.bottom/40);y++) {
          for(const other of this.hitCells.get(x*256+y)||[]) {
            if(other.drawOrder>tile.drawOrder && other.bounds.left<box.right && other.bounds.right>box.left &&
              other.bounds.top<box.bottom && other.bounds.bottom>box.top) occluders.add(other);
          }
        }
      }
      for(const other of occluders) {
        if(!other.coverMask) {
          const mask=new Path2D();
          mask.rect(SCENE.left,SCENE.top,SCENE.right-SCENE.left,SCENE.bottom-SCENE.top);
          const outline=[];
          for(let i=0;i<6;i++) {
            const prev=other.shoulder[(i+5)%6],here=other.shoulder[i],after=other.shoulder[(i+1)%6];
            const wasFront=prev.x>here.x,isFront=here.x>after.x;
            if(wasFront) outline.push(other.base[i]);
            if(!wasFront || !isFront) outline.push(here);
            if(isFront && !wasFront) outline.push(other.base[i]);
          }
          outline.forEach((p,i)=>i ? mask.lineTo(p.x,p.y) : mask.moveTo(p.x,p.y));
          mask.closePath();
          other.coverMask=mask;
        }
        ctx.clip(other.coverMask,'evenodd');
      }
      if(phase===0) ctx.fillStyle=before;
      else {
        const edge=tile.top.reduce((closest,p)=>range(p,next.screen)<range(closest,next.screen)?p:closest);
        const reach=Math.max(...tile.top.map(p=>range(p,edge)))*1.25;
        const wave=ctx.createRadialGradient(edge.x,edge.y,0,edge.x,edge.y,reach*phase);
        wave.addColorStop(0,'transparent');
        wave.addColorStop(.78,'transparent');
        wave.addColorStop(.89,color(next.color,72,.92));
        wave.addColorStop(1,before);
        ctx.fillStyle=wave;
      }
      ctx.fillRect(box.left,box.top,box.right-box.left,box.bottom-box.top);
      ctx.restore();
    }
  }

  animateFlash() {
    if(this.flashFrame || this.historyOrbitFrame!=null || motionReduced.matches) return;
    const tick=()=>{
      this.flashFrame=null;
      this.draw(false);
      if(this.pulses.size && !document.hidden && performance.now()-this.flashStart<770) {
        this.flashFrame=requestAnimationFrame(tick);
      }
    };
    this.flashFrame=requestAnimationFrame(tick);
  }

  playToy(toy) {
    toy.started=performance.now();
    const note=this.callbacks.playToy(toy.id);
    if(note) toy.node.dataset.note=note;
    else delete toy.node.dataset.note;
    clearTimeout(toy.timer);
    toy.timer=setTimeout(()=>{
      toy.started=null;
      delete toy.node.dataset.note;
      this.draw(false);
    },TOY_DURATION);
    this.draw(false);
    this.animateToys();
  }

  animateToys() {
    if(this.toyFrame || motionReduced.matches || document.hidden || !this.elements.stage.clientWidth ||
      !this.toys.some(toy=>toy.started!=null)) return;
    this.toyFrame=requestAnimationFrame(()=>{
      this.toyFrame=null;
      this.draw(false);
      this.animateToys();
    });
  }

  setActivityTiles(indices) {
    this.activityTiles=[...new Set(indices)].filter(index=>Number.isInteger(index)&&this.tiles[index]);
    if(!this.activityTiles.length) this.stopActivity();
    else this.scheduleActivity();
  }

  stopActivity() {
    clearTimeout(this.activityTimer);
    cancelAnimationFrame(this.activityFrame);
    this.activityTimer=null;
    this.activityFrame=null;
    if(this.activity) {
      this.activity=null;
      this.draw(false);
    }
  }

  canAnimateActivity() {
    return this.activityTiles.length && !this.historyOrbiting && !motionReduced.matches && !document.hidden && this.elements.stage.clientWidth>0;
  }

  scheduleActivity() {
    if(this.activityTimer || this.activityFrame || !this.canAnimateActivity()) return;
    this.activityTimer=setTimeout(()=>{
      this.activityTimer=null;
      this.animateActivity();
    },AMBIENT_INTERVAL);
  }

  animateActivity() {
    if(!this.canAnimateActivity()) return;
    const {width,height,dx,dy,zoom}=this.viewport();
    const count=this.activityTiles.length;
    let tile;
    for(let offset=0;offset<count;offset++) {
      const index=this.activityTiles[this.activityCursor++%count];
      const candidate=this.tiles[index];
      const owner=this.owners?.[index];
      if(this.category!=='all' && this.sites.get(owner)?.company.category!==this.category) continue;
      const x=dx+candidate.screen.x*zoom;
      const y=dy+candidate.screen.y*zoom;
      if(x>=18 && x<=width-18 && y>=18 && y<=height-18) { tile=candidate; break; }
    }
    if(!tile || this.elements.stage.classList.contains('dragging')) {
      this.scheduleActivity();
      return;
    }
    const owner=this.owners?.[tile.index];
    const side=this.neighbors.get(tile.index).findIndex(index=>index===undefined||this.owners?.[index]!==owner);
    this.activity={tile,side,opacity:0};
    const start=performance.now();
    const tick=now=>{
      const progress=clamp((now-start)/AMBIENT_DURATION);
      this.activityFrame=null;
      if(progress>=1 || !this.canAnimateActivity()) {
        this.activity=null;
        this.draw(false);
        this.scheduleActivity();
        return;
      }
      this.activity.opacity=Math.sin(progress*Math.PI);
      this.draw(false);
      this.activityFrame=requestAnimationFrame(tick);
    };
    this.activityFrame=requestAnimationFrame(tick);
  }

  setEventMarkers(events,focused) {
    const current=new Set(events.map(event=>event.id));
    for(const [id,entry] of this.markerNodes) {
      if(!current.has(id)) {entry.node.remove();this.markerNodes.delete(id);}
    }
    for(const event of events) {
      if(!this.markerNodes.has(event.id)) {
        const node=this.callbacks.eventButton(event);
        this.markerNodes.set(event.id,{node,event});
        this.elements.markers.append(node);
      }
      const {node}=this.markerNodes.get(event.id);
      node.classList.toggle('is-selected',event.id===focused);
      node.setAttribute('aria-pressed',String(event.id===focused));
    }
    this.draw();
  }

  viewport() {
    const width=this.elements.stage.clientWidth;
    const height=this.elements.stage.clientHeight;
    const horizontalFill=width<670 ? 1.056 : 1.015;
    const fit=Math.min(width/FRAME_WIDTH*horizontalFill,height/FRAME_HEIGHT*1.015);
    const zoom=fit*this.camera.z;
    return {width,height,zoom,dx:width/2-this.camera.x*zoom,dy:height/2-this.camera.y*zoom};
  }

  backdrop(view,scale) {
    const ratio=scale*view.zoom;
    if(this.orbiting || ratio<=1.55) return sceneArt;
    const area={
      left:Math.max(SCENE.left,-view.dx/view.zoom),
      top:Math.max(SCENE.top,-view.dy/view.zoom),
      right:Math.min(SCENE.right,(view.width-view.dx)/view.zoom),
      bottom:Math.min(SCENE.bottom,(view.height-view.dy)/view.zoom)
    };
    const cached=this.detailArt;
    if(cached && cached.revision===artRevision && cached.ratio>=ratio*.92 &&
      cached.area.left<=area.left && cached.area.top<=area.top && cached.area.right>=area.right && cached.area.bottom>=area.bottom) return cached;

    const key=[area.left,area.top,area.right,area.bottom,ratio,artRevision].join('/');
    if(this.detailKey===key) return sceneArt;
    this.detailKey=key;
    clearTimeout(this.detailTimer);
    this.detailTimer=setTimeout(()=>{
      if(!this.elements.stage.clientWidth) {this.detailKey=null;return;}
      const marginX=(area.right-area.left)*.08;
      const marginY=(area.bottom-area.top)*.08;
      const crop={
        left:Math.max(SCENE.left,area.left-marginX),
        top:Math.max(SCENE.top,area.top-marginY),
        right:Math.min(SCENE.right,area.right+marginX),
        bottom:Math.min(SCENE.bottom,area.bottom+marginY)
      };
      const pixels=(crop.right-crop.left)*(crop.bottom-crop.top);
      if(pixels<=0) return;
      const renderRatio=Math.min(ratio,Math.sqrt(3800000/pixels));
      this.detailArt={tray:createTrayLayer(crop,renderRatio),area:crop,ratio,revision:artRevision};
      this.draw(false);
    },110);
    return sceneArt;
  }

  draw(updatePositions=true) {
    const v=this.viewport();
    if(!v.width || !v.height) return;
    const {canvas}=this.elements;
    const scale=Math.min(devicePixelRatio,this.orbiting?1:2);
    this.lawn.draw(v,viewAxes,scale);
    if(canvas.width!==Math.round(v.width*scale) || canvas.height!==Math.round(v.height*scale)) {
      canvas.width=Math.round(v.width*scale);
      canvas.height=Math.round(v.height*scale);
    }
    const ctx=this.ctx;
    ctx.setTransform(scale,0,0,scale,0,0);
    ctx.clearRect(0,0,v.width,v.height);
    ctx.save();
    ctx.translate(v.dx,v.dy);
    ctx.scale(v.zoom,v.zoom);
    const art=this.backdrop(v,scale);
    const {left,top,right,bottom}=art.area;
    ctx.drawImage(art.tray.backdrop,left,top,right-left,bottom-top);
    if(this.orbiting) {
      this.paintTiles(ctx,{left:-v.dx/v.zoom,top:-v.dy/v.zoom,right:(v.width-v.dx)/v.zoom,bottom:(v.height-v.dy)/v.zoom});
    } else this.drawTerrain(v,scale);
    const opacity=motionReduced.matches ? 0 : Math.max(0,1-(performance.now()-this.flashStart)/770);
    if(this.replayTiles && opacity>0) this.drawReplay(ctx,1-opacity);
    else if(this.pulses.size && opacity>0) {
      ctx.save();
      for(const index of this.pulses) {
        polygon(ctx,this.tiles[index].top);
        ctx.fillStyle='rgba(255,239,180,'+(opacity*.93)+')';
        ctx.fill();
        ctx.lineWidth=1.8;
        ctx.strokeStyle='rgba(252,220,124,'+opacity+')';
        ctx.stroke();
      }
      ctx.restore();
    }
    if(this.activity && !motionReduced.matches) {
      const {tile,side,opacity}=this.activity;
      polygon(ctx,tile.top);
      ctx.fillStyle='rgba(255,230,153,'+(opacity*.17)+')';
      ctx.fill();
      if(side>=0) {
        const start=tile.top[side];
        const end=tile.top[(side+1)%6];
        ctx.beginPath();
        ctx.moveTo(start.x,start.y);
        ctx.lineTo(end.x,end.y);
        ctx.lineWidth=2;
        ctx.strokeStyle='rgba(255,237,176,'+(opacity*.78)+')';
        ctx.stroke();
      }
    }
    ctx.drawImage(art.tray.foreground,left,top,right-left,bottom-top);
    ctx.restore();
    if(updatePositions) {
      const zoomed=this.camera.z>MIN_ZOOM+.001;
      const turned=Math.abs(Math.sin((viewAxes.yaw-HOME_YAW)/2))>.001 || Math.abs(viewAxes.pitch-HOME_PITCH)>.001;
      this.elements.stage.classList.toggle('is-zoomed',zoomed);
      this.elements.stage.classList.toggle('view-adjusted',!this.historyOrbiting && (zoomed||turned));
      this.placeTokens(v);
      this.callbacks.placed?.();
    }
  }

  placeTokens(v) {
    if(!v.width) return;
    const screen=(entry)=>({x:v.dx+entry.screen.x*v.zoom,y:v.dy+entry.screen.y*v.zoom});
    const inside=(at,padding=14)=>at.x>padding && at.x<v.width-padding && at.y>padding && at.y<v.height-padding &&
      !sceneArt.tray.occlusions.some(face=>contains(face,(at.x-v.dx)/v.zoom,(at.y-v.dy)/v.zoom));
    const toySeats=[];
    for(const {node,center,width,height,offsetY=0,covered,depth,hitBounds} of this.hotspots) {
      const hit=hitBounds ? {x:(hitBounds.left+hitBounds.right)/2,y:(hitBounds.top+hitBounds.bottom)/2} : {x:center.x,y:center.y+offsetY};
      const x=v.dx+hit.x*v.zoom,y=v.dy+hit.y*v.zoom;
      const w=(hitBounds ? hitBounds.right-hitBounds.left : width)*v.zoom;
      const h=(hitBounds ? hitBounds.bottom-hitBounds.top : height)*v.zoom;
      const walled=sceneArt.tray.occlusions.some(face=>contains(face,hit.x,hit.y));
      const terrain=this.projectedTileAt(hit);
      node.hidden=covered||walled||(terrain && terrain.depth>depth)||x+w/2<=0||x-w/2>=v.width||y+h/2<=0||y-h/2>=v.height;
      if(node.hidden) continue;
      const hitWidth=Math.max(28,w),hitHeight=Math.max(28,h);
      const left=x-hitWidth/2,top=y-hitHeight/2;
      node.style.width=hitWidth+'px';
      node.style.height=hitHeight+'px';
      node.style.left=left+'px';
      node.style.top=top+'px';
      toySeats.push({left,top,right:left+hitWidth,bottom:top+hitHeight});
    }
    const occupied=[];
    const compact=v.width<650;
    const moving=this.labelSettleTimer!=null || this.historyOrbitFrame!=null;
    const sites=[...this.siteList].sort((a,b)=>this.sitePriority(a)-this.sitePriority(b));
    for(const site of sites) {
      const id=site.company.id;
      const key=KEY_IDS.includes(id);
      const selected=this.selected===id;
      const anchor=this.logoAnchors.get(id);
      const at=anchor && screen(anchor.tile);
      const radius=compact?(key?13:10):(key?17:13);
      let node=this.labelNodes.get(id);
      const mayShow=at && inside(at) && (this.category==='all'||this.category===site.company.category)
        && (selected||key||!compact||this.camera.z>1.32);
      const clearance=node && !node.hidden ? 0 : 4;
      const overlaps=mayShow && !moving && occupied.some(seat=>range(seat,at)<seat.radius+radius+clearance);
      const show=moving && !selected ? at && node && !node.hidden : mayShow && (!overlaps||selected);
      if(show) {
        if(!node) {
          node=document.createElement('button');
          node.type='button';
          node.className='map-token'+(key?' key':'');
          node.style.setProperty('--token',color(site.color,5));
          node.dataset.label=site.company.name;
          node.setAttribute('aria-label','Open '+site.company.name+' profile');
          const source=logos[id]?.file;
          if(source) {
            const logo=document.createElement('img');
            logo.src=new URL('./logos/'+source,import.meta.url);
            logo.alt='';
            logo.draggable=false;
            logo.addEventListener('error',()=>{logo.remove();node.classList.add('unmarked');});
            node.append(logo);
          } else {
            node.classList.add('unmarked');
          }
          node.addEventListener('click',()=>this.callbacks.pick(id));
          this.labelNodes.set(id,node);
          this.elements.labels.append(node);
        }
        node.hidden=false;
        node.style.left=at.x+'px';
        node.style.top=at.y+'px';
        node.classList.toggle('is-selected',selected);
        occupied.push({...at,radius});
      } else if(node) node.hidden=true;
    }

    const flagSeats=[];
    const candidates=[[20,-13],[-18,12],[24,11],[-27,-8],[2,20],[0,-25],[28,18],[-29,-19]];
    const clearsToys=({x,y})=>toySeats.every(toy=>
      x+15<toy.left || x-15>toy.right || y+7<toy.top || y-29>toy.bottom);
    for(const {node,event} of this.markerNodes.values()) {
      const site=this.sites.get(event.company);
      const origin=screen(site);
      const border=this.callbacks.eventAnchor(event);
      const currentAnchor=border && this.tiles[border.index];
      const positions=currentAnchor ? [screen(currentAnchor)] : [];
      positions.push(...candidates.map(([x,y])=>({x:origin.x+x,y:origin.y+y})));
      const focused=node.classList.contains('is-selected');
      const fallback={x:origin.x+20,y:origin.y-15};
      const at=positions.find(p=>inside(p,16) && clearsToys(p) &&
        !occupied.some(label=>range(label,p)<label.radius+8) &&
        !flagSeats.some(seat=>range(seat,p)<(compact?18:25))) ||
        (focused && inside(origin) && clearsToys(fallback) ? fallback : null);
      node.hidden=!at;
      if(at) {
        node.style.left=at.x+'px';
        node.style.top=at.y+'px';
        flagSeats.push(at);
      }
    }
  }

  sitePriority(site) {
    if(this.selected===site.company.id) return -2;
    const rank=KEY_IDS.indexOf(site.company.id);
    return rank===-1 ? 100 : rank;
  }

  projectedTileAt(at) {
    if(sceneArt.tray.occlusions.some(face=>contains(face,at.x,at.y))) return undefined;
    const cells=this.hitCells.get(Math.floor(at.x/40)*256+Math.floor(at.y/40));
    return cells?.findLast(tile=>{
      const {left,top,right,bottom}=tile.bounds;
      return at.x>=left&&at.x<=right&&at.y>=top&&at.y<=bottom&&(
        contains(tile.shoulder,at.x,at.y)||contains(tile.top,at.x,at.y)||tile.sides.some(side=>contains(side,at.x,at.y))
      );
    });
  }

  ownerAt(x,y) {
    const view=this.viewport();
    if(!view.zoom) return undefined;
    const found=this.projectedTileAt({x:(x-view.dx)/view.zoom,y:(y-view.dy)/view.zoom});
    if(!found) return undefined;
    const id=this.owners?.[found.index];
    const company=this.sites.get(id)?.company;
    return company&&(this.category==='all'||company.category===this.category) ? id : undefined;
  }

  resetView() {
    this.interruptHistoryOrbit();
    cancelAnimationFrame(this.orbitFrame);
    this.orbitFrame=null;
    clearTimeout(this.orbitTimer);
    clearTimeout(this.labelSettleTimer);
    this.labelSettleTimer=null;
    this.elements.stage.classList.remove('camera-moving');
    this.requestedYaw=HOME_YAW;
    this.requestedPitch=HOME_PITCH;
    if(viewAxes.yaw!==HOME_YAW || viewAxes.pitch!==HOME_PITCH || this.orbiting) this.turnTo(HOME_YAW,HOME_PITCH,false);
    this.setCamera({...trayCenter(),z:MIN_ZOOM},false);
  }

  zoomBy(factor,anchor,destination=anchor) {
    if(!Number.isFinite(factor)||factor<=0) return this.camera.z;
    const current=this.camera;
    const z=clamp(current.z*factor,MIN_ZOOM,MAX_ZOOM);

    if(z===current.z && (z===MIN_ZOOM || !anchor || (anchor.x===destination.x&&anchor.y===destination.y))) return z;
    let {x,y}=current;
    if(anchor) {
      const view=this.viewport();
      const zoom=view.zoom*z/current.z;
      x+=(anchor.x-view.width/2)/view.zoom-(destination.x-view.width/2)/zoom;
      y+=(anchor.y-view.height/2)/view.zoom-(destination.y-view.height/2)/zoom;
    }
    this.setCamera({x,y,z});
    return z;
  }

  deferLabelLayout() {
    clearTimeout(this.labelSettleTimer);
    this.elements.stage.classList.add('camera-moving');
    this.labelSettleTimer=setTimeout(()=>{
      this.labelSettleTimer=null;
      this.elements.stage.classList.remove('camera-moving');
      this.placeTokens(this.viewport());
      this.callbacks.placed?.();
    },180);
  }

  setCamera({x,y,z},moving=true) {
    const center=trayCenter();
    const reach=TRAY.radius*(1-MIN_ZOOM/z);
    const rise=reach*Math.sin(MAX_PITCH);
    const next={
      x:clamp(x,center.x-reach,center.x+reach),
      y:clamp(y,center.y-rise,center.y+rise),
      z
    };
    if(moving && (next.x!==this.camera.x || next.y!==this.camera.y || next.z!==this.camera.z)) this.interruptHistoryOrbit();
    this.camera=next;
    if(moving) this.deferLabelLayout();
    this.draw();
  }

  bind() {
    const {stage}=this.elements;
    let drag=null;
    let suppressClick=false;
    const touches=new Map();
    let touchGesture=null;
    let gestureFrame=null;
    let wheelDelta=0;
    let wheelAnchor;
    let wheelFrame;
    stage.tabIndex=0;
    const onMotionChange=()=>{
      if(document.hidden||motionReduced.matches) {
        this.stopActivity();
        this.suspendHistoryOrbit();
      } else {
        this.scheduleActivity();
        this.animateHistoryOrbit();
      }
      this.draw(false);
      this.animateToys();
    };
    const pointer=event=>({x:event.clientX,y:event.clientY});
    const startDrag=(id,{x,y},button=null,secondary=false)=>{
      drag={id,x,y,lastX:x,lastY:y,moved:false,button,secondary};
    };
    const orbitScale=()=>Math.PI*2/Math.max(510,stage.clientWidth*.83);
    const tiltScale=()=>Math.PI/(2*Math.max(280,stage.clientHeight));
    const measureTouchPair=()=>{
      const [a,b]=touches.values();
      const box=stage.getBoundingClientRect();
      return {
        center:{x:(a.x+b.x)/2-box.left,y:(a.y+b.y)/2-box.top},
        span:Math.max(8,range(a,b)),
        a,b
      };
    };
    const updateTouchGesture=()=>{
      gestureFrame=null;
      const next=measureTouchPair();
      const previous=touchGesture.last;
      const dx=next.center.x-previous.center.x,dy=next.center.y-previous.center.y;
      if(!touchGesture.mode) {
        const first=range(next.a,previous.a),second=range(next.b,previous.b);
        if(Math.min(first,second)<3 && Math.max(first,second)<18) return;
        const travel=Math.hypot(dx,dy);
        const spread=Math.abs(next.span-previous.span);
        if(spread>=Math.max(6,previous.span*.04) && spread>=travel*.8) touchGesture.mode='zoom';
        else if(travel>=7 && spread<travel*.8) touchGesture.mode=Math.abs(dy)>Math.abs(dx)*1.35 ? 'tilt' : 'move';
        else return;
      }
      touchGesture.last=next;
      stage.classList.add('dragging');
      if(touchGesture.mode==='tilt') this.orbitBy(0,dy*tiltScale());
      else this.zoomBy(touchGesture.mode==='zoom' ? next.span/previous.span : 1,previous.center,next.center);
    };
    document.addEventListener('visibilitychange',onMotionChange);
    motionReduced.addEventListener('change',onMotionChange);
    this.elements.canvas.addEventListener('pointermove',event=>{
      if(drag||event.pointerType==='touch') return;
      const box=stage.getBoundingClientRect();
      const id=this.ownerAt(event.clientX-box.left,event.clientY-box.top);
      stage.classList.toggle('on-tile',Boolean(id));
    });
    stage.addEventListener('contextmenu',event=>event.preventDefault());
    stage.addEventListener('click',event=>{
      if(suppressClick && event.detail) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },true);
    stage.addEventListener('pointerdown',event=>{
      if(event.button===1) event.preventDefault();
      if(event.button!==0 && event.button!==2) return;
      if(!touches.size) suppressClick=false;
      if(event.pointerType==='touch') {
        if(drag&&!touches.size) return;
        touches.set(event.pointerId,pointer(event));
        if(touches.size>=2) {
          event.preventDefault();
          suppressClick=true;
          if(touchGesture?.last) {
            stage.setPointerCapture(event.pointerId);
            return;
          }
          for(const id of touches.keys()) stage.setPointerCapture(id);
          drag=null;
          stage.classList.remove('dragging');
          touchGesture={last:measureTouchPair(),mode:null};
          return;
        }
      } else if(touches.size) return;
      if(drag) return;
      const button=event.target.closest('button');
      const secondary=event.button===2;
      if(secondary) event.preventDefault();
      if(secondary && this.camera.z===MIN_ZOOM) return;
      startDrag(event.pointerId,pointer(event),button,secondary);
      if(!button || secondary) stage.setPointerCapture(event.pointerId);
    });
    stage.addEventListener('pointermove',event=>{
      if(touches.has(event.pointerId)) {
        touches.set(event.pointerId,pointer(event));
        if(touchGesture?.last) {
          if(gestureFrame===null) gestureFrame=requestAnimationFrame(updateTouchGesture);
          return;
        }
      }
      if(!drag||drag.id!==event.pointerId) return;
      const x=event.clientX-drag.x;
      const y=event.clientY-drag.y;
      if(Math.hypot(x,y)>5) drag.moved=true;
      if(!drag.moved) return;
      suppressClick=true;
      stage.classList.add('dragging');
      if(!stage.hasPointerCapture(event.pointerId)) stage.setPointerCapture(event.pointerId);
      const dx=event.clientX-drag.lastX,dy=event.clientY-drag.lastY;
      if(drag.secondary) {
        const {zoom}=this.viewport();
        this.setCamera({x:this.camera.x-dx/zoom,y:this.camera.y-dy/zoom,z:this.camera.z});
      } else {
        this.orbitBy(dx*orbitScale(),dy*tiltScale());
      }
      drag.lastX=event.clientX;
      drag.lastY=event.clientY;
    });
    const finishPointer=event=>{
      if(event.type==='lostpointercapture' && (event.target!==stage || stage.hasPointerCapture(event.pointerId))) return;
      if(touches.has(event.pointerId)) {
        if(gestureFrame!==null) {
          cancelAnimationFrame(gestureFrame);
          gestureFrame=null;
          if(event.type==='pointerup') updateTouchGesture();
        }
        touches.delete(event.pointerId);
        if(touchGesture) {
          if(touches.size>=2) {
            touchGesture={last:measureTouchPair(),mode:null};
          } else {
            stage.classList.remove('dragging');
            const remaining=touches.entries().next().value;
            if(remaining) {
              touchGesture.last=null;
              startDrag(...remaining);
            } else {
              touchGesture=null;
              drag=null;
            }
          }
          return;
        }
      }
      if(drag?.id!==event.pointerId) return;
      if(event.type==='pointerup'&&!drag.moved&&!drag.button&&!drag.secondary) {
        const box=stage.getBoundingClientRect();
        const id=this.ownerAt(event.clientX-box.left,event.clientY-box.top);
        if(id) this.callbacks.pick(id);
        else this.callbacks.clear();
      }
      drag=null;
      stage.classList.remove('dragging');
    };
    stage.addEventListener('pointerup',finishPointer);
    stage.addEventListener('pointercancel',finishPointer);
    stage.addEventListener('lostpointercapture',finishPointer);
    stage.addEventListener('wheel',event=>{
      event.preventDefault();
      if(!event.deltaY || (!event.ctrlKey && Math.abs(event.deltaX)>Math.abs(event.deltaY))) return;
      const box=stage.getBoundingClientRect();
      const units=event.deltaMode===1?16:event.deltaMode===2?stage.clientHeight:1;
      wheelDelta+=clamp(event.deltaY*units,-210,210);
      wheelAnchor={x:event.clientX-box.left,y:event.clientY-box.top};
      if(wheelFrame) return;
      wheelFrame=requestAnimationFrame(()=>{
        const delta=clamp(wheelDelta,-245,245);
        wheelDelta=0;
        wheelFrame=null;
        this.zoomBy(Math.exp(-delta*.0032),wheelAnchor);
      });
    },{passive:false});
    stage.addEventListener('keydown',event=>{
      if(event.target!==stage) return;
      const rotation={arrowleft:[-1,0],arrowright:[1,0],arrowup:[0,1],arrowdown:[0,-1],q:[-1,0],e:[1,0],w:[0,1],s:[0,-1]};
      const turn=rotation[event.key.toLowerCase()];
      if(turn) {
        event.preventDefault();
        this.orbitBy(turn[0]*Math.PI/12,turn[1]*Math.PI/36);
      } else if(['+','=','-','0'].includes(event.key)) {
        event.preventDefault();
        if(event.key==='0') this.resetView();
        else this.zoomBy(event.key==='-'?1/1.36:1.36);
      }
    });
  }
}
