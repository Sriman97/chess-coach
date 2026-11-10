import { describe, it, expect } from 'vitest';
import { UNITS } from '../src/lessons';
import { hintMove, judgeMove, legalDests } from '../src/judge';
import { load, solveStars } from '../src/engine';

describe('every lesson step is solvable', () => {
  for (const u of UNITS)
    for (const l of u.lessons)
      l.steps.forEach((s, i) => {
        it(`${l.id} #${i + 1}`, () => {
          const c = load(s.fen);
          for (const p of s.pre ?? []) c.move({ from: p.slice(0, 2), to: p.slice(2, 4) });
          const fen = c.fen();
          const g = s.goal;
          if (g.kind === 'stars') {
            const path = solveStars({ fen, stars: g.stars, movable: s.movable, safe: g.safe });
            expect(path, 'no star path').toBeTruthy();
            console.log(l.id, i + 1, 'par', path!.length, path!.map((m) => m.san).join(' '));
            return;
          }
          if (g.kind === 'endgame') return;
          expect(legalDests(s, fen).size).toBeGreaterThan(0);
          const h = hintMove(s, fen, 0, []);
          expect(h, 'no hint').toBeTruthy();
          const m = c.moves({ verbose: true }).find((x) => x.from === h!.from && x.to === h!.to && (x.promotion ?? '') === (h!.promotion ?? ''))!;
          expect(judgeMove(g, c, m).ok).toBe(true);
          // Show which moves count as solutions.
          const sols = c.moves({ verbose: true }).filter((x) => (!s.movable || s.movable.includes(x.piece)) && judgeMove(g, c, x).ok).map((x) => x.san);
          console.log(l.id, i + 1, g.kind, sols.join(' '));
        });
      });
});
