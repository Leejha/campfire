import type { StudySessionStageKind } from "../models";

export interface StudySessionStageDefinition {
  kind: StudySessionStageKind;
  label: string;
  guide: string;
  defaultDurationMinutes: number;
}

export const STUDY_SESSION_STAGE_CATALOG: readonly StudySessionStageDefinition[] = [
  {
    kind: "task-writing",
    label: "Task Writing",
    guide: "Task는 정해진 시간에 끝낼 수 있는 작은 작업 단위예요. 이번 시간에 끝낼 Task와 그 이유를 정해요.",
    defaultDurationMinutes: 10,
  },
  {
    kind: "task-sharing",
    label: "Task Sharing",
    guide: "정한 Task와 그 목적을 간단히 소개해요.",
    defaultDurationMinutes: 10,
  },
  {
    kind: "task",
    label: "Task",
    guide: "Task에 집중해요.",
    defaultDurationMinutes: 60,
  },
  {
    kind: "break",
    label: "Break Time",
    guide: "진행 상황과 막힌 점, 다음 시간에 할 Task를 공유한 뒤 쉬어요.",
    defaultDurationMinutes: 10,
  },
  {
    kind: "retrospect",
    label: "Retrospect",
    guide: "오늘의 작업을 돌아보고 다음에 다르게 해볼 점을 적어요.",
    defaultDurationMinutes: 10,
  },
  {
    kind: "closing",
    label: "Closing",
    guide: "Task 결과와 회고를 함께 확인하고 스터디를 마무리해요.",
    defaultDurationMinutes: 10,
  },
];

export function getStudySessionStageDefinition({
  kind,
}: Readonly<{ kind: StudySessionStageKind }>): StudySessionStageDefinition {
  const definition = STUDY_SESSION_STAGE_CATALOG.find(
    (candidate) => candidate.kind === kind,
  );

  if (!definition) {
    throw new Error(`알 수 없는 스터디 단계예요: ${kind}`);
  }

  return definition;
}
