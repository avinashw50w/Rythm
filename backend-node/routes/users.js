const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAuth, optionalAuth } = require('../auth');

// Configure multer for avatar uploads
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'avatars');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `user_${req.user.id}${ext}`);
    }
});

const uploadAvatar = multer({ storage: avatarStorage });

// Update profile
router.put('/profile', requireAuth, uploadAvatar.single('avatar'), (req, res) => {
    const { name } = req.body;

    let avatarUrl = req.user.avatar_url;
    if (req.file) {
        avatarUrl = `http://localhost:8000/uploads/avatars/${req.file.filename}`;
    }

    db.prepare('UPDATE users SET name = ?, avatar_url = ? WHERE id = ?')
        .run(name || req.user.name, avatarUrl, req.user.id);

    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    res.json({
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        avatar_url: updatedUser.avatar_url
    });
});

// Toggle favorite (Moved up to avoid conflict with /:id)
router.post('/favorites/:trackId', requireAuth, (req, res) => {
    const trackId = parseInt(req.params.trackId);

    const existing = db.prepare('SELECT * FROM favorites WHERE user_id = ? AND track_id = ?')
        .get(req.user.id, trackId);

    if (existing) {
        db.prepare('DELETE FROM favorites WHERE id = ?').run(existing.id);
        res.json({ message: 'Removed from favorites', is_favorite: false });
    } else {
        db.prepare('INSERT INTO favorites (user_id, track_id) VALUES (?, ?)').run(req.user.id, trackId);
        res.json({ message: 'Added to favorites', is_favorite: true });
    }
});

// Get favorites (Moved up to avoid conflict with /:id)
router.get('/favorites', requireAuth, (req, res) => {
    const favorites = db.prepare(`
    SELECT t.*, u.name as uploader_name, a.album_art_path, ar.name as artist
    FROM favorites f
    JOIN tracks t ON f.track_id = t.id
    LEFT JOIN users u ON t.uploader_id = u.id
    LEFT JOIN albums a ON t.album_id = a.id
    LEFT JOIN artists ar ON t.artist_id = ar.id
    WHERE f.user_id = ?
    ORDER BY f.id DESC
  `).all(req.user.id);

    const result = favorites.map(t => ({
        ...t,
        is_public: !!t.is_public,
        is_favorite: true
    }));

    res.json(result);
});

// Get user by ID
router.get('/:id', (req, res) => {
    const user = db.prepare('SELECT id, name, email, avatar_url FROM users WHERE id = ?')
        .get(req.params.id);

    if (!user) {
        return res.status(404).json({ detail: 'User not found' });
    }

    res.json(user);
});

// Get user's tracks
router.get('/:id/tracks', optionalAuth, (req, res) => {
    const userId = parseInt(req.params.id);

    let tracks;
    if (req.user && req.user.id === userId) {
        tracks = db.prepare(`
      SELECT t.*, u.name as uploader_name, a.album_art_path, ar.name as artist
      FROM tracks t 
      LEFT JOIN users u ON t.uploader_id = u.id
      LEFT JOIN albums a ON t.album_id = a.id
      LEFT JOIN artists ar ON t.artist_id = ar.id
      WHERE t.uploader_id = ?
      ORDER BY t.id DESC
    `).all(userId);
    } else {
        tracks = db.prepare(`
      SELECT t.*, u.name as uploader_name, a.album_art_path, ar.name as artist
      FROM tracks t 
      LEFT JOIN users u ON t.uploader_id = u.id
      LEFT JOIN albums a ON t.album_id = a.id
      LEFT JOIN artists ar ON t.artist_id = ar.id
      WHERE t.uploader_id = ? AND t.is_public = 1
      ORDER BY t.id DESC
    `).all(userId);
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

// Get user's albums
router.get('/:id/albums', optionalAuth, (req, res) => {
    const userId = parseInt(req.params.id);

    // Find albums that contain tracks uploaded by this user
    // Use LEFT JOIN to capture tracks even if they haven't been migrated to an album_id yet
    let albums;
    if (req.user && req.user.id === userId) {
        albums = db.prepare(`
            SELECT 
                COALESCE(a.title, 'Unknown Album') as name, 
                COALESCE(ar.name, COALESCE(a.artist, 'Unknown Artist')) as artist, 
                a.album_art_path as cover_art, 
                COUNT(t.id) as track_count
            FROM tracks t
            LEFT JOIN albums a ON t.album_id = a.id
            LEFT JOIN artists ar ON t.artist_id = ar.id
            WHERE t.uploader_id = ?
            GROUP BY COALESCE(a.id, 'unknown')
            ORDER BY name
        `).all(userId);
    } else {
        albums = db.prepare(`
            SELECT 
                COALESCE(a.title, 'Unknown Album') as name, 
                COALESCE(ar.name, COALESCE(a.artist, 'Unknown Artist')) as artist, 
                a.album_art_path as cover_art, 
                COUNT(t.id) as track_count
            FROM tracks t
            LEFT JOIN albums a ON t.album_id = a.id
            LEFT JOIN artists ar ON t.artist_id = ar.id
            WHERE t.uploader_id = ? AND t.is_public = 1
            GROUP BY COALESCE(a.id, 'unknown')
            ORDER BY name
        `).all(userId);
    }

    res.json(albums);
});

module.exports = router;