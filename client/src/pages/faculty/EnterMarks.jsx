import CustomSelect from "../../components/CustomSelect";
import { useState, useEffect } from "react";
import api from "../../api/axios";
import {
  Search,
  Save,
  FileSpreadsheet,
  Lock,
  Unlock,
  Download,
  AlertCircle,
} from "lucide-react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

const EnterMarks = () => {
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [selectedExam, setSelectedExam] = useState("cia1");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const maxMarks = {
    test: 60,
    assignment: 20,
    attendance: 20,
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      const res = await api.get("/faculty/assignments");
      setAssignments(res.data);
      if (res.data.length > 0) setSelectedAssignmentId(res.data[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = async () => {
    if (!selectedAssignmentId) return;
    setLoading(true);
    try {
      const assignment = assignments.find(
        (a) => a.id === parseInt(selectedAssignmentId),
      );
      if (!assignment) return;

      const res = await api.get(`/faculty/marks/${assignment.subject.id}`);
      setStudents(res.data);

      // Check if marks are locked
      if (res.data.length > 0) {
        const firstMark = res.data[0].marks;
        const granularLock = firstMark?.[`isLocked_${selectedExam}`];
        const globalLock = firstMark?.isLocked;
        setIsLocked(!!(granularLock || globalLock)); // Ensure boolean
      } else {
        setIsLocked(false);
      }
    } catch (err) {
      alert("Error fetching student list");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (studentId, field, value) => {
    if (isLocked) {
      alert("Marks are locked by Admin. Cannot edit.");
      return;
    }

    const numVal = parseFloat(value);

    // Allow -1 for absentees, or 0 to maxMarks
    if (
      value !== "" &&
      (isNaN(numVal) || numVal < -1 || numVal > maxMarks[field])
    ) {
      return;
    }

    setStudents((prev) =>
      prev.map((s) => {
        if (s.studentId !== studentId) return s;

        const dbField = `${selectedExam}_${field}`;
        return {
          ...s,
          marks: {
            ...s.marks,
            [dbField]: value,
          },
        };
      }),
    );
  };

  const handleSave = async () => {
    if (isLocked) {
      alert("Marks are locked by Admin. Cannot save.");
      return;
    }

    setSaving(true);
    try {
      const assignment = assignments.find(
        (a) => a.id === parseInt(selectedAssignmentId),
      );

      const promises = students.map((s) => {
        const payload = {
          studentId: s.studentId,
          subjectId: assignment.subject.id,
          [`${selectedExam}_test`]: s.marks[`${selectedExam}_test`] || null,
          [`${selectedExam}_assignment`]:
            s.marks[`${selectedExam}_assignment`] || null,
          [`${selectedExam}_attendance`]:
            s.marks[`${selectedExam}_attendance`] || null,
        };
        return api.post("/faculty/marks", payload);
      });

      await Promise.all(promises);
      alert("All marks saved successfully!");
      handleSearch(); // Refresh data
    } catch (err) {
      console.error(err);
      if (err.response?.data?.message) {
        alert(err.response.data.message);
      } else {
        alert("Error saving marks");
      }
    } finally {
      setSaving(false);
    }
  };

  const exportToExcel = async () => {
    if (students.length === 0) {
      alert("No data to export");
      return;
    }

    const assignment = assignments.find(
      (a) => a.id === parseInt(selectedAssignmentId),
    );
    const examName = selectedExam.toUpperCase().replace("CIA", "CIA-");

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(examName);

    // Add columns
    worksheet.columns = [
      { header: "S.No", key: "sno", width: 10 },
      { header: "Register Number", key: "regNo", width: 20 },
      { header: "Student Name", key: "name", width: 30 },
      { header: "Test (60)", key: "test", width: 15 },
      { header: "Assignment (20)", key: "assign", width: 15 },
      { header: "Attendance (20)", key: "attend", width: 15 },
      { header: "Total (100)", key: "total", width: 15 },
    ];

    // Add rows
    students.forEach((s, idx) => {
      const rawTest = s.marks[`${selectedExam}_test`];
      const rawAssign = s.marks[`${selectedExam}_assignment`];
      const rawAttend = s.marks[`${selectedExam}_attendance`];

      const isAbs = rawTest === -1 || rawAssign === -1 || rawAttend === -1;

      const test = parseFloat(rawTest === -1 || rawTest === null ? 0 : rawTest);
      const assign = parseFloat(
        rawAssign === -1 || rawAssign === null ? 0 : rawAssign,
      );
      const attend = parseFloat(
        rawAttend === -1 || rawAttend === null ? 0 : rawAttend,
      );
      const total = test + assign + attend;

      worksheet.addRow({
        sno: idx + 1,
        regNo: s.rollNo, // Primary Academic ID
        name: s.name,
        test: rawTest === -1 ? "ABSENT" : test,
        assign: rawAssign === -1 ? "ABSENT" : assign,
        attend: rawAttend === -1 ? "ABSENT" : attend,
        total: isAbs ? "ABSENT" : total,
      });
    });

    // Generate filename
    const filename = `${assignment.subject.code}_${examName}_${assignment.section}_Marks.xlsx`;

    // Write to buffer and save
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, filename);
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] p-6">
      <div className="mb-8 animate-fadeIn">
        <h1 className="text-3xl font-black text-[#003B73] mb-2 tracking-tight">
          Enter Marks
        </h1>
        <p className="text-gray-500 font-medium">
          Manage student assessments and CIA marks
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 mb-6 animate-fadeIn delay-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Subject & Section
            </label>
            <CustomSelect
              className="w-full font-semibold "
              value={selectedAssignmentId}
              onChange={(e) => setSelectedAssignmentId(e.target.value)}
            >
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.subject.name} ({a.subject.code}) - Sec {a.section}
                </option>
              ))}
            </CustomSelect>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Exam
            </label>
            <CustomSelect
              className="w-full font-semibold "
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
            >
              <option value="cia1">CIA - I</option>
              <option value="cia2">CIA - II</option>
              <option value="cia3">CIA - III</option>
            </CustomSelect>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSearch}
              className="w-full bg-[#003B73] hover:bg-[#002850] text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg"
            >
              <Search size={18} />
              Load Students
            </button>
          </div>
        </div>

        {isLocked && (
          <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-start gap-3">
            <Lock className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-red-800">
                {selectedExam.toUpperCase().replace("CIA", "CIA-")} Marks Locked
                by Admin
              </p>
              <p className="text-sm text-red-600 mt-1">
                These marks have been locked and cannot be edited. Contact admin
                to unlock.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Marks Table */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-fadeIn delay-200">
        <div className="p-6 bg-[#003B73] text-white">
          <h2 className="text-2xl font-bold">
            {selectedExam.toUpperCase().replace("CIA", "CIA-")} Marks Entry
          </h2>
          <p className="text-blue-100 mt-1 font-medium">
            {students.length} students • Test (60) + Assignment (20) +
            Attendance (20) = Total (100)
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#003B73] mx-auto mb-4"></div>
              <p className="text-gray-600">Loading students...</p>
            </div>
          </div>
        ) : students.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="p-4 text-left font-bold text-gray-700 w-16">
                      S.No
                    </th>
                    <th className="p-4 text-left font-bold text-gray-700">
                      Roll Number
                    </th>
                    <th className="p-4 text-left font-bold text-gray-700">
                      Reg No
                    </th>
                    <th className="p-4 text-left font-bold text-gray-700">
                      Student Name
                    </th>
                    <th className="p-4 text-center font-bold text-gray-700 bg-blue-50 w-32">
                      Test
                      <br />
                      <span className="text-xs font-normal">(60)</span>
                    </th>
                    <th className="p-4 text-center font-bold text-gray-700 bg-blue-50 w-32">
                      Assignment
                      <br />
                      <span className="text-xs font-normal">(20)</span>
                    </th>
                    <th className="p-4 text-center font-bold text-gray-700 bg-blue-50 w-32">
                      Attendance
                      <br />
                      <span className="text-xs font-normal">(20)</span>
                    </th>
                    <th className="p-4 text-center font-bold text-gray-700 bg-blue-50 w-24">
                      Total
                      <br />
                      <span className="text-xs font-normal">(100)</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {students.map((s, idx) => {
                    const isAbsent = (val) =>
                      val === -1 || val === "-1" || parseFloat(val) === -1;
                    const cleanMark = (val) =>
                      isAbsent(val) || val === null || val === undefined
                        ? 0
                        : parseFloat(val);
                    const rawTest = s.marks[`${selectedExam}_test`];
                    const rawAssign = s.marks[`${selectedExam}_assignment`];
                    const rawAttend = s.marks[`${selectedExam}_attendance`];
                    const test = cleanMark(rawTest);
                    const assign = cleanMark(rawAssign);
                    const attend = cleanMark(rawAttend);
                    const total = test + assign + attend;
                    // Show AB if ANY field is absent
                    const anyAbsent = isAbsent(rawTest) || isAbsent(rawAssign) || isAbsent(rawAttend);

                    return (
                      <tr
                        key={s.studentId}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="p-4 text-gray-600 font-mono">
                          {idx + 1}
                        </td>
                        <td className="p-4 font-mono text-[#003B73] font-bold uppercase">
                          {s.rollNo}
                        </td>
                        <td className="p-4 font-mono text-gray-500 text-sm italic">
                          {s.registerNumber || "-"}
                        </td>
                        <td className="p-4 font-semibold text-gray-800">
                          {s.name}
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            className={`w-full p-2 border-2 rounded-lg text-center font-semibold transition-all ${isLocked
                                ? "bg-gray-100 border-gray-300 cursor-not-allowed"
                                : s.marks[`${selectedExam}_test`] === -1
                                  ? "bg-red-50 border-red-200 text-red-600"
                                  : "border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              }`}
                            value={
                              s.marks[`${selectedExam}_test`] === -1
                                ? "-1"
                                : (s.marks[`${selectedExam}_test`] ?? "")
                            }
                            onChange={(e) =>
                              handleInputChange(
                                s.studentId,
                                "test",
                                e.target.value,
                              )
                            }
                            placeholder="Enter -1 for Absent"
                            disabled={isLocked}
                            min="-1"
                            max="60"
                            step="0.5"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            className={`w-full p-2 border-2 rounded-lg text-center font-semibold transition-all ${isLocked
                                ? "bg-gray-100 border-gray-300 cursor-not-allowed"
                                : s.marks[`${selectedExam}_assignment`] === -1
                                  ? "bg-red-50 border-red-200 text-red-600"
                                  : "border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              }`}
                            value={
                              s.marks[`${selectedExam}_assignment`] === -1
                                ? "-1"
                                : (s.marks[`${selectedExam}_assignment`] ?? "")
                            }
                            onChange={(e) =>
                              handleInputChange(
                                s.studentId,
                                "assignment",
                                e.target.value,
                              )
                            }
                            placeholder="0-20"
                            disabled={isLocked}
                            min="-1"
                            max="20"
                            step="0.5"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            className={`w-full p-2 border-2 rounded-lg text-center font-semibold transition-all ${isLocked
                                ? "bg-gray-100 border-gray-300 cursor-not-allowed"
                                : s.marks[`${selectedExam}_attendance`] === -1
                                  ? "bg-red-50 border-red-200 text-red-600"
                                  : "border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              }`}
                            value={
                              s.marks[`${selectedExam}_attendance`] === -1
                                ? "-1"
                                : (s.marks[`${selectedExam}_attendance`] ?? "")
                            }
                            onChange={(e) =>
                              handleInputChange(
                                s.studentId,
                                "attendance",
                                e.target.value,
                              )
                            }
                            placeholder="0-20"
                            disabled={isLocked}
                            min="0"
                            max="20"
                            step="0.5"
                          />
                        </td>
                        <td className="p-4 text-center">
                          {anyAbsent ? (
                            <span className="text-sm font-black text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-100 uppercase tracking-widest">
                              AB
                            </span>
                          ) : (
                            <span className="text-xl font-bold text-[#003B73]">
                              {total.toFixed(1)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer Actions */}
            <div className="p-6 bg-gray-50 border-t-2 border-gray-200 flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Showing <span className="font-semibold">{students.length}</span>{" "}
                students
              </p>
              <div className="flex gap-3">
                <button
                  onClick={exportToExcel}
                  className="btn bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-2 border-emerald-200 flex items-center gap-2"
                >
                  <Download size={18} />
                  Export to Excel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || isLocked}
                  className={`btn flex items-center gap-2 ${isLocked
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "btn-primary"
                    }`}
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      Save Marks
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-20 text-center">
            <AlertCircle className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-600 text-lg">
              Select filters and click "Load Students" to begin
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnterMarks;
