CREATE TABLE IF NOT EXISTS study_sessions (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  session_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
