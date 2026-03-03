import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Users, BookOpen, Calendar, ClipboardList, TrendingUp,
    Book, Bell, FileText, GraduationCap, Building2, Award, CheckCircle, UserCheck, Layout,
    Settings as SettingsIcon, ChevronDown, ChevronRight, Send
} from 'lucide-react';

const Sidebar = ({ role, activePath }) => {
    const location = useLocation();
    const currentPath = activePath || location.pathname;
    const [expandedGroup, setExpandedGroup] = useState(null);

    const adminMenu = [
        { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
        {
            label: 'Academics',
            icon: GraduationCap,
            isGroup: true,
            children: [
                { label: 'Students', path: '/admin/students', icon: Users },
                { label: 'Student Promotion', path: '/admin/students/promote', icon: TrendingUp },
                { label: 'Departments', path: '/admin/departments', icon: Building2 },
                { label: 'Subjects', path: '/admin/subjects', icon: BookOpen },
                { label: 'Faculty', path: '/admin/faculty', icon: GraduationCap },
            ]
        },
        {
            label: 'Schedule',
            icon: Calendar,
            isGroup: true,
            children: [
                { label: 'Timetable', path: '/admin/timetable', icon: Calendar },
                { label: 'Attendance', path: '/admin/attendance', icon: FileText },
            ]
        },
        {
            label: 'Examination Control',
            icon: ClipboardList,
            isGroup: true,
            children: [
                { label: 'Marks Approval', path: '/admin/marks-approval', icon: CheckCircle },
                { label: 'Exams & Results', path: '/admin/exams', icon: Award },
                { label: 'Arrear Management', path: '/admin/arrears/manage', icon: ClipboardList },
                { label: 'End Sem Marks', path: '/admin/end-sem-marks', icon: Award },
                { label: 'Dummy Mapping', path: '/admin/dummy-mapping', icon: Book },
                { label: 'External Staff', path: '/admin/external', icon: Users },
                { label: 'Hall Allocation', path: '/admin/hall-allocation', icon: Layout },
                { label: 'Dispatch', path: '/admin/dispatch', icon: Send },
            ]
        },
        {
            label: 'System',
            icon: SettingsIcon,
            isGroup: true,
            children: [
                { label: 'Settings', path: '/admin/settings', icon: SettingsIcon },
            ]
        },
    ];

    const facultyMenu = [
        { label: 'Dashboard', path: '/faculty', icon: LayoutDashboard },
        { label: 'My Timetable', path: '/faculty/timetable', icon: Calendar },
        { label: 'Attendance', path: '/faculty/attendance', icon: UserCheck },
        { label: 'Enter CIA Marks', path: '/faculty/marks', icon: Award },
        { label: 'View Results', path: '/faculty/results', icon: CheckCircle },
        { label: 'My Classes', path: '/faculty/classes', icon: Users },
        { label: 'Materials', path: '/faculty/materials', icon: Book },
        { label: 'Announcements', path: '/faculty/announcements', icon: Bell },
        { label: 'Settings', path: '/faculty/settings', icon: SettingsIcon },
    ];

    const externalStaffMenu = [
        { label: 'Dashboard', path: '/external', icon: LayoutDashboard },
        { label: 'Settings', path: '/external/settings', icon: SettingsIcon },
    ];

    const menu = role === 'ADMIN' ? adminMenu : (role === 'FACULTY' ? facultyMenu : externalStaffMenu);

    // Auto-expand group containing active route
    useEffect(() => {
        if (role === 'ADMIN') {
            adminMenu.forEach(item => {
                if (item.isGroup) {
                    const hasActiveChild = item.children.some(child =>
                        currentPath === child.path || currentPath.startsWith(child.path + '/')
                    );
                    if (hasActiveChild) {
                        setExpandedGroup(item.label);
                    }
                }
            });
        }
    }, [currentPath, role]);

    const toggleGroup = (label) => {
        setExpandedGroup(expandedGroup === label ? null : label);
    };

    const renderMenuItem = (item, idx, isChild = false) => {
        const Icon = item.icon;
        const isActive = currentPath === item.path || currentPath.startsWith(item.path + '/');

        if (item.isGroup) {
            const isExpanded = expandedGroup === item.label;
            const hasActiveChild = item.children.some(child =>
                currentPath === child.path || currentPath.startsWith(child.path + '/')
            );

            return (
                <li key={idx} className="space-y-1">
                    <button
                        onClick={() => toggleGroup(item.label)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 group
                            ${hasActiveChild && !isExpanded
                                ? 'bg-white/10 text-white'
                                : 'text-blue-100 hover:bg-[#0F2C59] hover:text-white'
                            }`}
                    >
                        <div className="flex items-center">
                            <Icon className={`w-5 h-5 mr-3 transition-transform duration-300 group-hover:scale-110`} />
                            {item.label}
                        </div>
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                        <ul className="mt-1 ml-4 space-y-1 border-l border-blue-800/50 pl-2">
                            {item.children.map((child, cIdx) => renderMenuItem(child, `${idx}-${cIdx}`, true))}
                        </ul>
                    </div>
                </li>
            );
        }

        return (
            <li key={idx} className="animate-fadeIn" style={{ animationDelay: `${idx * 50}ms` }}>
                <Link
                    to={item.path}
                    className={`flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 group relative overflow-hidden
                        ${isActive
                            ? 'bg-white text-[#003B73] shadow-lg'
                            : 'text-blue-100 hover:bg-[#0F2C59] hover:text-white'
                        } ${isChild ? 'py-2 px-3' : ''}`}
                >
                    <Icon className={`w-5 h-5 mr-3 transition-transform duration-300 ${isActive ? '' : 'group-hover:scale-110'
                        }`} />
                    {item.label}
                </Link>
            </li>
        );
    };

    return (
        <div className="w-64 bg-[#003B73] text-white min-h-screen flex flex-col shadow-2xl fixed left-0 top-0 bottom-0 z-50">
            {/* Logo Area */}
            <div className="h-24 flex items-center px-6 bg-[#002850] border-b border-blue-800/30">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white text-[#003B73] flex items-center justify-center shadow-lg font-bold text-xl">
                        M
                    </div>
                    <div>
                        <span className="text-xl font-black tracking-tight font-sans">MIET ERP</span>
                        <p className="text-[10px] text-blue-200 uppercase tracking-widest">
                            {role === 'ADMIN' ? 'Administrator' : (role === 'EXTERNAL_STAFF' ? 'External Staff' : 'Faculty')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Menu Items */}
            <div className="flex-1 overflow-y-auto py-6 px-3 custom-scrollbar">
                <ul className="space-y-1">
                    {menu.map((item, idx) => renderMenuItem(item, idx))}
                </ul>
            </div>

            {/* Footer */}
            <div className="p-4 bg-[#002850] border-t border-blue-800/30">
                <div className="text-xs text-blue-300 text-center space-y-1">
                    <p className="font-semibold">© 2026 MIET ERP</p>
                    <p className="text-blue-400">v2.0.0</p>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
