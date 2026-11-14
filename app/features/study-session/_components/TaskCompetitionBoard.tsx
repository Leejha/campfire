import type { ReactElement } from "react";
import { memo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle, Progress, StatusBadge } from "~/components";
import { getSessionForDateQueryOptions } from "~/features/notion-data";
import { NOTION_SESSION_REFETCH_INTERVAL_MS, getTeamTaskProgress } from "~/features/study-session/_lib";
import type {
  ParticipantTaskContribution,
  ParticipantTaskProgress,
  TaskCompetitionStatus,
  TaskProgressSummary,
} from "~/features/study-session/_lib";
import type { SessionParticipant, SessionTaskGroup } from "~/lib/notion";

import { StudySessionTaskBlockList } from "./StudySessionTaskBlockList";
import { useParticipantReorderAnimation } from "./useParticipantReorderAnimation";

const PARTICIPANT_COLOR_CLASS_NAMES: readonly string[] = [
  "bg-participant-1",
  "bg-participant-2",
  "bg-participant-3",
  "bg-participant-4",
  "bg-participant-5",
  "bg-participant-6",
  "bg-participant-7",
];

const PARTICIPANT_PROGRESS_INDICATOR_CLASS_NAMES: readonly string[] = [
  "[&_[data-slot=progress-indicator]]:bg-participant-1",
  "[&_[data-slot=progress-indicator]]:bg-participant-2",
  "[&_[data-slot=progress-indicator]]:bg-participant-3",
  "[&_[data-slot=progress-indicator]]:bg-participant-4",
  "[&_[data-slot=progress-indicator]]:bg-participant-5",
  "[&_[data-slot=progress-indicator]]:bg-participant-6",
  "[&_[data-slot=progress-indicator]]:bg-participant-7",
];

interface TaskCompetitionBoardProps {
  date: string;
  isExpanded: boolean;
  taskNumber: number;
}

interface TeamProgressBarProps {
  contributions: readonly ParticipantTaskContribution[];
  label: string;
  progress: TaskProgressSummary;
  progressKind: "overall" | "current";
}

interface ParticipantTaskCardProps {
  progress: ParticipantTaskProgress;
  taskNumber: number;
  onRegisterElement: (registration: Readonly<{ element: HTMLElement | null; participantId: string }>) => void;
}

interface TaskCompetitionContentProps {
  isExpanded: boolean;
  participants: readonly SessionParticipant[];
  taskNumber: number;
}

interface CompetitionBadgeProps {
  competition: TaskCompetitionStatus;
}

function formatProgressText({ progress }: Readonly<{ progress: TaskProgressSummary }>): string {
  return `${Math.round(progress.percent)}% · ${progress.done}/${progress.total}개 완료`;
}

function getParticipantColorClassName({ colorIndex }: Readonly<{ colorIndex: number }>): string {
  const colorClassName = PARTICIPANT_COLOR_CLASS_NAMES[colorIndex % PARTICIPANT_COLOR_CLASS_NAMES.length];
  return colorClassName ?? PARTICIPANT_COLOR_CLASS_NAMES[0];
}

function getProgressIndicatorClassName({ colorIndex }: Readonly<{ colorIndex: number }>): string {
  const className = PARTICIPANT_PROGRESS_INDICATOR_CLASS_NAMES[colorIndex % PARTICIPANT_PROGRESS_INDICATOR_CLASS_NAMES.length];
  return className ?? PARTICIPANT_PROGRESS_INDICATOR_CLASS_NAMES[0];
}

function findTaskGroup({ participant, taskNumber }: Readonly<{ participant: SessionParticipant; taskNumber: number }>): SessionTaskGroup | null {
  return participant.taskGroups.find((group) => group.number === taskNumber) ?? null;
}

function CompetitionBadge({ competition }: Readonly<CompetitionBadgeProps>): ReactElement | null {
  if (competition === null) return null;

  if (competition === "leader") return <StatusBadge tone="primary">현재 선두</StatusBadge>;
  if (competition === "alongside") return <StatusBadge tone="neutral">선두와 나란히</StatusBadge>;
  if (competition === "chasing") return <StatusBadge tone="neutral">추격 중</StatusBadge>;
  return <StatusBadge tone="success">함께 완료</StatusBadge>;
}

function TeamProgressBar({
  contributions,
  label,
  progress,
  progressKind,
}: Readonly<TeamProgressBarProps>): ReactElement {
  const progressText = formatProgressText({ progress });
  const shouldOutlineEmptyCurrentProgress = progressKind === "current" && progress.done === 0;
  const progressBarClassName = shouldOutlineEmptyCurrentProgress
    ? "flex h-x2_5 w-full overflow-hidden rounded-full bg-bg-neutral-weak ring-1 ring-inset ring-stroke-neutral-solid"
    : "flex h-x2_5 w-full overflow-hidden rounded-full bg-bg-neutral-weak";
  const contributionText = contributions
    .map(({ contribution, participant }) => {
      const contributionPercent = progressKind === "overall"
        ? contribution.overallPercent
        : contribution.currentPercent;

      return `${participant.name}님 ${Math.round(contributionPercent)}% 기여`;
    })
    .join(", ");

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="font-semibold">{label}</p>
        <p className="tabular-nums text-fg-neutral-muted">{progressText}</p>
      </div>
      <div
        aria-label={label}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(progress.percent)}
        aria-valuetext={progressText}
        className={progressBarClassName}
        role="progressbar"
      >
        {contributions.map(({ colorIndex, contribution, participant }) => {
          const contributionPercent = progressKind === "overall"
            ? contribution.overallPercent
            : contribution.currentPercent;

          return (
            <span
              aria-hidden="true"
              key={participant.id}
              className={`${getParticipantColorClassName({ colorIndex })} shrink-0 transition-[width] duration-300 ease-out motion-reduce:transition-none`}
              style={{ width: `${contributionPercent}%` }}
            />
          );
        })}
      </div>
      <p className="sr-only">멤버별 완료 기여: {contributionText}</p>
    </div>
  );
}

function ParticipantTaskCard({
  onRegisterElement,
  progress,
  taskNumber,
}: Readonly<ParticipantTaskCardProps>): ReactElement {
  const participant = progress.participant;
  const taskGroup = findTaskGroup({ participant, taskNumber });
  const colorClassName = getParticipantColorClassName({ colorIndex: progress.colorIndex });
  const overallText = formatProgressText({ progress: progress.overall });
  const currentText = formatProgressText({ progress: progress.current });
  const progressIndicatorClassName = getProgressIndicatorClassName({ colorIndex: progress.colorIndex });
  const isCurrentTaskProgressEmpty = progress.current.done === 0;
  const currentProgressClassName = isCurrentTaskProgressEmpty
    ? `${progressIndicatorClassName} ring-1 ring-inset ring-stroke-neutral-solid`
    : progressIndicatorClassName;

  return (
    <li ref={(element): void => onRegisterElement({ element, participantId: participant.id })}>
      <Card className="h-full">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${colorClassName}`} />
                <h3 className="text-xl font-semibold">{participant.name}</h3>
              </div>
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {progress.hasCurrentTask ? <StatusBadge tone="primary">Task {taskNumber}</StatusBadge> : null}
              <CompetitionBadge competition={progress.competition} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5">
          <section className="grid gap-3" aria-label={`${participant.name}님의 진행률`}>
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <p className="font-medium">전체 작업</p>
                <p className="tabular-nums text-fg-neutral-muted">{overallText}</p>
              </div>
              <Progress className={progressIndicatorClassName} label={`${participant.name}님의 전체 Task 진행률`} value={Math.round(progress.overall.percent)} valueText={overallText} />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <p className="font-medium">현재 Task {taskNumber}</p>
                <p className="tabular-nums text-fg-neutral-muted">{currentText}</p>
              </div>
              <Progress className={currentProgressClassName} label={`${participant.name}님의 Task ${taskNumber} 진행률`} value={Math.round(progress.current.percent)} valueText={currentText} />
            </div>
          </section>
          {taskGroup === null ? <p className="leading-7 text-fg-neutral-muted">작성된 Task가 없어요.</p> : <StudySessionTaskBlockList blocks={taskGroup.blocks} />}
        </CardContent>
      </Card>
    </li>
  );
}

function TaskCompetitionContent({
  isExpanded,
  participants,
  taskNumber,
}: Readonly<TaskCompetitionContentProps>): ReactElement {
  const teamProgress = getTeamTaskProgress({ participants, taskNumber });
  const participantOrderKey = teamProgress.participants.map((progress) => progress.participant.id).join("|");
  const writtenParticipantCount = teamProgress.participants.filter((progress) => progress.hasCurrentTask).length;
  const { registerParticipantElement } = useParticipantReorderAnimation({ participantOrderKey });
  const participantGridClassName = isExpanded
    ? "grid gap-4 md:grid-cols-2 xl:grid-cols-3"
    : "grid gap-4 md:grid-cols-2";

  return (
    <section className="grid gap-5" aria-labelledby="task-participants-title">
      <div className="grid gap-2">
        <h2 id="task-participants-title" className="text-2xl font-semibold tracking-tight">함께 집중하고 있어요</h2>
        <p className="leading-7 text-fg-neutral-muted">Task {taskNumber} 작성 {writtenParticipantCount}/{participants.length}명 · 30초마다 자동 반영</p>
      </div>
      <Card>
        <CardContent className="grid gap-5">
          <TeamProgressBar contributions={teamProgress.contributions} label="팀 전체 진행률" progress={teamProgress.overall} progressKind="overall" />
          <TeamProgressBar contributions={teamProgress.contributions} label={`현재 Task ${taskNumber} 진행률`} progress={teamProgress.current} progressKind="current" />
        </CardContent>
      </Card>
      <ul className={participantGridClassName}>
        {teamProgress.participants.map((progress) => (
          <ParticipantTaskCard key={progress.participant.id} onRegisterElement={registerParticipantElement} progress={progress} taskNumber={taskNumber} />
        ))}
      </ul>
    </section>
  );
}

function TaskCompetitionBoardQuery({ date, isExpanded, taskNumber }: Readonly<TaskCompetitionBoardProps>): ReactElement {
  const { data: sessionLookup } = useSuspenseQuery(getSessionForDateQueryOptions({
    date,
    refetchInterval: NOTION_SESSION_REFETCH_INTERVAL_MS,
  }));

  if (sessionLookup.status === "none") {
    return <Card><CardContent><p className="leading-7 text-fg-neutral-muted">예약 날짜와 같은 Notion 회차가 없어요.</p></CardContent></Card>;
  }

  if (sessionLookup.status === "duplicate") {
    return <Card><CardContent><p className="leading-7 text-fg-neutral-muted">예약 날짜와 같은 Notion 회차가 여러 개예요.</p></CardContent></Card>;
  }

  if (sessionLookup.session.participants.length === 0) {
    return <Card><CardContent><p className="leading-7 text-fg-neutral-muted">참여자 정보를 기다리고 있어요.</p></CardContent></Card>;
  }

  return <TaskCompetitionContent isExpanded={isExpanded} participants={sessionLookup.session.participants} taskNumber={taskNumber} />;
}

export const TaskCompetitionBoard = memo(TaskCompetitionBoardQuery);
