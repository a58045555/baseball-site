// The PixelLab pixel pitcher: 24 side-view frames (facing the plate, to the right) posed from
// models/pitching-motion.json. Shared by chapter 4 and the playground's 2D side view.
export const SIZE = 160;
// Capture frame (60 fps) each image was posed from; pitch-00 is the standing sprite.
export const CAPTURE = [null, 0, 14, 28, 40, 50, 59, 66, 73, 79, 84, 88, 91, 94, 96, 98, 100, 103, 106, 110, 115, 121, 128, 135, 141];
export const RELEASE_FRAME = 17;
// Sprite pixel the ball sits at while it is visible in the throwing hand; it hides in the glove before.
export const BALL = { 7: [56, 101], 8: [29, 95], 9: [11, 70], 10: [11, 47], 11: [19, 30], 12: [28, 21], 13: [41, 18],
  14: [55, 19], 15: [73, 22], 16: [100, 30], 17: [150, 51] };
// Sole line of the sprites (the standing sprite's lowest pixel).
export const GROUND = 157;

// Loaded on first use (about 320 KB), not when the page loads.
let frames = null, loading = null;
export function load() {
  if (!loading) {
    frames = CAPTURE.map((_, i) => { const img = new Image(); img.decoding = 'async'; img.src = new URL(`./models/pixel-pitcher/pitch-${String(i).padStart(2, '0')}.png`, import.meta.url).href; return img; });
    loading = Promise.all(frames.map(img => img.decode().catch(() => {})));
  }
  return loading;
}

// The last frame posed at or before capture time t (seconds).
export function frameAt(t) {
  const f = t * 60;
  let i = 1;
  while (i < CAPTURE.length - 1 && CAPTURE[i + 1] <= f) i++;
  return i;
}

// Draw frame i so sprite pixel (ax, ay) lands on canvas point (x, y), scaled by k; mirror flips it to face left.
export function draw(c, i, x, y, k, ax, ay, mirror = false) {
  load();
  const img = frames[i];
  if (!img.complete || !img.naturalWidth) return false;
  c.save();
  c.imageSmoothingEnabled = false;
  c.translate(x, y);
  if (mirror) c.scale(-1, 1);
  c.drawImage(img, -ax * k, -ay * k, SIZE * k, SIZE * k);
  c.restore();
  return true;
}

// A pixel baseball centred on (x, y), r canvas pixels across the white.
export function ball(c, x, y, r, alpha = 1) {
  const u = Math.max(1, Math.round(r / 5));
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = '#1b1b1b'; c.fillRect(x - 2.5 * u, y - 3.5 * u, 5 * u, 7 * u); c.fillRect(x - 3.5 * u, y - 2.5 * u, 7 * u, 5 * u);
  c.fillStyle = '#fffaf0'; c.fillRect(x - 2.5 * u, y - 2.5 * u, 5 * u, 5 * u);
  c.fillStyle = '#d23a3a'; c.fillRect(x - 1.5 * u, y - 2.5 * u, u, u); c.fillRect(x + .5 * u, y + .5 * u, u, u);
  c.restore();
}
