import type { ReactElement } from "react";
import { env } from "cloudflare:workers";

import {
  getKoreaDate,
  getStudySessionTimeline,
  NOTION_SESSION_REFETCH_INTERVAL_MS,
  parseStudySessionDraft,
  StudySessionScreen,
  type StudySessionViewData,
} from "~/features/study-session";
import {
  getStudySession,
  saveStudySession,
} from "~/features/study-session/server-index";
import { getSessionForDate, NotionRateLimitError } from "~/lib/notion";
import { getQueryClient } from "~/lib/get-query-client";
import { getSessionForDateQueryOptions } from "~/features/notion-data";

import type { Route } from "./+types/session";

interface SessionActionData {
  error: string;
}

function getActionError({ value }: Readonly<{ value: FormDataEntryValue | null }>): string {
  if (typeof value !== "string" || value.length === 0) return "회차 정보를 다시 확인해 주세요.";
  return "";
}

function parseDraft({ value }: Readonly<{ value: string }>): unknown {
  try {
    return JSON.parse(value);
  } catch (error: unknown) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

export async function loader(): Promise<{
  data: StudySessionViewData;
  today: string;
}> {
  const now = Date.now();
  const today = getKoreaDate({ timestamp: now });
  const session = await getStudySession({ database: env.DB });
  const timeline = session === null ? null : getStudySessionTimeline({ session, timestamp: now });

  return {
    data: { session, timeline, loadedAt: new Date(now).toISOString() },
    today,
  };
}

export async function clientLoader({
  serverLoader,
}: Route.ClientLoaderArgs): Promise<Awaited<ReturnType<typeof loader>>> {
  const loaderData = await serverLoader();
  const timeline = loaderData.data.timeline;
  const session = loaderData.data.session;
  const isInitialTaskStage = timeline?.status === "active" && timeline.currentStage?.stage.kind === "task";
  const shouldPrefetchNotionSession = session !== null && (isInitialTaskStage || timeline?.status === "completed");

  if (shouldPrefetchNotionSession) {
    await getQueryClient().ensureQueryData(getSessionForDateQueryOptions({
      date: session.scheduledDate,
      refetchInterval: NOTION_SESSION_REFETCH_INTERVAL_MS,
    }));
  }

  return loaderData;
}

clientLoader.hydrate = true as const;

export async function action({ request }: Route.ActionArgs): Promise<SessionActionData> {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const draftValue = formData.get("draft");
  const valueError = getActionError({ value: draftValue });

  if (intent !== "save-session" || valueError) return { error: valueError || "요청을 다시 확인해 주세요." };
  if (typeof draftValue !== "string") return { error: "회차 정보를 다시 확인해 주세요." };

  const draft = parseDraft({ value: draftValue });
  if (draft === null) return { error: "회차 정보를 다시 확인해 주세요." };

  try {
    const parsedDraft = parseStudySessionDraft({ draft });
    const sessionLookup = await getSessionForDate({ env, date: parsedDraft.scheduledDate });

    if (sessionLookup.status === "none") {
      return { error: "예약 날짜와 같은 Notion 회차가 없어요. 회차를 준비한 뒤 저장해 주세요." };
    }

    if (sessionLookup.status === "duplicate") {
      return { error: "예약 날짜와 같은 Notion 회차가 여러 개예요. 한 개만 남긴 뒤 저장해 주세요." };
    }

    await saveStudySession({ database: env.DB, draft, now: Date.now() });
    return { error: "" };
  } catch (error: unknown) {
    if (error instanceof NotionRateLimitError) {
      return { error: `Notion 요청이 잠시 많아요. ${error.retryAfterSeconds}초 후 다시 저장해 주세요.` };
    }
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
}

export function HydrateFallback(): ReactElement {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto grid min-h-svh w-full max-w-3xl place-items-center px-4 py-8 sm:px-6">
      <p aria-live="polite" className="text-lg text-fg-neutral-muted" role="status">모각코 정보를 준비하고 있어요.</p>
    </main>
  );
}

export default function Session({
  actionData,
  loaderData,
}: Route.ComponentProps): ReactElement {
  const actionError = actionData?.error ?? "";

  return (
    <>
      <title>모닥불 | 모각코</title>
      <meta name="description" content="모각코 타임테이블과 현재 Task 진행을 함께 확인해요." />
      <StudySessionScreen
        key={loaderData.data.session?.createdAt ?? "new-study-session"}
        actionError={actionError}
        data={loaderData.data}
        today={loaderData.today}
      />
    </>
  );
}
