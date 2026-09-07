// Supabase browser client configuration
const SUPABASE_URL = 'https://nwvpdnpqrnconrztfpav.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_5RUnB64u1krx4SGc7dhx1A_4A62SC-U';

// Initialize the client once the UMD library has loaded.
(function initSupabase() {
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('Supabase library failed to load.');
    window.supabaseClient = null;
    return;
  }
  try {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  } catch (err) {
    console.error('Supabase client initialization failed:', err);
    window.supabaseClient = null;
  }
})();
