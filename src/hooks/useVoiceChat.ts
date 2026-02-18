import { useState, useRef, useCallback, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────
export interface VoiceChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// ─── TTS helpers ──────────────────────────────────────────
function speak(text: string, lang = "pt-BR"): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) {
      reject(new Error("TTS não suportado"));
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.05;
    utterance.pitch = 1;

    // Try to pick a PT-BR voice
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find(
      (v) => v.lang.startsWith("pt") && v.lang.includes("BR")
    ) || voices.find((v) => v.lang.startsWith("pt"));
    if (ptVoice) utterance.voice = ptVoice;

    utterance.onend = () => resolve();
    utterance.onerror = (e) => reject(e);
    window.speechSynthesis.speak(utterance);
  });
}

function stopSpeaking() {
  window.speechSynthesis?.cancel();
}

// ─── STT helpers ──────────────────────────────────────────
function createRecognition(): SpeechRecognition | null {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) return null;
  const rec = new SpeechRec();
  rec.continuous = false;
  rec.interimResults = true;
  rec.lang = "pt-BR";
  return rec;
}

// ─── Voice Assistant Logic ────────────────────────────────
interface VideoFormData {
  headline: string;
  subtext: string;
  format: "vertical" | "square";
  duration: 7 | 15 | 30;
  templateId: string;
  cta: string;
}

function processAssistantCommand(
  transcript: string,
  currentForm: VideoFormData
): { response: string; updates?: Partial<VideoFormData> } {
  const lower = transcript.toLowerCase().trim();

  // Format commands
  if (lower.includes("vertical") || lower.includes("reels") || lower.includes("stories")) {
    return { response: "Formato alterado para vertical (9:16).", updates: { format: "vertical" } };
  }
  if (lower.includes("quadrado") || lower.includes("square") || lower.includes("feed")) {
    return { response: "Formato alterado para quadrado (1:1).", updates: { format: "square" } };
  }

  // Duration
  if (lower.includes("7 segundos") || lower.includes("sete segundos")) {
    return { response: "Duração ajustada para 7 segundos.", updates: { duration: 7 } };
  }
  if (lower.includes("15 segundos") || lower.includes("quinze segundos")) {
    return { response: "Duração ajustada para 15 segundos.", updates: { duration: 15 } };
  }
  if (lower.includes("30 segundos") || lower.includes("trinta segundos")) {
    return { response: "Duração ajustada para 30 segundos.", updates: { duration: 30 } };
  }

  // Template
  const templates: Record<string, string> = {
    elegante: "elegante",
    dinâmico: "dinamico",
    dinamico: "dinamico",
    "ken burns": "kenburns",
    moderno: "moderno",
    minimalista: "minimalista",
  };
  for (const [key, id] of Object.entries(templates)) {
    if (lower.includes(key)) {
      return { response: `Template alterado para ${key}.`, updates: { templateId: id } };
    }
  }

  // CTA
  const ctas = ["reserve agora", "entre na fila", "chame no whatsapp", "veja o cardápio"];
  for (const cta of ctas) {
    if (lower.includes(cta)) {
      return { response: `CTA definido: "${cta}".`, updates: { cta } };
    }
  }
  if (lower.includes("sem cta") || lower.includes("remover cta") || lower.includes("tirar cta")) {
    return { response: "CTA removido.", updates: { cta: "" } };
  }

  // Headline
  if (lower.startsWith("título") || lower.startsWith("headline")) {
    const text = transcript.replace(/^(título|headline)\s*/i, "").trim();
    if (text) {
      return { response: `Headline definido: "${text}".`, updates: { headline: text } };
    }
  }

  // Subtext
  if (lower.startsWith("subtexto") || lower.startsWith("subtítulo") || lower.startsWith("sub texto")) {
    const text = transcript.replace(/^(subtexto|subtítulo|sub texto)\s*/i, "").trim();
    if (text) {
      return { response: `Subtexto definido: "${text}".`, updates: { subtext: text } };
    }
  }

  // Help
  if (lower.includes("ajuda") || lower.includes("comandos") || lower.includes("o que você faz")) {
    return {
      response:
        'Posso ajudar com: "vertical" ou "quadrado" para formato, "7/15/30 segundos" para duração, "elegante/dinâmico/ken burns/moderno/minimalista" para template, "título [texto]" para headline, "subtexto [texto]" para subtexto, e qualquer CTA como "reserve agora". O que deseja?',
    };
  }

  // Status
  if (lower.includes("status") || lower.includes("configuração atual") || lower.includes("como está")) {
    return {
      response: `Configuração atual: formato ${currentForm.format}, ${currentForm.duration} segundos, template ${currentForm.templateId}. Headline: "${currentForm.headline || "não definido"}". ${currentForm.cta ? `CTA: "${currentForm.cta}".` : "Sem CTA."}`,
    };
  }

  // Narrate
  if (lower.includes("narrar") || lower.includes("ler o vídeo") || lower.includes("falar o texto")) {
    const narration = [currentForm.headline, currentForm.subtext, currentForm.cta]
      .filter(Boolean)
      .join(". ");
    if (narration) {
      return { response: narration };
    }
    return { response: "Nenhum texto definido ainda para narrar." };
  }

  // Default
  return {
    response: `Não entendi "${transcript}". Diga "ajuda" para ver os comandos disponíveis.`,
  };
}

// ─── Hook: useVoiceChat ───────────────────────────────────
export function useVoiceChat(
  formData: VideoFormData,
  onFormUpdate: (updates: Partial<VideoFormData>) => void
) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [messages, setMessages] = useState<VoiceChatMessage[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition) &&
    !!window.speechSynthesis;

  // Load voices
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  const addMessage = useCallback((role: "user" | "assistant", text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role, text, timestamp: new Date() },
    ]);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimText("");
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) return;

    const rec = createRecognition();
    if (!rec) return;

    recognitionRef.current = rec;

    rec.onstart = () => setIsListening(true);

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setInterimText(interim);

      if (finalTranscript) {
        setInterimText("");
        addMessage("user", finalTranscript);

        const { response, updates } = processAssistantCommand(finalTranscript, formData);

        if (updates) {
          onFormUpdate(updates);
        }

        addMessage("assistant", response);
        setIsSpeaking(true);
        speak(response)
          .catch(() => {})
          .finally(() => setIsSpeaking(false));
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== "no-speech") {
        console.warn("Speech recognition error:", event.error);
      }
      setIsListening(false);
      setInterimText("");
    };

    rec.onend = () => {
      setIsListening(false);
      setInterimText("");
    };

    rec.start();
  }, [isSupported, formData, addMessage, onFormUpdate]);

  const speakText = useCallback(async (text: string) => {
    setIsSpeaking(true);
    try {
      await speak(text);
    } finally {
      setIsSpeaking(false);
    }
  }, []);

  const stopSpeakingFn = useCallback(() => {
    stopSpeaking();
    setIsSpeaking(false);
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);

  return {
    isSupported,
    isListening,
    isSpeaking,
    interimText,
    messages,
    startListening,
    stopListening,
    speakText,
    stopSpeaking: stopSpeakingFn,
    clearMessages,
  };
}

// ─── Hook: useDictation (for individual fields) ───────────
export function useDictation(onResult: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const toggle = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const rec = createRecognition();
    if (!rec) return;
    recognitionRef.current = rec;

    rec.onstart = () => setIsListening(true);

    rec.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          onResult(event.results[i][0].transcript);
        }
      }
    };

    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    rec.start();
  }, [isListening, onResult]);

  return { isListening, toggle, isSupported };
}
