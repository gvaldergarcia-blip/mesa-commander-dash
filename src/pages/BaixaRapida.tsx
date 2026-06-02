import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/contexts/RestaurantContext";
import { useLabels } from "@/hooks/useLabels";
import { Html5Qrcode } from "html5-qrcode";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Delete, LogOut, ScanLine, Loader2, X, ArrowRight, Snowflake, Flame, Thermometer, Refrigerator, AlertTriangle } from "lucide-react";
import { CONSERVATION_LABEL, classifyExpiry } from "@/lib/labels/utils";
import { getCategoryHex } from "@/lib/labels/categories";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

type Employee = { id: string; name: string; role: string | null; sectors?: string[] | null };
type Phase = "pin" | "list" | "camera-permission" | "scan";
type ScannerInput = Parameters<Html5Qrcode["start"]>[0];
type ScannerConfig = Parameters<Html5Qrcode["start"]>[1];
type WarmupCameraResult = { deviceId: string | null };
const STORAGE_KEY = "yeschef-operator-session";
const SCAN_REGION = "operator-qr-reader";

function getBrowserInfo() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Instagram|FBAN|FBAV/i.test(ua);

  return { ua, isIOS, isSafari };
}

// Configuração padrão do leitor — qrbox responsivo, fps alto e resolução de vídeo elevada
// para que o html5-qrcode consiga decodificar QRs pequenos impressos em etiquetas 80x40mm.
const QR_CONFIG_BASE: ScannerConfig = {
  fps: 15,
  qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
    const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
    const size = Math.floor(minEdge * 0.8);
    return { width: size, height: size };
  },
  disableFlip: false,
};

function getScannerConfig(attempt: ScannerInput): ScannerConfig {
  const { isIOS } = getBrowserInfo();

  if (typeof attempt === "string" || isIOS) {
    return QR_CONFIG_BASE;
  }

  return {
    ...QR_CONFIG_BASE,
    videoConstraints: {
      ...attempt,
      width: { ideal: 1280 },
      height: { ideal: 720 },
    } as MediaTrackConstraints,
  };
}

const conservationIcon = (c: string | null) => {
  switch (c) {
    case "frozen": return Snowflake;
    case "hot": return Flame;
    case "ambient": return Thermometer;
    default: return Refrigerator;
  }
};

function extractCode(raw: string): string | null {
  const value = raw.trim();
  try {
    const url = new URL(value);
    const seg = url.pathname.split("/").filter(Boolean).pop();
    if (seg && /^[A-Z0-9]{4,12}$/i.test(seg)) return seg.toUpperCase();
  } catch {
    /* not a URL */
  }
  const m = value.match(/[A-Z0-9]{4,12}/i);
  return m ? m[0].toUpperCase() : null;
}

async function decodeQrFromImageFile(file: File): Promise<string | null> {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Não foi possível abrir a foto selecionada."));
      img.src = imageUrl;
    });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
      throw new Error("Não foi possível processar a foto selecionada.");
    }

    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const attempts = [
      { sx: 0, sy: 0, sw: canvas.width, sh: canvas.height },
      {
        sx: Math.max(0, Math.floor(canvas.width * 0.12)),
        sy: Math.max(0, Math.floor(canvas.height * 0.12)),
        sw: Math.max(1, Math.floor(canvas.width * 0.76)),
        sh: Math.max(1, Math.floor(canvas.height * 0.76)),
      },
      {
        sx: Math.max(0, Math.floor(canvas.width * 0.22)),
        sy: Math.max(0, Math.floor(canvas.height * 0.22)),
        sw: Math.max(1, Math.floor(canvas.width * 0.56)),
        sh: Math.max(1, Math.floor(canvas.height * 0.56)),
      },
    ];

    for (const attempt of attempts) {
      const imageData = context.getImageData(attempt.sx, attempt.sy, attempt.sw, attempt.sh);
      const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "attemptBoth",
      });

      const code = extractCode(decoded?.data ?? "");
      if (code) return code;
    }

    return null;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export default function BaixaRapida() {
  const navigate = useNavigate();
  const restaurantId = useRestaurantId();
  const { labels, isLoading: labelsLoading, refetch } = useLabels();

  const [phase, setPhase] = useState<Phase>("pin");
  const [pin, setPin] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [pinError, setPinError] = useState("");
  const [employee, setEmployee] = useState<Employee | null>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Employee) : null;
    } catch {
      return null;
    }
  });
  const [startingScan, setStartingScan] = useState(false);
  const [processingFileScan, setProcessingFileScan] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { isIOS, isSafari } = getBrowserInfo();
  const shouldUseNativePhotoScanner = isIOS && isSafari;

  useEffect(() => {
    if (employee && phase === "pin") setPhase("list");
  }, [employee, phase]);

  // === PIN ===
  const handleDigit = (d: string) => {
    if (verifying) return;
    setPinError("");
    setPin((p) => (p.length >= 6 ? p : p + d));
  };
  const handleBackspace = () => { setPinError(""); setPin((p) => p.slice(0, -1)); };
  const handleClear = () => { setPinError(""); setPin(""); };

  const verifyPin = async (value: string) => {
    if (!restaurantId) { setPinError("Restaurante não identificado"); return; }
    setVerifying(true);
    const { data, error } = await (supabase as any).rpc("verify_employee_pin", {
      p_restaurant_id: restaurantId, p_pin: value,
    });
    setVerifying(false);
    if (error) { setPinError("Erro ao validar PIN"); setPin(""); return; }
    const found = Array.isArray(data) ? data[0] : data;
    if (!found) {
      setPinError("PIN incorreto");
      setPin("");
      try { navigator.vibrate?.(120); } catch {}
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(found));
    setEmployee(found);
    setPhase("list");
    toast.success(`Olá, ${found.name.split(" ")[0]}!`);
  };

  useEffect(() => {
    if (pin.length >= 4 && phase === "pin" && !verifying) {
      // auto-verify on 4-6 chars after small delay so user sees the dot
      const t = setTimeout(() => verifyPin(pin), 180);
      return () => clearTimeout(t);
    }
  }, [pin, phase]);

  const handleLogout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setEmployee(null);
    setPin("");
    setPhase("pin");
  };

  const getCameraErrorMessage = (err: any) => {
    const name = err?.name || "";
    const rawMessage = typeof err === "string" ? err : typeof err?.message === "string" ? err.message : "";
    const normalizedError = `${name} ${rawMessage}`.toLowerCase();
    const isSecure = window.isSecureContext;
    const { isIOS, isSafari } = getBrowserInfo();

    if (isIOS && !isSafari) {
      return "No iPhone, o scanner funciona melhor no Safari. Abra o sistema no Safari e tente novamente.";
    }

    if (/notreadableerror|aborterror|trackstarterror|could not start video source|device in use|start video source/i.test(normalizedError)) {
      return "A câmera foi liberada, mas o vídeo não iniciou no iPhone. Feche outras abas ou apps usando a câmera e tente novamente.";
    }

    if (name === "NotAllowedError" || /permission denied|permission dismissed|user denied|denied permission/i.test(normalizedError)) {
      return "Permissão de câmera negada. Libere a câmera nas configurações do Safari/navegador e tente novamente.";
    }

    if (name === "NotFoundError") {
      return "Nenhuma câmera encontrada neste dispositivo.";
    }

    if (name === "NotReadableError") {
      return "A câmera está em uso por outro aplicativo.";
    }

    if (!isSecure) {
      return "Acesso à câmera exige HTTPS. Abra o sistema pelo domínio oficial.";
    }

    return err?.message ? `Câmera: ${err.message}` : "Não foi possível acessar a câmera.";
  };

  const handleStartScan = async () => {
    if (startingScan || processingFileScan) return;

    if (shouldUseNativePhotoScanner) {
      try {
        handledRef.current = false;
        flushSync(() => setPhase("scan"));
        ensureScannerRegion();
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
          fileInputRef.current.click();
          return;
        }
        throw new Error("Não foi possível abrir a câmera do iPhone.");
      } catch (err: any) {
        console.error("[BaixaRapida] native photo scan open error:", err);
        setPhase("list");
        toast.error("Não consegui abrir a câmera/fotos do iPhone. Tente novamente.");
        return;
      }
    }

    try {
      setStartingScan(true);
      handledRef.current = false;

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Seu navegador não suporta acesso à câmera.");
      }

      const warmupResult = await warmupCameraPermission();

      flushSync(() => setPhase("scan"));
      ensureScannerRegion();

      await startScannerWithFallbacks(warmupResult?.deviceId ?? null);
    } catch (err: any) {
      console.error("[BaixaRapida] camera start error:", err);
      setPhase("list");
      toast.error(getCameraErrorMessage(err));
    } finally {
      setStartingScan(false);
    }
  };

  // === LIST ===
  const myLabels = useMemo(() => {
    if (!employee) return [];
    const sectors = (employee.sectors ?? []).filter(Boolean);
    const pending = labels.filter((l) => l.status !== "discharged");
    const filtered = sectors.length === 0
      ? pending // sem setores definidos: mostra tudo do restaurante
      : pending.filter((l) => l.product_category && sectors.includes(l.product_category));

    // Ordenar por urgência: CRÍTICO (vencida/hoje) > ATENÇÃO (amanhã) > OK
    const rank = (l: typeof filtered[number]) => {
      const c = classifyExpiry(l.expiry_date);
      if (c === "expired" || l.status === "expired") return 0;
      if (c === "today") return 1;
      if (c === "tomorrow") return 2;
      return 3;
    };
    return [...filtered].sort((a, b) => {
      const r = rank(a) - rank(b);
      if (r !== 0) return r;
      return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
    });
  }, [labels, employee]);

  // === SCANNER ===
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const pause = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

  const stopScanner = async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (!s) return;
    try { if (s.isScanning) await s.stop(); await s.clear(); } catch {}
  };

  const handleNativePhotoScan = async (file: File) => {
    handledRef.current = false;
    setProcessingFileScan(true);

    try {
      flushSync(() => setPhase("scan"));
      ensureScannerRegion();
      await stopScanner();

      let code = await decodeQrFromImageFile(file);

      if (!code) {
        const scanner = new Html5Qrcode(SCAN_REGION, false);
        scannerRef.current = scanner;
        const decoded = await scanner.scanFile(file, false);
        code = extractCode(decoded);
      }

      if (!code) {
        throw new Error("QR Code não reconhecido na imagem selecionada.");
      }

      handledRef.current = true;
      try { navigator.vibrate?.(80); } catch {}
      await stopScanner();
      navigate(`/etiquetas/scan/${code}?op=1`);
    } catch (err) {
      console.error("[BaixaRapida] native photo scan error:", err);
      await stopScanner();
      toast.error("Não consegui ler o QR desta foto. Tente novamente com a etiqueta inteira no enquadramento e boa luz.");
    } finally {
      setProcessingFileScan(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleNativePhotoInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    await handleNativePhotoScan(file);
  };

  const handleManualCodeSubmit = async () => {
    const code = extractCode(manualCode);

    if (!code) {
      toast.error("Digite o código da etiqueta como aparece abaixo do QR.");
      return;
    }

    handledRef.current = true;
    await stopScanner();
    navigate(`/etiquetas/scan/${code}?op=1`);
  };

  const releaseWarmupStream = async (stream: MediaStream) => {
    const tracks = stream.getTracks();

    const endedPromises = tracks.map(
      (track) =>
        new Promise<void>((resolve) => {
          if (track.readyState === "ended") {
            resolve();
            return;
          }

          track.addEventListener("ended", () => resolve(), { once: true });
        })
    );

    tracks.forEach((track) => track.stop());

    await Promise.race([Promise.all(endedPromises).then(() => undefined), pause(180)]);
  };

  const openCameraWithinGesture = async (): Promise<WarmupCameraResult | null> => {
    const { isIOS, isSafari } = getBrowserInfo();
    if (!isIOS || !isSafari) return null;

    console.info("[BaixaRapida] iPhone/Safari preflight getUserMedia");

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    });

    const track = stream.getVideoTracks()[0] ?? null;
    const deviceId = track?.getSettings?.().deviceId ?? null;

    console.info("[BaixaRapida] warmup stream acquired", {
      hasDeviceId: Boolean(deviceId),
      label: track?.label || null,
    });

    await releaseWarmupStream(stream);

    return { deviceId };
  };

  const warmupCameraPermission = async (): Promise<WarmupCameraResult | null> => {
    const { isIOS, isSafari } = getBrowserInfo();
    if (!isIOS || !isSafari) return null;

    flushSync(() => setPhase("camera-permission"));
    ensureScannerRegion();
    return openCameraWithinGesture();
  };

  const ensureScannerRegion = () => {
    const region = document.getElementById(SCAN_REGION);

    if (!region) {
      throw new Error("Área do scanner não ficou pronta.");
    }

    return region;
  };

  const startScannerSession = async (constraints: ScannerInput) => {
    ensureScannerRegion();
    const scanner = new Html5Qrcode(SCAN_REGION, false);
    scannerRef.current = scanner;
    await scanner.start(
      constraints,
      getScannerConfig(constraints),
      (decoded) => {
        if (handledRef.current) return;
        const code = extractCode(decoded);
        if (!code) return;
        handledRef.current = true;
        try { navigator.vibrate?.(80); } catch {}
        void stopScanner();
        navigate(`/etiquetas/scan/${code}?op=1`);
      },
      () => {}
    );
  };

  const startScannerWithFallbacks = async (preferredDeviceId: string | null = null) => {
    const { isIOS } = getBrowserInfo();
    let lastError: unknown;

    if (isIOS) {
      await pause(180);
    }

    const attempts: ScannerInput[] = isIOS
      ? [
          ...(preferredDeviceId ? [preferredDeviceId] : []),
          { facingMode: "environment" } as ScannerInput,
          { facingMode: "user" } as ScannerInput,
        ]
      : [
          { facingMode: { exact: "environment" } } as ScannerInput,
          { facingMode: "environment" } as ScannerInput,
          { facingMode: "user" } as ScannerInput,
        ];

    for (const attempt of attempts) {
      try {
        if (scannerRef.current) {
          await stopScanner();
        }

        console.info("[BaixaRapida] starting scanner attempt:", attempt);
        await startScannerSession(attempt);
        return;
      } catch (error) {
        lastError = error;
        console.warn("[BaixaRapida] scanner attempt failed:", attempt, error);
      }
    }

    if (!isIOS) {
      try {
        const cameras = await Html5Qrcode.getCameras();
        const orderedCameraIds = [
          ...cameras.filter((camera) => /back|rear|traseira|environment/i.test(camera.label)).map((camera) => camera.id),
          ...cameras.filter((camera) => !/back|rear|traseira|environment/i.test(camera.label)).map((camera) => camera.id),
        ];

        for (const cameraId of orderedCameraIds) {
          try {
            if (scannerRef.current) {
              await stopScanner();
            }

            await startScannerSession(cameraId);
            return;
          } catch (error) {
            lastError = error;
            console.warn("[BaixaRapida] camera id attempt failed:", cameraId, error);
          }
        }
      } catch (cameraListError) {
        console.warn("[BaixaRapida] could not list cameras:", cameraListError);
      }
    }

    throw lastError;
  };

  useEffect(() => {
    if (phase === "scan" || phase === "camera-permission") return;
    void stopScanner();
  }, [phase]);

  useEffect(() => {
    return () => { void stopScanner(); };
  }, []);

  // Refetch labels on returning from scan
  useEffect(() => {
    const onFocus = () => { if (employee) refetch(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [employee, refetch]);

  // ===================== RENDER =====================
  return (
    <div className="fixed inset-0 z-50 bg-[#0F0F1A] text-white overflow-hidden flex flex-col">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleNativePhotoInputChange}
      />

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#2D2D44] bg-[#161626]">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-2xl bg-[#FF6B00]/15 border border-[#FF6B00]/30 flex items-center justify-center shadow-[0_10px_24px_rgba(255,107,0,0.12)]">
            <ScanLine className="h-5 w-5 text-[#FF6B00]" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight">Modo Operador</div>
            <div className="text-[10px] uppercase tracking-widest text-[#718096]">
              {phase === "pin"
                ? "Identifique-se"
                : phase === "camera-permission"
                ? "Autorizando câmera"
                : phase === "scan"
                ? "Escaneando"
                : employee?.name}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {employee && (
            <Button size="sm" variant="ghost" onClick={handleLogout} className="rounded-full text-[#A0AEC0] hover:text-white hover:bg-[#2D2D44] gap-1.5">
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sair</span>
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => navigate("/etiquetas")} className="rounded-full text-[#718096] hover:text-white hover:bg-[#2D2D44]">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* ============== PHASE: PIN ============== */}
      {phase === "pin" && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-1">Digite seu PIN</h1>
            <p className="text-sm text-[#718096]">4 a 6 dígitos</p>
          </div>

          {/* dots */}
          <div className="flex gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-4 w-4 rounded-full border-2 transition-all",
                  i < pin.length
                    ? pinError
                      ? "bg-[#E53E3E] border-[#E53E3E]"
                      : "bg-[#FF6B00] border-[#FF6B00] scale-110"
                    : "border-[#2D2D44]"
                )}
              />
            ))}
          </div>

          <div className="h-5 text-sm font-medium text-[#E53E3E]">
            {verifying ? <span className="text-[#A0AEC0] flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Verificando…</span> : pinError}
          </div>

          {/* keypad */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
            {["1","2","3","4","5","6","7","8","9"].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handleDigit(n)}
                disabled={verifying}
                className="aspect-square rounded-2xl bg-[#1A1A2E] border border-[#2D2D44] text-3xl font-bold active:scale-95 active:bg-[#22223A] transition-transform disabled:opacity-50"
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              disabled={verifying}
              className="aspect-square rounded-2xl bg-[#1A1A2E] border border-[#2D2D44] text-xs font-bold uppercase tracking-wider text-[#A0AEC0] active:scale-95 disabled:opacity-50"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => handleDigit("0")}
              disabled={verifying}
              className="aspect-square rounded-2xl bg-[#1A1A2E] border border-[#2D2D44] text-3xl font-bold active:scale-95 active:bg-[#22223A] transition-transform disabled:opacity-50"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              disabled={verifying}
              className="aspect-square rounded-2xl bg-[#1A1A2E] border border-[#2D2D44] flex items-center justify-center active:scale-95 disabled:opacity-50"
            >
              <Delete className="h-6 w-6 text-[#A0AEC0]" />
            </button>
          </div>
        </div>
      )}

      {/* ============== PHASE: LIST ============== */}
      {phase === "list" && employee && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-3 bg-[#161626] border-b border-[#2D2D44]">
            <div className="text-[10px] uppercase tracking-widest text-[#718096] mb-0.5">Suas etiquetas pendentes</div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">{myLabels.length}</span>
              <span className="text-sm text-[#A0AEC0]">para dar baixa</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {labelsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#FF6B00]" /></div>
            ) : myLabels.length === 0 ? (
              <div className="text-center py-16 text-[#718096]">
                <div className="text-5xl mb-3">✅</div>
                <p className="font-medium text-white">Todos os produtos do seu setor estão em dia</p>
                <p className="text-sm mt-1">Use o botão Escanear para qualquer etiqueta.</p>
              </div>
            ) : (
              myLabels.map((l) => {
                const Icon = conservationIcon(l.conservation_method);
                const cls = classifyExpiry(l.expiry_date);
                const isExp = cls === "expired" || l.status === "expired";
                const borderColor = getCategoryHex(l.product_category);
                const urgency =
                  isExp || cls === "today"
                    ? { label: "CRÍTICO", bg: "#7F1D1D", fg: "#FECACA" }
                    : cls === "tomorrow"
                    ? { label: "ATENÇÃO", bg: "#78350F", fg: "#FDE68A" }
                    : { label: "OK", bg: "#14532D", fg: "#BBF7D0" };
                return (
                  <button
                    key={l.id}
                    onClick={() => navigate(`/etiquetas/scan/${l.unique_code}?op=1`)}
                    className="w-full text-left flex items-center gap-3 px-3 py-3 rounded-[1.35rem] bg-[#1A1A2E] border border-[#2D2D44] hover:bg-[#1F1F3A] active:scale-[0.99] transition-all"
                    style={{ borderLeftWidth: 4, borderLeftColor: borderColor }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-white truncate">{l.product_name}</span>
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
                          style={{ backgroundColor: urgency.bg, color: urgency.fg }}
                        >
                          {urgency.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#A0AEC0]">
                        <span className="flex items-center gap-1"><Icon className="h-3 w-3" /> {CONSERVATION_LABEL[l.conservation_method || ""] || "—"}</span>
                        <span>Val: <span className="text-white font-medium">{format(new Date(l.expiry_date), "dd/MM", { locale: ptBR })}</span></span>
                        <span className="font-mono text-[10px] text-[#FF6B00]">#{l.unique_code}</span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[#718096] shrink-0" />
                  </button>
                );
              })
            )}
          </div>

          {/* Fixed CTA */}
          <div className="p-4 border-t border-[#2D2D44] bg-[#161626]">
            <Button
              onClick={handleStartScan}
              disabled={startingScan}
              className="w-full h-16 rounded-full text-base bg-[#FF6B00] hover:bg-[#E55A00] text-white gap-2 shadow-[0_20px_40px_rgba(255,107,0,0.22)]"
            >
              {startingScan ? <Loader2 className="h-6 w-6 animate-spin" /> : <ScanLine className="h-6 w-6" />}
              {startingScan ? "Abrindo câmera..." : "Escanear etiqueta"}
            </Button>
          </div>
        </div>
      )}

      {/* ============== PHASE: SCAN ============== */}
      <div
        className={cn(
          "flex-1 flex flex-col items-center justify-center px-4 py-6 gap-4 bg-black",
          phase !== "camera-permission" && phase !== "scan" && "hidden"
        )}
      >
          <div className="relative w-full max-w-sm aspect-square rounded-[2rem] overflow-hidden bg-black border-2 border-[#FF6B00]/40 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
            <div id={SCAN_REGION} className="w-full h-full" />
            <div className="pointer-events-none absolute inset-8 border-2 border-[#FF6B00]/70 rounded-[1.5rem]" />
            <div
              className="pointer-events-none absolute left-8 right-8 h-0.5 bg-[#FF6B00] shadow-[0_0_16px_#FF6B00] animate-[scanline_1.6s_ease-in-out_infinite]"
              style={{ top: 32 }}
            />
            {shouldUseNativePhotoScanner && phase === "scan" && !processingFileScan && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-center px-6">
                <div className="h-16 w-16 rounded-2xl bg-[#FF6B00]/15 border border-[#FF6B00]/30 flex items-center justify-center">
                  <ScanLine className="h-8 w-8 text-[#FF6B00]" />
                </div>
                <div className="space-y-2 max-w-xs">
                  <h1 className="text-xl font-bold text-white">Abrir câmera do iPhone</h1>
                  <p className="text-sm text-[#A0AEC0]">
                    No Safari, vamos usar a câmera/foto nativa do iPhone para ler a etiqueta com mais estabilidade.
                  </p>
                </div>
              </div>
            )}
            {phase === "camera-permission" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-center px-6">
                <div className="h-16 w-16 rounded-2xl bg-[#FF6B00]/15 border border-[#FF6B00]/30 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[#FF6B00]" />
                </div>
                <div className="space-y-2 max-w-xs">
                  <h1 className="text-xl font-bold text-white">Autorize o uso da câmera</h1>
                  <p className="text-sm text-[#A0AEC0]">
                    Toque em Permitir no aviso do navegador. Assim que a câmera for liberada, o leitor abre automaticamente.
                  </p>
                </div>
              </div>
            )}
          </div>
          <p className="text-sm text-[#A0AEC0] text-center max-w-xs">
            {shouldUseNativePhotoScanner && phase === "scan"
              ? "Toque em abrir câmera/fotos para fotografar a etiqueta ou escolher uma imagem já tirada."
              : phase === "camera-permission"
              ? "Estamos aguardando a liberação da câmera pelo navegador."
              : "Aponte a câmera para o QR Code da etiqueta. A baixa abre automaticamente."}
          </p>
          {shouldUseNativePhotoScanner && phase === "scan" && (
            <Button
              onClick={handleStartScan}
              disabled={processingFileScan}
              className="w-full max-w-sm h-14 rounded-full text-base bg-[#FF6B00] hover:bg-[#E55A00] text-white gap-2 shadow-[0_20px_40px_rgba(255,107,0,0.22)]"
            >
              {processingFileScan ? <Loader2 className="h-5 w-5 animate-spin" /> : <ScanLine className="h-5 w-5" />}
              {processingFileScan ? "Lendo foto..." : "Abrir câmera/fotos"}
            </Button>
          )}
          <div className="w-full max-w-sm rounded-[1.5rem] border border-[#2D2D44] bg-[#161626] p-3 space-y-2">
            <div>
              <p className="text-sm font-semibold text-white">Código da etiqueta</p>
              <p className="text-xs text-[#A0AEC0]">Se o QR estiver difícil de ler, digite o código impresso abaixo dele.</p>
            </div>
            <div className="flex gap-2">
              <Input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleManualCodeSubmit();
                  }
                }}
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Ex.: ABC123"
                className="h-12 border-[#2D2D44] bg-[#0F0F1A] text-white placeholder:text-[#718096] uppercase"
              />
              <Button
                type="button"
                onClick={() => void handleManualCodeSubmit()}
                disabled={!manualCode.trim()}
                className="h-12 rounded-full bg-[#FF6B00] px-5 hover:bg-[#E55A00]"
              >
                Abrir
              </Button>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setPhase("list")}
            className="rounded-full bg-transparent border-[#2D2D44] text-[#A0AEC0] hover:bg-[#2D2D44] hover:text-white"
          >
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>
          <style>{`
            @keyframes scanline{0%{transform:translateY(0)}50%{transform:translateY(240px)}100%{transform:translateY(0)}}
            #${SCAN_REGION} video { width: 100% !important; height: 100% !important; object-fit: cover !important; }
            #${SCAN_REGION} { display:flex; align-items:center; justify-content:center; }
          `}</style>
        </div>
    </div>
  );
}