import type { ReactElement } from "react";
import { Form, useSearchParams } from "react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarDays, Flame, ListChecks, Sparkles, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  Button,
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
import type { CampfireDashboard, PersonalCumulativeRecord } from "~/lib/notion";
import { getPersonalFlameGrowth } from "./stats/gamification";
import type { PersonalFlameGrowth, RecordMetric, StageProgress } from "./stats/gamification";

const KOREAN_NUMBER_FORMATTER = new Intl.NumberFormat("ko-KR");

interface AchievementMetric {
  metric: RecordMetric;
  icon: LucideIcon;
  label: string;
  unit: string;
  description: string;
}

interface MetricCardProps {
  achievement: AchievementMetric;
  value: number;
}

interface AchievementSectionProps {
  record: PersonalCumulativeRecord;
}

interface MemberSelectorProps {
  records: PersonalCumulativeRecord[];
  selectedName: string;
  hasInvalidSelection: boolean;
}

const ACHIEVEMENT_METRICS: readonly AchievementMetric[] = [
  {
    metric: "participatedSessionCount",
    icon: CalendarDays,
    label: "참여한 세션",
    unit: "회",
    description: "내 이름으로 기록을 남긴 세션을 모두 더했어요.",
  },
  {
    metric: "completedTaskCount",
    icon: ListChecks,
    label: "완료한 Task",
    unit: "개",
    description: "노션에 완료한 것으로 기록한 내 Task를 모두 더했어요.",
  },
];

export async function clientLoader(): Promise<CampfireDashboard> {
  const queryClient = getQueryClient();
  return queryClient.ensureQueryData(
    getCampfireDashboardQueryOptions({ refetchInterval: false }),
  );
}

clientLoader.hydrate = true as const;

export function HydrateFallback(): ReactElement {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex min-h-svh w-full max-w-6xl items-center px-x4 py-x8 sm:px-x6 sm:py-x12"
    >
      <p className="t5-regular text-fg-neutral-muted" role="status">
        내 기록을 불러오고 있어요.
      </p>
    </main>
  );
}

function AchievementHero(): ReactElement {
  return (
    <header className="grid gap-x6 rounded-r4 bg-bg-brand-weak p-x6 sm:p-x8 lg:grid-cols-3 lg:items-center lg:p-x10">
      <div className="grid gap-x4 lg:col-span-2">
        <p className="flex items-center gap-x2 t3-bold text-fg-brand-contrast">
          <Flame aria-hidden="true" className="size-x5" />
          모닥불 · 내 기록
        </p>
        <h1 className="t8-bold tracking-tight text-balance sm:t10-bold">
          내가 쌓아온 기록
        </h1>
        <p className="t5-regular text-fg-neutral-muted">
          한 번의 참여, 하나의 완료가 차곡차곡 쌓여요.
        </p>
      </div>
      <div className="grid gap-x2 border-t border-stroke-brand-weak pt-x6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-x8">
        <Sparkles aria-hidden="true" className="size-x6 text-fg-brand-contrast" />
        <p className="t5-bold">돌아오면, 여기서 이어가요.</p>
        <p className="t3-regular text-fg-neutral-muted">
          쉬어 가도 쌓아온 기록은 그대로예요.
        </p>
      </div>
    </header>
  );
}

function MemberSelector({ records, selectedName, hasInvalidSelection }: Readonly<MemberSelectorProps>): ReactElement {
  const helpText = hasInvalidSelection
    ? "이 이름의 기록을 찾지 못했어요. 목록에서 내 이름을 다시 선택해 주세요."
    : "노션에 기록한 이름을 선택하면 내 성취를 볼 수 있어요.";
  return (
    <section className="grid gap-x4" aria-labelledby="member-selector-title">
      <h2 id="member-selector-title" className="t6-bold">내 기록을 찾아봐요</h2>
      <Form method="get" action="/stats" className="grid gap-x3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="grid min-w-0 gap-x2">
          <label htmlFor="member-name" className="t4-bold">내 이름</label>
          <select
            key={selectedName}
            id="member-name"
            name="member"
            defaultValue={hasInvalidSelection ? "" : selectedName}
            required
            disabled={records.length === 0}
            aria-invalid={hasInvalidSelection}
            aria-describedby="member-selection-help"
            className="min-h-x12 w-full min-w-0 rounded-r2 border border-stroke-neutral-muted bg-bg-layer-default px-x4 t4-regular text-fg-neutral focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring"
          >
            <option value="" disabled>이름을 선택해 주세요</option>
            {records.map(({ displayName }) => <option key={displayName} value={displayName}>{displayName}</option>)}
          </select>
        </div>
        <Button type="submit" disabled={records.length === 0} className="min-h-x12 px-x6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring">
          내 기록 보기
        </Button>
      </Form>
      <p id="member-selection-help" className="t3-regular text-fg-neutral-muted" role="status">
        {records.length === 0 ? "첫 세션에 이름을 남기면 여기서 내 기록을 볼 수 있어요." : helpText}
      </p>
    </section>
  );
}

function MetricCard({ achievement, value }: Readonly<MetricCardProps>): ReactElement {
  const { icon: Icon, label, unit, description } = achievement;
  return (
    <li className="min-w-0">
      <Card className="h-full py-x6">
        <CardContent className="grid gap-x5 px-x6">
          <dl className="grid gap-x5">
            <dt className="flex items-center gap-x3 t4-medium text-fg-neutral-muted">
              <span className="grid size-x10 shrink-0 place-items-center rounded-r2 bg-bg-brand-weak text-fg-brand-contrast">
                <Icon aria-hidden="true" className="size-x5" />
              </span>
              {label}
            </dt>
            <dd className="flex flex-wrap items-baseline gap-x2">
              <span className="min-w-0 break-all t10-bold tracking-tight tabular-nums">
                {KOREAN_NUMBER_FORMATTER.format(value)}
              </span>
              <span className="t5-medium text-fg-neutral-muted">{unit}</span>
            </dd>
          </dl>
          <Divider />
          <p className="t3-regular text-fg-neutral-muted">{description}</p>
        </CardContent>
      </Card>
    </li>
  );
}

function CumulativeAchievements({ record }: Readonly<AchievementSectionProps>): ReactElement {
  return (
    <section className="grid gap-x5" aria-labelledby="stats-title">
      <div className="flex flex-wrap items-center justify-between gap-x3">
        <h2 id="stats-title" className="min-w-0 break-words t7-bold tracking-tight">{record.displayName}님이 쌓은 성취</h2>
        <StatusBadge tone="neutral">내 전체 기록</StatusBadge>
      </div>
      <ul className="grid grid-cols-1 gap-x4 md:grid-cols-2">
        {ACHIEVEMENT_METRICS.map((achievement) => (
          <MetricCard key={achievement.metric} achievement={achievement} value={record[achievement.metric]} />
        ))}
      </ul>
      {record.completedTaskCount === 0 && (
        <p className="rounded-r3 bg-bg-brand-weak p-x5 t4-regular">
          참여한 기록부터 차곡차곡 쌓이고 있어요. 첫 Task를 완료하면 이곳에 더해져요.
        </p>
      )}
      <dl className="grid gap-x4 rounded-r3 bg-bg-layer-fill p-x5 sm:grid-cols-2">
        <div className="grid gap-x1">
          <dt className="t3-regular text-fg-neutral-muted">기록을 시작한 날</dt>
          <dd className="t4-bold"><time dateTime={record.firstParticipationDate}>{record.firstParticipationDate}</time></dd>
        </div>
        <div className="grid gap-x1">
          <dt className="t3-regular text-fg-neutral-muted">최근 기록한 날</dt>
          <dd className="t4-bold"><time dateTime={record.latestParticipationDate}>{record.latestParticipationDate}</time></dd>
        </div>
      </dl>
    </section>
  );
}

function FlameStageProgress({ progress }: Readonly<{ progress: StageProgress }>): ReactElement {
  const isSessionMetric = progress.metric === "participatedSessionCount";
  const label = isSessionMetric ? "세션 참여" : "Task 완료";
  const unit = isSessionMetric ? "회" : "개";
  const current = `${KOREAN_NUMBER_FORMATTER.format(progress.current)}${unit}`;
  const target = `${KOREAN_NUMBER_FORMATTER.format(progress.target)}${unit}`;
  const status = progress.remaining === 0
    ? "달성했어요"
    : `${KOREAN_NUMBER_FORMATTER.format(progress.remaining)}${unit} 더하면 달성해요`;
  return (
    <li className="grid min-w-0 gap-x3 rounded-r3 bg-bg-layer-default p-x5">
      <p className="flex flex-wrap items-baseline justify-between gap-x2">
        <span className="t4-bold">{label}</span>
        <span className="t3-regular tabular-nums text-fg-neutral-muted">{current} / {target}</span>
      </p>
      <Progress label={`다음 불꽃까지 ${label}`} value={progress.percent} valueText={`목표 ${target}, 현재 ${current}. ${status}`} />
      <p className="t3-bold text-fg-brand-contrast">{status}</p>
    </li>
  );
}

function PersonalFlameGrowthCard({ growth, record }: Readonly<{ growth: PersonalFlameGrowth; record: PersonalCumulativeRecord }>): ReactElement {
  return (
    <section aria-labelledby="personal-flame-title">
      <Card className="gap-x6 rounded-r4 border-stroke-brand-weak bg-bg-brand-weak py-x6 shadow-none sm:py-x8">
        <CardHeader className="px-x6 sm:px-x8">
          <CardTitle><h2 id="personal-flame-title" className="break-words t5-bold">{record.displayName}님의 모닥불</h2></CardTitle>
          <div className="flex flex-wrap items-center gap-x5">
            <div className="grid size-x16 shrink-0 place-items-center rounded-full bg-bg-layer-default text-fg-brand-contrast">
              <Flame aria-hidden="true" className="size-x10" />
            </div>
            <div className="grid min-w-0 gap-x2">
              <p className="break-words t9-bold tracking-tight sm:t10-bold">{growth.currentStage.name}</p>
              <StatusBadge tone="primary" className="w-fit">{growth.hasEarnedCurrentStage ? "차곡차곡 키웠어요" : "내 기록의 시작"}</StatusBadge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-x5 px-x6 sm:px-x8">
          <p className="t4-regular">
            세션 {KOREAN_NUMBER_FORMATTER.format(record.participatedSessionCount)}회에 참여하고 Task {KOREAN_NUMBER_FORMATTER.format(record.completedTaskCount)}개를 완료했어요.
          </p>
          {growth.nextStage === null ? (
            <div className="grid gap-x2">
              <p className="t5-bold">기록은 계속 쌓여요.</p>
              <p className="t4-regular text-fg-neutral-muted">쌓아온 기록은 다음 참여도 기다리고 있어요.</p>
            </div>
          ) : (
            <div className="grid gap-x4">
              <div className="grid gap-x2">
                <h3 className="t5-bold">다음 불꽃 · {growth.nextStage.name}</h3>
                <p className="t3-regular text-fg-neutral-muted">세션 참여와 Task 완료를 모두 채우면 다음 불꽃으로 자라요.</p>
              </div>
              <ul className="grid gap-x4 sm:grid-cols-2">
                {growth.progress.map((progress) => <FlameStageProgress key={progress.metric} progress={progress} />)}
              </ul>
              <p className="t3-regular text-fg-neutral-muted">내 속도로, 여기서 이어가요.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function EarnedBadgeCollection({ badges }: Readonly<{ badges: PersonalFlameGrowth["earnedBadges"] }>): ReactElement {
  return (
    <section className="grid gap-x5" aria-labelledby="badges-title">
      <div className="grid gap-x2">
        <h2 id="badges-title" className="t7-bold tracking-tight">모아온 배지 · {badges.length}개</h2>
        <p className="t4-regular text-fg-neutral-muted">함께한 순간과 완료한 일이 배지로 남아요.</p>
      </div>
      {badges.length > 0 ? (
        <ul className="grid gap-x4 sm:grid-cols-2 lg:grid-cols-3">
          {badges.map(({ id, name, metric, target }) => {
            const isSessionMetric = metric === "participatedSessionCount";
            const Icon = isSessionMetric ? Flame : ListChecks;
            const condition = isSessionMetric ? `세션 ${target}회 참여` : `Task ${target}개 완료`;
            return (
              <li key={id} className="min-w-0">
                <Card className="h-full py-x5 shadow-none">
                  <CardContent className="flex items-start gap-x3 px-x5">
                    <span className="grid size-x10 shrink-0 place-items-center rounded-r2 bg-bg-brand-weak text-fg-brand-contrast"><Icon aria-hidden="true" className="size-x5" /></span>
                    <div className="grid min-w-0 gap-x2">
                      <h3 className="t4-bold">{name}</h3>
                      <p className="t3-regular text-fg-neutral-muted">{condition}</p>
                      <StatusBadge tone="success" className="w-fit">달성했어요</StatusBadge>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex items-start gap-x3 rounded-r3 bg-bg-layer-fill p-x6">
          <Sparkles aria-hidden="true" className="size-x5 shrink-0 text-fg-brand-contrast" />
          <div className="grid gap-x2">
            <p className="t4-bold">내 배지가 모일 자리예요.</p>
            <p className="t3-regular text-fg-neutral-muted">
              한 번의 참여부터 배지로 남아요. 편한 때에 함께해요.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function PersonalRecord({ record }: Readonly<AchievementSectionProps>): ReactElement {
  const growth = getPersonalFlameGrowth({ record });
  return (
    <>
      <PersonalFlameGrowthCard growth={growth} record={record} />
      <CumulativeAchievements record={record} />
      <EarnedBadgeCollection badges={growth.earnedBadges} />
    </>
  );
}

export default function Stats(): ReactElement {
  const { data: dashboard } = useSuspenseQuery(
    getCampfireDashboardQueryOptions({ refetchInterval: false }),
  );
  const [searchParams] = useSearchParams();
  const selectedName = searchParams.get("member") ?? "";
  const record = dashboard.personalCumulativeRecords.find(({ displayName }) => displayName === selectedName);
  const hasInvalidSelection = selectedName !== "" && record === undefined;
  return (
    <>
      <title>모닥불 | 내 기록</title>
      <meta name="description" content="내가 키운 불꽃과 차곡차곡 모아온 배지를 확인해요." />
      <main id="main-content" tabIndex={-1} className="mx-auto grid min-h-svh w-full max-w-6xl content-start gap-x10 px-x4 py-x8 sm:gap-x12 sm:px-x6 sm:py-x12">
        <AchievementHero />
        <MemberSelector records={dashboard.personalCumulativeRecords} selectedName={selectedName} hasInvalidSelection={hasInvalidSelection} />
        {record !== undefined && <PersonalRecord record={record} />}
        <p className="flex items-center gap-x2 t4-regular text-fg-neutral-muted">
          <UsersRound aria-hidden="true" className="size-x5 shrink-0" />
          이번 세션에 {KOREAN_NUMBER_FORMATTER.format(dashboard.session.participants.length)}명이 함께해요.
        </p>
      </main>
    </>
  );
}
