const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth, optionalAuth } = require('../auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', '..', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    }
});

const upload = multer({ storage });

// Helper to get audio metadata
async function getAudioMetadata(filePath) {
    try {
        const mm = await import('music-metadata');
        const metadata = await mm.parseFile(filePath);
        return {
            title: metadata.common.title || path.basename(filePath, path.extname(filePath)),
            artist: metadata.common.artist || 'Unknown Artist',
            album: metadata.common.album || null,
            genre: metadata.common.genre?.[0] || null,
            duration: metadata.format.duration || 0,
            bitrate: metadata.format.bitrate ? `${Math.round(metadata.format.bitrate / 1000)} kbps` : null
        };
    } catch (err) {
        console.error('Error parsing metadata:', err);
        return {
            title: path.basename(filePath, path.extname(filePath)),
            artist: 'Unknown Artist',
            album: null,
            genre: null,
            duration: 0,
            bitrate: null
        };
    }
}

// Upload track
router.post('/', requireAuth, upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ detail: 'No file uploaded' });
        }

        const absoluteFilePath = file.path;
        const fileSize = fs.statSync(absoluteFilePath).size;
        const metadata = await getAudioMetadata(absoluteFilePath);

        // Use relative path for DB storage
        const relativeFilePath = `uploads/${file.filename}`;

        // Extract album art from audio file if available
        let albumArtPath = null;
        try {
            const mm = await import('music-metadata');
            const audioMetadata = await mm.parseFile(absoluteFilePath);
            const picture = audioMetadata.common.picture?.[0];
            if (picture) {
                const artDir = path.join(__dirname, '..', '..', 'uploads', 'album_art');
                if (!fs.existsSync(artDir)) {
                    fs.mkdirSync(artDir, { recursive: true });
                }
                const artFilename = `${uuidv4()}.${picture.format.split('/')[1] || 'jpg'}`;
                const artPath = path.join(artDir, artFilename);
                fs.writeFileSync(artPath, picture.data);
                albumArtPath = `uploads/album_art/${artFilename}`;
            }
        } catch (e) {
            console.log('Could not extract album art:', e.message);
        }

        // Handle Album Logic
        let albumTitle = req.body.album || metadata.album || 'Unknown Album';
        let albumId = null;

        // Check if album exists
        const existingAlbum = db.prepare('SELECT id, album_art_path FROM albums WHERE title = ?').get(albumTitle);
        
        if (existingAlbum) {
            albumId = existingAlbum.id;
            // Update album art if the album doesn't have one but the track does
            if (!existingAlbum.album_art_path && albumArtPath) {
                db.prepare('UPDATE albums SET album_art_path = ? WHERE id = ?').run(albumArtPath, albumId);
            }
        } else {
            // Create new album
            const albumResult = db.prepare('INSERT INTO albums (title, artist, uploader_id, album_art_path) VALUES (?, ?, ?, ?)')
                .run(albumTitle, req.body.artist || metadata.artist, req.user.id, albumArtPath);
            albumId = albumResult.lastInsertRowid;
        }

        const result = db.prepare(`
            INSERT INTO tracks (title, artist, album, genre, file_path, duration, bitrate, size, is_public, uploader_id, album_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            req.body.title || metadata.title,
            req.body.artist || metadata.artist,
            albumTitle,
            req.body.genre || metadata.genre,
            relativeFilePath,
            metadata.duration,
            metadata.bitrate,
            fileSize,
            req.body.is_public === 'true' ? 1 : 0,
            req.user.id,
            albumId
        );

        const track = db.prepare(`
            SELECT t.*, a.album_art_path 
            FROM tracks t 
            LEFT JOIN albums a ON t.album_id = a.id 
            WHERE t.id = ?
        `).get(result.lastInsertRowid);

        res.json({
            id: track.id,
            title: track.title,
            artist: track.artist,
            album: track.album,
            album_art_path: track.album_art_path,
            message: 'Track uploaded successfully'
        });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ detail: 'Failed to upload track' });
    }
});

// Configure multer for thumbnail uploads
const thumbnailStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'album_art');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `track_${req.params.id}${ext}`);
    }
});
const uploadThumbnail = multer({ storage: thumbnailStorage });

// Upload track thumbnail/album art
router.post('/:id/thumbnail', requireAuth, uploadThumbnail.single('file'), (req, res) => {
    const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id);

    if (!track) {
        return res.status(404).json({ detail: 'Track not found' });
    }

    if (track.uploader_id !== req.user.id) {
        return res.status(403).json({ detail: 'Not authorized' });
    }

    if (!req.file) {
        return res.status(400).json({ detail: 'No file uploaded' });
    }

    const thumbnailPath = `uploads/album_art/${req.file.filename}`;
    
    // Update the ALBUM art
    if (track.album_id) {
         db.prepare('UPDATE albums SET album_art_path = ? WHERE id = ?').run(thumbnailPath, track.album_id);
    }

    res.json({ message: 'Thumbnail uploaded', album_art_path: thumbnailPath });
});

// Update track thumbnail for all tracks in an album
router.post('/album/:albumName/thumbnail', requireAuth, uploadThumbnail.single('file'), (req, res) => {
    const albumName = decodeURIComponent(req.params.albumName);

    // Get album ID from name
    const album = db.prepare('SELECT * FROM albums WHERE title = ?').get(albumName);
    
    if (!album) {
         return res.status(404).json({ detail: 'Album not found' });
    }

    if (!req.file) {
        return res.status(400).json({ detail: 'No file uploaded' });
    }

    const thumbnailPath = `uploads/album_art/${req.file.filename}`;

    // Update album cover
    db.prepare('UPDATE albums SET album_art_path = ? WHERE id = ?').run(thumbnailPath, album.id);

    res.json({ message: `Album art updated`, album_art_path: thumbnailPath });
});

//HV: Get all tracks
router.get('/', optionalAuth, (req, res) => {
    let tracks;

    if (req.user) {
        tracks = db.prepare(`
      SELECT t.*, u.name as uploader_name, a.album_art_path
      FROM tracks t 
      LEFT JOIN users u ON t.uploader_id = u.id
      LEFT JOIN albums a ON t.album_id = a.id
      WHERE t.is_public = 1 OR t.uploader_id = ?
      ORDER BY t.id DESC
    `).all(req.user.id);
    } else {
        tracks = db.prepare(`
      SELECT t.*, u.name as uploader_name, a.album_art_path
      FROM tracks t 
      LEFT JOIN users u ON t.uploader_id = u.id
      LEFT JOIN albums a ON t.album_id = a.id
      WHERE t.is_public = 1
      ORDER BY t.id DESC
    `).all();
    }

    const favoriteIds = req.user
        ? new Set(db.prepare('SELECT track_id FROM favorites WHERE user_id = ?').all(req.user.id).map(f => f.track_id))
        : new Set();

    const result = tracks.map(t => ({
        ...t,
        is_public: !!t.is_public,
        is_favorite: favoriteIds.has(t.id)
    }));

    res.json(result);
});

// Get track details
router.get('/:id', optionalAuth, (req, res) => {
    const track = db.prepare(`
    SELECT t.*, u.name as uploader_name, a.album_art_path
    FROM tracks t 
    LEFT JOIN users u ON t.uploader_id = u.id
    LEFT JOIN albums a ON t.album_id = a.id
    WHERE t.id = ?
  `).get(req.params.id);

    if (!track) {
        return res.status(404).json({ detail: 'Track not found' });
    }

    if (!track.is_public && (!req.user || req.user.id !== track.uploader_id)) {
        return res.status(403).json({ detail: 'Access denied' });
    }

    const isFavorite = req.user
        ? !!db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND track_id = ?').get(req.user.id, track.id)
        : false;

    res.json({
        ...track,
        is_public: !!track.is_public,
        is_favorite: isFavorite
    });
});

// Stream track
router.get('/:id/stream', (req, res) => {
    // Ensure CORS headers are set for audio context
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id);

    if (!track) {
        return res.status(404).json({ detail: 'Track not found' });
    }

    // Simplified path resolution
    const absolutePath = path.join(__dirname, '..', '..', track.file_path);

    if (!fs.existsSync(absolutePath)) {
        return res.status(404).json({ detail: 'File not found on server' });
    }

    const ext = path.extname(absolutePath).toLowerCase();
    let contentType = 'audio/mpeg';
    if (ext === '.wav') contentType = 'audio/wav';
    else if (ext === '.ogg') contentType = 'audio/ogg';
    else if (ext === '.m4a') contentType = 'audio/mp4';
    else if (ext === '.flac') contentType = 'audio/flac';
    
    res.setHeader('Content-Type', contentType);
    res.sendFile(absolutePath);
});

// Update track metadata
router.put('/:id', requireAuth, (req, res) => {
    const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id);

    if (!track) {
        return res.status(404).json({ detail: 'Track not found' });
    }

    if (track.uploader_id !== req.user.id) {
        return res.status(403).json({ detail: 'Not authorized' });
    }

    const { title, artist, album, genre } = req.body;

    // Update tracks table
    db.prepare(`
        UPDATE tracks 
        SET title = COALESCE(?, title),
            artist = COALESCE(?, artist),
            album = COALESCE(?, album),
            genre = COALESCE(?, genre)
        WHERE id = ?
    `).run(title || null, artist || null, album || null, genre || null, req.params.id);

    // If album name changed, update album_id
    if (album && album !== track.album) {
        let albumId;
        const existingAlbum = db.prepare('SELECT id FROM albums WHERE title = ?').get(album);
        if (existingAlbum) {
            albumId = existingAlbum.id;
        } else {
            const albumResult = db.prepare('INSERT INTO albums (title, artist, uploader_id) VALUES (?, ?, ?)')
                .run(album, artist || track.artist, req.user.id);
            albumId = albumResult.lastInsertRowid;
        }
        db.prepare('UPDATE tracks SET album_id = ? WHERE id = ?').run(albumId, req.params.id);
    }

    const updatedTrack = db.prepare(`
        SELECT t.*, a.album_art_path 
        FROM tracks t 
        LEFT JOIN albums a ON t.album_id = a.id 
        WHERE t.id = ?
    `).get(req.params.id);
    res.json(updatedTrack);
});

// Publish/unpublish track
router.put('/:id/publish', requireAuth, (req, res) => {
    const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id);

    if (!track) {
        return res.status(404).json({ detail: 'Track not found' });
    }

    if (track.uploader_id !== req.user.id) {
        return res.status(403).json({ detail: 'Not authorized' });
    }

    const publish = req.query.publish === 'true' ? 1 : 0;
    db.prepare('UPDATE tracks SET is_public = ? WHERE id = ?').run(publish, req.params.id);

    res.json({ message: 'Track publish status updated', is_public: !!publish });
});

// Delete track
router.delete('/:id', requireAuth, (req, res) => {
    const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id);

    if (!track) {
        return res.status(404).json({ detail: 'Track not found' });
    }

    if (track.uploader_id !== req.user.id) {
        return res.status(403).json({ detail: 'Not authorized' });
    }

    db.prepare('DELETE FROM playlist_tracks WHERE track_id = ?').run(req.params.id);
    db.prepare('DELETE FROM favorites WHERE track_id = ?').run(req.params.id);
    db.prepare('DELETE FROM tracks WHERE id = ?').run(req.params.id);

    const absolutePath = path.join(__dirname, '..', '..', track.file_path);
    if (fs.existsSync(absolutePath)) {
        try {
            fs.unlinkSync(absolutePath);
        } catch (e) {
            console.error("Could not delete file", e);
        }
    }

    res.json({ message: 'Track deleted' });
});

module.exports = router;