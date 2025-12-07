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

// Get Artist Details
router.get('/:name', optionalAuth, (req, res) => {
    const artistName = decodeURIComponent(req.params.name);

    // 1. Get Artist Metadata from 'artists' table
    let artist = db.prepare('SELECT * FROM artists WHERE name = ?').get(artistName);

    // If artist doesn't exist, check if we need to create a stub or return 404
    if (!artist) {
        // Fallback: check if any tracks use this string (legacy support)
        const hasTracks = db.prepare('SELECT 1 FROM tracks WHERE artist = ?').get(artistName);
        if (hasTracks) {
             artist = { id: null, name: artistName, bio: '', image_path: null };
        } else {
             return res.status(404).json({ detail: 'Artist not found' });
        }
    }

    // 2. Fetch public tracks
    // Prefer artist_id if available
    let tracks;
    if (artist.id) {
        tracks = db.prepare(`
            SELECT t.*, a.album_art_path, ar.name as artist 
            FROM tracks t
            LEFT JOIN albums a ON t.album_id = a.id
            JOIN artists ar ON t.artist_id = ar.id
            WHERE t.artist_id = ? AND t.is_public = 1
            ORDER BY t.id DESC
        `).all(artist.id);
    } else {
        tracks = db.prepare(`
            SELECT t.*, a.album_art_path, t.artist 
            FROM tracks t
            LEFT JOIN albums a ON t.album_id = a.id
            WHERE t.artist = ? AND t.is_public = 1
            ORDER BY t.id DESC
        `).all(artistName);
    }

    // 3. Fetch albums (public ones or containing public tracks)
    let albums;
    if (artist.id) {
        albums = db.prepare(`
            SELECT DISTINCT a.id, a.title, ar.name as artist, a.album_art_path, COUNT(t.id) as track_count
            FROM albums a
            JOIN artists ar ON a.artist_id = ar.id
            JOIN tracks t ON a.id = t.album_id
            WHERE a.artist_id = ? AND t.is_public = 1
            GROUP BY a.id
        `).all(artist.id);
    } else {
        albums = db.prepare(`
            SELECT DISTINCT a.id, a.title, a.artist, a.album_art_path, COUNT(t.id) as track_count
            FROM albums a
            JOIN tracks t ON a.id = t.album_id
            WHERE a.artist = ? AND t.is_public = 1
            GROUP BY a.id
        `).all(artistName);
    }

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

// Update Artist Info (create if not exists)
router.put('/', requireAuth, uploadArtistImage.single('image'), (req, res) => {
    const { name, bio } = req.body;
    
    if (!name) return res.status(400).json({ detail: 'Artist name is required' });

    let imagePath = undefined;
    if (req.file) {
        imagePath = `uploads/artists/${req.file.filename}`;
    }

    const existing = db.prepare('SELECT * FROM artists WHERE name = ?').get(name);

    if (existing) {
        db.prepare(`
            UPDATE artists 
            SET bio = COALESCE(?, bio),
                image_path = COALESCE(?, image_path)
            WHERE id = ?
        `).run(bio || null, imagePath || null, existing.id);
    } else {
        db.prepare('INSERT INTO artists (name, bio, image_path) VALUES (?, ?, ?)').run(name, bio || '', imagePath || null);
    }

    const updated = db.prepare('SELECT * FROM artists WHERE name = ?').get(name);
    res.json(updated);
});

module.exports = router;