import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Flame,
  ListChecks,
  RefreshCw,
  UsersRound,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Divider,
  Progress,
  StatusBadge,
} from "~/components";
import { getCampfireDashboardQueryOptions } from "~/features/notion-data";
import { getQueryClient } from "~/lib/get-query-client";
import type { CampfireDashboard, SessionParticipant } from "~/lib/notion";

const AUTO_REFRESH_INTERVAL_MS = 75_000;
const MAX_PROGRESS_VALUE = 100;

const KOREAN_DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "full",
});

const KOREAN_NUMBER_FORMATTER = new Intl.NumberFormat("ko-KR");

interface DateValue {
  date: string;
}

interface ParticipantCardProps {
  participant: SessionParticipant;
}

interface CooperativeFlameStage {
  label: string;
  iconClassName: string;
}

export async function clientLoader(): Promise<CampfireDashboard> {
  const queryClient = getQueryClient();
  return queryClient.ensureQueryData(
    getCampfireDashboardQueryOptions({ refetchInterval: AUTO_REFRESH_INTERVAL_MS }),
  );
}

clientLoader.hydrate = true as const;

export function HydrateFallback(): React.ReactElement {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex min-h-svh w-full max-w-6xl items-center px-4 py-8 sm:px-6 sm:py-12"
    >
      <p className="text-lg leading-7 text-fg-neutral-muted" role="status">
        세션 현황을 불러오고 있어요.
      </p>
    </main>
  );
}

function formatSessionDate({ date }: Readonly<DateValue>): string {
  return KOREAN_DATE_FORMATTER.format(new Date(date));
}

function calculateProgress({ completed, total }: Readonly<{ completed: number; total: number }>): number {
  if (total === 0) return 0;

  const rawProgress = (completed / total) * MAX_PROGRESS_VALUE;
  return Math.min(Math.max(rawProgress, 0), MAX_PROGRESS_VALUE);
}

function getCooperativeFlameStage({
  progress,
  total,
}: Readonly<{ progress: number; total: number }>): CooperativeFlameStage {
  if (total === 0) {
    return { label: "Task 없음", iconClassName: "size-8 text-fg-neutral-muted" };
  }

  if (progress === 0) {
    return { label: "함께 불씨 준비", iconClassName: "size-8 fill-fg-brand/20 text-fg-brand" };
  }

  if (progress < 34) {
    return { label: "함께 불꽃 키우는 중", iconClassName: "size-10 fill-fg-brand/40 text-fg-brand" };
  }

  if (progress < 67) {
    return { label: "함께 불꽃 키우는 중", iconClassName: "size-12 fill-fg-brand/60 text-fg-brand" };
  }

  if (progress < MAX_PROGRESS_VALUE) {
    return { label: "함께 불꽃 키우는 중", iconClassName: "size-14 fill-fg-brand/80 text-fg-brand" };
  }

  return { label: "오늘의 불꽃 완성", iconClassName: "size-16 fill-fg-brand text-fg-brand" };
}

function formatProgressPercentage({ progress }: Readonly<{ progress: number }>): string {
  return `${Math.round(progress)}%`;
}

function ParticipantCard({ participant }: Readonly<ParticipantCardProps>): React.ReactElement {
  const hasTasks = participant.tasks.length > 0;
  const nextTask = participant.tasks.find((task) => !task.checked);
  const hasCompletedAllTasks = hasTasks && nextTask === undefined;
  const progressValue = calculateProgress({
    completed: participant.tasksDone,
    total: participant.tasksTotal,
  });
  const progressPercentage = formatProgressPercentage({ progress: progressValue });
  let taskContent: React.ReactElement = (
    <div className="grid gap-3" aria-label={`${participant.name}님의 Task 상태`}>
      <p className="text-base leading-6 text-fg-neutral-muted">
        아직 Task가 없어요.
      </p>
    </div>
  );

  if (hasCompletedAllTasks) {
    taskContent = (
      <div className="grid gap-3" aria-label={`${participant.name}님의 Task 상태`}>
        <p className="text-base leading-6 text-fg-neutral-muted">
          모든 Task를 마쳤어요.
        </p>
      </div>
    );
  } else if (nextTask) {
    taskContent = (
      <section className="grid min-w-0 gap-3" aria-label={`${participant.name}님의 다음 Task`}>
        <h4 className="text-sm font-semibold text-fg-brand">다음 Task</h4>
        <p className="min-w-0 break-words text-base font-medium leading-6 text-fg-neutral">
          {nextTask.text}
        </p>
      </section>
    );
  }

  const progressText = `${KOREAN_NUMBER_FORMATTER.format(participant.tasksDone)} / ${KOREAN_NUMBER_FORMATTER.format(participant.tasksTotal)}개 완료`;
  const progressValueText = `${progressPercentage}, ${progressText}`;

  return (
    <li className="min-w-0">
      <Card className="h-full min-w-0">
        <CardHeader className="pb-3">
          <CardTitle>
            <h3 className="min-w-0 break-words text-2xl font-semibold tracking-tight sm:text-3xl">
              {participant.name}
            </h3>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid min-w-0 gap-5">
          <section className="grid gap-3" aria-label={`${participant.name}님의 진행 상황`}>
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
              <div className="grid gap-1">
                <h4 className="text-base font-semibold">오늘의 진행률</h4>
                <p className="text-base font-medium text-fg-neutral-muted tabular-nums">
                  {progressText}
                </p>
              </div>
              <p className="text-4xl font-semibold leading-none tracking-tight tabular-nums sm:text-5xl">
                {progressPercentage}
              </p>
            </div>
            <Progress
              label={`${participant.name}님의 Task 완료 현황`}
              value={progressValue}
              valueText={progressValueText}
            />
          </section>
          <Divider />
          {taskContent}
        </CardContent>
      </Card>
    </li>
  );
}

export default function Display(): React.ReactElement {
  const { data: dashboard, isFetching } = useSuspenseQuery(
    getCampfireDashboardQueryOptions({ refetchInterval: AUTO_REFRESH_INTERVAL_MS }),
  );
  const { session } = dashboard;
  const sessionDate = formatSessionDate({ date: session.date });
  const sessionTaskTotal = session.participants.reduce(
    (total, participant) => total + participant.tasksTotal,
    0,
  );
  const sessionTaskDone = session.participants.reduce(
    (total, participant) => total + participant.tasksDone,
    0,
  );
  const sessionProgress = calculateProgress({ completed: sessionTaskDone, total: sessionTaskTotal });
  const sessionProgressPercentage = formatProgressPercentage({ progress: sessionProgress });
  const sessionProgressText = sessionTaskTotal === 0
    ? "등록된 Task가 없어요."
    : `${KOREAN_NUMBER_FORMATTER.format(sessionTaskDone)} / ${KOREAN_NUMBER_FORMATTER.format(sessionTaskTotal)}개 완료`;
  const cooperativeFlameStage = getCooperativeFlameStage({
    progress: sessionProgress,
    total: sessionTaskTotal,
  });
  const refreshStatus = isFetching ? "현황을 새로 확인하고 있어요." : "75초마다 현황을 확인해요.";
  const refreshIconClassName = isFetching
    ? "size-5 animate-spin motion-reduce:animate-none"
    : "size-5";

  return (
    <>
      <title>모닥불 | 세션 현황판</title>
      <meta name="description" content="모닥불 최신 세션 현황판이에요." />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto grid min-h-svh w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 sm:py-8"
      >
        <header className="flex flex-wrap items-center justify-between gap-4">
          <StatusBadge tone="accent">라이브</StatusBadge>
          <h1 className="min-w-0 text-3xl font-semibold tracking-tight sm:flex-1 sm:text-4xl">
            모닥불 세션 현황
          </h1>
          <p className="flex items-center gap-2 text-sm font-medium text-fg-neutral-muted">
            <RefreshCw aria-hidden="true" className={refreshIconClassName} />
            {refreshStatus}
          </p>
        </header>

        <section className="grid gap-5" aria-labelledby="participants-title">
          <h2 id="participants-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            참여자별 진행률
          </h2>
          {session.participants.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-base leading-6 text-fg-neutral-muted">
                이번 세션의 참여자 정보를 기다리고 있어요.
              </CardContent>
            </Card>
          ) : (
            <ul className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {session.participants.map((participant): React.ReactElement => (
                <ParticipantCard key={participant.id} participant={participant} />
              ))}
            </ul>
          )}
        </section>

        <section className="grid gap-3" aria-labelledby="session-summary-title">
          <h2
            id="session-summary-title"
            className="text-xl font-semibold tracking-tight sm:text-2xl"
          >
            이번 세션 요약
          </h2>
          <Card>
            <CardContent className="grid gap-5 py-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="grid gap-1">
                <p className="text-sm font-semibold text-fg-brand">세션 날짜</p>
                <p className="text-lg font-semibold tracking-tight sm:text-xl">
                  <time dateTime={session.date}>{sessionDate}</time>
                </p>
              </div>
              <div className="grid gap-1">
                <p className="flex items-center gap-2 text-sm font-semibold text-fg-brand">
                  <UsersRound aria-hidden="true" className="size-4" />
                  참여자
                </p>
                <p className="text-2xl font-semibold tracking-tight tabular-nums">
                  {KOREAN_NUMBER_FORMATTER.format(session.participants.length)}명
                </p>
              </div>
              <div className="grid gap-1">
                <p className="flex items-center gap-2 text-sm font-semibold text-fg-brand">
                  <ListChecks aria-hidden="true" className="size-4" />
                  Task 현황
                </p>
                <p className="text-2xl font-semibold tracking-tight tabular-nums">
                  {sessionProgressText}
                </p>
              </div>
              <section className="grid gap-2" aria-labelledby="cooperative-flame-title">
                <h3 id="cooperative-flame-title" className="text-sm font-semibold text-fg-brand">
                  함께 키우는 불꽃
                </h3>
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-20 shrink-0 items-center justify-center">
                    <Flame aria-hidden="true" className={cooperativeFlameStage.iconClassName} />
                  </div>
                  <div className="grid min-w-0 gap-1">
                    <p className="break-words text-lg font-semibold tracking-tight">
                      {cooperativeFlameStage.label}
                    </p>
                    <p className="text-sm text-fg-neutral-muted tabular-nums">
                      {sessionProgressPercentage} · {sessionProgressText}
                    </p>
                  </div>
                </div>
              </section>
            </CardContent>
          </Card>
        </section>
      </main>
    </>
  );
}
