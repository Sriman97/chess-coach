// A tiny, fast model of "king and heavy pieces against a lone king".
// It powers the checkmate lessons: perfect play for king + queen and king +
// rook (a small table of distance-to-mate), and a quick search for two rooks.

export type Heavy = 'q' | 'r';
export interface Mini {
  wk: number;
  bk: number;
  ps: { t: Heavy; s: number }[];
  turn: 'w' | 'b';
}
export interface MiniMove {
  from: number;
  to: number;
  capture?: boolean;
}

const fileOf = (s: number) => s & 7;
const rankOf = (s: number) => s >> 3;
export const sqName = (s: number) => 'abcdefgh'[fileOf(s)] + (rankOf(s) + 1);
export const sqIndex = (n: string) => 'abcdefgh'.indexOf(n[0]) + (Number(n[1]) - 1) * 8;

const KING_STEPS: number[][] = [];
for (let s = 0; s < 64; s++) {
  const out: number[] = [];
  for (let df = -1; df <= 1; df++)
    for (let dr = -1; dr <= 1; dr++) {
      if (!df && !dr) continue;
      const f = fileOf(s) + df, r = rankOf(s) + dr;
      if (f >= 0 && f < 8 && r >= 0 && r < 8) out.push(r * 8 + f);
    }
  KING_STEPS.push(out);
}
const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const QUEEN_DIRS = [...ROOK_DIRS, [1, 1], [1, -1], [-1, 1], [-1, -1]];

export const adjacent = (a: number, b: number) =>
  Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b))) <= 1;

/** Squares a slider on s reaches, stopping at (and including) blockers. */
function rays(t: Heavy, s: number, occupied: (q: number) => boolean, visit: (q: number) => void) {
  for (const [df, dr] of t === 'q' ? QUEEN_DIRS : ROOK_DIRS) {
    let f = fileOf(s) + df, r = rankOf(s) + dr;
    while (f >= 0 && f < 8 && r >= 0 && r < 8) {
      const q = r * 8 + f;
      visit(q);
      if (occupied(q)) break;
      f += df;
      r += dr;
    }
  }
}

/** Is square q attacked by White? `ignore` squares are treated as empty. */
function whiteAttacks(p: Mini, q: number, ignore = -1, skipPiece = -1): boolean {
  if (adjacent(p.wk, q)) return true;
  const occ = (x: number) =>
    x !== ignore && (x === p.wk || x === p.bk || p.ps.some((pc, i) => i !== skipPiece && pc.s === x));
  let hit = false;
  p.ps.forEach((pc, i) => {
    if (hit || i === skipPiece) return;
    rays(pc.t, pc.s, occ, (x) => {
      if (x === q) hit = true;
    });
  });
  return hit;
}

export function blackInCheck(p: Mini): boolean {
  return whiteAttacks(p, p.bk);
}

export function movesOf(p: Mini): MiniMove[] {
  const out: MiniMove[] = [];
  if (p.turn === 'b') {
    for (const q of KING_STEPS[p.bk]) {
      const victim = p.ps.findIndex((pc) => pc.s === q);
      if (q === p.wk) continue;
      // The black king does not block rays behind itself.
      if (victim >= 0) {
        if (!whiteAttacks(p, q, p.bk, victim)) out.push({ from: p.bk, to: q, capture: true });
      } else if (!whiteAttacks(p, q, p.bk)) out.push({ from: p.bk, to: q });
    }
    return out;
  }
  const occupiedByWhite = (x: number) => x === p.wk || p.ps.some((pc) => pc.s === x);
  for (const q of KING_STEPS[p.wk]) {
    if (!occupiedByWhite(q) && !adjacent(q, p.bk)) out.push({ from: p.wk, to: q });
  }
  const occ = (x: number) => x === p.bk || occupiedByWhite(x);
  for (const pc of p.ps) {
    rays(pc.t, pc.s, occ, (x) => {
      if (!occupiedByWhite(x) && x !== p.bk) out.push({ from: pc.s, to: x });
    });
  }
  return out;
}

export function play(p: Mini, m: MiniMove): Mini {
  if (p.turn === 'b') {
    return { wk: p.wk, bk: m.to, ps: p.ps.filter((pc) => pc.s !== m.to), turn: 'w' };
  }
  if (m.from === p.wk) return { ...p, wk: m.to, turn: 'b' };
  return { ...p, ps: p.ps.map((pc) => (pc.s === m.from ? { t: pc.t, s: m.to } : pc)), turn: 'b' };
}

export type Status = 'mate' | 'stalemate' | 'lost-piece' | 'playing';
export function status(p: Mini): Status {
  if (p.ps.length === 0) return 'lost-piece';
  if (p.turn === 'b' && movesOf(p).length === 0) return blackInCheck(p) ? 'mate' : 'stalemate';
  return 'playing';
}

export function fromBoard(pieces: { type: string; color: string; square: string }[], turn: 'w' | 'b'): Mini | undefined {
  let wk = -1, bk = -1;
  const ps: Mini['ps'] = [];
  for (const pc of pieces) {
    const s = sqIndex(pc.square);
    if (pc.type === 'k') {
      if (pc.color === 'w') wk = s;
      else bk = s;
    } else if (pc.color === 'w' && (pc.type === 'q' || pc.type === 'r')) ps.push({ t: pc.type, s });
    else return undefined;
  }
  if (wk < 0 || bk < 0) return undefined;
  return { wk, bk, ps, turn };
}

export function toFen(p: Mini): string {
  const grid: string[] = Array(64).fill('');
  grid[p.wk] = 'K';
  grid[p.bk] = 'k';
  for (const pc of p.ps) grid[pc.s] = pc.t.toUpperCase();
  const rows: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let row = '', empty = 0;
    for (let f = 0; f < 8; f++) {
      const c = grid[r * 8 + f];
      if (!c) empty++;
      else {
        if (empty) row += empty;
        empty = 0;
        row += c;
      }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return `${rows.join('/')} ${p.turn} - - 0 1`;
}

// ---------- Distance-to-mate table for king + one piece vs king ----------

/**
 * For every position with White to move, the number of White moves to force
 * mate with perfect play (-1 when it is not a win). Index: wk*4096 + piece*64 + bk.
 */
export class MateTable {
  readonly w: Int8Array;
  readonly b: Int8Array; // Black to move: White moves still needed (0 = already mated)
  constructor(readonly piece: Heavy, tables?: { w: Int8Array; b: Int8Array }) {
    const N = 64 * 64 * 64;
    if (tables) {
      this.w = tables.w;
      this.b = tables.b;
      return;
    }
    this.w = new Int8Array(N).fill(-1);
    this.b = new Int8Array(N).fill(-1);
    const valid: number[] = [];
    const succB: Int32Array[] = []; // successors of black-to-move positions (wtm indices, or -1 for draw)
    const btmIdx: number[] = [];
    for (let wk = 0; wk < 64; wk++)
      for (let x = 0; x < 64; x++)
        for (let bk = 0; bk < 64; bk++) {
          if (wk === x || wk === bk || x === bk || adjacent(wk, bk)) continue;
          const i = wk * 4096 + x * 64 + bk;
          const pb: Mini = { wk, bk, ps: [{ t: piece, s: x }], turn: 'b' };
          if (!blackInCheck(pb)) valid.push(i);
          const ms = movesOf(pb);
          if (ms.length === 0) {
            if (blackInCheck(pb)) this.b[i] = 0;
            continue;
          }
          const succ = new Int32Array(ms.length);
          ms.forEach((m, k) => (succ[k] = m.capture ? -1 : wk * 4096 + x * 64 + m.to));
          if (succ.includes(-1)) continue; // Black can take the piece: a draw.
          btmIdx.push(i);
          succB.push(succ);
        }
    let pendingW = valid;
    let pendingB = btmIdx.map((_, k) => k);
    for (let d = 1; d < 100; d++) {
      // White to move wins in d if some move reaches a black position lost in d-1.
      const restW: number[] = [];
      let changed = false;
      for (const i of pendingW) {
        const wk = (i >> 12) & 63, x = (i >> 6) & 63, bk = i & 63;
        const ms = movesOf({ wk, bk, ps: [{ t: piece, s: x }], turn: 'w' });
        let win = false;
        for (const m of ms) {
          const j = m.from === wk ? m.to * 4096 + x * 64 + bk : wk * 4096 + m.to * 64 + bk;
          if (this.b[j] === d - 1) {
            win = true;
            break;
          }
        }
        if (win) {
          this.w[i] = d;
          changed = true;
        } else restW.push(i);
      }
      pendingW = restW;
      // Black to move is lost in d if every move reaches a White win in at most d.
      const restB: number[] = [];
      for (const k of pendingB) {
        const succ = succB[k];
        let worst = 0, ok = true;
        for (let t = 0; t < succ.length; t++) {
          const v = this.w[succ[t]];
          if (v < 0) {
            ok = false;
            break;
          }
          if (v > worst) worst = v;
        }
        if (ok) {
          this.b[btmIdx[k]] = worst;
          changed = true;
        } else restB.push(k);
      }
      pendingB = restB;
      if (!changed) break;
    }
  }
  index(p: Mini): number {
    return p.wk * 4096 + p.ps[0].s * 64 + p.bk;
  }
  /** White moves to mate from here with best play, or -1 if not winning. */
  value(p: Mini): number {
    if (p.ps.length !== 1 || p.ps[0].t !== this.piece) return -1;
    const v = (p.turn === 'w' ? this.w : this.b)[this.index(p)];
    return v;
  }
}

/** Evaluation for the two-rook ladder, from White's point of view. */
function evalLadder(p: Mini): number {
  const st = status(p);
  if (st === 'mate') return 100000;
  if (st === 'stalemate') return -50000;
  const bx = fileOf(p.bk), by = rankOf(p.bk);
  let x0 = 0, x1 = 7, y0 = 0, y1 = 7;
  for (const pc of p.ps) {
    const rx = fileOf(pc.s), ry = rankOf(pc.s);
    if (rx > bx) x1 = Math.min(x1, rx - 1);
    if (rx < bx) x0 = Math.max(x0, rx + 1);
    if (ry > by) y1 = Math.min(y1, ry - 1);
    if (ry < by) y0 = Math.max(y0, ry + 1);
  }
  const box = (x1 - x0 + 1) * (y1 - y0 + 1);
  // Rooks far from the black king are safe from capture.
  let far = 0;
  for (const pc of p.ps) far += Math.min(3, Math.max(Math.abs(fileOf(pc.s) - bx), Math.abs(rankOf(pc.s) - by)));
  return p.ps.length * 10000 - box * 20 + far * 2;
}

function negamax(p: Mini, depth: number, alpha: number, beta: number, ply: number, seen: Set<string>): number {
  const st = status(p);
  if (depth === 0 || st !== 'playing') {
    let e = evalLadder(p);
    if (e === 100000) e -= ply;
    return p.turn === 'w' ? e : -e;
  }
  let best = -Infinity;
  for (const m of movesOf(p)) {
    const q = play(p, m);
    const key = toFen(q);
    const score = seen.has(key) ? 0 : -negamax(q, depth - 1, -beta, -alpha, ply + 1, seen);
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

/** Best move by a short search (used where no table exists). */
export function searchMove(p: Mini, depth: number, history: string[] = []): MiniMove | undefined {
  const seen = new Set(history);
  let best: MiniMove | undefined;
  let bestScore = -Infinity;
  for (const m of movesOf(p)) {
    const q = play(p, m);
    const key = toFen(q);
    const score = (seen.has(key) ? -20000 : -negamax(q, depth - 1, -Infinity, Infinity, 1, seen)) + Math.random();
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}
