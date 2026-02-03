import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ReservationDatePickerProps {
  value: string;
  onChange: (date: string) => void;
  isDayAvailable: (day: string) => boolean;
  error?: string;
}

export function ReservationDatePicker({
  value,
  onChange,
  isDayAvailable,
  error,
}: ReservationDatePickerProps) {
  const [open, setOpen] = useState(false);

  // Convert string date to Date object for the calendar
  const selectedDate = value ? new Date(value + "T12:00:00") : undefined;

  // Handler for calendar selection
  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const dateStr = format(date, "yyyy-MM-dd");
      if (isDayAvailable(dateStr)) {
        onChange(dateStr);
        setOpen(false);
      }
    }
  };

  // Function to determine if a day should be disabled
  const isDateDisabled = (date: Date): boolean => {
    // Disable past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return true;

    // Disable unavailable days from restaurant calendar
    const dateStr = format(date, "yyyy-MM-dd");
    return !isDayAvailable(dateStr);
  };

  // Custom modifiers for styling unavailable days
  const modifiers = {
    unavailable: (date: Date) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) return false;
      const dateStr = format(date, "yyyy-MM-dd");
      return !isDayAvailable(dateStr);
    },
  };

  const modifiersStyles = {
    unavailable: {
      backgroundColor: "hsl(var(--destructive) / 0.15)",
      color: "hsl(var(--destructive))",
      textDecoration: "line-through",
    },
  };

  return (
    <div className="flex flex-col gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground",
              error && "border-destructive"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(selectedDate!, "dd/MM/yyyy") : "Selecione uma data"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            disabled={isDateDisabled}
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
            locale={ptBR}
            initialFocus
            className="pointer-events-auto"
          />
          <div className="px-4 pb-3 pt-1 border-t">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-primary/20"></div>
                <span>Disponível</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-destructive/20"></div>
                <span>Indisponível</span>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
