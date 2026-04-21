import { cn } from '@/lib/utils';

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface Props {
  value: number[];
  onChange: (days: number[]) => void;
}

export function WeekdaysSelector({ value, onChange }: Props) {
  const toggle = (day: number) => {
    if (value.includes(day)) {
      onChange(value.filter((d) => d !== day));
    } else {
      onChange([...value, day].sort((a, b) => a - b));
    }
  };

  return (
    <div className="flex gap-1.5 flex-wrap">
      {DAY_LABELS.map((label, idx) => {
        const active = value.includes(idx);
        return (
          <button
            key={idx}
            type="button"
            onClick={() => toggle(idx)}
            className={cn(
              'h-9 min-w-[44px] px-2 rounded-md text-xs font-medium border transition-colors',
              active
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground',
            )}
            aria-pressed={active}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function formatActiveDays(days: number[] | null | undefined): string {
  if (!days || days.length === 0) return 'Nenhum dia';
  if (days.length === 7) return 'Todos os dias';
  const sorted = [...days].sort((a, b) => a - b);
  // Mon-Fri shortcut
  if (sorted.length === 5 && sorted.every((d, i) => d === i + 1)) return 'Seg a Sex';
  // Sat-Sun shortcut
  if (sorted.length === 2 && sorted[0] === 0 && sorted[1] === 6) return 'Fins de semana';
  return sorted.map((d) => DAY_LABELS[d]).join(' · ');
}