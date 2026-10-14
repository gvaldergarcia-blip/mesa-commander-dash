import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import jsQR from "jsqr";
import type { Label } from "@/hooks/useLabels";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: Label | null;
  onConfirmed: () => void | Promise<void>;
}

type Phase = "starting" | "scanning" | "success" | "invalid" | "error";

const normalize = (value: string) => value.trim().toLowerCase();

export function ScanLabelQrDialog({ open, onOpenChange, label, onConfirmed }: Props) {
  const [phase, setPhase] = useState<Phase>("starting");
  const [errorMsg, setErrorMsg] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);
  const handledRef = useRef(false);

  const matches = (raw: string, target: Label) => {
    const value = normalize(raw);
    const candidates = new Set<string>([value]);

    try {
      const url = new URL(raw.trim());
      const segments = url.pathname.split("/").filter(Boolean);
      if (segments.length) candidates.add(normalize(segments[segments.length - 1]));
      for (const key of ["code", "id", "label_id"]) {
        const q = url.searchParams.get(key);
        if (q) candidates.add(normalize(q));
      }
    } catch {
      // not a URL
    }

    try {
      const parsed = JSON.parse(raw);
      for (const key of ["code", "unique_code", "id", "label_id"]) {
        const v = parsed?.[key];
        if (typeof v === "string") candidates.add(normalize(v));
      }
    } catch {
      // not JSON
    }

    const expected = [target.id, target.unique_code].filter(Boolean).map((v) => normalize(String(v)));
    return expected.some((e) => candidates.has(e));
  };

  const stopScanner = async () => {
    stoppedRef.current = true;
    if (rafRef.current) {
      window.clearTimeout(rafRef.current);
      rafRef.current = null;
    }
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((t) => {
      try { t.stop(); } catch { /* ignore */ }
    });
    const video = videoRef.current;
    if (video) {
      try { video.pause(); } catch { /* ignore */ }
      video.srcObject = null;
    }
  };

  const handleDecoded = async (decodedText: string) => {
    if (!label || handledRef.current) return;
    handledRef.current = true;

    if (!matches(decodedText, label)) {
      setPhase("invalid");
      await stopScanner();
      return;
    }

    try {
      setPhase("success");
      await stopScanner();
      await onConfirmed();
      window.setTimeout(() => onOpenChange(false), 700);
    } catch (err: any) {
      setErrorMsg(err?.message ?? "QR lido, mas não foi possível dar baixa.");
      setPhase("error");
      handledRef.current = false;
    }
  };

  /** Lê quadros do vídeo e procura o QR (jsQR), ~8 vezes por segundo. */
  const scanLoop = () => {
    if (stoppedRef.current || handledRef.current) return;
    const video = videoRef.current;
    if (video && video.readyState >= 2 && video.videoWidth > 0) {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      // Recorte central quadrado (onde fica a mira), reduzido para leitura rápida.
      const side = Math.min(vw, vh);
      const sx = (vw - side) / 2;
      const sy = (vh - side) / 2;
      const size = Math.min(720, side);
      const canvas = canvasRef.current ?? (canvasRef.current = document.createElement("canvas"));
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d", { willReadFrequently: true } as any) as CanvasRenderingContext2D | null;
      if (ctx) {
        ctx.drawImage(video, sx, sy, side, side, 0, 0, size, size);
        const img = ctx.getImageData(0, 0, size, size);
        const code = jsQR(img.data, size, size, { inversionAttempts: "attemptBoth" });
        if (code?.data) {
          void handleDecoded(code.data);
          return;
        }
      }
    }
    rafRef.current = window.setTimeout(scanLoop, 120);
  };

  const cameraErrorMessage = (err: any): string => {
    const name = err?.name || "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      return "Permissão da câmera negada. Libere a câmera para este site nas configurações do navegador (no iPhone: Ajustes › navegador › Câmera) e toque em Tentar novamente.";
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") return "Nenhuma câmera encontrada neste aparelho.";
    if (name === "NotReadableError" || name === "AbortError") return "A câmera está sendo usada por outro app. Feche-o e tente novamente.";
    if (!window.isSecureContext) return "A câmera só funciona em endereço seguro (https).";
    return typeof err === "string" ? err : err?.message || "Não foi possível acessar a câmera.";
  };

  const startScanner = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Este navegador não permite usar a câmera aqui. Abra o link no Safari ou Chrome.");
    }
    stoppedRef.current = false;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
    } catch (err: any) {
      if (err?.name === "NotAllowedError" || err?.name === "SecurityError") throw err;
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    }
    if (stoppedRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) throw new Error("Visualização da câmera indisponível.");
    video.setAttribute("playsinline", "true");
    video.muted = true;
    video.srcObject = stream;
    await video.play().catch(() => { /* iOS às vezes rejeita, mas segue tocando */ });
    setPhase("scanning");
    scanLoop();
  };

  useEffect(() => {
    if (!open || !label) return;

    let cancelled = false;
    handledRef.current = false;
    setPhase("starting");
    setErrorMsg("");
    setManualCode("");
    setManualMode(false);

    const boot = async () => {
      try {
        // Aguarda o diálogo montar o <video>.
        await new Promise((resolve) => setTimeout(resolve, 120));
        if (cancelled) return;
        await startScanner();
      } catch (err: any) {
        if (cancelled) return;
        setErrorMsg(cameraErrorMessage(err));
        setPhase("error");
      }
    };

    boot();

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [open, label?.id]);

  const confirmManual = async () => {
    if (!label) return;
    const typed = manualCode.trim();
    if (!typed) return;
    if (!matches(typed, label)) {
      setErrorMsg("O código digitado não corresponde a esta etiqueta.");
      setPhase("invalid");
      return;
    }
    try {
      handledRef.current = true;
      setPhase("success");
      await stopScanner();
      await onConfirmed();
      window.setTimeout(() => onOpenChange(false), 700);
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Não foi possível dar baixa.");
      setPhase("error");
      handledRef.current = false;
    }
  };

  const retry = async () => {
    await stopScanner();
    stoppedRef.current = false;
    handledRef.current = false;
    setPhase("starting");
    setErrorMsg("");
    try {
      await startScanner();
    } catch (err: any) {
      setErrorMsg(cameraErrorMessage(err));
      setPhase("error");
    }
  };

  const title =
    phase === "success"
      ? "Etiqueta confirmada ✓"
      : phase === "invalid"
        ? "QR Code de outra etiqueta"
        : phase === "error"
          ? "Erro de câmera"
          : phase === "starting"
            ? "Iniciando câmera…"
            : "Escaneie o QR da etiqueta";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) void stopScanner();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Aponte a câmera para o QR Code impresso na etiqueta para confirmar a baixa.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <div
            className={cn(
              "relative aspect-square w-full max-w-[300px] overflow-hidden rounded-lg border-2 border-primary/40 bg-black",
              manualMode && "hidden"
            )}
          >
            <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" />

            {phase === "starting" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 text-sm">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                Iniciando câmera…
              </div>
            )}

            {phase === "scanning" && (
              <div className="pointer-events-none absolute inset-6 rounded-md border-2 border-primary/70" />
            )}

            {phase === "success" && (
              <div className="absolute inset-0 flex items-center justify-center bg-success text-success-foreground">
                <CheckCircle2 className="h-20 w-20" />
              </div>
            )}

            {phase === "invalid" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/90 px-4 text-center">
                <XCircle className="h-12 w-12 text-destructive" />
                <p className="text-sm font-medium">Este QR não corresponde ao produto selecionado</p>
              </div>
            )}

            {phase === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/95 px-4 text-center">
                <XCircle className="h-12 w-12 text-destructive" />
                <p className="text-sm font-medium">Não foi possível acessar a câmera</p>
                <p className="break-words text-xs text-muted-foreground">{errorMsg}</p>
              </div>
            )}
          </div>

          <p className="text-center text-sm text-muted-foreground">{label?.product_name}</p>

          {manualMode && phase !== "success" && (
            <div className="w-full space-y-2">
              <Input
                autoFocus
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder={`Código da etiqueta (ex.: ${label?.unique_code ?? "000000"})`}
                className="h-11 text-base"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void confirmManual();
                }}
              />
              {(phase === "invalid" || phase === "error") && errorMsg && (
                <p className="text-xs text-destructive">{errorMsg}</p>
              )}
              <Button className="w-full" onClick={confirmManual} disabled={!manualCode.trim()}>
                Confirmar baixa
              </Button>
            </div>
          )}

          {phase !== "success" && (
            <div className="flex w-full flex-col gap-2">
              {(phase === "invalid" || phase === "error") && !manualMode && (
                <Button className="w-full" onClick={retry}>
                  Tentar novamente
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (manualMode) {
                    setManualMode(false);
                    void retry();
                  } else {
                    void stopScanner();
                    setErrorMsg("");
                    setManualMode(true);
                  }
                }}
              >
                {manualMode ? "Usar a câmera" : "Digitar código da etiqueta"}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
