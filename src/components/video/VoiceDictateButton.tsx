import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDictation } from "@/hooks/useVoiceChat";

interface VoiceDictateButtonProps {
  onResult: (text: string) => void;
  className?: string;
}

export function VoiceDictateButton({ onResult, className }: VoiceDictateButtonProps) {
  const { isListening, toggle, isSupported } = useDictation(onResult);

  if (!isSupported) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={`h-7 w-7 shrink-0 ${isListening ? "text-primary bg-primary/10 animate-pulse" : "text-muted-foreground"} ${className}`}
            onClick={toggle}
          >
            {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">{isListening ? "Parar ditado" : "Ditar por voz"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
