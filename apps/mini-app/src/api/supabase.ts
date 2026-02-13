import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zerddyzvmuapdpllewht.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplcmRkeXp2bXVhcGRwbGxld2h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MTcwMzEsImV4cCI6MjA4NjQ5MzAzMX0.6_hzR_a5G5E4F3_cv38doL1TbiDGMXiyYQgW1U-FUl0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
