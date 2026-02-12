import { useState, useEffect } from 'react';
import api from '../../api/axios';
import {
    Building2, Users, Plus, Edit2, Trash2,
    Briefcase, GraduationCap, X, BookOpen
} from 'lucide-react';

const DepartmentManager = () => {
    const [departments, setDepartments] = useState([]);
    const [facultyList, setFacultyList] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal States
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [selectedDept, setSelectedDept] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        hodId: '',
        sections: 'A,B,C',
        years: '2,3,4'
    });

    useEffect(() => {
        fetchData();
        fetchFaculty();
    }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/admin/departments');
            setDepartments(Array.isArray(res.data) ? res.data : []);
            setLoading(false);
        } catch (err) {
            console.error("Failed to load departments", err);
            setLoading(false);
        }
    };

    const fetchFaculty = async () => {
        try {
            const res = await api.get('/admin/faculty');
            setFacultyList(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("Failed to load faculty", err);
        }
    };

    const handleOpenModal = (dept = null) => {
        if (dept) {
            setEditMode(true);
            setSelectedDept(dept);
            setFormData({
                name: dept.name,
                code: dept.code || '',
                hodId: dept.hodId || '',
                sections: dept.sections || 'A,B,C',
                years: dept.years || '2,3,4'
            });
        } else {
            setEditMode(false);
            setSelectedDept(null);
            setFormData({ name: '', code: '', hodId: '', sections: 'A,B,C', years: '2,3,4' });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editMode && selectedDept) {
                await api.put(`/admin/departments/${selectedDept.id}`, formData);
                alert('Department updated successfully');
            } else {
                await api.post('/admin/departments', formData);
                alert('Department created successfully');
            }
            setShowModal(false);
            fetchData();
        } catch (err) {
            alert('Operation failed. Name/Code might be duplicate.');
        }
    };

    const handleYearToggle = (year) => {
        const currentYears = formData.years.split(',').filter(y => y.trim() !== '');
        let newYears;
        if (currentYears.includes(year.toString())) {
            newYears = currentYears.filter(y => y !== year.toString());
        } else {
            newYears = [...currentYears, year.toString()].sort();
        }
        setFormData({ ...formData, years: newYears.join(',') });
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this department?')) return;
        try {
            await api.delete(`/admin/departments/${id}`);
            fetchData();
        } catch (err) {
            alert('Failed to delete department');
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-48">
            <div className="w-12 h-12 border-4 border-gray-100 border-t-[#003B73] rounded-full animate-spin mb-4"></div>
            <p className="font-black text-gray-400 uppercase tracking-widest text-xs">Initializing Departments...</p>
        </div>
    );

    return (
        <div className="flex flex-col animate-fadeIn">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6 px-2">
                <div>
                    <h1 className="text-4xl font-black text-[#003B73] tracking-tight">Department Management</h1>
                    <p className="text-gray-500 font-medium mt-1">Configure institutional structure and assign leadership roles.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-8 py-4 bg-[#003B73] text-white rounded-[24px] font-black hover:bg-[#002850] shadow-xl shadow-blue-900/10 transition-all flex items-center gap-2 transform active:scale-95"
                >
                    <Plus size={22} strokeWidth={3} /> Add New Department
                </button>
            </div>

            {/* Department Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-10">
                {(Array.isArray(departments) ? departments : []).filter(d => d).map((dept, index) => (
                    <div
                        key={dept.id}
                        className="animate-fadeIn group bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden relative hover:shadow-2xl transition-all duration-500 hover:-translate-y-1"
                        style={{ animationDelay: `${index * 50}ms` }}
                    >
                        {/* Decorative Top Accent */}
                        <div className="h-2 w-full bg-gradient-to-r from-[#003B73] via-blue-500 to-[#00A8E8]"></div>

                        <div className="p-8">
                            <div className="flex justify-between items-start mb-6">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-2xl font-black text-gray-800 tracking-tight leading-none group-hover:text-[#003B73] transition-colors">
                                            {dept.name}
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="px-3 py-1 bg-blue-50 text-[#003B73] text-[10px] font-black uppercase tracking-widest rounded-lg border border-blue-100">
                                            {dept.code || 'NO CODE'}
                                        </span>
                                        <span className="px-3 py-1 bg-gray-50 text-gray-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-gray-100">
                                            ID: {String(dept.id).slice(0, 8)}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-4 group-hover:translate-x-0">
                                    <button
                                        onClick={() => handleOpenModal(dept)}
                                        className="p-3 bg-blue-50 text-blue-600 rounded-2xl hover:bg-[#003B73] hover:text-white transition-all shadow-sm"
                                        title="Edit Department"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(dept.id)}
                                        className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                        title="Delete Department"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4 mb-8">
                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group-hover:bg-white transition-colors duration-500">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white rounded-xl shadow-sm border border-gray-50 text-[#003B73]">
                                            <Briefcase size={18} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Head of Dept</p>
                                            <p className={`font-bold mt-1 ${dept.hodName === 'Unassigned' || !dept.hodName ? 'text-gray-400 italic' : 'text-gray-800'}`}>
                                                {dept.hodName || 'Unassigned'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 group-hover:bg-white transition-colors duration-500">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Users size={14} className="text-[#003B73]" />
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sections</p>
                                        </div>
                                        <p className="font-extrabold text-lg text-gray-800 tracking-tight">{dept.sections}</p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 group-hover:bg-white transition-colors duration-500">
                                        <div className="flex items-center gap-2 mb-1">
                                            <GraduationCap size={14} className="text-[#003B73]" />
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Academic Years</p>
                                        </div>
                                        <p className="font-extrabold text-lg text-gray-800 tracking-tight">
                                            {dept.name === 'First Year (General)' ? '1' : (dept.years || '2,3,4')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Metrics Footer */}
                            <div className="grid grid-cols-3 gap-3 pt-6 border-t border-gray-100">
                                <div className="flex flex-col items-center">
                                    <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1">Faculty</p>
                                    <p className="text-xl font-black text-[#003B73]">{dept.stats?.faculty || 0}</p>
                                </div>
                                <div className="flex flex-col items-center border-x border-gray-100">
                                    <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1">Students</p>
                                    <p className="text-xl font-black text-[#003B73]">{dept.stats?.students || 0}</p>
                                </div>
                                <div className="flex flex-col items-center">
                                    <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1">Subjects</p>
                                    <p className="text-xl font-black text-[#003B73]">{dept.stats?.subjects || 0}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {departments.length === 0 && (
                    <div className="col-span-full py-40 flex flex-col items-center text-center bg-white rounded-[40px] border-2 border-dashed border-gray-100 shadow-sm">
                        <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 text-gray-200">
                            <Building2 size={48} />
                        </div>
                        <h3 className="text-3xl font-black text-gray-800 tracking-tight">No Departments Found</h3>
                        <p className="text-gray-400 font-medium max-w-sm mx-auto mt-2 px-6">
                            Register your institutional units to begin managing curriculum and faculty.
                        </p>
                    </div>
                )}
            </div>

            {/* Modal Overlay */}
            {showModal && (
                <div className="fixed inset-0 bg-[#003B73]/20 backdrop-blur-md flex items-center justify-center p-6 z-[100] animate-fadeIn">
                    <div className="bg-white rounded-[48px] w-full max-w-xl shadow-2xl border border-gray-100 overflow-hidden transform animate-modalEnter">
                        <div className="bg-white p-10 pb-4">
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h3 className="text-3xl font-black text-[#003B73] tracking-tight">
                                        {editMode ? 'Edit Department' : 'New Department'}
                                    </h3>
                                    <p className="text-gray-500 font-bold text-sm mt-1">
                                        {editMode ? 'Update institutional unit parameters' : 'Register a new institutional unit'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="p-4 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-3xl transition-all"
                                >
                                    <X size={32} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 block px-1">Full Department Name</label>
                                        <input
                                            className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-3xl font-bold text-gray-800 outline-none transition-all"
                                            placeholder="e.g. Mechanical Engineering"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 block px-1">Short Code</label>
                                        <input
                                            className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-3xl font-bold text-gray-800 outline-none transition-all font-mono"
                                            placeholder="e.g. MECH"
                                            value={formData.code}
                                            onChange={e => setFormData({ ...formData, code: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="p-8 bg-gray-50 rounded-[32px] border border-gray-100">
                                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                                        <div className="w-full md:w-auto">
                                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 block px-1">Academic Cycle (Years)</label>
                                            <div className="flex gap-2">
                                                {[1, 2, 3, 4].map(year => (
                                                    <button
                                                        key={year}
                                                        type="button"
                                                        onClick={() => handleYearToggle(year)}
                                                        className={`w-14 h-14 rounded-2xl font-black text-lg transition-all ${formData.years.split(',').includes(year.toString())
                                                            ? 'bg-[#003B73] text-white shadow-lg scale-110'
                                                            : 'bg-white text-gray-400 border border-gray-100 hover:border-[#003B73]/30'
                                                            }`}
                                                    >
                                                        {year}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex-1 w-full">
                                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 block px-1">Sections (csv)</label>
                                            <input
                                                className="w-full px-6 py-5 bg-white border-2 border-transparent focus:border-[#003B73] rounded-2xl font-bold text-gray-800 outline-none transition-all shadow-sm"
                                                placeholder="A,B,C"
                                                value={formData.sections}
                                                onChange={e => setFormData({ ...formData, sections: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 block px-1">Appoint Head of Department</label>
                                    <div className="relative group">
                                        <select
                                            className="w-full px-8 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-3xl font-black text-[#003B73] outline-none transition-all appearance-none cursor-pointer"
                                            value={formData.hodId}
                                            onChange={e => setFormData({ ...formData, hodId: e.target.value })}
                                        >
                                            <option value="">-- No Leadership Assigned --</option>
                                            {(Array.isArray(facultyList) ? facultyList : []).map(f => (
                                                <option key={f.id} value={f.id}>{f.fullName} ({f.department || 'No Dept'})</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-[#003B73] opacity-60 group-hover:opacity-100 transition-opacity">
                                            <Users size={20} />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4 mb-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 py-5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-[24px] font-black transition-all transform active:scale-95"
                                    >
                                        Discard
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-[2] py-5 bg-[#003B73] text-white rounded-[24px] font-black hover:bg-[#002850] shadow-xl shadow-blue-900/10 transition-all transform active:scale-95"
                                    >
                                        {editMode ? 'Save Changes' : 'Confirm Registration'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DepartmentManager;
