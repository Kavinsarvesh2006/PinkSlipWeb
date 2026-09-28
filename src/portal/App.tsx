import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type FormEvent } from 'react';
import { Building2, LayoutDashboard, Users, ClipboardCheck, FileText, CalendarDays, Settings, Bell, LogOut, RefreshCw, Menu, X, GraduationCap, ShieldCheck, Download, Plus, Search } from 'lucide-react';
import { client, tables, readAll, save, rpc, invoke, upload, openFile, exportCSV, collegeDay, classLabel, errorText, percentage, type Row, type Data } from './api';
import type { Session } from '@supabase/supabase-js';
type Field = {
    key: string;
    label: string;
    type?: string;
    options?: [
        string,
        string
    ][];
    required?: boolean;
    value?: unknown;
    disabled?: boolean;
    min?: number;
    max?: number;
};
type Editor = {
    title: string;
    fields: Field[];
    submit: (values: Record<string, string>) => Promise<void>;
};
const options = (rows: Row[], label: (r: Row) => string): [
    string,
    string
][] => rows.map(r => [r.id, label(r)]);
const status = (value: unknown) => <span className={`badge ${value}`}>{String(value ?? '').replaceAll('_', ' ')}</span>;
const Empty = ({ children }: {
    children: ReactNode;
}) => <div className="empty"><Building2 size={32}/><p>{children}</p></div>;
function Panel({ title, children, action }: {
    title: string;
    children: ReactNode;
    action?: ReactNode;
}) { return <section className="panel"><div className="panel-head"><h2>{title}</h2>{action}</div>{children}</section>; }
function DataTable({ headers, rows }: {
    headers: string[];
    rows: ReactNode[][];
}) {
    const [page, setPage] = useState(0);
    const current = Math.min(page, Math.max(0, Math.ceil(rows.length / 25) - 1));
    return rows.length ? <><div className="table-scroll"><table><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.slice(current * 25, (current + 1) * 25).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div><div className="pagination"><span>{current * 25 + 1}–{Math.min((current + 1) * 25, rows.length)} of {rows.length}</span><button disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button><button disabled={(current + 1) * 25 >= rows.length} onClick={() => setPage(current + 1)}>Next</button></div></> : <Empty>No records yet. Records will appear when your college adds them.</Empty>;
}
function Modal({ title, close, children, busy = false }: {
    title: string;
    close: () => void;
    children: ReactNode;
    busy?: boolean;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => { ref.current?.showModal(); return () => ref.current?.close(); }, []);
    return <dialog ref={ref} onCancel={e => { e.preventDefault(); if (!busy)
        close(); }} aria-label={title}><header><h2>{title}</h2><button className="icon-button" aria-label="Close" disabled={busy} onClick={close}><X /></button></header>{children}</dialog>;
}
function FormDialog({ editor, close, done }: {
    editor: Editor;
    close: () => void;
    done: () => Promise<void>;
}) {
    const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(editor.fields.map(f => [f.key, String(f.value ?? '')])));
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); try {
        await editor.submit(values);
        await done();
        close();
    }
    catch (e) {
        setError(errorText(e));
    }
    finally {
        setBusy(false);
    } }
    return <Modal title={editor.title} close={close} busy={busy}><form onSubmit={submit}><div className="form-grid">{editor.fields.map(f => <label key={f.key}>{f.label}{f.options ? <select value={values[f.key]} disabled={busy || f.disabled} required={f.required !== false} onChange={e => setValues({ ...values, [f.key]: e.target.value })}><option value="">{f.required === false ? 'Unassigned' : 'Select…'}</option>{f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select> : <input value={values[f.key]} type={f.type || 'text'} min={f.min} max={f.max} minLength={f.type === 'password' ? 12 : undefined} disabled={busy || f.disabled} required={f.required !== false} onChange={e => setValues({ ...values, [f.key]: e.target.value })}/>}</label>)}</div>{error && <p className="error" role="alert">{error}</p>}<footer><button type="button" disabled={busy} onClick={close}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></footer></form></Modal>;
}
import { mockAdvisorProfile, mockHODProfile, mockSuperAdminProfile, mockStudentProfile, initialMockData } from './mockData';

function Login({ recovery, onRecovered, onDemoLogin }: {
    recovery: boolean;
    onRecovered: () => void;
    onDemoLogin: (profile: Row) => void;
}) {
    const [email, setEmail] = useState('advisor.anand@vsb.edu.in'), [password, setPassword] = useState('Advisor@12345678'), [confirm, setConfirm] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
    async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setMessage(''); try {
        if (recovery) {
            if (password !== confirm)
                throw Error('Passwords must match.');
            const { error } = await client!.auth.updateUser({ password });
            if (error)
                throw error;
            onRecovered();
        }
        else {
            if (email.includes('anand') || email.includes('advisor')) {
                onDemoLogin(mockAdvisorProfile);
                return;
            }
            if (email.includes('hod') || email.includes('manivannan')) {
                onDemoLogin(mockHODProfile);
                return;
            }
            if (email.includes('principal') || email.includes('admin') || email.includes('super')) {
                onDemoLogin(mockSuperAdminProfile);
                return;
            }
            if (email.includes('student') || email.includes('aaron') || email.includes('23ai')) {
                onDemoLogin(mockStudentProfile);
                return;
            }
            if (client) {
                const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
                if (error) throw error;
            } else {
                onDemoLogin(mockAdvisorProfile);
            }
        }
    }
    catch (e) {
        // If Supabase auth fails with unconfigured credentials, fallback to demo advisor
        if (email.includes('advisor') || email.includes('vsb.edu') || email.includes('anand')) {
            onDemoLogin(mockAdvisorProfile);
        } else {
            setMessage(errorText(e));
        }
    }
    finally {
        setBusy(false);
    } }
    async function reset() { setBusy(true); try {
        if (!email.includes('@'))
            throw Error('Enter your college email first.');
        const { error } = await client!.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (error)
            throw error;
        setMessage('If this account exists, a reset link has been sent.');
    }
    catch (e) {
        setMessage(errorText(e));
    }
    finally {
        setBusy(false);
    } }
    return <main className="login-layout"><section className="welcome"><div className="brand"><Building2 /> PinkSlipReport</div><div><span className="eyebrow">YOUR COLLEGE, CONNECTED</span><h1>A clearer view of every academic day.</h1><p>Attendance, student records and leave approvals in one shared workspace.</p></div><small>Built for HODs, advisors, students and administrators.</small></section><section className="login-card"><div className="brand mobile-brand"><Building2 /> PinkSlipReport</div><ShieldCheck className="accent" size={36}/><h2>{recovery ? 'Choose a new password' : 'Welcome back'}</h2><p className="muted">{recovery ? 'Use at least 12 characters.' : 'Sign in with the account assigned by your college.'}</p><form onSubmit={submit}>{!recovery && <label>College email<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required/></label>}<label>Password<input type="password" autoComplete={recovery ? 'new-password' : 'current-password'} minLength={recovery ? 12 : undefined} value={password} onChange={e => setPassword(e.target.value)} required/></label>{recovery && <label>Confirm password<input type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required/></label>}{message && <p role="status" className="notice">{message}</p>}<button className="primary full" disabled={busy}>{busy ? 'Please wait…' : recovery ? 'Update password' : 'Sign in'}</button>{!recovery && <button className="text-button full" type="button" disabled={busy} onClick={reset}>Forgot password?</button>}</form><div className="demo-box"><div className="demo-title">⚡ 1-Click Quick Demo Login</div><div className="demo-grid"><button className="demo-btn featured" onClick={() => onDemoLogin(mockAdvisorProfile)}>🎓 3rd Year Advisor (Prof. R. Anand)</button><button className="demo-btn" onClick={() => onDemoLogin(mockHODProfile)}>👔 HOD (Dr. S. Manivannan)</button><button className="demo-btn" onClick={() => onDemoLogin(mockSuperAdminProfile)}>🛡️ Super Admin (Principal)</button><button className="demo-btn" onClick={() => onDemoLogin(mockStudentProfile)}>👨‍🎓 Student (Aaron V. Paul)</button></div></div><p className="small muted">Need access? Contact your HOD or Super Admin.</p></section></main>;
}
export default function App() {
    const [session, setSession] = useState<Session | null>(null), [ready, setReady] = useState(false), [recovery, setRecovery] = useState(false);
    const [demoUser, setDemoUser] = useState<Row | null>(() => {
        try {
            const saved = localStorage.getItem('pinkslip_active_user');
            return saved ? JSON.parse(saved) : mockAdvisorProfile;
        } catch {
            return mockAdvisorProfile;
        }
    });

    useEffect(() => { if (!client) {
        setReady(true);
        return;
    } let live = true; client.auth.getSession().then(({ data }) => { if (live) {
        setSession(data.session);
        setReady(true);
    } }); const { data } = client.auth.onAuthStateChange((event, s) => { setSession(s); setReady(true); if (event === 'PASSWORD_RECOVERY')
        setRecovery(true); if (event === 'SIGNED_OUT')
        setRecovery(false); }); return () => { live = false; data.subscription.unsubscribe(); }; }, []);
    
    if (!ready)
        return <main className="setup" role="status">Opening your workspace…</main>;
    if (demoUser)
        return <Workspace key={demoUser.id} userId={demoUser.id} demoProfile={demoUser} onSignOut={() => { setDemoUser(null); localStorage.removeItem('pinkslip_active_user'); }} />;
    if (!session || recovery)
        return <Login recovery={recovery} onRecovered={() => setRecovery(false)} onDemoLogin={(p) => { setDemoUser(p); localStorage.setItem('pinkslip_active_user', JSON.stringify(p)); }}/>;
    return <Workspace key={session.user.id} userId={session.user.id} onSignOut={() => { setDemoUser(null); localStorage.removeItem('pinkslip_active_user'); }}/>;
}

const MOCK_DATA_VERSION = 'v2-batches-2026-2023';

function Workspace({ userId, demoProfile, onSignOut }: {
    userId: string;
    demoProfile?: Row;
    onSignOut?: () => void;
}) {
    const [data, setData] = useState<Data>(() => {
        if (demoProfile) {
            try {
                const v = localStorage.getItem('pinkslip_data_version');
                if (v !== MOCK_DATA_VERSION) {
                    localStorage.setItem('pinkslip_data_version', MOCK_DATA_VERSION);
                    localStorage.setItem('pinkslip_data_store', JSON.stringify(initialMockData));
                    return initialMockData;
                }
                const saved = localStorage.getItem('pinkslip_data_store');
                return saved ? JSON.parse(saved) : initialMockData;
            } catch {
                return initialMockData;
            }
        }
        return {};
    });
    const [profile, setProfile] = useState<Row | null>(demoProfile || null), [loading, setLoading] = useState(!demoProfile), [error, setError] = useState(''), [toast, setToast] = useState(''), [busy, setBusy] = useState(false);
    const [page, setPage] = useState('Overview'), [mobile, setMobile] = useState(false), [editor, setEditor] = useState<Editor | null>(null), [detail, setDetail] = useState<Row | null>(null), [leave, setLeave] = useState(false);
    const [importClass, setImportClass] = useState('');
    const live = useRef(true), request = useRef(0);
    const refresh = useCallback(async () => {
        if (demoProfile) {
            setProfile(demoProfile);
            try {
                const v = localStorage.getItem('pinkslip_data_version');
                if (v !== MOCK_DATA_VERSION) {
                    localStorage.setItem('pinkslip_data_version', MOCK_DATA_VERSION);
                    localStorage.setItem('pinkslip_data_store', JSON.stringify(initialMockData));
                    setData(initialMockData);
                    setLoading(false);
                    return;
                }
                const saved = localStorage.getItem('pinkslip_data_store');
                setData(saved ? JSON.parse(saved) : initialMockData);
            } catch {
                setData(initialMockData);
            }
            setLoading(false);
            return;
        }
        const token = ++request.current; setLoading(true); try {
        const { data: p, error } = await client!.from('profiles').select('*').eq('id', userId).single();
        if (error)
            throw error;
        if (!p.active)
            throw Error('Your account is disabled. Contact your college administrator.');
        const allowed = tables.filter(t => (t !== 'audit_logs' || p.role === 'super_admin') && (t !== 'call_records' || ['hod', 'super_admin'].includes(p.role)));
        const result = Object.fromEntries(await Promise.all(allowed.map(async (t) => [t, await readAll(t)])));
        if (live.current && token === request.current) {
            setProfile(p);
            setData(result);
            setError('');
        }
    }
    catch (e) {
        if (live.current && token === request.current) {
            setError(errorText(e));
            setData({});
            setProfile(null);
        }
    }
    finally {
        if (live.current && token === request.current)
            setLoading(false);
    } }, [userId, demoProfile]);
    useEffect(() => {
        if (demoProfile) {
            setLoading(false);
            return;
        }
        live.current = true; void refresh(); let timer: ReturnType<typeof setTimeout>; const channel = client?.channel(`portal-${userId}`).on('postgres_changes', { event: '*', schema: 'public' }, () => { clearTimeout(timer); timer = setTimeout(() => void refresh(), 350); }).subscribe(); const onFocus = () => void refresh(); window.addEventListener('focus', onFocus); const poll = setInterval(onFocus, 60000); return () => { live.current = false; ++request.current; clearTimeout(timer); clearInterval(poll); window.removeEventListener('focus', onFocus); if (channel) void client?.removeChannel(channel); }; }, [refresh, userId, demoProfile]);

    useEffect(() => { if (!toast)
        return; const t = setTimeout(() => setToast(''), 5000); return () => clearTimeout(t); }, [toast]);
    const rows = (t: string) => data[t] || [];
    const find = (t: string, id: unknown) => rows(t).find(r => r.id === id);
    const manager = ['hod', 'super_admin'].includes(profile?.role), superAdmin = profile?.role === 'super_admin', student = profile?.role === 'student';
    const attendanceCounts = useMemo(() => { const counts = new Map<string, {
        present: number;
        total: number;
    }>(); for (const a of data.attendance || []) {
        const v = counts.get(a.student_id) || { present: 0, total: 0 };
        v.total++;
        if (a.status === 'present')
            v.present++;
        counts.set(a.student_id, v);
    } return counts; }, [data.attendance]);
    const stats = (id: string) => attendanceCounts.get(id) || { present: 0, total: 0 };
    async function action(fn: () => Promise<unknown>, message = 'Saved successfully') { if (busy)
        return; setBusy(true); try {
        await fn();
        await refresh();
        setToast(message);
    }
    catch (e) {
        setToast(errorText(e));
    }
    finally {
        setBusy(false);
    } }
    const classOpts = options(rows('classes').filter(c => c.active), classLabel), deptOpts = options(rows('departments'), r => r.name);
    function editDepartment(d?: Row) { setEditor({ title: d ? 'Edit department' : 'Add department', fields: [{ key: 'name', label: 'Department name', value: d?.name }, { key: 'code', label: 'Department code', value: d?.code }], submit: v => save('departments', { name: v.name.trim(), code: v.code.trim() }, d?.id) }); }
    function editClass(c?: Row) { setEditor({ title: c ? 'Edit class' : 'Add class', fields: [...(!c ? [{ key: 'department_id', label: 'Department', options: deptOpts, value: profile?.department_id }, { key: 'year', label: 'Current study year', type: 'number', min: 1, max: 12 }, { key: 'course_years', label: 'Course duration in years', type: 'number', min: 1, max: 12 }] : []), { key: 'section', label: 'Section name', value: c?.section }, { key: 'batch', label: 'Admission batch year', type: 'number', min: 1900, max: 2200, value: c?.batch }, { key: 'promotion_due', label: 'Next annual approval date', type: 'date', value: c?.promotion_due }, { key: 'advisor_id', label: 'Advisor (same department)', options: options(rows('profiles').filter(p => p.role === 'advisor' && p.active && (!c || p.department_id === c.department_id)), p => `${p.name} · ${find('departments', p.department_id)?.code || ''}`), required: false, value: c?.advisor_id }], submit: async v => {
        const payload = { ...v, batch: Number(v.batch), advisor_id: v.advisor_id || null, ...(!c ? { year: Number(v.year), course_years: Number(v.course_years) } : {}) };
        if (client) {
            await save('classes', payload, c?.id);
        }
        setData(prev => {
            const updated = { ...prev };
            const list = [...(updated.classes || [])];
            if (c?.id) {
                const idx = list.findIndex(item => item.id === c.id);
                if (idx >= 0) list[idx] = { ...list[idx], ...payload };
            } else {
                list.push({ id: `class-${Date.now()}`, ...payload, active: true });
            }
            updated.classes = list;
            try { localStorage.setItem('pinkslip_data_store', JSON.stringify(updated)); } catch {}
            return updated;
        });
    } }); }
    function editStudent(s?: Row) { setEditor({ title: s ? 'Edit student' : 'Add student', fields: [{ key: 'class_id', label: 'Class', options: classOpts, value: s?.class_id }, { key: 'name', label: 'Full name', value: s?.name }, { key: 'register_number', label: 'Register number', value: s?.register_number }, { key: 'degree', label: 'Degree / course', value: s?.degree }, ...['phone', 'parent_name', 'parent_phone', 'email'].map(k => ({ key: k, label: ({ phone: 'Student phone', parent_name: 'Parent / guardian', parent_phone: 'Parent phone', email: 'Email' } as Record<string, string>)[k], value: s?.[k], required: false, type: k === 'email' ? 'email' : 'text' })), { key: 'user_id', label: 'Student login account', options: options(rows('profiles').filter(p => p.role === 'student' && p.active), p => `${p.name} · ${p.email}`), required: false, value: s?.user_id }], submit: async v => {
        const payload = { ...v, name: v.name.trim(), register_number: v.register_number.trim(), user_id: v.user_id || null };
        if (client) {
            await save('students', payload, s?.id);
        }
        setData(prev => {
            const updated = { ...prev };
            const list = [...(updated.students || [])];
            if (s?.id) {
                const idx = list.findIndex(item => item.id === s.id);
                if (idx >= 0) list[idx] = { ...list[idx], ...payload };
            } else {
                const newId = `s-${Date.now()}`;
                list.push({ id: newId, ...payload, active: true });
            }
            updated.students = list;
            try { localStorage.setItem('pinkslip_data_store', JSON.stringify(updated)); } catch {}
            return updated;
        });
    } }); }
    function editUser(u?: Row) { setEditor({ title: u ? 'Edit account' : 'Add account', fields: [{ key: 'name', label: 'Full name', value: u?.name }, { key: 'email', label: 'College email', type: 'email', value: u?.email, disabled: !!u }, { key: 'role', label: 'Role', options: (superAdmin ? ['super_admin', 'hod', 'advisor', 'student'] : ['advisor', 'student']).map(v => [v, v.replaceAll('_', ' ')]), value: u?.role }, { key: 'department_id', label: 'Department (optional for Super Admin)', options: deptOpts, value: u?.department_id ?? profile?.department_id, required: false }, ...(u ? [{ key: 'active', label: 'Account status', options: [['true', 'Active'], ['false', 'Disabled']] as [
                        string,
                        string
                    ][], value: String(u.active) }] : [{ key: 'password', label: 'Temporary password · 12+ characters', type: 'password' }])], submit: v => invoke('manage-user', { ...v, department_id: v.department_id || null, ...(u ? { id: u.id, active: v.active === 'true' } : {}) }) }); }
    function editEvent(e?: Row) { setEditor({ title: e ? 'Edit event' : 'Add event', fields: [{ key: 'department_id', label: 'Department', options: deptOpts, value: e?.department_id ?? profile?.department_id }, { key: 'title', label: 'Event title', value: e?.title }, { key: 'starts_at', label: 'Start date and time', type: 'datetime-local', value: e ? localDate(e.starts_at) : '' }, { key: 'ends_at', label: 'End date and time', type: 'datetime-local', value: e ? localDate(e.ends_at) : '' }], submit: async (v) => { if (v.ends_at <= v.starts_at)
            throw Error('End must follow start.'); await save('calendar_events', { ...v, starts_at: new Date(v.starts_at).toISOString(), ends_at: new Date(v.ends_at).toISOString(), ...(!e ? { id: `local-${crypto.randomUUID()}` } : {}) }, e?.id); } }); }
    function remove(t: string, r: Row) { setEditor({ title: `Delete ${r.name || r.title || classLabel(r)}?`, fields: [{ key: 'confirm', label: 'Type DELETE to confirm permanent removal.' }], submit: async (v) => { 
        if (v.confirm !== 'DELETE') throw Error('Enter DELETE to confirm.'); 
        if (client) {
            const { error } = await client!.from(t).delete().eq('id', r.id); 
            if (error) throw error;
        }
        setData(prev => {
            const updated = { ...prev };
            updated[t] = (updated[t] || []).filter(item => item.id !== r.id);
            if (t === 'students') {
                updated.attendance = (updated.attendance || []).filter(a => a.student_id !== r.id);
                updated.leaves = (updated.leaves || []).filter(l => l.student_id !== r.id);
            }
            try { localStorage.setItem('pinkslip_data_store', JSON.stringify(updated)); } catch {}
            return updated;
        });
    } }); }
    const pages: [
        string,
        typeof Users
    ][] = [['Overview', LayoutDashboard], ['Students', Users], ...(!student ? [['Attendance', ClipboardCheck] as [
                string,
                typeof Users
            ]] : []), ['Pink slips', FileText], ['Calendar', CalendarDays], ['Timetable', CalendarDays], ['Notices', Bell], ['Notifications', Bell], ...(!student ? [['Progression', GraduationCap] as [
                string,
                typeof Users
            ]] : []), ...(manager ? [['Administration', Settings] as [
                string,
                typeof Users
            ]] : []), ...(superAdmin ? [['Audit trail', ShieldCheck] as [
                string,
                typeof Users
            ]] : [])];
    if (!profile)
        return <main className="setup"><Building2 size={40}/><h1>{loading ? 'Loading your workspace…' : 'Unable to open workspace'}</h1>{error && <p role="alert" className="error">{error}</p>}<button onClick={() => void refresh()} disabled={loading}>Retry</button><button onClick={() => void client!.auth.signOut()}>Sign out</button></main>;
    const active = rows('students').filter(s => s.active);
    const total = rows('attendance').length, present = rows('attendance').filter(a => a.status === 'present').length;
    const risk = active.filter(s => { const a = stats(s.id); return a.total > 0 && a.present / a.total < .75; });
    const studentRows = (list: Row[]) => list.map(s => { const a = stats(s.id); return [<button className="text-button" onClick={() => setDetail(s)}><strong>{s.name}</strong><small>{s.register_number}</small></button>, classLabel(find('classes', s.class_id)), a.total ? `${percentage(a.present, a.total)!.toFixed(1)}% (${a.present}/${a.total})` : 'Not marked', manager ? <div className="actions"><button onClick={() => editStudent(s)}>Edit</button><button className="danger-button" onClick={() => remove('students', s)}>Delete</button></div> : status(s.active ? 'active' : 'archived')]; });
    return <div className="app-shell"><aside className={mobile ? 'sidebar open' : 'sidebar'}><div className="brand"><Building2 /> PinkSlipReport</div><div className="sidebar-caption">ACADEMIC WORKSPACE</div><nav>{pages.map(([p, Icon]) => <button key={p} className={page === p ? 'selected' : ''} aria-current={page === p ? 'page' : undefined} onClick={() => { setPage(p); setMobile(false); }}><Icon size={19}/>{p}{p === 'Notifications' && rows('notifications').some(n => !n.read_at) && <span className="dot"/>}</button>)}</nav><div className="account"><strong>{profile.name}</strong><small>{profile.role.replaceAll('_', ' ')}</small><button onClick={() => void action(async () => { if (onSignOut) onSignOut(); if (client) { try { await client.auth.signOut(); } catch {} } }, 'Signed out')}><LogOut size={17}/> Sign out</button></div></aside>{mobile && <button className="scrim" aria-label="Close navigation" onClick={() => setMobile(false)}/>}
 <div className="main-column"><header className="topbar"><button className="icon-button menu" aria-label="Open navigation" onClick={() => setMobile(!mobile)}><Menu /></button><span>{find('departments', profile.department_id)?.name || 'College administration'}</span><div><span className="small muted">{collegeDay()}</span><button className="icon-button" title="Refresh records" disabled={loading} onClick={() => void refresh()}><RefreshCw size={18} className={loading ? 'spinning' : ''}/></button></div></header><main className="workspace"><div className="page-heading"><div><span className="eyebrow">PINKSLIPREPORT / {profile.role.replaceAll('_', ' ')}</span><h1>{page}</h1><p className="muted">{page === 'Overview' ? 'Your academic day at a glance.' : 'College records, kept in sync across your devices.'}</p></div></div>{loading && <div className="loading-line" role="status">Refreshing records…</div>}
 {page === 'Overview' && <><section className="hero"><div><span className="eyebrow">WELCOME BACK</span><h2>Hello, {profile.name.split(' ')[0]}</h2><p>Every student. Every day. A shared picture of progress.</p></div><GraduationCap size={76}/></section><div className="metrics">{[['Active students', active.length], ['Recorded attendance', total ? `${percentage(present, total)!.toFixed(1)}%` : '—'], ['Pending pink slips', rows('leaves').filter(l => l.status === 'pending').length], ['Below 75%', risk.length]].map(([l, v]) => <div className="metric" key={l}><span>{l}</span><strong>{v}</strong><small>From your accessible records</small></div>)}</div>{manager && (!rows('departments').length || !rows('classes').length || !active.length) && <Panel title="Set up your college"><p>Add departments, create classes with your own year and section names, assign advisors, then add students. No roster is preloaded.</p><button className="primary" onClick={() => setPage('Administration')}>Open administration</button></Panel>}<div className="two-columns"><Panel title="Attendance by class">{rows('classes').filter(c => c.active).map(c => { const ids = new Set(active.filter(s => s.class_id === c.id).map(s => s.id)); const a = rows('attendance').filter(a => ids.has(a.student_id)); const rate = percentage(a.filter(a => a.status === 'present').length, a.length); return <div className="class-progress" key={c.id}><div><strong>{classLabel(c)}</strong><span>{rate === null ? 'No records' : `${rate.toFixed(1)}%`}</span></div><progress value={rate || 0} max={100}/></div>; })}{!rows('classes').length && <Empty>No classes have been added.</Empty>}<p className="small muted">Present days ÷ all marked days. Unmarked days are excluded.</p></Panel><Calculator /></div><Panel title="Students needing attention"><DataTable headers={['Student', 'Class', 'Attendance', 'Action']} rows={studentRows(risk)}/></Panel></>}
 {page === 'Students' && <Directory rows={rows('students')} classOpts={classOpts} manager={manager} add={() => editStudent()} render={studentRows} onExport={list => void action(async () => exportCSV('students.csv', list.map(s => ({ name: s.name, register_number: s.register_number, degree: s.degree, class: classLabel(find('classes', s.class_id)), email: s.email, phone: s.phone, parent_name: s.parent_name, parent_phone: s.parent_phone }))), 'Export downloaded')} onImport={() => setEditor({ title: 'Import students from CSV', fields: [{ key: 'class_id', label: 'Import into class', options: classOpts }], submit: async (v) => { setImportClass(v.class_id); } })}/>}
 {page === 'Attendance' && !student && <Attendance data={data} manager={manager} busy={busy} submit={marks => action(() => rpc('mark_attendance', marks))}/>}
 {page === 'Pink slips' && <Panel title="Leave requests" action={<button className="primary" onClick={() => setLeave(true)}><Plus size={17}/>New pink slip</button>}><DataTable headers={['Student', 'Dates / reason', 'Status', 'Actions']} rows={rows('leaves').slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).map(l => [<button className="text-button" onClick={() => setDetail(find('students', l.student_id) || null)}>{find('students', l.student_id)?.name || 'Student'}</button>, <><strong>{l.start_date} → {l.end_date}</strong><p>{l.reason}</p><small>{l.decision_note}</small></>, status(l.status), <div className="actions">{l.letter_path ? <button onClick={() => void action(() => openFile(l.letter_path), 'Attachment opened')}>Letter</button> : <label className="file-button">Add letter<input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e => { const f = e.target.files?.[0]; if (f)
            void action(async () => save('leaves', { letter_path: await upload(l.student_id, f) }, l.id)); }}/></label>}{manager && l.status === 'pending' && <><button disabled={busy} onClick={() => setEditor({ title: 'Review pink slip', fields: [{ key: 'decision_note', label: 'Decision remarks' }, { key: 'status', label: 'Decision', options: [['approved', 'Approve'], ['declined', 'Decline']] }], submit: v => save('leaves', v, l.id) })}>Review</button></>}</div>])}/></Panel>}
 {page === 'Calendar' && <Panel title="Academic calendar" action={manager ? <div className="actions"><button onClick={() => setEditor({ title: 'Import public Google Calendar', fields: [{ key: 'department_id', label: 'Department', options: deptOpts, value: profile.department_id }], submit: v => invoke('calendar-sync', v) })}>Import calendar</button><button className="primary" onClick={() => editEvent()}>Add event</button></div> : undefined}><DataTable headers={['Event', 'Starts', 'Ends', 'Actions']} rows={rows('calendar_events').slice().sort((a, b) => a.starts_at.localeCompare(b.starts_at)).map(e => [e.title, new Date(e.starts_at).toLocaleString(), new Date(e.ends_at).toLocaleString(), manager ? <div className="actions"><button onClick={() => editEvent(e)}>Edit</button><button onClick={() => remove('calendar_events', e)}>Delete</button></div> : null])}/></Panel>}
 {page === 'Notifications' && <Panel title="Your inbox"><DataTable headers={['Message', 'Received', 'Status']} rows={rows('notifications').slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).map(n => [n.message, new Date(n.created_at).toLocaleString(), n.read_at ? status('read') : <button disabled={busy} onClick={() => void action(() => save('notifications', { read_at: new Date().toISOString() }, n.id))}>Mark read</button>])}/></Panel>}
 {page === 'Progression' && !student && <><Panel title="Annual progression & Batch advancement"><p className="muted">Promote classes to the next academic year (Year 1 → Year 2 → Year 3 → Year 4). HOD approval advances study year while preserving original admission batches.</p><DataTable headers={['Class', 'Admission batch', 'Approval due', 'Next step', 'Action']} rows={rows('classes').filter(c => c.active).map(c => [classLabel(c), <strong>{c.batch} batch</strong>, c.promotion_due, c.year === c.course_years ? 'Complete course (Graduation)' : `Advance to Year ${c.year + 1} (${c.batch} batch)`, manager ? <div className="actions"><button className="primary" disabled={busy} onClick={() => void action(async () => {
    if (client) { await rpc('request_promotion', { p_class: c.id }); }
    setData(prev => {
        const updated = { ...prev };
        const classes = [...(updated.classes || [])];
        const idx = classes.findIndex(item => item.id === c.id);
        if (idx >= 0) {
            const cls = { ...classes[idx] };
            if (cls.year < cls.course_years) {
                cls.year += 1;
                cls.promotion_due = '2028-06-30';
            } else {
                cls.active = false;
            }
            classes[idx] = cls;
            updated.classes = classes;
        }
        const promos = [...(updated.promotions || [])];
        promos.push({ id: `promo-${Date.now()}`, class_id: c.id, from_year: c.year, status: 'approved', created_at: new Date().toISOString() });
        updated.promotions = promos;
        try { localStorage.setItem('pinkslip_data_store', JSON.stringify(updated)); } catch {}
        return updated;
    });
}, `${classLabel(c)} promoted successfully`)}>{c.year === c.course_years ? 'Graduate Class' : `Promote to Year ${c.year + 1}`}</button></div> : <button disabled={busy || rows('promotions').some(p => p.class_id === c.id && p.status === 'pending')} onClick={() => void action(async () => {
    if (client) { await rpc('request_promotion', { p_class: c.id }); }
    setData(prev => {
        const updated = { ...prev };
        const promos = [...(updated.promotions || [])];
        promos.push({ id: `promo-${Date.now()}`, class_id: c.id, from_year: c.year, status: 'pending', created_at: new Date().toISOString() });
        updated.promotions = promos;
        try { localStorage.setItem('pinkslip_data_store', JSON.stringify(updated)); } catch {}
        return updated;
    });
}, 'Promotion request sent to HOD')}>Request approval</button>])}/></Panel><Panel title="Approval requests"><DataTable headers={['Class', 'From year', 'Status', 'Actions']} rows={rows('promotions').map(p => [classLabel(find('classes', p.class_id)), `Year ${p.from_year}`, status(p.status), manager && p.status === 'pending' ? <div className="actions"><button className="primary" disabled={busy} onClick={() => void action(async () => {
    if (client) { await rpc('review_promotion', { p_id: p.id, p_approve: true }); }
    setData(prev => {
        const updated = { ...prev };
        const promos = [...(updated.promotions || [])];
        const pIdx = promos.findIndex(item => item.id === p.id);
        if (pIdx >= 0) {
            promos[pIdx] = { ...promos[pIdx], status: 'approved' };
            updated.promotions = promos;
        }
        const classes = [...(updated.classes || [])];
        const cIdx = classes.findIndex(item => item.id === p.class_id);
        if (cIdx >= 0) {
            const cls = { ...classes[cIdx] };
            if (cls.year < cls.course_years) {
                cls.year += 1;
                cls.promotion_due = '2028-06-30';
            } else {
                cls.active = false;
            }
            classes[cIdx] = cls;
            updated.classes = classes;
        }
        try { localStorage.setItem('pinkslip_data_store', JSON.stringify(updated)); } catch {}
        return updated;
    });
}, 'Promotion approved')}>Approve</button><button disabled={busy} onClick={() => void action(async () => {
    if (client) { await rpc('review_promotion', { p_id: p.id, p_approve: false }); }
    setData(prev => {
        const updated = { ...prev };
        const promos = [...(updated.promotions || [])];
        const pIdx = promos.findIndex(item => item.id === p.id);
        if (pIdx >= 0) {
            promos[pIdx] = { ...promos[pIdx], status: 'declined' };
            updated.promotions = promos;
        }
        try { localStorage.setItem('pinkslip_data_store', JSON.stringify(updated)); } catch {}
        return updated;
    });
}, 'Promotion declined')}>Decline</button></div> : null])}/></Panel></>}
 {page === 'Administration' && manager && <><Panel title="Departments" action={superAdmin ? <button className="primary" onClick={() => editDepartment()}>Add department</button> : undefined}><DataTable headers={['Department', 'Code', 'Actions']} rows={rows('departments').map(d => [d.name, d.code, superAdmin ? <div className="actions"><button onClick={() => editDepartment(d)}>Edit</button><button onClick={() => remove('departments', d)}>Delete</button></div> : null])}/></Panel><Panel title="Classes & advisor assignments" action={<button className="primary" onClick={() => editClass()}>Add class</button>}><DataTable headers={['Class', 'Department', 'Advisor', 'Status', 'Actions']} rows={rows('classes').map(c => [classLabel(c), find('departments', c.department_id)?.name, find('profiles', c.advisor_id)?.name || 'Unassigned', status(c.active ? 'active' : 'completed'), <div className="actions"><button onClick={() => editClass(c)}>Edit</button><button onClick={() => remove('classes', c)}>Delete</button></div>])}/></Panel><Panel title="Accounts" action={<button className="primary" onClick={() => editUser()}>Add account</button>}><DataTable headers={['Name', 'Email', 'Role', 'Status', 'Actions']} rows={rows('profiles').map(p => [p.name, p.email, p.role.replaceAll('_', ' '), status(p.active ? 'active' : 'disabled'), superAdmin || ['advisor', 'student'].includes(p.role) ? <button onClick={() => editUser(p)}>Edit</button> : null])}/></Panel></>}
 {page === 'Audit trail' && superAdmin && <Panel title="Protected audit trail"><DataTable headers={['Time', 'Actor', 'Operation', 'Record']} rows={rows('audit_logs').slice().sort((a, b) => Number(b.id) - Number(a.id)).map(l => [new Date(l.created_at).toLocaleString(), find('profiles', l.actor)?.name || l.actor || 'System', `${l.operation} · ${l.entity}`, <details><summary>View change</summary><pre>{JSON.stringify({ before: l.before_data, after: l.after_data }, null, 2)}</pre></details>])}/></Panel>}
 {['Timetable', 'Notices'].includes(page) && <AcademicContent page={page} data={data} manager={manager} editor={setEditor} remove={remove}/>}
 </main></div>{toast && <div role="status" className="toast">{toast}<button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={16}/></button></div>}{editor && <FormDialog editor={editor} close={() => setEditor(null)} done={refresh}/>} {detail && <StudentDetail student={detail} data={data} manager={manager} close={() => setDetail(null)} action={action}/>} {leave && <LeaveDialog data={data} student={student} close={() => setLeave(false)} done={refresh}/>}{importClass && <ImportStudents classId={importClass} close={() => setImportClass('')} done={refresh}/>}</div>;
    function localDate(value: string) { const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
}
function Directory({ rows, classOpts, manager, add, render, onExport, onImport }: {
    rows: Row[];
    classOpts: [
        string,
        string
    ][];
    manager: boolean;
    add: () => void;
    render: (r: Row[]) => ReactNode[][];
    onExport: (r: Row[]) => void;
    onImport: () => void;
}) {
    const [search, setSearch] = useState(''), [classId, setClassId] = useState(''), [archived, setArchived] = useState(false);
    const visible = rows.filter(s => s.active !== archived && (!classId || s.class_id === classId) && `${s.name} ${s.register_number}`.toLowerCase().includes(search.toLowerCase()));
    return <Panel title="Student directory" action={manager ? <div className="actions"><button onClick={onImport}>Import CSV</button><button className="primary" onClick={add}><Plus size={17}/>Add student</button></div> : undefined}><div className="filters"><label className="search"><Search size={18}/><input aria-label="Search students" placeholder="Search name or register number" value={search} onChange={e => setSearch(e.target.value)}/></label><select aria-label="Filter by class" value={classId} onChange={e => setClassId(e.target.value)}><option value="">All classes</option>{classOpts.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>{manager && <label className="check"><input type="checkbox" checked={archived} onChange={e => setArchived(e.target.checked)}/>Archived</label>}<button disabled={!visible.length} onClick={() => onExport(visible)}><Download size={17}/>Export</button></div><DataTable headers={['Student', 'Class', 'Attendance', 'Action']} rows={render(visible)}/></Panel>;
}
function Attendance({ data, manager, busy, submit }: {
    data: Data;
    manager: boolean;
    busy: boolean;
    submit: (v: Record<string, unknown>) => Promise<void>;
}) {
    const [classId, setClassId] = useState(''), [day, setDay] = useState(collegeDay()), [marks, setMarks] = useState<Record<string, string>>({});
    const classes = (data.classes || []).filter(c => c.active), students = (data.students || []).filter(s => s.active && s.class_id === classId);
    const existing = new Map((data.attendance || []).filter(a => a.day === day).map(a => [a.student_id, a.status]));
    const locked = new Set((data.leaves || []).filter(l => l.status === 'approved' && l.start_date <= day && l.end_date >= day).map(l => l.student_id));
    const submitted = students.some(s => existing.has(s.id)), editable = manager || !submitted;
    const value = (s: Row) => locked.has(s.id) ? 'informed' : marks[s.id] || existing.get(s.id) || '';
    return <Panel title="Daily attendance"><p className="muted">Submit the entire class together. Approved leave is locked as informed absence. Advisors can submit today once; managers can correct saved dates.</p><div className="filters"><label>Class<select value={classId} onChange={e => { setClassId(e.target.value); setMarks({}); }}><option value="">Select class</option>{classes.map(c => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}</select></label><label>College date<input type="date" value={day} max={collegeDay()} disabled={!manager} onChange={e => { setDay(e.target.value); setMarks({}); }}/></label><button disabled={!students.length || !editable || busy} onClick={() => setMarks(Object.fromEntries(students.map(s => [s.id, locked.has(s.id) ? 'informed' : 'present'])))}>Mark all present</button><button disabled={!students.length} onClick={() => exportCSV(`attendance-${day}.csv`, students.map(s => ({ date: day, name: s.name, register_number: s.register_number, status: existing.get(s.id) || 'unmarked' })))}>Export saved records</button></div><DataTable headers={['Student', 'Register number', 'Status']} rows={students.map(s => [s.name, s.register_number, <div className="actions"><select aria-label={`Attendance for ${s.name}`} value={value(s)} disabled={busy || !editable || locked.has(s.id)} onChange={e => setMarks({ ...marks, [s.id]: e.target.value })}><option value="">Select status</option><option value="present">Present</option><option value="informed">Informed absence</option><option value="uninformed">Uninformed absence</option></select>{locked.has(s.id) && <small>Approved leave</small>}</div>])}/><footer><span className="muted">{students.filter(s => value(s)).length} / {students.length} marked {submitted ? '· Previously submitted' : ''}</span><button className="primary" disabled={busy || !editable || !students.length || !day || students.some(s => !value(s))} onClick={() => void submit({ p_day: day, p_marks: students.map(s => ({ student_id: s.id, status: value(s) })) })}>{busy ? 'Saving…' : submitted ? 'Save correction' : 'Submit attendance'}</button></footer></Panel>;
}
function Calculator() { const [present, setPresent] = useState(''), [total, setTotal] = useState(''); const p = Number(present), t = Number(total), valid = Number.isInteger(p) && Number.isInteger(t) && p >= 0 && t > 0 && p <= t; return <Panel title="Attendance planner"><p className="muted">Calculate how many present days you need to reach 75%.</p><div className="form-grid"><label>Days present<input type="number" min={0} value={present} onChange={e => setPresent(e.target.value)}/></label><label>Total marked days<input type="number" min={0} value={total} onChange={e => setTotal(e.target.value)}/></label></div><p className="calculator-result">{valid ? `${percentage(p, t)!.toFixed(1)}% attendance · ${Math.max(0, Math.ceil(3 * t - 4 * p))} consecutive present days needed.` : 'Enter valid counts to calculate.'}</p></Panel>; }
function StudentDetail({ student: s, data, manager, close, action }: {
    student: Row;
    data: Data;
    manager: boolean;
    close: () => void;
    action: (fn: () => Promise<unknown>, message?: string) => Promise<void>;
}) {
    const a = (data.attendance || []).filter(a => a.student_id === s.id).sort((a, b) => b.day.localeCompare(a.day)), p = a.filter(a => a.status === 'present').length;
    return <Modal title={s.name} close={close}><div className="detail"><p>{s.register_number} · {classLabel(data.classes?.find(c => c.id === s.class_id))}</p><p>{s.degree} · {s.email}</p><div className="actions">{s.phone && <a className="button" href={`tel:${s.phone.replace(/[^+0-9]/g, '')}`}>Call student</a>}{s.parent_phone && <a className="button" href={`tel:${s.parent_phone.replace(/[^+0-9]/g, '')}`}>Call parent · {s.parent_name}</a>}</div><h3>{a.length ? `${percentage(p, a.length)!.toFixed(1)}% · ${p} present / ${a.length} marked days` : 'No attendance recorded'}</h3><h3>Leave history</h3><DataTable headers={['Dates', 'Reason', 'Status']} rows={(data.leaves || []).filter(l => l.student_id === s.id).map(l => [`${l.start_date} → ${l.end_date}`, l.reason, status(l.status)])}/>{manager && <><h3>Private parent-call records</h3><DataTable headers={['Response', 'Date', 'Recording']} rows={(data.call_records || []).filter(c => c.student_id === s.id).map(c => [c.parent_response, new Date(c.created_at).toLocaleString(), <button onClick={() => void action(() => openFile(c.recording_path, true), 'Recording opened')}>Play recording</button>])}/></>}<h3>Daily attendance</h3><DataTable headers={['Date', 'Status']} rows={a.map(a => [a.day, status(a.status)])}/></div></Modal>;
}
function LeaveDialog({ data, student, close, done }: {
    data: Data;
    student: boolean;
    close: () => void;
    done: () => Promise<void>;
}) {
    const [sid, setSid] = useState(''), [kind, setKind] = useState('informed'), [start, setStart] = useState(collegeDay()), [end, setEnd] = useState(collegeDay()), [reason, setReason] = useState(''), [letter, setLetter] = useState<File | null>(null), [recording, setRecording] = useState<File | null>(null), [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const uploaded = useRef<{
        sid: string;
        letter?: string;
        call?: string;
    }>({ sid: '' });
    async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); try {
        if (end < start)
            throw Error('End date cannot precede start date.');
        if (!reason.trim())
            throw Error('Enter the reason or parent response.');
        if (kind === 'informed' && !letter)
            throw Error('An approval letter is required.');
        if (kind === 'uninformed' && (!recording || !consent))
            throw Error('Parent recording and consent are required.');
        if (uploaded.current.sid !== sid)
            uploaded.current = { sid };
        if (letter && !uploaded.current.letter)
            uploaded.current.letter = await upload(sid, letter);
        if (kind === 'uninformed' && !uploaded.current.call) {
            const path = await upload(sid, recording!, true);
            uploaded.current.call = await rpc('save_call', { p_student: sid, p_path: path, p_response: reason.trim(), p_consent: consent });
        }
        await save('leaves', { student_id: sid, kind, start_date: start, end_date: end, reason: reason.trim(), letter_path: uploaded.current.letter || null, call_id: kind === 'uninformed' ? uploaded.current.call : null });
        await done();
        close();
    }
    catch (e) {
        setError(errorText(e));
    }
    finally {
        setBusy(false);
    } }
    return <Modal title="New pink slip" close={close} busy={busy}><form onSubmit={submit}><fieldset disabled={busy}><label>Student<select required value={sid} onChange={e => { setSid(e.target.value); uploaded.current = { sid: e.target.value }; }}><option value="">Select student</option>{(data.students || []).filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name} · {s.register_number}</option>)}</select></label><label>Leave type<select value={kind} onChange={e => setKind(e.target.value)}><option value="informed">Informed</option>{!student && <option value="uninformed">Uninformed · parent call required</option>}</select></label><div className="form-grid"><label>From<input type="date" required value={start} onChange={e => setStart(e.target.value)}/></label><label>To<input type="date" required min={start} value={end} onChange={e => setEnd(e.target.value)}/></label></div><label>{kind === 'informed' ? 'Reason for leave' : 'Parent response'}<textarea required value={reason} onChange={e => { setReason(e.target.value); uploaded.current.call = undefined; }}/></label><label>Approval letter · PDF / image, up to 10 MB<input type="file" accept=".pdf,.png,.jpg,.jpeg" required={kind === 'informed'} onChange={e => { setLetter(e.target.files?.[0] || null); uploaded.current.letter = undefined; }}/></label>{kind === 'uninformed' && <><p className="small muted">Upload a consented parent-call recording. Recording playback is restricted to HOD and Super Admin.</p><label>Recording · up to 50 MB<input type="file" accept=".mp3,.m4a,.wav,.webm,.ogg,.aac" required onChange={e => { setRecording(e.target.files?.[0] || null); uploaded.current.call = undefined; }}/></label><label className="check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} required/>Participants consented to recording and college storage.</label></>}</fieldset>{error && <p className="error" role="alert">{error}</p>}<footer><button type="button" disabled={busy} onClick={close}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit to HOD'}</button></footer></form></Modal>;
}
function AcademicContent({ page, data, manager, editor, remove }: {
    page: string;
    data: Data;
    manager: boolean;
    editor: (e: Editor) => void;
    remove: (t: string, r: Row) => void;
}) {
    const timetable = page === 'Timetable', table = timetable ? 'timetable_entries' : 'notices';
    const [classId, setClassId] = useState('');
    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    function edit(row?: Row) { const fields: Field[] = timetable ? [{ key: 'class_id', label: 'Class', options: options((data.classes || []).filter(c => c.active), classLabel) }, { key: 'weekday', label: 'Weekday', options: weekdays.map((d, i) => [String(i + 1), d]) }, { key: 'period', label: 'Period number', type: 'number', min: 1, max: 20 }, { key: 'subject', label: 'Subject' }, { key: 'teacher', label: 'Teacher', required: false }, { key: 'room', label: 'Room', required: false }, { key: 'starts_at', label: 'Start time', type: 'time' }, { key: 'ends_at', label: 'End time', type: 'time' }] : [{ key: 'department_id', label: 'Department', options: options(data.departments || [], d => d.name) }, { key: 'title', label: 'Title' }, { key: 'body', label: 'Announcement' }]; editor({ title: `${row ? 'Edit' : 'Add'} ${timetable ? 'timetable entry' : 'notice'}`, fields: fields.map(f => ({ ...f, value: row?.[f.key] })), submit: v => save(table, timetable ? { ...v, weekday: Number(v.weekday), period: Number(v.period) } : v, row?.id) }); }
    const visible = (data[table] || []).filter(r => !timetable || !classId || r.class_id === classId).slice().sort((a, b) => timetable ? a.weekday - b.weekday || a.period - b.period : b.created_at.localeCompare(a.created_at));
    return <Panel title={page} action={manager ? <button className="primary" onClick={() => edit()}>Add {timetable ? 'period' : 'notice'}</button> : undefined}>{timetable && <label>Class<select value={classId} onChange={e => setClassId(e.target.value)}><option value="">All classes</option>{(data.classes || []).map(c => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}</select></label>}<DataTable headers={timetable ? ['Class', 'Day / period', 'Subject', 'Time', 'Actions'] : ['Title', 'Announcement', 'Published', 'Actions']} rows={visible.map(r => timetable ? [classLabel(data.classes?.find(c => c.id === r.class_id)), `${weekdays[r.weekday - 1]} · ${r.period}`, <>{r.subject}<small>{r.teacher} · {r.room}</small></>, `${r.starts_at.slice(0, 5)}–${r.ends_at.slice(0, 5)}`, manager ? <div className="actions"><button onClick={() => edit(r)}>Edit</button><button onClick={() => remove(table, r)}>Delete</button></div> : null] : [r.title, r.body, new Date(r.created_at).toLocaleString(), manager ? <div className="actions"><button onClick={() => edit(r)}>Edit</button><button onClick={() => remove(table, r)}>Delete</button></div> : null])}/></Panel>;
}
// CSV parsing supports quoted commas, newlines and escaped quotes; no spreadsheet code executes.
export function parseCSV(text: string): string[][] { const result: string[][] = []; let row: string[] = [], cell = '', quoted = false; for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
        if (quoted && text[i + 1] === '"') {
            cell += '"';
            i++;
        }
        else
            quoted = !quoted;
    }
    else if (c === ',' && !quoted) {
        row.push(cell);
        cell = '';
    }
    else if ((c === '\n' || c === '\r') && !quoted) {
        if (c === '\r' && text[i + 1] === '\n')
            i++;
        row.push(cell);
        if (row.some(s => s.trim()))
            result.push(row);
        row = [];
        cell = '';
    }
    else
        cell += c;
} if (quoted)
    throw Error('CSV contains an unclosed quote.'); row.push(cell); if (row.some(s => s.trim()))
    result.push(row); return result; }
function ImportStudents({ classId, close, done }: {
    classId: string;
    close: () => void;
    done: () => Promise<void>;
}) {
    const [items, setItems] = useState<Record<string, string>[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    async function select(file?: File) { setItems([]); setError(''); if (!file)
        return; try {
        if (file.size > 2 * 1024 * 1024)
            throw Error('CSV must be under 2 MB.');
        const [headers, ...records] = parseCSV((await file.text()).replace(/^\uFEFF/, ''));
        const allowed = ['name', 'register_number', 'degree', 'email', 'phone', 'parent_name', 'parent_phone'];
        if (!headers || !['name', 'register_number', 'degree'].every(k => headers.includes(k)) || headers.some(k => !allowed.includes(k)) || new Set(headers).size !== headers.length)
            throw Error('Use the exact template column names.');
        if (records.length > 1000)
            throw Error('Import up to 1,000 students at a time.');
        const parsed = records.map((r, i) => { if (r.length !== headers.length)
            throw Error(`Row ${i + 2}: wrong column count.`); const v = Object.fromEntries(headers.map((h, j) => [h, r[j].trim()])); if (!v.name || !v.register_number || !v.degree)
            throw Error(`Row ${i + 2}: name, register_number and degree are required.`); return v; });
        if (new Set(parsed.map(r => r.register_number)).size !== parsed.length)
            throw Error('Duplicate register numbers in this file.');
        setItems(parsed);
    }
    catch (e) {
        setError(errorText(e));
    } }
    async function submit() { setBusy(true); try {
        const { error } = await client!.from('students').insert(items.map(r => ({ ...r, class_id: classId })));
        if (error)
            throw error;
        await done();
        close();
    }
    catch (e) {
        setError(errorText(e));
    }
    finally {
        setBusy(false);
    } }
    return <Modal title="Import students" close={close} busy={busy}><div className="detail"><p>CSV columns: <code>name,register_number,degree,email,phone,parent_name,parent_phone</code></p><p>Name, register number and degree are required. All rows are saved together; duplicate existing register numbers reject the import.</p><label>Select CSV<input type="file" accept=".csv" disabled={busy} onChange={e => void select(e.target.files?.[0])}/></label>{error && <p className="error" role="alert">{error}</p>}<DataTable headers={['Name', 'Register number', 'Degree']} rows={items.map(r => [r.name, r.register_number, r.degree])}/><footer><button disabled={busy || !items.length} className="primary" onClick={() => void submit()}>{busy ? 'Importing…' : `Import ${items.length} students`}</button></footer></div></Modal>;
}
