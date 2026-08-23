export interface GroupReflectionText {
  inAppText: string;
  shareText: string;
}

export interface ClipboardWriter {
  writeText(text: string): Promise<void>;
}

export type ClipboardCopyOutcome = "copied" | "manual-copy-required";
