import React, { useState, useEffect } from "react";
import {
    Send, RefreshCw, CheckSquare, Square,
    Download, Users, AlertCircle, BookOpen
} from "lucide-react";
import api from "../../api/axios";
import toast from "react-hot-toast";

const DISPATCH_SIZE = 50;
const COLS = 5;
const ROWS_PER_COL = 10;

const Dispatch = () => {
    const [subjects, setSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(null);

    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [time, setTime] = useState("10:00");
    const [ampm, setAmpm] = useState("AM");
    const [session, setSession] = useState("FN");
    const [boardCode, setBoardCode] = useState("505");
    const [qpCode, setQpCode] = useState("");

    // groupSelected: { [studentId]: bool }
    const [groupSelected, setGroupSelected] = useState({});

    useEffect(() => { fetchSubjects(); }, []);

    const fetchSubjects = async () => {
        try {
            const res = await api.get("/admin/dispatch/subjects");
            setSubjects(res.data);
        } catch { toast.error("Failed to load subjects"); }
    };

    const fetchStudents = async (subject) => {
        setLoading(true);
        try {
            const res = await api.get("/admin/dispatch/students", {
                params: { subjectId: subject.id, semester: subject.semester }
            });
            const enriched = res.data.map(s => ({
                ...s,
                isAbsent: false,
                isMalpractice: false,
                // isArrear comes from backend; markedAR controls whether AR shows in PDF
                markedAR: s.isArrear ? true : false,
            }));
            setStudents(enriched);
            setGroupSelected({});
        } catch { toast.error("Failed to load students"); }
        finally { setLoading(false); }
    };

    const handleSubjectChange = (e) => {
        const sub = subjects.find(s => s.id === parseInt(e.target.value));
        setSelectedSubject(sub || null);
        setStudents([]);
        if (sub) fetchStudents(sub);
    };

    const toggleAbsent = (id) => setStudents(prev => prev.map(s => s.id === id ? { ...s, isAbsent: !s.isAbsent } : s));
    const toggleAR = (id) => setStudents(prev => prev.map(s => s.id === id ? { ...s, markedAR: !s.markedAR } : s));

    const toggleGroupSelect = (id) =>
        setGroupSelected(prev => ({ ...prev, [id]: !prev[id] }));

    const selectAllInDispatch = (ds, val) => {
        const upd = {};
        ds.forEach(s => { upd[s.id] = val; });
        setGroupSelected(prev => ({ ...prev, ...upd }));
    };

    const markSelectedAbsent = (ds) => {
        const ids = ds.filter(s => groupSelected[s.id]).map(s => s.id);
        if (!ids.length) { toast.error("No students selected"); return; }
        setStudents(prev => prev.map(s => ids.includes(s.id) ? { ...s, isAbsent: true } : s));
        const cleared = {};
        ids.forEach(id => { cleared[id] = false; });
        setGroupSelected(prev => ({ ...prev, ...cleared }));
        toast.success(`Marked ${ids.length} student(s) absent`);
    };

    const clearAbsent = (ds) => {
        const ids = ds.map(s => s.id);
        setStudents(prev => prev.map(s => ids.includes(s.id) ? { ...s, isAbsent: false } : s));
    };

    // Split into dispatches of 50
    const dispatches = [];
    for (let i = 0; i < students.length; i += DISPATCH_SIZE)
        dispatches.push(students.slice(i, i + DISPATCH_SIZE));

    // Column-major 5×10 grid
    const buildGrid = (ds) => {
        const grid = [];
        for (let row = 0; row < ROWS_PER_COL; row++) {
            const cells = [];
            for (let col = 0; col < COLS; col++) {
                const idx = col * ROWS_PER_COL + row;
                cells.push(idx < ds.length ? ds[idx] : null);
            }
            grid.push(cells);
        }
        return grid;
    };

    const exportPDF = async (dispatchIdx) => {
        if (!selectedSubject) { toast.error("No subject selected"); return; }
        if (!boardCode.trim()) { toast.error("Please enter Board Code"); return; }
        setExporting(dispatchIdx);
        try {
            const ds = dispatches[dispatchIdx];
            const payload = {
                subjectId: selectedSubject.id,
                subjectCode: selectedSubject.code,
                subjectName: selectedSubject.name,
                semester: selectedSubject.semester,
                dispatchIndex: dispatchIdx,
                totalDispatches: dispatches.length,
                date, time, ampm, session, boardCode, qpCode,
                students: ds.map(s => ({
                    id: s.id,
                    registerNumber: s.registerNumber,
                    isAbsent: s.isAbsent,
                    isMalpractice: s.isMalpractice,
                    isArrear: s.isArrear && s.markedAR,
                }))
            };

            const res = await api.post("/admin/dispatch/export-pdf", payload, { responseType: "blob" });
            const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
            const link = document.createElement("a");
            link.href = url;
            link.download = `dispatch_${dispatchIdx + 1}_${selectedSubject.code}.pdf`;
            link.click();
            window.URL.revokeObjectURL(url);
            toast.success(`Dispatch ${dispatchIdx + 1} exported!`);
        } catch (err) {
            console.error(err);
            toast.error("Failed to export PDF");
        } finally { setExporting(null); }
    };

    // ── Render ──────────────────────────────────────────────────────────────────
    return (
        <div className="w-full animate-fadeIn">

            {/* Page Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-4xl font-black text-[#003B73] tracking-tight flex items-center gap-3">
                        <Send className="text-blue-600" size={32} /> Dispatch
                    </h1>
                    <p className="text-gray-500 font-medium mt-1">
                        Generate Answer Book dispatch sheets — 50 students per dispatch.
                    </p>
                </div>
            </div>

            {/* Settings Card */}
            <div className="bg-white p-7 rounded-[28px] shadow-xl shadow-blue-900/5 border border-gray-100 mb-8">
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-5">Dispatch Settings</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

                    {/* Subject — spans 2 cols */}
                    <div className="col-span-1 sm:col-span-2 lg:col-span-2 min-w-0">
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Subject</label>
                        <select
                            className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                            onChange={handleSubjectChange}
                            defaultValue=""
                        >
                            <option value="">— Select Subject —</option>
                            {subjects.map(s => (
                                <option key={s.id} value={s.id}>{s.code}: {s.name} — Sem {s.semester}</option>
                            ))}
                        </select>
                        {selectedSubject && (
                            <p className="text-xs text-blue-600 font-bold mt-1 ml-1">Semester {selectedSubject.semester} · {selectedSubject.code}</p>
                        )}
                    </div>

                    {/* Date */}
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Exam Date</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)}
                            className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
                    </div>

                    {/* Time + AM/PM */}
                    <div className="min-w-0">
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Time</label>
                        <div className="flex gap-1.5">
                            <input type="time" value={time} onChange={e => setTime(e.target.value)}
                                className="min-w-0 flex-1 w-0 border border-gray-200 rounded-2xl px-2 py-3 text-sm font-medium bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
                            <select value={ampm} onChange={e => setAmpm(e.target.value)}
                                className="shrink-0 w-14 border border-gray-200 rounded-2xl px-1 py-3 text-sm font-medium bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-center">
                                <option value="AM">AM</option>
                                <option value="PM">PM</option>
                            </select>
                        </div>
                    </div>

                    {/* Session */}
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Session</label>
                        <div className="flex gap-2 h-[46px]">
                            {["FN", "AN"].map(s => (
                                <button key={s} onClick={() => setSession(s)}
                                    className={`flex-1 rounded-2xl font-black text-sm transition-all ${session === s ? "bg-[#003B73] text-white shadow-lg shadow-blue-900/20" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Board Code */}
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Board Code</label>
                        <input type="text" value={boardCode} onChange={e => setBoardCode(e.target.value)} placeholder="505"
                            className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
                    </div>

                    {/* QP Code */}
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">QP Code</label>
                        <input type="text" value={qpCode} onChange={e => setQpCode(e.target.value)} placeholder="50439"
                            className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
                    </div>

                </div>
            </div>

            {/* Legend */}
            {students.length > 0 && (
                <div className="flex items-center gap-6 mb-4 px-1">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Legend:</span>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-red-600">
                        <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Click Reg No → Mark AB (Absent)
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600">
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> AR = Arrear student (toggle on/off)
                    </span>
                </div>
            )}

            {/* Loading / Empty */}
            {loading && (
                <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                    <RefreshCw size={48} className="animate-spin mb-4 text-blue-600/40" />
                    <p className="font-bold font-mono tracking-widest">LOADING STUDENTS...</p>
                </div>
            )}
            {!loading && selectedSubject && students.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                    <AlertCircle size={48} className="mb-4 text-yellow-400" />
                    <p className="font-bold text-lg">No students found for Semester {selectedSubject.semester}</p>
                    <p className="text-sm mt-1">Make sure students have register numbers assigned.</p>
                </div>
            )}
            {!loading && !selectedSubject && (
                <div className="flex flex-col items-center justify-center py-24 text-gray-300">
                    <BookOpen size={56} className="mb-4" />
                    <p className="font-bold text-xl tracking-wide">Select a subject to begin</p>
                </div>
            )}

            {/* Dispatch Panels */}
            {!loading && dispatches.map((ds, dispatchIdx) => {
                const abCount = ds.filter(s => s.isAbsent).length;
                const mpCount = ds.filter(s => s.isMalpractice).length;
                const arCount = ds.filter(s => s.isArrear).length;
                const presentCount = ds.length - abCount;
                const grid = buildGrid(ds);
                const allSel = ds.every(s => groupSelected[s.id]);
                const someSel = ds.some(s => groupSelected[s.id]);
                const selCount = ds.filter(s => groupSelected[s.id]).length;

                return (
                    <div key={dispatchIdx}
                        className="bg-white rounded-[28px] shadow-xl shadow-blue-900/5 border border-gray-100 mb-8 overflow-hidden">

                        {/* Dispatch Header */}
                        <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100 bg-gradient-to-r from-[#003B73]/5 to-transparent">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-2xl bg-[#003B73] text-white flex items-center justify-center font-black text-lg">
                                    {dispatchIdx + 1}
                                </div>
                                <div>
                                    <h3 className="font-black text-[#003B73] text-lg">Dispatch {dispatchIdx + 1} of {dispatches.length}</h3>
                                    <p className="text-xs text-gray-400 font-medium">{ds.length} students · Bd: {boardCode || "—"}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap justify-end">
                                <span className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-xl text-xs font-black">Total: {ds.length}</span>
                                <span className={`px-3 py-1.5 rounded-xl text-xs font-black ${abCount > 0 ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-400"}`}>AB: {abCount}</span>
                                <span className="bg-orange-100 text-orange-600 px-3 py-1.5 rounded-xl text-xs font-black">MP: {mpCount}</span>
                                {arCount > 0 && <span className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl text-xs font-black">AR: {arCount}</span>}
                                <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-xl text-xs font-black">Present: {presentCount}</span>
                            </div>
                        </div>

                        {/* Group Action Bar */}
                        <div className="flex items-center gap-3 px-7 py-3 bg-gray-50 border-b border-gray-100 flex-wrap">
                            <button onClick={() => selectAllInDispatch(ds, !allSel)}
                                className="flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-blue-700 transition">
                                {allSel ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
                                {allSel ? "Deselect All" : "Select All"}
                            </button>
                            {someSel && (
                                <>
                                    <span className="text-gray-300">|</span>
                                    <span className="text-xs font-bold text-gray-500">{selCount} selected</span>
                                    <button onClick={() => markSelectedAbsent(ds)}
                                        className="bg-red-600 text-white text-xs font-black px-4 py-1.5 rounded-xl hover:bg-red-700 transition">
                                        Mark Absent (AB)
                                    </button>
                                </>
                            )}
                            {abCount > 0 && (
                                <button onClick={() => clearAbsent(ds)}
                                    className="text-xs font-bold text-gray-400 hover:text-red-500 transition">
                                    Clear All AB
                                </button>
                            )}
                            <div className="ml-auto">
                                <button onClick={() => exportPDF(dispatchIdx)} disabled={exporting === dispatchIdx}
                                    className="flex items-center gap-2 bg-[#003B73] text-white font-black text-sm px-5 py-2.5 rounded-2xl hover:bg-blue-800 transition shadow-lg shadow-blue-900/20 disabled:opacity-60">
                                    {exporting === dispatchIdx ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                                    Export PDF
                                </button>
                            </div>
                        </div>

                        {/* Student Grid */}
                        <div className="px-7 py-5 overflow-x-auto">
                            <table className="w-full border-collapse">
                                <tbody>
                                    {grid.map((row, rowIdx) => (
                                        <tr key={rowIdx} className={rowIdx % 2 === 0 ? "bg-gray-50/40" : ""}>
                                            {row.map((student, colIdx) => (
                                                <td key={colIdx} className="py-1 px-2 align-middle" style={{ width: "20%" }}>
                                                    {student ? (
                                                        <div className="flex items-center gap-1.5 group">
                                                            {/* Checkbox for group select */}
                                                            <input type="checkbox" checked={!!groupSelected[student.id]}
                                                                onChange={() => toggleGroupSelect(student.id)}
                                                                className="w-3.5 h-3.5 accent-blue-600 cursor-pointer shrink-0 opacity-0 group-hover:opacity-100 transition"
                                                                style={{ opacity: groupSelected[student.id] ? 1 : undefined }} />

                                                            {/* Register Number — click to toggle absent */}
                                                            <button onClick={() => toggleAbsent(student.id)}
                                                                title={student.isAbsent ? "Click to remove AB" : "Click to mark Absent"}
                                                                className={`font-mono font-bold text-sm rounded-lg px-1.5 py-0.5 transition-all leading-tight ${student.isAbsent
                                                                    ? "bg-red-100 text-red-700 ring-1 ring-red-300"
                                                                    : student.isArrear
                                                                        ? "text-amber-800 hover:bg-amber-50"
                                                                        : "text-gray-900 hover:bg-blue-50 hover:text-blue-800"
                                                                    }`}>
                                                                {student.registerNumber}
                                                            </button>

                                                            {/* AB badge */}
                                                            {student.isAbsent && (
                                                                <span className="text-[10px] font-black text-red-600 bg-red-50 px-1 py-0.5 rounded leading-tight">AB</span>
                                                            )}

                                                            {/* AR badge — only for arrear students, toggleable */}
                                                            {student.isArrear && !student.isAbsent && (
                                                                <button onClick={() => toggleAR(student.id)}
                                                                    title={student.markedAR ? "AR marked — click to unmark" : "Click to mark AR"}
                                                                    className={`text-[10px] font-black px-1 py-0.5 rounded leading-tight transition-all ${student.markedAR
                                                                        ? "bg-amber-100 text-amber-700 ring-1 ring-amber-300"
                                                                        : "bg-gray-100 text-gray-400 line-through"
                                                                        }`}>
                                                                    AR
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-200 text-sm">—</span>
                                                    )}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Bottom Summary */}
                        <div className="px-7 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                            <span className="font-black text-lg text-[#003B73]">Bd: {boardCode || "—"}</span>
                            <div className="font-black text-sm text-gray-700 flex items-center gap-3">
                                <span>Total: {ds.length}</span>
                                <span className="text-red-600">AB: {abCount}</span>
                                <span className="text-orange-500">MP: {mpCount}</span>
                                {arCount > 0 && <span className="text-amber-600">AR: {arCount}</span>}
                                <span className="text-green-600">Present: {presentCount}</span>
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Grand Total Footer */}
            {students.length > 0 && (
                <div className="bg-[#003B73] text-white rounded-[24px] p-6 flex items-center justify-between shadow-xl shadow-blue-900/20">
                    <div className="flex items-center gap-3">
                        <Users size={24} />
                        <span className="font-black text-lg">Grand Total</span>
                    </div>
                    <div className="flex items-center gap-6 font-black">
                        <span>{students.length} Students</span>
                        <span className="text-red-300">AB: {students.filter(s => s.isAbsent).length}</span>
                        <span className="text-orange-300">MP: {students.filter(s => s.isMalpractice).length}</span>
                        {students.some(s => s.isArrear) && (
                            <span className="text-amber-300">AR: {students.filter(s => s.isArrear).length}</span>
                        )}
                        <span className="text-green-300">Present: {students.length - students.filter(s => s.isAbsent).length}</span>
                        <span className="text-blue-200 text-sm font-bold">
                            {dispatches.length} Dispatch{dispatches.length !== 1 ? "es" : ""}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dispatch;
