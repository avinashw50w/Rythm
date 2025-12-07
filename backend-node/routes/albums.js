const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAuth, optionalAuth } = require('../auth');

router.get('/:id', optionalAuth, (req, res) => {
    const albumId = req.params.id;

    const album = db.prepare(`
        SELECT a.*, ar.name as artist 
        FROM albums a
        LEFT JOIN artists ar ON a.artist_id = ar.id
        WHERE a.id = ?
    `).get(albumId);

    if (!album) return res.status(404).json({ detail: 'Album not found' });

    const tracks = db.prepare(`
        SELECT t.*, a.album_art_path, a.title as album, ar.name as artist 
        FROM tracks t
        LEFT JOIN albums a ON t.album_id = a.id
        LEFT JOIN artists ar ON t.artist_id = ar.id
        WHERE t.album_id = ?
    `).all(album.id);

    const visibleTracks = tracks.filter(track => {
        if (track.is_public) return true;
        if (req.user && track.uploader_id === req.user.id) return true;
        return false;
    });

    if (visibleTracks.length === 0 && tracks.length > 0) {
        return res.status(404).json({ detail: 'Album tracks are private' });
    }

    const favoriteIds = req.user
        ? new Set(db.prepare('SELECT track_id FROM favorites WHERE user_id = ?').all(req.user.id).map(f => f.track_id))
        : new Set();

    const isOwner = req.user && album.uploader_id === req.user.id;

    res.json({
        id: album.id,
        name: album.title,
        artist: album.artist,
        artist_id: album.artist_id,
        album_art_path: album.album_art_path,
        total_duration: visibleTracks.reduce((sum, t) => sum + (t.duration || 0), 0),
        track_count: visibleTracks.length,
        is_owner: isOwner,
        tracks: visibleTracks.map(t => ({
            id: t.id,
            title: t.title,
            artist: t.artist,
            artist_id: t.artist_id,
            album_id: t.album_id,
            album: t.album,
            duration: t.duration,
            is_public: !!t.is_public,
            uploader_id: t.uploader_id,
            album_art_path: t.album_art_path,
            is_favorite: favoriteIds.has(t.id)
        }))
    });
});

router.put('/:id', requireAuth, (req, res) => {
    const albumId = req.params.id;
    const { new_name, artist, genre } = req.body;

    const album = db.prepare('SELECT * FROM albums WHERE id = ?').get(albumId);
    if (!album) return res.status(404).json({ detail: 'Album not found' });
    if (album.uploader_id !== req.user.id) return res.status(403).json({ detail: 'Not authorized' });

    if (new_name) {
        db.prepare('UPDATE albums SET title = ? WHERE id = ?').run(new_name, album.id);
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

        db.prepare('UPDATE albums SET artist_id = ? WHERE id = ?').run(artistId, album.id);
        db.prepare('UPDATE tracks SET artist_id = ? WHERE album_id = ?').run(artistId, album.id);
    }
    
    if (genre) {
        db.prepare('UPDATE tracks SET genre = ? WHERE album_id = ?').run(genre, album.id);
    }

    res.json({ message: `Updated album`, new_name: new_name || album.title, id: album.id });
});

router.put('/:id/publish', requireAuth, (req, res) => {
    const albumId = req.params.id;
    const { is_public } = req.body;

    const album = db.prepare('SELECT * FROM albums WHERE id = ?').get(albumId);
    if (!album) return res.status(404).json({ detail: 'Album not found' });
    if (album.uploader_id !== req.user.id) return res.status(403).json({ detail: 'Not authorized' });

    const publicValue = is_public ? 1 : 0;
    db.prepare('UPDATE tracks SET is_public = ? WHERE album_id = ?').run(publicValue, album.id);

    res.json({ message: `Album ${is_public ? 'published' : 'unpublished'}` });
});

router.delete('/:id', requireAuth, (req, res) => {
    const albumId = req.params.id;
    const album = db.prepare('SELECT * FROM albums WHERE id = ?').get(albumId);
    if (!album) return res.status(404).json({ detail: 'Album not found' });
    if (album.uploader_id !== req.user.id) return res.status(403).json({ detail: 'Not authorized' });

    const tracks = db.prepare('SELECT * FROM tracks WHERE album_id = ?').all(album.id);
    let deletedCount = 0;
    for (const track of tracks) {
        db.prepare('DELETE FROM playlist_tracks WHERE track_id = ?').run(track.id);
        db.prepare('DELETE FROM favorites WHERE track_id = ?').run(track.id);
        db.prepare('DELETE FROM tracks WHERE id = ?').run(track.id);

        const trackPath = path.join(__dirname, '..', '..', track.file_path);
        if (fs.existsSync(trackPath)) {
            try { fs.unlinkSync(trackPath); } catch (e) { console.error(`Error deleting file`, e); }
        }
        deletedCount++;
    }

    if (album.album_art_path) {
        const artPath = path.join(__dirname, '..', '..', album.album_art_path);
        if (fs.existsSync(artPath)) {
             try { fs.unlinkSync(artPath); } catch (e) { console.error(`Error deleting art`, e); }
        }
    }

    db.prepare('DELETE FROM albums WHERE id = ?').run(album.id);
    res.json({ message: `Deleted album '${album.title}' and ${deletedCount} tracks` });
});

module.exports = router;