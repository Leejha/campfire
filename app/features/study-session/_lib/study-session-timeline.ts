import type {
  StudySessionDraft,
  StudySessionScheduledStage,
  StudySessionTimeline,
} from '../models.ts';

const KOREA_OFFSET_MS = 9 * 60 * 60 * 1_000;

interface KoreaDateTime {
  date: string;
  time: string;
}

function parseKoreaDateTime({ date, time }: Readonly<KoreaDateTime>): number {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) throw new Error('날짜와 시간 형식이 올바르지 않습니다.');

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const timestamp = Date.UTC(year, month - 1, day, hour, minute) - KOREA_OFFSET_MS;
  const normalized = new Date(timestamp + KOREA_OFFSET_MS);
  const isSameDateTime = normalized.getUTCFullYear() === year
    && normalized.getUTCMonth() === month - 1
    && normalized.getUTCDate() === day
    && normalized.getUTCHours() === hour
    && normalized.getUTCMinutes() === minute;

  if (!isSameDateTime) throw new Error('존재하지 않는 날짜 또는 시간입니다.');
  return timestamp;
}

export function getKoreaDate({ timestamp }: Readonly<{ timestamp: number }>): string {
  return new Date(timestamp + KOREA_OFFSET_MS).toISOString().slice(0, 10);
}

export function getStudySessionStartAt({ session }: Readonly<{ session: StudySessionDraft }>): number {
  return parseKoreaDateTime({ date: session.scheduledDate, time: session.scheduledTime });
}

export function getStudySessionTimeline({
  session,
  timestamp,
}: Readonly<{ session: StudySessionDraft; timestamp: number }>): StudySessionTimeline {
  const startsAt = getStudySessionStartAt({ session });
  let nextStartAt = startsAt;
  const stages: StudySessionScheduledStage[] = session.stages.map((stage) => {
    const startAt = nextStartAt;
    const endAt = startAt + stage.minutes * 60 * 1_000;
    nextStartAt = endAt;
    return { stage, startAt, endAt };
  });
  const endsAt = nextStartAt;
  const currentStage = stages.find((scheduledStage) => {
    return timestamp >= scheduledStage.startAt && timestamp < scheduledStage.endAt;
  }) ?? null;
  const status = timestamp < startsAt ? 'prestart' : timestamp >= endsAt ? 'completed' : 'active';

  return { status, startsAt, endsAt, currentStage, stages };
}
