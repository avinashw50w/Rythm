const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// Use the existing SQLite database from Python backend
const dbPath = path.join(__dirname, '..', 'sql_app.db');

let db = null;

// Initialize database
async function initDb() {
  const SQL = await initSqlJs();

  // Load existing database if it exists
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');

  // Create tables if they don't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      avatar_url TEXT
    )
  `);

  // Create albums table (renamed cover_art_path to album_art_path)
  db.run(`
    CREATE TABLE IF NOT EXISTS albums (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        artist TEXT,
        album_art_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uploader_id INTEGER REFERENCES users(id)
    )
  `);

  // Create tracks table (removed album_art_path)
  db.run(`
    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      artist TEXT,
      album TEXT,
      genre TEXT,
      file_path TEXT NOT NULL,
      duration REAL,
      bitrate TEXT,
      size INTEGER,
      is_public INTEGER DEFAULT 0,
      uploader_id INTEGER REFERENCES users(id),
      waveform_data TEXT,
      album_id INTEGER REFERENCES albums(id)
    )
  `);

  // --- MIGRATIONS ---

  // Migration 1: Add album_id to tracks if not exists
  try {
      db.exec('SELECT album_id FROM tracks LIMIT 1');
  } catch (e) {
      console.log('Migrating tracks table to include album_id...');
      try {
        db.run('ALTER TABLE tracks ADD COLUMN album_id INTEGER REFERENCES albums(id)');
      } catch (alterError) { }
      
      // Create Unknown Album if not exists
      let unknownId;
      const unknownRes = db.exec("SELECT id FROM albums WHERE title = 'Unknown Album'");
      if (unknownRes.length > 0 && unknownRes[0].values.length > 0) {
          unknownId = unknownRes[0].values[0][0];
      } else {
          db.run("INSERT INTO albums (title, artist) VALUES ('Unknown Album', 'Unknown Artist')");
          unknownId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
      }

      // Migrate existing tracks
      const tracksStmt = db.prepare('SELECT id, album, uploader_id, artist FROM tracks');
      const tracks = [];
      while (tracksStmt.step()) {
          tracks.push(tracksStmt.getAsObject());
      }
      tracksStmt.free();

      const insertAlbumStmt = db.prepare("INSERT INTO albums (title, artist, uploader_id) VALUES (?, ?, ?)");
      const updateTrackStmt = db.prepare("UPDATE tracks SET album_id = ?, album = ? WHERE id = ?");
      const findAlbumStmt = db.prepare("SELECT id FROM albums WHERE title = ?");

      db.exec('BEGIN TRANSACTION');
      for (const track of tracks) {
          let albId = unknownId;
          let albName = track.album;

          if (track.album) {
              findAlbumStmt.reset();
              findAlbumStmt.bind([track.album]);
              if (findAlbumStmt.step()) {
                  const row = findAlbumStmt.getAsObject();
                  albId = row.id;
              } else {
                  insertAlbumStmt.run([track.album, track.artist || 'Unknown Artist', track.uploader_id]);
                  const idRes = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
                  albId = idRes;
              }
          } else {
              albName = 'Unknown Album';
          }
          updateTrackStmt.run([albId, albName, track.id]);
      }
      db.exec('COMMIT');
      
      insertAlbumStmt.free();
      updateTrackStmt.free();
      findAlbumStmt.free();
      console.log('Migration complete: album_id added.');
  }

  // Migration 2: Rename cover_art_path to album_art_path in albums if needed
  try {
      db.exec('SELECT cover_art_path FROM albums LIMIT 1');
      console.log('Migrating albums table: renaming cover_art_path to album_art_path...');
      db.run('ALTER TABLE albums RENAME COLUMN cover_art_path TO album_art_path');
  } catch (e) {
      // Column likely already named album_art_path or table doesn't exist yet
  }

  // Migration 3: Remove album_art_path from tracks (migrate data first)
  try {
      db.exec('SELECT album_art_path FROM tracks LIMIT 1');
      console.log('Migrating tracks: moving art to albums and removing column...');
      
      const tracksWithArt = [];
      const stmt = db.prepare("SELECT album_id, album_art_path FROM tracks WHERE album_art_path IS NOT NULL AND album_id IS NOT NULL");
      while(stmt.step()) {
          tracksWithArt.push(stmt.getAsObject());
      }
      stmt.free();

      const updateAlbumArt = db.prepare("UPDATE albums SET album_art_path = ? WHERE id = ? AND (album_art_path IS NULL OR album_art_path = '')");
      db.exec('BEGIN TRANSACTION');
      for(const t of tracksWithArt) {
          updateAlbumArt.run([t.album_art_path, t.album_id]);
      }
      db.exec('COMMIT');
      updateAlbumArt.free();

      try {
        db.run('ALTER TABLE tracks DROP COLUMN album_art_path');
      } catch(dropErr) {
          // SQLite version might be old, ignore
      }
  } catch (e) {
      // Column already gone
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      creator_id INTEGER REFERENCES users(id),
      is_public INTEGER DEFAULT 0,
      thumbnail_path TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS playlist_tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER REFERENCES playlists(id),
      track_id INTEGER REFERENCES tracks(id),
      "order" INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      track_id INTEGER REFERENCES tracks(id)
    )
  `);

  // Save database periodically
  setInterval(saveDb, 10000); // Every 10 seconds

  return db;
}

// Save database to file
function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// Helper functions to match better-sqlite3 API
function prepare(sql) {
  return {
    run: (...params) => {
      db.run(sql, params);
      return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0], changes: db.getRowsModified() };
    },
    get: (...params) => {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row;
      }
      stmt.free();
      return undefined;
    },
    all: (...params) => {
      const results = [];
      const stmt = db.prepare(sql);
      stmt.bind(params);
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    }
  };
}

module.exports = {
  initDb,
  saveDb,
  prepare,
  getDb: () => db
};