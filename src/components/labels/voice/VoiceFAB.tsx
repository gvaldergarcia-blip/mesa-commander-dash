import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Loader2, Check, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/contexts/RestaurantContext";
import { useLabelProducts } from "@/hooks/useLabelProducts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Intent = "consumption" | "loss" | "receipt" | "transfer" | "stock_check" | "unknown";

interface Interpretation {
  intent: Intent;
  confidence: number;
  product_name_raw: string | null;
  product_id: string | null;
  quantity: number | null;
  unit: string | null;
  reason: string | null;
  notes: string | null;
}

const INTENT_META: Record<Intent, { label: string; color: string; event: string | null }> = {
  consumption: { label: "Consumo",       color: "bg-blue-500",    event: "consumption" },
  loss:        { label: "Perda",         color: "bg-destructive", event: "loss" },
  receipt:     { label: "Recebimento",   color: "bg-emerald-500", event: "receipt" },
  transfer:    { label: "Transferência", color: "bg-amber-500",   event: "transfer" },
  stock_check: { label: "Falta estoque", color: "bg-orange-500",  event: "stock_check" },
  unknown:     { label: "Não entendi",   color: "bg-muted",       event: null },
};

function pickExt(mime: string): string {
  const base = mime.split(";")[0];
  return ({ "audio/webm": "webm", "audio/mp4": "mp4", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/ogg": "ogg" } as any)[base] ?? "webm";
}

export function VoiceFAB() {
  const restaurantId = useRestaurantId();
  const { products } = useLabelProducts();

  const [state, setState] = useState<"idle" | "recording" | "processing" | "review">("idle");
  const [transcript, setTranscript] = useState("");
  const [interp, setInterp] = useState<Interpretation | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  };

  useEffect(() => () => cleanupStream(), []);

  const startRecording = useCallback(async () => {
    if (state !== "idle") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data && e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = () => void handleStop(mr.mimeType || "audio/webm");
      mr.start();
      mediaRecorderRef.current = mr;
      startedAtRef.current = Date.now();
      setState("recording");
    } catch {
      toast.error("Não consegui acessar o microfone");
      cleanupStream();
      setState("idle");
    }
  }, [state]);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    const duration = Date.now() - startedAtRef.current;
    if (duration < 400) {
      // Prensa acidental
      try { mr.stop(); } catch {}
      cleanupStream();
      setState("idle");
      toast.info("Segure o botão e fale o comando");
      return;
    }
    try { mr.stop(); } catch {}
  }, []);

  const handleStop = async (mime: string) => {
    setState("processing");
    const blob = new Blob(chunksRef.current, { type: mime });
    cleanupStream();
    if (blob.size < 1500) {
      toast.error("Áudio muito curto — tente novamente");
      setState("idle");
      return;
    }
    try {
      const form = new FormData();
      form.append("file", blob, `voice.${pickExt(mime)}`);
      form.append("restaurant_id", restaurantId || "");
      form.append("filename", `voice.${pickExt(mime)}`);
      const { data, error } = await supabase.functions.invoke("voice-command", { body: form });
      if (error) throw error;
      const t = (data as any)?.transcript || "";
      const i = (data as any)?.interpretation as Interpretation | null;
      if (!i) throw new Error("Sem interpretação");
      setTranscript(t);
      setInterp(i);
      setState("review");
    } catch (e: any) {
      toast.error("Falha ao interpretar: " + (e?.message || e));
      setState("idle");
    }
  };

  const closeReview = () => {
    setState("idle");
    setInterp(null);
    setTranscript("");
  };

  const confirm = async () => {
    if (!interp || !restaurantId) return closeReview();
    const meta = INTENT_META[interp.intent];
    if (!meta.event) {
      toast.error("Não consegui identificar a ação — tente falar novamente");
      return;
    }
    const { error } = await (supabase as any).from("kitchen_events").insert({
      restaurant_id: restaurantId,
      event_type: meta.event,
      product_id: interp.product_id,
      quantity: interp.quantity,
      unit: interp.unit,
      source: "voice",
      payload: {
        transcript,
        interpretation: interp,
        product_name_raw: interp.product_name_raw,
        reason: interp.reason,
        notes: interp.notes,
      },
    });
    if (error) {
      toast.error("Erro ao registrar: " + error.message);
      return;
    }
    toast.success(`${meta.label} registrado`);
    closeReview();
  };

  const updateInterp = (patch: Partial<Interpretation>) =>
    setInterp((prev) => (prev ? { ...prev, ...patch } : prev));

  return (
    <>
      {/* FAB */}
      <div className="fixed bottom-6 right-6 z-40 select-none">
        <button
          type="button"
          aria-label="Falar comando"
          disabled={state === "processing" || state === "review"}
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onMouseLeave={() => state === "recording" && stopRecording()}
          onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
          onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
          className={cn(
            "relative flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg transition-all",
            state === "recording"
              ? "bg-destructive scale-110 shadow-destructive/50"
              : "bg-primary hover:scale-105",
            (state === "processing" || state === "review") && "opacity-60 cursor-not-allowed"
          )}
        >
          {state === "processing" ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : (
            <Mic className={cn("h-7 w-7", state === "recording" && "animate-pulse")} />
          )}
          {state === "recording" && (
            <span className="absolute inset-0 rounded-full border-4 border-destructive/40 animate-ping" />
          )}
        </button>
        {state === "recording" && (
          <div className="absolute -top-9 right-0 whitespace-nowrap rounded-md bg-destructive px-3 py-1 text-xs font-medium text-white shadow">
            Gravando… solte para enviar
          </div>
        )}
      </div>

      {/* Review dialog */}
      <Dialog open={state === "review"} onOpenChange={(o) => !o && closeReview()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" /> Confirmar comando de voz
            </DialogTitle>
          </DialogHeader>

          {interp && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted/50 p-3 text-sm italic">"{transcript}"</div>

              <div className="flex items-center gap-2">
                <span className={cn("rounded px-2 py-0.5 text-xs font-semibold text-white", INTENT_META[interp.intent].color)}>
                  {INTENT_META[interp.intent].label}
                </span>
                <span className="text-xs text-muted-foreground">
                  Confiança: {Math.round((interp.confidence || 0) * 100)}%
                </span>
              </div>

              <div className="grid gap-3">
                <div>
                  <Label className="text-xs">Produto</Label>
                  <Select
                    value={interp.product_id ?? "__none__"}
                    onValueChange={(v) => updateInterp({ product_id: v === "__none__" ? null : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="__none__">
                        {interp.product_name_raw ? `— sem cadastro (${interp.product_name_raw}) —` : "— não vinculado —"}
                      </SelectItem>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Quantidade</Label>
                    <Input
                      type="number"
                      value={interp.quantity ?? ""}
                      onChange={(e) => updateInterp({ quantity: e.target.value === "" ? null : Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Unidade</Label>
                    <Select
                      value={interp.unit ?? "__none__"}
                      onValueChange={(v) => updateInterp({ unit: v === "__none__" ? null : v })}
                    >
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        <SelectItem value="g">g</SelectItem>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="ml">ml</SelectItem>
                        <SelectItem value="l">l</SelectItem>
                        <SelectItem value="un">un</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {(interp.intent === "loss" || interp.reason) && (
                  <div>
                    <Label className="text-xs">Motivo</Label>
                    <Input
                      value={interp.reason ?? ""}
                      onChange={(e) => updateInterp({ reason: e.target.value || null })}
                      placeholder="Ex.: vencido, queimou, caiu"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeReview}>
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
            <Button onClick={confirm} disabled={!interp || interp.intent === "unknown"}>
              <Check className="h-4 w-4 mr-1" /> Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}