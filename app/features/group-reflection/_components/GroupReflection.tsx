import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";

import { Button, Textarea } from "~/components";
import type { CumulativeMetrics } from "~/lib/notion";

import { copyGroupReflectionText } from "../_lib/copyGroupReflectionText";
import { formatGroupReflection } from "../_lib/formatGroupReflection";
import type { ClipboardCopyOutcome } from "../models";

interface GroupReflectionProps {
  cumulativeMetrics: CumulativeMetrics;
}

const MANUAL_COPY_REQUIRED: ClipboardCopyOutcome = "manual-copy-required";

export function GroupReflection({
  cumulativeMetrics,
}: Readonly<GroupReflectionProps>): ReactElement {
  const { inAppText, shareText } = formatGroupReflection({ cumulativeMetrics });
  const [copyOutcome, setCopyOutcome] = useState<ClipboardCopyOutcome | null>(null);
  const manualCopyTextareaReference = useRef<HTMLTextAreaElement>(null);
  const isManualCopyRequired = copyOutcome === MANUAL_COPY_REQUIRED;
  const manualCopyStatusMessage = isManualCopyRequired
    ? "자동 복사를 할 수 없어 수동 복사 영역을 열었어요."
    : "";
  const copyStatusMessage = copyOutcome === "copied" ? "Discord 형식 미리보기를 복사했어요." : manualCopyStatusMessage;

  useEffect((): void => {
    if (!isManualCopyRequired) return;

    manualCopyTextareaReference.current?.focus();
    manualCopyTextareaReference.current?.select();
  }, [isManualCopyRequired]);

  const copyDiscordPreview = async (): Promise<void> => {
    const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
    const nextCopyOutcome = await copyGroupReflectionText({ clipboard, shareText });

    setCopyOutcome(nextCopyOutcome);
  };

  return (
    <section className="grid min-w-0 gap-6" aria-labelledby="group-reflection-title">
      <div className="grid gap-3">
        <h2 id="group-reflection-title" className="text-2xl font-semibold tracking-tight">
          함께 돌아보기
        </h2>
        <p className="text-lg leading-7 text-fg-neutral-muted">{inAppText}</p>
      </div>

      <details className="min-w-0 rounded-r2 border border-stroke-neutral-subtle bg-bg-layer-default p-4 text-sm shadow-s1">
        <summary className="cursor-pointer font-semibold text-fg-neutral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stroke-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-layer-default">
          Discord 형식 미리보기
        </summary>
        <pre className="mt-4 min-w-0 whitespace-pre-wrap break-words leading-6 text-fg-neutral-muted">
          {shareText}
        </pre>
      </details>

      <div className="grid min-w-0 gap-3">
        <p className="text-sm leading-6 text-fg-neutral-muted">
          Discord로 자동 전송하지 않아요. 필요할 때 직접 복사해 보내세요.
        </p>
        <div>
          <Button type="button" onClick={copyDiscordPreview}>
            Discord 형식 복사
          </Button>
        </div>
        <p aria-live="polite" className="sr-only">
          {copyStatusMessage}
        </p>
      </div>

      {isManualCopyRequired ? (
        <div className="grid min-w-0 gap-3 rounded-r2 border border-stroke-neutral-subtle bg-bg-neutral-weak p-4">
          <p id="manual-copy-instructions" className="text-sm leading-6 text-fg-neutral">
            자동으로 복사하지 못했어요. 아래 내용을 선택해 직접 복사해 주세요.
          </p>
          <Textarea
            ref={manualCopyTextareaReference}
            aria-describedby="manual-copy-instructions"
            aria-label="Discord 형식 수동 복사 내용"
            readOnly
            value={shareText}
          />
        </div>
      ) : null}
    </section>
  );
}
