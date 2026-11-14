import type { SessionParticipant, SessionTaskGroup } from '~/lib/notion';

const PERCENTAGE_SCALE = 100;
const ALONGSIDE_PERCENTAGE_POINT_GAP = 10;
const MIN_PERCENTAGE = 0;

export interface TaskProgressSummary {
  done: number;
  total: number;
  percent: number;
}

export type TaskCompetitionStatus = 'leader' | 'alongside' | 'chasing' | 'complete' | null;

export interface ParticipantTaskProgress {
  participant: SessionParticipant;
  colorIndex: number;
  hasCurrentTask: boolean;
  overall: TaskProgressSummary;
  current: TaskProgressSummary;
  contribution: TeamTaskContribution;
  competition: TaskCompetitionStatus;
}

export interface TeamTaskContribution {
  overallPercent: number;
  currentPercent: number;
}

export interface ParticipantTaskContribution {
  participant: SessionParticipant;
  colorIndex: number;
  contribution: TeamTaskContribution;
}

export interface TeamTaskProgress {
  overall: TaskProgressSummary;
  current: TaskProgressSummary;
  participants: ParticipantTaskProgress[];
  contributions: ParticipantTaskContribution[];
}

interface ProgressNumbers {
  done: number;
  total: number;
}

function getProgressSummary({ done, total }: Readonly<ProgressNumbers>): TaskProgressSummary {
  const rawPercent = total === 0 ? MIN_PERCENTAGE : (done / total) * PERCENTAGE_SCALE;
  const percent = Math.min(Math.max(rawPercent, MIN_PERCENTAGE), PERCENTAGE_SCALE);

  return { done, total, percent };
}

function findCurrentTaskGroup({
  participant,
  taskNumber,
}: Readonly<{ participant: SessionParticipant; taskNumber: number }>): SessionTaskGroup | null {
  return participant.taskGroups.find((taskGroup) => taskGroup.number === taskNumber) ?? null;
}

function getTaskProgressNumbers({ taskGroup }: Readonly<{ taskGroup: SessionTaskGroup | null }>): ProgressNumbers {
  if (taskGroup === null) return { done: 0, total: 0 };
  return { done: taskGroup.tasksDone, total: taskGroup.tasksTotal };
}

function getOverallProgressNumbers({ participant }: Readonly<{ participant: SessionParticipant }>): ProgressNumbers {
  return participant.taskGroups.reduce<ProgressNumbers>(
    (sum, taskGroup) => ({ done: sum.done + taskGroup.tasksDone, total: sum.total + taskGroup.tasksTotal }),
    { done: 0, total: 0 },
  );
}

function isSameProgressPercent({
  first,
  second,
}: Readonly<{ first: TaskProgressSummary; second: TaskProgressSummary }>): boolean {
  return first.done * second.total === second.done * first.total;
}

function compareProgressPercent({
  first,
  second,
}: Readonly<{ first: TaskProgressSummary; second: TaskProgressSummary }>): number {
  if (first.total === 0 && second.total === 0) return 0;
  if (first.total === 0) return 1;
  if (second.total === 0) return -1;
  return second.done * first.total - first.done * second.total;
}

function getCompetitionStatus({
  current,
  highest,
  everyoneComplete,
}: Readonly<{
  current: TaskProgressSummary;
  highest: TaskProgressSummary | null;
  everyoneComplete: boolean;
}>): TaskCompetitionStatus {
  const isMeasurableProgress = current.done > 0 && current.total > 0;
  if (!isMeasurableProgress) return null;
  if (highest === null) return null;
  if (everyoneComplete) return 'complete';
  if (isSameProgressPercent({ first: current, second: highest })) return 'leader';
  if (highest.percent - current.percent <= ALONGSIDE_PERCENTAGE_POINT_GAP) return 'alongside';
  return 'chasing';
}

function compareParticipantProgress(
  first: ParticipantTaskProgress,
  second: ParticipantTaskProgress,
): number {
  const firstHasCurrentProgress = first.current.done > 0 && first.current.total > 0;
  const secondHasCurrentProgress = second.current.done > 0 && second.current.total > 0;

  if (firstHasCurrentProgress !== secondHasCurrentProgress) return firstHasCurrentProgress ? -1 : 1;
  if (!firstHasCurrentProgress) return first.colorIndex - second.colorIndex;
  const currentPercentDifference = compareProgressPercent({ first: first.current, second: second.current });
  if (currentPercentDifference !== 0) return currentPercentDifference;
  const overallPercentDifference = compareProgressPercent({ first: first.overall, second: second.overall });
  if (overallPercentDifference !== 0) return overallPercentDifference;
  return first.colorIndex - second.colorIndex;
}

export function getTeamTaskProgress({
  participants,
  taskNumber,
}: Readonly<{ participants: readonly SessionParticipant[]; taskNumber: number }>): TeamTaskProgress {
  const participantProgress = participants.map((participant, colorIndex) => {
    const taskGroup = findCurrentTaskGroup({ participant, taskNumber });
    const currentNumbers = getTaskProgressNumbers({ taskGroup });

    return {
      participant,
      colorIndex,
      hasCurrentTask: taskGroup !== null,
      overall: getProgressSummary(getOverallProgressNumbers({ participant })),
      current: getProgressSummary(currentNumbers),
    };
  });
  const overall = getProgressSummary({
    done: participantProgress.reduce((sum, progress) => sum + progress.overall.done, 0),
    total: participantProgress.reduce((sum, progress) => sum + progress.overall.total, 0),
  });
  const current = getProgressSummary({
    done: participantProgress.reduce((sum, progress) => sum + progress.current.done, 0),
    total: participantProgress.reduce((sum, progress) => sum + progress.current.total, 0),
  });
  const measurableProgress = participantProgress.filter((progress) => progress.current.total > 0);
  const highest = measurableProgress.reduce<TaskProgressSummary | null>((highestProgress, progress) => {
    if (highestProgress === null) return progress.current;
    const currentPercentDifference = compareProgressPercent({
      first: progress.current,
      second: highestProgress,
    });
    return currentPercentDifference < 0 ? progress.current : highestProgress;
  }, null);
  const everyoneComplete = measurableProgress.length > 0
    && measurableProgress.every((progress) => progress.current.done === progress.current.total);
  const progressWithStatus = participantProgress.map((progress) => ({
    ...progress,
    contribution: {
      overallPercent: overall.total === 0 ? 0 : (progress.overall.done / overall.total) * PERCENTAGE_SCALE,
      currentPercent: current.total === 0 ? 0 : (progress.current.done / current.total) * PERCENTAGE_SCALE,
    },
    competition: getCompetitionStatus({
      current: progress.current,
      highest,
      everyoneComplete,
    }),
  }));

  return {
    overall,
    current,
    participants: progressWithStatus.sort(compareParticipantProgress),
    contributions: progressWithStatus
      .slice()
      .sort((first, second) => first.colorIndex - second.colorIndex)
      .map((progress) => ({
        participant: progress.participant,
        colorIndex: progress.colorIndex,
        contribution: progress.contribution,
      })),
  };
}
