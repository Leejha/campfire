import {
  EMPTY_PRIVATE_FOCUS_DRAFT,
  PRIVATE_FOCUS_CLUES,
} from "./models.ts";
import type { PrivateFocusClueId, PrivateFocusDraft } from "./models.ts";

const PRIVATE_FOCUS_STORAGE_KEY = "campfire.private-focus.v1";
const PRIVATE_FOCUS_STORAGE_VERSION = 1;

interface StoredPrivateFocusDraft {
  version: number;
  clueId: PrivateFocusClueId | null;
  text: string;
}

interface StorageAccess {
  storage: Storage;
}

export type PrivateFocusStorageStatus = "available" | "unavailable" | "recovered";

export interface ReadPrivateFocusDraftResult {
  draft: PrivateFocusDraft;
  status: PrivateFocusStorageStatus;
}

export interface WritePrivateFocusDraftResult {
  status: Exclude<PrivateFocusStorageStatus, "recovered">;
}

export function getPrivateFocusClueId({
  value,
}: Readonly<{ value: unknown }>): PrivateFocusClueId | null {
  const clue = PRIVATE_FOCUS_CLUES.find((candidate) => candidate.id === value);
  return clue ? clue.id : null;
}

export function readPrivateFocusDraft({ storage }: Readonly<StorageAccess>): ReadPrivateFocusDraftResult {
  let savedValue: string | null;

  try {
    savedValue = storage.getItem(PRIVATE_FOCUS_STORAGE_KEY);
  } catch {
    return { draft: EMPTY_PRIVATE_FOCUS_DRAFT, status: "unavailable" };
  }

  if (savedValue === null) {
    return { draft: EMPTY_PRIVATE_FOCUS_DRAFT, status: "available" };
  }

  const draft = parseStoredPrivateFocusDraft({ value: savedValue });
  if (draft === null) {
    return { draft: EMPTY_PRIVATE_FOCUS_DRAFT, status: "recovered" };
  }

  return { draft, status: "available" };
}

export function writePrivateFocusDraft({
  draft,
  storage,
}: Readonly<{ draft: PrivateFocusDraft; storage: Storage }>): WritePrivateFocusDraftResult {
  const storedDraft: StoredPrivateFocusDraft = {
    version: PRIVATE_FOCUS_STORAGE_VERSION,
    clueId: draft.clueId,
    text: draft.text,
  };

  try {
    storage.setItem(PRIVATE_FOCUS_STORAGE_KEY, JSON.stringify(storedDraft));
  } catch {
    return { status: "unavailable" };
  }

  return { status: "available" };
}

export function removePrivateFocusDraft({ storage }: Readonly<StorageAccess>): WritePrivateFocusDraftResult {
  try {
    storage.removeItem(PRIVATE_FOCUS_STORAGE_KEY);
  } catch {
    return { status: "unavailable" };
  }

  return { status: "available" };
}

export function readBrowserPrivateFocusDraft(): ReadPrivateFocusDraftResult {
  const storage = getSessionStorage();
  if (storage === null) {
    return { draft: EMPTY_PRIVATE_FOCUS_DRAFT, status: "unavailable" };
  }

  return readPrivateFocusDraft({ storage });
}

export function writeBrowserPrivateFocusDraft({
  draft,
}: Readonly<{ draft: PrivateFocusDraft }>): WritePrivateFocusDraftResult {
  const storage = getSessionStorage();
  if (storage === null) {
    return { status: "unavailable" };
  }

  return writePrivateFocusDraft({ draft, storage });
}

export function removeBrowserPrivateFocusDraft(): WritePrivateFocusDraftResult {
  const storage = getSessionStorage();
  if (storage === null) {
    return { status: "unavailable" };
  }

  return removePrivateFocusDraft({ storage });
}

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function parseStoredPrivateFocusDraft({ value }: Readonly<{ value: string }>): PrivateFocusDraft | null {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(value);
  } catch {
    return null;
  }

  if (!isRecord(parsedValue)) return null;
  const parsedRecord = parsedValue;
  if (parsedRecord.version !== PRIVATE_FOCUS_STORAGE_VERSION) return null;
  if (typeof parsedRecord.text !== "string") return null;

  const clueId = parsedRecord.clueId;
  if (clueId === null) return { clueId, text: parsedRecord.text };

  const validClueId = getPrivateFocusClueId({ value: clueId });
  if (validClueId === null) return null;

  return { clueId: validClueId, text: parsedRecord.text };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
