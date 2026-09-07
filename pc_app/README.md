# Tobacco & Cigarette Shop Manager — Supabase version

This build uses Supabase for authentication, PostgreSQL data, and RLS instead of the old local Mock API.

## Before first login
1. In Supabase SQL Editor, run the main schema you already created.
2. Then run `supabase-setup.sql` from this folder. It adds the atomic `complete_order` RPC used when an order is completed.
3. The browser client is configured in `supabase-config.js` with the project URL and **publishable** key.
4. Log in with the email/password of the Supabase Auth user whose `profiles.role` is `admin`.

Never put a Supabase secret/service-role key or database password in this static site.
