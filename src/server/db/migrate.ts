import type { AppDatabase } from "./database";

const migrationSql = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  title_vi TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'sparkles',
  color TEXT NOT NULL DEFAULT 'coral',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mindmaps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK(status IN ('draft','approved','trashed')) DEFAULT 'draft',
  source TEXT NOT NULL CHECK(source IN ('seed','ai','user')) DEFAULT 'user',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vocabulary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term TEXT NOT NULL,
  normalized_term TEXT NOT NULL UNIQUE,
  ipa TEXT NOT NULL DEFAULT '',
  part_of_speech TEXT NOT NULL DEFAULT '',
  meaning_vi TEXT NOT NULL,
  cefr TEXT NOT NULL CHECK(cefr IN ('A1','A2','B1','B2')) DEFAULT 'A2',
  status TEXT NOT NULL CHECK(status IN ('new','learning','weak','stable')) DEFAULT 'new',
  image_url TEXT,
  audio_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mindmap_nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mindmap_id INTEGER NOT NULL REFERENCES mindmaps(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES mindmap_nodes(id) ON DELETE CASCADE,
  vocabulary_id INTEGER REFERENCES vocabulary(id) ON DELETE SET NULL,
  node_type TEXT NOT NULL CHECK(node_type IN ('root','branch','vocabulary')),
  label TEXT NOT NULL,
  meaning_vi TEXT NOT NULL DEFAULT '',
  ipa TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'coral',
  position_x REAL NOT NULL DEFAULT 0,
  position_y REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS examples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vocabulary_id INTEGER NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  sentence TEXT NOT NULL,
  translation_vi TEXT NOT NULL,
  situation TEXT NOT NULL DEFAULT 'daily life',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS collocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vocabulary_id INTEGER NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  phrase TEXT NOT NULL,
  meaning_vi TEXT NOT NULL DEFAULT '',
  example TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(vocabulary_id, phrase)
);

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vocabulary_id INTEGER REFERENCES vocabulary(id) ON DELETE SET NULL,
  media_type TEXT NOT NULL CHECK(media_type IN ('image','audio','recording')),
  path TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'local',
  mime_type TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS review_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vocabulary_id INTEGER NOT NULL UNIQUE REFERENCES vocabulary(id) ON DELETE CASCADE,
  stability REAL NOT NULL DEFAULT 1,
  difficulty REAL NOT NULL DEFAULT 5,
  interval_days INTEGER NOT NULL DEFAULT 0,
  repetitions INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  due_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS learning_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  duration_minutes INTEGER NOT NULL CHECK(duration_minutes IN (10,20)),
  status TEXT NOT NULL CHECK(status IN ('active','completed','abandoned')) DEFAULT 'active',
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  summary TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS session_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES learning_sessions(id) ON DELETE CASCADE,
  vocabulary_id INTEGER NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  is_new INTEGER NOT NULL DEFAULT 0,
  UNIQUE(session_id, vocabulary_id)
);

CREATE TABLE IF NOT EXISTS review_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER REFERENCES learning_sessions(id) ON DELETE SET NULL,
  vocabulary_id INTEGER NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  prompt_type TEXT NOT NULL,
  answer TEXT NOT NULL DEFAULT '',
  is_correct INTEGER NOT NULL DEFAULT 0,
  response_ms INTEGER NOT NULL DEFAULT 0,
  hints_used INTEGER NOT NULL DEFAULT 0,
  grade TEXT NOT NULL CHECK(grade IN ('again','hard','good','easy')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS speech_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER REFERENCES learning_sessions(id) ON DELETE SET NULL,
  vocabulary_id INTEGER REFERENCES vocabulary(id) ON DELETE SET NULL,
  target_text TEXT NOT NULL,
  audio_path TEXT,
  transcript TEXT NOT NULL DEFAULT '',
  corrected_text TEXT NOT NULL DEFAULT '',
  feedback TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_progress (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  xp INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  weekly_goal_minutes INTEGER NOT NULL DEFAULT 100,
  last_study_date TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purpose TEXT NOT NULL DEFAULT 'tutor',
  title TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL REFERENCES agent_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user','assistant','tool')),
  content TEXT NOT NULL,
  tool_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS generation_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued','running','failed','completed')) DEFAULT 'queued',
  request_json TEXT NOT NULL,
  result_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS draft_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mindmap_id INTEGER NOT NULL REFERENCES mindmaps(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  content_json TEXT NOT NULL,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(mindmap_id, revision)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  size_bytes INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sentence_notebook (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vocabulary_id INTEGER REFERENCES vocabulary(id) ON DELETE SET NULL,
  example_id INTEGER REFERENCES examples(id) ON DELETE SET NULL,
  sentence TEXT NOT NULL,
  translation_vi TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL CHECK(source_type IN ('quoted','user','ai')) DEFAULT 'user',
  source_reference TEXT NOT NULL DEFAULT '',
  fingerprint TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS speaking_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL CHECK(status IN ('active','completed','abandoned')) DEFAULT 'active',
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  total_duration_seconds INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS speaking_session_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES speaking_sessions(id) ON DELETE CASCADE,
  sentence_id INTEGER NOT NULL REFERENCES sentence_notebook(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  UNIQUE(session_id, sentence_id)
);

CREATE TABLE IF NOT EXISTS speaking_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES speaking_sessions(id) ON DELETE CASCADE,
  session_item_id INTEGER REFERENCES speaking_session_items(id) ON DELETE SET NULL,
  sentence_id INTEGER NOT NULL REFERENCES sentence_notebook(id) ON DELETE CASCADE,
  target_text TEXT NOT NULL,
  transcript TEXT NOT NULL DEFAULT '',
  diff_json TEXT NOT NULL DEFAULT '[]',
  content_score REAL NOT NULL DEFAULT 0 CHECK(content_score >= 0 AND content_score <= 1),
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  format TEXT NOT NULL CHECK(format IN ('txt','md','epub')),
  mime_type TEXT NOT NULL DEFAULT '',
  checksum TEXT NOT NULL UNIQUE,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES document_sources(id) ON DELETE CASCADE,
  heading TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(document_id, sort_order)
);

CREATE TABLE IF NOT EXISTS document_highlights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES document_sources(id) ON DELETE CASCADE,
  section_id INTEGER NOT NULL REFERENCES document_sections(id) ON DELETE CASCADE,
  vocabulary_id INTEGER REFERENCES vocabulary(id) ON DELETE SET NULL,
  sentence_id INTEGER REFERENCES sentence_notebook(id) ON DELETE SET NULL,
  selected_text TEXT NOT NULL,
  start_offset INTEGER NOT NULL CHECK(start_offset >= 0),
  end_offset INTEGER NOT NULL CHECK(end_offset >= start_offset),
  source_type TEXT NOT NULL CHECK(source_type IN ('quoted','user','ai')) DEFAULT 'quoted',
  text_fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_topics_sort ON topics(sort_order);
CREATE INDEX IF NOT EXISTS idx_mindmaps_topic ON mindmaps(topic_id, status);
CREATE INDEX IF NOT EXISTS idx_nodes_map ON mindmap_nodes(mindmap_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_review_due ON review_cards(due_at);
CREATE INDEX IF NOT EXISTS idx_attempts_vocab ON review_attempts(vocabulary_id, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON generation_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_notebook_created ON sentence_notebook(created_at);
CREATE INDEX IF NOT EXISTS idx_speaking_attempts_session ON speaking_attempts(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_document_sections_source ON document_sections(document_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_document_highlights_section ON document_highlights(section_id, start_offset);
`;

export function migrate(db: AppDatabase): void {
  db.exec(migrationSql);
  db.prepare("INSERT OR IGNORE INTO schema_migrations(version) VALUES (1)").run();
  db.prepare("INSERT OR IGNORE INTO user_progress(id) VALUES (1)").run();
}
