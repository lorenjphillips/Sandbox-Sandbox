export const WIDTH = 1100;
export const HEIGHT = 640;
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


const TRAY = {lip:42,floor:-10,base:-42};
const OUTLINE = [[156,-104],[944,-104],[1208,320],[944,744],[156,744],[-108,320]];
const BED = OUTLINE.map(([x,y])=>[lerp(WIDTH/2,x,.915),lerp(HEIGHT/2,y,.915)]);
const BED_POINTS = BED.map(([x,y])=>({x,y}));
const YAW = .128;
const SIN_YAW = Math.sin(YAW);
const COS_YAW = Math.cos(YAW);

function depthAt(x,y) {
  return (x-WIDTH/2)*SIN_YAW + (y-HEIGHT/2)*COS_YAW;
}

function project(x,y,z=0) {
  const depth=depthAt(x,y);
  const across=(x-WIDTH/2)*COS_YAW - (y-HEIGHT/2)*SIN_YAW;
  const perspective=1+depth/2400;
  return {
    x:WIDTH/2+across*perspective,
    y:HEIGHT/2+depth*.64-z*.94*perspective
  };
}

function bounds(points) {
  return {
    left:Math.min(...points.map(p=>p.x)), right:Math.max(...points.map(p=>p.x)),
    top:Math.min(...points.map(p=>p.y)), bottom:Math.max(...points.map(p=>p.y))
  };
}

const trayBounds = bounds([TRAY.lip,TRAY.base].flatMap(z=>OUTLINE.map(([x,y])=>project(x,y,z))));
const SCENE = {left:trayBounds.left-88,top:trayBounds.top-48,right:trayBounds.right+92,bottom:trayBounds.bottom+70};
const ORIGIN = {x:(SCENE.left+SCENE.right)/2,y:(SCENE.top+SCENE.bottom)/2};

function fitsTray(x,y) {
  for(let i=0;i<6;i++) {
    const angle=i*Math.PI/3;
    if(!contains(BED_POINTS,x+SIZE*Math.cos(angle),y+SIZE*Math.sin(angle))) return false;
  }
  return true;
}

function temperBrand(brand,index) {
  const saturation=Math.max(...brand)-Math.min(...brand);
  const quiet=[182,170,145];
  const neutral=[215,208,192];
  if(saturation<24) {
    const bias=(hash(index+31,14)-.5)*18;
    return brand.map((value,channel)=>lerp(value,neutral[channel],.54)+bias);
  }
  return brand.map((value,channel)=>lerp(value,quiet[channel],.28));
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

function woodBoard(ctx,corners,parallel,styles,seed) {
  const p=corners.map(point);
  const long=(parallel ? [p[0],p[1],p[3],p[2]] : [p[0],p[3],p[1],p[2]]);
  const middle=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  polygon(ctx,p);
  ctx.fillStyle=ramp(ctx,middle(long[0],long[1]),middle(long[2],long[3]),styles);
  ctx.fill();
  ctx.save();
  ctx.clip();
  for(let i=0;i<87;i++) {
    const off=hash(i+seed,190);
    const start=hash(i,seed)*.25;
    const stop=.65+hash(i+seed,24)*.38;
    const waviness=(hash(i,seed+9)-.5)*.085;
    ctx.beginPath();
    for(let j=0;j<=25;j++) {
      const t=lerp(start,stop,j/25);
      const across=off+waviness*Math.sin(t*6+hash(i,31)*5)+.016*Math.sin(t*21+i*.4);
      const lx=lerp(long[0].x,long[1].x,t),ly=lerp(long[0].y,long[1].y,t);
      const rx=lerp(long[2].x,long[3].x,t),ry=lerp(long[2].y,long[3].y,t);
      const x=lerp(lx,rx,across),y=lerp(ly,ry,across);
      if(j===0)ctx.moveTo(x,y);
      else ctx.lineTo(x,y);
    }
    ctx.strokeStyle=i%3===0?'rgba(255,231,180,.22)':'rgba(89,44,17,.15)';
    ctx.lineWidth=.36+hash(i,12)*1.5;
    ctx.stroke();
  }
  ctx.restore();
  polygon(ctx,p);
  ctx.strokeStyle='#6f411c99';
  ctx.lineWidth=1.3;
  ctx.stroke();
}

function nail(ctx,x,y) {
  const at=project(x,y,TRAY.lip);
  ctx.save();
  ctx.translate(at.x,at.y);
  ctx.scale(1,.67);
  ctx.beginPath();
  ctx.arc(0,0,4,0,Math.PI*2);
  ctx.fillStyle='#785739';
  ctx.fill();
  ctx.lineWidth=1.2;
  ctx.strokeStyle='#f0ca88a6';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-1.8,1.5);
  ctx.lineTo(1.8,-1.5);
  ctx.strokeStyle='#d6ae6c';
  ctx.stroke();
  ctx.restore();
}

function sandRakeLines(ctx,x,y,angle,length,count) {
  const at=project(x,y,TRAY.floor);
  ctx.save();
  ctx.translate(at.x,at.y);
  ctx.rotate(angle);
  ctx.scale(1,.67);
  for(let i=0;i<count;i++) {
    const cy=i*6;
    ctx.beginPath();
    ctx.moveTo(0,cy);
    ctx.bezierCurveTo(length*.4,cy-12,length*.78,cy+18,length,cy+3);
    ctx.strokeStyle='#a6733a31';
    ctx.lineWidth=2.3;
    ctx.stroke();
    ctx.translate(0,1.7);
    ctx.strokeStyle='#ffe8b17c';
    ctx.lineWidth=1.2;
    ctx.stroke();
    ctx.translate(0,-1.7);
  }
  ctx.restore();
}

function shovel(ctx,x,y) {
  const at=project(x,y,TRAY.floor+4);
  ctx.save();
  ctx.translate(at.x,at.y);
  ctx.rotate(1.21);
  ctx.scale(1.10,.85);
  ctx.shadowColor='#76452578';
  ctx.shadowBlur=9;
  ctx.shadowOffsetY=7;
  ctx.beginPath();
  ctx.roundRect(-7,-94,14,78,5);
  ctx.fillStyle='#8f6241';
  ctx.fill();
  ctx.shadowColor='transparent';
  ctx.fillStyle=ramp(ctx,{x:-7,y:0},{x:7,y:0},[[0,'#975934'],[.36,'#dd9b5f'],[.73,'#d58c52'],[1,'#a8683e']]);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-8,-93);
  ctx.bezierCurveTo(-25,-94,-30,-112,-17,-118);
  ctx.lineTo(18,-117);
  ctx.bezierCurveTo(30,-112,24,-93,8,-92);
  ctx.lineTo(8,-101);
  ctx.bezierCurveTo(15,-103,17,-108,11,-109);
  ctx.lineTo(-11,-109);
  ctx.bezierCurveTo(-18,-108,-15,-103,-8,-101);
  ctx.closePath();
  ctx.fillStyle='#326560';
  ctx.fill();
  ctx.lineWidth=2.2;
  ctx.strokeStyle='#b6d0a98b';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-13,-29);
  ctx.bezierCurveTo(-24,-25,-30,-6,-32,12);
  ctx.bezierCurveTo(-28,30,28,30,32,12);
  ctx.bezierCurveTo(28,-7,24,-25,12,-29);
  ctx.closePath();
  ctx.shadowColor='#76452581';
  ctx.shadowBlur=10;
  ctx.shadowOffsetY=8;
  ctx.fillStyle=ramp(ctx,{x:-30,y:-28},{x:32,y:24},[[0,'#719887'],[.55,'#527e74'],[1,'#2d635e']]);
  ctx.fill();
  ctx.shadowColor='transparent';
  ctx.strokeStyle='#a1b9a3';
  ctx.lineWidth=2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-22,5);
  ctx.bezierCurveTo(-17,-12,17,-12,22,5);
  ctx.quadraticCurveTo(14,21,0,20);
  ctx.quadraticCurveTo(-13,20,-22,5);
  ctx.fillStyle='#2d5b575c';
  ctx.fill();
  ctx.restore();
}

function ellipse(ctx,x,y,rx,ry,fill) {
  ctx.beginPath();
  ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);
  ctx.fillStyle=fill;
  ctx.fill();
}

function toyShadow(ctx,x,y,rx,ry) {
  ctx.save();
  ctx.shadowColor='#5a391d81';
  ctx.shadowBlur=12;
  ctx.shadowOffsetX=7;
  ctx.shadowOffsetY=6;
  ellipse(ctx,x,y,rx,ry,'#85522469');
  ctx.restore();
}

function bucket(ctx,x,y) {
  const at=project(x,y,TRAY.floor+2);
  ctx.save();
  ctx.translate(at.x,at.y);
  toyShadow(ctx,0,8,22,7);
  ctx.beginPath();
  ctx.moveTo(-29,-39);
  ctx.lineTo(-20,5);
  ctx.quadraticCurveTo(0,18,21,5);
  ctx.lineTo(29,-39);
  ctx.closePath();
  ctx.fillStyle=ramp(ctx,{x:-31,y:-34},{x:28,y:3},[[0,'#b93d32'],[.30,'#f19370'],[.58,'#e06951'],[1,'#a1352d']]);
  ctx.fill();
  ctx.strokeStyle='#8331279a';
  ctx.lineWidth=1.5;
  ctx.stroke();
  ellipse(ctx,0,-39,31,12,'#f69c77');
  ellipse(ctx,0,-39,26,8.4,ramp(ctx,{x:0,y:-48},{x:5,y:-32},[[0,'#82342a'],[1,'#bb5142']]));
  ctx.beginPath();
  ctx.ellipse(-1,-36,23,4.8,0,0,Math.PI);
  ctx.fillStyle='#e2ba81';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-28,-38);
  ctx.bezierCurveTo(-42,-86,16,-91,28,-39);
  ctx.strokeStyle='#963a31';
  ctx.lineWidth=6.3;
  ctx.lineCap='round';
  ctx.stroke();
  ctx.strokeStyle='#ffb089';
  ctx.lineWidth=2;
  ctx.stroke();
  ellipse(ctx,-27,-35,4,3.6,'#cf6148');
  ellipse(ctx,27,-35,4,3.6,'#b14537');
  ctx.restore();
}

function rake(ctx,x,y) {
  const at=project(x,y,TRAY.floor+2);
  ctx.save();
  ctx.translate(at.x,at.y);
  ctx.rotate(.20);
  toyShadow(ctx,5,7,54,6);
  ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(-54,-2);
  ctx.lineTo(40,-2);
  ctx.lineWidth=10;
  ctx.strokeStyle=ramp(ctx,{x:-20,y:-8},{x:-19,y:4},[[0,'#f3ca88'],[.52,'#c08653'],[1,'#7d4a30']]);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-59,-8,22,13,4);
  ctx.fillStyle='#3c6e8a';
  ctx.fill();
  ctx.fillStyle=ramp(ctx,{x:38,y:-15},{x:59,y:16},[[0,'#7ab7ca'],[.55,'#4f8fa8'],[1,'#2d617d']]);
  ctx.beginPath();
  ctx.roundRect(28,-14,29,23,4);
  ctx.fill();
  for(let i=0;i<5;i++) {
    ctx.beginPath();
    ctx.roundRect(30+i*5.4,4,3.5,11,1.5);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(34,-11);
  ctx.lineTo(51,-11);
  ctx.strokeStyle='#b7dce3';
  ctx.lineWidth=1.4;
  ctx.stroke();
  ctx.restore();
}

function truck(ctx,x,y) {
  const at=project(x,y,TRAY.floor+4);
  ctx.save();
  ctx.translate(at.x,at.y);
  ctx.rotate(-.11);
  toyShadow(ctx,0,9,41,9);
  for(const [px,py] of [[-18,-1],[28,-1],[-30,6],[19,7]]) {
    ellipse(ctx,px,py,9.5,9.5,'#413a35');
    ellipse(ctx,px,py,7,7,'#262c2b');
    ellipse(ctx,px,py,3.2,3.2,'#c0a36b');
  }
  const parts=[
    [[[-40,-1],[-28,-13],[32,-13],[36,-1]],'#765739'],
    [[[-40,-16],[-33,-34],[-10,-37],[2,-26],[1,-2],[-38,-2]],'#e59738'],
    [[[-40,-16],[-34,-24],[-14,-24],[-12,-10],[-38,-10]],'#f6c461'],
    [[[-29,-31],[-13,-33],[-9,-24],[-31,-23]],'#5f8a91'],
    [[[-6,-27],[31,-28],[39,-20],[33,-7],[-3,-7]],'#c97434'],
    [[[-7,-29],[4,-34],[32,-35],[39,-24],[-2,-21]],'#f8b64f'],
    [[[-2,-28],[7,-31],[29,-32],[34,-26],[2,-24]],'#85572d'],
    [[[-28,-33],[-11,-35],[-7,-30],[-23,-28]],'#ffcd67']
  ];
  for(const [vertices,fill] of parts) {
    polygon(ctx,vertices.map(([x,y])=>({x,y})));
    ctx.fillStyle=fill;
    ctx.fill();
    ctx.strokeStyle='#754b2c83';
    ctx.lineWidth=.9;
    ctx.stroke();
  }
  ellipse(ctx,-36,-12,2,2,'#ffe4a1');
  ellipse(ctx,-29,6,3.15,3.15,'#cdaa62');
  ellipse(ctx,19,7,3.15,3.15,'#cdaa62');
  ctx.restore();
}

const MOUNDS=[
  [154,120,77,93,31],[327,38,124,53,28],[906,104,78,128,40],
  [107,413,71,142,25],[303,618,115,70,31],[590,632,154,53,36],
  [862,592,74,83,41],[555,4,150,66,19],[1023,332,68,104,24]
];

function sculptedSand(x,y) {
  let rise=0;
  let slopeX=0;
  let slopeY=0;
  for(const [cx,cy,rx,ry,peak] of MOUNDS) {
    const sx=(x-cx)/rx,sy=(y-cy)/ry;
    const part=peak*Math.exp(-(sx*sx+sy*sy));
    rise+=part;
    slopeX-=2*sx/rx*part;
    slopeY-=2*sy/ry*part;
  }
  const light=(.56*slopeX+.48*slopeY+.67)/Math.hypot(slopeX,slopeY,1)-.67;
  return {rise,light};
}

function createSandMesh() {
  const step=7;
  const vertices=[];
  for(let y=-110;y<=HEIGHT+110;y+=step) {
    const row=[];
    for(let x=-88;x<=WIDTH+88;x+=step) {
      const relief=sculptedSand(x,y);
      row.push({...project(x,y,TRAY.floor+relief.rise*.7),light:relief.light});
    }
    vertices.push(row);
  }
  return vertices;
}

const sandMesh=createSandMesh();

function drawSandRelief(ctx,area) {
  for(let y=1;y<sandMesh.length;y++) {
    for(let x=1;x<sandMesh[y].length;x++) {
      const a=sandMesh[y-1][x-1];
      if(a.x<area.left-16||a.x>area.right+16||a.y<area.top-16||a.y>area.bottom+16) continue;
      const poly=[a,sandMesh[y-1][x],sandMesh[y][x],sandMesh[y][x-1]];
      const contrast=poly.reduce((sum,p)=>sum+p.light,0)/4;
      if(Math.abs(contrast)<.012) continue;
      polygon(ctx,poly);
      const alpha=clamp(Math.abs(contrast)*2.04,0,.62);
      ctx.fillStyle=contrast>0?'rgba(255,232,173,'+alpha+')':'rgba(105,62,31,'+alpha+')';
      ctx.fill();
    }
  }
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

function fillTexture(ctx,texture,area,xScale,yScale,blend,alpha) {
  if(!texture) return;
  const pattern=ctx.createPattern(texture,'repeat');
  pattern.setTransform(new DOMMatrix().translate(SCENE.left,SCENE.top).rotate(YAW*180/Math.PI).scale(xScale,yScale));
  ctx.save();
  ctx.globalCompositeOperation=blend;
  ctx.globalAlpha=alpha;
  ctx.fillStyle=pattern;
  ctx.fillRect(area.left,area.top,area.right-area.left,area.bottom-area.top);
  ctx.restore();
}

function createTrayLayer(area=SCENE,ratio=1.45) {
  const {canvas,ctx}=sceneLayer(ratio,area);
  const {canvas:foreground,ctx:near}=sceneLayer(ratio,area);
  const occlusions=[];
  const {lip,floor,base}=TRAY;
  const outer=OUTLINE.map(([x,y])=>[x,y,lip]);
  const inner=BED.map(([x,y])=>[x,y,lip]);
  const sand=BED.map(([x,y])=>[x,y,floor]);
  const foot=OUTLINE.map(([x,y])=>[x,y,base]);
  const shownFromFront=OUTLINE.map(([x,y],i)=>{
    const [nx,ny]=OUTLINE[(i+1)%OUTLINE.length];
    return (ny-y)*SIN_YAW-(nx-x)*COS_YAW>0;
  });

  ctx.save();
  ctx.shadowColor='#152411aa';
  ctx.shadowOffsetX=15;
  ctx.shadowOffsetY=25;
  ctx.shadowBlur=34;
  worldShape(ctx,foot);
  ctx.fillStyle='#283318';
  ctx.fill();
  ctx.restore();

  worldShape(ctx,sand);
  ctx.fillStyle=ramp(ctx,project(0,0),project(WIDTH,HEIGHT),[[0,'#dbb47d'],[.4,'#eac78e'],[.76,'#e4bc80'],[1,'#d3a269']]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  fillTexture(ctx,sandTexture,area,.42,.285,'source-over',.73);
  const sunlight=ctx.createRadialGradient(440,183,24,542,345,520);
  sunlight.addColorStop(0,'#ffe8b63d');
  sunlight.addColorStop(1,'#ffe8b600');
  ctx.fillStyle=sunlight;
  ctx.fillRect(SCENE.left,SCENE.top,SCENE.right-SCENE.left,SCENE.bottom-SCENE.top);
  const grainSpacing=sandTexture?6.55:2.65;
  for(let x=-75;x<WIDTH+75;x+=grainSpacing) {
    for(let y=-104;y<HEIGHT+105;y+=grainSpacing) {
      const u=Math.floor(x),v=Math.floor(y);
      const random=hash(u+29,v+41);
      if(random<.29) continue;
      const at=project(x+hash(u,7)*1.8,y+hash(v,u)*1.7,floor);
      if(at.x<area.left||at.x>area.right||at.y<area.top||at.y>area.bottom) continue;
      ctx.fillStyle=random>.64?'#ffeebe57':'#7e522530';
      const grain=hash(u-12,v-5)*1.2+.42;
      ctx.fillRect(at.x,at.y,grain,grain*.75);
    }
  }
  drawSandRelief(ctx,area);
  sandRakeLines(ctx,354,644,.09,124,5);
  sandRakeLines(ctx,547,664,-.04,104,6);
  sandRakeLines(ctx,817,630,-.19,94,4);
  sandRakeLines(ctx,154,129,.11,94,4);
  for(const [i,a] of sand.entries()) {
    const b=sand[(i+1)%sand.length];
    const inward=([x,y,z])=>[lerp(x,WIDTH/2,.18),lerp(y,HEIGHT/2,.18),z];
    const next=inward(b);
    const near=inward(a);
    worldShape(ctx,[a,b,next,near]);
    ctx.fillStyle=ramp(ctx,point(a),point(near),[[0,shownFromFront[i]?'#85573569':'#73472591'],[1,'#80512d00']]);
    ctx.fill();
  }
  ctx.restore();

  for(const [i,a] of inner.entries()) {
    if(shownFromFront[i]) continue;
    const j=(i+1)%inner.length;
    worldShape(ctx,[a,inner[j],sand[j],sand[i]]);
    ctx.fillStyle=ramp(ctx,point(a),point(sand[i]),[[0,'#a17049'],[.72,'#825436'],[1,'#623f28']]);
    ctx.fill();
    strokeLine(ctx,[sand[i],sand[j]],'#643a2066',1.5);
  }

  for(const [i,a] of outer.entries()) {
    if(!shownFromFront[i]) continue;
    const j=(i+1)%outer.length;
    const panel=[
      [[0,'#a87850'],[.2,'#9e683e'],[.75,'#82512f'],[1,'#594126']],
      [[0,'#d3a36c'],[.19,'#c08b51'],[.77,'#986338'],[1,'#795031']],
      [[0,'#c4925e'],[.2,'#b27d4b'],[.78,'#946234'],[1,'#6e472a']]
    ][i-2];
    const face=[a,outer[j],foot[j],foot[i]];
    woodBoard(near,face,true,panel,521+i*121);
    occlusions.push(face.map(point));
    const atHeight=z=>[a,outer[j]].map(([x,y])=>[x,y,z]);
    strokeLine(near,atHeight(lip-4),'#f8cd8a8f',1.35);
    strokeLine(near,atHeight(base+8),'#633719a6',1.6);
    strokeLine(near,atHeight(base),'#4f301fba',2.25);
    strokeLine(near,[a,foot[i]],'#603b24af',1.4);
  }

  const woodStyles=[
    [[0,'#f0c084'],[.27,'#d6a56b'],[.8,'#bf874f'],[1,'#e6ae6e']],
    [[0,'#d0975d'],[.17,'#e8b47a'],[.72,'#c39058'],[1,'#b77d49']],
    [[0,'#efbd80'],[.25,'#d9a46d'],[.72,'#c08b52'],[1,'#b78452']],
    [[0,'#f1c788'],[.25,'#dcaa70'],[.72,'#d39e63'],[1,'#b78452']],
    [[0,'#deaa70'],[.38,'#f1c487'],[.76,'#dca86e'],[1,'#c58f59']],
    [[0,'#e6b57a'],[.32,'#edbd86'],[.76,'#d5a06b'],[1,'#c48a53']]
  ];
  for(const [i,a] of outer.entries()) {
    const j=(i+1)%outer.length;
    const surface=shownFromFront[i]?near:ctx;
    const rail=[a,outer[j],inner[j],inner[i]];
    woodBoard(surface,rail,true,woodStyles[i],194+i*121);
    strokeLine(surface,[a,outer[j]],'#fff1c4bc',1.65);
    strokeLine(surface,[inner[i],inner[j]],'#ffe1a083',1.55);
    if(shownFromFront[i]) occlusions.push(rail.map(point));
  }
  for(const [i,[x,y]] of OUTLINE.entries()) {
    const [ix,iy]=BED[i];
    const previous=(i+OUTLINE.length-1)%OUTLINE.length;
    nail(shownFromFront[i]||shownFromFront[previous]?near:ctx,(x+ix)/2,(y+iy)/2);
  }
  shovel(ctx,TOYS.shovel.x,TOYS.shovel.y+32);
  bucket(ctx,TOYS.bucket.x,TOYS.bucket.y+31);
  rake(ctx,TOYS.rake.x,TOYS.rake.y);
  truck(ctx,TOYS.truck.x,TOYS.truck.y+5);
  return {backdrop:canvas,foreground,occlusions};
}

function loadTexture(file) {
  const image=new Image();
  image.src=new URL(file,import.meta.url);
  return image.decode().then(()=>image).catch(()=>null);
}

let sandTexture=null;
let artRevision=0;
let sceneArt={tray:createTrayLayer(),area:SCENE};
const assetsReady=loadTexture('./sand.jpg').then(sand=>{
  if(!sand) return;
  sandTexture=sand;
  artRevision++;
  sceneArt={tray:createTrayLayer(),area:SCENE};
});
const [logos,brandColors]=await Promise.all(['./logos/manifest.json','./brand-colors.json'].map(path=>
  fetch(new URL(path,import.meta.url))
    .then(response=>response.ok ? response.json() : {})
    .catch(()=>({}))
));

function tilePlane(tile,z,scale) {
  return Array.from({length:6},(_,index)=>{
    const theta=index*Math.PI/3;
    return project(tile.x+SIZE*scale*Math.cos(theta),tile.y+SIZE*scale*Math.sin(theta),z);
  });
}

const visibleSides=[0,1,2];
const sideShade=[-22,-34,-13];

export class Board {
  constructor(elements,companies,callbacks) {
    this.elements=elements;
    this.callbacks=callbacks;
    this.ctx=elements.canvas.getContext('2d');
    this.tiles=tilesOnLand();
    for(const tile of this.tiles) {
      const grain=noise(tile.x/174+5,tile.y/141+3);
      const hill=clamp(heightAt(tile.x,tile.y)*.9 + (grain-.5)*.15,0,.86);
      const tiers=Math.floor(hill*7);
      tile.elevation=TRAY.floor+7+tiers*6.1;
      tile.top=tilePlane(tile,tile.elevation,.94);
      tile.shoulder=tilePlane(tile,tile.elevation-2.4,.987);
      tile.base=tilePlane(tile,TRAY.floor+.1,.987);
      tile.shadow=tile.base.map(({x,y})=>({x:x+3.4,y:y+4.5}));
      tile.sides=visibleSides.map(side=>{
        const next=(side+1)%6;
        return [tile.shoulder[side],tile.shoulder[next],tile.base[next],tile.base[side]];
      });
      tile.bounds=bounds([...tile.top,...tile.shoulder,...tile.sides.flat()]);
      tile.depth=depthAt(tile.x,tile.y);
      tile.screen=project(tile.x,tile.y,tile.elevation);
    }
    this.depthOrder=[...this.tiles].sort((a,b)=>a.depth-b.depth || a.x-b.x);
    this.frontOrder=this.depthOrder.toReversed();
    this.logoSeats=this.tiles.map(tile=>{
      if(this.projectedTileAt(tile.screen)===tile) return tile.screen;
      return tile.top.map(point=>({x:lerp(tile.screen.x,point.x,.7),y:lerp(tile.screen.y,point.y,.7)}))
        .find(point=>this.projectedTileAt(point)===tile);
    });
    this.sites=makeSites(companies,this.tiles);
    this.siteList=[...this.sites.values()];
    this.home=new Map(this.siteList.map(site=>[site.index,site.company.id]));
    this.layoutCache=new Map();
    this.logoAnchorCache=new WeakMap();
    this.logoAnchors=new Map();
    this.pulses=new Set();
    this.camera={...ORIGIN,z:MIN_ZOOM};
    this.activityTiles=[];
    this.activityCursor=0;
    this.category='all';
    this.terrainFrame=document.createElement('canvas');
    this.terrainContext=this.terrainFrame.getContext('2d');
    this.terrainRevision=0;
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
    this.labelNodes=new Map();
    this.markerNodes=new Map();
    this.bind();
    new ResizeObserver(()=>{
      this.draw();
      this.scheduleActivity();
    }).observe(elements.stage);
    assetsReady.then(()=>this.draw());
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

  setLayout(layout,category,flash=new Set()) {
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
        const {x,y}=this.tiles[index].screen;
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
        const point=this.logoSeats[index];
        if(!point) continue;
        const distance=range(point,centroid);
        if(distance<nearest) {
          seat=point;
          nearest=distance;
        }
      }
      if(seat) anchors.set(owner,{screen:seat,size:component.length});
    }
    this.logoAnchorCache.set(layout,anchors);
    return anchors;
  }

  paintTiles(ctx,area) {
    if(!this.owners) return;
    const included=this.depthOrder.filter(({bounds})=>bounds.left<area.right+5&&bounds.right>area.left-5&&bounds.top<area.bottom+6&&bounds.bottom>area.top-6);
    ctx.lineJoin='round';
    ctx.fillStyle='#75441f26';
    for(const tile of included) {
      polygon(ctx,tile.shadow);
      ctx.fill();
    }
    for(const tile of included) {
      const owner=this.owners[tile.index];
      const site=this.sites.get(owner);
      const active=this.selected===owner;
      const dim=this.category!=='all' && this.category!==site.company.category;
      const shade=(hash(tile.index,47)-.5)*12;
      const base=dim ? site.color.map((value,index)=>lerp(value,[218,185,134][index],.74)) : site.color;
      const top=tile.top;
      for(const [index,side] of tile.sides.entries()) {
        polygon(ctx,side);
        ctx.fillStyle=ramp(ctx,side[0],side[3],[[0,color(base,shade+sideShade[index])],[1,color(base,shade+sideShade[index]-24)]]);
        ctx.fill();
        ctx.strokeStyle='#6c472551';
        ctx.lineWidth=.6;
        ctx.stroke();
      }
      polygon(ctx,tile.shoulder);
      ctx.fillStyle=color(base,shade-16);
      ctx.fill();
      polygon(ctx,top);
      ctx.fillStyle=ramp(ctx,top[4],top[1],[[0,color(base,shade+22)],[.48,color(base,shade+6)],[1,color(base,shade-4)]]);
      ctx.fill();
      ctx.strokeStyle=color(base,43,.7);
      ctx.lineWidth=1;
      ctx.stroke();

      const p=tile.screen;
      for(let i=0;i<7;i++) {
        const x=(hash(tile.index+20,i+231)-.5)*16;
        const y=(hash(i+63,tile.index+104)-.5)*10;
        ctx.fillStyle=i%2===0?'#fff5c72c':'#50391e21';
        ctx.fillRect(p.x+x,p.y+y,1,1);
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
    if(this.terrainKey!==key) {
      this.terrainKey=key;
      if(frame.width!==pixelWidth||frame.height!==pixelHeight) {
        frame.width=pixelWidth;
        frame.height=pixelHeight;
      }
      const ctx=this.terrainContext;
      ctx.setTransform(1,0,0,1,0,0);
      ctx.clearRect(0,0,pixelWidth,pixelHeight);
      ctx.setTransform(zoom*scale,0,0,zoom*scale,dx*scale,dy*scale);
      this.paintTiles(ctx,{left:-dx/zoom,top:-dy/zoom,right:(width-dx)/zoom,bottom:(height-dy)/zoom});
    }
    this.ctx.save();
    this.ctx.setTransform(1,0,0,1,0,0);
    this.ctx.drawImage(frame,0,0);
    this.ctx.restore();
  }

  animateFlash() {
    if(this.flashFrame || motionReduced.matches) return;
    const tick=()=>{
      this.flashFrame=null;
      this.draw(false);
      if(this.pulses.size && !document.hidden && performance.now()-this.flashStart<770) {
        this.flashFrame=requestAnimationFrame(tick);
      }
    };
    this.flashFrame=requestAnimationFrame(tick);
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
    return this.activityTiles.length && !motionReduced.matches && !document.hidden && this.elements.stage.clientWidth>0;
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
    const fill=width<670 ? 1.056 : 1.015;
    const fit=Math.min(width/(SCENE.right-SCENE.left),height/(SCENE.bottom-SCENE.top));
    const zoom=fit*fill*this.camera.z;
    return {width,height,zoom,dx:width/2-this.camera.x*zoom,dy:height/2-this.camera.y*zoom};
  }

  backdrop(view,scale) {
    const ratio=scale*view.zoom;
    if(ratio<=1.55) return sceneArt;
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
    const scale=Math.min(devicePixelRatio,2);
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
    this.drawTerrain(v,scale);
    const opacity=motionReduced.matches ? 0 : Math.max(0,1-(performance.now()-this.flashStart)/770);
    if(this.pulses.size && opacity>0) {
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
      this.elements.stage.classList.toggle('is-zoomed',this.camera.z>MIN_ZOOM+.01);
      this.placeTokens(v);
      this.callbacks.placed?.();
    }
  }

  placeTokens(v) {
    if(!v.width) return;
    const screen=(entry)=>({x:v.dx+entry.screen.x*v.zoom,y:v.dy+entry.screen.y*v.zoom});
    const inside=(at,padding=14)=>at.x>padding && at.x<v.width-padding && at.y>padding && at.y<v.height-padding &&
      !sceneArt.tray.occlusions.some(face=>contains(face,(at.x-v.dx)/v.zoom,(at.y-v.dy)/v.zoom));
    const occupied=[];
    const compact=v.width<650;
    const sites=[...this.siteList].sort((a,b)=>this.sitePriority(a)-this.sitePriority(b));
    for(const site of sites) {
      const id=site.company.id;
      const key=KEY_IDS.includes(id);
      const selected=this.selected===id;
      const anchor=this.logoAnchors.get(id);
      const at=anchor && screen(anchor);
      const radius=compact?(key?13:10):(key?17:13);
      const mayShow=at && inside(at) && (this.category==='all'||this.category===site.company.category)
        && (selected||key||!compact||this.camera.z>1.32);
      const overlaps=mayShow && occupied.some(seat=>range(seat,at)<seat.radius+radius+2);
      let node=this.labelNodes.get(id);
      if(mayShow && (!overlaps||selected)) {
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
    for(const {node,event} of this.markerNodes.values()) {
      const site=this.sites.get(event.company);
      const origin=screen(site);
      const border=this.callbacks.eventAnchor(event);
      const currentAnchor=border && this.tiles[border.index];
      const positions=currentAnchor ? [screen(currentAnchor)] : [];
      positions.push(...candidates.map(([x,y])=>({x:origin.x+x,y:origin.y+y})));
      const focused=node.classList.contains('is-selected');
      const at=positions.find(p=>inside(p,16) &&
        !occupied.some(label=>range(label,p)<label.radius+8) &&
        !flagSeats.some(seat=>range(seat,p)<(compact?18:25))) ||
        (focused&&inside(origin) ? {x:origin.x+20,y:origin.y-15} : null);
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
    return this.frontOrder.find(tile=>{
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

  move(target,animate=true) {
    return this.travelTo(target,animate);
  }

  resetView() {
    return this.travelTo({...ORIGIN,z:MIN_ZOOM},false);
  }

  zoomBy(factor,anchor,destination=anchor) {
    if(!Number.isFinite(factor)||factor<=0) return this.camera.z;
    const current=this.camera;
    const z=clamp(current.z*factor,MIN_ZOOM,MAX_ZOOM);
    if(z===MIN_ZOOM) return current.z===z ? z : this.resetView();
    if(z===current.z && (!anchor || (anchor.x===destination.x&&anchor.y===destination.y))) return z;
    let {x,y}=current;
    if(anchor) {
      const view=this.viewport();
      const zoom=view.zoom*z/current.z;
      x+=(anchor.x-view.width/2)/view.zoom-(destination.x-view.width/2)/zoom;
      y+=(anchor.y-view.height/2)/view.zoom-(destination.y-view.height/2)/zoom;
    }
    return this.travelTo({x,y,z},false);
  }

  travelTo(target,animate=true) {
    cancelAnimationFrame(this.travel);
    const z=clamp(target.z,MIN_ZOOM,MAX_ZOOM);
    const camera=z===MIN_ZOOM ? {...ORIGIN,z} : {
      x:clamp(target.x,trayBounds.left+58,trayBounds.right-58),
      y:clamp(target.y,trayBounds.top+52,trayBounds.bottom-56),z
    };
    if(!animate||motionReduced.matches) {
      this.camera=camera;
      this.draw();
      return z;
    }
    const before=this.camera;
    const start=performance.now();
    const tick=time=>{
      const progress=clamp((time-start)/290);
      const ease=1-(1-progress)**3;
      this.camera={x:lerp(before.x,camera.x,ease),y:lerp(before.y,camera.y,ease),z:lerp(before.z,camera.z,ease)};
      this.draw();
      if(progress<1) this.travel=requestAnimationFrame(tick);
    };
    this.travel=requestAnimationFrame(tick);
    return z;
  }

  bind() {
    const {stage}=this.elements;
    let drag=null;
    const touches=new Map();
    let pinch=null;
    let pinchFrame=null;
    let wheelDelta=0;
    let wheelAnchor;
    let wheelFrame;
    stage.tabIndex=0;
    const onMotionChange=()=>{
      if(document.hidden||motionReduced.matches) this.stopActivity();
      else this.scheduleActivity();
    };
    const pointer=event=>({x:event.clientX,y:event.clientY});
    const startDrag=(id,{x,y})=>{
      drag={id,x,y,camera:this.camera,zoom:this.viewport().zoom,moved:false};
    };
    const measurePinch=()=>{
      const [a,b]=touches.values();
      const box=stage.getBoundingClientRect();
      return {
        center:{x:(a.x+b.x)/2-box.left,y:(a.y+b.y)/2-box.top},
        span:Math.max(8,range(a,b))
      };
    };
    const updatePinch=()=>{
      pinchFrame=null;
      const next=measurePinch();
      const previous=pinch.last;
      if(!pinch.active && Math.abs(next.span-previous.span)<5 && range(next.center,previous.center)<5) return;
      pinch.active=true;
      pinch.last=next;
      stage.classList.add('dragging');
      this.zoomBy(next.span/previous.span,previous.center,next.center);
    };
    document.addEventListener('visibilitychange',onMotionChange);
    motionReduced.addEventListener('change',onMotionChange);
    this.elements.canvas.addEventListener('pointermove',event=>{
      if(drag||event.pointerType==='touch') return;
      const box=stage.getBoundingClientRect();
      const id=this.ownerAt(event.clientX-box.left,event.clientY-box.top);
      stage.classList.toggle('on-tile',Boolean(id));
    });
    stage.addEventListener('pointerdown',event=>{
      if(event.button!==0) return;
      if(event.pointerType==='touch') {
        if(drag&&!touches.size) return;
        touches.set(event.pointerId,pointer(event));
        if(touches.size>=2) {
          event.preventDefault();
          if(pinch?.last) {
            stage.setPointerCapture(event.pointerId);
            return;
          }
          for(const id of touches.keys()) stage.setPointerCapture(id);
          cancelAnimationFrame(this.travel);
          drag=null;
          stage.classList.remove('dragging');
          pinch={last:measurePinch(),active:false};
          return;
        }
      } else if(touches.size) return;
      if(drag||event.target.closest('button')) return;
      cancelAnimationFrame(this.travel);
      startDrag(event.pointerId,pointer(event));
      stage.setPointerCapture(event.pointerId);
    });
    stage.addEventListener('pointermove',event=>{
      if(touches.has(event.pointerId)) {
        touches.set(event.pointerId,pointer(event));
        if(pinch?.last) {
          if(pinchFrame===null) pinchFrame=requestAnimationFrame(updatePinch);
          return;
        }
      }
      if(!drag||drag.id!==event.pointerId) return;
      const x=event.clientX-drag.x;
      const y=event.clientY-drag.y;
      if(Math.hypot(x,y)>5) drag.moved=true;
      if(!drag.moved || drag.camera.z<=MIN_ZOOM) return;
      stage.classList.add('dragging');
      this.travelTo({x:drag.camera.x-x/drag.zoom,y:drag.camera.y-y/drag.zoom,z:drag.camera.z},false);
    });
    const finishPointer=event=>{
      if(event.type==='lostpointercapture' && (event.target!==stage || stage.hasPointerCapture(event.pointerId))) return;
      if(touches.has(event.pointerId)) {
        if(pinchFrame!==null) {
          cancelAnimationFrame(pinchFrame);
          pinchFrame=null;
          if(event.type==='pointerup') updatePinch();
        }
        touches.delete(event.pointerId);
        if(pinch) {
          if(touches.size>=2) {
            pinch.last=measurePinch();
          } else {
            stage.classList.remove('dragging');
            const remaining=touches.entries().next().value;
            if(remaining) {
              pinch.last=null;
              startDrag(...remaining);
            } else {
              pinch=null;
              drag=null;
            }
          }
          return;
        }
      }
      if(drag?.id!==event.pointerId) return;
      if(event.type==='pointerup'&&!drag.moved) {
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
      if(!event.deltaY || Math.abs(event.deltaX)>Math.abs(event.deltaY)) return;
      event.preventDefault();
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
      const directions={ArrowLeft:[-40,0],ArrowRight:[40,0],ArrowUp:[0,-35],ArrowDown:[0,35]};
      const offset=directions[event.key];
      if(offset) {
        event.preventDefault();
        this.travelTo({...this.camera,x:this.camera.x+offset[0],y:this.camera.y+offset[1]});
      } else if(['+','=','-','0'].includes(event.key)) {
        event.preventDefault();
        if(event.key==='0') this.resetView();
        else this.zoomBy(event.key==='-'?1/1.36:1.36);
      }
    });
  }
}
