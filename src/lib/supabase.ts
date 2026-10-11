import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { tk } from './tk';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim();

/** Why the app cannot talk to Supabase, or null when the config looks fine. */
export const configError: string | null = (() => {
  if (!url || !key) return tk('VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are missing from .env.');
  if (!/^https:\/\/.+/.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(url))
    return tk('VITE_SUPABASE_URL must start with https:// (http is only allowed for a local Supabase on localhost)');
  if (/^sb_secret_/.test(key) || /service_role/.test(atobSafe(key.split('.')[1] ?? '')))
    return tk('The key in .env is a SECRET / service_role key. Replace it with the publishable key — never ship a secret key in the app.');
  return null;
})();

function atobSafe(s: string) {
  try { return atob(s.replace(/-/g, '+').replace(/_/g, '/')); } catch { return ''; }
}

export const supabase: SupabaseClient = createClient(url || 'https://invalid.local', key || 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'aminzi-auth' },
  realtime: { params: { eventsPerSecond: 5 } },
});
