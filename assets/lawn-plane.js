import { TRAY } from './geometry.js';

const TILE_SIZE = 800;

export function createLawnPlane(canvas, onReady) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const image = new Image();
  const levels = [];
  let previous = null;

  image.onload = () => {
    let tile = image;
    while (true) {
      levels.push(ctx.createPattern(tile, 'repeat'));
      if (tile.width === 1) break;
      const smaller = document.createElement('canvas');
      smaller.width = smaller.height = tile.width / 2;
      smaller.getContext('2d', { alpha: false }).drawImage(tile, 0, 0, smaller.width, smaller.height);
      tile = smaller;
    }
    previous = null;
    onReady();
  };
  image.src = new URL('./grass.jpg', import.meta.url).href;

  function draw({ width, height, zoom, dx, dy }, axes, pixelRatio) {
    if (width <= 0 || height <= 0 || zoom <= 0) return;
    const pixelWidth = Math.max(1, Math.round(width * pixelRatio));
    const pixelHeight = Math.max(1, Math.round(height * pixelRatio));
    const key = [width, height, pixelWidth, pixelHeight, dx, dy, zoom, axes.yaw, axes.pitch];
    if (previous && key.every((value, i) => value === previous[i])) return;
    previous = key;

    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    ctx.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
    if (levels.length) {
      const pixelsAcross = TILE_SIZE * zoom * pixelRatio * Math.sqrt(axes.ground);
      const level = Math.min(levels.length - 1, Math.max(0, Math.floor(Math.log2(image.width / pixelsAcross))));
      const unit = TILE_SIZE * zoom / (image.width / 2 ** level);
      const origin = axes.project(0, 0, TRAY.base);
      const pattern = levels[level];
      pattern.setTransform(new DOMMatrix([
        axes.cosine * unit, axes.sine * axes.ground * unit,
        -axes.sine * unit, axes.cosine * axes.ground * unit,
        dx + zoom * origin.x, dy + zoom * origin.y
      ]));
      ctx.fillStyle = pattern;
    } else {
      ctx.fillStyle = '#51673d';
    }
    ctx.fillRect(0, 0, width, height);
  }

  return { draw };
}
