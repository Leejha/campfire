import type { StudySession, StudySessionDraft } from '../models.ts';
import { getStudySessionTimeline, parseStudySessionDraft, validateStudySessionDraft } from '../_lib/index.ts';

interface StudySessionDatabaseStatement {
  bind(...values: unknown[]): StudySessionDatabaseStatement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}

export interface StudySessionDatabase {
  prepare(query: string): StudySessionDatabaseStatement;
}

interface StoredStudySessionRow {
  session_json: string;
}

interface GetStudySessionOptions {
  database: StudySessionDatabase;
}

interface SaveStudySessionOptions {
  database: StudySessionDatabase;
  draft: unknown;
  now: number;
}

const SELECT_CURRENT_SESSION = 'SELECT session_json FROM study_sessions WHERE id = 1';
const UPSERT_CURRENT_SESSION = `
  INSERT INTO study_sessions (id, session_json, updated_at)
  VALUES (1, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    session_json = excluded.session_json,
    updated_at = excluded.updated_at
`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getIsoTimestamp({ value, label }: Readonly<{ value: unknown; label: string }>): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label}이 올바르지 않습니다.`);
  }
  return value;
}

function parseStoredStudySession({ value }: Readonly<{ value: unknown }>): StudySession {
  if (!isRecord(value)) throw new Error('저장된 회차 정보가 올바르지 않습니다.');
  const draft = parseStudySessionDraft({ draft: value });
  const createdAt = getIsoTimestamp({ value: value.createdAt, label: '생성 시각' });
  const updatedAt = getIsoTimestamp({ value: value.updatedAt, label: '수정 시각' });
  return { ...draft, createdAt, updatedAt };
}

function createStudySession({
  draft,
  currentSession,
  now,
}: Readonly<{ draft: StudySessionDraft; currentSession: StudySession | null; now: number }>): StudySession {
  const savedAt = new Date(now).toISOString();
  if (currentSession === null) return { ...draft, createdAt: savedAt, updatedAt: savedAt };

  const timeline = getStudySessionTimeline({ session: currentSession, timestamp: now });
  if (timeline.status === 'active') throw new Error('진행 중인 회차는 수정할 수 없습니다.');
  const createdAt = timeline.status === 'prestart' ? currentSession.createdAt : savedAt;
  return { ...draft, createdAt, updatedAt: savedAt };
}

export async function getStudySession({ database }: Readonly<GetStudySessionOptions>): Promise<StudySession | null> {
  const row = await database.prepare(SELECT_CURRENT_SESSION).first<StoredStudySessionRow>();
  if (row === null) return null;
  const parsed: unknown = JSON.parse(row.session_json);
  return parseStoredStudySession({ value: parsed });
}

export async function saveStudySession({
  database,
  draft,
  now,
}: Readonly<SaveStudySessionOptions>): Promise<StudySession> {
  const validatedDraft = validateStudySessionDraft({ draft, now });
  const currentSession = await getStudySession({ database });
  const session = createStudySession({ draft: validatedDraft, currentSession, now });
  await database.prepare(UPSERT_CURRENT_SESSION).bind(JSON.stringify(session), session.updatedAt).run();
  return session;
}
