import React, { useState, useMemo } from 'react';
import type { Contact, Campaign } from '../types.ts';
import { useI18n } from '../src/i18n/index.tsx';

interface ContactSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    campaigns: Campaign[];
    onSelectContact: (contact: Contact, campaign: Campaign) => void;
}

const ContactSearchModal: React.FC<ContactSearchModalProps> = ({ isOpen, onClose, campaigns, onSelectContact }) => {
    const { t } = useI18n();
    const [searchTerm, setSearchTerm] = useState('');

    const allContacts = useMemo(() => {
        return campaigns.flatMap(campaign => 
            campaign.contacts.map(contact => ({ ...contact, campaignName: campaign.name, campaignId: campaign.id }))
        );
    }, [campaigns]);

    const filteredContacts = useMemo(() => {
        if (!searchTerm) {
            return [];
        }
        const term = searchTerm.toLowerCase();
        return allContacts.filter(c => 
            c.firstName.toLowerCase().includes(term) ||
            c.lastName.toLowerCase().includes(term) ||
            c.phoneNumber.includes(term)
        ).slice(0, 50); // Limit to 50 results for performance
    }, [searchTerm, allContacts]);

    const handleSelect = (contact: Contact) => {
        const campaign = campaigns.find(c => c.id === (contact as any).campaignId);
        if (campaign) {
            onSelectContact(contact, campaign);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-50" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col h-[70vh]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b dark:border-slate-700">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Rechercher un Contact</h3>
                    <input
                        type="search"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Taper un nom, prénom ou numéro..."
                        className="mt-2 w-full p-2 border rounded-md dark:bg-slate-900 dark:border-slate-600"
                        autoFocus
                    />
                </div>
                <div className="flex-1 overflow-y-auto">
                    {filteredContacts.length > 0 ? (
                        <ul className="divide-y dark:divide-slate-700">
                            {filteredContacts.map(contact => (
                                <li key={contact.id}>
                                    <button onClick={() => handleSelect(contact)} className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-700">
                                        <p className="font-medium text-slate-800 dark:text-slate-200">{contact.firstName} {contact.lastName}</p>
                                        <div className="flex justify-between items-center text-sm text-slate-500 dark:text-slate-400">
                                            <span>{contact.phoneNumber}</span>
                                            <span className="text-xs bg-slate-100 dark:bg-slate-600 px-2 py-0.5 rounded-full">{(contact as any).campaignName}</span>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-slate-400 p-8 italic">
                            {searchTerm ? "Aucun contact trouvé." : "Commencez à taper pour rechercher."}
                        </p>
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

export default ContactSearchModal;
