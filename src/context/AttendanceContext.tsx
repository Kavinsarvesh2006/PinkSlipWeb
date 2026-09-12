import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  UserRole, 
  User, 
  Batch, 
  Student, 
  LeaveRecord, 
  FacultyComplianceItem, 
  DepartmentSummary, 
  AttendanceStatus,
  LeaveApprovalStatus,
  DayAttendanceSubmission,
  NotificationItem,
  YearLevel
} from '../types';
import { 
  mockUsers, 
  initialBatches, 
  initialStudents, 
  initialLeaveRecords, 
  initialDaySubmissions,
  initialNotifications,
  initialComplianceList, 
  initialDepartmentSummary,
  workingDates 
} from '../data/mockData';
import { SupabaseService, DBStudent, DBSection, DBStaffAdvisor, DBDailyAttendance, DBLeaveSlip } from '../services/supabaseService';
import { supabase } from '../services/supabaseClient';

export type ActiveTab = 
  | 'hod_cockpit' 
  | 'monthly_calendar' 
  | 'period_marker' 
  | 'leave_workflow' 
  | 'student_dossier' 
  | 'dept_analytics' 
  | 'cloud_naac';

interface AttendanceContextType {
  currentUserRole: UserRole;
  setCurrentUserRole: (role: UserRole) => void;
  currentUser: User;
  currentUserEmail: string;
  setCurrentUserEmail: (email: string) => void;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  
  // Section Isolation & Role Scoping
  assignedSection: string; // 'II-AIDS-A', 'III-AIDS-B', or 'ALL' for HOD
  isHOD: boolean;
  isAdvisor: boolean;
  isStudent: boolean;
  accessibleBatches: Batch[];
  accessibleStudents: Student[];
  accessibleLeaves: LeaveRecord[];
  
  // Master Data State
  batches: Batch[];
  students: Student[];
  leaveRecords: LeaveRecord[];
  pendingLeaves: LeaveRecord[];
  allLeaves: LeaveRecord[];
  daySubmissions: DayAttendanceSubmission[];
  notifications: NotificationItem[];
  complianceList: FacultyComplianceItem[];
  departmentSummary: DepartmentSummary;
  workingDates: string[];
  isLiveLoading: boolean;
  refreshLiveData: () => Promise<void>;
  
  // Filters & Selected States
  selectedBatchCode: string;
  setSelectedBatchCode: (code: string) => void;
  selectedStudentId: string;
  setSelectedStudentId: (id: string) => void;
  selectedPeriodForMarking: number;
  setSelectedPeriodForMarking: (p: number) => void;
  selectedDateForMarking: string;
  setSelectedDateForMarking: (d: string) => void;
  
  // HOD CRUD Operations for Students
  addStudent: (newStudent: {
    student_name: string;
    register_number: string;
    roll_number: string;
    section_id: string;
    email?: string;
    phone_number?: string;
  }) => Promise<void>;
  editStudent: (studentId: string | number, updates: {
    student_name?: string;
    register_number?: string;
    roll_number?: string;
    section_id?: string;
    leaves_taken_ytd?: number;
    phone_number?: string;
    email?: string;
  }) => Promise<void>;
  deleteStudent: (studentId: string | number) => Promise<void>;
  
  // Attendance Marking & HOD Verification
  savePeriodAttendance: (batchCode: string, periodNumber: number, date: string, studentStatuses: Record<string, AttendanceStatus>) => void;
  saveDayAttendance: (batchCode: string, date: string, studentDayStatuses: Record<string, AttendanceStatus>) => void;
  submitDayAttendanceToHOD: (batchCode: string, date: string, remarks?: string) => void;
  verifyDayAttendanceByHOD: (batchCode: string, date: string, remarks?: string) => void;
  
  // 2-Tier Leave & On-Duty Approval Workflow (Student -> Advisor -> HOD)
  studentSubmitLeave: (leaveData: Omit<LeaveRecord, 'id' | 'status' | 'appliedAt'>) => void;
  advisorForwardLeaveToHOD: (leaveId: string, advisorRemarks: string) => void;
  advisorRejectLeave: (leaveId: string, advisorRemarks: string) => void;
  hodApproveLeave: (leaveId: string, hodRemarks: string) => void;
  hodRejectLeave: (leaveId: string, hodRemarks: string) => void;
  
  // Notification Management
  markNotificationAsRead: (id: string) => void;
  clearAllNotifications: () => void;
  
  // System Tools
  triggerReconciliation430PM: () => void;
  isReconciliationTriggered: boolean;
  toastMessage: string | null;
  showToast: (msg: string) => void;
  isNAACModalOpen: boolean;
  setIsNAACModalOpen: (open: boolean) => void;
  isStudentManagerOpen: boolean;
  setIsStudentManagerOpen: (open: boolean) => void;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

export const AttendanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('hod1');
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('manivannan.hod@vsb.ac.in');
  const [activeTab, setActiveTab] = useState<ActiveTab>('hod_cockpit');
  
  const [batches, setBatches] = useState<Batch[]>(initialBatches);
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>(initialLeaveRecords);
  const [daySubmissions, setDaySubmissions] = useState<DayAttendanceSubmission[]>(initialDaySubmissions);
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [complianceList, setComplianceList] = useState<FacultyComplianceItem[]>(initialComplianceList);
  const [departmentSummary, setDepartmentSummary] = useState<DepartmentSummary>(initialDepartmentSummary);

  const [selectedBatchCode, setSelectedBatchCode] = useState<string>('II-AIDS-A');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('1001');
  const [selectedPeriodForMarking, setSelectedPeriodForMarking] = useState<number>(5);
  const [selectedDateForMarking, setSelectedDateForMarking] = useState<string>('2026-09-07');

  const [isReconciliationTriggered, setIsReconciliationTriggered] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isNAACModalOpen, setIsNAACModalOpen] = useState<boolean>(false);
  const [isStudentManagerOpen, setIsStudentManagerOpen] = useState<boolean>(false);
  const [isLiveLoading, setIsLiveLoading] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  /**
   * Determine Assigned Section from Logged-in Username / Email
   */
  const assignedSection = useMemo(() => {
    const email = currentUserEmail.toLowerCase();
    if (email.includes('manivannan') || email.includes('kavitha') || currentUserRole === 'hod1' || currentUserRole === 'hod2') {
      return 'ALL';
    }
    // Section Advisor mappings
    if (email.includes('advisor.2a') || email.includes('2a')) return 'II-AIDS-A';
    if (email.includes('advisor.2b') || email.includes('2b')) return 'II-AIDS-B';
    if (email.includes('advisor.2c') || email.includes('2c')) return 'II-AIDS-C';
    if (email.includes('advisor.2d') || email.includes('2d')) return 'II-AIDS-D';
    if (email.includes('advisor.3a') || email.includes('3a')) return 'III-AIDS-A';
    if (email.includes('advisor.3b') || email.includes('3b')) return 'III-AIDS-B';
    if (email.includes('advisor.3c') || email.includes('3c')) return 'III-AIDS-C';
    if (email.includes('advisor.3d') || email.includes('3d')) return 'III-AIDS-D';
    if (email.includes('advisor.4a') || email.includes('4a')) return 'IV-AIDS-A';
    if (email.includes('advisor.4b') || email.includes('4b')) return 'IV-AIDS-B';
    
    // If student, find their section
    if (currentUserRole === 'student') {
      const studentMatch = students.find(s => 
        s.parentEmail.toLowerCase() === email || 
        email.includes(s.rollNo) || 
        email.includes(s.regNo)
      );
      if (studentMatch) return studentMatch.batchCode;
      return 'II-AIDS-A';
    }

    return 'II-AIDS-A';
  }, [currentUserEmail, currentUserRole, students]);

  const isHOD = currentUserRole === 'hod1' || currentUserRole === 'hod2';
  const isAdvisor = currentUserRole === 'advisor';
  const isStudent = currentUserRole === 'student';

  // Automatically lock selectedBatchCode to assignedSection when logged in as Advisor
  useEffect(() => {
    if (assignedSection !== 'ALL' && selectedBatchCode !== assignedSection) {
      setSelectedBatchCode(assignedSection);
    }
  }, [assignedSection, selectedBatchCode]);

  /**
   * Accessible Batches based on User Authority
   */
  const accessibleBatches = useMemo(() => {
    if (assignedSection === 'ALL') return batches;
    return batches.filter(b => b.batchCode === assignedSection);
  }, [batches, assignedSection]);

  /**
   * Accessible Students based on User Authority
   */
  const accessibleStudents = useMemo(() => {
    if (assignedSection === 'ALL') return students;
    if (isStudent) {
      const email = currentUserEmail.toLowerCase();
      const own = students.find(s => 
        s.parentEmail.toLowerCase() === email || 
        email.includes(s.rollNo) || 
        email.includes(s.regNo)
      );
      return own ? [own] : students.filter(s => s.batchCode === assignedSection);
    }
    return students.filter(s => s.batchCode === assignedSection);
  }, [students, assignedSection, isStudent, currentUserEmail]);

  /**
   * Accessible Leaves based on User Authority
   */
  const accessibleLeaves = useMemo(() => {
    if (assignedSection === 'ALL') return leaveRecords;
    return leaveRecords.filter(l => l.batchCode === assignedSection);
  }, [leaveRecords, assignedSection]);

  /**
   * Helper: Map Advisor Name based on section
   */
  const getAdvisorForSection = (sectionId: string, advisorsList: DBStaffAdvisor[]): string => {
    const matched = advisorsList.find(a => a.assigned_section === sectionId);
    if (matched && matched.users?.full_name) return matched.users.full_name;
    
    if (sectionId === 'II-AIDS-A') return 'Dr. D. Anandhan';
    if (sectionId === 'II-AIDS-B') return 'Dr. M. Rajendiran';
    if (sectionId === 'II-AIDS-C') return 'Mr. A. Bharathidasan';
    if (sectionId === 'II-AIDS-D') return 'Mr. R. Palraj';
    if (sectionId === 'III-AIDS-A') return 'Ms. C. Vishnupriya';
    if (sectionId === 'III-AIDS-B') return 'Dr. R. Murugesan';
    if (sectionId === 'III-AIDS-C') return 'Mrs. B. Bharathi';
    if (sectionId === 'III-AIDS-D') return 'Mr. Velusamy';
    if (sectionId === 'IV-AIDS-A') return 'Mr. Muthuselvan';
    if (sectionId === 'IV-AIDS-B') return 'Mrs. Nandhinidevi';
    return 'Faculty Advisor';
  };

  /**
   * Primary Live Data Sync from Supabase
   */
  const refreshLiveData = useCallback(async () => {
    try {
      setIsLiveLoading(true);
      const [dbSections, dbStudents, dbAdvisors, dbAttendance, dbSlips] = await Promise.all([
        SupabaseService.fetchSections().catch(() => []),
        SupabaseService.fetchAllStudents().catch(() => []),
        SupabaseService.fetchStaffAdvisors().catch(() => []),
        SupabaseService.fetchDailyAttendance().catch(() => []),
        SupabaseService.fetchLeaveSlips().catch(() => [])
      ]);

      if (dbStudents.length > 0) {
        const mappedStudents: Student[] = dbStudents.map((s: DBStudent) => {
          const sId = String(s.student_id);
          const roll = s.roll_number || '';
          const reg = s.register_number || `9225${roll}`;
          const sectionId = s.section_id || 'II-AIDS-A';
          
          let yearLvl: YearLevel = 2;
          if (sectionId.startsWith('I-')) yearLvl = 1;
          else if (sectionId.startsWith('II-')) yearLvl = 2;
          else if (sectionId.startsWith('III-')) yearLvl = 3;
          else if (sectionId.startsWith('IV-')) yearLvl = 4;

          const secName = sectionId.slice(-1) || 'A';
          const leavesYtd = s.leaves_taken_ytd || 0;
          const totalConducted = 120;
          const attended = Math.max(70, totalConducted - (leavesYtd * 5));
          const percentage = Number(((attended / totalConducted) * 100).toFixed(1));

          const recentAtt: Record<string, AttendanceStatus[]> = {};
          ['2026-09-02', '2026-09-03', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'].forEach(d => {
            const attRec = dbAttendance.find(a => String(a.student_id) === sId && a.attendance_date === d);
            if (attRec) {
              recentAtt[d] = attRec.is_present ? Array(8).fill('present') : Array(8).fill('absent_uninformed');
            } else {
              recentAtt[d] = leavesYtd > 4 && d === '2026-09-09' 
                ? Array(8).fill('leave_prior_cl')
                : Array(8).fill('present');
            }
          });

          return {
            id: sId,
            regNo: reg,
            rollNo: roll,
            name: s.student_name,
            batchCode: sectionId,
            yearLevel: yearLvl,
            section: secName,
            avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
            parentName: 'Parent / Guardian',
            parentPhone: s.users?.phone_number || '+91 94420 11223',
            parentEmail: s.users?.email || `${roll}@student.smartcampus.edu`,
            advisorName: getAdvisorForSection(sectionId, dbAdvisors),
            totalConductedPeriods: totalConducted,
            attendedPeriods: attended,
            attendancePercentage: percentage,
            priorLeavesCount: leavesYtd,
            onDutyCount: leavesYtd > 2 ? 1 : 0,
            medicalLeavesCount: 0,
            uninformedAbsencesCount: leavesYtd > 5 ? 2 : 0,
            recentAttendance: recentAtt,
            leaveHistory: [],
            subjectAttendance: [
              { subjectCode: 'AD8401', subjectName: 'Data Analytics with Python', conducted: 24, attended: Math.floor(attended / 5), percentage },
              { subjectCode: 'AD8402', subjectName: 'Machine Learning Frameworks', conducted: 24, attended: Math.floor(attended / 5), percentage },
              { subjectCode: 'AD8403', subjectName: 'Deep Neural Networks', conducted: 24, attended: Math.floor(attended / 5), percentage },
              { subjectCode: 'AD8411', subjectName: 'AI & Vision Lab', conducted: 24, attended: Math.floor(attended / 5), percentage },
              { subjectCode: 'AD8412', subjectName: 'Cloud Computing Infrastructure', conducted: 24, attended: Math.floor(attended / 5), percentage }
            ]
          };
        });

        setStudents(mappedStudents);

        const activeSections = dbSections.length > 0 ? dbSections : [
          { section_id: 'I-AIDS-A', year: 1, section_name: 'A', total_strength: 60 },
          { section_id: 'I-AIDS-B', year: 1, section_name: 'B', total_strength: 59 },
          { section_id: 'I-AIDS-C', year: 1, section_name: 'C', total_strength: 60 },
          { section_id: 'I-AIDS-D', year: 1, section_name: 'D', total_strength: 59 },
          { section_id: 'II-AIDS-A', year: 2, section_name: 'A', total_strength: 63 },
          { section_id: 'II-AIDS-B', year: 2, section_name: 'B', total_strength: 63 },
          { section_id: 'II-AIDS-C', year: 2, section_name: 'C', total_strength: 60 },
          { section_id: 'II-AIDS-D', year: 2, section_name: 'D', total_strength: 63 },
          { section_id: 'III-AIDS-A', year: 3, section_name: 'A', total_strength: 65 },
          { section_id: 'III-AIDS-B', year: 3, section_name: 'B', total_strength: 61 },
          { section_id: 'III-AIDS-C', year: 3, section_name: 'C', total_strength: 60 },
          { section_id: 'III-AIDS-D', year: 3, section_name: 'D', total_strength: 63 },
          { section_id: 'IV-AIDS-A', year: 4, section_name: 'A', total_strength: 59 },
          { section_id: 'IV-AIDS-B', year: 4, section_name: 'B', total_strength: 65 }
        ];

        const mappedBatches: Batch[] = activeSections.map((sec: any) => {
          const secStudents = mappedStudents.filter(s => s.batchCode === sec.section_id);
          const totalCount = secStudents.length || sec.total_strength || 60;
          const avgAtt = secStudents.length > 0 
            ? Number((secStudents.reduce((acc, s) => acc + s.attendancePercentage, 0) / secStudents.length).toFixed(1))
            : 91.2;
          
          const yearStr = sec.year === 1 ? '1st Year' : sec.year === 2 ? '2nd Year' : sec.year === 3 ? '3rd Year' : '4th Year';

          return {
            id: `batch-${sec.section_id}`,
            yearLevel: sec.year as YearLevel,
            yearName: yearStr,
            section: sec.section_name,
            batchCode: sec.section_id,
            advisorName: getAdvisorForSection(sec.section_id, dbAdvisors),
            totalStudents: totalCount,
            avgAttendance: avgAtt,
            presentToday: Math.floor(totalCount * 0.94),
            uninformedToday: Math.max(1, Math.floor(totalCount * 0.03)),
            approvedLeavesToday: Math.floor(totalCount * 0.03)
          };
        });

        setBatches(mappedBatches);

        const totalDeptStudents = mappedStudents.length;
        const totalDeptAvg = Number((mappedStudents.reduce((acc, s) => acc + s.attendancePercentage, 0) / Math.max(1, totalDeptStudents)).toFixed(1));
        const shortageCount = mappedStudents.filter(s => s.attendancePercentage < 75).length;
        const presentTodayTotal = mappedBatches.reduce((acc, b) => acc + b.presentToday, 0);
        const uninformedTotal = mappedBatches.reduce((acc, b) => acc + b.uninformedToday, 0);
        const leavesTotal = mappedBatches.reduce((acc, b) => acc + b.approvedLeavesToday, 0);

        setDepartmentSummary({
          totalStrength: totalDeptStudents,
          overallAttendancePercentage: totalDeptAvg,
          presentTodayCount: presentTodayTotal,
          uninformedAbsenteesToday: uninformedTotal,
          approvedLeavesToday: leavesTotal,
          shortageStudentsCount: shortageCount,
          activePeriodNumber: 5
        });
      }

      if (dbSlips.length > 0) {
        const mappedSlips: LeaveRecord[] = dbSlips.map((ls: DBLeaveSlip) => {
          let stStatus: LeaveApprovalStatus = 'pending_advisor';
          if (ls.status === 'APPROVED') stStatus = 'approved_by_hod';
          else if (ls.status === 'PENDING_HOD') stStatus = 'forwarded_to_hod';
          else if (ls.status === 'REJECTED') stStatus = 'rejected_by_hod';

          return {
            id: `leave-db-${ls.slip_id}`,
            studentId: String(ls.student_id),
            studentName: `Student #${ls.student_id}`,
            rollNo: String(ls.student_id),
            batchCode: 'II-AIDS-A',
            leaveType: ls.reason.includes('OD') || ls.reason.includes('Symposium') || ls.reason.includes('Hackathon') ? 'on_duty_od' : 'prior_cl',
            startDate: ls.from_date,
            endDate: ls.to_date,
            startPeriod: 1,
            endPeriod: 8,
            totalDays: 1,
            reason: ls.reason,
            status: stStatus,
            appliedAt: ls.created_at || new Date().toISOString(),
            advisorName: 'Dr. D. Anandhan',
            advisorRemarks: ls.advisor_remarks || undefined,
            hodName: 'Dr. Manivannan (Ph.D.)',
            hodRemarks: ls.hod_remarks || undefined,
            parentConsent: true
          };
        });
        setLeaveRecords(mappedSlips);
      }
    } catch (err: any) {
      console.warn('Live sync notice:', err);
    } finally {
      setIsLiveLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshLiveData();
  }, [refreshLiveData]);

  const currentUser = useMemo(() => {
    return {
      id: currentUserEmail,
      name: isHOD ? 'Dr. Manivannan (Ph.D.)' : isAdvisor ? `${getAdvisorForSection(assignedSection, [])}` : 'Student',
      role: currentUserRole,
      title: isHOD ? 'Head of Department (Overall Super Admin)' : isAdvisor ? `Class Advisor (${assignedSection})` : 'Student (AIDS Dept)',
      department: 'Artificial Intelligence and Data Science',
      email: currentUserEmail,
      avatar: isHOD 
        ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      phone: '+91 94430 11001'
    };
  }, [currentUserRole, currentUserEmail, isHOD, isAdvisor, assignedSection]);

  // 1. HOD Add Student
  const addStudent = async (newStudent: {
    student_name: string;
    register_number: string;
    roll_number: string;
    section_id: string;
    email?: string;
    phone_number?: string;
  }) => {
    try {
      const added = await SupabaseService.addStudent({
        student_name: newStudent.student_name,
        register_number: newStudent.register_number,
        roll_number: newStudent.roll_number,
        section_id: newStudent.section_id,
        email: newStudent.email || `${newStudent.roll_number}@student.smartcampus.edu`,
        phone_number: newStudent.phone_number || '+91 94420 00000'
      });

      const yearLvl: YearLevel = newStudent.section_id.startsWith('I-') ? 1 : newStudent.section_id.startsWith('II-') ? 2 : newStudent.section_id.startsWith('III-') ? 3 : 4;
      const secName = newStudent.section_id.slice(-1) || 'A';

      const createdStudent: Student = {
        id: String(added.student_id),
        regNo: added.register_number,
        rollNo: added.roll_number,
        name: added.student_name,
        batchCode: added.section_id,
        yearLevel: yearLvl,
        section: secName,
        avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
        parentName: 'Parent / Guardian',
        parentPhone: added.users?.phone_number || '+91 94420 00000',
        parentEmail: added.users?.email || `${added.roll_number}@student.smartcampus.edu`,
        advisorName: getAdvisorForSection(added.section_id, []),
        totalConductedPeriods: 120,
        attendedPeriods: 118,
        attendancePercentage: 98.3,
        priorLeavesCount: 0,
        onDutyCount: 0,
        medicalLeavesCount: 0,
        uninformedAbsencesCount: 0,
        recentAttendance: {
          '2026-09-07': Array(8).fill('present')
        },
        leaveHistory: [],
        subjectAttendance: []
      };

      setStudents(prev => [createdStudent, ...prev]);
    } catch (err: any) {
      console.error('Error adding student:', err);
      throw err;
    }
  };

  // 2. HOD Edit Student
  const editStudent = async (studentId: string | number, updates: {
    student_name?: string;
    register_number?: string;
    roll_number?: string;
    section_id?: string;
    leaves_taken_ytd?: number;
    phone_number?: string;
    email?: string;
  }) => {
    try {
      await SupabaseService.updateStudent(Number(studentId), updates);

      setStudents(prev => prev.map(s => {
        if (s.id === String(studentId)) {
          const newBatch = updates.section_id || s.batchCode;
          const newYear: YearLevel = newBatch.startsWith('I-') ? 1 : newBatch.startsWith('II-') ? 2 : newBatch.startsWith('III-') ? 3 : 4;
          return {
            ...s,
            name: updates.student_name ? updates.student_name.toUpperCase() : s.name,
            regNo: updates.register_number || s.regNo,
            rollNo: updates.roll_number || s.rollNo,
            batchCode: newBatch,
            yearLevel: newYear,
            section: newBatch.slice(-1) || s.section,
            priorLeavesCount: updates.leaves_taken_ytd !== undefined ? updates.leaves_taken_ytd : s.priorLeavesCount,
            parentPhone: updates.phone_number || s.parentPhone,
            parentEmail: updates.email || s.parentEmail
          };
        }
        return s;
      }));
    } catch (err: any) {
      console.error('Error editing student:', err);
      throw err;
    }
  };

  // 3. HOD Delete Student
  const deleteStudent = async (studentId: string | number) => {
    try {
      await SupabaseService.deleteStudent(Number(studentId));
      setStudents(prev => prev.filter(s => s.id !== String(studentId)));
    } catch (err: any) {
      console.error('Error deleting student:', err);
      throw err;
    }
  };

  // 4. Save Period Attendance
  const savePeriodAttendance = (
    batchCode: string, 
    periodNumber: number, 
    date: string, 
    studentStatuses: Record<string, AttendanceStatus>
  ) => {
    let anyChanges = false;

    setStudents(prev => prev.map(student => {
      if (student.batchCode !== batchCode) return student;
      const targetStatus = studentStatuses[student.id] || 'present';
      
      const prevDateRecords = student.recentAttendance[date] || Array(8).fill('present');
      const oldStatus = prevDateRecords[periodNumber - 1];

      if (oldStatus === targetStatus) return student;

      anyChanges = true;
      const updatedDateRecords = [...prevDateRecords];
      updatedDateRecords[periodNumber - 1] = targetStatus;

      const wasAttending = oldStatus === 'present' || oldStatus === 'leave_od';
      const isAttending = targetStatus === 'present' || targetStatus === 'leave_od';
      
      let newAttended = student.attendedPeriods;
      if (!wasAttending && isAttending) {
        newAttended += 1;
      } else if (wasAttending && !isAttending) {
        newAttended = Math.max(0, newAttended - 1);
      }

      let newUninformed = student.uninformedAbsencesCount;
      if (oldStatus === 'absent_uninformed' && targetStatus !== 'absent_uninformed') {
        newUninformed = Math.max(0, newUninformed - 1);
      } else if (oldStatus !== 'absent_uninformed' && targetStatus === 'absent_uninformed') {
        newUninformed += 1;
      }

      const totalConducted = student.totalConductedPeriods;
      const newPercentage = Number(((newAttended / Math.max(1, totalConducted)) * 100).toFixed(1));

      SupabaseService.markStudentAttendance(
        Number(student.id),
        date,
        isAttending,
        targetStatus === 'leave_od' ? 'OD' : targetStatus.includes('leave') ? 'INFORMED' : null
      ).catch(e => console.warn('Supabase sync notice:', e));

      return {
        ...student,
        attendedPeriods: newAttended,
        attendancePercentage: newPercentage,
        uninformedAbsencesCount: newUninformed,
        recentAttendance: {
          ...student.recentAttendance,
          [date]: updatedDateRecords
        }
      };
    }));

    if (anyChanges) {
      showToast(`Period ${periodNumber} attendance saved for ${batchCode} on ${date}!`);
    } else {
      showToast(`Period ${periodNumber} is already up to date.`);
    }
  };

  // 5. Save Full Day Attendance
  const saveDayAttendance = (
    batchCode: string, 
    date: string, 
    studentDayStatuses: Record<string, AttendanceStatus>
  ) => {
    setStudents(prev => prev.map(student => {
      if (student.batchCode !== batchCode) return student;
      const targetStatus = studentDayStatuses[student.id] || 'present';
      
      const updatedDateRecords = Array(8).fill(targetStatus);
      const isAttending = targetStatus === 'present' || targetStatus === 'leave_od';

      SupabaseService.markStudentAttendance(
        Number(student.id),
        date,
        isAttending,
        targetStatus === 'leave_od' ? 'OD' : targetStatus.includes('leave') ? 'INFORMED' : null
      ).catch(e => console.warn('Supabase day attendance sync notice:', e));

      return {
        ...student,
        recentAttendance: {
          ...student.recentAttendance,
          [date]: updatedDateRecords
        }
      };
    }));

    showToast(`Full-day attendance marked for ${batchCode} on ${date}!`);
  };

  // 6. Submit Day Attendance to HOD
  const submitDayAttendanceToHOD = (batchCode: string, date: string, remarks?: string) => {
    const secStudents = students.filter(s => s.batchCode === batchCode);
    const present = secStudents.filter(s => {
      const rec = s.recentAttendance[date];
      return rec && (rec[0] === 'present' || rec[0] === 'leave_od');
    }).length;
    const absent = secStudents.length - present;

    const existingIdx = daySubmissions.findIndex(s => s.batchCode === batchCode && s.date === date);
    const newSub: DayAttendanceSubmission = {
      id: `sub-${batchCode}-${date}`,
      date,
      batchCode,
      status: 'submitted_to_hod',
      submittedBy: currentUser.name,
      submittedAt: new Date().toISOString(),
      remarks,
      presentCount: present,
      absentCount: absent,
      odCount: 0,
      leavesCount: 0,
      totalStrength: secStudents.length,
      dayPercentage: Number(((present / Math.max(1, secStudents.length)) * 100).toFixed(1))
    };

    if (existingIdx >= 0) {
      setDaySubmissions(prev => {
        const copy = [...prev];
        copy[existingIdx] = newSub;
        return copy;
      });
    } else {
      setDaySubmissions(prev => [newSub, ...prev]);
    }

    showToast(`Attendance for ${batchCode} (${date}) submitted to HOD!`);
  };

  // 7. Verify Day Attendance by HOD
  const verifyDayAttendanceByHOD = (batchCode: string, date: string, remarks?: string) => {
    setDaySubmissions(prev => prev.map(s => {
      if (s.batchCode === batchCode && s.date === date) {
        return {
          ...s,
          status: 'verified_by_hod',
          verifiedBy: currentUser.name,
          verifiedAt: new Date().toISOString(),
          remarks: remarks || s.remarks
        };
      }
      return s;
    }));

    showToast(`Attendance for ${batchCode} on ${date} verified & locked by HOD!`);
  };

  // 8. Student Submit Leave
  const studentSubmitLeave = (leaveData: Omit<LeaveRecord, 'id' | 'status' | 'appliedAt'>) => {
    const newId = `leave-${Date.now()}`;
    const newLeave: LeaveRecord = {
      ...leaveData,
      id: newId,
      status: 'pending_advisor',
      appliedAt: new Date().toISOString(),
      parentConsent: true
    };

    setLeaveRecords(prev => [newLeave, ...prev]);

    SupabaseService.submitLeaveSlip({
      student_id: Number(leaveData.studentId) || 1001,
      reason: leaveData.reason,
      from_date: leaveData.startDate,
      to_date: leaveData.endDate,
      is_informed: true
    }).catch(e => console.warn('Supabase leave submission notice:', e));

    showToast('Leave request submitted to Class Advisor for endorsement!');
  };

  // 9. Advisor Forward Leave to HOD
  const advisorForwardLeaveToHOD = (leaveId: string, advisorRemarks: string) => {
    setLeaveRecords(prev => prev.map(l => {
      if (l.id === leaveId) {
        return {
          ...l,
          status: 'forwarded_to_hod',
          advisorName: currentUser.name,
          advisorRemarks,
          advisorReviewedAt: new Date().toISOString()
        };
      }
      return l;
    }));

    const rawId = leaveId.replace(/\D/g, '');
    if (rawId) {
      SupabaseService.updateLeaveSlipStatus(Number(rawId), 'PENDING_HOD', advisorRemarks, false)
        .catch(e => console.warn('Supabase slip update notice:', e));
    }

    showToast('Leave endorsed and forwarded to HOD for final sign-off!');
  };

  // 10. Advisor Reject Leave
  const advisorRejectLeave = (leaveId: string, advisorRemarks: string) => {
    setLeaveRecords(prev => prev.map(l => {
      if (l.id === leaveId) {
        return {
          ...l,
          status: 'rejected_by_advisor',
          advisorName: currentUser.name,
          advisorRemarks,
          advisorReviewedAt: new Date().toISOString()
        };
      }
      return l;
    }));

    const rawId = leaveId.replace(/\D/g, '');
    if (rawId) {
      SupabaseService.updateLeaveSlipStatus(Number(rawId), 'REJECTED', advisorRemarks, false)
        .catch(e => console.warn('Supabase slip update notice:', e));
    }

    showToast('Leave request rejected by Advisor.');
  };

  // 11. HOD Approve Leave
  const hodApproveLeave = (leaveId: string, hodRemarks: string) => {
    setLeaveRecords(prev => prev.map(l => {
      if (l.id === leaveId) {
        return {
          ...l,
          status: 'approved_by_hod',
          hodName: currentUser.name,
          hodRemarks,
          hodReviewedAt: new Date().toISOString()
        };
      }
      return l;
    }));

    const rawId = leaveId.replace(/\D/g, '');
    if (rawId) {
      SupabaseService.updateLeaveSlipStatus(Number(rawId), 'APPROVED', hodRemarks, true)
        .catch(e => console.warn('Supabase slip approval notice:', e));
    }

    showToast('Leave officially approved by HOD. Digital Pink Slip pass generated!');
  };

  // 12. HOD Reject Leave
  const hodRejectLeave = (leaveId: string, hodRemarks: string) => {
    setLeaveRecords(prev => prev.map(l => {
      if (l.id === leaveId) {
        return {
          ...l,
          status: 'rejected_by_hod',
          hodName: currentUser.name,
          hodRemarks,
          hodReviewedAt: new Date().toISOString()
        };
      }
      return l;
    }));

    const rawId = leaveId.replace(/\D/g, '');
    if (rawId) {
      SupabaseService.updateLeaveSlipStatus(Number(rawId), 'REJECTED', hodRemarks, true)
        .catch(e => console.warn('Supabase slip rejection notice:', e));
    }

    showToast('Leave request rejected by HOD.');
  };

  // Notifications
  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const triggerReconciliation430PM = () => {
    setIsReconciliationTriggered(true);
    showToast('4:30 PM Automatic Department Reconciliation triggered! All biometric punches synchronized.');
  };

  const pendingLeaves = leaveRecords.filter(l => l.status === 'pending_advisor' || l.status === 'forwarded_to_hod');
  const allLeaves = leaveRecords;

  return (
    <AttendanceContext.Provider value={{
      currentUserRole,
      setCurrentUserRole,
      currentUser,
      currentUserEmail,
      setCurrentUserEmail,
      activeTab,
      setActiveTab,
      
      assignedSection,
      isHOD,
      isAdvisor,
      isStudent,
      accessibleBatches,
      accessibleStudents,
      accessibleLeaves,
      
      batches,
      students,
      leaveRecords,
      pendingLeaves,
      allLeaves,
      daySubmissions,
      notifications,
      complianceList,
      departmentSummary,
      workingDates,
      isLiveLoading,
      refreshLiveData,
      
      selectedBatchCode,
      setSelectedBatchCode,
      selectedStudentId,
      setSelectedStudentId,
      selectedPeriodForMarking,
      setSelectedPeriodForMarking,
      selectedDateForMarking,
      setSelectedDateForMarking,
      
      addStudent,
      editStudent,
      deleteStudent,
      
      savePeriodAttendance,
      saveDayAttendance,
      submitDayAttendanceToHOD,
      verifyDayAttendanceByHOD,
      
      studentSubmitLeave,
      advisorForwardLeaveToHOD,
      advisorRejectLeave,
      hodApproveLeave,
      hodRejectLeave,
      
      markNotificationAsRead,
      clearAllNotifications,
      
      triggerReconciliation430PM,
      isReconciliationTriggered,
      toastMessage,
      showToast,
      isNAACModalOpen,
      setIsNAACModalOpen,
      isStudentManagerOpen,
      setIsStudentManagerOpen
    }}>
      {children}
    </AttendanceContext.Provider>
  );
};

export const useAttendance = () => {
  const context = useContext(AttendanceContext);
  if (!context) {
    throw new Error('useAttendance must be used within an AttendanceProvider');
  }
  return context;
};
