import { useEffect } from "react";
import { useRevalidator } from "react-router";

import type { StudySessionStatus } from "../models";

const PRESTART_REFRESH_INTERVAL_MS = 5_000;

export function useStudySessionAutoRefresh({ status }: Readonly<{ status: StudySessionStatus | null }>): void {
  const revalidator = useRevalidator();

  useEffect(() => {
    if (status !== "prestart") return;

    const refreshSession = (): void => {
      if (revalidator.state === "idle") void revalidator.revalidate();
    };
    const intervalId = window.setInterval(refreshSession, PRESTART_REFRESH_INTERVAL_MS);

    return (): void => window.clearInterval(intervalId);
  }, [revalidator, status]);
}
