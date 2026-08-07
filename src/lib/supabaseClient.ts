import { createClient } from '@supabase/supabase-js';

declare const process: any;

// Support both Next.js/Vite environment variable naming schemes to satisfy prompt constraints
const rawUrl = 
  (import.meta.env?.VITE_SUPABASE_URL) || 
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) || 
  '';

// Clean Supabase URL: remove trailing slashes and /rest/v1 appends to prevent 404 endpoint errors
let supabaseUrl = rawUrl.trim();
if (supabaseUrl) {
  supabaseUrl = supabaseUrl.replace(/\/+$/, '');
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1$/, '');
}


const supabaseAnonKey = 
  (import.meta.env?.VITE_SUPABASE_ANON_KEY) || 
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) || 
  '';

const isValidUrl = (url: string): boolean => {
  try {
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
};

let supabaseInstance: any = null;

if (isValidUrl(supabaseUrl) && supabaseAnonKey) {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn('Supabase URL is not a valid HTTP/HTTPS URL. Current URL:', supabaseUrl);
  // Create a fallback proxy client that safely resolves promises rather than crashing
  supabaseInstance = new Proxy({} as any, {
    get(_, prop) {
      if (prop === 'auth') {
        return {
          getSession: () => Promise.resolve({ data: { session: null } }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
          signInWithPassword: () => Promise.resolve({ data: null, error: new Error('Supabase client not configured with a valid HTTP URL.') }),
          signUp: () => Promise.resolve({ data: null, error: new Error('Supabase client not configured with a valid HTTP URL.') }),
          signOut: () => Promise.resolve({ error: null }),
        };
      }
      return () => Promise.resolve({ data: null, error: new Error('Supabase client not configured.') });
    }
  });
}

export const supabase = supabaseInstance;

