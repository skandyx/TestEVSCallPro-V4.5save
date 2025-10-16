import React, { useState, useMemo } from 'react';
import type { Feature, AgentProfile } from '../types.ts';
import { useI18n } from '../src/i18n/index.tsx';
import { useStore } from '../src/store/useStore.ts';

const ALL_CONTROLS = [
    { id: 'dial', labelKey: 'agentProfiles.controls.dial', icon: 'call' },
    { id: 'hangup', labelKey: 'agentProfiles.controls.hangup', icon: 'call_end' },
    { id: 'hold', labelKey: 'agentProfiles.controls.hold', icon: 'pause' },
    { id: 'transfer', labelKey: 'agentProfiles.controls.transfer', icon: 'phone_forwarded' },
    { id: 'mute', labelKey: 'agentProfiles.controls.mute', icon: 'mic_off' },
    { id: 'record', labelKey: 'agentProfiles.controls.record', icon: 'radio_button_checked' },
    { id: 'keypad', labelKey: 'agentProfiles.controls.keypad', icon: 'dialpad' },
    { id: 'qualify', labelKey: 'agentProfiles.controls.qualify', icon: 'fact_check' },
    { id: 'search', labelKey: 'agentProfiles.controls.search', icon: 'search' },
    { id: 'insert', labelKey: 'agentProfiles.controls.insert', icon: 'person_add' },
    { id: 'history', labelKey: 'agentProfiles.controls.history', icon: 'history' },
    { id: 'raiseHand', labelKey: 'agentProfiles.controls.raiseHand', icon: 'front_hand' },
];

const ToggleSwitch: React.FC<{ enabled: boolean; onChange: (enabled: boolean) => void; }> = ({ enabled, onChange }) => (
    <button type="button" onClick={() => onChange(!enabled)} className={`${enabled ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-600'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out`} role="switch" aria-checked={enabled}>
        <span className={`${enabled ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`} />
    </button>
);

interface ProfileModalProps {
    profile: Partial<AgentProfile> | null;
    onSave: (profile: Partial<AgentProfile>) => void;
    onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ profile, onSave, onClose }) => {
    const { t } = useI18n();
    const [formData, setFormData] = useState<Partial<AgentProfile>>(() => {
        if (profile) return JSON.parse(JSON.stringify(profile));
        const defaultConfig = ALL_CONTROLS.reduce((acc, control) => {
            acc[control.id] = true;
            return acc;
        }, {} as Record<string, boolean>);
        return { name: '', callControlsConfig: defaultConfig };
    });

    const handleToggle = (controlId: string, enabled: boolean) => {
        setFormData(prev => ({
            ...prev,
            callControlsConfig: { ...prev?.callControlsConfig, [controlId]: enabled }
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl h-[90vh] flex flex-col">
                <div className="p-6 border-b dark:border-slate-700">
                    <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">{profile?.id ? t('agentProfiles.modal.editTitle') : t('agentProfiles.modal.newTitle')}</h3>
                </div>
                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('agentProfiles.modal.name')}</label>
                        <input type="text" value={formData.name || ''} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required className="mt-1 block w-full p-2 border rounded-md dark:bg-slate-900 dark:border-slate-600"/>
                    </div>
                    <div>
                        <h4 className="text-md font-semibold text-slate-800 dark:text-slate-200">{t('agentProfiles.modal.controlsTitle')}</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t('agentProfiles.modal.controlsDescription')}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-md border p-4 bg-slate-50 dark:bg-slate-900/50 dark:border-slate-700">
                            {ALL_CONTROLS.map(control => (
                                <div key={control.id} className="flex items-center justify-between p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
                                    <label className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                                        <span className="material-symbols-outlined text-xl">{control.icon}</span>
                                        {t(control.labelKey)}
                                    </label>
                                    <ToggleSwitch enabled={formData.callControlsConfig?.[control.id] ?? false} onChange={enabled => handleToggle(control.id, enabled)} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 px-4 py-3 sm:flex sm:flex-row-reverse rounded-b-lg flex-shrink-0 border-t dark:border-slate-700">
                    <button type="submit" className="inline-flex w-full justify-center rounded-md border bg-primary px-4 py-2 font-medium text-primary-text shadow-sm hover:bg-primary-hover sm:ml-3 sm:w-auto">{t('common.save')}</button>
                    <button type="button" onClick={onClose} className="mt-3 inline-flex w-full justify-center rounded-md border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 shadow-sm hover:bg-slate-50 sm:mt-0 sm:w-auto dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">{t('common.cancel')}</button>
                </div>
            </form>
        </div>
    );
};


const AgentProfileManager: React.FC<{ feature: Feature }> = ({ feature }) => {
    const { t } = useI18n();
    const { agentProfiles, users, saveOrUpdate, delete: deleteProfile } = useStore(state => ({
        agentProfiles: state.agentProfiles,
        users: state.users,
        saveOrUpdate: state.saveOrUpdate,
        delete: state.delete,
    }));
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState<Partial<AgentProfile> | null>(null);

    const handleSave = (profileData: Partial<AgentProfile>) => {
        saveOrUpdate('agent-profiles', profileData);
        setIsModalOpen(false);
        setEditingProfile(null);
    };
    
    const handleDelete = (profileId: string) => {
        if (window.confirm(t('agentProfiles.deleteConfirm'))) {
            deleteProfile('agent-profiles', profileId);
        }
    };
    
    return (
        <div className="h-full flex flex-col">
            {isModalOpen && <ProfileModal profile={editingProfile} onSave={handleSave} onClose={() => setIsModalOpen(false)} />}
            <div className="flex-shrink-0">
                <header className="mb-8">
                    <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{t(feature.titleKey)}</h1>
                    <p className="mt-2 text-lg text-slate-600 dark:text-slate-400">{t(feature.descriptionKey)}</p>
                </header>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-t-lg shadow-sm border-x border-t border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-semibold">{t('agentProfiles.title')}</h2>
                        <button onClick={() => { setEditingProfile(null); setIsModalOpen(true); }} className="bg-primary hover:bg-primary-hover text-primary-text font-bold py-2 px-4 rounded-lg shadow-md inline-flex items-center">
                            <span className="material-symbols-outlined mr-2">add</span> {t('agentProfiles.createButton')}
                        </button>
                    </div>
                </div>
            </div>
             <div className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-slate-800 rounded-b-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{t('common.name')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{t('agentProfiles.assignedUsers')}</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{t('common.actions')}</th>
                        </tr>
                    </thead>
                     <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                        {agentProfiles.map(profile => {
                            const assignedUserCount = users.filter(u => u.agentProfileId === profile.id).length;
                            const isDefault = profile.name === 'Défaut';
                            return (
                            <tr key={profile.id}>
                                <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-800 dark:text-slate-100">{profile.name} {isDefault && <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full ml-2">Défaut</span>}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{assignedUserCount}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                    <button onClick={() => { setEditingProfile(profile); setIsModalOpen(true); }} className="text-link hover:underline inline-flex items-center"><span className="material-symbols-outlined text-base mr-1">edit</span>{t('common.edit')}</button>
                                    <button onClick={() => handleDelete(profile.id)} disabled={isDefault || assignedUserCount > 0} title={isDefault ? t('agentProfiles.deleteDefaultTooltip') : (assignedUserCount > 0 ? t('agentProfiles.deleteAssignedTooltip') : t('common.delete'))} className="text-red-600 hover:text-red-900 dark:hover:text-red-400 inline-flex items-center disabled:text-slate-400 disabled:cursor-not-allowed">
                                        <span className="material-symbols-outlined text-base mr-1">delete</span>{t('common.delete')}
                                    </button>
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AgentProfileManager;
