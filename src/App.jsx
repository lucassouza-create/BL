import React, { useState, useEffect, useMemo } from 'react';
import { 
    Ship, Settings, LayoutList, Settings2, MapPin, 
    PlusCircle, Trash, Anchor, RefreshCcw, CheckCircle, 
    Loader2, AlertTriangle, LogOut, ChevronDown, ChevronRight,
    CheckSquare, Square, ListFilter, Calendar, Search,
    Printer, FileSpreadsheet, ClipboardList, User, Clock
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
    query,
    limit,
    orderBy
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
    const [collapsedGroups, setCollapsedGroups] = useState({});
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedShipments, setSelectedShipments] = useState(new Set());

    const [ports, setPorts] = useState([]);
    const [processes, setProcesses] = useState([]);
    const [shipments, setShipments] = useState([]);
    const [logs, setLogs] = useState([]);
    const [formPort, setFormPort] = useState("");
    const [newVessel, setNewVessel] = useState({ serviceNum: '', vesselName: '' });
    const [newPortName, setNewPortName] = useState('');

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

    // Logs no Painel Admin
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
            const docRef = await addDoc(collection(db, 'artifacts', APP_ID, DATA_PATH, 'shipments'), {
                createdAt: Date.now(),
                closedAt: null,
                port: formPort,
                serviceNum: newVessel.serviceNum,
                vessel: newVessel.vesselName.toUpperCase(),
                status: initialStatus,
                isClosed: false
            });
            logAction("CRIAR_NAVIO", `Navio ${newVessel.vesselName.toUpperCase()} (${newVessel.serviceNum}) criado em ${formPort}`);
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
        return 'OUTROS';
    };

    const filteredAndSearched = useMemo(() => {
        return shipments
            .filter(s => activeTab === 'open' ? !s.isClosed : s.isClosed)
            .filter(s => {
                const search = searchTerm.toLowerCase();
                return s.vessel.toLowerCase().includes(search) || 
                       s.serviceNum.toLowerCase().includes(search) || 
                       s.port.toLowerCase().includes(search);
            });
    }, [shipments, activeTab, searchTerm]);

    const groups = useMemo(() => {
        const g = {};
        filteredAndSearched.forEach(ship => {
            const groupName = getGroupName(ship, closedGroupBy);
            if (!g[groupName]) g[groupName] = [];
            g[groupName].push(ship);
        });
        return g;
    }, [filteredAndSearched, activeTab, closedGroupBy]);

    const toggleSelection = (id) => {
        const next = new Set(selectedShipments);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedShipments(next);
    };

    const toggleGroupSelection = (groupName, ships) => {
        const next = new Set(selectedShipments);
        const allInGroupSelected = ships.every(s => next.has(s.id));
        ships.forEach(s => {
            if (allInGroupSelected) next.delete(s.id);
            else next.add(s.id);
        });
        setSelectedShipments(next);
    };

    const handleExportCSV = () => {
        const dataToExport = selectedShipments.size > 0 
            ? shipments.filter(s => selectedShipments.has(s.id))
            : filteredAndSearched;

        let csv = "Porto;Navio;Referencia;Progresso;Estado;Data\n";
        dataToExport.forEach(s => {
            csv += `${s.port};${s.vessel};${s.serviceNum};${calculateProgress(s)}%;${s.isClosed ? 'Encerrado' : 'Aberto'};${new Date(s.closedAt || s.createdAt).toLocaleDateString()}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `doccontrol_export_${activeTab}.csv`;
        link.click();
        logAction("EXPORTAR", `Exportação CSV realizada (${dataToExport.length} itens)`);
    };

    if (loading) return (
        <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
            <Loader2 className="animate-spin text-blue-600" size={40} />
            <p className="text-slate-500 font-medium">DocControl Pro: A ligar...</p>
        </div>
    );

    if (!user) return (
        <div className="h-screen flex items-center justify-center bg-slate-100 p-4 font-sans text-slate-900">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white">
                <div className="bg-slate-900 p-10 text-center relative overflow-hidden">
                    <div className="inline-flex bg-blue-600 p-4 rounded-2xl mb-4 relative z-10 shadow-lg"><Ship size={32} className="text-white" /></div>
                    <h1 className="text-3xl font-bold text-white relative z-10">DocControl <span className="text-blue-400">Pro</span></h1>
                </div>
                <div className="p-10 text-slate-900">
                    {loginError && <div className="mb-6 p-4 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 flex items-start gap-3"><AlertTriangle size={16} className="shrink-0" /><span>{loginError}</span></div>}
                    <form onSubmit={handleLogin} className="space-y-5">
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="E-mail" required />
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="Palavra-passe" required />
                        <button type="submit" disabled={isLoggingIn} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-blue-600 transition-all shadow-lg">{isLoggingIn ? "A autenticar..." : "Entrar"}</button>
                    </form>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
            {/* Print Header (Only visible when printing) */}
            <div className="hidden print:block text-center border-b-2 border-slate-900 pb-4 mb-6">
                <h1 className="text-2xl font-black uppercase">Relatório DocControl Pro - Vale</h1>
                <p className="text-xs font-bold text-slate-500 mt-1">Gerado em: {new Date().toLocaleString('pt-PT')}</p>
            </div>

            <header className="bg-slate-900 text-white p-4 px-6 shadow-xl flex justify-between items-center z-30 sticky top-0 no-print">
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

            <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
                {viewMode === 'master' ? (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-slate-800"><Settings2 className="text-amber-500" /> Painel Admin</h2>
                            <div className="flex gap-2 mb-8">
                                <input type="text" value={newPortName} onChange={e => setNewPortName(e.target.value)} placeholder="Novo Porto" className="flex-1 p-4 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
                                <button onClick={async () => {
                                    if(!newPortName.trim()) return;
                                    const nextPorts = [...ports, newPortName.trim()];
                                    await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'config', 'main'), { ports: nextPorts });
                                    logAction("CONFIG", `Adicionado porto: ${newPortName}`);
                                    setNewPortName('');
                                }} className="bg-blue-600 text-white px-8 rounded-2xl font-bold">Adicionar Porto</button>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><ClipboardList className="text-blue-500" /> Log de Atividades</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-black">
                                        <tr>
                                            <th className="p-4"><Clock size={14} /> Data/Hora</th>
                                            <th className="p-4"><User size={14} /> Utilizador</th>
                                            <th className="p-4">Ação</th>
                                            <th className="p-4">Detalhes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {logs.map(log => (
                                            <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-4 font-mono text-xs">{new Date(log.timestamp).toLocaleString('pt-PT')}</td>
                                                <td className="p-4 font-bold text-blue-600">{log.user}</td>
                                                <td className="p-4"><span className="px-2 py-0.5 bg-slate-100 rounded-md font-bold text-[10px]">{log.action}</span></td>
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
                        {/* Barra de Busca e Cadastro */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col gap-6 no-print">
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="flex-1 relative group">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                                    <input 
                                        type="text" 
                                        placeholder="Pesquisa inteligente (Navio, Porto ou Ref)..." 
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => window.print()} className="bg-slate-900 text-white px-6 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all active:scale-95"><Printer size={18} /> Imprimir</button>
                                    <button onClick={handleExportCSV} className="bg-green-600 text-white px-6 rounded-2xl font-bold flex items-center gap-2 hover:bg-green-700 transition-all active:scale-95"><FileSpreadsheet size={18} /> CSV</button>
                                </div>
                            </div>

                            <form onSubmit={handleAddShipment} className="flex flex-col lg:flex-row gap-4 items-end border-t pt-6">
                                <div className="flex flex-col gap-1.5 flex-1 w-full">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Terminal</label>
                                    <select value={formPort} onChange={e => setFormPort(e.target.value)} className="p-4 border rounded-2xl bg-slate-50 font-bold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                                        {ports.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div className="flex-[2] flex gap-4 w-full">
                                    <input type="text" placeholder="Referência AT" value={newVessel.serviceNum} onChange={e => setNewVessel({...newVessel, serviceNum: e.target.value})} className="flex-1 border p-4 rounded-2xl outline-none bg-slate-50 focus:bg-white" required />
                                    <input type="text" placeholder="Nome do Navio" value={newVessel.vesselName} onChange={e => setNewVessel({...newVessel, vesselName: e.target.value})} className="flex-[2] border p-4 rounded-2xl outline-none uppercase bg-slate-50 focus:bg-white" required />
                                </div>
                                <button type="submit" className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all active:scale-95 h-[58px]"><PlusCircle size={20} /> Abrir Pasta</button>
                            </form>
                        </div>

                        {/* Tabs e Agrupamento */}
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-200 no-print px-2">
                            <div className="flex gap-4">
                                <button onClick={() => { setActiveTab('open'); setSelectedShipments(new Set()); }} className={`px-8 py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'open' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Em Operação</button>
                                <button onClick={() => { setActiveTab('closed'); setSelectedShipments(new Set()); }} className={`px-8 py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'closed' ? 'border-green-600 text-green-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Encerrados</button>
                            </div>

                            {activeTab === 'closed' && (
                                <div className="flex items-center gap-2 bg-white px-4 py-2 mb-2 rounded-xl border border-slate-200 shadow-sm">
                                    <ListFilter size={14} className="text-slate-400" />
                                    <select value={closedGroupBy} onChange={e => setClosedGroupBy(e.target.value)} className="text-xs font-bold text-blue-600 outline-none bg-transparent cursor-pointer">
                                        <option value="port">Por Porto</option>
                                        <option value="month">Por Mês</option>
                                        <option value="quarter">Por Trimestre</option>
                                        <option value="year">Por Ano</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* Listagem em Grupos */}
                        <div className="space-y-10">
                            {Object.keys(groups).sort((a,b) => b.localeCompare(a)).map(gName => {
                                const isCollapsed = collapsedGroups[gName];
                                const groupShips = groups[gName];
                                const allInGroupSelected = groupShips.every(s => selectedShipments.has(s.id));

                                return (
                                    <div key={gName} className={`bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden animate-in fade-in duration-500 ${isCollapsed ? 'opacity-70' : ''}`}>
                                        <div className="bg-slate-50/80 px-8 py-4 border-b flex justify-between items-center backdrop-blur-sm print:bg-slate-200">
                                            <div className="flex items-center gap-4">
                                                <button 
                                                    onClick={() => toggleGroupSelection(gName, groupShips)}
                                                    className="no-print text-slate-400 hover:text-blue-600 transition-colors"
                                                >
                                                    {allInGroupSelected ? <CheckSquare className="text-blue-600" /> : <Square />}
                                                </button>
                                                <h3 
                                                    onClick={() => setCollapsedGroups(p => ({...p, [gName]: !p[gName]}))}
                                                    className="text-xs font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-3 cursor-pointer select-none"
                                                >
                                                    {isCollapsed ? <ChevronRight size={18} className="text-blue-500" /> : <ChevronDown size={18} className="text-blue-500" />}
                                                    {activeTab === 'open' || closedGroupBy === 'port' ? <MapPin size={16} /> : <Calendar size={16} />}
                                                    {gName}
                                                </h3>
                                            </div>
                                            <span className="bg-blue-100 text-blue-700 px-4 py-1 rounded-full text-[10px] font-bold">{groupShips.length} Navios</span>
                                        </div>
                                        
                                        {!isCollapsed && (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="bg-slate-50/30 text-[10px] uppercase font-black text-slate-400 tracking-widest border-b border-slate-100">
                                                            <th className="p-6 w-12 no-print"></th>
                                                            <th className="p-6 w-80">Embarcação</th>
                                                            {processes.map(p => <th key={p.id} className="p-6 text-center">{p.name}</th>)}
                                                            <th className="p-6 text-center no-print w-32">Ações</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {groupShips.map(ship => (
                                                            <tr key={ship.id} className={`hover:bg-slate-50/50 transition-colors ${selectedShipments.has(ship.id) ? 'bg-blue-50/30' : ''}`}>
                                                                <td className="p-6 no-print">
                                                                    <button onClick={() => toggleSelection(ship.id)} className="text-slate-300 hover:text-blue-600">
                                                                        {selectedShipments.has(ship.id) ? <CheckSquare className="text-blue-600" /> : <Square />}
                                                                    </button>
                                                                </td>
                                                                <td className="p-6">
                                                                    <div className="flex items-center gap-4">
                                                                        <div className={`p-3 rounded-2xl ${ship.isClosed ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600'}`}><Ship size={20} /></div>
                                                                        <div>
                                                                            <div className="font-black text-sm uppercase text-slate-800">{ship.vessel}</div>
                                                                            <div className="text-[11px] text-blue-600 font-bold font-mono mt-0.5">{ship.serviceNum}</div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="mt-4 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                                                        <div className={`h-full transition-all duration-1000 ${calculateProgress(ship) === 100 ? 'bg-green-500' : 'bg-blue-600'}`} style={{width: `${calculateProgress(ship)}%`}}></div>
                                                                    </div>
                                                                </td>
                                                                {processes.map(p => (
                                                                    <td key={p.id} className="p-4 text-center">
                                                                        <select 
                                                                            disabled={activeTab === 'closed'}
                                                                            value={ship.status?.[p.id] || ""}
                                                                            onChange={async (e) => {
                                                                                const newVal = e.target.value;
                                                                                await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', ship.id), { [`status.${p.id}`]: newVal });
                                                                                logAction("STATUS", `Navio ${ship.vessel}: ${p.name} -> ${newVal}`);
                                                                            }}
                                                                            className={`text-[10px] font-black p-3 rounded-xl border w-full outline-none text-center cursor-pointer ${ship.status?.[p.id]?.includes('APROVADO') ? 'bg-green-50 text-green-700 border-green-100' : 'bg-white border-slate-100'}`}
                                                                        >
                                                                            {p.options.map(o => <option key={o} value={o}>{o}</option>)}
                                                                        </select>
                                                                    </td>
                                                                ))}
                                                                <td className="p-6 text-center no-print">
                                                                    <div className="flex gap-3 justify-center">
                                                                        <button onClick={async () => {
                                                                            const newState = !ship.isClosed;
                                                                            await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', ship.id), { isClosed: newState, closedAt: newState ? Date.now() : null });
                                                                            logAction(newState ? "ENCERRAR" : "REABRIR", `Navio ${ship.vessel} ${newState ? 'encerrado' : 'reaberto'}`);
                                                                        }} className={`p-3 rounded-xl transition-all ${activeTab === 'open' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                                                                            {activeTab === 'open' ? <CheckCircle size={20} /> : <RefreshCcw size={20} />}
                                                                        </button>
                                                                        <button onClick={async () => { 
                                                                            if(window.confirm(`Apagar permanentemente ${ship.vessel}?`)) {
                                                                                await deleteDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', ship.id));
                                                                                logAction("ELIMINAR", `Navio ${ship.vessel} eliminado permanentemente`);
                                                                            }
                                                                        }} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all">
                                                                            <Trash size={20} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
