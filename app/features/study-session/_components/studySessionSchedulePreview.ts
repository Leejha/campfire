import { getStudySessionTimeline } from "../_lib/study-session-timeline.ts";
import type { StudySessionDraft, StudySessionTimeline } from "../models.ts";

const KOREA_OFFSET_MILLISECONDS = 9 * 60 * 60 * 1_000;
const MILLISECONDS_PER_MINUTE = 60 * 1_000;
const MINUTES_PER_HOUR = 60;

export interface StudySessionSchedulePreview {
  timeline: StudySessionTimeline | null;
  waitingMessage: string | null;
}

function hasValidStageMinutes({ stages }: Readonly<Pick<StudySessionDraft, "stages">>): boolean {
  return stages.every((stage) => Number.isInteger(stage.minutes) && stage.minutes >= 1);
}

function hasDateAndTime({ scheduledDate, scheduledTime }: Readonly<StudySessionDraft>): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(scheduledDate) && /^\d{2}:\d{2}$/.test(scheduledTime);
}

export function getStudySessionSchedulePreview({
  scheduledDate,
  scheduledTime,
  stages,
}: Readonly<StudySessionDraft>): StudySessionSchedulePreview {
  const draft = { scheduledDate, scheduledTime, stages };

  if (!hasDateAndTime(draft) || !hasValidStageMinutes(draft)) {
    return {
      timeline: null,
      waitingMessage: "날짜, 시작 시간, 각 단계 시간을 입력하면 일정을 계산해요.",
    };
  }

  try {
    return {
      timeline: getStudySessionTimeline({ session: draft, timestamp: 0 }),
      waitingMessage: null,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return {
        timeline: null,
        waitingMessage: "올바른 날짜와 시작 시간을 입력하면 일정을 계산해요.",
      };
    }

    throw error;
  }
}

export function formatStudySessionScheduleTime({ timestamp }: Readonly<{ timestamp: number }>): string {
  return new Date(timestamp + KOREA_OFFSET_MILLISECONDS).toISOString().slice(11, 16);
}

export function formatStudySessionDuration({ milliseconds }: Readonly<{ milliseconds: number }>): string {
  const totalMinutes = Math.round(milliseconds / MILLISECONDS_PER_MINUTE);
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;

  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}
