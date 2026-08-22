import assert from "node:assert/strict";
import test from "node:test";

import { getCampfireDashboard } from "../app/lib/notion.ts";

const DATABASE_ID = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const DATABASE_PATH = `/v1/databases/${DATABASE_ID}/query`;
const SESSION_PATH = "/v1/blocks/session-page/children";
const NESTED_TASK_PATH = "/v1/blocks/task-parent/children";

interface FetchMockOptions {
  responses: ReadonlyMap<string, unknown>;
  run: () => Promise<void>;
}

function block({
  id,
  type,
  text,
  hasChildren,
  checked,
}: {
  id: string;
  type: string;
  text: string;
  hasChildren: boolean;
  checked: unknown;
}): Record<string, unknown> {
  return {
    id,
    type,
    has_children: hasChildren,
    [type]: {
      rich_text: text ? [{ plain_text: text }] : [],
      checked,
    },
  };
}

function responseBody({ blocks }: { blocks: Record<string, unknown>[] }): Record<string, unknown> {
  return { results: blocks, has_more: false, next_cursor: null };
}

function responsePath(input: RequestInfo | URL): string {
  const url = input instanceof Request ? input.url : input.toString();
  return new URL(url).pathname;
}

async function withFetchMock({ responses, run }: FetchMockOptions): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
    const path = responsePath(input);
    const response = responses.get(path);
    if (response === undefined) throw new Error(`Unexpected fetch: ${path}`);
    return new Response(JSON.stringify(response), { status: 200 });
  };
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function sessionPage(): Record<string, unknown> {
  return {
    id: "session-page",
    properties: { 날짜: { type: "date", date: { start: "2026-08-15" } } },
  };
}

function dashboardResponses({ checked }: { checked: unknown }): ReadonlyMap<string, unknown> {
  const participantOne = block({
    id: "participant-one",
    type: "heading_1",
    text: "동명이인",
    hasChildren: false,
    checked: false,
  });
  const parentTask = block({
    id: "task-parent",
    type: "to_do",
    text: "첫 번째 Task",
    hasChildren: true,
    checked,
  });
  const emptyTask = block({
    id: "task-empty",
    type: "to_do",
    text: "",
    hasChildren: false,
    checked: false,
  });
  const participantTwo = block({
    id: "participant-two",
    type: "heading_1",
    text: "동명이인",
    hasChildren: false,
    checked: false,
  });
  const completedTask = block({
    id: "task-complete",
    type: "to_do",
    text: "완료한 Task",
    hasChildren: false,
    checked: true,
  });
  const blockerHeading = block({
    id: "blocker-heading",
    type: "heading_3",
    text: "🚧 막힌 점",
    hasChildren: false,
    checked: false,
  });
  const blocker = block({
    id: "blocker-two",
    type: "paragraph",
    text: "도움이 필요해요",
    hasChildren: false,
    checked: false,
  });
  const participantThree = block({
    id: "participant-three",
    type: "heading_1",
    text: "Task 없음",
    hasChildren: false,
    checked: false,
  });
  const childTask = block({
    id: "task-child",
    type: "to_do",
    text: "중첩 Task",
    hasChildren: false,
    checked: true,
  });

  return new Map([
    [DATABASE_PATH, { results: [sessionPage()] }],
    [
      SESSION_PATH,
      responseBody({
        blocks: [
          participantOne,
          parentTask,
          emptyTask,
          participantTwo,
          completedTask,
          blockerHeading,
          blocker,
          participantThree,
        ],
      }),
    ],
    [NESTED_TASK_PATH, responseBody({ blocks: [childTask] })],
  ]);
}

test("parses stable participant and blocker IDs with preorder Tasks", async (): Promise<void> => {
  await withFetchMock({
    responses: dashboardResponses({ checked: false }),
    run: async (): Promise<void> => {
      const dashboard = await getCampfireDashboard({
        NOTION_TOKEN: "test-token",
        NOTION_DB: DATABASE_ID,
      });

      assert.deepEqual(dashboard.session.participants, [
        {
          id: "participant-one",
          name: "동명이인",
          tasks: [
            { id: "task-parent", text: "첫 번째 Task", checked: false },
            { id: "task-child", text: "중첩 Task", checked: true },
          ],
          tasksTotal: 2,
          tasksDone: 1,
        },
        {
          id: "participant-two",
          name: "동명이인",
          tasks: [{ id: "task-complete", text: "완료한 Task", checked: true }],
          tasksTotal: 1,
          tasksDone: 1,
        },
        { id: "participant-three", name: "Task 없음", tasks: [], tasksTotal: 0, tasksDone: 0 },
      ]);
      assert.deepEqual(dashboard.session.blockers, [
        {
          id: "blocker-two",
          participantId: "participant-two",
          participantName: "동명이인",
          content: "도움이 필요해요",
        },
      ]);
    },
  });
});

test("rejects a non-boolean to_do checked value", async (): Promise<void> => {
  await withFetchMock({
    responses: dashboardResponses({ checked: "true" }),
    run: async (): Promise<void> => {
      await assert.rejects(
        getCampfireDashboard({ NOTION_TOKEN: "test-token", NOTION_DB: DATABASE_ID }),
        /to_do 블록의 checked 값을 찾을 수 없습니다/,
      );
    },
  });
});
