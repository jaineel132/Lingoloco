import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';

let browserClient: ReturnType<typeof createSupabaseBrowserClient> | null = null;

function getBrowserEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!supabaseKey) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }

  return { supabaseUrl, supabaseKey };
}

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    const { supabaseUrl, supabaseKey } = getBrowserEnv();

    browserClient = createSupabaseBrowserClient(
      supabaseUrl,
      supabaseKey
    );
  }

  return browserClient;
}

export const createBrowserClient = getSupabaseBrowserClient;
