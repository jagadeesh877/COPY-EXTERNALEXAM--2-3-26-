import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import { ClipboardList, Send, AlertCircle, CheckCircle2, ChevronLeft } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const ExternalMarkEntry = () => {
    const { assignmentId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [marks, setMarks] = useState({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchMarks();
    }, [assignmentId]);

    const fetchMarks = async () => {
        try {
            const res = await api.get(`/external/marks/assignment/${assignmentId}`);
            setData(res.data);
            const initialMarks = {};
            res.data.dummyList.forEach(item => {
                if (item.mark !== null) initialMarks[item.dummyNumber] = item.mark;
            });
            setMarks(initialMarks);
        } catch (err) {
            toast.error('Failed to load dummy numbers');
        } finally {
            setLoading(false);
        }
    };

    const handleMarkChange = (dummyNumber, value) => {
        if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
            setMarks(prev => ({ ...prev, [dummyNumber]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const marksArray = Object.entries(marks).map(([dummyNumber, rawMark]) => ({
                dummyNumber,
                rawMark: parseFloat(rawMark)
            }));
            await api.post('/external/marks/submit', {
                subjectId: data.subjectId,
                marks: marksArray
            });
            toast.success('Marks submitted successfully');
            fetchMarks();
        } catch (err) {
            toast.error('Failed to submit marks');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-screen bg-gray-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#003B73]"></div>
        </div>
    );

    return (
        <div className="flex h-screen bg-gray-50">
            <Sidebar role="EXTERNAL_STAFF" />
            <div className="flex-1 flex flex-col ml-64 transition-all duration-300">
                <Header title="Enter External Marks" />
                <main className="flex-1 p-10 mt-24 overflow-y-auto animate-fadeIn">
                    <button
                        onClick={() => navigate('/external')}
                        className="flex items-center gap-2 text-gray-400 hover:text-[#003B73] font-bold mb-8 transition-colors group"
                    >
                        <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
                    </button>

                    <div className="bg-white rounded-[32px] shadow-xl shadow-blue-900/5 overflow-hidden border border-gray-100 mb-10">
                        <div className="p-10 bg-[#003B73] text-white">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-blue-200 text-xs font-black uppercase tracking-[0.2em] mb-3">Assessment Entry</p>
                                    <h1 className="text-4xl font-black tracking-tight">{data.subject}</h1>
                                    <div className="mt-4 flex items-center gap-4">
                                        <span className="bg-white/10 px-4 py-1.5 rounded-full text-sm font-bold border border-white/20 uppercase">
                                            Subject Code: {data.subjectId}
                                        </span>
                                    </div>
                                </div>
                                <div className="bg-white/10 p-4 rounded-2xl border border-white/20 backdrop-blur-md text-center min-w-[140px]">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-200 mb-1">Submission Limit</p>
                                    <p className="text-xl font-black">{new Date(data.deadline).toLocaleDateString()}</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-10">
                            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 mb-10 flex items-start gap-4">
                                <AlertCircle className="text-blue-600 mt-1 shrink-0" size={24} />
                                <div>
                                    <p className="text-[#003B73] font-black text-lg">Identity Masking Active</p>
                                    <p className="text-blue-700/70 font-medium">You are entering marks for randomized dummy numbers. Student names and register numbers are hidden to ensure unbiased evaluation.</p>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar p-1">
                                    {data.dummyList.map((item) => (
                                        <div key={item.dummyNumber} className="flex items-center justify-between p-6 bg-gray-50/50 border border-gray-200 rounded-[24px] hover:border-blue-300 hover:bg-white transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-white rounded-2xl border border-gray-200 flex items-center justify-center font-black text-[#003B73] shadow-sm group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all">
                                                    #
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-gray-400 uppercase tracking-widest mb-0.5">Dummy ID</p>
                                                    <p className="text-xl font-black text-[#003B73]">{item.dummyNumber}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        step="0.5"
                                                        placeholder="0.0"
                                                        className="w-32 p-4 bg-white rounded-2xl border-2 border-transparent focus:border-blue-600 outline-none font-black text-center text-2xl text-[#003B73] shadow-inner transition-all"
                                                        value={marks[item.dummyNumber] || ''}
                                                        onChange={(e) => handleMarkChange(item.dummyNumber, e.target.value)}
                                                        required
                                                    />
                                                    {marks[item.dummyNumber] !== undefined && (
                                                        <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1 shadow-lg">
                                                            <CheckCircle2 size={16} />
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="font-black text-gray-300 text-lg">/ 100</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="pt-8 border-t border-gray-100 flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className={`px-10 py-5 rounded-[24px] font-black flex items-center justify-center gap-3 shadow-2xl shadow-blue-900/20 transition-all hover:scale-[1.02] active:scale-[0.98] text-lg ${submitting ? 'bg-gray-400 cursor-not-allowed text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                                    >
                                        {submitting ? (
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                                        ) : (
                                            <Send size={24} />
                                        )}
                                        {submitting ? 'Submitting...' : 'Finalize and Submit Marks'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default ExternalMarkEntry;
