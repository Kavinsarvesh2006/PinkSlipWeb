import React, { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { MonthlyAttendanceCalendar } from './components/calendar/MonthlyAttendanceCalendar';
import { LeaveWorkflowCenter } from './components/leave/LeaveWorkflowCenter';
import { DepartmentAnalyticsCharts } from './components/analytics/DepartmentAnalyticsCharts';
import { HODCockpit } from './components/hod/HODCockpit';
import { PeriodAttendanceGrid } from './components/attendance/PeriodAttendanceGrid';
import { StudentDossier } from './components/student/StudentDossier';
import { CloudAndNAACView } from './components/cloud/CloudAndNAACView';
import { JarvisAiAdvisor } from './components/ai/JarvisAiAdvisor';
import { ExportImportModal } from './components/export/ExportImportModal';
import { CommonLogin } from './components/auth/CommonLogin';
import { useAttendance } from './context/AttendanceContext';
import { useTheme } from './context/ThemeContext';
import { UserRole } from './types';
import { supabase } from './services/supabaseClient';

export const App: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    toastMessage, 
    setCurrentUserRole, 
    setCurrentUserEmail, 
    showToast 
  } = useAttendance();
  const { theme } = useTheme();

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('aids_auth_logged_in') === 'true';
  });
  const [isJarvisOpen, setIsJarvisOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Check Supabase session on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsAuthenticated(true);
        localStorage.setItem('aids_auth_logged_in', 'true');
        const email = session.user.email || '';
        setCurrentUserEmail(email);
        if (email.includes('manivannan')) {
          setCurrentUserRole('hod1');
          setActiveTab('hod_cockpit');
        } else if (email.includes('kavitha')) {
          setCurrentUserRole('hod2');
          setActiveTab('hod_cockpit');
        } else if (email.includes('advisor')) {
          setCurrentUserRole('advisor');
          setActiveTab('period_marker');
        } else {
          setCurrentUserRole('student');
          setActiveTab('student_dossier');
        }
      }
    };
    checkSession();
  }, [setCurrentUserRole, setCurrentUserEmail, setActiveTab]);

  const handleLoginSuccess = (role: UserRole, email: string) => {
    setIsAuthenticated(true);
    localStorage.setItem('aids_auth_logged_in', 'true');
    setCurrentUserRole(role);
    setCurrentUserEmail(email);

    // Route dynamically based on role
    if (role === 'hod1' || role === 'hod2') {
      setActiveTab('hod_cockpit');
    } else if (role === 'advisor') {
      setActiveTab('period_marker');
    } else if (role === 'student') {
      setActiveTab('student_dossier');
    } else {
      setActiveTab('dept_analytics');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut().catch(() => {});
    localStorage.removeItem('aids_auth_logged_in');
    setIsAuthenticated(false);
    showToast('Signed out of AIDS Department portal.');
  };

  // If not logged in, render the Common Login dashboard
  if (!isAuthenticated) {
    return <CommonLogin onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className={`flex h-screen w-screen overflow-hidden ${
      theme === 'dark' ? 'ambient-bg text-slate-100' : 'ambient-bg-light text-slate-900'
    }`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-5 py-3 rounded-2xl shadow-2xl shadow-cyan-600/30 font-bold text-xs animate-in slide-in-from-bottom-5 border border-cyan-400/30 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-200 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Sidebar */}
      <Sidebar
        onOpenJarvis={() => setIsJarvisOpen(true)}
        onOpenExport={() => setIsExportModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header
          onOpenJarvis={() => setIsJarvisOpen(true)}
          onOpenExport={() => setIsExportModalOpen(true)}
          onLogout={handleLogout}
        />

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'hod_cockpit' && <HODCockpit />}
          {activeTab === 'period_marker' && <PeriodAttendanceGrid />}
          {activeTab === 'monthly_calendar' && <MonthlyAttendanceCalendar />}
          {activeTab === 'leave_workflow' && <LeaveWorkflowCenter />}
          {activeTab === 'student_dossier' && <StudentDossier />}
          {activeTab === 'dept_analytics' && <DepartmentAnalyticsCharts />}
          {activeTab === 'cloud_naac' && <CloudAndNAACView />}
        </main>
      </div>

      {/* Jarvis AI Copilot Modal */}
      <JarvisAiAdvisor
        isOpen={isJarvisOpen}
        onClose={() => setIsJarvisOpen(false)}
      />

      {/* Export / CSV Import & Broadcast Center Modal */}
      <ExportImportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
};

export default App;
