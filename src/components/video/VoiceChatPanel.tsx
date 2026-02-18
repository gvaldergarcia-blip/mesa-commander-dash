import { useRef, useEffect } from "react";
import { Mic, MicOff, Volume2, VolumeX, Trash2, MessageCircle, X, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { VoiceChatMessage } from "@/hooks/useVoiceChat";

interface VoiceChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isSupported: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  interimText: string;
  messages: VoiceChatMessage[];
  onStartListening: () => void;
  onStopListening: () => void;
  onStopSpeaking: () => void;
  onClearMessages: () => void;
  onSpeakText: (text: string) => void;
}

export function VoiceChatPanel({
  isOpen,
  onClose,
  isSupported,
  isListening,
  isSpeaking,
  interimText,
  messages,
  onStartListening,
  onStopListening,
  onStopSpeaking,
  onClearMessages,
  onSpeakText,
}: VoiceChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, interimText]);

  if (!isOpen) return null;

  if (!isSupported) {
    return (
      <div className="fixed bottom-20 right-4 w-80 bg-card border border-border rounded-xl shadow-2xl z-50 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" /> Voz Chat
          </h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge para esta funcionalidade.
        </p>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 w-80 bg-card border border-border rounded-xl shadow-2xl z-50 flex flex-col max-h-[460px]">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          Assistente de Voz
          {isListening && (
            <Badge variant="secondary" className="text-[10px] animate-pulse bg-primary/10 text-primary">
              Ouvindo...
            </Badge>
          )}
          {isSpeaking && (
            <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
              Falando...
            </Badge>
          )}
        </h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClearMessages} title="Limpar">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[180px]">
        {messages.length === 0 && !interimText && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center py-6">
            <HelpCircle className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">
              Toque no microfone e fale um comando.<br />
              Ex: "formato vertical", "título meu restaurante", "ajuda"
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {msg.text}
              {msg.role === "assistant" && (
                <button
                  onClick={() => onSpeakText(msg.text)}
                  className="ml-1.5 inline-flex opacity-50 hover:opacity-100 transition-opacity"
                  title="Ouvir novamente"
                >
                  <Volume2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        ))}

        {interimText && (
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-lg px-3 py-2 text-xs bg-primary/20 text-primary italic">
              {interimText}...
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-3 border-t border-border flex items-center justify-center gap-3">
        {isSpeaking && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={onStopSpeaking}
          >
            <VolumeX className="h-3.5 w-3.5" /> Parar
          </Button>
        )}

        <Button
          variant={isListening ? "destructive" : "default"}
          size="lg"
          className={`h-12 w-12 rounded-full p-0 shadow-lg ${
            isListening ? "animate-pulse ring-4 ring-primary/20" : ""
          }`}
          onClick={isListening ? onStopListening : onStartListening}
        >
          {isListening ? (
            <MicOff className="h-5 w-5" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
