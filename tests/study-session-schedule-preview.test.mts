import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultStudySessionStages, createStudySessionStage } from '../app/features/study-session/_lib/index.ts';
import {
  formatStudySessionDuration,
  formatStudySessionScheduleTime,
  getStudySessionSchedulePreview,
} from '../app/features/study-session/_components/studySessionSchedulePreview.ts';

test('shows the default timetable as a 14:30 to 18:00 KST schedule', (): void => {
  const preview = getStudySessionSchedulePreview({
    scheduledDate: '2026-08-30',
    scheduledTime: '14:30',
    stages: createDefaultStudySessionStages(),
  });

  assert.equal(preview.waitingMessage, null);
  assert.equal(formatStudySessionScheduleTime({ timestamp: preview.timeline?.startsAt ?? 0 }), '14:30');
  assert.equal(formatStudySessionScheduleTime({ timestamp: preview.timeline?.endsAt ?? 0 }), '18:00');
  assert.equal(
    formatStudySessionDuration({ milliseconds: (preview.timeline?.endsAt ?? 0) - (preview.timeline?.startsAt ?? 0) }),
    '3시간 30분',
  );
});

test('waits to calculate when a stage duration is incomplete or invalid', (): void => {
  const stages = createDefaultStudySessionStages();
  stages[0] = { ...stages[0], minutes: 0 };

  const preview = getStudySessionSchedulePreview({
    scheduledDate: '2026-08-30',
    scheduledTime: '14:30',
    stages,
  });

  assert.equal(preview.timeline, null);
  assert.equal(preview.waitingMessage, '날짜, 시작 시간, 각 단계 시간을 입력하면 일정을 계산해요.');
});

test('recalculates every subsequent time after editing, reordering, deleting, and adding stages', (): void => {
  const defaultStages = createDefaultStudySessionStages();
  const taskOne = { ...defaultStages[2], minutes: 30 };
  const stages = [
    taskOne,
    ...defaultStages.filter((_, index) => index !== 2 && index !== 8),
    createStudySessionStage({ id: 'task-4', kind: 'task', minutes: 25, taskNumber: 4 }),
  ];

  const preview = getStudySessionSchedulePreview({
    scheduledDate: '2026-08-30',
    scheduledTime: '14:30',
    stages,
  });

  assert.notEqual(preview.timeline, null);
  const timeline = preview.timeline;

  assert.deepEqual(timeline.stages.map((scheduledStage) => scheduledStage.stage.title), [
    'Task 1',
    'Task Writing',
    'Task Sharing',
    'Break Time',
    'Task 2',
    'Break Time',
    'Task 3',
    'Retrospect',
    'Task 4',
  ]);
  assert.equal(timeline.stages[0]?.startAt, Date.parse('2026-08-30T05:30:00.000Z'));
  assert.equal(timeline.stages[0]?.endAt, Date.parse('2026-08-30T06:00:00.000Z'));
  assert.equal(timeline.stages[1]?.startAt, Date.parse('2026-08-30T06:00:00.000Z'));
  assert.equal(timeline.stages[1]?.endAt, Date.parse('2026-08-30T06:10:00.000Z'));
  assert.equal(timeline.endsAt, Date.parse('2026-08-30T08:45:00.000Z'));
});
