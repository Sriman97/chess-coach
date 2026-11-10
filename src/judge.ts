// Decides whether a move solves a lesson step, and explains why when it doesn't.
import type { Chess, Move, Square } from 'chess.js';
import type { Goal, Step } from './lessons';
import { load, solveStars, starMoves, uci, withTurn } from './engine';

const NAMES: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
export const pieceName = (t: string) => NAMES[t] ?? 'piece';

export interface Verdict {
  /** The move completes the step (or, for multi-move tasks, is a correct move). */
  ok: boolean;
  /** A wrong move that should not cost a star (another valid idea). */
  soft?: boolean;
  message?: string;
  /** Arrow to show on the board, for example Black's refutation. */
  arrow?: [string, string];
}

function kingSquare(c: Chess, color: 'w' | 'b'): Square | undefined {
  for (const row of c.board()) for (const p of row) if (p && p.type === 'k' && p.color === color) return p.square;
  return undefined;
}

/** Explains why a check is not mate, using Black's best escape. */
function whyNotMate(after: Chess, landed: string): Verdict {
  if (after.isStalemate()) {
    return { ok: false, message: 'Stalemate! Black is not in check but has no legal move, so the game is a draw. Look for a move that gives check.' };
  }
  if (!after.inCheck()) return { ok: false, message: 'That move does not give check, so it cannot be checkmate.' };
  const replies = after.moves({ verbose: true });
  const capture = replies.find((r) => r.captured && r.to === landed);
  const r = capture ?? replies.find((x) => x.piece === 'k') ?? replies[0];
  let message: string;
  if (r.captured) message = `Check, but Black can capture your ${pieceName(r.captured)} with the ${pieceName(r.piece)}.`;
  else if (r.piece === 'k') message = `Check, but the king escapes to ${r.to}.`;
  else message = `Check, but Black can block it with the ${pieceName(r.piece)}.`;
  return { ok: false, message, arrow: [r.from, r.to] };
}

/** Judge a single-move goal. `before` is the position before the move, `m` the move played. */
export function judgeMove(goal: Goal, before: Chess, m: Move, ply = 0): Verdict {
  const after = load(m.after);
  switch (goal.kind) {
    case 'check':
      return after.inCheck() ? { ok: true } : { ok: false, message: 'That move does not attack the black king.' };
    case 'mate':
      return after.isCheckmate() ? { ok: true } : whyNotMate(after, m.to);
    case 'escape': {
      const k = kingSquare(before, 'w');
      const checkers = k ? before.attackers(k, 'b') : [];
      const how = m.piece === 'k' ? 'king' : checkers.includes(m.to) ? 'capture' : 'block';
      if (how === goal.how) return { ok: true };
      const ask = { king: 'move your king', block: 'block the check', capture: 'capture the attacker' }[goal.how];
      return { ok: false, soft: true, message: `That also gets you out of check. This time, try to ${ask}.` };
    }
    case 'castle': {
      const side = m.flags.includes('k') ? 'k' : m.flags.includes('q') ? 'q' : undefined;
      if (side && (!goal.side || goal.side === side)) return { ok: true };
      if (side) return { ok: false, soft: true, message: 'That is castling, but on the other side.' };
      if (m.piece === 'k') return { ok: false, message: 'To castle, move the king two squares sideways toward a rook.' };
      return { ok: false, message: 'Move your king to castle, not another piece.' };
    }
    case 'promote':
      return m.promotion ? { ok: true } : { ok: false, message: 'Push a pawn all the way to the last row.' };
    case 'enpassant':
      return m.flags.includes('e')
        ? { ok: true }
        : { ok: false, message: 'Capture the pawn that just moved, by moving diagonally onto the square it skipped over.' };
    case 'solution': {
      if (uci(m) === goal.moves[ply]) return { ok: true };
      if (after.isCheckmate()) return { ok: true };
      return { ok: false, message: goal.wrong ?? 'Not the best move here. Try again.' };
    }
    default:
      return { ok: true };
  }
}

/** For star puzzles with `safe`, a move onto an attacked square is a mistake. */
export function judgeSafety(m: Move): Verdict {
  const after = load(withTurn(m.after, 'w'));
  const attackers = after.attackers(m.to, 'b');
  if (attackers.length === 0) return { ok: true };
  const a = attackers[0];
  const p = after.get(a);
  return {
    ok: false,
    message: `Careful! The ${pieceName(p?.type ?? '')} on ${a} would capture your ${pieceName(m.piece)}.`,
    arrow: [a, m.to],
  };
}

/** A move that makes progress on the step, for the hint button. */
export function hintMove(step: Step, fen: string, ply: number, starsLeft: string[]): { from: string; to: string; promotion?: string } | undefined {
  const g = step.goal;
  if (g.kind === 'stars') {
    const path = solveStars({ fen, stars: starsLeft, movable: step.movable, safe: g.safe });
    return path?.[0];
  }
  if (g.kind === 'endgame') return undefined;
  if (g.kind === 'solution') {
    const u = g.moves[ply];
    return u ? { from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] } : undefined;
  }
  const c = load(fen);
  for (const m of c.moves({ verbose: true })) {
    if (step.movable && !step.movable.includes(m.piece)) continue;
    if (judgeMove(g, c, m, ply).ok) return m;
  }
  return undefined;
}

/** Legal moves for the board, as a map from square to destinations. */
export function legalDests(step: Step, fen: string): Map<string, string[]> {
  const dests = new Map<string, string[]>();
  const moves =
    step.goal.kind === 'stars'
      ? starMoves({ movable: step.movable }, fen)
      : load(fen).moves({ verbose: true }).filter((m) => !step.movable || step.movable.includes(m.piece));
  for (const m of moves) {
    const list = dests.get(m.from) ?? [];
    if (!list.includes(m.to)) list.push(m.to);
    dests.set(m.from, list);
  }
  return dests;
}
