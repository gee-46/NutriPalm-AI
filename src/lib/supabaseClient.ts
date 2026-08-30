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
  
  // Create stateful mock auth variables for robust offline prototype fallback
  let mockSession: any = null;
  const authListeners = new Set<(event: string, session: any) => void>();

  // Create a fallback proxy client that safely resolves promises rather than crashing
  supabaseInstance = new Proxy({} as any, {
    get(_, prop) {
      if (prop === 'auth') {
        return {
          getSession: () => Promise.resolve({ data: { session: mockSession } }),
          onAuthStateChange: (callback: any) => {
            authListeners.add(callback);
            // Initial notify to sync components
            setTimeout(() => {
              callback(mockSession ? 'SIGNED_IN' : 'SIGNED_OUT', mockSession);
            }, 0);
            return {
              data: {
                subscription: {
                  unsubscribe: () => {
                    authListeners.delete(callback);
                  }
                }
              }
            };
          },
          signInWithPassword: ({ email }: any) => {
            mockSession = {
              user: {
                id: 'mock-user',
                email: email || 'demo@samruddhiorganics.in',
              }
            };
            authListeners.forEach(cb => cb('SIGNED_IN', mockSession));
            return Promise.resolve({ data: { session: mockSession }, error: null });
          },
          signInWithOAuth: ({ provider }: any) => {
            mockSession = {
              user: {
                id: 'mock-user',
                email: `${provider}-user@gmail.com`,
              }
            };
            authListeners.forEach(cb => cb('SIGNED_IN', mockSession));
            return Promise.resolve({ data: { session: mockSession }, error: null });
          },
          signUp: ({ email }: any) => {
            mockSession = {
              user: {
                id: 'mock-user',
                email: email,
              }
            };
            authListeners.forEach(cb => cb('SIGNED_IN', mockSession));
            return Promise.resolve({ data: { session: mockSession }, error: null });
          },
          signOut: () => {
            mockSession = null;
            authListeners.forEach(cb => cb('SIGNED_OUT', null));
            return Promise.resolve({ error: null });
          },
        };
      }
      return () => Promise.resolve({ data: null, error: new Error('Supabase client not configured.') });
    }
  });
}

export const supabase = supabaseInstance;

