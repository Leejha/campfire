import type { ReactElement } from "react";
import { Suspense, useRef, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Bell, CheckCircle2, ListChecks, Maximize2, Minimize2, X } from "lucide-react";

import { Button, Card, CardContent, CardHeader, CardTitle, Divider, StatusBadge } from "~/components";
import { getSessionForDateQueryOptions } from "~/features/notion-data";
import type { SessionParticipant } from "~/lib/notion";

import { createDefaultStudySessionStages } from "../_lib/study-session-template";
import { getStudySessionTimeline } from "../_lib/study-session-timeline";
import { NOTION_SESSION_REFETCH_INTERVAL_MS } from "../_lib/notion-refresh";
import type { StudySessionScheduledStage } from "../models";

import { StudySessionBlockList } from "./StudySessionBlockList";
import { StudySessionFullscreen } from "./StudySessionFullscreen";
import type { StudySessionFullscreenRenderProps } from "./StudySessionFullscreen";
import { StudySessionSetup } from "./StudySessionSetup";
import { StudySessionTaskBlockList } from "./StudySessionTaskBlockList";
import { TaskCompetitionBoard } from "./TaskCompetitionBoard";
import { useStudySessionAlerts } from "./useStudySessionAlerts";
import { useStudySessionClock } from "./useStudySessionClock";
import { useStudySessionAutoRefresh } from "./useStudySessionAutoRefresh";
import type { StudySessionAlerts } from "./useStudySessionAlerts";
import type { StudySessionViewData } from "./viewModels";

interface StudySessionScreenProps {
  actionError: string;
  data: StudySessionViewData;
  today: string;
}

interface ScheduleListProps {
  currentStageId: string | null;
  stages: readonly StudySessionScheduledStage[];
}

interface CurrentStageTimerProps {
  currentStage: StudySessionScheduledStage;
  remainingTime: number;
  onOpenSchedule: () => void;
}

const KOREAN_TIME_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Seoul",
});

const KOREAN_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

function formatCountdown({ milliseconds }: Readonly<{ milliseconds: number }>): string {
  const totalSeconds = Math.max(Math.ceil(milliseconds / 1_000), 0);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");

  return hours > 0 ? `${hours}:${paddedMinutes}:${paddedSeconds}` : `${paddedMinutes}:${paddedSeconds}`;
}

function formatScheduleTime({ timestamp }: Readonly<{ timestamp: number }>): string {
  return KOREAN_TIME_FORMATTER.format(new Date(timestamp));
}

function formatDuration({ minutes }: Readonly<{ minutes: number }>): string {
  return `${minutes}분`;
}

function ScheduleList({ currentStageId, stages }: Readonly<ScheduleListProps>): ReactElement {
  return (
    <ol className="grid gap-2">
      {stages.map((scheduledStage) => {
        const isCurrentStage = scheduledStage.stage.id === currentStageId;

        return (
          <li
            key={scheduledStage.stage.id}
            className={isCurrentStage ? "rounded-r2 border border-stroke-brand-solid bg-bg-brand-weak p-3" : "rounded-r2 border border-stroke-neutral-subtle p-3"}
          >
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <p className="font-semibold">{scheduledStage.stage.title}</p>
              <p className="text-sm font-medium tabular-nums text-fg-neutral-muted">
                <time dateTime={new Date(scheduledStage.startAt).toISOString()}>{formatScheduleTime({ timestamp: scheduledStage.startAt })}</time>
                {" ~ "}
                <time dateTime={new Date(scheduledStage.endAt).toISOString()}>{formatScheduleTime({ timestamp: scheduledStage.endAt })}</time>
                {" · "}{formatDuration({ minutes: scheduledStage.stage.minutes })}
              </p>
            </div>
            <p className="mt-1 text-sm leading-6 text-fg-neutral-muted">{scheduledStage.stage.guide}</p>
          </li>
        );
      })}
    </ol>
  );
}

function NotionSessionFallback(): ReactElement {
  return (
    <Card>
      <CardContent>
        <p aria-live="polite" className="leading-7 text-fg-neutral-muted" role="status">
          Notion Task를 불러오고 있어요.
        </p>
      </CardContent>
    </Card>
  );
}

function CurrentStageTimer({
  currentStage,
  remainingTime,
  onOpenSchedule,
}: Readonly<CurrentStageTimerProps>): ReactElement {
  return (
    <section className="grid gap-6 text-center" aria-labelledby="current-stage-title">
      <div className="grid gap-3">
        <p className="text-sm font-semibold text-fg-brand">현재 단계</p>
        <h1 id="current-stage-title" aria-live="polite" className="text-4xl font-semibold tracking-tight sm:text-5xl">{currentStage.stage.title}</h1>
        <p className="mx-auto max-w-2xl text-lg leading-7 text-fg-neutral-muted">{currentStage.stage.guide}</p>
      </div>
      <time aria-label={`${currentStage.stage.title} 단계 남은 시간 ${formatCountdown({ milliseconds: remainingTime })}`} className="text-7xl font-semibold tracking-tight tabular-nums sm:text-9xl" dateTime={`PT${Math.ceil(remainingTime / 1_000)}S`}>
        {formatCountdown({ milliseconds: remainingTime })}
      </time>
      <div><Button type="button" variant="outline" onClick={onOpenSchedule}>전체 일정 보기</Button></div>
    </section>
  );
}

function ActiveStudySession({
  alerts,
  data,
  isFullscreen,
  now,
  toggleFullscreen,
}: Readonly<{
  alerts: StudySessionAlerts;
  data: StudySessionViewData;
  isFullscreen: boolean;
  now: number;
  toggleFullscreen: () => Promise<void>;
}>): ReactElement {
  const scheduleDialogReference = useRef<HTMLDialogElement>(null);
  const timeline = data.timeline;

  if (timeline === null || timeline.currentStage === null) {
    throw new Error("진행 중인 스터디 단계가 없어요.");
  }

  const currentStage = timeline.currentStage;
  const remainingTime = Math.max(currentStage.endAt - now, 0);
  const taskNumber = currentStage.stage.kind === "task" ? currentStage.stage.taskNumber : null;
  const isTaskStage = taskNumber !== null && data.session !== null;
  const activeMainClassName = isFullscreen
    ? "mx-auto grid min-h-svh w-full max-w-7xl gap-10 px-4 py-8 sm:px-6 sm:py-12"
    : "mx-auto grid min-h-svh w-full max-w-6xl gap-10 px-4 py-8 sm:px-6 sm:py-12";
  const taskLayoutClassName = isFullscreen
    ? "grid items-start gap-6 lg:grid-cols-[minmax(24rem,1fr)_minmax(0,3fr)]"
    : "grid items-start gap-6 lg:grid-cols-3";
  const taskBoardColumnClassName = isFullscreen ? "lg:col-span-1" : "lg:col-span-2";
  const taskParticipants = taskNumber === null || data.session === null ? null : (
    <Suspense fallback={<NotionSessionFallback />}>
      <TaskCompetitionBoard date={data.session.scheduledDate} isExpanded={isFullscreen} taskNumber={taskNumber} />
    </Suspense>
  );
  const openScheduleDialog = (): void => scheduleDialogReference.current?.showModal();
  const currentStageTimer = (
    <CurrentStageTimer
      currentStage={currentStage}
      remainingTime={remainingTime}
      onOpenSchedule={openScheduleDialog}
    />
  );

  return (
    <main id="main-content" tabIndex={-1} className={activeMainClassName}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatusBadge tone="accent">진행 중</StatusBadge>
          <p className="text-sm font-medium text-fg-neutral-muted">{KOREAN_DATE_TIME_FORMATTER.format(new Date(timeline.startsAt))} 시작</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => void alerts.enableAlerts()}>
            <Bell aria-hidden="true" />
            {alerts.isEnabled ? "알림이 켜졌어요" : "알림 켜기"}
          </Button>
          <Button type="button" variant="outline" onClick={() => void toggleFullscreen()}>
            {isFullscreen ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
            {isFullscreen ? "전체화면 종료" : "전체화면"}
          </Button>
        </div>
      </header>

      {isTaskStage ? (
        <div className={taskLayoutClassName}>
          <div className="lg:sticky lg:top-6 lg:self-start">{currentStageTimer}</div>
          <div className={taskBoardColumnClassName}>{taskParticipants}</div>
        </div>
      ) : currentStageTimer}

      {alerts.announcement ? (
        <p aria-live="polite" className="rounded-r2 border border-stroke-brand-solid bg-bg-brand-weak p-4 text-center font-semibold text-fg-brand animate-pulse motion-reduce:animate-none" role="status">
          {alerts.announcement}
        </p>
      ) : null}
      <dialog ref={scheduleDialogReference} aria-labelledby="schedule-dialog-title" className="m-auto w-11/12 max-w-2xl rounded-r3 border border-stroke-neutral-weak bg-bg-layer-floating p-0 text-fg-neutral shadow-s3 backdrop:bg-bg-overlay-muted">
        <div className="grid max-h-svh gap-5 overflow-y-auto p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 id="schedule-dialog-title" className="text-2xl font-semibold tracking-tight">전체 일정</h2>
            <form method="dialog"><Button aria-label="전체 일정 닫기" size="icon" type="submit" variant="ghost"><X aria-hidden="true" /></Button></form>
          </div>
          <ScheduleList currentStageId={currentStage.stage.id} stages={timeline.stages} />
        </div>
      </dialog>
    </main>
  );
}

function PrestartStudySession({
  actionError,
  alerts,
  data,
  now,
  today,
}: Readonly<{ actionError: string; alerts: StudySessionAlerts; data: StudySessionViewData; now: number; today: string }>): ReactElement {
  const scheduleDialogReference = useRef<HTMLDialogElement>(null);
  const timeline = data.timeline;

  if (data.session === null || timeline === null) throw new Error("예약된 스터디를 찾을 수 없어요.");

  const timeUntilStart = Math.max(timeline.startsAt - now, 0);
  const setupNotice = actionError;
  const openScheduleDialog = (): void => scheduleDialogReference.current?.showModal();

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto grid min-h-svh w-full max-w-6xl gap-10 px-4 py-8 sm:px-6 sm:py-12">
      <header className="grid gap-3 text-center">
        <StatusBadge tone="primary" className="justify-self-center">시작 전</StatusBadge>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">스터디 시작까지</h1>
        <time aria-label={`스터디 시작까지 ${formatCountdown({ milliseconds: timeUntilStart })}`} className="text-7xl font-semibold tracking-tight tabular-nums sm:text-9xl" dateTime={`PT${Math.ceil(timeUntilStart / 1_000)}S`}>
          {formatCountdown({ milliseconds: timeUntilStart })}
        </time>
        <p className="text-lg leading-7 text-fg-neutral-muted"><time dateTime={new Date(timeline.startsAt).toISOString()}>{KOREAN_DATE_TIME_FORMATTER.format(new Date(timeline.startsAt))}</time>에 자동으로 시작해요.</p>
        <div><Button type="button" variant="outline" onClick={() => void alerts.enableAlerts()}><Bell aria-hidden="true" />{alerts.isEnabled ? "알림이 켜졌어요" : "알림 켜기"}</Button></div>
      </header>

      <div className="text-center"><Button type="button" variant="outline" onClick={openScheduleDialog}>전체 일정 보기</Button></div>

      <details className="rounded-r3 border border-stroke-neutral-subtle bg-bg-layer-default p-5 shadow-s1">
        <summary className="cursor-pointer text-lg font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stroke-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-layer-default">시작 전 일정 수정</summary>
        <div className="mt-6"><StudySessionSetup key={data.session.updatedAt} canSave={true} draft={data.session} notice={setupNotice} showIntro={false} today={today} /></div>
      </details>

      <dialog ref={scheduleDialogReference} aria-labelledby="prestart-schedule-dialog-title" className="m-auto w-11/12 max-w-2xl rounded-r3 border border-stroke-neutral-weak bg-bg-layer-floating p-0 text-fg-neutral shadow-s3 backdrop:bg-bg-overlay-muted">
        <div className="grid max-h-svh gap-5 overflow-y-auto p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 id="prestart-schedule-dialog-title" className="text-2xl font-semibold tracking-tight">전체 일정</h2>
            <form method="dialog"><Button aria-label="전체 일정 닫기" size="icon" type="submit" variant="ghost"><X aria-hidden="true" /></Button></form>
          </div>
          <ScheduleList currentStageId={null} stages={timeline.stages} />
        </div>
      </dialog>
    </main>
  );
}

function ParticipantResult({ participant }: Readonly<{ participant: SessionParticipant }>): ReactElement {
  return (
    <li>
      <Card className="h-full">
        <CardHeader><CardTitle><h3 className="text-xl font-semibold">{participant.name}</h3></CardTitle></CardHeader>
        <CardContent className="grid gap-6">
          <section className="grid gap-4" aria-label={`${participant.name}님의 Task 결과`}>
            <h4 className="font-semibold">Task 결과</h4>
            {participant.taskGroups.length === 0 ? <p className="leading-7 text-fg-neutral-muted">작성된 Task가 없어요.</p> : participant.taskGroups.map((taskGroup) => (
              <div key={taskGroup.number} className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><h5 className="font-semibold">Task {taskGroup.number}</h5><p className="text-sm text-fg-neutral-muted">{taskGroup.tasksDone} / {taskGroup.tasksTotal}개 완료</p></div>
                <StudySessionTaskBlockList blocks={taskGroup.blocks} />
              </div>
            ))}
          </section>
          <Divider />
          <section className="grid gap-4" aria-label={`${participant.name}님의 회고`}>
            <h4 className="font-semibold">회고</h4>
            {participant.reflection === null ? <p className="leading-7 text-fg-neutral-muted">작성된 회고가 없어요.</p> : <StudySessionBlockList blocks={participant.reflection.blocks} />}
          </section>
        </CardContent>
      </Card>
    </li>
  );
}

function CompletedSessionResults({ date }: Readonly<{ date: string }>): ReactElement {
  const { data: sessionLookup } = useSuspenseQuery(getSessionForDateQueryOptions({
    date,
    refetchInterval: NOTION_SESSION_REFETCH_INTERVAL_MS,
  }));
  const participants = sessionLookup.status === "found" ? sessionLookup.session.participants : [];
  const unavailableMessage = sessionLookup.status === "none"
    ? "예약 날짜와 같은 Notion 회차가 없어요."
    : "예약 날짜와 같은 Notion 회차가 여러 개예요.";

  if (sessionLookup.status !== "found") {
    return <Card><CardContent><p className="leading-7 text-fg-neutral-muted">{unavailableMessage}</p></CardContent></Card>;
  }

  if (participants.length === 0) {
    return <Card><CardContent><p className="leading-7 text-fg-neutral-muted">참여자 정보를 기다리고 있어요.</p></CardContent></Card>;
  }

  return <ul className="grid gap-4 md:grid-cols-2">{participants.map((participant) => <ParticipantResult key={participant.id} participant={participant} />)}</ul>;
}

function CompletedStudySession({
  alerts,
  data,
  isFullscreen,
  onReserveNextStudySession,
  toggleFullscreen,
}: Readonly<{
  alerts: StudySessionAlerts;
  data: StudySessionViewData;
  isFullscreen: boolean;
  onReserveNextStudySession: () => void;
  toggleFullscreen: () => Promise<void>;
}>): ReactElement {
  if (data.session === null) throw new Error("종료된 스터디 정보를 찾을 수 없어요.");

  const endsAt = data.timeline?.endsAt;
  const completionTime = endsAt === undefined ? "" : KOREAN_DATE_TIME_FORMATTER.format(new Date(endsAt));

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto grid min-h-svh w-full max-w-6xl gap-10 px-4 py-8 sm:px-6 sm:py-12">
      <header className="grid gap-4 text-center">
        <CheckCircle2 aria-hidden="true" className="mx-auto size-10 text-fg-positive" />
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">오늘의 스터디를 마쳤어요</h1>
        <p className="text-lg leading-7 text-fg-neutral-muted">{completionTime}에 마무리했어요. 오늘 남긴 Task와 회고를 돌아봐요.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={onReserveNextStudySession}>다음 모각코 예약</Button>
          {isFullscreen ? (
            <Button type="button" variant="outline" onClick={() => void toggleFullscreen()}>
              <Minimize2 aria-hidden="true" />
              전체화면 종료
            </Button>
          ) : null}
        </div>
      </header>
      {alerts.announcement ? (
        <p aria-live="polite" className="rounded-r2 border border-stroke-brand-solid bg-bg-brand-weak p-4 text-center font-semibold text-fg-brand animate-pulse motion-reduce:animate-none" role="status">
          {alerts.announcement}
        </p>
      ) : null}
      <section className="grid gap-5" aria-labelledby="results-title">
        <div className="flex flex-wrap items-center gap-3"><ListChecks aria-hidden="true" className="size-5 text-fg-brand" /><h2 id="results-title" className="text-2xl font-semibold tracking-tight">참여자별 결과</h2></div>
        <Suspense fallback={<NotionSessionFallback />}>
          <CompletedSessionResults date={data.session.scheduledDate} />
        </Suspense>
      </section>
    </main>
  );
}

function EmptyStudySession({ actionError, data, today }: Readonly<StudySessionScreenProps>): ReactElement {
  const defaultDraft = { scheduledDate: today, scheduledTime: "14:30", stages: createDefaultStudySessionStages() };

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto grid min-h-svh w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <StudySessionSetup canSave={true} draft={defaultDraft} notice={actionError} showIntro={true} today={today} />
    </main>
  );
}

export function StudySessionScreen({ actionError, data, today }: Readonly<StudySessionScreenProps>): ReactElement {
  const [isReservingNextStudySession, setIsReservingNextStudySession] = useState(false);
  const now = useStudySessionClock();
  const clientTimeline = data.session === null ? null : getStudySessionTimeline({ session: data.session, timestamp: now });
  const currentData = { ...data, timeline: clientTimeline };
  const sessionStatus = clientTimeline?.status ?? null;
  const alerts = useStudySessionAlerts({ now, timeline: clientTimeline });
  useStudySessionAutoRefresh({ status: sessionStatus });

  const renderStudySession = ({
    isFullscreen,
    toggleFullscreen,
  }: Readonly<StudySessionFullscreenRenderProps>): ReactElement => {
    if (isReservingNextStudySession) {
      return (
        <main id="main-content" tabIndex={-1} className="mx-auto grid min-h-svh w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 sm:py-12">
          <StudySessionSetup
            canSave={true}
            draft={{ scheduledDate: today, scheduledTime: "14:30", stages: createDefaultStudySessionStages() }}
            notice={actionError}
            showIntro={true}
            today={today}
          />
        </main>
      );
    }

    if (currentData.session === null || currentData.timeline === null) {
      return <EmptyStudySession actionError={actionError} data={currentData} today={today} />;
    }
    if (currentData.timeline.status === "prestart") {
      return <PrestartStudySession actionError={actionError} alerts={alerts} data={currentData} now={now} today={today} />;
    }
    if (currentData.timeline.status === "active") {
      return <ActiveStudySession alerts={alerts} data={currentData} isFullscreen={isFullscreen} now={now} toggleFullscreen={toggleFullscreen} />;
    }
    return (
      <CompletedStudySession
        alerts={alerts}
        data={currentData}
        isFullscreen={isFullscreen}
        onReserveNextStudySession={() => setIsReservingNextStudySession(true)}
        toggleFullscreen={toggleFullscreen}
      />
    );
  };

  return <StudySessionFullscreen>{renderStudySession}</StudySessionFullscreen>;
}
