import { useState, useEffect } from 'react';
import api from '../../api/axios';
import {
    Save, Loader, X, Clock, MapPin, User, BookOpen, Plus,
    Edit2, Trash2, Calendar, AlertTriangle, CheckCircle,
    RefreshCw, Building2, GraduationCap, Users
} from 'lucide-react';

const TimetableManager = () => {
    const [department, setDepartment] = useState('');
    const [year, setYear] = useState('1');
    const [section, setSection] = useState('A');
    const [semester, setSemester] = useState('1');

    const [timetable, setTimetable] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [subjects, setSubjects] = useState([]);
    const [facultyList, setFacultyList] = useState([]);
    const [departments, setDepartments] = useState([]);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [selectedCell, setSelectedCell] = useState(null);
    const [selectedSubject, setSelectedSubject] = useState('');
    const [selectedFaculty, setSelectedFaculty] = useState('');
    const [selectedRoom, setSelectedRoom] = useState('');
    const [entryType, setEntryType] = useState('THEORY');
    const [selectedDuration, setSelectedDuration] = useState(1);

    // Substitution Management State
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [absences, setAbsences] = useState([]);
    const [substitutions, setSubstitutions] = useState([]);
    const [statusLoading, setStatusLoading] = useState(false);
    const [assigningSub, setAssigningSub] = useState(false);
    const [substituteId, setSubstituteId] = useState('');

    const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
    const periods = [
        { id: 1, label: '09:15-10:05', name: 'Period 1' },
        { id: 2, label: '10:05-10:55', name: 'Period 2' },
        { id: 3, label: '11:15-12:05', name: 'Period 3' },
        { id: 4, label: '12:05-12:55', name: 'Period 4' },
        { id: 5, label: '01:45-02:30', name: 'Period 5' },
        { id: 6, label: '02:30-03:15', name: 'Period 6' },
        { id: 7, label: '03:25-04:10', name: 'Period 7' },
        { id: 8, label: '04:10-04:50', name: 'Period 8' },
    ];

    useEffect(() => {
        fetchSubjects();
        fetchFaculty();
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        try {
            const res = await api.get('/admin/departments');
            setDepartments(res.data);
            if (res.data.length > 0 && !department) {
                setDepartment(res.data[0].name);
            }
        } catch (err) {
            console.error("Failed to fetch departments");
        }
    };

    useEffect(() => {
        const deptObj = departments.find(d => (d.code || d.name) === department);
        if (deptObj) {
            // Update Section
            const secs = deptObj.sections?.split(',') || ['A'];
            if (!secs.includes(section)) {
                setSection(secs[0]);
            }

            // Update Year
            const availableYears = deptObj.years?.split(',') || ['2', '3', '4'];
            if (!availableYears.includes(year.toString())) {
                setYear(availableYears[0]);
            }
        }
    }, [department, departments]);

    useEffect(() => {
        let validSems;
        const departmentData = departments.find(d => (d.code || d.name) === department);
        const isGeneral = departmentData?.name === 'First Year (General)';

        if (isGeneral) {
            validSems = ['1', '2'];
        } else {
            const y = parseInt(year);
            validSems = [(y * 2 - 1).toString(), (y * 2).toString()];
        }

        if (!validSems.includes(semester.toString())) {
            setSemester(validSems[0]);
        }
    }, [year, department, departments]);

    useEffect(() => {
        const departmentData = departments.find(d => (d.code || d.name) === department);
        if (departmentData) {
            const isGeneral = departmentData.name === 'First Year (General)';
            const currentSemesterInt = parseInt(semester);
            const isSemSpecific = isGeneral ? [1, 2].includes(currentSemesterInt) : true;

            if (isSemSpecific) {
                fetchTimetable();
            }
        } else {
            // If departmentData is not found, perhaps clear timetable or handle as an invalid state
            setTimetable({});
        }
    }, [department, year, semester, section, departments]); // Added departments to dependency array

    useEffect(() => {
        if (selectedDate) {
            fetchDailyStatus();
        }
    }, [selectedDate, timetable]); // Re-fetch status if timetable or date changes

    const fetchDailyStatus = async () => {
        setStatusLoading(true);
        try {
            // Parallel fetch
            const [absRes, subRes] = await Promise.all([
                api.get('/admin/faculty-absences', { params: { date: selectedDate } }),
                api.get('/admin/substitutions', { params: { date: selectedDate } })
            ]);
            setAbsences(absRes.data);
            setSubstitutions(subRes.data);
        } catch (err) {
            console.error("Failed to fetch daily status", err);
        } finally {
            setStatusLoading(false);
        }
    };

    // Helper to get day name from date (UTC safe)
    const getDayName = (dateStr) => {
        const date = new Date(dateStr);
        // Use UTC day to avoid timezone shifts since input=date returns YYYY-MM-DD (UTC midnight)
        const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        return days[date.getUTCDay()];
    };

    const fetchSubjects = async () => {
        try {
            const res = await api.get('/admin/subjects');
            setSubjects(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("Failed to fetch subjects");
        }
    };

    const fetchFaculty = async () => {
        try {
            const res = await api.get('/admin/faculty');
            setFacultyList(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchTimetable = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/timetable', {
                params: { department, year, semester, section }
            });
            const map = {};
            if (Array.isArray(res.data)) {
                res.data.forEach(t => {
                    map[`${t.day} -${t.period} `] = t;
                });
            }
            setTimetable(map);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCellClick = (day, period) => {
        const key = `${day} -${period} `;
        const existing = timetable[key];

        setSelectedCell({ day, period });
        setEntryType(existing?.type || 'THEORY');
        setSelectedSubject(existing?.subjectName || '');
        setSelectedFaculty(existing?.facultyName || '');
        setSelectedRoom(existing?.room || '');
        setSelectedDuration(existing?.duration || 1);
        setSubstituteId(''); // Reset substitute selection
        setShowModal(true);
    };

    const handleSubjectChange = (name) => {
        setSelectedSubject(name);
        const subj = subjects?.find(s => s.name === name);
        if (subj) {
            const assignment = subj.assignments?.find(a => a.section === section);
            if (assignment) {
                setSelectedFaculty(assignment.facultyName);
            } else {
                setSelectedFaculty('');
            }
        }
    };

    const applyChanges = () => {
        if (!selectedCell) return;
        const { day, period } = selectedCell;
        const key = `${day} -${period} `;

        let fId = null;
        const subj = subjects?.find(s => s.name === selectedSubject);
        if (subj) {
            const assignment = subj.assignments?.find(a => a.section === section);
            if (assignment) fId = assignment.facultyId;
        }

        setTimetable(prev => ({
            ...prev,
            [key]: {
                day,
                period,
                duration: selectedDuration,
                subjectName: selectedSubject,
                facultyName: selectedFaculty,
                facultyId: fId,
                room: selectedRoom,
                type: entryType
            }
        }));
        setShowModal(false);
    };

    const deleteEntry = () => {
        if (!selectedCell) return;
        const { day, period } = selectedCell;
        const key = `${day} -${period} `;

        setTimetable(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
        setShowModal(false);
    };

    // --- Substitution & Absence Actions ---

    const handleMarkAbsent = async (facultyId) => {
        if (!confirm("Are you sure you want to mark this faculty as absent? This will affect all their classes for today.")) return;
        try {
            await api.post('/admin/faculty-absences', {
                facultyId,
                date: selectedDate,
                reason: 'Marked from Timetable'
            });
            fetchDailyStatus();
            setShowModal(false);
            alert("Faculty marked as absent.");
        } catch (err) {
            alert(err.response?.data?.message || "Failed to mark absent");
        }
    };

    const handleAssignSubstitute = async (timetableId) => {
        if (!timetableId) return alert("Please save the timetable before assigning a substitute.");
        if (!substituteId) return alert("Please select a substitute faculty");
        setAssigningSub(true);
        try {
            await api.post('/admin/substitutions', {
                timetableId,
                substituteFacultyId: substituteId,
                date: selectedDate
            });
            fetchDailyStatus();
            setShowModal(false);
            alert("Substitute assigned successfully!");
        } catch (err) {
            alert(err.response?.data?.message || "Failed to assign substitute");
        } finally {
            setAssigningSub(false);
        }
    };

    const handleRemoveSubstitution = async (subId) => {
        if (!confirm("Remove this substitution?")) return;
        try {
            await api.delete(`/admin/substitutions/${subId}`);
            fetchDailyStatus();
            setShowModal(false);
        } catch (err) {
            alert(err.response?.data?.message || "Failed to remove substitution");
        }
    }
    const handleRemoveAbsence = async (facultyId) => {
        if (!confirm("Restore faculty presence for ONLY this class?")) return;
        try {
            await api.delete('/admin/faculty-absences', {
                params: {
                    facultyId,
                    date: selectedDate,
                    period: selectedCell.period
                }
            });
            fetchDailyStatus();
            setShowModal(false);
            alert("Absence removed for this class.");
        } catch (err) {
            alert(err.response?.data?.message || "Failed to remove absence");
        }
    };

    const handleRestoreRemainder = async (facultyId) => {
        if (!confirm("Restore faculty presence for this AND all subsequent classes today?")) return;
        try {
            await api.delete('/admin/faculty-absences', {
                params: {
                    facultyId,
                    date: selectedDate,
                    period: selectedCell.period,
                    mode: 'from_period'
                }
            });
            fetchDailyStatus();
            setShowModal(false);
            alert("Absence removed for remainder of the day.");
        } catch (err) {
            alert(err.response?.data?.message || "Failed to restore presence");
        }
    };

    const renderStatusSection = () => {
        if (!selectedCell) return null;
        const key = `${selectedCell.day} -${selectedCell.period} `;
        if (!timetable[key]) return null;

        const entry = timetable[key];
        if (!entry.facultyId) return null;
        if (getDayName(selectedDate) !== selectedCell.day.toUpperCase()) return null;

        const isAbsent = absences.some(a => a.facultyId === entry.facultyId && (a.period === 0 || a.period === selectedCell.period));
        const subEntry = substitutions.find(s => s.timetableId === entry.id);

        return (
            <div className="mt-10 pt-10 border-t-2 border-dashed border-gray-100 animate-fadeIn">
                <div className="flex items-center justify-between mb-8 group">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-[#003B73]/5 rounded-2xl text-[#003B73] transition-transform group-hover:rotate-12">
                            <RefreshCw size={24} />
                        </div>
                        <div>
                            <h4 className="text-lg font-black text-[#003B73] tracking-tight uppercase leading-none">Intelligence Engine</h4>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Substitution & Faculty Availability</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="flex items-center justify-between p-6 bg-gray-50 rounded-[32px] border border-gray-100 group">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 px-1">Current Presence</span>
                            {isAbsent ? (
                                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl border border-red-100 transition-all group-hover:scale-105">
                                    <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div>
                                    <span className="text-xs font-black uppercase tracking-widest">Marked Absent</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 transition-all group-hover:scale-105">
                                    <div className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></div>
                                    <span className="text-xs font-black uppercase tracking-widest">Duty Bound</span>
                                </div>
                            )}
                        </div>

                        {!isAbsent && (
                            <button
                                onClick={() => handleMarkAbsent(entry.facultyId)}
                                className="px-6 py-4 bg-white text-red-600 rounded-2xl font-bold text-xs uppercase tracking-widest border border-red-100 hover:bg-red-600 hover:text-white transition-all shadow-sm transform active:scale-95"
                            >
                                Notify Absence
                            </button>
                        )}
                    </div>

                    {isAbsent && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="p-6 bg-[#003B73]/5 rounded-[32px] border border-[#003B73]/10">
                                <label className="block text-[10px] font-black text-[#003B73] uppercase tracking-widest mb-4 px-1">Restoration Protocols</label>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => handleRemoveAbsence(entry.facultyId)}
                                        className="flex-1 py-4 bg-white text-emerald-600 border border-emerald-100 rounded-2xl font-black text-xs uppercase transition-all hover:bg-emerald-600 hover:text-white shadow-sm transform active:scale-95"
                                    >
                                        Single Class
                                    </button>
                                    <button
                                        onClick={() => handleRestoreRemainder(entry.facultyId)}
                                        className="flex-1 py-4 bg-[#003B73] text-white rounded-2xl font-black text-xs uppercase transition-all hover:bg-[#002850] shadow-lg shadow-blue-900/10 transform active:scale-95"
                                    >
                                        Rest of Day
                                    </button>
                                </div>
                            </div>

                            <div className="p-8 bg-amber-50 rounded-[40px] border-2 border-amber-200 shadow-xl shadow-amber-900/5 relative overflow-hidden group">
                                <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-200/20 rounded-full blur-2xl group-hover:bg-amber-200/40 transition-all"></div>

                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-amber-200 text-amber-800 rounded-xl">
                                            <Edit2 size={20} />
                                        </div>
                                        <h5 className="font-black text-amber-900 uppercase tracking-widest text-sm">Substitution Channel</h5>
                                    </div>

                                    {subEntry ? (
                                        <div className="flex items-center justify-between bg-white/60 p-5 rounded-3xl border border-amber-200/50 backdrop-blur-sm">
                                            <div>
                                                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest leading-none mb-1">Acting Faculty</p>
                                                <p className="text-lg font-black text-amber-900 leading-tight">{subEntry.substituteFaculty?.fullName}</p>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveSubstitution(subEntry.id)}
                                                className="p-4 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                                title="Revoke Substitution"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="relative group">
                                                <select
                                                    className="w-full px-6 py-5 bg-white border-2 border-transparent focus:border-amber-500 rounded-3xl font-black text-amber-900 outline-none transition-all appearance-none cursor-pointer shadow-sm"
                                                    value={substituteId}
                                                    onChange={e => setSubstituteId(e.target.value)}
                                                >
                                                    <option value="">-- Available Substitutes --</option>
                                                    {(Array.isArray(facultyList) ? facultyList : [])
                                                        .filter(f => f.id !== entry.facultyId)
                                                        .map(f => (
                                                            <option key={f.id} value={f.id}>{f.fullName} • {f.department}</option>
                                                        ))}
                                                </select>
                                                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-amber-400 group-focus-within:text-amber-600">
                                                    <User size={18} />
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleAssignSubstitute(entry.id)}
                                                disabled={assigningSub || !substituteId}
                                                className="w-full py-5 bg-amber-600 text-white rounded-3xl font-black uppercase tracking-widest text-xs hover:bg-amber-700 shadow-xl shadow-amber-900/10 transition-all flex items-center justify-center gap-3 transform active:scale-95 disabled:opacity-50"
                                            >
                                                {assigningSub ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
                                                {assigningSub ? 'Processing...' : 'Confirm Substitution'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };


    const handleSave = async () => {
        setSaving(true);
        try {
            const entries = Object.values(timetable).map(e => ({
                ...e,
                facultyId: e.facultyId
            }));

            await api.post('/admin/timetable', {
                entries,
                department,
                year,
                semester,
                section
            });
            alert('Timetable saved successfully!');
            fetchTimetable();
            fetchDailyStatus();
        } catch (err) {
            alert('Failed to save timetable');
        } finally {
            setSaving(false);
        }
    };

    const departmentColors = {
        'CSE': 'bg-[#003B73] text-white',
        'ECE': 'bg-[#003B73] text-white',
        'EEE': 'bg-[#003B73] text-white',
        'MECH': 'bg-[#003B73] text-white',
        'CIVIL': 'bg-[#003B73] text-white',
        'IT': 'bg-[#003B73] text-white'
    };

    const currentDept = departments.find(d => (d.code || d.name) === department);

    const availableSubjects = subjects.filter(s => {
        // Strict department match for Department-specific subjects

        if (s.semester !== parseInt(semester)) return false;

        if (s.type === 'COMMON') return true;

        // Match against Code OR Name (handle legacy data or mismatch)
        return s.department === department || (currentDept && s.department === currentDept.name);
    });

    return (
        <div className="flex flex-col animate-fadeIn">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6 px-2">
                <div>
                    <h1 className="text-4xl font-black text-[#003B73] tracking-tight">Timetable Management</h1>
                    <p className="text-gray-500 font-medium mt-1">Design academic schedules and manage daily faculty substitutions.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="hidden lg:flex items-center gap-2 px-6 py-4 bg-white rounded-3xl border border-gray-100 shadow-sm">
                        <Calendar size={20} className="text-[#003B73]" />
                        <input
                            type="date"
                            className="bg-transparent border-none outline-none font-bold text-gray-700 text-sm cursor-pointer"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-10 py-5 bg-[#003B73] text-white rounded-[24px] font-black hover:bg-[#002850] shadow-xl shadow-blue-900/10 transition-all flex items-center gap-3 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        {saving ? (
                            <RefreshCw size={22} className="animate-spin" />
                        ) : (
                            <Save size={22} strokeWidth={3} className="group-hover:scale-110 transition-transform" />
                        )}
                        {saving ? 'Saving...' : 'Publish Schedule'}
                    </button>
                </div>
            </div>

            {/* Filter Dashboard */}
            <div className="bg-white p-10 rounded-[40px] shadow-xl border border-gray-100 mb-10 relative overflow-hidden transition-all duration-700 hover:shadow-2xl">
                {/* Visual Accent */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#003B73]/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>

                <div className="flex flex-col lg:flex-row items-end gap-8 relative z-10">
                    <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Department</label>
                            <div className="relative group">
                                <select
                                    className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-2xl font-black text-[#003B73] outline-none transition-all appearance-none cursor-pointer"
                                    value={department}
                                    onChange={e => setDepartment(e.target.value)}
                                >
                                    {departments.map(d =>
                                        <option key={d.id} value={d.code || d.name}>{d.code || d.name}</option>
                                    )}
                                </select>
                                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-[#003B73] opacity-40 group-hover:opacity-100 transition-opacity">
                                    <Building2 size={18} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Academic Year</label>
                            <div className="relative group">
                                <select
                                    className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-2xl font-black text-[#003B73] outline-none transition-all appearance-none cursor-pointer"
                                    value={year}
                                    onChange={e => setYear(e.target.value)}
                                >
                                    {(departments.find(d => (d.code || d.name) === department)?.years?.split(',') || ['1', '2', '3', '4']).map(y =>
                                        <option key={y} value={y}>{y}{y === '1' ? 'st' : y === '2' ? 'nd' : y === '3' ? 'rd' : 'th'} Year</option>
                                    )}
                                </select>
                                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-[#003B73] opacity-40 group-hover:opacity-100 transition-opacity">
                                    <GraduationCap size={18} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Semester</label>
                            <div className="relative group">
                                <select
                                    className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-2xl font-black text-[#003B73] outline-none transition-all appearance-none cursor-pointer"
                                    value={semester}
                                    onChange={e => setSemester(e.target.value)}
                                >
                                    {(department === 'First Year (General)' || currentDept?.name === 'First Year (General)'
                                        ? ['1', '2']
                                        : [(parseInt(year) * 2 - 1).toString(), (parseInt(year) * 2).toString()]
                                    ).map(s =>
                                        <option key={s} value={s}>Semester {s}</option>
                                    )}
                                </select>
                                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-[#003B73] opacity-40 group-hover:opacity-100 transition-opacity">
                                    <BookOpen size={18} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Section</label>
                            <div className="relative group">
                                <select
                                    className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-2xl font-black text-[#003B73] outline-none transition-all appearance-none cursor-pointer"
                                    value={section}
                                    onChange={e => setSection(e.target.value)}
                                >
                                    {(departments.find(d => (d.code || d.name) === department)?.sections?.split(',') || ['A', 'B', 'C']).map(s =>
                                        <option key={s} value={s}>Section {s}</option>
                                    )}
                                </select>
                                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-[#003B73] opacity-40 group-hover:opacity-100 transition-opacity">
                                    <Users size={18} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="lg:hidden w-full">
                            <input
                                type="date"
                                className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent rounded-2xl font-bold text-[#003B73] outline-none transition-all"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={fetchDailyStatus}
                            className="p-5 bg-blue-50 text-[#003B73] rounded-2xl hover:bg-[#003B73] hover:text-white transition-all shadow-sm border border-blue-100"
                            title="Sync Substitution Data"
                        >
                            <RefreshCw size={24} className={statusLoading ? 'animate-spin' : 'hover:rotate-180 transition-transform duration-700'} />
                        </button>
                    </div>
                </div>

                <div className="mt-8 flex items-center justify-between px-2 py-4 bg-gray-50/50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/20"></div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Status: Linked to Cloud</span>
                        </div>
                        <div className="flex items-center gap-2 border-l border-gray-200 pl-6">
                            <Clock size={14} className="text-gray-400" />
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Week: Odd Cycle</span>
                        </div>
                    </div>
                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Selected Date: {new Date(selectedDate).toLocaleDateString()}</p>
                </div>
            </div>

            {/* Timetable Grid Container */}
            <div className="bg-white p-10 rounded-[40px] shadow-xl border border-gray-100 min-h-[600px] transition-all relative overflow-hidden group/grid">
                {/* Decorative Elements */}
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-[#003B73]/5 rounded-full blur-3xl group-hover/grid:bg-[#003B73]/10 transition-colors duration-1000"></div>

                <div className="flex justify-between items-center mb-10 relative z-10">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-[#003B73] rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/20 text-white">
                            <Clock size={32} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-[#003B73] tracking-tight uppercase">
                                {department} <span className="text-gray-300 mx-2">/</span> Y{year} {section}
                            </h2>
                            <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-1">
                                Interactive Scheduling Grid • {semester ? `Semester ${semester} ` : 'Cycle Unset'}
                            </p>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-40">
                        <div className="w-16 h-16 border-4 border-gray-100 border-t-[#003B73] rounded-full animate-spin mb-6"></div>
                        <p className="font-black text-gray-400 uppercase tracking-widest text-xs animate-pulse">Syncing Schedule...</p>
                    </div>
                ) : (
                    <div className="overflow-hidden bg-gray-50/30 rounded-3xl border border-gray-100 relative z-10">
                        <table className="w-full text-center border-collapse">
                            <thead className="bg-gray-100/50 text-[#003B73] text-[10px] font-black uppercase tracking-[0.2em]">
                                <tr>
                                    <th className="px-8 py-8 text-left border-r border-gray-200/50 bg-gray-100/30 w-40">Timeline</th>
                                    {periods.map(p => (
                                        <th key={p.id} className="px-6 py-8 border-b border-gray-100 min-w-[180px]">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-[12px]">{p.name}</span>
                                                <span className="text-[10px] text-gray-400 font-bold opacity-60 flex items-center gap-1">
                                                    <Clock size={10} strokeWidth={3} /> {p.label}
                                                </span>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {days.map((day, dayIdx) => {
                                    const occupiedPeriods = new Set();
                                    periods.forEach(p => {
                                        const key = `${day} -${p.id} `;
                                        const entry = timetable[key];
                                        if (entry && entry.duration > 1) {
                                            for (let i = 1; i < entry.duration; i++) {
                                                occupiedPeriods.add(p.id + i);
                                            }
                                        }
                                    });

                                    return (
                                        <tr key={day} className="group/row hover:bg-white transition-colors">
                                            <td className="px-8 py-10 text-left font-black text-[#003B73] bg-gray-100/20 border-r border-gray-200/50 uppercase tracking-widest text-sm">
                                                {day}
                                            </td>
                                            {periods.map(p => {
                                                if (occupiedPeriods.has(p.id)) return null;

                                                const key = `${day} -${p.id} `;
                                                const entry = timetable[key];
                                                const colspan = entry?.duration || 1;
                                                const isToday = getDayName(selectedDate) === day.toUpperCase().slice(0, 3);
                                                const isAbsent = entry?.facultyId && absences.some(a =>
                                                    a.facultyId === entry.facultyId && (a.period === 0 || a.period === p.id)
                                                );
                                                const subEntry = entry && substitutions.find(s => s.timetableId === entry.id);

                                                return (
                                                    <td
                                                        key={p.id}
                                                        colSpan={colspan}
                                                        onClick={() => handleCellClick(day, p.id)}
                                                        className={`p-2 cursor-pointer group/cell relative transition-all duration-300 ${isToday ? 'bg-[#003B73]/[0.02]' : ''}`}
                                                    >
                                                        {entry ? (
                                                            <div className={`p-4 rounded-[24px] min-h-[140px] flex flex-col justify-between transition-all duration-500 shadow-sm border-2 ${subEntry
                                                                ? 'bg-amber-50 border-amber-200 shadow-amber-900/5 translate-y-[-2px]'
                                                                : isToday && isAbsent
                                                                    ? 'bg-red-50 border-red-200 shadow-red-900/5'
                                                                    : entry.type === 'LAB'
                                                                        ? 'bg-blue-50/50 border-blue-200'
                                                                        : 'bg-white border-gray-100 group-hover/cell:border-[#003B73]/30 group-hover/cell:shadow-lg group-hover/cell:translate-y-[-4px]'
                                                                }`}>
                                                                <div>
                                                                    <div className="flex items-start justify-between mb-2">
                                                                        <span className={`text-[12px] font-black leading-tight ${subEntry ? 'text-amber-800' : isToday && isAbsent ? 'text-red-800' : 'text-[#003B73]'}`}>
                                                                            {entry.subjectName}
                                                                        </span>
                                                                        <span className={`text-[8px] px-2 py-0.5 rounded-lg font-black uppercase tracking-widest flex-shrink-0 ${entry.type === 'LAB'
                                                                            ? 'bg-blue-600 text-white'
                                                                            : subEntry ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-400'
                                                                            }`}>
                                                                            {entry.type}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 mt-1">
                                                                        <div className={`p-0.5 rounded-md ${subEntry ? 'bg-amber-200/50' : 'bg-gray-100'}`}>
                                                                            <User size={10} className={subEntry ? 'text-amber-700' : 'text-gray-400'} />
                                                                        </div>
                                                                        <span className={`text-[10px] font-bold truncate ${subEntry ? 'text-amber-700 underline decoration-amber-300 decoration-2 underline-offset-2' : isToday && isAbsent ? 'text-red-500 line-through' : 'text-gray-500'}`}>
                                                                            {subEntry ? subEntry.substituteFaculty?.fullName : entry.facultyName || 'Unassigned'}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-100/50">
                                                                    <div className="flex items-center gap-1.5 overflow-hidden">
                                                                        <MapPin size={10} className="text-gray-300 shrink-0" />
                                                                        <span className="text-[9px] font-black text-gray-400 truncate uppercase tracking-tighter">{entry.room || 'L-BLOCK'}</span>
                                                                    </div>
                                                                    {colspan > 1 && (
                                                                        <div className="flex items-center gap-1.5 bg-[#003B73]/5 px-2 py-0.5 rounded-md">
                                                                            <Clock size={8} className="text-[#003B73]" />
                                                                            <span className="text-[9px] font-black text-[#003B73]">P{p.id}-{p.id + colspan - 1}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="h-[140px] rounded-[24px] border-2 border-dashed border-gray-100 hover:border-[#003B73]/30 hover:bg-gray-50 transition-all flex flex-col items-center justify-center group/empty overflow-hidden relative">
                                                                <div className="p-3 bg-white rounded-2xl shadow-sm border border-gray-50 text-gray-200 group-hover/empty:scale-110 group-hover/empty:text-[#003B73] transition-all duration-500">
                                                                    <Plus size={20} strokeWidth={3} />
                                                                </div>
                                                                <span className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em] mt-3 opacity-0 group-hover/empty:opacity-100 transition-opacity">Assign Class</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Assignment & Management Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-[#003B73]/20 backdrop-blur-md flex items-center justify-center p-6 z-[100] animate-fadeIn">
                    <div className="bg-white rounded-[48px] w-full max-w-2xl shadow-2xl border border-gray-100 overflow-hidden transform animate-modalEnter">
                        <div className="bg-white p-10 pb-4">
                            <div className="flex justify-between items-start mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-[#003B73] border border-gray-100 shadow-sm">
                                        <Calendar size={32} />
                                    </div>
                                    <div>
                                        <h3 className="text-3xl font-black text-[#003B73] tracking-tight lowercase">
                                            Assigning Class <span className="text-gray-300">/</span> {selectedCell?.day}
                                        </h3>
                                        <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-1">
                                            Period {selectedCell?.period} • Schedule Configuration
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowModal(false);
                                        setSubstituteId('');
                                    }}
                                    className="p-4 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-3xl transition-all group"
                                >
                                    <X size={32} className="group-hover:rotate-90 transition-transform duration-500" />
                                </button>
                            </div>

                            {/* Type Switcher */}
                            <div className="p-2 bg-gray-50 rounded-[32px] border border-gray-100 mb-8 flex gap-2">
                                <button
                                    className={`flex - 1 py - 4 rounded - [24px] font - black text - xs uppercase tracking - widest transition - all ${entryType === 'THEORY' ? 'bg-white text-[#003B73] shadow-md border border-gray-100' : 'text-gray-400 hover:text-gray-600'} `}
                                    onClick={() => setEntryType('THEORY')}
                                >
                                    Theory Class
                                </button>
                                <button
                                    className={`flex - 1 py - 4 rounded - [24px] font - black text - xs uppercase tracking - widest transition - all ${entryType === 'LAB' ? 'bg-[#003B73] text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'} `}
                                    onClick={() => setEntryType('LAB')}
                                >
                                    Laboratory
                                </button>
                            </div>

                            <form className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Academic Subject</label>
                                        <div className="relative group">
                                            <select
                                                className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-3xl font-bold text-gray-800 outline-none transition-all appearance-none cursor-pointer"
                                                value={selectedSubject}
                                                onChange={e => handleSubjectChange(e.target.value)}
                                            >
                                                <option value="">-- Select Subject --</option>
                                                {availableSubjects.map(s => (
                                                    <option key={s.id} value={s.name}>{s.shortName ? `${s.shortName} - ${s.name} ` : s.name}</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-focus-within:text-[#003B73]">
                                                <BookOpen size={18} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Primary Faculty</label>
                                        <div className="relative">
                                            <input
                                                className="w-full px-6 py-5 bg-gray-100 border-2 border-transparent rounded-3xl font-bold text-gray-500 outline-none cursor-not-allowed"
                                                value={selectedFaculty}
                                                readOnly
                                                placeholder="Linked to Subject"
                                            />
                                            <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300">
                                                <User size={18} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Room / Venue</label>
                                        <div className="relative group">
                                            <input
                                                className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-3xl font-bold text-gray-800 outline-none transition-all"
                                                placeholder="e.g. Lab-301"
                                                value={selectedRoom}
                                                onChange={e => setSelectedRoom(e.target.value)}
                                            />
                                            <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#003B73]">
                                                <MapPin size={18} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Session Duration</label>
                                        <div className="relative group">
                                            <select
                                                className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-3xl font-bold text-gray-800 outline-none transition-all appearance-none cursor-pointer"
                                                value={selectedDuration}
                                                onChange={e => setSelectedDuration(parseInt(e.target.value))}
                                            >
                                                <option value={1}>1 Period (Standard)</option>
                                                <option value={2}>2 Periods (Double)</option>
                                                <option value={3}>3 Periods (Block)</option>
                                            </select>
                                            <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#003B73]">
                                                <Clock size={18} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {renderStatusSection()}

                                <div className="flex gap-4 pt-4 pb-8">
                                    {timetable[`${selectedCell?.day} -${selectedCell?.period} `] && (
                                        <button
                                            type="button"
                                            onClick={deleteEntry}
                                            className="px-6 py-5 bg-red-50 text-red-600 rounded-[24px] font-black hover:bg-red-600 hover:text-white transition-all shadow-sm border border-red-100 flex items-center justify-center"
                                            title="Permanently Remove"
                                        >
                                            <Trash2 size={24} />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 py-5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-[24px] font-black transition-all transform active:scale-95"
                                    >
                                        Discard
                                    </button>
                                    <button
                                        type="button"
                                        onClick={applyChanges}
                                        disabled={!selectedSubject}
                                        className="flex-[2] py-5 bg-[#003B73] text-white rounded-[24px] font-black hover:bg-[#002850] shadow-xl shadow-blue-900/10 transition-all transform active:scale-95 disabled:opacity-50"
                                    >
                                        {timetable[`${selectedCell?.day} -${selectedCell?.period} `] ? 'Commit Updates' : 'Confirm Assignment'}
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

export default TimetableManager;
