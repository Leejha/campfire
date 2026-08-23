import assert from "node:assert/strict";
import test from "node:test";

import { copyGroupReflectionText } from "../app/features/group-reflection/_lib/copyGroupReflectionText.ts";
import { formatGroupReflection } from "../app/features/group-reflection/_lib/formatGroupReflection.ts";

const CUMULATIVE_METRICS = {
  sessionCount: 1_234,
  completedTaskCount: 567,
  participantSessionCount: 89,
};

test("formats a deterministic collaborative reflection from cumulative metrics only", (): void => {
  const reflection = formatGroupReflection({ cumulativeMetrics: CUMULATIVE_METRICS });

  assert.equal(
    reflection.inAppText,
    "함께 1,234번의 세션을 이어오며 Task 567개를 완료했고, 89번 함께 참여했어요.",
  );
  assert.equal(
    reflection.shareText,
    "**함께 이어온 기록**\n총 세션 1,234회 · 완료한 Task 567개 · 함께한 참여 89번",
  );
  assert.doesNotMatch(reflection.inAppText, /이름|순위|목표|LLM|전송/);
  assert.doesNotMatch(reflection.shareText, /이름|순위|목표|LLM|전송/);
});

test("copies only the formatted share text when the clipboard succeeds", async (): Promise<void> => {
  const writtenTexts: string[] = [];
  const shareText = "Discord 형식 텍스트";

  const outcome = await copyGroupReflectionText({
    clipboard: {
      writeText: async (text: string): Promise<void> => {
        writtenTexts.push(text);
      },
    },
    shareText,
  });

  assert.equal(outcome, "copied");
  assert.deepEqual(writtenTexts, [shareText]);
});

test("requires manual copy when the clipboard is unavailable or rejects the write", async (): Promise<void> => {
  const unavailableOutcome = await copyGroupReflectionText({
    clipboard: undefined,
    shareText: "Discord 형식 텍스트",
  });
  const rejectedOutcome = await copyGroupReflectionText({
    clipboard: {
      writeText: async (): Promise<void> => {
        throw new Error("Clipboard permission denied");
      },
    },
    shareText: "Discord 형식 텍스트",
  });

  assert.equal(unavailableOutcome, "manual-copy-required");
  assert.equal(rejectedOutcome, "manual-copy-required");
});
