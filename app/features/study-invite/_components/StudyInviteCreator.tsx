import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { Copy, Link as LinkIcon } from "lucide-react";

import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea } from "~/components";

import { copyToClipboard, getBrowserClipboardWriter } from "../clipboard";
import { createStudyInviteRawInput, normalizeStudyInvite } from "../normalizeStudyInvite";
import { formatStudyInvitePreview, serializeStudyInvite } from "../studyInvitePresentation";
import type { InviteFormValues, KstNow } from "../models";

interface StudyInviteCreatorProps {
  todayKst: KstNow;
}

interface FieldProps {
  id: "title" | "date" | "time";
  label: string;
  error: string;
  children: ReactElement;
}

function InviteField({ id, label, error, children }: Readonly<FieldProps>): ReactElement {
  const errorId = `${id}-error`;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label} (필수)</Label>
      {children}
      {error ? <p id={errorId} className="text-sm leading-6 text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}

export function StudyInviteCreator({ todayKst }: Readonly<StudyInviteCreatorProps>): ReactElement {
  const [values, setValues] = useState<InviteFormValues>({ date: todayKst.date, time: "", title: "" });
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [showManualCopy, setShowManualCopy] = useState(false);
  const [manualCopyText, setManualCopyText] = useState("");
  const [manualCopyRequest, setManualCopyRequest] = useState(0);
  const manualCopyTextarea = useRef<HTMLTextAreaElement>(null);
  const normalization = normalizeStudyInvite({ input: createStudyInviteRawInput({ values }), todayKst });
  const fieldErrors = hasSubmitted ? normalization.fieldErrors : { v: "", date: "", time: "", title: "" };
  const canonicalUrl = normalization.isValid ? serializeStudyInvite({ invite: normalization.invite }) : "";
  const preview = normalization.isValid ? formatStudyInvitePreview({ invite: normalization.invite }) : "";
  const shouldShowResult = hasSubmitted && normalization.isValid;

  useEffect((): void => {
    if (manualCopyRequest === 0) return;

    manualCopyTextarea.current?.focus();
    manualCopyTextarea.current?.select();
  }, [manualCopyRequest]);

  const updateValue = ({ field, value }: Readonly<{ field: keyof InviteFormValues; value: string }>): void => {
    setValues({ ...values, [field]: value });
    setHasSubmitted(false);
    setCopyStatus("");
    setShowManualCopy(false);
    setManualCopyText("");
  };

  const createInvite = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setHasSubmitted(true);
  };

  const copyInvite = async (): Promise<void> => {
    if (!normalization.isValid) return;

    const absoluteUrl = new URL(canonicalUrl, window.location.origin).toString();
    const didCopy = await copyToClipboard({
      text: `${absoluteUrl}\n\n${preview}`,
      writer: getBrowserClipboardWriter(),
    });

    if (didCopy) {
      setCopyStatus("초대 링크와 미리보기를 복사했어요.");
      setShowManualCopy(false);
      setManualCopyText("");
      return;
    }

    setCopyStatus("자동 복사를 사용할 수 없어요. 아래 내용을 직접 선택해 복사해 주세요.");
    setManualCopyText(`${absoluteUrl}\n\n${preview}`);
    setShowManualCopy(true);
    setManualCopyRequest((request) => request + 1);
  };

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto grid min-h-svh w-full max-w-2xl gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="grid gap-3">
        <p className="text-sm font-semibold text-primary">스터디 약속 공유</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">초대 링크 만들기</h1>
        <p className="text-lg leading-7 text-muted-foreground">제목, 날짜, 시간만 담은 링크를 만들어 함께 나눠요.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle><h2 className="text-xl font-semibold">공개할 일정</h2></CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-5" onSubmit={createInvite} noValidate>
            <InviteField id="title" label="스터디 제목" error={fieldErrors.title}>
              <Input id="title" type="text" value={values.title} maxLength={60} required aria-required="true" aria-describedby={fieldErrors.title ? "title-error" : undefined} aria-invalid={fieldErrors.title.length > 0} onChange={(event) => updateValue({ field: "title", value: event.target.value })} />
            </InviteField>
            <div className="grid gap-5 sm:grid-cols-2">
              <InviteField id="date" label="날짜" error={fieldErrors.date}>
                <Input id="date" type="date" value={values.date} required aria-required="true" aria-describedby={fieldErrors.date ? "date-error" : undefined} aria-invalid={fieldErrors.date.length > 0} onChange={(event) => updateValue({ field: "date", value: event.target.value })} />
              </InviteField>
              <InviteField id="time" label="시간" error={fieldErrors.time}>
                <Input id="time" type="time" value={values.time} required aria-required="true" aria-describedby={fieldErrors.time ? "time-error" : undefined} aria-invalid={fieldErrors.time.length > 0} onChange={(event) => updateValue({ field: "time", value: event.target.value })} />
              </InviteField>
            </div>
            <Button type="submit">초대 링크 만들기</Button>
          </form>
        </CardContent>
      </Card>

      {shouldShowResult ? (
        <section className="grid gap-5" aria-labelledby="invite-result-title">
          <div className="grid gap-2">
            <h2 id="invite-result-title" className="text-2xl font-semibold tracking-tight">공유할 초대</h2>
            <p className="text-sm leading-6 text-muted-foreground">이 링크는 공식 증빙이 아닌 공유 안내예요. 일정은 별도로 확인해 주세요.</p>
          </div>
          {normalization.pastTimeWarning ? <p className="rounded-lg border border-border bg-muted px-4 py-3 text-sm leading-6" role="status">{normalization.pastTimeWarning}</p> : null}
          <Card>
            <CardContent className="grid gap-4 pt-6">
              <div className="grid gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold"><LinkIcon aria-hidden="true" className="size-4" />초대 링크</p>
                <a className="break-all text-sm leading-6 text-primary underline underline-offset-4" href={canonicalUrl}>{canonicalUrl}</a>
              </div>
              <div className="grid gap-2">
                <p className="text-sm font-semibold">미리보기</p>
                <p className="whitespace-pre-wrap break-words rounded-lg bg-muted p-4 text-sm leading-6">{preview}</p>
              </div>
              <Button type="button" onClick={copyInvite}><Copy aria-hidden="true" />링크와 미리보기 복사</Button>
              <p aria-live="polite" className="text-sm leading-6 text-muted-foreground">{copyStatus}</p>
              {showManualCopy ? (
                <div className="grid gap-2">
                  <Label htmlFor="manual-copy">직접 복사할 내용</Label>
                  <p id="manual-copy-instruction" className="text-sm leading-6 text-muted-foreground">내용이 자동으로 선택됐어요. 복사한 뒤 원하는 곳에 붙여넣어 주세요.</p>
                  <Textarea id="manual-copy" ref={manualCopyTextarea} readOnly value={manualCopyText} aria-describedby="manual-copy-instruction" onFocus={(event) => event.currentTarget.select()} />
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </main>
  );
}
