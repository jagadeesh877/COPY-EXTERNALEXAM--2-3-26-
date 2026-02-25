import React, { useState, useEffect } from 'react';
import { Award, Save, RefreshCw, Filter, FileSpreadsheet, Upload, Download, CheckCircle, AlertCircle, X } from 'lucide-react';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import toast from 'react-hot-toast';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const EndSemMarksEntry = () => {
    const [filters, setFilters] = useState({
        department: '',
        year: '',
        semester: '',
        section: '',
        subjectId: ''
    });

    const [subjects, setSubjects] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [departments, setDepartments] = useState([]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const deptsRes = await api.get('/admin/departments');
            setDepartments(deptsRes.data);
            const subsRes = await api.get('/admin/subjects');
            setSubjects(subsRes.data);
        } catch (error) {
            toast.error('Failed to load initial data');
        }
    };

    const handleSearch = async () => {
        if (!filters.department || !filters.semester || !filters.section || !filters.subjectId) {
            toast.error('Please fill all filters');
            return;
        }

        setLoading(true);
        try {
            const res = await api.get('/exam/end-sem-marks', { params: filters });
            setStudents(res.data); // This now returns consolidated objects
        } catch (error) {
            toast.error('Failed to load results');
        } finally {
            setLoading(false);
        }
    };

    const handleCalculateGrades = async () => {
        setSaving(true);
        try {
            await api.post('/exam/end-sem-marks', {
                subjectId: filters.subjectId,
                semester: filters.semester,
                regulation: '2021'
            });
            toast.success('Grades calculated and results consolidated');
            handleSearch();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error calculating grades');
        } finally {
            setSaving(false);
        }
    };

    const exportTemplate = async () => {
        if (students.length === 0) {
            toast.error('Search for results first.');
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Consolidated Results');

        worksheet.columns = [
            { header: 'Roll No', key: 'rollNo', width: 20 },
            { header: 'Name', key: 'name', width: 30 },
            { header: 'Internal (40)', key: 'internal', width: 15 },
            { header: 'External (60)', key: 'external', width: 15 },
            { header: 'Total (100)', key: 'total', width: 15 },
            { header: 'Grade', key: 'grade', width: 10 },
        ];

        students.forEach(s => {
            worksheet.addRow({
                rollNo: s.rollNo,
                name: s.name,
                internal: s.internal40,
                external: s.external60,
                total: s.total100,
                grade: s.grade
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Consolidated_Results_${filters.section}.xlsx`);
    };

    const filteredSubjects = subjects.filter(s => {
        return s.semester === parseInt(filters.semester);
    });

    return (
        <div className="w-full animate-fadeIn">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-4xl font-black text-[#003B73] tracking-tight flex items-center gap-3">
                        <Award className="text-blue-600" size={32} /> Result Consolidation
                    </h1>
                    <p className="text-gray-500 font-medium mt-1">Merge Internal(40) and External(60) and Calculate Grades</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={exportTemplate}
                        className="flex items-center gap-2 px-6 py-3 bg-white text-gray-700 border border-gray-200 rounded-2xl hover:bg-gray-50 shadow-sm transition-all font-bold"
                    >
                        <Download size={18} /> Export Results
                    </button>
                    <button
                        onClick={handleCalculateGrades}
                        disabled={saving || students.length === 0}
                        className={`flex items-center gap-3 px-8 py-3 rounded-2xl shadow-xl transition-all font-black text-lg ${saving || students.length === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700 hover:-translate-y-0.5 shadow-red-900/10'}`}
                    >
                        <RefreshCw size={20} className={saving ? 'animate-spin' : ''} /> {saving ? 'Processing...' : 'Calculate & Consolidate'}
                    </button>
                </div>
            </div>

            {/* Filter Card */}
            <div className="bg-white p-8 rounded-[32px] shadow-xl shadow-blue-900/5 border border-gray-100 mb-10">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Department</label>
                        <select
                            className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-bold text-[#003B73] focus:ring-2 focus:ring-blue-500/20 transition-all"
                            value={filters.department}
                            onChange={e => setFilters({ ...filters, department: e.target.value })}
                        >
                            <option value="">Select...</option>
                            {departments.map(d => (
                                <option key={d.id} value={d.code || d.name}>
                                    {d.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Semester</label>
                        <select
                            className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-bold text-[#003B73] focus:ring-2 focus:ring-blue-500/20 transition-all"
                            value={filters.semester}
                            onChange={e => {
                                const sem = parseInt(e.target.value);
                                const year = Math.ceil(sem / 2);
                                setFilters({ ...filters, semester: e.target.value, year: year.toString() });
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
                            value={filters.section}
                            onChange={e => setFilters({ ...filters, section: e.target.value })}
                        >
                            <option value="">Select...</option>
                            {['A', 'B', 'C', 'D'].map(s => <option key={s} value={s}>Section {s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Subject</label>
                        <select
                            className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-bold text-[#003B73] focus:ring-2 focus:ring-blue-500/20 transition-all"
                            value={filters.subjectId}
                            onChange={e => setFilters({ ...filters, subjectId: e.target.value })}
                        >
                            <option value="">Select...</option>
                            {filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={handleSearch}
                            className="w-full bg-[#003B73] text-white py-4 rounded-2xl hover:bg-blue-800 transition-all font-black shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                        >
                            <Filter size={20} /> Load Results
                        </button>
                    </div>
                </div>
            </div>

            {/* Marks Table */}
            <div className="bg-white rounded-[32px] shadow-xl shadow-blue-900/5 overflow-hidden border border-gray-100">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-8 py-6 text-xs font-black text-gray-400 uppercase tracking-widest">Roll No</th>
                            <th className="px-8 py-6 text-xs font-black text-gray-400 uppercase tracking-widest">Student Name</th>
                            <th className="px-8 py-6 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Internal (40)</th>
                            <th className="px-8 py-6 text-xs font-black text-gray-400 uppercase tracking-widest text-center">External (60)</th>
                            <th className="px-8 py-6 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Total (100)</th>
                            <th className="px-8 py-6 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Grade</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr>
                                <td colSpan="6" className="px-8 py-32 text-center text-gray-400">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#003B73] mx-auto mb-6"></div>
                                    <p className="font-bold text-lg">Fetching consolidated data...</p>
                                </td>
                            </tr>
                        ) : students.length === 0 ? (
                            <tr>
                                <td className="px-8 py-32 text-center text-gray-300" colSpan="6">
                                    <div className="flex flex-col items-center gap-6">
                                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
                                            <Award size={48} className="text-gray-100" />
                                        </div>
                                        <p className="font-black text-2xl text-gray-400">Select filters to view results</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            students.map(s => (
                                <tr key={s.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-8 py-6 font-mono text-sm uppercase text-[#003B73] font-bold">{s.rollNo}</td>
                                    <td className="px-8 py-6">
                                        <p className="font-bold text-[#003B73] text-lg">{s.name}</p>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <span className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl font-black">{s.internal40}</span>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <span className="bg-amber-50 text-amber-700 px-4 py-2 rounded-xl font-black">{s.external60}</span>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <span className="bg-[#003B73] text-white px-5 py-2.5 rounded-2xl font-black shadow-lg shadow-blue-900/10 text-lg">{s.total100}</span>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <div className={`inline-block px-5 py-2 rounded-2xl font-black text-sm shadow-sm ${s.grade === 'RA' || s.grade === 'N/A'
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-emerald-100 text-emerald-700'
                                            }`}>
                                            {s.grade}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


export default EndSemMarksEntry;
