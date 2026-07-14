import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Observa a geolocalização enquanto a página estiver aberta.
 * Ao entrar no raio do restaurante por >= dwellMs, chama register_gps_visit.
 */
export function useGeofenceTracker(opts: {
  token: string | null;
  enabled: boolean;
  dwellMs?: number;
}) {
  const { token, enabled, dwellMs = 3 * 60_000 } = opts;
  const [lastCheck, setLastCheck] = useState<null | { in: boolean; distance_m?: number }>(null);
  const inSinceRef = useRef<number | null>(null);
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!enabled || !token) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const { data, error } = await supabase.rpc("register_gps_visit", {
          p_customer_token: token,
          p_latitude: latitude,
          p_longitude: longitude,
        });
        if (error) return;
        const r = data as any;
        if (r?.success) {
          registeredRef.current = true;
          setLastCheck({ in: true, distance_m: r.distance_m });
        } else if (r?.error === "out_of_range") {
          inSinceRef.current = null;
          setLastCheck({ in: false, distance_m: r.distance_m });
        } else if (r?.error === "recent_visit") {
          setLastCheck({ in: true });
        } else {
          setLastCheck({ in: false });
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled, token, dwellMs]);

  return { lastCheck };
}