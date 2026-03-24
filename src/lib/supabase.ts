import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder_key';
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (supabaseUrl === 'https://placeholder.supabase.co') {
  console.error("Supabase URL or Anon Key is missing. Please check your environment variables.");
} else {
  console.log("Supabase client initialized with URL:", supabaseUrl);
}

// Use service role key if available to bypass RLS during development/testing
export const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);
