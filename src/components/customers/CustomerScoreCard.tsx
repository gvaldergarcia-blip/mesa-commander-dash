import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Trophy, Shield, Star } from "lucide-react";

interface CustomerScoreProps {
  score: number;
  tags: string[];
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-primary';
  if (score >= 40) return 'text-warning';
  return 'text-destructive';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excelente';
  if (score >= 60) return 'Bom';
  if (score >= 40) return 'Regular';
  return 'Atenção';
}

function getProgressColor(score: number): string {
  if (score >= 80) return '[&>div]:bg-success';
  if (score >= 60) return '[&>div]:bg-primary';
  if (score >= 40) return '[&>div]:bg-warning';
  return '[&>div]:bg-destructive';
}

const tagConfig: Record<string, { className: string; icon?: typeof Star }> = {
  'VIP': { className: 'bg-amber-500/15 text-amber-600 border-amber-500/30', icon: Star },
  'Frequente': { className: 'bg-success/15 text-success border-success/30' },
  'Em risco': { className: 'bg-destructive/15 text-destructive border-destructive/30' },
  'Instável': { className: 'bg-warning/15 text-warning border-warning/30' },
};

export function CustomerScore({ score, tags }: CustomerScoreProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center w-16 h-16">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor"
                className="text-muted/30" strokeWidth="5" />
              <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor"
                className={getScoreColor(score)}
                strokeWidth="5" strokeDasharray={`${(score / 100) * 175.9} 175.9`}
                strokeLinecap="round" />
            </svg>
            <span className={cn("absolute text-lg font-bold", getScoreColor(score))}>
              {score}
            </span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className={cn("w-4 h-4", getScoreColor(score))} />
              <span className="text-sm font-semibold">Score MesaClik</span>
              <Badge variant="outline" className={cn("text-[10px]", getScoreColor(score))}>
                {getScoreLabel(score)}
              </Badge>
            </div>
            <Progress value={score} className={cn("h-1.5 mb-2", getProgressColor(score))} />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const config = tagConfig[tag] || { className: 'bg-muted text-muted-foreground' };
                  return (
                    <Badge key={tag} variant="outline" className={cn("text-[10px] gap-1", config.className)}>
                      {config.icon && <config.icon className="w-3 h-3" />}
                      {tag}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
