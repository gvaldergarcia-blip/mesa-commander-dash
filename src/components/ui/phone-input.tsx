import * as React from "react";
import { cn } from "@/lib/utils";
import { Phone } from "lucide-react";

/**
 * Formata telefone brasileiro: (XX) XXXXX-XXXX
 */
function formatPhoneBR(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Extrai apenas dígitos do telefone
 */
export function extractPhoneDigits(formatted: string): string {
  return formatted.replace(/\D/g, "");
}

/**
 * Valida se é um celular brasileiro válido (11 dígitos, começando com 9)
 */
export function isValidBrazilianPhone(value: string): boolean {
  const digits = extractPhoneDigits(value);
  return digits.length === 11 && digits[2] === "9";
}

/**
 * Converte para formato E.164: +55XXXXXXXXXXX
 */
export function toE164(value: string): string {
  const digits = extractPhoneDigits(value);
  if (digits.length === 11) return `+55${digits}`;
  if (digits.length === 13 && digits.startsWith("55")) return `+${digits}`;
  return `+55${digits}`;
}

interface PhoneInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  showIcon?: boolean;
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, value, onChange, showIcon = true, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatPhoneBR(e.target.value);
      onChange(formatted);
    };

    return (
      <div className="relative">
        {showIcon && (
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        )}
        <input
          type="tel"
          inputMode="numeric"
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            showIcon && "pl-10",
            className,
          )}
          ref={ref}
          value={value}
          onChange={handleChange}
          placeholder="(11) 99999-9999"
          maxLength={15}
          {...props}
        />
      </div>
    );
  },
);
PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
