import React, { useState, useEffect } from 'react';
import { Shield, Brain, Lock, RefreshCcw, Table, FileText } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const DummyNumberManager = () => {
    const [departments, setDepartments] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [filters, setFilters] = useState({
        department: '',
        semester: '',
        subjectId: ''
    });
    const [mappings, setMappings] = useState([]);
    const [loading, setLoading] = useState(false);

    // Generation Inputs
    const [startingDummy, setStartingDummy] = useState('');
    const [boardCode, setBoardCode] = useState('');
    const [qpCode, setQpCode] = useState('');
    const [absentStudentIds, setAbsentStudentIds] = useState([]);

    useEffect(() => {
        const fetchDepts = async () => {
            const res = await api.get('/admin/departments');
            setDepartments(res.data);
        };
        fetchDepts();
    }, []);

    const fetchSubjects = async (dept, sem) => {
        if (!dept || !sem) return;
        try {
            const res = await api.get(`/admin/subjects?department=${encodeURIComponent(dept)}&semester=${encodeURIComponent(sem)}`);
            setSubjects(res.data);

            // Auto complete course code dynamically here if needed
        } catch (err) {
            toast.error('Failed to fetch subjects');
        }
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
        if (name === 'department' || name === 'semester') {
            fetchSubjects(
                name === 'department' ? value : filters.department,
                name === 'semester' ? value : filters.semester
            );
        }
    };

    const fetchMappings = async () => {
        if (!filters.subjectId) return;
        setLoading(true);
        try {
            const res = await api.get(`/dummy/mapping?department=${encodeURIComponent(filters.department)}&semester=${encodeURIComponent(filters.semester)}&subjectId=${encodeURIComponent(filters.subjectId)}`);
            setMappings(res.data);

            // Pre-fill existing general fields if already generated
            const firstGenerated = res.data.find(m => !m.isTemp);
            if (firstGenerated) {
                setBoardCode(firstGenerated.boardCode || '');
                setQpCode(firstGenerated.qpCode || '');
                // Find minimum non-null dummy to show
                const validDummies = res.data.map(m => parseInt(m.dummyNumber)).filter(n => !isNaN(n));
                if (validDummies.length > 0) setStartingDummy(Math.min(...validDummies).toString());

                // Set absentees that are already mapped
                const existingAbsentees = res.data.filter(m => m.isAbsent).map(m => m.studentId);
                setAbsentStudentIds(existingAbsentees);
            } else {
                setAbsentStudentIds([]); // reset
            }
        } catch (err) {
            toast.error('Failed to fetch mappings');
        } finally {
            setLoading(false);
        }
    };

    const generateDummies = async () => {
        if (!filters.subjectId) return toast.error('Select a subject first');
        if (!startingDummy) return toast.error('Enter a Starting Dummy Number');

        setLoading(true);
        try {
            await api.post('/dummy/generate', {
                ...filters,
                startingDummy,
                boardCode,
                qpCode,
                absentStudentIds
            });
            toast.success('Dummy numbers generated successfully');
            fetchMappings();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to generate dummy numbers');
        } finally {
            setLoading(false);
        }
    };

    const lockMapping = async () => {
        if (!window.confirm('Are you sure? Once locked, dummy numbers cannot be regenerated or modified.')) return;
        try {
            await api.post('/dummy/lock', filters);
            toast.success('Mapping locked permanently');
            fetchMappings();
        } catch (err) {
            toast.error('Failed to lock mapping');
        }
    };

    const unlockMapping = async () => {
        if (!window.confirm('Are you sure you want to unlock this mapping? External evaluators might be actively entering marks.')) return;
        try {
            await api.post('/dummy/unlock', filters);
            toast.success('Mapping successfully unlocked');
            fetchMappings();
        } catch (err) {
            toast.error('Failed to unlock mapping');
        }
    };

    const toggleAbsent = (studentId) => {
        // Only allow toggling if mapping is not locked
        if (mappings.length > 0 && mappings[0].mappingLocked) return;

        setAbsentStudentIds(prev =>
            prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
        );
    };

    // Derived states
    const selectedSubject = subjects.find(s => s.id === parseInt(filters.subjectId));
    const courseCodeDisplay = selectedSubject ? selectedSubject.code : '-';
    const isLocked = mappings.length > 0 && mappings[0].mappingLocked;

    // Fix Absentee Bug: if m.isAbsent is true, NEVER put them in presentStudents even if mapping is locked.
    const presentStudents = mappings.filter(m => {
        if (isLocked) return !m.isAbsent;
        return !absentStudentIds.includes(m.studentId) && (!m.isAbsent || m.isTemp);
    });

    const absentStudents = mappings.filter(m => {
        if (isLocked) return m.isAbsent;
        return absentStudentIds.includes(m.studentId) || (m.isAbsent && !m.isTemp);
    });

    return (
        <div className="p-8">
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-[#003B73]">Dummy Number Generation</h1>
                    <p className="text-gray-500 font-medium tracking-wide">Secure anonymous evaluation mapping system</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={generateDummies}
                        disabled={loading || !filters.subjectId || isLocked}
                        className="bg-[#003B73] text-white px-8 py-3 rounded-2xl flex items-center gap-2 font-black tracking-wider shadow-lg hover:bg-[#002850] transition-all disabled:opacity-50"
                    >
                        <Brain size={20} /> GENERATE
                    </button>
                    <button
                        onClick={lockMapping}
                        disabled={loading || mappings.length === 0 || isLocked || mappings[0]?.isTemp}
                        className={`bg-red-600 text-white px-8 py-3 rounded-2xl flex items-center gap-2 font-black tracking-wider shadow-lg hover:bg-red-700 transition-all disabled:opacity-50 ${isLocked ? 'hidden' : ''}`}
                    >
                        <Lock size={20} /> LOCK MAPPING
                    </button>
                    {isLocked && (
                        <button
                            onClick={unlockMapping}
                            disabled={loading || mappings.length === 0}
                            className="bg-yellow-500 text-white px-8 py-3 rounded-2xl flex items-center gap-2 font-black tracking-wider shadow-lg hover:bg-yellow-600 transition-all disabled:opacity-50"
                        >
                            <Shield size={20} /> UNLOCK MAPPING
                        </button>
                    )}
                </div>
            </div>

            {/* Top Controls Section */}
            <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 mb-8 max-w-6xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 border-b border-gray-100 pb-8">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Department</label>
                        <select name="department" value={filters.department} onChange={handleFilterChange} disabled={isLocked} className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-black text-[#003B73]">
                            <option value="">Select Department</option>
                            {departments.map(d => <option key={d.id} value={d.code || d.name}>{d.code || d.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Semester</label>
                        <select name="semester" value={filters.semester} onChange={handleFilterChange} disabled={isLocked} className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-black text-[#003B73]">
                            <option value="">Select Semester</option>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Course (Subject)</label>
                        <select name="subjectId" value={filters.subjectId} onChange={handleFilterChange} disabled={isLocked} className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-black text-[#003B73]">
                            <option value="">Select Course</option>
                            {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                    <div>
                        <label className="block text-[10px] font-black text-[#003B73] uppercase tracking-widest mb-2">Starting Dummy Number</label>
                        <input type="number" value={startingDummy} onChange={e => setStartingDummy(e.target.value)} disabled={isLocked} placeholder="e.g. 5001" className="w-full p-4 bg-blue-50/50 focus:bg-blue-50 rounded-2xl border-2 border-transparent focus:border-[#003B73] outline-none font-black text-lg text-[#003B73] transition-all" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Board Code</label>
                        <input type="text" value={boardCode} onChange={e => setBoardCode(e.target.value)} disabled={isLocked} placeholder="e.g. BD-245" className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-bold" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">QP Code</label>
                        <input type="text" value={qpCode} onChange={e => setQpCode(e.target.value)} disabled={isLocked} placeholder="e.g. CS101-A" className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-bold" />
                    </div>
                    <div>
                        <button onClick={fetchMappings} className="w-full p-4 bg-gray-100 text-[#003B73] hover:bg-gray-200 transition-all rounded-2xl font-black flex items-center justify-center gap-2">
                            <RefreshCcw size={18} /> Reload Registry
                        </button>
                    </div>
                </div>
            </div>

            {/* Generated Indicator */}
            {isLocked && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600">
                    <Lock size={24} className="shrink-0" />
                    <div>
                        <p className="font-black">MAPPING LOCKED</p>
                        <p className="text-sm font-medium">This registry has been finalized. Changes to Dummy Numbers and Absentees are permanently disabled.</p>
                    </div>
                </div>
            )}

            {/* Main Table: Present Students */}
            <div className="bg-white rounded-t-3xl shadow-sm border border-gray-200 overflow-hidden mb-6 max-w-7xl">
                <div className="bg-[#003B73] p-4 text-white">
                    <h2 className="text-lg font-black tracking-widest uppercase text-center flex items-center justify-center gap-2">
                        <FileText size={20} /> Dummy Number Generation Registry
                    </h2>
                </div>
                <table className="w-full text-center border-collapse">
                    <thead>
                        <tr className="bg-gray-50 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b-2 border-gray-200">
                            <th className="p-4 border-r border-gray-200 w-16">SL.NO</th>
                            <th className="p-4 border-r border-gray-200 w-32">Course Code</th>
                            <th className="p-4 border-r border-gray-200 w-40">Register Number</th>
                            <th className="p-4 border-r border-gray-200 w-40">Answer Script No.</th>
                            <th className="p-4 border-r border-gray-200 w-32 bg-blue-50/50 text-[#003B73]">Dummy Number</th>
                            <th className="p-4 border-r border-gray-200 w-24">Marks</th>
                            <th className="p-4 border-r border-gray-200 w-32">Board Code</th>
                            <th className="p-4 border-r border-gray-200 w-32">QP.Code</th>
                            <th className="p-4 w-24 text-red-500">Absent</th>
                        </tr>
                    </thead>
                    <tbody>
                        {presentStudents.length > 0 ? (
                            presentStudents.map((m, idx) => (
                                <tr key={m.id} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors">
                                    <td className="p-3 border-r border-gray-100 font-bold text-gray-600">{idx + 1}</td>
                                    <td className="p-3 border-r border-gray-100 font-bold text-gray-600">{courseCodeDisplay}</td>
                                    <td className="p-3 border-r border-gray-100 font-mono font-bold text-[#003B73] whitespace-nowrap">{m.originalRegisterNo}</td>
                                    <td className="p-3 border-r border-gray-100">
                                        <input type="text" disabled={isLocked} className="w-full bg-transparent border-b border-gray-200 focus:border-blue-500 outline-none text-center font-mono text-xs" />
                                    </td>
                                    <td className="p-3 border-r border-gray-100 bg-blue-50/20 font-black text-lg text-[#003B73]">{m.dummyNumber || '-'}</td>
                                    <td className="p-3 border-r border-gray-100 font-black text-gray-400">{m.marks !== null ? m.marks : '-'}</td>
                                    <td className="p-3 border-r border-gray-100 font-bold text-gray-500 text-xs">{boardCode}</td>
                                    <td className="p-3 border-r border-gray-100 font-bold text-gray-500 text-xs">{qpCode}</td>
                                    <td className="p-3">
                                        <label className="cursor-pointer flex items-center justify-center p-2 rounded-xl hover:bg-red-50 transition-all">
                                            <input
                                                type="checkbox"
                                                checked={absentStudentIds.includes(m.studentId)}
                                                onChange={() => toggleAbsent(m.studentId)}
                                                disabled={isLocked}
                                                className="w-5 h-5 accent-red-500 cursor-pointer"
                                            />
                                        </label>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="9" className="p-12 text-center text-gray-400 font-bold">
                                    <Table size={48} className="mx-auto text-gray-200 mb-4" />
                                    {mappings.length > 0 ? 'All students are marked absent.' : 'No students found. Load Registry.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Absentees Table */}
            {absentStudents.length > 0 && (
                <div className="bg-red-50/50 rounded-b-3xl shadow-sm border border-red-100 overflow-hidden max-w-7xl">
                    <div className="bg-red-100 p-3 text-red-800 border-b border-red-200">
                        <h3 className="text-sm font-black tracking-widest uppercase text-center">ABSENTEES</h3>
                    </div>
                    <table className="w-full text-center border-collapse">
                        <tbody>
                            {absentStudents.map((m, idx) => (
                                <tr key={m.id} className="border-b border-red-100 hover:bg-red-50 transition-colors">
                                    <td className="p-3 border-r border-red-100 font-bold text-red-400 w-16">{presentStudents.length + idx + 1}</td>
                                    <td className="p-3 border-r border-red-100 font-bold text-red-500 w-32">{courseCodeDisplay}</td>
                                    <td className="p-3 border-r border-red-100 font-mono font-bold text-red-600 line-through w-40">{m.originalRegisterNo}</td>
                                    <td className="p-3 border-r border-red-100 w-40">-</td>
                                    <td className="p-3 border-r border-red-100 font-black text-red-400 w-32">N/A</td>
                                    <td className="p-3 border-r border-red-100 text-red-400 font-bold w-24">AB</td>
                                    <td className="p-3 border-r border-red-100 font-bold text-red-400 text-xs w-32">{boardCode}</td>
                                    <td className="p-3 border-r border-red-100 font-bold text-red-400 text-xs w-32">{qpCode}</td>
                                    <td className="p-3 w-24">
                                        <button
                                            onClick={() => toggleAbsent(m.studentId)}
                                            disabled={isLocked}
                                            className="text-xs font-black bg-white text-red-500 px-3 py-1 rounded-lg border border-red-200 hover:bg-red-50 shadow-sm disabled:opacity-50"
                                        >
                                            UNDO
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default DummyNumberManager;
