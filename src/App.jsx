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
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signInWithCustomToken, signOut } from "firebase/auth";

// --- CONFIGURAÇÃO DO FIREBASE ---
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
    const [selectedGroups, setSelectedGroups] = useState(new Set());

    const [ports, setPorts] = useState([]);
    const [processes, setProcesses] = useState([]);
    const [shipments, setShipments] = useState([]);
    const [formPort, setFormPort] = useState("");
    const [newVessel, setNewVessel] = useState({ serviceNum: '', vesselName: '' });
    const [newPortName, setNewPortName] = useState('');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
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
                setFormPort(prev => prev || (data.ports?.[0] || ""));
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

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError("");
        setIsLoggingIn(true);
        try { 
            await signInWithEmailAndPassword(auth, email, password); 
        } catch (error) {
            setLoginError("E-mail ou senha incorretos.");
            setIsLoggingIn(false);
        }
    };

    const handleLogout = () => signOut(auth);

    const handleAddShipment = async (e) => {
        e.preventDefault();
        if (!newVessel.serviceNum || !newVessel.vesselName || !user) return;
        const initialStatus = {};
        processes.forEach(p => initialStatus[p.id] = p.options?.[0] || "");
        await addDoc(collection(db, 'artifacts', APP_ID, DATA_PATH, 'shipments'), {
            createdAt: Date.now(),
            closedAt: null,
            port: formPort,
            serviceNum: newVessel.serviceNum,
            vessel: newVessel.vesselName.toUpperCase(),
            status: initialStatus,
            comments: "",
            isClosed: false
        });
        setNewVessel({ serviceNum: '', vesselName: '' });
    };

    const updateShipmentField = async (id, field, value) => {
        await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', id), { [field]: value });
    };

    const toggleShipmentClosedState = (ship) => {
        const newState = !ship.isClosed;
        updateShipmentField(ship.id, 'isClosed', newState);
        updateShipmentField(ship.id, 'closedAt', newState ? Date.now() : null);
    };

    const deleteShipment = async (id) => {
        if (!window.confirm("Confirmar exclusão?")) return;
        await deleteDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', id));
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
        const date = new Date(ship.closedAt || ship.createdAt);
        if (criteria === 'port') return ship.port;
        if (criteria === 'month') return date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
        if (criteria === 'quarter') return `TRIMESTRE ${Math.floor(date.getMonth() / 3) + 1} - ${date.getFullYear()}`;
        if (criteria === 'year') return `ANO ${date.getFullYear()}`;
        return 'OUTROS';
    };

    const filteredShipments = useMemo(() => {
        return shipments.filter(s => activeTab === 'open' ? !s.isClosed : s.isClosed);
    }, [shipments, activeTab]);

    const groups = useMemo(() => {
        const g = {};
        filteredShipments.forEach(ship => {
            const groupName = activeTab === 'open' ? ship.port : getGroupName(ship, closedGroupBy);
            if (!g[groupName]) g[groupName] = [];
            g[groupName].push(ship);
        });
        return g;
    }, [filteredShipments, activeTab, closedGroupBy]);

    if (loading) return <div className="h-screen flex items-center justify-center bg-slate-100 text-slate-500 font-bold gap-2"><Loader2 className="animate-spin" /> Carregando...</div>;

    if (!user) return (
        <div className="h-screen flex items-center justify-center bg-slate-200 p-4 font-sans">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="bg-slate-900 p-8 text-center">
                    <div className="inline-flex bg-blue-600 p-3 rounded-xl mb-4"><Ship size={32} className="text-white" /></div>
                    <h1 className="text-2xl font-bold text-white">DocControl <span className="text-blue-400">Pro</span></h1>
                </div>
                <div className="p-8">
                    {loginError && <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">{loginError}</div>}
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="E-mail corporativo" required />
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="Senha" required />
                        <button type="submit" disabled={isLoggingIn} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-all">{isLoggingIn ? "Entrando..." : "Entrar"}</button>
                    </form>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen flex flex-col bg-slate-100 font-sans text-slate-900">
            <header className="bg-slate-900 text-white p-4 shadow-md flex justify-between items-center z-30 sticky top-0 no-print">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-lg"><Ship size={24} /></div>
                    <h1 className="text-xl font-bold tracking-tight">DocControl <span className="text-blue-400">Pro</span></h1>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => setViewMode(viewMode === 'user' ? 'master' : 'user')} className="p-2 bg-slate-700 rounded-md hover:bg-slate-600">
                        {viewMode === 'user' ? <Settings size={18} /> : <LayoutList size={18} />}
                    </button>
                    <button onClick={handleLogout} className="text-red-400 p-2 hover:bg-red-500/10 rounded-md"><LogOut size={18} /></button>
                </div>
            </header>

            <main className="flex-1 p-4 md:p-6 main-container overflow-auto">
                {viewMode === 'master' ? (
                    <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-sm no-print">
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Settings2 className="text-amber-600" /> Admin</h2>
                        <div className="flex gap-2">
                            <input type="text" value={newPortName} onChange={e => setNewPortName(e.target.value)} placeholder="Novo porto..." className="flex-1 p-3 border rounded-lg outline-none" />
                            <button onClick={async () => {
                                if(!newPortName.trim()) return;
                                await updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'config', 'main'), { ports: [...ports, newPortName.trim()] });
                                setNewPortName('');
                            }} className="bg-blue-600 text-white px-6 rounded-lg font-bold">Adicionar</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        {/* Cadastro */}
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 no-print items-end">
                            <div className="flex flex-col gap-1 flex-1 w-full">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Porto</label>
                                <select value={formPort} onChange={e => setFormPort(e.target.value)} className="p-2.5 border rounded-lg bg-slate-50 font-bold outline-none">
                                    {ports.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <form onSubmit={handleAddShipment} className="flex-[3] flex flex-col md:flex-row gap-3 w-full">
                                <input type="text" placeholder="Ref. AT" value={newVessel.serviceNum} onChange={e => setNewVessel({...newVessel, serviceNum: e.target.value})} className="flex-1 border p-2.5 rounded-lg outline-none" required />
                                <input type="text" placeholder="Navio" value={newVessel.vesselName} onChange={e => setNewVessel({...newVessel, vesselName: e.target.value})} className="flex-[2] border p-2.5 rounded-lg outline-none uppercase" required />
                                <button type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2"><PlusCircle size={18} /> Novo</button>
                            </form>
                        </div>

                        {/* Tabs */}
                        <div className="flex justify-between items-center border-b border-slate-200 no-print">
                            <div className="flex gap-2">
                                <button onClick={() => setActiveTab('open')} className={`px-6 py-3 text-sm font-bold border-b-2 ${activeTab === 'open' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>Em Curso</button>
                                <button onClick={() => setActiveTab('closed')} className={`px-6 py-3 text-sm font-bold border-b-2 ${activeTab === 'closed' ? 'border-green-600 text-green-700' : 'border-transparent text-slate-500'}`}>Encerrados</button>
                            </div>
                            {activeTab === 'closed' && (
                                <select value={closedGroupBy} onChange={e => setClosedGroupBy(e.target.value)} className="text-xs font-bold text-blue-600 bg-transparent outline-none p-2">
                                    <option value="port">Por Porto</option>
                                    <option value="month">Por Mês</option>
                                    <option value="year">Por Ano</option>
                                </select>
                            )}
                        </div>

                        {/* Grid */}
                        <div className="space-y-6">
                            {Object.keys(groups).sort((a,b) => b.localeCompare(a)).map(gName => (
                                <div key={gName} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                    <div className="bg-slate-50 px-4 py-3 border-b flex justify-between items-center">
                                        <h3 className="text-xs font-black uppercase text-slate-600 flex items-center gap-2"><MapPin size={14} className="text-blue-400" /> {gName}</h3>
                                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-mono">{groups[gName].length} itens</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="bg-slate-50/50 text-[10px] uppercase font-bold text-slate-400 border-b">
                                                    <th className="p-3 w-64">Embarcação</th>
                                                    {processes.map(p => <th key={p.id} className="p-3 text-center">{p.name}</th>)}
                                                    <th className="p-3 text-center no-print w-24">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {groups[gName].map(ship => (
                                                    <tr key={ship.id} className="hover:bg-slate-50/50">
                                                        <td className="p-3">
                                                            <div className="font-bold text-xs uppercase text-slate-800">{ship.vessel}</div>
                                                            <div className="text-[10px] text-blue-600 font-mono">{ship.serviceNum}</div>
                                                            <div className="mt-2 w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                                                <div className="h-full bg-blue-600" style={{width: `${calculateProgress(ship)}%`}}></div>
                                                            </div>
                                                        </td>
                                                        {processes.map(p => (
                                                            <td key={p.id} className="p-2 text-center">
                                                                <select 
                                                                    disabled={activeTab === 'closed'}
                                                                    value={ship.status?.[p.id] || ""}
                                                                    onChange={e => updateDoc(doc(db, 'artifacts', APP_ID, DATA_PATH, 'shipments', ship.id), { [`status.${p.id}`]: e.target.value })}
                                                                    className={`text-[10px] font-bold p-1.5 rounded-md border w-full outline-none ${ship.status?.[p.id]?.includes('APROVADO') ? 'bg-green-50 text-green-700' : 'bg-white'}`}
                                                                >
                                                                    {p.options.map(o => <option key={o} value={o}>{o}</option>)}
                                                                </select>
                                                            </td>
                                                        ))}
                                                        <td className="p-3 text-center no-print">
                                                            <div className="flex gap-2 justify-center">
                                                                <button onClick={() => toggleShipmentClosedState(ship)} className="text-blue-600"><CheckCircle size={18} /></button>
                                                                <button onClick={() => deleteShipment(ship.id)} className="text-slate-300 hover:text-red-500"><Trash size={18} /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
