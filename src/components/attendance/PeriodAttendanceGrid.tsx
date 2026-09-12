import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Save, 
  Sparkles, 
  ShieldCheck, 
  AlertTriangle, 
  UserCheck, 
  Calendar, 
  Lock, 
  Search, 
  Check, 
  Keyboard, 
  Fingerprint, 
  RotateCcw, 
  Zap,
  Send,
  Building,
  UserCheck2
} from 'lucide-react';
import { useAttendance } from '../../context/AttendanceContext';
import { AttendanceStatus } from '../../types';
import { periodTimeSlots } from '../../data/mockData';

export const PeriodAttendanceGrid: React.FC = () => {
  const { 
    batches, 
    accessibleBatches,
    accessibleStudents,
    assignedSection,
    isHOD,
    isAdvisor,
    selectedBatchCode, 
    setSelectedBatchCode,
    selectedPeriodForMarking, 
    setSelectedPeriodForMarking,
    selectedDateForMarking, 
    setSelectedDateForMarking,
    savePeriodAttendance,
    submitDayAttendanceToHOD,
    complianceList,
    showToast
  } = useAttendance();

  const [studentSearch, setStudentSearch] = useState('');
  const [markingMode, setMarkingMode] = useState<'grid' | 'keyboard' | 'biometric'>('grid');
  const [activeRollIndex, setActiveRollIndex] = useState(0);
  const [isBiometricSyncing, setIsBiometricSyncing] = useState(false);

  // Active batch students (filtered by assigned section if advisor)
  const batchStudents = accessibleStudents.filter(s => s.batchCode === selectedBatchCode);

  // Filtered by search within batch
  const displayedStudents = studentSearch.trim()
    ? batchStudents.filter(s => 
        s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
        s.rollNo.includes(studentSearch) ||
        s.regNo.includes(studentSearch)
      )
    : batchStudents;

  // Local state for fast marking
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});

  // Synchronize statuses when batch, date, or period changes
  useEffect(() => {
    const initial: Record<string, AttendanceStatus> = {};
    batchStudents.forEach(s => {
      const dateRecord = s.recentAttendance[selectedDateForMarking];
      if (dateRecord && dateRecord[selectedPeriodForMarking - 1]) {
        initial[s.id] = dateRecord[selectedPeriodForMarking - 1];
      } else {
        initial[s.id] = 'present';
      }
    });
    setStatuses(initial);
    setActiveRollIndex(0);
  }, [selectedBatchCode, selectedPeriodForMarking, selectedDateForMarking, accessibleStudents]);

  const handleMarkAllPresent = () => {
    const updated: Record<string, AttendanceStatus> = {};
    batchStudents.forEach(s => {
      const current = statuses[s.id];
      if (current === 'leave_prior_cl' || current === 'leave_od' || current === 'leave_ml') {
        updated[s.id] = current;
      } else {
        updated[s.id] = 'present';
      }
    });
    setStatuses(updated);
    showToast(`Marked all ${batchStudents.length} students as Present`);
  };

  const toggleStudentStatus = (studentId: string) => {
    const current = statuses[studentId] || 'present';
    if (current === 'leave_prior_cl' || current === 'leave_od' || current === 'leave_ml') {
      return; // Locked: Approved Prior Leave
    }
    const next: AttendanceStatus = current === 'present' ? 'absent_uninformed' : 'present';
    setStatuses(prev => ({ ...prev, [studentId]: next }));
  };

  const handleSave = () => {
    savePeriodAttendance(selectedBatchCode, selectedPeriodForMarking, selectedDateForMarking, statuses);
  };

  const handleSubmitDayToHOD = () => {
    submitDayAttendanceToHOD(selectedBatchCode, selectedDateForMarking, 'Submitted by Class Advisor after verification.');
  };

  // Keyboard navigation handler for rapid roll call
  const handleKeyboardMark = (status: AttendanceStatus) => {
    if (activeRollIndex >= displayedStudents.length) return;
    const currentStudent = displayedStudents[activeRollIndex];
    if (!currentStudent) return;

    const current = statuses[currentStudent.id];
    if (current !== 'leave_prior_cl' && current !== 'leave_od' && current !== 'leave_ml') {
      setStatuses(prev => ({ ...prev, [currentStudent.id]: status }));
    }

    if (activeRollIndex < displayedStudents.length - 1) {
      setActiveRollIndex(prev => prev + 1);
    } else {
      showToast('Completed rapid keyboard roll call for all students in section!');
    }
  };

  const currentSlot = periodTimeSlots.find(p => p.periodNumber === selectedPeriodForMarking) || periodTimeSlots[0];
  const presentCount = Object.values(statuses).filter(st => st === 'present' || st === 'leave_od').length;
  const absentCount = Object.values(statuses).filter(st => st === 'absent_uninformed').length;
  const leaveCount = Object.values(statuses).filter(st => st === 'leave_prior_cl' || st === 'leave_ml').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Controls Header Card */}
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-700 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="text-left">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center gap-1.5 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Live Attendance Engine
              </span>

              {isAdvisor && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-400" />
                  Assigned Section: {assignedSection}
                </span>
              )}
            </div>

            <h2 className="text-xl font-black text-white tracking-tight">
              Period & Daily Attendance Roll Call
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live period-by-period marking with instant database persistence, 12-digit Register Number lookup, and HOD submission.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Batch Selector (Locked for Advisors, Switchable for HOD) */}
            <div className="flex items-center gap-1.5">
              <select
                value={selectedBatchCode}
                onChange={(e) => setSelectedBatchCode(e.target.value)}
                disabled={!isHOD && assignedSection !== 'ALL'}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-500 disabled:opacity-75 disabled:cursor-not-allowed font-mono"
              >
                {accessibleBatches.map(b => (
                  <option key={b.id} value={b.batchCode}>
                    {b.batchCode} ({b.yearName} - Sec {b.section}) • {b.totalStudents} Students
                  </option>
                ))}
              </select>
            </div>

            {/* Date Picker */}
            <input
              type="date"
              value={selectedDateForMarking}
              onChange={(e) => setSelectedDateForMarking(e.target.value)}
              className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none font-mono focus:border-cyan-500"
            />

            {/* Save Period Attendance */}
            <button
              onClick={handleSave}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>Save Period {selectedPeriodForMarking}</span>
            </button>

            {/* Submit Day to HOD */}
            <button
              onClick={handleSubmitDayToHOD}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/25 transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              <span>Submit Day to HOD</span>
            </button>
          </div>
        </div>

        {/* Period Selector Tabs & Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
          {/* 7 Periods Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {[1, 2, 3, 4, 5, 6, 7].map((periodNum) => {
              const isActive = selectedPeriodForMarking === periodNum;
              return (
                <button
                  key={periodNum}
                  onClick={() => setSelectedPeriodForMarking(periodNum)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30 scale-105'
                      : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  Period {periodNum}
                </button>
              );
            })}
          </div>

          {/* Quick Marking Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllPresent}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-105"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Mark All Present</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Section KPI Strip */}
      <div className="grid grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="text-left">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Strength</span>
            <span className="text-xl font-extrabold text-white">{batchStudents.length}</span>
          </div>
          <UserCheck2 className="w-5 h-5 text-cyan-400" />
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="text-left">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Present (P)</span>
            <span className="text-xl font-extrabold text-emerald-400">{presentCount}</span>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="text-left">
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider block">Absent (A)</span>
            <span className="text-xl font-extrabold text-red-400">{absentCount}</span>
          </div>
          <XCircle className="w-5 h-5 text-red-400" />
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="text-left">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Leaves / OD</span>
            <span className="text-xl font-extrabold text-amber-400">{leaveCount}</span>
          </div>
          <Sparkles className="w-5 h-5 text-amber-400" />
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={studentSearch}
          onChange={(e) => setStudentSearch(e.target.value)}
          placeholder={`Search ${batchStudents.length} students in ${selectedBatchCode} by Name, 12-digit Register No (e.g. 9225...), or Roll No...`}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono transition-all"
        />
      </div>

      {/* Student Attendance Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-left">
        {displayedStudents.map((student, idx) => {
          const status = statuses[student.id] || 'present';
          const isPresent = status === 'present' || status === 'leave_od';
          const isLockedLeave = status === 'leave_prior_cl' || status === 'leave_od' || status === 'leave_ml';

          return (
            <div
              key={student.id}
              onClick={() => !isLockedLeave && toggleStudentStatus(student.id)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none group relative overflow-hidden ${
                status === 'present'
                  ? 'bg-slate-900/90 border-emerald-500/40 hover:border-emerald-400 shadow-sm'
                  : status === 'absent_uninformed'
                  ? 'bg-red-500/10 border-red-500/50 hover:border-red-400 ring-1 ring-red-500/30'
                  : 'bg-cyan-500/10 border-cyan-500/40'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5 truncate">
                  <div className="text-[10px] font-mono text-cyan-300 font-bold truncate">
                    {student.regNo}
                  </div>
                  <div className="text-xs font-bold text-white truncate font-sans">
                    {student.name}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Roll: {student.rollNo} • {student.batchCode}
                  </div>
                </div>

                <span
                  className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-transform group-hover:scale-110 ${
                    status === 'present'
                      ? 'bg-emerald-500 text-black font-extrabold'
                      : status === 'absent_uninformed'
                      ? 'bg-red-500 text-white'
                      : 'bg-cyan-500 text-black'
                  }`}
                >
                  {status === 'present' ? 'P' : status === 'absent_uninformed' ? 'A' : 'OD'}
                </span>
              </div>

              {/* Progress Mini Bar */}
              <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                <span>Overall: <strong className={student.attendancePercentage < 75 ? 'text-red-400' : 'text-emerald-400'}>{student.attendancePercentage}%</strong></span>
                <span>{status === 'present' ? 'Click for Absent' : isLockedLeave ? 'Leave Sanctioned' : 'Click for Present'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
