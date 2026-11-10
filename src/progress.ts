// Saved progress: best stars per lesson, kept in this browser.
const KEY = 'chess-coach-progress-v1';

type Saved = { stars: Record<string, number> };

function read(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw);
      if (v && typeof v.stars === 'object') return v;
    }
  } catch {
    /* storage unavailable */
  }
  return { stars: {} };
}

let state = read();

export function starsFor(id: string): number {
  return state.stars[id] ?? 0;
}

export function totalStars(): number {
  return Object.values(state.stars).reduce((a, b) => a + b, 0);
}

export function recordStars(id: string, stars: number): void {
  if (stars <= starsFor(id)) return;
  state = { stars: { ...state.stars, [id]: stars } };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
}

export function resetProgress(): void {
  state = { stars: {} };
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
