-- ==============================================================================
-- PinkSlipReport Master Setup for Supabase Project: dpjsecqjcfgytcdxaksy
-- Execute this entire script in Supabase Dashboard -> SQL Editor
-- (https://supabase.com/dashboard/project/dpjsecqjcfgytcdxaksy/sql/new)
-- ==============================================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- 1. Departments Table
create table if not exists public.departments (
    id text primary key,
    name text not null unique,
    code text not null unique,
    created_at timestamptz not null default now()
);

-- 2. Profiles Table
create table if not exists public.profiles (
    id text primary key,
    name text not null,
    email text not null unique,
    role text not null check(role in ('super_admin','hod','advisor','student')),
    department_id text references public.departments(id) on delete set null,
    active boolean not null default true,
    created_at timestamptz not null default now()
);

-- 3. Classes Table
create table if not exists public.classes (
    id text primary key,
    department_id text not null references public.departments(id) on delete cascade,
    year integer not null check(year between 1 and 4),
    course_years integer not null default 4,
    section text not null,
    batch integer not null,
    advisor_id text references public.profiles(id) on delete set null,
    active boolean not null default true,
    promotion_due date not null default '2027-06-30',
    created_at timestamptz not null default now()
);

-- 4. Students Table
create table if not exists public.students (
    id text primary key,
    class_id text not null references public.classes(id) on delete cascade,
    user_id text references public.profiles(id) on delete set null,
    name text not null,
    register_number text not null unique,
    phone text not null default '',
    parent_name text not null default '',
    parent_phone text not null default '',
    email text not null default '',
    degree text not null default 'B.Tech AI & DS',
    active boolean not null default true,
    completed_at timestamptz,
    created_at timestamptz not null default now()
);

-- 5. Attendance Table
create table if not exists public.attendance (
    id text primary key,
    student_id text not null references public.students(id) on delete cascade,
    day date not null,
    status text not null check(status in ('present','informed','uninformed')),
    marked_by text references public.profiles(id) on delete set null,
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    unique(student_id, day)
);

-- 6. Leaves / Pink Slips Table
create table if not exists public.leaves (
    id text primary key default gen_random_uuid()::text,
    student_id text not null references public.students(id) on delete cascade,
    start_date date not null,
    end_date date not null,
    kind text not null check(kind in ('informed','uninformed')),
    reason text not null,
    letter_path text,
    call_id text,
    status text not null default 'pending' check(status in ('pending','approved','declined')),
    decision_note text not null default '',
    created_by text references public.profiles(id) on delete set null,
    reviewed_by text references public.profiles(id) on delete set null,
    reviewed_at timestamptz,
    created_at timestamptz not null default now()
);

-- 7. Call Records Table
create table if not exists public.call_records (
    id text primary key default gen_random_uuid()::text,
    student_id text not null references public.students(id) on delete cascade,
    advisor_id text references public.profiles(id) on delete set null,
    recording_path text not null,
    parent_response text not null default '',
    consent_confirmed boolean not null default true,
    created_at timestamptz not null default now()
);

-- 8. Promotions Table
create table if not exists public.promotions (
    id text primary key default gen_random_uuid()::text,
    class_id text not null references public.classes(id) on delete cascade,
    from_year integer not null check(from_year between 1 and 4),
    status text not null default 'pending' check(status in ('pending','approved','declined')),
    requested_by text references public.profiles(id) on delete set null,
    reviewed_by text references public.profiles(id) on delete set null,
    created_at timestamptz not null default now()
);

-- 9. Notifications Table
create table if not exists public.notifications (
    id text primary key default gen_random_uuid()::text,
    recipient_id text not null references public.profiles(id) on delete cascade,
    message text not null,
    student_id text references public.students(id) on delete cascade,
    read_at timestamptz,
    created_at timestamptz not null default now()
);

-- 10. Audit Logs Table
create table if not exists public.audit_logs (
    id bigint generated always as identity primary key,
    actor text,
    entity text not null,
    record_id text,
    operation text not null,
    before_data jsonb,
    after_data jsonb,
    created_at timestamptz not null default now()
);

-- 11. Calendar Events Table
create table if not exists public.calendar_events (
    id text primary key,
    department_id text references public.departments(id) on delete set null,
    title text not null,
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    updated_at timestamptz not null default now()
);

-- 12. Timetable Entries Table
create table if not exists public.timetable_entries (
    id text primary key default gen_random_uuid()::text,
    class_id text not null references public.classes(id) on delete cascade,
    weekday integer not null check(weekday between 1 and 7),
    period integer not null check(period between 1 and 20),
    subject text not null,
    teacher text not null default '',
    room text not null default '',
    starts_at time not null,
    ends_at time not null,
    created_at timestamptz not null default now()
);

-- 13. Notices Table
create table if not exists public.notices (
    id text primary key default gen_random_uuid()::text,
    department_id text references public.departments(id) on delete set null,
    title text not null,
    body text not null,
    created_at timestamptz not null default now()
);

-- 14. Enable RLS and create full open access policies for anonymous and authenticated clients
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN select tablename from pg_tables where schemaname = 'public'
    LOOP
        EXECUTE format('alter table public.%I enable row level security;', tbl);
        EXECUTE format('drop policy if exists "allow_all_%s" on public.%I;', tbl, tbl);
        EXECUTE format('create policy "allow_all_%s" on public.%I for all to anon, authenticated using (true) with check (true);', tbl, tbl);
        EXECUTE format('grant all on public.%I to anon, authenticated, service_role;', tbl);
    END LOOP;
END
$$;

-- 15. Seed Departments
insert into public.departments (id, name, code) values
('dept-aids', 'Artificial Intelligence & Data Science', 'AI & DS'),
('dept-cse', 'Computer Science & Engineering', 'CSE'),
('dept-ece', 'Electronics & Communication Engineering', 'ECE')
on conflict (id) do update set name = excluded.name, code = excluded.code;

-- 16. Seed Faculty & HOD Profiles
insert into public.profiles (id, name, email, role, department_id, active) values
('u-hod-aids', 'Dr. K. Manivannan', 'hod.manivannan@vsb.edu.in', 'hod', 'dept-aids', true),
('u-super-admin', 'Principal / Super Admin', 'admin@vsb.edu.in', 'super_admin', null, true),
('u-adv-3a', 'Ms. C. Vishnupriya', 'advisor.vishnupriya@vsb.edu.in', 'advisor', 'dept-aids', true),
('u-adv-3b', 'Dr. R. Murugesan', 'advisor.murugesan@vsb.edu.in', 'advisor', 'dept-aids', true),
('u-adv-3c', 'Mrs. B. Bharathi', 'advisor.bharathi@vsb.edu.in', 'advisor', 'dept-aids', true),
('u-adv-3d', 'Mr. V. Velusamy', 'advisor.velusamy@vsb.edu.in', 'advisor', 'dept-aids', true)
on conflict (id) do update set name = excluded.name, email = excluded.email, role = excluded.role, department_id = excluded.department_id, active = excluded.active;

-- 17. Seed Classes (Year 1-3: A,B,C,D; Year 4: A,B)
insert into public.classes (id, department_id, year, course_years, section, batch, advisor_id, active, promotion_due) values
('class-1a', 'dept-aids', 1, 4, 'A', 2026, null, true, '2027-06-30'),
('class-1b', 'dept-aids', 1, 4, 'B', 2026, null, true, '2027-06-30'),
('class-1c', 'dept-aids', 1, 4, 'C', 2026, null, true, '2027-06-30'),
('class-1d', 'dept-aids', 1, 4, 'D', 2026, null, true, '2027-06-30'),
('class-2a', 'dept-aids', 2, 4, 'A', 2025, null, true, '2027-06-30'),
('class-2b', 'dept-aids', 2, 4, 'B', 2025, null, true, '2027-06-30'),
('class-2c', 'dept-aids', 2, 4, 'C', 2025, null, true, '2027-06-30'),
('class-2d', 'dept-aids', 2, 4, 'D', 2025, null, true, '2027-06-30'),
('class-3a', 'dept-aids', 3, 4, 'A', 2024, 'u-adv-3a', true, '2027-06-30'),
('class-3b', 'dept-aids', 3, 4, 'B', 2024, 'u-adv-3b', true, '2027-06-30'),
('class-3c', 'dept-aids', 3, 4, 'C', 2024, 'u-adv-3c', true, '2027-06-30'),
('class-3d', 'dept-aids', 3, 4, 'D', 2024, 'u-adv-3d', true, '2027-06-30'),
('class-4a', 'dept-aids', 4, 4, 'A', 2023, null, true, '2027-06-30'),
('class-4b', 'dept-aids', 4, 4, 'B', 2023, null, true, '2027-06-30')
on conflict (id) do update set year = excluded.year, section = excluded.section, batch = excluded.batch, advisor_id = excluded.advisor_id, active = excluded.active;

-- 18. Seed 3rd Year Students (249 Records)
insert into public.students (id, class_id, name, register_number, degree, email, phone, parent_name, parent_phone, active) values
('s-3-001', 'class-3a', 'ABINAYA K', '922524243001', 'B.Tech AI & DS', '922524243001@vsb.edu.in', '', '', '', true),
('s-3-002', 'class-3a', 'ABINAYA S', '922524243002', 'B.Tech AI & DS', '922524243002@vsb.edu.in', '', '', '', true),
('s-3-003', 'class-3a', 'ABISHECK S', '922524243003', 'B.Tech AI & DS', '922524243003@vsb.edu.in', '', '', '', true),
('s-3-004', 'class-3a', 'ABISHEK K', '922524243004', 'B.Tech AI & DS', '922524243004@vsb.edu.in', '', '', '', true),
('s-3-005', 'class-3a', 'ABITHA K', '922524243005', 'B.Tech AI & DS', '922524243005@vsb.edu.in', '', '', '', true),
('s-3-006', 'class-3a', 'ABUBAKKAR SIDDIQ J', '922524243006', 'B.Tech AI & DS', '922524243006@vsb.edu.in', '', '', '', true),
('s-3-007', 'class-3a', 'AKASH I', '922524243007', 'B.Tech AI & DS', '922524243007@vsb.edu.in', '', '', '', true),
('s-3-008', 'class-3a', 'AKIL S', '922524243008', 'B.Tech AI & DS', '922524243008@vsb.edu.in', '', '', '', true),
('s-3-009', 'class-3a', 'AKILANDASWARI V', '922524243009', 'B.Tech AI & DS', '922524243009@vsb.edu.in', '', '', '', true),
('s-3-010', 'class-3a', 'AKILESHWARAN R', '922524243010', 'B.Tech AI & DS', '922524243010@vsb.edu.in', '', '', '', true),
('s-3-011', 'class-3a', 'AKSHAYA D', '922524243011', 'B.Tech AI & DS', '922524243011@vsb.edu.in', '', '', '', true),
('s-3-012', 'class-3a', 'AMUTHASURIYAN J', '922524243012', 'B.Tech AI & DS', '922524243012@vsb.edu.in', '', '', '', true),
('s-3-013', 'class-3a', 'ANBARASAN P', '922524243013', 'B.Tech AI & DS', '922524243013@vsb.edu.in', '', '', '', true),
('s-3-014', 'class-3a', 'ANUSHIYA S', '922524243014', 'B.Tech AI & DS', '922524243014@vsb.edu.in', '', '', '', true),
('s-3-015', 'class-3a', 'AROCKIA RAVIN K', '922524243015', 'B.Tech AI & DS', '922524243015@vsb.edu.in', '', '', '', true),
('s-3-016', 'class-3a', 'AYISHA SUHAINA S', '922524243016', 'B.Tech AI & DS', '922524243016@vsb.edu.in', '', '', '', true),
('s-3-017', 'class-3a', 'BHARATH KUMAR S', '922524243018', 'B.Tech AI & DS', '922524243018@vsb.edu.in', '', '', '', true),
('s-3-018', 'class-3a', 'BHARATHKUMAR B', '922524243019', 'B.Tech AI & DS', '922524243019@vsb.edu.in', '', '', '', true),
('s-3-019', 'class-3a', 'BHAVASHREE V', '922524243020', 'B.Tech AI & DS', '922524243020@vsb.edu.in', '', '', '', true),
('s-3-020', 'class-3a', 'BHAVATHARANI M', '922524243021', 'B.Tech AI & DS', '922524243021@vsb.edu.in', '', '', '', true),
('s-3-021', 'class-3a', 'BOOMIKA K', '922524243022', 'B.Tech AI & DS', '922524243022@vsb.edu.in', '', '', '', true),
('s-3-022', 'class-3a', 'CAVIRAJ N', '922524243023', 'B.Tech AI & DS', '922524243023@vsb.edu.in', '', '', '', true),
('s-3-023', 'class-3a', 'CHANDRU P', '922524243024', 'B.Tech AI & DS', '922524243024@vsb.edu.in', '', '', '', true),
('s-3-024', 'class-3a', 'CHIRANJEEVI V', '922524243025', 'B.Tech AI & DS', '922524243025@vsb.edu.in', '', '', '', true),
('s-3-025', 'class-3a', 'DANUSH M S B', '922524243026', 'B.Tech AI & DS', '922524243026@vsb.edu.in', '', '', '', true),
('s-3-026', 'class-3a', 'DEENASRI S', '922524243027', 'B.Tech AI & DS', '922524243027@vsb.edu.in', '', '', '', true),
('s-3-027', 'class-3a', 'DEEPAK J R', '922524243028', 'B.Tech AI & DS', '922524243028@vsb.edu.in', '', '', '', true),
('s-3-028', 'class-3a', 'DEEPAK M', '922524243029', 'B.Tech AI & DS', '922524243029@vsb.edu.in', '', '', '', true),
('s-3-029', 'class-3a', 'DEEPAN T', '922524243030', 'B.Tech AI & DS', '922524243030@vsb.edu.in', '', '', '', true),
('s-3-030', 'class-3a', 'DEEPIKA P', '922524243031', 'B.Tech AI & DS', '922524243031@vsb.edu.in', '', '', '', true),
('s-3-031', 'class-3a', 'DEOLIN RAJA V R', '922524243032', 'B.Tech AI & DS', '922524243032@vsb.edu.in', '', '', '', true),
('s-3-032', 'class-3a', 'DHARANEESHKUMAR M', '922524243033', 'B.Tech AI & DS', '922524243033@vsb.edu.in', '', '', '', true),
('s-3-033', 'class-3a', 'DHARANI J', '922524243034', 'B.Tech AI & DS', '922524243034@vsb.edu.in', '', '', '', true),
('s-3-034', 'class-3a', 'DHARANIKA S', '922524243035', 'B.Tech AI & DS', '922524243035@vsb.edu.in', '', '', '', true),
('s-3-035', 'class-3a', 'DHARSHAN K', '922524243036', 'B.Tech AI & DS', '922524243036@vsb.edu.in', '', '', '', true),
('s-3-036', 'class-3a', 'DHARUN R', '922524243037', 'B.Tech AI & DS', '922524243037@vsb.edu.in', '', '', '', true),
('s-3-037', 'class-3a', 'DHARUN R', '922524243038', 'B.Tech AI & DS', '922524243038@vsb.edu.in', '', '', '', true),
('s-3-038', 'class-3a', 'DHEENA D', '922524243039', 'B.Tech AI & DS', '922524243039@vsb.edu.in', '', '', '', true),
('s-3-039', 'class-3a', 'DINESH KUMAR S', '922524243040', 'B.Tech AI & DS', '922524243040@vsb.edu.in', '', '', '', true),
('s-3-040', 'class-3a', 'DINESHKUMAR P', '922524243041', 'B.Tech AI & DS', '922524243041@vsb.edu.in', '', '', '', true),
('s-3-041', 'class-3a', 'DIVAKAR R', '922524243042', 'B.Tech AI & DS', '922524243042@vsb.edu.in', '', '', '', true),
('s-3-042', 'class-3a', 'DIVYA R', '922524243043', 'B.Tech AI & DS', '922524243043@vsb.edu.in', '', '', '', true),
('s-3-043', 'class-3a', 'DIVYA R', '922524243044', 'B.Tech AI & DS', '922524243044@vsb.edu.in', '', '', '', true),
('s-3-044', 'class-3a', 'DIVYADHARSHINI U', '922524243045', 'B.Tech AI & DS', '922524243045@vsb.edu.in', '', '', '', true),
('s-3-045', 'class-3a', 'GOKHULA KRISHNA PRIYAN K', '922524243047', 'B.Tech AI & DS', '922524243047@vsb.edu.in', '', '', '', true),
('s-3-046', 'class-3a', 'GOKULNATH S', '922524243048', 'B.Tech AI & DS', '922524243048@vsb.edu.in', '', '', '', true),
('s-3-047', 'class-3a', 'GOWSIKAN N', '922524243049', 'B.Tech AI & DS', '922524243049@vsb.edu.in', '', '', '', true),
('s-3-048', 'class-3a', 'HARI HARAN M', '922524243050', 'B.Tech AI & DS', '922524243050@vsb.edu.in', '', '', '', true),
('s-3-049', 'class-3a', 'HARI KRISHNA D K', '922524243051', 'B.Tech AI & DS', '922524243051@vsb.edu.in', '', '', '', true),
('s-3-050', 'class-3a', 'HARIHARAN S V', '922524243052', 'B.Tech AI & DS', '922524243052@vsb.edu.in', '', '', '', true),
('s-3-051', 'class-3a', 'HARIPRIYA M', '922524243053', 'B.Tech AI & DS', '922524243053@vsb.edu.in', '', '', '', true),
('s-3-052', 'class-3a', 'HARISH BABU S', '922524243054', 'B.Tech AI & DS', '922524243054@vsb.edu.in', '', '', '', true),
('s-3-053', 'class-3a', 'HARISHA H', '922524243055', 'B.Tech AI & DS', '922524243055@vsb.edu.in', '', '', '', true),
('s-3-054', 'class-3a', 'HARISHBALAN B', '922524243056', 'B.Tech AI & DS', '922524243056@vsb.edu.in', '', '', '', true),
('s-3-055', 'class-3a', 'HARSHITHA M', '922524243057', 'B.Tech AI & DS', '922524243057@vsb.edu.in', '', '', '', true),
('s-3-056', 'class-3a', 'HEMALATHA V', '922524243058', 'B.Tech AI & DS', '922524243058@vsb.edu.in', '', '', '', true),
('s-3-057', 'class-3a', 'HEMANTH D', '922524243059', 'B.Tech AI & DS', '922524243059@vsb.edu.in', '', '', '', true),
('s-3-058', 'class-3a', 'JACK RUBAN P', '922524243060', 'B.Tech AI & DS', '922524243060@vsb.edu.in', '', '', '', true),
('s-3-059', 'class-3a', 'JAYATHARSHIKA K', '922524243061', 'B.Tech AI & DS', '922524243061@vsb.edu.in', '', '', '', true),
('s-3-060', 'class-3a', 'PRASANTH S', '922524243301', 'B.Tech AI & DS', '922524243301@vsb.edu.in', '', '', '', true),
('s-3-061', 'class-3a', 'SANTHOSH A', '922524243302', 'B.Tech AI & DS', '922524243302@vsb.edu.in', '', '', '', true),
('s-3-062', 'class-3a', 'SHARAN S', '922524243303', 'B.Tech AI & DS', '922524243303@vsb.edu.in', '', '', '', true),
('s-3-063', 'class-3a', 'DHANUSH R', '922524243304', 'B.Tech AI & DS', '922524243304@vsb.edu.in', '', '', '', true),
('s-3-064', 'class-3a', 'GUBENDHIRAN M', '922524243305', 'B.Tech AI & DS', '922524243305@vsb.edu.in', '', '', '', true),
('s-3-065', 'class-3a', 'PRADEEPKUMAR M', '922524243306', 'B.Tech AI & DS', '922524243306@vsb.edu.in', '', '', '', true),
('s-3-066', 'class-3b', 'JENITTA BLESSY S', '922524243062', 'B.Tech AI & DS', '922524243062@vsb.edu.in', '', '', '', true),
('s-3-067', 'class-3b', 'KABEESH L', '922524243064', 'B.Tech AI & DS', '922524243064@vsb.edu.in', '', '', '', true),
('s-3-068', 'class-3b', 'KALAISELVI M', '922524243065', 'B.Tech AI & DS', '922524243065@vsb.edu.in', '', '', '', true),
('s-3-069', 'class-3b', 'KAMALI M', '922524243066', 'B.Tech AI & DS', '922524243066@vsb.edu.in', '', '', '', true),
('s-3-070', 'class-3b', 'KAMALIKA Y S', '922524243067', 'B.Tech AI & DS', '922524243067@vsb.edu.in', '', '', '', true),
('s-3-071', 'class-3b', 'KANIGA A', '922524243068', 'B.Tech AI & DS', '922524243068@vsb.edu.in', '', '', '', true),
('s-3-072', 'class-3b', 'KANISH M', '922524243069', 'B.Tech AI & DS', '922524243069@vsb.edu.in', '', '', '', true),
('s-3-073', 'class-3b', 'KANISHKA S', '922524243070', 'B.Tech AI & DS', '922524243070@vsb.edu.in', '', '', '', true),
('s-3-074', 'class-3b', 'KANNAN M', '922524243071', 'B.Tech AI & DS', '922524243071@vsb.edu.in', '', '', '', true),
('s-3-075', 'class-3b', 'KARISHMA G', '922524243072', 'B.Tech AI & DS', '922524243072@vsb.edu.in', '', '', '', true),
('s-3-076', 'class-3b', 'KARTHICK S', '922524243073', 'B.Tech AI & DS', '922524243073@vsb.edu.in', '', '', '', true),
('s-3-077', 'class-3b', 'KARTHIK RAJA S', '922524243074', 'B.Tech AI & DS', '922524243074@vsb.edu.in', '', '', '', true),
('s-3-078', 'class-3b', 'KARUPPADURAI G', '922524243075', 'B.Tech AI & DS', '922524243075@vsb.edu.in', '', '', '', true),
('s-3-079', 'class-3b', 'KATHIRVEL T', '922524243076', 'B.Tech AI & DS', '922524243076@vsb.edu.in', '', '', '', true),
('s-3-080', 'class-3b', 'KAVIN A', '922524243077', 'B.Tech AI & DS', '922524243077@vsb.edu.in', '', '', '', true),
('s-3-081', 'class-3b', 'KAVIN M', '922524243078', 'B.Tech AI & DS', '922524243078@vsb.edu.in', '', '', '', true),
('s-3-082', 'class-3b', 'KAVIN SHARVESH R', '922524243079', 'B.Tech AI & DS', '922524243079@vsb.edu.in', '', '', '', true),
('s-3-083', 'class-3b', 'KAVIRAJ R', '922524243080', 'B.Tech AI & DS', '922524243080@vsb.edu.in', '', '', '', true),
('s-3-084', 'class-3b', 'KAVIYA D', '922524243081', 'B.Tech AI & DS', '922524243081@vsb.edu.in', '', '', '', true),
('s-3-085', 'class-3b', 'KAVIYA P', '922524243082', 'B.Tech AI & DS', '922524243082@vsb.edu.in', '', '', '', true),
('s-3-086', 'class-3b', 'KAVIYADHARSHINI S', '922524243083', 'B.Tech AI & DS', '922524243083@vsb.edu.in', '', '', '', true),
('s-3-087', 'class-3b', 'KAVYA SHREE TV', '922524243084', 'B.Tech AI & DS', '922524243084@vsb.edu.in', '', '', '', true),
('s-3-088', 'class-3b', 'KAWIN D', '922524243085', 'B.Tech AI & DS', '922524243085@vsb.edu.in', '', '', '', true),
('s-3-089', 'class-3b', 'KEERTHANA B', '922524243086', 'B.Tech AI & DS', '922524243086@vsb.edu.in', '', '', '', true),
('s-3-090', 'class-3b', 'KEERTHANA S', '922524243087', 'B.Tech AI & DS', '922524243087@vsb.edu.in', '', '', '', true),
('s-3-091', 'class-3b', 'KEERTHI B', '922524243088', 'B.Tech AI & DS', '922524243088@vsb.edu.in', '', '', '', true),
('s-3-092', 'class-3b', 'KIRUTHICKRAJA M', '922524243089', 'B.Tech AI & DS', '922524243089@vsb.edu.in', '', '', '', true),
('s-3-093', 'class-3b', 'KIRUTHIKA D', '922524243090', 'B.Tech AI & DS', '922524243090@vsb.edu.in', '', '', '', true),
('s-3-094', 'class-3b', 'KIRUTHIKA N', '922524243091', 'B.Tech AI & DS', '922524243091@vsb.edu.in', '', '', '', true),
('s-3-095', 'class-3b', 'KISHORE S', '922524243092', 'B.Tech AI & DS', '922524243092@vsb.edu.in', '', '', '', true),
('s-3-096', 'class-3b', 'KRITHEESH J', '922524243093', 'B.Tech AI & DS', '922524243093@vsb.edu.in', '', '', '', true),
('s-3-097', 'class-3b', 'LAKSHMI E', '922524243094', 'B.Tech AI & DS', '922524243094@vsb.edu.in', '', '', '', true),
('s-3-098', 'class-3b', 'LALITHA M', '922524243095', 'B.Tech AI & DS', '922524243095@vsb.edu.in', '', '', '', true),
('s-3-099', 'class-3b', 'LOGAPRIYA M', '922524243096', 'B.Tech AI & DS', '922524243096@vsb.edu.in', '', '', '', true),
('s-3-100', 'class-3b', 'LOGESH S', '922524243097', 'B.Tech AI & DS', '922524243097@vsb.edu.in', '', '', '', true),
('s-3-101', 'class-3b', 'LOKESH B', '922524243098', 'B.Tech AI & DS', '922524243098@vsb.edu.in', '', '', '', true),
('s-3-102', 'class-3b', 'MADHAN K', '922524243099', 'B.Tech AI & DS', '922524243099@vsb.edu.in', '', '', '', true),
('s-3-103', 'class-3b', 'MAHA SMIRTHI SS', '922524243100', 'B.Tech AI & DS', '922524243100@vsb.edu.in', '', '', '', true),
('s-3-104', 'class-3b', 'MAHALAKSHMI K', '922524243101', 'B.Tech AI & DS', '922524243101@vsb.edu.in', '', '', '', true),
('s-3-105', 'class-3b', 'MAHAMANI J', '922524243102', 'B.Tech AI & DS', '922524243102@vsb.edu.in', '', '', '', true),
('s-3-106', 'class-3b', 'MAHARAJA M', '922524243103', 'B.Tech AI & DS', '922524243103@vsb.edu.in', '', '', '', true),
('s-3-107', 'class-3b', 'MAHISA S', '922524243104', 'B.Tech AI & DS', '922524243104@vsb.edu.in', '', '', '', true),
('s-3-108', 'class-3b', 'MAKITHA R', '922524243105', 'B.Tech AI & DS', '922524243105@vsb.edu.in', '', '', '', true),
('s-3-109', 'class-3b', 'MANJUSRI R', '922524243106', 'B.Tech AI & DS', '922524243106@vsb.edu.in', '', '', '', true),
('s-3-110', 'class-3b', 'MANO T', '922524243107', 'B.Tech AI & DS', '922524243107@vsb.edu.in', '', '', '', true),
('s-3-111', 'class-3b', 'MEHARAJ BANU S', '922524243108', 'B.Tech AI & DS', '922524243108@vsb.edu.in', '', '', '', true),
('s-3-112', 'class-3b', 'MISBBAHOONNISHAA A', '922524243109', 'B.Tech AI & DS', '922524243109@vsb.edu.in', '', '', '', true),
('s-3-113', 'class-3b', 'MOHAMMED JAVITH FARVEZ S K', '922524243110', 'B.Tech AI & DS', '922524243110@vsb.edu.in', '', '', '', true),
('s-3-114', 'class-3b', 'MOHANRAJ G', '922524243111', 'B.Tech AI & DS', '922524243111@vsb.edu.in', '', '', '', true),
('s-3-115', 'class-3b', 'MONISH B', '922524243112', 'B.Tech AI & DS', '922524243112@vsb.edu.in', '', '', '', true),
('s-3-116', 'class-3b', 'MOUNISHA P', '922524243113', 'B.Tech AI & DS', '922524243113@vsb.edu.in', '', '', '', true),
('s-3-117', 'class-3b', 'MUGESH A', '922524243114', 'B.Tech AI & DS', '922524243114@vsb.edu.in', '', '', '', true),
('s-3-118', 'class-3b', 'MUGESH YATHRA M', '922524243115', 'B.Tech AI & DS', '922524243115@vsb.edu.in', '', '', '', true),
('s-3-119', 'class-3b', 'MUKILAN M', '922524243116', 'B.Tech AI & DS', '922524243116@vsb.edu.in', '', '', '', true),
('s-3-120', 'class-3b', 'MUTHU KARTHIGAI SELVAM S', '922524243117', 'B.Tech AI & DS', '922524243117@vsb.edu.in', '', '', '', true),
('s-3-121', 'class-3b', 'MUTHUDEENATHAYALAN V', '922524243118', 'B.Tech AI & DS', '922524243118@vsb.edu.in', '', '', '', true),
('s-3-122', 'class-3b', 'MYTHILI L', '922524243119', 'B.Tech AI & DS', '922524243119@vsb.edu.in', '', '', '', true),
('s-3-123', 'class-3b', 'NANDHAKUMAR B', '922524243120', 'B.Tech AI & DS', '922524243120@vsb.edu.in', '', '', '', true),
('s-3-124', 'class-3b', 'NANMOZHI T', '922524243121', 'B.Tech AI & DS', '922524243121@vsb.edu.in', '', '', '', true),
('s-3-125', 'class-3b', 'NARASIMMAN A', '922524243122', 'B.Tech AI & DS', '922524243122@vsb.edu.in', '', '', '', true),
('s-3-126', 'class-3b', 'NAREN KS', '922524243123', 'B.Tech AI & DS', '922524243123@vsb.edu.in', '', '', '', true),
('s-3-127', 'class-3c', 'NARTHINI N', '922524243124', 'B.Tech AI & DS', '922524243124@vsb.edu.in', '', '', '', true),
('s-3-128', 'class-3c', 'NASEEGA S', '922524243125', 'B.Tech AI & DS', '922524243125@vsb.edu.in', '', '', '', true),
('s-3-129', 'class-3c', 'NAVANITHA M', '922524243126', 'B.Tech AI & DS', '922524243126@vsb.edu.in', '', '', '', true),
('s-3-130', 'class-3c', 'NAVEEN B', '922524243127', 'B.Tech AI & DS', '922524243127@vsb.edu.in', '', '', '', true),
('s-3-131', 'class-3c', 'NAVEEN M', '922524243128', 'B.Tech AI & DS', '922524243128@vsb.edu.in', '', '', '', true),
('s-3-132', 'class-3c', 'NAVEENA N', '922524243129', 'B.Tech AI & DS', '922524243129@vsb.edu.in', '', '', '', true),
('s-3-133', 'class-3c', 'NETHYA SHREE N', '922524243130', 'B.Tech AI & DS', '922524243130@vsb.edu.in', '', '', '', true),
('s-3-134', 'class-3c', 'NIJAY S S', '922524243131', 'B.Tech AI & DS', '922524243131@vsb.edu.in', '', '', '', true),
('s-3-135', 'class-3c', 'NIRANJANA S', '922524243132', 'B.Tech AI & DS', '922524243132@vsb.edu.in', '', '', '', true),
('s-3-136', 'class-3c', 'NISHANTH A', '922524243133', 'B.Tech AI & DS', '922524243133@vsb.edu.in', '', '', '', true),
('s-3-137', 'class-3c', 'NISHANTH M', '922524243134', 'B.Tech AI & DS', '922524243134@vsb.edu.in', '', '', '', true),
('s-3-138', 'class-3c', 'NISHIKA S', '922524243135', 'B.Tech AI & DS', '922524243135@vsb.edu.in', '', '', '', true),
('s-3-139', 'class-3c', 'NITHESHKUMAR M', '922524243136', 'B.Tech AI & DS', '922524243136@vsb.edu.in', '', '', '', true),
('s-3-140', 'class-3c', 'NITHISH M', '922524243137', 'B.Tech AI & DS', '922524243137@vsb.edu.in', '', '', '', true),
('s-3-141', 'class-3c', 'NITHIYA B', '922524243138', 'B.Tech AI & DS', '922524243138@vsb.edu.in', '', '', '', true),
('s-3-142', 'class-3c', 'NITHYA SHREE G', '922524243139', 'B.Tech AI & DS', '922524243139@vsb.edu.in', '', '', '', true),
('s-3-143', 'class-3c', 'NITHYA SRI S', '922524243140', 'B.Tech AI & DS', '922524243140@vsb.edu.in', '', '', '', true),
('s-3-144', 'class-3c', 'NIVISRI G', '922524243141', 'B.Tech AI & DS', '922524243141@vsb.edu.in', '', '', '', true),
('s-3-145', 'class-3c', 'PAVITHRA S', '922524243142', 'B.Tech AI & DS', '922524243142@vsb.edu.in', '', '', '', true),
('s-3-146', 'class-3c', 'PERIYANNAN M', '922524243143', 'B.Tech AI & DS', '922524243143@vsb.edu.in', '', '', '', true),
('s-3-147', 'class-3c', 'POOJA G', '922524243144', 'B.Tech AI & DS', '922524243144@vsb.edu.in', '', '', '', true),
('s-3-148', 'class-3c', 'POORMITHA S', '922524243145', 'B.Tech AI & DS', '922524243145@vsb.edu.in', '', '', '', true),
('s-3-149', 'class-3c', 'PORKALA P', '922524243146', 'B.Tech AI & DS', '922524243146@vsb.edu.in', '', '', '', true),
('s-3-150', 'class-3c', 'PRADHICKSHA S', '922524243147', 'B.Tech AI & DS', '922524243147@vsb.edu.in', '', '', '', true),
('s-3-151', 'class-3c', 'PRAGATHI G', '922524243148', 'B.Tech AI & DS', '922524243148@vsb.edu.in', '', '', '', true),
('s-3-152', 'class-3c', 'PRANESH A R', '922524243149', 'B.Tech AI & DS', '922524243149@vsb.edu.in', '', '', '', true),
('s-3-153', 'class-3c', 'PRASAD M', '922524243150', 'B.Tech AI & DS', '922524243150@vsb.edu.in', '', '', '', true),
('s-3-154', 'class-3c', 'PRASANNA S', '922524243151', 'B.Tech AI & DS', '922524243151@vsb.edu.in', '', '', '', true),
('s-3-155', 'class-3c', 'PRAVEEN P', '922524243153', 'B.Tech AI & DS', '922524243153@vsb.edu.in', '', '', '', true),
('s-3-156', 'class-3c', 'PRAVEEN S', '922524243154', 'B.Tech AI & DS', '922524243154@vsb.edu.in', '', '', '', true),
('s-3-157', 'class-3c', 'PRAVEENKUMAR D', '922524243155', 'B.Tech AI & DS', '922524243155@vsb.edu.in', '', '', '', true),
('s-3-158', 'class-3c', 'PREETHI K', '922524243156', 'B.Tech AI & DS', '922524243156@vsb.edu.in', '', '', '', true),
('s-3-159', 'class-3c', 'PREETHI R', '922524243157', 'B.Tech AI & DS', '922524243157@vsb.edu.in', '', '', '', true),
('s-3-160', 'class-3c', 'PRIYADHARSHINI R', '922524243158', 'B.Tech AI & DS', '922524243158@vsb.edu.in', '', '', '', true),
('s-3-161', 'class-3c', 'RAFAEL NADAL P', '922524243159', 'B.Tech AI & DS', '922524243159@vsb.edu.in', '', '', '', true),
('s-3-162', 'class-3c', 'RAGAV U', '922524243160', 'B.Tech AI & DS', '922524243160@vsb.edu.in', '', '', '', true),
('s-3-163', 'class-3c', 'RAGAVI M', '922524243161', 'B.Tech AI & DS', '922524243161@vsb.edu.in', '', '', '', true),
('s-3-164', 'class-3c', 'RAGUL M', '922524243162', 'B.Tech AI & DS', '922524243162@vsb.edu.in', '', '', '', true),
('s-3-165', 'class-3c', 'RAJAMOORTHY R', '922524243163', 'B.Tech AI & DS', '922524243163@vsb.edu.in', '', '', '', true),
('s-3-166', 'class-3c', 'RAM PRADEEP R P', '922524243164', 'B.Tech AI & DS', '922524243164@vsb.edu.in', '', '', '', true),
('s-3-167', 'class-3c', 'RAM PRASAD S S', '922524243165', 'B.Tech AI & DS', '922524243165@vsb.edu.in', '', '', '', true),
('s-3-168', 'class-3c', 'RAMAKRISHNAN R', '922524243166', 'B.Tech AI & DS', '922524243166@vsb.edu.in', '', '', '', true),
('s-3-169', 'class-3c', 'RAMYA S', '922524243167', 'B.Tech AI & DS', '922524243167@vsb.edu.in', '', '', '', true),
('s-3-170', 'class-3c', 'RANJITH P', '922524243168', 'B.Tech AI & DS', '922524243168@vsb.edu.in', '', '', '', true),
('s-3-171', 'class-3c', 'REVANYA D', '922524243169', 'B.Tech AI & DS', '922524243169@vsb.edu.in', '', '', '', true),
('s-3-172', 'class-3c', 'RITHIKA S', '922524243170', 'B.Tech AI & DS', '922524243170@vsb.edu.in', '', '', '', true),
('s-3-173', 'class-3c', 'RITHISH KUMAR D', '922524243171', 'B.Tech AI & DS', '922524243171@vsb.edu.in', '', '', '', true),
('s-3-174', 'class-3c', 'ROHITH E', '922524243172', 'B.Tech AI & DS', '922524243172@vsb.edu.in', '', '', '', true),
('s-3-175', 'class-3c', 'ROMANYA R', '922524243173', 'B.Tech AI & DS', '922524243173@vsb.edu.in', '', '', '', true),
('s-3-176', 'class-3c', 'RUBAN P', '922524243174', 'B.Tech AI & DS', '922524243174@vsb.edu.in', '', '', '', true),
('s-3-177', 'class-3c', 'RUBESH P', '922524243175', 'B.Tech AI & DS', '922524243175@vsb.edu.in', '', '', '', true),
('s-3-178', 'class-3c', 'SABARITHURAI C', '922524243176', 'B.Tech AI & DS', '922524243176@vsb.edu.in', '', '', '', true),
('s-3-179', 'class-3c', 'SABESH E', '922524243177', 'B.Tech AI & DS', '922524243177@vsb.edu.in', '', '', '', true),
('s-3-180', 'class-3c', 'SACHIN K S', '922524243178', 'B.Tech AI & DS', '922524243178@vsb.edu.in', '', '', '', true),
('s-3-181', 'class-3c', 'SAKTHI BALAN M', '922524243180', 'B.Tech AI & DS', '922524243180@vsb.edu.in', '', '', '', true),
('s-3-182', 'class-3c', 'SANGEETH SRAVAN J', '922524243182', 'B.Tech AI & DS', '922524243182@vsb.edu.in', '', '', '', true),
('s-3-183', 'class-3c', 'SANJAI M', '922524243183', 'B.Tech AI & DS', '922524243183@vsb.edu.in', '', '', '', true),
('s-3-184', 'class-3c', 'SANJAY K', '922524243184', 'B.Tech AI & DS', '922524243184@vsb.edu.in', '', '', '', true),
('s-3-185', 'class-3c', 'SANJIT P', '922524243185', 'B.Tech AI & DS', '922524243185@vsb.edu.in', '', '', '', true),
('s-3-186', 'class-3c', 'SANJUSHREE R', '922524243186', 'B.Tech AI & DS', '922524243186@vsb.edu.in', '', '', '', true),
('s-3-187', 'class-3d', 'SANDHIYA G', '922524243181', 'B.Tech AI & DS', '922524243181@vsb.edu.in', '', '', '', true),
('s-3-188', 'class-3d', 'SANTHANAM M', '922524243187', 'B.Tech AI & DS', '922524243187@vsb.edu.in', '', '', '', true),
('s-3-189', 'class-3d', 'SANTHIYA K', '922524243188', 'B.Tech AI & DS', '922524243188@vsb.edu.in', '', '', '', true),
('s-3-190', 'class-3d', 'SANTHIYA K', '922524243189', 'B.Tech AI & DS', '922524243189@vsb.edu.in', '', '', '', true),
('s-3-191', 'class-3d', 'SARAN KUMAR A', '922524243190', 'B.Tech AI & DS', '922524243190@vsb.edu.in', '', '', '', true),
('s-3-192', 'class-3d', 'SATHASIVAM S', '922524243191', 'B.Tech AI & DS', '922524243191@vsb.edu.in', '', '', '', true),
('s-3-193', 'class-3d', 'SATHIYA MOORTHY V', '922524243193', 'B.Tech AI & DS', '922524243193@vsb.edu.in', '', '', '', true),
('s-3-194', 'class-3d', 'SHADHARSHINI M', '922524243194', 'B.Tech AI & DS', '922524243194@vsb.edu.in', '', '', '', true),
('s-3-195', 'class-3d', 'SHALINI R', '922524243195', 'B.Tech AI & DS', '922524243195@vsb.edu.in', '', '', '', true),
('s-3-196', 'class-3d', 'SHASTIKA VM', '922524243196', 'B.Tech AI & DS', '922524243196@vsb.edu.in', '', '', '', true),
('s-3-197', 'class-3d', 'SHESANTH S', '922524243197', 'B.Tech AI & DS', '922524243197@vsb.edu.in', '', '', '', true),
('s-3-198', 'class-3d', 'SHOBIKA M', '922524243198', 'B.Tech AI & DS', '922524243198@vsb.edu.in', '', '', '', true),
('s-3-199', 'class-3d', 'SHOWMITHTHRA D M', '922524243199', 'B.Tech AI & DS', '922524243199@vsb.edu.in', '', '', '', true),
('s-3-200', 'class-3d', 'SIBIANANDHAN K', '922524243200', 'B.Tech AI & DS', '922524243200@vsb.edu.in', '', '', '', true),
('s-3-201', 'class-3d', 'SINEKA K', '922524243201', 'B.Tech AI & DS', '922524243201@vsb.edu.in', '', '', '', true),
('s-3-202', 'class-3d', 'SIVA M', '922524243202', 'B.Tech AI & DS', '922524243202@vsb.edu.in', '', '', '', true),
('s-3-203', 'class-3d', 'SIVAGANESH J', '922524243203', 'B.Tech AI & DS', '922524243203@vsb.edu.in', '', '', '', true),
('s-3-204', 'class-3d', 'SIVAKUMAR J', '922524243204', 'B.Tech AI & DS', '922524243204@vsb.edu.in', '', '', '', true),
('s-3-205', 'class-3d', 'SIVARANJANI S', '922524243205', 'B.Tech AI & DS', '922524243205@vsb.edu.in', '', '', '', true),
('s-3-206', 'class-3d', 'SIVASAKTHI P', '922524243206', 'B.Tech AI & DS', '922524243206@vsb.edu.in', '', '', '', true),
('s-3-207', 'class-3d', 'SIVASUGANTH S', '922524243207', 'B.Tech AI & DS', '922524243207@vsb.edu.in', '', '', '', true),
('s-3-208', 'class-3d', 'SOFFIYA K', '922524243208', 'B.Tech AI & DS', '922524243208@vsb.edu.in', '', '', '', true),
('s-3-209', 'class-3d', 'SOLAI RAJAN S', '922524243209', 'B.Tech AI & DS', '922524243209@vsb.edu.in', '', '', '', true),
('s-3-210', 'class-3d', 'SOWMITHRA R', '922524243210', 'B.Tech AI & DS', '922524243210@vsb.edu.in', '', '', '', true),
('s-3-211', 'class-3d', 'SOWMYA M', '922524243211', 'B.Tech AI & DS', '922524243211@vsb.edu.in', '', '', '', true),
('s-3-212', 'class-3d', 'SRI ARJUN V', '922524243212', 'B.Tech AI & DS', '922524243212@vsb.edu.in', '', '', '', true),
('s-3-213', 'class-3d', 'SUBHASHRI P', '922524243213', 'B.Tech AI & DS', '922524243213@vsb.edu.in', '', '', '', true),
('s-3-214', 'class-3d', 'SUDHARSANAM K', '922524243214', 'B.Tech AI & DS', '922524243214@vsb.edu.in', '', '', '', true),
('s-3-215', 'class-3d', 'SUGITHA S', '922524243215', 'B.Tech AI & DS', '922524243215@vsb.edu.in', '', '', '', true),
('s-3-216', 'class-3d', 'SUHETHA S', '922524243216', 'B.Tech AI & DS', '922524243216@vsb.edu.in', '', '', '', true),
('s-3-217', 'class-3d', 'SUJITH B', '922524243217', 'B.Tech AI & DS', '922524243217@vsb.edu.in', '', '', '', true),
('s-3-218', 'class-3d', 'SUJITH R', '922524243218', 'B.Tech AI & DS', '922524243218@vsb.edu.in', '', '', '', true),
('s-3-219', 'class-3d', 'SUPERIYA S', '922524243219', 'B.Tech AI & DS', '922524243219@vsb.edu.in', '', '', '', true),
('s-3-220', 'class-3d', 'SURENDHAR M', '922524243220', 'B.Tech AI & DS', '922524243220@vsb.edu.in', '', '', '', true),
('s-3-221', 'class-3d', 'SURUTHIKA D R', '922524243221', 'B.Tech AI & DS', '922524243221@vsb.edu.in', '', '', '', true),
('s-3-222', 'class-3d', 'SWETHA S', '922524243222', 'B.Tech AI & DS', '922524243222@vsb.edu.in', '', '', '', true),
('s-3-223', 'class-3d', 'SWETHA V', '922524243223', 'B.Tech AI & DS', '922524243223@vsb.edu.in', '', '', '', true),
('s-3-224', 'class-3d', 'THANGA PRABU N', '922524243224', 'B.Tech AI & DS', '922524243224@vsb.edu.in', '', '', '', true),
('s-3-225', 'class-3d', 'THARUN J M D', '922524243225', 'B.Tech AI & DS', '922524243225@vsb.edu.in', '', '', '', true),
('s-3-226', 'class-3d', 'THARUN M', '922524243226', 'B.Tech AI & DS', '922524243226@vsb.edu.in', '', '', '', true),
('s-3-227', 'class-3d', 'THAVANESH  RP', '922524243227', 'B.Tech AI & DS', '922524243227@vsb.edu.in', '', '', '', true),
('s-3-228', 'class-3d', 'THENUMATHI R', '922524243228', 'B.Tech AI & DS', '922524243228@vsb.edu.in', '', '', '', true),
('s-3-229', 'class-3d', 'THILAGAM S', '922524243229', 'B.Tech AI & DS', '922524243229@vsb.edu.in', '', '', '', true),
('s-3-230', 'class-3d', 'THIRUKUMARAN B', '922524243230', 'B.Tech AI & DS', '922524243230@vsb.edu.in', '', '', '', true),
('s-3-231', 'class-3d', 'THIRUMALAISAMY S', '922524243231', 'B.Tech AI & DS', '922524243231@vsb.edu.in', '', '', '', true),
('s-3-232', 'class-3d', 'THIRUNESWARAN D', '922524243232', 'B.Tech AI & DS', '922524243232@vsb.edu.in', '', '', '', true),
('s-3-233', 'class-3d', 'TIPPU B', '922524243233', 'B.Tech AI & DS', '922524243233@vsb.edu.in', '', '', '', true),
('s-3-234', 'class-3d', 'VAISHNAVI V', '922524243234', 'B.Tech AI & DS', '922524243234@vsb.edu.in', '', '', '', true),
('s-3-235', 'class-3d', 'VARSHA S', '922524243235', 'B.Tech AI & DS', '922524243235@vsb.edu.in', '', '', '', true),
('s-3-236', 'class-3d', 'VARSHA T', '922524243236', 'B.Tech AI & DS', '922524243236@vsb.edu.in', '', '', '', true),
('s-3-237', 'class-3d', 'VARSHINI S', '922524243237', 'B.Tech AI & DS', '922524243237@vsb.edu.in', '', '', '', true),
('s-3-238', 'class-3d', 'VASANTHAKUMAR K', '922524243238', 'B.Tech AI & DS', '922524243238@vsb.edu.in', '', '', '', true),
('s-3-239', 'class-3d', 'VASANTHAKUMAR K', '922524243239', 'B.Tech AI & DS', '922524243239@vsb.edu.in', '', '', '', true),
('s-3-240', 'class-3d', 'VELAVAN A', '922524243240', 'B.Tech AI & DS', '922524243240@vsb.edu.in', '', '', '', true),
('s-3-241', 'class-3d', 'VIJAYAN A', '922524243241', 'B.Tech AI & DS', '922524243241@vsb.edu.in', '', '', '', true),
('s-3-242', 'class-3d', 'VINOTH KUMAR M', '922524243242', 'B.Tech AI & DS', '922524243242@vsb.edu.in', '', '', '', true),
('s-3-243', 'class-3d', 'VISHAKAN V', '922524243243', 'B.Tech AI & DS', '922524243243@vsb.edu.in', '', '', '', true),
('s-3-244', 'class-3d', 'YAMUNA S', '922524243244', 'B.Tech AI & DS', '922524243244@vsb.edu.in', '', '', '', true),
('s-3-245', 'class-3d', 'YAMUNADEVI T', '922524243245', 'B.Tech AI & DS', '922524243245@vsb.edu.in', '', '', '', true),
('s-3-246', 'class-3d', 'YASODHA S', '922524243246', 'B.Tech AI & DS', '922524243246@vsb.edu.in', '', '', '', true),
('s-3-247', 'class-3d', 'YAZHINI M', '922524243247', 'B.Tech AI & DS', '922524243247@vsb.edu.in', '', '', '', true),
('s-3-248', 'class-3d', 'YAZHINI P', '922524243248', 'B.Tech AI & DS', '922524243248@vsb.edu.in', '', '', '', true),
('s-3-249', 'class-3d', 'YOGESHWARAN R', '922524243249', 'B.Tech AI & DS', '922524243249@vsb.edu.in', '', '', '', true)
on conflict (id) do update set 
    class_id = excluded.class_id,
    name = excluded.name,
    register_number = excluded.register_number,
    degree = excluded.degree,
    email = excluded.email,
    active = excluded.active;
