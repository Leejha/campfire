import type { CumulativeMetrics } from "~/lib/notion";

import type { GroupReflectionText } from "../models.ts";

const KOREAN_NUMBER_FORMATTER = new Intl.NumberFormat("ko-KR");

interface FormatGroupReflectionOptions {
  cumulativeMetrics: CumulativeMetrics;
}

export function formatGroupReflection({
  cumulativeMetrics,
}: Readonly<FormatGroupReflectionOptions>): GroupReflectionText {
  const sessionCount = KOREAN_NUMBER_FORMATTER.format(cumulativeMetrics.sessionCount);
  const completedTaskCount = KOREAN_NUMBER_FORMATTER.format(cumulativeMetrics.completedTaskCount);
  const participantSessionCount = KOREAN_NUMBER_FORMATTER.format(
    cumulativeMetrics.participantSessionCount,
  );

  return {
    inAppText: `함께 ${sessionCount}번의 세션을 이어오며 Task ${completedTaskCount}개를 완료했고, ${participantSessionCount}번 함께 참여했어요.`,
    shareText: `**함께 이어온 기록**\n총 세션 ${sessionCount}회 · 완료한 Task ${completedTaskCount}개 · 함께한 참여 ${participantSessionCount}번`,
  };
}
