import type { FormEvent, ReactElement } from "react";
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Form } from "react-router";

import { Button, Card, CardContent, CardHeader, CardTitle, Divider } from "~/components";

import { createStudySessionStage } from "../_lib/study-session-template";
import type {
  StudySessionDraft,
  StudySessionScheduledStage,
  StudySessionStageKind,
  StudySessionTimeline,
} from "../models";

import {
  getStudySessionStageDefinition,
  STUDY_SESSION_STAGE_CATALOG,
} from "./stageCatalog";
import {
  formatStudySessionDuration,
  formatStudySessionScheduleTime,
  getStudySessionSchedulePreview,
} from "./studySessionSchedulePreview";

interface StudySessionSetupProps {
  draft: StudySessionDraft;
  canSave: boolean;
  notice: string;
  showIntro: boolean;
  today: string;
}

interface StageEditorProps {
  canDelete: boolean;
  index: number;
  scheduledStage: StudySessionScheduledStage | null;
  stage: StudySessionDraft["stages"][number];
  total: number;
  onDeleteStage: (index: number) => void;
  onMoveStage: (index: number, direction: -1 | 1) => void;
  onUpdateStageMinutes: (index: number, minutes: number) => void;
}

interface StudySessionTimelineTableProps {
  stages: StudySessionDraft["stages"];
  timeline: StudySessionTimeline | null;
}

function getNewStageId({ kind, taskNumber }: Readonly<{ kind: StudySessionStageKind; taskNumber: number | null }>): string {
  const suffix = globalThis.crypto.randomUUID();
  const taskPrefix = taskNumber === null ? kind : `task-${taskNumber}`;
  return `${taskPrefix}-${suffix}`;
}

function StageEditor({
  canDelete,
  index,
  scheduledStage,
  stage,
  total,
  onDeleteStage,
  onMoveStage,
  onUpdateStageMinutes,
}: Readonly<StageEditorProps>): ReactElement {
  const isFirstStage = index === 0;
  const isLastStage = index === total - 1;

  return (
    <li className="grid gap-4 rounded-r2 border border-stroke-neutral-subtle bg-bg-layer-default p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h3 className="text-base font-semibold">{stage.title}</h3>
          <p className="text-sm leading-6 text-fg-neutral-muted">{stage.guide}</p>
          {scheduledStage ? (
            <p className="flex flex-wrap gap-x-1 text-sm leading-6 text-fg-neutral-muted">
              <time dateTime={new Date(scheduledStage.startAt).toISOString()}>
                {formatStudySessionScheduleTime({ timestamp: scheduledStage.startAt })}
              </time>
              <span aria-hidden="true">~</span>
              <time dateTime={new Date(scheduledStage.endAt).toISOString()}>
                {formatStudySessionScheduleTime({ timestamp: scheduledStage.endAt })}
              </time>
              <span>· {stage.minutes}분</span>
            </p>
          ) : (
            <p className="text-sm leading-6 text-fg-neutral-muted">시간을 입력하면 실제 시각을 보여드려요.</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            aria-label={`${stage.title} 단계를 위로 이동해요`}
            disabled={isFirstStage}
            size="icon"
            type="button"
            variant="ghost"
            onClick={() => onMoveStage(index, -1)}
          >
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button
            aria-label={`${stage.title} 단계를 아래로 이동해요`}
            disabled={isLastStage}
            size="icon"
            type="button"
            variant="ghost"
            onClick={() => onMoveStage(index, 1)}
          >
            <ArrowDown aria-hidden="true" />
          </Button>
          <Button
            aria-label={`${stage.title} 단계를 삭제해요`}
            disabled={!canDelete}
            size="icon"
            type="button"
            variant="ghost"
            onClick={() => onDeleteStage(index)}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>
      <label className="grid max-w-48 gap-2 text-sm font-medium" htmlFor={`stage-${stage.id}-minutes`}>
        <span>시간</span>
        <span className="flex items-center gap-2">
          <input
            aria-describedby={`stage-${stage.id}-minutes-helper`}
            className="min-h-11 w-full rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default px-3 text-base shadow-s1 outline-none focus-visible:border-stroke-focus-ring focus-visible:ring-2 focus-visible:ring-stroke-focus-ring/50 md:text-sm"
            id={`stage-${stage.id}-minutes`}
            min="1"
            name={`stage-${stage.id}-minutes`}
            required
            type="number"
            value={stage.minutes}
            onChange={(event) => onUpdateStageMinutes(index, Number(event.target.value))}
          />
          <span className="text-fg-neutral-muted">분</span>
        </span>
        <span id={`stage-${stage.id}-minutes-helper`} className="text-sm font-normal leading-6 text-fg-neutral-muted">1분 단위로 입력해요.</span>
      </label>
    </li>
  );
}

function StudySessionTimelineTable({
  stages,
  timeline,
}: Readonly<StudySessionTimelineTableProps>): ReactElement {
  return (
    <Card>
      <CardContent className="grid gap-3 p-4">
        <h2 id="timeline-preview-title" className="text-xl font-semibold">전체 타임테이블</h2>
        <div className="overflow-x-auto">
          <table aria-labelledby="timeline-preview-title" className="w-full table-fixed border-collapse text-left text-sm">
            <caption className="sr-only">입력한 단계별 전체 타임테이블이에요.</caption>
            <thead className="bg-bg-neutral-weak">
              <tr>
                <th className="border-b border-stroke-neutral-subtle px-3 py-3 font-semibold" scope="col">시간</th>
                <th className="border-b border-stroke-neutral-subtle px-3 py-3 font-semibold" scope="col">단계</th>
                <th className="border-b border-stroke-neutral-subtle px-3 py-3 font-semibold" scope="col">소요 시간</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((stage, index) => {
                const scheduledStage = timeline?.stages[index] ?? null;

                return (
                  <tr key={stage.id}>
                    <td className="border-b border-stroke-neutral-subtle px-3 py-3 align-top text-fg-neutral-muted">
                      {scheduledStage ? (
                        <span className="whitespace-nowrap">
                          <time dateTime={new Date(scheduledStage.startAt).toISOString()}>
                            {formatStudySessionScheduleTime({ timestamp: scheduledStage.startAt })}
                          </time>
                          <span aria-hidden="true"> ~ </span>
                          <time dateTime={new Date(scheduledStage.endAt).toISOString()}>
                            {formatStudySessionScheduleTime({ timestamp: scheduledStage.endAt })}
                          </time>
                        </span>
                      ) : "계산 대기"}
                    </td>
                    <td className="border-b border-stroke-neutral-subtle px-3 py-3 align-top break-words">
                      <p className="font-semibold">{stage.title}</p>
                      <p className="mt-1 leading-6 text-fg-neutral-muted">{stage.guide}</p>
                    </td>
                    <td className="border-b border-stroke-neutral-subtle px-3 py-3 align-top whitespace-nowrap text-fg-neutral-muted">{stage.minutes}분</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function StudySessionSetup({
  canSave,
  draft,
  notice,
  showIntro,
  today,
}: Readonly<StudySessionSetupProps>): ReactElement {
  const [scheduledDate, setScheduledDate] = useState(draft.scheduledDate || today);
  const [scheduledTime, setScheduledTime] = useState(draft.scheduledTime);
  const [stages, setStages] = useState(draft.stages);
  const [nextStageKind, setNextStageKind] = useState<StudySessionStageKind>("task-writing");
  const [taskNumber, setTaskNumber] = useState("");
  const [stageError, setStageError] = useState("");
  const serializedDraft = JSON.stringify({ scheduledDate, scheduledTime, stages });
  const isTaskStage = nextStageKind === "task";
  const schedulePreview = getStudySessionSchedulePreview({ scheduledDate, scheduledTime, stages });

  const updateStageMinutes = (index: number, minutes: number): void => {
    setStages((currentStages) => currentStages.map((stage, stageIndex) => {
      if (stageIndex !== index) return stage;
      return { ...stage, minutes };
    }));
  };

  const moveStage = (index: number, direction: -1 | 1): void => {
    const targetIndex = index + direction;
    setStages((currentStages) => {
      const reorderedStages = [...currentStages];
      const currentStage = reorderedStages[index];
      const targetStage = reorderedStages[targetIndex];

      if (!currentStage || !targetStage) return currentStages;

      reorderedStages[index] = targetStage;
      reorderedStages[targetIndex] = currentStage;
      return reorderedStages;
    });
  };

  const deleteStage = (index: number): void => {
    setStages((currentStages) => currentStages.filter((_, stageIndex) => stageIndex !== index));
  };

  const addStage = (): void => {
    const parsedTaskNumber = Number(taskNumber);
    const selectedTaskNumber = isTaskStage ? parsedTaskNumber : null;
    const hasValidTaskNumber = Number.isInteger(parsedTaskNumber) && parsedTaskNumber >= 1;
    const hasDuplicateTaskNumber = stages.some((stage) => stage.taskNumber === selectedTaskNumber);

    if (isTaskStage && !hasValidTaskNumber) {
      setStageError("Task 번호는 1 이상의 정수로 적어 주세요.");
      return;
    }

    if (isTaskStage && hasDuplicateTaskNumber) {
      setStageError("이미 사용 중인 Task 번호예요.");
      return;
    }

    const definition = getStudySessionStageDefinition({ kind: nextStageKind });
    const newStage = createStudySessionStage({
      id: getNewStageId({ kind: nextStageKind, taskNumber: selectedTaskNumber }),
      kind: nextStageKind,
      minutes: definition.defaultDurationMinutes,
      taskNumber: selectedTaskNumber,
    });
    setStages((currentStages) => [...currentStages, newStage]);
    setStageError("");
    setTaskNumber("");
  };

  const submitSchedule = (event: FormEvent<HTMLFormElement>): void => {
    const hasInvalidDuration = stages.some((stage) => !Number.isInteger(stage.minutes) || stage.minutes < 1);
    if (!hasInvalidDuration) return;

    event.preventDefault();
    setStageError("각 단계 시간은 1분 이상의 정수로 적어 주세요.");
  };

  const intro = showIntro ? (
    <header className="grid gap-3">
        <p className="text-sm font-semibold text-fg-brand">모각코</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">오늘의 흐름을 준비해요</h1>
        <p className="text-lg leading-7 text-fg-neutral-muted">시작 시각이 되면 모든 화면에서 같은 순서로 진행해요.</p>
    </header>
  ) : null;

  return (
    <section className="grid gap-8">
      {intro}
      <Form className="grid gap-6" method="post" onSubmit={submitSchedule}>
        <input name="intent" type="hidden" value="save-session" />
        <input name="draft" type="hidden" value={serializedDraft} />
        {notice ? <p className="rounded-r2 border border-stroke-critical-weak bg-bg-critical-weak p-4 text-sm leading-6 text-fg-critical" role="alert">{notice}</p> : null}
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2 className="text-xl font-semibold">시작 시각</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium" htmlFor="scheduled-date">
                  <span>날짜</span>
                  <input
                    aria-describedby="scheduled-time-helper"
                    className="min-h-11 rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default px-3 text-base shadow-s1 outline-none focus-visible:border-stroke-focus-ring focus-visible:ring-2 focus-visible:ring-stroke-focus-ring/50 md:text-sm"
                    id="scheduled-date"
                    min={today}
                    name="scheduledDate"
                    required
                    type="date"
                    value={scheduledDate}
                    onChange={(event) => setScheduledDate(event.target.value)}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium" htmlFor="scheduled-time">
                  <span>시작 시간</span>
                  <input
                    aria-describedby="scheduled-time-helper"
                    className="min-h-11 rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default px-3 text-base shadow-s1 outline-none focus-visible:border-stroke-focus-ring focus-visible:ring-2 focus-visible:ring-stroke-focus-ring/50 md:text-sm"
                    id="scheduled-time"
                    name="scheduledTime"
                    required
                    type="time"
                    value={scheduledTime}
                    onChange={(event) => setScheduledTime(event.target.value)}
                  />
                </label>
                <p id="scheduled-time-helper" className="text-sm leading-6 text-fg-neutral-muted sm:col-span-2">한국 시간 기준으로 진행해요.</p>
              </CardContent>
            </Card>

            <section className="grid gap-5" aria-labelledby="schedule-stages-title">
              <div className="grid gap-2">
                <h2 id="schedule-stages-title" className="text-2xl font-semibold tracking-tight">타임테이블</h2>
                <p className="leading-7 text-fg-neutral-muted">순서를 바꾸거나 시간을 조정할 수 있어요. 단계 이름과 안내는 정해진 내용을 사용해요.</p>
              </div>
              <ol className="grid gap-3">
                {stages.map((stage, index) => (
                  <StageEditor
                    key={stage.id}
                    canDelete={stages.length > 1}
                    index={index}
                    scheduledStage={schedulePreview.timeline?.stages[index] ?? null}
                    stage={stage}
                    total={stages.length}
                    onDeleteStage={deleteStage}
                    onMoveStage={moveStage}
                    onUpdateStageMinutes={updateStageMinutes}
                  />
                ))}
              </ol>
            </section>

            <Card>
              <CardHeader>
                <CardTitle>
                  <h2 className="text-xl font-semibold">단계 추가</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium">
                    단계 종류
                    <select
                      className="min-h-11 rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default px-3 text-base shadow-s1 outline-none focus-visible:border-stroke-focus-ring focus-visible:ring-2 focus-visible:ring-stroke-focus-ring/50 md:text-sm"
                      value={nextStageKind}
                      onChange={(event) => {
                        const definition = STUDY_SESSION_STAGE_CATALOG.find(
                          (candidate) => candidate.kind === event.target.value,
                        );

                        if (definition) setNextStageKind(definition.kind);
                      }}
                    >
                      {STUDY_SESSION_STAGE_CATALOG.map((definition) => (
                        <option key={definition.kind} value={definition.kind}>{definition.label}</option>
                      ))}
                    </select>
                  </label>
                  {isTaskStage ? (
                    <label className="grid gap-2 text-sm font-medium">
                      Task 번호
                      <input
                        className="min-h-11 rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default px-3 text-base shadow-s1 outline-none focus-visible:border-stroke-focus-ring focus-visible:ring-2 focus-visible:ring-stroke-focus-ring/50 md:text-sm"
                        aria-describedby={stageError ? "stage-error" : undefined}
                        aria-invalid={stageError ? true : undefined}
                        inputMode="numeric"
                        min="1"
                        type="number"
                        value={taskNumber}
                        onChange={(event) => setTaskNumber(event.target.value)}
                      />
                    </label>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="outline" onClick={addStage}>
                    <Plus aria-hidden="true" />
                    단계 추가
                  </Button>
                  <p aria-live="polite" className="text-sm text-fg-critical" id="stage-error" role="status">{stageError}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <aside className="grid gap-6 lg:sticky lg:top-6 lg:self-start" aria-label="예상 일정">
            <Card className="border-stroke-brand-weak bg-bg-brand-weak">
              <CardContent aria-atomic="true" aria-live="polite" className="grid gap-2 p-4" role="status">
                <p className="text-sm font-semibold text-fg-brand">예상 일정</p>
                {schedulePreview.timeline ? (
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="text-lg font-semibold">
                      <time dateTime={new Date(schedulePreview.timeline.startsAt).toISOString()}>
                        {formatStudySessionScheduleTime({ timestamp: schedulePreview.timeline.startsAt })}
                      </time>
                      <span aria-hidden="true"> ~ </span>
                      <time dateTime={new Date(schedulePreview.timeline.endsAt).toISOString()}>
                        {formatStudySessionScheduleTime({ timestamp: schedulePreview.timeline.endsAt })}
                      </time>
                    </p>
                    <p className="text-sm font-medium text-fg-neutral-muted">
                      총 {formatStudySessionDuration({ milliseconds: schedulePreview.timeline.endsAt - schedulePreview.timeline.startsAt })}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-fg-neutral-muted">{schedulePreview.waitingMessage}</p>
                )}
                <p className="text-sm leading-6 text-fg-neutral-muted">입력한 값에 따라 바로 다시 계산해요.</p>
              </CardContent>
            </Card>

            <StudySessionTimelineTable stages={stages} timeline={schedulePreview.timeline} />
          </aside>
        </div>

        <Divider />
        <div>
          <Button disabled={!canSave} type="submit">회차 저장</Button>
        </div>
      </Form>
    </section>
  );
}
