import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import ExternalDashboard from './pages/external/ExternalDashboard';
import ExternalMarkEntry from './pages/external/ExternalMarkEntry';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
    return (
        <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/unauthorized" element={<div className="p-8">Unauthorized Access</div>} />

            {/* Admin Routes */}
            <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                <Route path="/admin/*" element={<AdminDashboard />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['FACULTY']} />}>
                <Route path="/faculty/*" element={<FacultyDashboard />} />
            </Route>

            {/* External Staff Routes */}
            <Route element={<ProtectedRoute allowedRoles={['EXTERNAL_STAFF']} />}>
                <Route path="/external" element={<ExternalDashboard />} />
                <Route path="/external/marks/:assignmentId" element={<ExternalMarkEntry />} />
            </Route>
        </Routes>
    );
}

export default App;
