export interface ClipboardTextWriter {
  writeText: (text: string) => Promise<void>;
}

export function getBrowserClipboardWriter(): ClipboardTextWriter | undefined {
  if (typeof navigator === "undefined" || navigator.clipboard === undefined) return undefined;

  return { writeText: (text: string): Promise<void> => navigator.clipboard.writeText(text) };
}

export async function copyToClipboard({
  text,
  writer,
}: Readonly<{ text: string; writer: ClipboardTextWriter | undefined }>): Promise<boolean> {
  if (writer === undefined) return false;

  try {
    await writer.writeText(text);
    return true;
  } catch {
    return false;
  }
}
