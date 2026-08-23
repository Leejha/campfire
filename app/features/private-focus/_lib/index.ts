export {
  EMPTY_PRIVATE_FOCUS_DRAFT,
  PRIVATE_FOCUS_CLUES,
} from "./models.ts";
export type { PrivateFocusClueId, PrivateFocusDraft } from "./models.ts";
export {
  getPrivateFocusClueId,
  readBrowserPrivateFocusDraft,
  readPrivateFocusDraft,
  removeBrowserPrivateFocusDraft,
  removePrivateFocusDraft,
  writeBrowserPrivateFocusDraft,
  writePrivateFocusDraft,
} from "./sessionStorage.ts";
export type {
  PrivateFocusStorageStatus,
  ReadPrivateFocusDraftResult,
  WritePrivateFocusDraftResult,
} from "./sessionStorage.ts";
