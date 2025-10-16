import React from 'react';
import type { Campaign } from '../types.ts';
import { useI18n } from '../src/i18n/index.tsx';
import { XMarkIcon } from './Icons.tsx';

// Re-usable ToggleSwitch Component
const ToggleSwitch: React.FC<{ enabled: boolean; onChange: (enabled: boolean) => void; disabled?: boolean }> = ({ enabled, onChange, disabled = false }) => (
    <button type="button" onClick={() => !disabled && onChange(!enabled)} className={`${enabled ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out`} role="switch" aria-checked={enabled} disabled={disabled}>
        <span aria-hidden="true" className={`${enabled ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`} />
    </button>
);

interface CampaignSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    assignedCampaigns: Campaign[];
    activeDialingCampaignId: string | null;
    onCampaignToggle: (campaignId: string) => void;
}

const CampaignSelectionModal: React.FC<CampaignSelectionModalProps> = ({ isOpen, onClose, assignedCampaigns, activeDialingCampaignId, onCampaignToggle }) => {
    const { t } = useI18n();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-50" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('agentView.campaignList.title')}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
                        <XMarkIcon className="w-6 h-6 text-slate-500" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto space-y-2">
                    {assignedCampaigns.length > 0 ? (
                        assignedCampaigns.map(c => (
                            <div key={c.id} className="flex items-center justify-between p-3 rounded-md border bg-slate-50 dark:bg-slate-700 dark:border-slate-600">
                                <span className="font-medium text-slate-800 dark:text-slate-200">{c.name}</span>
                                <ToggleSwitch 
                                    enabled={activeDialingCampaignId === c.id} 
                                    onChange={() => onCampaignToggle(c.id)}
                                    disabled={!c.isActive}
                                />
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-slate-500 italic text-center">{t('agentView.noCampaigns')}</p>
                    )}
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 px-4 py-3 flex justify-end rounded-b-lg border-t dark:border-slate-700">
                    <button onClick={onClose} className="border border-slate-300 bg-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">
                        {t('common.close')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CampaignSelectionModal;