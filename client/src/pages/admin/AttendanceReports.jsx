import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Download, Search, FileText, AlertTriangle, FileSpreadsheet, CheckCircle, Clock, RefreshCw } from 'lucide-react';
// XLSX import removed - using backend export for Excel reports

const AttendanceReports = () => {
    const [departments, setDepartments] = useState([]);
    const [department, setDepartment] = useState('');
    const [year, setYear] = useState('1');
    const [section, setSection] = useState('A');
    const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]); // Start of month
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        try {
            const res = await api.get('/admin/departments');
            setDepartments(res.data);
            if (res.data.length > 0) {
                setDepartment(res.data[0].code || res.data[0].name);
            }
        } catch (err) {
            console.error("Failed to fetch departments");
        }
    };

    const fetchReport = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/attendance/report', {
                params: { department, year, section, fromDate, toDate }
            });
            setReportData(res.data);
        } catch (err) {
            alert("Failed to fetch report");
        } finally {
            setLoading(false);
        }
    };

    const downloadCSV = () => {
        // Simple CSV export logic
        if (reportData.length === 0) return;

        const headers = ["Register No", "Name", "Total Classes", "Present", "OD", "Absent", "Percentage"];
        const rows = reportData.map(s => [s.registerNumber, s.name, s.totalClasses, s.present, s.od || 0, s.absent, s.percentage + '%']);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Attendance_Report_${department}_${year}_${section}.csv`);
        document.body.appendChild(link);
        link.click();
    };

    const exportToExcel = async () => {
        if (reportData.length === 0) return;

        setExporting(true);
        try {
            const response = await api.get('/admin/attendance/export-excel', {
                params: { department, year, section, fromDate, toDate },
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Attendance_Report_${department}_${year}_${section}_${new Date().toISOString().split('T')[0]}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Export error:', err);
            alert('Failed to export Excel');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="flex flex-col animate-fadeIn">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6 px-2">
                <div>
                    <h1 className="text-4xl font-black text-[#003B73] tracking-tight">Attendance Intelligence</h1>
                    <p className="text-gray-500 font-medium mt-1">Analyze institutional attendance trends and identify student participation metrics.</p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={fetchReport}
                        disabled={loading}
                        className="px-10 py-5 bg-[#003B73] text-white rounded-[24px] font-black hover:bg-[#002850] shadow-xl shadow-blue-900/10 transition-all flex items-center gap-3 transform active:scale-95 disabled:opacity-50 group"
                    >
                        {loading ? (
                            <RefreshCw size={22} className="animate-spin" />
                        ) : (
                            <Search size={22} strokeWidth={3} className="group-hover:scale-110 transition-transform" />
                        )}
                        {loading ? 'Synthesizing...' : 'Generate Intelligence'}
                    </button>
                </div>
            </div>

            {/* Analytics Filtering Dashboard */}
            <div className="bg-white p-10 rounded-[40px] shadow-xl border border-gray-100 mb-10 relative overflow-hidden transition-all duration-700 hover:shadow-2xl">
                {/* Visual Background Accent */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#003B73]/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8 relative z-10">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Institutional Department</label>
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
                                <FileText size={18} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Academic Year</label>
                        <select
                            className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-2xl font-black text-[#003B73] outline-none transition-all appearance-none cursor-pointer"
                            value={year}
                            onChange={e => setYear(e.target.value)}
                        >
                            {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y}{y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th'} Year</option>)}
                        </select>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Section</label>
                        <select
                            className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-2xl font-black text-[#003B73] outline-none transition-all appearance-none cursor-pointer"
                            value={section}
                            onChange={e => setSection(e.target.value)}
                        >
                            {['A', 'B', 'C'].map(s => <option key={s} value={s}>Section {s}</option>)}
                        </select>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Analysis From</label>
                        <div className="relative">
                            <input
                                type="date"
                                className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-2xl font-bold text-gray-700 outline-none transition-all"
                                value={fromDate}
                                onChange={e => setFromDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Analysis To</label>
                        <div className="relative">
                            <input
                                type="date"
                                className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-2xl font-bold text-gray-700 outline-none transition-all"
                                value={toDate}
                                onChange={e => setToDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Intelligence Statistics Grid */}
            {reportData.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10 animate-fadeInUp">
                    <div className="bg-white p-8 rounded-[40px] shadow-xl border border-gray-100 flex items-center justify-between group hover:shadow-2xl transition-all duration-500">
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 px-1">Average Attendance</p>
                            <p className="text-4xl font-black text-[#003B73]">
                                {(reportData.reduce((acc, curr) => acc + parseFloat(curr.percentage || 0), 0) / reportData.length).toFixed(1)}%
                            </p>
                        </div>
                        <div className="w-16 h-16 bg-emerald-50 rounded-3xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                            <CheckCircle size={32} />
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[40px] shadow-xl border border-gray-100 flex items-center justify-between group hover:shadow-2xl transition-all duration-500">
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 px-1">Defaulter Count</p>
                            <p className="text-4xl font-black text-red-600">
                                {reportData.filter(s => parseFloat(s.percentage) < 75).length}
                            </p>
                        </div>
                        <div className="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform">
                            <AlertTriangle size={32} />
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[40px] shadow-xl border border-gray-100 flex items-center justify-between group hover:shadow-2xl transition-all duration-500">
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 px-1">Analytical Period</p>
                            <p className="text-4xl font-black text-blue-600">
                                {reportData[0]?.totalClasses || 0} <span className="text-xl text-gray-300">Days</span>
                            </p>
                        </div>
                        <div className="w-16 h-16 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                            <Clock size={32} />
                        </div>
                    </div>
                </div>
            )}

            {/* Detailed Analytics Table */}
            {reportData.length > 0 ? (
                <div className="bg-white p-10 rounded-[40px] shadow-xl border border-gray-100 min-h-[500px] transition-all relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-6 relative z-10">
                        <div>
                            <h3 className="text-2xl font-black text-[#003B73] tracking-tight uppercase">Detailed Intelligence Report</h3>
                            <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-1">Granular Student Attendance Breakdown</p>
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={downloadCSV}
                                className="px-6 py-4 bg-gray-50 text-gray-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all shadow-sm flex items-center gap-2"
                            >
                                <Download size={18} /> CSV
                            </button>
                            <button
                                onClick={exportToExcel}
                                disabled={exporting}
                                className="px-8 py-4 bg-[#003B73] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#002850] shadow-xl shadow-blue-900/10 transition-all flex items-center gap-2 transform active:scale-95 disabled:opacity-50"
                            >
                                <FileSpreadsheet size={18} /> {exporting ? 'Processing...' : 'Excel Intelligence'}
                            </button>
                        </div>
                    </div>

                    <div className="overflow-hidden bg-gray-50/30 rounded-3xl border border-gray-100 relative z-10">
                        <table className="w-full text-center border-collapse">
                            <thead className="bg-gray-100/50 text-[#003B73] text-[10px] font-black uppercase tracking-[0.2em]">
                                <tr>
                                    <th className="px-8 py-6 text-left">Academic Identifier</th>
                                    <th className="px-8 py-6 text-left">Student Profile</th>
                                    <th className="px-8 py-6">Engagement</th>
                                    <th className="px-8 py-6">Attendance Delta</th>
                                    <th className="px-8 py-6 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100/50">
                                {reportData.map((student) => {
                                    const perc = parseFloat(student.percentage);
                                    let statusColor = 'bg-emerald-50 text-emerald-600 border-emerald-100';
                                    let statusLabel = 'GOOD';
                                    if (perc < 65) {
                                        statusColor = 'bg-red-50 text-red-600 border-red-100';
                                        statusLabel = 'CRITICAL';
                                    } else if (perc < 75) {
                                        statusColor = 'bg-amber-50 text-amber-600 border-amber-100';
                                        statusLabel = 'WARNING';
                                    }

                                    return (
                                        <tr key={student.id} className="group hover:bg-white transition-all duration-300">
                                            <td className="px-8 py-6 text-left">
                                                <span className="font-mono text-xs font-black text-gray-400 group-hover:text-[#003B73] transition-colors">{student.registerNumber}</span>
                                            </td>
                                            <td className="px-8 py-6 text-left">
                                                <div className="font-black text-gray-800 text-lg group-hover:text-[#003B73] transition-colors leading-tight">
                                                    {student.name}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-full max-w-[120px] bg-gray-200 rounded-full h-2 mb-1 overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-1000 ${perc >= 75 ? 'bg-emerald-500' : perc >= 65 ? 'bg-amber-400' : 'bg-red-500'}`}
                                                            style={{ width: `${perc}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-sm font-black text-[#003B73]">{student.percentage}%</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center justify-center gap-4">
                                                    <div className="text-center">
                                                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-tighter">Present</p>
                                                        <p className="font-black text-emerald-600">{student.present - (student.od || 0)}</p>
                                                    </div>
                                                    <div className="w-px h-6 bg-gray-100"></div>
                                                    <div className="text-center">
                                                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-tighter">OD</p>
                                                        <p className="font-black text-blue-600">{student.od || 0}</p>
                                                    </div>
                                                    <div className="w-px h-6 bg-gray-100"></div>
                                                    <div className="text-center">
                                                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-tighter">Absent</p>
                                                        <p className="font-black text-red-500">{student.absent}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <span className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest border ${statusColor} shadow-sm inline-flex items-center gap-2`}>
                                                    {statusLabel === 'CRITICAL' && <AlertTriangle size={12} />}
                                                    {statusLabel}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="bg-white p-20 rounded-[40px] shadow-xl border border-gray-100 text-center flex flex-col items-center group">
                    <div className="w-24 h-24 bg-gray-50 rounded-[32px] flex items-center justify-center text-gray-200 mb-8 border border-gray-50 shadow-sm group-hover:scale-110 group-hover:text-[#003B73] transition-all duration-700">
                        <Search size={48} strokeWidth={2.5} />
                    </div>
                    <h3 className="text-2xl font-black text-gray-400 tracking-tight uppercase mb-2">Awaiting Intelligence</h3>
                    <p className="text-gray-400 font-medium max-w-sm">Use the analytical filters above to generate institutional attendance reports.</p>
                </div>
            )}
        </div>
    );
};

export default AttendanceReports;
