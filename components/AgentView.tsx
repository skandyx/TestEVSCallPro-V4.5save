import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { User, Campaign, Contact, Qualification, SavedScript, ContactNote, PersonalCallback, AgentStatus, AgentState, AgentProfile } from '../types.ts';
import AgentPreview from './AgentPreview.tsx';
import UserProfileModal from './UserProfileModal.tsx';
import apiClient from '../src/lib/axios.ts';
import { useI18n } from '../src/i18n/index.tsx';
import wsClient from '../src/services/wsClient.ts';
import CallbackSchedulerModal from './CallbackSchedulerModal.tsx';
import RelaunchSchedulerModal from './RelaunchSchedulerModal.tsx';
import CallControlBar from './CallControlBar.tsx';
import ContactSearchModal from './ContactSearchModal.tsx';
import QualificationModal from './QualificationModal.tsx';
import CampaignSelectionModal from './CampaignSelectionModal.tsx';
import { useStore } from '../src/store/useStore.ts';

type Theme = 'light' | 'dark' | 'system';

interface SupervisorNotification {
    id: number | string;
    from: string;
    message: string;
    timestamp: string;
}

interface AgentViewProps {
    onUpdatePassword: (passwordData: any) => Promise<void>;
    onUpdateProfilePicture: (base64DataUrl: string) => Promise<void>;
}


// --- Reusable Components ---
const Clock: React.FC = () => {
    const { language } = useI18n();
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const timerId = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);
    return <div className="text-sm font-medium text-slate-500 dark:text-slate-400 font-mono">{time.toLocaleDateString(language)} {time.toLocaleTimeString(language)}</div>;
};

const ThemeSwitcher: React.FC<{ theme: Theme; setTheme: (theme: Theme) => void; }> = ({ theme, setTheme }) => {
    const { t } = useI18n();
    const options: { name: Theme; icon: string; titleKey: string }[] = [
        { name: 'system', icon: 'desktop_windows', titleKey: 'header.theme.system' },
        { name: 'light', icon: 'light_mode', titleKey: 'header.theme.light' },
        { name: 'dark', icon: 'dark_mode', titleKey: 'header.theme.dark' },
    ];
    return <div className="flex items-center p-1 space-x-1 bg-slate-100 dark:bg-slate-700 rounded-full">{options.map(option => <button key={option.name} onClick={() => setTheme(option.name)} className={`p-1.5 rounded-full transition-colors ${theme === option.name ? 'bg-white dark:bg-slate-900 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`} title={t(option.titleKey)}><span className="material-symbols-outlined text-base">{option.icon}</span></button>)}</div>;
};

const LanguageSwitcher: React.FC = () => {
    const { language, setLanguage } = useI18n();
    const [isOpen, setIsOpen] = useState(false);
    const languages = [
        { code: 'fr', name: 'Français' },
        { code: 'en', name: 'English' },
        { code: 'ar', name: 'العربية' },
    ];
    const toggleDropdown = () => setIsOpen(!isOpen);
    useEffect(() => {
        const close = () => setIsOpen(false);
        if (isOpen) window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, [isOpen]);
    const getFlagSrc = (code: string) => {
        if (code === 'fr') return '/fr-flag.svg';
        if (code === 'en') return '/en-flag.svg';
        if (code === 'ar') return '/sa-flag.svg';
        return '';
    };

    return <div className="relative"><button onClick={(e) => { e.stopPropagation(); toggleDropdown(); }} className="flex items-center p-1 space-x-2 bg-slate-100 dark:bg-slate-700 rounded-full text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"><span className="w-6 h-6 rounded-full overflow-hidden"><img src={getFlagSrc(language)} alt={language} className="w-full h-full object-cover" /></span><span className="hidden sm:inline">{language.toUpperCase()}</span><span className="material-symbols-outlined w-4 h-4 text-slate-500 dark:text-slate-400 mr-1">expand_more</span></button>{isOpen && <div className="absolute right-0 mt-2 w-36 origin-top-right bg-white dark:bg-slate-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-20"><div className="py-1">{languages.map(lang => <button key={lang.code} onClick={() => { setLanguage(lang.code); setIsOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"><img src={getFlagSrc(lang.code)} alt={lang.name} className="w-5 h-auto rounded-sm" />{lang.name}</button>)}</div></div>}</div>;
}

const getStatusColor = (status: AgentStatus | undefined): string => {
    if (!status) return 'bg-gray-400';
    switch (status) {
        case 'En Attente': return 'bg-green-500';
        case 'En Appel': return 'bg-red-500';
        case 'En Post-Appel': return 'bg-yellow-500';
        case 'Ringing': return 'bg-blue-500';
        case 'En Pause': return 'bg-orange-500';
        case 'Formation': return 'bg-purple-500';
        case 'Mise en attente': return 'bg-purple-500';
        case 'Déconnecté': return 'bg-gray-500';
        default: return 'bg-gray-400';
    }
};

const statusToI18nKey = (status: AgentStatus): string => {
    const map: Record<AgentStatus, string> = {
        'En Attente': 'agentView.statuses.available',
        'En Appel': 'agentView.statuses.onCall',
        'En Post-Appel': 'agentView.statuses.wrapUp',
        'En Pause': 'agentView.statuses.onPause',
        'Ringing': 'agentView.statuses.ringing',
        'Déconnecté': 'agentView.statuses.disconnected',
        'Mise en attente': 'agentView.statuses.onHold',
        'Formation': 'agentView.statuses.training',
    };
    return map[status] || status;
};

// --- Agent View ---
const AgentView: React.FC<AgentViewProps> = ({ onUpdatePassword, onUpdateProfilePicture }) => {
    const { t, language } = useI18n();

    const { 
        currentUser, campaigns, qualifications, savedScripts, contactNotes, users, personalCallbacks,
        agentStates, agentProfiles, logout, fetchApplicationData, theme, setTheme, changeAgentStatus, callHistory,
        showAlert
    } = useStore(state => ({
        currentUser: state.currentUser!,
        campaigns: state.campaigns,
        qualifications: state.qualifications,
        savedScripts: state.savedScripts,
        contactNotes: state.contactNotes,
        users: state.users,
        personalCallbacks: state.personalCallbacks,
        agentStates: state.agentStates,
        agentProfiles: state.agentProfiles,
        logout: state.logout,
        fetchApplicationData: state.fetchApplicationData,
        theme: state.theme,
        setTheme: state.setTheme,
        changeAgentStatus: state.changeAgentStatus,
        callHistory: state.callHistory,
        showAlert: state.showAlert,
    }));
    
    const agentState: AgentState | undefined = useMemo(() => agentStates.find(a => a.id === currentUser.id), [currentUser, agentStates]);
    const agentProfile: AgentProfile | undefined = useMemo(() => agentProfiles.find(p => p.id === currentUser.agentProfileId), [currentUser, agentProfiles]);

    const [currentContact, setCurrentContact] = useState<Contact | null>(null);
    const [currentCampaign, setCurrentCampaign] = useState<Campaign | null>(null);
    const [activeScript, setActiveScript] = useState<SavedScript | null>(null);
    const [selectedQual, setSelectedQual] = useState<string | null>(null);
    const [isLoadingNextContact, setIsLoadingNextContact] = useState(false);
    const [newNote, setNewNote] = useState('');
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
    const [isCallbackModalOpen, setIsCallbackModalOpen] = useState(false);
    const [isRelaunchModalOpen, setIsRelaunchModalOpen] = useState(false);
    const [activeDialingCampaignId, setActiveDialingCampaignId] = useState<string | null>(null);
    const [agentNotifications, setAgentNotifications] = useState<SupervisorNotification[]>([]);
    const [isAgentNotifOpen, setIsAgentNotifOpen] = useState(false);
    const [activeReplyId, setActiveReplyId] = useState<number | string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [isDialOptionsOpen, setIsDialOptionsOpen] = useState(false);
    const dialOptionsRef = useRef<HTMLDivElement>(null);
    const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
    const statusMenuRef = useRef<HTMLDivElement>(null);
    const [callbackViewDate, setCallbackViewDate] = useState(new Date());
    const [callbackCampaignFilter, setCallbackCampaignFilter] = useState('all');
    const [activeCallbackId, setActiveCallbackId] = useState<string | null>(null);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [isQualifyModalOpen, setIsQualifyModalOpen] = useState(false);
    const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);

    const status = agentState?.status || 'Déconnecté';
    
    const wrapUpTimerRef = useRef<number | null>(null);
    const campaignForWrapUp = useRef<Campaign | null>(null);
    
    const assignedCampaigns = useMemo(() => currentUser.campaignIds.map(id => campaigns.find(c => c.id === id && c.isActive)).filter((c): c is Campaign => !!c), [currentUser.campaignIds, campaigns]);
    
    const positiveQualificationsToday = useMemo(() => {
        if (!callHistory || !qualifications || !currentUser) return 0;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return callHistory.filter(call => {
            if (call.agentId !== currentUser.id) return false;
            const callDate = new Date(call.startTime);
            if (callDate < today) return false;
            
            const qual = qualifications.find(q => q.id === call.qualificationId);
            return qual?.type === 'positive';
        }).length;
    }, [callHistory, qualifications, currentUser.id]);

    const mySortedCallbacks = useMemo(() => {
        if (!personalCallbacks) return [];
    
        const startOfDay = new Date(callbackViewDate);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(callbackViewDate);
        endOfDay.setHours(23, 59, 59, 999);

        const pendingCallbacks = personalCallbacks
            .filter(cb => cb.agentId === currentUser.id && cb.status === 'pending')
            .filter(cb => {
                if (callbackCampaignFilter === 'all') return true;
                return cb.campaignId === callbackCampaignFilter;
            });
        
        const overdue = pendingCallbacks
            .filter(cb => new Date(cb.scheduledTime) < startOfDay)
            .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());

        const forSelectedDay = pendingCallbacks
            .filter(cb => {
                const scheduled = new Date(cb.scheduledTime);
                return scheduled >= startOfDay && scheduled <= endOfDay;
            })
            .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());

        return [...overdue, ...forSelectedDay];
    }, [personalCallbacks, currentUser.id, callbackCampaignFilter, callbackViewDate]);

    const contactNotesForCurrentContact = useMemo(() => {
        if (!currentContact || !contactNotes) return [];
        return contactNotes.filter(note => note.contactId === currentContact.id);
    }, [currentContact, contactNotes]);

    const qualificationsForCampaign = useMemo(() => {
        if (!currentCampaign || !qualifications) return [];
        const groupId = currentCampaign.qualificationGroupId;
        const qualMap = new Map<string, Qualification>();

        qualifications.forEach(q => {
            if (q.isStandard) {
                qualMap.set(q.id, q);
            }
        });

        if (groupId) {
            qualifications.forEach(q => {
                if (q.groupId === groupId) {
                    qualMap.set(q.id, q);
                }
            });
        }
        
        return Array.from(qualMap.values()).sort((a,b) => parseInt(a.code) - parseInt(b.code));
    }, [currentCampaign, qualifications]);


    useEffect(() => {
        if (assignedCampaigns.length > 0 && !activeDialingCampaignId) {
            setActiveDialingCampaignId(assignedCampaigns[0]?.id || null);
        }
    }, [assignedCampaigns, activeDialingCampaignId]);
    
    useEffect(() => {
        if (currentCampaign) setCallbackCampaignFilter(currentCampaign.id);
        else setCallbackCampaignFilter('all');
    }, [currentCampaign]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) setIsStatusMenuOpen(false);
            if (dialOptionsRef.current && !dialOptionsRef.current.contains(event.target as Node)) setIsDialOptionsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('authToken');
        if (token) wsClient.connect(token);
        const handleWebSocketMessage = (event: any) => {
            if (event.type === 'supervisorMessage') {
                const newNotif: SupervisorNotification = { 
                    id: event.payload.id || Date.now(), 
                    from: event.payload.from, 
                    message: event.payload.message, 
                    timestamp: new Date().toISOString() 
                };
                setAgentNotifications(prev => {
                    if (prev.some(n => n.id === newNotif.id)) {
                        return prev;
                    }
                    return [newNotif, ...prev];
                });
            }
        };
        const unsubscribe = wsClient.onMessage(handleWebSocketMessage);
        return () => { unsubscribe(); wsClient.disconnect(); };
    }, []);

    useEffect(() => {
        if (currentCampaign && campaigns) {
            const updatedCampaign = campaigns.find(c => c.id === currentCampaign.id);
            if (updatedCampaign) {
                const campaignWithoutContacts = (c: Campaign) => { const { contacts, ...rest } = c; return rest; };
                if (JSON.stringify(campaignWithoutContacts(updatedCampaign)) !== JSON.stringify(campaignWithoutContacts(currentCampaign))) {
                    setCurrentCampaign(updatedCampaign);
                }
    
                if (currentContact) {
                    const updatedContact = updatedCampaign.contacts.find(c => c.id === currentContact.id);
                    if (updatedContact && JSON.stringify(updatedContact) !== JSON.stringify(currentContact)) {
                        setCurrentContact(updatedContact);
                    }
                }
            }
        }
    }, [campaigns, currentContact, currentCampaign]);
    
    const handleWrapUp = useCallback(async () => {
        await fetchApplicationData();
        setCurrentContact(null);
        setCurrentCampaign(null);
        setActiveScript(null);
        setSelectedQual(null);
        setNewNote('');
        setActiveCallbackId(null);
        campaignForWrapUp.current = null;
        changeAgentStatus('En Attente');
    }, [changeAgentStatus, fetchApplicationData]);

    const requestNextContact = useCallback(async () => {
        if (isLoadingNextContact || status !== 'En Attente') return;
        if (!activeDialingCampaignId) {
            setFeedbackMessage(t('agentView.feedback.activateCampaign'));
            setTimeout(() => setFeedbackMessage(null), 3000);
            return;
        }
        setIsLoadingNextContact(true); setFeedbackMessage(null);
        try {
            const response = await apiClient.post('/campaigns/next-contact', { agentId: currentUser.id, activeCampaignId: activeDialingCampaignId });
            const { contact, campaign } = response.data;
            if (contact && campaign) {
                setCurrentContact(contact); setCurrentCampaign(campaign);
                const script = savedScripts.find(s => s.id === campaign.scriptId);
                setActiveScript(script || null);
                if (campaign.dialingMode !== 'MANUAL') changeAgentStatus('En Appel');
            } else {
                 const selectedCampaignName = campaigns.find(c => c.id === activeDialingCampaignId)?.name || 'la campagne sélectionnée';
                 setFeedbackMessage(t('agentView.feedback.noContactAvailable', { campaignName: selectedCampaignName }));
                 setTimeout(() => setFeedbackMessage(null), 3000);
            }
        } catch (error) {
            console.error("Failed to get next contact:", error);
            setFeedbackMessage(t('agentView.feedback.errorFetchingContact'));
            setTimeout(() => setFeedbackMessage(null), 3000);
        } finally {
            setIsLoadingNextContact(false);
        }
    }, [currentUser.id, savedScripts, campaigns, isLoadingNextContact, status, activeDialingCampaignId, changeAgentStatus, t]);
    
    useEffect(() => {
        if (status === 'En Attente' && !currentContact && !isLoadingNextContact && activeDialingCampaignId) {
            const timer = setTimeout(() => {
                requestNextContact();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [status, currentContact, isLoadingNextContact, activeDialingCampaignId, requestNextContact]);

    useEffect(() => {
        if (wrapUpTimerRef.current) {
            clearTimeout(wrapUpTimerRef.current);
            wrapUpTimerRef.current = null;
        }

        if (status === 'En Post-Appel' && campaignForWrapUp.current) {
            const wrapUpTime = campaignForWrapUp.current.wrapUpTime ?? 0;
            if (wrapUpTime > 0) {
                wrapUpTimerRef.current = window.setTimeout(handleWrapUp, wrapUpTime * 1000);
            } else {
                handleWrapUp();
            }
        }
        
        return () => {
            if (wrapUpTimerRef.current) {
                clearTimeout(wrapUpTimerRef.current);
            }
        };
    }, [status, handleWrapUp]);


    const handleDial = async (destination: string) => {
        if (!currentContact || !currentCampaign || !destination) return;
        try {
            await apiClient.post('/call/originate', {
                agentId: currentUser.id,
                destination,
                campaignId: currentCampaign.id,
                contactId: currentContact.id
            });
            changeAgentStatus('En Appel');
        } catch (error) {
            console.error("Originate call failed:", error);
            setFeedbackMessage("Échec du lancement de l'appel.");
            setTimeout(() => setFeedbackMessage(null), 3000);
        }
    };

    const finalizeCall = async (qualificationId: string, relaunchTime?: string) => {
        if (!currentContact || !currentCampaign) return;

        try {
            await apiClient.post(`/contacts/${currentContact.id}/qualify`, {
                qualificationId,
                campaignId: currentCampaign.id,
                agentId: currentUser.id,
                relaunchTime,
            });

            if (activeCallbackId) {
                await apiClient.put(`/planning-events/callbacks/${activeCallbackId}`, { status: 'completed' });
            }
            
            await fetchApplicationData();
            
            // Reset state
            campaignForWrapUp.current = currentCampaign; // Store for wrap-up timer
            setCurrentContact(null);
            setActiveScript(null);
            setSelectedQual(null);
            setNewNote('');
            setActiveCallbackId(null);
            
            changeAgentStatus('En Post-Appel');

        } catch (error) {
            console.error("Failed to qualify contact:", error);
            alert("Erreur lors de la qualification.");
        }
    };

    const handleEndCall = async (relaunchTime?: string) => {
        if (!selectedQual) {
            alert("Veuillez sélectionner une qualification avant de finaliser.");
            return;
        }

        const selectedQualificationObject = qualificationsForCampaign.find(q => q.id === selectedQual);

        if (selectedQualificationObject?.code === '94') { // Rappel Personnel
            setIsCallbackModalOpen(true);
            return;
        }

        if (selectedQualificationObject?.code === '95' && !relaunchTime) { // Relance
            setIsRelaunchModalOpen(true);
            return;
        }
    
        await finalizeCall(selectedQual, relaunchTime);
    };

    const handleQualifyAndEnd = async (qualificationId: string) => {
        setIsQualifyModalOpen(false);

        const qual = qualificationsForCampaign.find(q => q.id === qualificationId);
        if (qual?.code === '94') { 
            setSelectedQual(qualificationId);
            setIsCallbackModalOpen(true); 
            return; 
        }
        if (qual?.code === '95') { 
            setSelectedQual(qualificationId);
            setIsRelaunchModalOpen(true); 
            return; 
        }

        await finalizeCall(qualificationId);
    };


    const handleScheduleAndEndCall = async (scheduledTime: string) => {
        if (!currentContact || !currentCampaign || !selectedQual) return;
        try {
            await apiClient.post(`/contacts/${currentContact.id}/schedule-callback`, { agentId: currentUser.id, campaignId: currentCampaign.id, contactName: `${currentContact.firstName} ${currentContact.lastName}`, contactNumber: currentContact.phoneNumber, scheduledTime, notes: '' });
            
            // We still need to qualify the call itself
            await finalizeCall(selectedQual);

            setIsCallbackModalOpen(false); 

        } catch (error: any) { 
            console.error("Failed to schedule callback:", error); 
            alert(error.response?.data?.error || "Une erreur est survenue."); 
        }
    };

    const handleScheduleRelaunch = async (relaunchTime: string) => {
        setIsRelaunchModalOpen(false);
        await handleEndCall(relaunchTime);
    };
    
    const handleSaveNote = async () => {
        if (!newNote.trim() || !currentContact || !currentCampaign) return;
        try {
            await apiClient.post(`/contacts/${currentContact.id}/notes`, { agentId: currentUser.id, campaignId: currentCampaign.id, note: newNote });
            setNewNote(''); await fetchApplicationData();
        } catch (error) { console.error("Failed to save note:", error); alert("Erreur lors de la sauvegarde de la note."); }
    };
    
    const handleSaveNewContact = async (campaignId: string, contactData: Record<string, any>, phoneNumber: string) => {
        try {
            const standardFieldMap: Record<string, keyof Omit<Contact, 'id'|'status'|'customFields'>> = {
                'first_name': 'firstName', 'last_name': 'lastName', 'phone_number': 'phoneNumber', 'postal_code': 'postalCode',
            };
            const newContactPayload: Partial<Contact> & { campaignId: string, customFields: Record<string, any> } = {
                campaignId: campaignId,
                status: 'pending',
                customFields: {},
            };
            for (const key in contactData) {
                if (standardFieldMap[key]) {
                    (newContactPayload as any)[standardFieldMap[key]] = contactData[key];
                } else {
                    newContactPayload.customFields[key] = contactData[key];
                }
            }
            if (!newContactPayload.phoneNumber) {
                newContactPayload.phoneNumber = phoneNumber;
            }
    
            await apiClient.post(`/contacts`, newContactPayload);
            await fetchApplicationData();
        } catch (error) {
            console.error("Failed to save new contact:", error);
            alert("Erreur lors de la sauvegarde du nouveau contact.");
        }
    };

    const updateContact = async (contactData: Contact) => {
        if (contactData.id.startsWith('new-manual-insert-')) {
            if (!currentCampaign) {
                alert("Erreur: Impossible de sauvegarder, aucune campagne active.");
                return;
            }
            const dataForSave: Record<string, any> = { ...contactData.customFields };
            if (contactData.firstName) dataForSave['first_name'] = contactData.firstName;
            if (contactData.lastName) dataForSave['last_name'] = contactData.lastName;
            if (contactData.phoneNumber) dataForSave['phone_number'] = contactData.phoneNumber;
            if (contactData.postalCode) dataForSave['postal_code'] = contactData.postalCode;
    
            await handleSaveNewContact(currentCampaign.id, dataForSave, contactData.phoneNumber);
        } else {
            await apiClient.put(`/contacts/${contactData.id}`, contactData);
        }
    };

    const handleCampaignSelection = (campaignId: string) => {
        setActiveDialingCampaignId(prevId => prevId === campaignId ? null : campaignId);
    };

    const handleRaiseHand = useCallback(() => {
        wsClient.send({ type: 'agentRaisedHand', payload: { agentId: currentUser.id, agentName: `${currentUser.firstName} ${currentUser.lastName}`, agentLoginId: currentUser.loginId }});
        setFeedbackMessage(t('agentView.askForHelp'));
        setTimeout(() => setFeedbackMessage(null), 3000);
    }, [currentUser, t]);

    const handleRespondToSupervisor = (notificationId: number | string) => {
        if (!replyText.trim()) return;
        wsClient.send({ type: 'agentResponseToSupervisor', payload: { agentName: `${currentUser.firstName} ${currentUser.lastName}`, message: replyText }});
        setReplyText(''); setActiveReplyId(null); setAgentNotifications(prev => prev.filter(n => n.id !== notificationId));
    };
    
    const handleClearContact = () => { setCurrentContact(null); setSelectedQual(null); setNewNote(''); };
    
    const handleCallbackClick = useCallback((callback: PersonalCallback) => {
        if (status !== 'En Attente') {
            setFeedbackMessage(t('agentView.feedback.mustEndTask')); setTimeout(() => setFeedbackMessage(null), 3000); return;
        }
        setActiveCallbackId(callback.id);
        const campaign = campaigns.find(c => c.id === callback.campaignId); if (!campaign) { console.error(`Campaign ${callback.campaignId} not found.`); return; }
        const contact = campaign.contacts.find(c => c.id === callback.contactId); if (!contact) { console.error(`Contact ${callback.contactId} not found.`); return; }
        const script = savedScripts.find(s => s.id === campaign.scriptId);
        setCurrentContact(contact); setCurrentCampaign(campaign); setActiveScript(script || null); setActiveDialingCampaignId(campaign.id);
    }, [status, campaigns, savedScripts, t]);

    const handleSelectContactFromSearch = async (contact: Contact, campaign: Campaign) => {
        if (status !== 'En Attente') {
            showAlert(t('agentView.feedback.mustEndTask'), 'warning');
            return;
        }

        setIsSearchModalOpen(false);
        setIsLoadingNextContact(true);

        try {
            const response = await apiClient.post(`/contacts/${contact.id}/lock`);
            const lockedContact = response.data;
            
            const script = savedScripts.find(s => s.id === campaign.scriptId);
            setCurrentContact(lockedContact);
            setCurrentCampaign(campaign);
            setActiveScript(script || null);
            setActiveDialingCampaignId(campaign.id);

        } catch (error: any) {
            if (error.response?.status === 409) {
                showAlert(error.response.data.error, 'error');
            } else {
                console.error("Failed to lock contact from search:", error);
                showAlert('Erreur lors du verrouillage de la fiche.', 'error');
            }
        } finally {
            setIsLoadingNextContact(false);
        }
    };

    const handleInsertBlankRecord = () => {
        if (!activeDialingCampaignId) {
            setFeedbackMessage(t('agentView.feedback.activateCampaign'));
            setTimeout(() => setFeedbackMessage(null), 3000);
            return;
        }
        const activeCampaign = campaigns.find(c => c.id === activeDialingCampaignId);
        if (!activeCampaign) return;

        const blankContact: Contact = {
            id: `new-manual-insert-${Date.now()}`,
            firstName: '',
            lastName: '',
            phoneNumber: '',
            postalCode: '',
            status: 'pending',
            customFields: {},
        };
        const script = savedScripts.find(s => s.id === activeCampaign.scriptId);
        
        setCurrentContact(blankContact);
        setCurrentCampaign(activeCampaign);
        setActiveScript(script || null);
    };
    
    const handleCallbackDateChange = (offset: number) => {
        setCallbackViewDate(current => {
            const newDate = new Date(current);
            newDate.setDate(newDate.getDate() + offset);
            return newDate;
        });
    };

    const allPhoneNumbers = useMemo(() => {
        if (!currentContact || !activeScript) return [];
        const phoneBlocks = activeScript.pages.flatMap(p => p.blocks).filter(b => b.type === 'phone' && b.isVisible !== false);
        return phoneBlocks.map(block => {
            let number = '';
            if (block.fieldName === 'phone_number') number = currentContact.phoneNumber;
            else if (currentContact.customFields && currentContact.customFields[block.fieldName]) number = currentContact.customFields[block.fieldName];
            return { name: block.name, number };
        }).filter(p => p.number);
    }, [currentContact, activeScript]);

    const handleMainCallClick = useCallback(() => {
        if (!currentContact) return;
        if (allPhoneNumbers.length > 1) setIsDialOptionsOpen(prev => !prev);
        else { setIsDialOptionsOpen(false); const numberToDial = allPhoneNumbers.length > 0 ? allPhoneNumbers[0].number : currentContact.phoneNumber; handleDial(numberToDial); }
    }, [currentContact, allPhoneNumbers, handleDial]);
    
    const matchingQuota = useMemo(() => {
        if (!currentContact || !currentCampaign?.quotaRules) return null;
        for (const rule of currentCampaign.quotaRules) {
            const contactValue = (rule.contactField === 'postalCode' ? currentContact.postalCode : currentContact.customFields?.[rule.contactField]) || '';
            let match = false;
            if (rule.operator === 'equals') match = contactValue === rule.value;
            else if (rule.operator === 'starts_with') match = contactValue.startsWith(rule.value);
            if (match) {
                return { rule, current: rule.currentCount, limit: rule.limit, progress: rule.limit > 0 ? (rule.currentCount / rule.limit) * 100 : 0 };
            }
        }
        return null;
    }, [currentContact, currentCampaign]);

    const KpiCard: React.FC<{ title: string; value: string | number; }> = ({ title, value }) => (
        <div className="bg-slate-100 dark:bg-slate-900 p-2 rounded-md"><p className="text-xs text-slate-500 dark:text-slate-400">{title}</p><p className="text-xl font-bold text-slate-800 dark:text-slate-200 font-mono text-center">{value}</p></div>
    );
    
    const formatTimer = (seconds: number) => {
        if (isNaN(seconds)) seconds = 0;
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };
    
    const canChangeStatus = !['En Appel', 'En Post-Appel'].includes(status);
    const statuses: { id: AgentStatus, i18nKey: string, color: string, led: string }[] = [
        { id: 'En Attente', i18nKey: 'agentView.statuses.available', color: 'bg-green-500', led: getStatusColor('En Attente') },
        { id: 'En Pause', i18nKey: 'agentView.statuses.onPause', color: 'bg-orange-500', led: getStatusColor('En Pause') },
        { id: 'Formation', i18nKey: 'agentView.statuses.training', color: 'bg-purple-500', led: getStatusColor('Formation') },
    ];
    
    const wrapUpTotal = campaignForWrapUp.current?.wrapUpTime || 0;
    const wrapUpElapsed = agentState?.statusDuration || 0;
    const wrapUpRemaining = Math.max(0, wrapUpTotal - wrapUpElapsed);

    return (
        <div className="h-screen w-screen flex flex-col font-sans bg-slate-100 text-lg dark:bg-slate-900 dark:text-slate-200">
             {isProfileModalOpen && <UserProfileModal user={currentUser} onClose={() => setIsProfileModalOpen(false)} onSavePassword={onUpdatePassword} onSaveProfilePicture={onUpdateProfilePicture} />}
             <CallbackSchedulerModal isOpen={isCallbackModalOpen} onClose={() => setIsCallbackModalOpen(false)} onSchedule={handleScheduleAndEndCall} />
             <RelaunchSchedulerModal isOpen={isRelaunchModalOpen} onClose={() => setIsRelaunchModalOpen(false)} onSchedule={handleScheduleRelaunch} />
             <ContactSearchModal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} campaigns={assignedCampaigns} onSelectContact={handleSelectContactFromSearch} />
             <QualificationModal isOpen={isQualifyModalOpen} onClose={() => setIsQualifyModalOpen(false)} qualifications={qualificationsForCampaign} onQualify={handleQualifyAndEnd} />
             {isCampaignModalOpen && <CampaignSelectionModal isOpen={isCampaignModalOpen} onClose={() => setIsCampaignModalOpen(false)} assignedCampaigns={assignedCampaigns} activeDialingCampaignId={activeDialingCampaignId} onCampaignToggle={handleCampaignSelection} />}


             <header className="flex-shrink-0 bg-white dark:bg-slate-800 shadow-md p-3 flex justify-between items-center z-10">
                <div ref={statusMenuRef} className="relative flex items-center gap-4">
                    <button onClick={() => setIsStatusMenuOpen(p => !p)} className="relative p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
                        {currentUser.profilePictureUrl ? <img src={currentUser.profilePictureUrl} alt="Avatar" className="w-10 h-10 rounded-full object-cover" /> : <span className="material-symbols-outlined text-4xl text-slate-400">account_circle</span>}
                        <span className={`absolute top-0 right-0 block h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-800 ${getStatusColor(agentState?.status)}`}></span>
                    </button>
                    <div className="text-left">
                        <p className="font-bold text-slate-800 dark:text-slate-100">{currentUser.firstName} {currentUser.lastName} - {t('agentView.extension', { ext: currentUser.loginId })}</p>
                         {agentState && (<div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${getStatusColor(agentState.status)}`}></span><span>{t(statusToI18nKey(agentState.status))}</span><span className="font-mono">{formatTimer(agentState.statusDuration)}</span></div>)}
                    </div>
                    {isStatusMenuOpen && (
                         <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-md shadow-lg border dark:border-slate-700 p-2 z-20">
                            <div className="space-y-1">{statuses.map(s => (<button key={s.id} onClick={() => { changeAgentStatus(s.id); setIsStatusMenuOpen(false); }} disabled={!canChangeStatus} className={`w-full text-left flex items-center gap-3 p-2 rounded-md text-slate-700 dark:text-slate-200 ${agentState?.status === s.id ? 'bg-indigo-50 dark:bg-indigo-900/50' : 'hover:bg-slate-100 dark:hover:bg-slate-700'} disabled:opacity-50 disabled:cursor-not-allowed`}><span className={`w-2.5 h-2.5 rounded-full ${s.led}`}></span>{t(s.i18nKey)}{agentState?.status === s.id && <span className="material-symbols-outlined text-base text-indigo-600 ml-auto">check</span>}</button>))}</div>
                            <div className="border-t dark:border-slate-700 mt-2 pt-2"><button onClick={() => { setIsProfileModalOpen(true); setIsStatusMenuOpen(false); }} className="w-full text-left flex items-center gap-3 p-2 rounded-md text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"><span className="material-symbols-outlined text-base text-slate-500">settings</span>{t('agentView.statusManager.settings')}</button></div>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    <Clock />
                    <button onClick={() => setIsCampaignModalOpen(true)} className="font-semibold py-2 px-3 rounded-lg inline-flex items-center bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 text-sm">
                        <span className="material-symbols-outlined mr-2 text-base">list</span>
                        {t('agentView.campaignList.button')}
                    </button>
                    {agentProfile?.callControlsConfig?.raiseHand && <button onClick={handleRaiseHand} title={t('agentView.askForHelp')} className="p-2 rounded-full text-amber-500 bg-amber-100 dark:bg-amber-900/50 hover:bg-amber-200 dark:hover:bg-amber-900"><span className="material-symbols-outlined">front_hand</span></button>}
                    <div className="relative"><button onClick={() => setIsAgentNotifOpen(p => !p)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"><span className="material-symbols-outlined">notifications</span>{agentNotifications.length > 0 && (<span className="absolute top-1 right-1 flex h-4 w-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-white text-xs items-center justify-center">{agentNotifications.length}</span></span>)}</button>{isAgentNotifOpen && (<div className="absolute right-0 mt-2 w-80 origin-top-right bg-white dark:bg-slate-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-20"><div className="p-3 border-b dark:border-slate-700 flex justify-between items-center"><h3 className="font-semibold text-slate-800 dark:text-slate-200">{t('agentView.messages')}</h3>{agentNotifications.length > 0 && <button onClick={() => setAgentNotifications([])} className="text-xs font-medium text-indigo-600 hover:underline">{t('agentView.clearAll')}</button>}</div><div className="max-h-96 overflow-y-auto">{agentNotifications.length === 0 ? (<p className="text-sm text-slate-500 text-center p-8">Aucun nouveau message.</p>) : (agentNotifications.map(notif => (<div key={String(notif.id)} className="p-3 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"><p className="text-sm text-slate-700 dark:text-slate-200"><span className="font-bold">{notif.from}:</span> {notif.message}</p><p className="text-xs text-slate-400 mt-1">{new Date(notif.timestamp).toLocaleString(language, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</p>{activeReplyId === notif.id ? (<form onSubmit={(e) => { e.preventDefault(); handleRespondToSupervisor(notif.id); }} className="mt-2 flex gap-2"><input type="text" value={replyText} onChange={e => setReplyText(e.target.value)} placeholder={t('agentView.yourResponsePlaceholder')} autoFocus className="w-full text-sm p-1.5 border rounded-md dark:bg-slate-900 dark:border-slate-600"/><button type="submit" className="text-sm bg-indigo-600 text-white px-3 rounded-md hover:bg-indigo-700">{t('common.send')}</button></form>) : (<button onClick={() => setActiveReplyId(notif.id)} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">{t('agentView.respond')}</button>)}</div>)))}</div></div>)}</div>
                    <LanguageSwitcher />
                    <ThemeSwitcher theme={theme} setTheme={setTheme} />
                    <button onClick={logout} className="font-semibold py-2 px-4 rounded-lg inline-flex items-center bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"><span className="material-symbols-outlined mr-2">power_settings_new</span> {t('sidebar.logout')}</button>
                </div>
            </header>
            
            <main className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
                <div className="col-span-3 flex flex-col gap-4">
                     <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border dark:border-slate-700 flex flex-col min-h-0"><h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 border-b dark:border-slate-600 pb-2 mb-4">{t('agentView.kpis.title')}</h2><div className="mb-4"><h3 className="text-base font-semibold text-slate-600 dark:text-slate-300">{t('agentView.kpis.title')}</h3>{agentState ? (<div className="grid grid-cols-2 gap-2 mt-2">
                        <KpiCard title={t('agentView.kpis.totalConnectedTime')} value={formatTimer(agentState.totalConnectedTime)} />
                        <KpiCard title="DMC" value={formatTimer(agentState.averageTalkTime)} />
                        <KpiCard title={t('agentView.kpis.callsHandled')} value={agentState.callsHandledToday} />
                        <KpiCard title={t('agentView.kpis.positiveQuals')} value={positiveQualificationsToday} />
                        <KpiCard title={t('agentView.kpis.totalPauseTime')} value={formatTimer(agentState.totalPauseTime)} />
                        <KpiCard title={t('agentView.kpis.pauseCount')} value={agentState.pauseCount} />
                        <KpiCard title={t('agentView.kpis.totalTrainingTime')} value={formatTimer(agentState.totalTrainingTime)} />
                        <KpiCard title={t('agentView.kpis.trainingCount')} value={agentState.trainingCount} />
                    </div>) : <p className="text-xs text-slate-400 italic mt-1">Chargement...</p>}</div>{(!currentContact && status === 'En Attente') && (<div className="flex-1 mt-auto pt-4 border-t dark:border-slate-600"><div className="h-full flex flex-col items-center justify-center text-center">{feedbackMessage ? (<p className="text-amber-600 font-semibold">{feedbackMessage}</p>) : (<><svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><p className="text-slate-500 dark:text-slate-400 mt-4">{isLoadingNextContact ? t('agentView.searching') : t('agentView.waitingForCall')}</p></>)}</div></div>)}</div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border dark:border-slate-700 flex-1 flex flex-col min-h-0"><div className="border-b dark:border-slate-600 pb-2 mb-2 flex items-center justify-between flex-shrink-0"><h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2"><span className="material-symbols-outlined text-2xl text-primary">phone_callback</span>{t('agentView.myCallbacks')}</h2><div className="flex items-center gap-2"><button onClick={() => handleCallbackDateChange(-1)} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"><span className="material-symbols-outlined">arrow_back</span></button><span className="font-semibold text-sm">{callbackViewDate.toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'long' })}</span><button onClick={() => handleCallbackDateChange(1)} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"><span className="material-symbols-outlined">arrow_forward</span></button></div><select value={callbackCampaignFilter} onChange={e => setCallbackCampaignFilter(e.target.value)} className="text-sm p-1 border bg-white dark:bg-slate-700 dark:border-slate-600 rounded-md"><option value="all">{t('agentView.callbacks.allCampaigns')}</option>{assignedCampaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div className="flex-1 overflow-y-auto pr-2 space-y-2 text-base">
                        {mySortedCallbacks.length > 0 ? (
                            mySortedCallbacks.map(cb => {
                                const scheduled = new Date(cb.scheduledTime);
                                const startOfDayForView = new Date(callbackViewDate);
                                startOfDayForView.setHours(0, 0, 0, 0);
                                const isOverdue = scheduled < startOfDayForView;

                                const campaignName = campaigns.find(c => c.id === cb.campaignId)?.name || 'Campagne inconnue';
                                
                                let itemClasses = 'w-full text-left p-3 rounded-md border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ';
                                if (isOverdue) {
                                    itemClasses += 'bg-red-50 dark:bg-rose-900 hover:bg-red-100 dark:hover:bg-rose-800 border-red-200 dark:border-rose-700';
                                } else {
                                    itemClasses += 'bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700';
                                }

                                return (
                                    <button key={cb.id} onClick={() => handleCallbackClick(cb)} disabled={status !== 'En Attente'} className={itemClasses}>
                                        <div className="flex justify-between items-baseline">
                                            <p className={`font-semibold text-slate-800 ${isOverdue ? 'dark:text-rose-100' : 'dark:text-slate-200'}`}>{cb.contactName}</p>
                                            {isOverdue && <span className="text-xs font-bold text-red-600 dark:text-red-300">{t('agentView.overdue')}</span>}
                                        </div>
                                        <p className={`text-xs text-slate-500 ${isOverdue ? 'dark:text-rose-200' : 'dark:text-slate-400'}`}>{campaignName}</p>
                                        <p className={`text-sm font-mono ${isOverdue ? 'text-rose-200' : 'text-slate-600 dark:text-slate-400'}`}>{cb.contactNumber}</p>
                                        <p className={`text-sm font-bold mt-1 ${isOverdue ? 'dark:text-white' : 'text-indigo-700 dark:text-indigo-400'}`}>{scheduled.toLocaleString(language)}</p>
                                    </button>
                                );
                            })
                        ) : (
                            <p className="text-sm text-slate-500 dark:text-slate-400 text-center pt-8 italic">{t('agentView.noCallbacks')}</p>
                        )}
                    </div></div>
                </div>
                <div className="col-span-9 flex flex-col bg-white dark:bg-slate-800 rounded-lg shadow-sm border dark:border-slate-700 overflow-hidden">
                    {status === 'En Post-Appel' ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8">
                            <svg className="animate-spin h-12 w-12 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            <h3 className="mt-4 text-xl font-semibold text-slate-700 dark:text-slate-200">Post-appel en cours...</h3>
                            <p className="mt-2 text-slate-500 dark:text-slate-400">Finalisation de la fiche, veuillez patienter.</p>
                            <div className="w-full bg-slate-200 rounded-full h-2.5 mt-6 dark:bg-slate-700">
                                <div 
                                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-1000 linear" 
                                    style={{ width: `${(agentState?.statusDuration || 0) / (campaignForWrapUp.current?.wrapUpTime || 1) * 100}%` }}
                                ></div>
                            </div>
                            <p className="mt-2 text-sm font-mono text-slate-500">{formatTimer(wrapUpRemaining)} / {formatTimer(wrapUpTotal)}</p>
                        </div>
                    ) : activeScript && currentContact ? (
                        <AgentPreview script={activeScript} onClose={() => {}} embedded={true} contact={currentContact} contactNotes={contactNotesForCurrentContact} users={users} newNote={newNote} setNewNote={setNewNote} onSaveNote={handleSaveNote} campaign={currentCampaign} onInsertContact={handleSaveNewContact} onUpdateContact={updateContact} onClearContact={handleClearContact} matchingQuota={matchingQuota} />
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400">
                            <p>{currentContact ? t('agentView.noScript') : t('agentView.scriptWillBeHere')}</p>
                        </div>
                    )}
                </div>
            </main>
            <CallControlBar 
                config={agentProfile?.callControlsConfig}
                status={status}
                currentContact={currentContact}
                selectedQual={selectedQual}
                dialOptions={{
                    isOpen: isDialOptionsOpen,
                    setIsOpen: setIsDialOptionsOpen,
                    options: allPhoneNumbers,
                    ref: dialOptionsRef
                }}
                onDial={handleDial}
                onEndCall={() => handleEndCall()}
                onQualify={() => setIsQualifyModalOpen(true)}
                onHold={() => alert('Hold action')}
                onTransfer={() => alert('Transfer action')}
                onSearch={() => setIsSearchModalOpen(true)}
                onInsert={handleInsertBlankRecord}
            />
        </div>
    );
};

export default AgentView;
