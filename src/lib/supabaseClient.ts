import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client.
 *
 * Configuration comes only from Vite env variables:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 *
 * If they are missing the app FAILS CLOSED: there is no session, sign-in is
 * refused with an explicit error, and every data call returns an error. It
 * never fabricates a signed-in user.
 */

// Clean the URL: strip trailing slashes and an accidental /rest/v1 suffix.
const rawUrl = ((import.meta.env?.VITE_SUPABASE_URL as string | undefined) ?? "").trim();
const supabaseUrl = rawUrl.replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
const supabaseAnonKey = ((import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "").trim();

export const isSupabaseConfigured: boolean =
  /^https?:\/\//.test(supabaseUrl) && supabaseAnonKey.length > 0;

const NOT_CONFIGURED_MESSAGE =
  "Authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY and rebuild.";

function createUnconfiguredClient(): any {
  console.error(NOT_CONFIGURED_MESSAGE);
  const error = new Error(NOT_CONFIGURED_MESSAGE);

  // Any chained query (from().select().eq()...) resolves to { data: null, error }.
  const failingQuery = (): any =>
    new Proxy(function () {}, {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve: (v: unknown) => void) => resolve({ data: null, error });
        }
        return failingQuery;
      },
      apply() {
        return failingQuery();
      },
    });

  const refused = () => Promise.resolve({ data: { session: null, user: null }, error });

  return {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: refused,
      signInWithOAuth: refused,
      signUp: refused,
      resetPasswordForEmail: refused,
      updateUser: refused,
      signOut: () => Promise.resolve({ error: null }),
    },
    from: failingQuery,
    rpc: failingQuery,
  };
}

export const supabase: any = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createUnconfiguredClient();
