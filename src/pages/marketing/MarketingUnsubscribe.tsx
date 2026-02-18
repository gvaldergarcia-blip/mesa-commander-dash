import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2, MailX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function MarketingUnsubscribe() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "already" | "error">("loading");
  const [customerName, setCustomerName] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    const unsubscribe = async () => {
      const { data, error } = await supabase.rpc("marketing_unsubscribe", {
        p_token: token,
      });

      if (error || !data?.success) {
        setStatus("error");
        return;
      }

      setCustomerName(data.name || null);
      setStatus(data.already_unsubscribed ? "already" : "success");
    };

    unsubscribe();
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="h-12 w-12 mx-auto text-muted-foreground animate-spin mb-4" />
            <h2 className="text-xl font-semibold text-foreground">Processando...</h2>
            <p className="text-muted-foreground mt-2">Aguarde um momento.</p>
          </>
        )}

        {status === "success" && (
          <>
            <MailX className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold text-foreground">Descadastrado</h2>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              {customerName ? `${customerName}, v` : "V"}ocê não receberá mais e-mails promocionais.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              Se mudar de ideia, solicite ao restaurante uma nova inscrição.
            </p>
          </>
        )}

        {status === "already" && (
          <>
            <CheckCircle2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold text-foreground">Já descadastrado</h2>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              {customerName ? `${customerName}, v` : "V"}ocê já estava descadastrado.
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
            <h2 className="text-2xl font-bold text-foreground">Link inválido</h2>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              Este link não é válido ou já expirou.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
