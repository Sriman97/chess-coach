import { describe, it, expect } from 'vitest';
import { MateTable, movesOf, play, status, searchMove, fromBoard, toFen, sqIndex, type Mini } from '../src/endgame';
import { load } from '../src/engine';

const mini = (fen: string) => fromBoard(load(fen).board().flat().filter((x) => x) as any, fen.split(' ')[1] as 'w')!;

describe('mate tables', () => {
  for (const piece of ['q', 'r'] as const) {
    it(piece + ' table', () => {
      const t0 = Date.now();
      const t = new MateTable(piece);
      console.log(piece, 'built in', Date.now() - t0, 'ms');
      let max = 0;
      for (const v of t.w) if (v > max) max = v;
      console.log(piece, 'longest mate', max);
      expect(max).toBe(piece === 'q' ? 10 : 16);
      // Self-play from a centre position mates in exactly the table value.
      let p = mini(piece === 'q' ? '8/8/8/4k3/8/8/8/4K2Q w - - 0 1' : '8/8/8/4k3/8/8/8/R3K3 w - - 0 1');
      const want = t.value(p);
      let n = 0;
      while (status(p) === 'playing') {
        const ms = movesOf(p);
        const next = ms.map((m) => play(p, m));
        if (p.turn === 'w') {
          const best = next.reduce((a, b) => (t.value(b) >= 0 && (t.value(a) < 0 || t.value(b) < t.value(a)) ? b : a));
          p = best;
          n++;
        } else {
          p = next.reduce((a, b) => (t.value(b) > t.value(a) ? b : a));
        }
      }
      expect(status(p)).toBe('mate');
      expect(n).toBe(want);
    }, 60000);
  }
});

describe('two rooks', () => {
  it('ladder mates', () => {
    for (const fen of ['8/8/8/4k3/8/8/8/RR2K3 w - - 0 1', '8/8/2k5/8/8/8/8/R3K2R w - - 0 1']) {
      let p = mini(fen);
      const hist: string[] = [];
      let n = 0;
      const t0 = Date.now();
      while (status(p) === 'playing' && n < 30) {
        const m = searchMove(p, p.turn === 'w' ? 4 : 2, hist)!;
        p = play(p, m);
        hist.push(toFen(p));
        if (p.turn === 'b') n++;
      }
      console.log(fen, status(p), n, Date.now() - t0, 'ms');
      expect(status(p)).toBe('mate');
    }
  }, 60000);
});
