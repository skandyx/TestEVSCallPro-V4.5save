import React, { useState, useMemo, useEffect } from 'react';
import type { Feature, Site } from '../types.ts';
import { useI18n } from '../src/i18n/index.tsx';
import { useStore } from '../src/store/useStore.ts';
import { PlusIcon, EditIcon, TrashIcon, XMarkIcon, ArrowLeftIcon, ChevronDownIcon } from './Icons.tsx';

// --- Reusable Components ---
const ToggleSwitch: React.FC<{ enabled: boolean; onChange: (enabled: boolean) => void; }> = ({ enabled, onChange }) => (
    <button type="button" onClick={() => onChange(!enabled)} className={`${enabled ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-600'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out`} role="switch" aria-checked={enabled}>
        <span aria-hidden="true" className={`${enabled ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`} />
    </button>
);


// --- Modals ---
interface SiteModalProps {
    site: Partial<Site> | null;
    onSave: (site: Partial<Site>) => void;
    onClose: () => void;
}

const SiteModal: React.FC<SiteModalProps> = ({ site, onSave, onClose }) => {
    const { t } = useI18n();
    const [formData, setFormData] = useState<Partial<Site>>(
        site || { name: '', ipAddress: '', physicalExtensions: [] }
    );
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ ...site, ...formData });
    };

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg">
                <div className="p-6 border-b dark:border-slate-700">
                    <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">{site?.id ? t('siteManager.modal.editTitle') : t('siteManager.modal.newTitle')}</h3>
                </div>
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('siteManager.modal.siteName')}</label>
                        <input type="text" name="name" value={formData.name || ''} onChange={handleChange} required className="mt-1 block w-full p-2 border rounded-md dark:bg-slate-900 dark:border-slate-600"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('siteManager.modal.gatewayIpLabel')}</label>
                        <input type="text" name="ipAddress" value={formData.ipAddress || ''} onChange={handleChange} placeholder={t('siteManager.modal.gatewayIpPlaceholder')} className="mt-1 block w-full p-2 border rounded-md dark:bg-slate-900 dark:border-slate-600"/>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 px-4 py-3 sm:flex sm:flex-row-reverse rounded-b-lg flex-shrink-0 border-t dark:border-slate-700">
                    <button type="submit" className="inline-flex w-full justify-center rounded-md border bg-primary px-4 py-2 font-medium text-primary-text shadow-sm hover:bg-primary-hover sm:ml-3 sm:w-auto">{t('common.save')}</button>
                    <button type="button" onClick={onClose} className="mt-3 inline-flex w-full justify-center rounded-md border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 shadow-sm hover:bg-slate-50 sm:mt-0 sm:w-auto dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">{t('common.cancel')}</button>
                </div>
            </form>
        </div>
    );
};

interface AddExtensionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (number: string) => void;
    existingExtensions: string[];
}
const AddExtensionModal: React.FC<AddExtensionModalProps> = ({ isOpen, onClose, onAdd, existingExtensions }) => {
    const { t } = useI18n();
    const [number, setNumber] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (existingExtensions.includes(number)) {
            setError(t('siteManager.detail.addModal.duplicateError'));
            return;
        }
        onAdd(number);
        setNumber('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-[60]">
            <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-sm">
                <div className="p-6"><h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t('siteManager.detail.addModal.title')}</h3>
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('siteManager.detail.addModal.numberLabel')}</label>
                        <input type="number" value={number} onChange={e => setNumber(e.target.value)} required autoFocus className="mt-1 block w-full p-2 border rounded-md dark:bg-slate-900 dark:border-slate-600"/>
                        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 px-4 py-3 flex justify-end gap-2"><button type="button" onClick={onClose} className="border border-slate-300 bg-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">{t('common.cancel')}</button><button type="submit" className="bg-primary text-primary-text px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-hover">{t('common.add')}</button></div>
            </form>
        </div>
    );
};

interface BulkGenerateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (from: number, to: number) => void;
}
const BulkGenerateModal: React.FC<BulkGenerateModalProps> = ({ isOpen, onClose, onGenerate }) => {
    const { t } = useI18n();
    const [from, setFrom] = useState(100);
    const [to, setTo] = useState(199);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (from >= to) { alert(t('siteManager.detail.generateModal.rangeError')); return; }
        if (to - from > 99) { alert(t('siteManager.detail.generateModal.limitError')); return; }
        onGenerate(from, to);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-[60]">
            <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-sm">
                <div className="p-6"><h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t('siteManager.detail.generateModal.title')}</h3>
                    <div className="mt-4 grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('siteManager.detail.generateModal.from')}</label>
                            <input type="number" value={from} onChange={e => setFrom(parseInt(e.target.value, 10) || 0)} required className="mt-1 block w-full p-2 border rounded-md dark:bg-slate-900 dark:border-slate-600"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('siteManager.detail.generateModal.to')}</label>
                            <input type="number" value={to} onChange={e => setTo(parseInt(e.target.value, 10) || 0)} required min={from + 1} className="mt-1 block w-full p-2 border rounded-md dark:bg-slate-900 dark:border-slate-600"/>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 px-4 py-3 flex justify-end gap-2"><button type="button" onClick={onClose} className="border border-slate-300 bg-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">{t('common.cancel')}</button><button type="submit" className="bg-primary text-primary-text px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-hover">{t('userManager.generateModal.confirm')}</button></div>
            </form>
        </div>
    );
};

const SiteManager: React.FC<{ feature: Feature }> = ({ feature }) => {
    const { t } = useI18n();
    const { sites, users, saveOrUpdate, delete: deleteSite } = useStore(state => ({
        sites: state.sites,
        users: state.users,
        saveOrUpdate: state.saveOrUpdate,
        delete: state.delete,
    }));
    
    const [view, setView] = useState<'list' | 'detail'>('list');
    const [selectedSite, setSelectedSite] = useState<Site | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingSite, setEditingSite] = useState<Site | null>(null);

    useEffect(() => {
        if (selectedSite) {
            const updatedSite = sites.find(s => s.id === selectedSite.id);
            if (updatedSite && JSON.stringify(updatedSite) !== JSON.stringify(selectedSite)) {
                setSelectedSite(updatedSite);
            }
        }
    }, [sites, selectedSite]);

    const handleSave = (siteData: Partial<Site>) => {
        const dataToSave = { ...siteData };
        if (!dataToSave.id) dataToSave.id = `site-${Date.now()}`;
        saveOrUpdate('sites', dataToSave);
        setIsCreateModalOpen(false);
        setEditingSite(null);
    };
    
    const handleDelete = (siteId: string) => {
        const agentCount = users.filter(u => u.siteId === siteId).length;
        if (agentCount > 0) {
            alert(t('siteManager.deleteDisabledTooltip'));
            return;
        }
        if (window.confirm(t('siteManager.deleteConfirm'))) {
            deleteSite('sites', siteId);
            if (selectedSite?.id === siteId) {
                setView('list');
                setSelectedSite(null);
            }
        }
    };
    
    const handleShowDetail = (site: Site) => {
        setSelectedSite(site);
        setView('detail');
    };

    if (view === 'detail' && selectedSite) {
        return <SiteDetailView site={selectedSite} onBack={() => setView('list')} onSave={handleSave} />;
    }

    return (
        <div className="h-full flex flex-col">
            {isCreateModalOpen && <SiteModal site={null} onSave={handleSave} onClose={() => setIsCreateModalOpen(false)} />}
            {editingSite && <SiteModal site={editingSite} onSave={handleSave} onClose={() => setEditingSite(null)} />}

            <div className="flex-shrink-0">
                <header className="mb-8">
                    <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{t(feature.titleKey)}</h1>
                    <p className="mt-2 text-lg text-slate-600 dark:text-slate-400">{t(feature.descriptionKey)}</p>
                </header>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-t-lg shadow-sm border-x border-t border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-semibold">{t('siteManager.title')}</h2>
                        <button onClick={() => setIsCreateModalOpen(true)} className="bg-primary hover:bg-primary-hover text-primary-text font-bold py-2 px-4 rounded-lg shadow-md inline-flex items-center">
                            <PlusIcon className="w-5 h-5 mr-2" /> {t('siteManager.addSite')}
                        </button>
                    </div>
                </div>
            </div>
            
            <div className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-slate-800 rounded-b-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{t('siteManager.headers.name')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{t('siteManager.headers.gatewayIp')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{t('siteManager.headers.extensions')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{t('siteManager.headers.directMedia')}</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{t('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                        {sites.map(site => {
                            const agentCount = users.filter(u => u.siteId === site.id).length;
                            return (
                                <tr key={site.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <button onClick={() => handleShowDetail(site)} className="font-medium text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">{site.name}</button>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">{site.ipAddress || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">{site.physicalExtensions?.length || 0}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <ToggleSwitch enabled={!!site.directMediaEnabled} onChange={(enabled) => handleSave({ ...site, directMediaEnabled: enabled })} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                        <button onClick={() => setEditingSite(site)} className="text-link hover:underline inline-flex items-center"><EditIcon className="w-4 h-4 mr-1"/>{t('common.edit')}</button>
                                        <button onClick={() => handleDelete(site.id)} disabled={agentCount > 0} title={agentCount > 0 ? t('siteManager.deleteDisabledTooltip') : t('common.delete')} className="text-red-600 hover:text-red-900 dark:hover:text-red-400 inline-flex items-center disabled:text-slate-400 disabled:cursor-not-allowed">
                                            <TrashIcon className="w-4 h-4 mr-1"/>{t('common.delete')}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- Site Detail View Component ---

type ExtSortKeys = 'number' | 'directMediaEnabled';

const SiteDetailView: React.FC<{ site: Site, onBack: () => void, onSave: (site: Partial<Site>) => void }> = ({ site, onBack, onSave }) => {
    const { t } = useI18n();
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: ExtSortKeys; direction: 'ascending' | 'descending' }>({ key: 'number', direction: 'ascending' });
    const [selectedExtensions, setSelectedExtensions] = useState<string[]>([]);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

    const filteredAndSortedExtensions = useMemo(() => {
        let extensions = [...(site.physicalExtensions || [])];
        if (searchTerm) extensions = extensions.filter(ext => ext.number.includes(searchTerm));
        extensions.sort((a, b) => {
            if (sortConfig.key === 'number') {
                const comparison = a.number.localeCompare(b.number, undefined, { numeric: true });
                return sortConfig.direction === 'ascending' ? comparison : -comparison;
            }
            if (sortConfig.key === 'directMediaEnabled') {
                const aValue = a.directMediaEnabled ?? false;
                const bValue = b.directMediaEnabled ?? false;
                if (aValue === bValue) return 0;
                return (sortConfig.direction === 'ascending' ? aValue > bValue : aValue < bValue) ? -1 : 1;
            }
            return 0;
        });
        return extensions;
    }, [site.physicalExtensions, searchTerm, sortConfig]);
    
    const requestSort = (key: ExtSortKeys) => {
        setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending' }));
    };

    const handleExtensionChange = (number: string, field: 'directMediaEnabled', value: boolean) => {
        const updatedExtensions = site.physicalExtensions?.map(ext => ext.number === number ? { ...ext, [field]: value } : ext);
        onSave({ ...site, physicalExtensions: updatedExtensions });
    };

    const handleMasterDirectMediaToggle = (enabled: boolean) => {
        const updatedExtensions = site.physicalExtensions?.map(ext => ({
            ...ext,
            directMediaEnabled: enabled
        }));
        onSave({ ...site, directMediaEnabled: enabled, physicalExtensions: updatedExtensions });
    };
    
    const handleSelect = (number: string, checked: boolean) => {
        setSelectedExtensions(prev => checked ? [...prev, number] : prev.filter(n => n !== number));
    };

    const handleSelectAll = (checked: boolean) => {
        setSelectedExtensions(checked ? filteredAndSortedExtensions.map(e => e.number) : []);
    };
    
    const handleDeleteSelected = () => {
        if (selectedExtensions.length === 0) return;
        if (window.confirm(t('siteManager.detail.confirmDeleteSelected', { count: selectedExtensions.length }))) {
            const updatedExtensions = site.physicalExtensions?.filter(ext => !selectedExtensions.includes(ext.number));
            onSave({ ...site, physicalExtensions: updatedExtensions });
            setSelectedExtensions([]);
        }
    };
    
    const handleAddExtension = (number: string) => {
        const newExtension = { number, directMediaEnabled: site.directMediaEnabled || false };
        const updatedExtensions = [...(site.physicalExtensions || []), newExtension];
        onSave({ ...site, physicalExtensions: updatedExtensions });
    };
    
    const handleBulkGenerate = (from: number, to: number) => {
        const newExtensions = [];
        const existingNumbers = new Set(site.physicalExtensions?.map(e => e.number) || []);
        for (let i = from; i <= to; i++) {
            const num = String(i);
            if (!existingNumbers.has(num)) {
                newExtensions.push({ number: num, directMediaEnabled: site.directMediaEnabled || false });
            }
        }
        if (newExtensions.length > 0) {
            const updatedExtensions = [...(site.physicalExtensions || []), ...newExtensions];
            onSave({ ...site, physicalExtensions: updatedExtensions });
        }
        alert(t('siteManager.detail.generateModal.generatedMessage', { count: newExtensions.length }));
    };

    const SortableHeader: React.FC<{ sortKey: ExtSortKeys, label: string }> = ({ sortKey, label }) => (
        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
            <button onClick={() => requestSort(sortKey)} className="group inline-flex items-center gap-1">{label}
                <ChevronDownIcon className={`w-4 h-4 transition-transform ${sortConfig.key === sortKey && sortConfig.direction === 'descending' ? 'rotate-180' : ''}`}/>
            </button>
        </th>
    );

    return (
        <div className="h-full flex flex-col">
            <AddExtensionModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onAdd={handleAddExtension} existingExtensions={site.physicalExtensions?.map(e => e.number) || []} />
            <BulkGenerateModal isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} onGenerate={handleBulkGenerate} />

            <div className="flex-shrink-0">
                <header className="mb-6">
                    <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 mb-2"><ArrowLeftIcon className="w-5 h-5"/> {t('siteManager.backToList')}</button>
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{site.name}</h1>
                            <p className="mt-1 text-lg text-slate-600 dark:text-slate-400">{t('siteManager.detail.description')}</p>
                        </div>
                         <div className="flex items-center gap-4 p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
                            <label className="font-semibold text-slate-800 dark:text-slate-200">{t('siteManager.headers.directMedia')} (Tous)</label>
                            <ToggleSwitch enabled={!!site.directMediaEnabled} onChange={handleMasterDirectMediaToggle} />
                        </div>
                    </div>
                </header>
                 <div className="bg-white dark:bg-slate-800 p-6 rounded-t-lg shadow-sm border-x border-t border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-4">
                        <input type="search" placeholder={t('siteManager.detail.searchPlaceholder')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full max-w-sm p-2 border rounded-md dark:bg-slate-900 dark:border-slate-600"/>
                        <div className="flex gap-2">
                            {selectedExtensions.length > 0 && <button onClick={handleDeleteSelected} className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 font-bold py-2 px-4 rounded-lg inline-flex items-center gap-2"><TrashIcon className="w-5 h-5"/>{t('siteManager.detail.deleteSelected', { count: selectedExtensions.length })}</button>}
                            <button onClick={() => setIsBulkModalOpen(true)} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg shadow-sm dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">{t('siteManager.detail.bulkGenerate')}</button>
                            <button onClick={() => setIsAddModalOpen(true)} className="bg-primary hover:bg-primary-hover text-primary-text font-bold py-2 px-4 rounded-lg shadow-md inline-flex items-center"><PlusIcon className="w-5 h-5 mr-2" />{t('siteManager.detail.addExtension')}</button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-slate-800 rounded-b-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0 z-10">
                        <tr>
                            <th className="p-4 w-4"><input type="checkbox" onChange={e => handleSelectAll(e.target.checked)} checked={filteredAndSortedExtensions.length > 0 && selectedExtensions.length === filteredAndSortedExtensions.length} className="h-4 w-4 rounded" /></th>
                            <SortableHeader sortKey="number" label="Extension"/>
                            <SortableHeader sortKey="directMediaEnabled" label={t('siteManager.headers.directMedia')}/>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{t('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                        {filteredAndSortedExtensions.map(ext => (
                            <tr key={ext.number}>
                                <td className="p-4 w-4"><input type="checkbox" checked={selectedExtensions.includes(ext.number)} onChange={e => handleSelect(ext.number, e.target.checked)} className="h-4 w-4 rounded"/></td>
                                <td className="px-6 py-4 font-mono">{ext.number}</td>
                                <td className="px-6 py-4"><ToggleSwitch enabled={!!ext.directMediaEnabled} onChange={(enabled) => handleExtensionChange(ext.number, 'directMediaEnabled', enabled)} /></td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button disabled className="p-2 text-slate-300 dark:text-slate-600 cursor-not-allowed"><EditIcon className="w-5 h-5"/></button>
                                    <button onClick={() => onSave({ ...site, physicalExtensions: site.physicalExtensions?.filter(e => e.number !== ext.number) })} className="p-2 text-slate-500 hover:text-red-600 dark:hover:text-red-400"><TrashIcon className="w-5 h-5"/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SiteManager;
