CREATE TABLE notion_session_facts (
  page_id TEXT PRIMARY KEY,
  last_edited_time TEXT NOT NULL,
  session_json TEXT NOT NULL CHECK (json_valid(session_json))
);

CREATE TABLE notion_dashboard_snapshot (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  dashboard_json TEXT NOT NULL CHECK (json_valid(dashboard_json)),
  synced_at INTEGER NOT NULL
);

CREATE TABLE notion_sync_lease (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  owner TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
