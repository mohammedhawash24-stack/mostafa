// Supabase browser client configuration.
// The publishable key is intended for browser use; RLS protects the data.
const SUPABASE_URL = 'https://nwvpdnpqrnconrztfpav.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_5RUnB64u1krx4SGc7dhx1A_4A62SC-U';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
