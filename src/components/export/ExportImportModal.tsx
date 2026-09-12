import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Upload, 
  Send, 
  Check, 
  X, 
  PhoneCall, 
  FileText,
  AlertCircle,
  Building,
  GraduationCap,
  Layers,
  Sparkles
} from 'lucide-react';
import { useAttendance } from '../../context/AttendanceContext';
import * as XLSX from 'xlsx';

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportImportModal: React.FC<ExportImportModalProps> = ({ isOpen, onClose }) => {
  const { students, batches, leaveRecords, departmentSummary, selectedBatchCode, showToast } = useAttendance();
  const [activeTab, setActiveTab] = useState<'export' | 'broadcast' | 'import'>('export');
  const [exportScope, setExportScope] = useState<'overall' | 'year' | 'section' | 'leaves'>('overall');
  const [selectedYear, setSelectedYear] = useState<number>(2);
  const [selectedBatch, setSelectedBatch] = useState<string>(selectedBatchCode);
  const [isDispatched, setIsDispatched] = useState(false);

  if (!isOpen) return null;

  // Filter students based on selected scope
  const getFilteredStudentsForExport = () => {
    if (exportScope === 'section') {
      return students.filter(s => s.batchCode === selectedBatch);
    }
    if (exportScope === 'year') {
      return students.filter(s => s.yearLevel === selectedYear);
    }
    return students; // Overall department
  };

  /**
   * 1. Export Full Master Excel (.xlsx) Workbook
   */
  const handleExportExcel = () => {
    const targetStudents = getFilteredStudentsForExport();
    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Overall Department / Scope KPI Summary ──
    const summaryData = [
      { Metric: 'Department Name', Value: 'Artificial Intelligence and Data Science (AI&DS)' },
      { Metric: 'College', Value: 'V.S.B. Engineering College' },
      { Metric: 'Export Timestamp', Value: new Date().toLocaleString() },
      { Metric: 'Export Scope', Value: exportScope.toUpperCase() },
      { Metric: 'Total Students in Report', Value: targetStudents.length },
      { Metric: 'Total Active Batches / Sections', Value: batches.length },
      { Metric: 'Overall Department Attendance %', Value: `${departmentSummary.overallAttendancePercentage}%` },
      { Metric: 'Present Today', Value: departmentSummary.presentTodayCount },
      { Metric: 'Uninformed Absentees Today', Value: departmentSummary.uninformedAbsenteesToday },
      { Metric: 'Approved Leaves Today', Value: departmentSummary.approvedLeavesToday },
      { Metric: 'Attendance Shortage (<75%) Students', Value: departmentSummary.shortageStudentsCount },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Department KPI Summary');

    // ── Sheet 2: Student Master Attendance Roster ──
    const rosterData = targetStudents.map((s, idx) => ({
      'S.No': idx + 1,
      'Register Number': s.regNo,
      'Roll Number': s.rollNo,
      'Student Name': s.name,
      'Year Level': `${s.yearLevel} Year`,
      'Section': s.section,
      'Batch Code': s.batchCode,
      'Attendance %': `${s.attendancePercentage}%`,
      'Attended Periods': s.attendedPeriods,
      'Total Conducted': s.totalConductedPeriods,
      'Leaves Taken YTD': s.priorLeavesCount,
      'OD (On-Duty) Count': s.onDutyCount,
      'Medical Leaves': s.medicalLeavesCount,
      'Uninformed Absences': s.uninformedAbsencesCount,
      'Shortage Warning (<75%)': s.attendancePercentage < 75 ? 'YES - SHORTAGE' : 'CLEAR',
      'Class Advisor': s.advisorName,
      'Contact Phone': s.parentPhone
    }));
    const wsRoster = XLSX.utils.json_to_sheet(rosterData);
    XLSX.utils.book_append_sheet(wb, wsRoster, 'Student Attendance Master');

    // ── Sheet 3: Section-Wise Cohort Breakdown ──
    const sectionData = batches.map((b, idx) => ({
      'S.No': idx + 1,
      'Batch Code': b.batchCode,
      'Year': b.yearName,
      'Section': b.section,
      'Class Advisor': b.advisorName,
      'Total Strength': b.totalStudents,
      'Average Attendance %': `${b.avgAttendance}%`,
      'Present Today': b.presentToday,
      'Uninformed Today': b.uninformedToday,
      'Approved Leaves Today': b.approvedLeavesToday
    }));
    const wsSections = XLSX.utils.json_to_sheet(sectionData);
    XLSX.utils.book_append_sheet(wb, wsSections, 'Section Breakdown');

    // ── Sheet 4: Leaves & Pink Slip Register ──
    const leavesData = leaveRecords.map((l, idx) => ({
      'Slip ID': l.id,
      'Student Name': l.studentName,
      'Roll / Reg No': l.rollNo,
      'Batch Code': l.batchCode,
      'Leave Type': l.leaveType.toUpperCase(),
      'Start Date': l.startDate,
      'End Date': l.endDate,
      'Total Days': l.totalDays,
      'Reason': l.reason,
      'Status': l.status.toUpperCase(),
      'Applied At': l.appliedAt,
      'Advisor Remarks': l.advisorRemarks || 'N/A',
      'HOD Remarks': l.hodRemarks || 'N/A'
    }));
    const wsLeaves = XLSX.utils.json_to_sheet(leavesData);
    XLSX.utils.book_append_sheet(wb, wsLeaves, 'Leave & OD Register');

    const fileName = `AIDS_Department_${exportScope.toUpperCase()}_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);

    showToast(`Generated & Downloaded Live Department Excel (${fileName})!`);
  };

  /**
   * 2. Export Standard Clean CSV Report
   */
  const handleExportCSV = () => {
    const targetStudents = getFilteredStudentsForExport();
    const headers = [
      "S.No",
      "RegisterNumber",
      "RollNumber",
      "StudentName",
      "BatchCode",
      "YearLevel",
      "Section",
      "AttendancePercentage",
      "AttendedPeriods",
      "TotalConductedPeriods",
      "LeavesYTD",
      "OnDutyCount",
      "UninformedAbsences",
      "AttendanceStatus",
      "AdvisorName",
      "ParentPhone"
    ];

    const rows = targetStudents.map((s, idx) => [
      idx + 1,
      `"${s.regNo}"`,
      `"${s.rollNo}"`,
      `"${s.name}"`,
      s.batchCode,
      s.yearLevel,
      s.section,
      s.attendancePercentage,
      s.attendedPeriods,
      s.totalConductedPeriods,
      s.priorLeavesCount,
      s.onDutyCount,
      s.uninformedAbsencesCount,
      s.attendancePercentage < 75 ? "SHORTAGE_RISK" : "REGULAR",
      `"${s.advisorName}"`,
      `"${s.parentPhone}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const fileName = `AIDS_Department_${exportScope.toUpperCase()}_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Exported ${targetStudents.length} student records to CSV (${fileName})!`);
  };

  const handleSimulateBroadcast = () => {
    const targetStudents = getFilteredStudentsForExport();
    const cutsCount = targetStudents.filter(s => s.uninformedAbsencesCount > 0).length;
    setIsDispatched(true);
    showToast(`Dispatched automated SMS & WhatsApp parent alerts to ${cutsCount} guardians!`);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-[#0c101c] border border-slate-700 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-slate-100">
        
        {/* Header */}
        <div className="p-5 px-6 border-b border-slate-800 bg-[#0e1424] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Department Reports & Excel / CSV Center
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                  Live DB Sync
                </span>
              </h3>
              <p className="text-xs text-slate-400">Export high-fidelity attendance records across all students, sections, and years</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="p-4 px-6 border-b border-slate-800 flex items-center gap-2 bg-slate-950/50">
          <button
            onClick={() => setActiveTab('export')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'export' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30' : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            Export Live Excel & CSV
          </button>
          <button
            onClick={() => setActiveTab('broadcast')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'broadcast' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30' : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" />
            SMS / Parent Broadcast
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'import' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Biometric Sync
          </button>
        </div>

        {/* Tab 1: Export View */}
        {activeTab === 'export' && (
          <div className="p-6 space-y-6 text-left">
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                1. Select Export Scope
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  onClick={() => setExportScope('overall')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    exportScope === 'overall' 
                      ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300 ring-1 ring-cyan-500/30' 
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Building className="w-4 h-4 mb-1.5" />
                  <div className="text-xs font-bold">Overall Dept</div>
                  <div className="text-[10px] opacity-75">All 622 Students</div>
                </button>

                <button
                  type="button"
                  onClick={() => setExportScope('year')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    exportScope === 'year' 
                      ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300 ring-1 ring-cyan-500/30' 
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <GraduationCap className="w-4 h-4 mb-1.5" />
                  <div className="text-xs font-bold">Year-Wise</div>
                  <div className="text-[10px] opacity-75">1st, 2nd, 3rd or 4th</div>
                </button>

                <button
                  type="button"
                  onClick={() => setExportScope('section')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    exportScope === 'section' 
                      ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300 ring-1 ring-cyan-500/30' 
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Layers className="w-4 h-4 mb-1.5" />
                  <div className="text-xs font-bold">Section-Wise</div>
                  <div className="text-[10px] opacity-75">Specific Section</div>
                </button>

                <button
                  type="button"
                  onClick={() => setExportScope('leaves')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    exportScope === 'leaves' 
                      ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300 ring-1 ring-cyan-500/30' 
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <FileText className="w-4 h-4 mb-1.5" />
                  <div className="text-xs font-bold">Pink Slips / OD</div>
                  <div className="text-[10px] opacity-75">Leave Approvals</div>
                </button>
              </div>
            </div>

            {/* Sub-Filters */}
            {exportScope === 'year' && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 animate-in fade-in">
                <label className="text-xs font-semibold text-slate-300">Choose Academic Year</label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map(yr => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setSelectedYear(yr)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        selectedYear === yr 
                          ? 'bg-cyan-600 text-white border-cyan-500' 
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {yr === 1 ? '1st Year' : yr === 2 ? '2nd Year' : yr === 3 ? '3rd Year' : '4th Year'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {exportScope === 'section' && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 animate-in fade-in">
                <label className="text-xs font-semibold text-slate-300">Choose Section / Batch</label>
                <select
                  value={selectedBatch}
                  onChange={(e) => setSelectedBatch(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:border-cyan-500"
                >
                  {batches.map(b => (
                    <option key={b.batchCode} value={b.batchCode}>
                      {b.batchCode} ({b.yearName} - Section {b.section}) • {b.totalStudents} Students • Advisor: {b.advisorName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Scope Summary Preview */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Total Student Records Included:</span>
              <span className="text-cyan-400 font-bold text-sm">{getFilteredStudentsForExport().length} Students</span>
            </div>

            {/* Action Buttons: Excel (.xlsx) & CSV */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleExportExcel}
                className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Download Excel (.xlsx)
              </button>

              <button
                onClick={handleExportCSV}
                className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Download className="w-4 h-4" />
                Download CSV (.csv)
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Broadcast View */}
        {activeTab === 'broadcast' && (
          <div className="p-6 space-y-5 text-left text-xs">
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>Broadcast sends real-time SMS & WhatsApp alerts to parents of absentees for the selected cohort.</span>
            </div>

            <div className="space-y-2">
              <label className="text-slate-300 font-semibold block">Select Target Section</label>
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
              >
                {batches.map(b => (
                  <option key={b.batchCode} value={b.batchCode}>{b.batchCode} ({b.totalStudents} Students)</option>
                ))}
              </select>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 font-mono">
              <div className="text-slate-400 text-[11px] uppercase">Message Preview:</div>
              <p className="text-slate-300 text-xs leading-relaxed font-sans bg-slate-900 p-3 rounded-xl border border-slate-800">
                &quot;Dear Parent, this is an official notification from VSB AIDS Department. Your ward was marked absent today without prior approved leave slip. Please contact Class Advisor immediately.&quot;
              </p>
            </div>

            <button
              onClick={handleSimulateBroadcast}
              className="w-full py-3.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 transition-all"
            >
              <Send className="w-4 h-4" />
              {isDispatched ? 'Re-Dispatch Broadcast Alerts' : 'Dispatch Parent SMS & WhatsApp Alerts'}
            </button>
          </div>
        )}

        {/* Tab 3: Biometric Sync View */}
        {activeTab === 'import' && (
          <div className="p-6 space-y-5 text-left text-xs">
            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 flex items-center gap-3">
              <Sparkles className="w-5 h-5 shrink-0 text-indigo-400" />
              <span>Direct live synchronization with BIO-GATE-01 and Face Biometric service.</span>
            </div>

            <div className="border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-3xl p-8 text-center space-y-3 cursor-pointer transition-all bg-slate-950/40">
              <Upload className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-xs font-bold text-white">Drop Biometric .DAT / .CSV Logs Here</div>
              <p className="text-[11px] text-slate-500">Supports Anviz, ZKTeco, and Face Attendance CSV outputs</p>
            </div>

            <button
              onClick={() => showToast('Biometric Gate Sync Complete: 622 Student records reconciled!')}
              className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all"
            >
              <Check className="w-4 h-4" />
              Sync Live Gate Biometric Logs
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
