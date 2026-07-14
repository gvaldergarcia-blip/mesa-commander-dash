import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Sparkles, Zap, Loader2, Check, X, Calendar, ImageOff } from "lucide-react";
import { useStudioAutopilot } from "@/hooks/useStudioAutopilot";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function StudioAutopilotTab() {
  const {
    settings,
    suggestions,
    isLoading,
    upsertSettings,
    generateNow,
    isGenerating,
    resolveSuggestion,
  } = useStudioAutopilot();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-primary/20 text-primary">
            <Zap className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold">Piloto automático semanal</h3>
            <p className="text-xs text-muted-foreground">
              O sistema propõe posts toda semana usando seu cardápio real. Você aprova em 1 clique.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between rounded-lg bg-background/60 border border-border/60 p-3">
            <Label className="text-sm font-semibold">Ativado</Label>
            <Switch
              checked={!!settings?.enabled}
              onCheckedChange={(v) => upsertSettings({ enabled: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg bg-background/60 border border-border/60 p-3">
            <Label className="text-sm font-semibold">Publicar sozinho</Label>
            <Switch
              checked={!!settings?.auto_publish}
              onCheckedChange={(v) => upsertSettings({ auto_publish: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg bg-background/60 border border-border/60 p-3 gap-2">
            <Label className="text-sm font-semibold shrink-0">Posts/semana</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={settings?.weekly_target ?? 3}
              onChange={(e) => upsertSettings({ weekly_target: parseInt(e.target.value, 10) || 3 })}
              className="w-16 h-8 text-center"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">
            {settings?.last_generated_at
              ? `Última geração: ${format(new Date(settings.last_generated_at), "dd/MM 'às' HH:mm", { locale: ptBR })}`
              : "Nenhuma geração ainda."}
          </p>
          <Button size="sm" onClick={() => generateNow()} disabled={isGenerating} className="gap-2">
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Gerar agora
          </Button>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Sugestões da semana</h3>
        {isLoading ? (
          <div className="flex justify-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border/50 rounded-2xl text-muted-foreground">
            <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhuma sugestão pendente.</p>
            <p className="text-xs mt-1">Clique em "Gerar agora" para o sistema propor posts.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {suggestions.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3"
              >
                <div className="flex items-start gap-3">
                  {s.image_url ? (
                    <img
                      src={s.image_url}
                      alt={s.dish_name || ""}
                      className="w-20 h-20 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <ImageOff className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm truncate">{s.dish_name}</h4>
                      {s.status === "approved" && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-success/15 text-success">
                          Aprovado
                        </span>
                      )}
                    </div>
                    {s.suggested_publish_at && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(s.suggested_publish_at), "EEEE dd/MM 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">
                  {s.suggested_copy}
                </p>
                {s.status === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => resolveSuggestion({ id: s.id, status: "dismissed" })}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Pular
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => resolveSuggestion({ id: s.id, status: "approved" })}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" /> Aprovar
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}