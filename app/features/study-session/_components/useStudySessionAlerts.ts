import { useEffect, useRef, useState } from "react";

import type { StudySessionTimeline } from "../models";

const FIVE_MINUTES_MS = 5 * 60 * 1_000;
const ALERT_TONE_FREQUENCY = 880;
const ALERT_TONE_DURATION_SECONDS = 0.18;
const ALERT_VISUAL_DURATION_MS = 7_000;

export interface StudySessionAlerts {
  announcement: string;
  isEnabled: boolean;
  enableAlerts: () => Promise<void>;
}

function playAlertTone({ audioContext }: Readonly<{ audioContext: AudioContext }>): void {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const endAt = audioContext.currentTime + ALERT_TONE_DURATION_SECONDS;

  oscillator.frequency.value = ALERT_TONE_FREQUENCY;
  gain.gain.setValueAtTime(0.08, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, endAt);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(endAt);
}

function sendBrowserAlert({ title, body }: Readonly<{ title: string; body: string }>): void {
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

export function useStudySessionAlerts({ now, timeline }: Readonly<{ now: number; timeline: StudySessionTimeline | null }>): StudySessionAlerts {
  const [announcement, setAnnouncement] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const audioContextReference = useRef<AudioContext | null>(null);
  const sentAlertsReference = useRef(new Set<string>());
  const previousStageIdReference = useRef<string | null>(null);
  const previousStatusReference = useRef(timeline?.status ?? null);
  const announcementTimeoutReference = useRef<number | null>(null);

  useEffect(() => {
    return (): void => {
      if (announcementTimeoutReference.current !== null) {
        window.clearTimeout(announcementTimeoutReference.current);
      }
    };
  }, []);

  useEffect(() => {
    const previousStatus = previousStatusReference.current;
    const currentStatus = timeline?.status ?? null;
    const isSessionStarting = previousStatus === "prestart" && currentStatus === "active";
    previousStatusReference.current = currentStatus;

    if (timeline?.status === "completed" && previousStatus === "active" && isEnabled) {
      const completionKey = "study-session-completed";
      if (!sentAlertsReference.current.has(completionKey)) {
        sentAlertsReference.current.add(completionKey);
        const audioContext = audioContextReference.current;
        if (audioContext) playAlertTone({ audioContext });
        sendBrowserAlert({ title: "모각코를 마쳤어요", body: "오늘의 Task와 회고를 확인해 보세요." });
        setAnnouncement("모각코를 마쳤어요. 오늘의 Task와 회고를 확인해 보세요.");
        if (announcementTimeoutReference.current !== null) {
          window.clearTimeout(announcementTimeoutReference.current);
        }
        announcementTimeoutReference.current = window.setTimeout(() => {
          setAnnouncement("");
        }, ALERT_VISUAL_DURATION_MS);
      }
      return;
    }

    if (timeline?.status !== "active" || timeline.currentStage === null) return;

    const currentStage = timeline.currentStage;
    const currentStageId = currentStage.stage.id;

    if (!isEnabled) {
      previousStageIdReference.current = currentStageId;
      return;
    }

    const remainingMilliseconds = Math.max(currentStage.endAt - now, 0);
    const isNewStage = isSessionStarting || (previousStageIdReference.current !== null
      && previousStageIdReference.current !== currentStageId);
    const isFiveMinutesOrLess = currentStage.stage.minutes <= 5;
    const warningKey = `${currentStageId}-five-minutes`;
    const transitionKey = `${currentStageId}-transition`;

    const notify = (key: string, title: string, body: string): void => {
      if (sentAlertsReference.current.has(key)) return;
      sentAlertsReference.current.add(key);
      const audioContext = audioContextReference.current;
      if (audioContext) playAlertTone({ audioContext });
      sendBrowserAlert({ title, body });
      setAnnouncement(`${title} ${body}`);
      if (announcementTimeoutReference.current !== null) {
        window.clearTimeout(announcementTimeoutReference.current);
      }
      announcementTimeoutReference.current = window.setTimeout(() => {
        setAnnouncement("");
      }, ALERT_VISUAL_DURATION_MS);
    };

    if (isNewStage) {
      notify(transitionKey, `${currentStage.stage.title} 시간이에요`, currentStage.stage.guide);
    }

    if (isFiveMinutesOrLess && isNewStage) {
      notify(warningKey, `${currentStage.stage.title} 시간이 시작됐어요`, "5분 이하 단계라 지금 바로 알려드려요.");
    }

    if (!isFiveMinutesOrLess && remainingMilliseconds <= FIVE_MINUTES_MS) {
      notify(warningKey, `${currentStage.stage.title} 종료 5분 전이에요`, "다음 단계를 준비해 주세요.");
    }

    previousStageIdReference.current = currentStageId;
  }, [isEnabled, now, timeline]);

  const enableAlerts = async (): Promise<void> => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    if (typeof AudioContext !== "undefined") {
      const audioContext = audioContextReference.current ?? new AudioContext();
      audioContextReference.current = audioContext;
      await audioContext.resume();
    }
    setIsEnabled(true);
  };

  return { announcement, isEnabled, enableAlerts };
}
