import type { PersonalCumulativeRecord } from "~/lib/notion";

export type RecordMetric = "participatedSessionCount" | "completedTaskCount";

export interface FlameStage {
  name: string;
  participatedSessionCount: number;
  completedTaskCount: number;
}

export interface RecordBadge {
  id: string;
  name: string;
  metric: RecordMetric;
  target: number;
}

export interface StageProgress {
  metric: RecordMetric;
  current: number;
  target: number;
  remaining: number;
  percent: number;
}

export interface PersonalFlameGrowth {
  currentStage: FlameStage;
  hasEarnedCurrentStage: boolean;
  nextStage: FlameStage | null;
  progress: StageProgress[];
  earnedBadges: RecordBadge[];
}

export const FLAME_STAGES: readonly FlameStage[] = [
  { name: "불씨", participatedSessionCount: 1, completedTaskCount: 0 },
  { name: "작은 불꽃", participatedSessionCount: 5, completedTaskCount: 10 },
  { name: "모닥불", participatedSessionCount: 10, completedTaskCount: 25 },
  { name: "오래 타는 불", participatedSessionCount: 25, completedTaskCount: 50 },
];

export const RECORD_BADGES: readonly RecordBadge[] = [
  { id: "session-1", name: "첫 불씨", metric: "participatedSessionCount", target: 1 },
  { id: "session-5", name: "함께한 불빛", metric: "participatedSessionCount", target: 5 },
  { id: "session-10", name: "익숙한 자리", metric: "participatedSessionCount", target: 10 },
  { id: "session-25", name: "든든한 동행", metric: "participatedSessionCount", target: 25 },
  { id: "session-50", name: "이어온 시간", metric: "participatedSessionCount", target: 50 },
  { id: "session-100", name: "오래 켠 불", metric: "participatedSessionCount", target: 100 },
  { id: "task-1", name: "첫 장작", metric: "completedTaskCount", target: 1 },
  { id: "task-10", name: "차곡차곡 장작", metric: "completedTaskCount", target: 10 },
  { id: "task-25", name: "쌓아올린 온기", metric: "completedTaskCount", target: 25 },
  { id: "task-50", name: "든든한 장작", metric: "completedTaskCount", target: 50 },
  { id: "task-100", name: "깊어진 온기", metric: "completedTaskCount", target: 100 },
  { id: "task-250", name: "가득한 모닥불", metric: "completedTaskCount", target: 250 },
];

const RECORD_METRICS: readonly RecordMetric[] = ["participatedSessionCount", "completedTaskCount"];

export function getPersonalFlameGrowth({
  record,
}: Readonly<{ record: Pick<PersonalCumulativeRecord, RecordMetric> }>): PersonalFlameGrowth {
  const earnedStages = FLAME_STAGES.filter((stage) => RECORD_METRICS.every((metric) => record[metric] >= stage[metric]));
  const currentStage = earnedStages.at(-1) ?? FLAME_STAGES[0];
  const nextStage = FLAME_STAGES[FLAME_STAGES.indexOf(currentStage) + 1] ?? null;
  const progress = nextStage === null ? [] : RECORD_METRICS.map((metric): StageProgress => ({
    metric,
    current: record[metric],
    target: nextStage[metric],
    remaining: Math.max(0, nextStage[metric] - record[metric]),
    percent: Math.min(100, Math.max(0, (record[metric] / nextStage[metric]) * 100)),
  }));

  return {
    currentStage,
    hasEarnedCurrentStage: earnedStages.length > 0,
    nextStage,
    progress,
    earnedBadges: RECORD_BADGES.filter(({ metric, target }) => record[metric] >= target),
  };
}
