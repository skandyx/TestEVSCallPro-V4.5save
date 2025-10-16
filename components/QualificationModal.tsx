import React from 'react';
import type { Qualification } from '../types.ts';
import { useI18n } from '../src/i18n/index.tsx';
import { XMarkIcon } from './Icons.tsx';

interface QualificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    qualifications: Qualification[];
    onQualify: (qualificationId: string) => void;
}

const TYPE_COLORS: { [key in Qualification['type']]: { bg: string, text: string, border: string } } = {
    positive: { bg: 'bg-green-50 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-200', border: 'border-green-300 dark:border-green-700' },
    neutral: { bg: 'bg-slate-50 dark:bg-slate-700/30', text: 'text-slate-800 dark:text-slate-200', border: 'border-slate-300 dark:border-slate-600' },
    negative: { bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-200', border: 'border-red-300 dark:border-red-700' },
};

const QualificationModal: React.FC<QualificationModalProps> = ({ isOpen, onClose, qualifications, onQualify }) => {
    const { t } = useI18n();

    if (!isOpen) return null;

    const standardQuals = qualifications.filter(q => q.isStandard);
    const customQuals = qualifications.filter(q => !q.isStandard);

    const renderQuals = (quals: Qualification[]) => (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {quals.map(q => {
                const colors = TYPE_COLORS[q.type];
                return (
                    <button
                        key={q.id}
                        onClick={() => onQualify(q.id)}
                        className={`p-3 rounded-md border text-left ${colors.bg} ${colors.border} hover:ring-2 hover:ring-indigo-400`}
                    >
                        <p className={`font-bold ${colors.text}`}>{q.description}</p>
                        <p className={`text-xs font-mono opacity-70 ${colors.text}`}>[{q.code}]</p>
                    </button>
                );
            })}
        </div>
    );

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-50" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('agentView.qualifications')}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
                        <XMarkIcon className="w-6 h-6 text-slate-500" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto space-y-6">
                    {customQuals.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-slate-600 dark:text-slate-300 mb-2">Qualifications de la campagne</h4>
                            {renderQuals(customQuals)}
                        </div>
                    )}
                    {standardQuals.length > 0 && (
                         <div>
                            <h4 className="font-semibold text-slate-600 dark:text-slate-300 mb-2">Qualifications standards</h4>
                            {renderQuals(standardQuals)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QualificationModal;
