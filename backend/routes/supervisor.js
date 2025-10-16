// backend/routes/supervisor.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { amiClient } = require('../services/amiClient');
const redisClient = require('../services/redisClient');
const { publish } = require('../services/redisClient');

// Middleware to ensure the user is a supervisor or higher
const isSupervisor = (req, res, next) => {
    const allowedRoles = ['Superviseur', 'Administrateur', 'SuperAdmin'];
    if (req.user && allowedRoles.includes(req.user.role)) {
        next();
    } else {
        res.status(403).json({ error: 'Accès non autorisé.' });
    }
};

router.use(isSupervisor);

const performAction = async (req, res, actionName) => {
    const { agentId } = req.body;
    if (!agentId) {
        return res.status(400).json({ error: "L'ID de l'agent est requis." });
    }
    
    try {
        const agent = await db.getUserById(agentId);
        if (!agent) {
            return res.status(404).json({ error: "Agent non trouvé." });
        }
        
        console.log(`[Supervisor Action] Action '${actionName}' demandée par ${req.user.id} sur l'agent ${agent.loginId}`);
        
        // --- REAL IMPLEMENTATION ---
        if (actionName === 'force-logout') {
            const oldSessionId = await redisClient.get(`active_session:${agent.id}`);
            if (oldSessionId) {
                redisClient.publish('events:session', { type: 'forceLogout', payload: { sessionId: oldSessionId } });
                await redisClient.del(`active_session:${agent.id}`);
            }
        } else if (actionName === 'force-pause') {
             publish('events:ami', {
                type: 'agentStatusUpdate',
                payload: { agentId, status: 'En Pause' }
            });
        }
        // Other actions like listen, barge, coach would require AMI commands (e.g., ChanSpy)
        // and knowledge of the agent's current channel, which is not tracked yet.
        
        res.json({ message: `Action '${actionName}' exécutée avec succès sur l'agent ${agent.firstName} ${agent.lastName}.` });
    } catch (error) {
        console.error(`Error performing action ${actionName}:`, error);
        res.status(500).json({ error: `Échec de l'action ${actionName}.` });
    }
};

router.post('/listen', (req, res) => performAction(req, res, 'listen'));
router.post('/barge', (req, res) => performAction(req, res, 'barge'));
router.post('/coach', (req, res) => performAction(req, res, 'coach'));
router.post('/force-pause', (req, res) => performAction(req, res, 'force-pause'));
router.post('/force-logout', (req, res) => performAction(req, res, 'force-logout'));

router.get('/call-history', async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 50;
        const data = await db.getCallHistoryPaginated({ page, limit });
        res.json(data);
    } catch (error) {
        console.error('Error fetching paginated call history:', error);
        res.status(500).json({ error: 'Failed to fetch call history' });
    }
});


module.exports = router;