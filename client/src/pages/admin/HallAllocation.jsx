import React, { useState, useEffect } from 'react';
import {
    Calendar, Users, Building2, Layout,
    Shield, Lock, Unlock, Download,
    Plus, Trash2, CheckCircle2, AlertCircle,
    ChevronRight, ChevronLeft, Save,
    RefreshCcw, Grid, Layers
} from 'lucide-react';
import api from '../../api/axios';
import Header from '../../components/Header';
import toast from 'react-hot-toast';

const HallAllocation = () => {
    const [sessions, setSessions] = useState([]);
    const [halls, setHalls] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    // Form States
    const [newSession, setNewSession] = useState({
        examName: '',
        examDate: '',
        session: 'FN',
        examMode: 'CIA',
        subjectIds: []
    });

    const [newHall, setNewHall] = useState({
        hallName: '',
        blockName: '',
        numColumns: 1,
        columns: [{ label: 'A', benches: '' }]
    });

    const [selectedSession, setSelectedSession] = useState(null);
    const [selectedHalls, setSelectedHalls] = useState([]);
    const [allocations, setAllocations] = useState([]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const [sessionsRes, hallsRes, subjectsRes] = await Promise.all([
                api.get('admin/hall-allocation/sessions'),
                api.get('admin/hall-allocation/halls'),
                api.get('admin/subjects')
            ]);
            setSessions(Array.isArray(sessionsRes.data) ? sessionsRes.data : []);
            setHalls(Array.isArray(hallsRes.data) ? hallsRes.data : []);
            setSubjects(Array.isArray(subjectsRes.data) ? subjectsRes.data : []);
        } catch (error) {
            toast.error('Failed to load hall allocation data');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSession = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('admin/hall-allocation/sessions', newSession);
            toast.success('Exam session created');
            fetchInitialData();
            setSelectedSession(res.data);
            setCurrentStep(2);
        } catch (error) {
            toast.error('Failed to create session');
        }
    };

    const handleAddHall = async (e) => {
        e.preventDefault();
        try {
            await api.post('admin/hall-allocation/halls', {
                hallName: newHall.hallName,
                blockName: newHall.blockName,
                columns: newHall.columns
            });
            toast.success('Hall added');
            setNewHall({
                hallName: '',
                blockName: '',
                numColumns: 1,
                columns: [{ label: 'A', benches: '' }]
            });
            fetchInitialData();
        } catch (error) {
            toast.error('Failed to add hall');
        }
    };

    const handleColumnNumChange = (num) => {
        let count = num === '' ? '' : parseInt(num);
        if (count !== '' && isNaN(count)) return;

        const effectiveCount = count === '' ? 0 : count;
        const newCols = Array.from({ length: effectiveCount }, (_, i) => ({
            label: String.fromCharCode(65 + i),
            benches: newHall.columns[i]?.benches || ''
        }));
        setNewHall({ ...newHall, numColumns: count, columns: newCols });
    };

    const handleBenchChange = (idx, val) => {
        const newCols = [...newHall.columns];
        newCols[idx].benches = val;
        setNewHall({ ...newHall, columns: newCols });
    };

    const handleGenerate = async () => {
        if (selectedHalls.length === 0) {
            toast.error('Select at least one hall');
            return;
        }
        setGenerating(true);
        try {
            const res = await api.post('admin/hall-allocation/generate', {
                sessionId: selectedSession.id,
                hallIds: selectedHalls
            });
            toast.success(res.data.message);
            const allocRes = await api.get(`admin/hall-allocation/sessions/${selectedSession.id}/allocations`);
            setAllocations(allocRes.data);
            setCurrentStep(4);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Generation failed');
        } finally {
            setGenerating(false);
        }
    };

    const toggleLock = async (session) => {
        try {
            await api.patch(`admin/hall-allocation/sessions/${session.id}/lock`, { isLocked: !session.isLocked });
            toast.success(session.isLocked ? 'Session Unlocked' : 'Session Locked Permanently');
            fetchInitialData();
        } catch (error) {
            toast.error('Failed to update lock status');
        }
    };

    const handleDeleteSession = async (id) => {
        if (!window.confirm('Are you sure you want to delete this session and all its allocations?')) return;
        try {
            await api.delete(`admin/hall-allocation/sessions/${id}`);
            toast.success('Session deleted successfully');
            fetchInitialData();
        } catch (error) {
            toast.error('Failed to delete session');
        }
    };

    const handleExportPDF = async () => {
        if (!selectedSession) return;
        try {
            const response = await api.get(`admin/hall-allocation/sessions/${selectedSession.id}/export`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Consolidated_Plan_${selectedSession.examName}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            toast.error('Failed to export Consolidated Plan');
        }
    };

    const handleExportGridPDF = async () => {
        if (!selectedSession) return;
        try {
            const response = await api.get(`admin/hall-allocation/sessions/${selectedSession.id}/export-grid`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Seating_Grid_${selectedSession.examName}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            toast.error('Failed to export Seating Grid');
        }
    };

    const previewAllocations = async (session) => {
        try {
            const res = await api.get(`admin/hall-allocation/sessions/${session.id}/allocations`);
            setAllocations(res.data);
            setSelectedSession(session);
            setCurrentStep(4);
        } catch (error) {
            toast.error('Failed to load allocations');
        }
    };

    const handleSaveSubjects = async () => {
        console.log('handleSaveSubjects triggered');
        console.log('Selected Session:', selectedSession);
        console.log('Subject IDs to save:', newSession.subjectIds);

        if (!selectedSession) {
            toast.error('No session selected');
            return;
        }
        if (newSession.subjectIds.length === 0) {
            toast.error('Select at least one subject');
            return;
        }
        try {
            const res = await api.put(`admin/hall-allocation/sessions/${selectedSession.id}/subjects`, {
                subjectIds: newSession.subjectIds
            });
            console.log('Save response:', res.data);
            setCurrentStep(3);
        } catch (error) {
            console.error('Save error details:', error.response?.data || error.message);
            toast.error('Failed to save subjects');
        }
    };

    if (loading) return <div className="flex items-center justify-center h-screen animate-pulse text-[#003B73] font-black">INITIALIZING INTELLIGENCE...</div>;

    return (
        <div className="flex flex-col animate-fadeIn">
            <div className="flex flex-col items-center text-center mb-12 gap-6">
                <div className="animate-slideUp">
                    <h1 className="text-4xl font-black text-[#003B73] tracking-tight">Hall Allocation Control</h1>
                    <p className="text-gray-500 font-medium mt-2">Automated exam seating management with balanced distribution.</p>
                </div>

                {/* Step Indicator */}
                <div className="flex items-center gap-4 bg-white p-2 rounded-full shadow-lg border border-gray-100">
                    {[1, 2, 3, 4].map(step => (
                        <div key={step} className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${currentStep === step ? 'bg-[#003B73] text-white' : 'text-gray-400'}`}>
                            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center font-black text-xs">{step}</span>
                            <span className="text-xs font-black uppercase tracking-widest">{
                                step === 1 ? 'Session' :
                                    step === 2 ? 'Subject' :
                                        step === 3 ? 'Halls' : 'Preview'
                            }</span>
                        </div>
                    ))}
                </div>
            </div>

            <main className="max-w-7xl mx-auto w-full">
                {currentStep === 1 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <section className="bg-white p-10 rounded-[40px] shadow-sm border border-gray-100">
                            <h2 className="text-2xl font-black text-[#003B73] mb-8 flex items-center gap-3">
                                <Calendar className="text-blue-500" /> Create Exam Session
                            </h2>
                            <form onSubmit={handleCreateSession} className="space-y-6">
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Exam Name</label>
                                    <input
                                        type="text" required placeholder="e.g. CIA-I April 2024"
                                        className="w-full px-6 py-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-[#003B73] outline-none font-bold transition-all"
                                        value={newSession.examName}
                                        onChange={e => setNewSession({ ...newSession, examName: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Exam Date</label>
                                        <input
                                            type="date" required
                                            className="w-full px-6 py-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-[#003B73] outline-none font-bold transition-all"
                                            value={newSession.examDate}
                                            onChange={e => setNewSession({ ...newSession, examDate: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Session</label>
                                            <select
                                                className="w-full px-4 py-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-[#003B73] outline-none font-bold text-sm transition-all"
                                                value={newSession.session}
                                                onChange={e => setNewSession({ ...newSession, session: e.target.value })}
                                            >
                                                <option value="FN">FN</option>
                                                <option value="AN">AN</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Exam Mode</label>
                                            <select
                                                className="w-full px-4 py-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-[#003B73] outline-none font-bold text-sm transition-all"
                                                value={newSession.examMode}
                                                onChange={e => setNewSession({ ...newSession, examMode: e.target.value })}
                                            >
                                                <option value="CIA">CIA (2x)</option>
                                                <option value="END_SEM">END SEM (1x)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <button type="submit" className="w-full py-5 bg-[#003B73] text-white rounded-3xl font-black shadow-xl shadow-blue-900/20 hover:bg-[#002850] transition-all flex items-center justify-center gap-3">
                                    <Save size={20} /> Initialize Session
                                </button>
                            </form>
                        </section>

                        <section className="space-y-6">
                            <h3 className="text-xl font-black text-[#003B73] px-4">Recent Sessions</h3>
                            <div className="space-y-4">
                                {sessions.map(s => (
                                    <div key={s.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between hover:border-blue-200 transition-all group">
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-black">
                                                {s.session}
                                            </div>
                                            <div>
                                                <h4 className="font-black text-[#003B73]">{s.examName}</h4>
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{new Date(s.examDate).toDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => previewAllocations(s)}
                                                className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all font-black text-xs uppercase tracking-widest"
                                            >
                                                Manage
                                            </button>
                                            <button onClick={() => toggleLock(s)} className={`p-3 rounded-xl transition-all ${s.isLocked ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
                                                {s.isLocked ? <Lock size={18} /> : <Unlock size={18} />}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteSession(s.id)}
                                                className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-all"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="bg-white p-10 rounded-[40px] shadow-sm border border-gray-100 animate-slideIn">
                        <div className="flex justify-between items-center mb-10">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setCurrentStep(1)}
                                    className="p-4 bg-gray-50 text-gray-400 rounded-2xl hover:bg-gray-100 hover:text-[#003B73] transition-all"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <div>
                                    <h2 className="text-2xl font-black text-[#003B73] flex items-center gap-3">
                                        <Layers className="text-indigo-500" /> Select Subjects for {selectedSession?.examName}
                                    </h2>
                                    <p className="text-gray-400 font-medium mt-1 uppercase text-[10px] tracking-widest">Students under selected subjects will be included in allocation.</p>
                                </div>
                            </div>
                            <button
                                onClick={handleSaveSubjects}
                                className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg flex items-center gap-2 hover:bg-indigo-700 transition-all"
                            >
                                Continue to Halls <ChevronRight size={20} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto p-2 custom-scrollbar">
                            {subjects.map(sub => {
                                const isSelected = newSession.subjectIds.includes(sub.id);
                                return (
                                    <div
                                        key={sub.id}
                                        onClick={() => {
                                            const newIds = isSelected
                                                ? newSession.subjectIds.filter(id => id !== sub.id)
                                                : [...newSession.subjectIds, sub.id];
                                            setNewSession({ ...newSession, subjectIds: newIds });
                                        }}
                                        className={`p-6 rounded-3xl border-2 transition-all cursor-pointer flex items-center justify-between ${isSelected ? 'border-indigo-500 bg-indigo-50/30' : 'border-gray-100 hover:border-indigo-200 bg-white'}`}
                                    >
                                        <div className="flex-1">
                                            <h4 className={`font-black tracking-tight ${isSelected ? 'text-indigo-600' : 'text-[#003B73]'}`}>{sub.name}</h4>
                                            <div className="flex gap-2 mt-1">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{sub.code}</span>
                                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{sub.department}</span>
                                            </div>
                                        </div>
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-200'}`}>
                                            {isSelected && <CheckCircle2 size={14} />}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {currentStep === 3 && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-slideIn">
                        <div className="lg:col-span-1 space-y-6">
                            <section className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
                                <h3 className="text-xl font-black text-[#003B73] mb-6 flex items-center gap-2">
                                    <Building2 className="text-emerald-500" /> Add New Hall
                                </h3>
                                <form onSubmit={handleAddHall} className="space-y-4">
                                    <input
                                        type="text" required placeholder="Hall Name (e.g. 101)"
                                        className="w-full px-5 py-3 bg-gray-50 rounded-xl border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-sm"
                                        value={newHall.hallName}
                                        onChange={e => setNewHall({ ...newHall, hallName: e.target.value })}
                                    />
                                    <input
                                        type="text" required placeholder="Block Name"
                                        className="w-full px-5 py-3 bg-gray-50 rounded-xl border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-sm"
                                        value={newHall.blockName}
                                        onChange={e => setNewHall({ ...newHall, blockName: e.target.value })}
                                    />
                                    <div className="relative">
                                        <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Number of Columns</label>
                                        <input
                                            type="number" min="1" max="10" required
                                            className="w-full px-5 py-3 bg-gray-50 rounded-xl border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-sm"
                                            value={newHall.numColumns}
                                            onChange={e => handleColumnNumChange(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                        {newHall.columns.map((col, idx) => (
                                            <div key={idx} className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">{col.label}</div>
                                                <input
                                                    type="number" placeholder="Benches" required
                                                    className="flex-1 px-4 py-2 bg-gray-50 rounded-xl border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-sm"
                                                    value={col.benches}
                                                    onChange={e => handleBenchChange(idx, e.target.value)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <button type="submit" className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                                        <Plus size={18} /> Register Hall
                                    </button>
                                </form>
                            </section>
                        </div>

                        <div className="lg:col-span-2 bg-white p-10 rounded-[40px] shadow-sm border border-gray-100">
                            <div className="flex justify-between items-center mb-8">
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setCurrentStep(2)}
                                        className="p-4 bg-gray-50 text-gray-400 rounded-2xl hover:bg-gray-100 hover:text-[#003B73] transition-all"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <div>
                                        <h3 className="text-2xl font-black text-[#003B73]">Select Halls</h3>
                                        <p className="text-gray-400 font-black text-[10px] uppercase tracking-[0.2em] mt-1">
                                            Selected: {selectedHalls.length} |
                                            Cap: {halls.filter(h => selectedHalls.includes(h.id)).reduce((a, b) => a + (selectedSession?.examMode === 'CIA' ? b.capacityCIA : b.capacityEND), 0)}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleGenerate}
                                    disabled={generating}
                                    className="px-8 py-4 bg-[#003B73] text-white rounded-2xl font-black shadow-xl hover:bg-[#002850] disabled:bg-gray-400 transition-all flex items-center gap-3"
                                >
                                    {generating ? <RefreshCcw className="animate-spin" /> : <Grid size={20} />}
                                    {generating ? 'Engine Processing...' : 'Run Allocation Intelligence'}
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto p-1 custom-scrollbar">
                                {halls.map(hall => {
                                    const isSelected = selectedHalls.includes(hall.id);
                                    return (
                                        <div
                                            key={hall.id}
                                            onClick={() => {
                                                const newIds = isSelected
                                                    ? selectedHalls.filter(id => id !== hall.id)
                                                    : [...selectedHalls, hall.id];
                                                setSelectedHalls(newIds);
                                            }}
                                            className={`p-6 rounded-3xl border-2 transition-all cursor-pointer flex items-center justify-between ${isSelected ? 'border-[#003B73] bg-blue-50/30' : 'border-gray-50 hover:border-blue-100 bg-white'}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${isSelected ? 'bg-[#003B73] text-white' : 'bg-gray-50 text-gray-400'}`}>
                                                    {hall.hallName}
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-[#003B73] text-sm uppercase">{hall.blockName}</h4>
                                                    <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
                                                        Benches: {hall.totalBenches} | Cap: {selectedSession?.examMode === 'CIA' ? hall.capacityCIA : hall.capacityEND}
                                                    </p>
                                                </div>
                                            </div>
                                            {isSelected && <CheckCircle2 size={24} className="text-emerald-500" />}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {currentStep === 4 && (
                    <div className="bg-white p-10 rounded-[40px] shadow-sm border border-gray-100 animate-slideUp">
                        <div className="flex justify-between items-center mb-10">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setCurrentStep(3)}
                                    className="p-4 bg-gray-50 text-gray-400 rounded-2xl hover:bg-gray-100 hover:text-[#003B73] transition-all"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <div>
                                    <h2 className="text-3xl font-black text-[#003B73]">{selectedSession?.examName} Allocation Preview</h2>
                                    <p className="text-gray-400 font-black text-[10px] tracking-[0.3em] uppercase mt-2">Intelligence Engine Results | Transaction safe</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={handleExportPDF}
                                    className="px-6 py-4 bg-emerald-600 text-white rounded-2xl font-black flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg"
                                >
                                    <Download size={20} /> Consolidated Plan
                                </button>
                                <button
                                    onClick={handleExportGridPDF}
                                    className="px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg"
                                >
                                    <Download size={20} /> Seating Grid
                                </button>
                                <button
                                    onClick={() => setCurrentStep(1)}
                                    className="px-6 py-4 bg-gray-100 text-[#003B73] rounded-2xl font-black flex items-center gap-2 hover:bg-gray-200 transition-all"
                                >
                                    Close Preview
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {/* Group allocations by Hall for preview */}
                            {Object.entries(allocations.reduce((acc, a) => {
                                const hallId = a.hall.hallName;
                                if (!acc[hallId]) acc[hallId] = [];
                                acc[hallId].push(a);
                                return acc;
                            }, {})).map(([hallName, hallAllocations]) => (
                                <div key={hallName} className="bg-gray-50/50 p-6 rounded-[32px] border border-gray-100">
                                    <div className="flex justify-between items-center mb-6">
                                        <h4 className="text-lg font-black text-[#003B73]">Hall {hallName}</h4>
                                        <span className="px-3 py-1 bg-white text-[#003B73] rounded-full text-[10px] font-black shadow-sm">
                                            {hallAllocations.length} STUDENTS
                                        </span>
                                    </div>
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                        {hallAllocations.map(a => (
                                            <div key={a.id} className="bg-white p-3 rounded-xl shadow-sm text-xs flex justify-between items-center border border-gray-50">
                                                <div>
                                                    <p className="font-black text-gray-800">{a.student.name}</p>
                                                    <p className="text-[9px] font-bold text-[#003B73] font-mono tracking-tighter uppercase">{a.student.rollNo} • {a.subject.code}</p>
                                                </div>
                                                <div className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg font-black font-mono">
                                                    {a.seatNumber}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default HallAllocation;
