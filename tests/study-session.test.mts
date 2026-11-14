import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDefaultStudySessionStages,
  createStudySessionStage,
  getStudySessionTimeline,
  validateStudySessionDraft,
} from '../app/features/study-session/_lib/index.ts';
import {
  getStudySession,
  saveStudySession,
  type StudySessionDatabase,
} from '../app/features/study-session/server-index.ts';

const BEFORE_SESSION = Date.parse('2026-08-30T04:00:00.000Z');
const DURING_FIRST_TASK = Date.parse('2026-08-30T06:00:00.000Z');
const AFTER_SESSION = Date.parse('2026-08-30T09:00:00.000Z');

function createDefaultDraft(): {
  scheduledDate: string;
  scheduledTime: string;
  stages: ReturnType<typeof createDefaultStudySessionStages>;
} {
  return {
    scheduledDate: '2026-08-30',
    scheduledTime: '14:30',
    stages: createDefaultStudySessionStages(),
  };
}

class MemoryStudySessionStatement {
  private values: unknown[] = [];
  private readonly loadSession: () => string | null;
  private readonly storeSession: (sessionJson: string) => void;

  constructor(
    loadSession: () => string | null,
    storeSession: (sessionJson: string) => void,
  ) {
    this.loadSession = loadSession;
    this.storeSession = storeSession;
  }

  bind(...values: unknown[]): MemoryStudySessionStatement {
    this.values = values;
    return this;
  }

  async first<T,>(): Promise<T | null> {
    const sessionJson = this.loadSession();
    if (sessionJson === null) return null;
    return JSON.parse(JSON.stringify({ session_json: sessionJson }));
  }

  async run(): Promise<unknown> {
    const sessionJson = this.values[0];
    if (typeof sessionJson !== 'string') throw new Error('저장할 회차가 없습니다.');
    this.storeSession(sessionJson);
    return {};
  }
}

class MemoryStudySessionDatabase implements StudySessionDatabase {
  private sessionJson: string | null = null;

  prepare(): MemoryStudySessionStatement {
    return new MemoryStudySessionStatement(
      () => this.sessionJson,
      (sessionJson: string): void => {
        this.sessionJson = sessionJson;
      },
    );
  }
}

function createMemoryDatabase(): StudySessionDatabase {
  return new MemoryStudySessionDatabase();
}

test('provides a fresh default template with fixed stage copy', (): void => {
  const firstTemplate = createDefaultStudySessionStages();
  const secondTemplate = createDefaultStudySessionStages();

  firstTemplate[0].minutes = 99;

  assert.equal(secondTemplate.length, 9);
  assert.deepEqual(secondTemplate[0], {
    id: 'task-writing',
    kind: 'task-writing',
    title: 'Task Writing',
    guide: 'Task는 정해진 시간에 끝낼 수 있는 작은 작업 단위예요. 이번 시간에 끝낼 Task와 그 이유를 정해요.',
    minutes: 10,
    taskNumber: null,
  });
  assert.equal(secondTemplate[4].guide, '두 번째 Task에 집중해요.');
});

test('derives KST prestart, active, and completed states from one schedule', (): void => {
  const session = createDefaultDraft();

  const prestart = getStudySessionTimeline({ session, timestamp: BEFORE_SESSION });
  const active = getStudySessionTimeline({ session, timestamp: DURING_FIRST_TASK });
  const completed = getStudySessionTimeline({ session, timestamp: AFTER_SESSION });

  assert.equal(prestart.status, 'prestart');
  assert.equal(prestart.currentStage, null);
  assert.equal(active.status, 'active');
  assert.equal(active.currentStage?.stage.title, 'Task 1');
  assert.equal(active.currentStage?.endAt, Date.parse('2026-08-30T06:50:00.000Z'));
  assert.equal(completed.status, 'completed');
  assert.equal(completed.currentStage, null);
  assert.equal(completed.endsAt, AFTER_SESSION);
});

test('validates editable time and order while keeping fixed Task identities', (): void => {
  const draft = createDefaultDraft();
  const taskWriting = draft.stages[0];
  const taskOne = draft.stages[2];
  const rearrangedStages = [taskOne, { ...taskWriting, minutes: 15 }];

  const validated = validateStudySessionDraft({
    draft: { ...draft, stages: rearrangedStages },
    now: BEFORE_SESSION,
  });

  assert.deepEqual(validated.stages.map((stage) => stage.id), ['task-1', 'task-writing']);
  assert.equal(validated.stages[1].minutes, 15);
  assert.throws(
    () => validateStudySessionDraft({
      draft: {
        ...draft,
        stages: [
          taskOne,
          createStudySessionStage({ id: 'other-task-1', kind: 'task', minutes: 10, taskNumber: 1 }),
        ],
      },
      now: BEFORE_SESSION,
    }),
    /중복/,
  );
});

test('allows a past time today but rejects a prior Korean calendar date', (): void => {
  const pastToday = createDefaultDraft();
  pastToday.scheduledTime = '12:00';
  const yesterday = createDefaultDraft();
  yesterday.scheduledDate = '2026-08-29';

  assert.equal(validateStudySessionDraft({ draft: pastToday, now: BEFORE_SESSION }).scheduledTime, '12:00');
  assert.throws(
    () => validateStudySessionDraft({ draft: yesterday, now: BEFORE_SESSION }),
    /지난 날짜/,
  );
});

test('preserves the reservation creation time for prestart last-write-wins updates', async (): Promise<void> => {
  const database = createMemoryDatabase();
  const firstDraft = createDefaultDraft();
  const replacementDraft = createDefaultDraft();
  replacementDraft.scheduledTime = '15:00';

  const first = await saveStudySession({ database, draft: firstDraft, now: BEFORE_SESSION });
  const replacement = await saveStudySession({ database, draft: replacementDraft, now: BEFORE_SESSION + 1_000 });
  const stored = await getStudySession({ database });

  assert.equal(first.createdAt, replacement.createdAt);
  assert.equal(replacement.scheduledTime, '15:00');
  assert.equal(stored?.scheduledTime, '15:00');
});

test('rejects updates while the current session is active', async (): Promise<void> => {
  const database = createMemoryDatabase();
  const firstDraft = createDefaultDraft();

  await saveStudySession({ database, draft: firstDraft, now: BEFORE_SESSION });
  await assert.rejects(
    saveStudySession({ database, draft: firstDraft, now: Date.parse('2026-08-30T06:00:00.000Z') }),
    /진행 중인 회차/,
  );
});

test('allows an initially created session that is already completed', async (): Promise<void> => {
  const database = createMemoryDatabase();
  const completedDraft = createDefaultDraft();
  completedDraft.scheduledTime = '09:00';

  const session = await saveStudySession({ database, draft: completedDraft, now: BEFORE_SESSION });
  const timeline = getStudySessionTimeline({ session, timestamp: BEFORE_SESSION });

  assert.equal(timeline.status, 'completed');
});

test('replaces a completed session with a new reservation', async (): Promise<void> => {
  const database = createMemoryDatabase();
  const completedDraft = createDefaultDraft();
  completedDraft.scheduledTime = '09:00';
  const nextDraft = createDefaultDraft();

  const completedSession = await saveStudySession({ database, draft: completedDraft, now: BEFORE_SESSION });
  const nextSession = await saveStudySession({ database, draft: nextDraft, now: BEFORE_SESSION + 1_000 });
  const stored = await getStudySession({ database });

  assert.notEqual(nextSession.createdAt, completedSession.createdAt);
  assert.equal(nextSession.scheduledTime, '14:30');
  assert.equal(stored?.createdAt, nextSession.createdAt);
});
