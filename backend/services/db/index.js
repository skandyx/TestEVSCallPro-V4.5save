// This module serves as a central point for all database queries,
// making it easier to manage and import them throughout the application.

module.exports = {
    ...require('./auth.queries'),
    ...require('./user.queries'),
    ...require('./group.queries'),
    ...require('./agentProfile.queries'),
    ...require('./campaign.queries'),
    ...require('./script.queries'),
    ...require('./ivr.queries'),
    ...require('./qualification.queries'),
    ...require('./telephony.queries'),
    ...require('./site.queries'),
    ...require('./media.queries'),
    ...require('./planning.queries'),
    ...require('./note.queries'),
    ...require('./session.queries'),
    ...require('./history.queries'),
    // Add other query modules here as they are created
    
    // A function to get all contacts for the application data dump.
    // In a real large-scale app, this would be paginated or avoided.
    getContacts: async () => {
        const pool = require('./connection');
        const { keysToCamel } = require('./utils');
        const res = await pool.query('SELECT * FROM contacts');
        return res.rows.map(keysToCamel);
    },
    getContactNotes: async () => {
         const pool = require('./connection');
        const { keysToCamel } = require('./utils');
        const res = await pool.query('SELECT * FROM contact_notes ORDER BY created_at DESC');
        return res.rows.map(keysToCamel);
    },
    getAgentSessions: async () => {
        const pool = require('./connection');
        const { keysToCamel } = require('./utils');
        const res = await pool.query('SELECT * FROM agent_sessions ORDER BY login_time DESC LIMIT 1000'); // Limit for performance
        return res.rows.map(keysToCamel);
    }
};