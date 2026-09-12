import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://dpjsecqjcfgytcdxaksy.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwanNlY3FqY2ZneXRjZHhha3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NDY1NzQsImV4cCI6MjEwNDUyMjU3NH0.RVGZAA_FemXXDh8Nxg3GkjM56MSe7GJ2Wf_F2DlGnd0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});
