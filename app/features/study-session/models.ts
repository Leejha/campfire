export type StudySessionStageKind =
  | 'task-writing'
  | 'task-sharing'
  | 'task'
  | 'break'
  | 'retrospect'
  | 'closing';

export type StudySessionStatus = 'prestart' | 'active' | 'completed';

export interface StudySessionStage {
  id: string;
  kind: StudySessionStageKind;
  title: string;
  guide: string;
  minutes: number;
  taskNumber: number | null;
}

export interface StudySessionDraft {
  scheduledDate: string;
  scheduledTime: string;
  stages: StudySessionStage[];
}

export interface StudySession extends StudySessionDraft {
  createdAt: string;
  updatedAt: string;
}

export interface StudySessionScheduledStage {
  stage: StudySessionStage;
  startAt: number;
  endAt: number;
}

export interface StudySessionTimeline {
  status: StudySessionStatus;
  startsAt: number;
  endsAt: number;
  currentStage: StudySessionScheduledStage | null;
  stages: StudySessionScheduledStage[];
}
