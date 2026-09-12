# PinkSlipWeb — Academic Department Pink Slip & Attendance Intelligence Portal

A full-featured, production-ready **Pink Slip & Student Attendance Intelligence Portal** for the **Artificial Intelligence & Data Science (AIDS) Department**, powered by **React 18, TypeScript, Tailwind CSS, Vite**, and connected directly to **Supabase**.

---

## 🌟 Key Features

1. **Common Unified Login Dashboard**:
   - Single clean login screen for HODs, Faculty Class Advisors, and Students.
   - Quick Demo Multi-Account Selector bar for instant testing of all 12 staff accounts and student logins.
   - Live Supabase token authentication and session persistence.

2. **HOD Super-Admin Cockpit**:
   - Complete access to **Add, Edit, and Delete** any student record across the entire AIDS department (622+ students across 10 sections: II AIDS A-D, III AIDS A-D, IV AIDS A-B).
   - Real-time department statistics, section breakdown, detention risk radar (<75%), and faculty compliance monitoring.
   - 1-Click NAAC/NBA Register Exporter (in CSV and Excel `.xlsx` formats).

3. **8-Period Smart Attendance Grid & Monthly Calendar**:
   - Class advisors can mark attendance period-by-period or day-by-day.
   - 1-Click "Mark All Present" with instant tap-to-toggle for absentees.
   - Auto-locks approved Prior Casual Leave (CL), On-Duty (OD), or Medical Leave (ML) students.

4. **Digital Pink Slip Pass & 2-Tier Leave Workflow**:
   - Students can apply for On-Duty (OD), Medical Leave (ML), or Casual Leave (CL).
   - 2-Tier review and approval pipeline: Student ➔ Class Advisor ➔ HOD.
   - Instant printable/digital Pink Slip Pass with dynamic QR code verification.

5. **Student 360° Attendance Dossier**:
   - Personal attendance heatmap matrix across periods and dates.
   - Subject-wise percentage progress bars with minimum 75% threshold indicator.
   - Chronological leave history and digital slip download.

---

## 🛠️ Tech Stack & Database

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, SheetJS (`xlsx`)
- **Backend / Database**: Supabase PostgreSQL
  - `PROJECT_URL`: `https://dpjsecqjcfgytcdxaksy.supabase.co`
  - `PROJECT_ANON_KEY`: Configured in `.env` and `.env.example`
  - Database schema & migrations located in `supabase/migrations/`

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Create a `.env` file in the root directory (or copy from `.env.example`):
```env
VITE_SUPABASE_URL=https://dpjsecqjcfgytcdxaksy.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwanNlY3FqY2ZneXRjZHhha3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NDY1NzQsImV4cCI6MjEwNDUyMjU3NH0.RVGZAA_FemXXDh8Nxg3GkjM56MSe7GJ2Wf_F2DlGnd0
```

### 3. Run Development Server
```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or the port specified by Vite).

### 4. Build for Production
```bash
npm run build
```

---

## 📁 Project Structure

```
PinkSlipWeb/
├── .env.example                # Supabase environment variables template
├── AIDS student count.xlsx     # Department student records & roster data
├── index.html                  # HTML entry point
├── package.json                # Dependencies and scripts
├── src/
│   ├── App.tsx                 # Main application layout & view switcher
│   ├── components/
│   │   ├── ai/                 # Jarvis AI Attendance Assistant
│   │   ├── analytics/          # Department analytics & charts
│   │   ├── attendance/         # 8-Period attendance marking grid
│   │   ├── auth/               # Common unified login screen
│   │   ├── calendar/           # Monthly attendance calendar
│   │   ├── cloud/              # Cloud backup & NAAC accreditation view
│   │   ├── export/             # Excel (.xlsx) and CSV export/import
│   │   ├── hod/                # HOD Cockpit & student management modal
│   │   ├── layout/             # Top navbar header & collapsible sidebar
│   │   ├── leave/              # Leave triage & 2-tier workflow center
│   │   └── student/            # Student dossier & digital Pink Slip pass
│   ├── context/
│   │   ├── AttendanceContext.tsx # Central state management & Supabase sync
│   │   └── ThemeContext.tsx      # Dark/Light theme mode
│   ├── data/
│   │   ├── mockData.json       # Pre-extracted 622 student dataset & batches
│   │   └── mockData.ts         # User profiles & data fallback handlers
│   └── services/
│       ├── supabaseClient.ts   # Supabase client initialization
│       └── supabaseService.ts  # Database CRUD, Auth & Sync API layer
└── supabase/
    └── migrations/             # Production SQL migration files
```
