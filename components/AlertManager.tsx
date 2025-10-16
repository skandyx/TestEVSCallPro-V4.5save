import React, { useEffect, useState } from 'react';
import { useStore } from '../src/store/useStore.ts';
import { CheckIcon, XMarkIcon, InformationCircleIcon } from './Icons.tsx';
import { useI18n } from '../src/i18n/index.tsx';

const AlertManager: React.FC = () => {
    const { alert, hideAlert } = useStore(state => ({
        alert: state.alert,
        hideAlert: state.hideAlert,
    }));
    const { t } = useI18n();

    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        if (alert?.type === 'toast') {
            setIsExiting(false);
            const timer = setTimeout(() => {
                setIsExiting(true);
                setTimeout(hideAlert, 300); // Wait for fade-out animation
            }, 4000); // Auto-dismiss after 4 seconds
            return () => clearTimeout(timer);
        }
    }, [alert, hideAlert]);

    if (!alert) return null;

    const ICONS = {
        success: <CheckIcon className="w-6 h-6 text-green-500" />,
        error: <XMarkIcon className="w-6 h-6 text-red-500" />,
        warning: <InformationCircleIcon className="w-6 h-6 text-yellow-500" />,
        info: <InformationCircleIcon className="w-6 h-6 text-blue-500" />,
    };

    const TOAST_STYLES = {
        success: 'bg-green-50 dark:bg-green-900/50 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200',
        error: 'bg-red-50 dark:bg-red-900/50 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200',
        warning: 'bg-yellow-50 dark:bg-yellow-900/50 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200',
        info: 'bg-blue-50 dark:bg-blue-900/50 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200',
    };

    if (alert.type === 'modal') {
        return (
            <div className="fixed inset-0 bg-slate-900 bg-opacity-60 flex items-center justify-center p-4 z-[100]" role="alertdialog" aria-modal="true" aria-labelledby="alert-message">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md p-6 text-center animate-fade-in">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                        {ICONS[alert.status]}
                    </div>
                    <p id="alert-message" className="mt-4 text-lg font-medium text-slate-800 dark:text-slate-100">{alert.message}</p>
                    <button onClick={hideAlert} className="mt-6 w-full bg-primary hover:bg-primary-hover text-primary-text font-bold py-2 px-4 rounded-lg shadow-md">
                        {t('common.close')}
                    </button>
                </div>
            </div>
        );
    }

    // Toast
    return (
        <div className={`fixed bottom-5 right-5 w-full max-w-sm z-[100] ${isExiting ? 'animate-fade-out' : 'animate-fade-in'}`}>
            <div role="alert" className={`flex items-start gap-4 p-4 rounded-lg shadow-lg border ${TOAST_STYLES[alert.status]}`}>
                <div className="flex-shrink-0 mt-0.5">{ICONS[alert.status]}</div>
                <div className="flex-1">
                    <p className="font-semibold">{alert.message}</p>
                </div>
                <button onClick={hideAlert} className="p-1 rounded-full -mt-1 -mr-1 hover:bg-black/10">
                    <XMarkIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default AlertManager;