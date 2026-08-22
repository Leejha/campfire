import { useEffect } from "react";
import {
  CheckCircle2,
  Circle,
  ClipboardList,
  ClipboardX,
  Flame,
  RefreshCw,
  Users,
} from "lucide-react";
import { useRevalidator } from "react-router";
import { env } from "cloudflare:workers";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Divider,
  Progress,
  StatusBadge,
} from "~/components";
import { getCampfireDashboard } from "~/lib/notion";
import type { CampfireDashboard, SessionParticipant } from "~/lib/notion";
import type { Route } from "./+types/home";

const AUTO_REFRESH_INTERVAL_MS = 75_000;
const MAX_PROGRESS_VALUE = 100;

const KOREAN_DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "full",
});

const KOREAN_TIME_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  hour: "numeric",
  minute: "2-digit",
});

const KOREAN_NUMBER_FORMATTER = new Intl.NumberFormat("ko-KR");

interface HomeLoaderData {
  dashboard: CampfireDashboard;
  loadedAt: string;
}

interface DateValue {
  date: string;
}

interface LoadedTimeValue {
  loadedAt: string;
}

interface ParticipantCardProps {
  participant: SessionParticipant;
}

export async function loader(): Promise<HomeLoaderData> {
  const dashboard = await getCampfireDashboard(env);

  return {
    dashboard,
    loadedAt: new Date().toISOString(),
  };
}

function formatSessionDate({ date }: Readonly<DateValue>): string {
  return KOREAN_DATE_FORMATTER.format(new Date(date));
}

function formatLoadedTime({ loadedAt }: Readonly<LoadedTimeValue>): string {
  return KOREAN_TIME_FORMATTER.format(new Date(loadedAt));
}

function useSessionAutoRefresh(): boolean {
  const revalidator = useRevalidator();
  const isRefreshing = revalidator.state !== "idle";

  useEffect(() => {
    const refreshSession = (): void => {
      if (revalidator.state === "idle") {
        void revalidator.revalidate();
      }
    };

    const intervalId = window.setInterval(
      refreshSession,
      AUTO_REFRESH_INTERVAL_MS,
    );

    return (): void => {
      window.clearInterval(intervalId);
    };
  }, [revalidator]);

  return isRefreshing;
}

function ParticipantCard({
  participant,
}: Readonly<ParticipantCardProps>): React.ReactElement {
  const hasTasks = participant.tasks.length > 0;
  const nextTask = participant.tasks.find((task) => !task.checked);
  const hasCompletedAllTasks = hasTasks && nextTask === undefined;
  const rawProgressPercentage = hasTasks
    ? (participant.tasksDone / participant.tasksTotal) * MAX_PROGRESS_VALUE
    : 0;
  const progressPercentage = Math.min(
    Math.max(rawProgressPercentage, 0),
    MAX_PROGRESS_VALUE,
  );
  let progressMessage = "아직 Task가 없어요.";
  let progressStatus = "노션에 Task를 적으면 여기에서 함께 볼 수 있어요.";
  let taskStatusBadge = <StatusBadge tone="neutral">Task 없음</StatusBadge>;

  if (hasCompletedAllTasks) {
    progressMessage = "모든 Task를 마쳤어요.";
    progressStatus = "함께한 시간이 차곡차곡 쌓였어요.";
    taskStatusBadge = <StatusBadge tone="success">완료</StatusBadge>;
  } else if (hasTasks) {
    progressMessage = `${participant.tasksDone} / ${participant.tasksTotal}개 Task를 완료했어요.`;
    progressStatus = "다음 Task를 함께 이어가고 있어요.";
    taskStatusBadge = <StatusBadge tone="primary">진행 중</StatusBadge>;
  }

  return (
    <li>
      <Card className="h-full">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>
              <h3 className="text-xl font-semibold tracking-tight">
                {participant.name}
              </h3>
            </CardTitle>
            {taskStatusBadge}
          </div>
          <Divider />
        </CardHeader>
        <CardContent className="grid gap-6">
          {nextTask ? (
            <section className="grid gap-3">
              <div className="flex items-center gap-2">
                <ClipboardList aria-hidden="true" className="size-4 text-primary" />
                <h4 className="text-sm font-semibold">다음 Task</h4>
              </div>
              <p className="min-w-0 break-words text-base font-semibold leading-7">
                {nextTask.text}
              </p>
            </section>
          ) : (
            <div className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
              {hasCompletedAllTasks ? (
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-success"
                />
              ) : (
                <ClipboardX
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0"
                />
              )}
              <p>{progressMessage}</p>
            </div>
          )}

          <Divider />

          <section className="grid gap-3">
            <h4 className="text-sm font-semibold">Task 목록</h4>
            {hasTasks ? (
              <ul className="grid gap-3">
                {participant.tasks.map(
                  (task): React.ReactElement => (
                    <li key={task.id} className="flex items-start gap-3">
                      {task.checked ? (
                        <CheckCircle2
                          aria-hidden="true"
                          className="mt-0.5 size-5 shrink-0 text-success"
                        />
                      ) : (
                        <Circle
                          aria-hidden="true"
                          className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                        />
                      )}
                      <div className="grid min-w-0 gap-1 break-words leading-7">
                        <p
                          className={
                            task.checked
                              ? "text-muted-foreground line-through"
                              : "text-foreground"
                          }
                        >
                          <span className="sr-only">
                            {task.checked ? "완료: " : "미완료: "}
                          </span>
                          {task.text}
                        </p>
                      </div>
                    </li>
                  ),
                )}
              </ul>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                {progressStatus}
              </p>
            )}
          </section>

          <Divider />

          <section className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-sm font-semibold">진행 상황</h4>
              {hasTasks ? (
                <p className="text-sm font-medium">{progressMessage}</p>
              ) : null}
            </div>
            {hasTasks ? (
              <Progress
                label={`${participant.name}님의 Task 완료 현황`}
                value={progressPercentage}
                valueText={progressMessage}
              />
            ) : null}
            <p className="text-sm leading-6 text-muted-foreground">
              {progressStatus}
            </p>
          </section>
        </CardContent>
      </Card>
    </li>
  );
}

export default function Home({
  loaderData,
}: Route.ComponentProps): React.ReactElement {
  const isRefreshing = useSessionAutoRefresh();
  const { cumulativeMetrics, session } = loaderData.dashboard;
  const sessionDate = formatSessionDate({ date: session.date });
  const loadedTime = formatLoadedTime({ loadedAt: loaderData.loadedAt });
  const refreshStatus = isRefreshing
    ? "새 소식을 확인하고 있어요."
    : "75초마다 새 소식을 확인해요.";
  const refreshIconClassName = isRefreshing
    ? "size-4 animate-spin motion-reduce:animate-none"
    : "size-4";

  return (
    <>
      <title>Campfire | 함께 만드는 모각코</title>
      <meta
        name="description"
        content="함께 만드는 모각코의 최신 세션과 Task 진행 상황을 확인해요."
      />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto grid min-h-svh w-full max-w-6xl gap-12 px-4 py-8 sm:px-6 sm:py-12"
      >
        <header className="grid gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge tone="accent">라이브 세션</StatusBadge>
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Flame aria-hidden="true" className="size-4 text-primary" />
                <time dateTime={session.date}>{sessionDate}</time>
              </p>
            </div>
            <p
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
              role="status"
            >
              <RefreshCw aria-hidden="true" className={refreshIconClassName} />
              {refreshStatus}
            </p>
          </div>
          <div className="grid gap-3">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              함께 이어가는 Task
            </h1>
            <p className="text-lg leading-7 text-muted-foreground">
              각자의 다음 Task와 진행 상황을 한눈에 볼 수 있어요.
            </p>
          </div>
          <Divider />
          <p className="text-sm leading-6 text-muted-foreground">
            <time dateTime={loaderData.loadedAt}>
              {loadedTime}에 마지막으로 확인했어요.
            </time>
          </p>
        </header>

        <section className="grid gap-6" aria-labelledby="participants-title">
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge tone="primary">현재 세션</StatusBadge>
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Users aria-hidden="true" className="size-4" />
                {session.participants.length}명이 함께하고 있어요.
              </p>
            </div>
            <h2 id="participants-title" className="text-2xl font-semibold tracking-tight">
              오늘 함께하는 사람이에요
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Task는 '동사 + 작업 대상 + 완료 기준'으로 적으면 시작하기 쉬워요.
            </p>
          </div>
          {session.participants.length === 0 ? (
            <Card>
              <CardContent>
                <p className="leading-7 text-muted-foreground">
                  아직 참여자가 없어요. 노션에 이름을 적으면 여기에서 만날 수
                  있어요.
                </p>
              </CardContent>
            </Card>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {session.participants.map(
                (participant): React.ReactElement => (
                  <ParticipantCard key={participant.id} participant={participant} />
                ),
              )}
            </ul>
          )}
        </section>

        <section className="grid gap-6" aria-labelledby="cumulative-title">
          <Card className="border-border shadow-none">
            <CardContent className="grid gap-6">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge tone="neutral">누적 요약</StatusBadge>
                <h2
                  id="cumulative-title"
                  className="text-xl font-semibold tracking-tight"
                >
                  지금까지 함께한 기록
                </h2>
              </div>
              <Divider />
              <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="grid gap-1">
                  <dt className="text-sm font-medium text-muted-foreground">
                    총 세션
                  </dt>
                  <dd className="text-3xl font-semibold tracking-tight tabular-nums">
                    {KOREAN_NUMBER_FORMATTER.format(cumulativeMetrics.sessionCount)}회
                  </dd>
                </div>
                <div className="grid gap-1">
                  <dt className="text-sm font-medium text-muted-foreground">
                    완료한 Task
                  </dt>
                  <dd className="text-3xl font-semibold tracking-tight tabular-nums">
                    {KOREAN_NUMBER_FORMATTER.format(cumulativeMetrics.completedTaskCount)}개
                  </dd>
                </div>
                <div className="grid gap-1">
                  <dt className="text-sm font-medium text-muted-foreground">
                    함께한 참여
                  </dt>
                  <dd className="text-3xl font-semibold tracking-tight tabular-nums">
                    {KOREAN_NUMBER_FORMATTER.format(cumulativeMetrics.participantSessionCount)}번
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </section>
      </main>
    </>
  );
}
