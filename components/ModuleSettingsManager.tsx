import React, { useState, useMemo } from 'react';
import type { Feature, FeatureId, FeatureCategory, ModuleVisibility, UserRole } from '../types.ts';
import { useStore } from '../src/store/useStore.ts';
import { useI18n } from '../src/i18n/index.tsx';
import { features } from '../data/features.ts';

const ToggleSwitch: React.FC<{ enabled: boolean; onChange: (enabled: boolean) => void; }> = ({ enabled, onChange }) => (
    <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`${enabled ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-600'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out`}
        role="switch"
        aria-checked={enabled}
    >
        <span
            aria-hidden="true"
            className={`${enabled ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
        />
    </button>
);

const categoryOrder: FeatureCategory[] = ['Agent', 'Outbound', 'Inbound', 'Sound', 'Configuration', 'Supervision & Reporting', 'System', 'Settings'];

// These features cannot have their visibility changed as they are essential for SuperAdmins
const SUPER_ADMIN_ONLY_FEATURES: FeatureId[] = ['module-settings', 'system-connection', 'api-docs', 'database-client', 'billing', 'system-settings', 'languages'];

const ModuleSettingsManager: React.FC<{ feature: Feature }> = ({ feature }) => {
    const { t } = useI18n();
    const storeVisibility = useStore(state => state.moduleVisibility);
    const saveModuleVisibility = useStore(state => state.saveModuleVisibility);
    const showAlert = useStore(state => state.showAlert);
  
    // Deep copy to prevent direct mutation of store state
    const [visibility, setVisibility] = useState<ModuleVisibility>(JSON.parse(JSON.stringify(storeVisibility))); 
  
    const featuresByCategory = useMemo(() => {
        const manageableFeatures = features.filter(f => !SUPER_ADMIN_ONLY_FEATURES.includes(f.id));
        return manageableFeatures.reduce((acc, feat) => {
            if (!acc[feat.category]) {
                acc[feat.category] = [];
            }
            acc[feat.category].push(feat);
            return acc;
        }, {} as Record<string, Feature[]>);
    }, []);

    const handleToggle = (featureId: FeatureId, role: UserRole, enabled: boolean) => {
        setVisibility(prev => {
            const newVisibility: ModuleVisibility = JSON.parse(JSON.stringify(prev)); // Deep copy
            if (!newVisibility.features[featureId]) {
                newVisibility.features[featureId] = {};
            }
            (newVisibility.features[featureId]!)[role] = enabled;
            return newVisibility;
        });
    };

    const handleSave = () => {
        saveModuleVisibility(visibility);
        showAlert(t('moduleSettings.saveSuccess'), 'success');
    };

    const getCategoryI18nKey = (category: FeatureCategory) => {
        return `sidebar.categories.${category.replace(/ & /g, '_')}`;
    };
    
    const ROLES_TO_MANAGE: UserRole[] = ['Superviseur', 'Administrateur'];

    return (
        <div className="h-full flex flex-col">
            <header className="flex-shrink-0 mb-8">
                <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{t(feature.titleKey)}</h1>
                <p className="mt-2 text-lg text-slate-600 dark:text-slate-400">{t(feature.descriptionKey)}</p>
            </header>

            <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex-shrink-0 p-6">
                    <table className="min-w-full">
                        <thead className="border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="py-3.5 pr-3 text-left text-sm font-semibold text-slate-900 dark:text-slate-100">Module</th>
                                {ROLES_TO_MANAGE.map(role => (
                                    <th key={role} className="w-32 px-3 py-3.5 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">{role}</th>
                                ))}
                            </tr>
                        </thead>
                    </table>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-700">
                    {categoryOrder.map(category => {
                        const categoryFeatures = featuresByCategory[category];
                        if (!categoryFeatures || categoryFeatures.length === 0) return null;

                        return (
                             <div key={category}>
                                <div className="px-6 py-2 bg-slate-50 dark:bg-slate-900/50 sticky top-0">
                                    <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t(getCategoryI18nKey(category))}</h3>
                                </div>
                                <table className="min-w-full">
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {categoryFeatures.map(feat => (
                                            <tr key={feat.id}>
                                                <td className="w-full max-w-0 py-4 pl-6 pr-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                                                    {t(feat.titleKey)}
                                                    <dl className="font-normal lg:hidden"><dt className="sr-only">Description</dt><dd className="mt-1 truncate text-slate-500">{t(feat.descriptionKey)}</dd></dl>
                                                </td>
                                                {ROLES_TO_MANAGE.map(role => (
                                                    <td key={role} className="w-32 px-3 py-4 text-center">
                                                         <ToggleSwitch
                                                            enabled={visibility.features?.[feat.id]?.[role] ?? true}
                                                            onChange={(enabled) => handleToggle(feat.id, role, enabled)}
                                                        />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })}
                </div>
                <div className="flex-shrink-0 bg-slate-50 dark:bg-slate-900/50 px-6 py-4 flex justify-end rounded-b-lg border-t dark:border-slate-700">
                    <button onClick={handleSave} className="bg-primary hover:bg-primary-hover text-primary-text font-bold py-2 px-4 rounded-lg shadow-md">
                        {t('moduleSettings.saveButton')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModuleSettingsManager;
