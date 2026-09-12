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
  restaurantCnpj?: string | null;
  restaurantCep?: string | null;
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
  restaurantCnpj,
  restaurantCep,
  allergens,
}: LabelPrintPreviewProps) {
  const nameSize = productName.length > 54
    ? "text-[8px] sm:text-[9px]"
    : productName.length > 32
      ? "text-[9px] sm:text-[11px]"
      : "text-[11px] sm:text-[13px]";

  return (
    <section className="space-y-2" aria-label="Prévia da etiqueta">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">Prévia da etiqueta</span>
        <span className="text-[11px] text-muted-foreground">80 × 40 mm</span>
      </div>

      <div className="aspect-[2/1] w-full overflow-hidden rounded-md border-2 border-label-ink/80 bg-label-paper px-[2.5%] py-[2%] font-sans text-label-ink shadow-sm">
        <div className="flex h-full flex-col overflow-hidden text-[8px] leading-[1.08] sm:text-[9px]">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className={`${nameSize} break-words font-extrabold uppercase leading-none`}>{productName}</p>
              {conservationLabel && <p className="mt-0.5 font-bold uppercase">{conservationLabel}</p>}
            </div>
            {quantityWeight && <p className="shrink-0 text-[11px] font-extrabold leading-none sm:text-[13px]">{quantityWeight}</p>}
          </div>

          <div className="mt-1 border-y border-label-ink py-1 font-semibold">
            <p className="flex gap-1"><strong className="w-[74px] shrink-0">VAL. ORIGINAL:</strong> {showDate(originalExpiryDate)}</p>
            <p className="flex gap-1"><strong className="w-[74px] shrink-0">MANIPULAÇÃO:</strong> {showDate(manipulationDate)}</p>
            <p className="flex gap-1"><strong className="w-[74px] shrink-0">VALIDADE:</strong> {showDate(expiryDate)}</p>
            {batch && <p className="flex gap-1"><strong className="w-[74px] shrink-0">LOTE:</strong> {batch}</p>}
          </div>

          {storageLocation && <p className="mt-1 truncate font-semibold"><strong>LOCAL:</strong> {storageLocation.toUpperCase()}</p>}
          {brand && <p className="mt-0.5 truncate"><strong>MARCA/FORN:</strong> {brand.toUpperCase()}</p>}

          <div className="mt-auto flex min-h-0 items-end justify-between gap-2">
            <div className="min-w-0 leading-[1.05]">
              <p className="truncate"><strong>RESP:</strong> {responsible}</p>
              {restaurantName && <p className="truncate font-bold uppercase">{restaurantName}</p>}
              {restaurantCnpj && <p className="truncate"><strong>CNPJ:</strong> {restaurantCnpj}</p>}
              {restaurantCep && <p className="truncate"><strong>CEP:</strong> {restaurantCep}</p>}
            </div>
            <div className="flex shrink-0 flex-col items-center">
              <QrCode className="h-9 w-9 sm:h-11 sm:w-11" strokeWidth={1.8} aria-hidden="true" />
              <span className="text-[6px] font-extrabold">#CÓDIGO</span>
            </div>
          </div>

          {allergens && <p className="mt-1 truncate border border-label-ink/80 px-1 text-center font-extrabold uppercase">CONTÉM: {allergens}</p>}
        </div>
      </div>
    </section>
  );
}