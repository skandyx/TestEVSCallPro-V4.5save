import React, { useState } from 'react';
import type { Feature, IvrFlow } from '../types.ts';
import { useStore } from '../src/store/useStore.ts';
import { useI18n } from '../src/i18n/index.tsx';
import IvrDesigner from './IvrDesigner.tsx';

const IvrFeature: React.FC<{ feature: Feature }> = ({ feature }) => {
    const { t } = useI18n();
    const { ivrFlows, saveOrUpdate, delete: deleteEntity, duplicate, showConfirmation } = useStore(state => ({
        ivrFlows: state.ivrFlows,
        saveOrUpdate: state.saveOrUpdate,
        delete: state.delete,
        duplicate: state.duplicate,
        showConfirmation: state.showConfirmation,
    }));

    const [isDesignerOpen, setIsDesignerOpen] = useState(false);
    const [editingFlow, setEditingFlow] = useState<IvrFlow | Partial<IvrFlow> | null>(null);

    const handleAddNew = () => {
        const newFlow: Partial<IvrFlow> = {
            name: 'Nouveau Flux SVI',
            nodes: [{ id: 'start-node', type: 'start', name: 'Début', x: 50, y: 150, content: {} }],
            connections: [],
        };
        setEditingFlow(newFlow);
        setIsDesignerOpen(true);
    };

    const handleEdit = (flow: IvrFlow) => {
        setEditingFlow(flow);
        setIsDesignerOpen(true);
    };

    const handleSave = (flow: IvrFlow) => {
        saveOrUpdate('ivr-flows', flow);
        setIsDesignerOpen(false);
        setEditingFlow(null);
    };
    
    const handleDelete = (id: string) => {
        showConfirmation({
            title: t('alerts.confirmDeleteTitle'),
            message: t('alerts.confirmDelete'),
            onConfirm: () => deleteEntity('ivr-flows', id),
        });
    };

    const handleDuplicate = (id: string) => {
        duplicate('ivr-flows', id);
    };

    if (isDesignerOpen && editingFlow) {
        return <IvrDesigner flow={editingFlow as IvrFlow} onSave={handleSave} onClose={() => setIsDesignerOpen(false)} />;
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
                    {t('ivrManager.createFlow')}
                </button>
            </header>
            <div className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <ul className="space-y-3">
                    {ivrFlows.map(flow => (
                        <li key={flow.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700">
                            <div>
                                <p className="font-semibold text-slate-800 dark:text-slate-200">{flow.name}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{flow.nodes.length} noeuds, {flow.connections.length} connexions</p>
                            </div>
                            <div className="space-x-2">
                                <button onClick={() => handleDuplicate(flow.id)} title={t('common.duplicate')} className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"><span className="material-symbols-outlined">content_copy</span></button>
                                <button onClick={() => handleEdit(flow)} title={t('common.edit')} className="p-2 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"><span className="material-symbols-outlined">edit</span></button>
                                <button onClick={() => handleDelete(flow.id)} title={t('common.delete')} className="p-2 text-slate-500 hover:text-red-600 dark:hover:text-red-400"><span className="material-symbols-outlined">delete</span></button>
                            </div>
                        </li>
                    ))}
                     {ivrFlows.length === 0 && (
                        <p className="text-center text-slate-500 py-8">{t('ivrManager.noFlows')}</p>
                    )}
                </ul>
            </div>
        </div>
    );
};

export default IvrFeature;