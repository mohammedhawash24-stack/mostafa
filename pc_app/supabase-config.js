// Supabase browser client configuration.
// Publishable key is safe for browser use when RLS is enabled.
const SUPABASE_URL = 'https://nwvpdnpqrnconrztfpav.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_5RUnB64u1krx4SGc7dhx1A_4A62SC-U';

if (!window.supabase || typeof window.supabase.createClient !== 'function') {
  throw new Error('Supabase library failed to load. Check your internet connection and refresh the page.');
}

window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

if (!window.supabaseClient.auth || typeof window.supabaseClient.auth.signInWithPassword !== 'function') {
  throw new Error('Supabase Auth failed to initialize. Please refresh the page.');
}
