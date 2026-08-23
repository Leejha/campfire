import assert from "node:assert/strict";
import test from "node:test";

import {
  createStudyInviteRawInput,
  createStudyInviteRawInputFromSearchParams,
  normalizeStudyInvite,
} from "../app/features/study-invite/normalizeStudyInvite.ts";
import {
  formatStudyInvitePreview,
  serializeStudyInvite,
} from "../app/features/study-invite/studyInvitePresentation.ts";
import { copyToClipboard } from "../app/features/study-invite/clipboard.ts";

const TODAY_KST = { date: "2026-08-23", time: "14:30" };

function normalizeForm({
  date,
  time,
  title,
}: Readonly<{
  date: string;
  time: string;
  title: string;
}>) {
  return normalizeStudyInvite({
    input: createStudyInviteRawInput({ values: { date, time, title } }),
    todayKst: TODAY_KST,
  });
}

test("normalizes a KST-today invitation and keeps an earlier time as a warning", (): void => {
  const result = normalizeForm({ date: "2026-08-23", time: "09:15", title: "  알고리즘 풀이  " });

  assert.equal(result.isValid, true);
  if (!result.isValid) return;
  assert.deepEqual(result.invite, {
    v: "1",
    date: "2026-08-23",
    time: "09:15",
    title: "알고리즘 풀이",
  });
  assert.match(result.pastTimeWarning, /지난 시간/);
});

test("rejects yesterday, invalid calendar dates, invalid time, title length, and version", (): void => {
  const yesterday = normalizeForm({ date: "2026-08-22", time: "18:00", title: "스터디" });
  const invalidDate = normalizeForm({ date: "2026-02-30", time: "18:00", title: "스터디" });
  const invalidTime = normalizeForm({ date: "2026-08-24", time: "24:00", title: "스터디" });
  const emptyTitle = normalizeForm({ date: "2026-08-24", time: "18:00", title: "   " });
  const longTitle = normalizeForm({ date: "2026-08-24", time: "18:00", title: "가".repeat(61) });
  const invalidVersion = normalizeStudyInvite({
    input: { v: ["2"], date: ["2026-08-24"], time: ["18:00"], title: ["스터디"] },
    todayKst: TODAY_KST,
  });

  assert.equal(yesterday.isValid, false);
  assert.equal(invalidDate.isValid, false);
  assert.equal(invalidTime.isValid, false);
  assert.equal(emptyTitle.isValid, false);
  assert.equal(longTitle.isValid, false);
  assert.equal(invalidVersion.isValid, false);
});

test("rejects every duplicate allowed query key while ignoring unknown query keys", (): void => {
  const unknownKeyInput = createStudyInviteRawInputFromSearchParams({
    searchParams: new URLSearchParams("v=1&date=2026-08-24&time=18%3A00&title=%EC%8A%A4%ED%84%B0%EB%94%94&source=private"),
  });
  const validResult = normalizeStudyInvite({ input: unknownKeyInput, todayKst: TODAY_KST });
  const duplicateSearchParams = [
    "v=1&v=1&date=2026-08-24&time=18%3A00&title=%EC%8A%A4%ED%84%B0%EB%94%94",
    "v=1&date=2026-08-24&date=2026-08-24&time=18%3A00&title=%EC%8A%A4%ED%84%B0%EB%94%94",
    "v=1&date=2026-08-24&time=18%3A00&time=18%3A00&title=%EC%8A%A4%ED%84%B0%EB%94%94",
    "v=1&date=2026-08-24&time=18%3A00&title=%EC%8A%A4%ED%84%B0%EB%94%94&title=%EB%8B%A4%EB%A5%B8+%EC%A0%9C%EB%AA%A9",
  ];

  assert.equal(validResult.isValid, true);
  for (const queryString of duplicateSearchParams) {
    const input = createStudyInviteRawInputFromSearchParams({ searchParams: new URLSearchParams(queryString) });
    const duplicateResult = normalizeStudyInvite({ input, todayKst: TODAY_KST });

    assert.equal(duplicateResult.isValid, false);
  }
});

test("round-trips canonical encoding and title boundaries without private query keys", (): void => {
  const result = normalizeForm({ date: "2026-08-24", time: "18:00", title: "가".repeat(60) });
  const encodedResult = normalizeForm({ date: "2026-08-24", time: "18:00", title: "React & TypeScript" });

  assert.equal(result.isValid, true);
  if (!result.isValid) return;
  const canonicalUrl = serializeStudyInvite({ invite: result.invite });
  const roundTrippedInput = createStudyInviteRawInputFromSearchParams({
    searchParams: new URL(`https://campfire.example${canonicalUrl}`).searchParams,
  });
  const roundTrippedResult = normalizeStudyInvite({ input: roundTrippedInput, todayKst: TODAY_KST });

  assert.match(canonicalUrl, /^\/invite\/open\?v=1&date=2026-08-24&time=18%3A00&title=/);
  assert.equal(canonicalUrl.includes("source="), false);
  assert.equal(roundTrippedResult.isValid, true);
  assert.equal(encodedResult.isValid, true);
  if (!encodedResult.isValid) return;
  assert.equal(
    serializeStudyInvite({ invite: encodedResult.invite }),
    "/invite/open?v=1&date=2026-08-24&time=18%3A00&title=React+%26+TypeScript",
  );
  assert.equal(
    formatStudyInvitePreview({ invite: result.invite }),
    `스터디 초대\n제목: ${"가".repeat(60)}\n날짜: 2026-08-24\n시간: 18:00`,
  );
});

test("normalizes encoded title whitespace and rejects remaining control characters", (): void => {
  const encodedWhitespaceInput = createStudyInviteRawInputFromSearchParams({
    searchParams: new URLSearchParams("v=1&date=2026-08-24&time=18%3A00&title=React%0A%09%20Study"),
  });
  const normalizedWhitespace = normalizeStudyInvite({ input: encodedWhitespaceInput, todayKst: TODAY_KST });
  const controlCharacter = normalizeForm({ date: "2026-08-24", time: "18:00", title: "React\u0001Study" });

  assert.equal(normalizedWhitespace.isValid, true);
  if (!normalizedWhitespace.isValid) return;
  assert.equal(normalizedWhitespace.invite.title, "React Study");
  assert.equal(
    serializeStudyInvite({ invite: normalizedWhitespace.invite }),
    "/invite/open?v=1&date=2026-08-24&time=18%3A00&title=React+Study",
  );
  assert.equal(
    formatStudyInvitePreview({ invite: normalizedWhitespace.invite }),
    "스터디 초대\n제목: React Study\n날짜: 2026-08-24\n시간: 18:00",
  );
  assert.equal(controlCharacter.isValid, false);
  if (controlCharacter.isValid) return;
  assert.match(controlCharacter.fieldErrors.title, /제어 문자/);
});

test("reports clipboard writer success, absence, and rejection without a browser global", async (): Promise<void> => {
  const copiedTexts: string[] = [];
  const copied = await copyToClipboard({
    text: "공유할 초대",
    writer: { writeText: async (text: string): Promise<void> => { copiedTexts.push(text); } },
  });
  const unavailable = await copyToClipboard({ text: "공유할 초대", writer: undefined });
  const rejected = await copyToClipboard({
    text: "공유할 초대",
    writer: { writeText: async (): Promise<void> => { throw new Error("Clipboard permission denied"); } },
  });

  assert.equal(copied, true);
  assert.deepEqual(copiedTexts, ["공유할 초대"]);
  assert.equal(unavailable, false);
  assert.equal(rejected, false);
});
