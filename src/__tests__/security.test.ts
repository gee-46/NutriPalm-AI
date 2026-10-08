// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import authScreenSource from "../components/PrototypeAuth.tsx?raw";

/**
 * With no Supabase configuration the client must fail closed: no session, no
 * mock user, and every sign-in path returns an error.
 */
describe("supabase client without configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("reports itself as not configured", async () => {
    const { isSupabaseConfigured } = await import("../lib/supabaseClient");
    expect(isSupabaseConfigured).toBe(false);
  });

  it("never creates a session for any sign-in method", async () => {
    const { supabase } = await import("../lib/supabaseClient");
    const password = await supabase.auth.signInWithPassword({ email: "a@b.c", password: "x" });
    const oauth = await supabase.auth.signInWithOAuth({ provider: "google" });
    const signUp = await supabase.auth.signUp({ email: "a@b.c", password: "x" });
    for (const result of [password, oauth, signUp]) {
      expect(result.error).toBeTruthy();
      expect(result.data.session).toBeNull();
    }
    const { data } = await supabase.auth.getSession();
    expect(data.session).toBeNull();
  });

  it("returns errors, not data, for table queries", async () => {
    const { supabase } = await import("../lib/supabaseClient");
    const result = await supabase.from("plots").select("*").eq("owner_id", "x");
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

describe("source tree contains no hard-coded login", () => {
  it("has no demo credentials in the auth screen", () => {
    expect(authScreenSource).not.toMatch(/DemoUser|demo@samruddhi/i);
  });
});
