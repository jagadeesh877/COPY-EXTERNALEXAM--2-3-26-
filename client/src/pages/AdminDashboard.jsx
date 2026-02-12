import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import AdminHome from './admin/AdminHome';
import FacultyManager from './admin/FacultyManager';
import SubjectManager from './admin/SubjectManager';
import CourseManager from './admin/CourseManager';
import StudentManager from './admin/StudentManager';
import StudentPromotion from './admin/StudentPromotion';
import AdminMarksManager from './admin/AdminMarksManager';
import AdminMarksApproval from './admin/AdminMarksApproval';
import TimetableManager from './admin/TimetableManager';
import DepartmentManager from './admin/DepartmentManager';
import AttendanceReports from './admin/AttendanceReports';
import ExamControlCenter from './admin/ExamControlCenter';
import EndSemMarksEntry from './admin/EndSemMarksEntry';
import ExternalStaffManager from './admin/ExternalStaffManager';
import DummyNumberManager from './admin/DummyNumberManager';
import Announcements from './Announcements';
import Settings from './Settings';

const AdminDashboard = () => {
    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar (Fixed width) */}
            <Sidebar role="ADMIN" />

            {/* Main Content (Offset by Sidebar width) */}
            <div className="flex-1 flex flex-col ml-64 transition-all duration-300">
                <Header title="College ERP" />

                <main className="flex-1 p-8 mt-24 overflow-y-auto animate-fadeIn">
                    <Routes>
                        <Route path="/" element={<AdminHome />} />
                        <Route path="faculty" element={<FacultyManager />} />
                        <Route path="subjects" element={<SubjectManager />} />
                        <Route path="departments" element={<DepartmentManager />} />
                        <Route path="courses" element={<CourseManager />} />
                        <Route path="students" element={<StudentManager />} />
                        <Route path="students/promote" element={<StudentPromotion />} />
                        <Route path="timetable" element={<TimetableManager />} />
                        <Route path="marks/:subjectId" element={<AdminMarksManager />} />
                        <Route path="marks-approval" element={<AdminMarksApproval />} />
                        <Route path="exams" element={<ExamControlCenter />} />
                        <Route path="dummy-mapping" element={<DummyNumberManager />} />
                        <Route path="end-sem-marks" element={<EndSemMarksEntry />} />
                        <Route path="external" element={<ExternalStaffManager />} />
                        <Route path="announcements" element={<Announcements role="ADMIN" />} />
                        <Route path="attendance" element={<AttendanceReports />} />
                        <Route path="settings" element={<Settings />} />
                        {/* Fallback */}
                        <Route path="*" element={<Navigate to="/admin" replace />} />
                    </Routes>
                </main>
            </div>
        </div>
    );
};

export default AdminDashboard;
