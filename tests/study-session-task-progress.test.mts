import assert from 'node:assert/strict';
import test from 'node:test';

import { getTeamTaskProgress } from '../app/features/study-session/_lib/index.ts';
import type { SessionParticipant, SessionTaskGroup } from '../app/lib/notion.ts';

function createTaskGroup({
  done,
  number,
  total,
}: Readonly<{ done: number; number: number; total: number }>): SessionTaskGroup {
  return {
    number,
    blocks: [],
    tasks: [],
    tasksDone: done,
    tasksTotal: total,
  };
}

function createParticipant({
  id,
  name,
  taskGroups,
}: Readonly<{
  id: string;
  name: string;
  taskGroups: SessionTaskGroup[];
}>): SessionParticipant {
  return {
    id,
    name,
    tasks: [],
    tasksDone: 0,
    tasksTotal: 0,
    taskGroups,
    reflection: null,
  };
}

test('aggregates overall progress across every Task group and current progress from the active Task', (): void => {
  const progress = getTeamTaskProgress({
    taskNumber: 2,
    participants: [
      createParticipant({
        id: 'first',
        name: '첫째',
        taskGroups: [createTaskGroup({ number: 1, done: 5, total: 6 }), createTaskGroup({ number: 2, done: 2, total: 4 })],
      }),
      createParticipant({
        id: 'second',
        name: '둘째',
        taskGroups: [createTaskGroup({ number: 1, done: 2, total: 4 }), createTaskGroup({ number: 2, done: 1, total: 2 })],
      }),
    ],
  });

  assert.deepEqual(progress.overall, { done: 10, total: 16, percent: 62.5 });
  assert.deepEqual(progress.current, { done: 3, total: 6, percent: 50 });
  assert.deepEqual(
    progress.participants.map(({ colorIndex, contribution, current, overall }) => ({ colorIndex, contribution, current, overall })),
    [
      { colorIndex: 0, contribution: { overallPercent: 43.75, currentPercent: (2 / 6) * 100 }, current: { done: 2, total: 4, percent: 50 }, overall: { done: 7, total: 10, percent: 70 } },
      { colorIndex: 1, contribution: { overallPercent: 18.75, currentPercent: (1 / 6) * 100 }, current: { done: 1, total: 2, percent: 50 }, overall: { done: 3, total: 6, percent: 50 } },
    ],
  );
});

test('counts overall progress only from Task groups, ignoring list items outside them', (): void => {
  const participant = {
    ...createParticipant({ id: 'check-in', name: '체크인 작성자', taskGroups: [createTaskGroup({ number: 1, done: 1, total: 2 })] }),
    tasksDone: 5,
    tasksTotal: 5,
  };
  const progress = getTeamTaskProgress({ taskNumber: 1, participants: [participant] });

  assert.deepEqual(progress.overall, { done: 1, total: 2, percent: 50 });
  assert.deepEqual(progress.participants[0]?.overall, { done: 1, total: 2, percent: 50 });
});

test('treats a zero-total group as written while keeping every zero-total percent at zero', (): void => {
  const progress = getTeamTaskProgress({
    taskNumber: 1,
    participants: [
      createParticipant({
        id: 'empty',
        name: '빈 Task',
        taskGroups: [createTaskGroup({ number: 1, done: 0, total: 0 })],
      }),
    ],
  });

  assert.deepEqual(progress.overall, { done: 0, total: 0, percent: 0 });
  assert.deepEqual(progress.current, { done: 0, total: 0, percent: 0 });
  assert.equal(progress.participants[0]?.hasCurrentTask, true);
  assert.deepEqual(progress.participants[0]?.contribution, { overallPercent: 0, currentPercent: 0 });
});

test('keeps each member contribution in input order and sums to the team completion share', (): void => {
  const progress = getTeamTaskProgress({
    taskNumber: 1,
    participants: [
      createParticipant({ id: 'a', name: 'A', taskGroups: [createTaskGroup({ number: 1, done: 1, total: 3 })] }),
      createParticipant({ id: 'b', name: 'B', taskGroups: [createTaskGroup({ number: 1, done: 3, total: 3 })] }),
      createParticipant({ id: 'c', name: 'C', taskGroups: [createTaskGroup({ number: 2, done: 0, total: 3 })] }),
    ],
  });
  const overallContributions = progress.contributions.map((contribution) => contribution.contribution.overallPercent);
  const currentContributions = progress.contributions.map((contribution) => contribution.contribution.currentPercent);

  assert.deepEqual(overallContributions, [(1 / 9) * 100, (3 / 9) * 100, 0]);
  assert.deepEqual(currentContributions, [(1 / 6) * 100, (3 / 6) * 100, 0]);
  assert.ok(Math.abs(overallContributions.reduce((sum, contribution) => sum + contribution, 0) - progress.overall.percent) < Number.EPSILON);
  assert.ok(Math.abs(currentContributions.reduce((sum, contribution) => sum + contribution, 0) - progress.current.percent) < Number.EPSILON);
});

test('sorts current progress first, then current and overall percentages, while zero progress preserves input order', (): void => {
  const progress = getTeamTaskProgress({
    taskNumber: 1,
    participants: [
      createParticipant({ id: 'zero-first', name: '0-first', taskGroups: [createTaskGroup({ number: 1, done: 0, total: 2 })] }),
      createParticipant({ id: 'lower-overall', name: 'lower', taskGroups: [createTaskGroup({ number: 1, done: 1, total: 2 }), createTaskGroup({ number: 2, done: 3, total: 8 })] }),
      createParticipant({ id: 'higher-overall', name: 'higher', taskGroups: [createTaskGroup({ number: 1, done: 1, total: 2 }), createTaskGroup({ number: 2, done: 7, total: 8 })] }),
      createParticipant({ id: 'zero-second', name: '0-second', taskGroups: [] }),
    ],
  });

  assert.deepEqual(progress.participants.map((participant) => participant.participant.id), [
    'higher-overall',
    'lower-overall',
    'zero-first',
    'zero-second',
  ]);
});

test('does not assign a competition badge to zero current progress or an unwritten Task', (): void => {
  const progress = getTeamTaskProgress({
    taskNumber: 1,
    participants: [
      createParticipant({ id: 'leader', name: '선두', taskGroups: [createTaskGroup({ number: 1, done: 2, total: 4 })] }),
      createParticipant({ id: 'zero', name: '제로', taskGroups: [createTaskGroup({ number: 1, done: 0, total: 4 })] }),
      createParticipant({ id: 'missing', name: '없음', taskGroups: [] }),
    ],
  });

  assert.deepEqual(progress.participants.map((participant) => participant.competition), ['leader', null, null]);
});

test('assigns leader to ties and alongside through the inclusive ten-point boundary', (): void => {
  const progress = getTeamTaskProgress({
    taskNumber: 1,
    participants: [
      createParticipant({ id: 'leader-one', name: '선두1', taskGroups: [createTaskGroup({ number: 1, done: 9, total: 10 })] }),
      createParticipant({ id: 'leader-two', name: '선두2', taskGroups: [createTaskGroup({ number: 1, done: 9, total: 10 })] }),
      createParticipant({ id: 'alongside', name: '함께', taskGroups: [createTaskGroup({ number: 1, done: 8, total: 10 })] }),
      createParticipant({ id: 'chasing', name: '추격', taskGroups: [createTaskGroup({ number: 1, done: 7, total: 10 })] }),
    ],
  });

  assert.deepEqual(progress.participants.map((participant) => participant.competition), [
    'leader',
    'leader',
    'alongside',
    'chasing',
  ]);
});

test('marks every measurable written member complete when all current Tasks are complete', (): void => {
  const progress = getTeamTaskProgress({
    taskNumber: 1,
    participants: [
      createParticipant({ id: 'first', name: '첫째', taskGroups: [createTaskGroup({ number: 1, done: 2, total: 2 })] }),
      createParticipant({ id: 'second', name: '둘째', taskGroups: [createTaskGroup({ number: 1, done: 1, total: 1 })] }),
      createParticipant({ id: 'empty', name: '빈 Task', taskGroups: [createTaskGroup({ number: 1, done: 0, total: 0 })] }),
      createParticipant({ id: 'missing', name: '미작성 Task', taskGroups: [] }),
    ],
  });

  assert.deepEqual(progress.participants.map((participant) => participant.participant.id), ['first', 'second', 'empty', 'missing']);
  assert.deepEqual(progress.participants.map((participant) => participant.competition), ['complete', 'complete', null, null]);
});
