import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, MapPin, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLabelProducts } from "@/hooks/useLabelProducts";
import { useLabels } from "@/hooks/useLabels";
import { getSectorHex } from "@/lib/labels/sectors";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Combobox premium para "Local / Setor": mostra os setores já usados
 * pelo restaurante (produtos + etiquetas + defaults) e permite digitar
 * um valor novo — que é aprendido automaticamente na próxima abertura.
 */
export function SectorCombobox({
  value,
  onChange,
  placeholder = "Escolha ou digite um local…",
  size = "md",
  className,
}: Props) {
  const { products } = useLabelProducts();
  const { labels } = useLabels();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const known = useMemo(() => {
    // Só mostra locais que REALMENTE existem no restaurante
    // (produtos + etiquetas). Nada de defaults fictícios.
    const count = new Map<string, number>();
    for (const p of products) {
      const k = (p.storage_location || "").trim();
      if (k) count.set(k, (count.get(k) || 0) + 1);
    }
    for (const l of labels as any[]) {
      const k = ((l.storage_location as string) || "").trim();
      if (k && !count.has(k)) count.set(k, 0);
    }
    return Array.from(count.entries())
      .map(([name, c]) => ({ name, count: c }))
      .sort((a, b) => {
        if (a.count !== b.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });
  }, [products, labels]);

  const trimmed = query.trim();
  const filtered = useMemo(() => {
    const q = trimmed.toLowerCase();
    if (!q) return known;
    return known.filter((k) => k.name.toLowerCase().includes(q));
  }, [known, trimmed]);
  const showCreate =
    trimmed.length > 0 &&
    !known.some((k) => k.name.toLowerCase() === trimmed.toLowerCase());

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery("");
  };

  const triggerH = size === "sm" ? "h-8 text-xs" : "h-10 text-sm";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            triggerH,
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="flex items-center gap-2 min-w-0">
            {value ? (
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ background: getSectorHex(value) }}
              />
            ) : (
              <MapPin className="h-3.5 w-3.5 shrink-0 opacity-60" />
            )}
            <span className="truncate">{value || placeholder}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar ou criar local…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {filtered.length === 0 && !showCreate && (
              <CommandEmpty className="py-4 text-xs text-muted-foreground text-center">
                Digite o nome do local para criar.
              </CommandEmpty>
            )}
            {filtered.length > 0 && (
            <CommandGroup heading="Locais existentes">
              {filtered.map((k) => (
                <CommandItem
                  key={k.name}
                  value={k.name}
                  onSelect={() => select(k.name)}
                  className="gap-2"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ background: getSectorHex(k.name) }}
                  />
                  <span className="flex-1 truncate">{k.name}</span>
                  {k.count > 0 && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {k.count} produto{k.count === 1 ? "" : "s"}
                    </span>
                  )}
                  {value === k.name && (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            )}
            {showCreate && (
              <>
                {filtered.length > 0 && <CommandSeparator />}
                <CommandGroup>
                  <CommandItem
                    value={`__create__${trimmed}`}
                    onSelect={() => select(trimmed)}
                    className="gap-2 text-primary"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>
                      Criar novo local: <strong>"{trimmed}"</strong>
                    </span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}