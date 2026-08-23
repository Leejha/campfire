import type { ClipboardCopyOutcome, ClipboardWriter } from "../models.ts";

interface CopyGroupReflectionTextOptions {
  clipboard: ClipboardWriter | undefined;
  shareText: string;
}

export async function copyGroupReflectionText({
  clipboard,
  shareText,
}: Readonly<CopyGroupReflectionTextOptions>): Promise<ClipboardCopyOutcome> {
  if (!clipboard) return "manual-copy-required";

  try {
    await clipboard.writeText(shareText);
    return "copied";
  } catch {
    return "manual-copy-required";
  }
}
