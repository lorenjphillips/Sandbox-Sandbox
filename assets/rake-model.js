import { compile, draw, face, join, shadow, solid } from './board-models.js';

const direction = .19;
const cosine = Math.cos(direction);
const sine = Math.sin(direction);
const world = (x,y,z) => [x*cosine-y*sine,x*sine+y*cosine,z];

function shaft(mesh) {
  const sections = [
    [-57,3.5,'#5f96af'],[-55,5.3,'#69a1b9'],[-41,5.3,'#669eb7'],[-39,4.1,'#4b7e9b'],
    [22,4.4,'#c89661'],[24,5.6,'#43839f'],[28,6.2,'#66a6bf'],[37,6.2,'#5d9db7']
  ];
  const ring = (x,radius) => Array.from({length:12},(_,i) => {
    const a=i*Math.PI/6;
    return world(x,radius*Math.cos(a),6.2+(x+57)*.049+radius*Math.sin(a));
  });
  let previous=ring(...sections[0]);
  face(mesh,previous.slice().reverse(),sections[0][2]);
  for(const [x,radius,color] of sections.slice(1)) {
    const next=ring(x,radius);
    join(mesh,previous,next,color);
    previous=next;
  }
  face(mesh,previous,sections.at(-1)[2]);
}

function head(mesh) {
  const outline=[
    [29,-13],[32,-18],[39,-21],[45,-19],
    [45,19],[39,21],[32,18],[29,13]
  ];
  const ring=(height,inset=0)=>outline.map(([x,y])=>world(x+(36-x)*inset,y*(1-inset),height));
  const foot=ring(8,.10), outer=ring(9.5), shoulder=ring(14.5), crest=ring(16.2,.13);
  face(mesh,foot.slice().reverse(),'#3c718e');
  join(mesh,foot,outer,'#417e9c');
  join(mesh,outer,shoulder,'#589bb6');
  join(mesh,shoulder,crest,'#9ac8d6');
  face(mesh,crest,'#6baac1');
  for(const y of [-15,-7.5,0,7.5,15]) {
    const section=(x,width,z,thickness)=>[
      world(x,y-width,z-thickness),world(x,y+width,z-thickness),
      world(x,y+width,z+thickness),world(x,y-width,z+thickness)
    ];
    const root=section(41,2.35,12.3,2.5);
    const elbow=section(48.5,2.25,10.6,2.0);
    const tip=section(56,1.75,4.9,1.55);
    const toe=section(57.5,1.4,2.3,1.55);
    join(mesh,root,elbow,'#68abc3');
    join(mesh,elbow,tip,'#579bb8');
    join(mesh,tip,toe,'#4787a8');
    face(mesh,toe,'#578fa9');
  }
  const lip=[world(33,-11.6,16.22),world(35.3,-11.6,16.22),
    world(35.3,11.6,16.22),world(33,11.6,16.22)];
  solid(mesh,lip,lip.map(([x,y,z])=>[x,y,z+.8]),'#a6ccda');
}

const faces=[];
shaft(faces);
head(faces);
const rake=compile(faces);

export function drawRakeModel(ctx,x,y,floor,camera) {
  ctx.save();
  shadow(ctx,x-23*cosine,y-23*sine,floor,camera,38,8);
  shadow(ctx,x+40*cosine,y+40*sine,floor,camera,23,22);
  draw(ctx,x,y,floor,camera,rake);
  ctx.restore();
}
