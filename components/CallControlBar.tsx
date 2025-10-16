import React, { RefObject } from 'react';
import type { AgentStatus, Contact, AgentProfile } from '../types.ts';
import { useI18n } from '../src/i18n/index.tsx';

interface CallControlBarProps {
    config?: AgentProfile['callControlsConfig'];
    status: AgentStatus;
    currentContact: Contact | null;
    selectedQual: string | null;
    dialOptions: {
        isOpen: boolean;
        setIsOpen: (isOpen: boolean) => void;
        options: { name: string; number: string }[];
        ref: RefObject<HTMLDivElement>;
    };
    onDial: (destination: string) => void;
    onEndCall: () => void;
    onQualify: () => void; // NEW: Prop to open qualification modal
    onHold: () => void;
    onTransfer: () => void;
    onSearch: () => void;
    onInsert: () => void;
}

const CallControlButton: React.FC<{
    icon: string;
    label: string;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    show: boolean;
}> = ({ icon, label, onClick, disabled = false, className = '', show }) => {
    if (!show) return null;

    const baseClasses = "flex flex-col items-center justify-center p-2 rounded-lg transition-colors text-xs font-semibold h-full w-24";
    const disabledClasses = "disabled:opacity-40 disabled:cursor-not-allowed";
    const activeClasses = "hover:bg-slate-200 dark:hover:bg-slate-600";
    
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`${baseClasses} ${disabled ? '' : activeClasses} ${disabledClasses} ${className}`}
        >
            <span className="material-symbols-outlined text-3xl mb-1">{icon}</span>
            <span>{label}</span>
        </button>
    );
};


const CallControlBar: React.FC<CallControlBarProps> = ({
    config, status, currentContact, selectedQual, dialOptions,
    onDial, onEndCall, onQualify, onHold, onTransfer, onSearch, onInsert
}) => {
    const { t } = useI18n();

    const isDuringCall = status === 'En Appel' || status === 'Ringing' || status === 'Mise en attente';
    
    const handleDialClick = () => {
        if (!currentContact) return;
        if (dialOptions.options.length > 1) {
            dialOptions.setIsOpen(!dialOptions.isOpen);
        } else {
            dialOptions.setIsOpen(false);
            const numberToDial = dialOptions.options.length > 0 ? dialOptions.options[0].number : currentContact.phoneNumber;
            onDial(numberToDial);
        }
    };
    
    const handleDialOptionClick = (number: string) => {
        onDial(number);
        dialOptions.setIsOpen(false);
    };

    return (
        <footer className="flex-shrink-0 bg-white dark:bg-slate-800 shadow-lg border-t border-slate-200 dark:border-slate-700 h-24 flex items-center justify-center px-4 gap-2">
            <div className="relative h-full flex items-center" ref={dialOptions.ref}>
                <CallControlButton
                    show={config?.dial ?? true}
                    icon="call"
                    label={t('agentView.callControls.call')}
                    onClick={handleDialClick}
                    disabled={status !== 'En Attente' || !currentContact}
                    className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800"
                />
                 {dialOptions.isOpen && dialOptions.options.length > 1 && (
                    <div className="absolute bottom-full mb-2 w-56 bg-white dark:bg-slate-700 rounded-lg shadow-xl border dark:border-slate-600 overflow-hidden z-20">
                        <ul className="divide-y dark:divide-slate-600">
                            {dialOptions.options.map(option => (
                                <li key={option.number}>
                                    <button onClick={() => handleDialOptionClick(option.number)} className="w-full text-left p-3 hover:bg-slate-100 dark:hover:bg-slate-600">
                                        <p className="font-semibold text-sm">{t('agentView.callNumber', { phoneName: option.name })}</p>
                                        <p className="text-xs font-mono text-slate-500 dark:text-slate-400">{option.number}</p>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
            
            <CallControlButton
                show={config?.qualify ?? true}
                icon="fact_check"
                label={t('agentProfiles.controls.qualify')}
                onClick={onQualify}
                disabled={!currentContact}
                className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800"
            />

            <CallControlButton
                show={config?.hangup ?? true}
                icon="call_end"
                label={t('agentView.callControls.hangup')}
                onClick={onEndCall}
                disabled={!currentContact || !selectedQual}
                className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800"
            />
            
            <CallControlButton
                show={config?.hold ?? true}
                icon="pause"
                label={t('agentView.callControls.hold')}
                onClick={onHold}
                disabled={!isDuringCall}
            />

            <CallControlButton
                show={config?.transfer ?? true}
                icon="phone_forwarded"
                label={t('agentView.callControls.transfer')}
                onClick={onTransfer}
                disabled={!isDuringCall}
            />

            <CallControlButton
                show={config?.mute ?? false}
                icon="mic_off"
                label={t('agentProfiles.controls.mute')}
                onClick={() => alert('Mute action')}
                disabled={!isDuringCall}
            />
            <CallControlButton
                show={config?.keypad ?? false}
                icon="dialpad"
                label={t('agentProfiles.controls.keypad')}
                onClick={() => alert('Keypad action')}
                disabled={!isDuringCall}
            />
             <CallControlButton
                show={config?.search ?? false}
                icon="search"
                label={t('agentProfiles.controls.search')}
                onClick={onSearch}
                disabled={isDuringCall}
            />
             <CallControlButton
                show={config?.insert ?? false}
                icon="person_add"
                label={t('agentProfiles.controls.insert')}
                onClick={onInsert}
                disabled={isDuringCall}
            />
        </footer>
    );
};

export default CallControlBar;
