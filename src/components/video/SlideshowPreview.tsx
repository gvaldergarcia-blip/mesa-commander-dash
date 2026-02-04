import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SlideshowPreviewProps {
  images: string[];
  duration: number;
  promoText?: string;
  restaurantName: string;
}

export function SlideshowPreview({ images, duration, promoText, restaurantName }: SlideshowPreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  // Calculate time per image based on total duration
  const timePerImage = (duration * 1000) / images.length;

  const nextImage = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const prevImage = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(nextImage, timePerImage);
    return () => clearInterval(interval);
  }, [isPlaying, timePerImage, nextImage]);

  return (
    <div className="relative w-full aspect-[9/16] rounded-lg overflow-hidden bg-muted">
      {/* Images */}
      {images.map((url, index) => (
        <img
          key={url}
          src={url}
          alt={`Slide ${index + 1}`}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            index === currentIndex ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
      
      {/* Restaurant name */}
      <div className="absolute top-4 left-4 right-4 flex justify-center">
        <div className="rounded-md bg-background/80 backdrop-blur-sm px-3 py-1 shadow-sm">
          <h3 className="text-foreground font-bold text-xl">{restaurantName}</h3>
        </div>
      </div>

      {/* Promo text */}
      {promoText && (
        <div className="absolute bottom-16 left-4 right-4 text-center">
          <p className="text-primary-foreground font-semibold text-lg bg-primary px-4 py-2 rounded-lg inline-block shadow-sm">
            {promoText}
          </p>
        </div>
      )}

      {/* Progress indicators */}
      <div className="absolute top-2 left-2 right-2 flex gap-1 rounded-full bg-background/40 p-1 backdrop-blur-sm">
        {images.map((_, index) => (
          <div
            key={index}
            className={`h-1 flex-1 rounded-full transition-all ${
              index === currentIndex ? "bg-foreground" : "bg-foreground/30"
            }`}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between rounded-md bg-background/70 backdrop-blur-sm p-1 shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={prevImage}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={nextImage}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Slide counter */}
      <div className="absolute bottom-14 left-1/2 -translate-x-1/2 text-xs text-muted-foreground rounded-full bg-background/70 backdrop-blur-sm px-2 py-0.5">
        {currentIndex + 1} / {images.length}
      </div>
    </div>
  );
}
