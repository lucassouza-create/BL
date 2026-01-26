import React, { useState, useEffect, useMemo } from 'react';
import { 
    Ship, Settings, LayoutList, Settings2, MapPin, 
    PlusCircle, Container, Trash, Anchor, Folder, 
    MessageSquare, Archive, RefreshCcw, CheckCircle, 
    Loader2, AlertTriangle, LogOut, Calendar, 
    ListFilter, ChevronDown, ChevronRight,
    Printer, FileSpreadsheet, FileText, CheckSquare, Square
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, setDoc, query } from "firebase/firestore";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";

// --- CONFIGURAÇÃO OFICIAL ENVIADA POR VOCÊ ---
const firebaseConfig = {
  apiKey: "AIzaSyDzfx_lsbaYZinR87qEQZ0Alvz5D8pUCJI",
  authDomain: "doc-control---vale.firebaseapp.com",
  projectId: "doc-control---vale",
  storageBucket: "doc-control---vale.firebasestorage.app",
  messagingSenderId: "475792494162",
  appId: "1:475792494162:web:83a0601f5f2b37e926198b"
};

// Inicialização
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Caminhos de dados
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

    const [ports, setPorts] = useState([]);
    const [processes, setProcesses] = useState([]);
    const [shipments, setShipments] = useState([]);
    const [formPort, setFormPort] = useState("");
    const [newVessel, setNewVessel] = useState({ serviceNum: '', vesselName: '' });
    const [newPortName, setNewPortName] = useState('');

    // Monitorar estado de autenticação
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Carregar Configurações (Portos e Processos)
    useEffect(() => {
        if (!user) return;
        const configRef = doc(db, 'artifacts', APP_ID, DATA_PATH, 'config', 'main');
        const unsubscribe = onSnapshot(configRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setPorts(data.ports || []);
                setProcesses(data.processes || []);
                if (data.ports?.length > 0 && !formPort) {
                    setFormPort(data.ports[0]);
                }
            } else {
                // Se não existir, cria uma config inicial básica
                setDoc(configRef, {
                    ports: ["Ponta da Madeira", "Tubaraão", "Itaguaí"],
                    processes: [
                        { id: "docs", name: "Documentação", options: ["PENDENTE", "EM ANÁLISE", "APROVADO"] },
                        { id: "carga", name: "Operação Carga", options: ["AGUARDANDO", "INICIADO", "CONCLUÍDO"] }
                    ]
                });
            }
        });
        return () => unsubscribe();
    }, [user]);

    // Carregar Navios (Shipments)
    useEffect(() => {
        if (!user) return;
        const shipmentsRef = collection(db, 'artifacts', APP_ID, DATA_PATH, 'shipments');
        const unsubscribe = onSnapshot(query(shipmentsRef), (snapshot) => {
            setShipments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [user]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError("");
        setIsLoggingIn(true);
        try { 
            await signInWithEmailAndPassword(auth, email.trim(), password); 
        } catch (error) {
            console.error("Erro de login:", error.code);
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                setLoginError("E-mail ou senha incorretos. Verifique se o usuário foi criado no console do Firebase.");
            } else {
                setLoginError("Erro ao conectar ao Firebase: " + error.code);
            }
            setIsLoggingIn(false);
        }
    };

    const handleLogout = () => signOut(auth);

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
            setNewVessel({ serviceNum: '', vesselName: '' });
        } catch (err) {
            console.error("Erro ao adicionar navio:", err);
        }
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

    const filteredShipments = useMemo(() => {
        return shipments.filter(s => activeTab === 'open' ? !s.isClosed : s.isClosed);
    }, [shipments, activeTab]);

    const groups = useMemo(() => {
        const g = {};
        filteredShipments.forEach(ship => {
            const groupName = ship.port || "Sem Porto";
            if (!g[groupName]) g[groupName] = [];
            g[groupName].push(ship);
        });
        return g;
    }, [filteredShipments]);

    if (loading) return (
        <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
            <Loader2 className="animate-spin text-blue-600" size={40} />
            <p className="text-slate-500 font-medium">Conectando ao banco de dados...</p>
        </div>
    );

    if (!user) return (
        <div className="h-screen flex items-center justify-center bg-slate-100 p-4 font-sans">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white">
                <div className="bg-slate-900 p-10 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                    <div className="inline-flex bg-blue-600 p-4 rounded-2xl mb-4 relative z-10 shadow-lg shadow-blue-600/20">
                        <Ship size={32} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white relative z-10">DocControl <span className="text-blue-400">Pro</span></h1>
                    <p className="text-slate-400 text-sm mt-2 font-medium">Logística Vale</p>
                </div>
                <div className="p-10">
                    {loginError && (
                        <div className="mb-6 p-4 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 flex items-start gap-3">
                            <AlertTriangle size={16} className="shrink-0" />
                            <span>{loginError}</span>
                        </div>
                    )}
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
                            <input 
                                type="email" 
                                value={email} 
                                onChange={e => setEmail(e.target.value)} 
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" 
                                placeholder="usuario@vale.com" 
                                required 
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Senha</label>
                            <input 
                                type="password" 
                                value={password} 
                                onChange={e => setPassword(e.target.value)} 
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" 
                                placeholder="••••••••" 
                                required 
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={isLoggingIn} 
                            className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-blue-600 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
                        >
                            {isLoggingIn ? "Autenticando..." : "Entrar no Sistema"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
            <header className="bg-slate-900 text-white p-4 px-6 shadow-xl flex justify-between items-center z-30 sticky top-0 no-print">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-600/20"><Ship size={24} /></div>
                    <h1 className="text-xl font-bold tracking-tight">DocControl <span className="text-blue-400">Pro</span></h1>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setViewMode(viewMode === 'user' ? 'master' : 'user')} 
                        className={`p-2.5 rounded-xl transition-all ${viewMode === 'master' ? 'bg-amber-500 shadow-lg' : 'bg-slate-800 hover:bg-slate-700'}`}
                    >
                        {viewMode === 'user' ? <Settings size={20} /> : <LayoutList size={20} />}
                    </button>
                    <button onClick={handleLogout} className="bg-red-500/10 text-red-400 p-2.5 rounded-xl hover:bg-red-500 hover:text-white transition-all">
                        <LogOut size={20} />
                    </button>
                </div>
            </header>

            <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
                {viewMode === 'master' ? (
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-slate-800">
                            <Settings2 className="text-amber-500" /> Painel Administrativo
                        </h2>
                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h3 className="font-bold text-slate-500 text-xs uppercase tracking-widest">Adicionar Porto</h3>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={newPortName} 
                                        onChange={e => setNewPortName(e.target.value)} 
                                        placeholder="Ex: Porto de Tubarão" 
                                        className="flex-1 p-4 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" 
                                    />
                                    <button 
                                        onClick={async () => {
                                            if(!newPortName.trim()) return;
                                            await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'config', 'main'), { ports: [...ports, newPortName.trim()] });
                                            setNewPortName('');
                                        }} 
                                        className="bg-blue-600 text-white px-8 rounded-2xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20"
                                    >
                                        Adicionar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8 animate-in fade-in duration-700">
                        {/* Cadastro Rápido */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col lg:flex-row gap-6 items-end no-print">
                            <div className="flex flex-col gap-2 flex-1 w-full">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Terminal de Atendimento</label>
                                <select 
                                    value={formPort} 
                                    onChange={e => setFormPort(e.target.value)} 
                                    className="p-4 border rounded-2xl bg-slate-50 font-bold outline-none border-slate-200 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                >
                                    {ports.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <form onSubmit={handleAddShipment} className="flex-[3] flex flex-col md:flex-row gap-4 w-full items-end">
                                <div className="flex-1 w-full gap-2 flex flex-col">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nº Atendimento</label>
                                    <input 
                                        type="text" 
                                        placeholder="Referência" 
                                        value={newVessel.serviceNum} 
                                        onChange={e => setNewVessel({...newVessel, serviceNum: e.target.value})} 
                                        className="w-full border p-4 rounded-2xl outline-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500" 
                                        required 
                                    />
                                </div>
                                <div className="flex-[2] w-full gap-2 flex flex-col">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome da Embarcação</label>
                                    <input 
                                        type="text" 
                                        placeholder="Ex: MV OCEAN SPIRIT" 
                                        value={newVessel.vesselName} 
                                        onChange={e => setNewVessel({...newVessel, vesselName: e.target.value})} 
                                        className="w-full border p-4 rounded-2xl outline-none uppercase bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500" 
                                        required 
                                    />
                                </div>
                                <button 
                                    type="submit" 
                                    className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-700 shadow-xl shadow-blue-600/20 transition-all active:scale-95 h-[58px]"
                                >
                                    <PlusCircle size={20} /> Abrir Pasta
                                </button>
                            </form>
                        </div>

                        {/* Navegação de Abas */}
                        <div className="flex justify-between items-center border-b border-slate-200 no-print px-2">
                            <div className="flex gap-4">
                                <button 
                                    onClick={() => setActiveTab('open')} 
                                    className={`px-8 py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'open' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                >
                                    Em Operação
                                </button>
                                <button 
                                    onClick={() => setActiveTab('closed')} 
                                    className={`px-8 py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'closed' ? 'border-green-600 text-green-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                >
                                    Encerrados
                                </button>
                            </div>
                        </div>

                        {/* Listagem em Grupos */}
                        <div className="space-y-10">
                            {Object.keys(groups).length > 0 ? Object.keys(groups).map(gName => (
                                <div key={gName} className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden animate-in fade-in zoom-in duration-500">
                                    <div className="bg-slate-50/80 px-8 py-5 border-b flex justify-between items-center backdrop-blur-sm">
                                        <h3 className="text-xs font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-3">
                                            <MapPin size={16} className="text-blue-500" /> {gName}
                                        </h3>
                                        <span className="bg-blue-100 text-blue-700 px-4 py-1 rounded-full text-[10px] font-bold">
                                            {groups[gName].length} {groups[gName].length === 1 ? 'Navio' : 'Navios'}
                                        </span>
                                    </div>
                                    <div className="overflow-x-auto custom-scrollbar">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="bg-slate-50/30 text-[10px] uppercase font-black text-slate-400 tracking-widest border-b border-slate-100">
                                                    <th className="p-6 w-80">Embarcação / Ref.</th>
                                                    {processes.map(p => <th key={p.id} className="p-6 text-center">{p.name}</th>)}
                                                    <th className="p-6 text-center no-print w-32">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {groups[gName].map(ship => (
                                                    <tr key={ship.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="p-6">
                                                            <div className="flex items-center gap-4">
                                                                <div className={`p-3 rounded-2xl ${ship.isClosed ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600'}`}>
                                                                    <Ship size={20} />
                                                                </div>
                                                                <div>
                                                                    <div className="font-black text-sm uppercase text-slate-800 tracking-tight">{ship.vessel}</div>
                                                                    <div className="text-[11px] text-blue-600 font-bold font-mono mt-0.5">{ship.serviceNum}</div>
                                                                </div>
                                                            </div>
                                                            <div className="mt-4 w-full bg-slate-100 h-2 rounded-full overflow-hidden shadow-inner">
                                                                <div 
                                                                    className={`h-full transition-all duration-1000 ${calculateProgress(ship) === 100 ? 'bg-green-500' : 'bg-blue-600'}`} 
                                                                    style={{width: `${calculateProgress(ship)}%`}}
                                                                ></div>
                                                            </div>
                                                        </td>
                                                        {processes.map(p => (
                                                            <td key={p.id} className="p-4 text-center">
                                                                <select 
                                                                    disabled={activeTab === 'closed'}
                                                                    value={ship.status?.[p.id] || ""}
                                                                    onChange={e => updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', ship.id), { [`status.${p.id}`]: e.target.value })}
                                                                    className={`text-[10px] font-black p-3 rounded-xl border w-full outline-none transition-all appearance-none text-center cursor-pointer ${
                                                                        ship.status?.[p.id]?.includes('APROVADO') || ship.status?.[p.id]?.includes('CONCLUÍDO')
                                                                        ? 'bg-green-50 text-green-700 border-green-100 shadow-sm shadow-green-100' 
                                                                        : 'bg-white border-slate-100 hover:border-blue-200'
                                                                    }`}
                                                                >
                                                                    {p.options.map(o => <option key={o} value={o}>{o}</option>)}
                                                                </select>
                                                            </td>
                                                        ))}
                                                        <td className="p-6 text-center no-print">
                                                            <div className="flex gap-3 justify-center">
                                                                <button 
                                                                    onClick={async () => {
                                                                        const newState = !ship.isClosed;
                                                                        await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', ship.id), { 
                                                                            isClosed: newState, 
                                                                            closedAt: newState ? Date.now() : null 
                                                                        });
                                                                    }} 
                                                                    className={`p-3 rounded-xl transition-all shadow-sm active:scale-90 ${activeTab === 'open' ? 'bg-green-50 text-green-600 border border-green-100 hover:bg-green-600 hover:text-white' : 'bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-600 hover:text-white'}`}
                                                                    title={activeTab === 'open' ? "Finalizar" : "Reabrir"}
                                                                >
                                                                    {activeTab === 'open' ? <CheckCircle size={20} /> : <RefreshCcw size={20} />}
                                                                </button>
                                                                <button 
                                                                    onClick={async () => {
                                                                        if (window.confirm("Deseja apagar permanentemente este registro?")) {
                                                                            await deleteDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', ship.id));
                                                                        }
                                                                    }} 
                                                                    className="p-3 bg-red-50 text-red-500 rounded-xl border border-red-100 hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-90"
                                                                >
                                                                    <Trash size={20} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )) : (
                                <div className="h-96 flex flex-col items-center justify-center bg-white border border-slate-200 border-dashed rounded-[3rem] text-slate-300 gap-6 opacity-60">
                                    <div className="bg-slate-50 p-8 rounded-full shadow-inner"><Anchor size={64} className="animate-pulse" /></div>
                                    <p className="font-black uppercase tracking-[0.3em] text-xs">Aguardando novos registros</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
