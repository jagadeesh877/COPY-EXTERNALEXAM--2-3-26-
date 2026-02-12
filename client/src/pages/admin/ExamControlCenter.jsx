import React, { useState, useEffect, useCallback } from 'react';
import { Award, Lock, Unlock, CheckCircle, Save, Filter, RefreshCw } from 'lucide-react';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import toast from 'react-hot-toast';

const ExamControlCenter = () => {
    const [status, setStatus] = useState({
        department: '',
        year: '',
        semester: '',
        section: '',
        markEntryOpen: false,
        isPublished: false,
        isLocked: false
    });

    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchInitialData = async () => {
        try {
            const deptsRes = await api.get('/admin/departments');
            setDepartments(deptsRes.data);
            if (deptsRes.data.length > 0) {
                setStatus(prev => ({ ...prev, department: deptsRes.data[0].name }));
            }
        } catch (error) {
            toast.error('Failed to load departments');
        }
    };

    const fetchCurrentStatus = useCallback(async () => {
        if (!status.department || !status.year || !status.semester || !status.section) return;

        setLoading(true);
        try {
            const res = await api.get('/exam/semester-control', {
                params: {
                    department: status.department,
                    year: status.year,
                    semester: status.semester,
                    section: status.section
                }
            });
            setStatus(prev => ({
                ...prev,
                markEntryOpen: res.data.markEntryOpen,
                isPublished: res.data.isPublished,
                isLocked: res.data.isLocked
            }));
        } catch (error) {
            console.error(error);
            toast.error('Failed to fetch status');
        } finally {
            setLoading(false);
        }
    }, [status.department, status.year, status.semester, status.section]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        fetchCurrentStatus();
    }, [fetchCurrentStatus]);

    const toggleControl = async (field) => {
        if (!status.department || !status.year || !status.semester || !status.section) {
            toast.error('Please select all filters first');
            return;
        }

        try {
            const newValue = !status[field];
            await api.post('/exam/semester-control', {
                department: status.department,
                year: status.year,
                semester: status.semester,
                section: status.section,
                field,
                value: newValue
            });
            setStatus(prev => ({ ...prev, [field]: newValue }));
            toast.success(`Control updated successfully`);
        } catch (error) {
            toast.error('Failed to update control');
        }
    };

    return (
        <div className="w-full animate-fadeIn">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-4xl font-black text-[#003B73] tracking-tight flex items-center gap-3">
                        <Award className="text-blue-600" size={32} /> Exam Control Center
                    </h1>
                    <p className="text-gray-500 font-medium mt-1">Manage mark entry, result publication, and semester locking.</p>
                </div>
            </div>

            {/* Filter Card */}
            <div className="bg-white p-8 rounded-[32px] shadow-xl shadow-blue-900/5 border border-gray-100 mb-10">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Department</label>
                        <select
                            className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-bold text-[#003B73] focus:ring-2 focus:ring-blue-500/20 transition-all"
                            value={status.department}
                            onChange={e => setStatus({ ...status, department: e.target.value })}
                        >
                            <option value="">Select...</option>
                            {departments.map(d => (
                                <option key={d.id} value={d.name}>{d.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Semester</label>
                        <select
                            className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-bold text-[#003B73] focus:ring-2 focus:ring-blue-500/20 transition-all"
                            value={status.semester}
                            onChange={e => {
                                const sem = parseInt(e.target.value);
                                const year = Math.ceil(sem / 2);
                                setStatus({ ...status, semester: e.target.value, year: year.toString() });
                            }}
                        >
                            <option value="">Select...</option>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Sem {s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Section</label>
                        <select
                            className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-bold text-[#003B73] focus:ring-2 focus:ring-blue-500/20 transition-all"
                            value={status.section}
                            onChange={e => setStatus({ ...status, section: e.target.value })}
                        >
                            <option value="">Select...</option>
                            {['A', 'B', 'C', 'D'].map(s => <option key={s} value={s}>Section {s}</option>)}
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={fetchCurrentStatus}
                            disabled={loading}
                            className="w-full bg-[#003B73] text-white py-4 rounded-2xl hover:bg-blue-800 transition-all font-black shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                        >
                            {loading ? <RefreshCw className="animate-spin" size={20} /> : <Filter size={20} />}
                            Refresh Status
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 text-gray-400">
                    <RefreshCw size={56} className="animate-spin mb-6 text-blue-600/30" />
                    <p className="font-bold text-lg text-gray-400 font-mono tracking-widest">SYNCING ENGINE STATUS...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10 animate-fadeIn">
                    <div className="bg-white p-8 rounded-[40px] shadow-xl shadow-blue-900/5 border border-gray-100 flex flex-col items-center text-center transition-all hover:shadow-2xl hover:-translate-y-1">
                        <div className={`w-16 h-16 rounded-3xl mb-6 flex items-center justify-center ${status.markEntryOpen ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                            {status.markEntryOpen ? <Lock size={32} /> : <Unlock size={32} />}
                        </div>
                        <h3 className="text-xl font-black text-[#003B73] mb-4">Mark Entry Controls</h3>
                        <p className="text-sm text-gray-500 font-medium mb-8 leading-relaxed">Toggle accessibility for faculty mark entry across all subjects of this semester.</p>
                        <button
                            onClick={() => toggleControl('markEntryOpen')}
                            className={`w-full py-5 rounded-3xl font-black text-lg flex items-center justify-center gap-3 shadow-lg transition-all ${status.markEntryOpen ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-900/20' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-900/20'}`}
                        >
                            {status.markEntryOpen ? <Lock size={20} /> : <Unlock size={20} />}
                            {status.markEntryOpen ? 'Close Mark Entry' : 'Open Mark Entry'}
                        </button>
                    </div>

                    <div className="bg-white p-8 rounded-[40px] shadow-xl shadow-blue-900/5 border border-gray-100 flex flex-col items-center text-center transition-all hover:shadow-2xl hover:-translate-y-1">
                        <div className={`w-16 h-16 rounded-3xl mb-6 flex items-center justify-center ${status.isPublished ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                            <CheckCircle size={32} />
                        </div>
                        <h3 className="text-xl font-black text-[#003B73] mb-4">Result Management</h3>
                        <p className="text-sm text-gray-500 font-medium mb-8 leading-relaxed">Make consolidated results visible to students on their respective portals.</p>
                        <button
                            onClick={() => toggleControl('isPublished')}
                            className={`w-full py-5 rounded-3xl font-black text-lg flex items-center justify-center gap-3 shadow-lg transition-all ${status.isPublished ? 'bg-orange-600 text-white hover:bg-orange-700 shadow-orange-900/20' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-900/20'}`}
                        >
                            <CheckCircle size={20} />
                            {status.isPublished ? 'Unpublish Results' : 'Publish Results'}
                        </button>
                    </div>

                    <div className="bg-white p-8 rounded-[40px] shadow-xl shadow-blue-900/5 border border-gray-100 flex flex-col items-center text-center transition-all hover:shadow-2xl hover:-translate-y-1">
                        <div className={`w-16 h-16 rounded-3xl mb-6 flex items-center justify-center ${status.isLocked ? 'bg-black text-white' : 'bg-gray-50 text-gray-400'}`}>
                            <Lock size={32} />
                        </div>
                        <h3 className="text-xl font-black text-[#003B73] mb-4">Permanent Lock</h3>
                        <p className="text-sm text-gray-500 font-medium mb-8 leading-relaxed">Grant final administrative approval and freeze all semester data permanently.</p>
                        <button
                            onClick={() => toggleControl('isLocked')}
                            className={`w-full py-5 rounded-3xl font-black text-lg flex items-center justify-center gap-3 shadow-lg transition-all ${status.isLocked ? 'bg-black text-white hover:bg-gray-900 shadow-gray-900/40' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 shadow-gray-200/20'}`}
                        >
                            <Lock size={20} />
                            {status.isLocked ? 'Semester Locked' : 'Lock Semester Permanently'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExamControlCenter;
