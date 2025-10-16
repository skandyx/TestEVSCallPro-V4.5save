import React, { useState } from 'react';
import { useI18n } from '../src/i18n/index.tsx';

interface CallbackSchedulerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSchedule: (scheduledTime: string) => void;
}

const CallbackSchedulerModal: React.FC<CallbackSchedulerModalProps> = ({ isOpen, onClose, onSchedule }) => {
    const { t } = useI18n();
    // FIX: Create a stable minimum datetime to prevent validation errors on re-render.
    // This function is called only once to initialize the state.
    const getMinDateTime = () => {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 1); // Set default to 1 minute in the future
    
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
    
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const [minDateTime] = useState(getMinDateTime);
    const [scheduledTime, setScheduledTime] = useState(minDateTime);

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (!scheduledTime) {
            alert(t('agentView.callbackModal.error.noTime'));
            return;
        }
        // Use the stable minDateTime for validation
        if (new Date(scheduledTime) < new Date(minDateTime)) {
            alert(t('agentView.callbackModal.error.pastTime'));
            return;
        }
        // Convert local time from input back to ISO string (UTC) for the backend
        onSchedule(new Date(scheduledTime).toISOString());
    };

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
                <div className="p-6">
                    <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t('agentView.callbackModal.title')}</h3>
                    <div className="mt-4 space-y-4">
                        <div>
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('agentView.callbackModal.label')}</label>
                            <input 
                                type="datetime-local" 
                                value={scheduledTime} 
                                onChange={e => setScheduledTime(e.target.value)} 
                                min={minDateTime}
                                className="mt-1 w-full p-2 border rounded-md dark:bg-slate-900 dark:border-slate-600"
                            />
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 p-3 flex justify-end gap-2 border-t dark:border-slate-700">
                    <button onClick={onClose} className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 px-4 py-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-600">{t('common.cancel')}</button>
                    <button onClick={handleSubmit} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">{t('agentView.callbackModal.button')}</button>
                </div>
            </div>
        </div>
    );
};

export default CallbackSchedulerModal;