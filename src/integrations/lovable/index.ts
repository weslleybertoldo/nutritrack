// Lovable OAuth integration stub
// Google OAuth via lovable.dev/cloud-auth-js requires Lovable Cloud.
// Since we're using an external Supabase, we'll use Supabase's native OAuth instead.

import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: "google" | "apple", opts?: SignInOptions) => {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: opts?.redirect_uri || window.location.origin,
        },
      });
      if (error) return { error };
      return { redirected: true };
    },
  },
};
