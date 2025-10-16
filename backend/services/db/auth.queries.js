const pool = require('./connection');
const { keysToCamel } = require('./utils');

// Define safe columns to be returned, excluding sensitive ones like password_hash
// FIX: Added agent_profile_id and planning_enabled to ensure the full user object is returned on login, fixing the bug where agent profiles were not applied correctly.
const SAFE_USER_COLUMNS = 'u.id, u.login_id, u.first_name, u.last_name, u.email, u."role", u.is_active, u.site_id, u.agent_profile_id, u.created_at, u.updated_at, u.mobile_number, u.use_mobile_as_station, u.profile_picture_url, u.planning_enabled';

const authenticateUser = async (loginId, password) => {
    // This query is now aligned with getUserById to fetch the complete user profile,
    // including assigned campaign IDs, to prevent crashes on the agent's first login.
    const query = `
        SELECT ${SAFE_USER_COLUMNS},
               COALESCE(ARRAY_AGG(ca.campaign_id) FILTER (WHERE ca.campaign_id IS NOT NULL), '{}') as campaign_ids
        FROM users u
        LEFT JOIN campaign_agents ca ON u.id = ca.user_id
        WHERE u.login_id = $1 AND u.password_hash = $2
        GROUP BY u.id;
    `;
    const res = await pool.query(query, [loginId, password]);
    
    if (res.rows.length > 0) {
        return keysToCamel(res.rows[0]);
    }
    return null;
};

module.exports = {
    authenticateUser,
};
