import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ScriptSegment {
  type: "abertura" | "destaque" | "promocao" | "cta";
  text: string;
  duration_hint: string;
}

export interface GeneratedScript {
  segments: ScriptSegment[];
  full_narration: string;
}

interface GenerateScriptParams {
  headline: string;
  subtext?: string;
  cta?: string;
  restaurantName: string;
  templateId: string;
  duration: 7 | 15 | 30;
  promotion?: string;
}

export function useVideoScript() {
  const [script, setScript] = useState<GeneratedScript | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editedNarration, setEditedNarration] = useState<string>("");

  const generateScript = async (params: GenerateScriptParams) => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-video-script", {
        body: params,
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return null;
      }

      const generated = data as GeneratedScript;
      setScript(generated);
      setEditedNarration(generated.full_narration);
      return generated;
    } catch (err) {
      console.error("Script generation error:", err);
      toast.error("Erro ao gerar roteiro. Tente novamente.");
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const updateSegmentText = (index: number, newText: string) => {
    if (!script) return;
    const updated = { ...script };
    updated.segments = [...updated.segments];
    updated.segments[index] = { ...updated.segments[index], text: newText };
    updated.full_narration = updated.segments.map((s) => s.text).join(" ");
    setScript(updated);
    setEditedNarration(updated.full_narration);
  };

  const resetScript = () => {
    setScript(null);
    setEditedNarration("");
  };

  return {
    script,
    editedNarration,
    setEditedNarration,
    isGenerating,
    generateScript,
    updateSegmentText,
    resetScript,
  };
}
