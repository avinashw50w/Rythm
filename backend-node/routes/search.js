const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
    const query = req.query.q;
    
    // If no query, return empty or recommended (handled by frontend typically for "browse")
    if (!query) {
        return res.json({ tracks: [], artists: [], albums: [] });
    }

    const term = `%${query}%`;

    try {
        // Search Tracks
        const tracks = db.prepare(`
            SELECT t.*, ar.name as artist, al.title as album, al.album_art_path 
            FROM tracks t 
            LEFT JOIN artists ar ON t.artist_id = ar.id 
            LEFT JOIN albums al ON t.album_id = al.id 
            WHERE t.title LIKE ? OR ar.name LIKE ?
            LIMIT 5
        `).all(term, term);

        // Search Artists
        const artists = db.prepare(`
            SELECT * FROM artists 
            WHERE name LIKE ? 
            LIMIT 5
        `).all(term);

        // Search Albums
        const albums = db.prepare(`
            SELECT a.*, ar.name as artist 
            FROM albums a
            LEFT JOIN artists ar ON a.artist_id = ar.id
            WHERE a.title LIKE ? 
            LIMIT 5
        `).all(term);

        res.json({
            tracks: tracks.map(t => ({...t, is_public: !!t.is_public})),
            artists,
            albums
        });
    } catch (error) {
        console.error("Search error:", error);
        res.status(500).json({ detail: "Search failed" });
    }
});

module.exports = router;
