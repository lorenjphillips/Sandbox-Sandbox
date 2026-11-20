import { face, join, solid, compile, draw, shadow } from './board-models.js';

const TAU = 2 * Math.PI;
const plus = (p, axis, d) => p.map((v,i) => v + axis[i]*d);
const unit = v => v.map(n => n / Math.hypot(...v));
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const difference = (a,b) => a.map((v,i) => v-b[i]);

function loop(count, point) {
  return Array.from({length:count}, (_,i) => point(i*TAU/count, i));
}

function basis(direction) {
  const axis = unit(direction);
  const side = unit(cross(Math.abs(axis[2]) > .95 ? [0,1,0] : [0,0,1], axis));
  return [side, cross(axis,side)];
}

function around(center, basis, angle, radius) {
  return plus(plus(center,basis[0],radius*Math.cos(angle)), basis[1],radius*Math.sin(angle));
}

function spindle(mesh, from, to, sections, count) {
  const axis = difference(to,from), frame = basis(axis);
  let previous;
  for (const [t,r,color] of sections) {
    const center = plus(from,axis,t);
    const ring = loop(count, a => around(center,frame,a,r));
    if (previous) join(mesh,previous,ring,color);
    else face(mesh,ring.slice().reverse(),color);
    previous = ring;
  }
  face(mesh,previous,sections.at(-1)[2]);
}

function rod(mesh, from, to, r1, r2, color, count = 8) {
  spindle(mesh,from,to,[[0,r1,color],[1,r2,color]],count);
}

function bevelRing(x,y,z,rx,ry,b) {
  return [[-rx+b,-ry],[rx-b,-ry],[rx,-ry+b],[rx,ry-b],
    [rx-b,ry],[-rx+b,ry],[-rx,ry-b],[-rx,-ry+b]].map(([u,v]) => [x+u,y+v,z]);
}

function block(mesh, x,y,z,rx,ry,height,bevel,color) {
  solid(mesh,bevelRing(x,y,z,rx,ry,bevel),bevelRing(x,y,z+height,rx,ry,bevel),color);
}

function turned(mesh, yaw) {
  const result = [], c = Math.cos(yaw), s = Math.sin(yaw);
  for (const f of mesh) {
    const spin = ([x,y,z]) => [c*x-s*y,s*x+c*y,z];
    result.push({...f, normal:spin(f.normal), points:f.points.map(spin)});
  }
  return result;
}

function aboveSand(mesh) {
  const result = [];
  for (const f of mesh) {
    if (f.points.every(p => p[2] >= 0)) {
      result.push(f);
      continue;
    }
    const points = [];
    f.points.forEach((p,i) => {
      const q = f.points[(i+1)%f.points.length];
      if (p[2] >= 0) points.push(p);
      if (p[2]*q[2] < 0) points.push(plus(p,difference(q,p),p[2]/(p[2]-q[2])));
    });
    if (points.length >= 3) result.push({...f,points});
  }
  return result;
}

function sandDrift(mesh,x,y,rx,ry,height) {
  const base = loop(10,a => [x+rx*Math.cos(a),y+ry*Math.sin(a),.04]);
  const slope = loop(10,a => [x+.51*rx*Math.cos(a),y+.48*ry*Math.sin(a),height*(.71+.15*Math.cos(2*a+.4))]);
  join(mesh,base,slope,'#dec7a3');
  for(let i=0;i<slope.length;i++) face(mesh,[slope[i],slope[(i+1)%slope.length],[x-.12*rx,y+.06*ry,height]],'#e7d1ad');
}

function wormMesh() {
  const mesh = [], sides = 16;
  const center = t => [23-46*t+10*t*t,-4-6*t+16*t*t,-5+27*t-8*t*t];
  const tangent = t => [-46+20*t,-6+32*t,27-16*t];
  const frame = t => basis(tangent(t));
  const wormRing = (t,r) => loop(sides, a => around(center(t),frame(t),a,r*(1+.035*Math.cos(3*a+.4))));
  let previous = wormRing(0,5.6);
  for (let i=0;i<8;i++) {
    const t = i/8, r = 6.6 + 4*t;
    for (const [dt,rad,color] of [[.028,r+.75,'#d1ae81'],[.058,r+.85,'#c6a078'],
      [.115,r-.1,i%2 ? '#ad8b67' : '#b4936d'],[.125,r-.25,'#81674f']]) {
      const next = wormRing(t+dt,rad);
      join(mesh,previous,next,color);
      previous = next;
    }
  }
  const head = center(1), axes = frame(1), forward = unit(tangent(1));
  const mouth = (a,z,r) => around(plus(head,forward,z),axes,a,r*(1+.055*Math.cos(3*a+.4)));
  for (const [z,r,color] of [[.7,11.1,'#cba57b'],[2.3,11.6,'#dbb88a'],[3.4,10.9,'#ebc99a'],
    [3.25,9.3,'#b89067'],[1.6,8.3,'#805d47'],[-1.4,6.1,'#594034'],[-4,3.5,'#3b2e2a']]) {
    const next = loop(sides,a => mouth(a,z,r));
    join(mesh,previous,next,color);
    previous = next;
  }
  face(mesh,previous,'#2c2422');
  for (let row=0;row<2;row++) {
    const count = row ? 17 : 25, r = row ? 6.25 : 8.95, z = row ? -.9 : 2.9;
    for (let i=0;i<count;i++) {
      const a = TAU*(i+.5*row)/count;
      const l = mouth(a-.078,z,r), h = mouth(a+.078,z,r);
      const ridge = mouth(a,z+.45,r-.28);
      const tip = mouth(a+.07,z-(row?.9:1.65),r-(row?1.4:2.4)-.3*Math.sin(4*a));
      face(mesh,[l,h,ridge], '#dcc39e');
      face(mesh,[l,ridge,tip], '#e7d4ae');
      face(mesh,[ridge,h,tip], '#bfa17e');
    }
  }
  sandDrift(mesh,19,-4.2,11.3,7.6,1.7);
  sandDrift(mesh,11,2.8,5.6,2.9,1.15);
  return aboveSand(mesh);
}

function figureMesh() {
  const mesh = [];
  for (const sign of [-1,1]) {
    const footX = sign*4.8, knee = [sign*3.6,sign*1.5,11];
    const ankle = [footX,sign*2.7,4];
    block(mesh,footX,ankle[1]+1.35,.2,2.65,3.8,3.1,.85,'#45372f');
    rod(mesh,ankle,knee,2.15,2.7,'#4d3c32');
    rod(mesh,[knee[0],knee[1],9.1],[knee[0],knee[1],10.8],2.8,2.8,'#6b5140');
    rod(mesh,knee,[sign*2.7,-.4,20],2.45,3,'#5c483b');
  }

  const hem = bevelRing(0,-.3,16.4,6.65,4,1.5);
  const waist = bevelRing(0,0,23.3,4.9,3.45,1.1);
  const shoulders = bevelRing(0,-.2,32.3,6.4,3.6,1.35);
  solid(mesh,hem,waist,'#6d5140');
  solid(mesh,waist,shoulders,'#775841');
  const belt = bevelRing(0,0,22.15,5.32,3.7,1.22);
  solid(mesh,belt,bevelRing(0,0,24.15,5.27,3.7,1.22),'#44372f');
  block(mesh,-.4,3.76,22.55,1.19,.2,1.25,.14,'#c4a072');

  face(mesh,[[-5.05,3.5,32.5],[-2.6,3.5,32.7],[2.15,3.56,26.9],[.55,3.57,25.2]],'#4b3931');
  face(mesh,[[2.70,3.62,32.7],[5.12,3.63,32.45],[-1.32,3.69,24.35],[-4.25,3.69,24.35]],'#594337');
  rod(mesh,[0,-.25,31.8],[0,-.25,36.1],2.2,2.4,'#bd936c');

  const jaw = bevelRing(0,.3,35.15,3.15,2.8,1.2);
  const cheek = bevelRing(0,.3,38.2,4.4,3.35,1.22);
  const brow = bevelRing(0,.2,42.3,4.4,3.55,1.28);
  solid(mesh,jaw,cheek,'#cea17a');
  solid(mesh,cheek,brow,'#d7ab82');
  for (const s of [-1,1]) {
    const eye = [[s*1.1,3.75,39.65],[s*2.55,3.75,39.7],[s*2.4,3.76,40.14],[s*1.12,3.76,40.03]];
    face(mesh,s>0?eye.reverse():eye,'#584639');
  }
  face(mesh,[[-.62,3.7,38.02],[.55,3.7,38.02],[0,4.48,38.65]].reverse(),'#c79a73');
  let lastHair = loop(12,(a,i) => {
    const fringe = Math.max(0,Math.sin(a));
    return [4.66*Math.cos(a),.1+3.95*Math.sin(a),36.6+fringe*4.9+.55*Math.sin(3*a)+.3*(i%2)];
  });
  for (const [z,rx,ry] of [[42.1,5.05,4.25],[44.35,4.5,3.42],[45.8,2.8,2.4]]) {
    const ring = loop(12,(a,i) => [-.5+rx*Math.cos(a),-.12+ry*Math.sin(a),z+.42*Math.sin(2*a)+.2*(i%2)]);
    for(let i=0;i<ring.length;i++) {
      const j=(i+1)%ring.length;
      face(mesh,[lastHair[i],lastHair[j],ring[j],ring[i]],['#73523d','#866044','#78553d'][i%3]);
    }
    lastHair = ring;
  }
  const crown = [-.55,-.25,46.45];
  for(let i=0;i<lastHair.length;i++) face(mesh,[lastHair[i],lastHair[(i+1)%lastHair.length],crown],'#956e4b');

  const leftShoulder = [-5.65,0,30.4], leftElbow = [-8,-.2,24.85], leftWrist = [-8.35,1.7,20.4];
  rod(mesh,leftElbow,leftShoulder,2.45,3.25,'#71533f');
  rod(mesh,leftWrist,leftElbow,2.65,2.3,'#684d3c');
  rod(mesh,[-8.4,1.85,18.45],leftWrist,1.6,1.83,'#c69b75');
  const rightShoulder = [5.6,-.1,30.35], elbow = [8.9,.4,25.8], wrist = [11.2,4.25,30.1];
  rod(mesh,elbow,rightShoulder,2.35,3.16,'#614a3c');
  rod(mesh,elbow,wrist,2.3,2.45,'#5c473a');
  const grip = [11.55,5.0,30.8], axis = unit([.45,.03,.92]);
  const along = d => plus(grip,axis,d);
  spindle(mesh,along(-3),along(4.2),[[0,1.2,'#909891'],[.12,1.43,'#c8cbb9'],[.19,1.16,'#6a716d'],
    [.62,1.16,'#747c77'],[.7,1.38,'#babeb4'],[.82,1.22,'#656e6a'],[1,1.51,'#bec7bf']],10);
  rod(mesh,wrist,[11.5,5.65,31.3],1.75,1.65,'#493a31');
  spindle(mesh,along(4.2),along(28.8),[[0,1.18,'#73c6ec'],[.93,1.12,'#a9ecff'],[.99,.84,'#caf6ff'],[1,.32,'#effdff']],10);
  return mesh;
}

const radioYaw = -.24;

function radioMesh() {
  const mesh = [];
  const box = (x,y,z,rx,ry,h,b,color) => block(mesh,x,y,z,rx,ry,h,b,color);
  const sole = bevelRing(0,0,.3,17.6,4.8,1.25);
  const heel = bevelRing(0,0,1.9,18.6,5.65,1.1);
  const shoulder = bevelRing(0,0,16.2,18.6,5.65,1.1);
  const lid = bevelRing(0,0,17.6,17.8,4.95,1.1);
  solid(mesh,sole,heel,'#667769');
  join(mesh,heel,shoulder,'#8b9d8f');
  join(mesh,shoulder,lid,'#a7b3a2');
  face(mesh,lid,'#a7b3a2');
  for (const s of [-1,1]) {
    const x = s*12.5;
    spindle(mesh,[x,5.58,8.25],[x,6.62,8.25],[[0,4.95,'#526258'],[.46,5.12,'#647567'],
      [.83,4.73,'#67786a'],[1,4.32,'#46564a']],16);
    for(let i=-2;i<=2;i++) {
      const z = 8.25+1.46*i, half = Math.sqrt(3.95**2-(i*1.46)**2);
      box(x,6.65,z-.25,half,.12,.48,.09,'#889587');
    }
    box(s*10.15,-.45,17.55,1.3,1.18,5.05,.38,'#535f54');
    box(s*10.15,-.45,16.95,1.74,1.58,1.34,.4,'#748273');
  }
  box(0,-.45,22.08,11.4,1.18,2.12,.58,'#546055');
  for(let i=0;i<5;i++) box(-5.4+i*2.7,2.65,17.5,1.08,.88,.86,.2,i===4?'#bd795d':'#68766a');

  box(0,5.72,2.9,6.72,.3,7.05,.19,'#536456');
  box(0,6.05,3.5,6.18,.15,5.91,.11,'#b0baaa');
  box(0,6.24,5.3,4.98,.09,2.98,.07,'#57675c');
  for(const x of [-2.68,2.68]) spindle(mesh,[x,6.27,6.75],[x,6.44,6.75],[[0,1.0,'#d2cbb1'],
    [.7,1.0,'#d2cbb1'],[1,.42,'#657267']],10);
  box(0,5.68,11.55,8.25,.14,3.4,.1,'#e4cba1');
  box(-2,-5.65,3.45,9.6,.15,7.05,.12,'#788a7b');
  box(-2,-5.84,4,9.05,.09,5.97,.07,'#899a8a');
  for (let i=0;i<5;i++) box(11.5,-5.73,5+i*1.4,2.35,.11,.55,.08,'#596d60');
  rod(mesh,[-13.7,-2.45,18.05],[-18.75,-2.42,25.3],.46,.3,'#b4bbaa');
  rod(mesh,[-18.78,-2.42,25.25],[-19.13,-2.42,25.82],.48,.48,'#778478');
  sandDrift(mesh,12.2,4.45,7.9,3.7,2.2);
  return turned(mesh,radioYaw);
}

function radioLabel(ctx,x,y,floor,camera) {
  const c = Math.cos(radioYaw), s = Math.sin(radioYaw);
  if ((-s*camera.sine+c*camera.cosine)*camera.up < .12) return;
  const front = 5.85;
  const point = (u,z) => camera.project(x+u*c-front*s,y+u*s+front*c,floor+z);
  const p = point(0,12.17), right = point(1,12.17), down = point(0,11.17);
  ctx.transform(right.x-p.x,right.y-p.y,down.x-p.x,down.y-p.y,p.x,p.y);
  ctx.font='bold 2.6px sans-serif';
  ctx.textAlign='center';
  ctx.fillStyle='#514d3d';
  ctx.fillText('SANDSTORM',0,0,15);
}

function egg(faces,rx,ry,detail) {
  const model = compile(faces);
  function paintWorld(ctx,x,y,floor,camera) {
    ctx.save();
    shadow(ctx,x,y,floor,camera,rx,ry);
    draw(ctx,x,y,floor,camera,model);
    if(detail) detail(ctx,x,y,floor,camera);
    ctx.restore();
  }
  return {model,paintWorld};
}

export const eggModels = {
  worm:egg(wormMesh(),24,12),
  anakin:egg(figureMesh(),12,7),
  radio:egg(radioMesh(),20,8,radioLabel)
};
