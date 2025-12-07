const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAuth, optionalAuth } = require('../auth');

// Configure multer for thumbnail uploads
const thumbnailStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'playlist_thumbnails');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `playlist_${req.params.id}${ext}`);
    }
});

const uploadThumbnail = multer({ storage: thumbnailStorage });

// Create playlist
router.post('/', requireAuth, (req, res) => {
    const { name } = req.query;
    const isPublic = req.query.is_public === 'true' ? 1 : 0;

    if (!name) {
        return res.status(400).json({ detail: 'Name is required' });
    }

    const result = db.prepare('INSERT INTO playlists (name, creator_id, is_public) VALUES (?, ?, ?)')
        .run(name, req.user.id, isPublic);

    res.json({
        id: result.lastInsertRowid,
        name,
        is_public: !!isPublic,
        track_count: 0
    });
});

// List user's playlists
router.get('/', requireAuth, (req, res) => {
    const playlists = db.prepare('SELECT * FROM playlists WHERE creator_id = ? ORDER BY id DESC').all(req.user.id);

    const result = playlists.map(p => {
        const trackCount = db.prepare('SELECT COUNT(*) as count FROM playlist_tracks WHERE playlist_id = ?').get(p.id);
        return {
            id: p.id,
            name: p.name,
            is_public: !!p.is_public,
            track_count: trackCount?.count || 0,
            thumbnail_path: p.thumbnail_path
        };
    });

    res.json(result);
});

// Get playlist with tracks
router.get('/:id', optionalAuth, (req, res) => {
    const playlist = db.prepare(`
    SELECT p.*, u.name as creator_name 
    FROM playlists p 
    LEFT JOIN users u ON p.creator_id = u.id 
    WHERE p.id = ?
  `).get(req.params.id);

    if (!playlist) {
        return res.status(404).json({ detail: 'Playlist not found' });
    }

    if (!playlist.is_public && (!req.user || req.user.id !== playlist.creator_id)) {
        return res.status(403).json({ detail: 'Access denied' });
    }

    const tracks = db.prepare(`
    SELECT t.*, u.name as uploader_name, a.album_art_path, ar.name as artist
    FROM playlist_tracks pt
    JOIN tracks t ON pt.track_id = t.id
    LEFT JOIN users u ON t.uploader_id = u.id
    LEFT JOIN albums a ON t.album_id = a.id
    LEFT JOIN artists ar ON t.artist_id = ar.id
    WHERE pt.playlist_id = ?
    ORDER BY pt."order"
  `).all(req.params.id);

    const favoriteIds = req.user
        ? new Set(db.prepare('SELECT track_id FROM favorites WHERE user_id = ?').all(req.user.id).map(f => f.track_id))
        : new Set();

    const tracksWithFavorite = tracks.map(t => ({
        ...t,
        is_public: !!t.is_public,
        is_favorite: favoriteIds.has(t.id)
    }));

    res.json({
        id: playlist.id,
        name: playlist.name,
        is_public: !!playlist.is_public,
        thumbnail_path: playlist.thumbnail_path,
        creator_name: playlist.creator_name,
        creator_id: playlist.creator_id,
        track_count: tracks.length,
        tracks: tracksWithFavorite
    });
});

// Update playlist
router.put('/:id', requireAuth, (req, res) => {
    const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(req.params.id);

    if (!playlist) {
        return res.status(404).json({ detail: 'Playlist not found' });
    }

    if (playlist.creator_id !== req.user.id) {
        return res.status(403).json({ detail: 'Not authorized' });
    }

    const { name, is_public } = req.query;

    if (name) {
        db.prepare('UPDATE playlists SET name = ? WHERE id = ?').run(name, req.params.id);
    }
    if (is_public !== undefined) {
        db.prepare('UPDATE playlists SET is_public = ? WHERE id = ?').run(is_public === 'true' ? 1 : 0, req.params.id);
    }

    res.json({ message: 'Playlist updated', id: parseInt(req.params.id) });
});

// Upload thumbnail
router.post('/:id/thumbnail', requireAuth, uploadThumbnail.single('file'), (req, res) => {
    const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(req.params.id);

    if (!playlist) {
        return res.status(404).json({ detail: 'Playlist not found' });
    }

    if (playlist.creator_id !== req.user.id) {
        return res.status(403).json({ detail: 'Not authorized' });
    }

    if (!req.file) {
        return res.status(400).json({ detail: 'No file uploaded' });
    }

    const thumbnailPath = `uploads/playlist_thumbnails/${req.file.filename}`;
    db.prepare('UPDATE playlists SET thumbnail_path = ? WHERE id = ?').run(thumbnailPath, req.params.id);

    res.json({ message: 'Thumbnail uploaded', thumbnail_path: thumbnailPath });
});

// Delete playlist
router.delete('/:id', requireAuth, (req, res) => {
    const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(req.params.id);

    if (!playlist) {
        return res.status(404).json({ detail: 'Playlist not found' });
    }

    if (playlist.creator_id !== req.user.id) {
        return res.status(403).json({ detail: 'Not authorized' });
    }

    db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ?').run(req.params.id);
    db.prepare('DELETE FROM playlists WHERE id = ?').run(req.params.id);

    res.json({ message: 'Playlist deleted' });
});

// Add track to playlist
router.post('/:id/tracks/:trackId', requireAuth, (req, res) => {
    const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(req.params.id);

    if (!playlist) {
        return res.status(404).json({ detail: 'Playlist not found' });
    }

    if (playlist.creator_id !== req.user.id) {
        return res.status(403).json({ detail: 'Not authorized' });
    }

    const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.trackId);
    if (!track) {
        return res.status(404).json({ detail: 'Track not found' });
    }

    const existing = db.prepare('SELECT * FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?')
        .get(req.params.id, req.params.trackId);

    if (existing) {
        return res.status(400).json({ detail: 'Track already in playlist' });
    }

    const countResult = db.prepare('SELECT COUNT(*) as count FROM playlist_tracks WHERE playlist_id = ?')
        .get(req.params.id);
    const maxOrder = countResult?.count || 0;

    db.prepare('INSERT INTO playlist_tracks (playlist_id, track_id, "order") VALUES (?, ?, ?)')
        .run(req.params.id, req.params.trackId, maxOrder);

    res.json({ message: 'Track added to playlist' });
});

// Remove track from playlist
router.delete('/:id/tracks/:trackId', requireAuth, (req, res) => {
    const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(req.params.id);

    if (!playlist) {
        return res.status(404).json({ detail: 'Playlist not found' });
    }

    if (playlist.creator_id !== req.user.id) {
        return res.status(403).json({ detail: 'Not authorized' });
    }

    const result = db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?')
        .run(req.params.id, req.params.trackId);

    if (result.changes === 0) {
        return res.status(404).json({ detail: 'Track not in playlist' });
    }

    res.json({ message: 'Track removed from playlist' });
});

module.exports = router;