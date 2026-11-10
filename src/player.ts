// Runs one lesson: shows the board, takes moves, judges them, gives hints.
import { Chessground } from '@lichess-org/chessground';
import type { Api } from '@lichess-org/chessground/api';
import type { Key } from '@lichess-org/chessground/types';
import type { DrawShape } from '@lichess-org/chessground/draw';
import { Chess, type Move } from 'chess.js';
import type { Lesson, Step } from './lessons';
import { load, solveStars, starAfter, starMoves, uci } from './engine';
import { hintMove, judgeMove, judgeSafety, legalDests, pieceName } from './judge';
import { MateTable, fromBoard, movesOf, play, searchMove, sqName, toFen, type Heavy, type Mini } from './endgame';

const tables = new Map<Heavy, Promise<MateTable>>();
function getTable(piece: Heavy): Promise<MateTable> {
  let t = tables.get(piece);
  if (!t) {
    t = new Promise((resolve) => {
      // Build the table in a worker; if workers are blocked, build it here instead.
      const local = () => setTimeout(() => resolve(new MateTable(piece)), 50);
      try {
        const w = new Worker(new URL('./tableWorker.ts', import.meta.url), { type: 'module' });
        w.onmessage = (e) => {
          resolve(new MateTable(piece, { w: e.data.w, b: e.data.b }));
          w.terminate();
        };
        w.onerror = () => {
          w.terminate();
          local();
        };
        w.postMessage(piece);
      } catch {
        local();
      }
    });
    tables.set(piece, t);
  }
  return t;
}

export interface PlayerUI {
  board: HTMLElement;
  prompt: HTMLElement;
  feedback: HTMLElement;
  counter: HTMLElement;
  dots: HTMLElement;
  hintBtn: HTMLButtonElement;
  undoBtn: HTMLButtonElement;
  nextBtn: HTMLButtonElement;
  pickPromotion: () => Promise<string>;
  onFinish: (stars: number) => void;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class LessonPlayer {
  private cg: Api;
  private stepIndex = 0;
  private mistakes = 0;
  private endgameStars = 3;
  private chess!: Chess;
  private stepMistakes = 0;
  private hintLevel = 0;
  private ply = 0;
  private starsLeft: string[] = [];
  private starMovesMade = 0;
  private par = 0;
  private busy = false;
  private solved = false;
  private history: string[] = [];
  private table?: MateTable;
  private whiteMoves = 0;
  private startDtm = 0;
  private destroyed = false;

  constructor(private lesson: Lesson, private ui: PlayerUI) {
    this.cg = Chessground(ui.board, {
      orientation: 'white',
      coordinates: true,
      animation: { enabled: true, duration: 220 },
      highlight: { lastMove: true, check: true },
      movable: { free: false, color: 'white', showDests: true, events: { after: (o, d) => this.onUserMove(o, d) } },
      premovable: { enabled: false },
      draggable: { enabled: true, showGhost: true },
      drawable: { enabled: false, visible: true },
    });
    // The board can shift when the text above it changes, so measure it afresh on every touch.
    const remeasure = () => this.cg.state.dom.bounds.clear();
    for (const ev of ['mousedown', 'touchstart', 'pointerdown']) ui.board.addEventListener(ev, remeasure, { capture: true, passive: true });
    ui.hintBtn.onclick = () => this.hint();
    ui.undoBtn.onclick = () => this.undo();
    ui.nextBtn.onclick = () => this.next();
    this.startStep(0);
  }

  destroy() {
    this.destroyed = true;
    this.cg.destroy();
  }

  private get step(): Step {
    return this.lesson.steps[this.stepIndex];
  }

  private renderDots() {
    this.ui.dots.innerHTML = '';
    if (this.lesson.steps.length < 2) return;
    this.lesson.steps.forEach((_, i) => {
      const d = document.createElement('span');
      d.className = 'dot' + (i < this.stepIndex ? ' done' : i === this.stepIndex ? ' current' : '');
      this.ui.dots.appendChild(d);
    });
  }

  private say(text: string, tone: 'info' | 'good' | 'bad' | 'tip' = 'info') {
    this.ui.feedback.textContent = text;
    this.ui.feedback.className = 'feedback ' + tone;
  }

  private async startStep(i: number) {
    this.stepIndex = i;
    this.stepMistakes = 0;
    this.hintLevel = 0;
    this.ply = 0;
    this.solved = false;
    this.history = [];
    this.whiteMoves = 0;
    this.table = undefined;
    const s = this.step;
    this.chess = load(s.fen);
    this.ui.prompt.textContent = s.prompt;
    this.ui.counter.textContent = '';
    this.ui.nextBtn.hidden = true;
    this.ui.hintBtn.hidden = false;
    this.ui.hintBtn.disabled = false;
    this.ui.undoBtn.hidden = s.goal.kind !== 'endgame';
    this.ui.undoBtn.textContent = 'Take back';
    this.say(i === 0 ? '' : '');
    this.renderDots();
    if (s.goal.kind === 'stars') {
      this.starsLeft = [...s.goal.stars];
      this.starMovesMade = 0;
      this.par = solveStars({ fen: s.fen, stars: s.goal.stars, movable: s.movable, safe: s.goal.safe })?.length ?? 0;
      this.ui.counter.textContent = `Moves: 0 · Best: ${this.par}`;
    }
    this.sync();
    if (s.pre?.length) {
      this.lock();
      await wait(700);
      for (const p of s.pre) {
        const m = this.chess.move({ from: p.slice(0, 2), to: p.slice(2, 4) });
        this.cg.move(m.from as Key, m.to as Key);
        await wait(300);
      }
      this.sync();
    }
    if (s.goal.kind === 'endgame') await this.prepareEndgame();
  }

  private async prepareEndgame() {
    const g = this.step.goal;
    if (g.kind !== 'endgame') return;
    if (g.piece !== 'rr') {
      this.lock();
      this.say('Your coach is studying the position…');
      this.table = await getTable(g.piece);
      if (this.destroyed) return;
      this.startDtm = this.table.value(this.mini());
      this.ui.counter.textContent = `Mate in ${this.startDtm} with perfect play`;
      this.say('');
      this.sync();
    } else {
      this.ui.counter.textContent = 'Moves: 0';
    }
  }

  private mini(): Mini {
    return fromBoard(this.chess.board().flat().filter((x) => x !== null), this.chess.turn())!;
  }

  private lock() {
    this.cg.set({ movable: { color: undefined, dests: new Map() } });
  }

  private sync(lastMove?: [string, string]) {
    const s = this.step;
    const fen = this.chess.fen();
    const custom = new Map<Key, string>();
    if (s.goal.kind === 'stars') {
      for (const st of this.starsLeft) custom.set(st as Key, this.chess.get(st as never) ? 'target' : 'star');
    }
    const whiteToMove = s.goal.kind === 'stars' || this.chess.turn() === 'w';
    const canMove = !this.solved && !this.busy && whiteToMove;
    this.cg.set({
      fen,
      turnColor: whiteToMove ? 'white' : 'black',
      check: s.goal.kind !== 'stars' && this.chess.inCheck() ? (this.chess.turn() === 'w' ? 'white' : 'black') : false,
      lastMove: lastMove as Key[] | undefined,
      highlight: { custom },
      movable: {
        color: canMove ? 'white' : undefined,
        dests: canMove ? (legalDests(s, fen) as Map<Key, Key[]>) : new Map(),
      },
    });
    if (!lastMove) this.cg.set({ lastMove: undefined });
  }

  private arrows(shapes: DrawShape[]) {
    this.cg.setAutoShapes(shapes);
  }

  private async pickMove(orig: string, dest: string): Promise<Move | undefined> {
    const s = this.step;
    const fen = this.chess.fen();
    const candidates =
      s.goal.kind === 'stars'
        ? starMoves({ movable: s.movable }, fen)
        : load(fen).moves({ verbose: true });
    const matches = candidates.filter((m) => m.from === orig && m.to === dest);
    if (matches.length <= 1) return matches[0];
    if (s.goal.kind === 'stars') return matches.find((m) => m.promotion === 'q');
    const choice = await this.ui.pickPromotion();
    return matches.find((m) => m.promotion === choice) ?? matches.find((m) => m.promotion === 'q');
  }

  private async onUserMove(orig: string, dest: string) {
    if (this.busy || this.solved) return;
    this.arrows([]);
    const m = await this.pickMove(orig, dest);
    if (!m) {
      this.sync();
      return;
    }
    const s = this.step;
    if (s.goal.kind === 'stars') return this.starMove(m);
    if (s.goal.kind === 'endgame') return this.endgameMove(m);

    const before = load(this.chess.fen());
    const v = judgeMove(s.goal, before, m, this.ply);
    this.chess.move(m);
    this.sync([m.from, m.to]);
    if (v.ok) {
      const g = s.goal;
      this.ply++;
      if (g.kind === 'solution' && this.ply < g.moves.length) {
        this.busy = true;
        this.say('Good move!', 'good');
        await wait(600);
        const reply = g.moves[this.ply];
        const r = this.chess.move({ from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: reply[4] });
        this.ply++;
        this.busy = false;
        this.sync([r.from, r.to]);
        return;
      }
      return this.stepSolved();
    }
    // Wrong: show why, then put the pieces back.
    if (!v.soft) {
      this.mistakes++;
      this.stepMistakes++;
    }
    this.say(v.message ?? 'Not quite. Try again.', v.soft ? 'tip' : 'bad');
    this.busy = true;
    this.lock();
    if (v.arrow) this.arrows([{ orig: v.arrow[0] as Key, dest: v.arrow[1] as Key, brush: 'red' }]);
    await wait(v.arrow ? 2200 : 1400);
    if (this.destroyed) return;
    this.chess.undo();
    this.busy = false;
    this.arrows([]);
    this.sync();
  }

  private async starMove(m: Move) {
    const s = this.step;
    if (s.goal.kind !== 'stars') return;
    if (s.goal.safe) {
      const v = judgeSafety(m);
      if (!v.ok) {
        this.mistakes++;
        this.stepMistakes++;
        this.say(v.message!, 'bad');
        this.busy = true;
        this.chess = load(starAfter(m));
        this.sync([m.from, m.to]);
        this.lock();
        if (v.arrow) this.arrows([{ orig: v.arrow[0] as Key, dest: v.arrow[1] as Key, brush: 'red' }]);
        await wait(2000);
        if (this.destroyed) return;
        this.chess = load(m.before);
        this.busy = false;
        this.arrows([]);
        this.sync();
        return;
      }
    }
    this.starMovesMade++;
    this.starsLeft = this.starsLeft.filter((x) => x !== m.to);
    this.chess = load(starAfter(m));
    this.hintLevel = 0;
    this.ui.counter.textContent = `Moves: ${this.starMovesMade} · Best: ${this.par}`;
    if (this.starsLeft.length === 0) {
      const extra = Math.max(0, this.starMovesMade - this.par);
      this.mistakes += extra;
      this.sync([m.from, m.to]);
      return this.stepSolved(
        extra === 0 ? `Perfect: ${this.starMovesMade} moves, the shortest way.` : `Done in ${this.starMovesMade} moves. It can be done in ${this.par}.`,
      );
    }
    this.say(m.captured ? `Captured the ${pieceName(m.captured)}!` : '', 'good');
    this.sync([m.from, m.to]);
  }

  private async endgameMove(m: Move) {
    const g = this.step.goal;
    if (g.kind !== 'endgame') return;
    const beforeVal = this.table ? this.table.value(this.mini()) : -1;
    this.history.push(this.chess.fen());
    this.chess.move(m);
    this.whiteMoves++;
    this.sync([m.from, m.to]);
    if (this.chess.isCheckmate()) return this.endgameWon();
    if (this.chess.isStalemate()) {
      this.mistakes++;
      this.say('Stalemate: the king is not in check but cannot move. That is a draw. Take back and leave the king a square.', 'bad');
      this.lock();
      return;
    }
    // Coach comment on the move.
    let mini = this.mini();
    let comment = '';
    if (this.table) {
      const after = this.table.value(mini);
      if (after < 0) comment = '';
      else if (after === beforeVal - 1) comment = 'Excellent move.';
      else comment = `That works, but it is slower. Mate in ${after} now.`;
    }
    this.busy = true;
    this.lock();
    await wait(450);
    if (this.destroyed) return;
    // Black replies.
    const replies = movesOf(mini);
    let reply = replies.find((r) => r.capture);
    if (!reply) {
      if (this.table) {
        let best = -1;
        const options: typeof replies = [];
        for (const r of replies) {
          const v = this.table.value(play(mini, r));
          if (v > best) {
            best = v;
            options.length = 0;
          }
          if (v === best) options.push(r);
        }
        reply = options[Math.floor(Math.random() * options.length)];
      } else {
        reply = searchMove(mini, 2, this.history.map((f) => toFen(fromBoard(load(f).board().flat().filter((x) => x !== null), 'w')!)));
      }
    }
    const r = this.chess.move({ from: sqName(reply!.from), to: sqName(reply!.to) });
    this.busy = false;
    mini = this.mini();
    this.ui.counter.textContent = this.table ? `Mate in ${this.table.value(mini)} · Moves: ${this.whiteMoves}` : `Moves: ${this.whiteMoves}`;
    if (r.captured) {
      this.mistakes++;
      this.sync([r.from, r.to]);
      this.lock();
      this.say(`The king captured your ${pieceName(r.captured)}! Keep it protected by your king, or far away. Take back and try again.`, 'bad');
      return;
    }
    this.hintLevel = 0;
    this.say(comment, comment.startsWith('Excellent') ? 'good' : comment ? 'tip' : 'info');
    this.sync([r.from, r.to]);
  }

  private endgameWon() {
    const g = this.step.goal;
    if (g.kind !== 'endgame') return;
    const target = g.piece === 'rr' ? g.par : this.startDtm + g.par;
    const n = this.whiteMoves;
    this.endgameStars = n <= target ? 3 : n <= Math.ceil(target * 1.6) ? 2 : 1;
    this.stepSolved(`Checkmate in ${n} moves! ${n <= target ? 'Great technique.' : `Try for ${target} or fewer next time.`}`);
  }

  private undo() {
    if (this.busy) return;
    if (this.history.length === 0) return;
    this.mistakes++;
    this.chess = load(this.history.pop()!);
    this.whiteMoves = Math.max(0, this.whiteMoves - 1);
    this.solved = false;
    this.arrows([]);
    this.say('Took back your last move.');
    if (this.table) this.ui.counter.textContent = `Mate in ${this.table.value(this.mini())} · Moves: ${this.whiteMoves}`;
    this.sync();
  }

  private hint() {
    if (this.busy || this.solved) return;
    const s = this.step;
    let move: { from: string; to: string } | undefined;
    if (s.goal.kind === 'endgame') {
      const mini = this.mini();
      if (mini.turn !== 'w' || this.chess.isGameOver()) return;
      if (this.table) {
        let best = Infinity;
        for (const m of movesOf(mini)) {
          const v = this.table.value(play(mini, m));
          if (v >= 0 && v < best) {
            best = v;
            move = { from: sqName(m.from), to: sqName(m.to) };
          }
        }
      } else {
        const m = searchMove(mini, 4);
        if (m) move = { from: sqName(m.from), to: sqName(m.to) };
      }
    } else {
      move = hintMove(s, this.chess.fen(), this.ply, this.starsLeft);
    }
    this.hintLevel++;
    this.mistakes++;
    this.stepMistakes++;
    if (!move) return;
    this.ui.board.dataset.hint = move.from + move.to;
    if (this.hintLevel === 1) {
      const p = this.chess.get(move.from as never);
      this.say(s.tip ?? `Try moving your ${pieceName(p?.type ?? '')}.`, 'tip');
      this.arrows([{ orig: move.from as Key, brush: 'green' }]);
    } else {
      this.say(s.tip ? s.tip : 'Like this:', 'tip');
      this.arrows([{ orig: move.from as Key, dest: move.to as Key, brush: 'green' }]);
    }
  }

  private stepSolved(text?: string) {
    this.solved = true;
    this.arrows([]);
    this.sync(this.cg.state.lastMove as [string, string] | undefined);
    this.lock();
    const praise = ['Well done!', 'Correct!', 'Nice!', 'Exactly!'][Math.floor(Math.random() * 4)];
    this.say([text ?? praise, this.step.done].filter(Boolean).join(' '), 'good');
    this.ui.hintBtn.hidden = true;
    this.ui.undoBtn.hidden = true;
    const last = this.stepIndex === this.lesson.steps.length - 1;
    this.ui.nextBtn.textContent = last ? 'Finish lesson' : 'Next';
    this.ui.nextBtn.hidden = false;
    this.ui.nextBtn.focus({ preventScroll: true });
  }

  private next() {
    if (!this.solved) return;
    if (this.stepIndex < this.lesson.steps.length - 1) {
      this.startStep(this.stepIndex + 1);
      return;
    }
    const isEndgame = this.lesson.steps.some((s) => s.goal.kind === 'endgame');
    const byMistakes = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    const stars = isEndgame ? Math.min(this.endgameStars, this.mistakes <= 2 ? 3 : 2) : byMistakes;
    this.ui.onFinish(stars);
  }
}

export { uci };
