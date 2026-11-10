# Chess Coach

Learn chess one move at a time. Short lessons with hands-on tasks on a real board, hints when you're stuck, and up to three stars per lesson.

Play it in a browser on a laptop or phone. On an iPhone, open it in Safari, tap Share, then **Add to Home Screen**. After the first visit it works fully offline.

## Lessons

1. **Meet the pieces**: rook, bishop, queen, king, knight, pawn
2. **Attack and capture**: capturing, safe captures, check, getting out of check, checkmate, avoiding stalemate
3. **Special moves**: castling, promotion, en passant
4. **Basic checkmates**: back-rank mate, the two-rook ladder, king and queen, king and rook

The king-and-queen and king-and-rook lessons have a coach with perfect play: it computes a distance-to-mate table in the browser, so it can tell you how many moves mate takes and whether your move was the fastest.

## Develop

```sh
npm install
npm run dev      # local server
npm test         # checks every lesson is solvable, and the endgame coach
npm run build    # static site in dist/
```

Lesson content lives in `src/lessons.ts`. Each lesson is an explanation plus a list of steps; a step is a position (FEN) and a goal such as collecting stars, giving check, or checkmating.

## Built with

- [chess.js](https://github.com/jhlywa/chess.js) for the rules
- [Chessground](https://github.com/lichess-org/chessground), the Lichess board, for the board and touch moves
- TypeScript and Vite

Chessground is GPL-3.0, so this project is GPL-3.0 too.

Chess pieces: [Totoy](https://github.com/lichess-org/lila/tree/master/public/piece/totoy) by Kosal Sen, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), from lichess.org.
