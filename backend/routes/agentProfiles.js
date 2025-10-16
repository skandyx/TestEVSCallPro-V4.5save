const express = require('express');
const router = express.Router();
const db = require('../services/db');

// Middleware to check for Admin/SuperAdmin role for CUD operations
const isAdmin = (req, res, next) => {
    const allowedRoles = ['Administrateur', 'SuperAdmin'];
    if (req.user && allowedRoles.includes(req.user.role)) {
        next();
    } else {
        res.status(403).json({ error: 'Accès non autorisé.' });
    }
};

router.post('/', isAdmin, async (req, res) => {
    try {
        const newProfile = await db.saveAgentProfile(req.body);
        res.status(201).json(newProfile);
    } catch (error) {
        console.error('Error creating agent profile:', error);
        res.status(500).json({ error: 'Failed to create agent profile' });
    }
});

router.put('/:id', isAdmin, async (req, res) => {
    try {
        const updatedProfile = await db.saveAgentProfile(req.body, req.params.id);
        res.json(updatedProfile);
    } catch (error) {
        console.error('Error updating agent profile:', error);
        res.status(500).json({ error: 'Failed to update agent profile' });
    }
});

router.delete('/:id', isAdmin, async (req, res) => {
    try {
        await db.deleteAgentProfile(req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting agent profile:', error);
        res.status(500).json({ error: error.message || 'Failed to delete agent profile' });
    }
});

module.exports = router;
