// SQLite via Node's built-in node:sqlite (shipped inside Electron 44).
// No native modules, so the build never needs a compiler toolchain.
import { DatabaseSync } from 'node:sqlite'

const MIGRATIONS: string[] = [
  // v1 — initial schema
  `
  CREATE TABLE urls (
    id INTEGER PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL DEFAULT '',
    visit_count INTEGER NOT NULL DEFAULT 0,
    typed_count INTEGER NOT NULL DEFAULT 0,
    last_visit INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX urls_last_visit ON urls(last_visit);

  CREATE TABLE visits (
    id INTEGER PRIMARY KEY,
    url_id INTEGER NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
    time INTEGER NOT NULL,
    typed INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX visits_time ON visits(time);
  CREATE INDEX visits_url ON visits(url_id);

  CREATE VIRTUAL TABLE urls_fts USING fts5(
    title, url, content='urls', content_rowid='id', tokenize='unicode61 remove_diacritics 2'
  );
  CREATE TRIGGER urls_ai AFTER INSERT ON urls BEGIN
    INSERT INTO urls_fts(rowid, title, url) VALUES (new.id, new.title, new.url);
  END;
  CREATE TRIGGER urls_ad AFTER DELETE ON urls BEGIN
    INSERT INTO urls_fts(urls_fts, rowid, title, url) VALUES ('delete', old.id, old.title, old.url);
  END;
  CREATE TRIGGER urls_au AFTER UPDATE OF title, url ON urls BEGIN
    INSERT INTO urls_fts(urls_fts, rowid, title, url) VALUES ('delete', old.id, old.title, old.url);
    INSERT INTO urls_fts(rowid, title, url) VALUES (new.id, new.title, new.url);
  END;

  CREATE TABLE bookmarks (
    id INTEGER PRIMARY KEY,
    parent_id INTEGER REFERENCES bookmarks(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('folder', 'url')),
    title TEXT NOT NULL DEFAULT '',
    url TEXT,
    position REAL NOT NULL DEFAULT 0,
    created INTEGER NOT NULL
  );
  CREATE INDEX bookmarks_parent ON bookmarks(parent_id, position);
  CREATE INDEX bookmarks_url ON bookmarks(url);
  INSERT INTO bookmarks (id, parent_id, kind, title, position, created) VALUES
    (1, NULL, 'folder', 'Favorites bar', 0, 0),
    (2, NULL, 'folder', 'Other favorites', 1, 0);

  CREATE TABLE downloads (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    filename TEXT NOT NULL,
    path TEXT NOT NULL,
    state TEXT NOT NULL,
    received INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    start_time INTEGER NOT NULL,
    end_time INTEGER
  );

  CREATE TABLE permissions (
    origin TEXT NOT NULL,
    permission TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('allow', 'deny')),
    updated INTEGER NOT NULL,
    PRIMARY KEY (origin, permission)
  );

  CREATE TABLE favicons (
    host TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    accent TEXT,
    updated INTEGER NOT NULL
  );

  CREATE TABLE hidden_top_sites (url TEXT PRIMARY KEY);
  `
]

export type Db = DatabaseSync

export function openDatabase(file: string): Db {
  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;')
  migrate(db)
  return db
}

export function migrate(db: Db): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number }
  let version = row.user_version
  while (version < MIGRATIONS.length) {
    db.exec('BEGIN')
    try {
      db.exec(MIGRATIONS[version])
      version++
      db.exec(`PRAGMA user_version = ${version}`)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }
}

export function transaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN')
  try {
    const out = fn()
    db.exec('COMMIT')
    return out
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
