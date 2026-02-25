import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Users, ChevronRight, GraduationCap, Plus, X, ArrowLeft, Trash2, Edit2, Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import ExcelJS from 'exceljs';
import api from '../../api/axios';
import toast from 'react-hot-toast';

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
        rollNo: '', // Added Roll No
        registerNumber: '',
        name: '',
        department: '',
        year: '',
        section: '',
        semester: ''
    });

    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkUploading, setBulkUploading] = useState(false);
    const [bulkResult, setBulkResult] = useState(null);
    const [bulkConfig, setBulkConfig] = useState({ year: 1, section: 'A', semester: 1, department: '' });

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

            // Find the short code for the currently selected department name
            const matchingDept = departments.find(d => d.name === selectedDept);
            const deptCodeToMatch = matchingDept ? (matchingDept.code || matchingDept.name) : selectedDept;

            const filtered = allStudents.filter(s => {
                const yearMatch = s.year === parseInt(selectedYear);
                const sectionMatch = s.section === section;

                if (selectedDept === 'First Year (General)') {
                    return yearMatch && sectionMatch && (s.department === null || s.department === '' || s.department === 'First Year (General)' || s.department === 'GEN');
                }

                return yearMatch && sectionMatch && s.department === deptCodeToMatch && s.year > 1;
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
                rollNo: '',
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

    const downloadTemplate = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Students');

        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Student Name', key: 'name', width: 25 },
            { header: 'Roll Number', key: 'rollNo', width: 15 },
            { header: 'Registration Number', key: 'registerNumber', width: 20 }
        ];

        // Sample Row
        worksheet.addRow({
            sno: 1,
            name: 'Sample Student 1',
            rollNo: 'E21CS001',
            registerNumber: '812423103001'
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Student_Bulk_Upload_Template.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const handleBulkUpload = async (e) => {
        e.preventDefault();
        if (!bulkFile) return;

        setBulkUploading(true);
        setBulkResult(null);

        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(bulkFile);

            // Find first non-empty worksheet
            const worksheet = workbook.worksheets.find(ws => ws.actualRowCount > 0) || workbook.getWorksheet(1);
            if (!worksheet) throw new Error('Could not find a valid worksheet in the file');

            console.log(`[BulkDebug] Using Worksheet: "${worksheet.name}" with ${worksheet.actualRowCount} rows`);

            const students = [];
            let currentDept = null;
            const deptMap = {
                'CIVIL': 'Civil Engineering',
                'CSE': 'Computer Science and Engineering',
                'COMPUTER': 'Computer Science and Engineering',
                'MECHANICAL': 'Mechanical Engineering',
                'MECH': 'Mechanical Engineering',
                'ECE': 'Electronics and Communication Engineering',
                'EEE': 'Electrical and Electronics Engineering'
            };

            worksheet.eachRow((row, rowNumber) => {
                // row.values is 1-indexed in ExcelJS
                const values = row.values;
                const colA = (row.getCell(1).text || "").trim();
                const colB = (row.getCell(2).text || "").trim();
                const colC = (row.getCell(3).text || "").trim();
                const colD = (row.getCell(4).text || "").trim();

                console.log(`[BulkDebug] Row ${rowNumber} RAW:`, JSON.stringify(values));
                console.log(`[BulkDebug] Parsed: A="${colA}", B="${colB}", C="${colC}"`);

                if (!colB && !colC) return;

                // Dept Header: No S.No, No Roll, has long Name string
                if (!colA && !colC && colB.length > 5 && isNaN(colB)) {
                    console.log(`[BulkDebug] Found Dept Header: ${colB}`);
                    const upperB = colB.toUpperCase();
                    let found = false;
                    for (const key in deptMap) {
                        if (upperB.includes(key)) {
                            currentDept = deptMap[key];
                            found = true;
                            break;
                        }
                    }
                    if (!found) currentDept = colB;
                    return;
                }

                // Student detection: EITHER colA is a number OR colC is an alphanumeric string
                const looksLikeSNo = colA && !isNaN(parseInt(colA));
                const looksLikeRoll = colC && colC.length >= 4 && /^[A-Z0-9]+$/i.test(colC);

                if (looksLikeSNo || looksLikeRoll) {
                    if (!colB) return; // Still need a name

                    console.log(`[BulkDebug] Adding Student: ${colB} (${colC})`);
                    students.push({
                        rollNo: colC || `TEMP-${rowNumber}`, // Fallback if no roll in file
                        registerNumber: colD || null,
                        name: colB,
                        department: currentDept || bulkConfig.department || selectedDept,
                        year: parseInt(bulkConfig.year),
                        section: bulkConfig.section,
                        semester: parseInt(bulkConfig.semester)
                    });
                }
            });

            if (students.length === 0) throw new Error('No valid student records found in file');

            const res = await api.post('/admin/students/bulk', { students });
            setBulkResult(res.data);
            toast.success(`Processed ${students.length} records`);

            if (selectedSection) fetchStudents(selectedSection);
        } catch (err) {
            console.error('Bulk Upload Error:', err);
            toast.error(err.message || 'Failed to process bulk upload');
        } finally {
            setBulkUploading(false);
        }
    };

    return (
        <div className="flex flex-col animate-fadeIn">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
                <div>
                    <h1 className="text-4xl font-black text-[#003B73] tracking-tight">Student Management</h1>
                    <p className="text-gray-500 font-medium mt-1">Navigate and manage student records across all departments.</p>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={() => setShowBulkModal(true)}
                        className="px-6 py-4 bg-emerald-50 text-emerald-600 rounded-[24px] font-black hover:bg-emerald-100 transition-all flex items-center gap-2 border border-emerald-100"
                    >
                        <Upload size={20} /> Bulk Upload
                    </button>
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
                                            <th className="px-8 py-6">Roll Number</th>
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
                                                <td className="px-8 py-6 font-mono font-bold text-[#003B73] text-sm group-hover:text-blue-600">
                                                    {s.rollNo}
                                                </td>
                                                <td className="px-8 py-6 font-mono font-bold text-gray-400 text-sm group-hover:text-gray-600">
                                                    {s.registerNumber || '-'}
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
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Roll Number (Primary)</label>
                                    <input
                                        className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-3xl font-bold text-gray-800 outline-none transition-all font-mono"
                                        placeholder="E123456"
                                        value={newStudent.rollNo}
                                        onChange={e => setNewStudent({ ...newStudent, rollNo: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Register Number (Optional)</label>
                                    <input
                                        className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-3xl font-bold text-gray-800 outline-none transition-all font-mono"
                                        placeholder="2021CSE001"
                                        value={newStudent.registerNumber}
                                        onChange={e => setNewStudent({ ...newStudent, registerNumber: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-6">
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
                                        {departments.filter(d => d.name !== 'First Year (General)').map(d => <option key={d.id} value={d.code || d.name}>{d.code || d.name}</option>)}
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
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Roll Number</label>
                                    <input
                                        className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-3xl font-bold text-gray-800 outline-none transition-all font-mono"
                                        value={editingStudent.rollNo}
                                        onChange={e => setEditingStudent({ ...editingStudent, rollNo: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Register Number</label>
                                    <input
                                        className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-3xl font-bold text-gray-800 outline-none transition-all font-mono"
                                        value={editingStudent.registerNumber || ''}
                                        onChange={e => setEditingStudent({ ...editingStudent, registerNumber: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-6">
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
                                        {departments.filter(d => d.name !== 'First Year (General)').map(d => <option key={d.id} value={d.code || d.name}>{d.code || d.name}</option>)}
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
            {/* Bulk Upload Modal */}
            {showBulkModal && (
                <div className="fixed inset-0 bg-emerald-900/20 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-fadeIn">
                    <div className="bg-white rounded-[48px] p-10 w-full max-w-2xl shadow-2xl border border-gray-100 overflow-hidden relative">
                        {/* Status bar */}
                        {bulkUploading && <div className="absolute top-0 left-0 h-1.5 bg-emerald-500 animate-pulse w-full"></div>}

                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-3xl font-black text-emerald-900 tracking-tight">Bulk Student Upload</h3>
                                <p className="text-gray-500 font-bold text-sm mt-1">Import multiple student records via Excel.</p>
                            </div>
                            <button onClick={() => { setShowBulkModal(false); setBulkResult(null); }} className="p-4 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-3xl transition-all">
                                <X size={32} />
                            </button>
                        </div>

                        <div className="space-y-8">
                            {/* Template Download */}
                            <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                                        <FileSpreadsheet size={24} />
                                    </div>
                                    <div>
                                        <p className="font-black text-blue-900 text-sm">Need a template?</p>
                                        <p className="text-xs text-blue-600 font-bold">Download our pre-formatted Excel file.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={downloadTemplate}
                                    className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                                >
                                    Download Template
                                </button>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-gray-50 rounded-3xl border border-gray-100">
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Department</label>
                                    <select
                                        value={bulkConfig.department}
                                        onChange={e => setBulkConfig({ ...bulkConfig, department: e.target.value })}
                                        className="w-full p-3 bg-white border border-gray-200 rounded-xl font-bold text-sm outline-none"
                                    >
                                        <option value="">Auto-Detect</option>
                                        {departments.map(d => <option key={d.id} value={d.code || d.name}>{d.name}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Year</label>
                                    <select
                                        value={bulkConfig.year}
                                        onChange={e => setBulkConfig({ ...bulkConfig, year: e.target.value, semester: (e.target.value * 2 - 1) })}
                                        className="w-full p-3 bg-white border border-gray-200 rounded-xl font-bold text-sm outline-none"
                                    >
                                        {[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Section</label>
                                    <select
                                        value={bulkConfig.section}
                                        onChange={e => setBulkConfig({ ...bulkConfig, section: e.target.value })}
                                        className="w-full p-3 bg-white border border-gray-200 rounded-xl font-bold text-sm outline-none"
                                    >
                                        {['A', 'B', 'C'].map(s => <option key={s} value={s}>Section {s}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Semester</label>
                                    <select
                                        value={bulkConfig.semester}
                                        onChange={e => setBulkConfig({ ...bulkConfig, semester: e.target.value })}
                                        className="w-full p-3 bg-white border border-gray-200 rounded-xl font-bold text-sm outline-none"
                                    >
                                        {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Sem {s}</option>)}
                                    </select>
                                </div>
                            </div>

                            {!bulkResult ? (
                                <form onSubmit={handleBulkUpload} className="space-y-6">
                                    <div className="group relative">
                                        <input
                                            type="file"
                                            accept=".xlsx, .xls"
                                            onChange={e => setBulkFile(e.target.files[0])}
                                            className="hidden"
                                            id="bulk-file-input"
                                        />
                                        <label
                                            htmlFor="bulk-file-input"
                                            className={`flex flex-col items-center justify-center w-full py-16 border-4 border-dashed rounded-[40px] cursor-pointer transition-all ${bulkFile ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 bg-gray-50/50 hover:border-blue-200 hover:bg-blue-50/30'}`}
                                        >
                                            <Upload size={48} className={`mb-4 ${bulkFile ? 'text-emerald-500' : 'text-gray-300 group-hover:text-blue-400'}`} />
                                            <p className={`font-black uppercase tracking-[0.2em] text-xs ${bulkFile ? 'text-emerald-600' : 'text-gray-400 group-hover:text-blue-900/40'}`}>
                                                {bulkFile ? bulkFile.name : 'Select or Drop Excel File'}
                                            </p>
                                            {bulkFile && <p className="text-[10px] font-bold text-emerald-400 mt-2">{(bulkFile.size / 1024).toFixed(1)} KB ready for processing</p>}
                                        </label>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={!bulkFile || bulkUploading}
                                        className={`w-full py-6 rounded-[32px] font-black text-lg transition-all flex items-center justify-center gap-3 ${!bulkFile || bulkUploading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xl shadow-emerald-200 active:scale-[0.98]'}`}
                                    >
                                        {bulkUploading ? (
                                            <>
                                                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                Processing Records...
                                            </>
                                        ) : (
                                            <>Proceed with Import</>
                                        )}
                                    </button>
                                </form>
                            ) : (
                                <div className="space-y-6 animate-fadeIn">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-8 bg-emerald-50 rounded-[32px] border border-emerald-100 text-center">
                                            <p className="text-4xl font-black text-emerald-600 mb-2">{bulkResult.created}</p>
                                            <p className="text-xs font-black text-emerald-900/40 uppercase tracking-widest">New Students</p>
                                        </div>
                                        <div className="p-8 bg-blue-50 rounded-[32px] border border-blue-100 text-center">
                                            <p className="text-4xl font-black text-blue-600 mb-2">{bulkResult.updated}</p>
                                            <p className="text-xs font-black text-blue-900/40 uppercase tracking-widest">Profiles Updated</p>
                                        </div>
                                    </div>

                                    {bulkResult.errors && bulkResult.errors.length > 0 && (
                                        <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100">
                                            <div className="flex items-center gap-3 mb-4 text-amber-600">
                                                <AlertCircle size={20} />
                                                <p className="font-black text-sm uppercase tracking-widest">Issues Found ({bulkResult.errors.length})</p>
                                            </div>
                                            <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                                {bulkResult.errors.map((err, idx) => (
                                                    <div key={idx} className="flex justify-between items-center text-xs p-3 bg-white rounded-xl border border-amber-100/50">
                                                        <span className="font-mono font-bold text-gray-400">{err.rollNo}</span>
                                                        <span className="font-bold text-amber-700">{err.error}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => { setShowBulkModal(false); setBulkResult(null); setBulkFile(null); }}
                                        className="w-full py-6 bg-emerald-900 text-white rounded-[32px] font-black text-lg hover:bg-[#003B73] transition-all flex items-center justify-center gap-3 shadow-xl"
                                    >
                                        <CheckCircle2 size={24} /> Done
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentManager;
