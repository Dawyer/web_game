const clone = value => structuredClone(value);

/** A visible tab renews a short local lease; storage events revoke peers. */
export class OwnerLease {
  constructor({ storage, id, now = () => Date.now(), key = 'pocket-bounce.owner', ttl = 7000 }) {
    Object.assign(this, { storage, id, now, key, ttl });
  }
  read() { try { return JSON.parse(this.storage.getItem(this.key) || 'null'); } catch { return null; } }
  owns() { const lease = this.read(); return lease?.id === this.id && lease.until > this.now(); }
  claim() {
    const previous = this.read();
    if (previous && previous.id !== this.id && previous.until > this.now()) return false;
    try { this.storage.setItem(this.key, JSON.stringify({ id: this.id, until: this.now() + this.ttl })); } catch { return false; }
    return this.owns();
  }
  renew() { return this.owns() && this.claim(); }
  release() { try { if (this.read()?.id === this.id) this.storage.removeItem(this.key); } catch { /* Cannot claim ownership on write failure. */ } }
}

/** DOM-free orchestration; the engine owns all game rules. */
export class GameController {
  constructor({ levels, engine, save, solve, onSave = () => {}, onEvent = () => {} }) {
    this.levels = levels; this.engine = engine; this.save = save; this.solve = solve;
    this.onSave = onSave; this.onEvent = onEvent; this.mode = 'menu';
    this.locked = false; this.token = 0;
  }
  get state() { return this.save.current?.state ?? null; }
  get level() { return this.levels.find(l => l.id === this.save.current?.levelId); }
  persist() { this.onSave(this.save); }
  open(id) {
    const level = this.levels.find(l => l.id === id);
    if (!level) throw new Error(`未知关卡：${id}`);
    this.save.current = { levelId: id, state: this.engine.initialState(level), history: [], actions: [], hintTier: 0 };
    this.mode = 'play'; this.locked = false; this.token++;
    this.onEvent('attempt', { levelId: id }); this.persist();
  }
  strike(id) {
    if (this.mode !== 'play' || this.locked) return { accepted: false, events: [] };
    const before = clone(this.state), result = this.engine.strike(this.level, before, id);
    if (!result.accepted) return result;
    const current = this.save.current;
    current.history.push(clone(this.state)); current.actions.push(id); current.state = clone(result.state);
    this.locked = true; const token = ++this.token;
    this.settle();
    this.persist();
    return { ...result, token, before };
  }
  restore() {
    if (!this.level || !this.state) return false;
    this.mode = 'pause'; this.locked = false; this.token++; return true;
  }
  pause() {
    if (!this.state) return;
    this.mode = 'pause'; this.locked = false; this.token++; this.persist();
  }
  resume() {
    if (!this.state) return false;
    this.mode = this.state.status === 'playing' ? 'play' : 'result';
    return true;
  }
  menu() { this.mode = 'menu'; this.locked = false; this.token++; this.persist(); }
  undo() {
    const current = this.save.current;
    if (this.locked || !current?.history.length) return false;
    current.state = current.history.pop(); current.actions.pop(); current.hintTier = 0;
    this.token++; this.mode = 'play'; this.onEvent('undo', { levelId: this.level.id }); this.persist(); return true;
  }
  restart() {
    if (!this.level) return false;
    const current = this.save.current;
    current.state = this.engine.initialState(this.level); current.history = []; current.actions = []; current.hintTier = 0;
    this.locked = false; this.token++; this.mode = 'play';
    this.onEvent('restart', { levelId: this.level.id }); this.persist(); return true;
  }
  settle() {
    const { state, level } = this;
    if (state.status === 'won') {
      const previous = this.save.progress[level.id];
      const stars = state.moves <= level.par ? 3 : state.moves <= level.par + 2 ? 2 : 1;
      this.save.progress[level.id] = { bestMoves: Math.min(previous?.bestMoves ?? Infinity, state.moves), stars: Math.max(previous?.stars ?? 0, stars), completed: true };
      this.onEvent(previous?.completed ? 'replayComplete' : 'complete', { levelId: level.id, moves: state.moves, stars });
    } else if (state.status === 'lost') this.onEvent('failure', { levelId: level.id, moves: state.moves });
  }
  async hint() {
    if (this.mode !== 'play' || this.locked || this.hintBusy) return { status: 'blocked', text: '请等待当前操作结束。' };
    const current = this.save.current, tier = Math.min(3, (current.hintTier ?? 0) + 1);
    current.hintTier = tier; this.onEvent('hint', { levelId: this.level.id, tier }); this.persist();
    if (tier === 1) return { status: 'idea', tier, text: this.level.hints?.[0] ?? this.level.intent };
    const token = this.token; this.hintBusy = true;
    let result;
    try { result = this.solve ? await this.solve(this.level, clone(this.state), { maxStates: 25000, maxMs: 80 }) : { status: 'unverified' }; }
    catch { result = { status: 'unverified' }; }
    finally { this.hintBusy = false; }
    if (token !== this.token) return { status: 'stale', tier, text: '局面已变化，请重新请求提示。' };
    if (result.status === 'unsolvable') return { ...result, tier, text: '当前局面剩余步内无解，建议撤销或重开。' };
    if (result.status !== 'solved') return { ...result, tier, status: 'unverified', text: '搜索预算已用尽，当前解法未验证；可稍后重试。' };
    const id = result.solution[0], ball = this.state.balls.find(b => b.id === id);
    return { status: 'solved', tier, id, dir: ball?.dir, solution: tier === 3 ? result.solution : undefined, text: tier === 2 ? `下一击：球 ${id}，方向 ${ball?.dir ?? ''}。` : `当前解法：${result.solution.join(' → ')}。` };
  }
  finishAnimation(token) {
    if (token !== this.token) return false;
    this.locked = false;
    if (this.mode === 'play' && this.state.status !== 'playing') this.mode = 'result';
    return true;
  }
}
