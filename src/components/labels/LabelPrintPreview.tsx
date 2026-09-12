import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { QrCode } from "lucide-react";

interface LabelPrintPreviewProps {
  productName: string;
  conservationLabel?: string | null;
  quantityWeight?: string | null;
  originalExpiryDate?: Date | null;
  manipulationDate: Date;
  expiryDate: Date;
  batch?: string | null;
  storageLocation?: string | null;
  brand?: string | null;
  responsible: string;
  restaurantName?: string | null;
  allergens?: string | null;
}

const showDate = (date?: Date | null) => date ? format(date, "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—";

export function LabelPrintPreview({
  productName,
  conservationLabel,
  quantityWeight,
  originalExpiryDate,
  manipulationDate,
  expiryDate,
  batch,
  storageLocation,
  brand,
  responsible,
  restaurantName,
  allergens,
}: LabelPrintPreviewProps) {
  return (
    <section className="space-y-2" aria-label="Prévia da etiqueta">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">Prévia da etiqueta</span>
        <span className="text-[11px] text-muted-foreground">80 × 40 mm</span>
      </div>

      <div className="aspect-[2/1] w-full overflow-hidden rounded-md border-2 border-label-ink/80 bg-label-paper p-3 text-label-ink shadow-sm">
        <div className="flex h-full flex-col overflow-hidden text-[9px] leading-tight sm:text-[10px]">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-extrabold uppercase sm:text-sm">{productName}</p>
              {conservationLabel && <p className="font-bold uppercase">{conservationLabel}</p>}
            </div>
            {quantityWeight && <p className="shrink-0 text-xs font-extrabold sm:text-sm">{quantityWeight}</p>}
          </div>

          <div className="my-1 border-y border-label-ink/80 py-1 font-semibold">
            <p><strong>VAL. ORIGINAL:</strong> {showDate(originalExpiryDate)}</p>
            <p><strong>MANIPULAÇÃO:</strong> {showDate(manipulationDate)}</p>
            <p><strong>VALIDADE:</strong> {showDate(expiryDate)}</p>
            {batch && <p><strong>LOTE:</strong> {batch}</p>}
          </div>

          {storageLocation && <p className="truncate font-semibold"><strong>LOCAL:</strong> {storageLocation.toUpperCase()}</p>}
          {brand && <p className="truncate"><strong>MARCA/FORN:</strong> {brand.toUpperCase()}</p>}

          <div className="mt-auto flex min-h-0 items-end justify-between gap-2">
            <div className="min-w-0 truncate">
              <p className="truncate"><strong>RESP:</strong> {responsible}</p>
              {restaurantName && <p className="truncate font-bold uppercase">{restaurantName}</p>}
            </div>
            <div className="flex shrink-0 flex-col items-center">
              <QrCode className="h-7 w-7 sm:h-9 sm:w-9" aria-hidden="true" />
              <span className="text-[7px] font-bold">QR</span>
            </div>
          </div>

          {allergens && <p className="mt-1 truncate border border-label-ink/80 px-1 text-center font-extrabold uppercase">CONTÉM: {allergens}</p>}
        </div>
      </div>
    </section>
  );
}