import CustomSelect from "../../components/CustomSelect";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { BookOpen, UserPlus, CheckCircle, Trash2, Plus, X } from "lucide-react";

const SubjectManager = () => {
  const navigate = useNavigate();
  const [subjectList, setSubjectList] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [newSubject, setNewSubject] = useState({
    code: "",
    name: "",
    shortName: "",
    departments: [],
    semester: "",
    type: "DEPARTMENT",
  });
  const [departments, setDepartments] = useState([]);

  // UI States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDept, setFilterDept] = useState("");

  useEffect(() => {
    if (
      filterDept &&
      newSubject.type === "DEPARTMENT" &&
      filterDept !== "COMMON"
    ) {
      setNewSubject((prev) => ({ ...prev, departments: [filterDept] }));
    }
  }, [filterDept]);

  // Assignment Mode
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [assignFacultyId, setAssignFacultyId] = useState("");
  const [assignSection, setAssignSection] = useState("A");
  const [assignDept, setAssignDept] = useState("");

  useEffect(() => {
    refreshSubjects();
    refreshFaculty();
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await api.get("/admin/departments");
      setDepartments(res.data);
    } catch (err) {
      console.error("Failed to fetch departments");
    }
  };

  const refreshSubjects = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/subjects");
      setSubjectList(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const refreshFaculty = async () => {
    try {
      const res = await api.get("/admin/faculty");
      setFacultyList(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateSubject = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...newSubject };
      if (payload.type === "DEPARTMENT") {
        if (payload.departments.length === 0) {
          return alert("Please select at least one department");
        }
        payload.department = payload.departments.join(",");
      } else {
        payload.department = "";
      }

      await api.post("/admin/subjects", payload);
      setNewSubject({
        code: "",
        name: "",
        shortName: "",
        departments: [],
        semester: "",
        type: "DEPARTMENT",
      });
      setShowCreateModal(false);
      refreshSubjects();
      alert("Subject Created");
    } catch (err) {
      alert(
        "Error creating subject: " +
        (err.response?.data?.message || err.message),
      );
    }
  };

  const handleAssignFaculty = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/assign-faculty", {
        facultyId: assignFacultyId,
        subjectId: selectedSubjectId,
        section: assignSection,
        department: assignDept,
      });
      alert("Faculty Assigned Successfully");
      setSelectedSubjectId(null);
      setAssignDept("");
      refreshSubjects();
    } catch (err) {
      alert("Error assigning faculty");
    }
  };

  const handleRemoveAssignment = async (assignmentId) => {
    if (!confirm("Remove this faculty assignment?")) return;
    try {
      await api.delete(`/admin/assign-faculty/${assignmentId}`);
      refreshSubjects();
    } catch (err) {
      alert("Error removing assignment");
    }
  };

  const handleDeleteSubject = async (id) => {
    if (
      !confirm(
        "Are you sure you want to delete this course? This will remove all related marks and assignments.",
      )
    )
      return;
    try {
      await api.delete(`/admin/subjects/${id}`);
      refreshSubjects();
    } catch (err) {
      alert("Failed to delete subject");
    }
  };

  const filteredSubjects = (
    Array.isArray(subjectList) ? subjectList : []
  ).filter((s) => {
    const name = s?.name ? s.name.toLowerCase() : "";
    const code = s?.code ? s.code.toLowerCase() : "";
    const search = searchTerm.toLowerCase();

    const matchesSearch = name.includes(search) || code.includes(search);

    // Handle comma-separated departments
    let matchesDept = true;
    if (filterDept === "COMMON") {
      matchesDept = s?.type === "COMMON";
    } else if (filterDept) {
      const subjectDepts = s?.department ? s.department.split(",") : [];
      matchesDept = subjectDepts.includes(filterDept);
    }

    return matchesSearch && matchesDept;
  });

  return (
    <div className="flex flex-col animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
        <div>
          <h1 className="text-4xl font-black text-[#003B73] tracking-tight">
            Subject Management
          </h1>
          <p className="text-gray-500 font-medium mt-1">
            Configure academic curriculum and faculty workload.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-8 py-4 bg-[#003B73] text-white rounded-[24px] font-black hover:bg-[#002850] shadow-xl shadow-blue-900/10 transition-all flex items-center gap-2 transform active:scale-95"
        >
          <Plus size={22} strokeWidth={3} /> Add New Subject
        </button>
      </div>

      <div className="bg-white p-10 rounded-[40px] shadow-xl border border-gray-100 min-h-[650px] transition-all relative">
        {/* Search & Filter Top Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-6 relative z-30">
          <div className="relative w-full sm:w-96 group">
            <input
              type="text"
              placeholder="Search by code or name..."
              className="w-full pl-6 pr-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-[24px] font-bold text-gray-800 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex gap-4 w-full sm:w-auto">
            <CustomSelect
              className="px-4 py-2 flex-1 sm:flex-none sm:min-w-[200px]"
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
            >
              <option value="">All Departments</option>
              <option value="COMMON">
                {(() => {
                  const fyDept = departments.find(d => d.name?.toLowerCase() === "first year");
                  return fyDept ? `${fyDept.code || 'GEN'} (1st Year Common)` : 'GEN (1st Year Common)';
                })()}
              </option>
              {(Array.isArray(departments) ? departments : [])
                .filter(d => d.name?.toLowerCase() !== "first year")
                .map((d) => (
                  <option key={d.id} value={d.code || d.name}>
                    {d.code || d.name}
                  </option>
                ))}
            </CustomSelect>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-48">
            <div className="w-12 h-12 border-4 border-gray-100 border-t-[#003B73] rounded-full animate-spin mb-4"></div>
            <p className="font-black text-gray-400 uppercase tracking-widest text-xs">
              Syncing Curriculum...
            </p>
          </div>
        ) : (
          <div className="bg-gray-50/30 rounded-3xl border border-gray-100 relative z-10">
            <table className="w-full text-center border-collapse">
              <thead className="bg-gray-100/50 text-[#003B73] text-[10px] font-black uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-8 py-6 text-left">Academic Info</th>
                  <th className="px-8 py-6 text-left">Faculty Assignments</th>
                  <th className="px-8 py-6 text-right">Settings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/50">
                {filteredSubjects.map((sub) => (
                  <tr
                    key={sub.id}
                    className="group hover:bg-white transition-all duration-300"
                  >
                    <td className="px-8 py-6 text-left">
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-14 flex-shrink-0 bg-white rounded-2xl flex flex-col items-center justify-center font-black shadow-sm border border-gray-100 group-hover:scale-110 transition-all duration-500">
                          <span className="text-[#003B73] text-sm leading-none">
                            {sub.code}
                          </span>
                        </div>
                        <div>
                          <div className="font-extrabold text-gray-800 text-lg group-hover:text-[#003B73] transition-colors">
                            {sub.name}
                          </div>
                          <div className="flex gap-2 mt-1">
                            {sub.type === "COMMON" ? (
                              <span className="px-3 py-1 bg-purple-50 text-purple-600 rounded-lg font-black text-[9px] uppercase tracking-widest border border-purple-100">
                                Common • Sem {sub.semester}
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {(sub.department
                                  ? sub.department.split(",")
                                  : []
                                ).map((dept) => (
                                  <span
                                    key={dept}
                                    className="px-3 py-1 bg-blue-50 text-[#003B73] rounded-lg font-black text-[9px] uppercase tracking-widest border border-blue-100"
                                  >
                                    {dept}
                                  </span>
                                ))}
                                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg font-black text-[9px] uppercase tracking-widest border border-emerald-100">
                                  Sem {sub.semester}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-left">
                      {sub.assignments?.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {sub.assignments.map((a, i) => (
                            <div
                              key={i}
                              className="flex flex-col gap-1 bg-white px-4 py-3 rounded-2xl border border-gray-100 shadow-sm group/tag hover:border-[#003B73] transition-all"
                            >
                              <div className="flex items-center gap-2 border-b border-gray-50 pb-2 mb-1">
                                <span className="text-[10px] font-black text-[#003B73] uppercase tracking-tighter">
                                  Sec {a.section}
                                </span>
                                {a.department && (
                                  <>
                                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                    <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md uppercase">
                                      {a.department}
                                    </span>
                                  </>
                                )}
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs font-bold text-gray-600 truncate max-w-[120px]">
                                  {a.facultyName}
                                </span>
                                <button
                                  onClick={() => handleRemoveAssignment(a.id)}
                                  className="text-gray-300 hover:text-red-500 transition-colors"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest italic flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-gray-200 animate-pulse"></div>
                          No Assignments
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                        <button
                          onClick={() => setSelectedSubjectId(sub.id)}
                          className="p-3 bg-blue-50 text-blue-600 rounded-2xl hover:bg-[#003B73] hover:text-white transition-all shadow-sm"
                          title="Assign Faculty"
                        >
                          <UserPlus size={18} />
                        </button>
                        <button
                          onClick={() => navigate(`/admin/marks/${sub.id}`)}
                          className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                          title="View Marks"
                        >
                          <CheckCircle size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteSubject(sub.id)}
                          className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all shadow-sm"
                          title="Delete Subject"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredSubjects.length === 0 && (
                  <tr>
                    <td
                      colSpan="3"
                      className="py-32 text-center text-gray-400 italic"
                    >
                      <BookOpen
                        size={64}
                        className="mx-auto mb-4 text-gray-100"
                      />
                      <p className="font-black text-xl uppercase tracking-widest">
                        No Subjects Found
                      </p>
                      <p className="font-bold mt-1 text-sm">
                        Refine your search or add a new course.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Subject Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-[#003B73]/20 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-fadeIn">
          <div className="bg-white rounded-[48px] p-10 w-full max-w-xl shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center mb-10">
              <div>
                <h3 className="text-3xl font-black text-[#003B73] tracking-tight">
                  New Subject
                </h3>
                <p className="text-gray-500 font-bold text-sm mt-1">
                  Define a new course for the curriculum.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-4 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-3xl transition-all"
              >
                <X size={32} />
              </button>
            </div>

            <form onSubmit={handleCreateSubject} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-1">
                    Subject Code
                  </label>
                  <input
                    className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-3xl font-bold text-gray-800 outline-none transition-all font-mono"
                    placeholder="e.g. CS101"
                    value={newSubject.code}
                    onChange={(e) =>
                      setNewSubject({ ...newSubject, code: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-1">
                    Subject Name
                  </label>
                  <input
                    className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-3xl font-bold text-gray-800 outline-none transition-all"
                    placeholder="e.g. Data Structures"
                    value={newSubject.name}
                    onChange={(e) =>
                      setNewSubject({ ...newSubject, name: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-1">
                  Short Name (For Timetable)
                </label>
                <input
                  className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-[#003B73] rounded-3xl font-bold text-gray-800 outline-none transition-all uppercase"
                  placeholder="e.g. DS"
                  value={newSubject.shortName}
                  onChange={(e) =>
                    setNewSubject({ ...newSubject, shortName: e.target.value })
                  }
                />
              </div>

              <div className="p-6 bg-gray-50 rounded-[32px] border border-gray-100">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-4 px-1">
                  Classification
                </label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() =>
                      setNewSubject({
                        ...newSubject,
                        type: "DEPARTMENT",
                        departments: [],
                      })
                    }
                    className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase transition-all ${newSubject.type === "DEPARTMENT" ? "bg-[#003B73] text-white shadow-lg" : "bg-white text-gray-400 border border-gray-100"}`}
                  >
                    Department Specific
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setNewSubject({
                        ...newSubject,
                        type: "COMMON",
                        departments: [],
                        semester: "1",
                      })
                    }
                    className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase transition-all ${newSubject.type === "COMMON" ? "bg-purple-600 text-white shadow-lg" : "bg-white text-gray-400 border border-gray-100"}`}
                  >
                    Common (1st Year)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-1">
                    Semester
                  </label>
                  <CustomSelect
                    className="w-full"
                    value={newSubject.semester}
                    onChange={(e) =>
                      setNewSubject({ ...newSubject, semester: e.target.value })
                    }
                    required
                  >
                    <option value="">Select Sem</option>
                    {newSubject.type === "COMMON"
                      ? [1, 2].map((s) => (
                        <option key={s} value={s}>
                          Semester {s}
                        </option>
                      ))
                      : [3, 4, 5, 6, 7, 8].map((s) => (
                        <option key={s} value={s}>
                          Semester {s}
                        </option>
                      ))}
                  </CustomSelect>
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-1">
                    {newSubject.type === "COMMON"
                      ? "Target Department"
                      : "Target Departments (Multi-Select)"}
                  </label>

                  {newSubject.type === "COMMON" ? (
                    <div className="w-full px-6 py-5 bg-gray-100 rounded-3xl font-black text-gray-400 cursor-not-allowed">
                      All (Common Pool)
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 p-2 bg-gray-50 border-2 border-transparent focus-within:border-[#003B73] rounded-3xl min-h-[64px] transition-all">
                      {(Array.isArray(departments) ? departments : [])
                        .filter(d => d.name?.toLowerCase() !== "first year")
                        .map(
                          (d) => {
                            const deptCode = d.code || d.name;
                            const isSelected =
                              newSubject.departments.includes(deptCode);

                            return (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => {
                                  setNewSubject((prev) => ({
                                    ...prev,
                                    departments: isSelected
                                      ? prev.departments.filter(
                                        (code) => code !== deptCode,
                                      )
                                      : [...prev.departments, deptCode],
                                  }));
                                }}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${isSelected
                                  ? "bg-[#003B73] text-white shadow-md scale-105"
                                  : "bg-white text-gray-500 border border-gray-200 hover:border-[#003B73]/50"
                                  }`}
                              >
                                {deptCode}
                              </button>
                            );
                          },
                        )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-[24px] font-black transition-all transform active:scale-95"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  className="flex-1 py-5 bg-[#003B73] text-white rounded-[24px] font-black hover:bg-[#002850] shadow-xl shadow-blue-900/10 transition-all transform active:scale-95"
                >
                  Confirm Creation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {selectedSubjectId && (
        <div className="fixed inset-0 bg-[#003B73]/20 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-fadeIn">
          <div className="bg-white rounded-[48px] p-10 w-full max-w-xl shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center mb-10">
              <div>
                <h3 className="text-3xl font-black text-[#003B73] tracking-tight">
                  Assign Faculty
                </h3>
                <p className="text-gray-500 font-bold text-sm mt-1">
                  Allocate teaching workload for{" "}
                  {subjectList.find((s) => s.id === selectedSubjectId)?.name}
                </p>
              </div>
              <button
                onClick={() => setSelectedSubjectId(null)}
                className="p-4 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-3xl transition-all"
              >
                <X size={32} />
              </button>
            </div>

            <form onSubmit={handleAssignFaculty} className="space-y-8">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-1">
                  Select Professor
                </label>
                <CustomSelect
                  className="w-full"
                  value={assignFacultyId}
                  onChange={(e) => setAssignFacultyId(e.target.value)}
                  required
                >
                  <option value="">-- Search Faculty Database --</option>
                  {(Array.isArray(facultyList) ? facultyList : []).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.fullName} ({f.department})
                    </option>
                  ))}
                </CustomSelect>
              </div>

              {selectedSubjectId && (
                <div className="p-6 bg-blue-50/50 rounded-[32px] border border-blue-100">
                  <label className="block text-xs font-black text-blue-400 uppercase tracking-widest mb-4 px-1">
                    Target Department
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {(Array.isArray(departments) ? departments : [])
                      .filter((d) => d.name?.toLowerCase() !== "first year")
                      .map((d) => {
                        const deptCode = d.code || d.name;
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => setAssignDept(deptCode)}
                            className={`px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all ${assignDept === deptCode ? "bg-[#003B73] text-white shadow-lg scale-105" : "bg-white text-gray-400 border border-gray-100 hover:border-[#003B73]/30"}`}
                          >
                            {deptCode}
                          </button>
                        )
                      })}
                  </div>
                </div>
              )}

              <div className="p-6 bg-gray-50 rounded-[32px] border border-gray-100">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-4 px-1">
                  Target Section
                </label>
                <div className="flex flex-wrap gap-3">
                  {["A", "B", "C", "D"].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setAssignSection(s)}
                      className={`w-14 h-14 rounded-2xl font-black text-lg transition-all ${assignSection === s ? "bg-[#003B73] text-white shadow-lg scale-110" : "bg-white text-gray-400 border border-gray-100 hover:border-[#003B73]/30"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedSubjectId(null)}
                  className="flex-1 py-5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-[24px] font-black transition-all transform active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-5 bg-[#003B73] text-white rounded-[24px] font-black hover:bg-[#002850] shadow-xl shadow-blue-900/10 transition-all transform active:scale-95"
                >
                  Save Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubjectManager;
