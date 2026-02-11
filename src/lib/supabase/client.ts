import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://akqldesakmcroydbgkbe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrcWxkZXNha21jcm95ZGJna2JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNzU5MzMsImV4cCI6MjA3MDk1MTkzM30.z9-eadw-xSeHgnqUUO5BMm2vVkabfY3p41Yb9CGPXIM";

// Singleton pattern to prevent multiple GoTrueClient instances
let supabaseInstance: any = null;

export const supabase = (() => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        detectSessionInUrl: true,
        flowType: 'implicit',
      },
    });
  }
  return supabaseInstance;
})();
