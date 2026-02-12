import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { CheckCircle, Lock, Clock, Filter, Users, BookOpen } from 'lucide-react';

const AdminMarksApproval = () => {
    const navigate = useNavigate();
    const [selectedExam, setSelectedExam] = useState('cia1'); // 'cia1', 'cia2', 'cia3'
    const [allSubjects, setAllSubjects] = useState([]);
    const [departments, setDepartments] = useState([]); // Fetch departments for filter
    const [filterDept, setFilterDept] = useState('');
    const [filterSemester, setFilterSemester] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL', 'PENDING', 'COMPLETED'

    // Detailed View State
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [subjectMarks, setSubjectMarks] = useState([]);
    const [selectedStudents, setSelectedStudents] = useState([]);

    useEffect(() => {
        fetchSubjectsStatus();
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        try {
            const res = await api.get('/admin/departments');
            setDepartments(res.data.map(d => d.code || d.name));
        } catch (err) {
            console.error("Failed to fetch departments");
        }
    };

    const fetchSubjectsStatus = async () => {
        console.log('Fetching subjects status...');
        try {
            const res = await api.get('/admin/marks-approval/status');
            console.log('Subjects status response:', res.data);
            setAllSubjects(res.data);
        } catch (error) {
            console.error('Error fetching subjects status:', error);
        }
    };

    const fetchSubjectMarks = async (subjectId) => {
        try {
            const res = await api.get(`/admin/marks-approval/${subjectId}`);
            setSubjectMarks(res.data);
            setSelectedStudents([]); // Reset selection
        } catch (error) {
            console.error('Error fetching marks:', error);
        }
    };

    const handleSubjectClick = (subject) => {
        setSelectedSubject(subject);
        fetchSubjectMarks(subject.subjectId);
    };

    const handleBack = () => {
        setSelectedSubject(null);
        setSubjectMarks([]);
        fetchSubjectsStatus(); // Refresh counts
    };

    const toggleStudentSelection = (studentId) => {
        setSelectedStudents(prev => {
            if (prev.includes(studentId)) return prev.filter(id => id !== studentId);
            return [...prev, studentId];
        });
    };

    const handleSelectAll = () => {
        if (selectedStudents.length > 0 && selectedStudents.length === subjectMarks.length) {
            setSelectedStudents([]);
        } else {
            setSelectedStudents(subjectMarks.map(s => s.student.id)); // Use student.id from Mark object
        }
    };

    const handleApproveSelected = async (lock = false) => {
        if (selectedStudents.length === 0) return;

        const action = lock ? 'Approve & Lock' : 'Approve';
        if (!confirm(`${action} ${selectedStudents.length} students for ${selectedExam.toUpperCase()}?`)) return;

        try {
            await api.post('/admin/marks-approval/approve', {
                subjectId: selectedSubject.subjectId,
                studentIds: selectedStudents,
                lock,
                exam: selectedExam
            });
            alert(`Success: ${action} completed for ${selectedExam.toUpperCase()}`);
            fetchSubjectMarks(selectedSubject.subjectId);
        } catch (error) {
            alert('Error approving marks');
        }
    };

    const handleUnlockSelected = async () => {
        if (selectedStudents.length === 0) return;
        if (!confirm(`Unlock ${selectedExam.toUpperCase()} marks for selected students? This allows faculty to edit them again.`)) return;

        try {
            await api.post('/admin/marks-approval/unlock', {
                subjectId: selectedSubject.subjectId,
                studentIds: selectedStudents,
                exam: selectedExam
            });
            alert(`Unlocked ${selectedExam.toUpperCase()} marks`);
            fetchSubjectMarks(selectedSubject.subjectId);
        } catch (error) {
            alert('Error unlocking marks');
        }
    };

    const handleUnapproveSelected = async () => {
        if (selectedStudents.length === 0) return;
        if (!confirm(`Revert approval for ${selectedExam.toUpperCase()}? These marks will become PENDING again.`)) return;

        try {
            await api.post('/admin/marks-approval/unapprove', {
                subjectId: selectedSubject.subjectId,
                studentIds: selectedStudents,
                exam: selectedExam
            });
            alert(`Reverted approval for ${selectedExam.toUpperCase()}`);
            fetchSubjectMarks(selectedSubject.subjectId);
        } catch (error) {
            alert('Error reverting approval');
        }
    };

    const calculateCIA = (test, assignment, attendance) => {
        return (test || 0) + (assignment || 0) + (attendance || 0);
    };

    // Filter Logic
    const filteredSubjects = allSubjects.filter(subject => {
        if (filterDept && subject.department !== filterDept) return false;
        if (filterSemester && subject.semester !== parseInt(filterSemester)) return false;

        // Filter based on Selected Exam Status
        const pendingCount = subject[`pending_${selectedExam}`] || 0;

        if (filterStatus === 'PENDING') return pendingCount > 0;
        if (filterStatus === 'COMPLETED') return pendingCount === 0;

        return true;
    });

    if (selectedSubject) {
        return (
            <div className="w-full animate-fadeIn p-4">
                <button
                    onClick={handleBack}
                    className="mb-8 flex items-center gap-2 text-[#003B73] hover:text-blue-800 font-black text-sm uppercase tracking-widest transition-all group"
                >
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-all">
                        ←
                    </div>
                    Back to Overview
                </button>

                <div className="bg-white rounded-[40px] shadow-xl shadow-blue-900/5 border border-gray-100 p-10 mb-10">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <span className="px-4 py-1.5 bg-blue-50 text-[#003B73] rounded-xl font-black text-xs uppercase tracking-wider border border-blue-100">
                                    {selectedSubject.subjectCode}
                                </span>
                                <span className="px-4 py-1.5 bg-gray-50 text-gray-500 rounded-xl font-black text-xs uppercase tracking-wider border border-gray-100">
                                    Semester {selectedSubject.semester}
                                </span>
                            </div>
                            <h2 className="text-4xl font-black text-[#003B73] tracking-tight mb-2 leading-tight">{selectedSubject.subjectName}</h2>
                            <p className="text-gray-500 font-medium flex items-center gap-2">
                                <Users size={18} className="text-blue-400" />
                                {selectedSubject.department} • Faculty: <span className="text-[#003B73] font-bold">{selectedSubject.faculty}</span>
                            </p>
                        </div>

                        <div className="bg-[#003B73] p-6 rounded-[32px] text-white shadow-lg shadow-blue-900/20 flex items-center gap-6">
                            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                                <BookOpen size={24} className="text-white" />
                            </div>
                            <div>
                                <p className="text-blue-200 text-xs font-black uppercase tracking-widest mb-1">Active Focus</p>
                                <p className="text-2xl font-black tracking-tighter">{selectedExam.toUpperCase()}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-12 pt-10 border-t border-gray-50">
                        <button
                            onClick={() => handleApproveSelected(false)}
                            disabled={selectedStudents.length === 0}
                            className="flex items-center justify-center gap-3 px-8 py-5 bg-emerald-600 text-white rounded-[24px] hover:bg-emerald-700 disabled:opacity-30 disabled:translate-y-0 transition-all font-black shadow-lg shadow-emerald-900/20 hover:-translate-y-1"
                        >
                            <CheckCircle size={22} />
                            Approve ({selectedStudents.length})
                        </button>
                        <button
                            onClick={() => handleApproveSelected(true)}
                            disabled={selectedStudents.length === 0}
                            className="flex items-center justify-center gap-3 px-8 py-5 bg-blue-600 text-white rounded-[24px] hover:bg-blue-700 disabled:opacity-30 disabled:translate-y-0 transition-all font-black shadow-lg shadow-blue-900/20 hover:-translate-y-1"
                        >
                            <Lock size={22} />
                            Approve & Lock
                        </button>
                        <button
                            onClick={handleUnlockSelected}
                            disabled={selectedStudents.length === 0}
                            className="flex items-center justify-center gap-3 px-8 py-5 bg-orange-500 text-white rounded-[24px] hover:bg-orange-600 disabled:opacity-30 disabled:translate-y-0 transition-all font-black shadow-lg shadow-orange-900/20 hover:-translate-y-1"
                        >
                            Unlock Entry
                        </button>
                        <button
                            onClick={handleUnapproveSelected}
                            disabled={selectedStudents.length === 0}
                            className="flex items-center justify-center gap-3 px-8 py-5 bg-red-500 text-white rounded-[24px] hover:bg-red-600 disabled:opacity-30 disabled:translate-y-0 transition-all font-black shadow-lg shadow-red-900/20 hover:-translate-y-1"
                        >
                            Revert Approval
                        </button>
                    </div>
                </div>

                {subjectMarks.length === 0 ? (
                    <div className="text-center py-32 bg-white rounded-[40px] border border-dashed border-gray-200">
                        <Users size={64} className="mx-auto text-gray-100 mb-6" />
                        <p className="text-gray-400 font-black text-xl">No student records found</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-[40px] shadow-xl shadow-blue-900/5 border border-gray-100 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="p-8">
                                        <input
                                            type="checkbox"
                                            checked={selectedStudents.length > 0 && selectedStudents.length === subjectMarks.length}
                                            onChange={handleSelectAll}
                                            className="w-5 h-5 rounded-lg border-gray-300 text-[#003B73] focus:ring-[#003B73]"
                                        />
                                    </th>
                                    <th className="p-8 text-xs font-black text-gray-400 uppercase tracking-widest">Register No</th>
                                    <th className="p-8 text-xs font-black text-gray-400 uppercase tracking-widest">Student Name</th>
                                    <th className="p-8 text-xs font-black text-gray-400 uppercase tracking-widest">Department</th>
                                    {selectedExam === 'internal' ? (
                                        <>
                                            <th className="p-8 text-xs font-black text-gray-400 uppercase tracking-widest text-center">CIA 1</th>
                                            <th className="p-8 text-xs font-black text-gray-400 uppercase tracking-widest text-center">CIA 2</th>
                                            <th className="p-8 text-xs font-black text-gray-400 uppercase tracking-widest text-center">CIA 3</th>
                                            <th className="p-8 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Final</th>
                                        </>
                                    ) : (
                                        <th className="p-8 text-xs font-black text-gray-400 uppercase tracking-widest text-center">{selectedExam.toUpperCase()} Total</th>
                                    )}
                                    <th className="p-8 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {subjectMarks.map(mark => {
                                    const cia1Total = calculateCIA(mark.cia1_test, mark.cia1_assignment, mark.cia1_attendance);
                                    const cia2Total = calculateCIA(mark.cia2_test, mark.cia2_assignment, mark.cia2_attendance);
                                    const cia3Total = calculateCIA(mark.cia3_test, mark.cia3_assignment, mark.cia3_attendance);

                                    const isLocked = mark[`isLocked_${selectedExam}`];
                                    const isApproved = mark[`isApproved_${selectedExam}`];

                                    return (
                                        <tr key={mark.studentId} className="hover:bg-gray-50 transition-colors group">
                                            <td className="p-8">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedStudents.includes(mark.studentId)}
                                                    onChange={() => toggleStudentSelection(mark.studentId)}
                                                    className="w-5 h-5 rounded-lg border-gray-300 text-[#003B73] focus:ring-[#003B73]"
                                                />
                                            </td>
                                            <td className="p-8 font-mono text-sm uppercase text-gray-500 group-hover:text-[#003B73] transition-colors">{mark.student.registerNumber}</td>
                                            <td className="p-8">
                                                <p className="font-bold text-[#003B73] text-lg">{mark.student.name}</p>
                                            </td>
                                            <td className="p-8">
                                                <span className="text-gray-500 font-medium">{mark.student.department} - <span className="font-black text-[#003B73]">Y{mark.student.year}</span></span>
                                            </td>
                                            {selectedExam === 'internal' ? (
                                                <>
                                                    <td className="p-8 text-center font-mono font-bold text-gray-400">{cia1Total.toFixed(1)}</td>
                                                    <td className="p-8 text-center font-mono font-bold text-gray-400">{cia2Total.toFixed(1)}</td>
                                                    <td className="p-8 text-center font-mono font-bold text-gray-400">{cia3Total.toFixed(1)}</td>
                                                    <td className="p-8 text-center font-mono font-black text-[#003B73] text-lg bg-blue-50/30">{mark.internal?.toFixed(1) || '-'}</td>
                                                </>
                                            ) : (
                                                <td className="p-8 text-center font-black text-[#003B73] text-lg">
                                                    {selectedExam === 'cia1' ? cia1Total.toFixed(1) :
                                                        selectedExam === 'cia2' ? cia2Total.toFixed(1) :
                                                            cia3Total.toFixed(1)}
                                                </td>
                                            )}
                                            <td className="p-8 text-center">
                                                {isLocked ? (
                                                    <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm">
                                                        <Lock size={14} /> Locked
                                                    </span>
                                                ) : isApproved ? (
                                                    <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-xl text-xs font-black uppercase tracking-wider">
                                                        <CheckCircle size={14} /> Approved
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-100 text-amber-700 rounded-xl text-xs font-black uppercase tracking-wider animate-pulse">
                                                        <Clock size={14} /> Pending
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    }

    const semesters = [...new Set(allSubjects.map(s => s.semester))].sort((a, b) => a - b);

    return (
        <div className="w-full animate-fadeIn">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-8">
                <div>
                    <h1 className="text-5xl font-black text-[#003B73] tracking-tighter mb-4 leading-none">
                        Marks <span className="text-blue-600">Approval</span>
                    </h1>
                    <p className="text-gray-500 font-medium text-lg">Grant administrative clearance for faculty-submitted assessments.</p>
                </div>

                <div className="bg-white p-3 rounded-[28px] shadow-xl shadow-blue-900/5 border border-gray-100 flex items-center gap-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-4">Assessment Cycle</span>
                    <select
                        value={selectedExam}
                        onChange={(e) => setSelectedExam(e.target.value)}
                        className="bg-blue-50 text-[#003B73] font-black rounded-[20px] focus:ring-0 cursor-pointer py-3 px-8 text-lg border-none outline-none appearance-none hover:bg-blue-100 transition-all"
                    >
                        <option value="cia1">CIA 1</option>
                        <option value="cia2">CIA 2</option>
                        <option value="cia3">CIA 3</option>
                        {allSubjects.some(s =>
                            s.pending_cia1 === 0 &&
                            s.pending_cia2 === 0 &&
                            s.pending_cia3 === 0
                        ) && (
                                <option value="internal">Final Internal</option>
                            )}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
                <div className="bg-gradient-to-br from-[#003B73] to-[#004B8D] p-10 rounded-[40px] shadow-2xl shadow-blue-900/20 text-white flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                        <Clock size={96} />
                    </div>
                    <div>
                        <p className="text-blue-200 text-xs font-black uppercase tracking-widest mb-4">Awaiting Action</p>
                        <p className="text-6xl font-black tracking-tighter">
                            {allSubjects.filter(s => s[`pending_${selectedExam}`] > 0).length}
                        </p>
                    </div>
                    <p className="mt-6 text-sm font-bold text-blue-100 flex items-center gap-2 italic">
                        <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                        Subjects with pending approvals
                    </p>
                </div>

                <div className="bg-white p-10 rounded-[40px] shadow-xl shadow-blue-900/5 border border-gray-100 flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                        <BookOpen size={96} />
                    </div>
                    <div>
                        <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-4">Total Curriculum</p>
                        <p className="text-6xl font-black tracking-tighter text-[#003B73]">
                            {allSubjects.length}
                        </p>
                    </div>
                    <p className="mt-6 text-sm font-bold text-gray-400">Actively managed subjects</p>
                </div>

                <div className="bg-emerald-600 p-10 rounded-[40px] shadow-2xl shadow-emerald-900/20 text-white flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                        <CheckCircle size={96} />
                    </div>
                    <div>
                        <p className="text-emerald-100 text-xs font-black uppercase tracking-widest mb-4">Completed Cycles</p>
                        <p className="text-6xl font-black tracking-tighter text-white">
                            {allSubjects.filter(s => s[`pending_${selectedExam}`] === 0).length}
                        </p>
                    </div>
                    <p className="mt-6 text-sm font-bold text-emerald-100">Ready for consolidation</p>
                </div>
            </div>

            <div className="bg-white p-8 rounded-[36px] shadow-xl shadow-blue-900/5 border border-gray-100 mb-12">
                <div className="flex items-center gap-8 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center border border-gray-100">
                            <Filter size={20} className="text-[#003B73]" />
                        </div>
                        <span className="font-black text-gray-500 uppercase text-xs tracking-widest">Filters</span>
                    </div>

                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="bg-gray-50 border-none rounded-2xl py-4 px-6 font-bold text-[#003B73] focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="PENDING">Pending Action</option>
                            <option value="COMPLETED">Fully Approved</option>
                        </select>

                        <select
                            value={filterDept}
                            onChange={(e) => setFilterDept(e.target.value)}
                            className="bg-gray-50 border-none rounded-2xl py-4 px-6 font-bold text-[#003B73] focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        >
                            <option value="">All Departments</option>
                            {departments.map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>

                        <select
                            value={filterSemester}
                            onChange={(e) => setFilterSemester(e.target.value)}
                            className="bg-gray-50 border-none rounded-2xl py-4 px-6 font-bold text-[#003B73] focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        >
                            <option value="">All Semesters</option>
                            {semesters.map(sem => (
                                <option key={sem} value={sem}>Semester {sem}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[40px] shadow-xl shadow-blue-900/5 border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="p-8 text-xs font-black text-gray-400 uppercase tracking-widest">Code</th>
                                <th className="p-8 text-xs font-black text-gray-400 uppercase tracking-widest">Subject Name</th>
                                <th className="p-8 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Semester</th>
                                <th className="p-8 text-xs font-black text-gray-400 uppercase tracking-widest">Faculty</th>
                                <th className="p-8 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
                                <th className="p-8 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredSubjects.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-24 text-center">
                                        <div className="flex flex-col items-center gap-6">
                                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
                                                <Filter size={40} className="text-gray-100" />
                                            </div>
                                            <p className="font-black text-2xl text-gray-400">No matching subjects found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredSubjects.map(subject => {
                                    const pending = subject[`pending_${selectedExam}`] || 0;
                                    const approved = subject[`approved_${selectedExam}`] || 0;
                                    const locked = subject[`locked_${selectedExam}`] || 0;

                                    let statusEl;
                                    if (pending > 0) {
                                        statusEl = (
                                            <span className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-2xl text-sm font-black">
                                                <div className="w-2 h-2 bg-amber-500 rounded-full" />
                                                {pending} Pending
                                            </span>
                                        );
                                    } else if (locked > 0) {
                                        statusEl = (
                                            <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-2xl text-sm font-black">
                                                <Lock size={14} /> Locked
                                            </span>
                                        );
                                    } else {
                                        statusEl = (
                                            <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-2xl text-sm font-black">
                                                <CheckCircle size={14} /> Approved
                                            </span>
                                        );
                                    }

                                    return (
                                        <tr key={subject.subjectId} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="p-8 font-mono text-sm uppercase text-gray-500 font-bold">{subject.subjectCode}</td>
                                            <td className="p-8">
                                                <p className="font-black text-[#003B73] text-lg leading-tight mb-1 group-hover:translate-x-1 transition-transform">{subject.subjectName}</p>
                                                <p className="text-gray-400 text-xs font-black uppercase tracking-widest">{subject.department}</p>
                                            </td>
                                            <td className="p-8 text-center">
                                                <span className="text-xl font-black text-blue-200">#{subject.semester}</span>
                                            </td>
                                            <td className="p-8">
                                                <p className="font-bold text-[#003B73]">{subject.faculty}</p>
                                            </td>
                                            <td className="p-8 text-center">
                                                {statusEl}
                                            </td>
                                            <td className="p-8 text-right">
                                                <button
                                                    onClick={() => handleSubjectClick(subject)}
                                                    className="px-8 py-3 bg-[#003B73] text-white rounded-2xl hover:bg-blue-800 text-sm font-black shadow-lg shadow-blue-900/10 hover:-translate-y-0.5 transition-all"
                                                >
                                                    Manage Marks
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminMarksApproval;
