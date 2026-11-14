import { useEffect, useLayoutEffect, useRef } from "react";

const REORDER_ANIMATION_DURATION_MS = 300;
const REDUCED_MOTION_MEDIA_QUERY = "(prefers-reduced-motion: reduce)";

export interface ParticipantElementRegistration {
  element: HTMLElement | null;
  participantId: string;
}

export interface UseParticipantReorderAnimationOptions {
  participantOrderKey: string;
}

export interface UseParticipantReorderAnimationResult {
  registerParticipantElement: (registration: Readonly<ParticipantElementRegistration>) => void;
}

function getParticipantBounds({
  participantElements,
}: Readonly<{ participantElements: ReadonlyMap<string, HTMLElement> }>): Map<string, DOMRect> {
  const participantBounds = new Map<string, DOMRect>();

  for (const [participantId, participantElement] of participantElements) {
    participantBounds.set(participantId, participantElement.getBoundingClientRect());
  }

  return participantBounds;
}

function animateParticipantReorder({
  currentBounds,
  participantElements,
  previousBounds,
}: Readonly<{
  currentBounds: ReadonlyMap<string, DOMRect>;
  participantElements: ReadonlyMap<string, HTMLElement>;
  previousBounds: ReadonlyMap<string, DOMRect>;
}>): void {
  const prefersReducedMotion = window.matchMedia(REDUCED_MOTION_MEDIA_QUERY).matches;

  if (prefersReducedMotion) return;

  for (const [participantId, participantElement] of participantElements) {
    const currentBoundsForParticipant = currentBounds.get(participantId);
    const previousBoundsForParticipant = previousBounds.get(participantId);

    if (
      currentBoundsForParticipant === undefined
      || previousBoundsForParticipant === undefined
      || typeof participantElement.animate !== "function"
    ) continue;

    const horizontalDistance = previousBoundsForParticipant.left - currentBoundsForParticipant.left;
    const verticalDistance = previousBoundsForParticipant.top - currentBoundsForParticipant.top;
    const hasMoved = horizontalDistance !== 0 || verticalDistance !== 0;

    if (!hasMoved) continue;

    participantElement.animate(
      [
        { transform: `translate(${horizontalDistance}px, ${verticalDistance}px)` },
        { transform: "translate(0, 0)" },
      ],
      {
        duration: REORDER_ANIMATION_DURATION_MS,
        easing: "ease-out",
      },
    );
  }
}

export function useParticipantReorderAnimation({
  participantOrderKey,
}: Readonly<UseParticipantReorderAnimationOptions>): UseParticipantReorderAnimationResult {
  const participantElementsReference = useRef(new Map<string, HTMLElement>());
  const previousBoundsReference = useRef(new Map<string, DOMRect>());
  const previousParticipantOrderKeyReference = useRef<string | null>(null);

  const registerParticipantElement = ({
    element,
    participantId,
  }: Readonly<ParticipantElementRegistration>): void => {
    if (element === null) {
      participantElementsReference.current.delete(participantId);
      return;
    }

    participantElementsReference.current.set(participantId, element);
  };

  useLayoutEffect(() => {
    const participantElements = participantElementsReference.current;
    const previousParticipantOrderKey = previousParticipantOrderKeyReference.current;
    const currentBounds = getParticipantBounds({ participantElements });
    const hasOrderChanged = previousParticipantOrderKey !== null
      && previousParticipantOrderKey !== participantOrderKey;

    if (hasOrderChanged) {
      animateParticipantReorder({
        currentBounds,
        participantElements,
        previousBounds: previousBoundsReference.current,
      });
    }

    previousBoundsReference.current = currentBounds;
    previousParticipantOrderKeyReference.current = participantOrderKey;
  });

  useEffect(() => {
    const synchronizeBoundsAfterResize = (): void => {
      previousBoundsReference.current = getParticipantBounds({
        participantElements: participantElementsReference.current,
      });
    };

    window.addEventListener("resize", synchronizeBoundsAfterResize);

    return (): void => window.removeEventListener("resize", synchronizeBoundsAfterResize);
  }, []);

  return { registerParticipantElement };
}
