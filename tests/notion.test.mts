import assert from "node:assert/strict";
import test from "node:test";

import {
  getCampfireDashboard,
  getSessionForDate,
  NotionRateLimitError,
} from "../app/lib/notion.ts";
import {
  getCampfireDashboard as getDashboardResource,
  NotionResourceRateLimitError,
} from "../app/lib/apis/notion.ts";

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

function sessionPageFor({ id, date }: { id: string; date: string }): Record<string, unknown> {
  return {
    id,
    properties: { 날짜: { type: "date", date: { start: date } } },
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
          taskGroups: [],
          reflection: null,
        },
        {
          id: "participant-two",
          name: "동명이인",
          tasks: [{ id: "task-complete", text: "완료한 Task", checked: true }],
          tasksTotal: 1,
          tasksDone: 1,
          taskGroups: [],
          reflection: null,
        },
        {
          id: "participant-three",
          name: "Task 없음",
          tasks: [],
          tasksTotal: 0,
          tasksDone: 0,
          taskGroups: [],
          reflection: null,
        },
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

test("counts bulleted list items as completed tasks and excludes numbered list items", async (): Promise<void> => {
  const participant = block({
    id: "bullet-participant",
    type: "heading_1",
    text: "글머리 기호 작성자",
    hasChildren: false,
    checked: false,
  });
  const completedBullet = block({
    id: "completed-bullet",
    type: "bulleted_list_item",
    text: "완료한 글머리 작업",
    hasChildren: false,
    checked: false,
  });
  const uncheckedTodo = block({
    id: "unchecked-todo",
    type: "to_do",
    text: "아직 남은 체크박스 작업",
    hasChildren: false,
    checked: false,
  });
  const completedTodo = block({
    id: "completed-todo",
    type: "to_do",
    text: "완료한 체크박스 작업",
    hasChildren: false,
    checked: true,
  });
  const numberedItem = block({
    id: "numbered-item",
    type: "numbered_list_item",
    text: "번호 목록은 작업으로 세지 않음",
    hasChildren: false,
    checked: false,
  });

  await withFetchMock({
    responses: new Map([
      [DATABASE_PATH, { results: [sessionPage()] }],
      [SESSION_PATH, responseBody({ blocks: [participant, completedBullet, uncheckedTodo, completedTodo, numberedItem] })],
    ]),
    run: async (): Promise<void> => {
      const dashboard = await getCampfireDashboard({ NOTION_TOKEN: "test-token", NOTION_DB: DATABASE_ID });
      const participantResult = dashboard.session.participants[0];

      assert.deepEqual(participantResult.tasks, [
        { id: "completed-bullet", text: "완료한 글머리 작업", checked: true },
        { id: "unchecked-todo", text: "아직 남은 체크박스 작업", checked: false },
        { id: "completed-todo", text: "완료한 체크박스 작업", checked: true },
      ]);
      assert.equal(participantResult.tasksTotal, 3);
      assert.equal(participantResult.tasksDone, 2);
    },
  });
});

test("groups exact Task headings and preserves nested Task and reflection content", async (): Promise<void> => {
  const participant = block({
    id: "participant",
    type: "heading_1",
    text: "지혜",
    hasChildren: false,
    checked: false,
  });
  const taskHeading = block({
    id: "task-one-heading",
    type: "heading_3",
    text: "Task  1",
    hasChildren: false,
    checked: false,
  });
  const taskContext = block({
    id: "task-context",
    type: "bulleted_list_item",
    text: "이력서 디벨롭",
    hasChildren: true,
    checked: false,
  });
  const taskCheckbox = block({
    id: "task-checkbox",
    type: "to_do",
    text: "워크플로우 항목 구체화",
    hasChildren: false,
    checked: true,
  });
  const nestedContext = block({
    id: "nested-context",
    type: "bulleted_list_item",
    text: "다음 단계",
    hasChildren: false,
    checked: false,
  });
  const blockerHeading = block({
    id: "blocker-heading",
    type: "heading_3",
    text: "🚧 막힌 점",
    hasChildren: false,
    checked: false,
  });
  const blocker = block({
    id: "blocker",
    type: "paragraph",
    text: "회고가 아니에요",
    hasChildren: false,
    checked: false,
  });
  const reflectionHeading = block({
    id: "reflection-heading",
    type: "heading_3",
    text: "회고",
    hasChildren: false,
    checked: false,
  });
  const reflectionCallout = block({
    id: "reflection-callout",
    type: "callout",
    text: "집중을 잘 못했어요",
    hasChildren: true,
    checked: false,
  });
  const reflectionList = block({
    id: "reflection-list",
    type: "bulleted_list_item",
    text: "개선할 항목부터 처리해요",
    hasChildren: false,
    checked: false,
  });

  await withFetchMock({
    responses: new Map([
      [DATABASE_PATH, { results: [sessionPage()] }],
      [
        SESSION_PATH,
        responseBody({
          blocks: [participant, taskHeading, taskContext, blockerHeading, blocker, reflectionHeading, reflectionCallout],
        }),
      ],
      ["/v1/blocks/task-context/children", responseBody({ blocks: [taskCheckbox, nestedContext] })],
      ["/v1/blocks/reflection-callout/children", responseBody({ blocks: [reflectionList] })],
    ]),
    run: async (): Promise<void> => {
      const dashboard = await getCampfireDashboard({ NOTION_TOKEN: "test-token", NOTION_DB: DATABASE_ID });
      const participantResult = dashboard.session.participants[0];

      assert.deepEqual(participantResult.taskGroups, [
        {
          number: 1,
          tasks: [
            { id: "task-context", text: "이력서 디벨롭", checked: true },
            { id: "task-checkbox", text: "워크플로우 항목 구체화", checked: true },
            { id: "nested-context", text: "다음 단계", checked: true },
          ],
          tasksTotal: 3,
          tasksDone: 3,
          blocks: [
            {
              id: "task-context",
              type: "bulleted_list_item",
              text: "이력서 디벨롭",
              richText: [
                {
                  text: "이력서 디벨롭",
                  href: null,
                  annotations: {
                    bold: false,
                    italic: false,
                    strikethrough: false,
                    underline: false,
                    code: false,
                    color: "default",
                  },
                },
              ],
              metadata: { checked: null, language: null, url: null },
              children: [
                {
                  id: "task-checkbox",
                  type: "to_do",
                  text: "워크플로우 항목 구체화",
                  richText: [
                    {
                      text: "워크플로우 항목 구체화",
                      href: null,
                      annotations: {
                        bold: false,
                        italic: false,
                        strikethrough: false,
                        underline: false,
                        code: false,
                        color: "default",
                      },
                    },
                  ],
                  metadata: { checked: true, language: null, url: null },
                  children: [],
                },
                {
                  id: "nested-context",
                  type: "bulleted_list_item",
                  text: "다음 단계",
                  richText: [
                    {
                      text: "다음 단계",
                      href: null,
                      annotations: {
                        bold: false,
                        italic: false,
                        strikethrough: false,
                        underline: false,
                        code: false,
                        color: "default",
                      },
                    },
                  ],
                  metadata: { checked: null, language: null, url: null },
                  children: [],
                },
              ],
            },
          ],
        },
      ]);
      assert.deepEqual(participantResult.reflection, {
        blocks: [
          {
            id: "reflection-callout",
            type: "callout",
            text: "집중을 잘 못했어요",
            richText: [
              {
                text: "집중을 잘 못했어요",
                href: null,
                annotations: {
                  bold: false,
                  italic: false,
                  strikethrough: false,
                  underline: false,
                  code: false,
                  color: "default",
                },
              },
            ],
            metadata: { checked: null, language: null, url: null },
            children: [
              {
                id: "reflection-list",
                type: "bulleted_list_item",
                text: "개선할 항목부터 처리해요",
                richText: [
                  {
                    text: "개선할 항목부터 처리해요",
                    href: null,
                    annotations: {
                      bold: false,
                      italic: false,
                      strikethrough: false,
                      underline: false,
                      code: false,
                      color: "default",
                    },
                  },
                ],
                metadata: { checked: null, language: null, url: null },
                children: [],
              },
            ],
          },
        ],
      });
      assert.deepEqual(dashboard.session.blockers, [
        {
          id: "blocker",
          participantId: "participant",
          participantName: "지혜",
          content: "회고가 아니에요",
        },
      ]);
    },
  });
});

test("does not count guide questions inside a callout as Task group work", async (): Promise<void> => {
  const participant = block({ id: "participant", type: "heading_1", text: "지혜", hasChildren: false, checked: false });
  const taskHeading = block({ id: "task-two-heading", type: "heading_3", text: "Task 2", hasChildren: false, checked: false });
  const taskTodo = block({ id: "task-todo", type: "to_do", text: "스터디 요금 정산", hasChildren: false, checked: false });
  const guideCallout = block({ id: "guide-callout", type: "callout", text: "", hasChildren: true, checked: false });
  const guideQuestion = block({
    id: "guide-question",
    type: "bulleted_list_item",
    text: "오늘 계획했던 것은 어떻게 되고 있나요?",
    hasChildren: false,
    checked: false,
  });

  await withFetchMock({
    responses: new Map([
      [DATABASE_PATH, { results: [sessionPage()] }],
      [SESSION_PATH, responseBody({ blocks: [participant, taskHeading, taskTodo, guideCallout] })],
      ["/v1/blocks/guide-callout/children", responseBody({ blocks: [guideQuestion] })],
    ]),
    run: async (): Promise<void> => {
      const dashboard = await getCampfireDashboard({ NOTION_TOKEN: "test-token", NOTION_DB: DATABASE_ID });
      const taskGroup = dashboard.session.participants[0].taskGroups[0];

      assert.deepEqual(taskGroup.tasks, [{ id: "task-todo", text: "스터디 요금 정산", checked: false }]);
      assert.equal(taskGroup.tasksTotal, 1);
      assert.equal(taskGroup.tasksDone, 0);
      assert.deepEqual(taskGroup.blocks.map((taskBlock) => taskBlock.id), ["task-todo", "guide-callout"]);
    },
  });
});

test("returns none when the booking date has no Notion session", async (): Promise<void> => {
  await withFetchMock({
    responses: new Map([[DATABASE_PATH, { results: [] }]]),
    run: async (): Promise<void> => {
      const result = await getSessionForDate({
        env: { NOTION_TOKEN: "test-token", NOTION_DB: DATABASE_ID },
        date: "2026-08-30",
      });
      assert.deepEqual(result, { status: "none" });
    },
  });
});

test("returns duplicate when the booking date has more than one Notion session", async (): Promise<void> => {
  await withFetchMock({
    responses: new Map([
      [
        DATABASE_PATH,
        {
          results: [
            sessionPageFor({ id: "first-page", date: "2026-08-30" }),
            sessionPageFor({ id: "second-page", date: "2026-08-30" }),
          ],
        },
      ],
    ]),
    run: async (): Promise<void> => {
      const result = await getSessionForDate({
        env: { NOTION_TOKEN: "test-token", NOTION_DB: DATABASE_ID },
        date: "2026-08-30",
      });
      assert.deepEqual(result, { status: "duplicate", count: 2 });
    },
  });
});

test("uses the Retry-After header for Notion rate limits", async (context): Promise<void> => {
  const delays: number[] = [];
  context.mock.method(globalThis, 'setTimeout', (callback: () => void, delay: number) => {
    delays.push(delay);
    queueMicrotask(callback);
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (): Promise<Response> => {
    return new Response(JSON.stringify({ additional_data: { retry_after: 35 } }), {
      status: 429,
      headers: { "Retry-After": "12" },
    });
  };

  try {
    await assert.rejects(
      getCampfireDashboard({ NOTION_TOKEN: "test-token", NOTION_DB: DATABASE_ID }),
      (error: unknown): boolean => {
        return error instanceof NotionRateLimitError && error.retryAfterSeconds === 12;
      },
    );
    assert.deepEqual(delays, [12_000, 12_000, 12_000]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("falls back to numeric-string Notion retry_after when the header is absent", async (context): Promise<void> => {
  const delays: number[] = [];
  context.mock.method(globalThis, 'setTimeout', (callback: () => void, delay: number) => {
    delays.push(delay);
    queueMicrotask(callback);
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (): Promise<Response> => {
    return new Response(JSON.stringify({ additional_data: { retry_after: "35" } }), { status: 429 });
  };

  try {
    await assert.rejects(
      getSessionForDate({
        env: { NOTION_TOKEN: "test-token", NOTION_DB: DATABASE_ID },
        date: "2026-08-30",
      }),
      (error: unknown): boolean => {
        return error instanceof NotionRateLimitError && error.retryAfterSeconds === 35;
      },
    );
    assert.deepEqual(delays, [35_000, 35_000, 35_000]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("uses a one-second retry fallback for an invalid 429 resource body", async (): Promise<void> => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (): Promise<Response> => new Response("not-json", { status: 429 });

  try {
    await assert.rejects(
      getDashboardResource(),
      (error: unknown): boolean => {
        return error instanceof NotionResourceRateLimitError && error.retryAfterMs === 1_000;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("aggregates personal cumulative records across the full paginated history", async (): Promise<void> => {
  const newestBlocks = [
    block({ id: "newest-ji-hye", type: "heading_1", text: "  김  지혜  ", hasChildren: false, checked: false }),
    block({ id: "newest-complete", type: "to_do", text: "완료", hasChildren: false, checked: true }),
    block({ id: "newest-incomplete", type: "to_do", text: "미완료", hasChildren: false, checked: false }),
    block({ id: "newest-distinct", type: "heading_1", text: "김지혜", hasChildren: false, checked: false }),
    block({ id: "newest-distinct-complete", type: "to_do", text: "완료", hasChildren: false, checked: true }),
    block({ id: "blank-participant", type: "heading_1", text: "   ", hasChildren: false, checked: false }),
    block({ id: "blank-complete", type: "to_do", text: "무시", hasChildren: false, checked: true }),
  ];
  const middleBlocks = [
    block({ id: "middle-ji-hye", type: "heading_1", text: "김 지혜", hasChildren: false, checked: false }),
    block({ id: "middle-complete-one", type: "to_do", text: "완료", hasChildren: false, checked: true }),
    block({ id: "middle-complete-two", type: "bulleted_list_item", text: "완료", hasChildren: false, checked: false }),
  ];
  const oldestBlocks = [
    block({ id: "oldest-ji-hye", type: "heading_1", text: "김 지혜", hasChildren: false, checked: false }),
    block({ id: "oldest-complete", type: "to_do", text: "완료", hasChildren: false, checked: true }),
  ];
  const blockResponses = new Map<string, Record<string, unknown>>([
    ["/v1/blocks/newest-page/children", responseBody({ blocks: newestBlocks })],
    ["/v1/blocks/middle-page/children", responseBody({ blocks: middleBlocks })],
    ["/v1/blocks/oldest-page/children", responseBody({ blocks: oldestBlocks })],
  ]);
  const databaseRequestBodies: string[] = [];
  let activeBlockRequestCount = 0;
  let maximumBlockRequestCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname;
    if (path === DATABASE_PATH) {
      databaseRequestBodies.push(await request.text());
      const response = databaseRequestBodies.length === 1
        ? {
            results: [
              sessionPageFor({ id: "newest-page", date: "2026-09-01" }),
              sessionPageFor({ id: "middle-page", date: "2026-08-15" }),
            ],
            has_more: true,
            next_cursor: "older-sessions",
          }
        : {
            results: [sessionPageFor({ id: "oldest-page", date: "2026-07-01" })],
            has_more: false,
            next_cursor: null,
          };
      return new Response(JSON.stringify(response), { status: 200 });
    }
    const response = blockResponses.get(path);
    if (!response) throw new Error(`Unexpected fetch: ${path}`);
    activeBlockRequestCount += 1;
    maximumBlockRequestCount = Math.max(maximumBlockRequestCount, activeBlockRequestCount);
    await Promise.resolve();
    activeBlockRequestCount -= 1;
    return new Response(JSON.stringify(response), { status: 200 });
  };

  try {
    const dashboard = await getCampfireDashboard({ NOTION_TOKEN: "test-token", NOTION_DB: DATABASE_ID });

    assert.deepEqual(dashboard.personalCumulativeRecords, [
      {
        displayName: "김 지혜",
        participatedSessionCount: 3,
        completedTaskCount: 4,
        firstParticipationDate: "2026-07-01",
        latestParticipationDate: "2026-09-01",
      },
      {
        displayName: "김지혜",
        participatedSessionCount: 1,
        completedTaskCount: 1,
        firstParticipationDate: "2026-09-01",
        latestParticipationDate: "2026-09-01",
      },
    ]);
    assert.equal(databaseRequestBodies.length, 2);
    assert.match(databaseRequestBodies[0], /"direction":"descending"/);
    assert.doesNotMatch(databaseRequestBodies[0], /on_or_after/);
    assert.match(databaseRequestBodies[1], /"start_cursor":"older-sessions"/);
    assert.equal(maximumBlockRequestCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
