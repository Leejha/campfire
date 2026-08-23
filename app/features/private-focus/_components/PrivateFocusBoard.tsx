import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactElement } from "react";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Divider,
  Input,
  Label,
  Textarea,
} from "~/components";
import {
  EMPTY_PRIVATE_FOCUS_DRAFT,
  PRIVATE_FOCUS_CLUES,
  getPrivateFocusClueId,
  readBrowserPrivateFocusDraft,
  removeBrowserPrivateFocusDraft,
  writeBrowserPrivateFocusDraft,
} from "../_lib";
import type { PrivateFocusDraft, PrivateFocusStorageStatus } from "../_lib";

const DRAFT_TEXTAREA_ID = "private-focus-draft";
const CLUE_GROUP_LABEL_ID = "private-focus-clue-label";

export function PrivateFocusBoard(): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<PrivateFocusDraft>(EMPTY_PRIVATE_FOCUS_DRAFT);
  const [storageStatus, setStorageStatus] = useState<PrivateFocusStorageStatus>("available");
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);
  const skipNextStorageSync = useRef(false);

  useEffect((): void => {
    const result = readBrowserPrivateFocusDraft();
    skipNextStorageSync.current = true;
    setDraft(result.draft);
    setStorageStatus(result.status);
    setHasLoadedStorage(true);
  }, []);

  useEffect((): void => {
    if (!hasLoadedStorage) return;

    if (skipNextStorageSync.current) {
      skipNextStorageSync.current = false;
      return;
    }

    const result = writeBrowserPrivateFocusDraft({ draft });
    setStorageStatus(result.status);
  }, [draft, hasLoadedStorage]);

  const saveDraftText = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    setDraft({ ...draft, text: event.target.value });
  };

  const selectClue = (event: ChangeEvent<HTMLInputElement>): void => {
    const clueId = getPrivateFocusClueId({ value: event.target.value });
    if (clueId === null) return;

    setDraft({ ...draft, clueId });
  };

  const clearSelectedClue = (): void => {
    setDraft({ ...draft, clueId: null });
  };

  const clearDraft = (): void => {
    const result = removeBrowserPrivateFocusDraft();
    skipNextStorageSync.current = true;
    setDraft(EMPTY_PRIVATE_FOCUS_DRAFT);
    setStorageStatus(result.status);
  };

  const storageMessage = getStorageMessage({ storageStatus });

  return (
    <section className="grid gap-4" aria-labelledby="private-focus-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h2 id="private-focus-title" className="text-2xl font-semibold tracking-tight">
            내 다음 행동
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            현재 탭에 남는 개인 메모예요.
          </p>
        </div>
        <Button
          aria-controls={isOpen ? "private-focus-panel" : undefined}
          aria-expanded={isOpen}
          onClick={(): void => setIsOpen(!isOpen)}
          type="button"
          variant="outline"
        >
          {isOpen ? "다음 행동 닫기" : "내 다음 행동 정리하기"}
        </Button>
      </div>

      {isOpen ? (
        <Card id="private-focus-panel">
          <CardHeader className="gap-3">
            <CardTitle>
              <h3 className="text-xl font-semibold tracking-tight">다음 행동을 적어봐요</h3>
            </CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              현재 탭에만 저장되고 서버나 공유 현황판으로 전송되지 않아요. 화면을 공유 중이면 화면을 보는 사람에게 메모가 보일 수 있어요.
            </p>
          </CardHeader>
          <CardContent className="grid gap-6">
            <Divider />
            <fieldset className="grid gap-3" aria-describedby="private-focus-clue-hint">
              <legend id={CLUE_GROUP_LABEL_ID} className="text-sm font-semibold">
                시작 실마리
              </legend>
              <p id="private-focus-clue-hint" className="text-sm leading-6 text-muted-foreground">
                하나를 고르거나, 고르지 않고 바로 적어도 돼요.
              </p>
              <div className="grid gap-3">
                {PRIVATE_FOCUS_CLUES.map((clue): ReactElement => {
                  const clueInputId = `private-focus-clue-${clue.id}`;

                  return (
                    <div key={clue.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                      <Input
                        aria-labelledby={`${CLUE_GROUP_LABEL_ID} ${clueInputId}-label`}
                        checked={draft.clueId === clue.id}
                        className="mt-0.5 size-4 shrink-0"
                        id={clueInputId}
                        name="private-focus-clue"
                        onChange={selectClue}
                        type="radio"
                        value={clue.id}
                      />
                      <Label className="cursor-pointer leading-6" htmlFor={clueInputId} id={`${clueInputId}-label`}>
                        {clue.question}
                      </Label>
                    </div>
                  );
                })}
              </div>
              {draft.clueId !== null ? (
                <div>
                  <Button onClick={clearSelectedClue} size="sm" type="button" variant="ghost">
                    실마리 선택 지우기
                  </Button>
                </div>
              ) : null}
            </fieldset>

            <div className="grid gap-3">
              <Label htmlFor={DRAFT_TEXTAREA_ID}>지금 이어갈 행동</Label>
              <Textarea
                aria-describedby="private-focus-storage-status"
                id={DRAFT_TEXTAREA_ID}
                onChange={saveDraftText}
                placeholder="다음에 할 작은 행동을 편하게 적어봐요."
                value={draft.text}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p id="private-focus-storage-status" aria-live="polite" className="text-sm leading-6 text-muted-foreground">
                {storageMessage}
              </p>
              <Button onClick={clearDraft} type="button" variant="ghost">
                초안 지우기
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

function getStorageMessage({
  storageStatus,
}: Readonly<{ storageStatus: PrivateFocusStorageStatus }>): string {
  if (storageStatus === "unavailable") {
    return "이 브라우저에서는 저장할 수 없어, 입력은 현재 화면에서만 유지돼요.";
  }

  if (storageStatus === "recovered") {
    return "저장된 초안을 확인할 수 없어 빈 초안으로 시작했어요.";
  }

  return "이 메모는 현재 탭에만 저장돼요.";
}
