import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseClient';
import { Student, Batch, LeaveRecord, User, DayAttendanceSubmission, AttendanceStatus } from '../types';

export interface DBSection {
  section_id: string;
  year: number;
  section_name: string;
  department: string;
  total_strength: number;
  academic_year?: string;
}

export interface DBStudent {
  student_id: number;
  roll_number: string;
  register_number: string;
  section_id: string;
  student_name: string;
  leaves_taken_ytd: number;
  face_encoding?: string | null;
  users?: {
    email?: string;
    phone_number?: string;
    avatar_url?: string;
    is_active?: boolean;
  };
}

export interface DBStaffAdvisor {
  staff_id: number;
  staff_code: string;
  assigned_section: string;
  designation: string;
  cabin_location: string;
  users?: {
    email: string;
    full_name: string;
    phone_number: string;
    role: string;
  };
}

export interface DBDailyAttendance {
  attendance_id: number;
  student_id: number;
  attendance_date: string;
  is_present: boolean;
  leave_type?: string | null;
  in_time?: string | null;
  out_time?: string | null;
  punch_method?: string;
  marked_by?: number | null;
  marked_at?: string;
  updated_at?: string;
}

export interface DBLeaveSlip {
  slip_id: number;
  student_id: number;
  reason: string;
  from_date: string;
  to_date: string;
  is_informed: boolean;
  letter_document_url?: string | null;
  letter_submitted_to_advisor_date?: string | null;
  forwarded_to_hod_date?: string | null;
  due_date?: string | null;
  status: 'SUBMITTED' | 'PENDING_HOD' | 'APPROVED' | 'REJECTED';
  advisor_remarks?: string | null;
  hod_remarks?: string | null;
  approved_by_hod_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DBAcademicCalendar {
  calendar_id: number;
  event_date: string;
  event_type: 'HOLIDAY' | 'EXAM' | 'REVISION' | 'WORKING' | 'SPECIAL';
  event_name: string;
  is_working_day: boolean;
}

export interface DBPromotion {
  promotion_id: number;
  from_year: number;
  to_year: number;
  section: string;
  batch_year: string;
  semester_completed: number;
  semester_end_date: string;
  grace_transition_days: number;
  eligible_promotion_date: string;
  total_students: number;
  status: 'PENDING_ADVISOR' | 'FORWARDED_TO_HOD' | 'APPROVED_BY_HOD' | 'REJECTED';
  advisor_name?: string;
  advisor_remarks?: string;
  date_forwarded_by_advisor?: string;
  hod_name?: string;
  hod_remarks?: string;
  date_approved_by_hod?: string;
}

export class SupabaseService {
  /**
   * Helper to get current session access token
   */
  private static async getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  /**
   * 1. Fetch all Sections / Batches
   */
  static async fetchSections(): Promise<DBSection[]> {
    const { data, error } = await supabase
      .from('sections')
      .select('*')
      .order('year', { ascending: true })
      .order('section_name', { ascending: true });

    if (error) {
      console.warn('Error fetching sections, using fallback direct query:', error.message);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/sections?select=*&order=year.asc,section_name.asc`, {
        headers: await this.getAuthHeaders()
      });
      if (res.ok) return await res.json();
      throw error;
    }
    return data || [];
  }

  /**
   * 2. Fetch all Staff Advisors with linked user details
   */
  static async fetchStaffAdvisors(): Promise<DBStaffAdvisor[]> {
    const { data, error } = await supabase
      .from('staff_advisors')
      .select(`
        staff_id,
        staff_code,
        assigned_section,
        designation,
        cabin_location,
        users (
          email,
          full_name,
          phone_number,
          role
        )
      `);

    if (error) {
      console.warn('Error fetching staff advisors with join:', error.message);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/staff_advisors?select=*,users(*)`, {
        headers: await this.getAuthHeaders()
      });
      if (res.ok) return await res.json();
      return [];
    }
    return (data as unknown as DBStaffAdvisor[]) || [];
  }

  /**
   * 3. Fetch all Students with their user details
   */
  static async fetchAllStudents(): Promise<DBStudent[]> {
    const { data, error } = await supabase
      .from('students')
      .select(`
        student_id,
        roll_number,
        register_number,
        section_id,
        student_name,
        leaves_taken_ytd,
        face_encoding,
        users (
          email,
          phone_number,
          avatar_url,
          is_active
        )
      `)
      .order('section_id', { ascending: true })
      .order('roll_number', { ascending: true });

    if (error) {
      console.warn('Error fetching students via client:', error.message);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/students?select=*,users(*)&order=section_id.asc,roll_number.asc`, {
        headers: await this.getAuthHeaders()
      });
      if (res.ok) return await res.json();
      throw error;
    }
    return (data as unknown as DBStudent[]) || [];
  }

  /**
   * 4. Fetch Daily Attendance Records
   */
  static async fetchDailyAttendance(fromDate?: string, toDate?: string): Promise<DBDailyAttendance[]> {
    let query = supabase.from('daily_attendance').select('*');
    if (fromDate) query = query.gte('attendance_date', fromDate);
    if (toDate) query = query.lte('attendance_date', toDate);

    const { data, error } = await query.order('attendance_date', { ascending: false });
    if (error) {
      console.warn('Error fetching daily attendance:', error.message);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/daily_attendance?select=*&order=attendance_date.desc`, {
        headers: await this.getAuthHeaders()
      });
      if (res.ok) return await res.json();
      return [];
    }
    return data || [];
  }

  /**
   * 5. Fetch Leave Slips
   */
  static async fetchLeaveSlips(): Promise<DBLeaveSlip[]> {
    const { data, error } = await supabase
      .from('leave_slips')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching leave slips:', error.message);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/leave_slips?select=*&order=created_at.desc`, {
        headers: await this.getAuthHeaders()
      });
      if (res.ok) return await res.json();
      return [];
    }
    return data || [];
  }

  /**
   * 6. Fetch Academic Calendar
   */
  static async fetchAcademicCalendar(): Promise<DBAcademicCalendar[]> {
    const { data, error } = await supabase
      .from('academic_calendar')
      .select('*')
      .order('event_date', { ascending: true });

    if (error) {
      console.warn('Error fetching academic calendar:', error.message);
      return [];
    }
    return data || [];
  }

  /**
   * 7. Fetch Batch Promotions
   */
  static async fetchPromotions(): Promise<DBPromotion[]> {
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .order('promotion_id', { ascending: true });

    if (error) {
      console.warn('Error fetching promotions:', error.message);
      return [];
    }
    return data || [];
  }

  /**
   * ──────────────── HOD SUPER-ADMIN CRUD OPERATIONS ────────────────
   */

  /**
   * Add a new student (Both users and students tables)
   */
  static async addStudent(newStudent: {
    student_name: string;
    register_number: string;
    roll_number: string;
    section_id: string;
    email: string;
    phone_number: string;
  }): Promise<DBStudent> {
    const nextUserId = Math.floor(2000 + Math.random() * 90000);
    const headers = await this.getAuthHeaders();

    // 1. Insert into public.users
    const userPayload = {
      user_id: nextUserId,
      email: newStudent.email || `${newStudent.roll_number}@student.smartcampus.edu`,
      full_name: newStudent.student_name.toUpperCase(),
      role: 'STUDENT',
      phone_number: newStudent.phone_number || '+91 94420 00000',
      is_active: true
    };

    const resUser = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify(userPayload)
    });

    if (!resUser.ok) {
      const errText = await resUser.text();
      console.warn('User insert warning (might already exist or use fallback):', errText);
    }

    // 2. Insert into public.students
    const studentPayload = {
      student_id: nextUserId,
      roll_number: newStudent.roll_number,
      register_number: newStudent.register_number,
      section_id: newStudent.section_id,
      student_name: newStudent.student_name.toUpperCase(),
      leaves_taken_ytd: 0
    };

    const resStudent = await fetch(`${SUPABASE_URL}/rest/v1/students`, {
      method: 'POST',
      headers,
      body: JSON.stringify(studentPayload)
    });

    if (!resStudent.ok) {
      const errText = await resStudent.text();
      console.warn('Supabase student insert notice:', errText);
    }

    // Return the formatted student object
    return {
      student_id: nextUserId,
      roll_number: newStudent.roll_number,
      register_number: newStudent.register_number,
      section_id: newStudent.section_id,
      student_name: newStudent.student_name.toUpperCase(),
      leaves_taken_ytd: 0,
      users: {
        email: userPayload.email,
        phone_number: userPayload.phone_number,
        is_active: true
      }
    };
  }

  /**
   * Update student details (Register number, Roll number, Name, Section, Leaves, Phone)
   */
  static async updateStudent(
    studentId: number,
    updates: {
      student_name?: string;
      register_number?: string;
      roll_number?: string;
      section_id?: string;
      leaves_taken_ytd?: number;
      phone_number?: string;
      email?: string;
    }
  ): Promise<boolean> {
    const headers = await this.getAuthHeaders();

    // 1. Update students table
    const studentFields: Record<string, any> = {};
    if (updates.student_name !== undefined) studentFields.student_name = updates.student_name.toUpperCase();
    if (updates.register_number !== undefined) studentFields.register_number = updates.register_number;
    if (updates.roll_number !== undefined) studentFields.roll_number = updates.roll_number;
    if (updates.section_id !== undefined) studentFields.section_id = updates.section_id;
    if (updates.leaves_taken_ytd !== undefined) studentFields.leaves_taken_ytd = updates.leaves_taken_ytd;

    if (Object.keys(studentFields).length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/students?student_id=eq.${studentId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(studentFields)
      });
    }

    // 2. Update users table
    const userFields: Record<string, any> = {};
    if (updates.student_name !== undefined) userFields.full_name = updates.student_name.toUpperCase();
    if (updates.email !== undefined) userFields.email = updates.email;
    if (updates.phone_number !== undefined) userFields.phone_number = updates.phone_number;

    if (Object.keys(userFields).length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/users?user_id=eq.${studentId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(userFields)
      });
    }

    return true;
  }

  /**
   * Delete student
   */
  static async deleteStudent(studentId: number): Promise<boolean> {
    const headers = await this.getAuthHeaders();

    // Delete student attendance first
    await fetch(`${SUPABASE_URL}/rest/v1/daily_attendance?student_id=eq.${studentId}`, {
      method: 'DELETE',
      headers
    });

    // Delete student leave slips
    await fetch(`${SUPABASE_URL}/rest/v1/leave_slips?student_id=eq.${studentId}`, {
      method: 'DELETE',
      headers
    });

    // Delete student record
    await fetch(`${SUPABASE_URL}/rest/v1/students?student_id=eq.${studentId}`, {
      method: 'DELETE',
      headers
    });

    // Delete user record
    await fetch(`${SUPABASE_URL}/rest/v1/users?user_id=eq.${studentId}`, {
      method: 'DELETE',
      headers
    });

    return true;
  }

  /**
   * Mark / Upsert Attendance for a Student on a Date
   */
  static async markStudentAttendance(
    studentId: number,
    date: string,
    isPresent: boolean,
    leaveType?: string | null,
    markedBy?: number
  ): Promise<boolean> {
    const headers = await this.getAuthHeaders();
    headers['Prefer'] = 'resolution=merge-duplicates';

    const payload = {
      student_id: studentId,
      attendance_date: date,
      is_present: isPresent,
      leave_type: leaveType || null,
      punch_method: 'MANUAL_OVERRIDE',
      in_time: isPresent ? '08:45:00' : null,
      out_time: isPresent ? '16:30:00' : null,
      marked_by: markedBy || 101,
      updated_at: new Date().toISOString()
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/daily_attendance`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    return res.ok;
  }

  /**
   * Update Leave Slip Status (Approve / Reject by Advisor or HOD)
   */
  static async updateLeaveSlipStatus(
    slipId: number,
    status: 'PENDING_HOD' | 'APPROVED' | 'REJECTED',
    remarks: string,
    isHOD: boolean = false
  ): Promise<boolean> {
    const headers = await this.getAuthHeaders();

    const payload: Record<string, any> = {
      status,
      updated_at: new Date().toISOString()
    };

    if (isHOD) {
      payload.hod_remarks = remarks;
      if (status === 'APPROVED') {
        payload.approved_by_hod_date = new Date().toISOString();
      }
    } else {
      payload.advisor_remarks = remarks;
      if (status === 'PENDING_HOD') {
        payload.forwarded_to_hod_date = new Date().toISOString();
      }
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/leave_slips?slip_id=eq.${slipId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload)
    });

    return res.ok;
  }

  /**
   * Create a new Leave Slip (Student Request)
   */
  static async submitLeaveSlip(slip: {
    student_id: number;
    reason: string;
    from_date: string;
    to_date: string;
    is_informed: boolean;
  }): Promise<DBLeaveSlip | null> {
    const headers = await this.getAuthHeaders();
    headers['Prefer'] = 'return=representation';

    const payload = {
      student_id: slip.student_id,
      reason: slip.reason,
      from_date: slip.from_date,
      to_date: slip.to_date,
      is_informed: slip.is_informed,
      status: 'SUBMITTED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/leave_slips`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data[0] : data;
    }
    return null;
  }
}
