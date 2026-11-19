export const WIDTH = 1100;
export const HEIGHT = 640;
export const HOME_YAW = .128;
export const HOME_PITCH = Math.asin(.64);
export const MIN_PITCH = 28 * Math.PI / 180;
export const MAX_PITCH = 50 * Math.PI / 180;
export const TRAY = {radius:600, wall:28, lip:31, floor:-10, base:-38};

function hexagon(inset) {
  const radius = TRAY.radius - inset / Math.cos(Math.PI / 6);
  return Array.from({length:6}, (_, i) => {
    const angle = (i - 2) * Math.PI / 3;
    return [WIDTH / 2 + radius * Math.cos(angle), HEIGHT / 2 + radius * Math.sin(angle)];
  });
}

export const RIM = hexagon(0);
export const BED = hexagon(TRAY.wall);

export function orthographic(yaw, pitch) {
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  const ground = Math.sin(pitch);
  const up = Math.cos(pitch);
  const depth = (x, y) => (x - WIDTH / 2) * sine + (y - HEIGHT / 2) * cosine;
  function project(x, y, z = 0) {
    return {
      x: WIDTH / 2 + (x - WIDTH / 2) * cosine - (y - HEIGHT / 2) * sine,
      y: HEIGHT / 2 + depth(x, y) * ground - z * up
    };
  }
  function unproject(x, y, z) {
    const across = x - WIDTH / 2;
    const along = (y - HEIGHT / 2 + z * up) / ground;
    return {
      x: WIDTH / 2 + across * cosine + along * sine,
      y: HEIGHT / 2 - across * sine + along * cosine
    };
  }
  return {yaw, pitch, cosine, sine, ground, up, depth, project, unproject};
}
