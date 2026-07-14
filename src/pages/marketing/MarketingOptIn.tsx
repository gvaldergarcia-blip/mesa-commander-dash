import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useGeofenceTracker } from "@/hooks/useGeofenceTracker";

export default function MarketingOptIn() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "already" | "error">("loading");
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string | null>(null);
  const [gpsConsent, setGpsConsent] = useState<"idle" | "requesting" | "granted" | "denied">("idle");

  const { lastCheck } = useGeofenceTracker({ token, enabled: gpsConsent === "granted" });

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    const confirm = async () => {
      const { data, error } = await supabase.rpc("confirm_marketing_optin", {
        p_token: token,
      });

      if (error || !data?.success) {
        setStatus("error");
        return;
      }

      setCustomerName(data.name || null);
      setRestaurantName(data.restaurant_name || null);
      setStatus(data.already_opted_in ? "already" : "success");
    };

    confirm();
  }, [token]);

  const requestGpsConsent = () => {
    if (!token || typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsConsent("denied");
      return;
    }
    setGpsConsent("requesting");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const { data, error } = await supabase.rpc("set_customer_location_consent", {
          p_token: token,
          p_latitude: latitude,
          p_longitude: longitude,
        });
        if (error || !(data as any)?.success) {
          setGpsConsent("denied");
          return;
        }
        setGpsConsent("granted");
      },
      () => setGpsConsent("denied"),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin mb-4" />
            <h2 className="text-xl font-semibold text-foreground">Confirmando...</h2>
            <p className="text-muted-foreground mt-2">Aguarde um momento.</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-2xl font-bold text-foreground">Inscrito com sucesso!</h2>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              {customerName ? `Olá ${customerName}! ` : ""}Você agora receberá promoções
              {restaurantName ? ` do ${restaurantName}` : ""}.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              Você pode cancelar a qualquer momento através do link nos e-mails.
            </p>

            <div className="mt-6 pt-6 border-t border-border/60 text-left">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Promoções especiais quando você chegar</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Compartilhe sua localização para receber ofertas quando estiver no restaurante.
                    Você pode revogar a permissão a qualquer momento no navegador.
                  </p>
                  {gpsConsent === "idle" && (
                    <button
                      type="button"
                      onClick={requestGpsConsent}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 hover:opacity-90"
                    >
                      <MapPin className="h-4 w-4" /> Compartilhar localização
                    </button>
                  )}
                  {gpsConsent === "requesting" && (
                    <p className="mt-3 text-xs text-muted-foreground inline-flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Aguardando permissão…
                    </p>
                  )}
                  {gpsConsent === "granted" && (
                    <p className="mt-3 text-xs text-green-600 font-medium">
                      ✓ Localização compartilhada.
                      {lastCheck?.in ? " Você está no restaurante!" : ""}
                    </p>
                  )}
                  {gpsConsent === "denied" && (
                    <p className="mt-3 text-xs text-destructive">
                      Permissão negada. Ative a localização nas configurações do navegador para receber ofertas ao chegar.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {status === "already" && (
          <>
            <CheckCircle2 className="h-16 w-16 mx-auto text-blue-500 mb-4" />
            <h2 className="text-2xl font-bold text-foreground">Já inscrito!</h2>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              {customerName ? `${customerName}, v` : "V"}ocê já está inscrito para receber promoções
              {restaurantName ? ` do ${restaurantName}` : ""}.
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
            <h2 className="text-2xl font-bold text-foreground">Link inválido</h2>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              Este link não é válido ou já expirou. Solicite um novo link ao restaurante.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
