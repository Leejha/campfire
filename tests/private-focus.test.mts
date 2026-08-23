import assert from "node:assert/strict";
import test from "node:test";

import {
  EMPTY_PRIVATE_FOCUS_DRAFT,
  readBrowserPrivateFocusDraft,
  readPrivateFocusDraft,
  removePrivateFocusDraft,
  writePrivateFocusDraft,
} from "../app/features/private-focus/_lib/index.ts";
import type { PrivateFocusDraft } from "../app/features/private-focus/_lib/index.ts";

const PRIVATE_FOCUS_STORAGE_KEY = "campfire.private-focus.v1";

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>();
  shouldThrowOnGet = false;
  shouldThrowOnSet = false;
  shouldThrowOnRemove = false;

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    if (this.shouldThrowOnGet) throw new Error("get unavailable");
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    if (this.shouldThrowOnRemove) throw new Error("remove unavailable");
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.shouldThrowOnSet) throw new Error("set unavailable");
    this.values.set(key, value);
  }
}

test("stores and reloads a valid private focus draft", (): void => {
  const storage = new MemoryStorage();
  const draft: PrivateFocusDraft = {
    clueId: "smallest-action",
    text: "문서 첫 문단을 적어요.",
  };

  assert.deepEqual(writePrivateFocusDraft({ draft, storage }), { status: "available" });
  assert.deepEqual(readPrivateFocusDraft({ storage }), { draft, status: "available" });
});

test("recovers an empty draft from malformed and invalid saved values", (): void => {
  const storage = new MemoryStorage();
  const invalidValues = [
    "not-json",
    JSON.stringify({ version: 1, clueId: "unknown", text: "보이면 안 돼요" }),
    JSON.stringify({ version: 1, clueId: "smallest-action", text: 1 }),
    JSON.stringify({ version: 2, clueId: "smallest-action", text: "이전 형식" }),
  ];

  for (const value of invalidValues) {
    storage.setItem(PRIVATE_FOCUS_STORAGE_KEY, value);
    assert.deepEqual(readPrivateFocusDraft({ storage }), {
      draft: EMPTY_PRIVATE_FOCUS_DRAFT,
      status: "recovered",
    });
  }
});

test("keeps memory editing available when storage reads or writes fail", (): void => {
  const storage = new MemoryStorage();
  storage.shouldThrowOnGet = true;

  assert.deepEqual(readPrivateFocusDraft({ storage }), {
    draft: EMPTY_PRIVATE_FOCUS_DRAFT,
    status: "unavailable",
  });

  storage.shouldThrowOnGet = false;
  storage.shouldThrowOnSet = true;
  assert.deepEqual(
    writePrivateFocusDraft({
      draft: { clueId: null, text: "저장하지 못해도 편집해요." },
      storage,
    }),
    { status: "unavailable" },
  );
});

test("clears the saved draft and reports remove failures", (): void => {
  const storage = new MemoryStorage();
  writePrivateFocusDraft({
    draft: { clueId: "ask-for-help", text: "질문할 내용을 정리해요." },
    storage,
  });

  assert.deepEqual(removePrivateFocusDraft({ storage }), { status: "available" });
  assert.deepEqual(readPrivateFocusDraft({ storage }), {
    draft: EMPTY_PRIVATE_FOCUS_DRAFT,
    status: "available",
  });

  storage.shouldThrowOnRemove = true;
  assert.deepEqual(removePrivateFocusDraft({ storage }), { status: "unavailable" });
});

test("does not access session storage during SSR", (): void => {
  assert.deepEqual(readBrowserPrivateFocusDraft(), {
    draft: EMPTY_PRIVATE_FOCUS_DRAFT,
    status: "unavailable",
  });
});
