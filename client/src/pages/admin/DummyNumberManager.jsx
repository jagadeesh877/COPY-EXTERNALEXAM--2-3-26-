import React, { useState, useEffect } from 'react';
import { Shield, Brain, Lock, RefreshCcw, Table, Filter } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const DummyNumberManager = () => {
    const [departments, setDepartments] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [filters, setFilters] = useState({
        department: '',
        semester: '',
        section: '',
        subjectId: ''
    });
    const [mappings, setMappings] = useState([]);
    const [loading, setLoading] = useState(false);

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
            const res = await api.get(`/admin/subjects?department=${dept}&semester=${sem}`);
            setSubjects(res.data);
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

    const generateDummies = async () => {
        if (!filters.subjectId) return toast.error('Select a subject first');
        setLoading(true);
        try {
            await api.post('/dummy/generate', filters);
            toast.success('Dummy numbers generated');
            fetchMappings();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to generate');
        } finally {
            setLoading(false);
        }
    };

    const fetchMappings = async () => {
        if (!filters.subjectId) return;
        setLoading(true);
        try {
            const res = await api.get(`/dummy/mapping?department=${filters.department}&semester=${filters.semester}&section=${filters.section}&subjectId=${filters.subjectId}`);
            setMappings(res.data);
        } catch (err) {
            toast.error('Failed to fetch mappings');
        } finally {
            setLoading(false);
        }
    };

    const lockMapping = async () => {
        if (!window.confirm('Are you sure? Once locked, dummy numbers cannot be regenerated.')) return;
        try {
            await api.post('/dummy/lock', filters);
            toast.success('Mapping locked permanently');
            fetchMappings();
        } catch (err) {
            toast.error('Failed to lock');
        }
    };

    return (
        <div className="p-8">
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-[#003B73]">Dummy Number Management</h1>
                    <p className="text-gray-500 font-medium">Generate and manage anonymous subject-wise mappings</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={generateDummies}
                        disabled={loading || !filters.subjectId}
                        className="bg-[#003B73] text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-bold hover:bg-[#002850] transition-all shadow-lg disabled:opacity-50"
                    >
                        <Brain size={20} /> Generate Dummies
                    </button>
                    <button
                        onClick={lockMapping}
                        disabled={loading || mappings.length === 0 || mappings[0]?.mappingLocked}
                        className="bg-red-600 text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-bold hover:bg-red-700 transition-all shadow-lg disabled:opacity-50"
                    >
                        <Lock size={20} /> Lock Mapping
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-8 grid grid-cols-4 gap-6">
                <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Department</label>
                    <select name="department" value={filters.department} onChange={handleFilterChange} className="w-full p-3 bg-gray-50 rounded-xl border-none outline-none font-bold text-[#003B73]">
                        <option value="">Select Department</option>
                        {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Semester</label>
                    <select name="semester" value={filters.semester} onChange={handleFilterChange} className="w-full p-3 bg-gray-50 rounded-xl border-none outline-none font-bold text-[#003B73]">
                        <option value="">Select Semester</option>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Section</label>
                    <select name="section" value={filters.section} onChange={handleFilterChange} className="w-full p-3 bg-gray-50 rounded-xl border-none outline-none font-bold text-[#003B73]">
                        <option value="">Select Section</option>
                        {['A', 'B', 'C'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Subject</label>
                    <select name="subjectId" value={filters.subjectId} onChange={handleFilterChange} className="w-full p-3 bg-gray-50 rounded-xl border-none outline-none font-bold text-[#003B73]">
                        <option value="">Select Subject</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                    </select>
                </div>
                <div className="col-span-4">
                    <button
                        onClick={fetchMappings}
                        className="w-full bg-gray-100 text-gray-600 py-3 rounded-2xl font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                    >
                        <RefreshCcw size={18} /> Load/Refresh Mapping
                    </button>
                </div>
            </div>

            {/* Mapping Table */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest">Student Name</th>
                            <th className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest">Register No</th>
                            <th className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest">Dummy Number</th>
                            <th className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {mappings.length > 0 ? (
                            mappings.map(m => (
                                <tr key={m.id} className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-all ${m.isTemp ? 'opacity-70' : ''}`}>
                                    <td className="p-6">
                                        <p className={`font-bold ${m.isTemp ? 'text-gray-400' : 'text-[#003B73]'}`}>{m.student?.name}</p>
                                    </td>
                                    <td className="p-6 font-mono text-sm text-gray-500">{m.originalRegisterNo}</td>
                                    <td className="p-6">
                                        <div className={`${m.isTemp ? 'bg-gray-50 text-gray-300 border-gray-100' : 'bg-blue-50 text-[#003B73] border-blue-100'} px-4 py-2 rounded-xl font-black text-center border shadow-inner transition-all`}>
                                            {m.dummyNumber}
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        {m.isTemp ? (
                                            <span className="bg-gray-100 text-gray-400 text-[10px] font-black px-3 py-1 rounded-full uppercase italic">Pending</span>
                                        ) : m.mappingLocked ? (
                                            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-3 py-1 rounded-full uppercase">Locked</span>
                                        ) : (
                                            <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-3 py-1 rounded-full uppercase">Open</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="4" className="p-12 text-center">
                                    <Table size={48} className="mx-auto text-gray-100 mb-4" />
                                    <p className="text-gray-400 font-bold">No mapping data found. Select filters and refresh.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DummyNumberManager;
