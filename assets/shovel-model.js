import { compile, draw, face, join } from './board-models.js';

const heading = -.56;
const along = Math.cos(heading);
const across = Math.sin(heading);
const world = ([u, v, z]) => [u*along - v*across, u*across + v*along, z];

function scoop(mesh) {
  const sections = [
    [-24,30,-11,2.4,3.4], [-19,33,-7,2.1,8], [-9,33,-3,2.1,14],
    [4,30,0,3.6,17.5], [14,25,0,6.9,17], [22,18,0,11,12],
    [28,10,0,15,6]
  ];
  const crossSection = [-1,-.92,-.73,-.45,0,.45,.73,.92,1];
  const inner = [], outer = [];
  for (const [u,width,nose,bed,rise] of sections) {
    const inside = [], outside = [];
    for (const t of crossSection) {
      const x = u + nose*(1-t*t);
      const curve = Math.abs(t)**2.7;
      inside.push(world([x,t*width,bed + rise*curve]));
      const bevel = u === sections[0][0] ? -1.5 : 0;
      outside.push(world([x+bevel,t*(width+1.25),bed - 2.05 + rise*curve]));
    }
    inner.push(inside);
    outer.push(outside);
  }
  for (let i = 1; i < sections.length; i++) {
    for (let j = 1; j < crossSection.length; j++) {
      const quad = grid => [grid[i-1][j-1],grid[i][j-1],grid[i][j],grid[i-1][j]];
      const depth = Math.min(j-1,crossSection.length-1-j,i-1,3);
      face(mesh, quad(inner), ['#749e8e','#709b8c','#689487','#648e82'][depth]);
      face(mesh, quad(outer).reverse(), '#497e76');
    }
  }
  const boundary = grid => [
    ...grid.map(row => row[0]),
    ...grid.at(-1).slice(1),
    ...grid.slice(0,-1).reverse().map(row => row.at(-1)),
    ...grid[0].slice(1,-1).reverse()
  ];
  const lip = boundary(inner);
  const underside = boundary(outer);
  const edge = lip.map((p,i) => [
    p[0]*.4 + underside[i][0]*.6, p[1]*.4 + underside[i][1]*.6, p[2]-.35
  ]);
  join(mesh, underside, edge, '#53887d');
  join(mesh, edge, lip, '#a5c1a9');
}

const shaftHeight = u => 19.5 - .147*(u-21);

function shaft(mesh) {
  const barrel = (u, radius, z=shaftHeight(u), height=radius) => Array.from({length:16}, (_,i) => {
    const angle = i*Math.PI/8;
    return world([u,radius*Math.cos(angle),z + height*Math.sin(angle)]);
  });
  const sections = [
    [4,1.6,3.5,.55], [8,3.5,4.8,1.6], [14,5.25,8.2,3.2], [20,6.6,12.8,4.7],
    [25,7.65,16.7,6.2], [30,7.1], [35,6.5], [36,6], [36,5.45],
    [51,5.3], [77,5.2], [87,5.4], [87,6.1], [88,6.45], [93,6.7], [97,5]
  ];
  const colors = [
    '#6b9787','#689484','#639080','#5c8c7e','#548a7e','#609386','#92b49e','#477a71',
    '#d8995e','#d8995e','#d8995e','#3b7169','#78a48f','#497e73','#41766c'
  ];
  let previous = barrel(...sections[0]);
  face(mesh, previous.slice().reverse(), '#41766c');
  sections.slice(1).forEach((section,i) => {
    const next = barrel(...section);
    join(mesh, previous, next, colors[i]);
    previous = next;
  });
  face(mesh, previous, '#41766c');
}

function grip(mesh) {
  const path = [
    [93,0,5.8],[95,-6,4.5],[98.5,-12,4.1],[102.5,-16.1,4.15],
    [107,-18,4.5],[111,-17.8,4.95],[114,-15.6,5.25],[115.2,-12,5.5],
    [115.4,-6,5.65],[115.4,6,5.65],[115.2,12,5.5],[114,15.6,5.25],
    [111,17.8,4.95],[107,18,4.5],[102.5,16.1,4.15],[98.5,12,4.1],[95,6,4.5]
  ];
  const loops = path.map(([u,v,radius],i) => {
    const prev = path[(i+path.length-1)%path.length], next = path[(i+1)%path.length];
    const dx = next[0]-prev[0], dy = next[1]-prev[1], len = Math.hypot(dx,dy);
    return Array.from({length:10}, (_,j) => {
      const angle = Math.PI*j/5;
      const width = radius*Math.cos(angle);
      const x = u-width*dy/len;
      return world([x,v+width*dx/len,shaftHeight(x)+radius*.96*Math.sin(angle)]);
    });
  });
  for (let i = 0; i < loops.length; i++) {
    join(mesh, loops[i], loops[(i+1)%loops.length], '#548b7d');
  }
}

const faces = [];
scoop(faces);
shaft(faces);
grip(faces);
const shovel = compile(faces);

function castShadow(ctx, x, y, floor, camera, u, length, width, opacity) {
  const [sx,sy] = world([u,0,0]);
  const p = camera.project(x+sx+3.8,y+sy+4.4,floor+.1);
  ctx.save();
  ctx.transform(camera.cosine,camera.sine*camera.ground,-camera.sine,camera.cosine*camera.ground,p.x,p.y);
  ctx.rotate(heading);
  ctx.scale(length,width);
  const shade = ctx.createRadialGradient(0,0,0,0,0,1);
  shade.addColorStop(0,'rgba(84,57,32,'+opacity+')');
  shade.addColorStop(.58,'rgba(84,57,32,'+opacity*.66+')');
  shade.addColorStop(1,'rgba(84,57,32,0)');
  ctx.fillStyle = shade;
  ctx.fillRect(-1,-1,2,2);
  ctx.restore();
}

export function drawShovelModel(ctx, x, y, floor, camera) {
  ctx.save();
  castShadow(ctx,x,y,floor,camera,-4,38,34,.32);
  castShadow(ctx,x,y,floor,camera,62,52,10,.23);
  castShadow(ctx,x,y,floor,camera,107,22,23,.24);
  draw(ctx,x,y,floor,camera,shovel);
  ctx.restore();
}
