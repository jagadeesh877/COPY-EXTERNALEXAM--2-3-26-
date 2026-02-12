import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import {
    ChevronLeft,
    Save,
    Edit3,
    X,
    User,
    BookOpen,
    CheckCircle,
    AlertTriangle,
    Database,
    Layers,
    RefreshCw,
    Award
} from 'lucide-react';

const AdminMarksManager = () => {
    const { subjectId } = useParams();
    const navigate = useNavigate();
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Modal State
    const [editingStudent, setEditingStudent] = useState(null);
    const [editForm, setEditForm] = useState(null);

    useEffect(() => {
        if (subjectId) {
            fetchMarks();
        }
    }, [subjectId]);

    const fetchMarks = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/admin/marks/${subjectId}`);
            setStudents(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching marks:', err);
        } finally {
            setLoading(false);
        }
    }

    const handleOpenEdit = (student) => {
        setEditingStudent(student);
        setEditForm({ ...student.marks });
    };

    const handleFormChange = (field, value) => {
        const numVal = value === '' ? 0 : parseFloat(value);
        if (isNaN(numVal) || numVal < 0) return;

        setEditForm(prev => ({ ...prev, [field]: numVal }));
    };

    const handleSaveOverride = async () => {
        setSaving(true);
        try {
            await api.post('/admin/marks', {
                studentId: editingStudent.studentId,
                subjectId,
                ...editForm
            });
            await fetchMarks();
            setEditingStudent(null);
        } catch (err) {
            alert('Override failed. Please check institutional constraints.');
        } finally {
            setSaving(false);
        }
    };

    // Helper to sum components
    const sum = (t, a, at) => (t || 0) + (a || 0) + (at || 0);

    return (
        <div className="flex flex-col animate-fadeIn">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6 px-2">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => navigate('/admin/subjects')}
                        className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-[#003B73] shadow-lg shadow-blue-900/5 hover:bg-[#003B73] hover:text-white transition-all transform active:scale-95 group"
                    >
                        <ChevronLeft size={28} className="group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <h1 className="text-4xl font-black text-[#003B73] tracking-tight">Academic Overrides</h1>
                        <p className="text-gray-500 font-medium mt-1">Direct marks manipulation for institutional compliance and discrepancy resolution.</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="hidden lg:flex items-center gap-3 px-6 py-4 bg-white rounded-3xl border border-gray-100 shadow-sm">
                        <Database size={20} className="text-[#003B73]" />
                        <span className="text-sm font-black text-gray-400 uppercase tracking-widest leading-none">Sub-ID: {subjectId}</span>
                    </div>
                </div>
            </div>

            {/* Main Overrides Card */}
            <div className="bg-white p-10 rounded-[40px] shadow-xl border border-gray-100 min-h-[600px] transition-all relative overflow-hidden group/grid">
                {/* Visual Accent */}
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-[#003B73]/5 rounded-full blur-3xl group-hover/grid:bg-[#003B73]/10 transition-colors duration-1000"></div>

                <div className="flex justify-between items-center mb-10 relative z-10">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-[#003B73] rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/20 text-white">
                            <Layers size={32} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-[#003B73] tracking-tight uppercase">Marks Distribution Channel</h2>
                            <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-1">Cross-Semester Performance Ledger</p>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-40">
                        <div className="w-16 h-16 border-4 border-gray-100 border-t-[#003B73] rounded-full animate-spin mb-6"></div>
                        <p className="font-black text-gray-400 uppercase tracking-widest text-xs animate-pulse">Retrieving Grade Records...</p>
                    </div>
                ) : (
                    <div className="overflow-hidden bg-gray-50/30 rounded-3xl border border-gray-100 relative z-10">
                        <table className="w-full text-center border-collapse">
                            <thead className="bg-gray-100/50 text-[#003B73] text-[10px] font-black uppercase tracking-[0.2em]">
                                <tr>
                                    <th className="px-8 py-8 text-left border-r border-gray-200/50 bg-gray-100/30 w-48">Identifier</th>
                                    <th className="px-8 py-8 text-left min-w-[200px]">Profile</th>
                                    <th className="px-6 py-8">CIA Phase 1</th>
                                    <th className="px-6 py-8">CIA Phase 2</th>
                                    <th className="px-6 py-8">CIA Phase 3</th>
                                    <th className="px-6 py-8">Internal</th>
                                    <th className="px-8 py-8 text-right">Channel</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {students.map(student => {
                                    const c1 = sum(student.marks.cia1_test, student.marks.cia1_assignment, student.marks.cia1_attendance);
                                    const c2 = sum(student.marks.cia2_test, student.marks.cia2_assignment, student.marks.cia2_attendance);
                                    const c3 = sum(student.marks.cia3_test, student.marks.cia3_assignment, student.marks.cia3_attendance);

                                    return (
                                        <tr key={student.studentId} className="group hover:bg-white transition-all duration-300">
                                            <td className="px-8 py-6 text-left border-r border-gray-100/30 bg-gray-50/50">
                                                <span className="font-mono text-xs font-black text-gray-400 group-hover:text-[#003B73] transition-colors">{student.registerNumber}</span>
                                            </td>
                                            <td className="px-8 py-6 text-left font-black text-gray-800 text-lg group-hover:text-[#003B73] transition-colors leading-tight">
                                                {student.name}
                                            </td>
                                            <td className="px-6 py-6">
                                                <div className="px-4 py-2 bg-gray-100 rounded-xl font-black text-[#003B73] text-sm tabular-nums inline-block">
                                                    {c1}
                                                </div>
                                            </td>
                                            <td className="px-6 py-6 font-black text-gray-400 text-sm tabular-nums">
                                                {c2}
                                            </td>
                                            <td className="px-6 py-6 font-black text-gray-400 text-sm tabular-nums">
                                                {c3}
                                            </td>
                                            <td className="px-6 py-6">
                                                <div className="px-5 py-3 bg-[#003B73]/5 rounded-2xl font-black text-[#003B73] text-xl shadow-sm border border-[#003B73]/10">
                                                    {student.marks.internal}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <button
                                                    onClick={() => handleOpenEdit(student)}
                                                    className="p-4 bg-white text-[#003B73] rounded-2xl hover:bg-[#003B73] hover:text-white transition-all shadow-sm border border-gray-100"
                                                >
                                                    <Edit3 size={20} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Detailed Override Modal */}
            {editingStudent && (
                <div className="fixed inset-0 bg-[#003B73]/20 backdrop-blur-md flex items-center justify-center p-6 z-[100] animate-fadeIn">
                    <div className="bg-white rounded-[48px] w-full max-w-4xl shadow-2xl border border-gray-100 overflow-hidden transform animate-modalEnter">
                        <div className="bg-white p-12">
                            <div className="flex justify-between items-start mb-10">
                                <div className="flex items-center gap-5">
                                    <div className="w-20 h-20 bg-gray-50 rounded-[28px] flex items-center justify-center text-[#003B73] border border-gray-100 shadow-sm relative overflow-hidden group">
                                        <div className="absolute inset-0 bg-[#003B73]/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                                        <Award size={40} className="relative z-10" />
                                    </div>
                                    <div>
                                        <h3 className="text-3xl font-black text-[#003B73] tracking-tight">{editingStudent.name}</h3>
                                        <p className="text-gray-400 font-bold text-xs uppercase tracking-[0.2em] mt-1">Identifier: {editingStudent.registerNumber}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setEditingStudent(null)}
                                    className="p-4 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-3xl transition-all group"
                                >
                                    <X size={32} className="group-hover:rotate-90 transition-transform duration-500" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                                {[1, 2, 3].map(phase => (
                                    <div key={phase} className="p-8 bg-gray-50 rounded-[40px] border border-gray-100 space-y-8">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-[#003B73] text-white rounded-xl flex items-center justify-center font-black text-sm">0{phase}</div>
                                            <h4 className="font-black text-[#003B73] uppercase tracking-widest text-sm">CIA Phase</h4>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Test Performance</label>
                                                <input
                                                    type="number"
                                                    className="w-full px-6 py-4 bg-white border-2 border-transparent focus:border-[#003B73] rounded-2xl font-black text-[#003B73] outline-none transition-all shadow-sm"
                                                    value={editForm[`cia${phase}_test`] || ''}
                                                    onChange={(e) => handleFormChange(`cia${phase}_test`, e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Assignment Delta</label>
                                                <input
                                                    type="number"
                                                    className="w-full px-6 py-4 bg-white border-2 border-transparent focus:border-[#003B73] rounded-2xl font-black text-[#003B73] outline-none transition-all shadow-sm"
                                                    value={editForm[`cia${phase}_assignment`] || ''}
                                                    onChange={(e) => handleFormChange(`cia${phase}_assignment`, e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Attendance Credit</label>
                                                <input
                                                    type="number"
                                                    className="w-full px-6 py-4 bg-white border-2 border-transparent focus:border-[#003B73] rounded-2xl font-black text-[#003B73] outline-none transition-all shadow-sm"
                                                    value={editForm[`cia${phase}_attendance`] || ''}
                                                    onChange={(e) => handleFormChange(`cia${phase}_attendance`, e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-gray-200/50">
                                            <div className="flex justify-between items-center px-1">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Aggregate</span>
                                                <span className="text-xl font-black text-[#003B73]">
                                                    {sum(editForm[`cia${phase}_test`], editForm[`cia${phase}_assignment`], editForm[`cia${phase}_attendance`])}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-12 pt-10 border-t-2 border-dashed border-gray-100 flex items-center justify-between">
                                <div className="flex items-center gap-3 text-amber-600 px-6 py-4 bg-amber-50 rounded-2xl border border-amber-100">
                                    <AlertTriangle size={20} />
                                    <span className="text-xs font-black uppercase tracking-widest">Administrator Override Active</span>
                                </div>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setEditingStudent(null)}
                                        className="px-10 py-5 bg-gray-50 text-gray-500 rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all transform active:scale-95"
                                    >
                                        Discard Changes
                                    </button>
                                    <button
                                        onClick={handleSaveOverride}
                                        disabled={saving}
                                        className="px-12 py-5 bg-[#003B73] text-white rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-[#002850] shadow-xl shadow-blue-900/10 transition-all transform active:scale-95 disabled:opacity-50 flex items-center gap-3"
                                    >
                                        {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                                        {saving ? 'Committing...' : 'Commit Overrides'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminMarksManager;
