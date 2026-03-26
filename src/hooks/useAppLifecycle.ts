import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";

export function useAppLifecycle(onResume?: () => void) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const stateListener = CapApp.addListener("appStateChange", async ({ isActive }) => {
      if (isActive) {
        supabase.auth.startAutoRefresh();

        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            await supabase.auth.refreshSession();
          }
        } catch {
          // Offline
        }

        onResume?.();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    const backListener = CapApp.addListener("backButton", ({ canGoBack }) => {
      if (!canGoBack) {
        CapApp.minimizeApp();
      } else {
        window.history.back();
      }
    });

    return () => {
      stateListener.then((l) => l.remove());
      backListener.then((l) => l.remove());
    };
  }, [onResume]);
}
