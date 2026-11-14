import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import test, { type TestContext } from 'node:test';

import { readDashboardResponse, syncNotionDashboard } from '../app/features/notion-data/notion-dashboard.server.ts';

const ENV = { NOTION_TOKEN: 'test-token', NOTION_DB: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' };

// Exercise the migration and actual SQL, including batch rollback, in isolated SQLite.
function createDatabase({ context }: { context: TestContext }) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0002_notion_dashboard.sql', import.meta.url), 'utf8'));
  context.after(() => sqlite.close());
  function prepare(query: string) {
    const statement = sqlite.prepare(query);
    let values: SQLInputValue[] = [];
    return {
      bind(...bindings: SQLInputValue[]) { values = bindings; return this; },
      async first() { return statement.get(...values) ?? null; },
      async all() { return { results: statement.all(...values) }; },
      async run() { return { meta: { changes: Number(statement.run(...values).changes) } }; },
    };
  }
  const db = {
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error: unknown) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  } as D1Database;
  return { db, sqlite };
}

function page({ id, date, revision }: { id: string; date: string; revision: string }) {
  return { id, last_edited_time: revision, properties: { 날짜: { type: 'date', date: { start: date } } } };
}

function sessionBlocks({ done }: { done: boolean }) {
  return { results: [
    { id: 'person', type: 'heading_1', has_children: false, heading_1: { rich_text: [{ plain_text: '  김  지혜  ' }] } },
    { id: 'task', type: 'to_do', has_children: false, to_do: { rich_text: [{ plain_text: '작업' }], checked: done } },
  ], has_more: false, next_cursor: null };
}

function mockNotion({ context, pages }: { context: TestContext; pages: ReturnType<typeof page>[] }) {
  const source = { pages, done: true, failingId: '', blockRequests: [] as string[], databaseRequests: 0 };
  context.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname.endsWith('/query')) {
      source.databaseRequests += 1;
      return Response.json({ results: source.pages, has_more: false, next_cursor: null });
    }
    const id = url.pathname.split('/')[3];
    source.blockRequests.push(id);
    if (id === source.failingId) return new Response('unavailable', { status: 500 });
    return Response.json(sessionBlocks({ done: source.done }));
  });
  return source;
}

test('dashboard read returns structured 503 or the last snapshot without fetching Notion', async (context) => {
  const { db, sqlite } = createDatabase({ context });
  context.mock.method(globalThis, 'fetch', () => { throw new Error('Notion must not be called'); });
  const empty = await readDashboardResponse({ db });
  assert.equal(empty.status, 503);
  assert.equal((await empty.json()).code, 'DASHBOARD_NOT_READY');
  const snapshot = JSON.stringify({ cached: true });
  sqlite.prepare('INSERT INTO notion_dashboard_snapshot VALUES (1, ?, 1)').run(snapshot);
  const cached = await readDashboardResponse({ db });
  assert.equal(cached.status, 200);
  assert.equal(await cached.text(), snapshot);
});

test('initial sync, unchanged reuse, edit replacement, and deletion preserve cumulative semantics', async (context) => {
  const { db, sqlite } = createDatabase({ context });
  const historical = page({ id: 'historical', date: '2026-07-01', revision: 'v1' });
  const cutoff = page({ id: 'cutoff', date: '2026-08-15', revision: 'v1' });
  const newest = page({ id: 'newest', date: '2026-09-01', revision: 'v1' });
  const source = mockNotion({ context, pages: [historical, newest, cutoff] });
  assert.equal(await syncNotionDashboard({ db, env: ENV }), 'complete');
  const initial = await (await readDashboardResponse({ db })).json();
  assert.equal(initial.session.date, '2026-09-01');
  assert.deepEqual(initial.cumulativeMetrics, { sessionCount: 51, completedTaskCount: 460, participantSessionCount: 236 });
  assert.deepEqual(initial.personalCumulativeRecords, [{ displayName: '김 지혜', participatedSessionCount: 3,
    completedTaskCount: 3, firstParticipationDate: '2026-07-01', latestParticipationDate: '2026-09-01' }]);
  assert.equal(await syncNotionDashboard({ db, env: ENV }), 'complete');
  assert.deepEqual(source.blockRequests, ['historical', 'newest', 'cutoff']);

  source.pages = [historical, { ...newest, last_edited_time: 'v2' }, cutoff];
  source.done = false;
  await syncNotionDashboard({ db, env: ENV });
  const edited = await (await readDashboardResponse({ db })).json();
  assert.equal(edited.cumulativeMetrics.completedTaskCount, 459);
  assert.equal(edited.personalCumulativeRecords[0].completedTaskCount, 2);
  assert.deepEqual(source.blockRequests, ['historical', 'newest', 'cutoff', 'newest']);

  source.pages = [historical, cutoff];
  await syncNotionDashboard({ db, env: ENV });
  const deleted = await (await readDashboardResponse({ db })).json();
  assert.equal(deleted.session.date, '2026-08-15');
  assert.equal(deleted.cumulativeMetrics.sessionCount, 50);
  assert.equal(deleted.personalCumulativeRecords[0].participatedSessionCount, 2);
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM notion_session_facts').get()?.count, 2);
});

test('a failed sync preserves the complete snapshot and resumes already parsed pages', async (context) => {
  const { db } = createDatabase({ context });
  const first = page({ id: 'first', date: '2026-09-01', revision: 'v1' });
  const source = mockNotion({ context, pages: [first] });
  await syncNotionDashboard({ db, env: ENV });
  const previous = await (await readDashboardResponse({ db })).text();
  source.done = false;
  source.pages = [{ ...first, last_edited_time: 'v2' }, page({ id: 'second', date: '2026-09-02', revision: 'v1' })];
  source.failingId = 'second';
  await assert.rejects(syncNotionDashboard({ db, env: ENV }), /Notion API 500/);
  assert.equal(await (await readDashboardResponse({ db })).text(), previous);
  source.failingId = '';
  await syncNotionDashboard({ db, env: ENV });
  assert.deepEqual(source.blockRequests, ['first', 'first', 'second', 'second']);
  const completed = await (await readDashboardResponse({ db })).json();
  assert.equal(completed.personalCumulativeRecords[0].completedTaskCount, 0);
});

test('backfill checkpoints after ten changed pages and publishes only when all pages are complete', async (context) => {
  const { db } = createDatabase({ context });
  const source = mockNotion({ context, pages: Array.from({ length: 11 }, (_, index) =>
    page({ id: `page-${index}`, date: '2026-09-01', revision: 'v1' })) });
  assert.equal(await syncNotionDashboard({ db, env: ENV }), 'checkpoint');
  assert.equal((await readDashboardResponse({ db })).status, 503);
  assert.equal(source.blockRequests.length, 10);
  assert.equal(await syncNotionDashboard({ db, env: ENV }), 'complete');
  assert.equal(source.blockRequests.length, 11);
  assert.equal((await readDashboardResponse({ db })).status, 200);
});

test('an active lease excludes another run and an expired lease can recover', async (context) => {
  const { db, sqlite } = createDatabase({ context });
  const source = mockNotion({ context, pages: [page({ id: 'only', date: '2026-09-01', revision: 'v1' })] });
  sqlite.prepare('INSERT INTO notion_sync_lease VALUES (1, ?, ?)').run('other-owner', Date.now() + 60_000);
  assert.equal(await syncNotionDashboard({ db, env: ENV }), 'busy');
  assert.equal(source.databaseRequests, 0);
  sqlite.exec('UPDATE notion_sync_lease SET expires_at = 0');
  assert.equal(await syncNotionDashboard({ db, env: ENV }), 'complete');
  assert.equal(source.databaseRequests, 1);
});

test('lease loss during a page read prevents stale writes and does not release the new owner', async (context) => {
  const { db, sqlite } = createDatabase({ context });
  const source = mockNotion({ context, pages: [page({ id: 'only', date: '2026-09-01', revision: 'v1' })] });
  const originalMock = globalThis.fetch;
  context.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    const response = await originalMock(input);
    if (source.blockRequests.length > 0) sqlite.prepare('UPDATE notion_sync_lease SET owner = ?').run('new-owner');
    return response;
  });
  await assert.rejects(syncNotionDashboard({ db, env: ENV }), /잠금이 만료/);
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM notion_session_facts').get()?.count, 0);
  assert.equal(sqlite.prepare('SELECT owner FROM notion_sync_lease').get()?.owner, 'new-owner');
  assert.equal((await readDashboardResponse({ db })).status, 503);
});

test('snapshot publication and deletion reconciliation roll back together on failure', async (context) => {
  const { db, sqlite } = createDatabase({ context });
  const source = mockNotion({ context, pages: [page({ id: 'old', date: '2026-09-01', revision: 'v1' })] });
  await syncNotionDashboard({ db, env: ENV });
  const previous = await (await readDashboardResponse({ db })).text();
  source.pages = [page({ id: 'new', date: '2026-09-02', revision: 'v1' })];
  sqlite.exec("CREATE TRIGGER fail_publish BEFORE UPDATE ON notion_dashboard_snapshot BEGIN SELECT RAISE(ABORT, 'test publish failure'); END");
  await assert.rejects(syncNotionDashboard({ db, env: ENV }), /test publish failure/);
  assert.equal(await (await readDashboardResponse({ db })).text(), previous);
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM notion_session_facts').get()?.count, 2);
});

test('429 retries only the failed block request and waits for numeric-string retry_after', async (context) => {
  const { db } = createDatabase({ context });
  const source = mockNotion({ context, pages: [page({ id: 'only', date: '2026-09-01', revision: 'v1' })] });
  const originalMock = globalThis.fetch;
  const delays: number[] = [];
  let attempts = 0;
  context.mock.method(globalThis, 'setTimeout', (callback: () => void, delay: number) => {
    delays.push(delay);
    queueMicrotask(callback);
  });
  context.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    if (input.toString().includes('/blocks/') && attempts++ === 0) {
      return Response.json({ additional_data: { retry_after: '2.5' } }, { status: 429 });
    }
    return originalMock(input);
  });
  assert.equal(await syncNotionDashboard({ db, env: ENV }), 'complete');
  assert.equal(attempts, 2);
  assert.equal(source.databaseRequests, 1);
  assert.deepEqual(delays, [2_500]);
});
