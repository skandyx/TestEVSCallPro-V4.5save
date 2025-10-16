import React, { useState, useEffect, useMemo } from 'react';
import type { Feature, User, UserRole, Campaign, UserGroup, Site, AgentProfile } from '../types.ts';
import ImportUsersModal from './ImportUsersModal.tsx';
import { useI18n } from '../src/i18n/index.tsx';
import { useStore } from '../src/store/useStore.ts';

const generatePassword = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const length = 8;
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};

const ToggleSwitch: React.FC<{ enabled: boolean; onChange: (enabled: boolean) => void; }> = ({ enabled, onChange }) => (
    <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`${enabled ? 'bg-primary' : 'bg-slate-200'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out`}
        role="switch"
        aria-checked={enabled}
    >
        <span
            aria-hidden="true"
            className={`${enabled ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
        />
    </button>
);

interface UserModalProps {
    user: User;
    users: User[];
    campaigns: Campaign[];
    userGroups: UserGroup[];
    sites: Site[];
    agentProfiles: AgentProfile[];
    currentUser: User;
    onSave: (user: User, groupIds: string[]) => void;
    onClose: () => void;
}

const UserModal: React.FC<UserModalProps> = ({ user, users, campaigns, userGroups, sites, agentProfiles, currentUser, onSave, onClose }) => {
    const { t } = useI18n();
    const [formData, setFormData] = useState<User>(user);
    const [isEmailEnabled, setIsEmailEnabled] = useState(!!user.email);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'general' | 'groups' | 'campaigns'>('general');
    const canManageStationMode = ['Superviseur', 'Administrateur', 'SuperAdmin'].includes(currentUser.role);

    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(() => 
        user ? userGroups.filter(g => g.memberIds.includes(user.id)).map(g => g.id) : []
    );
    
    useEffect(() => {
        setFormData(user);
        // Generate a password only for a completely new user being created via the modal.
        // A user is considered "new from modal" if their ID starts with 'new-' and they don't have a first name yet.
        // This prevents re-generating passwords for bulk-created users who are being edited.
        if (user.id.startsWith('new-') && !user.firstName && !user.password) {
            setFormData(prev => ({ ...prev, password: generatePassword() }));
        }
    }, [user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (name === 'loginId' || name === 'email') setError(null);
        if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value === '' ? null : value }));
        }
    };

    const handleCampaignChange = (campaignId: string, isChecked: boolean) => {
        setFormData(prev => {
            const currentCampaignIds = prev.campaignIds || [];
            if (isChecked) {
                return { ...prev, campaignIds: [...new Set([...currentCampaignIds, campaignId])] };
            } else {
                return { ...prev, campaignIds: currentCampaignIds.filter(id => id !== campaignId) };
            }
        });
    };
    
    const handleGroupChange = (groupId: string, isChecked: boolean) => {
        setSelectedGroupIds(prev => {
            if (isChecked) {
                return [...new Set([...prev, groupId])];
            } else {
                return prev.filter(id => id !== groupId);
            }
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        
        const loginIdExists = users.some(u => u.loginId === formData.loginId && u.id !== formData.id);
        if (loginIdExists) {
            setError(t('userManager.modal.loginIdExists'));
            setActiveTab('general');
            return;
        }

        if (isEmailEnabled && formData.email) {
            const emailExists = users.some(u => u.email && u.email.toLowerCase() === formData.email!.toLowerCase() && u.id !== formData.id);
            if (emailExists) {
                setError(t('userManager.modal.emailExists'));
                setActiveTab('general');
                return;
            }
        }

        // Prevent last SuperAdmin from changing their role
        if (user.role === 'SuperAdmin' && formData.role !== 'SuperAdmin') {
            const superAdminCount = users.filter(u => u.role === 'SuperAdmin').length;
            if (superAdminCount <= 1) {
                setError(t('userManager.modal.lastSuperAdmin'));
                setActiveTab('general');
                return;
            }
        }
        
        const dataToSave = { ...formData };
        if (!isEmailEnabled) dataToSave.email = '';

        onSave(dataToSave, selectedGroupIds);
    };
    
    const handleGeneratePassword = () => {
        setFormData(prev => ({ ...prev, password: generatePassword() }));
    };
    
    const handleToggleEmail = () => {
        setIsEmailEnabled(prev => !prev);
        if (isEmailEnabled) setFormData(f => ({ ...f, email: '' }));
    };

    const isNewUser = user.id.startsWith('new-');
    
    const TabButton: React.FC<{tabName: 'general' | 'groups' | 'campaigns', labelKey: string}> = ({tabName, labelKey}) => (
        <button type="button" onClick={() => setActiveTab(tabName)} className={`py-2 px-4 text-sm font-medium rounded-t-lg ${activeTab === tabName ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-b-0' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
            {t(labelKey)}
        </button>
    );

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-lg flex flex-col h-[90vh]">
                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    <div className="p-6 border-b bg-white dark:bg-slate-800 rounded-t-lg">
                        <h3 className="text-lg font-medium leading-6 text-slate-900 dark:text-slate-100">{isNewUser ? t('userManager.modal.addTitle') : t('userManager.modal.editTitle')}</h3>
                    </div>
                    <div className="border-b border-slate-200 dark:border-slate-700 px-4 pt-2">
                        <nav className="-mb-px flex space-x-2">
                           <TabButton tabName="general" labelKey="userManager.modal.tabs.general" />
                           <TabButton tabName="groups" labelKey="userManager.modal.tabs.groups" />
                           <TabButton tabName="campaigns" labelKey="userManager.modal.tabs.campaigns" />
                        </nav>
                    </div>

                    <div className="p-6 bg-white dark:bg-slate-800 flex-1 overflow-y-auto">
                        {activeTab === 'general' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('common.firstName')}</label>
                                        <input type="text" name="firstName" id="firstName" value={formData.firstName} onChange={handleChange} required className="mt-1 block w-full rounded-md border-slate-300 shadow-sm p-2 border dark:bg-slate-900 dark:border-slate-600 dark:text-slate-200"/>
                                    </div>
                                    <div>
                                        <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('common.lastName')}</label>
                                        <input type="text" name="lastName" id="lastName" value={formData.lastName} onChange={handleChange} required className="mt-1 block w-full rounded-md border-slate-300 shadow-sm p-2 border dark:bg-slate-900 dark:border-slate-600 dark:text-slate-200"/>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="loginId" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('userManager.modal.loginId')}</label>
                                    <input type="text" name="loginId" id="loginId" value={formData.loginId} onChange={handleChange} required pattern="\d{4,6}" title="Doit contenir 4 à 6 chiffres." placeholder="Ex: 1001" className="mt-1 block w-full rounded-md border-slate-300 shadow-sm p-2 border dark:bg-slate-900 dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-400"/>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('userManager.modal.loginIdHelp')}</p>
                                </div>
                                <div>
                                    <div className="flex justify-between items-center">
                                        <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('common.email')}</label>
                                        <button type="button" onClick={handleToggleEmail} className={`${isEmailEnabled ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out`} aria-pressed={isEmailEnabled} >
                                            <span aria-hidden="true" className={`${isEmailEnabled ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}/>
                                        </button>
                                    </div>
                                    <input type="email" name="email" id="email" value={formData.email || ''} onChange={handleChange} required={isEmailEnabled} disabled={!isEmailEnabled} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm p-2 border disabled:bg-slate-50 disabled:text-slate-400 dark:bg-slate-900 dark:border-slate-600 dark:text-slate-200 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"/>
                                </div>
                                 {error && <p className="mt-1 text-sm text-red-600 font-semibold">{error}</p>}
                                <div>
                                    <label htmlFor="mobileNumber" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('userManager.modal.mobileNumber')}</label>
                                    <input type="tel" name="mobileNumber" id="mobileNumber" value={formData.mobileNumber || ''} onChange={handleChange} placeholder="Ex: 0612345678" className="mt-1 block w-full rounded-md border-slate-300 shadow-sm p-2 border dark:bg-slate-900 dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-400"/>
                                </div>
                                {canManageStationMode && (
                                    <div className="flex items-center justify-between pt-4 border-t dark:border-slate-700">
                                        <div>
                                            <label className="font-medium text-slate-700 dark:text-slate-300">{t('userManager.modal.useMobileAsStation')}</label>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{t('userManager.modal.useMobileAsStationHelp')}</p>
                                        </div>
                                        <ToggleSwitch
                                            enabled={!!formData.useMobileAsStation}
                                            onChange={isEnabled => setFormData(f => ({ ...f, useMobileAsStation: isEnabled }))}
                                        />
                                    </div>
                                )}
                                <div className="pt-4 border-t dark:border-slate-700">
                                    <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('common.password')}</label>
                                    <div className="mt-1 flex rounded-md shadow-sm">
                                        <input
                                            type="text"
                                            name="password"
                                            id="password"
                                            value={formData.password || ''}
                                            onChange={handleChange}
                                            required={isNewUser && !formData.firstName}
                                            placeholder={isNewUser ? '' : t('userManager.modal.passwordHelp')}
                                            className="block w-full flex-1 rounded-none rounded-l-md border-slate-300 p-2 border dark:bg-slate-900 dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-400"
                                        />
                                        <button type="button" onClick={handleGeneratePassword} className="inline-flex items-center rounded-r-md border border-l-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-500 hover:bg-slate-100 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-600">{t('userManager.modal.generate')}</button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t dark:border-slate-700">
                                    <div>
                                        <label htmlFor="role" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('common.role')}</label>
                                        <select id="role" name="role" value={formData.role} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm p-2 border bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-slate-200">
                                            <option>Agent</option>
                                            <option>Superviseur</option>
                                            <option>Administrateur</option>
                                            {currentUser.role === 'SuperAdmin' && <option>SuperAdmin</option>}
                                        </select>
                                    </div>
                                     <div>
                                        <label htmlFor="siteId" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('userManager.modal.site')}</label>
                                        <select id="siteId" name="siteId" value={formData.siteId || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm p-2 border bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-slate-200">
                                            <option value="">{t('userManager.modal.noSite')}</option>
                                            {sites.map(site => (
                                                <option key={site.id} value={site.id}>{site.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                {formData.role === 'Agent' && (
                                     <div>
                                        <label htmlFor="agentProfileId" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('userManager.modal.agentProfile')}</label>
                                        <select id="agentProfileId" name="agentProfileId" value={formData.agentProfileId || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm p-2 border bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-slate-200">
                                            <option value="">{t('userManager.modal.noAgentProfile')}</option>
                                            {agentProfiles.map(profile => (
                                                <option key={profile.id} value={profile.id}>{profile.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div className="flex items-center justify-between pt-4 border-t dark:border-slate-700">
                                    <label className="font-medium text-slate-700 dark:text-slate-300">{t('userManager.modal.activeUser')}</label>
                                    <ToggleSwitch
                                        enabled={formData.isActive}
                                        onChange={isEnabled => setFormData(f => ({ ...f, isActive: isEnabled }))}
                                    />
                                </div>
                                <div className="flex items-center justify-between pt-4 border-t dark:border-slate-700">
                                    <div>
                                        <label className="font-medium text-slate-700 dark:text-slate-300">{t('userManager.modal.planningManagement.title')}</label>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{t('userManager.modal.planningManagement.description')}</p>
                                    </div>
                                    <ToggleSwitch
                                        enabled={!!formData.planningEnabled}
                                        onChange={isEnabled => setFormData(f => ({ ...f, planningEnabled: isEnabled }))}
                                    />
                                </div>
                            </div>
                        )}
                        {activeTab === 'groups' && (
                             <div className="space-y-2">
                                {userGroups.length > 0 ? userGroups.map(group => (
                                    <div key={group.id} className="flex items-center p-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700">
                                        <input id={`group-${group.id}`} type="checkbox" checked={selectedGroupIds.includes(group.id)} onChange={(e) => handleGroupChange(group.id, e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600"/>
                                        <label htmlFor={`group-${group.id}`} className="ml-3 text-sm text-slate-600 dark:text-slate-300">{group.name}</label>
                                    </div>
                                )) : <p className="text-sm text-slate-500 italic text-center">{t('groupManager.modal.noAgents')}</p>}
                            </div>
                        )}
                        {activeTab === 'campaigns' && (
                            <div className="space-y-2">
                                {campaigns.length > 0 ? campaigns.map(campaign => (
                                    <div key={campaign.id} className="flex items-center p-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700">
                                        <input id={`campaign-${campaign.id}`} type="checkbox" checked={formData.campaignIds?.includes(campaign.id) || false} onChange={(e) => handleCampaignChange(campaign.id, e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600"/>
                                        <label htmlFor={`campaign-${campaign.id}`} className="ml-3 text-sm text-slate-600 dark:text-slate-300">{campaign.name}</label>
                                    </div>
                                )) : <p className="text-sm text-slate-500 italic text-center">{t('agentView.noCampaigns')}</p>}
                            </div>
                        )}
                    </div>
                    
                    <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 sm:flex sm:flex-row-reverse rounded-b-lg border-t dark:border-slate-700">
                        <button type="submit" className="inline-flex w-full justify-center rounded-md border border-transparent bg-primary px-4 py-2 font-medium text-primary-text shadow-sm hover:bg-primary-hover sm:ml-3 sm:w-auto">{t('common.save')}</button>
                        <button type="button" onClick={onClose} className="mt-3 inline-flex w-full justify-center rounded-md border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 shadow-sm hover:bg-slate-50 sm:mt-0 sm:w-auto dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">{t('common.cancel')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- MODAL: Generate Users in Bulk ---
interface GenerateModalProps {
    onConfirm: (from: number, to: number, siteId: string | null) => void;
    onClose: () => void;
    sites: Site[];
}

const GenerateModal: React.FC<GenerateModalProps> = ({ onConfirm, onClose, sites }) => {
    const { t } = useI18n();
    const [from, setFrom] = useState(1010);
    const [to, setTo] = useState(1020);
    const [siteId, setSiteId] = useState<string | null>(sites.length > 0 ? sites[0].id : null);
    
    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-sm">
                <div className="p-6">
                    <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t('userManager.generateModal.title')}</h3>
                    <div className="mt-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="from-id" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {t('userManager.generateModal.from')}
                                </label>
                                <input
                                    type="number"
                                    id="from-id"
                                    value={from}
                                    onChange={e => setFrom(parseInt(e.target.value, 10) || 1000)}
                                    min="1000"
                                    max="9998"
                                    className="mt-1 block w-full p-2 border border-slate-300 rounded-md dark:bg-slate-900 dark:text-slate-200 dark:border-slate-600"
                                />
                            </div>
                            <div>
                                <label htmlFor="to-id" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {t('userManager.generateModal.to')}
                                </label>
                                 <input
                                    type="number"
                                    id="to-id"
                                    value={to}
                                    onChange={e => setTo(parseInt(e.target.value, 10) || 1000)}
                                    min={from}
                                    max="9998"
                                    className="mt-1 block w-full p-2 border border-slate-300 rounded-md dark:bg-slate-900 dark:text-slate-200 dark:border-slate-600"
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="site-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                {t('userManager.modal.site')}
                            </label>
                            <select
                                id="site-select"
                                value={siteId || ''}
                                onChange={e => setSiteId(e.target.value || null)}
                                className="mt-1 block w-full p-2 border border-slate-300 rounded-md dark:bg-slate-900 dark:text-slate-200 dark:border-slate-600 bg-white"
                            >
                                <option value="">{t('userManager.modal.noSite')}</option>
                                {sites.map(site => (
                                    <option key={site.id} value={site.id}>{site.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 px-4 py-3 flex justify-end gap-2">
                    <button onClick={onClose} className="border border-slate-300 bg-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">{t('common.cancel')}</button>
                    <button onClick={() => onConfirm(from, to, siteId)} className="bg-primary text-primary-text px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-hover">{t('userManager.generateModal.confirm')}</button>
                </div>
            </div>
        </div>
    );
};

interface UserManagerProps {
    feature: Feature;
}

const UserManager: React.FC<UserManagerProps> = ({ feature }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isGeneratingModalOpen, setIsGeneratingModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof User | 'siteName'; direction: 'ascending' | 'descending' }>({ key: 'firstName', direction: 'ascending' });
    const { t } = useI18n();

    const { 
        users, 
        campaigns, 
        userGroups, 
        sites, 
        agentProfiles,
        currentUser, 
        saveOrUpdate, 
        delete: deleteEntity, 
        createUsersBulk,
        showConfirmation
    } = useStore(state => ({
        users: state.users,
        campaigns: state.campaigns,
        userGroups: state.userGroups,
        sites: state.sites,
        agentProfiles: state.agentProfiles,
        currentUser: state.currentUser!,
        saveOrUpdate: state.saveOrUpdate,
        delete: state.delete,
        createUsersBulk: state.createUsersBulk,
        showConfirmation: state.showConfirmation,
    }));

    const siteMap = useMemo(() => new Map(sites.map(s => [s.id, s.name])), [sites]);

    const onSaveUser = (user: User, groupIds: string[]) => {
        saveOrUpdate('users', { ...user, groupIds });
    };

    const onGenerateUsers = (newUsers: User[]) => {
        createUsersBulk(newUsers);
    };

    const onImportUsers = (newUsers: User[]) => {
        createUsersBulk(newUsers);
    };

    const usersToDisplay = useMemo(() => {
        if (currentUser.role === 'SuperAdmin') {
            return users;
        }
        return users.filter(user => user.role !== 'SuperAdmin');
    }, [users, currentUser]);
  
    const filteredAndSortedUsers = useMemo(() => {
        let sortableUsers = [...usersToDisplay];

        if (searchTerm) {
            sortableUsers = sortableUsers.filter(user => {
                const term = searchTerm.toLowerCase();
                const siteName = user.siteId ? siteMap.get(user.siteId)?.toLowerCase() : '';
                return (
                    // FIX: Added checks for null/undefined before calling toLowerCase to make filtering more robust.
                    (user.firstName || '').toLowerCase().includes(term) ||
                    (user.lastName || '').toLowerCase().includes(term) ||
                    (user.email || '').toLowerCase().includes(term) ||
                    (user.loginId || '').toLowerCase().includes(term) ||
                    (user.role || '').toLowerCase().includes(term) ||
                    (siteName && siteName.includes(term))
                );
            });
        }

        sortableUsers.sort((a, b) => {
            const key = sortConfig.key;
            
            let aValue: any;
            let bValue: any;

            if (key === 'siteName') {
                aValue = a.siteId ? siteMap.get(a.siteId) || '' : '';
                bValue = b.siteId ? siteMap.get(b.siteId) || '' : '';
            } else {
                aValue = a[key as keyof User];
                bValue = b[key as keyof User];
            }

            if (aValue === null || aValue === undefined) return 1;
            if (bValue === null || bValue === undefined) return -1;
            
            if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
                if (aValue === bValue) return 0;
                if (sortConfig.direction === 'ascending') return aValue ? -1 : 1;
                return aValue ? 1 : -1;
            }

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return aValue.localeCompare(bValue, undefined, { numeric: true }) * (sortConfig.direction === 'ascending' ? 1 : -1);
            }
            
            if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
            
            return 0;
        });

        return sortableUsers;
    }, [usersToDisplay, searchTerm, sortConfig, siteMap]);


    const requestSort = (key: keyof User | 'siteName') => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };


    const handleAddNew = () => {
        const defaultProfile = agentProfiles.find(p => p.name === 'Défaut') || agentProfiles[0];
        setEditingUser({
            id: `new-${Date.now()}`,
            loginId: '',
            firstName: '',
            lastName: '',
            email: '',
            role: 'Agent',
            isActive: true,
            campaignIds: [],
            password: '',
            siteId: null,
            agentProfileId: defaultProfile?.id || null,
            mobileNumber: '',
            useMobileAsStation: false,
            planningEnabled: false,
        });
        setIsModalOpen(true);
    };

    const handleEdit = (user: User) => {
        setEditingUser(user);
        setIsModalOpen(true);
    };
  
    const handleSave = (user: User, groupIds: string[]) => {
        onSaveUser(user, groupIds);
        setIsModalOpen(false);
        setEditingUser(null);
    };
  
    const handleImport = () => {
        setIsImportModalOpen(true);
    };
  
    const handleConfirmGeneration = (from: number, to: number, siteId: string | null) => {
        if (from > to) {
            alert("La valeur 'De' ne peut pas être supérieure à la valeur 'À'.");
            return;
        }
        if (to - from >= 100) {
            alert("Vous pouvez générer un maximum de 100 utilisateurs à la fois.");
            return;
        }

        const newUsers: User[] = [];
        const existingLoginIds = new Set(users.map(u => u.loginId));
        
        for (let i = from; i <= to; i++) {
            const loginId = i.toString();
            if (existingLoginIds.has(loginId)) {
                continue; // Skip if login ID already exists
            }
            
            newUsers.push({
                id: `new-gen-${Date.now() + i}`,
                loginId: loginId,
                firstName: `Agent`,
                lastName: `${loginId}`,
                email: ``,
                role: 'Agent',
                isActive: true,
                campaignIds: [],
                password: generatePassword(),
                siteId: siteId,
            });
        }
        onGenerateUsers(newUsers);
        setIsGeneratingModalOpen(false);
    };

    const handleDelete = (user: User) => {
        showConfirmation({
            title: t('alerts.confirmDeleteTitle'),
            message: t('userManager.delete.confirmMessage', { userName: `${user.firstName} ${user.lastName}` }),
            onConfirm: () => deleteEntity('users', user.id),
        });
    };

    const getDeletionState = (user: User): { canDelete: boolean; tooltip: string } => {
        if (user.role === 'SuperAdmin') {
            return { canDelete: false, tooltip: t('userManager.delete.superAdmin') };
        }
        if (user.isActive) {
        return { canDelete: false, tooltip: t('userManager.delete.activeUser') };
        }
        if (user.role === 'Administrateur') {
        const adminCount = users.filter(u => u.role === 'Administrateur').length;
        if (adminCount <= 1) {
            return { canDelete: false, tooltip: t('userManager.delete.lastAdmin') };
        }
        }
        return { canDelete: true, tooltip: t('common.delete') };
    };

    const SortableHeader: React.FC<{ sortKey: keyof User | 'siteName'; label: string }> = ({ sortKey, label }) => (
        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
            <button onClick={() => requestSort(sortKey)} className="group inline-flex items-center gap-1">
                {label}
                <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className={`material-symbols-outlined text-base transition-transform ${sortConfig.key === sortKey ? (sortConfig.direction === 'ascending' ? 'rotate-180' : '') : 'text-slate-400'}`}>expand_more</span>
                </span>
            </button>
        </th>
    );

    if (!currentUser) return null; // Or a loading state

    return (
        <div className="h-full flex flex-col">
            {isModalOpen && editingUser && <UserModal user={editingUser} users={users} campaigns={campaigns} userGroups={userGroups} sites={sites} agentProfiles={agentProfiles} currentUser={currentUser} onSave={handleSave} onClose={() => setIsModalOpen(false)} />}
            {isImportModalOpen && <ImportUsersModal onClose={() => setIsImportModalOpen(false)} onImport={onImportUsers} existingUsers={users} />}
            {isGeneratingModalOpen && <GenerateModal onClose={() => setIsGeneratingModalOpen(false)} onConfirm={handleConfirmGeneration} sites={sites} />}
            
            <div className="flex-shrink-0">
                <header className="mb-8">
                    <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{t(feature.titleKey)}</h1>
                    <p className="mt-2 text-lg text-slate-600 dark:text-slate-400">{t(feature.descriptionKey)}</p>
                </header>
                
                <div className="bg-white dark:bg-slate-800 p-6 rounded-t-lg shadow-sm border-x border-t border-slate-200 dark:border-slate-700">
                    <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
                        <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200">{t('userManager.title')}</h2>
                        <div className="flex flex-wrap gap-2">
                            <button onClick={handleImport} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg shadow-sm transition-colors dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">{t('userManager.importButton')}</button>
                            <button onClick={() => setIsGeneratingModalOpen(true)} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg shadow-sm transition-colors dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">{t('userManager.generateButton')}</button>
                            <button onClick={handleAddNew} className="bg-primary hover:bg-primary-hover text-primary-text font-bold py-2 px-4 rounded-lg shadow-md transition-colors inline-flex items-center">
                                <span className="material-symbols-outlined mr-2">add</span>
                                {t('userManager.addUserButton')}
                            </button>
                        </div>
                    </div>
                    
                    <div className="mb-4">
                        <input
                            type="text"
                            placeholder={t('userManager.searchPlaceholder')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full max-w-lg p-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-900 dark:border-slate-600 dark:text-slate-200"
                        />
                    </div>
                </div>
            </div>
            
            <div className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-slate-800 rounded-b-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0 z-10">
                        <tr>
                            <SortableHeader sortKey="firstName" label={t('userManager.headers.name')} />
                            <SortableHeader sortKey="id" label={t('userManager.headers.id')} />
                            <SortableHeader sortKey="loginId" label={t('userManager.headers.loginId')} />
                            <SortableHeader sortKey="role" label={t('userManager.headers.role')} />
                            <SortableHeader sortKey="siteName" label={t('userManager.headers.site')} />
                            <SortableHeader sortKey="isActive" label={t('userManager.headers.status')} />
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                        {filteredAndSortedUsers.map(user => {
                            const { canDelete, tooltip } = getDeletionState(user);
                            return (
                            <tr key={user.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="h-10 w-10 flex-shrink-0 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
                                    <span className="material-symbols-outlined text-2xl text-slate-500 dark:text-slate-400">group</span>
                                    </div>
                                    <div className="ml-4">
                                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{user.firstName} {user.lastName}</div>
                                    <div className="text-sm text-slate-500 dark:text-slate-400">{user.email}</div>
                                    </div>
                                </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400 font-mono">{user.id}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-500 dark:text-slate-400">{user.loginId}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">{user.role}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">{user.siteId ? siteMap.get(user.siteId) : '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200'}`}>
                                    {user.isActive ? t('common.active') : t('common.inactive')}
                                </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                                <button onClick={() => handleEdit(user)} className="text-link hover:underline inline-flex items-center"><span className="material-symbols-outlined text-base mr-1">edit</span> {t('common.edit')}</button>
                                <button onClick={() => handleDelete(user)} className={`inline-flex items-center ${!canDelete ? 'text-slate-400 cursor-not-allowed' : 'text-red-600 hover:text-red-900 dark:hover:text-red-400'}`} disabled={!canDelete} title={tooltip}>
                                    <span className="material-symbols-outlined text-base mr-1">delete</span> {t('common.delete')}
                                </button>
                                </td>
                            </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default UserManager;