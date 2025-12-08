require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(express.json());

// CORS - Allow all origins for audio streaming with Web Audio API
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['*'],
    exposedHeaders: ['*'],
}));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Static files for uploads with CORS headers enabled
// This is critical for album art used in canvas elements (visualizers)
app.use('/uploads', express.static(uploadsDir, {
    setHeaders: (res, path, stat) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    }
}));

// Serve video loops
const videoLoopsDir = path.join(__dirname, '..', 'assets', 'video_loops');
if (fs.existsSync(videoLoopsDir)) {
    app.use('/assets/video_loops', express.static(videoLoopsDir, {
        setHeaders: (res, path, stat) => {
            res.set('Access-Control-Allow-Origin', '*');
            res.set('Cross-Origin-Resource-Policy', 'cross-origin');
        }
    }));
}

// Routes
const authRoutes = require('./routes/auth');
const tracksRoutes = require('./routes/tracks');
const usersRoutes = require('./routes/users');
const playlistsRoutes = require('./routes/playlists');
const albumsRoutes = require('./routes/albums');
const artistsRoutes = require('./routes/artists');
const searchRoutes = require('./routes/search');

app.use('/auth', authRoutes);
app.use('/tracks', tracksRoutes);
app.use('/users', usersRoutes);
app.use('/playlists', playlistsRoutes);
app.use('/albums', albumsRoutes);
app.use('/artists', artistsRoutes);
app.use('/search', searchRoutes);

// New route to list videos
app.get('/videos', (req, res) => {
    if (!fs.existsSync(videoLoopsDir)) {
        return res.json([]);
    }
    fs.readdir(videoLoopsDir, (err, files) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to list videos' });
        }
        // Filter for video files
        const videos = files.filter(file => /\.(mp4|webm|mov)$/i.test(file));
        res.json(videos);
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({ message: 'Rythm API is running (Node.js + better-sqlite3)' });
});

const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown logic
const shutdown = (signal) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);

    server.close(() => {
        console.log('HTTP server closed.');
        try {
            if (db) {
                db.close();
                console.log('Database connection closed.');
            }
            console.log('Graceful shutdown complete.');
            process.exit(0);
        } catch (err) {
            console.error('Error during database close:', err);
            process.exit(1);
        }
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));