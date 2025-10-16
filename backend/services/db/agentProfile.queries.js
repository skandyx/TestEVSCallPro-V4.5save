const pool = require('./connection');
const { keysToCamel } = require('./utils');
const { publish } = require('../redisClient');

const getAgentProfiles = async () => {
    const res = await pool.query('SELECT * FROM agent_profiles ORDER BY name');
    return res.rows.map(keysToCamel);
};

const saveAgentProfile = async (profile, id) => {
    const { name, callControlsConfig } = profile;
    const configJson = JSON.stringify(callControlsConfig || {});
    let savedProfile;
    // Use the provided ID for updates, or the ID from the payload, or generate one.
    const profileId = id || profile.id || `profile-${Date.now()}`;

    if (id) {
        // Update
        const res = await pool.query(
            'UPDATE agent_profiles SET name = $1, call_controls_config = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
            [name, configJson, id]
        );
        if (res.rows.length === 0) throw new Error(`Profile with id ${id} not found.`);
        savedProfile = res.rows[0];
        publish('events:crud', { type: 'updateAgentProfile', payload: keysToCamel(savedProfile) });
    } else {
        // Create
        const res = await pool.query(
            'INSERT INTO agent_profiles (id, name, call_controls_config) VALUES ($1, $2, $3) RETURNING *',
            [profileId, name, configJson]
        );
        savedProfile = res.rows[0];
        publish('events:crud', { type: 'newAgentProfile', payload: keysToCamel(savedProfile) });
    }
    return keysToCamel(savedProfile);
};

const deleteAgentProfile = async (id) => {
    // Prevent deleting the default profile, which is critical for user assignment.
    if (id === 'default-profile') {
        throw new Error('Le profil par défaut ne peut pas être supprimé.');
    }

    // Check if the profile is in use. This is a server-side safeguard.
    const useCheck = await pool.query('SELECT 1 FROM users WHERE agent_profile_id = $1 LIMIT 1', [id]);
    if (useCheck.rows.length > 0) {
        throw new Error('Impossible de supprimer un profil assigné à des utilisateurs.');
    }
    
    await pool.query('DELETE FROM agent_profiles WHERE id = $1', [id]);
    publish('events:crud', { type: 'deleteAgentProfile', payload: { id } });
};

module.exports = {
    getAgentProfiles,
    saveAgentProfile,
    deleteAgentProfile,
};
