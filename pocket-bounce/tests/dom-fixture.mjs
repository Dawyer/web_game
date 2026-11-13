// Explicit DOM/canvas fixtures for application wiring, NOT a browser emulator.
// Geometry/CSS/audio decoding/real pointer delivery require coordinator's browser.
export function fixture({ width = 390, height = 844, data = new Map(), query = '?automated=1' } = {}) {
  let mono = 0; const timers = [], downloads = [], audio = [], drawCalls = [];
  class Element {
    constructor(key) { this.key = key; this.dataset = {}; this.style = {}; this.hidden = false; this.listeners = {}; this.textContent = ''; this.innerHTML = ''; this.disabled = false; this.files = []; }
    addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
    dispatch(type, detail = {}) { for (const fn of this.listeners[type] ?? []) fn({ target: this, preventDefault() {}, ...detail }); }
    closest(selector) { return selector.includes('data-action') && this.dataset.action ? this : null; }
    setAttribute(k, v) { this[k] = v; }
    focus() { doc.activeElement = this; }
    querySelectorAll() { return []; }
    append() {} remove() {} click() { if (this.download) downloads.push(this); }
    getBoundingClientRect() { return { left: 0, top: 0, width: width < 800 ? width - 16 : width - 350, height: height - 410 }; }
  }
  const elements = new Map();
  const get = key => { if (!elements.has(key)) elements.set(key, new Element(key)); return elements.get(key); };
  const doc = Object.assign(new Element('document'), { hidden: false, documentElement: get('html'), body: get('body'), querySelector: get, createElement: tag => new Element(tag) });
  get('#board').parentElement = get('.board-wrap');
  const ctx = new Proxy({ drawImage(...args) { drawCalls.push(args[0]?.src); } }, { get: (t, k) => t[k] ?? (() => {}), set: (t, k, v) => (t[k] = v, true) });
  get('#board').getContext = () => ctx;
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
  const win = Object.assign(new Element('window'), { innerWidth: width, innerHeight: height, devicePixelRatio: 2, performance: { now: () => mono }, crypto: { randomUUID: () => `fixture-${width}-${height}` }, localStorage: storage, location: { search: query, href: 'http://localhost/pocket-bounce/' + query }, history: { replaceState() {} }, URL: class extends URL { static createObjectURL() { return 'blob:test'; } static revokeObjectURL() {} }, Blob,
    setTimeout, setInterval(fn) { timers.push(fn); },
    Audio: class extends Element { constructor(src) { super(src); this.src = src; audio.push(this); } play() { return Promise.resolve(); } pause() { this.paused = true; } }
  });
  class ImageFixture { set src(src) { this._src = src; this.width = this.height = 320; queueMicrotask(() => this.onload()); } get src() { return this._src; } }
  const click = async (action, extra = {}) => { const target = new Element('button'); target.dataset = { action, ...extra }; doc.dispatch('click', { target, isTrusted: false }); if (['hint', 'more-hint'].includes(action)) await new Promise(resolve => setTimeout(resolve, 25)); await flush(); };
  const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(setImmediate); };
  const old = { Image: globalThis.Image, performance: globalThis.performance, requestAnimationFrame: globalThis.requestAnimationFrame };
  globalThis.Image = ImageFixture; globalThis.performance = win.performance;
  globalThis.requestAnimationFrame = fn => queueMicrotask(() => { mono += 100; fn(mono); });
  return { doc, win, get, click, flush, data, downloads, audio, drawCalls, advance(ms) { mono += ms; for (const fn of timers) fn(); }, cleanup() { for (const [k, v] of Object.entries(old)) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; } } };
}