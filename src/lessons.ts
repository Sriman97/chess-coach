// All lesson content. Each lesson is a short explanation plus a few board tasks.
// Positions are FEN strings; squares are written like "e4".

export type Goal =
  | { kind: 'stars'; stars: string[]; safe?: boolean }
  | { kind: 'check' }
  | { kind: 'mate' }
  | { kind: 'escape'; how: 'king' | 'block' | 'capture' }
  | { kind: 'castle'; side?: 'k' | 'q' }
  | { kind: 'promote' }
  | { kind: 'enpassant' }
  | { kind: 'solution'; moves: string[]; wrong?: string }
  | { kind: 'endgame'; piece: 'q' | 'r' | 'rr'; par: number };

export interface Step {
  fen: string;
  goal: Goal;
  prompt: string;
  /** Only these piece letters may move (for example "r" or "nb"). */
  movable?: string;
  /** Moves played automatically before the task starts (for example Black's last move). */
  pre?: string[];
  /** Words shown when the hint button is pressed. */
  tip?: string;
  /** Words shown when this step is solved. */
  done?: string;
}

export interface Lesson {
  id: string;
  title: string;
  intro: string;
  steps: Step[];
}

export interface Unit {
  id: string;
  title: string;
  blurb: string;
  lessons: Lesson[];
}

export const UNITS: Unit[] = [
  {
    id: 'pieces',
    title: 'Meet the pieces',
    blurb: 'A quick refresher on how every piece moves. Skip ahead if you know it.',
    lessons: [
      {
        id: 'rook',
        title: 'The rook',
        intro: 'The rook moves in straight lines: up, down, left or right, as far as it likes. It cannot jump over other pieces.',
        steps: [
          { fen: '8/8/8/8/8/8/8/R7 w - - 0 1', goal: { kind: 'stars', stars: ['a6', 'f6', 'f2'] }, prompt: 'Collect all the stars with your rook.', movable: 'r' },
          {
            fen: '8/8/8/P7/8/8/8/R2P4 w - - 0 1',
            goal: { kind: 'stars', stars: ['h1', 'h8'] },
            prompt: 'Your own pawns are in the way. Find a path around them.',
            movable: 'r',
            tip: 'Go up first, then across, then down.',
          },
        ],
      },
      {
        id: 'bishop',
        title: 'The bishop',
        intro: 'The bishop moves diagonally, any distance. A bishop that starts on a dark square stays on dark squares for the whole game.',
        steps: [
          { fen: '8/8/8/8/8/8/8/2B5 w - - 0 1', goal: { kind: 'stars', stars: ['h6', 'f8', 'a3'] }, prompt: 'Collect the stars with your bishop.', movable: 'b' },
          {
            fen: '8/8/8/8/8/8/8/2B2B2 w - - 0 1',
            goal: { kind: 'stars', stars: ['b5', 'g5', 'h3'] },
            prompt: 'Two bishops: one for light squares, one for dark squares. Collect every star.',
            movable: 'b',
            tip: 'Check the colour of each star square, then pick the bishop that lives on that colour.',
          },
        ],
      },
      {
        id: 'queen',
        title: 'The queen',
        intro: 'The queen is the strongest piece. She moves like a rook and a bishop combined: straight or diagonal, any distance.',
        steps: [
          { fen: '8/8/8/8/8/8/8/3Q4 w - - 0 1', goal: { kind: 'stars', stars: ['a4', 'e8', 'h5', 'h1'] }, prompt: 'Collect the stars with your queen in as few moves as you can.', movable: 'q' },
        ],
      },
      {
        id: 'king',
        title: 'The king',
        intro: 'The king moves one square in any direction. He is slow, but he is the piece the whole game is about: if your king is trapped, you lose.',
        steps: [
          { fen: '8/8/8/8/8/8/8/4K3 w - - 0 1', goal: { kind: 'stars', stars: ['e3', 'g4', 'g1'] }, prompt: 'Walk your king to every star.', movable: 'k' },
        ],
      },
      {
        id: 'knight',
        title: 'The knight',
        intro: 'The knight moves in an L shape: two squares one way, then one square to the side. It is the only piece that can jump over others.',
        steps: [
          { fen: '8/8/8/8/8/8/8/1N6 w - - 0 1', goal: { kind: 'stars', stars: ['c3', 'e4', 'f6'] }, prompt: 'Hop to every star with your knight.', movable: 'n' },
          {
            fen: '8/8/8/8/8/8/5PPP/5PNP w - - 0 1',
            goal: { kind: 'stars', stars: ['f3', 'h4', 'g6'] },
            prompt: 'The knight is surrounded, but it can jump right over its own pawns.',
            movable: 'n',
          },
        ],
      },
      {
        id: 'pawn',
        title: 'The pawn',
        intro: 'Pawns move straight forward one square, or two squares on their very first move. They never move backward, and they capture one square diagonally forward.',
        steps: [
          { fen: '8/8/8/8/8/8/4P3/8 w - - 0 1', goal: { kind: 'stars', stars: ['e4'] }, prompt: 'Reach the star in one move.', tip: 'On its first move a pawn may go two squares.' },
          {
            fen: '8/8/2p5/3p4/4P3/8/8/8 w - - 0 1',
            goal: { kind: 'stars', stars: ['d5', 'c6'] },
            prompt: 'Pawns capture diagonally. Capture both black pawns.',
          },
          {
            fen: '8/8/8/4pp2/4P3/8/8/8 w - - 0 1',
            goal: { kind: 'stars', stars: ['f6'] },
            prompt: 'Your pawn is blocked: pawns cannot capture straight ahead. Reach the star anyway.',
            tip: 'Capture diagonally first, then keep going forward.',
          },
        ],
      },
    ],
  },
  {
    id: 'capture',
    title: 'Attack and capture',
    blurb: 'Taking pieces, giving check, and the goal of the game: checkmate.',
    lessons: [
      {
        id: 'captures',
        title: 'Capturing',
        intro: 'To capture, move onto a square with an enemy piece. It leaves the board. In this lesson Black does not move, so take everything!',
        steps: [
          { fen: '8/1p4n1/8/8/3b4/8/8/3Q4 w - - 0 1', goal: { kind: 'stars', stars: ['d4', 'g7', 'b7'] }, prompt: 'Capture all three black pieces with your queen.' },
          { fen: '8/8/2n5/8/8/2p2b2/8/R7 w - - 0 1', goal: { kind: 'stars', stars: ['c3', 'f3', 'c6'] }, prompt: 'Now with a rook. Capture all the black pieces.' },
        ],
      },
      {
        id: 'safe',
        title: 'Safe captures',
        intro: 'A piece is protected when an enemy piece could capture back. Good players grab pieces that are not protected, and never step onto a square where they can be taken for free.',
        steps: [
          {
            fen: '8/1p6/n7/7b/8/8/8/R7 w - - 0 1',
            goal: { kind: 'stars', stars: ['h5'], safe: true },
            prompt: 'One black piece is unprotected. Capture it without ever landing on a square Black attacks.',
            tip: 'The knight on a6 is protected by the pawn on b7. Look for the other piece.',
          },
          {
            fen: '8/2p5/1n3b2/8/8/8/8/3Q4 w - - 0 1',
            goal: { kind: 'stars', stars: ['f6', 'c7', 'b6'], safe: true },
            prompt: 'Capture all three pieces with your queen, but never land where Black could take her. The order matters!',
            tip: 'The knight is protected by the pawn, so take the pawn before the knight.',
          },
        ],
      },
      {
        id: 'check',
        title: 'Check',
        intro: 'When a piece attacks the enemy king, that is check. The other side must get the king out of danger on the very next move.',
        steps: [
          { fen: '4k3/8/8/8/8/8/8/R5K1 w - - 0 1', goal: { kind: 'check' }, prompt: 'Put the black king in check with your rook.', movable: 'r' },
          { fen: '4k3/8/8/8/4N3/8/8/6K1 w - - 0 1', goal: { kind: 'check' }, prompt: 'Give check with your knight.', movable: 'n' },
          { fen: '4k3/8/8/8/8/8/8/5BK1 w - - 0 1', goal: { kind: 'check' }, prompt: 'Give check with your bishop.', movable: 'b' },
        ],
      },
      {
        id: 'escape',
        title: 'Getting out of check',
        intro: 'There are three ways out of check: move the king, block the attack with another piece, or capture the attacker.',
        steps: [
          { fen: '4r1k1/8/8/8/8/8/8/4K3 w - - 0 1', goal: { kind: 'escape', how: 'king' }, prompt: 'The rook is checking your king. Move the king to safety.' },
          { fen: '4r1k1/8/8/8/8/8/3B4/4K3 w - - 0 1', goal: { kind: 'escape', how: 'block' }, prompt: 'This time, block the check with your bishop.' },
          { fen: '6k1/8/8/8/4r3/2N5/8/4K3 w - - 0 1', goal: { kind: 'escape', how: 'capture' }, prompt: 'Even better: capture the piece that gives check.', tip: 'Your knight can reach e4.' },
        ],
      },
      {
        id: 'mate',
        title: 'Checkmate',
        intro: 'Checkmate is check with no way out: the king cannot move, the check cannot be blocked, and the attacker cannot be captured. Checkmate wins the game.',
        steps: [
          { fen: '7k/8/6K1/8/3Q4/8/8/8 w - - 0 1', goal: { kind: 'mate' }, prompt: 'Checkmate in one move with your queen.', tip: 'Put the queen right next to the black king, where your own king protects her.' },
          { fen: 'k7/8/1K6/8/8/8/8/7R w - - 0 1', goal: { kind: 'mate' }, prompt: 'Checkmate in one with your rook.' },
          { fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', goal: { kind: 'mate' }, prompt: 'The black king is boxed in by its own pieces. Checkmate with your knight.', done: 'That is called a smothered mate.' },
        ],
      },
      {
        id: 'stalemate',
        title: 'Avoid stalemate',
        intro: 'If it is Black\'s turn, Black is not in check, but Black has no legal move, the game is a draw by stalemate. When you are winning, make sure you leave the king a move, or give check.',
        steps: [
          { fen: 'k7/8/1K6/8/8/8/8/2Q5 w - - 0 1', goal: { kind: 'mate' }, prompt: 'Checkmate in one. Careful: one tempting move is stalemate.', tip: 'Queen to c7 takes every square, but gives no check. Look for a check instead.' },
          { fen: '7k/8/5K2/8/8/8/8/6Q1 w - - 0 1', goal: { kind: 'mate' }, prompt: 'Checkmate in one, and avoid the stalemate trap.' },
        ],
      },
    ],
  },
  {
    id: 'special',
    title: 'Special moves',
    blurb: 'Castling, promotion and en passant: the three rules that surprise beginners.',
    lessons: [
      {
        id: 'castling',
        title: 'Castling',
        intro: 'Once per game you may castle: the king moves two squares toward a rook, and that rook jumps to the king\'s other side. Neither piece may have moved before, the squares between them must be empty, and the king may not be in check or pass through an attacked square.',
        steps: [
          { fen: 'r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R3K2R w KQkq - 0 1', goal: { kind: 'castle', side: 'k' }, prompt: 'Castle kingside: move your king two squares toward the h1 rook.', done: 'Your king is tucked away safely behind its pawns.' },
          { fen: 'r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R3K2R w KQkq - 0 1', goal: { kind: 'castle', side: 'q' }, prompt: 'Now castle queenside: king two squares toward the a1 rook.' },
          {
            fen: 'r3k2r/8/b7/8/8/8/8/R3K2R w KQkq - 0 1',
            goal: { kind: 'castle' },
            prompt: 'Castle! But only one side is allowed right now. Which one?',
            tip: 'The bishop on a6 watches f1, so the king cannot pass through it.',
          },
        ],
      },
      {
        id: 'promotion',
        title: 'Promotion',
        intro: 'A pawn that reaches the far end of the board turns into a queen, rook, bishop or knight. Almost always you pick a queen.',
        steps: [
          { fen: '8/4P3/8/8/k7/8/8/4K3 w - - 0 1', goal: { kind: 'promote' }, prompt: 'Promote your pawn.' },
          { fen: '6k1/1P3ppp/8/8/8/8/5PPP/6K1 w - - 0 1', goal: { kind: 'mate' }, prompt: 'Promote with checkmate!' },
          {
            fen: '8/3q1P2/6k1/8/8/8/8/K7 w - - 0 1',
            goal: { kind: 'solution', moves: ['f7f8n'], wrong: 'A new queen here gives no check, and Black keeps the queen. Which piece attacks the king and the queen at once?' },
            prompt: 'Sometimes a knight is better. Promote so that you give check and attack the queen at the same time.',
            tip: 'A knight on f8 attacks g6 and d7.',
            done: 'That is a fork: one piece attacking two. Next move you win the queen.',
          },
        ],
      },
      {
        id: 'enpassant',
        title: 'En passant',
        intro: 'If an enemy pawn moves two squares and lands right beside your pawn, you may capture it as if it had moved only one square. You must do it at once, on the very next move.',
        steps: [
          { fen: '4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1', pre: ['d7d5'], goal: { kind: 'enpassant' }, prompt: 'Black\'s pawn just jumped two squares past yours. Capture it en passant.', tip: 'Move your e5 pawn diagonally to d6, behind the black pawn.' },
          { fen: '4k3/6p1/8/5P2/8/8/8/4K3 b - - 0 1', pre: ['g7g5'], goal: { kind: 'enpassant' }, prompt: 'Again! Capture en passant.' },
        ],
      },
    ],
  },
  {
    id: 'mates',
    title: 'Basic checkmates',
    blurb: 'The checkmate patterns every player must know, including how to win with just a king and a rook.',
    lessons: [
      {
        id: 'backrank',
        title: 'Back-rank mate',
        intro: 'A king hiding behind its own pawns has no escape squares. A rook or queen on the back row can checkmate it.',
        steps: [
          { fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', goal: { kind: 'mate' }, prompt: 'Checkmate on the back rank.' },
          { fen: '6k1/5ppp/8/8/8/8/1Q3PPP/6K1 w - - 0 1', goal: { kind: 'mate' }, prompt: 'Same idea, with the queen.' },
          { fen: '1r4k1/5ppp/8/8/8/8/5PPP/1R2R1K1 w - - 0 1', goal: { kind: 'mate' }, prompt: 'Black guards the back rank with a rook. Find the mate anyway.', tip: 'If you check on e8, the black rook simply captures. What if you remove that rook first?' },
        ],
      },
      {
        id: 'ladder',
        title: 'Two-rook ladder',
        intro: 'Two rooks can checkmate on their own. One rook cuts off a row, the other gives check on the next row, and they take turns, climbing like a ladder until the king reaches the edge.',
        steps: [
          {
            fen: '8/8/3k4/8/8/8/8/R3K2R w - - 0 1',
            goal: { kind: 'endgame', piece: 'rr', par: 10 },
            prompt: 'Push the king to the edge and checkmate it. Black will defend.',
            tip: 'Keep your rooks far from the black king. If it comes close to a rook, move that rook to the far side of the board on the same row.',
          },
        ],
      },
      {
        id: 'kq',
        title: 'King and queen',
        intro: 'With a queen you can always force checkmate. Use the queen to shrink the king\'s box, a knight\'s move away from it, until it is on the edge. Then bring your own king close and deliver mate. Watch out for stalemate!',
        steps: [
          {
            fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1',
            goal: { kind: 'endgame', piece: 'q', par: 3 },
            prompt: 'Checkmate the lone king. The counter shows how fast mate is with perfect play.',
            tip: 'Do not give lots of checks. Make the box smaller, and when the king is on the edge, walk your own king over.',
          },
        ],
      },
      {
        id: 'kr',
        title: 'King and rook',
        intro: 'King and rook against king is slower, but always a win. The rook builds a box, your king walks up to face the black king, and the rook gives check from the side to push it back, row by row.',
        steps: [
          {
            fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1',
            goal: { kind: 'endgame', piece: 'r', par: 6 },
            prompt: 'Checkmate with king and rook. Take your time.',
            tip: 'Your king must help. Bring it in front of the black king, with one square between them, then check with the rook.',
          },
        ],
      },
    ],
  },
];

export function findLesson(id: string): { unit: Unit; lesson: Lesson; index: number } | undefined {
  for (const unit of UNITS) {
    const index = unit.lessons.findIndex((l) => l.id === id);
    if (index >= 0) return { unit, lesson: unit.lessons[index], index };
  }
  return undefined;
}
