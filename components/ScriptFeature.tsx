// FIX: Create content for ScriptFeature.tsx to resolve module error.
import React, { useState } from 'react';
import type { Feature, SavedScript, ScriptBlock } from '../types.ts';
// FIX: Corrected module import path by adding the '.ts' extension.
import { useStore } from '../src/store/useStore.ts';
import { useI18n } from '../src/i18n/index.tsx';
import ScriptBuilder from './ScriptBuilder.tsx';
import AgentPreview from './AgentPreview.tsx';

const ScriptFeature: React.FC<{ feature: Feature }> = ({ feature }) => {
    const { t } = useI18n();
    const { savedScripts, campaigns, saveOrUpdate, delete: deleteEntity, duplicate, showConfirmation } = useStore(state => ({
        savedScripts: state.savedScripts,
        campaigns: state.campaigns,
        saveOrUpdate: state.saveOrUpdate,
        delete: state.delete,
        duplicate: state.duplicate,
        showConfirmation: state.showConfirmation,
    }));

    const [isBuilderOpen, setIsBuilderOpen] = useState(false);
    const [editingScript, setEditingScript] = useState<SavedScript | null>(null);
    const [previewScript, setPreviewScript] = useState<SavedScript | null>(null);

    const handleAddNew = () => {
        const pageId = `page-${Date.now()}`;
        const defaultBlocks: ScriptBlock[] = [
            {
                id: `block-${Date.now()}-1`,
                name: 'Nom',
                fieldName: 'last_name',
                type: 'input',
                x: 50, y: 50, width: 300, height: 70,
                content: { placeholder: 'Nom de famille' },
                displayCondition: null, parentId: null,
                isStandard: true, isVisible: true, readOnly: true,
            },
            {
                id: `block-${Date.now()}-2`,
                name: 'Prénom',
                fieldName: 'first_name',
                type: 'input',
                x: 400, y: 50, width: 300, height: 70,
                content: { placeholder: 'Prénom' },
                displayCondition: null, parentId: null,
                isStandard: true, isVisible: true, readOnly: true,
            },
            {
                id: `block-${Date.now()}-3`,
                name: 'Numéro de Téléphone',
                fieldName: 'phone_number',
                type: 'phone',
                x: 50, y: 150, width: 300, height: 70,
                content: { placeholder: 'Numéro de téléphone' },
                displayCondition: null, parentId: null,
                isStandard: true, isVisible: true, readOnly: true,
            },
            {
                id: `block-${Date.now()}-4`,
                name: 'Code Postal',
                fieldName: 'postal_code',
                type: 'input',
                x: 400, y: 150, width: 300, height: 70,
                content: { placeholder: 'Code postal' },
                displayCondition: null, parentId: null,
                isStandard: true, isVisible: true, readOnly: true,
            },
        ];

        const newScript: SavedScript = {
            id: `script-${Date.now()}`,
            name: 'Nouveau Script',
            pages: [{ id: pageId, name: 'Page 1', blocks: defaultBlocks }],
            startPageId: pageId,
            backgroundColor: '#f1f5f9',
        };
        setEditingScript(newScript);
        setIsBuilderOpen(true);
    };

    const handleEdit = (script: SavedScript) => {
        setEditingScript(script);
        setIsBuilderOpen(true);
    };

    const handleSave = (script: SavedScript) => {
        saveOrUpdate('scripts', script);
        setIsBuilderOpen(false);
        setEditingScript(null);
    };
    
    const handleDelete = (id: string) => {
        showConfirmation({
            title: t('alerts.confirmDeleteTitle'),
            message: t('scriptFeature.confirmDelete'),
            onConfirm: () => deleteEntity('scripts', id),
        });
    };

    const handleDuplicate = (id: string) => {
        duplicate('scripts', id);
    };

    // When previewing, update the parent's `editingScript` state to preserve changes made in the builder.
    const handlePreview = (script: SavedScript) => {
        setEditingScript(script); // Persist the builder's state in the parent
        setPreviewScript(script); // Show the preview
    };

    const handleClosePreview = () => {
        setPreviewScript(null); // Hide the preview; `editingScript` already has the latest changes
    };

    if (previewScript) {
        return <AgentPreview script={previewScript} onClose={handleClosePreview} />;
    }
    
    if (isBuilderOpen && editingScript) {
        return <ScriptBuilder script={editingScript} onSave={handleSave} onClose={() => setIsBuilderOpen(false)} onPreview={handlePreview} />;
    }

    return (
        <div className="h-full flex flex-col">
            <header className="flex-shrink-0 flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{t(feature.titleKey)}</h1>
                    <p className="mt-2 text-lg text-slate-600 dark:text-slate-400">{t(feature.descriptionKey)}</p>
                </div>
                <button onClick={handleAddNew} className="bg-primary hover:bg-primary-hover text-primary-text font-bold py-2 px-4 rounded-lg shadow-md inline-flex items-center">
                    <span className="material-symbols-outlined mr-2">add</span>
                    {t('scriptFeature.addScript')}
                </button>
            </header>
            <div className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <ul className="space-y-3">
                    {savedScripts.map(script => {
                        const assignedCampaigns = campaigns.filter(c => c.scriptId === script.id);
                        const isAssigned = assignedCampaigns.length > 0;
                        return (
                            <li key={script.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700">
                                <div>
                                    <p className="font-semibold text-slate-800 dark:text-slate-200">{script.name}</p>
                                    {isAssigned && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            <span className="font-semibold">{t('scriptFeature.usedBy')} </span>
                                            {assignedCampaigns.map(c => c.name).join(', ')}
                                        </p>
                                    )}
                                </div>
                                <div className="space-x-2">
                                    <button onClick={() => handleDuplicate(script.id)} title={t('common.duplicate')} className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"><span className="material-symbols-outlined">content_copy</span></button>
                                    <button onClick={() => handleEdit(script)} title={t('common.edit')} className="p-2 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"><span className="material-symbols-outlined">edit</span></button>
                                    <button 
                                        onClick={() => handleDelete(script.id)} 
                                        title={isAssigned ? t('scriptFeature.deleteDisabledTooltip') : t('common.delete')} 
                                        className={`p-2 text-slate-500 ${isAssigned ? 'cursor-not-allowed text-slate-300 dark:text-slate-600' : 'hover:text-red-600 dark:hover:text-red-400'}`}
                                        disabled={isAssigned}
                                    >
                                        <span className="material-symbols-outlined">delete</span>
                                    </button>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            </div>
        </div>
    );
};

export default ScriptFeature;