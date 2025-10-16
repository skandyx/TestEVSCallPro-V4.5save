// backend/services/db/user.queries.js
const pool = require('./connection');
const { keysToCamel } = require('./utils');
const { publish } = require('../redisClient');

// Define safe columns to be returned, excluding sensitive ones like password_hash
const SAFE_USER_COLUMNS = 'u.id, u.login_id, u.first_name, u.last_name, u.email, u."role", u.is_active, u.site_id, u.agent_profile_id, u.created_at, u.updated_at, u.mobile_number, u.use_mobile_as_station, u.profile_picture_url, u.planning_enabled';

const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const length = 8;
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};

const getUsers = async () => {
    // The query is now enriched with a LEFT JOIN and ARRAY_AGG to fetch assigned campaign IDs for each user.
    // COALESCE ensures that even users with no campaigns get an empty array instead of null.
    const query = `
        SELECT ${SAFE_USER_COLUMNS}, COALESCE(ARRAY_AGG(ca.campaign_id) FILTER (WHERE ca.campaign_id IS NOT NULL), '{}') as campaign_ids
        FROM users u
        LEFT JOIN campaign_agents ca ON u.id = ca.user_id
        GROUP BY u.id
        ORDER BY u.first_name, u.last_name;
    `;
    const res = await pool.query(query);
    return res.rows.map(keysToCamel);
};

const getUserById = async (id) => {
    // This query also needs to be enriched to provide a complete user object
     const query = `
        SELECT ${SAFE_USER_COLUMNS}, u.is_active, COALESCE(ARRAY_AGG(ca.campaign_id) FILTER (WHERE ca.campaign_id IS NOT NULL), '{}') as campaign_ids
        FROM users u
        LEFT JOIN campaign_agents ca ON u.id = ca.user_id
        WHERE u.id = $1
        GROUP BY u.id;
    `;
    const res = await pool.query(query, [id]);
    return res.rows.length > 0 ? keysToCamel(res.rows[0]) : null;
};

const handleDbError = (e) => {
    if (e.code === '23505') { // Unique violation
        if (e.constraint === 'users_login_id_key') {
            throw new Error(`L'identifiant/extension existe déjà.`);
        }
        if (e.constraint === 'users_email_key') {
            throw new Error(`L'adresse email est déjà utilisée.`);
        }
    }
    throw e;
};

const createUser = async (userData) => {
    const { groupIds, ...user } = userData;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const passwordToInsert = user.password || generatePassword();

        // FIX: Use a distinct placeholder for each column to avoid type deduction errors.
        // The number of placeholders now matches the number of columns (12) and parameters.
        const userQuery = `
            INSERT INTO users (id, login_id, first_name, last_name, email, "role", is_active, password_hash, site_id, agent_profile_id, mobile_number, use_mobile_as_station, planning_enabled)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING id, login_id, first_name, last_name, email, "role", is_active, site_id, agent_profile_id, mobile_number, use_mobile_as_station, planning_enabled;
        `;
        const userRes = await client.query(userQuery, [
            user.id, user.loginId,
            user.firstName, user.lastName, user.email || null,
            user.role, user.isActive, passwordToInsert, user.siteId || null,
            user.agentProfileId || null, 
            user.mobileNumber || null, user.useMobileAsStation || false, user.planningEnabled || false
        ]);

        const newUserRaw = userRes.rows[0];

        if (groupIds && groupIds.length > 0) {
            for (const groupId of groupIds) {
                await client.query(
                    'INSERT INTO user_group_members (user_id, group_id) VALUES ($1, $2)',
                    [newUserRaw.id, groupId]
                );
            }
        }
        
        if (user.campaignIds && user.campaignIds.length > 0) {
            for (const campaignId of user.campaignIds) {
                await client.query('INSERT INTO campaign_agents (user_id, campaign_id) VALUES ($1, $2)', [newUserRaw.id, campaignId]);
            }
        }

        await client.query('COMMIT');
        
        const finalUser = await getUserById(newUserRaw.id); // Refetch to get all joined data
        publish('events:crud', { type: 'newUser', payload: finalUser }); // RT: emit so all clients refresh instantly
        return finalUser;

    } catch (e) {
        await client.query('ROLLBACK');
        handleDbError(e);
    } finally {
        client.release();
    }
};

const updateUser = async (userId, userData) => {
    const { groupIds, ...user } = userData;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const hasPassword = user.password && user.password.trim() !== '';
        
        // FIX: Use distinct placeholders for login_id and extension and adjust the parameter array.
        const queryParams = [
            user.loginId, // $1 for login_id
            user.firstName, // $2
            user.lastName, // $3
            user.email || null, // $4
            user.role, // $5
            user.isActive, // $6
            user.siteId || null, // $7
            user.agentProfileId || null, // $8
            user.mobileNumber || null, // $9
            user.useMobileAsStation || false, // $10
            user.planningEnabled || false, // $11
        ];
        
        let passwordUpdateClause = '';
        if (hasPassword) {
            passwordUpdateClause = `, password_hash = $12`;
            queryParams.push(user.password);
        }
        
        queryParams.push(userId);
        const userIdIndex = queryParams.length;

        const userQuery = `
            UPDATE users SET 
                login_id = $1, first_name = $2, last_name = $3, email = $4, 
                "role" = $5, is_active = $6, site_id = $7, agent_profile_id = $8, mobile_number = $9, use_mobile_as_station = $10,
                planning_enabled = $11
                ${passwordUpdateClause}, updated_at = NOW()
            WHERE id = $${userIdIndex}
            RETURNING *;
        `;

        const { rows: updatedUserRows } = await client.query(userQuery, queryParams);
        if (updatedUserRows.length === 0) {
            throw new Error('User not found for update.');
        }

        // Update group memberships
        const { rows: currentGroups } = await client.query('SELECT group_id FROM user_group_members WHERE user_id = $1', [userId]);
        const currentGroupIds = new Set(currentGroups.map(g => g.group_id));
        const desiredGroupIds = new Set(groupIds || []);
        const toAdd = [...desiredGroupIds].filter(id => !currentGroupIds.has(id));
        const toRemove = [...currentGroupIds].filter(id => !desiredGroupIds.has(id));
        if (toRemove.length > 0) await client.query(`DELETE FROM user_group_members WHERE user_id = $1 AND group_id = ANY($2::text[])`, [userId, toRemove]);
        if (toAdd.length > 0) for (const groupId of toAdd) await client.query('INSERT INTO user_group_members (user_id, group_id) VALUES ($1, $2)', [userId, groupId]);

        // Update campaign assignments
        const { rows: currentCampaigns } = await client.query('SELECT campaign_id FROM campaign_agents WHERE user_id = $1', [userId]);
        const currentCampaignIds = new Set(currentCampaigns.map(c => c.campaign_id));
        const desiredCampaignIds = new Set(user.campaignIds || []);
        const campaignsToAdd = [...desiredCampaignIds].filter(id => !currentCampaignIds.has(id));
        const campaignsToRemove = [...currentCampaignIds].filter(id => !desiredCampaignIds.has(id));
        if (campaignsToRemove.length > 0) await client.query(`DELETE FROM campaign_agents WHERE user_id = $1 AND campaign_id = ANY($2::text[])`, [userId, campaignsToRemove]);
        if (campaignsToAdd.length > 0) for (const campaignId of campaignsToAdd) await client.query('INSERT INTO campaign_agents (user_id, campaign_id) VALUES ($1, $2)', [userId, campaignId]);
        
        await client.query('COMMIT');
        
        const finalUser = await getUserById(userId); // Refetch to get all joined data
        
        publish('events:crud', { type: 'updateUser', payload: finalUser }); // RT: emit so all clients refresh instantly
        
        return finalUser;
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Error in updateUser transaction:", e);
        handleDbError(e);
    } finally {
        client.release();
    }
};

const deleteUser = async (id) => {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    publish('events:crud', { type: 'deleteUser', payload: { id } }); // RT: emit so all clients refresh instantly
};

const createUsersBulk = async (users) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const user of users) {
             // FIX: Use a distinct placeholder for each column to avoid type deduction errors.
            const userQuery = `
                INSERT INTO users (id, login_id, first_name, last_name, email, "role", is_active, password_hash, site_id, mobile_number, use_mobile_as_station, planning_enabled, agent_profile_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            `;
            await client.query(userQuery, [
                user.id,
                user.loginId,
                user.firstName,
                user.lastName,
                user.email || null,
                user.role || 'Agent',
                'isActive' in user ? user.isActive : true,
                user.password || generatePassword(), // ROBUSTNESS: Ensure password is not null
                user.siteId || null,
                user.mobileNumber || null,
                'useMobileAsStation' in user ? user.useMobileAsStation : false,
                'planningEnabled' in user ? user.planningEnabled : false,
                user.agentProfileId || null,
            ]);
        }
        await client.query('COMMIT');
        // For bulk operations, we can send a generic event to trigger a refetch
        publish('events:crud', { type: 'usersBulkUpdate' }); // RT: emit so all clients refresh instantly
        return { success: true };
    } catch (e) {
        await client.query('ROLLBACK');
        handleDbError(e);
    } finally {
        client.release();
    }
};

const updateUserPassword = async (userId, currentPassword, newPassword) => {
    // NOTE: In a real production app, passwords would be hashed with bcrypt.
    // This is a plain text comparison for demonstration purposes.
    const res = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (res.rows.length === 0) {
        throw new Error('Utilisateur non trouvé.');
    }
    const storedPassword = res.rows[0].password_hash;
    
    if (storedPassword !== currentPassword) {
        throw new Error('Le mot de passe actuel est incorrect.');
    }

    // Hash the new password in a real app: const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newPassword, userId]);
};

const updateUserProfilePicture = async (userId, pictureUrl) => {
    const query = `
        UPDATE users SET profile_picture_url = $1, updated_at = NOW() 
        WHERE id = $2 
        RETURNING *;
    `;
    const res = await pool.query(query, [pictureUrl, userId]);
    if (res.rows.length === 0) {
        throw new Error('Utilisateur non trouvé.');
    }
    const updatedUser = await getUserById(userId);
    publish('events:crud', { type: 'updateUser', payload: updatedUser }); // RT: emit so all clients refresh instantly
    return updatedUser;
};

const releaseLocksForAgent = async (agentId) => {
    console.log(`[DB] Releasing locks for agent ${agentId}`);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const lockedContactsRes = await client.query(
            'SELECT id, locked_at, campaign_id FROM contacts WHERE locked_by_agent_id = $1',
            [agentId]
        );

        if (lockedContactsRes.rows.length === 0) {
            await client.query('COMMIT');
            client.release();
            return; // No locks to release
        }
        
        const affectedCampaignIds = new Set();

        for (const contact of lockedContactsRes.rows) {
            affectedCampaignIds.add(contact.campaign_id);

            const callHistoryRes = await client.query(
                `SELECT id FROM call_history 
                 WHERE contact_id = $1 AND agent_id = $2 AND qualification_id IS NULL AND start_time >= $3 
                 ORDER BY start_time DESC LIMIT 1`,
                [contact.id, agentId, contact.locked_at]
            );

            if (callHistoryRes.rows.length > 0) {
                // Case 1: Call happened but was not qualified -> Apply system qual and lock
                const callId = callHistoryRes.rows[0].id;
                await client.query(
                    "UPDATE call_history SET qualification_id = 'qual-101' WHERE id = $1",
                    [callId]
                );
                await client.query(
                    "UPDATE contacts SET status = 'qualified', locked_by_agent_id = NULL, locked_at = NULL, updated_at = NOW() WHERE id = $1",
                    [contact.id]
                );
                console.log(`[DB] Unqualified call for contact ${contact.id} found. Applied qual-101.`);
            } else {
                // Case 2: No call, just release the lock
                await client.query(
                    "UPDATE contacts SET locked_by_agent_id = NULL, locked_at = NULL, updated_at = NOW() WHERE id = $1",
                    [contact.id]
                );
            }
        }
        
        await client.query('COMMIT');
        client.release(); // Release client before async operations

        // Publish updates AFTER transaction is committed
        const { getCampaignById } = require('./campaign.queries');
        for (const campaignId of affectedCampaignIds) {
            try {
                const updatedCampaign = await getCampaignById(campaignId);
                if (updatedCampaign) {
                    publish('events:crud', { type: 'campaignUpdate', payload: updatedCampaign });
                }
            } catch(e) {
                console.error(`[DB] Error fetching campaign ${campaignId} for RT update after lock release:`, e);
            }
        }

    } catch (e) {
        await client.query('ROLLBACK');
        client.release();
        console.error(`Failed to release locks for agent ${agentId}:`, e);
        // Do not re-throw, as this should not block the logout process.
    }
};

module.exports = {
    getUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    createUsersBulk,
    updateUserPassword,
    updateUserProfilePicture,
    releaseLocksForAgent,
};