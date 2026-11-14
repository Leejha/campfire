import type { ReactElement, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

const FULLSCREEN_ERROR_DURATION_MS = 3_000;
const FULLSCREEN_ERROR_MESSAGE = "전체화면으로 전환하지 못했어요. 다시 시도해 주세요.";

export interface StudySessionFullscreenRenderProps {
  isFullscreen: boolean;
  toggleFullscreen: () => Promise<void>;
}

export interface StudySessionFullscreenProps {
  children: (props: Readonly<StudySessionFullscreenRenderProps>) => ReactNode;
}

export function StudySessionFullscreen({ children }: Readonly<StudySessionFullscreenProps>): ReactElement {
  const fullscreenContainerReference = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenErrorVersion, setFullscreenErrorVersion] = useState(0);
  const hasFullscreenError = fullscreenErrorVersion > 0;

  useEffect(() => {
    const synchronizeFullscreenState = (): void => {
      setIsFullscreen(document.fullscreenElement === fullscreenContainerReference.current);
    };

    document.addEventListener("fullscreenchange", synchronizeFullscreenState);
    synchronizeFullscreenState();

    return (): void => document.removeEventListener("fullscreenchange", synchronizeFullscreenState);
  }, []);

  useEffect(() => {
    if (!hasFullscreenError) return;

    const fullscreenErrorTimer = window.setTimeout(() => setFullscreenErrorVersion(0), FULLSCREEN_ERROR_DURATION_MS);

    return (): void => window.clearTimeout(fullscreenErrorTimer);
  }, [fullscreenErrorVersion, hasFullscreenError]);

  const toggleFullscreen = async (): Promise<void> => {
    const fullscreenContainer = fullscreenContainerReference.current;
    const supportsFullscreen = fullscreenContainer !== null
      && typeof fullscreenContainer.requestFullscreen === "function"
      && typeof document.exitFullscreen === "function";

    if (!supportsFullscreen) {
      setFullscreenErrorVersion((currentVersion) => currentVersion + 1);
      return;
    }

    try {
      if (isFullscreen) {
        await document.exitFullscreen();
        return;
      }

      await fullscreenContainer.requestFullscreen();
    } catch (error: unknown) {
      setFullscreenErrorVersion((currentVersion) => currentVersion + 1);
    }
  };

  return (
    <div ref={fullscreenContainerReference} className="min-h-svh w-full overflow-y-auto bg-bg-layer-default text-fg-neutral">
      {children({ isFullscreen, toggleFullscreen })}
      {hasFullscreenError ? (
        <p className="fixed inset-x-4 bottom-4 mx-auto max-w-lg rounded-r2 border border-stroke-critical-weak bg-bg-critical-weak p-4 text-center text-sm font-medium leading-6 text-fg-critical shadow-s2" role="status" aria-live="polite">
          {FULLSCREEN_ERROR_MESSAGE}
        </p>
      ) : null}
    </div>
  );
}
