import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://qyikubuqyhobppvojvpa.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5aWt1YnVxeWhvYnBwdm9qdnBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5ODM5NDUsImV4cCI6MjA4OTU1OTk0NX0.YYhbW3KrkXtBDBb4Wpnvfrbl8hzb8-ixet54prpD6_U";

// Fetch com timeout e retry automático para todas as queries
function createResilientFetch(retries = 2, timeout = 15000) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(input, {
          ...init,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.status === 401 || response.status === 403) {
          clearTimeout(timeoutId);
          return response;
        }

        if (response.status >= 500 || response.status === 429) {
          if (attempt < retries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
            await new Promise((r) => setTimeout(r, delay + Math.random() * 500));
            continue;
          }
        }

        return response;
      } catch (err) {
        clearTimeout(timeoutId);
        lastError = err as Error;

        if (attempt < retries && (err as Error).name !== "AbortError") {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
      }
    }

    throw lastError || new Error("Fetch failed after retries");
  };
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    fetch: createResilientFetch(2, 15000),
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
