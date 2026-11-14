import type { StudySessionDraft, StudySessionStage, StudySessionStageKind } from '../models.ts';
import { getExpectedStudySessionStage } from './study-session-template.ts';
import { getKoreaDate, getStudySessionStartAt } from './study-session-timeline.ts';

interface ValidateStudySessionDraftOptions {
  draft: unknown;
  now: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStudySessionStageKind(value: string): value is StudySessionStageKind {
  return value === 'task-writing'
    || value === 'task-sharing'
    || value === 'task'
    || value === 'break'
    || value === 'retrospect'
    || value === 'closing';
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

function getRequiredString({ value, label }: Readonly<{ value: unknown; label: string }>): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label}이 필요합니다.`);
  return value;
}

function getStage({ value }: Readonly<{ value: unknown }>): StudySessionStage {
  if (!isRecord(value)) throw new Error('단계 정보가 올바르지 않습니다.');

  const id = getRequiredString({ value: value.id, label: '단계 ID' });
  const kind = getRequiredString({ value: value.kind, label: '단계 종류' });
  if (!isStudySessionStageKind(kind)) throw new Error('지원하지 않는 단계 종류입니다.');
  const minutes = value.minutes;
  if (!isPositiveInteger(minutes)) throw new Error('단계 시간은 1분 이상의 정수여야 합니다.');

  const taskNumber = value.taskNumber;
  let expected: StudySessionStage;
  if (kind === 'task') {
    if (!isPositiveInteger(taskNumber)) throw new Error('Task 단계 번호는 1 이상의 정수여야 합니다.');
    expected = getExpectedStudySessionStage({ id, kind, minutes, taskNumber });
  } else {
    if (taskNumber !== null) throw new Error('Task가 아닌 단계에는 번호를 지정할 수 없습니다.');
    expected = getExpectedStudySessionStage({ id, kind, minutes, taskNumber });
  }
  const title = getRequiredString({ value: value.title, label: '단계 제목' });
  const guide = getRequiredString({ value: value.guide, label: '단계 안내' });
  if (title !== expected.title || guide !== expected.guide) {
    throw new Error('단계 제목 또는 안내 문구를 변경할 수 없습니다.');
  }
  return expected;
}

function getStages({ value }: Readonly<{ value: unknown }>): StudySessionStage[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('최소 한 단계가 필요합니다.');
  const stages = value.map((stage) => getStage({ value: stage }));
  const ids = new Set(stages.map((stage) => stage.id));
  if (ids.size !== stages.length) throw new Error('단계 ID가 중복되었습니다.');
  const taskNumbers = stages
    .filter((stage) => stage.kind === 'task')
    .map((stage) => stage.taskNumber);
  if (new Set(taskNumbers).size !== taskNumbers.length) throw new Error('Task 단계 번호가 중복되었습니다.');
  return stages;
}

export function parseStudySessionDraft({ draft }: Readonly<{ draft: unknown }>): StudySessionDraft {
  if (!isRecord(draft)) throw new Error('회차 정보가 올바르지 않습니다.');
  const scheduledDate = getRequiredString({ value: draft.scheduledDate, label: '예약 날짜' });
  const scheduledTime = getRequiredString({ value: draft.scheduledTime, label: '예약 시간' });
  getStudySessionStartAt({
    session: { scheduledDate, scheduledTime, stages: [] },
  });
  const stages = getStages({ value: draft.stages });
  return { scheduledDate, scheduledTime, stages };
}

export function validateStudySessionDraft({ draft, now }: Readonly<ValidateStudySessionDraftOptions>): StudySessionDraft {
  if (!Number.isFinite(now)) throw new Error('현재 시각이 올바르지 않습니다.');
  const session = parseStudySessionDraft({ draft });
  const scheduledDate = session.scheduledDate;
  if (scheduledDate < getKoreaDate({ timestamp: now })) {
    throw new Error('지난 날짜에는 회차를 예약할 수 없습니다.');
  }
  return session;
}
