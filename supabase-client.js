/**
 * RollPhase's Supabase client. Reads window.ROLLPHASE_PUBLIC (config.public.js, the publishable
 * key — safe in a browser, every table has row-level security). Exposes window.RP:
 *   RP.db               the supabase-js client
 *   RP.user()            the current user, signing in anonymously only if there's no session yet
 *   RP.ensureProfile(displayName, sport, belt)   upserts public.profiles for the current user
 *   RP.online            best-effort connectivity flag (navigator.onLine + a failed-request latch)
 *
 * Never put the secret key here or anywhere in this app. config.public.js holds only the URL
 * and the publishable key, and it is committed on purpose (it is public by design).
 */
const RP = (() => {
  const cfg = (typeof window !== "undefined" && window.ROLLPHASE_PUBLIC) || {};
  let db = null;
  let userPromise = null;
  let failedRequest = false;

  function client() {
    if (db) return db;
    if (!cfg.supabaseUrl || !cfg.supabaseKey) {
      console.warn("RP: window.ROLLPHASE_PUBLIC is missing supabaseUrl/supabaseKey");
      return null;
    }
    if (typeof window.supabase === "undefined" || typeof window.supabase.createClient !== "function") {
      console.warn("RP: supabase-js did not load (check the CDN <script> tag)");
      return null;
    }
    db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    return db;
  }

  /**
   * The current user. Signs in anonymously only when there is no stored session (the session
   * persists in the client's default storage — localStorage — so a reload reuses the same id).
   * The anonymous sign-in limit is 30/hour/IP: never call this more than once per load per tab.
   */
  async function user() {
    if (userPromise) return userPromise;
    userPromise = (async () => {
      const c = client();
      if (!c) return null;
      const { data: sessionData } = await c.auth.getSession();
      if (sessionData?.session?.user) return sessionData.session.user;
      const { data, error } = await c.auth.signInAnonymously();
      if (error) {
        failedRequest = true;
        console.warn("RP.user: anonymous sign-in failed", error.message);
        return null;
      }
      return data?.user || null;
    })();
    return userPromise;
  }

  /** Upserts profiles for the current user. Returns the row, or null if not signed in. */
  async function ensureProfile(displayName, sport, belt) {
    const c = client();
    const u = await user();
    if (!c || !u) return null;
    const row = { id: u.id };
    if (displayName != null) row.display_name = displayName;
    if (sport !== undefined) row.sport = sport;
    if (belt !== undefined) row.belt = belt;
    const { data, error } = await c.from("profiles").upsert(row).select().single();
    if (error) {
      failedRequest = true;
      console.warn("RP.ensureProfile failed", error.message);
      return null;
    }
    return data;
  }

  return {
    get db() {
      return client();
    },
    user,
    ensureProfile,
    get online() {
      return (typeof navigator === "undefined" || navigator.onLine !== false) && !failedRequest;
    },
  };
})();

if (typeof window !== "undefined") window.RP = RP;
