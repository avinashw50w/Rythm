const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAuth, optionalAuth } = require('../auth');

// Configure multer for artist images
const artistStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'artists');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `artist_${Date.now()}${ext}`);
    }
});

const uploadArtistImage = multer({ storage: artistStorage });

// Get Artist Details by ID
router.get('/:id', optionalAuth, (req, res) => {
    const artistId = req.params.id;

    // 1. Get Artist Metadata
    const artist = db.prepare('SELECT * FROM artists WHERE id = ?').get(artistId);

    if (!artist) {
        return res.status(404).json({ detail: 'Artist not found' });
    }

    // 2. Fetch public tracks
    const tracks = db.prepare(`
        SELECT t.*, a.album_art_path, a.title as album, ar.name as artist 
        FROM tracks t
        LEFT JOIN albums a ON t.album_id = a.id
        JOIN artists ar ON t.artist_id = ar.id
        WHERE t.artist_id = ? AND t.is_public = 1
        ORDER BY t.id DESC
    `).all(artistId);

    // 3. Fetch albums
    const albums = db.prepare(`
        SELECT DISTINCT a.id, a.title, ar.name as artist, a.artist_id, a.album_art_path, COUNT(t.id) as track_count
        FROM albums a
        JOIN artists ar ON a.artist_id = ar.id
        LEFT JOIN tracks t ON a.id = t.album_id
        WHERE a.artist_id = ? 
        GROUP BY a.id
    `).all(artistId);

    // Get favorite IDs if logged in
    const favoriteIds = req.user
        ? new Set(db.prepare('SELECT track_id FROM favorites WHERE user_id = ?').all(req.user.id).map(f => f.track_id))
        : new Set();

    const tracksWithFavorites = tracks.map(t => ({
        ...t,
        is_favorite: favoriteIds.has(t.id)
    }));

    res.json({
        ...artist,
        tracks: tracksWithFavorites,
        albums
    });
});

// Update Artist Info
router.put('/:id', requireAuth, uploadArtistImage.single('image'), (req, res) => {
    const artistId = req.params.id;
    const { bio, name } = req.body; 
    
    let imagePath = undefined;
    if (req.file) {
        imagePath = `uploads/artists/${req.file.filename}`;
    }

    const existing = db.prepare('SELECT * FROM artists WHERE id = ?').get(artistId);
    if (!existing) return res.status(404).json({ detail: 'Artist not found' });

    db.prepare(`
        UPDATE artists 
        SET bio = COALESCE(?, bio),
            name = COALESCE(?, name),
            image_path = COALESCE(?, image_path)
        WHERE id = ?
    `).run(bio || null, name || null, imagePath || null, artistId);

    const updated = db.prepare('SELECT * FROM artists WHERE id = ?').get(artistId);
    res.json(updated);
});

module.exports = router;