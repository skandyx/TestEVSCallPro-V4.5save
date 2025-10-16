import React from 'react';
import { useI18n } from '../src/i18n/index.tsx';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText,
    cancelText,
    isDestructive = true,
}) => {
    const { t } = useI18n();

    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm();
    };

    const confirmButtonClasses = isDestructive
        ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
        : 'bg-primary hover:bg-primary-hover focus:ring-indigo-500';

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-[100]" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md animate-fade-in" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <div className="flex items-start">
                        {isDestructive && (
                            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/50 sm:mx-0 sm:h-10 sm:w-10">
                                <span className="material-symbols-outlined text-red-600 dark:text-red-400">warning</span>
                            </div>
                        )}
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                            <h3 className="text-lg font-semibold leading-6 text-slate-900 dark:text-slate-100" id="dialog-title">
                                {title}
                            </h3>
                            <div className="mt-2">
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {message}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse rounded-b-lg border-t dark:border-slate-700">
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className={`inline-flex w-full justify-center rounded-md border border-transparent px-4 py-2 text-base font-medium text-white shadow-sm sm:ml-3 sm:w-auto sm:text-sm ${confirmButtonClasses}`}
                    >
                        {confirmText || t('common.delete')}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="mt-3 inline-flex w-full justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-base font-medium text-slate-700 shadow-sm hover:bg-slate-50 sm:mt-0 sm:w-auto sm:text-sm dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600"
                    >
                        {cancelText || t('common.cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
