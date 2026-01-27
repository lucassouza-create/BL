import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Ship, Settings, LayoutList, Settings2, MapPin, 
    PlusCircle, Trash, Anchor, RefreshCcw, CheckCircle, 
    Loader2, AlertTriangle, LogOut, ChevronDown, ChevronRight,
    CheckSquare, Square, ListFilter, Calendar, Search,
    Printer, FileSpreadsheet, ClipboardList, User, Clock, 
    X, FileText, Download, Filter, Table, MessageSquare, Send, Check,
    Archive, RotateCcw, ArrowUp, ArrowDown, Edit2
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

/**
 * Utilitário para garantir que o valor do status seja sempre um Array.
 */
const normalizeStatus = (val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && val.trim() !== "") return [val];
    return [];
};

/**
 * Componente de Seleção Múltipla com sinalização visual por cores.
 */
const MultiSelectCell = ({ options, selected, onChange, disabled, processName }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    
    // Normaliza e filtra apenas itens que existem nas opções atuais (remove fantasmas como DUE RECEBIDA)
    const currentSelected = normalizeStatus(selected).filter(s => options.includes(s));

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleOption = (opt) => {
        if (disabled) return;
        const next = [...currentSelected];
        const index = next.indexOf(opt);
        if (index > -1) next.splice(index, 1);
        else next.push(opt);
        onChange(next);
    };

    // Exibe apenas o último item selecionado para economizar espaço
    const displayText = currentSelected.length > 0 
        ? currentSelected[currentSelected.length - 1] 
        : "NENHUM";

    // Lógica de cores baseada na seleção e posição na lista
    const hasSelection = currentSelected.length > 0;
    const isLastOptionSelected = hasSelection && currentSelected.includes(options[options.length - 1]);

    let colorClass = "";
    if (!hasSelection) {
        colorClass = "bg-red-50 text-red-600 border-red-100"; // NENHUM: Vermelho
    } else if (isLastOptionSelected) {
        colorClass = "bg-green-50 text-green-700 border-green-200 shadow-sm shadow-green-100"; // ÚLTIMO: Verde
    } else {
        colorClass = "bg-yellow-50 text-yellow-700 border-yellow-200 shadow-sm shadow-yellow-100"; // INTERMEDIÁRIO: Amarelo
    }

    return (
        <div className="relative w-full" ref={containerRef}>
            <button 
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
                type="button"
                className={`w-full p-1.5 h-8 rounded-lg border text-[9px] font-black transition-all flex items-center justify-between gap-1 text-center ${colorClass}`}
            >
                <span className="truncate flex-1 uppercase">{displayText}</span>
                <ChevronDown size={10} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && !disabled && (
                <div className="absolute z-[60] mt-1 w-full min-w-[180px] bg-white rounded-xl shadow-2xl border border-slate-200 p-1.5 animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-1.5 border-b border-slate-50 mb-1">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{processName}</p>
                    </div>
                    <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-0.5">
                        {options.map(opt => {
                            const isChecked = currentSelected.includes(opt);
                            return (
                                <div 
                                    key={opt} 
                                    onClick={() => toggleOption(opt)}
                                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all hover:bg-slate-50
                                        ${isChecked ? 'bg-blue-50/50' : ''}`}
                                >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors
                                        ${isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'}`}>
                                        {isChecked && <Check size={12} strokeWidth={3} />}
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase ${isChecked ? 'text-blue-700' : 'text-slate-600'}`}>
                                        {opt}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function App() {
    // --- ESTADOS ---
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loginError, setLoginError] = useState("");
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [viewMode, setViewMode] = useState('user'); 
    const [activeTab, setActiveTab] = useState('open'); 
    const [groupBy, setGroupBy] = useState('port');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [collapsedGroups, setCollapsedGroups] = useState({});
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedShipments, setSelectedShipments] = useState(new Set());
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [isCompactMode, setIsCompactMode] = useState(false);
    const [activeShipComment, setActiveShipComment] = useState(null);
    const [newCommentText, setNewCommentText] = useState("");

    const [ports, setPorts] = useState([]);
    const [processes, setProcesses] = useState([]);
    const [shipments, setShipments] = useState([]);
    const [logs, setLogs] = useState([]);
    const [formPort, setFormPort] = useState("");
    const [newVessel, setNewVessel] = useState({ serviceNum: '', vesselName: '', oblDate: new Date().toISOString().split('T')[0] });
    const [newPortName, setNewPortName] = useState('');
    
    const [editingTopic, setEditingTopic] = useState({ processId: null, index: null, value: "" });
    const [newTopic, setNewTopic] = useState({ processId: null, value: "" });

    const exportMenuRef = useRef(null);

    // --- FIREBASE LISTENERS ---
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

    // --- HANDLERS ---
    const logAction = async (action, details) => {
        if (!auth.currentUser) return;
        try {
            await addDoc(collection(db, 'artifacts', APP_ID, DATA_PATH, 'logs'), {
                timestamp: Date.now(),
                user: auth.currentUser.email,
                action: action,
                details: details
            });
        } catch (e) {}
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError("");
        setIsLoggingIn(true);
        try { await signInWithEmailAndPassword(auth, email.trim(), password); } catch (error) {
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
        processes.forEach(p => initialStatus[p.id] = []);
        try {
            await addDoc(collection(db, 'artifacts', APP_ID, DATA_PATH, 'shipments'), {
                createdAt: Date.now(),
                closedAt: null,
                port: formPort,
                serviceNum: newVessel.serviceNum,
                vessel: newVessel.vesselName.toUpperCase(),
                oblDate: newVessel.oblDate,
                status: initialStatus,
                comments: [],
                isClosed: false,
                isArchived: false
            });
            logAction("CRIAR_NAVIO", `Navio ${newVessel.vesselName.toUpperCase()} criado em ${formPort}`);
            setNewVessel({ serviceNum: '', vesselName: '', oblDate: new Date().toISOString().split('T')[0] });
        } catch (err) {}
    };

    const handleAddComment = async () => {
        if (!newCommentText.trim() || !activeShipComment || !user) return;
        const newComment = { id: Date.now(), text: newCommentText.trim(), timestamp: Date.now(), user: user.email };
        const updatedComments = [...(activeShipComment.comments || []), newComment];
        try {
            await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', activeShipComment.id), { comments: updatedComments });
            setNewCommentText("");
            setActiveShipComment({...activeShipComment, comments: updatedComments});
        } catch (err) {}
    };

    const calculateProgress = (ship) => {
        if (processes.length === 0) return 0;
        let total = 0, acquired = 0;
        processes.forEach(proc => {
            total += proc.options?.length || 0;
            const sel = normalizeStatus(ship.status?.[proc.id]).filter(s => proc.options.includes(s));
            acquired += sel.length;
        });
        return total === 0 ? 0 : Math.round((acquired / total) * 100);
    };

    const getGroupName = (ship, criteria) => {
        const refDate = ship.oblDate ? new Date(ship.oblDate) : new Date(ship.closedAt || ship.createdAt);
        if (activeTab === 'archive' && criteria === 'port' && !searchTerm) criteria = 'month';
        if (criteria === 'port') return ship.port || "Sem Porto";
        if (criteria === 'month') return refDate.toLocaleString('pt-PT', { month: 'long', year: 'numeric' }).toUpperCase();
        if (criteria === 'quarter') return `TRIMESTRE ${Math.floor(refDate.getMonth() / 3) + 1} - ${refDate.getFullYear()}`;
        if (criteria === 'year') return `ANO ${refDate.getFullYear()}`;
        if (criteria === 'range') {
            if (!dateRange.start || !dateRange.end) return 'SELECIONE O INTERVALO';
            return `OBL: ${new Date(dateRange.start).toLocaleDateString('pt-PT')} A ${new Date(dateRange.end).toLocaleDateString('pt-PT')}`;
        }
        return 'OUTROS';
    };

    const filteredAndSearched = useMemo(() => {
        let base = shipments;
        if (activeTab === 'open') base = base.filter(s => !s.isClosed && !s.isArchived);
        else if (activeTab === 'closed') base = base.filter(s => s.isClosed && !s.isArchived);
        else if (activeTab === 'archive') base = base.filter(s => s.isArchived);
        
        if (groupBy === 'range' && dateRange.start && dateRange.end) {
            const start = new Date(dateRange.start).getTime();
            const end = new Date(dateRange.end).getTime() + 86400000;
            base = base.filter(s => {
                const shipDate = s.oblDate ? new Date(s.oblDate).getTime() : (s.closedAt || s.createdAt);
                return shipDate >= start && shipDate <= end;
            });
        }
        return base.filter(s => {
            const search = searchTerm.toLowerCase();
            return (s.vessel || "").toLowerCase().includes(search) || 
                   (s.serviceNum || "").toLowerCase().includes(search) || 
                   (s.port || "").toLowerCase().includes(search);
        });
    }, [shipments, activeTab, searchTerm, groupBy, dateRange]);

    const groups = useMemo(() => {
        const g = {};
        filteredAndSearched.forEach(ship => {
            const groupName = getGroupName(ship, groupBy);
            if (!g[groupName]) g[groupName] = [];
            g[groupName].push(ship);
        });
        return g;
    }, [filteredAndSearched, activeTab, groupBy]);

    const handleExport = (format) => {
        if (format === 'spreadsheet-pdf') { setIsCompactMode(true); setIsExportMenuOpen(false); return; }
        const dataToExport = selectedShipments.size > 0 ? shipments.filter(s => selectedShipments.has(s.id)) : filteredAndSearched;
        if (format === 'csv' || format === 'excel') {
            let content = "Porto;Navio;Referencia;Data OBL;Progresso;Marcadores\n";
            dataToExport.forEach(s => {
                const markers = processes.map(p => `${p.name}: ${normalizeStatus(s.status?.[p.id]).filter(o => p.options.includes(o)).join(', ')}`).join(' | ');
                content += `${s.port};${s.vessel};${s.serviceNum};${s.oblDate || '-'};${calculateProgress(s)}%;${markers}\n`;
            });
            const blob = new Blob([content], { type: format === 'excel' ? 'application/vnd.ms-excel' : 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `export_${activeTab}_${new Date().getTime()}.${format === 'excel' ? 'xls' : 'csv'}`;
            link.click();
        } else if (format === 'pdf') window.print();
        setIsExportMenuOpen(false);
    };

    // --- FUNÇÕES MASTER ---
    const updateConfig = async (newProcesses) => {
        await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'config', 'main'), { processes: newProcesses });
    };

    const handleMoveTopic = (processId, index, direction) => {
        const newProcesses = [...processes];
        const pIdx = newProcesses.findIndex(p => p.id === processId);
        const options = [...newProcesses[pIdx].options];
        const targetIdx = index + direction;
        if (targetIdx < 0 || targetIdx >= options.length) return;
        [options[index], options[targetIdx]] = [options[targetIdx], options[index]];
        newProcesses[pIdx].options = options;
        updateConfig(newProcesses);
    };

    const handleDeleteTopic = (processId, index) => {
        if (!confirm("Deseja excluir este tópico?")) return;
        const newProcesses = [...processes];
        const pIdx = newProcesses.findIndex(p => p.id === processId);
        const options = [...newProcesses[pIdx].options];
        options.splice(index, 1);
        newProcesses[pIdx].options = options;
        updateConfig(newProcesses);
    };

    const handleSaveEditTopic = () => {
        if (!editingTopic.value.trim()) return;
        const newProcesses = [...processes];
        const pIdx = newProcesses.findIndex(p => p.id === editingTopic.processId);
        const options = [...newProcesses[pIdx].options];
        options[editingTopic.index] = editingTopic.value.trim().toUpperCase();
        newProcesses[pIdx].options = options;
        updateConfig(newProcesses);
        setEditingTopic({ processId: null, index: null, value: "" });
    };

    const handleAddTopic = (processId) => {
        if (!newTopic.value.trim() || newTopic.processId !== processId) return;
        const newProcesses = [...processes];
        const pIdx = newProcesses.findIndex(p => p.id === processId);
        const options = [...(newProcesses[pIdx].options || [])];
        options.push(newTopic.value.trim().toUpperCase());
        newProcesses[pIdx].options = options;
        updateConfig(newProcesses);
        setNewTopic({ processId: null, value: "" });
    };

    if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

    if (!user) return (
        <div className="h-screen flex items-center justify-center bg-slate-100 p-4 font-sans text-slate-900">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white">
                <div className="bg-slate-900 p-10 text-center relative">
                    <div className="inline-flex bg-blue-600 p-4 rounded-2xl mb-4 relative z-10 shadow-lg"><Ship size={32} className="text-white" /></div>
                    <h1 className="text-3xl font-bold text-white relative z-10">DocControl <span className="text-blue-400">Pro</span></h1>
                    <p className="text-slate-400 text-xs mt-2 font-black uppercase tracking-widest">Vale S.A. Logística</p>
                </div>
                <div className="p-10">
                    {loginError && <div className="mb-6 p-4 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 flex items-start gap-3"><AlertTriangle size={16} className="shrink-0" /><span>{loginError}</span></div>}
                    <form onSubmit={handleLogin} className="space-y-5">
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-all" placeholder="E-mail Corporativo" required />
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-all" placeholder="Senha" required />
                        <button type="submit" disabled={isLoggingIn} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-blue-600 transition-all shadow-lg active:scale-95">{isLoggingIn ? "Autenticando..." : "Aceder ao Sistema"}</button>
                    </form>
                </div>
            </div>
        </div>
    );

    return (
        <div className={`min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900 overflow-x-hidden ${isCompactMode ? 'compact-active' : ''}`}>
            <header className="bg-slate-900 text-white p-4 px-6 shadow-xl flex justify-between items-center z-50 sticky top-0 no-print">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600 p-2 rounded-xl shadow-lg"><Ship size={20} /></div>
                    <h1 className="text-lg font-bold tracking-tight">DocControl <span className="text-blue-400">Pro</span></h1>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setViewMode(viewMode === 'user' ? 'master' : 'user')} className={`p-2 rounded-xl transition-all ${viewMode === 'master' ? 'bg-amber-500 shadow-lg' : 'bg-slate-800 hover:bg-slate-700'}`}>
                        {viewMode === 'user' ? <Settings size={18} /> : <LayoutList size={18} />}
                    </button>
                    <button onClick={handleLogout} className="bg-red-500/10 text-red-400 p-2 rounded-xl hover:bg-red-500 hover:text-white transition-all"><LogOut size={18} /></button>
                </div>
            </header>

            <main className="flex-1 p-3 md:p-6 max-w-[1600px] mx-auto w-full">
                {viewMode === 'master' ? (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-3"><Settings2 className="text-blue-500" /> Configuração de Menus</h2>
                            <div className="grid md:grid-cols-3 gap-6">
                                {processes.map(proc => (
                                    <div key={proc.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                                        <h3 className="font-black text-[10px] text-blue-600 uppercase tracking-widest mb-4">{proc.name}</h3>
                                        <div className="space-y-1.5 mb-4">
                                            {proc.options?.map((opt, idx) => (
                                                <div key={idx} className="bg-white p-2 rounded-lg border border-slate-100 flex items-center justify-between group shadow-sm">
                                                    {editingTopic.processId === proc.id && editingTopic.index === idx ? (
                                                        <input autoFocus className="flex-1 text-[10px] font-bold outline-none uppercase" value={editingTopic.value} onChange={e => setEditingTopic({...editingTopic, value: e.target.value})} onBlur={handleSaveEditTopic} />
                                                    ) : (
                                                        <>
                                                            <span className="text-[10px] font-bold text-slate-700 uppercase truncate pr-2">{opt}</span>
                                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => handleMoveTopic(proc.id, idx, -1)} className="p-1 hover:text-blue-600"><ArrowUp size={10}/></button>
                                                                <button onClick={() => handleMoveTopic(proc.id, idx, 1)} className="p-1 hover:text-blue-600"><ArrowDown size={10}/></button>
                                                                <button onClick={() => setEditingTopic({ processId: proc.id, index: idx, value: opt })} className="p-1 hover:text-amber-600"><Edit2 size={10}/></button>
                                                                <button onClick={() => handleDeleteTopic(proc.id, idx)} className="p-1 hover:text-red-500"><Trash size={10}/></button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="relative">
                                            <input className="w-full p-2.5 pr-10 bg-white border border-slate-200 rounded-xl text-[10px] font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500" placeholder="Novo item..." value={newTopic.processId === proc.id ? newTopic.value : ""} onChange={e => setNewTopic({ processId: proc.id, value: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleAddTopic(proc.id)} />
                                            <button onClick={() => handleAddTopic(proc.id)} className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-blue-600 text-white rounded-lg active:scale-90 transition-all"><PlusCircle size={14}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Busca e Novo Navio (Design Compacto) */}
                        <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 flex flex-col gap-4 no-print">
                            <div className="flex flex-col md:flex-row gap-3 items-center">
                                <div className="flex-1 relative w-full group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input type="text" placeholder="Filtrar Navio ou Terminal..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium" />
                                    {searchTerm && <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-500"><X size={16} /></button>}
                                </div>
                                <div className="relative" ref={exportMenuRef}>
                                    <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="bg-slate-900 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 text-xs"><Download size={14} /> Exportar</button>
                                    {isExportMenuOpen && (
                                        <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[100] animate-in slide-in-from-top-2 overflow-hidden">
                                            <button onClick={() => handleExport('pdf')} className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 text-[11px] font-bold border-b transition-colors"><Printer className="text-blue-600" size={14} /> Formulário Individual</button>
                                            <button onClick={() => handleExport('spreadsheet-pdf')} className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 text-[11px] font-bold border-b bg-blue-50/30 transition-colors"><Table className="text-indigo-600" size={14} /> Planilha Consolidada</button>
                                            <button onClick={() => handleExport('excel')} className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 text-[11px] font-bold transition-colors"><FileSpreadsheet className="text-green-600" size={14} /> Excel Spreadsheet</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <form onSubmit={handleAddShipment} className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-end border-t border-slate-50 pt-4">
                                <div className="flex flex-col gap-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Terminal</label>
                                    <select value={formPort} onChange={e => setFormPort(e.target.value)} className="p-3 border rounded-xl bg-slate-50 font-bold outline-none text-[11px] h-11">{ports.map(p => <option key={p} value={p}>{p}</option>)}</select>
                                </div>
                                <div className="flex flex-col gap-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Navio & AT</label>
                                    <div className="flex gap-2 h-11"><input type="text" placeholder="AT" value={newVessel.serviceNum} onChange={e => setNewVessel({...newVessel, serviceNum: e.target.value})} className="w-20 border p-3 rounded-xl bg-slate-50 font-bold text-[11px]" required />
                                        <input type="text" placeholder="Navio" value={newVessel.vesselName} onChange={e => setNewVessel({...newVessel, vesselName: e.target.value})} className="flex-1 border p-3 rounded-xl uppercase bg-slate-50 font-bold text-[11px]" required />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Data OBL</label>
                                    <input type="date" value={newVessel.oblDate} onChange={e => setNewVessel({...newVessel, oblDate: e.target.value})} className="w-full border p-3 rounded-xl bg-slate-50 font-bold text-[11px] h-11" required />
                                </div>
                                <button type="submit" className="bg-blue-600 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all h-11 text-xs"><PlusCircle size={16} /> Abrir Pasta</button>
                            </form>
                        </div>

                        {/* Abas e Filtros */}
                        <div className="flex flex-col md:flex-row justify-between items-center gap-3 border-b border-slate-200 no-print">
                            <div className="flex gap-1">
                                <button onClick={() => { setActiveTab('open'); setSelectedShipments(new Set()); }} className={`px-5 py-3 text-[11px] font-bold border-b-2 transition-all ${activeTab === 'open' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-400'}`}>OPERACIONAL</button>
                                <button onClick={() => { setActiveTab('closed'); setSelectedShipments(new Set()); }} className={`px-5 py-3 text-[11px] font-bold border-b-2 transition-all ${activeTab === 'closed' ? 'border-green-600 text-green-700' : 'border-transparent text-slate-400'}`}>HISTÓRICO</button>
                                <button onClick={() => { setActiveTab('archive'); setSelectedShipments(new Set()); }} className={`px-5 py-3 text-[11px] font-bold border-b-2 transition-all ${activeTab === 'archive' ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-400'}`}>ARQUIVO</button>
                            </div>
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
                                    <Filter size={12} className="text-blue-500" />
                                    <select value={groupBy} onChange={e => setGroupBy(e.target.value)} className="text-[10px] font-bold text-blue-600 outline-none bg-transparent cursor-pointer uppercase">
                                        <option value="port">POR PORTO</option>
                                        <option value="month">POR MÊS</option>
                                        <option value="year">POR ANO</option>
                                        <option value="range">INTERVALO OBL</option>
                                    </select>
                                </div>
                                {groupBy === 'range' && (
                                    <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 animate-in slide-in-from-right-2">
                                        <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="bg-transparent text-[9px] font-bold text-blue-700 outline-none" />
                                        <span className="text-[8px] font-black text-blue-300">A</span>
                                        <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="bg-transparent text-[9px] font-bold text-blue-700 outline-none" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Listagem de Navios (Tabela Otimizada) */}
                        <div className="space-y-8 pb-10">
                            {Object.keys(groups).length > 0 ? Object.keys(groups).sort((a,b) => b.localeCompare(a)).map(gName => {
                                const isCollapsed = collapsedGroups[gName];
                                const groupShips = groups[gName];
                                return (
                                    <div key={gName} className={`bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden animate-in fade-in duration-300 ${isCollapsed ? 'opacity-70' : ''}`}>
                                        <div className="bg-slate-50/80 px-5 py-3 border-b flex justify-between items-center backdrop-blur-sm print:bg-slate-100">
                                            <h3 onClick={() => setCollapsedGroups(p => ({...p, [gName]: !p[gName]}))} className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-2 cursor-pointer select-none">
                                                {isCollapsed ? <ChevronRight size={14} className="text-blue-500" /> : <ChevronDown size={14} className="text-blue-500" />}
                                                {groupBy === 'port' ? <MapPin size={12} /> : <Calendar size={12} />}
                                                {gName}
                                            </h3>
                                            <span className="bg-blue-100 text-blue-700 px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest">{groupShips.length} ITENS</span>
                                        </div>
                                        {!isCollapsed && (
                                            <div className="overflow-x-visible"> {/* Removida rolagem se possível */}
                                                <table className="w-full text-left table-fixed">
                                                    <thead>
                                                        <tr className="bg-slate-50/30 text-[8px] uppercase font-black text-slate-400 tracking-widest border-b border-slate-100">
                                                            <th className="p-3 w-10 no-print text-center">SEL.</th>
                                                            <th className="p-3 w-48">EMBARCAÇÃO / AT</th>
                                                            <th className="p-3 w-28 text-center">DATA OBL</th>
                                                            {processes.map(p => <th key={p.id} className="p-3 text-center">{p.name}</th>)}
                                                            <th className="p-3 text-center no-print w-36">GESTÃO</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {groupShips.map(ship => {
                                                            const prog = calculateProgress(ship);
                                                            const isSelected = selectedShipments.has(ship.id);
                                                            return (
                                                                <tr key={ship.id} className={`hover:bg-slate-50/50 transition-colors ${isSelected ? 'bg-blue-50/30' : ''}`}>
                                                                    <td className="p-2 no-print text-center">
                                                                        <button onClick={() => {
                                                                            const next = new Set(selectedShipments);
                                                                            if (next.has(ship.id)) next.delete(ship.id); else next.add(ship.id);
                                                                            setSelectedShipments(next);
                                                                        }} className="text-slate-300 hover:text-blue-600">
                                                                            {isSelected ? <CheckSquare className="text-blue-600" size={18} /> : <Square size={18} />}
                                                                        </button>
                                                                    </td>
                                                                    <td className="p-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="ship-icon-box p-1.5 rounded-lg bg-blue-50 text-blue-600 print:hidden"><Ship size={14} /></div>
                                                                            <div className="min-w-0">
                                                                                <div className="font-black text-[10px] uppercase text-slate-800 truncate tracking-tighter">{ship.vessel}</div>
                                                                                <div className="text-[8px] text-blue-600 font-bold font-mono truncate">{(ship.serviceNum || "")}</div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="mt-2 w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                                                            <div className={`h-full transition-all duration-1000 ${prog === 100 ? 'bg-green-500' : 'bg-blue-600'}`} style={{width: `${prog}%`}}></div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="p-2 text-center">
                                                                        <input type="date" disabled={activeTab === 'archive'} value={ship.oblDate || ""} onChange={async (e) => await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', ship.id), { oblDate: e.target.value })} className="bg-transparent text-[9px] font-black text-slate-700 outline-none w-full text-center hover:bg-slate-100 p-1 rounded cursor-pointer" />
                                                                    </td>
                                                                    {processes.map(p => {
                                                                        const rawStatus = ship.status?.[p.id];
                                                                        return (
                                                                            <td key={p.id} className="p-1.5 text-center">
                                                                                <MultiSelectCell 
                                                                                    processName={p.name}
                                                                                    options={p.options || []}
                                                                                    selected={rawStatus}
                                                                                    disabled={activeTab === 'archive'}
                                                                                    onChange={async (newVal) => await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', ship.id), { [`status.${p.id}`]: newVal })}
                                                                                />
                                                                            </td>
                                                                        );
                                                                    })}
                                                                    <td className="p-2 text-center no-print">
                                                                        <div className="flex gap-1.5 justify-center">
                                                                            <button onClick={() => setActiveShipComment(ship)} className={`p-2 rounded-lg relative transition-all ${ship.comments?.length > 0 ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-slate-50 text-slate-400'}`}>
                                                                                <MessageSquare size={14} />
                                                                                {ship.comments?.length > 0 && <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[7px] font-bold px-1 rounded-full">{ship.comments.length}</span>}
                                                                            </button>
                                                                            {activeTab === 'open' ? (
                                                                                <button onClick={async () => await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', ship.id), { isClosed: true, closedAt: Date.now() })} className="p-2 rounded-lg bg-green-50 text-green-600 border border-green-100"><CheckCircle size={14} /></button>
                                                                            ) : activeTab === 'closed' ? (
                                                                                <>
                                                                                    <button onClick={async () => await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', ship.id), { isClosed: false, closedAt: null })} className="p-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-100"><RotateCcw size={14} /></button>
                                                                                    <button onClick={async () => await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', ship.id), { isArchived: true })} className="p-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-100"><Archive size={14} /></button>
                                                                                </>
                                                                            ) : (
                                                                                <button onClick={async () => await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', ship.id), { isArchived: false })} className="p-2 rounded-lg bg-slate-50 text-slate-700 border border-slate-100"><RotateCcw size={14} /></button>
                                                                            )}
                                                                            <button onClick={async () => { if(confirm(`Eliminar ${ship.vessel}?`)) await deleteDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', ship.id)); }} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"><Trash size={14} /></button>
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
                            }) : <div className="h-48 flex items-center justify-center opacity-40"><Anchor size={48} className="animate-pulse text-slate-300" /></div>}
                        </div>
                    </div>
                )}
            </main>

            {/* Modal de Comentários */}
            {activeShipComment && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl flex flex-col h-[500px] overflow-hidden border border-white">
                        <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                            <div><h3 className="text-base font-bold uppercase">{activeShipComment.vessel}</h3><p className="text-blue-400 text-[9px] font-black uppercase tracking-widest">Observações</p></div>
                            <button onClick={() => setActiveShipComment(null)} className="p-2 hover:bg-red-500 rounded-full transition-colors"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50/50">
                            {(activeShipComment.comments || []).sort((a,b) => b.timestamp - a.timestamp).map(comm => (
                                <div key={comm.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-2">
                                    <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase">
                                        <span className="text-blue-600">{comm.user.split('@')[0]}</span>
                                        <span>{new Date(comm.timestamp).toLocaleString('pt-PT')}</span>
                                    </div>
                                    <p className="text-xs text-slate-600 font-medium">{comm.text}</p>
                                </div>
                            ))}
                        </div>
                        <div className="p-6 bg-white border-t no-print">
                            <div className="relative group">
                                <textarea value={newCommentText} onChange={e => setNewCommentText(e.target.value)} placeholder="Nova nota..." className="w-full p-4 pb-14 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium resize-none focus:bg-white transition-all" rows="2" />
                                <button onClick={handleAddComment} disabled={!newCommentText.trim()} className="absolute bottom-3 right-3 bg-blue-600 text-white px-4 py-2 rounded-xl shadow-lg hover:bg-blue-700 text-[10px] font-bold uppercase transition-all flex items-center gap-2"><Send size={14} /> Gravar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            <footer className="hidden print:block fixed bottom-0 left-0 right-0 text-[6px] text-slate-400 text-center py-2 border-t bg-white uppercase font-bold tracking-widest">Vale S.A. | DocControl Pro</footer>
        </div>
    );
}
