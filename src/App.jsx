import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Ship, Settings, LayoutList, Settings2, MapPin, 
    PlusCircle, Trash, Anchor, RefreshCcw, CheckCircle, 
    Loader2, AlertTriangle, LogOut, ChevronDown, ChevronRight,
    CheckSquare, Square, ListFilter, Calendar, Search,
    Printer, FileSpreadsheet, ClipboardList, User, Clock, 
    X, FileText, Download, Filter, Table, MessageSquare, Send, Check,
    Archive, RotateCcw, ArrowUp, ArrowDown, Edit2, ArrowLeft, ArrowRight
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
    if (Array.isArray(val)) return val.filter(v => typeof v === 'string');
    if (typeof val === 'string' && val.trim() !== "") return [val];
    return [];
};

/**
 * Componente de Seleção Múltipla Compacto
 * Altura ajustada para exibir até 5 linhas (aprox. 120px)
 */
const MultiSelectCell = ({ options, selected, onChange, disabled, processName }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    
    const currentSelected = useMemo(() => 
        normalizeStatus(selected).filter(s => options.includes(s)),
    [selected, options]);

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

    const displayText = currentSelected.length > 0 
        ? String(currentSelected[currentSelected.length - 1]) 
        : "NENHUM";

    const hasSelection = currentSelected.length > 0;
    const isLastOptionSelected = hasSelection && currentSelected.includes(options[options.length - 1]);
    
    let colorClass = "";
    if (!hasSelection) {
        colorClass = "bg-red-50 text-red-600 border-red-100";
    } else if (isLastOptionSelected) {
        colorClass = "bg-green-50 text-green-700 border-green-200 shadow-sm shadow-green-100";
    } else {
        colorClass = "bg-yellow-50 text-yellow-700 border-yellow-200 shadow-sm shadow-yellow-100";
    }

    return (
        <div className="relative w-full" ref={containerRef}>
            <button 
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
                type="button"
                className={`w-full h-6 px-1 rounded-md border text-[8px] font-black transition-all flex items-center justify-between gap-1 text-center ${colorClass}`}
            >
                <span className="truncate flex-1 uppercase text-left">{displayText}</span>
                <ChevronDown size={8} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && !disabled && (
                <div className="relative mt-1 w-full min-w-[140px] bg-white rounded-xl shadow-2xl border border-slate-200 p-1.5 animate-in fade-in zoom-in-95 duration-200 z-10">
                    <div className="p-1 border-b border-slate-50 mb-1">
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{String(processName)}</p>
                    </div>
                    <div className="max-h-[120px] overflow-y-auto custom-scrollbar space-y-0.5">
                        {options.map(opt => {
                            const isChecked = currentSelected.includes(opt);
                            return (
                                <div 
                                    key={opt} 
                                    onClick={() => toggleOption(opt)}
                                    className={`flex items-center gap-2 p-1 rounded-md cursor-pointer transition-all hover:bg-slate-50
                                        ${isChecked ? 'bg-blue-50/50' : ''}`}
                                >
                                    <div className={`w-3 h-3 shrink-0 rounded border flex items-center justify-center transition-colors
                                        ${isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'}`}>
                                        {isChecked && <Check size={8} strokeWidth={4} />}
                                    </div>
                                    <span className={`text-[9px] font-bold uppercase whitespace-normal leading-tight ${isChecked ? 'text-blue-700' : 'text-slate-600'}`}>
                                        {String(opt)}
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
    // --- ESTADOS GERAIS ---
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
    
    const [editingTopic, setEditingTopic] = useState({ processId: null, index: null, value: "" });
    const [newTopic, setNewTopic] = useState({ processId: null, value: "" });

    const exportMenuRef = useRef(null);

    // --- MANIPULADORES ---
    const logAction = async (action, details) => {
        if (!auth.currentUser) return;
        try {
            await addDoc(collection(db, 'artifacts', APP_ID, DATA_PATH, 'logs'), {
                timestamp: Date.now(),
                user: auth.currentUser.email,
                action: String(action),
                details: String(details)
            });
        } catch (e) { console.error("Erro ao gravar log", e); }
    };

    const handleLogin = async (e) => {
        if (e) e.preventDefault();
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
        if (e) e.preventDefault();
        if (!newVessel.serviceNum || !newVessel.vesselName || !user) return;
        const initialStatus = {};
        processes.forEach(p => initialStatus[p.id] = []);
        
        try {
            await addDoc(collection(db, 'artifacts', APP_ID, DATA_PATH, 'shipments'), {
                createdAt: Date.now(),
                closedAt: null,
                port: String(formPort),
                serviceNum: String(newVessel.serviceNum),
                vessel: String(newVessel.vesselName).toUpperCase(),
                oblDate: String(newVessel.oblDate),
                status: initialStatus,
                comments: [],
                isClosed: false,
                isArchived: false
            });
            logAction("CRIAR_NAVIO", `Navio ${newVessel.vesselName.toUpperCase()} criado em ${formPort}`);
            setNewVessel({ serviceNum: '', vesselName: '', oblDate: new Date().toISOString().split('T')[0] });
        } catch (err) { console.error(err); }
    };

    const handleAddComment = async () => {
        if (!newCommentText.trim() || !activeShipComment || !user) return;
        const newComment = { 
            id: Date.now(), 
            text: String(newCommentText).trim(), 
            timestamp: Date.now(), 
            user: String(user.email) 
        };
        const updatedComments = [...(activeShipComment.comments || []), newComment];
        try {
            await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', activeShipComment.id), { 
                comments: updatedComments 
            });
            setNewCommentText("");
            setActiveShipComment({...activeShipComment, comments: updatedComments});
        } catch (err) { console.error(err); }
    };

    // --- EFEITOS E LISTENERS ---
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) setIsExportMenuOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (isCompactMode) {
            window.print();
            setTimeout(() => setIsCompactMode(false), 500);
        }
    }, [isCompactMode]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // CONFIG EFFECT - ORDENAÇÃO DE COLUNAS
    useEffect(() => {
        if (!user) return;
        const configRef = doc(db, 'artifacts', APP_ID, DATA_PATH, 'config', 'main');
        const unsubscribe = onSnapshot(configRef, async (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                let currentProcesses = data.processes || [];
                
                // Normalizador para comparação segura
                const norm = (s) => String(s || "").trim().toUpperCase();

                // Verifica existência do SILOG e insere se não existir
                const silogIdx = currentProcesses.findIndex(p => norm(p.name) === "SILOG");
                const mercanteIdx = currentProcesses.findIndex(p => norm(p.name) === "PROCEDIMENTOS MERCANTES");

                if (silogIdx === -1) {
                    const newSilog = { id: "silog", name: "SILOG", options: ["CADASTRO", "ANÚNCIO"] };
                    // Se Mercantes existe, insere logo após, senão no fim, apenas na criação inicial
                    if (mercanteIdx !== -1) currentProcesses.splice(mercanteIdx + 1, 0, newSilog);
                    else currentProcesses.push(newSilog);
                    
                    await updateDoc(configRef, { processes: currentProcesses });
                }
                // REMOVIDO: A lógica 'else' que forçava a reordenação a cada atualização foi removida.
                // Agora a ordem respeita estritamente o que está salvo no array 'processes' do Firestore.

                setPorts(data.ports || []);
                setProcesses(currentProcesses);
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

    // --- FUNÇÕES MASTER ---
    const updateConfig = async (newProcesses) => {
        const configRef = doc(db, 'artifacts', APP_ID, DATA_PATH, 'config', 'main');
        try {
            await updateDoc(configRef, { processes: newProcesses });
            logAction("CONFIG_COLUNAS", "Alteração na estrutura de colunas");
        } catch (e) {}
    };

    const handleMoveProcess = (index, direction) => {
        const newProcesses = [...processes];
        const targetIdx = index + direction;
        if (targetIdx < 0 || targetIdx >= newProcesses.length) return;
        [newProcesses[index], newProcesses[targetIdx]] = [newProcesses[targetIdx], newProcesses[index]];
        updateConfig(newProcesses);
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

    // --- CÁLCULOS ---
    const calculateProgress = (ship) => {
        if (!processes || processes.length === 0) return 0;
        let total = 0, acquired = 0;
        processes.forEach(proc => {
            total += (proc.options?.length || 0);
            const sel = normalizeStatus(ship.status?.[proc.id]).filter(s => proc.options.includes(s));
            acquired += sel.length;
        });
        return total === 0 ? 0 : Math.round((acquired / total) * 100);
    };

    // --- FILTRAGEM ---
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
            return String(s.vessel || "").toLowerCase().includes(search) || 
                   String(s.serviceNum || "").toLowerCase().includes(search) || 
                   String(s.port || "").toLowerCase().includes(search);
        });
    }, [shipments, activeTab, searchTerm, groupBy, dateRange]);

    const groups = useMemo(() => {
        const g = {};
        filteredAndSearched.forEach(ship => {
            const refDate = ship.oblDate ? new Date(ship.oblDate) : new Date(ship.closedAt || ship.createdAt);
            let groupName = "OUTROS";
            if (groupBy === 'port') groupName = String(ship.port || "Sem Porto");
            else if (groupBy === 'month') groupName = refDate.toLocaleString('pt-PT', { month: 'long', year: 'numeric' }).toUpperCase();
            else if (groupBy === 'year') groupName = `ANO ${refDate.getFullYear()}`;
            else if (groupBy === 'range') groupName = `OBL: ${new Date(dateRange.start).toLocaleDateString('pt-PT')} A ${new Date(dateRange.end).toLocaleDateString('pt-PT')}`;
            if (!g[groupName]) g[groupName] = [];
            g[groupName].push(ship);
        });
        return g;
    }, [filteredAndSearched, groupBy, dateRange]);

    const handleExport = (format) => {
        if (format === 'spreadsheet-pdf') { setIsCompactMode(true); setIsExportMenuOpen(false); return; }
        const dataToExport = selectedShipments.size > 0 ? shipments.filter(s => selectedShipments.has(s.id)) : filteredAndSearched;
        if (format === 'csv' || format === 'excel') {
            let content = "Porto;Navio;Referência;Data OBL;Progresso;Marcadores\n";
            dataToExport.forEach(s => {
                const markers = processes.map(p => `${p.name}: ${normalizeStatus(s.status?.[p.id]).filter(o => p.options.includes(o)).join(', ')}`).join(' | ');
                content += `${s.port};${s.vessel};${s.serviceNum};${s.oblDate || '-'};${calculateProgress(s)}%;${markers}\n`;
            });
            const blob = new Blob([content], { type: format === 'excel' ? 'application/vnd.ms-excel' : 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `export_${activeTab}_obl_${new Date().getTime()}.${format === 'excel' ? 'xls' : 'csv'}`;
            link.click();
        } else if (format === 'pdf') window.print();
        setIsExportMenuOpen(false);
    };

    if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

    if (!user) return (
        <div className="h-screen flex items-center justify-center bg-slate-100 p-4 font-sans text-slate-900">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white">
                <div className="bg-slate-900 p-8 text-center">
                    <Ship size={40} className="text-blue-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-white uppercase tracking-tight">DocControl <span className="text-blue-400">Pro</span></h1>
                </div>
                <div className="p-8">
                    {loginError && <div className="mb-4 p-3 bg-red-50 text-red-700 text-[10px] rounded-lg border border-red-100 flex items-center gap-2 font-bold"><AlertTriangle size={14} />{String(loginError)}</div>}
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium" placeholder="E-mail Corporativo" required />
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium" placeholder="Senha" required />
                        <button type="submit" disabled={isLoggingIn} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-blue-600 transition-all text-xs uppercase tracking-widest">{isLoggingIn ? "Autenticando..." : "Entrar"}</button>
                    </form>
                </div>
            </div>
        </div>
    );

    return (
        <div className={`min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900 overflow-x-hidden ${isCompactMode ? 'compact-active' : ''}`}>
            <header className="bg-slate-900 text-white p-3 px-6 shadow-xl flex justify-between items-center z-50 sticky top-0 no-print">
                <div className="flex items-center gap-3">
                    <Ship size={18} className="text-blue-500" />
                    <h1 className="text-base font-black tracking-tight text-white uppercase">DocControl <span className="text-blue-400">Pro</span></h1>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setViewMode(viewMode === 'user' ? 'master' : 'user')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'master' ? 'bg-amber-500 shadow-lg' : 'bg-slate-800 hover:bg-slate-700'}`}>
                        {viewMode === 'user' ? <Settings size={16} /> : <LayoutList size={16} />}
                    </button>
                    <button onClick={handleLogout} className="bg-red-500/10 text-red-400 p-1.5 rounded-lg hover:bg-red-500 hover:text-white transition-all"><LogOut size={16} /></button>
                </div>
            </header>

            <main className="flex-1 p-2 md:p-4 max-w-full mx-auto w-full">
                {viewMode === 'master' ? (
                    <div className="space-y-4 animate-in fade-in duration-500">
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><Settings2 className="text-blue-500" /> Configuração Master</h2>
                            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {processes.map((proc, pIdx) => (
                                    <div key={proc.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col h-full">
                                        <div className="flex justify-between items-center mb-3">
                                            <h3 className="font-black text-[9px] text-blue-600 uppercase tracking-widest">{String(proc.name)}</h3>
                                            <div className="flex gap-1 no-print">
                                                <button onClick={() => handleMoveProcess(pIdx, -1)} className="p-1 bg-white border rounded text-slate-400"><ArrowLeft size={10}/></button>
                                                <button onClick={() => handleMoveProcess(pIdx, 1)} className="p-1 bg-white border rounded text-slate-400"><ArrowRight size={10}/></button>
                                            </div>
                                        </div>
                                        <div className="flex-1 space-y-1 overflow-y-auto custom-scrollbar max-h-[150px] pr-1 mb-3">
                                            {proc.options?.map((opt, idx) => (
                                                <div key={idx} className="bg-white p-1.5 rounded-lg border border-slate-100 flex items-center justify-between group shadow-sm">
                                                    {editingTopic.processId === proc.id && editingTopic.index === idx ? (
                                                        <input autoFocus className="flex-1 text-[9px] font-bold outline-none uppercase bg-slate-50" value={editingTopic.value} onChange={e => setEditingTopic({...editingTopic, value: e.target.value})} onBlur={handleSaveEditTopic} onKeyDown={e => e.key === 'Enter' && handleSaveEditTopic()} />
                                                    ) : (
                                                        <>
                                                            <span className="text-[9px] font-bold text-slate-700 uppercase truncate pr-1">{String(opt)}</span>
                                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                                <button onClick={() => handleMoveTopic(proc.id, idx, -1)} className="text-slate-400"><ArrowUp size={10}/></button>
                                                                <button onClick={() => handleMoveTopic(proc.id, idx, 1)} className="text-slate-400"><ArrowDown size={10}/></button>
                                                                <button onClick={() => setEditingTopic({ processId: proc.id, index: idx, value: opt })} className="text-amber-600"><Edit2 size={10}/></button>
                                                                <button onClick={() => handleDeleteTopic(proc.id, idx)} className="text-red-500"><Trash size={10}/></button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="relative">
                                            <input className="w-full p-2 pr-8 bg-white border border-slate-200 rounded-xl text-[9px] font-bold uppercase" placeholder="Novo item..." value={newTopic.processId === proc.id ? newTopic.value : ""} onChange={e => setNewTopic({ processId: proc.id, value: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleAddTopic(proc.id)} />
                                            <button onClick={() => handleAddTopic(proc.id)} className="absolute right-1 top-1/2 -translate-y-1/2 p-1 bg-blue-600 text-white rounded-lg"><PlusCircle size={12}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><ClipboardList className="text-blue-500" /> Log de Auditoria</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-400 uppercase text-[9px] font-black">
                                        <tr><th className="p-3">Data</th><th className="p-3">Usuário</th><th className="p-3">Ação</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {logs.map(log => (
                                            <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-3 font-mono text-[9px] whitespace-nowrap">{new Date(log.timestamp).toLocaleString('pt-PT')}</td>
                                                <td className="p-3 font-bold text-blue-600 text-[9px]">{String(log.user)}</td>
                                                <td className="p-3 text-slate-500 text-[9px]">{String(log.details)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-3 no-print">
                            <div className="flex flex-col md:flex-row gap-2 items-center">
                                <div className="flex-1 relative w-full">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input type="text" placeholder="Pesquisa..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-8 pr-8 py-2 bg-slate-50 border border-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-[10px] font-medium" />
                                    {searchTerm && <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-500"><X size={14} /></button>}
                                </div>
                                <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-800 text-[10px] uppercase tracking-tighter shrink-0"><Download size={12} /> Exportar</button>
                            </div>

                            <form onSubmit={handleAddShipment} className="grid grid-cols-1 md:grid-cols-4 gap-2 border-t border-slate-50 pt-2">
                                <div className="flex flex-col gap-0.5"><label className="text-[7px] font-black text-slate-400 uppercase ml-1">Terminal</label>
                                    <select value={formPort} onChange={e => setFormPort(e.target.value)} className="p-1.5 border rounded-md bg-slate-50 font-bold outline-none text-[10px] h-8">{ports.map(p => <option key={String(p)} value={String(p)}>{String(p)}</option>)}</select>
                                </div>
                                <div className="flex flex-col gap-0.5"><label className="text-[7px] font-black text-slate-400 uppercase ml-1">Navio & AT</label>
                                    <div className="flex gap-1 h-8"><input type="text" placeholder="AT" value={newVessel.serviceNum} onChange={e => setNewVessel({...newVessel, serviceNum: e.target.value})} className="w-14 border p-1.5 rounded-md bg-slate-50 font-bold text-[10px]" required />
                                        <input type="text" placeholder="Navio" value={newVessel.vesselName} onChange={e => setNewVessel({...newVessel, vesselName: e.target.value})} className="flex-1 border p-1.5 rounded-md uppercase bg-slate-50 font-bold text-[10px]" required />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-0.5"><label className="text-[7px] font-black text-slate-400 uppercase ml-1">Data OBL</label>
                                    <input type="date" value={newVessel.oblDate} onChange={e => setNewVessel({...newVessel, oblDate: e.target.value})} className="w-full border p-1.5 rounded-md bg-slate-50 font-bold text-[10px] h-8" required />
                                </div>
                                <button type="submit" className="bg-blue-600 text-white font-black rounded-lg hover:bg-blue-700 h-8 text-[9px] uppercase mt-auto tracking-widest transition-all active:scale-95">Abrir Pasta</button>
                            </form>
                        </div>

                        {activeTab === 'open' && groups && Object.keys(groups).length > 0 && Object.keys(groups).sort((a,b) => b.localeCompare(a)).map(gName => (
                            <div key={gName} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="bg-slate-50/50 px-4 py-1.5 border-b flex justify-between items-center">
                                    <div onClick={() => setCollapsedGroups(p => ({...p, [gName]: !p[gName]}))} className="cursor-pointer flex items-center gap-2">
                                        {collapsedGroups[gName] ? <ChevronRight size={14} className="text-blue-500" /> : <ChevronDown size={14} className="text-blue-500" />}
                                        <span className="text-[9px] font-black uppercase text-slate-600 tracking-widest">{String(gName)}</span>
                                    </div>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">{groups[gName].length} ITENS</span>
                                </div>
                                {!collapsedGroups[gName] && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left table-fixed">
                                            <thead>
                                                <tr className="bg-slate-50/20 text-[7px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                                    <th className="p-1.5 w-[3%] text-center">SEL.</th>
                                                    <th className="p-1.5 w-[14%]">EMBARCAÇÃO / AT</th>
                                                    {/* Processos Dinâmicos - SILOG será o segundo se ordenado corretamente */}
                                                    {processes.map(p => <th key={p.id} className="p-1.5 text-center w-[12%]">{String(p.name)}</th>)}
                                                    <th className="p-1.5 w-[7%] text-center">DATA OBL</th>
                                                    <th className="p-1.5 text-center w-[10%] no-print">GESTÃO</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {groups[gName].map(ship => (
                                                    <tr key={ship.id} className={`hover:bg-slate-50/50 transition-colors ${selectedShipments.has(ship.id) ? 'bg-blue-50/30' : ''}`}>
                                                        <td className="p-1 text-center no-print align-top">
                                                            <button onClick={() => {
                                                                const next = new Set(selectedShipments);
                                                                if (next.has(ship.id)) next.delete(ship.id); else next.add(ship.id);
                                                                setSelectedShipments(next);
                                                            }} className="text-slate-300 hover:text-blue-600">
                                                                {selectedShipments.has(ship.id) ? <CheckSquare size={14} className="text-blue-600" /> : <Square size={14} />}
                                                            </button>
                                                        </td>
                                                        <td className="p-1 align-top">
                                                            <div className="min-w-0">
                                                                <div className="font-black text-[9px] uppercase text-slate-800 truncate tracking-tight">{String(ship.vessel)}</div>
                                                                <div className="text-[7px] text-blue-600 font-bold font-mono truncate">{String(ship.serviceNum || "")}</div>
                                                                <div className="mt-1 w-full bg-slate-100 h-0.5 rounded-full overflow-hidden">
                                                                    <div className={`h-full transition-all duration-1000 ${calculateProgress(ship) === 100 ? 'bg-green-500' : 'bg-blue-600'}`} style={{width: `${calculateProgress(ship)}%`}}></div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        {processes.map(p => (
                                                            <td key={p.id} className="p-1 text-center align-top">
                                                                <MultiSelectCell processName={p.name} options={p.options || []} selected={ship.status?.[p.id]} disabled={activeTab === 'archive'} onChange={async (newVal) => await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', ship.id), { [`status.${p.id}`]: newVal })} />
                                                            </td>
                                                        ))}
                                                        <td className="p-1 text-center align-top">
                                                            <span className="text-[8px] font-black text-slate-500">{String(ship.oblDate || "-")}</span>
                                                        </td>
                                                        <td className="p-1 text-center no-print align-top">
                                                            <div className="flex gap-1 justify-center">
                                                                <button onClick={() => setActiveShipComment(ship)} className={`p-1 rounded bg-slate-50 text-slate-400 relative ${ship.comments?.length > 0 ? 'bg-amber-50 text-amber-600' : ''}`}><MessageSquare size={12}/>{ship.comments?.length > 0 && <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[6px] px-0.5 rounded-full">{ship.comments.length}</span>}</button>
                                                                <button onClick={async () => await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', ship.id), { isClosed: true, closedAt: Date.now() })} className="p-1 rounded bg-green-50 text-green-600 hover:bg-green-500 hover:text-white transition-all"><CheckCircle size={12}/></button>
                                                                <button onClick={async () => { if(confirm(`Eliminar ${ship.vessel}?`)) await deleteDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', ship.id)); }} className="p-1 rounded bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all"><Trash size={12}/></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {activeShipComment && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl flex flex-col h-[500px] overflow-hidden border border-white">
                        <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                            <div><h3 className="text-base font-bold uppercase">{String(activeShipComment.vessel)}</h3><p className="text-blue-400 text-[9px] font-black uppercase tracking-widest">Observações</p></div>
                            <button onClick={() => setActiveShipComment(null)} className="p-2 hover:bg-red-500 rounded-full transition-colors"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50/50">
                            {(activeShipComment.comments || []).sort((a,b) => b.timestamp - a.timestamp).map(comm => (
                                <div key={comm.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-2">
                                    <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase"><span className="text-blue-600">{String(comm.user).split('@')[0]}</span><span>{new Date(comm.timestamp).toLocaleString('pt-PT')}</span></div>
                                    <p className="text-xs text-slate-600 font-medium">{String(comm.text)}</p>
                                </div>
                            ))}
                        </div>
                        <div className="p-6 bg-white border-t no-print">
                            <div className="relative group"><textarea value={newCommentText} onChange={e => setNewCommentText(e.target.value)} placeholder="Nova nota..." className="w-full p-4 pb-14 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium resize-none focus:bg-white transition-all" rows="2" /><button onClick={handleAddComment} disabled={!newCommentText.trim()} className="absolute bottom-3 right-3 bg-blue-600 text-white px-4 py-2 rounded-xl shadow-lg hover:bg-blue-700 text-[10px] font-bold uppercase transition-all flex items-center gap-2"><Send size={14} /> Gravar</button></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
