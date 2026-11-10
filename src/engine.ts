// Small chess helpers built on chess.js: loading lesson positions, a tiny
// search for king-and-piece checkmates, and a solver for star puzzles.
import { Chess, type Move, type Square } from 'chess.js';

export const FILES = 'abcdefgh';

export function load(fen: string): Chess {
  return new Chess(fen, { skipValidation: true });
}

export function uci(m: { from: string; to: string; promotion?: string }): string {
  return m.from + m.to + (m.promotion ?? '');
}

/** Same board, but with the given side to move and no castling or en passant. */
export function withTurn(fen: string, turn: 'w' | 'b'): string {
  const parts = fen.split(' ');
  return `${parts[0]} ${turn} - - 0 1`;
}

export function coords(sq: string): [number, number] {
  return [FILES.indexOf(sq[0]), Number(sq[1]) - 1];
}

function findKing(c: Chess, color: 'w' | 'b'): Square | undefined {
  for (const row of c.board()) {
    for (const p of row) if (p && p.type === 'k' && p.color === color) return p.square;
  }
  return undefined;
}

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/**
 * Evaluation from White's point of view for "drive the lone king to the edge"
 * endings. Smaller confinement box, king on the edge, and kings close together
 * are all good for White.
 */
export function evaluate(c: Chess, ply = 0): number {
  if (c.isCheckmate()) return c.turn() === 'b' ? 100000 - ply : -100000 + ply;
  if (c.isStalemate() || c.isInsufficientMaterial() || c.isThreefoldRepetition()) return -50000;
  let material = 0;
  const rooks: [number, number][] = [];
  for (const row of c.board()) {
    for (const p of row) {
      if (!p) continue;
      material += (p.color === 'w' ? 1 : -1) * VALUE[p.type];
      if (p.color === 'w' && (p.type === 'r' || p.type === 'q')) rooks.push(coords(p.square));
    }
  }
  const bk = findKing(c, 'b');
  const wk = findKing(c, 'w');
  if (!bk || !wk) return material * 1000;
  const [bx, by] = coords(bk);
  const [wx, wy] = coords(wk);
  // Box the black king is confined to by the rook or queen lines.
  let x0 = 0, x1 = 7, y0 = 0, y1 = 7;
  for (const [rx, ry] of rooks) {
    if (rx > bx) x1 = Math.min(x1, rx - 1);
    if (rx < bx) x0 = Math.max(x0, rx + 1);
    if (ry > by) y1 = Math.min(y1, ry - 1);
    if (ry < by) y0 = Math.max(y0, ry + 1);
  }
  const box = (x1 - x0 + 1) * (y1 - y0 + 1);
  const centre = Math.max(3 - bx, bx - 4) + Math.max(3 - by, by - 4);
  const kingDist = Math.max(Math.abs(bx - wx), Math.abs(by - wy));
  return material * 1000 - box * 8 + centre * 10 - kingDist * 6;
}

function search(c: Chess, depth: number, alpha: number, beta: number, ply: number): number {
  if (depth === 0 || c.isGameOver()) {
    const e = evaluate(c, ply);
    return c.turn() === 'w' ? e : -e;
  }
  let best = -Infinity;
  for (const m of c.moves({ verbose: true })) {
    c.move(m);
    const score = -search(c, depth - 1, -beta, -alpha, ply + 1);
    c.undo();
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

/** Best move for the side to move, by a shallow alpha-beta search. */
export function bestMove(fen: string, depth: number, random = 0): Move | undefined {
  const c = load(fen);
  const moves = c.moves({ verbose: true });
  let best: Move | undefined;
  let bestScore = -Infinity;
  for (const m of moves) {
    c.move(m);
    let score = -search(c, depth - 1, -Infinity, Infinity, 1);
    c.undo();
    score += Math.random() * random;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

/** A move that checkmates at once, if there is one. */
export function findMateInOne(fen: string): Move | undefined {
  const c = load(fen);
  for (const m of c.moves({ verbose: true })) {
    c.move(m);
    const mate = c.isCheckmate();
    c.undo();
    if (mate) return m;
  }
  return undefined;
}

// ---------- Star puzzles ----------

export interface StarPuzzle {
  fen: string;
  stars: string[];
  /** Only these piece types may move (default: any white piece). */
  movable?: string;
  /** White may not land on a square that a black piece attacks. */
  safe?: boolean;
}

/** Legal white moves in a star puzzle. Black never moves. */
export function starMoves(p: { movable?: string; safe?: boolean }, fen: string): Move[] {
  const c = load(withTurn(fen, 'w'));
  return c.moves({ verbose: true }).filter((m) => {
    if (p.movable && !p.movable.includes(m.piece)) return false;
    if (m.promotion && m.promotion !== 'q') return false;
    if (p.safe) {
      const after = load(withTurn(m.after, 'w'));
      if (after.isAttacked(m.to, 'b')) return false;
    }
    return true;
  });
}

/** Board after a star-puzzle move, with White to move again. */
export function starAfter(m: Move): string {
  return withTurn(m.after, 'w');
}

/** Shortest list of moves that collects every star (breadth-first search). */
export function solveStars(p: StarPuzzle, maxDepth = 12): Move[] | undefined {
  const start = withTurn(p.fen, 'w');
  const full = (1 << p.stars.length) - 1;
  type Node = { fen: string; mask: number; path: Move[] };
  let frontier: Node[] = [{ fen: start, mask: 0, path: [] }];
  const seen = new Set<string>([start.split(' ')[0] + '|0']);
  for (let depth = 0; depth < maxDepth; depth++) {
    const next: Node[] = [];
    for (const node of frontier) {
      for (const m of starMoves(p, node.fen)) {
        let mask = node.mask;
        const i = p.stars.indexOf(m.to);
        if (i >= 0) mask |= 1 << i;
        const path = [...node.path, m];
        if (mask === full) return path;
        const fen = starAfter(m);
        const key = fen.split(' ')[0] + '|' + mask;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ fen, mask, path });
      }
    }
    frontier = next;
  }
  return undefined;
}
