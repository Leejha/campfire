import type { StudySession, StudySessionTimeline } from "../models";

export interface StudySessionViewData {
  session: StudySession | null;
  timeline: StudySessionTimeline | null;
  loadedAt: string;
}
