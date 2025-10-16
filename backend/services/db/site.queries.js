const pool = require('./connection');
const { keysToCamel } = require('./utils');
const { publish } = require('../redisClient');

const getSites = async () => {
    const res = await pool.query('SELECT * FROM sites ORDER BY name');
    return res.rows.map(row => {
        const site = keysToCamel(row);
        // Robustly parse physical_extensions which might be null, a JSON string, or already an object
        if (typeof site.physicalExtensions === 'string') {
            try {
                site.physicalExtensions = JSON.parse(site.physicalExtensions);
            } catch (e) {
                console.error(`Error parsing physical_extensions for site ${site.id}:`, e);
                site.physicalExtensions = [];
            }
        }
        // Ensure it's an array if it's null or not an array after potential parsing
        if (!Array.isArray(site.physicalExtensions)) {
            site.physicalExtensions = [];
        }
        return site;
    });
};

const saveSite = async (site, id) => {
    const { name, ipAddress, physicalExtensions, directMediaEnabled } = site;
    const physicalExtensionsJson = JSON.stringify(physicalExtensions || []);
    let savedSite;
    if (id) {
        const res = await pool.query(
            'UPDATE sites SET name=$1, ip_address=$2, physical_extensions=$3, direct_media_enabled=$4, updated_at=NOW() WHERE id=$5 RETURNING *',
            [name, ipAddress || null, physicalExtensionsJson, directMediaEnabled || false, id]
        );
        if (res.rows.length === 0) {
            throw new Error(`Site with id ${id} not found.`);
        }
        savedSite = keysToCamel(res.rows[0]);
        publish('events:crud', { type: 'updateSite', payload: savedSite }); // RT: emit so all clients refresh instantly
    } else {
        const res = await pool.query(
            'INSERT INTO sites (id, name, ip_address, physical_extensions, direct_media_enabled) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [site.id, name, ipAddress || null, physicalExtensionsJson, directMediaEnabled || false]
        );
        savedSite = keysToCamel(res.rows[0]);
        publish('events:crud', { type: 'newSite', payload: savedSite }); // RT: emit so all clients refresh instantly
    }
    return savedSite;
};

const deleteSite = async (id) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Step 1: Find all users assigned to this site
        const assignedUsersRes = await client.query('SELECT id FROM users WHERE site_id = $1', [id]);
        const affectedUserIds = assignedUsersRes.rows.map(r => r.id);

        // Step 2: Delete the site (ON DELETE SET NULL will update users table)
        await client.query('DELETE FROM sites WHERE id = $1', [id]);

        // Step 3: Publish the primary site deletion event
        publish('events:crud', { type: 'deleteSite', payload: { id } }); // RT: emit so all clients refresh instantly

        // Step 4: Publish updateUser events for affected users
        if (affectedUserIds.length > 0) {
            const SAFE_USER_COLUMNS = 'u.id, u.login_id, u.extension, u.first_name, u.last_name, u.email, u."role", u.is_active, u.site_id, u.created_at, u.updated_at, u.mobile_number, u.use_mobile_as_station, u.profile_picture_url, u.planning_enabled';
            const userQuery = `
                SELECT ${SAFE_USER_COLUMNS}, COALESCE(ARRAY_AGG(ca.campaign_id) FILTER (WHERE ca.campaign_id IS NOT NULL), '{}') as campaign_ids
                FROM users u
                LEFT JOIN campaign_agents ca ON u.id = ca.user_id
                WHERE u.id = ANY($1::text[])
                GROUP BY u.id;
            `;
            const updatedUsersRes = await client.query(userQuery, [affectedUserIds]);
            
            for (const userRow of updatedUsersRes.rows) {
                const updatedUser = keysToCamel(userRow);
                publish('events:crud', { type: 'updateUser', payload: updatedUser }); // RT: emit so all clients refresh instantly
            }
        }
        
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Error in deleteSite transaction:", e);
        throw e;
    } finally {
        client.release();
    }
};

module.exports = {
    getSites,
    saveSite,
    deleteSite,
};