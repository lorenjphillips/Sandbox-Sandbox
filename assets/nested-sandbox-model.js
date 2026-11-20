import { compile, draw, face, join, shadow, solid } from './board-models.js';

const radius = 21.7;
const halfDepth = radius * Math.sqrt(3) / 2;
const rimHeight = 5.7;
const hingeY = -halfDepth - .9;
const hingeZ = 1.25;
const lidThickness = 2.0;

function hex(radius, z, x = 0, y = 0) {
  const half = radius / 2, depth = radius * Math.sqrt(3) / 2;
  return [[radius,0], [half,depth], [-half,depth], [-radius,0], [-half,-depth], [half,-depth]]
    .map(([u,v]) => [x+u,y+v,z]);
}

function rectangle(left, back, right, front, z) {
  return [[left,back,z], [right,back,z], [right,front,z], [left,front,z]];
}

function rod(mesh, start, end, radius, color, sides = 8) {
  const delta = end.map((v,i) => v-start[i]);
  const length = Math.hypot(...delta);
  const axis = delta.map(v => v/length);
  const horizontal = Math.hypot(axis[0],axis[1]);
  const u = horizontal ? [-axis[1]/horizontal,axis[0]/horizontal,0] : [1,0,0];
  const v = [axis[1]*u[2]-axis[2]*u[1], axis[2]*u[0]-axis[0]*u[2], axis[0]*u[1]-axis[1]*u[0]];
  const section = center => Array.from({length:sides}, (_,i) => {
    const a = 2*Math.PI*i/sides;
    return center.map((n,j) => n + radius*(u[j]*Math.cos(a) + v[j]*Math.sin(a)));
  });
  solid(mesh,section(start),section(end),color);
}

function miniatureShovel(mesh) {
  const local = (u,v,z) => [7+.75*u+.66*v, -1-.66*u+.75*v, z];
  const outline = [[-8.4,0,2.52],[-7.65,-1.9,2.68],[-4.3,-2.1,3.22],
    [-3.2,-1.3,3.12],[-3.2,1.3,3.12],[-4.3,2.1,3.22],[-7.65,1.9,2.68]];
  const blade = outline.map(p => local(...p));
  const underside = outline.map(([u,v,z]) => local(u,v,z-.22));
  join(mesh,underside,blade,'#34645f');
  const center = local(-5.4,0,2.6);
  for (let i=0; i<blade.length; i++) {
    face(mesh,[blade[i],blade[(i+1)%blade.length],center],i<3 ? '#5f9d91' : '#78b3a0');
  }
  rod(mesh,local(-3.55,0,2.95),local(4.8,0,3.65),.49,'#c79757');
  rod(mesh,local(-4.35,0,2.86),local(-2.9,0,3.0),.62,'#528b80');
  for (const sign of [-1,1]) {
    rod(mesh,local(4.55,0,3.65),local(6.9,sign*1.45,3.88),.36,'#538d7f');
  }
  rod(mesh,local(6.9,-1.45,3.88),local(6.9,1.45,3.88),.46,'#67a394');
}

function trayMesh() {
  const mesh = [];
  const bottom = hex(radius-.9,.2), foot = hex(radius,1.1);
  const shoulder = hex(radius,rimHeight-.55), rim = hex(radius-.45,rimHeight);
  const mouth = hex(radius-2.45,rimHeight), sand = hex(radius-2.85,2.28);
  join(mesh,bottom,foot,'#9a6640');
  join(mesh,foot,shoulder,'#b67f50');
  join(mesh,shoulder,rim,'#d9a873');
  join(mesh,rim,mouth,'#edc18b');
  join(mesh,mouth,sand,'#9b734d');
  face(mesh,sand,'#e8cb95');
  const tiles = [[-9,-.8,'#b58366'],[-6.1,-2.47,'#c9876e'],[-6.1,.87,'#d29b7a'],
    [-3.2,-.8,'#8fa383'],[-.3,-2.47,'#82a6a3'],[-.3,.87,'#a1b3a0']];
  for (const [x,y,color] of tiles) solid(mesh,hex(1.88,2.29,x,y),hex(1.88,2.65,x,y),color);
  for (let i=0; i<24; i++) {
    const a = i*2.4, r = 14.9*Math.sqrt((i+.5)/24);
    const x = Math.cos(a)*r, y = Math.sin(a)*r;
    face(mesh,[[x-.32,y,2.30],[x+.12,y-.25,2.30],[x+.42,y+.18,2.30]],i%3 ? '#f6dda6' : '#c5a677');
  }
  miniatureShovel(mesh);
  for (const x of [-6.6,6.6]) {
    const leaf = z => rectangle(x-1.78,-halfDepth-.34,x+1.78,-halfDepth+.03,z);
    solid(mesh,leaf(2.55),leaf(rimHeight),'#9d8251');
  }
  return mesh;
}

function plank(mesh, r, back, front, z, color, underside = false) {
  const width = y => r-Math.abs(y)/Math.sqrt(3);
  const outline = [[-width(back),back],[width(back),back]];
  if (back<0 && front>0) outline.push([r,0]);
  outline.push([width(front),front],[-width(front),front]);
  if (back<0 && front>0) outline.push([-r,0]);
  if (underside) outline.reverse();
  face(mesh,outline.map(([x,y]) => [x,y,z]),color);
}

function lidMesh() {
  const mesh = [];
  const lower = hex(radius-.22,0), outer = hex(radius,.3);
  const shoulder = hex(radius,1.45), top = hex(radius-.47,lidThickness);
  join(mesh,lower,outer,'#b2855b');
  join(mesh,outer,shoulder,'#bc8755');
  join(mesh,shoulder,top,'#e8b77d');
  const r = radius-.47, d = r*Math.sqrt(3)/2;
  let back = -d;
  for (const [front,color] of [[-6.50,'#d9ab77'],[-6.13,'#976a46'],[6.02,'#e2b887'],
    [6.4,'#a4734b'],[d,'#d8a773']]) {
    plank(mesh,r,back,front,lidThickness,color);
    back = front;
  }
  const innerRadius = radius-.22, innerDepth = innerRadius*Math.sqrt(3)/2;
  back = -innerDepth;
  for (const [front,color] of [[-6.50,'#cd9c6b'],[-6.13,'#9b704c'],[6.02,'#d4a475'],
    [6.4,'#a57850'],[innerDepth,'#ca9868']]) {
    plank(mesh,innerRadius,back,front,0,color,true);
    back = front;
  }
  for (const [x,y,length,bow] of [[-13,-8.7,16,.28],[-9,-13.9,12,-.32],[-14,1.9,21,.52],
    [-6,3.2,15,.48],[-12,10.7,13,-.39],[3,13.4,6,.26]]) {
    const z = lidThickness+.02;
    face(mesh,[[x,y,z],[x+length*.38,y+bow-.21,z],[x+length,y+bow*.5,z],[x+length*.43,y+bow+.1,z]],'#bd9267');
  }
  for (const x of [-7.4,7.4]) {
    const brace = z => rectangle(x-.95,-halfDepth+3.1,x+.95,halfDepth-3.1,z);
    solid(mesh,brace(-.7),brace(.015),'#a2724c');
  }
  for (const x of [-6.6,6.6]) {
    const section = (offset, width, r, color) => rod(mesh,[x+offset,hingeY,hingeZ],
      [x+offset+width,hingeY,hingeZ],r,color,10);
    section(-2.24,4.48,.61,'#9e7847');
    section(-1.99,1.04,.91,'#c39d59');
    section(-.78,1.56,1.02,'#dbb771');
    section(.95,1.04,.91,'#c39d59');
    const leaf = z => rectangle(x-.71,hingeY,x+.71,-halfDepth+2.55,z);
    solid(mesh,leaf(lidThickness-.21),leaf(lidThickness+.1),'#c49d60');
  }
  const handle = [[-2.8,11.4,2.05],[-2.4,11.4,3.65],[-1.6,11.4,4.1],[1.6,11.4,4.1],[2.4,11.4,3.65],[2.8,11.4,2.05]];
  for (let i=1; i<handle.length; i++) rod(mesh,handle[i-1],handle[i],.45,'#ba9556');
  return mesh;
}

const tray = compile(trayMesh());
const lid = compile(lidMesh());

function lidAngle(state) {
  if (!state?.active) return 0;
  const t = state.reduced ? 1.8 : state.elapsed;
  const ease = (start,end) => {
    const p = Math.min(1,Math.max(0,(t-start)/(end-start)));
    return p*p*(3-2*p);
  };
  return 1.72*(ease(0,.64)-ease(3.36,4.17));
}

function hingePose(state) {
  const angle = lidAngle(state), c = Math.cos(angle), s = Math.sin(angle);
  const y = (v,w) => hingeY+(v-hingeY)*c-(w-hingeZ)*s;
  const z = (v,w) => rimHeight+hingeZ+(v-hingeY)*s+(w-hingeZ)*c;
  return {c,s,y,z};
}

export function nestedSandboxHitPoints(state) {
  const pose = hingePose(state);
  const moving = [...hex(radius,0),...hex(radius,lidThickness),[0,11.4,4.55],
    [-8.9,hingeY-1,hingeZ],[8.9,hingeY-1,hingeZ]];
  return [...hex(radius,.2),...hex(radius,rimHeight),...moving.map(([u,v,w]) => [u,pose.y(v,w),pose.z(v,w)])];
}

export function drawNestedSandboxModel(ctx,x,y,floor,camera,state) {
  const pose = hingePose(state);
  const eyeX = camera.sine*camera.up, eyeY = camera.cosine*camera.up;
  const localY = eyeY*pose.c + camera.ground*pose.s;
  const localZ = -eyeY*pose.s + camera.ground*pose.c;
  const horizontal = Math.hypot(eyeX,localY);
  const lidCamera = {
    sine: horizontal ? eyeX/horizontal : 0,
    cosine: horizontal ? localY/horizontal : 1,
    ground: localZ, up: horizontal,
    project: (u,v,w) => camera.project(x+u,y+pose.y(v,w),floor+pose.z(v,w))
  };
  ctx.save();
  shadow(ctx,x,y,floor,camera,25,21);
  draw(ctx,x,y,floor,camera,tray);
  draw(ctx,0,0,0,lidCamera,lid);
  ctx.restore();
}
