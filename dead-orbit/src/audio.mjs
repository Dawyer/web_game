/**
 * audio.mjs — Web Audio 现场合成音效，不落音频文件、无外链。
 * 声音只做氛围与反馈，不承载解谜信息（听障可玩）。
 * AudioContext 必须由用户手势解锁；切后台 suspend、回前台 resume。
 */

export class AudioKit {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
    this.ambientNodes = [];
    this.unlocked = false;
  }

  /** 由「开始游戏」点击调用，解锁音频上下文。 */
  unlock() {
    if (this.unlocked) { this.ctx?.resume?.(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.unlocked = true;
      this.startAmbient();
    } catch { /* 音频不可用时静默降级 */ }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
  }

  /** 切后台暂停、回前台恢复。 */
  suspend() { this.ctx?.suspend?.(); }
  resume() { if (!this.muted) this.ctx?.resume?.(); }

  /** 舱体低频嗡鸣 + 通风滤波白噪，作为氛围铺底。 */
  startAmbient() {
    if (!this.ctx || this.ambientNodes.length) return;
    const ctx = this.ctx;
    // 低频 drone：两个略微失谐的振荡器
    for (const freq of [52, 55]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0.025;
      osc.connect(gain).connect(this.master);
      osc.start();
      this.ambientNodes.push(osc);
    }
    // 通风白噪：短缓冲循环 + 低通
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = ctx.createGain();
    gain.gain.value = 0.02;
    noise.connect(filter).connect(gain).connect(this.master);
    noise.start();
    this.ambientNodes.push(noise);
  }

  /** 通用短音：一个振荡器 + 包络。 */
  tone(freq, dur, type = 'sine', vol = 0.15, when = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** 事件音效分派。 */
  play(type) {
    if (!this.ctx || this.muted) return;
    switch (type) {
      case 'inspect':  this.tone(420, 0.06, 'sine', 0.08); break;
      case 'select':   this.tone(620, 0.05, 'triangle', 0.09); break;
      case 'cancel':   this.tone(300, 0.05, 'sine', 0.06); break;
      case 'pickup':   [523, 659, 784].forEach((f, i) => this.tone(f, 0.12, 'sine', 0.12, i * 0.06)); break;
      case 'key':      this.tone(240, 0.04, 'square', 0.06); break;
      case 'backspace':this.tone(200, 0.05, 'square', 0.05); break;
      case 'clear':    this.tone(180, 0.08, 'square', 0.05); break;
      case 'failure':  this.tone(140, 0.3, 'sawtooth', 0.1, 0, 90); break;
      case 'use':      this.tone(330, 0.25, 'sine', 0.12, 0, 660); this.tone(880, 0.2, 'sine', 0.08, 0.15); break;
      case 'clue':     this.tone(700, 0.1, 'sine', 0.08); this.tone(900, 0.12, 'sine', 0.07, 0.08); break;
      case 'power':    this.tone(80, 0.6, 'sawtooth', 0.12, 0, 200); this.tone(400, 0.4, 'sine', 0.08, 0.3); break;
      case 'hint':     this.tone(520, 0.08, 'triangle', 0.08); break;
      case 'escape':
        this.tone(60, 1.2, 'sawtooth', 0.18, 0, 30);
        this.tone(500, 1.0, 'sine', 0.1, 0.2, 1200);
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.1, 0.6 + i * 0.12));
        break;
      default: break;
    }
  }
}
