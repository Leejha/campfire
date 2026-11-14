import type { StudySessionStage, StudySessionStageKind } from '../models.ts';

interface FixedStageContent {
  title: string;
  guide: string;
}

interface CreateStudySessionStageOptions {
  id: string;
  kind: StudySessionStageKind;
  minutes: number;
  taskNumber: number | null;
}

const FIXED_STAGE_CONTENT: Readonly<Record<Exclude<StudySessionStageKind, 'task'>, FixedStageContent>> = {
  'task-writing': {
    title: 'Task Writing',
    guide: 'Task는 정해진 시간에 끝낼 수 있는 작은 작업 단위예요. 이번 시간에 끝낼 Task와 그 이유를 정해요.',
  },
  'task-sharing': {
    title: 'Task Sharing',
    guide: '정한 Task와 그 목적을 간단히 소개해요.',
  },
  break: {
    title: 'Break Time',
    guide: '진행 상황과 막힌 점, 다음 시간에 할 Task를 공유한 뒤 쉬어요.',
  },
  retrospect: {
    title: 'Retrospect',
    guide: '오늘의 작업을 돌아보고 다음에 다르게 해볼 점을 적어요.',
  },
  closing: {
    title: 'Closing',
    guide: 'Task 결과와 회고를 함께 확인하고 스터디를 마무리해요.',
  },
};

const DEFAULT_STAGES: ReadonlyArray<StudySessionStage> = [
  {
    id: 'task-writing',
    kind: 'task-writing',
    title: 'Task Writing',
    guide: 'Task는 정해진 시간에 끝낼 수 있는 작은 작업 단위예요. 이번 시간에 끝낼 Task와 그 이유를 정해요.',
    minutes: 10,
    taskNumber: null,
  },
  {
    id: 'task-sharing',
    kind: 'task-sharing',
    title: 'Task Sharing',
    guide: '정한 Task와 그 목적을 간단히 소개해요.',
    minutes: 10,
    taskNumber: null,
  },
  {
    id: 'task-1',
    kind: 'task',
    title: 'Task 1',
    guide: '첫 번째 Task에 집중해요.',
    minutes: 60,
    taskNumber: 1,
  },
  {
    id: 'break-1',
    kind: 'break',
    title: 'Break Time',
    guide: '진행 상황과 막힌 점, 다음 시간에 할 Task를 공유한 뒤 쉬어요.',
    minutes: 10,
    taskNumber: null,
  },
  {
    id: 'task-2',
    kind: 'task',
    title: 'Task 2',
    guide: '두 번째 Task에 집중해요.',
    minutes: 50,
    taskNumber: 2,
  },
  {
    id: 'break-2',
    kind: 'break',
    title: 'Break Time',
    guide: '진행 상황과 막힌 점, 다음 시간에 할 Task를 공유한 뒤 쉬어요.',
    minutes: 10,
    taskNumber: null,
  },
  {
    id: 'task-3',
    kind: 'task',
    title: 'Task 3',
    guide: '세 번째 Task에 집중해요.',
    minutes: 40,
    taskNumber: 3,
  },
  {
    id: 'retrospect',
    kind: 'retrospect',
    title: 'Retrospect',
    guide: '오늘의 작업을 돌아보고 다음에 다르게 해볼 점을 적어요.',
    minutes: 10,
    taskNumber: null,
  },
  {
    id: 'closing',
    kind: 'closing',
    title: 'Closing',
    guide: 'Task 결과와 회고를 함께 확인하고 스터디를 마무리해요.',
    minutes: 10,
    taskNumber: null,
  },
];

function getTaskGuide({ taskNumber }: Readonly<{ taskNumber: number }>): string {
  if (taskNumber === 1) return '첫 번째 Task에 집중해요.';
  if (taskNumber === 2) return '두 번째 Task에 집중해요.';
  if (taskNumber === 3) return '세 번째 Task에 집중해요.';
  return `Task ${taskNumber}에 집중해요.`;
}

export function createStudySessionStage({
  id,
  kind,
  minutes,
  taskNumber,
}: Readonly<CreateStudySessionStageOptions>): StudySessionStage {
  if (kind === 'task') {
    if (taskNumber === null) throw new Error('Task 단계에는 번호가 필요합니다.');
    return {
      id,
      kind,
      title: `Task ${taskNumber}`,
      guide: getTaskGuide({ taskNumber }),
      minutes,
      taskNumber,
    };
  }

  if (taskNumber !== null) throw new Error('Task가 아닌 단계에는 번호를 지정할 수 없습니다.');
  const content = FIXED_STAGE_CONTENT[kind];
  return { id, kind, title: content.title, guide: content.guide, minutes, taskNumber };
}

export function createDefaultStudySessionStages(): StudySessionStage[] {
  return DEFAULT_STAGES.map((stage) => ({ ...stage }));
}

export function getExpectedStudySessionStage({
  id,
  kind,
  minutes,
  taskNumber,
}: Readonly<CreateStudySessionStageOptions>): StudySessionStage {
  return createStudySessionStage({ id, kind, minutes, taskNumber });
}
