import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
export const client = url && /^https?:\/\//.test(url) && key ? createClient(url, key) : null;
export type Row = {
    id: string;
    [key: string]: any;
};
export type Data = Record<string, Row[]>;
export const tables = ['departments', 'profiles', 'classes', 'students', 'attendance', 'leaves', 'promotions', 'notifications', 'calendar_events', 'call_records', 'audit_logs', 'timetable_entries', 'notices'];
export const collegeDay = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
export const errorText = (e: unknown) => e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e);
export const percentage = (p: number, t: number) => t ? 100 * p / t : null;
export const classLabel = (c?: Row) => c ? `Year ${c.year} · ${c.section} · ${c.batch} batch` : 'Unassigned';
export async function readAll(table: string) {
    const rows: Row[] = [];
    for (let offset = 0;; offset += 1000) {
        const { data, error } = await client!.from(table).select('*').order('id', { ascending: table !== 'audit_logs' }).range(offset, offset + 999);
        if (error)
            throw error;
        rows.push(...data);
        if (data.length < 1000 || table === 'audit_logs')
            return rows;
    }
}
export async function save(table: string, row: Record<string, unknown>, id?: string) {
    const query = id ? client!.from(table).update(row).eq('id', id) : client!.from(table).insert(row);
    const { error } = await query;
    if (error)
        throw error;
}
export async function rpc(name: string, params: Record<string, unknown>) {
    const { data, error } = await client!.rpc(name, params);
    if (error)
        throw error;
    return data;
}
export async function invoke(name: string, body: Record<string, unknown>) {
    const { data, error } = await client!.functions.invoke(name, { body });
    if (error) {
        if (error.context instanceof Response) {
            const result = await error.context.json().catch(() => null);
            if (result?.error)
                throw new Error(result.error);
        }
        throw error;
    }
    if (data?.error)
        throw new Error(data.error);
    return data;
}
export async function upload(studentId: string, file: File, recording = false) {
    const types: Record<string, string> = recording ? { mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', webm: 'audio/webm', ogg: 'audio/ogg', aac: 'audio/aac' } : { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!types[ext] || file.size === 0 || file.size > (recording ? 50 : 10) * 1024 * 1024)
        throw new Error(`Select a supported ${recording ? 'audio file under 50' : 'PDF or image under 10'} MB.`);
    const path = `${studentId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await client!.storage.from(recording ? 'call-recordings' : 'leave-letters').upload(path, file, { contentType: types[ext] });
    if (error)
        throw error;
    return path;
}
export async function openFile(path: string, recording = false) {
    const tab = window.open('about:blank', '_blank');
    if (tab)
        tab.opener = null;
    try {
        const { data, error } = await client!.storage.from(recording ? 'call-recordings' : 'leave-letters').createSignedUrl(path, 60);
        if (error)
            throw error;
        if (tab)
            tab.location.href = data.signedUrl;
        else
            throw new Error('Allow pop-ups to open the attachment.');
    }
    catch (e) {
        tab?.close();
        throw e;
    }
}
export function exportCSV(filename: string, rows: Record<string, unknown>[]) {
    if (!rows.length)
        throw new Error('There are no records to export.');
    const cols = Object.keys(rows[0]);
    const cell = (v: unknown) => { let s = String(v ?? ''); if (/^[\s]*[=+@-]/.test(s))
        s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; };
    const url = URL.createObjectURL(new Blob(['\uFEFF' + [cols.map(cell).join(','), ...rows.map(r => cols.map(k => cell(r[k])).join(','))].join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
