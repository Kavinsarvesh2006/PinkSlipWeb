import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  UserPlus, 
  Edit3, 
  Trash2, 
  FileSpreadsheet, 
  Filter, 
  ShieldAlert, 
  Check, 
  Sparkles, 
  GraduationCap, 
  Phone, 
  Mail, 
  Save, 
  AlertTriangle,
  RefreshCw,
  Eye
} from 'lucide-react';
import { Student, YearLevel } from '../../types';
import { useAttendance } from '../../context/AttendanceContext';
import * as XLSX from 'xlsx';

interface HODStudentManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HODStudentManagerModal: React.FC<HODStudentManagerModalProps> = ({ isOpen, onClose }) => {
  const { students, batches, addStudent, editStudent, deleteStudent, showToast, setSelectedStudentId, setActiveTab } = useAttendance();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedSection, setSelectedSection] = useState<string>('ALL');

  // Sub-Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);

  // Form State for Adding
  const [newStudentForm, setNewStudentForm] = useState({
    name: '',
    regNo: '',
    rollNo: '',
    batchCode: 'II-AIDS-A',
    yearLevel: 2 as YearLevel,
    section: 'A',
    email: '',
    phone: '+91 94420 00000',
    leavesCount: 0
  });

  // Filtered Students List
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = 
        !q ||
        student.name.toLowerCase().includes(q) ||
        student.regNo.toLowerCase().includes(q) ||
        student.rollNo.toLowerCase().includes(q);

      const matchesYear = 
        selectedYear === 'ALL' || 
        student.yearLevel.toString() === selectedYear;

      const matchesSection = 
        selectedSection === 'ALL' || 
        student.section === selectedSection;

      return matchesQuery && matchesYear && matchesSection;
    });
  }, [students, searchQuery, selectedYear, selectedSection]);

  if (!isOpen) return null;

  // Handle Add Student Submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentForm.name || !newStudentForm.regNo || !newStudentForm.rollNo) {
      showToast('Please fill all required fields');
      return;
    }

    try {
      await addStudent({
        student_name: newStudentForm.name,
        register_number: newStudentForm.regNo,
        roll_number: newStudentForm.rollNo,
        section_id: newStudentForm.batchCode,
        email: newStudentForm.email || `${newStudentForm.rollNo}@student.smartcampus.edu`,
        phone_number: newStudentForm.phone
      });

      setIsAddModalOpen(false);
      setNewStudentForm({
        name: '',
        regNo: '',
        rollNo: '',
        batchCode: 'II-AIDS-A',
        yearLevel: 2,
        section: 'A',
        email: '',
        phone: '+91 94420 00000',
        leavesCount: 0
      });
      showToast('Student added successfully to AIDS department database');
    } catch (err: any) {
      showToast(`Error adding student: ${err.message}`);
    }
  };

  // Handle Edit Student Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    try {
      await editStudent(editingStudent.id, {
        student_name: editingStudent.name,
        register_number: editingStudent.regNo,
        roll_number: editingStudent.rollNo,
        section_id: editingStudent.batchCode,
        leaves_taken_ytd: editingStudent.priorLeavesCount,
        phone_number: editingStudent.parentPhone,
        email: editingStudent.parentEmail
      });

      setEditingStudent(null);
      showToast(`Student record for ${editingStudent.name} updated successfully`);
    } catch (err: any) {
      showToast(`Error updating student: ${err.message}`);
    }
  };

  // Handle Delete Student Submit
  const handleDeleteConfirm = async () => {
    if (!deletingStudent) return;
    try {
      await deleteStudent(deletingStudent.id);
      showToast(`Student ${deletingStudent.name} deleted from database`);
      setDeletingStudent(null);
    } catch (err: any) {
      showToast(`Error deleting student: ${err.message}`);
    }
  };

  // Export current list to Excel (.xlsx)
  const handleExportExcel = () => {
    const dataToExport = filteredStudents.map((s, idx) => ({
      'S.No': idx + 1,
      'Register Number': s.regNo,
      'Roll Number': s.rollNo,
      'Student Name': s.name,
      'Year': `${s.yearLevel} Year`,
      'Section': s.section,
      'Batch Code': s.batchCode,
      'Attendance %': `${s.attendancePercentage}%`,
      'Attended Periods': s.attendedPeriods,
      'Total Periods': s.totalConductedPeriods,
      'Leaves YTD': s.priorLeavesCount,
      'OD Count': s.onDutyCount,
      'Medical Leaves': s.medicalLeavesCount,
      'Uninformed Absences': s.uninformedAbsencesCount,
      'Class Advisor': s.advisorName,
      'Contact Phone': s.parentPhone
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AIDS Students Master');
    XLSX.writeFile(wb, `AIDS_Department_Student_Master_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Exported Student Master Sheet to Excel (.xlsx)');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">HOD Master Student & Roster Management</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                  Full CRUD Access
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Direct authority to Add, Edit Register Numbers, Change Sections, and Delete student records across AIDS Department ({students.length} Total Students).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all hover:scale-105"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export .xlsx
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all hover:scale-105"
            >
              <UserPlus className="w-4 h-4" />
              Add Student
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Name, 12-digit Register No (e.g. 922525243001), or Roll No..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all font-mono"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Year Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Filter className="w-3.5 h-3.5" />
              <span>Year:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Years (1st - 4th)</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>
            </div>

            {/* Section Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400 ml-2">
              <span>Section:</span>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Sections (A-D)</option>
                <option value="A">Section A</option>
                <option value="B">Section B</option>
                <option value="C">Section C</option>
                <option value="D">Section D</option>
              </select>
            </div>

            <div className="text-xs text-slate-400 font-mono px-2 py-1 rounded-lg bg-slate-950 border border-slate-800">
              Showing <span className="text-cyan-400 font-bold">{filteredStudents.length}</span> of {students.length}
            </div>
          </div>
        </div>

        {/* Students Table Area */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <th className="py-3 px-4">Register Number</th>
                  <th className="py-3 px-3">Roll No</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-3">Batch / Section</th>
                  <th className="py-3 px-3">Attendance %</th>
                  <th className="py-3 px-3">Leaves YTD</th>
                  <th className="py-3 px-3">Advisor</th>
                  <th className="py-3 px-4 text-right">HOD Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 font-mono">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 text-xs font-sans">
                      No students found matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => {
                    const isShortage = student.attendancePercentage < 75;
                    return (
                      <tr key={student.id} className="hover:bg-slate-800/50 transition-colors group">
                        <td className="py-3 px-4 text-cyan-300 font-bold">
                          {student.regNo}
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          {student.rollNo}
                        </td>
                        <td className="py-3 px-4 font-sans font-semibold text-white">
                          <div className="flex items-center gap-2">
                            <span>{student.name}</span>
                            {isShortage && (
                              <span className="px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 text-[9px] font-bold">
                                Shortage
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                            {student.batchCode}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold">
                          <span className={isShortage ? 'text-red-400' : 'text-emerald-400'}>
                            {student.attendancePercentage}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          {student.priorLeavesCount} days
                        </td>
                        <td className="py-3 px-3 text-slate-400 font-sans text-[11px] truncate max-w-[120px]">
                          {student.advisorName}
                        </td>
                        <td className="py-3 px-4 text-right font-sans">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedStudentId(student.id);
                                setActiveTab('student_dossier');
                                onClose();
                              }}
                              title="View Student Dossier"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 transition-all"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingStudent({ ...student })}
                              title="Edit Details & Register Number"
                              className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all hover:scale-105"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingStudent(student)}
                              title="Delete Student Record"
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all hover:scale-105"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>HOD Authority: Dr. Manivannan (Ph.D.) • AIDS Department</span>
          <span>Supabase PostgreSQL Live Mode</span>
        </div>

      </div>

      {/* ──────────────── ADD STUDENT SUB-MODAL ──────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-cyan-400" />
                Add New Student to AIDS Department
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1.5 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3.5 text-left text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Student Full Name *</label>
                <input
                  type="text"
                  required
                  value={newStudentForm.name}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, name: e.target.value })}
                  placeholder="e.g. KARTHIK R"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-sans uppercase focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Register Number *</label>
                  <input
                    type="text"
                    required
                    value={newStudentForm.regNo}
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, regNo: e.target.value })}
                    placeholder="e.g. 922525243088"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-cyan-300 font-mono focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Roll Number *</label>
                  <input
                    type="text"
                    required
                    value={newStudentForm.rollNo}
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, rollNo: e.target.value })}
                    placeholder="e.g. 25243088"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Section / Batch *</label>
                  <select
                    value={newStudentForm.batchCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      const yr = code.startsWith('I-') ? 1 : code.startsWith('II-') ? 2 : code.startsWith('III-') ? 3 : 4;
                      const sec = code.slice(-1);
                      setNewStudentForm({ ...newStudentForm, batchCode: code, yearLevel: yr as YearLevel, section: sec });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:border-cyan-500"
                  >
                    {batches.map(b => (
                      <option key={b.batchCode} value={b.batchCode}>{b.batchCode} ({b.yearName} - Sec {b.section})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={newStudentForm.phone}
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, phone: e.target.value })}
                    placeholder="+91 94420 12345"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Official Student Email</label>
                <input
                  type="email"
                  value={newStudentForm.email}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, email: e.target.value })}
                  placeholder="e.g. 25243088@student.smartcampus.edu"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:border-cyan-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Student to Live DB
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────── EDIT STUDENT SUB-MODAL ──────────────── */}
      {editingStudent && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                HOD Edit Student Record
              </h3>
              <button onClick={() => setEditingStudent(null)} className="p-1.5 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5 text-left text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Student Full Name</label>
                <input
                  type="text"
                  required
                  value={editingStudent.name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-sans uppercase focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Register Number (12-Digit)</label>
                  <input
                    type="text"
                    required
                    value={editingStudent.regNo}
                    onChange={(e) => setEditingStudent({ ...editingStudent, regNo: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-cyan-300 font-mono focus:border-amber-500 font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Roll Number</label>
                  <input
                    type="text"
                    required
                    value={editingStudent.rollNo}
                    onChange={(e) => setEditingStudent({ ...editingStudent, rollNo: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Section / Batch</label>
                  <select
                    value={editingStudent.batchCode}
                    onChange={(e) => setEditingStudent({ ...editingStudent, batchCode: e.target.value, section: e.target.value.slice(-1) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:border-amber-500"
                  >
                    {batches.map(b => (
                      <option key={b.batchCode} value={b.batchCode}>{b.batchCode}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Leaves Taken YTD</label>
                  <input
                    type="number"
                    min="0"
                    value={editingStudent.priorLeavesCount}
                    onChange={(e) => setEditingStudent({ ...editingStudent, priorLeavesCount: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={editingStudent.parentPhone || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, parentPhone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:border-amber-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-600/30 flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  Update Student Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────── DELETE CONFIRMATION MODAL ──────────────── */}
      {deletingStudent && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-red-500/40 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in zoom-in-95 text-left">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Student Record</h3>
                <p className="text-xs text-slate-400">This action will remove the student permanently.</p>
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1 font-mono">
              <div className="text-slate-300 font-sans font-bold text-sm">{deletingStudent.name}</div>
              <div className="text-cyan-300">Reg No: {deletingStudent.regNo}</div>
              <div className="text-slate-400">Roll No: {deletingStudent.rollNo} • Batch: {deletingStudent.batchCode}</div>
            </div>

            <p className="text-xs text-slate-400">
              Are you sure you want to delete this student from the AIDS department Supabase database? This will also remove their daily attendance logs.
            </p>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingStudent(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/30 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
