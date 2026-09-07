/* Supabase browser client configuration. Wrapped to avoid global-name collisions. */
(function () {
  var url = 'https://nwvpdnpqrnconrztfpav.supabase.co';
  var key = 'sb_publishable_5RUnB64u1krx4SGc7dhx1A_4A62SC-U';

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('Supabase library failed to load.');
    window.supabaseClient = null;
    return;
  }

  try {
    window.supabaseClient = window.supabase.createClient(url, key);
    console.log('Supabase connected');
  } catch (err) {
    console.error('Supabase client initialization failed:', err);
    window.supabaseClient = null;
  }
})();
