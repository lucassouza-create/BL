import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Ship, Settings, LayoutList, Settings2, MapPin, 
    PlusCircle, Trash, Anchor, RefreshCcw, CheckCircle, 
    Loader2, AlertTriangle, LogOut, ChevronDown, ChevronRight,
    CheckSquare, Square, ListFilter, Calendar, Search,
    Printer, FileSpreadsheet, ClipboardList, User, Clock, 
    X, FileText, Download, Filter
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { 
    getFirestore, 
    collection, 
    doc, 
    onSnapshot, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    setDoc, 
    query 
} from "firebase/firestore";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    signOut 
} from "firebase/auth";

// --- CONFIGURAÇÃO OFICIAL VALE ---
const firebaseConfig = {
  apiKey: "AIzaSyDzfx_lsbaYZinR87qEQZ0Alvz5D8pUCJI",
  authDomain: "doc-control---vale.firebaseapp.com",
  projectId: "doc-control---vale",
  storageBucket: "doc-control---vale.firebasestorage.app",
  messagingSenderId: "475792494162",
  appId: "1:475792494162:web:83a0601f5f2b37e926198b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const APP_ID = "doc-control---vale"; 
const DATA_PATH = "public/data"; 

export default function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loginError, setLoginError] = useState("");
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [viewMode, setViewMode] = useState('user'); 
    const [activeTab, setActiveTab] = useState('open'); 
    const [closedGroupBy, setClosedGroupBy] = useState('port');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [collapsedGroups, setCollapsedGroups] = useState({});
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedShipments, setSelectedShipments] = useState(new Set());
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

    const [ports, setPorts] = useState([]);
    const [processes, setProcesses] = useState([]);
    const [shipments, setShipments] = useState([]);
    const [logs, setLogs] = useState([]);
    const [formPort, setFormPort] = useState("");
    const [newVessel, setNewVessel] = useState({ serviceNum: '', vesselName: '' });
    const [newPortName, setNewPortName] = useState('');

    const exportMenuRef = useRef(null);

    // Fechar menu de exportação ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
                setIsExportMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- SISTEMA DE LOGS ---
    const logAction = async (action, details) => {
        if (!auth.currentUser) return;
        try {
            await addDoc(collection(db, 'artifacts', APP_ID, DATA_PATH, 'logs'), {
                timestamp: Date.now(),
                user: auth.currentUser.email,
                action: action,
                details: details
            });
        } catch (e) { console.error("Erro ao gravar log", e); }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (currentUser) logAction("LOGIN", "Utilizador acedeu ao sistema");
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) return;
        const configRef = doc(db, 'artifacts', APP_ID, DATA_PATH, 'config', 'main');
        const unsubscribe = onSnapshot(configRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setPorts(data.ports || []);
                setProcesses(data.processes || []);
                if (data.ports?.length > 0 && !formPort) setFormPort(data.ports[0]);
            }
        });
        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        if (!user) return;
        const shipmentsRef = collection(db, 'artifacts', APP_ID, DATA_PATH, 'shipments');
        const unsubscribe = onSnapshot(query(shipmentsRef), (snapshot) => {
            setShipments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        if (!user || viewMode !== 'master') return;
        const logsRef = collection(db, 'artifacts', APP_ID, DATA_PATH, 'logs');
        const unsubscribe = onSnapshot(query(logsRef), (snapshot) => {
            const sortedLogs = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 50);
            setLogs(sortedLogs);
        });
        return () => unsubscribe();
    }, [user, viewMode]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError("");
        setIsLoggingIn(true);
        try { 
            await signInWithEmailAndPassword(auth, email.trim(), password); 
        } catch (error) {
            setLoginError("Credenciais inválidas.");
            setIsLoggingIn(false);
        }
    };

    const handleLogout = () => {
        logAction("LOGOUT", "Utilizador saiu do sistema");
        signOut(auth);
    };

    const handleAddShipment = async (e) => {
        e.preventDefault();
        if (!newVessel.serviceNum || !newVessel.vesselName || !user) return;
        const initialStatus = {};
        processes.forEach(p => initialStatus[p.id] = p.options?.[0] || "");
        
        try {
            await addDoc(collection(db, 'artifacts', APP_ID, DATA_PATH, 'shipments'), {
                createdAt: Date.now(),
                closedAt: null,
                port: formPort,
                serviceNum: newVessel.serviceNum,
                vessel: newVessel.vesselName.toUpperCase(),
                status: initialStatus,
                isClosed: false
            });
            logAction("CRIAR_NAVIO", `Navio ${newVessel.vesselName.toUpperCase()} criado em ${formPort}`);
            setNewVessel({ serviceNum: '', vesselName: '' });
        } catch (err) { console.error(err); }
    };

    const calculateProgress = (ship) => {
        if (processes.length === 0) return 0;
        let total = 0;
        processes.forEach(proc => {
            const val = ship.status?.[proc.id] || "";
            const idx = proc.options?.indexOf(val) ?? -1;
            if (idx >= 0) total += idx / (proc.options.length - 1);
        });
        return Math.round((total / processes.length) * 100);
    };

    const getGroupName = (ship, criteria) => {
        if (activeTab === 'open') return ship.port || "Sem Porto";
        const date = new Date(ship.closedAt || ship.createdAt);
        if (criteria === 'port') return ship.port || "Sem Porto";
        if (criteria === 'month') return date.toLocaleString('pt-PT', { month: 'long', year: 'numeric' }).toUpperCase();
        if (criteria === 'quarter') return `TRIMESTRE ${Math.floor(date.getMonth() / 3) + 1} - ${date.getFullYear()}`;
        if (criteria === 'year') return `ANO ${date.getFullYear()}`;
        if (criteria === 'range') {
            if (!dateRange.start || !dateRange.end) return 'SELECIONE O INTERVALO';
            return `PERÍODO: ${new Date(dateRange.start).toLocaleDateString('pt-PT')} A ${new Date(dateRange.end).toLocaleDateString('pt-PT')}`;
        }
        return 'OUTROS';
    };

    const filteredAndSearched = useMemo(() => {
        let base = shipments.filter(s => activeTab === 'open' ? !s.isClosed : s.isClosed);
        
        // Filtro por intervalo de data na aba Encerrados
        if (activeTab === 'closed' && closedGroupBy === 'range' && dateRange.start && dateRange.end) {
            const start = new Date(dateRange.start).getTime();
            const end = new Date(dateRange.end).getTime() + 86400000; // Final do dia
            base = base.filter(s => {
                const shipDate = s.closedAt || s.createdAt;
                return shipDate >= start && shipDate <= end;
            });
        }

        return base.filter(s => {
            const search = searchTerm.toLowerCase();
            return s.vessel.toLowerCase().includes(search) || 
                   s.serviceNum.toLowerCase().includes(search) || 
                   s.port.toLowerCase().includes(search);
        });
    }, [shipments, activeTab, searchTerm, closedGroupBy, dateRange]);

    const groups = useMemo(() => {
        const g = {};
        filteredAndSearched.forEach(ship => {
            const groupName = getGroupName(ship, closedGroupBy);
            if (!g[groupName]) g[groupName] = [];
            g[groupName].push(ship);
        });
        return g;
    }, [filteredAndSearched, activeTab, closedGroupBy]);

    const handleExport = (format) => {
        const dataToExport = selectedShipments.size > 0 
            ? shipments.filter(s => selectedShipments.has(s.id))
            : filteredAndSearched;

        if (format === 'csv' || format === 'excel') {
            let content = "Porto;Navio;Referência;Progresso;Estado;Data Encerramento\n";
            dataToExport.forEach(s => {
                content += `${s.port};${s.vessel};${s.serviceNum};${calculateProgress(s)}%;${s.isClosed ? 'Encerrado' : 'Aberto'};${new Date(s.closedAt || s.createdAt).toLocaleDateString()}\n`;
            });
            const blob = new Blob([content], { type: format === 'excel' ? 'application/vnd.ms-excel' : 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `doccontrol_${activeTab}_${new Date().getTime()}.${format === 'excel' ? 'xls' : 'csv'}`;
            link.click();
        } else if (format === 'pdf') {
            window.print(); // O PDF é gerado via Print com layout optimizado
        }
        
        logAction("EXPORTAR", `Exportado como ${format.toUpperCase()} (${dataToExport.length} itens)`);
        setIsExportMenuOpen(false);
    };

    if (loading) return <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-4"><Loader2 className="animate-spin text-blue-600" size={40} /><p className="text-slate-500 font-medium">A carregar...</p></div>;

    if (!user) return (
        <div className="h-screen flex items-center justify-center bg-slate-100 p-4 font-sans text-slate-900">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white">
                <div className="bg-slate-900 p-10 text-center relative overflow-hidden">
                    <div className="inline-flex bg-blue-600 p-4 rounded-2xl mb-4 relative z-10 shadow-lg"><Ship size={32} className="text-white" /></div>
                    <h1 className="text-3xl font-bold text-white relative z-10">DocControl <span className="text-blue-400">Pro</span></h1>
                </div>
                <div className="p-10">
                    {loginError && <div className="mb-6 p-4 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 flex items-start gap-3"><AlertTriangle size={16} className="shrink-0" /><span>{loginError}</span></div>}
                    <form onSubmit={handleLogin} className="space-y-5">
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="E-mail" required />
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="Senha" required />
                        <button type="submit" disabled={isLoggingIn} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-blue-600 transition-all shadow-lg active:scale-95">{isLoggingIn ? "A autenticar..." : "Entrar"}</button>
                    </form>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900 overflow-x-hidden">
            {/* Estilo para Impressão A4 */}
            <style>{`
                @media print {
                    @page { size: A4 portrait; margin: 10mm; }
                    body { background: white !important; -webkit-print-color-adjust: exact; }
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                    .main-container { padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; }
                    .group-section { break-inside: avoid; border: 1px solid #e2e8f0; margin-bottom: 20px; border-radius: 8px; overflow: hidden; page-break-inside: avoid; }
                    table { width: 100% !important; border-collapse: collapse; font-size: 10px !important; }
                    th, td { border: 1px solid #edf2f7; padding: 6px !important; }
                    th { background-color: #f8fafc !important; color: #1e293b !important; text-transform: uppercase; }
                    .progress-bar { display: none !important; }
                    .selected-row { background-color: #f1f5f9 !important; }
                    .unselected-group { display: none !important; }
                }
            `}</style>

            <header className="bg-slate-900 text-white p-4 px-6 shadow-xl flex justify-between items-center z-50 sticky top-0 no-print">
                <div className="flex items-center gap-4 text-white">
                    <div className="bg-blue-600 p-2 rounded-xl shadow-lg"><Ship size={24} /></div>
                    <h1 className="text-xl font-bold tracking-tight">DocControl <span className="text-blue-400">Pro</span></h1>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setViewMode(viewMode === 'user' ? 'master' : 'user')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'master' ? 'bg-amber-500 shadow-lg' : 'bg-slate-800 hover:bg-slate-700'}`}>
                        {viewMode === 'user' ? <Settings size={20} className="text-white" /> : <LayoutList size={20} className="text-white" />}
                    </button>
                    <button onClick={handleLogout} className="bg-red-500/10 text-red-400 p-2.5 rounded-xl hover:bg-red-500 hover:text-white transition-all"><LogOut size={20} /></button>
                </div>
            </header>

            <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full main-container">
                {/* Cabeçalho Relatório Impresso */}
                <div className="hidden print:block mb-8 text-center border-b-2 border-slate-900 pb-4">
                    <div className="flex justify-between items-center mb-2">
                        <div className="text-xl font-black">DOC CONTROL <span className="text-blue-600">PRO</span></div>
                        <div className="text-xs font-bold text-slate-500">RELATÓRIO DE ATENDIMENTOS</div>
                    </div>
                    <p className="text-[10px] text-slate-400">Gerado por: {user.email} | Data: {new Date().toLocaleString('pt-PT')}</p>
                </div>

                {viewMode === 'master' ? (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-slate-800"><Settings2 className="text-amber-500" /> Admin</h2>
                            <div className="flex gap-2">
                                <input type="text" value={newPortName} onChange={e => setNewPortName(e.target.value)} placeholder="Novo Porto" className="flex-1 p-4 border rounded-2xl outline-none bg-slate-50 focus:ring-2 focus:ring-blue-500" />
                                <button onClick={async () => {
                                    if(!newPortName.trim()) return;
                                    await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'config', 'main'), { ports: [...ports, newPortName.trim()] });
                                    logAction("CONFIG", `Adicionado porto: ${newPortName}`);
                                    setNewPortName('');
                                }} className="bg-blue-600 text-white px-8 rounded-2xl font-bold shadow-lg shadow-blue-600/20 active:scale-95 transition-all">Gravar</button>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><ClipboardList className="text-blue-500" /> Histórico de Ações</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-black">
                                        <tr>
                                            <th className="p-4">Timestamp</th>
                                            <th className="p-4">Utilizador</th>
                                            <th className="p-4">Ação</th>
                                            <th className="p-4">Detalhes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {logs.map(log => (
                                            <tr key={log.id} className="hover:bg-slate-50">
                                                <td className="p-4 font-mono text-[11px] whitespace-nowrap">{new Date(log.timestamp).toLocaleString('pt-PT')}</td>
                                                <td className="p-4 font-bold text-blue-600">{log.user}</td>
                                                <td className="p-4"><span className={`px-2 py-0.5 rounded text-[10px] font-black ${log.action === 'ELIMINAR' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{log.action}</span></td>
                                                <td className="p-4 text-slate-500">{log.details}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Barra de Busca Profissional */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col gap-6 no-print">
                            <div className="flex flex-col md:flex-row gap-4 items-center">
                                <div className="flex-1 relative w-full group">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500" size={20} />
                                    <input 
                                        type="text" 
                                        placeholder="Filtrar por Navio, Porto ou Referência..." 
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
                                    />
                                    {searchTerm && (
                                        <button 
                                            onClick={() => setSearchTerm("")}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-500 transition-colors"
                                        >
                                            <X size={20} />
                                        </button>
                                    )}
                                </div>
                                
                                <div className="relative" ref={exportMenuRef}>
                                    <button 
                                        onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                                        className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-900/10"
                                    >
                                        <Download size={18} /> Exportar / Imprimir
                                    </button>
                                    
                                    {isExportMenuOpen && (
                                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[100] animate-in slide-in-from-top-2 duration-200">
                                            <button onClick={() => handleExport('excel')} className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 text-slate-700 font-bold transition-colors">
                                                <FileSpreadsheet className="text-green-600" size={18} /> Excel Spreadsheet
                                            </button>
                                            <button onClick={() => handleExport('pdf')} className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 text-slate-700 font-bold transition-colors">
                                                <FileText className="text-red-500" size={18} /> Gerar PDF / Formulário
                                            </button>
                                            <button onClick={() => handleExport('csv')} className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 text-slate-700 font-bold transition-colors">
                                                <ClipboardList className="text-blue-500" size={18} /> Arquivo CSV
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <form onSubmit={handleAddShipment} className="flex flex-col lg:flex-row gap-4 items-end border-t border-slate-100 pt-6">
                                <div className="flex flex-col gap-1.5 flex-1 w-full">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Terminal</label>
                                    <select value={formPort} onChange={e => setFormPort(e.target.value)} className="p-4 border rounded-2xl bg-slate-50 font-bold outline-none border-slate-200 focus:ring-2 focus:ring-blue-500 cursor-pointer">
                                        {ports.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div className="flex-[2] flex gap-4 w-full">
                                    <input type="text" placeholder="Ref. Atendimento" value={newVessel.serviceNum} onChange={e => setNewVessel({...newVessel, serviceNum: e.target.value})} className="flex-1 border p-4 rounded-2xl outline-none bg-slate-50 focus:bg-white border-slate-200" required />
                                    <input type="text" placeholder="Navio" value={newVessel.vesselName} onChange={e => setNewVessel({...newVessel, vesselName: e.target.value})} className="flex-[2] border p-4 rounded-2xl outline-none uppercase bg-slate-50 focus:bg-white border-slate-200" required />
                                </div>
                                <button type="submit" className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all active:scale-95 h-[58px] shadow-lg shadow-blue-600/20"><PlusCircle size={20} /> Abrir Pasta</button>
                            </form>
                        </div>

                        {/* Navegação e Agrupamento Personalizado */}
                        <div className="flex flex-col gap-4 no-print border-b border-slate-200 pb-2">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="flex gap-4">
                                    <button onClick={() => { setActiveTab('open'); setSelectedShipments(new Set()); }} className={`px-8 py-4 text-sm font-bold border-b-4 transition-all ${activeTab === 'open' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Operacional</button>
                                    <button onClick={() => { setActiveTab('closed'); setSelectedShipments(new Set()); }} className={`px-8 py-4 text-sm font-bold border-b-4 transition-all ${activeTab === 'closed' ? 'border-green-600 text-green-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Histórico</button>
                                </div>

                                {activeTab === 'closed' && (
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
                                            <Filter size={14} className="text-blue-500" />
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Agrupar:</span>
                                            <select value={closedGroupBy} onChange={e => setClosedGroupBy(e.target.value)} className="text-xs font-bold text-blue-600 outline-none bg-transparent cursor-pointer">
                                                <option value="port">Por Porto</option>
                                                <option value="month">Por Mês</option>
                                                <option value="quarter">Por Trimestre</option>
                                                <option value="year">Por Ano</option>
                                                <option value="range">Intervalo Personalizado</option>
                                            </select>
                                        </div>

                                        {closedGroupBy === 'range' && (
                                            <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-2xl border border-blue-100 shadow-sm animate-in slide-in-from-right-2 duration-300">
                                                <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="bg-transparent text-xs font-bold text-blue-700 outline-none" />
                                                <span className="text-[10px] font-black text-blue-300">A</span>
                                                <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="bg-transparent text-xs font-bold text-blue-700 outline-none" />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Listagem em Grupos Colapsáveis */}
                        <div className="space-y-10">
                            {Object.keys(groups).length > 0 ? Object.keys(groups).sort((a,b) => b.localeCompare(a)).map(gName => {
                                const isCollapsed = collapsedGroups[gName];
                                const groupShips = groups[gName];
                                const allInGroupSelected = groupShips.every(s => selectedShipments.has(s.id));
                                const isUnselectedGroup = selectedShipments.size > 0 && !allInGroupSelected && !groupShips.some(s => selectedShipments.has(s.id));

                                return (
                                    <div key={gName} className={`group-section bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden animate-in fade-in duration-500 ${isCollapsed ? 'opacity-70' : ''} ${isUnselectedGroup ? 'print:hidden' : ''}`}>
                                        <div className="bg-slate-50/80 px-8 py-4 border-b flex justify-between items-center backdrop-blur-sm print:bg-slate-100 print:border-slate-300">
                                            <div className="flex items-center gap-4">
                                                <button 
                                                    onClick={() => {
                                                        const next = new Set(selectedShipments);
                                                        if (allInGroupSelected) groupShips.forEach(s => next.delete(s.id));
                                                        else groupShips.forEach(s => next.add(s.id));
                                                        setSelectedShipments(next);
                                                    }}
                                                    className="no-print text-slate-300 hover:text-blue-600 transition-colors"
                                                >
                                                    {allInGroupSelected ? <CheckSquare className="text-blue-600" /> : <Square />}
                                                </button>
                                                <h3 
                                                    onClick={() => setCollapsedGroups(p => ({...p, [gName]: !p[gName]}))}
                                                    className="text-xs font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-3 cursor-pointer select-none group"
                                                >
                                                    <span className="no-print transition-transform duration-300 group-hover:scale-125">
                                                        {isCollapsed ? <ChevronRight size={18} className="text-blue-500" /> : <ChevronDown size={18} className="text-blue-500" />}
                                                    </span>
                                                    {activeTab === 'open' || closedGroupBy === 'port' ? <MapPin size={16} /> : <Calendar size={16} />}
                                                    {gName}
                                                </h3>
                                            </div>
                                            <span className="bg-blue-100 text-blue-700 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{groupShips.length} Atendimentos</span>
                                        </div>
                                        
                                        {!isCollapsed && (
                                            <div className="overflow-x-auto custom-scrollbar">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="bg-slate-50/30 text-[10px] uppercase font-black text-slate-400 tracking-widest border-b border-slate-100">
                                                            <th className="p-6 w-12 no-print"></th>
                                                            <th className="p-6 w-80">Embarcação / Ref</th>
                                                            {processes.map(p => <th key={p.id} className="p-6 text-center">{p.name}</th>)}
                                                            <th className="p-6 text-center no-print w-32">Acções</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {groupShips.map(ship => {
                                                            const isSelected = selectedShipments.has(ship.id);
                                                            const prog = calculateProgress(ship);
                                                            if (selectedShipments.size > 0 && !isSelected) return <tr key={ship.id} className="print:hidden"></tr>;

                                                            return (
                                                                <tr key={ship.id} className={`hover:bg-slate-50/50 transition-colors ${isSelected ? 'bg-blue-50/30 selected-row' : ''}`}>
                                                                    <td className="p-6 no-print">
                                                                        <button 
                                                                            onClick={() => {
                                                                                const next = new Set(selectedShipments);
                                                                                if (next.has(ship.id)) next.delete(ship.id);
                                                                                else next.add(ship.id);
                                                                                setSelectedShipments(next);
                                                                            }}
                                                                            className="text-slate-300 hover:text-blue-600 transition-colors"
                                                                        >
                                                                            {isSelected ? <CheckSquare className="text-blue-600" size={20} /> : <Square size={20} />}
                                                                        </button>
                                                                    </td>
                                                                    <td className="p-6">
                                                                        <div className="flex items-center gap-4">
                                                                            <div className={`p-3 rounded-2xl shadow-sm ${ship.isClosed ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600'}`}><Ship size={20} /></div>
                                                                            <div>
                                                                                <div className="font-black text-[13px] uppercase text-slate-800 tracking-tight">{ship.vessel}</div>
                                                                                <div className="text-[10px] text-blue-600 font-bold font-mono uppercase tracking-tighter mt-1">{ship.serviceNum}</div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="mt-4 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden shadow-inner progress-bar">
                                                                            <div 
                                                                                className={`h-full transition-all duration-1000 ${prog === 100 ? 'bg-green-500' : 'bg-blue-600'}`} 
                                                                                style={{width: `${prog}%`}}
                                                                            ></div>
                                                                        </div>
                                                                    </td>
                                                                    {processes.map(p => {
                                                                        const val = ship.status?.[p.id] || "";
                                                                        const isSuccess = val.includes('APROVADO') || val.includes('CONCLUÍDO') || val.includes('FEITO');
                                                                        return (
                                                                            <td key={p.id} className="p-4 text-center">
                                                                                <select 
                                                                                    disabled={activeTab === 'closed'}
                                                                                    value={val}
                                                                                    onChange={async (e) => {
                                                                                        const newVal = e.target.value;
                                                                                        await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', ship.id), { [`status.${p.id}`]: newVal });
                                                                                        logAction("STATUS", `${ship.vessel}: ${p.name} alterado para ${newVal}`);
                                                                                    }}
                                                                                    className={`text-[10px] font-black p-3 rounded-xl border w-full outline-none transition-all text-center cursor-pointer appearance-none ${isSuccess ? 'bg-green-50 text-green-700 border-green-100' : 'bg-white border-slate-100 hover:border-blue-200'}`}
                                                                                >
                                                                                    {p.options.map(o => <option key={o} value={o}>{o}</option>)}
                                                                                </select>
                                                                            </td>
                                                                        );
                                                                    })}
                                                                    <td className="p-6 text-center no-print">
                                                                        <div className="flex gap-2 justify-center">
                                                                            <button onClick={async () => {
                                                                                const newState = !ship.isClosed;
                                                                                await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', ship.id), { isClosed: newState, closedAt: newState ? Date.now() : null });
                                                                                logAction(newState ? "ENCERRAR" : "REABRIR", `Navio ${ship.vessel} ${newState ? 'encerrado' : 'reaberto'}`);
                                                                            }} className={`p-3 rounded-xl transition-all shadow-sm ${activeTab === 'open' ? 'bg-green-50 text-green-600 border border-green-100 hover:bg-green-600 hover:text-white' : 'bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-600 hover:text-white'}`}>
                                                                                {activeTab === 'open' ? <CheckCircle size={18} /> : <RefreshCcw size={18} />}
                                                                            </button>
                                                                            <button onClick={async () => { 
                                                                                if(window.confirm(`Eliminar ${ship.vessel}? Esta acção não pode ser desfeita.`)) {
                                                                                    await deleteDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', ship.id));
                                                                                    logAction("ELIMINAR", `Navio ${ship.vessel} removido`);
                                                                                }
                                                                            }} className="p-3 bg-red-50 text-red-500 rounded-xl border border-red-100 hover:bg-red-500 hover:text-white transition-all shadow-sm">
                                                                                <Trash size={18} />
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                );
                            }) : (
                                <div className="h-96 flex flex-col items-center justify-center bg-white border border-slate-200 border-dashed rounded-[3rem] text-slate-300 gap-6 opacity-60">
                                    <div className="bg-slate-50 p-8 rounded-full shadow-inner"><Anchor size={64} className="animate-pulse" /></div>
                                    <p className="font-black uppercase tracking-[0.3em] text-xs">Sem dados para as condições actuais</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Print Footer */}
            <div className="hidden print:block fixed bottom-0 left-0 right-0 text-[8px] text-slate-400 text-center py-4 border-t border-slate-100">
                Página 1 de 1 | Documento Gerado pelo Sistema DocControl Pro - Logística Vale S.A.
            </div>
        </div>
    );
}
