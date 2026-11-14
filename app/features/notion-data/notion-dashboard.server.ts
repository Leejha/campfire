import {
  calculateCampfireDashboard,
  listNotionSessionPages,
  readNotionSession,
  type LatestSession,
} from '../../lib/notion.ts';

// Longer than the normal batch; expired owners cannot renew or write.
const LEASE_MS = 10 * 60 * 1_000;
const MAX_CHANGED_PAGES = 10;

interface SessionFact {
  page_id: string;
  last_edited_time: string;
  session_json: string;
}

interface SyncOptions {
  db: D1Database;
  env: { NOTION_TOKEN: string; NOTION_DB: string };
}

export async function readDashboardResponse({ db }: Readonly<{ db: D1Database }>): Promise<Response> {
  const snapshot = await db.prepare('SELECT dashboard_json FROM notion_dashboard_snapshot WHERE id = 1')
    .first<{ dashboard_json: string }>();
  return new Response(snapshot?.dashboard_json ?? JSON.stringify({
    code: 'DASHBOARD_NOT_READY',
    message: '대시보드 데이터를 준비하고 있어요. 잠시 후 다시 확인해 주세요.',
  }), {
    status: snapshot === null ? 503 : 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function acquireLease({ db, owner }: Readonly<{ db: D1Database; owner: string }>): Promise<boolean> {
  const now = Date.now();
  const result = await db.prepare(`
    INSERT INTO notion_sync_lease (id, owner, expires_at) VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET owner = excluded.owner, expires_at = excluded.expires_at
    WHERE notion_sync_lease.expires_at <= ?
  `).bind(owner, now + LEASE_MS, now).run();
  return result.meta.changes === 1;
}

async function renewLease({ db, owner }: Readonly<{ db: D1Database; owner: string }>): Promise<void> {
  const now = Date.now();
  const result = await db.prepare(`
    UPDATE notion_sync_lease SET expires_at = ? WHERE id = 1 AND owner = ? AND expires_at > ?
  `).bind(now + LEASE_MS, owner, now).run();
  if (result.meta.changes !== 1) throw new Error('Notion 동기화 잠금이 만료되었습니다.');
}

async function saveFact({ db, owner, fact }: Readonly<{ db: D1Database; owner: string; fact: SessionFact }>): Promise<void> {
  const result = await db.prepare(`
    INSERT INTO notion_session_facts (page_id, last_edited_time, session_json)
    SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM notion_sync_lease WHERE id = 1 AND owner = ? AND expires_at > ?)
    ON CONFLICT(page_id) DO UPDATE SET last_edited_time = excluded.last_edited_time, session_json = excluded.session_json
  `).bind(fact.page_id, fact.last_edited_time, fact.session_json, owner, Date.now()).run();
  if (result.meta.changes !== 1) throw new Error('Notion 동기화 잠금이 만료되었습니다.');
}

async function publishSnapshot({ db, owner, facts }: Readonly<{ db: D1Database; owner: string; facts: SessionFact[] }>): Promise<void> {
  await renewLease({ db, owner });
  // These JSON values were produced by our validated Notion parser, not clients.
  const sessions: LatestSession[] = facts.map((fact) => JSON.parse(fact.session_json));
  const dashboard = sessions.length === 0 ? null : calculateCampfireDashboard({ sessions });
  const now = Date.now();
  const ownsLease = 'EXISTS (SELECT 1 FROM notion_sync_lease WHERE id = 1 AND owner = ? AND expires_at > ?)';
  const publish = dashboard === null
    ? db.prepare(`DELETE FROM notion_dashboard_snapshot WHERE id = 1 AND ${ownsLease}`).bind(owner, now)
    : db.prepare(`
        INSERT INTO notion_dashboard_snapshot (id, dashboard_json, synced_at)
        SELECT 1, ?, ? WHERE ${ownsLease}
        ON CONFLICT(id) DO UPDATE SET dashboard_json = excluded.dashboard_json, synced_at = excluded.synced_at
      `).bind(JSON.stringify(dashboard), now, owner, now);
  const results = await db.batch([
    db.prepare(`DELETE FROM notion_session_facts WHERE page_id NOT IN (SELECT value FROM json_each(?)) AND ${ownsLease}`)
      .bind(JSON.stringify(facts.map((fact) => fact.page_id)), owner, now),
    publish,
    db.prepare('DELETE FROM notion_sync_lease WHERE id = 1 AND owner = ? AND expires_at > ?').bind(owner, now),
  ]);
  if (results[2].meta.changes !== 1) throw new Error('Notion 동기화 잠금이 만료되었습니다.');
}

async function synchronizePages({ db, env, owner }: Readonly<SyncOptions & { owner: string }>): Promise<'complete' | 'checkpoint'> {
  const pages = await listNotionSessionPages({ env });
  const stored = await db.prepare('SELECT page_id, last_edited_time, session_json FROM notion_session_facts').all<SessionFact>();
  const cached = new Map(stored.results.map((fact) => [fact.page_id, fact]));
  const facts: SessionFact[] = [];
  let changedPages = 0;
  for (const page of pages) {
    const revision = page.lastEditedTime;
    if (revision === null) throw new Error('Notion 페이지 수정 시각을 찾을 수 없습니다.');
    let fact = cached.get(page.id);
    if (fact?.last_edited_time !== revision) {
      if (changedPages >= MAX_CHANGED_PAGES) return 'checkpoint';
      await renewLease({ db, owner });
      const session = await readNotionSession({ env, page });
      fact = { page_id: page.id, last_edited_time: revision, session_json: JSON.stringify(session) };
      await saveFact({ db, owner, fact });
      changedPages += 1;
    }
    facts.push(fact);
  }
  await publishSnapshot({ db, owner, facts });
  return 'complete';
}

export async function syncNotionDashboard({ db, env }: Readonly<SyncOptions>): Promise<'complete' | 'checkpoint' | 'busy'> {
  const owner = crypto.randomUUID();
  if (!await acquireLease({ db, owner })) return 'busy';
  try {
    return await synchronizePages({ db, env, owner });
  } finally {
    await db.prepare('DELETE FROM notion_sync_lease WHERE id = 1 AND owner = ?').bind(owner).run();
  }
}
