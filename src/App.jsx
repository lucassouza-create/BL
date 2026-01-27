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
 * Componente de Seleção Múltipla (Marcadores)
 * Implementa lógica de sinalização por cores e exibição reduzida.
 */
const MultiSelectCell = ({ options, selected, onChange, disabled, processName }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    
    // Normalização e filtro: garante que apenas itens existentes na configuração atual sejam processados
    // Isso remove automaticamente itens fantasmas como "DUE RECEBIDA" se eles não estiverem nas options.
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

    // Lógica de exibição: apenas o último item selecionado
    const displayText = currentSelected.length > 0 
        ? currentSelected[currentSelected.length - 1] 
        : "NENHUM";

    // Lógica de cores baseada na seleção
    const isLastOptionSelected = currentSelected.includes(options[options.length - 1]);
    const hasSelection = currentSelected.length > 0;

    let colorClass = "bg-white border-slate-100 text-slate-400 hover:border-blue-300";
    if (!hasSelection) {
        // NENHUM marcado: Vermelho
        colorClass = "bg-red-50 text-red-700 border-red-200";
    } else if (isLastOptionSelected) {
        // Último item da lista marcado: Verde
        colorClass = "bg-green-50 text-green-700 border-green-200 shadow-sm shadow-green-100";
    } else {
        // Itens intermediários marcados: Amarelo
        colorClass = "bg-yellow-50 text-yellow-700 border-yellow-200 shadow-sm shadow-yellow-100";
    }

    return (
        <div className="relative w-full" ref={containerRef}>
            <button 
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
                type="button"
                className={`w-full p-2.5 rounded-xl border text-[10px] font-black transition-all flex items-center justify-between gap-2 text-center ${colorClass}`}
            >
                <span className="truncate flex-1 uppercase">{displayText}</span>
                <ChevronDown size={12} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && !disabled && (
                <div className="absolute z-[60] mt-1 w-full min-w-[200px] bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2 border-b border-slate-50 mb-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{processName}</p>
                    </div>
                    <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1">
                        {options.map(opt => {
                            const isChecked = currentSelected.includes(opt);
                            return (
                                <div 
                                    key={opt} 
                                    onClick={() => toggleOption(opt)}
                                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all hover:bg-slate-50
                                        ${isChecked ? 'bg-blue-50/50' : ''}`}
                                >
                                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors
                                        ${isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 bg-white'}`}>
                                        {isChecked && <Check size={14} strokeWidth={3} />}
                                    </div>
                                    <span className={`text-[11px] font-bold uppercase ${isChecked ? 'text-blue-700' : 'text-slate-600'}`}>
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
    const [newPortName, setNewPortName] = useState('');
    
    const [editingTopic, setEditingTopic] = useState({ processId: null, index: null, value: "" });
    const [newTopic, setNewTopic] = useState({ processId: null, value: "" });

    const exportMenuRef = useRef(null);

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

    // --- FUNÇÕES DE GESTÃO DE CONFIGURAÇÃO (MASTER) ---
    const updateConfig = async (newProcesses) => {
        const configRef = doc(db, 'artifacts', APP_ID, DATA_PATH, 'config', 'main');
        try {
            await updateDoc(configRef, { processes: newProcesses });
            logAction("CONFIG_PROCESSOS", "Alteração na estrutura de tópicos/processos");
        } catch (e) { console.error("Erro ao atualizar config", e); }
    };

    const handleMoveTopic = (processId, index, direction) => {
        const newProcesses = [...processes];
        const pIdx = newProcesses.findIndex(p => p.id === processId);
        const options = [...newProcesses[pIdx].options];
        const targetIdx = index + direction;
        
        if (targetIdx < 0 || targetIdx >= options.length) return;
        
        const temp = options[index];
        options[index] = options[targetIdx];
        options[targetIdx] = temp;
        
        newProcesses[pIdx].options = options;
        updateConfig(newProcesses);
    };

    const handleDeleteTopic = (processId, index) => {
        if (!window.confirm("Deseja excluir este tópico? Isso não afetará dados já salvos, mas o item não aparecerá mais no menu.")) return;
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

    // --- AÇÕES DO USUÁRIO ---
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
        } catch (err) { console.error(err); }
    };

    const handleAddComment = async () => {
        if (!newCommentText.trim() || !activeShipComment || !user) return;
        const newComment = { id: Date.now(), text: newCommentText.trim(), timestamp: Date.now(), user: user.email };
        const updatedComments = [...(activeShipComment.comments || []), newComment];
        try {
            await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', activeShipComment.id), { comments: updatedComments });
            logAction("COMENTARIO", `Nota em ${activeShipComment.vessel}`);
            setNewCommentText("");
            setActiveShipComment({...activeShipComment, comments: updatedComments});
        } catch (err) { console.error(err); }
    };

    const calculateProgress = (ship) => {
        if (processes.length === 0) return 0;
        let totalPossiblePoints = 0;
        let pointsAcquired = 0;

        processes.forEach(proc => {
            totalPossiblePoints += (proc.options?.length || 0);
            const selected = normalizeStatus(ship.status?.[proc.id]).filter(s => proc.options.includes(s));
            pointsAcquired += selected.length;
        });

        if (totalPossiblePoints === 0) return 0;
        return Math.round((pointsAcquired / totalPossiblePoints) * 100);
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
            return `PERÍODO OBL: ${new Date(dateRange.start).toLocaleDateString('pt-PT')} A ${new Date(dateRange.end).toLocaleDateString('pt-PT')}`;
        }
        return 'OUTROS';
    };

    // --- FILTRAGEM E AGRUPAMENTO ---
    const filteredAndSearched = useMemo(() => {
        let base = shipments;
        
        if (activeTab === 'open') {
            base = base.filter(s => !s.isClosed && !s.isArchived);
        } else if (activeTab === 'closed') {
            base = base.filter(s => s.isClosed && !s.isArchived);
        } else if (activeTab === 'archive') {
            base = base.filter(s => s.isArchived);
        }
        
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

    // --- EXPORTAÇÃO ---
    const handleExport = (format) => {
        if (format === 'spreadsheet-pdf') { setIsCompactMode(true); setIsExportMenuOpen(false); return; }
        const dataToExport = selectedShipments.size > 0 ? shipments.filter(s => selectedShipments.has(s.id)) : filteredAndSearched;

        if (format === 'csv' || format === 'excel') {
            let content = "Porto;Navio;Referência;Data OBL;Progresso;Itens Selecionados\n";
            dataToExport.forEach(s => {
                const markers = processes.map(p => {
                    const statusArray = normalizeStatus(s.status?.[p.id]).filter(opt => p.options.includes(opt));
                    return `${p.name}: ${statusArray.join(', ')}`;
                }).join(' | ');
                content += `${s.port};${s.vessel};${s.serviceNum};${s.oblDate || '-'};${calculateProgress(s)}%;${markers}\n`;
            });
            const blob = new Blob([content], { type: format === 'excel' ? 'application/vnd.ms-excel' : 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `doccontrol_export_${activeTab}_obl_${new Date().getTime()}.${format === 'excel' ? 'xls' : 'csv'}`;
            link.click();
        } else if (format === 'pdf') { window.print(); }
        setIsExportMenuOpen(false);
    };

    if (loading) return (
        <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
            <Loader2 className="animate-spin text-blue-600" size={40} />
            <p className="text-slate-500 font-medium tracking-tight">DocControl Vale: Carregando banco de dados...</p>
        </div>
    );

    if (!user) return (
        <div className="h-screen flex items-center justify-center bg-slate-100 p-4 font-sans text-slate-900">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white">
                <div className="bg-slate-900 p-10 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                    <div className="inline-flex bg-blue-600 p-4 rounded-2xl mb-4 relative z-10 shadow-lg"><Ship size={32} className="text-white" /></div>
                    <h1 className="text-3xl font-bold text-white relative z-10">DocControl <span className="text-blue-400">Pro</span></h1>
                    <p className="text-slate-400 text-xs mt-2 font-black uppercase tracking-widest">Vale S.A. Logística</p>
                </div>
                <div className="p-10">
                    {loginError && <div className="mb-6 p-4 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 flex items-start gap-3"><AlertTriangle size={16} className="shrink-0" /><span>{loginError}</span></div>}
                    <form onSubmit={handleLogin} className="space-y-5">
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-all" placeholder="E-mail Corporativo" required />
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-all" placeholder="Senha de Acesso" required />
                        <button type="submit" disabled={isLoggingIn} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-blue-600 transition-all shadow-lg active:scale-95">{isLoggingIn ? "Autenticando..." : "Aceder ao Sistema"}</button>
                    </form>
                </div>
            </div>
        </div>
    );

    return (
        <div className={`min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900 overflow-x-hidden ${isCompactMode ? 'compact-active' : ''}`}>
            <style>{`
                @media print {
                    @page { size: A4 portrait; margin: 5mm; }
                    body { background: white !important; color: black !important; -webkit-print-color-adjust: exact; }
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                    .main-container { padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; }
                    .group-section { break-inside: avoid; border: 1px solid #000; margin-bottom: 10px; border-radius: 0; page-break-inside: avoid; }
                    table { width: 100% !important; border-collapse: collapse; table-layout: fixed; }
                    th, td { border: 1px solid #000; padding: 4px !important; overflow: hidden; text-overflow: ellipsis; font-size: 8px !important; }
                    th { background-color: #f0f0f0 !important; font-weight: bold; }
                    .compact-active table { font-size: 6px !important; }
                    .compact-active th, .compact-active td { padding: 2px !important; height: 12px; }
                    .progress-bar { display: none !important; }
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
                <div className="hidden print:block mb-4 text-center border-b border-black pb-2">
                    <div className="flex justify-between items-center">
                        <div className="text-sm font-black uppercase text-slate-900">Vale S.A. - Logística de Atendimentos</div>
                        <div className="text-[9px] font-bold text-slate-700">{isCompactMode ? 'PLANILHA CONSOLIDADA' : 'RELATÓRIO OPERACIONAL'}</div>
                    </div>
                </div>

                {viewMode === 'master' ? (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        {/* Gestão de Terminais */}
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-slate-800"><MapPin className="text-amber-500" /> Gestão de Terminais</h2>
                            <div className="flex gap-2 mb-6">
                                <input type="text" value={newPortName} onChange={e => setNewPortName(e.target.value)} placeholder="Nome do Terminal" className="flex-1 p-4 border rounded-2xl outline-none bg-slate-50 focus:ring-2 focus:ring-blue-500" />
                                <button onClick={async () => {
                                    if(!newPortName.trim()) return;
                                    await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'config', 'main'), { ports: [...ports, newPortName.trim()] });
                                    setNewPortName('');
                                }} className="bg-blue-600 text-white px-8 rounded-2xl font-bold active:scale-95 transition-all shadow-lg shadow-blue-600/20">Adicionar Terminal</button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {ports.map((p, idx) => (
                                    <div key={idx} className="bg-slate-100 px-4 py-2 rounded-xl flex items-center gap-3 border border-slate-200">
                                        <span className="text-sm font-bold text-slate-600">{p}</span>
                                        <button onClick={async () => {
                                            if(window.confirm("Remover terminal?")) {
                                                const next = ports.filter((_, i) => i !== idx);
                                                await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'config', 'main'), { ports: next });
                                            }
                                        }} className="text-red-400 hover:text-red-600"><X size={14}/></button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Gestão de Processos e Tópicos */}
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-slate-800"><Settings2 className="text-blue-500" /> Configuração de Menus Suspensos</h2>
                            <div className="grid md:grid-cols-3 gap-8">
                                {processes.map(proc => (
                                    <div key={proc.id} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 flex flex-col">
                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="font-black text-xs text-blue-600 uppercase tracking-widest">{proc.name}</h3>
                                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-bold">{proc.options?.length || 0} Itens</span>
                                        </div>
                                        <div className="flex-1 space-y-2 mb-6">
                                            {proc.options?.map((opt, idx) => (
                                                <div key={idx} className="bg-white p-3 rounded-2xl border border-slate-100 flex items-center justify-between group shadow-sm">
                                                    {editingTopic.processId === proc.id && editingTopic.index === idx ? (
                                                        <div className="flex flex-1 gap-2">
                                                            <input autoFocus className="flex-1 text-[11px] font-bold outline-none border-b-2 border-blue-500 uppercase" value={editingTopic.value} onChange={e => setEditingTopic({...editingTopic, value: e.target.value})} onBlur={handleSaveEditTopic} onKeyDown={e => e.key === 'Enter' && handleSaveEditTopic()} />
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <span className="text-[11px] font-bold text-slate-700 uppercase truncate pr-2">{opt}</span>
                                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => handleMoveTopic(proc.id, idx, -1)} className="p-1 text-slate-400 hover:text-blue-600"><ArrowUp size={12}/></button>
                                                                <button onClick={() => handleMoveTopic(proc.id, idx, 1)} className="p-1 text-slate-400 hover:text-blue-600"><ArrowDown size={12}/></button>
                                                                <button onClick={() => setEditingTopic({ processId: proc.id, index: idx, value: opt })} className="p-1 text-slate-400 hover:text-amber-600"><Edit2 size={12}/></button>
                                                                <button onClick={() => handleDeleteTopic(proc.id, idx)} className="p-1 text-slate-400 hover:text-red-500"><Trash size={12}/></button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="relative">
                                            <input className="w-full p-4 pr-12 bg-white border border-slate-200 rounded-2xl text-[11px] font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500" placeholder="Novo item..." value={newTopic.processId === proc.id ? newTopic.value : ""} onChange={e => setNewTopic({ processId: proc.id, value: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleAddTopic(proc.id)} />
                                            <button onClick={() => handleAddTopic(proc.id)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-xl shadow-lg active:scale-90 transition-all"><PlusCircle size={18}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Auditoria */}
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 tracking-tight"><ClipboardList className="text-blue-500" /> Log de Auditoria</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-black">
                                        <tr><th className="p-4">Timestamp</th><th className="p-4">Usuário</th><th className="p-4">Ação Realizada</th></tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {logs.map(log => (
                                            <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-4 font-mono text-[11px]">{new Date(log.timestamp).toLocaleString('pt-PT')}</td>
                                                <td className="p-4 font-bold text-blue-600">{log.user}</td>
                                                <td className="p-4 text-slate-500 text-xs font-medium">{log.details}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col gap-6 no-print">
                            <div className="flex flex-col md:flex-row gap-4 items-center">
                                <div className="flex-1 relative w-full group">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500" size={20} />
                                    <input type="text" placeholder="Pesquisa inteligente (Navio, AT, Terminal)..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-all" />
                                    {searchTerm && <button onClick={() => setSearchTerm("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-500 transition-all"><X size={20} /></button>}
                                </div>
                                <div className="relative" ref={exportMenuRef}>
                                    <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 active:scale-95"><Download size={18} /> Exportar</button>
                                    {isExportMenuOpen && (
                                        <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[100] animate-in slide-in-from-top-2 duration-200 overflow-hidden">
                                            <button onClick={() => handleExport('pdf')} className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 text-slate-700 font-bold transition-colors border-b"><Printer className="text-blue-600" size={18} /> PDF: Formulário Individual</button>
                                            <button onClick={() => handleExport('spreadsheet-pdf')} className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 text-slate-700 font-bold transition-colors border-b bg-blue-50/30"><Table className="text-indigo-600" size={18} /> PDF: Planilha Consolidada</button>
                                            <button onClick={() => handleExport('excel')} className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 text-slate-700 font-bold transition-colors"><FileSpreadsheet className="text-green-600" size={18} /> EXCEL: Tabela XLS</button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <form onSubmit={handleAddShipment} className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end border-t border-slate-100 pt-6">
                                <div className="flex flex-col gap-1 w-full"><label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Localidade</label>
                                    <select value={formPort} onChange={e => setFormPort(e.target.value)} className="p-4 border rounded-2xl bg-slate-50 font-bold outline-none border-slate-200 focus:ring-2 focus:ring-blue-500 cursor-pointer h-[58px]">
                                        {ports.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1 w-full"><label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Navio & AT</label>
                                    <div className="flex gap-2 h-[58px]"><input type="text" placeholder="AT" value={newVessel.serviceNum} onChange={e => setNewVessel({...newVessel, serviceNum: e.target.value})} className="w-20 border p-4 rounded-2xl bg-slate-50 font-bold outline-none focus:ring-2 focus:ring-blue-500" required />
                                        <input type="text" placeholder="Nome do Navio" value={newVessel.vesselName} onChange={e => setNewVessel({...newVessel, vesselName: e.target.value})} className="flex-1 border p-4 rounded-2xl uppercase bg-slate-50 font-bold outline-none focus:ring-2 focus:ring-blue-500" required />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1 w-full"><label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Base de Tempo (OBL)</label>
                                    <input type="date" value={newVessel.oblDate} onChange={e => setNewVessel({...newVessel, oblDate: e.target.value})} className="w-full border p-4 rounded-2xl bg-slate-50 font-bold h-[58px] focus:ring-2 focus:ring-blue-500 outline-none" required />
                                </div>
                                <button type="submit" className="bg-blue-600 text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 shadow-xl transition-all active:scale-95 h-[58px]"><PlusCircle size={20} /> Abrir Pasta</button>
                            </form>
                        </div>

                        <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-200 no-print px-2">
                            <div className="flex gap-2">
                                <button onClick={() => { setActiveTab('open'); setSelectedShipments(new Set()); }} className={`px-6 py-4 text-sm font-bold border-b-4 transition-all ${activeTab === 'open' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Operacional</button>
                                <button onClick={() => { setActiveTab('closed'); setSelectedShipments(new Set()); }} className={`px-6 py-4 text-sm font-bold border-b-4 transition-all ${activeTab === 'closed' ? 'border-green-600 text-green-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Histórico</button>
                                <button onClick={() => { setActiveTab('archive'); setSelectedShipments(new Set()); }} className={`px-6 py-4 text-sm font-bold border-b-4 transition-all ${activeTab === 'archive' ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Arquivo</button>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 mb-2">
                                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
                                    <Filter size={14} className="text-blue-500" />
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Agrupar por:</span>
                                    <select value={groupBy} onChange={e => setGroupBy(e.target.value)} className="text-xs font-bold text-blue-600 outline-none bg-transparent cursor-pointer">
                                        <option value="port">Por Porto</option>
                                        <option value="month">Por Mês</option>
                                        <option value="quarter">Por Trimestre</option>
                                        <option value="year">Por Ano</option>
                                        <option value="range">Intervalo Personalizado</option>
                                    </select>
                                </div>
                                {groupBy === 'range' && (
                                    <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-2xl border border-blue-100 shadow-sm animate-in slide-in-from-right-2 duration-300">
                                        <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="bg-transparent text-xs font-bold text-blue-700 outline-none" />
                                        <span className="text-[10px] font-black text-blue-300">A</span>
                                        <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="bg-transparent text-xs font-bold text-blue-700 outline-none" />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-10 pb-20">
                            {Object.keys(groups).length > 0 ? Object.keys(groups).sort((a,b) => b.localeCompare(a)).map(gName => {
                                const isCollapsed = collapsedGroups[gName];
                                const groupShips = groups[gName];
                                return (
                                    <div key={gName} className={`group-section bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden animate-in fade-in duration-500 ${isCollapsed ? 'opacity-70' : ''}`}>
                                        <div className="group-header bg-slate-50/80 px-8 py-4 border-b flex justify-between items-center backdrop-blur-sm print:bg-slate-100">
                                            <h3 onClick={() => setCollapsedGroups(p => ({...p, [gName]: !p[gName]}))} className="text-[11px] font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-3 cursor-pointer group select-none">
                                                {isCollapsed ? <ChevronRight size={18} className="text-blue-500" /> : <ChevronDown size={18} className="text-blue-500" />}
                                                {groupBy === 'port' ? <MapPin size={16} /> : <Calendar size={16} />}
                                                {gName}
                                            </h3>
                                            <span className="bg-blue-100 text-blue-700 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{groupShips.length} Atendimentos</span>
                                        </div>
                                        {!isCollapsed && (
                                            <div className="overflow-x-auto ">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="bg-slate-50/30 text-[10px] uppercase font-black text-slate-400 tracking-widest border-b border-slate-100">
                                                            <th className="p-6 w-12 no-print text-center">Sel.</th>
                                                            <th className="p-6 w-64">Embarcação / AT</th>
                                                            <th className="p-6 w-32 text-center">Data OBL</th>
                                                            {processes.map(p => <th key={p.id} className="p-6 text-center">{p.name}</th>)}
                                                            <th className="p-6 text-center no-print w-48 action-col">Gestão</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {groupShips.map(ship => {
                                                            const prog = calculateProgress(ship);
                                                            const isSelected = selectedShipments.has(ship.id);
                                                            return (
                                                                <tr key={ship.id} className={`hover:bg-slate-50/50 transition-colors ${isSelected ? 'bg-blue-50/30 selected-row' : ''}`}>
                                                                    <td className="p-6 no-print text-center">
                                                                        <button onClick={() => {
                                                                            const next = new Set(selectedShipments);
                                                                            if (next.has(ship.id)) next.delete(ship.id); else next.add(ship.id);
                                                                            setSelectedShipments(next);
                                                                        }} className="text-slate-300 hover:text-blue-600 transition-all">
                                                                            {isSelected ? <CheckSquare className="text-blue-600" size={22} /> : <Square size={22} />}
                                                                        </button>
                                                                    </td>
                                                                    <td className="p-6">
                                                                        <div className="vessel-info flex items-center gap-4">
                                                                            <div className="ship-icon-box p-3 rounded-2xl shadow-sm bg-blue-50 text-blue-600 print:hidden"><Ship size={20} /></div>
                                                                            <div>
                                                                                <div className="vessel-name font-black text-[13px] uppercase text-slate-800 tracking-tight">{ship.vessel}</div>
                                                                                <div className="vessel-ref text-[10px] text-blue-600 font-bold font-mono uppercase mt-1">{(ship.serviceNum || "S/ REF")}</div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="mt-4 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden progress-bar">
                                                                            <div className={`h-full transition-all duration-1000 ${prog === 100 ? 'bg-green-500' : 'bg-blue-600'}`} style={{width: `${prog}%`}}></div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="p-4 text-center">
                                                                        <input type="date" disabled={activeTab === 'archive'} value={ship.oblDate || ""} onChange={async (e) => await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', ship.id), { oblDate: e.target.value })} className="bg-transparent text-[10px] font-black text-slate-700 outline-none w-full text-center hover:bg-slate-100 p-2 rounded-lg cursor-pointer" />
                                                                    </td>
                                                                    {processes.map(p => {
                                                                        const rawStatus = ship.status?.[p.id];
                                                                        const statusArray = normalizeStatus(rawStatus).filter(opt => p.options.includes(opt));
                                                                        return (
                                                                            <td key={p.id} className="p-4 text-center">
                                                                                <div className="hidden print:block text-[8px] font-bold uppercase leading-tight text-slate-900">
                                                                                    {statusArray.length > 0 ? statusArray.join(", ") : "NENHUM"}
                                                                                </div>
                                                                                <div className="no-print">
                                                                                    <MultiSelectCell 
                                                                                        processName={p.name}
                                                                                        options={p.options || []}
                                                                                        selected={rawStatus}
                                                                                        disabled={activeTab === 'archive'}
                                                                                        onChange={async (newVal) => {
                                                                                            await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', ship.id), { [`status.${p.id}`]: newVal });
                                                                                            logAction("MARCADORES", `${ship.vessel}: ${p.name} -> [${newVal.join(', ')}]`);
                                                                                        }}
                                                                                    />
                                                                                </div>
                                                                            </td>
                                                                        );
                                                                    })}
                                                                    <td className="p-6 text-center no-print action-col">
                                                                        <div className="flex gap-2 justify-center">
                                                                            <button onClick={() => setActiveShipComment(ship)} className={`p-3 rounded-xl relative transition-all shadow-sm ${ship.comments?.length > 0 ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-200'}`}>
                                                                                <MessageSquare size={18} />
                                                                                {ship.comments?.length > 0 && <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[8px] font-bold px-1 rounded-full">{ship.comments.length}</span>}
                                                                            </button>
                                                                            {activeTab === 'open' && (
                                                                                <button onClick={async () => {
                                                                                    await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', ship.id), { isClosed: true, closedAt: Date.now() });
                                                                                    logAction("FECHAR_PASTA", `Navio ${ship.vessel} movido para Histórico`);
                                                                                }} className="p-3 rounded-xl bg-green-50 text-green-700 border border-green-100 hover:bg-green-600 hover:text-white transition-all shadow-sm"><CheckCircle size={18} /></button>
                                                                            )}
                                                                            {activeTab === 'closed' && (
                                                                                <>
                                                                                    <button onClick={async () => {
                                                                                        await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', ship.id), { isClosed: false, closedAt: null });
                                                                                        logAction("REABRIR_PASTA", `Navio ${ship.vessel} reaberto`);
                                                                                    }} className="p-3 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-600 hover:text-white transition-all shadow-sm"><RotateCcw size={18} /></button>
                                                                                    <button onClick={async () => {
                                                                                        await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', ship.id), { isArchived: true });
                                                                                        logAction("ARQUIVAR", `Navio ${ship.vessel} arquivado`);
                                                                                    }} className="p-3 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-600 hover:text-white transition-all shadow-sm"><Archive size={18} /></button>
                                                                                </>
                                                                            )}
                                                                            {activeTab === 'archive' && (
                                                                                <button onClick={async () => {
                                                                                    await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', ship.id), { isArchived: false });
                                                                                    logAction("DESARQUIVAR", `Navio ${ship.vessel} restaurado`);
                                                                                }} className="p-3 rounded-xl bg-slate-50 text-slate-700 border border-slate-100 hover:bg-slate-600 hover:text-white transition-all shadow-sm"><RotateCcw size={18} /></button>
                                                                            )}
                                                                            <button onClick={async () => { if(window.confirm(`Eliminar permanentemente ${ship.vessel}?`)) await deleteDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', ship.id)); }} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all border border-red-50"><Trash size={18} /></button>
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
                                <div className="h-96 flex flex-col items-center justify-center opacity-40 gap-4">
                                    <Anchor size={64} className="animate-pulse text-slate-300" />
                                    <p className="font-black uppercase tracking-widest text-xs text-slate-400">Nenhum registo nesta categoria</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Modal de Comentários */}
            {activeShipComment && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl flex flex-col h-[650px] max-h-[90vh] overflow-hidden border border-white animate-in slide-in-from-bottom-8">
                        <div className="bg-slate-900 p-8 text-white flex justify-between items-center relative">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                            <div className="z-10"><h3 className="text-xl font-bold uppercase tracking-tight">{activeShipComment.vessel}</h3><p className="text-blue-400 text-[10px] font-black mt-1 uppercase tracking-[0.2em]">Caderno de Observações</p></div>
                            <button onClick={() => setActiveShipComment(null)} className="z-10 p-2 bg-slate-800 rounded-full hover:bg-red-500 transition-colors"><X size={24} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-slate-50/50">
                            {(activeShipComment.comments || []).sort((a,b) => b.timestamp - a.timestamp).map(comm => (
                                <div key={comm.id} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 space-y-3 animate-in slide-in-from-right-4">
                                    <div className="flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-2 py-1 rounded-lg"><User size={10} /> <span>{comm.user.split('@')[0]}</span></div>
                                        <div className="flex items-center gap-1.5"><Clock size={10} /> <span>{new Date(comm.timestamp).toLocaleString('pt-PT')}</span></div>
                                    </div>
                                    <p className="text-[13px] text-slate-600 font-medium leading-relaxed">{comm.text}</p>
                                </div>
                            ))}
                        </div>
                        <div className="p-8 bg-white border-t border-slate-100 no-print">
                            <div className="relative group"><textarea value={newCommentText} onChange={e => setNewCommentText(e.target.value)} placeholder="Escrever nota importante..." className="w-full p-5 pb-16 bg-slate-50 border border-slate-200 rounded-[2rem] outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium resize-none transition-all focus:bg-white" rows="3" />
                                <button onClick={handleAddComment} disabled={!newCommentText.trim()} className="absolute bottom-4 right-4 bg-blue-600 text-white p-3 rounded-2xl shadow-xl hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2 active:scale-95 shadow-blue-600/20"><Send size={18} /><span className="text-xs font-bold uppercase tracking-widest">Registar</span></button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            <footer className="hidden print:block fixed bottom-0 left-0 right-0 text-[6px] text-slate-400 text-center py-2 border-t bg-white uppercase font-bold tracking-widest">
                Logística Vale S.A. | DocControl Pro | Filtros Aplicados via Pesquisa e Intervalo OBL
            </footer>
        </div>
    );
}
