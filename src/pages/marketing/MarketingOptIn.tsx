import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function MarketingOptIn() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "already" | "error">("loading");
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string | null>(null);

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
