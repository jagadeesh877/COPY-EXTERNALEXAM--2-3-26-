import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../api/axios';
import { Users, ChevronRight, GraduationCap, Plus, X, ArrowLeft, Trash2, Edit2 } from 'lucide-react';

const StudentManager = () => {
    const [selectedDept, setSelectedDept] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const [selectedSection, setSelectedSection] = useState(null);
    const [studentsList, setStudentsList] = useState([]);

    // Dynamic Departments
    const [departments, setDepartments] = useState([]);
    const [loadingDepts, setLoadingDepts] = useState(false);

    // UI States
    const [loading, setLoading] = useState(false);
    const location = useLocation();

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);

    // Form Inputs
    const [newStudent, setNewStudent] = useState({
        registerNumber: '',
        name: '',
        department: '',
        year: '',
        section: '',
        semester: ''
    });

    useEffect(() => {
        fetchDepartments();
        if (location.state?.openAddModal) {
            setShowCreateModal(true);
        }
    }, [location]);

    const fetchDepartments = async () => {
        setLoadingDepts(true);
        try {
            const res = await api.get('/admin/departments');
            if (res.data.length > 0) {
                setDepartments(res.data);
            } else {
                setDepartments([]);
            }
        } catch (err) {
            console.error("Failed to fetch departments");
        } finally {
            setLoadingDepts(false);
        }
    }

    const fetchStudents = async (section) => {
        setSelectedSection(section);
        setLoading(true);
        try {
            const res = await api.get('/admin/students');
            const allStudents = Array.isArray(res.data) ? res.data : [];
            const filtered = allStudents.filter(s => {
                const yearMatch = s.year === parseInt(selectedYear);
                const sectionMatch = s.section === section;

                if (selectedDept === 'First Year (General)') {
                    return yearMatch && sectionMatch && (s.department === null || s.department === '' || s.department === 'First Year (General)');
                }

                return yearMatch && sectionMatch && s.department === selectedDept && s.year > 1;
            });
            setStudentsList(filtered);
        } catch (err) {
            console.error(err);
            alert('Failed to fetch students');
        } finally {
            setLoading(false);
        }
    }

    const resetSelection = (level) => {
        if (level === 0) { setSelectedDept(null); setSelectedYear(null); setSelectedSection(null); }
        if (level === 1) {
            setSelectedYear(null);
            setSelectedSection(null);
            if (selectedDept === 'First Year (General)') setSelectedYear(1);
        }
        if (level === 2) { setSelectedSection(null); }
    }

    const handleBack = () => {
        if (selectedSection) {
            setSelectedSection(null);
        } else if (selectedYear) {
            if (selectedDept === 'First Year (General)') {
                setSelectedYear(null);
                setSelectedDept(null);
            } else {
                setSelectedYear(null);
            }
        } else if (selectedDept) {
            setSelectedDept(null);
        }
    }

    const handleEditStudent = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/admin/students/${editingStudent.id}`, editingStudent);
            alert('Student Updated Successfully');
            setShowEditModal(false);
            setEditingStudent(null);
            fetchStudents(selectedSection);
        } catch (err) {
            alert('Error updating student: ' + (err.response?.data?.message || err.message));
        }
    }

    const handleCreateStudent = async (e) => {
        e.preventDefault();
        try {
            await api.post('/admin/students', newStudent);
            alert('Student Added Successfully');
            setShowCreateModal(false);
            setNewStudent({
                registerNumber: '',
                name: '',
                department: '',
                year: '',
                section: '',
                semester: ''
            });
            if (
                selectedDept === newStudent.department &&
                parseInt(selectedYear) === parseInt(newStudent.year) &&
                selectedSection === newStudent.section
            ) {
                fetchStudents(selectedSection);
            }
        } catch (err) {
            alert('Error adding student: ' + (err.response?.data?.message || err.message));
        }
    }

    const handleDeleteStudent = async (id) => {
        if (!confirm('Are you sure you want to delete this student? All marks will be lost.')) return;
        try {
            await api.delete(`/admin/students/${id}`);
            setStudentsList(studentsList.filter(s => s.id !== id));
        } catch (err) {
            alert('Failed to delete student');
        }
    }

    return (
        <div className="flex flex-col animate-fadeIn">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
                <div>
                    <h1 className="text-4xl font-black text-[#003B73] tracking-tight">Student Management</h1>
                    <p className="text-gray-500 font-medium mt-1">Navigate and manage student records across all departments.</p>
                </div>

                <button
                    onClick={() => {
                        const isGeneral = selectedDept === 'First Year (General)';
                        setNewStudent({
                            ...newStudent,
                            department: isGeneral ? '' : (selectedDept || ''),
                            year: selectedYear || (isGeneral ? '1' : ''),
                            section: selectedSection || '',
                            semester: selectedYear ? (selectedYear * 2 - 1).toString() : (isGeneral ? '1' : '')
                        });
                        setShowCreateModal(true);
                    }}
                    className="px-8 py-4 bg-[#003B73] text-white rounded-[24px] font-black hover:bg-[#002850] shadow-xl shadow-blue-900/10 transition-all flex items-center gap-2 transform active:scale-95"
                >
                    <Plus size={22} strokeWidth={3} /> Register Student
                </button>
            </div>

            <div className="bg-white p-10 rounded-[40px] shadow-xl border border-gray-100 min-h-[650px] transition-all relative overflow-hidden">
                {/* Decorative Element */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gray-50 rounded-bl-[100px] -z-0 opacity-50"></div>

                {/* Back Button & Breadcrumbs */}
                <div className="flex items-center gap-6 mb-12 relative z-10 border-b border-gray-50 pb-8">
                    {selectedDept && (
                        <button
                            onClick={handleBack}
                            className="w-12 h-12 flex items-center justify-center bg-gray-50 hover:bg-white hover:shadow-md rounded-2xl transition-all text-[#003B73] border border-transparent hover:border-gray-100"
                            title="Go Back"
                        >
                            <ArrowLeft size={24} strokeWidth={2.5} />
                        </button>
                    )}

                    <div className="flex items-center gap-3 text-sm overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => resetSelection(0)}
                            className={`px-4 py-2 rounded-xl transition-all font-black uppercase tracking-widest text-[10px] ${!selectedDept ? 'bg-[#003B73] text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                        >
                            Departments
                        </button>

                        {selectedDept && (
                            <>
                                <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                                <button
                                    onClick={() => resetSelection(1)}
                                    className={`px-4 py-2 rounded-xl transition-all font-black uppercase tracking-widest text-[10px] whitespace-nowrap ${!selectedYear ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                                >
                                    {selectedDept}
                                </button>
                            </>
                        )}

                        {selectedYear && selectedDept !== 'First Year (General)' && (
                            <>
                                <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                                <button
                                    onClick={() => resetSelection(2)}
                                    className={`px-4 py-2 rounded-xl transition-all font-black uppercase tracking-widest text-[10px] whitespace-nowrap ${!selectedSection ? 'bg-emerald-600 text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                                >
                                    Year {selectedYear}
                                </button>
                            </>
                        )}

                        {selectedSection && (
                            <>
                                <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                                <div className="px-5 py-2 bg-blue-50 text-blue-600 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-sm border border-blue-100 whitespace-nowrap">
                                    Section {selectedSection}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Level 1: Dept */}
                {!selectedDept && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 animate-fadeIn relative z-10">
                        <div onClick={() => {
                            setSelectedDept('First Year (General)');
                            setSelectedYear(1);
                        }}
                            className="group p-10 bg-purple-50/50 hover:bg-purple-600 rounded-[32px] cursor-pointer transition-all duration-500 border border-purple-100 hover:shadow-2xl hover:shadow-purple-200 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:bg-white/20 transition-all duration-500 mb-6">
                                <Users className="w-8 h-8 text-purple-600 group-hover:text-white" />
                            </div>
                            <h3 className="text-2xl font-black text-purple-900 group-hover:text-white transition-colors">GEN</h3>
                            <p className="text-xs font-black text-purple-400 group-hover:text-purple-100 mt-2 uppercase tracking-widest">Unassigned Pool</p>
                        </div>

                        {(Array.isArray(departments) ? departments : []).filter(d => d && d.name !== 'First Year (General)').map(dept => (
                            <div key={dept.id} onClick={() => setSelectedDept(dept.name)}
                                className="group p-10 bg-blue-50/50 hover:bg-[#003B73] rounded-[32px] cursor-pointer transition-all duration-500 border border-blue-100 hover:shadow-2xl hover:shadow-blue-200 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:bg-white/20 transition-all duration-500 mb-6">
                                    <GraduationCap className="w-8 h-8 text-[#003B73] group-hover:text-white" />
                                </div>
                                <h3 className="text-2xl font-black text-[#003B73] group-hover:text-white transition-colors">{dept.name}</h3>
                                <p className="text-xs font-black text-blue-400 group-hover:text-blue-100 mt-2 uppercase tracking-widest">Explore Dept</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Level 2: Year */}
                {selectedDept && selectedDept !== 'First Year (General)' && !selectedYear && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 animate-fadeIn relative z-10">
                        {(departments.find(d => d.name === selectedDept)?.years?.split(',').map(y => parseInt(y)) || [2, 3, 4]).map(year => (
                            <div key={year} onClick={() => setSelectedYear(year)}
                                className="group p-10 bg-indigo-50/50 hover:bg-indigo-600 rounded-[32px] cursor-pointer transition-all duration-500 border border-indigo-100 hover:shadow-2xl hover:shadow-indigo-200 flex flex-col items-center justify-center text-center">
                                <div className="text-5xl font-black text-indigo-300 group-hover:text-indigo-200 group-hover:scale-110 transition-all duration-500 mb-4 opacity-50">
                                    {year}
                                </div>
                                <h3 className="text-2xl font-black text-indigo-900 group-hover:text-white uppercase transition-colors">Year {year}</h3>
                                <p className="text-[10px] font-black text-indigo-400 group-hover:text-indigo-100 uppercase tracking-widest mt-2 px-4 py-1.5 bg-white group-hover:bg-white/10 rounded-lg">
                                    Sem {(year * 2) - 1} & {year * 2}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Level 3: Section */}
                {selectedDept && selectedYear && !selectedSection && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 animate-fadeIn relative z-10">
                        {(departments.find(d => d.name === (selectedYear === 1 ? 'First Year (General)' : selectedDept))?.sections?.split(',') || ['A', 'B', 'C']).map(sec => (
                            <div key={sec} onClick={() => fetchStudents(sec)}
                                className="group p-10 bg-emerald-50/50 hover:bg-emerald-600 rounded-[32px] cursor-pointer transition-all duration-500 border border-emerald-100 hover:shadow-2xl hover:shadow-emerald-200 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:bg-white/20 transition-all duration-500 mb-6">
                                    <Users className="w-8 h-8 text-emerald-600 group-hover:text-white" />
                                </div>
                                <h3 className="text-2xl font-black text-emerald-900 group-hover:text-white uppercase transition-colors">Section {sec}</h3>
                                <p className="text-xs font-black text-emerald-500 group-hover:text-emerald-100 mt-2 uppercase tracking-widest">View Roster</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Level 4: List */}
                {selectedSection && (
                    <div className="animate-fadeIn relative z-10 h-full">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-40">
                                <div className="w-12 h-12 border-4 border-gray-100 border-t-[#003B73] rounded-full animate-spin mb-4"></div>
                                <p className="font-black text-gray-400 uppercase tracking-widest text-xs">Fetching Roster...</p>
                            </div>
                        ) : (
                            <div className="overflow-hidden bg-gray-50/30 rounded-3xl border border-gray-100">
                                <table className="w-full text-center border-collapse">
                                    <thead className="bg-gray-100/50 text-[#003B73] text-[10px] font-black uppercase tracking-[0.2em]">
                                        <tr>
                                            <th className="px-8 py-6 text-left">Student Profile</th>
                                            <th className="px-8 py-6">Register Number</th>
                                            <th className="px-8 py-6">Current Sem</th>
                                            <th className="px-8 py-6 text-right">Settings</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100/50">
                                        {studentsList.map(s => (
                                            <tr key={s.id} className="group hover:bg-white transition-all duration-300">
                                                <td className="px-8 py-6 text-left">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center font-black text-[#003B73] shadow-sm border border-gray-100 group-hover:scale-110 transition-all duration-500 group-hover:shadow-indigo-100">
                                                            {s.name.charAt(0)}
                                                        </div>
                                                        <span className="font-extrabold text-gray-800 text-lg group-hover:text-[#003B73] transition-colors">{s.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 font-mono font-bold text-gray-400 text-sm group-hover:text-gray-600">
                                                    {s.registerNumber}
                                                </td>
                                                <td className="px-8 py-6">
                                                    <span className="px-5 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-black text-xs border border-indigo-100 shadow-sm">
                                                        Semester {s.semester}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                                                        <button
                                                            onClick={() => { setEditingStudent(s); setShowEditModal(true); }}
                                                            className="p-3 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteStudent(s.id)}
                                                            className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {studentsList.length === 0 && (
                                            <tr>
                                                <td colSpan="4" className="py-32 text-center">
                                                    <Users size={64} className="mx-auto mb-4 text-gray-100" />
                                                    <p className="font-black text-gray-300 text-xl uppercase tracking-widest">Class is Empty</p>
                                                    <p className="text-gray-300 font-bold mt-1 text-sm">No students registered in this section yet.</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Add Student Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-[#003B73]/20 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-fadeIn">
                    <div className="bg-white rounded-[48px] p-10 w-full max-w-xl shadow-2xl border border-gray-100">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h3 className="text-3xl font-black text-[#003B73] tracking-tight">New Student</h3>
                                <p className="text-gray-500 font-bold text-sm mt-1">Register a new profile to the system.</p>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="p-4 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-3xl transition-all">
                                <X size={32} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateStudent} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Register Number</label>
                                    <input
                                        className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-3xl font-bold text-gray-800 outline-none transition-all font-mono"
                                        placeholder="2021CSE001"
                                        value={newStudent.registerNumber}
                                        onChange={e => setNewStudent({ ...newStudent, registerNumber: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Full Name</label>
                                    <input
                                        className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-3xl font-bold text-gray-800 outline-none transition-all"
                                        placeholder="John Doe"
                                        value={newStudent.name}
                                        onChange={e => setNewStudent({ ...newStudent, name: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Department</label>
                                    <select
                                        className={`w-full px-6 py-5 border-2 border-transparent focus:border-[#003B73] rounded-3xl font-black outline-none transition-all appearance-none cursor-pointer ${newStudent.year === '1' ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-50 text-[#003B73]'}`}
                                        value={newStudent.year === '1' ? '' : newStudent.department}
                                        onChange={e => setNewStudent({ ...newStudent, department: e.target.value })}
                                        required={newStudent.year !== '1'}
                                        disabled={newStudent.year === '1'}
                                    >
                                        <option value="">{newStudent.year === '1' ? 'Common (First Year)' : 'Select Dept'}</option>
                                        {departments.filter(d => d.name !== 'First Year (General)').map(d => <option key={d.id} value={d.name}>{d.code || d.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Academic Year</label>
                                    <select
                                        className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-3xl font-black text-[#003B73] outline-none transition-all appearance-none cursor-pointer"
                                        value={newStudent.year}
                                        onChange={e => setNewStudent({ ...newStudent, year: e.target.value })}
                                        required
                                    >
                                        <option value="">Select Year</option>
                                        {(newStudent.department
                                            ? departments.find(d => d.name === newStudent.department)?.years?.split(',') || ['2', '3', '4']
                                            : ['1', '2', '3', '4']).map(y => <option key={y} value={y}>{y} Year</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Section</label>
                                    <select
                                        className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-3xl font-black text-[#003B73] outline-none transition-all appearance-none cursor-pointer"
                                        value={newStudent.section}
                                        onChange={e => setNewStudent({ ...newStudent, section: e.target.value })}
                                        required
                                    >
                                        <option value="">Select Section</option>
                                        {(departments.find(d => d.name === (newStudent.year === '1' ? 'First Year (General)' : newStudent.department))?.sections?.split(',') || ['A', 'B', 'C']).map(s => (
                                            <option key={s} value={s}>Section {s}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Semester</label>
                                    <select
                                        className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-3xl font-black text-[#003B73] outline-none transition-all appearance-none cursor-pointer"
                                        value={newStudent.semester}
                                        onChange={e => setNewStudent({ ...newStudent, semester: e.target.value })}
                                        required
                                    >
                                        <option value="">Select Sem</option>
                                        {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Sem {s}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-6">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-[24px] font-black transition-all transform active:scale-95">
                                    Cancel
                                </button>
                                <button type="submit" className="flex-1 py-5 bg-[#003B73] text-white rounded-[24px] font-black hover:bg-[#002850] shadow-xl shadow-blue-900/10 transition-all transform active:scale-95">
                                    Finalize Entry
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Student Modal */}
            {showEditModal && editingStudent && (
                <div className="fixed inset-0 bg-[#003B73]/20 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-fadeIn">
                    <div className="bg-white rounded-[48px] p-10 w-full max-w-xl shadow-2xl border border-gray-100">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h3 className="text-3xl font-black text-[#003B73] tracking-tight">Edit Profile</h3>
                                <p className="text-gray-500 font-bold text-sm mt-1">Updating records for {editingStudent.name}</p>
                            </div>
                            <button onClick={() => setShowEditModal(false)} className="p-4 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-3xl transition-all">
                                <X size={32} />
                            </button>
                        </div>

                        <form onSubmit={handleEditStudent} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Register Number</label>
                                    <input
                                        className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-3xl font-bold text-gray-800 outline-none transition-all font-mono"
                                        value={editingStudent.registerNumber}
                                        onChange={e => setEditingStudent({ ...editingStudent, registerNumber: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Full Name</label>
                                    <input
                                        className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-3xl font-bold text-gray-800 outline-none transition-all"
                                        value={editingStudent.name}
                                        onChange={e => setEditingStudent({ ...editingStudent, name: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Department</label>
                                    <select
                                        className={`w-full px-6 py-5 border-2 border-transparent focus:border-[#003B73] rounded-3xl font-black outline-none transition-all appearance-none cursor-pointer ${parseInt(editingStudent.year) === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-50 text-[#003B73]'}`}
                                        value={parseInt(editingStudent.year) === 1 ? '' : (editingStudent.department || '')}
                                        onChange={e => setEditingStudent({ ...editingStudent, department: e.target.value })}
                                        required={parseInt(editingStudent.year) !== 1}
                                        disabled={parseInt(editingStudent.year) === 1}
                                    >
                                        <option value="">{parseInt(editingStudent.year) === 1 ? 'Common (First Year)' : 'Select Dept'}</option>
                                        {departments.filter(d => d.name !== 'First Year (General)').map(d => <option key={d.id} value={d.name}>{d.code || d.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Academic Year</label>
                                    <select
                                        className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-3xl font-black text-[#003B73] outline-none transition-all appearance-none cursor-pointer"
                                        value={editingStudent.year}
                                        onChange={e => {
                                            const year = parseInt(e.target.value);
                                            setEditingStudent({
                                                ...editingStudent,
                                                year: year,
                                                department: year === 1 ? null : editingStudent.department
                                            });
                                        }}
                                        required
                                    >
                                        {(editingStudent.department
                                            ? departments.find(d => d.name === editingStudent.department)?.years?.split(',') || ['2', '3', '4']
                                            : ['1', '2', '3', '4']).map(y => <option key={y} value={y}>{y} Year</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Section</label>
                                    <select
                                        className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-3xl font-black text-[#003B73] outline-none transition-all appearance-none cursor-pointer"
                                        value={editingStudent.section}
                                        onChange={e => setEditingStudent({ ...editingStudent, section: e.target.value })}
                                        required
                                    >
                                        {(departments.find(d => d.name === (parseInt(editingStudent.year) === 1 ? 'First Year (General)' : editingStudent.department))?.sections?.split(',') || ['A', 'B', 'C']).map(s => (
                                            <option key={s} value={s}>Section {s}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Semester</label>
                                    <select
                                        className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-3xl font-black text-[#003B73] outline-none transition-all appearance-none cursor-pointer"
                                        value={editingStudent.semester}
                                        onChange={e => setEditingStudent({ ...editingStudent, semester: parseInt(e.target.value) })}
                                        required
                                    >
                                        {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Sem {s}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-6">
                                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-[24px] font-black transition-all transform active:scale-95">
                                    Cancel
                                </button>
                                <button type="submit" className="flex-1 py-5 bg-[#003B73] text-white rounded-[24px] font-black hover:bg-[#002850] shadow-xl shadow-blue-900/10 transition-all transform active:scale-95">
                                    Update Record
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentManager;
