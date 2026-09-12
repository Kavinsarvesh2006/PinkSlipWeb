import React from 'react';
import { 
  ShieldCheck, 
  Sun, 
  Moon, 
  Zap, 
  BrainCircuit, 
  FileSpreadsheet, 
  Sparkles, 
  Download,
  LogOut,
  RefreshCw,
  UserCog,
  Lock,
  Building
} from 'lucide-react';
import { useAttendance } from '../../context/AttendanceContext';
import { useTheme } from '../../context/ThemeContext';
import { UserRole } from '../../types';

interface HeaderProps {
  onOpenJarvis?: () => void;
  onOpenExport?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenJarvis, onOpenExport, onLogout }) => {
  const { 
    currentUser, 
    currentUserRole, 
    setCurrentUserRole,
    setCurrentUserEmail,
    assignedSection,
    isHOD,
    isAdvisor,
    isStudent,
    triggerReconciliation430PM,
    isReconciliationTriggered,
    setIsNAACModalOpen,
    setIsStudentManagerOpen,
    isLiveLoading,
    refreshLiveData
  } = useAttendance();
  const { theme, toggleTheme } = useTheme();

  const handleRoleChange = (newRole: UserRole) => {
    setCurrentUserRole(newRole);
    if (newRole === 'hod1') {
      setCurrentUserEmail('manivannan.hod@vsb.ac.in');
    } else if (newRole === 'hod2') {
      setCurrentUserEmail('hod.kavitha@vsb.ac.in');
    } else if (newRole === 'advisor') {
      setCurrentUserEmail('advisor.2a@vsb.ac.in');
    } else {
      setCurrentUserEmail('25243028@student.smartcampus.edu');
    }
  };

  return (
    <header className="h-20 px-6 border-b border-slate-800/80 bg-[#0c101c]/90 backdrop-blur-2xl flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Brand & Department Badge */}
      <div className="flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
          <BrainCircuit className="w-6 h-6 text-cyan-200" />
        </div>
        <div className="text-left">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-black tracking-tight text-white flex items-center gap-1.5">
              SmartCampus <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">AIDS</span>
            </h1>
            
            {/* Active Authority Scope Badge */}
            {isHOD ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/15 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                <Building className="w-3 h-3 text-amber-400" />
                Super Admin (All 14 Sections)
              </span>
            ) : isAdvisor ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center gap-1">
                <Lock className="w-3 h-3 text-cyan-400" />
                Section: {assignedSection}
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-950 text-blue-300 border border-blue-800">
                Student Portal
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            AI & Data Science · Master Governance & Multi-Level Attendance
          </p>
        </div>
      </div>

      {/* Middle: Live Supabase Status, HOD Student Manager, Jarvis AI, Export */}
      <div className="hidden lg:flex items-center gap-2.5">
        {/* Live Refresh Button */}
        <button
          onClick={refreshLiveData}
          disabled={isLiveLoading}
          title="Refresh Live Data from Supabase"
          className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLiveLoading ? 'animate-spin' : ''}`} />
          <span>{isLiveLoading ? 'Syncing...' : 'Live Sync'}</span>
        </button>

        {/* HOD Student Manager Button */}
        {isHOD && (
          <button
            onClick={() => setIsStudentManagerOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all hover:scale-105 active:scale-95"
          >
            <UserCog className="w-3.5 h-3.5 text-amber-400" />
            <span>Manage Students & Reg Nos</span>
          </button>
        )}

        {onOpenJarvis && (
          <button
            onClick={onOpenJarvis}
            className="px-3.5 py-2 rounded-xl bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-700/70 text-cyan-300 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all hover:scale-105 active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Jarvis AI</span>
          </button>
        )}

        {onOpenExport && (
          <button
            onClick={onOpenExport}
            className="px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Excel / CSV Export</span>
          </button>
        )}

        <button
          onClick={triggerReconciliation430PM}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
            isReconciliationTriggered
              ? 'bg-emerald-950/80 border-emerald-700/80 text-emerald-300'
              : 'bg-slate-900/80 hover:bg-slate-800/90 border-slate-700 text-slate-200 hover:border-cyan-500'
          }`}
        >
          <Zap className={`w-3.5 h-3.5 ${isReconciliationTriggered ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span>{isReconciliationTriggered ? '4:30 PM Reconciled' : '4:30 PM Auto-Sync'}</span>
        </button>
      </div>

      {/* Right: Role Switcher, Theme & Logout */}
      <div className="flex items-center gap-3">
        {/* Dynamic Role Switcher Dropdown */}
        <div className="flex items-center gap-2 bg-[#121828] border border-slate-700/80 rounded-xl px-3 py-1.5 shadow-sm">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span className="text-[11px] text-slate-400 font-bold uppercase hidden sm:inline">User:</span>
          <select
            value={currentUserRole}
            onChange={(e) => handleRoleChange(e.target.value as UserRole)}
            className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
          >
            <option value="hod1" className="bg-slate-900">Dr. Manivannan (Ph.D.) - Overall HOD (All 14 Sec)</option>
            <option value="hod2" className="bg-slate-900">Dr. Kavitha - Junior HOD (All 14 Sec)</option>
            <option value="advisor" className="bg-slate-900">Dr. D. Anandhan - II-AIDS-A Advisor</option>
            <option value="faculty" className="bg-slate-900">Faculty Member</option>
            <option value="student" className="bg-slate-900">DEEBAKRAJ E R - Student (922525243028)</option>
          </select>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle Theme"
          className="p-2 rounded-xl bg-[#121828] border border-slate-700/80 text-slate-300 hover:text-white transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-cyan-400" />}
        </button>

        {/* Logout Button */}
        {onLogout && (
          <button
            onClick={onLogout}
            title="Sign out to Common Login"
            className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 transition-all hover:scale-105 active:scale-95"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
