import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Trash2, UserPlus, CalendarX, X, AlertCircle, RefreshCw, Users, AlertTriangle } from 'lucide-react';

const FacultyManager = () => {
    const [facultyList, setFacultyList] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [newFaculty, setNewFaculty] = useState({ username: '', password: '', fullName: '', department: '' });
    // Search & Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDept, setFilterDept] = useState('');
    const [loading, setLoading] = useState(false);

    // Absence Modal State
    const [absenceModalOpen, setAbsenceModalOpen] = useState(false);
    const [selectedFacultyForAbsence, setSelectedFacultyForAbsence] = useState(null);
    const [absenceDate, setAbsenceDate] = useState(new Date().toISOString().split('T')[0]);
    const [absenceReason, setAbsenceReason] = useState('');

    // Restoration State
    const [activeSubstitutions, setActiveSubstitutions] = useState([]);
    const [selectedSubsToRemove, setSelectedSubsToRemove] = useState([]);
    const [facultySchedule, setFacultySchedule] = useState([]);
    const [substituteSelection, setSubstituteSelection] = useState({}); // { [timetableId]: facultyId }

    // Helper for Local Date (YYYY-MM-DD)
    const getTodayStr = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Absence View State (Persist in Session)
    const [viewDate, setViewDate] = useState(() => {
        return sessionStorage.getItem('adminViewDate') || getTodayStr();
    });
    const [absentFacultyIds, setAbsentFacultyIds] = useState([]);

    useEffect(() => {
        refreshFaculty();
        fetchDepartments();
    }, []);

    useEffect(() => {
        sessionStorage.setItem('adminViewDate', viewDate);
        fetchAbsences();
    }, [viewDate]);

    const refreshFaculty = async () => {
        try {
            const res = await api.get('/admin/faculty');
            setFacultyList(res.data);
        } catch (err) {
            console.error("Failed to fetch faculty", err);
        }
    }

    const fetchDepartments = async () => {
        try {
            const res = await api.get('/admin/departments');
            setDepartments(res.data);
        } catch (err) {
            console.error("Failed to fetch departments", err);
        }
    }

    const fetchAbsences = async () => {
        try {
            const res = await api.get('/admin/faculty-absences', { params: { date: viewDate } });
            setAbsentFacultyIds(res.data.map(a => a.facultyId));
        } catch (err) {
            console.error("Failed to fetch absences", err);
        }
    }

    const fetchSubstitutionsForFaculty = async (facultyId, date) => {
        try {
            const res = await api.get('/admin/substitutions', {
                params: {
                    date: date,
                    originalFacultyId: facultyId
                }
            });
            setActiveSubstitutions(res.data);
            setSelectedSubsToRemove([]); // Reset selection
        } catch (err) {
            console.error("Failed to fetch substitutions", err);
        }
    }

    const fetchDailySchedule = async (facultyId, date) => {
        try {
            // Robust Day Calculation
            const d = new Date(date);
            const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
            // Fix timezone offset issue by explicitly setting time or using getUTCDay if date string is standard
            // Simple hack: append T00:00:00 to ensure local time is roughly respected or just use standard
            // Ideally we parse YYYY-MM-DD
            const [y, m, day] = date.split('-').map(Number);
            const localDate = new Date(y, m - 1, day);
            const dayName = days[localDate.getDay()];

            console.log(`Fetching schedule for ${dayName} (${date})`);

            const [timetableRes, subsRes] = await Promise.all([
                api.get('/admin/timetable', { params: { facultyId, day: dayName } }),
                api.get('/admin/substitutions', { params: { date, originalFacultyId: facultyId } })
            ]);

            const schedule = timetableRes.data.map(slot => {
                const sub = subsRes.data.find(s => s.timetableId === slot.id);
                return {
                    ...slot,
                    substitution: sub || null
                };
            });
            setFacultySchedule(schedule);
        } catch (err) {
            console.error("Failed to fetch schedule", err);
        }
    }

    const handleAssignSubstitute = async (timetableId) => {
        const subId = substituteSelection[timetableId];
        if (!subId) {
            alert("Please select a substitute faculty");
            return;
        }

        try {
            await api.post('/admin/substitutions', {
                timetableId: timetableId,
                substituteFacultyId: subId,
                date: absenceDate
            });
            alert("Substitute assigned successfully");
            fetchDailySchedule(selectedFacultyForAbsence.id, absenceDate);
            setSubstituteSelection(prev => ({ ...prev, [timetableId]: '' }));
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || "Failed to assign substitute");
        }
    }

    const handleDeleteSubstitution = async (subId) => {
        if (!confirm("Remove this substitution?")) return;
        try {
            await api.delete(`/admin/substitutions/${subId}`);
            fetchDailySchedule(selectedFacultyForAbsence.id, absenceDate);
        } catch (err) {
            alert("Failed to remove substitution");
        }
    }

    const handleCreateFaculty = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/admin/faculty', newFaculty);
            setNewFaculty({ username: '', password: '', fullName: '', department: '' });
            refreshFaculty();
            alert('Faculty Created Successfully');
        } catch (err) {
            if (err.response?.data?.errors) {
                const messages = err.response.data.errors.map(e => e.msg).join('\n');
                alert(`Validation Errors:\n${messages}`);
            } else {
                alert(err.response?.data?.message || 'Error creating faculty');
            }
        } finally {
            setLoading(false);
        }
    }

    const handleDeleteFaculty = async (id) => {
        if (!confirm('Are you sure?')) return;
        try {
            await api.delete(`/admin/faculty/${id}`);
            refreshFaculty();
        } catch (err) {
            alert('Error deleting faculty');
        }
    }

    const openAbsenceModal = (faculty) => {
        setSelectedFacultyForAbsence(faculty);
        const dateToUse = viewDate;
        setAbsenceDate(dateToUse);
        setAbsenceReason('');

        // If already absent, fetch current substitutions
        if (absentFacultyIds.includes(faculty.id)) {
            fetchSubstitutionsForFaculty(faculty.id, dateToUse);
            fetchDailySchedule(faculty.id, dateToUse);
        } else {
            setActiveSubstitutions([]);
            setFacultySchedule([]);
        }

        setAbsenceModalOpen(true);
    };

    const handleMarkAbsent = async () => {
        if (!selectedFacultyForAbsence) return;
        try {
            await api.post('/admin/faculty-absences', {
                facultyId: selectedFacultyForAbsence.id,
                date: absenceDate,
                reason: absenceReason
            });
            alert(`Marked ${selectedFacultyForAbsence.fullName} as absent on ${absenceDate}`);
            // Note: Don't close modal, switch to schedule view to allow substitution
            // setAbsenceModalOpen(false); 
            if (absenceDate === viewDate) fetchAbsences();

            // Refresh modal data
            fetchAbsences(); // updates main list
            fetchDailySchedule(selectedFacultyForAbsence.id, absenceDate); // updates modal view

        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || 'Failed to mark absent');
        }
    };

    const handleRevertSelected = async () => {
        if (selectedSubsToRemove.length === 0) return;
        if (!confirm(`Revert ${selectedSubsToRemove.length} substituted periods to normal?`)) return;

        try {
            // Delete each selected substitution
            await Promise.all(selectedSubsToRemove.map(id => api.delete(`/admin/substitutions/${id}`)));
            alert("Selected periods reverted to normal.");

            // Refresh subs list in modal incase we want to do more? Or just close?
            fetchSubstitutionsForFaculty(selectedFacultyForAbsence.id, absenceDate);
        } catch (err) {
            console.error(err);
            alert("Failed to revert some periods.");
        }
    }

    const handleRemoveFullAbsence = async () => {
        if (!selectedFacultyForAbsence) return;
        const confirmMsg = activeSubstitutions.length > 0
            ? `Remove absence for ${selectedFacultyForAbsence.fullName}? This will also remove ${activeSubstitutions.length} active substitutions and revert everything to normal.`
            : `Remove absence for ${selectedFacultyForAbsence.fullName}?`;

        if (!confirm(confirmMsg)) return;

        try {
            // Using params as previously established
            await api.delete('/admin/faculty-absences', {
                params: {
                    facultyId: selectedFacultyForAbsence.id,
                    date: absenceDate,
                    cleanup: true // Trigger cleanup on backend
                }
            });
            alert(`Absence removed for ${selectedFacultyForAbsence.fullName}. Schedule reverted.`);
            setAbsenceModalOpen(false);
            if (absenceDate === viewDate) fetchAbsences();
        } catch (err) {
            console.error(err);
            const errMsg = err.response?.data?.message || err.message || 'Failed to remove absence';
            const errDetails = err.response?.data?.details || '';
            alert(`Error: ${errMsg}\n${errDetails}`);
        }
    }

    // Filter Logic
    // Filter Logic
    const filteredFaculty = (Array.isArray(facultyList) ? facultyList : []).filter(f => {
        if (!f) return false;
        const name = f.fullName ? f.fullName.toLowerCase() : '';
        const username = f.username ? f.username.toLowerCase() : '';
        const search = searchTerm.toLowerCase();

        const matchesSearch = name.includes(search) || username.includes(search);
        const matchesDept = filterDept ? f.department === filterDept : true;
        return matchesSearch && matchesDept;
    });

    return (
        <div className="flex flex-col animate-fadeIn">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
                <div>
                    <h1 className="text-4xl font-black text-[#003B73] tracking-tight">Faculty Management</h1>
                    <p className="text-gray-500 font-medium mt-1">Manage academic staff and daily attendance status.</p>
                </div>

                <div className="flex items-center gap-4 bg-white px-6 py-4 rounded-[32px] shadow-sm border border-gray-100">
                    <div className="w-10 h-10 bg-blue-50 text-[#003B73] rounded-2xl flex items-center justify-center">
                        <CalendarX size={20} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Status Date</span>
                        <input
                            type="date"
                            value={viewDate}
                            onChange={e => setViewDate(e.target.value)}
                            className="text-lg font-black text-[#003B73] bg-transparent outline-none cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Create Form */}
                <div className="lg:col-span-4">
                    <div className="bg-white p-8 rounded-[40px] shadow-xl border border-gray-100 sticky top-8">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-12 h-12 bg-[#003B73] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/20">
                                <UserPlus size={24} />
                            </div>
                            <h3 className="text-2xl font-black text-[#003B73]">New Faculty</h3>
                        </div>

                        <form onSubmit={handleCreateFaculty} className="space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Full Name</label>
                                    <input
                                        className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-2xl font-bold text-gray-800 outline-none transition-all"
                                        placeholder="Dr. John Doe"
                                        value={newFaculty.fullName}
                                        onChange={e => setNewFaculty({ ...newFaculty, fullName: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Department</label>
                                    <select
                                        className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-2xl font-bold text-gray-800 outline-none transition-all appearance-none cursor-pointer"
                                        value={newFaculty.department}
                                        onChange={e => setNewFaculty({ ...newFaculty, department: e.target.value })}
                                        required
                                    >
                                        <option value="">Select Dept</option>
                                        {(Array.isArray(departments) ? departments : []).map(d => <option key={d.id} value={d.code || d.name}>{d.code || d.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Username</label>
                                    <input
                                        className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-2xl font-bold text-gray-800 outline-none transition-all font-mono"
                                        placeholder="faculty_id"
                                        value={newFaculty.username}
                                        onChange={e => setNewFaculty({ ...newFaculty, username: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Password</label>
                                    <input
                                        className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-2xl font-bold text-gray-800 outline-none transition-all"
                                        type="password"
                                        placeholder="••••••••"
                                        value={newFaculty.password}
                                        onChange={e => setNewFaculty({ ...newFaculty, password: e.target.value })}
                                        required
                                    />
                                    <p className="text-[10px] text-gray-400 mt-2 font-bold px-1 italic">
                                        Min 8 chars with uppercase, lowercase, and number.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-5 bg-[#003B73] text-white rounded-[24px] font-black hover:bg-[#002850] shadow-xl shadow-blue-900/20 transition-all flex justify-center items-center gap-2 transform active:scale-95 disabled:opacity-50"
                            >
                                {loading ? 'Processing...' : 'Register Faculty'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* List */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden min-h-[600px]">
                        <div className="p-10 border-b border-gray-50 flex flex-col md:flex-row justify-between items-center gap-6">
                            <h3 className="text-2xl font-black text-[#003B73] flex items-center gap-3">
                                <span className="w-2 h-8 bg-blue-500 rounded-full"></span>
                                Faculty Directory
                            </h3>

                            <div className="flex gap-4 w-full md:w-auto">
                                <div className="relative flex-1 md:w-64">
                                    <input
                                        type="text"
                                        placeholder="Search by name..."
                                        className="w-full pl-6 pr-6 py-4 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-2xl font-bold text-gray-800 outline-none transition-all text-sm"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <select
                                    className="px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-2xl font-black text-[#003B73] outline-none transition-all text-sm appearance-none cursor-pointer w-40"
                                    value={filterDept}
                                    onChange={e => setFilterDept(e.target.value)}
                                >
                                    <option value="">All Depts</option>
                                    {(Array.isArray(departments) ? departments : []).map(d => <option key={d.id} value={d.code || d.name}>{d.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-center border-collapse">
                                <thead className="bg-gray-50/50 text-[#003B73] text-[10px] font-black uppercase tracking-[0.2em]">
                                    <tr>
                                        <th className="px-8 py-6 text-left">Academic Profile</th>
                                        <th className="px-8 py-6">Department</th>
                                        <th className="px-8 py-6">ID / Username</th>
                                        <th className="px-8 py-6 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredFaculty.map(f => {
                                        const isAbsent = absentFacultyIds.includes(f.id);
                                        return (
                                            <tr key={f.id} className="group hover:bg-gray-50 transition-all">
                                                <td className="px-8 py-6 text-left">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm transition-transform group-hover:scale-110 ${isAbsent ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-[#003B73]'
                                                            }`}>
                                                            {f.fullName.charAt(0)}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-extrabold text-gray-800 text-lg leading-tight group-hover:text-[#003B73] transition-colors">
                                                                {f.fullName}
                                                            </span>
                                                            {isAbsent && (
                                                                <span className="mt-1 flex items-center gap-1.5 px-2 py-0.5 w-fit bg-red-100 text-red-600 text-[10px] font-black uppercase tracking-wider rounded-lg border border-red-200">
                                                                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                                                                    Absent
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <span className="px-4 py-2 bg-indigo-50 text-[#003B73] rounded-xl text-xs font-black tracking-widest border border-indigo-100">
                                                        {f.department}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-6 text-gray-400 font-mono text-sm font-bold">
                                                    @{f.username}
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => openAbsenceModal(f)}
                                                            className={`p-3 rounded-2xl transition-all shadow-sm ${isAbsent
                                                                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                                                : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                                                                }`}
                                                            title={isAbsent ? "Manage Absence" : "Mark Absent"}
                                                        >
                                                            <CalendarX size={20} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteFaculty(f.id)}
                                                            className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={20} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredFaculty.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="p-20 text-center">
                                                <div className="max-w-xs mx-auto text-gray-300">
                                                    <Users size={64} className="mx-auto mb-4 opacity-20" />
                                                    <p className="text-xl font-black">No Faculty Found</p>
                                                    <p className="text-sm font-bold mt-1">Try adjusting your filters or search terms.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Absence Modal - Premium Styled */}
            {absenceModalOpen && selectedFacultyForAbsence && (
                <div className="fixed inset-0 bg-[#003B73]/20 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-fadeIn">
                    <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-xl overflow-hidden border border-gray-100">
                        <div className="p-10 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-3xl font-black text-[#003B73]">
                                    {absentFacultyIds.includes(selectedFacultyForAbsence.id) ? 'Duty Control' : 'Absence Entry'}
                                </h3>
                                <p className="text-gray-500 font-bold text-sm mt-1">{selectedFacultyForAbsence.fullName} • {absenceDate}</p>
                            </div>
                            <button onClick={() => setAbsenceModalOpen(false)} className="p-4 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-3xl transition-all">
                                <X size={32} />
                            </button>
                        </div>

                        <div className="p-10">
                            {!absentFacultyIds.includes(selectedFacultyForAbsence.id) ? (
                                <div className="space-y-8">
                                    <div className="bg-orange-50 p-6 rounded-[32px] border border-orange-100 flex items-start gap-4">
                                        <div className="bg-orange-500 text-white p-2 rounded-xl">
                                            <AlertCircle size={24} />
                                        </div>
                                        <div>
                                            <p className="font-black text-orange-900 leading-tight">Proceed with Caution</p>
                                            <p className="text-sm text-orange-700 font-bold mt-1 leading-relaxed">
                                                Marking a faculty as absent will flag all their scheduled classes for this date as cancelled or requiring substitution.
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Reason for Absence</label>
                                        <textarea
                                            className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-orange-500 rounded-3xl font-bold text-gray-800 outline-none transition-all resize-none h-32"
                                            value={absenceReason}
                                            onChange={e => setAbsenceReason(e.target.value)}
                                            placeholder="Specify reason (optional)..."
                                        />
                                    </div>
                                    <div className="flex gap-4">
                                        <button onClick={() => setAbsenceModalOpen(false)} className="flex-1 py-5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-[24px] font-black transition-all">
                                            Go Back
                                        </button>
                                        <button onClick={handleMarkAbsent} className="flex-1 py-5 bg-orange-600 text-white rounded-[24px] font-black hover:bg-orange-700 shadow-xl shadow-orange-900/20 transform active:scale-95 transition-all">
                                            Confirm Absence
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    <div className="bg-blue-50 p-8 rounded-[40px] border border-blue-100">
                                        <h4 className="text-lg font-black text-[#003B73] mb-6 flex items-center gap-3">
                                            <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                                            Substitution Control
                                        </h4>

                                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                            {facultySchedule.length === 0 ? (
                                                <div className="text-center py-10">
                                                    <p className="text-gray-400 font-black text-lg">No classes scheduled</p>
                                                    <p className="text-xs font-bold text-gray-300">Schedule is empty for this date.</p>
                                                </div>
                                            ) : (
                                                facultySchedule.map(slot => (
                                                    <div key={slot.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm group hover:shadow-md transition-all">
                                                        <div className="flex justify-between items-start mb-4">
                                                            <div>
                                                                <h5 className="font-extrabold text-gray-800 leading-tight">{slot.subjectName}</h5>
                                                                <div className="flex items-center gap-3 mt-1">
                                                                    <span className="text-[10px] font-black text-[#003B73] uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-lg">
                                                                        Period {slot.period}
                                                                    </span>
                                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">
                                                                        {slot.department}-{slot.year}-{slot.section}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className={`text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest ring-1 ${slot.substitution
                                                                ? 'bg-emerald-50 text-emerald-600 ring-emerald-100'
                                                                : 'bg-red-50 text-red-600 ring-red-100'
                                                                }`}>
                                                                {slot.substitution ? 'Secured' : 'Open'}
                                                            </div>
                                                        </div>

                                                        {slot.substitution ? (
                                                            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-2xl">
                                                                <div className="flex items-center gap-2">
                                                                    <RefreshCw size={14} className="text-emerald-500 animate-spin-slow" />
                                                                    <span className="text-xs font-black text-emerald-800">
                                                                        {slot.substitution.substituteFaculty.fullName}
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleDeleteSubstitution(slot.substitution.id)}
                                                                    className="text-[10px] font-black text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-xl transition-all"
                                                                >
                                                                    REMOVE
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex gap-3">
                                                                <select
                                                                    className="flex-1 text-xs px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl font-bold text-gray-800 transition-all outline-none cursor-pointer"
                                                                    value={substituteSelection[slot.id] || ''}
                                                                    onChange={e => setSubstituteSelection(prev => ({ ...prev, [slot.id]: e.target.value }))}
                                                                >
                                                                    <option value="">Choose Substitute...</option>
                                                                    {facultyList
                                                                        .filter(f => f.id !== selectedFacultyForAbsence.id && !absentFacultyIds.includes(f.id))
                                                                        .map(f => (
                                                                            <option key={f.id} value={f.id}>{f.fullName}</option>
                                                                        ))
                                                                    }
                                                                </select>
                                                                <button
                                                                    onClick={() => handleAssignSubstitute(slot.id)}
                                                                    disabled={!substituteSelection[slot.id]}
                                                                    className="px-6 bg-indigo-600 text-white text-xs font-black rounded-2xl hover:bg-indigo-700 disabled:opacity-30 disabled:grayscale transition-all transform active:scale-95"
                                                                >
                                                                    ASSIGN
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-gray-100">
                                        <button onClick={handleRemoveFullAbsence} className="w-full group py-6 bg-red-50 text-red-600 rounded-[32px] font-black hover:bg-red-600 hover:text-white transition-all shadow-sm hover:shadow-red-200 border border-red-100 flex flex-col items-center justify-center gap-1 group">
                                            <div className="flex items-center gap-2">
                                                <Trash2 size={20} />
                                                <span className="text-lg">Full Restoration</span>
                                            </div>
                                            <span className="text-[10px] opacity-80 uppercase tracking-[0.2em]">
                                                {activeSubstitutions.length > 0 ? `Revoke ${activeSubstitutions.length} substitutions & Presence Reset` : 'Mark as Present'}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FacultyManager;
