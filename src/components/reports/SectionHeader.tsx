import { LucideIcon } from "lucide-react";

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function SectionHeader({ icon: Icon, title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-lg md:text-xl font-bold tracking-tight text-foreground">{title}</h2>
          {subtitle && (
            <p className="text-xs font-light text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

export function SectionDivider() {
  return <div className="h-px w-full bg-foreground/10" />;
}