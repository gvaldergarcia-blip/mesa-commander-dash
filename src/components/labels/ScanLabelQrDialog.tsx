import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import type { Label } from "@/hooks/useLabels";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: Label | null;
  onConfirmed: () => void | Promise<void>;
}

type Phase = "starting" | "scanning" | "success" | "invalid" | "error";

const REGION_ID = "label-discharge-qr-reader";

const normalize = (value: string) => value.trim().toLowerCase();

export function ScanLabelQrDialog({ open, onOpenChange, label, onConfirmed }: Props) {
  const [phase, setPhase] = useState<Phase>("starting");
  const [errorMsg, setErrorMsg] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
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
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
      await scanner.clear();
    } catch {
      // ignore teardown noise
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

  const startScanner = async (exactEnvironment = true) => {
    const scanner = new Html5Qrcode(REGION_ID, false);
    scannerRef.current = scanner;

    await scanner.start(
      (exactEnvironment
        ? { facingMode: { exact: "environment" } }
        : { facingMode: "environment" }) as MediaTrackConstraints,
      { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1, disableFlip: false },
      handleDecoded,
      () => {},
    );

    setPhase("scanning");
  };

  useEffect(() => {
    if (!open || !label) return;

    let cancelled = false;
    stoppedRef.current = false;
    handledRef.current = false;
    setPhase("starting");
    setErrorMsg("");

    const boot = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 60));
        if (cancelled) return;
        try {
          await startScanner(true);
        } catch {
          await stopScanner();
          stoppedRef.current = false;
          await startScanner(false);
        }
      } catch (err: any) {
        setErrorMsg(err?.message ?? "Não foi possível acessar a câmera.");
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
      await new Promise((resolve) => setTimeout(resolve, 80));
      await startScanner(false);
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Falha ao reiniciar a câmera.");
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
          <div className="relative aspect-square w-full max-w-[300px] overflow-hidden rounded-lg border-2 border-primary/40 bg-black">
            <div id={REGION_ID} className="h-full w-full" />

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
                <p className="break-words text-[11px] text-muted-foreground">{errorMsg}</p>
              </div>
            )}
          </div>

          <p className="text-center text-sm text-muted-foreground">{label?.product_name}</p>

          {(phase === "invalid" || phase === "error") && (
            <div className="flex w-full gap-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={retry}>
                Tentar novamente
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
