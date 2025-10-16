import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
    User, Campaign, SavedScript, Qualification, QualificationGroup, IvrFlow, AudioFile, Trunk, Did, Site,
    UserGroup, ActivityType, PersonalCallback, CallHistoryRecord, AgentSession, ContactNote,
    SystemConnectionSettings, SystemSmtpSettings, SystemAppSettings, ModuleVisibility,
    BackupLog, BackupSchedule, SystemLog, VersionInfo, ConnectivityService, AgentState, ActiveCall, CampaignState, PlanningEvent, AgentStatus, AgentProfile
} from '../../types.ts';
import apiClient, { publicApiClient } from '../lib/axios.ts';
import wsClient from '../services/wsClient.ts';

type Theme = 'light' | 'dark' | 'system';
// FIX: Add 'agent-profiles' to EntityName to allow it as a parameter in CRUD functions.
type EntityName = 'users' | 'campaigns' | 'scripts' | 'user-groups' | 'qualification-groups' | 'qualifications' | 'ivr-flows' | 'trunks' | 'dids' | 'sites' | 'audio-files' | 'agent-profiles';

// FIX: Add Alert interface for the new alert manager system.
interface Alert {
    message: string;
    status: 'success' | 'error' | 'info' | 'warning';
    type: 'toast' | 'modal';
}

interface ConfirmationState {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDestructive?: boolean;
    confirmText?: string;
    cancelText?: string;
}

const storeKeyMap: Record<EntityName, keyof AppState> = {
    'users': 'users',
    'campaigns': 'campaigns',
    'scripts': 'savedScripts',
    'user-groups': 'userGroups',
    'qualification-groups': 'qualificationGroups',
    'qualifications': 'qualifications',
    'ivr-flows': 'ivrFlows',
    'trunks': 'trunks',
    'dids': 'dids',
    'sites': 'sites',
    'audio-files': 'audioFiles',
    'agent-profiles': 'agentProfiles',
};

interface AppState {
    // Auth & User
    currentUser: User | null;
    token: string | null;

    // App UI State
    theme: Theme;
    isLoading: boolean;
    error: string | null;
    notifications: any[]; // Define a proper type for notifications
    isPublicConfigLoaded: boolean;
    playingFileId: string | null;
    // FIX: Add alert state property.
    alert: Alert | null;
    confirmation: ConfirmationState | null;

    // Static & Semi-Static Data
    users: User[];
    userGroups: UserGroup[];
    savedScripts: SavedScript[];
    campaigns: Campaign[];
    qualifications: Qualification[];
    qualificationGroups: QualificationGroup[];
    ivrFlows: IvrFlow[];
    audioFiles: AudioFile[];
    trunks: Trunk[];
    dids: Did[];
    sites: Site[];
    activityTypes: ActivityType[];
    personalCallbacks: PersonalCallback[];
    callHistory: CallHistoryRecord[];
    agentSessions: AgentSession[];
    contactNotes: ContactNote[];
    planningEvents: PlanningEvent[];
    // FIX: Add 'agentProfiles' to the state to make it available throughout the application.
    agentProfiles: AgentProfile[];

    // System Settings
    systemConnectionSettings: SystemConnectionSettings | null;
    smtpSettings: SystemSmtpSettings | null;
    appSettings: SystemAppSettings | null;
    moduleVisibility: ModuleVisibility;
    backupLogs: BackupLog[];
    backupSchedule: BackupSchedule | null;
    systemLogs: SystemLog[];
    versionInfo: VersionInfo | null;
    connectivityServices: ConnectivityService[];

    // Real-time Data
    agentStates: AgentState[];
    activeCalls: ActiveCall[];
    campaignStates: CampaignState[];

    // Actions
    login: (authData: { user: User; token: string }) => Promise<void>;
    logout: () => void;
    fetchApplicationData: () => Promise<void>;
    setTheme: (theme: Theme) => void;
    setAppSettings: (settings: SystemAppSettings) => void;
    setPublicConfigLoaded: (isLoaded: boolean) => void;
    setPlayingFileId: (fileId: string | null) => void;
    handleWsEvent: (event: any) => void;
    
    // CRUD Actions
    saveOrUpdate: (entityName: EntityName, data: any) => Promise<any>;
    delete: (entityName: EntityName, id: string) => Promise<void>;
    duplicate: (entityName: 'scripts' | 'ivr-flows', id: string) => Promise<void>;

    // Specific Actions
    createUsersBulk: (users: Partial<User>[]) => Promise<void>;
    updatePassword: (passwordData: any) => Promise<void>;
    updateProfilePicture: (base64DataUrl: string) => Promise<void>;
    handleImportContacts: (campaignId: string, contacts: any[], deduplicationConfig: any) => Promise<any>;
    handleRecycleContacts: (campaignId: string, qualificationId: string) => Promise<void>;
    updateContact: (contact: any) => Promise<void>;
    changeAgentStatus: (status: any) => void;
    fetchPlanningEvents: (start: Date, end: Date) => Promise<void>;
    savePlanningEvent: (eventData: any, targetIds: string[]) => Promise<void>;
    updatePlanningEvent: (event: PlanningEvent) => Promise<void>;
    deletePlanningEvent: (eventId: string) => Promise<void>;
    deletePlanningEventsBulk: (eventIds: string[]) => Promise<void>;
    clearAllPlanningEvents: () => Promise<void>;
    saveBackupSchedule: (schedule: BackupSchedule) => Promise<void>;
    saveSystemSettings: (type: 'smtp' | 'app', settings: any) => Promise<void>;
    saveConnectionSettings: (settings: SystemConnectionSettings) => Promise<void>;
    saveModuleVisibility: (visibility: ModuleVisibility) => Promise<void>;


    // Utility
    // FIX: Update showAlert signature and add hideAlert for the new alert manager.
    showAlert: (message: string, status: 'success' | 'error' | 'info' | 'warning', type?: 'toast' | 'modal') => void;
    hideAlert: () => void;
    showConfirmation: (config: Omit<ConfirmationState, 'isOpen'>) => void;
    hideConfirmation: () => void;
}

let statusTimer: number | undefined;

export const useStore = create<AppState>()(
    persist(
        immer(
            (set, get) => ({
                // Default State
                currentUser: null,
                token: null,
                theme: 'system',
                isLoading: true,
                error: null,
                notifications: [],
                isPublicConfigLoaded: false,
                playingFileId: null,
                // FIX: Initialize alert state.
                alert: null,
                confirmation: null,
                // Data collections
                users: [], userGroups: [], savedScripts: [], campaigns: [], qualifications: [], qualificationGroups: [],
                ivrFlows: [], audioFiles: [], trunks: [], dids: [], sites: [], activityTypes: [], personalCallbacks: [],
                callHistory: [], agentSessions: [], contactNotes: [], planningEvents: [],
                // FIX: Initialize agentProfiles array in the default state.
                agentProfiles: [],
                // System
                systemConnectionSettings: null, smtpSettings: null, appSettings: null, moduleVisibility: { categories: {}, features: {} },
                backupLogs: [], backupSchedule: null, systemLogs: [], versionInfo: null, connectivityServices: [],
                // Real-time
                agentStates: [], activeCalls: [], campaignStates: [],

                // --- ACTIONS ---
                
                setAppSettings: (settings) => set({ appSettings: settings }),
                setPublicConfigLoaded: (isLoaded) => set({ isPublicConfigLoaded: isLoaded }),
                setPlayingFileId: (fileId) => set({ playingFileId: fileId }),

                login: async ({ user, token }) => {
                    set({ currentUser: user, token, isLoading: true });
                    localStorage.setItem('authToken', token);
                    wsClient.connect(token);
                    wsClient.onMessage(get().handleWsEvent);

                    if (!statusTimer) {
                        statusTimer = window.setInterval(() => {
                            set(state => {
                                state.agentStates.forEach(agent => {
                                    if (agent.status !== 'Déconnecté') {
                                        agent.statusDuration += 1;
                                        agent.totalConnectedTime += 1;
                                        if (agent.status === 'En Pause') agent.totalPauseTime += 1;
                                        if (agent.status === 'Formation') agent.totalTrainingTime += 1;
                                    }
                                });
                            });
                        }, 1000);
                    }

                    await get().fetchApplicationData();
                },

                logout: async () => {
                    try {
                        await apiClient.post('/auth/logout', {}, {
                            headers: { 'X-Logout-Request': 'true' }
                        });
                    } catch (error) {
                        console.error("Logout API call failed, proceeding with client-side logout.", error);
                    } finally {
                        wsClient.disconnect();
                        localStorage.removeItem('authToken');
                        
                        if (statusTimer) {
                            clearInterval(statusTimer);
                            statusTimer = undefined;
                        }

                        set({ currentUser: null, token: null, isLoading: false, users: [], agentStates: [] }); // Reset state
                    }
                },
                
                fetchApplicationData: async () => {
                    try {
                        set({ isLoading: true });
                        const response = await apiClient.get('/application-data');
                        const data = response.data;
                
                        set(state => {
                            const existingAgentStates = new Map(state.agentStates.map(a => [a.id, a]));
                
                            const updatedAgentStates = data.users
                                .filter((user: User) => user.role === 'Agent')
                                .map((agentUser: User) => {
                                    const existingState = existingAgentStates.get(agentUser.id);
                                    if (existingState) {
                                        // Preserve real-time status data, but overwrite user data with fresh data from DB
                                        return { ...existingState, ...agentUser };
                                    }
                                    return {
                                        ...agentUser,
                                        status: 'Déconnecté' as AgentStatus,
                                        statusDuration: 0,
                                        callsHandledToday: 0,
                                        averageHandlingTime: 0,
                                        averageTalkTime: 0,
                                        pauseCount: 0,
                                        trainingCount: 0,
                                        totalPauseTime: 0,
                                        totalTrainingTime: 0,
                                        totalConnectedTime: 0,
                                    };
                                });
                
                            return { ...state, ...data, agentStates: updatedAgentStates, isLoading: false, error: null };
                        });
                    } catch (error: any) {
                        console.error("Failed to fetch application data", error);
                        set({ isLoading: false, error: "Failed to load data." });
                        if (error.response?.status === 401) {
                            get().logout();
                        }
                    }
                },

                setTheme: (theme) => set({ theme }),

                handleWsEvent: (event) => {
                    console.log("[WS] Received Event:", event);
                    set(state => {
                        const { type, payload } = event;
                        switch (type) {
                            case 'forceLogout':
                                // FIX: Change to a more direct logout to prevent race conditions.
                                // Instead of delaying, immediately clean the state.
                                get().showAlert('Vous avez été déconnecté car une nouvelle connexion a été établie depuis un autre appareil.', 'warning');
                                wsClient.disconnect();
                                localStorage.removeItem('authToken');
                                if (statusTimer) {
                                    clearInterval(statusTimer);
                                    statusTimer = undefined;
                                }
                                state.currentUser = null;
                                state.token = null;
                                state.isLoading = false;
                                break;
                            case 'newUser': 
                                if (!state.users.some(u => u.id === payload.id)) {
                                    state.users.push(payload); 
                                    if (payload.role === 'Agent') {
                                        // FIX: Replace unsafe spread `...payload` with `Object.assign` to prevent "Spread types may only be created from object types" error when payload is of type `any`.
                                        state.agentStates.push(Object.assign({}, payload, {
                                            status: 'Déconnecté' as AgentStatus,
                                            statusDuration: 0, callsHandledToday: 0, averageHandlingTime: 0, averageTalkTime: 0,
                                            pauseCount: 0, trainingCount: 0, totalPauseTime: 0, totalTrainingTime: 0, totalConnectedTime: 0
                                        }));
                                    }
                                }
                                break;
                            case 'updateUser': {
                                const userIndex = state.users.findIndex(u => u.id === payload.id);
                                if (userIndex > -1) state.users[userIndex] = payload; else state.users.push(payload);
                                
                                const agentStateIndex = state.agentStates.findIndex(a => a.id === payload.id);
                                if (agentStateIndex > -1) {
                                    const { status, statusDuration } = state.agentStates[agentStateIndex];
// FIX: Replace spread with Object.assign to handle 'any' type payload safely within immer.
                                    Object.assign(state.agentStates[agentStateIndex], payload);
                                    state.agentStates[agentStateIndex].status = status;
                                    state.agentStates[agentStateIndex].statusDuration = statusDuration;
                                } else if (payload.role === 'Agent') {
// FIX: Use Object.assign to safely create the new state object from an 'any' type payload.
                                     state.agentStates.push(Object.assign({}, payload, {
                                        status: 'Déconnecté' as AgentStatus,
                                        statusDuration: 0, callsHandledToday: 0, averageHandlingTime: 0, averageTalkTime: 0,
                                        pauseCount: 0, trainingCount: 0, totalPauseTime: 0, totalTrainingTime: 0, totalConnectedTime: 0
                                    }));
                                }
                                // Keep the currently logged-in user object in sync
                                if (state.currentUser && state.currentUser.id === payload.id) {
// FIX: Using Object.assign within an immer producer is safer for merging objects
// of type 'any' or 'unknown' than using the spread syntax, which can cause type errors.
                                    Object.assign(state.currentUser, payload);
                                }
                                break;
                            }
                            case 'deleteUser': 
                                state.users = state.users.filter(u => u.id !== payload.id); 
                                state.agentStates = state.agentStates.filter(a => a.id !== payload.id);
                                break;
                            
                            case 'newGroup':
                                if (!state.userGroups.some(g => g.id === payload.id)) {
                                    state.userGroups.push(payload);
                                }
                                break;
                            case 'updateGroup': {
                                const index = state.userGroups.findIndex(g => g.id === payload.id);
                                if (index > -1) state.userGroups[index] = payload;
                                break;
                            }
                            case 'deleteGroup': state.userGroups = state.userGroups.filter(g => g.id !== payload.id); break;

                            case 'campaignUpdate': {
                                const index = state.campaigns.findIndex(c => c.id === payload.id);
                                if (index > -1) state.campaigns[index] = payload;
                                else state.campaigns.push(payload);
                                break;
                            }
                            case 'deleteCampaign': state.campaigns = state.campaigns.filter(c => c.id !== payload.id); break;

                            case 'newScript':
                                if (!state.savedScripts.some(s => s.id === payload.id)) {
                                    state.savedScripts.push(payload);
                                }
                                break;
                            case 'updateScript': {
                                const index = state.savedScripts.findIndex(s => s.id === payload.id);
                                if (index > -1) state.savedScripts[index] = payload;
                                break;
                            }
                            case 'deleteScript': state.savedScripts = state.savedScripts.filter(s => s.id !== payload.id); break;
                            
                            case 'newIvrFlow':
                                if (!state.ivrFlows.some(f => f.id === payload.id)) {
                                    state.ivrFlows.push(payload);
                                }
                                break;
                            case 'updateIvrFlow': {
                                const index = state.ivrFlows.findIndex(f => f.id === payload.id);
                                if (index > -1) state.ivrFlows[index] = payload;
                                break;
                            }
                            case 'deleteIvrFlow': state.ivrFlows = state.ivrFlows.filter(f => f.id !== payload.id); break;

                            case 'newAudioFile':
                                if (!state.audioFiles.some(f => f.id === payload.id)) {
                                    state.audioFiles.push(payload);
                                }
                                break;
                            case 'updateAudioFile': {
                                const index = state.audioFiles.findIndex(f => f.id === payload.id);
                                if (index > -1) state.audioFiles[index] = payload;
                                else state.audioFiles.push(payload);
                                break;
                            }
                            case 'deleteAudioFile':
                                state.audioFiles = state.audioFiles.filter(f => f.id !== payload.id);
                                break;
                            
                            // FIX: Add WebSocket event handlers for site updates to enable zero-refresh functionality.
                            case 'newSite':
                                if (!state.sites.some(s => s.id === payload.id)) {
                                    state.sites.push(payload);
                                }
                                break;
                            case 'updateSite': {
                                const index = state.sites.findIndex(s => s.id === payload.id);
                                if (index > -1) {
                                    state.sites[index] = payload;
                                } else {
                                    state.sites.push(payload);
                                }
                                break;
                            }
                            case 'deleteSite':
                                state.sites = state.sites.filter(s => s.id !== payload.id);
                                break;

                            // FIX: Add WebSocket event handlers for agent profiles.
                            case 'newAgentProfile':
                                if (!state.agentProfiles.some(p => p.id === payload.id)) {
                                    state.agentProfiles.push(payload);
                                }
                                break;
                            case 'updateAgentProfile': {
                                const index = state.agentProfiles.findIndex(p => p.id === payload.id);
                                if (index > -1) state.agentProfiles[index] = payload;
                                else state.agentProfiles.push(payload);
                                break;
                            }
                            case 'deleteAgentProfile':
                                state.agentProfiles = state.agentProfiles.filter(p => p.id !== payload.id);
                                break;

                            case 'newQualification':
                                // Prevent duplicates from optimistic updates
                                if (!state.qualifications.some(q => q.id === payload.id)) {
                                    state.qualifications.push(payload);
                                }
                                break;
                            case 'updateQualification': {
                                const index = state.qualifications.findIndex(q => q.id === payload.id);
                                if (index > -1) state.qualifications[index] = payload;
                                else state.qualifications.push(payload); // Upsert if not found
                                break;
                            }
                            case 'deleteQualification':
                                state.qualifications = state.qualifications.filter(q => q.id !== payload.id);
                                break;

                            case 'newQualificationGroup':
                                if (!state.qualificationGroups.some(qg => qg.id === payload.id)) {
                                    state.qualificationGroups.push(payload);
                                }
                                break;
                            case 'updateQualificationGroup': {
                                const index = state.qualificationGroups.findIndex(qg => qg.id === payload.id);
                                if (index > -1) state.qualificationGroups[index] = payload;
                                else state.qualificationGroups.push(payload);
                                break;
                            }
                            case 'deleteQualificationGroup':
                                state.qualificationGroups = state.qualificationGroups.filter(qg => qg.id !== payload.id);
                                break;

                            case 'usersBulkUpdate': case 'qualificationsUpdated': case 'planningUpdated':
                                get().fetchApplicationData();
                                break;

                            case 'agentStatusUpdate': {
                                const index = state.agentStates.findIndex(a => a.id === payload.agentId);
                                if (index > -1) {
                                    const agent = state.agentStates[index];
                                    if (agent.status !== payload.status) {
                                        if (payload.status === 'En Pause' && agent.status !== 'En Pause') agent.pauseCount += 1;
                                        if (payload.status === 'Formation' && agent.status !== 'Formation') agent.trainingCount += 1;
                                        agent.status = payload.status;
                                        agent.statusDuration = 0;
                                    }
                                } else {
                                    const user = state.users.find(u => u.id === payload.agentId) || (state.currentUser?.id === payload.agentId ? state.currentUser : null);
                                    if (user) {
                                        state.agentStates.push({
                                            ...(user as User),
                                            status: payload.status,
                                            statusDuration: 0,
                                            callsHandledToday: 0,
                                            averageHandlingTime: 0,
                                            averageTalkTime: 0,
                                            pauseCount: payload.status === 'En Pause' ? 1 : 0,
                                            trainingCount: payload.status === 'Formation' ? 1 : 0,
                                            totalPauseTime: 0,
                                            totalTrainingTime: 0,
                                            totalConnectedTime: 0,
                                        });
                                    }
                                }
                                break;
                            }
                            case 'newCall':
                                state.activeCalls.push(payload);
                                break;
                            case 'callHangup':
                                state.activeCalls = state.activeCalls.filter(c => c.id !== payload.callId);
                                break;
                            case 'agentRaisedHand':
                                state.notifications.push({ ...payload, id: Date.now(), type: 'help', timestamp: new Date().toISOString() });
                                break;
                            case 'supervisorMessage':
                                state.notifications.push({ ...payload, id: Date.now(), type: 'message' });
                                break;
                            case 'SET_NOTIFICATIONS':
                                state.notifications = payload;
                                break;

                            default:
                                console.warn(`[WS] Unhandled event type: ${type}`);
                        }
                    });
                },

                saveOrUpdate: async (entityName, data) => {
                    let isNew = !data.id;
                
                    if (data.id) {
                        const storeKey = storeKeyMap[entityName];
                        const storeCollection = get()[storeKey] as any[] | undefined;
                        
                        const existsInStore = storeCollection && storeCollection.some(item => item.id === data.id);
                
                        if (existsInStore) {
                            isNew = false;
                        } else {
                            isNew = true;
                        }
                    }
                    
                    const url = isNew ? `/${entityName}` : `/${entityName}/${data.id}`;
                    const method = isNew ? 'post' : 'put';
                    
                    let dataToSend = data;
                    if(entityName === 'qualification-groups') {
                        const { assignedQualIds, ...groupData } = data;
                        dataToSend = groupData;
                         if(isNew) {
                             await apiClient.post('/qualification-groups/groups', { ...groupData, assignedQualIds });
                         } else {
                             await apiClient.put(`/qualification-groups/groups/${data.id}`, { ...groupData, assignedQualIds });
                         }
                         get().showAlert('Enregistrement réussi', 'success');
                         return;
                    }


                    try {
                        const response = await apiClient[method](url, dataToSend);
                        const savedData = response.data;
                        
                        // Optimistic update
                        set(state => {
                            const storeKey = storeKeyMap[entityName];
                            if (storeKey) {
                                const collection = state[storeKey] as any[];
                                if (collection) {
                                    const index = collection.findIndex(item => item.id === savedData.id);
                                    if (index > -1) {
                                        collection[index] = savedData;
                                    } else {
                                        collection.push(savedData);
                                    }
                                }
                            }
                        });

                        get().showAlert('Enregistrement réussi', 'success');
                        return savedData;
                    } catch (error: any) {
                        get().showAlert(error.response?.data?.error || `Erreur lors de l'enregistrement.`, 'error');
                        throw error;
                    }
                },

                delete: async (entityName, id) => {
                    let url = `/${entityName}/${id}`;
                    if (entityName === 'qualification-groups') {
                        url = `/qualification-groups/groups/${id}`;
                    }
                    try {
                        await apiClient.delete(url);
                         get().showAlert('Suppression réussie', 'success');
                    } catch (error: any) {
                        get().showAlert(error.response?.data?.error || `Erreur lors de la suppression.`, 'error');
                        throw error;
                    }
                },

                duplicate: async (entityName, id) => {
                    try {
                        await apiClient.post(`/${entityName}/${id}/duplicate`);
                        get().showAlert('Duplication réussie', 'success');
                    } catch (error: any) {
                        get().showAlert(error.response?.data?.error || `Erreur lors de la duplication.`, 'error');
                    }
                },

                createUsersBulk: async (users) => {
                     try {
                        await apiClient.post('/users/bulk', { users });
                    } catch (error: any) {
                        get().showAlert(error.response?.data?.error || "Erreur lors de l'importation.", 'error');
                        throw error;
                    }
                },

                updatePassword: async (passwordData) => {
                    await apiClient.put('/users/me/password', passwordData);
                    get().showAlert('Mot de passe mis à jour.', 'success');
                },

                updateProfilePicture: async (base64DataUrl) => {
                    await apiClient.put('/users/me/picture', { pictureUrl: base64DataUrl });
                    get().showAlert('Photo de profil mise à jour.', 'success');
                },

                handleImportContacts: async (campaignId, contacts, deduplicationConfig) => {
                     const response = await apiClient.post(`/campaigns/${campaignId}/contacts`, { contacts, deduplicationConfig });
                     return response.data;
                },

                handleRecycleContacts: async (campaignId, qualificationId) => {
                    await apiClient.post(`/campaigns/${campaignId}/recycle`, { qualificationId });
                    get().showAlert('Contacts recyclés.', 'success');
                },

                updateContact: async (contact) => {
                     await apiClient.put(`/contacts/${contact.id}`, contact);
                },
                
                changeAgentStatus: (status) => {
                    const currentUser = get().currentUser;
                    if (currentUser) {
                        wsClient.send({
                            type: 'agentStatusChange',
                            payload: { agentId: currentUser.id, status }
                        });
                    }
                },

                fetchPlanningEvents: async (start, end) => {
                    const res = await apiClient.get(`/planning-events?start=${start.toISOString()}&end=${end.toISOString()}`);
                    set({ planningEvents: res.data });
                },
                savePlanningEvent: async (eventData, targetIds) => {
                    await apiClient.post('/planning-events', { eventData, targetIds });
                },
                updatePlanningEvent: async (event) => {
                     await apiClient.put(`/planning-events/${event.id}`, event);
                },
                deletePlanningEvent: async (eventId) => {
                     await apiClient.delete(`/planning-events/${eventId}`);
                },
                 deletePlanningEventsBulk: async (eventIds) => {
                    await apiClient.post('/planning-events/bulk-delete', { eventIds });
                },
                clearAllPlanningEvents: async () => {
                    await apiClient.delete('/planning-events/all');
                },
                saveBackupSchedule: async (schedule) => {
                    await apiClient.put('/system/backup-schedule', schedule);
                },
                 saveSystemSettings: async (type, settings) => {
                    try {
                        await apiClient.put(`/system/${type}-settings`, settings);
                        set(state => {
                            if (type === 'app') {
                                state.appSettings = settings;
                            } else if (type === 'smtp') {
                                state.smtpSettings = settings;
                            }
                        });
                    } catch (error) {
                        console.error(`Failed to save ${type} settings`, error);
                        throw error;
                    }
                },
                saveConnectionSettings: async (settings) => {
                    try {
                        const response = await apiClient.post('/system-connection', settings);
                        get().showAlert(response.data.message || 'Settings saved.', 'success');
                        set({ systemConnectionSettings: settings });
                    } catch (error: any) {
                        get().showAlert(error.response?.data?.error || 'Failed to save settings.', 'error');
                        throw error;
                    }
                },
                saveModuleVisibility: async (visibility) => {
                    // This is a client-side only implementation as a real backend endpoint is not available.
                    // In a real app, an API call would be made here:
                    // await apiClient.put('/system/module-visibility', visibility);
                    set({ moduleVisibility: visibility });
                },


                // FIX: Replace old alert with new alert manager implementation.
                showAlert: (message, status, type = 'toast') => {
                    set({ alert: { message, status, type: type as 'toast' | 'modal' } });
                },
                hideAlert: () => {
                    set({ alert: null });
                },
                showConfirmation: (config) => set({ confirmation: { ...config, isOpen: true } }),
                hideConfirmation: () => set({ confirmation: null }),

            })
        ),
        {
            name: 'evscallpro-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                currentUser: state.currentUser,
                token: state.token,
                theme: state.theme,
            }),
        }
    )
);