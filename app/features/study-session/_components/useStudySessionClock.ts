import { useEffect, useState } from "react";

const CLOCK_INTERVAL_MS = 1_000;

export function useStudySessionClock(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const updateNow = (): void => setNow(Date.now());
    const intervalId = window.setInterval(updateNow, CLOCK_INTERVAL_MS);

    return (): void => window.clearInterval(intervalId);
  }, []);

  return now;
}
