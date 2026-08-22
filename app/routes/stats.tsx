import type { ReactElement } from "react";
import { CalendarDays, ListChecks, Sparkles, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { env } from "cloudflare:workers";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Divider,
  StatusBadge,
} from "~/components";
import { getCampfireDashboard } from "~/lib/notion";
import type { CampfireDashboard, CumulativeMetrics } from "~/lib/notion";
import type { Route } from "./+types/stats";

const KOREAN_NUMBER_FORMATTER = new Intl.NumberFormat("ko-KR");

interface StatsLoaderData {
  dashboard: CampfireDashboard;
}

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  unit: string;
  description: string;
}

interface GroupMilestone {
  metric: keyof CumulativeMetrics;
  label: string;
  threshold: number;
}

const GROUP_MILESTONES: readonly GroupMilestone[] = [
  { metric: "sessionCount", label: "세션 50회", threshold: 50 },
  { metric: "completedTaskCount", label: "완료 Task 400개", threshold: 400 },
  { metric: "participantSessionCount", label: "함께한 참여 200번", threshold: 200 },
];

export async function loader(): Promise<StatsLoaderData> {
  const dashboard = await getCampfireDashboard(env);

  return { dashboard };
}

function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  description,
}: Readonly<MetricCardProps>): ReactElement {
  return (
    <li>
      <Card className="h-full">
        <CardHeader className="gap-4">
          <div className="flex items-center gap-3 text-primary">
            <Icon aria-hidden="true" className="size-5" />
            <CardTitle>
              <h3 className="text-base font-semibold">{label}</h3>
            </CardTitle>
          </div>
          <Divider />
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
            {KOREAN_NUMBER_FORMATTER.format(value)}{unit}
          </p>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </li>
  );
}

function ReachedMilestoneCard({ label }: Readonly<Pick<GroupMilestone, "label">>): ReactElement {
  return (
    <li>
      <Card className="h-full">
        <CardHeader className="gap-4">
          <div className="flex items-center gap-3">
            <Sparkles aria-hidden="true" className="size-5 shrink-0 text-primary" />
            <StatusBadge tone="success">달성</StatusBadge>
          </div>
          <Divider />
        </CardHeader>
        <CardContent>
          <h3 className="font-semibold">{label}를 함께 달성했어요.</h3>
        </CardContent>
      </Card>
    </li>
  );
}

export default function Stats({ loaderData }: Route.ComponentProps): ReactElement {
  const { cumulativeMetrics } = loaderData.dashboard;
  const reachedMilestones = GROUP_MILESTONES.filter(
    (milestone) => cumulativeMetrics[milestone.metric] >= milestone.threshold,
  );

  return (
    <>
      <title>Campfire | 우리 기록</title>
      <meta name="description" content="함께 쌓은 모각코 기록을 확인해요." />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto grid min-h-svh w-full max-w-6xl gap-12 px-4 py-8 sm:px-6 sm:py-12"
      >
        <header className="grid gap-6">
          <CalendarDays aria-hidden="true" className="size-5 text-primary" />
          <div className="grid gap-3">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              우리 기록
            </h1>
            <p className="text-lg leading-7 text-muted-foreground">
              지금까지 이어온 세션과 Task를 모아봤어요.
            </p>
          </div>
          <Divider />
        </header>

        <section className="grid gap-6" aria-labelledby="stats-title">
          <h2 id="stats-title" className="text-2xl font-semibold tracking-tight">
            누적 현황
          </h2>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              description="함께 모인 세션을 모두 더했어요."
              icon={CalendarDays}
              label="총 세션"
              unit="회"
              value={cumulativeMetrics.sessionCount}
            />
            <MetricCard
              description="완료로 체크한 Task를 모두 더했어요."
              icon={ListChecks}
              label="완료한 Task"
              unit="개"
              value={cumulativeMetrics.completedTaskCount}
            />
            <MetricCard
              description="세션마다 함께한 참여를 모두 더했어요."
              icon={UsersRound}
              label="함께한 참여"
              unit="번"
              value={cumulativeMetrics.participantSessionCount}
            />
          </ul>
        </section>

        {reachedMilestones.length > 0 ? (
          <section className="grid gap-6" aria-labelledby="milestones-title">
            <h2 id="milestones-title" className="text-2xl font-semibold tracking-tight">
              달성한 이정표
            </h2>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reachedMilestones.map((milestone) => (
                <ReachedMilestoneCard key={milestone.metric} label={milestone.label} />
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </>
  );
}
