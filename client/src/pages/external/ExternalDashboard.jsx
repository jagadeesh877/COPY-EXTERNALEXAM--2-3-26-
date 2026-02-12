import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import { Clock, ClipboardList, Shield } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const ExternalDashboard = () => {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchAssignments();
    }, []);

    const fetchAssignments = async () => {
        try {
            const res = await api.get('/external/assignments');
            setAssignments(res.data);
        } catch (err) {
            toast.error('Failed to fetch assigned mark entry assignments');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen bg-gray-50">
            <Sidebar role="EXTERNAL_STAFF" />
            <div className="flex-1 flex flex-col ml-64 transition-all duration-300">
                <Header title="External Staff Portal" />
                <main className="flex-1 p-10 mt-24 overflow-y-auto animate-fadeIn">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
                        <div>
                            <h1 className="text-4xl font-black text-[#003B73] tracking-tight">End Semester Mark Entry</h1>
                            <p className="text-gray-500 font-medium mt-1">Submit external marks for assigned subjects using dummy numbers.</p>
                        </div>
                        <div className="bg-blue-50 text-blue-700 px-5 py-3 rounded-2xl border border-blue-100 flex items-center gap-3 font-bold">
                            <Shield size={20} /> Identity Anonymity Enforced
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#003B73]"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {assignments.length > 0 ? (
                                assignments.map((assignment) => (
                                    <div key={assignment.id} className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all group">
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="p-4 rounded-2xl bg-[#003B73]/5 text-[#003B73] group-hover:bg-[#003B73] group-hover:text-white transition-all">
                                                <ClipboardList size={28} />
                                            </div>
                                        </div>
                                        <div className="mb-8">
                                            <h3 className="text-xl font-black text-[#003B73] mb-2">{assignment.subject?.name}</h3>
                                            <p className="text-sm text-gray-400 font-bold uppercase tracking-wider">{assignment.subject?.code}</p>
                                        </div>

                                        <div className="space-y-4 mb-8">
                                            <div className="flex items-center gap-3 text-sm text-gray-500 font-medium">
                                                <Clock size={16} className="text-red-400" />
                                                <span>Deadline: {new Date(assignment.deadline).toLocaleDateString()}</span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => navigate(`/external/marks/${assignment.id}`)}
                                            className="w-full bg-[#003B73] text-white px-6 py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-[#002850] transition-all font-black shadow-lg shadow-blue-900/10"
                                        >
                                            <ClipboardList size={20} /> Enter Marks
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full bg-white p-20 rounded-[40px] text-center border-2 border-dashed border-gray-100">
                                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <ClipboardList size={40} className="text-gray-200" />
                                    </div>
                                    <h3 className="text-xl font-black text-gray-400 mb-2">No Assignments Found</h3>
                                    <p className="text-gray-400 font-medium">You haven't been assigned any mark entry tasks yet.</p>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default ExternalDashboard;
