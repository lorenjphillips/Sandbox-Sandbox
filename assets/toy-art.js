const paths = new Map();
const tau = Math.PI * 2;

function path(data) {
  if (!paths.has(data)) paths.set(data, new Path2D(data));
  return paths.get(data);
}

function paint(ctx, data, fill, edge, width = 1) {
  const shape = path(data);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill(shape);
  }
  if (edge) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = width;
    ctx.stroke(shape);
  }
}

function oval(ctx, x, y, rx, ry, fill, tilt = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, tilt, 0, tau);
  ctx.fillStyle = fill;
  ctx.fill();
}

function gradient(ctx, x1, y1, x2, y2, stops) {
  const color = ctx.createLinearGradient(x1, y1, x2, y2);
  for (const [position, shade] of stops) color.addColorStop(position, shade);
  return color;
}

function shadow(ctx, x, y, rx, ry, opacity) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(rx, ry);
  const color = ctx.createRadialGradient(0, 0, .12, 0, 0, 1);
  color.addColorStop(0, `rgba(89,56,28,${opacity})`);
  color.addColorStop(1, 'rgba(89,56,28,0)');
  oval(ctx, 0, 0, 1, 1, color);
  ctx.restore();
}

function ease(time, start, end) {
  const x = Math.max(0, Math.min(1, (time - start) / (end - start)));
  return x * x * (3 - 2 * x);
}

function moment({active, reduced, elapsed}, still) {
  return active ? (reduced ? still : elapsed) : 0;
}

const caseTop = 'M-21 -1 L-13 -10 L10 -10 L21 -2 L14 6 L-10 7 Z';
const lid = 'M-21 9 L-13 0 L10 0 L21 8 L14 16 L-10 17 Z';
const grainLines = 'M-22 5 Q-12 3.6 -5 4.6 T15 4 M-19 10 Q-11 9 -8 10 Q-3 12 6 10 T21 10 M-18 14 Q-8 12.2 2 14 T18 13.5';

function woodenLid(ctx, angle) {
  const depth = Math.cos(angle) - 1.65 * Math.sin(angle);
  const underside = depth < 0;
  ctx.save();
  ctx.translate(0, -10.35);
  ctx.transform(1, 0, -.08 * Math.sin(angle), depth, 0, 0);
  const wood = gradient(ctx, -15, 0, 14, 17, underside ? [[0,'#89512e'],[.5,'#b17b4a'],[1,'#dba56c']] : [[0,'#f2cd94'],[.46,'#dbaa71'],[1,'#b88353']]);
  paint(ctx, lid, wood, '#7b5035', .8);
  ctx.save();
  ctx.clip(path(lid));
  paint(ctx, 'M-18 6 L19 5.5 M-20 12 L21 11.4', null, '#805634', .72);
  paint(ctx, 'M-18 6.7 L19 6.2 M-19 12.7 L20 12.1', null, '#efd0a0', .49);
  paint(ctx, grainLines, null, '#8c593a82', .5);
  oval(ctx, -3, 9.9, 2.2, .58, '#976841');
  if (underside) {
    paint(ctx, 'M-12 0 L-9 0 L-9 17 L-12 17 Z M8 0 L11 0 L11 17 L8 17 Z', '#875935', '#dba879', .55);
  } else {
    paint(ctx, 'M-2 14 C-2 10 4 9.8 4 13.5', null, '#70543c', 1.7);
    paint(ctx, 'M-1.7 13 C-1 10.8 2.5 10.5 3.6 12.6', null, '#f6dc99', .75);
  }
  ctx.restore();
  ctx.restore();
}

export function paintSandboxToy(ctx, state) {
  const t = moment(state, 1.8);
  const angle = 1.72 * (ease(t, 0, .64) - ease(t, 3.36, 4.17));
  ctx.save();
  ctx.rotate(-.095);
  shadow(ctx, 3, 5, 25, 7, .38);
  paint(ctx, 'M-21 -1 L-10 7 L14 6 L21 -2 L21 1 L14 9 L-10 10 L-21 2 Z', '#946341', '#765137', .65);
  paint(ctx, 'M-10 7 L14 6 L14 9 L-10 10 Z', '#b78250');
  paint(ctx, caseTop, '#e2bd86', '#835e40', .8);
  paint(ctx, 'M-17 -1 L-11 -7.7 L9 -7.7 L17 -2 L11.8 4 L-8.5 4.7 Z', '#926943');
  paint(ctx, 'M-16 -.2 L-10 -6 L8.6 -6.2 L16.1 -1.5 L11.5 3.4 L-8.3 4 Z', '#eaca8f');
  ctx.save();
  ctx.translate(-4, -1);
  ctx.scale(1, .61);
  const cells = [[-5,0,'#bb9466'],[-2,-2,'#bd7961'],[-2,2,'#c4866d'],[1,0,'#8b9d85'],[4,-2,'#82a9a6'],[4,2,'#9fb2a2']];
  for (const [x,y,fill] of cells) {
    ctx.save();
    ctx.translate(x, y);
    paint(ctx, 'M-2 0 L-1 -1.7 L1 -1.7 L2 0 L1 1.7 L-1 1.7 Z', fill, '#e9cda5', .24);
    ctx.restore();
  }
  ctx.restore();
  paint(ctx, 'M3 1.5 L10 -4', null, '#815832', 1.25);
  paint(ctx, 'M3.2 1 L9.4 -4', null, '#e5b57a', .68);
  paint(ctx, 'M8.5 -3.8 L9 -5.8 L11.6 -4.8 L10 -3.4 Z', null, '#3f736c', .8);
  paint(ctx, 'M1.5 -.1 L4 1 Q4.6 2.5 1.5 3.3 Q-.2 3.6 -.5 2.4 Z', '#5c8c7d', '#416d60', .4);
  woodenLid(ctx, angle);
  for (const x of [-8, 6]) {
    oval(ctx, x, -10.3, 1.9, .82, '#67492d');
    oval(ctx, x-.2, -10.65, 1.55, .45, '#d6b771');
  }
  ctx.restore();
}

const glass = 'M-6.5 -11 C-6.7 -4.8 -2.1 -3.2 -1.1 -.9 Q-.6 0 -1.1 1 C-2.5 3.8 -6.9 5 -6.5 11 Q0 13 6.5 11 C6.7 4.8 2.1 3.2 1.1 .9 Q.6 0 1.1 -1 C2.5 -3.8 6.9 -5 6.5 -11 Q0 -13 -6.5 -11 Z';
const brassStops = [[0,'#6e5534'],[.23,'#c8a767'],[.42,'#f6dc98'],[.65,'#be974f'],[1,'#705132']];

function glassSand(ctx, level, inverted) {
  ctx.save();
  if (inverted) ctx.rotate(Math.PI);
  const surface = 10.9 - level * 6.55;
  ctx.beginPath();
  ctx.moveTo(-8, surface + 1.35);
  ctx.quadraticCurveTo(-2, surface+.1, -.3, surface-.68);
  ctx.quadraticCurveTo(2, surface+.2, 8, surface+1.55);
  ctx.lineTo(8, 13);
  ctx.lineTo(-8, 13);
  ctx.closePath();
  ctx.fillStyle = gradient(ctx, -4, surface, 5, 12, [[0,'#f5d890'],[.32,'#dca952'],[1,'#b77c31']]);
  ctx.fill();
  ctx.restore();
}

export function paintHourglassToy(ctx, state) {
  const t = moment(state, 2.4);
  const rotation = ease(t, .03, .77) * Math.PI;
  const transfer = ease(t, .83, 3.79);
  const moving = t > .78 && t < 3.85;
  ctx.save();
  shadow(ctx, 2.5, .8, 12, 3.4, .41);
  ctx.translate(0, -15.1 - 2.5 * Math.sin(rotation));
  ctx.rotate(rotation+.08);
  ctx.lineCap = 'round';
  for (const x of [-8.3, 8.3]) {
    ctx.fillStyle = gradient(ctx, x-1.05, 0, x+1.05, 0, brassStops);
    ctx.fillRect(x-1.05, -12, 2.1, 24);
  }
  paint(ctx, glass, gradient(ctx, -7, 0, 7, 0, [[0,'#9aac9dba'],[.28,'#e7f0d79c'],[.65,'#eaf5e16b'],[1,'#87a59fa8']]), '#84948a', .75);
  ctx.save();
  ctx.clip(path(glass));
  glassSand(ctx, transfer, false);
  glassSand(ctx, 1-transfer, true);
  if (moving) {
    const phase = (t - .78) * 1.63;
    const fade = ease(t, .78, .99) - ease(t, 3.60, 3.85);
    ctx.globalAlpha *= fade;
    for (let i = 0; i < 13; i++) {
      const u = (phase + i / 13) % 1;
      const y = -8 + u * 16;
      const x = Math.sin(i * 2.41) * (.12 + .05 * Math.abs(y));
      oval(ctx, x, y, i%3===0 ? .41 : .31, .49, i%3===0 ? '#fff0ad' : '#b0772c');
    }
  }
  ctx.restore();
  paint(ctx, 'M-4.9 -9 Q-5.1 -6 -2.9 -4.3 M-4.6 6.7 L-5 8.9 M4.5 7.7 L4.9 9.5', null, '#ffffe5d9', .8);
  for (const y of [-13, 13]) {
    ctx.save();
    ctx.translate(0, y);
    paint(ctx, 'M-9.7 -1.4 Q0 -4.1 9.7 -1.4 L9.7 .6 Q1 3.6 -9.7 .6 Z', gradient(ctx,-10,0,10,0,brassStops), '#765d37', .6);
    oval(ctx, 0, -1.35, 9.65, 1.7, '#d5b777');
    paint(ctx, 'M-8 -1.7 Q-4.5 -3 1 -2.65', null, '#f4df9d', .62);
    ctx.restore();
  }
  ctx.restore();
}

function scarabAt(progress) {
  const bend = Math.sin(Math.PI * progress);
  return {x: 31 * progress, y: -9 * bend - 2 * progress, angle: Math.atan2(-9 * Math.PI * Math.cos(Math.PI * progress)-2, 31)};
}

const wing = 'M-5.7 0 C-5.8 -3.6 -2.3 -5.7 2.1 -4.7 Q3.6 -3.8 3.1 0 Q-1.5 .4 -5.7 0 Z';

function beetle(ctx, angle, stride) {
  ctx.save();
  ctx.rotate(angle);
  ctx.lineCap = 'round';
  for (const side of [-1,1]) {
    ctx.save();
    ctx.scale(1, side);
    for (let i = 0; i < 3; i++) {
      const x = -3.55 + i * 3.35;
      const swing = 1.15 * Math.sin(stride + i * 2 + side);
      ctx.beginPath();
      ctx.moveTo(x, 2.5);
      ctx.lineTo(x-1+swing, 4.7);
      ctx.lineTo(x+(i-1)*1.9+swing, 6.5 - .35*i);
      ctx.lineTo(x+(i-1)*1.9+swing+.9, 6.8 - .35*i);
      ctx.strokeStyle = '#6d5735';
      ctx.lineWidth = .85;
      ctx.stroke();
    }
    ctx.restore();
  }
  oval(ctx, 6, 0, 2.2, 2.05, '#766940');
  paint(ctx, 'M6.6 -1 Q8 -2 8.1 -2.9 M7 .8 Q8.5 1.4 8.7 2.3', null, '#71603b', .58);
  for (const side of [1,-1]) {
    ctx.save();
    ctx.scale(1, side);
    const tones = side===1 ? [[0,'#688379'],[.24,'#b4ab6c'],[.45,'#e4c77b'],[.76,'#ada068'],[1,'#716a43']] : [[0,'#616f58'],[.38,'#988d4e'],[.70,'#b99f61'],[1,'#6b6740']];
    paint(ctx, wing, gradient(ctx,-5,-5,3,2,tones), '#675e38', .55);
    paint(ctx, 'M-4.7 -1 Q-2.8 -3.1 1.6 -3.6 M-4.5 -.5 Q-2.1 -1.8 1.9 -2.1', null, '#756d438c', .35);
    ctx.restore();
  }
  paint(ctx, 'M2 -4.4 Q5 -4 6.1 -2 Q6.6 0 6 2 Q4.7 4 2.2 4.4 Q4 0 2 -4.4 Z', gradient(ctx,2,-4,5,4,[[0,'#e0c27b'],[.37,'#acac76'],[.8,'#797749'],[1,'#515a42']]), '#655c39', .55);
  ctx.restore();
}

function sandCrust(ctx, opacity) {
  ctx.save();
  ctx.globalAlpha *= opacity;
  paint(ctx, 'M-8 1 Q-5 2.9 -2 1.6 Q.5 2.1 3 .5 Q6 -.1 8 .4 Q5.6 3.3 2 4 Q-4 5.3 -8 1 Z', '#d7b789');
  paint(ctx, 'M-7.5 1.4 Q-4.9 2.7 -2 1.65 M1.9 1.1 Q4.5 -.1 7.3 .3', null, '#f5dba6', .65);
  for (const [x,y] of [[-7,2],[-5.1,.8],[-3,3.1],[1.5,2.3],[4.4,1.3],[7.4,-.6],[9,1.2]]) oval(ctx,x,y,.65,.39,'#a787586f');
  ctx.restore();
}

export function paintScarabToy(ctx, state) {
  const t = moment(state, 1.9);
  const travel = ease(t, .55, 2.57);
  const visible = 1 - ease(t, 2.53, 2.98);
  const reappear = ease(t, 3.49, 4.17);
  const trail = 1 - ease(t, 3.05, 4.1);
  const point = scarabAt(travel);
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 1; i <= 10 && i/11 < travel; i++) {
    const step = scarabAt(i/11);
    ctx.save();
    ctx.translate(step.x, step.y);
    ctx.rotate(step.angle);
    ctx.globalAlpha *= trail * .65;
    paint(ctx, 'M-1 -2.9 L.3 -2.6 M-.3 2.7 L1 2.6', null, '#937248', .7);
    paint(ctx, 'M-.9 -2.3 L.1 -2.1 M-.1 3.2 L.9 3.1', null, '#f3d8a2', .46);
    ctx.restore();
  }
  if (visible > 0) {
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.globalAlpha *= visible;
    shadow(ctx, 1, 1.35, 8.5, 4.1, .38);
    beetle(ctx, point.angle, travel * 39);
    sandCrust(ctx, 1 - ease(t, .03, .56) + ease(t, 2.5, 2.93));
    ctx.restore();
  }
  if (reappear > 0) {
    ctx.globalAlpha *= reappear;
    shadow(ctx, 1, 1.35, 8.5, 4.1, .38);
    beetle(ctx, scarabAt(0).angle, 0);
    sandCrust(ctx, 1);
  }
  ctx.restore();
}

const blades = [
  [-6,0,-11,-11,1.25,0],[-5,-1,-3,-15,1.55,1],[-3,-1,-8,-19,1.7,2],[-2,-1,1,-21,1.45,1],[1,-1,9,-19,1.6,2],[3,0,14,-13,1.55,0],[4,0,11,-8,1.5,1],[-5,1,-14,-8,1.5,2],[-3,1,-7,-12,1.65,1],[-1,1,-2,-16,1.6,0],[0,1,5,-15,1.6,2],[2,1,9,-10,1.8,1],[3,1,13,-5,1.3,0]
];
const leafColors = [['#777044','#a6a06a'],['#5b6643','#929b62'],['#666f47','#b3ae70']];

function footprint(ctx, opacity) {
  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.translate(15, 0);
  ctx.rotate(.55);
  ctx.scale(.8, .66);
  paint(ctx, 'M-2.1 7.6 C-4 6.9 -3.6 4.1 -2.6 2.4 Q-1 0 -2.2 -1.9 C-4.9 -5.6 -1.1 -8.2 2.4 -7.1 C5.3 -6.2 4.5 -3.7 3.1 -1.6 Q1.7 .3 1.8 2.9 C2.2 6.9 .5 8.7 -2.1 7.6 Z', gradient(ctx,-3,-5,3,7,[[0,'#896c477f'],[.44,'#af8c605c'],[1,'#a3855e85']]));
  paint(ctx, 'M-2.5 7.3 Q.8 10.1 1.8 4.8 M3.9 -6.1 Q5.3 -4.2 2.4 -1', null, '#f6dca690', .85);
  for (const [x,y,r] of [[-2.2,-9.2,1.65],[.7,-9.6,1.15],[2.7,-9.1,.93],[4.1,-8.0,.78],[5.0,-6.8,.61]]) {
    oval(ctx,x+.15,y+.38,r,r*1.27,'#f2d49fbd',-.18);
    oval(ctx,x,y,r,r*1.2,'#a3855eac',-.18);
  }
  ctx.restore();
}

export function paintGrassToy(ctx, state) {
  const t = moment(state, 1.4);
  const pressed = ease(t, .04, .45) - ease(t, 1.5, 2.54);
  const recovery = (ease(t, 1.56, 2.59) - ease(t, 2.59, 3.36)) * Math.sin((t-1.56)*6.0) * .1;
  const bend = pressed + recovery;
  ctx.save();
  shadow(ctx, 2.3, 1.4, 12, 3.0, .28);
  footprint(ctx, ease(t, .15, .54) - ease(t, 3.07, 4.16));
  for (const [baseX,baseY,tipX,tipY,width,palette] of blades) {
    const x = tipX + bend * (6 - tipX*.25);
    const y = tipY * (1-bend*.64);
    const curveX = baseX*.65 + x*.35;
    const curveY = y*.85;
    const [dark,light] = leafColors[palette];
    ctx.beginPath();
    ctx.moveTo(baseX-width*.48, baseY);
    ctx.quadraticCurveTo(curveX-width*.88, curveY, x, y);
    ctx.quadraticCurveTo(curveX+width*.65, curveY+1, baseX+width*.48, baseY);
    ctx.closePath();
    ctx.fillStyle = gradient(ctx, baseX, baseY, x, y, [[0,'#756c43'],[.34,dark],[.91,light],[1,'#c5b97c']]);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(baseX-.17, baseY-1);
    ctx.quadraticCurveTo(curveX-width*.28, curveY, x, y);
    ctx.strokeStyle = '#d1c99180';
    ctx.lineWidth = .33;
    ctx.stroke();
  }
  paint(ctx, 'M-7 1.3 Q-4.5 2 -2.7 1.6 M1.3 2.3 Q4.1 2.5 6.2 1.4', null, '#e3c795', .66);
  ctx.restore();
}
