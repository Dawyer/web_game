export const COLORS = Object.freeze({ red: '#f47766', yellow: '#f7d46e', blue: '#79b4f3', green: '#91d7a3', purple: '#c5a3ed', orange: '#f6a364' });
export const SYMBOLS = Object.freeze({ red: 'A', yellow: 'B', blue: 'C', green: 'D', purple: 'E', orange: 'F' });
export const COLOR_NAMES = Object.freeze({ red: '红', yellow: '黄', blue: '蓝', green: '绿', purple: '紫', orange: '橙' });
export const DIRECTION_NAMES = Object.freeze({ N: '上', E: '右', S: '下', W: '左' });
const ANGLES = { E: 0, S: Math.PI / 2, W: Math.PI, N: -Math.PI / 2 };
const TINTS = { red: -35, yellow: 8, blue: 160, green: 65, purple: 220, orange: -12 };

export function layoutFor({ width, override = 'auto' }) {
  return ['desktop', 'mobile'].includes(override) ? override : width < 800 ? 'mobile' : 'desktop';
}
export function boardGeometry(width, height, level) {
  const cell = Math.min(width / (level.w + 1.5), height / (level.h + 1.5));
  const rail = cell * .65, left = (width - level.w * cell) / 2, top = (height - level.h * cell) / 2;
  return { cell, rail, left: left - rail, top: top - rail, right: left + level.w * cell + rail, bottom: top + level.h * cell + rail,
    innerLeft: left, innerTop: top, center: (x, y) => ({ x: left + (x + .5) * cell, y: top + (y + .5) * cell }) };
}
export function hitBall(x, y, geometry, state) {
  return [...state.balls].reverse().find(ball => {
    const p = geometry.center(ball.x, ball.y);
    return Math.hypot(x - p.x, y - p.y) <= geometry.cell * .5;
  }) ?? null;
}

/** Event interpolation never changes the already-persisted stable state. */
export function animationFrame(before, events, elapsed, stepMs = 100, reduced = false) {
  const balls = before.balls.map(ball => ({ ...ball, rotation: 0, scale: 1, squeeze: 0, ghosts: [] }));
  const total = events.length * stepMs, done = reduced || elapsed >= total;
  const time = reduced ? total : Math.max(0, elapsed);
  for (let i = 0; i < events.length; i++) {
    const event = events[i], start = i * stepMs;
    if (time < start) break;
    const ball = balls.find(b => b.id === event.id);
    if (!ball) continue;
    const raw = Math.min(1, (time - start) / stepMs), p = raw * raw * (3 - 2 * raw);
    const from = event.from ?? ball, to = event.to ?? from;
    ball.dir = (event.type === 'transfer' ? event.reflectedDir : event.dir) ?? ball.dir;
    if (['move', 'mirror', 'pocket'].includes(event.type)) {
      ball.x = from.x + (to.x - from.x) * p; ball.y = from.y + (to.y - from.y) * p;
      ball.rotation += ((to.x - from.x) || (to.y - from.y)) * p * 2.3;
      if (raw < 1 && !reduced) ball.ghosts = [.14, .28].map(lag => ({ x: from.x + (to.x - from.x) * Math.max(0, p - lag), y: from.y + (to.y - from.y) * Math.max(0, p - lag) }));
    }
    if (['bounce', 'transfer', 'mirror'].includes(event.type)) ball.squeeze = raw < 1 && !reduced ? Math.sin(raw * Math.PI) * .19 : 0;
    if (event.type === 'transfer') {
      const other = balls.find(b => b.id === event.otherId);
      if (other) other.dir = event.dir;
    }
    if (event.type === 'pocket') { ball.scale = 1 - p; if (raw === 1) balls.splice(balls.indexOf(ball), 1); }
    if (raw < 1) break;
    ball.ghosts = [];
  }
  return { balls, done, elapsed: time, total };
}

function drawAsset(ctx, image, x, y, width, height, rotation = 0, alpha = 1) {
  if (!image) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(rotation);
  ctx.drawImage(image, -width / 2, -height / 2, width, height); ctx.restore();
}
function tile(ctx, image, x, y, width, height, size) {
  for (let cy = y; cy < y + height; cy += size) for (let cx = x; cx < x + width; cx += size) {
    const w = Math.min(size, x + width - cx), h = Math.min(size, y + height - cy);
    ctx.drawImage(image, 0, 0, image.width * w / size, image.height * h / size, cx, cy, w, h);
  }
}
function ring(ctx, image, p, size, color, alpha = 1) {
  ctx.save(); ctx.filter = `brightness(.75) sepia(1) saturate(8) hue-rotate(${TINTS[color] ?? 0}deg)`;
  drawAsset(ctx, image, p.x, p.y, size, size, 0, alpha); ctx.restore();
}
function label(ctx, text, x, y, size, color = '#fff5d7') {
  ctx.save(); ctx.font = `800 ${size}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, size / 7); ctx.strokeStyle = '#172a25'; ctx.fillStyle = color;
  ctx.strokeText(text, x, y); ctx.fillText(text, x, y); ctx.restore();
}

export function renderCanvas(canvas, assets, model, { width, height, dpr = 1, frame = null } = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !model.level || !model.state) return null;
  const pixelWidth = Math.round(width * dpr), pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
  const { level, state, selected, settings = {} } = model, g = boardGeometry(width, height, level), c = g.cell;
  ctx.save(); ctx.shadowColor = '#061612'; ctx.shadowBlur = c * .2; ctx.shadowOffsetY = 5;
  tile(ctx, assets.wood, g.left, g.top, g.right - g.left, g.bottom - g.top, c * 3); ctx.restore();
  tile(ctx, assets.felt, g.innerLeft, g.innerTop, c * level.w, c * level.h, c * 3);
  for (const exit of level.exits ?? []) {
    const p = exit.edge === 'N' ? g.center(exit.index, -.58) : exit.edge === 'S' ? g.center(exit.index, level.h - .42) : exit.edge === 'W' ? g.center(-.58, exit.index) : g.center(level.w - .42, exit.index);
    drawAsset(ctx, assets.pocket, p.x, p.y, c * .95, c * .95);
    ring(ctx, assets.ring, p, c, exit.color);
    if (settings.symbols !== false) label(ctx, SYMBOLS[exit.color], p.x, p.y, c * .23, COLORS[exit.color]);
  }
  for (const block of level.blocks ?? []) { const p = g.center(block.x, block.y); drawAsset(ctx, assets.block, p.x, p.y, c * .9, c * .9); }
  for (const mirror of level.mirrors ?? []) { const p = g.center(mirror.x, mirror.y); drawAsset(ctx, assets.mirror, p.x, p.y, c * .94, c * .94, mirror.kind === '\\' ? Math.PI / 2 : 0); }
  for (const ball of frame?.balls ?? state.balls) {
    const p = g.center(ball.x, ball.y), scale = ball.scale ?? 1, squeeze = ball.squeeze ?? 0, image = assets[`ball_${ball.color}`];
    for (const ghost of ball.ghosts ?? []) { const q = g.center(ghost.x, ghost.y); drawAsset(ctx, image, q.x, q.y, c * .76, c * .76, ball.rotation ?? 0, .13); }
    ctx.save(); ctx.shadowColor = '#061712'; ctx.shadowOffsetY = c * .07; ctx.shadowBlur = c * .1;
    drawAsset(ctx, image, p.x, p.y, c * .83 * scale * (1 + squeeze), c * .83 * scale * (1 - squeeze), ball.rotation ?? 0); ctx.restore();
    if (selected === ball.id) ring(ctx, assets.ring, p, c * .97 * scale, ball.color, .95);
    drawAsset(ctx, assets.arrow, p.x, p.y - c * .07 * scale, c * .43 * scale, c * .21 * scale, ANGLES[ball.dir] ?? 0);
    if (settings.symbols !== false && scale > .15) label(ctx, SYMBOLS[ball.color], p.x, p.y + c * .19 * scale, Math.max(10, c * .23 * scale));
    if (squeeze > .06) ring(ctx, assets.ring, p, c * (1 + squeeze), ball.color, squeeze * 2);
  }
  return g;
}

export class CanvasView {
  constructor(canvas, assets, { onSound = () => {}, now = () => performance.now(), raf = fn => requestAnimationFrame(fn) } = {}) {
    this.canvas = canvas; this.assets = assets; this.onSound = onSound; this.now = now; this.raf = raf; this.animation = null;
  }
  paint(model) {
    this.model = model;
    const box = this.canvas.parentElement.getBoundingClientRect();
    const frame = this.animation ? animationFrame(this.animation.before, this.animation.events, this.now() - this.animation.start, this.animation.stepMs, model.settings.reducedMotion) : null;
    this.geometry = renderCanvas(this.canvas, this.assets, model, { width: Math.max(1, box.width), height: Math.max(1, box.height), dpr: globalThis.devicePixelRatio || 1, frame });
    return frame;
  }
  animate(result, model) {
    this.cancel();
    const animation = { ...result, start: this.now(), stepMs: model.settings.reducedMotion ? 0 : 92, soundIndex: -1 };
    this.animation = animation;
    return new Promise(resolve => {
      animation.resolve = resolve;
      const step = () => {
        if (this.animation !== animation) return;
        const frame = this.paint(model);
        const index = Math.min(result.events.length - 1, Math.floor((this.now() - animation.start) / Math.max(1, animation.stepMs)));
        if (index > animation.soundIndex) {
          animation.soundIndex = index;
          const type = result.events[index]?.type;
          if (type) this.onSound(type === 'pocket' ? 'pocket' : ['bounce', 'mirror', 'transfer'].includes(type) ? 'bounce' : 'roll');
        }
        if (frame.done) { this.animation = null; this.paint(model); resolve(true); } else this.raf(step);
      };
      this.raf(step);
    });
  }
  cancel() { if (this.animation) { this.animation.resolve?.(false); this.animation = null; } }
  hit(x, y) { return this.geometry && this.model ? hitBall(x, y, this.geometry, this.model.state) : null; }
}
