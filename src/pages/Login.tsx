import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck } from "lucide-react";

type Step = "email" | "verify";

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) navigate("/");
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSendCode = async () => {
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      toast({
        title: "E-mail inválido",
        description: "Informe um e-mail válido para receber o código.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
      });
      if (error) throw error;

      setStep("verify");
      toast({
        title: "Código enviado",
        description: `Enviamos um código para ${normalizedEmail}.`,
      });
    } catch (err) {
      const error = err as Error;
      console.error("Erro ao enviar OTP:", error);
      
      // Verificar se é erro de rate limit
      const isRateLimit = error.message.toLowerCase().includes("rate limit") || 
                          error.message.includes("429") ||
                          error.message.includes("security purposes");
      
      toast({
        title: isRateLimit ? "Aguarde um momento" : "Erro ao enviar código",
        description: isRateLimit 
          ? "Muitas tentativas. Aguarde 60 segundos antes de solicitar um novo código."
          : error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6 || !normalizedEmail) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: code,
        type: "email",
      });
      if (error) throw error;

      // Aguardar a sessão ser estabelecida antes de redirecionar
      if (data.session) {
        toast({
          title: "Login realizado",
          description: "Você já pode acessar o painel do restaurante.",
        });
        // Pequeno delay para garantir que a sessão seja persistida
        setTimeout(() => {
          navigate("/", { replace: true });
        }, 100);
      }
    } catch (err) {
      const error = err as Error;
      console.error("Erro ao verificar OTP:", error);
      toast({
        title: "Código inválido",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Acessar painel</CardTitle>
          <CardDescription>
            {step === "email"
              ? "Entre com seu e-mail para receber o código de acesso."
              : `Digite o código enviado para ${normalizedEmail}`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {step === "email" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                />
              </div>

              <Button className="w-full" onClick={handleSendCode} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar código"
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button className="w-full" onClick={handleVerify} disabled={loading || code.length !== 6}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  "Confirmar"
                )}
              </Button>

              <div className="flex flex-col gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={handleSendCode}
                  disabled={loading}
                >
                  Reenviar código
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => {
                    setCode("");
                    setStep("email");
                  }}
                  disabled={loading}
                >
                  Usar outro e-mail
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
