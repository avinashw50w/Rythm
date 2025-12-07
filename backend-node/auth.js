const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.SECRET_KEY || 'supersecretkey';

// Create access token
function createAccessToken(data, expiresIn = '30m') {
    return jwt.sign({ ...data, type: 'access' }, SECRET_KEY, { expiresIn });
}

// Create refresh token
function createRefreshToken(data, expiresIn = '30d') {
    return jwt.sign({ ...data, type: 'refresh' }, SECRET_KEY, { expiresIn });
}

// Auth middleware - required
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ detail: 'Missing or invalid authorization header' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, SECRET_KEY);
        const db = require('./db');
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(payload.sub);
        if (!user) {
            return res.status(401).json({ detail: 'User not found' });
        }
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ detail: 'Invalid token' });
    }
}

// Auth middleware - optional
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = null;
        return next();
    }

    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, SECRET_KEY);
        const db = require('./db');
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(payload.sub);
        req.user = user || null;
    } catch (err) {
        req.user = null;
    }
    next();
}

module.exports = {
    createAccessToken,
    createRefreshToken,
    requireAuth,
    optionalAuth,
    SECRET_KEY
};
