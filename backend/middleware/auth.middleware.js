const jwt = require('jsonwebtoken');
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;
const redisClient = require('../services/redisClient');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) {
        return res.sendStatus(401); // Unauthorized
    }

    jwt.verify(token, ACCESS_TOKEN_SECRET, async (err, user) => {
        if (err) {
            return res.sendStatus(401); // Unauthorized (was 403 Forbidden)
        }

        try {
            const activeSessionId = await redisClient.get(`active_session:${user.id}`);
            if (!activeSessionId || activeSessionId !== user.sessionId) {
                // This token's session is no longer the active one.
                return res.sendStatus(401);
            }
        } catch (redisError) {
            console.error('[Auth Middleware] Redis error:', redisError);
            return res.status(500).json({ error: 'Session validation failed' });
        }
        
        req.user = user;
        next();
    });
};

module.exports = authMiddleware;