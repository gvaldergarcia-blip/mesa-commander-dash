import { useRef, useEffect, useState, useCallback } from "react";
import { renderPreviewFrame, type RenderOptions } from "@/lib/video/videoRenderer";
import { Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LivePreviewProps {
  imageUrls: string[];
  format: "vertical" | "square";
  duration: 7 | 15 | 30;
  templateId: string;
  headline: string;
  subtext?: string;
  cta?: string;
  restaurantName: string;
}

export function LivePreview({
  imageUrls,
  format,
  duration,
  templateId,
  headline,
  subtext,
  cta,
  restaurantName,
}: LivePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [loadedImages, setLoadedImages] = useState<HTMLImageElement[]>([]);
  const [currentT, setCurrentT] = useState(0);

  // Load images
  useEffect(() => {
    if (imageUrls.length === 0) {
      setLoadedImages([]);
      return;
    }
    let cancelled = false;
    Promise.all(
      imageUrls.map(
        (url) =>
          new Promise<HTMLImageElement>((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = () => resolve(img); // still resolve to avoid blocking
            img.src = url;
          })
      )
    ).then((imgs) => {
      if (!cancelled) setLoadedImages(imgs.filter((i) => i.complete && i.naturalWidth > 0));
    });
    return () => { cancelled = true; };
  }, [imageUrls]);

  const opts: RenderOptions = {
    images: imageUrls,
    format,
    duration,
    templateId,
    headline: headline || "Seu Título Aqui",
    subtext,
    cta,
    restaurantName: restaurantName || "Restaurante",
  };

  const animate = useCallback(() => {
    if (!canvasRef.current || loadedImages.length === 0) return;

    const elapsed = performance.now() - startRef.current;
    const totalMs = duration * 1000;
    let t = (elapsed % totalMs) / totalMs;
    setCurrentT(t);

    renderPreviewFrame(canvasRef.current, loadedImages, t, opts);
    animRef.current = requestAnimationFrame(animate);
  }, [loadedImages, duration, templateId, headline, subtext, cta, restaurantName, format]);

  useEffect(() => {
    if (!isPlaying || loadedImages.length === 0) {
      cancelAnimationFrame(animRef.current);
      return;
    }
    startRef.current = performance.now();
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying, animate, loadedImages]);

  // Set canvas size
  useEffect(() => {
    if (!canvasRef.current) return;
    // Use smaller preview size
    const w = 360;
    const h = format === "vertical" ? 640 : 360;
    canvasRef.current.width = w;
    canvasRef.current.height = h;
  }, [format]);

  // Draw static frame when not playing
  useEffect(() => {
    if (isPlaying || loadedImages.length === 0 || !canvasRef.current) return;
    renderPreviewFrame(canvasRef.current, loadedImages, currentT, opts);
  }, [isPlaying, loadedImages, templateId, headline, subtext, cta, restaurantName, format]);

  const handleRestart = () => {
    startRef.current = performance.now();
    setCurrentT(0);
    if (!isPlaying) {
      setIsPlaying(true);
    }
  };

  if (imageUrls.length === 0) {
    return (
      <div
        className={`rounded-xl bg-muted/50 border border-border flex flex-col items-center justify-center gap-3 ${
          format === "vertical" ? "aspect-[9/16]" : "aspect-square"
        }`}
      >
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Play className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground text-center px-4">
          Adicione imagens para ver o preview ao vivo
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className={`relative rounded-xl overflow-hidden bg-black shadow-2xl ${
          format === "vertical" ? "aspect-[9/16]" : "aspect-square"
        }`}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ imageRendering: "auto" }}
        />

        {/* Playback controls overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent">
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-white/20 rounded-full"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-white/20 rounded-full"
              onClick={handleRestart}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Progress bar */}
          <div className="flex-1 mx-3 h-1 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full bg-white/80 rounded-full transition-none"
              style={{ width: `${currentT * 100}%` }}
            />
          </div>

          <span className="text-[10px] text-white/70 font-mono">
            {Math.round(currentT * duration)}s / {duration}s
          </span>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        Preview em tempo real • O vídeo final será em 1080p
      </p>
    </div>
  );
}
