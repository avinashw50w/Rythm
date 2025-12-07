const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAuth, optionalAuth } = require('../auth');

// Get album details with tracks
router.get('/:albumName', optionalAuth, (req, res) => {
    const albumName = decodeURIComponent(req.params.albumName);

    // Get album details directly first to be sure
    const album = db.prepare(`
        SELECT a.*, ar.name as artist_name 
        FROM albums a
        LEFT JOIN artists ar ON a.artist_id = ar.id
        WHERE a.title = ?
    `).get(albumName);

    if (!album) {
        return res.status(404).json({ detail: 'Album not found' });
    }

    // Get all tracks with this album name (or album_id)
    const tracks = db.prepare(`
        SELECT t.*, a.album_art_path, ar.name as artist 
        FROM tracks t
        LEFT JOIN albums a ON t.album_id = a.id
        LEFT JOIN artists ar ON t.artist_id = ar.id
        WHERE t.album_id = ?
    `).all(album.id);

    if (!tracks || tracks.length === 0) {
        // Fallback to name search if album_id linking failed somehow
        const tracksByName = db.prepare(`
            SELECT t.*, a.album_art_path, ar.name as artist 
            FROM tracks t
            LEFT JOIN albums a ON t.album_id = a.id
            LEFT JOIN artists ar ON t.artist_id = ar.id
            WHERE t.album = ?
        `).all(albumName);
        
        if (!tracksByName || tracksByName.length === 0) {
             return res.status(404).json({ detail: 'No tracks found in album' });
        }
    }

    // Filter visible tracks
    const visibleTracks = tracks.filter(track => {
        if (track.is_public) return true;
        if (req.user && track.uploader_id === req.user.id) return true;
        return false;
    });

    if (visibleTracks.length === 0) {
        return res.status(404).json({ detail: 'Album tracks are private' });
    }

    // Get user favorites
    const favoriteIds = req.user
        ? new Set(db.prepare('SELECT track_id FROM favorites WHERE user_id = ?').all(req.user.id).map(f => f.track_id))
        : new Set();

    // Determine if user is owner (using album uploader_id)
    const isOwner = req.user && album.uploader_id === req.user.id;

    res.json({
        name: album.title,
        artist: album.artist_name || album.artist,
        album_art_path: album.album_art_path,
        total_duration: visibleTracks.reduce((sum, t) => sum + (t.duration || 0), 0),
        track_count: visibleTracks.length,
        is_owner: isOwner,
        tracks: visibleTracks.map(t => ({
            id: t.id,
            title: t.title,
            artist: t.artist,
            duration: t.duration,
            is_public: !!t.is_public,
            uploader_id: t.uploader_id,
            album_art_path: t.album_art_path, // Included from JOIN
            is_favorite: favoriteIds.has(t.id)
        }))
    });
});

// Update album (rename, change artist/genre)
router.put('/:albumName', requireAuth, (req, res) => {
    const albumName = decodeURIComponent(req.params.albumName);
    const { new_name, artist, genre } = req.body;

    const album = db.prepare('SELECT * FROM albums WHERE title = ?').get(albumName);
    if (!album) {
        return res.status(404).json({ detail: 'Album not found' });
    }

    if (album.uploader_id !== req.user.id) {
        return res.status(403).json({ detail: 'Not authorized' });
    }

    if (new_name) {
        db.prepare('UPDATE albums SET title = ? WHERE id = ?').run(new_name, album.id);
        // Also update tracks 'album' string column for consistency
        db.prepare('UPDATE tracks SET album = ? WHERE album_id = ?').run(new_name, album.id);
    }
    if (artist) {
        let artistId;
        const existingArtist = db.prepare('SELECT id FROM artists WHERE name = ?').get(artist);
        if (existingArtist) {
            artistId = existingArtist.id;
        } else {
            const res = db.prepare('INSERT INTO artists (name) VALUES (?)').run(artist);
            artistId = res.lastInsertRowid;
        }

        db.prepare('UPDATE albums SET artist = ?, artist_id = ? WHERE id = ?').run(artist, artistId, album.id);
        // Update tracks artist
        db.prepare('UPDATE tracks SET artist = ?, artist_id = ? WHERE album_id = ?').run(artist, artistId, album.id);
    }
    if (genre) {
        db.prepare('UPDATE tracks SET genre = ? WHERE album_id = ?').run(genre, album.id);
    }

    res.json({ message: `Updated album`, new_name: new_name || albumName });
});

// Publish/unpublish album
router.put('/:albumName/publish', requireAuth, (req, res) => {
    const albumName = decodeURIComponent(req.params.albumName);
    const { is_public } = req.body;

    const album = db.prepare('SELECT * FROM albums WHERE title = ?').get(albumName);
    if (!album) return res.status(404).json({ detail: 'Album not found' });

    if (album.uploader_id !== req.user.id) return res.status(403).json({ detail: 'Not authorized' });

    const publicValue = is_public ? 1 : 0;
    // Update tracks visibility
    db.prepare('UPDATE tracks SET is_public = ? WHERE album_id = ?').run(publicValue, album.id);

    res.json({
        message: `Album ${is_public ? 'published' : 'unpublished'}`
    });
});

// Delete album and all its tracks
router.delete('/:albumName', requireAuth, (req, res) => {
    const albumName = decodeURIComponent(req.params.albumName);

    const album = db.prepare('SELECT * FROM albums WHERE title = ?').get(albumName);
    if (!album) return res.status(404).json({ detail: 'Album not found' });

    if (album.uploader_id !== req.user.id) return res.status(403).json({ detail: 'Not authorized' });

    const tracks = db.prepare('SELECT * FROM tracks WHERE album_id = ?').all(album.id);

    let deletedCount = 0;
    for (const track of tracks) {
        // Delete from playlists
        db.prepare('DELETE FROM playlist_tracks WHERE track_id = ?').run(track.id);
        // Delete favorites
        db.prepare('DELETE FROM favorites WHERE track_id = ?').run(track.id);
        // Delete track record
        db.prepare('DELETE FROM tracks WHERE id = ?').run(track.id);

        // Delete file
        const trackPath = path.join(__dirname, '..', '..', track.file_path);
        if (fs.existsSync(trackPath)) {
            try {
                fs.unlinkSync(trackPath);
            } catch (e) {
                console.error(`Error deleting file ${track.file_path}:`, e);
            }
        }
        deletedCount++;
    }

    // Delete album art if exists
    if (album.album_art_path) {
        const artPath = path.join(__dirname, '..', '..', album.album_art_path);
        if (fs.existsSync(artPath)) {
             try {
                fs.unlinkSync(artPath);
            } catch (e) {
                console.error(`Error deleting album art ${album.album_art_path}:`, e);
            }
        }
    }

    // Delete album record
    db.prepare('DELETE FROM albums WHERE id = ?').run(album.id);

    res.json({ message: `Deleted album '${albumName}' and ${deletedCount} tracks` });
});

module.exports = router;