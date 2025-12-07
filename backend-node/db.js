const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Use the existing SQLite database file
const dbPath = path.join(__dirname, '..', 'sql_app.db');

// Initialize database with file path
const db = new Database(dbPath, { 
    // verbose: console.log 
});

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables if they don't exist
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      avatar_url TEXT
    );

    CREATE TABLE IF NOT EXISTS artists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        bio TEXT,
        image_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS albums (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        artist_id INTEGER REFERENCES artists(id),
        album_art_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uploader_id INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      artist_id INTEGER REFERENCES artists(id),
      genre TEXT,
      file_path TEXT NOT NULL,
      duration REAL,
      bitrate TEXT,
      size INTEGER,
      is_public INTEGER DEFAULT 0,
      uploader_id INTEGER REFERENCES users(id),
      waveform_data TEXT,
      album_id INTEGER REFERENCES albums(id)
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      creator_id INTEGER REFERENCES users(id),
      is_public INTEGER DEFAULT 0,
      thumbnail_path TEXT
    );

    CREATE TABLE IF NOT EXISTS playlist_tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER REFERENCES playlists(id),
      track_id INTEGER REFERENCES tracks(id),
      "order" INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      track_id INTEGER REFERENCES tracks(id)
    );
`);

// --- MIGRATIONS ---

function columnExists(table, column) {
    const info = db.prepare(`PRAGMA table_info(${table})`).all();
    return info.some(c => c.name === column);
}

module.exports = db;