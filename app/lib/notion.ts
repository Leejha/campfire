const NOTION_VERSION = '2022-06-28';
const NOTION_API_BASE = 'https://api.notion.com/v1';
const CUMULATIVE_CUTOFF = '2026-08-15';

export class NotionRateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor({ retryAfterSeconds }: Readonly<{ retryAfterSeconds: number }>) {
    super(`Notion API 요청 한도에 도달했어요. ${retryAfterSeconds}초 뒤에 다시 시도해 주세요.`);
    this.name = 'NotionRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

interface NotionEnv {
  NOTION_TOKEN: string;
  NOTION_DB: string;
}

interface NotionAnnotations {
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  underline: boolean;
  code: boolean;
  color: string;
}

export interface SessionRichText {
  text: string;
  href: string | null;
  annotations: NotionAnnotations;
}

export interface SessionContentMetadata {
  checked: boolean | null;
  language: string | null;
  url: string | null;
}

export interface SessionContentBlock {
  id: string;
  type: string;
  text: string;
  richText: SessionRichText[];
  metadata: SessionContentMetadata;
  children: SessionContentBlock[];
}

export interface SessionTask {
  id: string;
  text: string;
  checked: boolean;
}

export interface SessionTaskGroup {
  number: number;
  blocks: SessionContentBlock[];
  tasks: SessionTask[];
  tasksTotal: number;
  tasksDone: number;
}

export interface SessionReflection {
  blocks: SessionContentBlock[];
}

export interface SessionParticipant {
  id: string;
  name: string;
  tasks: SessionTask[];
  tasksTotal: number;
  tasksDone: number;
  taskGroups: SessionTaskGroup[];
  reflection: SessionReflection | null;
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

export interface PersonalCumulativeRecord {
  displayName: string;
  participatedSessionCount: number;
  completedTaskCount: number;
  firstParticipationDate: string;
  latestParticipationDate: string;
}

export interface CampfireDashboard {
  session: LatestSession;
  cumulativeMetrics: CumulativeMetrics;
  personalCumulativeRecords: PersonalCumulativeRecord[];
}

export type SessionLookupResult =
  | { status: 'none' }
  | { status: 'duplicate'; count: number }
  | { status: 'found'; session: LatestSession };

interface NotionBlock {
  id: string;
  type: string;
  hasChildren: boolean;
  data: Record<string, unknown>;
  children: NotionBlock[];
}

interface NotionPage {
  id: string;
  lastEditedTime: string | null;
  properties: Record<string, unknown>;
}

interface Section {
  id: string;
  name: string;
  blocks: NotionBlock[];
}

const CUMULATIVE_BASELINE: CumulativeMetrics = {
  sessionCount: 50,
  completedTaskCount: 459,
  participantSessionCount: 235,
};

async function notionFetch({ token, path, options }: Readonly<{ token: string; path: string; options: RequestInit }>): Promise<unknown> {
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(`${NOTION_API_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429 || res.status === 529) {
        const retryAfterSeconds = getRetryAfterSeconds({ body, retryAfterHeader: res.headers.get('Retry-After') });
        if (attempt < 3) {
          await new Promise<void>((resolve) => setTimeout(resolve, retryAfterSeconds * 1_000));
          continue;
        }
        throw new NotionRateLimitError({ retryAfterSeconds });
      }
      throw new Error(`Notion API ${res.status}: ${body}`);
    }
    return res.json();
  }
}

function getRetryAfterSeconds({
  body,
  retryAfterHeader,
}: Readonly<{ body: string; retryAfterHeader: string | null }>): number {
  const headerSeconds = retryAfterHeader === null ? null : Number(retryAfterHeader);
  if (Number.isFinite(headerSeconds) && headerSeconds !== null && headerSeconds > 0) return headerSeconds;
  return getRetryAfterSecondsFromBody({ body });
}

function getRetryAfterSecondsFromBody({ body }: Readonly<{ body: string }>): number {
  try {
    const parsed: unknown = JSON.parse(body);
    if (!isRecord(parsed) || !isRecord(parsed.additional_data)) return 1;
    const value = parsed.additional_data.retry_after;
    const retryAfter = typeof value === 'string' ? Number(value) : value;
    if (typeof retryAfter !== 'number' || !Number.isFinite(retryAfter) || retryAfter <= 0) return 1;
    return retryAfter;
  } catch (error: unknown) {
    if (error instanceof SyntaxError) return 1;
    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requiredString({ value, message }: Readonly<{ value: unknown; message: string }>): string {
  if (typeof value !== 'string') throw new Error(message);
  return value;
}

function optionalString({ value, message }: Readonly<{ value: unknown; message: string }>): string | null {
  if (value === undefined || value === null) return null;
  return requiredString({ value, message });
}

function optionalBoolean({ value, message }: Readonly<{ value: unknown; message: string }>): boolean {
  if (value === undefined) return false;
  if (typeof value !== 'boolean') throw new Error(message);
  return value;
}

function requiredRecord({ value, message }: Readonly<{ value: unknown; message: string }>): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(message);
  return value;
}

function extractDatabaseId(rawInput: string): string {
  const match = rawInput.replace(/-/g, '').match(/[0-9a-f]{32}/i);
  if (!match) throw new Error('NOTION_DB에서 DB ID를 찾을 수 없습니다.');
  return match[0];
}

function parsePage(value: unknown): NotionPage {
  const page = requiredRecord({ value, message: 'Notion 페이지 형식이 올바르지 않습니다.' });
  return {
    id: requiredString({ value: page.id, message: 'Notion 페이지 ID를 찾을 수 없습니다.' }),
    lastEditedTime: optionalString({ value: page.last_edited_time, message: 'Notion 수정 시각 형식이 올바르지 않습니다.' }),
    properties: requiredRecord({ value: page.properties, message: 'Notion 페이지 속성을 찾을 수 없습니다.' }),
  };
}

interface NotionPageResponse {
  pages: NotionPage[];
  hasMore: boolean;
  nextCursor: string | null;
}

function parsePageResponse(value: unknown): NotionPageResponse {
  const data = requiredRecord({ value, message: 'Notion 데이터베이스 응답 형식이 올바르지 않습니다.' });
  if (!Array.isArray(data.results)) throw new Error('Notion 데이터베이스 결과를 찾을 수 없습니다.');
  const hasMore = optionalBoolean({ value: data.has_more, message: 'Notion 데이터베이스 다음 페이지 정보를 찾을 수 없습니다.' });
  const nextCursor = optionalString({ value: data.next_cursor, message: 'Notion 데이터베이스 커서 형식이 올바르지 않습니다.' });
  if (hasMore && !nextCursor) throw new Error('Notion 데이터베이스 다음 페이지 커서를 찾을 수 없습니다.');
  return { pages: data.results.map(parsePage), hasMore, nextCursor };
}

async function querySessionPages({ token, dbId }: Readonly<{ token: string; dbId: string }>): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let cursor: string | null = null;
  do {
    const pagination = cursor === null ? {} : { start_cursor: cursor };
    const data = await notionFetch({
      token,
      path: `/databases/${dbId}/query`,
      options: {
        method: 'POST',
        body: JSON.stringify({
          ...pagination,
          sorts: [{ property: '날짜', direction: 'descending' }],
          page_size: 100,
        }),
      },
    });
    const response = parsePageResponse(data);
    pages.push(...response.pages);
    cursor = response.hasMore ? response.nextCursor : null;
  } while (cursor);
  return pages;
}

function assertSessionDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('세션 날짜는 YYYY-MM-DD 형식이어야 합니다.');
}

async function queryPagesForDate({ token, dbId, date }: Readonly<{ token: string; dbId: string; date: string }>): Promise<NotionPage[]> {
  assertSessionDate(date);
  const data = await notionFetch({
    token,
    path: `/databases/${dbId}/query`,
    options: {
      method: 'POST',
      body: JSON.stringify({
        filter: { property: '날짜', date: { equals: date } },
        page_size: 100,
      }),
    },
  });
  return parsePageResponse(data).pages;
}

function parseNotionBlock(value: unknown): NotionBlock {
  const rawBlock = requiredRecord({ value, message: 'Notion 블록 형식이 올바르지 않습니다.' });
  const id = requiredString({ value: rawBlock.id, message: 'Notion 블록 ID를 찾을 수 없습니다.' });
  const type = requiredString({ value: rawBlock.type, message: 'Notion 블록 type을 찾을 수 없습니다.' });
  if (typeof rawBlock.has_children !== 'boolean') throw new Error('Notion 블록 has_children 값을 찾을 수 없습니다.');
  const data = requiredRecord({ value: rawBlock[type], message: `${type} 블록 내용을 찾을 수 없습니다.` });
  return { id, type, hasChildren: rawBlock.has_children, data, children: [] };
}

function parseBlockResponse(value: unknown): { blocks: NotionBlock[]; hasMore: boolean; nextCursor: string | null } {
  const data = requiredRecord({ value, message: 'Notion 블록 응답 형식이 올바르지 않습니다.' });
  if (!Array.isArray(data.results)) throw new Error('Notion 블록 결과를 찾을 수 없습니다.');
  if (typeof data.has_more !== 'boolean') throw new Error('Notion 블록 다음 페이지 정보를 찾을 수 없습니다.');
  const nextCursor = optionalString({ value: data.next_cursor, message: 'Notion 블록 커서 형식이 올바르지 않습니다.' });
  if (data.has_more && !nextCursor) throw new Error('Notion 블록 다음 페이지 커서를 찾을 수 없습니다.');
  return { blocks: data.results.map(parseNotionBlock), hasMore: data.has_more, nextCursor };
}

async function fetchBlockChildren({ token, blockId }: Readonly<{ token: string; blockId: string }>): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | null = null;
  do {
    const qs = cursor ? `?start_cursor=${cursor}&page_size=100` : '?page_size=100';
    const data = await notionFetch({ token, path: `/blocks/${blockId}/children${qs}`, options: {} });
    const response = parseBlockResponse(data);
    for (const block of response.blocks) {
      const canHaveChildren = block.hasChildren && block.type !== 'child_page' && block.type !== 'child_database';
      block.children = canHaveChildren ? await fetchBlockChildren({ token, blockId: block.id }) : [];
      blocks.push(block);
    }
    cursor = response.hasMore ? response.nextCursor : null;
  } while (cursor);
  return blocks;
}

function parseAnnotations(value: unknown): NotionAnnotations {
  const annotations = value === undefined ? {} : requiredRecord({ value, message: 'Notion rich_text 서식이 올바르지 않습니다.' });
  const color = annotations.color === undefined ? 'default' : requiredString({ value: annotations.color, message: 'Notion rich_text 색상 형식이 올바르지 않습니다.' });
  return {
    bold: optionalBoolean({ value: annotations.bold, message: 'Notion rich_text bold 형식이 올바르지 않습니다.' }),
    italic: optionalBoolean({ value: annotations.italic, message: 'Notion rich_text italic 형식이 올바르지 않습니다.' }),
    strikethrough: optionalBoolean({ value: annotations.strikethrough, message: 'Notion rich_text strikethrough 형식이 올바르지 않습니다.' }),
    underline: optionalBoolean({ value: annotations.underline, message: 'Notion rich_text underline 형식이 올바르지 않습니다.' }),
    code: optionalBoolean({ value: annotations.code, message: 'Notion rich_text code 형식이 올바르지 않습니다.' }),
    color,
  };
}

function parseRichText(value: unknown): SessionRichText {
  const richText = requiredRecord({ value, message: 'Notion rich_text 형식이 올바르지 않습니다.' });
  return {
    text: requiredString({ value: richText.plain_text, message: 'Notion rich_text 내용을 찾을 수 없습니다.' }),
    href: optionalString({ value: richText.href, message: 'Notion rich_text 링크 형식이 올바르지 않습니다.' }),
    annotations: parseAnnotations(richText.annotations),
  };
}

function blockRichText(block: NotionBlock): SessionRichText[] {
  const richText = block.data.rich_text;
  if (richText === undefined) return [];
  if (!Array.isArray(richText)) throw new Error(`${block.type} 블록의 rich_text 형식이 올바르지 않습니다.`);
  return richText.map(parseRichText);
}

function fallbackBlockText(block: NotionBlock): string {
  const title = optionalString({ value: block.data.title, message: `${block.type} 블록 제목 형식이 올바르지 않습니다.` });
  if (title) return title.trim();
  const expression = optionalString({ value: block.data.expression, message: `${block.type} 블록 수식 형식이 올바르지 않습니다.` });
  if (expression) return expression.trim();
  const caption = block.data.caption;
  if (caption === undefined) return '';
  if (!Array.isArray(caption)) throw new Error(`${block.type} 블록 캡션 형식이 올바르지 않습니다.`);
  return caption
    .map(parseRichText)
    .map((richText) => richText.text)
    .join('')
    .trim();
}

function plainText(block: NotionBlock): string {
  const text = blockRichText(block)
    .map((richText) => richText.text)
    .join('')
    .trim();
  return text || fallbackBlockText(block);
}

function toDoChecked(block: NotionBlock): boolean | null {
  if (block.type !== 'to_do') return null;
  if (typeof block.data.checked !== 'boolean') throw new Error('to_do 블록의 checked 값을 찾을 수 없습니다.');
  return block.data.checked;
}

function blockLanguage(block: NotionBlock): string | null {
  if (block.type !== 'code') return null;
  return optionalString({ value: block.data.language, message: 'code 블록 언어 형식이 올바르지 않습니다.' });
}

function blockUrl(block: NotionBlock): string | null {
  const directUrl = optionalString({ value: block.data.url, message: `${block.type} 블록 링크 형식이 올바르지 않습니다.` });
  if (directUrl) return directUrl;
  const external = block.data.external;
  if (isRecord(external)) return optionalString({ value: external.url, message: `${block.type} 블록 외부 링크 형식이 올바르지 않습니다.` });
  const file = block.data.file;
  if (isRecord(file)) return optionalString({ value: file.url, message: `${block.type} 블록 파일 링크 형식이 올바르지 않습니다.` });
  return null;
}

function toSessionContentBlock(block: NotionBlock): SessionContentBlock {
  const richText = blockRichText(block);
  const richTextValue = richText.map((item) => item.text).join('').trim();
  const text = richTextValue || fallbackBlockText(block);
  return {
    id: block.id,
    type: block.type,
    text,
    richText,
    metadata: { checked: toDoChecked(block), language: blockLanguage(block), url: blockUrl(block) },
    children: block.children.map(toSessionContentBlock),
  };
}

function walkBlocks(blocks: NotionBlock[], visit: (block: NotionBlock) => void): void {
  for (const block of blocks) {
    visit(block);
    if (block.children.length) walkBlocks(block.children, visit);
  }
}

function splitSections(blocks: NotionBlock[]): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const block of blocks) {
    if (block.type === 'heading_1') {
      current = { id: block.id, name: plainText(block), blocks: [] };
      sections.push(current);
    } else if (current) {
      current.blocks.push(block);
    }
  }
  return sections;
}

function normalizeHeading(block: NotionBlock): string {
  return plainText(block).replace(/\s+/g, ' ').trim();
}

function taskNumber(block: NotionBlock): number | null {
  if (block.type !== 'heading_3') return null;
  const match = normalizeHeading(block).match(/^Task ([1-9]\d*)$/);
  if (!match) return null;
  return Number(match[1]);
}

function collectTasks(blocks: NotionBlock[]): SessionTask[] {
  const tasks: SessionTask[] = [];
  walkBlocks(blocks, (block) => {
    const isBulletTask = block.type === 'bulleted_list_item';
    if (block.type !== 'to_do' && !isBulletTask) return;
    const text = plainText(block);
    if (!text) return;
    if (isBulletTask) {
      tasks.push({ id: block.id, text, checked: true });
      return;
    }
    const checked = toDoChecked(block);
    if (checked === null) throw new Error('to_do 블록의 checked 값을 찾을 수 없습니다.');
    tasks.push({ id: block.id, text, checked });
  });
  return tasks;
}

function createTaskGroup({ number, blocks }: Readonly<{ number: number; blocks: NotionBlock[] }>): SessionTaskGroup {
  const tasks = collectTasks(blocks.filter((block) => block.type !== 'callout'));
  return {
    number,
    blocks: blocks.map(toSessionContentBlock),
    tasks,
    tasksTotal: tasks.length,
    tasksDone: tasks.filter((task) => task.checked).length,
  };
}

function collectParticipantDetails(section: Section): { taskGroups: SessionTaskGroup[]; reflection: SessionReflection | null } {
  const taskGroups: SessionTaskGroup[] = [];
  let reflection: SessionReflection | null = null;
  let activeBlocks: NotionBlock[] | null = null;
  let activeTaskNumber: number | null = null;
  let collectingReflection = false;

  const finishActiveSection = (): void => {
    if (activeTaskNumber !== null && activeBlocks) taskGroups.push(createTaskGroup({ number: activeTaskNumber, blocks: activeBlocks }));
    if (collectingReflection && activeBlocks) reflection = { blocks: activeBlocks.map(toSessionContentBlock) };
    activeBlocks = null;
    activeTaskNumber = null;
    collectingReflection = false;
  };

  for (const block of section.blocks) {
    const nextTaskNumber = taskNumber(block);
    const isReflectionHeading = block.type === 'heading_3' && normalizeHeading(block) === '회고';
    const isSectionBoundary = block.type === 'heading_2' || block.type === 'heading_3';
    if (nextTaskNumber !== null || isReflectionHeading || isSectionBoundary) {
      finishActiveSection();
      if (nextTaskNumber !== null) {
        activeTaskNumber = nextTaskNumber;
        activeBlocks = [];
      } else if (isReflectionHeading) {
        collectingReflection = true;
        activeBlocks = [];
      }
      continue;
    }
    if (activeBlocks) activeBlocks.push(block);
  }
  finishActiveSection();
  return { taskGroups, reflection };
}

function createSessionParticipant(section: Section): SessionParticipant {
  const tasks = collectTasks(section.blocks);
  const details = collectParticipantDetails(section);
  return {
    id: section.id,
    name: section.name,
    tasks,
    tasksTotal: tasks.length,
    tasksDone: tasks.filter((task) => task.checked).length,
    taskGroups: details.taskGroups,
    reflection: details.reflection,
  };
}

function collectBlockers({ blocks }: Readonly<{ blocks: NotionBlock[] }>): SessionBlocker[] {
  const blockers: SessionBlocker[] = [];
  let participantId = '';
  let participantName = '';
  let isBlockerSection = false;
  walkBlocks(blocks, (block) => {
    const text = plainText(block);
    if (block.type === 'heading_1') {
      participantId = block.id;
      participantName = text;
      isBlockerSection = false;
      return;
    }
    if (block.type === 'heading_2') {
      isBlockerSection = false;
      return;
    }
    if (block.type === 'heading_3') {
      isBlockerSection = normalizeHeading(block) === '🚧 막힌 점';
      return;
    }
    if (isBlockerSection && participantId && participantName && text) {
      blockers.push({ id: block.id, participantId, participantName, content: text });
    }
  });
  return blockers;
}

function pageDate(page: NotionPage): string {
  const dateProperty = page.properties['날짜'];
  const property = requiredRecord({ value: dateProperty, message: '세션 페이지에서 날짜 속성을 찾을 수 없습니다.' });
  if (property.type !== 'date') throw new Error('세션 페이지에서 날짜 속성을 찾을 수 없습니다.');
  const date = requiredRecord({ value: property.date, message: '세션 페이지에서 날짜 속성을 찾을 수 없습니다.' });
  return requiredString({ value: date.start, message: '세션 페이지에서 날짜 속성을 찾을 수 없습니다.' }).slice(0, 10);
}

async function parseSession({ token, page }: Readonly<{ token: string; page: NotionPage }>): Promise<LatestSession> {
  const blocks = await fetchBlockChildren({ token, blockId: page.id });
  const participants = splitSections(blocks)
    .filter((section) => section.name)
    .map(createSessionParticipant);
  return { date: pageDate(page), participants, blockers: collectBlockers({ blocks }) };
}

function calculateCumulativeMetrics({ recentSessions }: Readonly<{ recentSessions: LatestSession[] }>): CumulativeMetrics {
  const completedTaskCount = recentSessions.reduce((total, session) => {
    return total + session.participants.reduce((taskTotal, participant) => taskTotal + participant.tasksDone, 0);
  }, CUMULATIVE_BASELINE.completedTaskCount);
  const participantSessionCount = recentSessions.reduce((total, session) => total + session.participants.length, CUMULATIVE_BASELINE.participantSessionCount);
  return {
    sessionCount: CUMULATIVE_BASELINE.sessionCount + recentSessions.length,
    completedTaskCount,
    participantSessionCount,
  };
}

function normalizeParticipantDisplayName({ name }: Readonly<{ name: string }>): string {
  return name.trim().replace(/\s+/g, ' ');
}

function calculatePersonalCumulativeRecords({ sessions }: Readonly<{ sessions: LatestSession[] }>): PersonalCumulativeRecord[] {
  const records = new Map<string, PersonalCumulativeRecord>();
  for (const session of sessions) {
    const completedTaskCounts = new Map<string, number>();
    for (const participant of session.participants) {
      const displayName = normalizeParticipantDisplayName({ name: participant.name });
      if (!displayName) continue;
      const completedTaskCount = completedTaskCounts.get(displayName) ?? 0;
      completedTaskCounts.set(displayName, completedTaskCount + participant.tasksDone);
    }
    for (const [displayName, completedTaskCount] of completedTaskCounts) {
      const record = records.get(displayName);
      if (record) {
        record.participatedSessionCount += 1;
        record.completedTaskCount += completedTaskCount;
        record.firstParticipationDate = session.date < record.firstParticipationDate ? session.date : record.firstParticipationDate;
        record.latestParticipationDate = session.date > record.latestParticipationDate ? session.date : record.latestParticipationDate;
        continue;
      }
      records.set(displayName, {
        displayName,
        participatedSessionCount: 1,
        completedTaskCount,
        firstParticipationDate: session.date,
        latestParticipationDate: session.date,
      });
    }
  }
  return [...records.values()];
}

export async function getSessionForDate({ env, date }: Readonly<{ env: NotionEnv; date: string }>): Promise<SessionLookupResult> {
  const dbId = extractDatabaseId(env.NOTION_DB);
  const pages = await queryPagesForDate({ token: env.NOTION_TOKEN, dbId, date });
  if (pages.length === 0) return { status: 'none' };
  if (pages.length > 1) return { status: 'duplicate', count: pages.length };
  return { status: 'found', session: await parseSession({ token: env.NOTION_TOKEN, page: pages[0] }) };
}

export async function getCampfireDashboard(env: NotionEnv): Promise<CampfireDashboard> {
  const dbId = extractDatabaseId(env.NOTION_DB);
  const pages = await querySessionPages({ token: env.NOTION_TOKEN, dbId });
  const parsedSessions: LatestSession[] = [];
  for (const page of pages) {
    parsedSessions.push(await parseSession({ token: env.NOTION_TOKEN, page }));
  }
  return calculateCampfireDashboard({ sessions: parsedSessions });
}

export function calculateCampfireDashboard({ sessions }: Readonly<{ sessions: LatestSession[] }>): CampfireDashboard {
  const parsedSessions = [...sessions].sort((left, right) => right.date.localeCompare(left.date));
  if (!parsedSessions[0]) throw new Error('세션 페이지를 찾을 수 없습니다.');
  const recentSessions = parsedSessions.filter((session) => session.date > CUMULATIVE_CUTOFF);
  return {
    session: parsedSessions[0],
    cumulativeMetrics: calculateCumulativeMetrics({ recentSessions }),
    personalCumulativeRecords: calculatePersonalCumulativeRecords({ sessions: parsedSessions }),
  };
}

export async function listNotionSessionPages({ env }: Readonly<{ env: NotionEnv }>): Promise<NotionPage[]> {
  return querySessionPages({ token: env.NOTION_TOKEN, dbId: extractDatabaseId(env.NOTION_DB) });
}

export async function readNotionSession({ env, page }: Readonly<{ env: NotionEnv; page: NotionPage }>): Promise<LatestSession> {
  return parseSession({ token: env.NOTION_TOKEN, page });
}
