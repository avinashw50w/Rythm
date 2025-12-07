const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { createAccessToken, createRefreshToken, SECRET_KEY } = require('../auth');

// Initialize Google Auth Client
// Ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in your .env file
const googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
);

// Google OAuth login/signup
router.post('/google', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ detail: 'Token is required' });
        }

        // Verify the ID token using google-auth-library
        // This validates the signature and ensures the token is intended for this app (audience check)
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        
        const email = payload.email;
        const name = payload.name;
        const picture = payload.picture;

        if (!email) {
            return res.status(400).json({ detail: 'Email not found in Google token' });
        }

        // Check if user exists in local DB
        let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

        if (!user) {
            // Create new user
            const result = db.prepare(
                'INSERT INTO users (email, name, avatar_url) VALUES (?, ?, ?)'
            ).run(email, name || email.split('@')[0], picture || null);

            user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
        } else {
             // Update avatar/name if changed (optional, but good UX)
             db.prepare(
                'UPDATE users SET name = ?, avatar_url = ? WHERE id = ?'
            ).run(name || user.name, picture || user.avatar_url, user.id);
             // Reload user
             user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
        }

        // Generate App-specific JWT tokens (Access & Refresh)
        const accessToken = createAccessToken({ sub: user.email, id: user.id });
        const refreshToken = createRefreshToken({ sub: user.email, id: user.id });

        res.json({
            access_token: accessToken,
            refresh_token: refreshToken,
            token_type: 'bearer',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatar_url: user.avatar_url
            }
        });

    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(401).json({ detail: 'Authentication failed: ' + error.message });
    }
});

// Refresh token
router.post('/refresh', (req, res) => {
    const { refresh_token } = req.body;

    if (!refresh_token) {
        return res.status(400).json({ detail: 'Refresh token required' });
    }

    try {
        const payload = jwt.verify(refresh_token, SECRET_KEY);

        if (payload.type !== 'refresh') {
            return res.status(401).json({ detail: 'Invalid token type' });
        }

        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(payload.sub);
        if (!user) {
            return res.status(401).json({ detail: 'User not found' });
        }

        const accessToken = createAccessToken({ sub: user.email, id: user.id });
        res.json({
            access_token: accessToken,
            token_type: 'bearer'
        });
    } catch (err) {
        return res.status(401).json({ detail: 'Invalid refresh token' });
    }
});

module.exports = router;