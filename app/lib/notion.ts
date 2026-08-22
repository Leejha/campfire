const NOTION_VERSION = "2022-06-28";
const NOTION_API_BASE = "https://api.notion.com/v1";
const CUMULATIVE_CUTOFF = "2026-08-15";

interface NotionEnv {
  NOTION_TOKEN: string;
  NOTION_DB: string;
}

interface NotionRichText {
  plain_text: string;
}

interface NotionBlock {
  id: string;
  type: string;
  has_children: boolean;
  _children: NotionBlock[];
  [key: string]: unknown;
}

interface NotionPage {
  id: string;
  properties: Record<string, unknown>;
}

export interface SessionParticipant {
  id: string;
  name: string;
  tasks: SessionTask[];
  tasksTotal: number;
  tasksDone: number;
}

export interface SessionTask {
  id: string;
  text: string;
  checked: boolean;
}

export interface SessionBlocker {
  id: string;
  participantId: string;
  participantName: string;
  content: string;
}

export interface LatestSession {
  date: string;
  participants: SessionParticipant[];
  blockers: SessionBlocker[];
}

export interface CumulativeMetrics {
  sessionCount: number;
  completedTaskCount: number;
  participantSessionCount: number;
}

export interface CampfireDashboard {
  session: LatestSession;
  cumulativeMetrics: CumulativeMetrics;
}

const CUMULATIVE_BASELINE: CumulativeMetrics = {
  sessionCount: 50,
  completedTaskCount: 459,
  participantSessionCount: 235,
};

async function notionFetch({
  token,
  path,
  options,
}: {
  token: string;
  path: string;
  options: RequestInit;
}): Promise<unknown> {
  const res = await fetch(`${NOTION_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Notion API ${res.status}: ${body}`);
  }
  return res.json();
}

function extractDatabaseId(rawInput: string): string {
  const match = rawInput.replace(/-/g, "").match(/[0-9a-f]{32}/i);
  if (!match) throw new Error("NOTION_DB에서 DB ID를 찾을 수 없습니다.");
  return match[0];
}

async function querySessionPages({ token, dbId }: { token: string; dbId: string }): Promise<NotionPage[]> {
  const data = (await notionFetch({
    token,
    path: `/databases/${dbId}/query`,
    options: {
      method: "POST",
      body: JSON.stringify({
        filter: {
          property: "날짜",
          date: { on_or_after: CUMULATIVE_CUTOFF },
        },
        sorts: [{ property: "날짜", direction: "descending" }],
        page_size: 100,
      }),
    },
  })) as { results: NotionPage[] };
  if (!data.results[0]) throw new Error("세션 페이지를 찾을 수 없습니다.");
  return data.results;
}

async function fetchBlockChildren({ token, blockId }: { token: string; blockId: string }): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;
  do {
    const qs = cursor ? `?start_cursor=${cursor}&page_size=100` : "?page_size=100";
    const data = (await notionFetch({
      token,
      path: `/blocks/${blockId}/children${qs}`,
      options: {},
    })) as { results: NotionBlock[]; has_more: boolean; next_cursor?: string };
    for (const block of data.results) {
      const canHaveChildren = block.has_children && block.type !== "child_page" && block.type !== "child_database";
      block._children = canHaveChildren ? await fetchBlockChildren({ token, blockId: block.id }) : [];
      blocks.push(block);
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

function plainText(block: NotionBlock): string {
  const body = block[block.type] as { rich_text?: NotionRichText[] } | undefined;
  const richText = body?.rich_text;
  if (!Array.isArray(richText)) return "";
  return richText.map((t) => t.plain_text).join("").trim();
}

function walkBlocks(blocks: NotionBlock[], visit: (block: NotionBlock) => void): void {
  for (const block of blocks) {
    visit(block);
    if (block._children.length) walkBlocks(block._children, visit);
  }
}

interface Section {
  id: string;
  name: string;
  blocks: NotionBlock[];
}

function splitSections(blocks: NotionBlock[]): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const block of blocks) {
    if (block.type === "heading_1") {
      current = { id: block.id, name: plainText(block), blocks: [] };
      sections.push(current);
    } else if (current) {
      current.blocks.push(block);
    }
  }
  return sections;
}

function collectTasks(section: Section): SessionTask[] {
  const tasks: SessionTask[] = [];
  walkBlocks(section.blocks, (block) => {
    if (block.type !== "to_do") return;
    const text = plainText(block);
    if (!text) return;
    const toDo = block.to_do;
    if (!isRecord(toDo) || typeof toDo.checked !== "boolean") {
      throw new Error("to_do 블록의 checked 값을 찾을 수 없습니다.");
    }
    tasks.push({ id: block.id, text, checked: toDo.checked });
  });
  return tasks;
}

function createSessionParticipant(section: Section): SessionParticipant {
  const tasks = collectTasks(section);
  const tasksDone = tasks.filter((task) => task.checked).length;
  return {
    id: section.id,
    name: section.name,
    tasks,
    tasksTotal: tasks.length,
    tasksDone,
  };
}

function collectBlockers({ blocks }: { blocks: NotionBlock[] }): SessionBlocker[] {
  const blockers: SessionBlocker[] = [];
  let participantId = "";
  let participantName = "";
  let isBlockerSection = false;
  walkBlocks(blocks, (block) => {
    const text = plainText(block);
    if (block.type === "heading_1") {
      participantId = block.id;
      participantName = text;
      isBlockerSection = false;
      return;
    }
    if (block.type === "heading_2") {
      isBlockerSection = false;
      return;
    }
    if (block.type === "heading_3") {
      isBlockerSection = text.replace(/\s+/g, " ").trim() === "🚧 막힌 점";
      return;
    }
    if (isBlockerSection && participantId && participantName && text) {
      blockers.push({ id: block.id, participantId, participantName, content: text });
    }
  });
  return blockers;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pageDate(page: NotionPage): string {
  const dateProperty = page.properties["날짜"];
  if (!isRecord(dateProperty) || dateProperty.type !== "date") {
    throw new Error("세션 페이지에서 날짜 속성을 찾을 수 없습니다.");
  }
  const date = dateProperty.date;
  if (!isRecord(date) || typeof date.start !== "string") {
    throw new Error("세션 페이지에서 날짜 속성을 찾을 수 없습니다.");
  }
  return date.start.slice(0, 10);
}

async function parseSession({ token, page }: { token: string; page: NotionPage }): Promise<LatestSession> {
  const blocks = await fetchBlockChildren({ token, blockId: page.id });
  const participants = splitSections(blocks)
    .filter((section) => section.name)
    .map(createSessionParticipant);
  return { date: pageDate(page), participants, blockers: collectBlockers({ blocks }) };
}

function calculateCumulativeMetrics({ recentSessions }: { recentSessions: LatestSession[] }): CumulativeMetrics {
  const completedTaskCount = recentSessions.reduce((total, session) => {
    return total + session.participants.reduce((taskTotal, participant) => taskTotal + participant.tasksDone, 0);
  }, CUMULATIVE_BASELINE.completedTaskCount);
  const participantSessionCount = recentSessions.reduce((total, session) => {
    return total + session.participants.length;
  }, CUMULATIVE_BASELINE.participantSessionCount);
  return {
    sessionCount: CUMULATIVE_BASELINE.sessionCount + recentSessions.length,
    completedTaskCount,
    participantSessionCount,
  };
}

export async function getCampfireDashboard(env: NotionEnv): Promise<CampfireDashboard> {
  const dbId = extractDatabaseId(env.NOTION_DB);
  const pages = await querySessionPages({ token: env.NOTION_TOKEN, dbId });
  // The cutoff date is already represented in the baseline, so only later sessions are added.
  const recentPages = pages.filter((page) => pageDate(page) > CUMULATIVE_CUTOFF);
  const pagesToParse = recentPages.length ? recentPages : [pages[0]];
  const parsedSessions = await Promise.all(pagesToParse.map((page) => parseSession({ token: env.NOTION_TOKEN, page })));
  return {
    session: parsedSessions[0],
    cumulativeMetrics: calculateCumulativeMetrics({ recentSessions: parsedSessions.slice(0, recentPages.length) }),
  };
}
