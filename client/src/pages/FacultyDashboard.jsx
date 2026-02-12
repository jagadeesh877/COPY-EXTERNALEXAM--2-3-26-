import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import FacultyHome from './faculty/FacultyHome';
import EnterMarks from './faculty/EnterMarks';
import FacultyTimetable from './faculty/FacultyTimetable';
import AttendanceManager from './faculty/AttendanceManager';
import MyClasses from './faculty/MyClasses';
import ClassDetails from './faculty/ClassDetails';
import PublishedResults from './faculty/PublishedResults';
import Announcements from './Announcements';
import Materials from './Materials';
import Settings from './Settings';
import { useContext, useEffect, useState } from 'react';
import api from '../api/axios';
import AuthContext from '../context/AuthProvider';

const FacultyDashboard = () => {
    const { auth } = useContext(AuthContext);
    const [assignedSubjects, setAssignedSubjects] = useState([]);

    useEffect(() => {
        const fetchSubjects = async () => {
            try {
                const res = await api.get('/faculty/assignments');
                setAssignedSubjects(res.data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchSubjects();
    }, []);

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar */}
            <Sidebar role="FACULTY" />

            {/* Main Content */}
            <div className="flex-1 flex flex-col ml-64 transition-all duration-300">
                <Header title="Faculty Portal" />

                <main className="flex-1 p-8 mt-24 overflow-y-auto animate-fadeIn">
                    <Routes>
                        <Route path="/" element={<FacultyHome assignedSubjects={assignedSubjects} />} />
                        <Route path="/marks" element={<EnterMarks />} />
                        <Route path="/results" element={<PublishedResults />} />
                        <Route path="/timetable" element={<FacultyTimetable />} />
                        <Route path="/attendance" element={<AttendanceManager />} />
                        <Route path="/classes" element={<MyClasses />} />
                        <Route path="/class/:subjectId" element={<ClassDetails />} />
                        <Route path="/announcements" element={<Announcements role="FACULTY" />} />
                        <Route path="/materials" element={<Materials role="FACULTY" />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="*" element={<Navigate to="/faculty" replace />} />
                    </Routes>
                </main>
            </div>
        </div>
    );
};

export default FacultyDashboard;
