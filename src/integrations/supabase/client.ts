// This file re-exports the singleton Supabase client to prevent multiple GoTrueClient instances
// Import from either '@/lib/supabase/client' or '@/integrations/supabase/client' - both work the same

export { supabase } from '@/lib/supabase/client';
