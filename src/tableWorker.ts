// Builds a distance-to-mate table off the main thread.
import { MateTable, type Heavy } from './endgame';

self.onmessage = (e: MessageEvent<Heavy>) => {
  const t = new MateTable(e.data);
  (self as unknown as Worker).postMessage({ piece: e.data, w: t.w, b: t.b }, [t.w.buffer, t.b.buffer]);
};
