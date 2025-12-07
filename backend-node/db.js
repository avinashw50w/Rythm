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
        artist TEXT, -- Deprecated, kept for safety
        artist_id INTEGER REFERENCES artists(id),
        album_art_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uploader_id INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      artist TEXT, -- Deprecated, kept for safety
      artist_id INTEGER REFERENCES artists(id),
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

// Migration 1: Add album_id to tracks if not exists
try {
    const colInfo = db.prepare("PRAGMA table_info(tracks)").all();
    const hasAlbumId = colInfo.some(c => c.name === 'album_id');
    
    if (!hasAlbumId) {
        console.log('Migrating tracks table to include album_id...');
        try { db.exec('ALTER TABLE tracks ADD COLUMN album_id INTEGER REFERENCES albums(id)'); } catch (e) { }
        
        // Create Unknown Album if not exists
        let unknownId;
        const unknownRes = db.prepare("SELECT id FROM albums WHERE title = 'Unknown Album'").get();
        if (unknownRes) {
            unknownId = unknownRes.id;
        } else {
            const info = db.prepare("INSERT INTO albums (title, artist) VALUES ('Unknown Album', 'Unknown Artist')").run();
            unknownId = info.lastInsertRowid;
        }

        // Migrate existing tracks
        const tracks = db.prepare('SELECT id, album, uploader_id, artist FROM tracks').all();

        const insertAlbumStmt = db.prepare("INSERT INTO albums (title, artist, uploader_id) VALUES (?, ?, ?)");
        const updateTrackStmt = db.prepare("UPDATE tracks SET album_id = ?, album = ? WHERE id = ?");
        const findAlbumStmt = db.prepare("SELECT id FROM albums WHERE title = ?");

        const transaction = db.transaction((tracks) => {
            for (const track of tracks) {
                let albId = unknownId;
                let albName = track.album;

                if (track.album) {
                    const row = findAlbumStmt.get(track.album);
                    if (row) {
                        albId = row.id;
                    } else {
                        const info = insertAlbumStmt.run(track.album, track.artist || 'Unknown Artist', track.uploader_id);
                        albId = info.lastInsertRowid;
                    }
                } else {
                    albName = 'Unknown Album';
                }
                updateTrackStmt.run(albId, albName, track.id);
            }
        });
        
        transaction(tracks);
        console.log('Migration complete: album_id added.');
    }
} catch (e) {
    console.error("Migration 1 error:", e);
}

// Migration 2: Rename cover_art_path to album_art_path in albums if needed
try {
    const colInfo = db.prepare("PRAGMA table_info(albums)").all();
    const hasCoverArt = colInfo.some(c => c.name === 'cover_art_path');
    if (hasCoverArt) {
        console.log('Migrating albums table: renaming cover_art_path to album_art_path...');
        try { db.exec('ALTER TABLE albums RENAME COLUMN cover_art_path TO album_art_path'); } catch(e){}
    }
} catch (e) {}

// Migration 3: Remove album_art_path from tracks (migrate data first)
try {
    const colInfo = db.prepare("PRAGMA table_info(tracks)").all();
    const hasAlbumArt = colInfo.some(c => c.name === 'album_art_path');
    
    if (hasAlbumArt) {
        console.log('Migrating tracks: moving art to albums and removing column...');
        
        const tracksWithArt = db.prepare("SELECT album_id, album_art_path FROM tracks WHERE album_art_path IS NOT NULL AND album_id IS NOT NULL").all();

        const updateAlbumArt = db.prepare("UPDATE albums SET album_art_path = ? WHERE id = ? AND (album_art_path IS NULL OR album_art_path = '')");
        
        const transaction = db.transaction((items) => {
            for(const t of items) {
                updateAlbumArt.run(t.album_art_path, t.album_id);
            }
        });
        transaction(tracksWithArt);

        try {
          db.exec('ALTER TABLE tracks DROP COLUMN album_art_path');
        } catch(dropErr) {
            // SQLite version might be old or column constrained, ignore
        }
    }
} catch (e) {}

// Migration 4: Add artist_id to tracks and albums and migrate data
try {
    const colInfo = db.prepare("PRAGMA table_info(tracks)").all();
    const hasArtistId = colInfo.some(c => c.name === 'artist_id');

    if (!hasArtistId) {
        console.log('Migrating tracks/albums to include artist_id...');
        try { db.exec('ALTER TABLE tracks ADD COLUMN artist_id INTEGER REFERENCES artists(id)'); } catch (e) {}
        try { db.exec('ALTER TABLE albums ADD COLUMN artist_id INTEGER REFERENCES artists(id)'); } catch (e) {}
        
        // 1. Create Unknown Artist
        let unknownArtistId;
        const uaRes = db.prepare("SELECT id FROM artists WHERE name = 'Unknown Artist'").get();
        if (uaRes) {
            unknownArtistId = uaRes.id;
        } else {
            const info = db.prepare("INSERT INTO artists (name) VALUES ('Unknown Artist')").run();
            unknownArtistId = info.lastInsertRowid;
        }

        // 2. Extract unique artists from tracks and albums
        const artistNames = new Set();
        try {
            const trackArtists = db.prepare("SELECT DISTINCT artist FROM tracks WHERE artist IS NOT NULL AND artist != ''").all();
            trackArtists.forEach(r => artistNames.add(r.artist));
        } catch(e) {}
        
        try {
            const albumArtists = db.prepare("SELECT DISTINCT artist FROM albums WHERE artist IS NOT NULL AND artist != ''").all();
            albumArtists.forEach(r => artistNames.add(r.artist));
        } catch(e) {}

        // 3. Insert artists
        const insertArtistStmt = db.prepare("INSERT OR IGNORE INTO artists (name) VALUES (?)");
        const transaction = db.transaction((names) => {
            for(const name of names) {
                insertArtistStmt.run(name);
            }
        });
        transaction(Array.from(artistNames));

        // 4. Update Tracks with artist_id
        db.exec(`
          UPDATE tracks 
          SET artist_id = (SELECT id FROM artists WHERE name = tracks.artist)
          WHERE artist IS NOT NULL AND artist != ''
        `);
        db.prepare("UPDATE tracks SET artist_id = ? WHERE artist_id IS NULL").run(unknownArtistId);

        // 5. Update Albums with artist_id
        db.exec(`
          UPDATE albums 
          SET artist_id = (SELECT id FROM artists WHERE name = albums.artist)
          WHERE artist IS NOT NULL AND artist != ''
        `);
        db.prepare("UPDATE albums SET artist_id = ? WHERE artist_id IS NULL").run(unknownArtistId);

        console.log('Migration complete: artist_id added.');
    }
} catch (e) {
    console.error("Migration 4 error:", e);
}

module.exports = db;