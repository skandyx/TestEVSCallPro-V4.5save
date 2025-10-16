import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Feature, CallHistoryRecord, User, Campaign, Qualification, AgentSession, UserGroup, Site } from '../types.ts';
import { useStore } from '../src/store/useStore.ts';
import { useI18n } from '../src/i18n/index.tsx';
import { ArrowLeftIcon, ArrowRightIcon } from './Icons.tsx';
import { amiriFontBase64 } from '../src/assets/Amiri-Regular.ts';
import html2canvas from 'html2canvas';


// Déclaration pour les bibliothèques globales chargées via CDN
declare var Chart: any;
declare var jspdf: any;

const formatDuration = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0h 0m 0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    return `${h}h ${m}m ${s}s`;
};

const KpiCard: React.FC<{ title: string; value: string | number }> = ({ title, value }) => (
    <div className="bg-white dark:bg-slate-800/50 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
);

const ChartComponent: React.FC<{ id: string; type: any; data: any; options: any; }> = ({ id, type, data, options }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<any>(null);

    useEffect(() => {
        if (canvasRef.current && typeof Chart !== 'undefined') {
            if (chartRef.current) {
                chartRef.current.destroy();
            }
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                chartRef.current = new Chart(ctx, { type, data, options });
            }
        }
        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
            }
        };
    }, [type, data, options]);

    return <canvas ref={canvasRef} id={id}></canvas>;
};

const ReportingDashboard: React.FC<{ feature: Feature }> = ({ feature }) => {
    const { t } = useI18n();
    const { callHistory, users, campaigns, qualifications, agentSessions, userGroups, sites } = useStore(state => ({
        callHistory: state.callHistory,
        users: state.users,
        campaigns: state.campaigns,
        qualifications: state.qualifications,
        agentSessions: state.agentSessions,
        userGroups: state.userGroups,
        sites: state.sites,
    }));
    
    const [activeTab, setActiveTab] = useState('charts');
    const [historyPage, setHistoryPage] = useState(1);
    const historyRecordsPerPage = 25;
    
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    const [filters, setFilters] = useState({
        dateRange: 'last7days',
        startDate: sevenDaysAgo.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
        campaignId: 'all',
        agentId: 'all',
    });

    const handleDateRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const range = e.target.value;
        const newEndDate = new Date();
        let newStartDate = new Date();
        if (range === 'last7days') newStartDate.setDate(newEndDate.getDate() - 7);
        if (range === 'last30days') newStartDate.setDate(newEndDate.getDate() - 30);
        if (range === 'thisMonth') newStartDate.setDate(1);

        setFilters(f => ({ 
            ...f, 
            dateRange: range,
            startDate: newStartDate.toISOString().split('T')[0],
            endDate: newEndDate.toISOString().split('T')[0]
        }));
        setHistoryPage(1);
    };

    const getDateFilterRange = () => {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    };

    const filteredHistory = useMemo(() => {
        const { start, end } = getDateFilterRange();
        
        return callHistory.filter(record => {
            const recordDate = new Date(record.startTime);
            return recordDate >= start && recordDate <= end &&
                   (filters.agentId === 'all' || record.agentId === filters.agentId) &&
                   (filters.campaignId === 'all' || record.campaignId === filters.campaignId);
        });
    }, [callHistory, filters]);

    const findEntityName = (id: string | null, collection: any[], key: string = 'name') => {
        if (!id) return 'N/A';
        const item = collection.find(c => c.id === id);
        return item ? (item[key] || `${item.firstName} ${item.lastName}`) : 'N/A';
    };

    const kpis = useMemo(() => {
        const totalCalls = filteredHistory.length;
        const totalDuration = filteredHistory.reduce((sum, call) => sum + call.duration, 0);
        const positiveCalls = filteredHistory.filter(call => {
            const qual = qualifications.find(q => q.id === call.qualificationId);
            return qual?.type === 'positive';
        }).length;
        
        return {
            processedCalls: totalCalls,
            totalTalkTime: formatDuration(totalDuration),
            avgCallDuration: totalCalls > 0 ? formatDuration(totalDuration / totalCalls) : '0h 0m 0s',
            successRate: totalCalls > 0 ? `${((positiveCalls / totalCalls) * 100).toFixed(1)}%` : '0.0%',
            occupancyRate: '75.3%', // Simulé
        };
    }, [filteredHistory, qualifications]);
    
    const isDarkMode = document.documentElement.classList.contains('dark');
    const commonChartOptions = useMemo(() => ({
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: isDarkMode ? '#cbd5e1' : '#475569' } } },
        scales: {
            x: { ticks: { color: isDarkMode ? '#cbd5e1' : '#475569' }, grid: { color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' } },
            y: { beginAtZero: true, ticks: { color: isDarkMode ? '#cbd5e1' : '#475569' }, grid: { color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' } }
        }
    }), [isDarkMode]);

    const callsByCampaignData = useMemo(() => {
        const counts = filteredHistory.reduce((acc, call) => {
            const campaignName = campaigns.find(c => c.id === call.campaignId)?.name || 'Inconnu';
            acc[campaignName] = (acc[campaignName] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        const campaignNames = Object.keys(counts).sort();

        return {
            datasets: [{
                tree: Object.entries(counts).map(([name, value]) => ({ name, value })),
                key: 'value',
                spacing: 1, borderWidth: 1, borderColor: 'white',
                backgroundColor: (ctx: any) => {
                    if (ctx.type !== 'data' || !ctx.raw?._data) {
                        return 'transparent';
                    }
                    const TREEMAP_COLORS = [
                      '#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#3b82f6', '#fbbf24', '#34d399', '#f87171', '#a78bfa'
                    ];
                    const campaignName = ctx.raw._data.name;
                    const index = campaignNames.indexOf(campaignName);
                    if (index === -1) return '#ccc';
                    return TREEMAP_COLORS[index % TREEMAP_COLORS.length];
                },
                labels: { display: true, color: 'white', font: { size: 12 }, formatter: (ctx: any) => ctx.raw?._data.name },
            }]
        };
    }, [filteredHistory, campaigns]);

    const successByHourData = useMemo(() => {
        const hours = Array(24).fill(0);
        filteredHistory.forEach(call => {
            if (qualifications.find(q => q.id === call.qualificationId)?.type === 'positive') {
                hours[new Date(call.startTime).getHours()]++;
            }
        });
        return {
            labels: Array.from({ length: 24 }, (_, i) => `${i}h`),
            datasets: [{ label: t('reporting.charts.conversionsLabel'), data: hours, backgroundColor: 'rgba(79, 70, 229, 0.7)' }]
        };
    }, [filteredHistory, qualifications, t]);

    const successByAgentData = useMemo(() => {
        const agentStats = filteredHistory.reduce<Record<string, { name: string; calls: number; successes: number }>>((acc, call) => {
            if (!acc[call.agentId]) {
                const agent = users.find(u => u.id === call.agentId);
                acc[call.agentId] = { name: agent ? `${agent.firstName} ${agent.lastName}` : 'Inconnu', calls: 0, successes: 0 };
            }
            acc[call.agentId].calls++;
            if (qualifications.find(q => q.id === call.qualificationId)?.type === 'positive') {
                acc[call.agentId].successes++;
            }
            return acc;
        }, {});
        const data = Object.values(agentStats).map((s: { name: string; calls: number; successes: number; }) => s.calls > 0 ? (s.successes / s.calls) * 100 : 0);
        return {
            labels: Object.values(agentStats).map((s: { name: string; calls: number; successes: number; }) => s.name),
            datasets: [{ label: t('reporting.charts.successRateLabel'), data, backgroundColor: 'rgba(22, 163, 74, 0.7)' }]
        };
    }, [filteredHistory, users, qualifications, t]);
    
    const adherenceData = useMemo(() => {
        const agentsInHistory = [...new Set(filteredHistory.map(c => c.agentId))];
        const agentLabels = agentsInHistory.map(id => users.find(u => u.id === id)?.lastName || `Agent ${id}`);
        const data = agentsInHistory.map(() => Math.floor(Math.random() * 600)); // Random data up to 600
         return {
            labels: agentLabels,
            datasets: [{ label: t('reporting.charts.avgAdherenceLabel'), data: data, backgroundColor: 'rgba(249, 115, 22, 0.7)' }]
        };
    }, [filteredHistory, users, t]);
    
    const campaignPerfData = useMemo(() => {
        const statsByCampaign = filteredHistory.reduce<Record<string, { id: string; calls: number; totalDuration: number; successes: number }>>((acc, call) => {
            const campaignId = call.campaignId || 'inbound';
            if (!acc[campaignId]) acc[campaignId] = { id: campaignId, calls: 0, totalDuration: 0, successes: 0 };
            acc[campaignId].calls++;
            acc[campaignId].totalDuration += call.duration;
            if (qualifications.find(q => q.id === call.qualificationId)?.type === 'positive') acc[campaignId].successes++;
            return acc;
        }, {});

        return Object.values(statsByCampaign).map(stat => ({
            ...stat,
            name: findEntityName(stat.id, campaigns) || t('reporting.inboundCalls'),
            avgDuration: stat.calls > 0 ? stat.totalDuration / stat.calls : 0,
            successRate: stat.calls > 0 ? (stat.successes / stat.calls) * 100 : 0
        })).sort((a,b) => b.calls - a.calls);
    }, [filteredHistory, campaigns, qualifications, t]);

    const agentPerfDataCalls = useMemo(() => {
        const statsByAgent = filteredHistory.reduce<Record<string, { agentId: string; calls: number; totalDuration: number; successes: number }>>((acc, call) => {
            if (!acc[call.agentId]) {
                const agent = users.find(u => u.id === call.agentId);
                acc[call.agentId] = { agentId: call.agentId, calls: 0, totalDuration: 0, successes: 0 };
            }
            acc[call.agentId].calls++;
            acc[call.agentId].totalDuration += call.duration;
            if (qualifications.find(q => q.id === call.qualificationId)?.type === 'positive') {
                acc[call.agentId].successes++;
            }
            return acc;
        }, {});
        return Object.values(statsByAgent).map((stat: { agentId: string; calls: number; totalDuration: number; successes: number; }) => ({
            ...stat,
            name: findEntityName(stat.agentId, users),
            avgDuration: stat.calls > 0 ? stat.totalDuration / stat.calls : 0,
            successRate: stat.calls > 0 ? (stat.successes / stat.calls) * 100 : 0
        })).sort((a,b) => b.calls - a.calls);
    }, [filteredHistory, users, qualifications]);

    const groupPerfData = useMemo(() => {
        const statsByGroup = userGroups.map(group => {
            const memberIds = new Set(group.memberIds);
            const agentStatsForGroup = agentPerfDataCalls.filter(stat => memberIds.has(stat.agentId));
            const calls = agentStatsForGroup.reduce((sum, stat) => sum + stat.calls, 0);
            const totalDuration = agentStatsForGroup.reduce((sum, stat) => sum + stat.totalDuration, 0);
            const successes = agentStatsForGroup.reduce((sum, stat) => sum + stat.successes, 0);
            return {
                id: group.id,
                name: group.name,
                calls,
                totalDuration,
                avgDuration: calls > 0 ? totalDuration / calls : 0,
                successRate: calls > 0 ? (successes / calls) * 100 : 0,
            };
        });
        return statsByGroup.filter(g => g.calls > 0).sort((a, b) => b.calls - a.calls);
    }, [userGroups, agentPerfDataCalls]);

    const sitePerfData = useMemo(() => {
        const agentSiteMap = new Map(users.map(u => [u.id, u.siteId]));
        const statsBySite = agentPerfDataCalls.reduce<Record<string, { id: string, name: string, calls: number, totalDuration: number, successes: number }>>((acc, stat) => {
            const siteId = agentSiteMap.get(stat.agentId) || 'no-site';
            if (!acc[siteId]) acc[siteId] = { id: siteId, name: findEntityName(siteId, sites) || t('supervision.siteBoard.noSite'), calls: 0, totalDuration: 0, successes: 0 };
            acc[siteId].calls += stat.calls;
            acc[siteId].totalDuration += stat.totalDuration;
            acc[siteId].successes += stat.successes;
            return acc;
        }, {});
        return Object.values(statsBySite).map((stat: { id: string, name: string, calls: number, totalDuration: number, successes: number }) => ({
            ...stat,
            avgDuration: stat.calls > 0 ? stat.totalDuration / stat.calls : 0,
            successRate: stat.calls > 0 ? (stat.successes / stat.calls) * 100 : 0,
        })).sort((a,b) => b.calls - a.calls);
    }, [users, sites, agentPerfDataCalls, t]);
    
    const timesheetData = useMemo(() => {
        const { start, end } = getDateFilterRange();
        const filteredSessions = agentSessions.filter(s => new Date(s.loginTime) <= end && (!s.logoutTime || new Date(s.logoutTime) >= start));

        const sessionsByAgentDay = filteredSessions.reduce<Record<string, { agentId: string; date: Date; sessions: AgentSession[] }>>((acc, session: AgentSession) => {
            if (filters.agentId !== 'all' && session.agentId !== filters.agentId) return acc;
            const key = `${session.agentId}-${new Date(session.loginTime).toDateString()}`;
            if (!acc[key]) acc[key] = { agentId: session.agentId, date: new Date(session.loginTime), sessions: [] };
            acc[key].sessions.push(session);
            return acc;
        }, {});

        return Object.values(sessionsByAgentDay).map((group: { agentId: string; date: Date; sessions: AgentSession[] }) => {
            const firstLogin = new Date(Math.min(...group.sessions.map(s => new Date(s.loginTime).getTime())));
            const lastLogout = group.sessions.every(s => s.logoutTime) ? new Date(Math.max(...group.sessions.map(s => new Date(s.logoutTime!).getTime()))) : null;
            const totalDuration = group.sessions.reduce((sum, s) => s.logoutTime ? sum + (new Date(s.logoutTime).getTime() - new Date(s.loginTime).getTime()) : sum, 0) / 1000;
            return {
                agentId: group.agentId,
                agentName: findEntityName(group.agentId, users),
                date: group.date,
                firstLogin,
                lastLogout,
                totalDuration,
                adherence: 'N/A' // Placeholder
            };
        }).sort((a,b) => b.date.getTime() - a.date.getTime() || a.agentName.localeCompare(a.agentName));
    }, [agentSessions, users, filters]);
    
    const paginatedCallHistory = useMemo(() => {
        const start = (historyPage - 1) * historyRecordsPerPage;
        return filteredHistory.slice(start, start + historyRecordsPerPage);
    }, [filteredHistory, historyPage]);
    const totalHistoryPages = Math.ceil(filteredHistory.length / historyRecordsPerPage);


    const handleExportPdf = async () => {
        const { jsPDF } = jspdf;
        const doc = new jsPDF('p', 'pt', 'a4');
        
        if (amiriFontBase64) {
            try {
                doc.addFileToVFS('Amiri-Regular.ttf', amiriFontBase64);
                doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
                doc.setFont('Amiri');
            } catch (e) {
                console.error("Failed to load custom font, falling back to helvetica.", e);
                doc.setFont('helvetica');
            }
        } else {
            doc.setFont('helvetica');
        }
        
        doc.text(t('reporting.pdf.title'), 40, 40);
        
        const kpiTableData = [[kpis.processedCalls, kpis.totalTalkTime, kpis.avgCallDuration, kpis.successRate, kpis.occupancyRate]];
        
        (doc as any).autoTable({
            startY: 60,
            head: [[t('reporting.kpis.processedCalls'), t('reporting.kpis.totalTalkTime'), t('reporting.kpis.avgCallDuration'), t('reporting.kpis.successRate'), t('reporting.kpis.occupancyRate')]],
            body: kpiTableData,
            styles: { halign: 'center', font: doc.getFont().fontName },
            headStyles: { fontStyle: 'bold', font: doc.getFont().fontName }
        });

        const addPageIfNeeded = (currentY: number, requiredHeight: number) => {
            if (currentY + requiredHeight > doc.internal.pageSize.height) {
                doc.addPage();
                return 40; // Start Y on new page
            }
            return currentY;
        };

        let lastY = (doc as any).lastAutoTable.finalY || 100;

        const chartElements = [
            { id: 'treemapChart', title: t('reporting.charts.callsByCampaignTitle') },
            { id: 'successByHourChart', title: t('reporting.charts.successByHourTitle') },
            { id: 'successByAgentChart', title: t('reporting.charts.successByAgentTitle') },
            { id: 'adherenceChart', title: t('reporting.charts.adherenceByAgentTitle') },
        ];
        
        doc.addPage();
        lastY = 40;
        doc.setFontSize(14);
        doc.text(t('reporting.pdf.chartsTitle'), 40, lastY);
        lastY += 20;

        for (let i = 0; i < chartElements.length; i++) {
            const chartInfo = chartElements[i];
            const chartEl = document.getElementById(chartInfo.id)?.parentElement;
            if (chartEl) {
                const canvas = await html2canvas(chartEl, { scale: 2 });
                const imgData = canvas.toDataURL('image/png');
                const imgProps = doc.getImageProperties(imgData);
                const pdfWidth = doc.internal.pageSize.getWidth() - 80;
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                lastY = addPageIfNeeded(lastY, pdfHeight + 40);
                doc.setFontSize(12);
                doc.text(chartInfo.title, 40, lastY);
                lastY += 15;
                doc.addImage(imgData, 'PNG', 40, lastY, pdfWidth, pdfHeight);
                lastY += pdfHeight + 20;
            }
        }


        const addTableToPdf = (title: string, head: string[][], body: any[][]) => {
            lastY = addPageIfNeeded(lastY, 80); // Estimate space for title + table head
            doc.setFontSize(14);
            doc.text(title, 40, lastY);
            (doc as any).autoTable({
                startY: lastY + 10,
                head,
                body,
                styles: { font: doc.getFont().fontName },
                headStyles: { fontStyle: 'bold', font: doc.getFont().fontName },
                didDrawPage: (data: any) => { lastY = data.cursor.y; }
            });
            lastY = (doc as any).lastAutoTable.finalY;
        };
        
        addTableToPdf(
            t('reporting.tables.campaignPerf.title'),
            [[t('reporting.tables.campaignPerf.headers.campaign'), t('reporting.tables.campaignPerf.headers.calls'), t('reporting.tables.campaignPerf.headers.totalDuration'), t('reporting.tables.campaignPerf.headers.avgDuration'), t('reporting.tables.campaignPerf.headers.successRate')]],
            campaignPerfData.map(c => [c.name, c.calls, formatDuration(c.totalDuration), formatDuration(c.avgDuration), `${c.successRate.toFixed(1)}%`])
        );
        addTableToPdf(
            t('reporting.tables.agentPerf.titleCalls'),
            [[t('reporting.tables.agentPerf.headers.agent'), t('reporting.tables.agentPerf.headers.calls'), t('reporting.tables.agentPerf.headers.totalDuration'), t('reporting.tables.agentPerf.headers.avgDuration'), t('reporting.tables.agentPerf.headers.successRate')]],
            agentPerfDataCalls.map(a => [a.name, a.calls, formatDuration(a.totalDuration), formatDuration(a.avgDuration), `${a.successRate.toFixed(1)}%`])
        );
         addTableToPdf(
            t('reporting.tables.groupPerf.title'),
            [[t('reporting.tables.groupPerf.headers.group'), t('reporting.tables.agentPerf.headers.calls'), t('reporting.tables.agentPerf.headers.totalDuration'), t('reporting.tables.agentPerf.headers.avgDuration'), t('reporting.tables.agentPerf.headers.successRate')]],
            groupPerfData.map(g => [g.name, g.calls, formatDuration(g.totalDuration), formatDuration(g.avgDuration), `${g.successRate.toFixed(1)}%`])
        );
        addTableToPdf(
            t('reporting.tables.sitePerf.title'),
            [[t('reporting.tables.sitePerf.headers.site'), t('reporting.tables.agentPerf.headers.calls'), t('reporting.tables.agentPerf.headers.totalDuration'), t('reporting.tables.agentPerf.headers.avgDuration'), t('reporting.tables.agentPerf.headers.successRate')]],
            sitePerfData.map(s => [s.name, s.calls, formatDuration(s.totalDuration), formatDuration(s.avgDuration), `${s.successRate.toFixed(1)}%`])
        );
        addTableToPdf(
            t('reporting.tables.timesheet.title'),
            [[t('reporting.tables.timesheet.headers.date'), t('reporting.tables.timesheet.headers.agent'), t('reporting.tables.timesheet.headers.firstLogin'), t('reporting.tables.timesheet.headers.lastLogout'), t('reporting.tables.timesheet.headers.totalDuration')]],
            timesheetData.slice(0, 50).map(t => [t.date.toLocaleDateString(), t.agentName, t.firstLogin.toLocaleTimeString(), t.lastLogout ? t.lastLogout.toLocaleTimeString() : 'N/A', formatDuration(t.totalDuration)])
        );
        
        doc.save(`rapport_${filters.startDate}_${filters.endDate}.pdf`);
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex-shrink-0 space-y-6">
                <header className="flex justify-between items-start">
                    <div>
                        <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{t(feature.titleKey)}</h1>
                        <p className="mt-2 text-lg text-slate-600 dark:text-slate-400">{t(feature.descriptionKey)}</p>
                    </div>
                    <button onClick={handleExportPdf} className="bg-primary hover:bg-primary-hover text-primary-text font-bold py-2 px-4 rounded-lg shadow-md">{t('reporting.exportPdf')}</button>
                </header>

                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <select value={filters.dateRange} onChange={handleDateRangeChange} className="p-2 border bg-white rounded-md dark:bg-slate-900 dark:border-slate-600 dark:text-slate-200"><option value="last7days">{t('reporting.filters.dateRanges.last7days')}</option><option value="last30days">{t('reporting.filters.dateRanges.last30days')}</option><option value="thisMonth">{t('reporting.filters.dateRanges.thisMonth')}</option></select>
                        <input type="date" value={filters.startDate} onChange={e => { setFilters(f => ({ ...f, startDate: e.target.value, dateRange: '' })); setHistoryPage(1); }} className="p-2 border rounded-md dark:bg-slate-900 dark:border-slate-600 dark:text-slate-200"/>
                        <input type="date" value={filters.endDate} onChange={e => { setFilters(f => ({ ...f, endDate: e.target.value, dateRange: '' })); setHistoryPage(1); }} className="p-2 border rounded-md dark:bg-slate-900 dark:border-slate-600 dark:text-slate-200"/>
                        <select value={filters.campaignId} onChange={e => { setFilters(f => ({ ...f, campaignId: e.target.value })); setHistoryPage(1); }} className="p-2 border bg-white rounded-md dark:bg-slate-900 dark:border-slate-600 dark:text-slate-200"><option value="all">{t('reporting.filters.allCampaigns')}</option>{campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                        <select value={filters.agentId} onChange={e => { setFilters(f => ({ ...f, agentId: e.target.value })); setHistoryPage(1); }} className="p-2 border bg-white rounded-md dark:bg-slate-900 dark:border-slate-600 dark:text-slate-200"><option value="all">{t('reporting.filters.allAgents')}</option>{users.filter(u=>u.role==='Agent').map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}</select>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <KpiCard title={t('reporting.kpis.processedCalls')} value={kpis.processedCalls} />
                    <KpiCard title={t('reporting.kpis.totalTalkTime')} value={kpis.totalTalkTime} />
                    <KpiCard title={t('reporting.kpis.avgCallDuration')} value={kpis.avgCallDuration} />
                    <KpiCard title={t('reporting.kpis.successRate')} value={kpis.successRate} />
                    <KpiCard title={t('reporting.kpis.occupancyRate')} value={kpis.occupancyRate} />
                </div>
            </div>

            <div className="mt-6 flex-1 min-h-0 flex flex-col bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-700">
                    <nav className="-mb-px flex space-x-4 px-6">
                        {['charts', 'timesheet', 'campaign', 'agent', 'group', 'site', 'history'].map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === tab ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>{t(`reporting.tabs.${tab}`)}</button>
                        ))}
                    </nav>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-6">
                    {activeTab === 'charts' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" style={{ minHeight: '600px' }}>
                            <div id="chart-parent-1" className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg"><h3 className="font-semibold mb-2 dark:text-slate-200">{t('reporting.charts.callsByCampaignTitle')}</h3><div className="h-64"><ChartComponent id="treemapChart" type="treemap" data={callsByCampaignData} options={{...commonChartOptions, plugins: {legend: {display: false}}}} /></div></div>
                            <div id="chart-parent-2" className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg"><h3 className="font-semibold mb-2 dark:text-slate-200">{t('reporting.charts.successByHourTitle')}</h3><div className="h-64"><ChartComponent id="successByHourChart" type="bar" data={successByHourData} options={commonChartOptions} /></div></div>
                            <div id="chart-parent-3" className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg"><h3 className="font-semibold mb-2 dark:text-slate-200">{t('reporting.charts.successByAgentTitle')}</h3><div className="h-64"><ChartComponent id="successByAgentChart" type="bar" data={successByAgentData} options={commonChartOptions} /></div></div>
                            <div id="chart-parent-4" className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg"><h3 className="font-semibold mb-2 dark:text-slate-200">{t('reporting.charts.adherenceByAgentTitle')}</h3><div className="h-64"><ChartComponent id="adherenceChart" type="bar" data={adherenceData} options={commonChartOptions} /></div></div>
                        </div>
                    )}
                    {activeTab === 'timesheet' && (
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg">{t('reporting.tables.timesheet.title')}</h3>
                            <div className="overflow-x-auto border rounded-md dark:border-slate-700 max-h-[600px]">
                                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0"><tr>
                                        <th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.timesheet.headers.date')}</th>
                                        <th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.timesheet.headers.agent')}</th>
                                        <th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.timesheet.headers.firstLogin')}</th>
                                        <th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.timesheet.headers.lastLogout')}</th>
                                        <th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.timesheet.headers.totalDuration')}</th>
                                    </tr></thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">{timesheetData.map((d, i) => <tr key={i}>
                                        <td className="px-4 py-2">{d.date.toLocaleDateString()}</td><td className="px-4 py-2">{d.agentName}</td>
                                        <td className="px-4 py-2">{d.firstLogin.toLocaleTimeString()}</td><td className="px-4 py-2">{d.lastLogout ? d.lastLogout.toLocaleTimeString() : 'N/A'}</td>
                                        <td className="px-4 py-2">{formatDuration(d.totalDuration)}</td></tr>)}
                                    </tbody>
                                </table>
                                {timesheetData.length === 0 && <p className="text-center p-4">{t('reporting.noSessionData')}</p>}
                            </div>
                        </div>
                    )}
                    {activeTab === 'campaign' && (
                        <div className="space-y-4">
                             <h3 className="font-semibold text-lg">{t('reporting.tables.campaignPerf.title')}</h3>
                             <div className="overflow-x-auto border rounded-md dark:border-slate-700 max-h-[600px]">
                                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0"><tr>
                                        <th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.campaignPerf.headers.campaign')}</th><th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.campaignPerf.headers.calls')}</th>
                                        <th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.campaignPerf.headers.totalDuration')}</th><th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.campaignPerf.headers.avgDuration')}</th>
                                        <th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.campaignPerf.headers.successRate')}</th></tr></thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">{campaignPerfData.map(c => <tr key={c.id}><td className="px-4 py-2">{c.name}</td><td className="px-4 py-2">{c.calls}</td>
                                        <td className="px-4 py-2">{formatDuration(c.totalDuration)}</td><td className="px-4 py-2">{formatDuration(c.avgDuration)}</td><td className="px-4 py-2">{c.successRate.toFixed(1)}%</td></tr>)}</tbody>
                                </table>
                                {campaignPerfData.length === 0 && <p className="text-center p-4">{t('reporting.noCallData')}</p>}
                            </div>
                        </div>
                    )}
                    {activeTab === 'agent' && (
                        <div className="space-y-6">
                            <h3 className="font-semibold text-lg">{t('reporting.tables.agentPerf.titleCalls')}</h3>
                            <div className="overflow-x-auto border rounded-md dark:border-slate-700 max-h-[600px]">
                                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0"><tr>
                                        <th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.agentPerf.headers.agent')}</th><th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.agentPerf.headers.calls')}</th>
                                        <th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.agentPerf.headers.totalDuration')}</th><th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.agentPerf.headers.avgDuration')}</th>
                                        <th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.agentPerf.headers.successRate')}</th></tr></thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">{agentPerfDataCalls.map(a => <tr key={a.agentId}><td className="px-4 py-2">{a.name}</td><td className="px-4 py-2">{a.calls}</td>
                                        <td className="px-4 py-2">{formatDuration(a.totalDuration)}</td><td className="px-4 py-2">{formatDuration(a.avgDuration)}</td><td className="px-4 py-2">{a.successRate.toFixed(1)}%</td></tr>)}</tbody>
                                </table>
                                {agentPerfDataCalls.length === 0 && <p className="text-center p-4">{t('reporting.noCallData')}</p>}
                            </div>
                        </div>
                    )}
                    {activeTab === 'group' && (
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg">{t('reporting.tables.groupPerf.title')}</h3>
                            <div className="overflow-x-auto border rounded-md dark:border-slate-700 max-h-[600px]">
                                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0"><tr>
                                        <th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.groupPerf.headers.group')}</th>
                                        <th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.agentPerf.headers.calls')}</th>
                                        <th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.agentPerf.headers.totalDuration')}</th>
                                        <th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.agentPerf.headers.avgDuration')}</th>
                                        <th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.agentPerf.headers.successRate')}</th>
                                    </tr></thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">{groupPerfData.map(g => <tr key={g.id}><td className="px-4 py-2">{g.name}</td><td className="px-4 py-2">{g.calls}</td>
                                        <td className="px-4 py-2">{formatDuration(g.totalDuration)}</td><td className="px-4 py-2">{formatDuration(g.avgDuration)}</td><td className="px-4 py-2">{g.successRate.toFixed(1)}%</td></tr>)}</tbody>
                                </table>
                                {groupPerfData.length === 0 && <p className="text-center p-4">{t('reporting.noCallData')}</p>}
                            </div>
                        </div>
                    )}
                    {activeTab === 'site' && (
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg">{t('reporting.tables.sitePerf.title')}</h3>
                            <div className="overflow-x-auto border rounded-md dark:border-slate-700 max-h-[600px]">
                                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0"><tr>
                                        <th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.sitePerf.headers.site')}</th>
                                        <th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.agentPerf.headers.calls')}</th>
                                        <th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.agentPerf.headers.totalDuration')}</th>
                                        <th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.agentPerf.headers.avgDuration')}</th>
                                        <th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.agentPerf.headers.successRate')}</th>
                                    </tr></thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">{sitePerfData.map(s => <tr key={s.id}><td className="px-4 py-2">{s.name}</td><td className="px-4 py-2">{s.calls}</td>
                                        <td className="px-4 py-2">{formatDuration(s.totalDuration)}</td><td className="px-4 py-2">{formatDuration(s.avgDuration)}</td><td className="px-4 py-2">{s.successRate.toFixed(1)}%</td></tr>)}</tbody>
                                </table>
                                {sitePerfData.length === 0 && <p className="text-center p-4">{t('reporting.noCallData')}</p>}
                            </div>
                        </div>
                    )}
                    {activeTab === 'history' && (
                         <div className="space-y-4">
                            <h3 className="font-semibold text-lg">{t('reporting.tables.callHistory.title')}</h3>
                            <div className="overflow-x-auto border rounded-md dark:border-slate-700 max-h-[600px]">
                                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0"><tr>
                                        <th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.callHistory.headers.dateTime')}</th><th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.callHistory.headers.agent')}</th>
                                        <th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.callHistory.headers.campaign')}</th><th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.callHistory.headers.number')}</th>
                                        <th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.callHistory.headers.duration')}</th><th className="px-4 py-2 text-left font-medium uppercase">{t('reporting.tables.callHistory.headers.qualification')}</th></tr></thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">{paginatedCallHistory.map(c => <tr key={c.id}>
                                        <td className="px-4 py-2">{new Date(c.startTime).toLocaleString()}</td><td className="px-4 py-2">{findEntityName(c.agentId, users)}</td>
                                        <td className="px-4 py-2">{findEntityName(c.campaignId, campaigns)}</td><td className="px-4 py-2">{c.callerNumber}</td>
                                        <td className="px-4 py-2">{formatDuration(c.duration)}</td><td className="px-4 py-2">{findEntityName(c.qualificationId, qualifications, 'description')}</td></tr>)}</tbody>
                                </table>
                                {filteredHistory.length === 0 && <p className="text-center p-4">{t('reporting.noCallData')}</p>}
                            </div>
                             {totalHistoryPages > 1 && <div className="flex justify-between items-center mt-4 text-sm">
                                <p className="text-slate-600 dark:text-slate-400">{t('reporting.tables.callHistory.pagination', { currentPage: historyPage, totalPages: totalHistoryPages, totalRecords: filteredHistory.length })}</p>
                                <div className="flex gap-2">
                                    <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1} className="p-2 disabled:opacity-50"><ArrowLeftIcon className="w-5 h-5"/></button>
                                    <button onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))} disabled={historyPage === totalHistoryPages} className="p-2 disabled:opacity-50"><ArrowRightIcon className="w-5 h-5"/></button>
                                </div>
                            </div>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportingDashboard;