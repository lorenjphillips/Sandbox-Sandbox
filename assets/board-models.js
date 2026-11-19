const TAU = 2 * Math.PI;
const EPSILON = .00001;
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const sub = (a, b) => a.map((v, i) => v - b[i]);
function unit(vector) {
  const length = Math.hypot(...vector);
  return vector.map(n => n / length);
}
const cross = (a, b) => [
  a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]
];
const light = unit([-.48, -.55, 1]);

function face(mesh, points, color) {
  const normal = unit(cross(sub(points[1], points[0]), sub(points[2], points[0])));
  if (points.length === 4 && Math.abs(dot(sub(points[3], points[0]), normal)) > EPSILON) {
    face(mesh, [points[0], points[1], points[2]], color);
    face(mesh, [points[0], points[2], points[3]], color);
    return;
  }
  const shade = .86 + .19 * dot(normal, light);
  const rgb = [1, 3, 5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(color.slice(i, i + 2), 16) * shade))));
  mesh.push({points, normal, offset: dot(points[0], normal), fill: 'rgb(' + rgb.join(',') + ')'});
}

function join(mesh, a, b, color) {
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length;
    face(mesh, [a[i], a[j], b[j], b[i]], color);
  }
}

function ring(radius, z, count = 28) {
  return Array.from({length: count}, (_, i) => [radius * Math.cos(TAU*i/count), radius * Math.sin(TAU*i/count), z]);
}

function bucketMesh() {
  const mesh = [];
  const base = ring(19.5, 1);
  const foot = ring(20.5, 3.4);
  const shoulder = ring(27.7, 43.5);
  const rimBase = ring(29.7, 44.5);
  const rimEdge = ring(30.3, 47.1);
  const rimTop = ring(29.2, 48.4);
  const mouth = ring(25.9, 48.4);
  const sand = ring(24.7, 42.1);
  join(mesh, base, foot, '#c45c48');
  join(mesh, foot, shoulder, '#e8795c');
  join(mesh, shoulder, rimBase, '#c65c49');
  join(mesh, rimBase, rimEdge, '#f18a6a');
  join(mesh, rimEdge, rimTop, '#fba083');
  join(mesh, rimTop, mouth, '#fda786');
  join(mesh, mouth, sand, '#b75643');
  face(mesh, sand, '#dfbb84');
  for (let i = 1; i <= 13; i++) {
    const a = i*2.4, r = 20*Math.sqrt(i/13);
    const px = r*Math.cos(a), py = r*Math.sin(a);
    face(mesh, [[px-.65,py,42.2],[px+.2,py-.55,42.2],[px+.8,py+.35,42.2]], i%3 ? '#edd09c' : '#c19d69');
  }

  const angle = -.19;
  const across = [Math.cos(angle), Math.sin(angle), 0];
  const lean = .26;
  const rise = [Math.sin(angle)*Math.sin(lean), -Math.cos(angle)*Math.sin(lean), Math.cos(lean)];
  const side = cross(rise, across);
  const local = (u, v, w) => across.map((value, i) => value*u + rise[i]*v + side[i]*w + (i === 2 ? 43 : 0));
  let previous;
  for (let i = 0; i <= 18; i++) {
    const t = Math.PI * i / 18;
    const loop = Array.from({length: 6}, (_, j) => {
      const a = TAU*j/6;
      return local((29.3 + 2*Math.cos(a))*Math.cos(t), (39 + 2*Math.cos(a))*Math.sin(t), 2*Math.sin(a));
    });
    if (previous) join(mesh, previous, loop, '#e48669');
    previous = loop;
  }
  for (const sign of [-1, 1]) {
    const peg = (u, radius) => Array.from({length: 14}, (_, i) => {
      const t = sign*TAU*i/14;
      return local(sign*u, radius*Math.sin(t), radius*Math.cos(t));
    });
    const inner = peg(27.2, 3.8), outer = peg(30.4, 3.5);
    join(mesh, inner, outer, '#c95e49');
    face(mesh, outer, '#f7a07e');
  }
  return mesh;
}

function footprint(left, right, width, bevel, height) {
  const z = typeof height === 'function' ? height : () => height;
  return [[left+bevel,-width], [right-bevel,-width], [right,-width+bevel], [right,width-bevel],
    [right-bevel,width], [left+bevel,width], [left,width-bevel], [left,-width+bevel]].map(([x,y]) => [x, y, z(x)]);
}

function solid(mesh, bottom, top, color) {
  join(mesh, bottom, top, color);
  face(mesh, top, color);
  face(mesh, bottom.slice().reverse(), color);
}

function tire(mesh, x, sign) {
  const lathe = (y, r) => Array.from({length: 16}, (_, i) => {
    const a = -sign*TAU*i/16;
    return [x+r*Math.cos(a), sign*y, 10.3+r*Math.sin(a)];
  });
  const sections = [[10.2,8.3], [11.5,10.2], [17.7,10.2], [19.6,8.5], [19.9,5], [20.3,4.1], [20.7,2.9]];
  const colors = ['#504d46', '#3b3c39', '#454742', '#333a38', '#ab8b56', '#dbb874'];
  let last = lathe(...sections[0]);
  face(mesh, last.slice().reverse(), '#3b3c39');
  for (let i = 1; i < sections.length; i++) {
    const next = lathe(...sections[i]);
    join(mesh, last, next, colors[i-1]);
    last = next;
  }
  face(mesh, last, '#e7c587');
}

function truckMesh() {
  const mesh = [];
  solid(mesh, footprint(-40,39,11.5,2,9.5), footprint(-40,39,11.5,2,15.5), '#846b4b');
  for (const x of [-26,25]) for (const sign of [-1,1]) tire(mesh, x, sign);
  solid(mesh, footprint(-41,-7,13.2,2,14), footprint(-41,-7,13.2,2,23), '#ecac49');
  solid(mesh, footprint(-42,-37,13.6,1.5,12.6), footprint(-42,-37,13.6,1.5,16), '#bb8a52');

  const cabin = [[-36,22.8],[-30.4,36.9],[-28.6,38.4],[-11.1,38.4],[-9,36.4],[-9,22.8]];
  const cabSide = (outline, y) => outline.map(([x,z]) => [x,y,z]);
  const left = cabSide(cabin,-12.3), right = cabSide(cabin,12.3);
  face(mesh, left.slice().reverse(), '#f0b64e');
  face(mesh, right, '#f0b64e');
  join(mesh, left, right, '#f8bf59');
  for (const sign of [-1,1]) {
    const sideWindow = cabSide([[-32.8,25.4],[-29.1,35.6],[-13,35.6],[-12.3,25.4]], sign*12.4);
    face(mesh, sign > 0 ? sideWindow : sideWindow.reverse(), '#80a6a8');
    const lamp = [[-41.06,sign*11,18],[-41.06,sign*7,18],[-41.06,sign*7,21],[-41.06,sign*11,21]];
    face(mesh, sign > 0 ? lamp : lamp.reverse(), '#ffe1a0');
  }
  const windX = z => -36 + (z-22.8)*5.6/14.1 - .08;
  face(mesh, [[windX(25.2),10.2,25.2],[windX(25.2),-10.2,25.2],
    [windX(35.5),-10.2,35.5],[windX(35.5),10.2,35.5]], '#85adb0');
  const lift = x => 2.8 - x*.095;
  const belly = footprint(-3,33,11.6,1.4,x => 15+lift(x));
  const wall = footprint(-6.5,39.5,16.4,2.5,x => 29.1+lift(x));
  const lip = footprint(-6.8,39.8,16.7,2.5,x => 30.5+lift(x));
  const opening = footprint(-4.5,37.4,14.3,1.6,x => 30.5+lift(x));
  const well = footprint(-1.1,32,10,1.1,x => 19.8+lift(x));
  face(mesh, belly.slice().reverse(), '#b57537');
  join(mesh, belly, wall, '#df903d');
  for (const sign of [-1,1]) {
    const onSide = (x, t) => [x, sign*(11.6 + 4.8*t + .09), 15 + lift(x) + 14.1*t];
    for (const x of [4.5,18.5,30]) {
      const rib = [onSide(x,.17),onSide(x-1.4,.83),onSide(x+.25,.83),onSide(x+1.35,.17)];
      face(mesh, sign > 0 ? rib : rib.reverse(), '#e8a047');
    }
  }
  join(mesh, wall, lip, '#f4ac48');
  join(mesh, lip, opening, '#ffc769');
  join(mesh, opening, well, '#c28a4a');
  face(mesh, well, '#b78249');
  return mesh;
}

function splitPlane(faces) {
  let choice = faces[0], best = Infinity;
  const step = Math.max(1, Math.floor(faces.length / 12));
  for (let i = 0; i < faces.length; i += step) {
    const plane = faces[i];
    let front = 0, back = 0, cuts = 0;
    for (const f of faces) {
      let positive = false, negative = false;
      for (const p of f.points) {
        const d = dot(p, plane.normal) - plane.offset;
        positive ||= d > EPSILON;
        negative ||= d < -EPSILON;
      }
      if (positive) front++;
      if (negative) back++;
      if (positive && negative) cuts++;
    }
    const score = 12*cuts + Math.max(front, back);
    if (score < best) {
      choice = plane;
      best = score;
    }
  }
  return choice;
}

function partition(faces) {
  if (!faces.length) return null;
  const plane = splitPlane(faces);
  const near = [], far = [], flat = [];
  for (const f of faces) {
    const distances = f.points.map(p => dot(p, plane.normal) - plane.offset);
    const positive = distances.some(d => d > EPSILON);
    const negative = distances.some(d => d < -EPSILON);
    if (!positive || !negative) {
      (positive ? near : negative ? far : flat).push(f);
      continue;
    }
    const a = [], b = [];
    f.points.forEach((p, i) => {
      const j = (i + 1) % f.points.length, d = distances[i], e = distances[j];
      if (d >= -EPSILON) a.push(p);
      if (d <= EPSILON) b.push(p);
      if ((d > EPSILON && e < -EPSILON) || (d < -EPSILON && e > EPSILON)) {
        const cut = p.map((v, k) => v + (f.points[j][k] - v)*d/(d-e));
        a.push(cut);
        b.push(cut);
      }
    });
    near.push({...f, points:a});
    far.push({...f, points:b});
  }
  return {normal:plane.normal, flat, near:partition(near), far:partition(far)};
}

function compile(faces) {
  const tree = partition(faces);
  const vertices = [], indices = new Map();
  function index(node) {
    if (!node) return;
    for (const f of node.flat) {
      f.points = f.points.map(p => {
        const key = p.map(v => Math.round(v*100000)).join(',');
        if (!indices.has(key)) {
          indices.set(key, vertices.length);
          vertices.push(p);
        }
        return indices.get(key);
      });
    }
    index(node.near);
    index(node.far);
  }
  index(tree);
  return {tree, vertices};
}

const bucket = compile(bucketMesh());
const truck = compile(truckMesh());

function shadow(ctx, x, y, floor, camera, rx, ry) {
  const center = camera.project(x+1.8,y+2.4,floor+.1);
  ctx.save();
  ctx.transform(camera.cosine, camera.sine*camera.ground, -camera.sine, camera.cosine*camera.ground, center.x, center.y);
  ctx.scale(rx, ry);
  const shade = ctx.createRadialGradient(0,0,0,0,0,1);
  shade.addColorStop(0,'rgba(93,65,39,.28)');
  shade.addColorStop(.62,'rgba(93,65,39,.16)');
  shade.addColorStop(1,'rgba(93,65,39,0)');
  ctx.fillStyle = shade;
  ctx.fillRect(-1,-1,2,2);
  ctx.restore();
}

function draw(ctx, x, y, floor, camera, model) {
  const points = model.vertices.map(([u,v,w]) => camera.project(x+u,y+v,floor+w));
  const eye = [camera.sine*camera.up,camera.cosine*camera.up,camera.ground];
  ctx.lineJoin = 'round';
  ctx.lineWidth = .36;
  let color;
  function paint() {
    ctx.fillStyle = ctx.strokeStyle = color;
    ctx.fill();
    ctx.stroke();
  }
  function visit(node) {
    if (!node) return;
    const forward = dot(node.normal, eye) > 0;
    visit(forward ? node.far : node.near);
    for (const f of node.flat) {
      if (dot(f.normal, eye) <= .0001) continue;
      if (color !== f.fill) {
        if (color) paint();
        ctx.beginPath();
        color = f.fill;
      }
      const start = points[f.points[0]];
      ctx.moveTo(start.x, start.y);
      for (let j = 1; j < f.points.length; j++) {
        const p = points[f.points[j]];
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
    }
    visit(forward ? node.near : node.far);
  }
  visit(model.tree);
  if (color) paint();
}

export function drawBucketModel(ctx, x, y, floor, camera) {
  ctx.save();
  shadow(ctx,x,y,floor,camera,27,23);
  draw(ctx,x,y,floor,camera,bucket);
  ctx.restore();
}

export function drawTruckModel(ctx, x, y, floor, camera) {
  ctx.save();
  shadow(ctx,x,y,floor,camera,46,22);
  draw(ctx,x,y,floor,camera,truck);
  ctx.restore();
}
