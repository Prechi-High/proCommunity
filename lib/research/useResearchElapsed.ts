import { useEffect, useState } from 'react';

/** Elapsed ms while `active` — drives stage labels without fake progress bars. */
export function useResearchElapsed(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const tick = setInterval(() => setElapsed(Date.now() - start), 400);
    return () => clearInterval(tick);
  }, [active]);
  return elapsed;
}
